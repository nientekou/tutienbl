"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatReplayService = void 0;
// V13 D-03: Chiến Lược Phân Tích (Combat Replay & Analysis)
const database_1 = __importDefault(require("../database/database"));
class CombatReplayService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS combat_replays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        enemy_name TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
    `);
    }
    storeReplay(userId, result, enemyName) {
        this.initTable();
        const info = database_1.default.prepare('INSERT INTO combat_replays (user_id, result_json, enemy_name) VALUES (?, ?, ?)').run(userId, JSON.stringify(result), enemyName);
        // V16 E-02: Keep last 20 only
        database_1.default.prepare(`
      DELETE FROM combat_replays WHERE user_id = ? AND id NOT IN (
        SELECT id FROM combat_replays WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      )
    `).run(userId, userId);
        return info.lastInsertRowid;
    }
    analyze(result) {
        const log = result.log;
        const tips = [];
        let critCount = 0;
        let dodgeCount = 0;
        let blockCount = 0;
        let playerDamageTaken = 0;
        let damageAbsorbed = 0;
        let damageMitigated = 0;
        const roundBreakdown = [];
        // Parse log for per-round data
        const roundSections = log.join('\n').split(/=== ⏳ \*\*Hiệp (\d+)\*\* ===/);
        for (let i = 1; i < roundSections.length; i += 2) {
            const roundNum = parseInt(roundSections[i]);
            const section = roundSections[i + 1] || '';
            const playerDmg = (section.match(/gây \*\*(\d+)\*\* sát thương/g) || [])
                .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
            const enemyDmg = (section.match(/nhận \*\*(\d+)\*\* sát thương/g) || [])
                .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
            const crits = (section.match(/Bạo Kích|crit/gi) || []).length;
            const dodges = (section.match(/né tránh| dodge/gi) || []).length;
            const blocks = (section.match(/Chặn| block/gi) || []).length;
            // V17 E-02: Track damage absorbed from shields / Khí Linh / pet aura / bloodline
            const absorptions = (section.match(/hấp thụ \*\*(\d+)\*\*/g) || [])
                .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
            const mitigations = (section.match(/giảm \*\*-?(\d+)\*\* sát thương/g) || [])
                .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
            critCount += crits;
            dodgeCount += dodges;
            blockCount += blocks;
            playerDamageTaken += enemyDmg;
            damageAbsorbed += absorptions;
            damageMitigated += mitigations;
            roundBreakdown.push({
                round: roundNum,
                playerDamageDealt: playerDmg,
                playerDamageTaken: enemyDmg,
                skillsUsed: [],
                critCount: crits,
                dodgeCount: dodges,
                blockCount: blocks,
            });
        }
        // Calculate efficiency
        const totalRounds = result.rounds || 1;
        const avgDmgPerRound = Math.round(result.totalDamageDealt / totalRounds);
        const critRate = result.totalDamageDealt > 0 ? critCount / totalRounds : 0;
        let rating = 'C';
        if (result.winner === 'player') {
            if (totalRounds <= 5)
                rating = 'S';
            else if (totalRounds <= 10)
                rating = 'A';
            else if (totalRounds <= 20)
                rating = 'B';
            else
                rating = 'C';
        }
        else {
            rating = 'D';
        }
        // Generate tips
        if (critRate < 0.1)
            tips.push('Tỷ lệ chí mạng thấp — thử equip trang bị +crit hoặc dùng tâm pháp crit.');
        if (playerDamageTaken > result.totalDamageDealt * 0.5)
            tips.push('Nhận quá nhiều sát thương — thử dùng guard hoặc build DEF hơn.');
        if (dodgeCount === 0 && blockCount === 0)
            tips.push('Không né/block lần nào — equip vật phẩm +dodge hoặc dùng skill né.');
        if (totalRounds > 25)
            tips.push('Trận kéo dài quá — cần burst damage hơn, thử dùng elemental combo.');
        if (result.winner === 'enemy')
            tips.push('Thua trận — thử đổi element克制 enemy, hoặc提升 level/trang bị.');
        if (tips.length === 0)
            tips.push('Trận chiến tốt! Tiếp tục maintain phong độ.');
        return {
            totalDamageDealt: result.totalDamageDealt,
            totalDamageTaken: playerDamageTaken,
            avgDamagePerRound: avgDmgPerRound,
            critRate: Math.round(critRate * 100),
            dodgeCount,
            blockCount,
            efficiencyRating: rating,
            tips,
            roundBreakdown,
            damageAbsorbed,
            damageMitigated,
        };
    }
    /**
     * V17 E-02: Text-based damage chart per round
     */
    getDamageChart(breakdown) {
        if (breakdown.length === 0)
            return '';
        const maxVal = Math.max(...breakdown.map(r => Math.max(r.playerDamageDealt, r.playerDamageTaken)), 1);
        const barMax = 15;
        let chart = '```\n📊 Diễn Biến Sát Thương:\n';
        for (const r of breakdown) {
            const dealtBars = Math.round((r.playerDamageDealt / maxVal) * barMax);
            const takenBars = Math.round((r.playerDamageTaken / maxVal) * barMax);
            chart += `Hiệp ${String(r.round).padStart(2, ' ')} |`;
            chart += '🟢'.repeat(dealtBars) + '🔴'.repeat(takenBars);
            if (dealtBars + takenBars === 0)
                chart += '⏸️';
            chart += `| ${r.playerDamageDealt.toLocaleString()} / ${r.playerDamageTaken.toLocaleString()}\n`;
        }
        chart += '🟢 = ST gây, 🔴 = ST nhận\n```';
        return chart;
    }
    getReplayDescription(analysis) {
        let msg = `📊 **Phân Tích Chiến Đấu** — Rating: **${analysis.efficiencyRating}**\n`;
        msg += `⚔️ Damage gây: **${analysis.totalDamageDealt.toLocaleString()}** | Damage nhận: **${analysis.totalDamageTaken.toLocaleString()}**\n`;
        msg += `📈 TB Damage/hit: **${analysis.avgDamagePerRound.toLocaleString()}**\n`;
        msg += `💥 Chí mạng: **${analysis.critRate}%** | Né: **${analysis.dodgeCount}** | Chặn: **${analysis.blockCount}**\n`;
        msg += `🛡️ Damage hấp thụ: **${analysis.damageAbsorbed.toLocaleString()}** | Giảm trừ: **${analysis.damageMitigated.toLocaleString()}**\n`;
        // V17 E-02: Text chart
        msg += this.getDamageChart(analysis.roundBreakdown);
        if (analysis.tips.length > 0) {
            msg += `\n**Gợi Ý:**\n`;
            for (const tip of analysis.tips) {
                msg += `• ${tip}\n`;
            }
        }
        return msg;
    }
    getRecentReplays(userId) {
        this.initTable();
        return database_1.default.prepare('SELECT id, enemy_name as enemyName, created_at as createdAt FROM combat_replays WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
    }
    getReplay(userId, replayId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT result_json FROM combat_replays WHERE user_id = ? AND id = ?').get(userId, replayId);
        return row ? JSON.parse(row.result_json) : null;
    }
}
exports.combatReplayService = new CombatReplayService();
