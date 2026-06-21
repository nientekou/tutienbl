"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldBossRepository = exports.WorldBossRepository = void 0;
const database_1 = __importDefault(require("../database"));
class WorldBossRepository {
    /**
     * Lấy thông tin trạng thái Boss thế giới hiện tại
     */
    getBossStatus(bossId = 1) {
        const stmt = database_1.default.prepare('SELECT * FROM world_boss_status WHERE id = ?');
        return stmt.get(bossId) || null;
    }
    /**
     * Cập nhật lượng máu hiện tại của Boss. Nếu HP <= 0, chuyển status thành 'dead'
     */
    updateBossHp(bossId = 1, newHp) {
        const cappedHp = Math.max(newHp, 0);
        const status = cappedHp <= 0 ? 'dead' : 'alive';
        const stmt = database_1.default.prepare('UPDATE world_boss_status SET hp = ?, status = ? WHERE id = ?');
        stmt.run(cappedHp, status, bossId);
    }
    /**
     * Lấy chi tiết sát thương và lượt đánh của người chơi. Tự động reset lượt đánh nếu qua ngày mới.
     */
    getUserDamage(userId) {
        const stmt = database_1.default.prepare('SELECT * FROM world_boss_damage WHERE user_id = ?');
        const record = stmt.get(userId);
        const now = Math.floor(Date.now() / 1000);
        if (!record) {
            return {
                user_id: userId,
                damage: 0,
                attacks_left: 3,
                last_attack_at: now
            };
        }
        // Kiểm tra reset lượt đánh hàng ngày (so sánh ngày lịch sử tấn công cuối)
        const lastDate = new Date(record.last_attack_at * 1000).toDateString();
        const currentDate = new Date().toDateString();
        if (lastDate !== currentDate) {
            // Đã qua ngày mới -> Reset lại lượt đánh thành 3 lượt
            const resetStmt = database_1.default.prepare('UPDATE world_boss_damage SET attacks_left = 3, last_attack_at = ? WHERE user_id = ?');
            resetStmt.run(now, userId);
            record.attacks_left = 3;
            record.last_attack_at = now;
        }
        return record;
    }
    /**
     * Ghi nhận sát thương gây ra và giảm số lượt khiêu chiến đi 1
     */
    recordAttack(userId, dmgDealt) {
        const now = Math.floor(Date.now() / 1000);
        const record = this.getUserDamage(userId);
        const stmt = database_1.default.prepare(`
      INSERT INTO world_boss_damage (user_id, damage, attacks_left, last_attack_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        damage = damage + excluded.damage,
        attacks_left = attacks_left - 1,
        last_attack_at = excluded.last_attack_at
    `);
        // Lưu ý: Do getUserDamage tự động reset lượt nếu qua ngày mới, 
        // ta trừ lượt của record hiện tại rồi chèn lại.
        const newAttacksLeft = Math.max(record.attacks_left - 1, 0);
        stmt.run(userId, dmgDealt, newAttacksLeft, now);
    }
    /**
     * Lấy danh sách bảng xếp hạng sát thương Top N người chơi
     */
    getRankings(limit = 5) {
        const stmt = database_1.default.prepare(`
      SELECT d.user_id, d.damage, d.attacks_left, d.last_attack_at, u.name
      FROM world_boss_damage d
      JOIN users u ON d.user_id = u.discord_id
      WHERE d.damage > 0
      ORDER BY d.damage DESC
      LIMIT ?
    `);
        return stmt.all(limit) || [];
    }
    /**
     * Reset lại máu Boss thế giới, phát thưởng tự động và xóa bảng xếp hạng sát thương tích lũy
     */
    resetBossAndRankings(bossId = 1) {
        const boss = this.getBossStatus(bossId);
        if (!boss)
            return;
        // Lấy danh sách tất cả người chơi đã tham gia gây sát thương
        const stmt = database_1.default.prepare('SELECT user_id, damage FROM world_boss_damage WHERE damage > 0 ORDER BY damage DESC');
        const contributors = stmt.all();
        const now = Math.floor(Date.now() / 1000);
        // Phát thưởng dựa trên đóng góp xếp hạng
        for (let idx = 0; idx < contributors.length; idx++) {
            const contributor = contributors[idx];
            const userId = contributor.user_id;
            let coinReward = 500;
            let knbReward = 5;
            if (idx === 0) { // Top 1
                coinReward = 5000;
                knbReward = 50;
            }
            else if (idx === 1) { // Top 2
                coinReward = 3000;
                knbReward = 30;
            }
            else if (idx === 2) { // Top 3
                coinReward = 2000;
                knbReward = 20;
            }
            else if (idx < 5) { // Top 4, 5
                coinReward = 1000;
                knbReward = 10;
            }
            // Cập nhật linh thạch & KNB của user
            const userUpdateStmt = database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ?, knb = knb + ?, updated_at = ? WHERE discord_id = ?');
            userUpdateStmt.run(coinReward, knbReward, now, userId);
            console.log(`[WorldBoss Reward] Phát thưởng cho ${userId} (Hạng ${idx + 1}): +${coinReward} Linh thạch, +${knbReward} KNB`);
        }
        // Reset máu Boss
        const updateBoss = database_1.default.prepare("UPDATE world_boss_status SET hp = max_hp, status = 'alive' WHERE id = ?");
        updateBoss.run(bossId);
        // Xóa xếp hạng sát thương
        database_1.default.prepare('DELETE FROM world_boss_damage').run();
        console.log('[WorldBoss] Đã hồi sinh Boss thế giới, phát thưởng hoàn tất và reset bảng xếp hạng sát thương.');
    }
}
exports.WorldBossRepository = WorldBossRepository;
exports.worldBossRepository = new WorldBossRepository();
