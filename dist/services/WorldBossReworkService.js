"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldBossReworkService = void 0;
const database_1 = __importDefault(require("../database/database"));
const worldBossReworkConstants_1 = require("../config/worldBossReworkConstants");
const CacheService_1 = require("./CacheService");
class WorldBossReworkService {
    checkPhaseTransition(bossId) {
        const boss = database_1.default.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId);
        if (!boss)
            return false;
        const hpPercent = (boss.hp / boss.max_hp) * 100;
        const currentPhase = boss.phase || 1;
        for (const phase of worldBossReworkConstants_1.BOSS_PHASES) {
            if (phase.phase > currentPhase && hpPercent <= phase.hpThreshold) {
                database_1.default.prepare(`
          UPDATE world_boss SET phase = ?, current_weakness = ?,
            atk = CAST(atk * ? AS INTEGER), def = CAST(def * ? AS INTEGER)
          WHERE id = ?
        `).run(phase.phase, phase.weakness, phase.statMultiplier.atk, phase.statMultiplier.def, bossId);
                return true;
            }
        }
        return false;
    }
    calculateDamageWithCounter(baseDamage, playerElement, bossWeakness, playerUsedSkillElement) {
        if (playerUsedSkillElement === bossWeakness || playerElement === bossWeakness) {
            return Math.floor(baseDamage * worldBossReworkConstants_1.BOSS_COUNTER_BONUS);
        }
        return baseDamage;
    }
    recordPhaseDamage(userId, bossId, phase, damage) {
        const contrib = database_1.default.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
            .get(userId, bossId);
        if (!contrib)
            return;
        const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
        phaseDmg[phase] = (phaseDmg[phase] || 0) + damage;
        const mvpScore = Object.values(phaseDmg).reduce((s, v) => s + v, 0);
        database_1.default.prepare('UPDATE world_boss_contributions SET phase_damages = ?, mvp_score = ? WHERE user_id = ? AND boss_id = ?')
            .run(JSON.stringify(phaseDmg), mvpScore, userId, bossId);
    }
    getMVPScore(userId, bossId) {
        const contrib = database_1.default.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
            .get(userId, bossId);
        if (!contrib)
            return 0;
        const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
        // V2: 5 phases, each later phase worth more (multiplier increases)
        return (phaseDmg[1] || 0) * 1.0 + (phaseDmg[2] || 0) * 1.3 + (phaseDmg[3] || 0) * 1.6
            + (phaseDmg[4] || 0) * 2.0 + (phaseDmg[5] || 0) * 3.0;
    }
    getBossInfo(bossId) {
        const boss = database_1.default.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId);
        if (!boss)
            return null;
        const phase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1)) || worldBossReworkConstants_1.BOSS_PHASES[0];
        const nextPhase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1);
        return {
            ...boss,
            phaseInfo: phase,
            hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
            nextPhaseThreshold: nextPhase?.hpThreshold ?? 0,
            currentWeakness: boss.current_weakness || phase.weakness,
            abilities: phase.abilities
        };
    }
    distributeRewards(bossId) {
        const contributions = database_1.default.prepare(`
      SELECT * FROM world_boss_contributions WHERE boss_id = ? ORDER BY mvp_score DESC
    `).all(bossId);
        if (!contributions.length)
            return { totalRewarded: 0, mvp: null, lastHit: null, topPlayers: [] };
        const totalRewarded = contributions.length;
        let mvpUserId = null;
        let lastHitUserId = null;
        const topPlayers = [];
        // Find MVP (highest mvp_score)
        const mvp = contributions[0];
        if (mvp && mvp.mvp_score > 0)
            mvpUserId = mvp.user_id;
        // Find last hit
        const lastHitter = contributions.find(c => c.last_hit === 1);
        if (lastHitter)
            lastHitUserId = lastHitter.user_id;
        database_1.default.transaction(() => {
            contributions.forEach((c, idx) => {
                const rank = idx + 1;
                let reward = worldBossReworkConstants_1.BOSS_REWARDS.participation;
                let rewardLabel = 'Tham gia';
                if (c.user_id === mvpUserId) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.mvp;
                    rewardLabel = 'MVP';
                }
                else if (c.user_id === lastHitUserId) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.last_hit;
                    rewardLabel = 'Chóp cuối';
                }
                else if (rank <= 3) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.top3;
                    rewardLabel = 'Top 3';
                }
                else if (rank <= 10) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.top10;
                    rewardLabel = 'Top 10';
                }
                else if (c.damage > 0) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.participation;
                    rewardLabel = 'Tham gia';
                }
                if (reward.ngotinh > 0) {
                    database_1.default.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
                        .run(reward.ngotinh, c.user_id);
                }
                if (reward.coins > 0) {
                    database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?')
                        .run(reward.coins, c.user_id);
                }
                if (rank <= 10) {
                    topPlayers.push({ userId: c.user_id, rank, reward: `${reward.ngotinh} Ngt, ${reward.coins} coins (${rewardLabel})` });
                }
            });
            // Clear contributions for this boss
            database_1.default.prepare('DELETE FROM world_boss_contributions WHERE boss_id = ?').run(bossId);
        })();
        CacheService_1.cacheService.invalidatePrefix('boss:');
        return { totalRewarded, mvp: mvpUserId, lastHit: lastHitUserId, topPlayers };
    }
    getSpectators(bossId) {
        return database_1.default.prepare(`
      SELECT s.*, u.name FROM arena_spectators s
      JOIN users u ON s.viewer_id = u.discord_id
      WHERE s.match_id = ?
    `).all(bossId);
    }
    // === C-03: World Boss — Rotation, Phases, Contribution Milestones ===
    /**
     * C-03: Get boss rotation (different bosses at different times)
     */
    getBossRotation() {
        const bosses = [
            { id: 'boss_fire', name: 'Hỏa Long', element: 'Hỏa', hours: [0, 6, 12, 18] },
            { id: 'boss_water', name: 'Thủy Rồng', element: 'Thủy', hours: [2, 8, 14, 20] },
            { id: 'boss_earth', name: 'Thổ Tướng', element: 'Thổ', hours: [4, 10, 16, 22] },
        ];
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const currentHour = vn.getUTCHours();
        return bosses.map(b => {
            const isActive = b.hours.includes(currentHour);
            const nextHour = b.hours.find(h => h > currentHour) || b.hours[0] + 24;
            const timeLeft = isActive ? 60 : (nextHour - currentHour) * 60;
            return {
                bossId: b.id,
                name: b.name,
                element: b.element,
                active: isActive,
                timeLeft
            };
        });
    }
    /**
     * C-03: Get contribution milestones for rewards
     */
    getContributionMilestones() {
        return [
            { damage: 1000, reward: '100 LT', label: '25% Boss HP' },
            { damage: 5000, reward: '500 LT + 1 KNB', label: '50% Boss HP' },
            { damage: 15000, reward: '2000 LT + 5 KNB', label: '75% Boss HP' },
            { damage: 30000, reward: '5000 LT + 10 KNB + Vật liệu hiếm', label: '100% Boss HP' },
        ];
    }
    /**
     * C-03: Check and award contribution milestones
     */
    checkMilestones(userId, bossId) {
        const contrib = database_1.default.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
            .get(userId, bossId);
        if (!contrib)
            return [];
        const totalDamage = contrib.damage_dealt || 0;
        const milestones = this.getContributionMilestones();
        const awarded = [];
        for (const m of milestones) {
            if (totalDamage >= m.damage) {
                awarded.push(`${m.label}: ${m.reward}`);
            }
        }
        return awarded;
    }
    /**
     * C-03: Get boss description for UI
     */
    getBossDescription(bossId) {
        const info = this.getBossInfo(bossId);
        if (!info)
            return '❌ Không có boss active!';
        const phase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (info.phase || 1)) || worldBossReworkConstants_1.BOSS_PHASES[0];
        let msg = `👹 **${info.name}** — **Giai Đoạn ${info.phase || 1}: ${phase.name}**\n`;
        msg += `❤️ HP: **${info.hpPercent}%** (${info.hp}/${info.max_hp})\n`;
        msg += `⚔️ ATK: **${info.atk}** | 🛡️ DEF: **${info.def}**\n`;
        msg += `🔥 Điểm Yếu: **${info.currentWeakness}**\n`;
        msg += `\n**Kỹ Năng Giai Đoạn ${info.phase}:**\n`;
        for (const a of phase.abilities) {
            msg += `• **${a.name}**: ${a.description}\n`;
        }
        // Phase-specific mechanic warnings
        if (phase.phase >= 3)
            msg += `\n⚠️ **Hồi Phục:** Boss hồi 10% HP mỗi hiệp!`;
        if (phase.phase >= 4)
            msg += `\n⚠️ **Thôn Tính:** Boss hấp thụ sát thương nguyên tố (-50%)!`;
        if (phase.phase === 5)
            msg += `\n💀 **Tuyệt Vọng:** Boss sẽ hủy diệt sau 5 hiệp nếu không bị tiêu diệt!`;
        return msg;
    }
    // === V16 B-02: World Boss V2 — 5 Phases ===
    // ponytail: in-memory phase 5 attack counter (lost on restart, acceptable for boss fights)
    phase5AttackCount = new Map();
    getPhaseV2Description() {
        let msg = '**5-Giai Đoạn Boss:**\n';
        for (const phase of worldBossReworkConstants_1.BOSS_PHASES) {
            msg += `• GĐ ${phase.phase} (≤${phase.hpThreshold}%): **${phase.name}**\n`;
            msg += `  ${phase.abilities.map(a => a.description).join('; ')}\n`;
        }
        return msg;
    }
    /**
     * Apply phase mechanic effects when a player attacks the boss
     */
    applyPhaseMechanics(boss, hpPercent) {
        const phase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1)) || worldBossReworkConstants_1.BOSS_PHASES[0];
        const result = {
            atkMult: phase.statMultiplier.atk,
            defMult: phase.statMultiplier.def,
            healAmount: 0,
            absorbPct: 0,
            phase5Attacks: 0,
        };
        // Phase 3: heal 10% max HP per round
        if (phase.phase >= 3) {
            result.healAmount = Math.round(boss.max_hp * 0.10);
        }
        // Phase 4: absorb element damage (reduce player damage by 50% if element matches)
        if (phase.phase >= 4) {
            result.absorbPct = 50;
        }
        // Phase 5: track attacks, one-shot after 5
        if (phase.phase === 5) {
            const bossId = boss.id || 'world_boss_current';
            const count = (this.phase5AttackCount.get(bossId) || 0) + 1;
            this.phase5AttackCount.set(bossId, count);
            result.phase5Attacks = count;
        }
        return result;
    }
    resetPhase5Count(bossId) {
        this.phase5AttackCount.delete(bossId);
    }
    getPhase5Attacks(bossId) {
        return this.phase5AttackCount.get(bossId) || 0;
    }
}
exports.worldBossReworkService = new WorldBossReworkService();
