"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysteryBoxService = void 0;
// V15 B-04: Mystery Box Daily
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const REWARD_POOL = [
    // Coins (60%)
    { type: 'coins', name: 'Linh Thạch', amount: 500, emoji: '🪙' },
    { type: 'coins', name: 'Linh Thạch', amount: 1000, emoji: '🪙' },
    { type: 'coins', name: 'Linh Thạch', amount: 2000, emoji: '🪙' },
    // Materials (25%)
    { type: 'material', name: 'Nguyên liệu thường', amount: 5, emoji: '📦' },
    { type: 'material', name: 'Nguyên liệu hiếm', amount: 3, emoji: '📦' },
    // Rare (10%)
    { type: 'rare', name: 'Vật phẩm hiếm', amount: 1, emoji: '🔵' },
    // Legendary (4%)
    { type: 'legendary', name: 'Vật phẩm huyền thoại', amount: 1, emoji: '🟣' },
    // Mythic (1%)
    { type: 'mythic', name: 'V vật phẩm thần thoại', amount: 1, emoji: '🟡' },
];
class MysteryBoxService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS mystery_box_claims (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        streak INTEGER DEFAULT 1,
        PRIMARY KEY (user_id, day)
      );
    `);
    }
    getToday() {
        return new Date().toISOString().slice(0, 10);
    }
    canClaim(userId) {
        this.initTable();
        const today = this.getToday();
        const row = database_1.default.prepare('SELECT 1 FROM mystery_box_claims WHERE user_id = ? AND day = ?')
            .get(userId, today);
        if (row)
            return { eligible: false, reason: 'Đã mở hộp quà hôm nay rồi!' };
        return { eligible: true, reason: '' };
    }
    claim(userId) {
        const check = this.canClaim(userId);
        if (!check.eligible)
            return { success: false, message: `❌ ${check.reason}` };
        const today = this.getToday();
        // Calculate streak
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const prevStreak = database_1.default.prepare('SELECT streak FROM mystery_box_claims WHERE user_id = ? AND day = ?')
            .get(userId, yesterday);
        const streak = (prevStreak?.streak || 0) + 1;
        // Record claim
        database_1.default.prepare(`
      INSERT INTO mystery_box_claims (user_id, day, streak) VALUES (?, ?, ?)
      ON CONFLICT(user_id, day) DO NOTHING
    `).run(userId, today, streak);
        // Roll reward
        let reward;
        if (streak >= 7) {
            // Streak 7+: guaranteed rare+
            const rarePool = REWARD_POOL.filter(r => r.type === 'rare' || r.type === 'legendary' || r.type === 'mythic');
            reward = rarePool[Math.floor(Math.random() * rarePool.length)];
        }
        else {
            reward = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
        }
        // Apply reward
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Lỗi user.' };
        if (reward.type === 'coins') {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.amount });
        }
        const streakText = streak >= 7 ? `\n🔥 **Streak ${streak} ngày!** Guaranteed rare+` : `\n📅 Streak: ${streak}/7 ngày`;
        return {
            success: true,
            message: `${reward.emoji} **Mở Hộp Quà:** ${reward.name} x${reward.amount}${streakText}`,
            reward,
        };
    }
    getDescription(userId) {
        const today = this.getToday();
        const row = database_1.default.prepare('SELECT streak FROM mystery_box_claims WHERE user_id = ? AND day = ?')
            .get(userId, today);
        const claimed = !!row;
        const streak = row?.streak || 0;
        let msg = '📦 **Hộp Quà Bí Ẩn**\n';
        msg += `📅 Hôm nay: ${claimed ? '✅ Đã mở' : '❌ Chưa mở'}\n`;
        msg += `🔥 Streak: ${streak}/7 ngày${streak >= 7 ? ' (Guaranteed rare+!)' : ''}`;
        return msg;
    }
}
exports.mysteryBoxService = new MysteryBoxService();
