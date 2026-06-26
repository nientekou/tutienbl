"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bountyBoardService = void 0;
// V13 C-02: Bảng Nghĩa Vụ (Bounty Board) — replaces DailyQuestService
const database_1 = __importDefault(require("../database/database"));
const BOUNTY_POOL = [
    { id: 'b_com_1', name: 'Sát Thủ', description: 'Đánh bại 5 kẻ địch', category: 'combat', tier: 'common', requirement: 'kill', target: 5, rewardExp: 200, rewardCoins: 500, rewardKnb: 0 },
    { id: 'b_com_2', name: 'Chiến Binh', description: 'Đánh bại 10 kẻ địch', category: 'combat', tier: 'elite', requirement: 'kill', target: 10, rewardExp: 500, rewardCoins: 1500, rewardKnb: 5 },
    { id: 'b_com_3', name: 'Tổng Tư Lệnh', description: 'Đánh bại 20 kẻ địch', category: 'combat', tier: 'legendary', requirement: 'kill', target: 20, rewardExp: 1500, rewardCoins: 5000, rewardKnb: 20 },
    { id: 'b_life_1', name: 'Thu Mùa', description: 'Hái 3 thảo dược', category: 'life', tier: 'common', requirement: 'herb', target: 3, rewardExp: 150, rewardCoins: 300, rewardKnb: 0 },
    { id: 'b_life_2', name: 'Đại Thu Mùa', description: 'Hái 8 thảo dược', category: 'life', tier: 'elite', requirement: 'herb', target: 8, rewardExp: 400, rewardCoins: 1000, rewardKnb: 5 },
    { id: 'b_soc_1', name: 'Hảo Hán', description: 'Trao đổi 2 vật phẩm', category: 'social', tier: 'common', requirement: 'trade', target: 2, rewardExp: 150, rewardCoins: 400, rewardKnb: 0 },
    { id: 'b_spec_1', name: 'Thám Hiểm', description: 'Hoàn thành 1 lần thám hiểm', category: 'special', tier: 'common', requirement: 'explore', target: 1, rewardExp: 300, rewardCoins: 800, rewardKnb: 0 },
    { id: 'b_spec_2', name: 'Thám Hiểm Sâu', description: 'Hoàn thành 3 lần thám hiểm', category: 'special', tier: 'elite', requirement: 'explore', target: 3, rewardExp: 800, rewardCoins: 2000, rewardKnb: 10 },
];
class BountyBoardService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS bounty_board (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        cards_json TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );
    `);
    }
    getToday() {
        return new Date().toISOString().slice(0, 10);
    }
    generateCards(level) {
        const cards = [];
        const pool = [...BOUNTY_POOL];
        for (let i = 0; i < 6; i++) {
            // Tier distribution based on level
            const rand = Math.random();
            let tierFilter;
            if (rand < 0.15 && level >= 50)
                tierFilter = 'legendary';
            else if (rand < 0.40 && level >= 20)
                tierFilter = 'elite';
            else
                tierFilter = 'common';
            const eligible = pool.filter(q => q.tier === tierFilter && !cards.includes(q));
            if (eligible.length > 0) {
                cards.push(eligible[Math.floor(Math.random() * eligible.length)]);
            }
            else if (pool.length > 0) {
                cards.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        }
        return cards;
    }
    getTodayCards(userId, userLevel) {
        this.initTable();
        const today = this.getToday();
        const row = database_1.default.prepare('SELECT cards_json FROM bounty_board WHERE user_id = ? AND day = ?')
            .get(userId, today);
        if (row)
            return JSON.parse(row.cards_json);
        const cards = this.generateCards(userLevel);
        database_1.default.prepare('INSERT INTO bounty_board (user_id, day, cards_json, completed, streak) VALUES (?, ?, ?, 0, 0)')
            .run(userId, today, JSON.stringify(cards));
        return cards;
    }
    isCompletedToday(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT completed FROM bounty_board WHERE user_id = ? AND day = ?')
            .get(userId, this.getToday());
        return row?.completed === 1;
    }
    completeToday(userId) {
        this.initTable();
        const today = this.getToday();
        const row = database_1.default.prepare('SELECT streak FROM bounty_board WHERE user_id = ? AND day = ?')
            .get(userId, today);
        if (!row)
            return { success: false, streakBonus: 0, message: 'Chưa có bounty hôm nay.' };
        const newStreak = (row.streak || 0) + 1;
        const streakBonus = newStreak >= 5 ? 1 : 0; // legendary card next day
        database_1.default.prepare('UPDATE bounty_board SET completed = 1, streak = ? WHERE user_id = ? AND day = ?')
            .run(newStreak, userId, today);
        return { success: true, streakBonus, message: `✅ Hoàn thành! Streak: ${newStreak} ngày.` };
    }
    getStreak(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT streak FROM bounty_board WHERE user_id = ? AND day = ?')
            .get(userId, this.getToday());
        return row?.streak ?? 0;
    }
}
exports.bountyBoardService = new BountyBoardService();
