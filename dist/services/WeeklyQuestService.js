"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyQuestService = exports.WEEKLY_QUEST_POOL = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const constants_1 = require("../utils/constants");
exports.WEEKLY_QUEST_POOL = [
    { id: 'wq_bicanh', name: 'Bí Cảnh Marathon', emoji: '🔮', description: 'Hoàn thành 10 lần Bí Cảnh.', required: 10, rewardCoin: 300, rewardTuVi: 3000, rewardNgotinh: 10 },
    { id: 'wq_thap', name: 'Tháp Thử Thách', emoji: '🏯', description: 'Đạt tầng 20+ trong Tháp Vô Hạn.', required: 20, rewardCoin: 400, rewardTuVi: 4000, rewardNgotinh: 12 },
    { id: 'wq_pvp', name: 'Bậc Thầy PvP', emoji: '⚔️', description: 'Thắng 15 trận quyết đấu.', required: 15, rewardCoin: 600, rewardTuVi: 4000, rewardNgotinh: 15 },
    { id: 'wq_daosu', name: 'Đạo Sư', emoji: '🧑‍🏫', description: 'Thực hiện công việc sư phạm 5 lần.', required: 5, rewardCoin: 200, rewardTuVi: 2000, rewardNgotinh: 8 },
    { id: 'wq_luyendan', name: 'Luyện Đan Sư', emoji: '🌿', description: 'Luyện chế 8 viên đan dược.', required: 8, rewardCoin: 200, rewardTuVi: 2000, rewardNgotinh: 8 },
    { id: 'wq_tho', name: 'Thợ Rèn', emoji: '🔨', description: 'Rèn 3 trang bị.', required: 3, rewardCoin: 200, rewardTuVi: 2000, rewardNgotinh: 8 },
    { id: 'wq_thamhiem', name: 'Thám Hiểm Viên', emoji: '🗺️', description: 'Hoàn thành 8 chuyến thám hiểm.', required: 8, rewardCoin: 300, rewardTuVi: 3000, rewardNgotinh: 10 },
    { id: 'wq_nongdan', name: 'Nông Dân', emoji: '🌾', description: 'Thu hoạch 15 ô farm.', required: 15, rewardCoin: 150, rewardTuVi: 1500, rewardNgotinh: 6 },
    { id: 'wq_thuongnhan', name: 'Thương Nhân', emoji: '💰', description: 'Bán 30 vật phẩm lên chợ.', required: 30, rewardCoin: 300, rewardTuVi: 2500, rewardNgotinh: 8 },
    { id: 'wq_boss', name: 'Diệt Boss', emoji: '👹', description: 'Tấn công Boss Thế Giới 3 lần.', required: 3, rewardCoin: 400, rewardTuVi: 4000, rewardNgotinh: 12 },
    { id: 'wq_noima', name: 'Thợ Săn Nội Ma', emoji: '😈', description: 'Hoàn thành 3 trận Nội Ma.', required: 3, rewardCoin: 300, rewardTuVi: 3000, rewardNgotinh: 10 },
    { id: 'wq_mongcanh', name: 'Mộng Cảnh', emoji: '🌙', description: 'Đạt tầng 15+ Mộng Cảnh.', required: 15, rewardCoin: 300, rewardTuVi: 3000, rewardNgotinh: 10 },
    { id: 'wq_linhthu', name: 'Huấn Luyện Linh Thú', emoji: '🐾', description: 'Huấn luyện 2 linh thú.', required: 2, rewardCoin: 200, rewardTuVi: 2000, rewardNgotinh: 8 },
    { id: 'wq_sanlinhthu', name: 'Săn Linh Thú', emoji: '🐉', description: 'Thu phục 2 linh thú.', required: 2, rewardCoin: 250, rewardTuVi: 2500, rewardNgotinh: 8 },
    { id: 'wq_tongmon', name: 'Tông Môn Vụ', emoji: '☯️', description: 'Quyên góp 1500 LT cho Tông Môn.', required: 1500, rewardCoin: 200, rewardTuVi: 2000, rewardNgotinh: 8 },
];
class WeeklyQuestService {
    /**
     * Lấy timestamp đầu tuần (Thứ Hai 0h00 UTC+7)
     */
    getWeekStart() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const day = vn.getUTCDay() || 7; // 1=Mon..7=Sun
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return Math.floor((vn.getTime() - 7 * 3600000) / 1000);
    }
    /**
     * Lấy ngày đầu tuần dạng YYYY-MM-DD (UTC+7)
     */
    getWeekDateString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const day = vn.getUTCDay() || 7;
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return vn.toISOString().slice(0, 10);
    }
    /**
     * Lấy tuần trước dạng YYYY-MM-DD
     */
    getLastWeekDateString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000 - 7 * 86400000);
        const day = vn.getUTCDay() || 7;
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return vn.toISOString().slice(0, 10);
    }
    /**
     * Level scaling factor
     */
    getLevelScaling(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return 1.0;
        const { majorIndex } = (0, constants_1.getRealmDetails)(user.level);
        return 1 + majorIndex * 0.10;
    }
    /**
     * Lấy hoặc tạo mới bộ nhiệm vụ hàng tuần (chọn 5 từ pool 15)
     */
    getOrAssignQuests(userId) {
        const weekStart = this.getWeekStart();
        const existing = database_1.default.prepare(`
      SELECT * FROM weekly_quests WHERE user_id = ? AND week_start = ?
    `).all(userId, weekStart);
        if (existing.length > 0) {
            return existing.map(q => ({
                ...q,
                definition: exports.WEEKLY_QUEST_POOL.find(p => p.id === q.quest_id)
            })).filter(q => q.definition);
        }
        // Chọn 5 nhiệm vụ ngẫu nhiên từ pool 15
        const shuffled = [...exports.WEEKLY_QUEST_POOL].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 5);
        const scaling = this.getLevelScaling(userId);
        const insertStmt = database_1.default.prepare(`
      INSERT OR IGNORE INTO weekly_quests
        (user_id, quest_id, progress, required, reward_coin, reward_exp, reward_ngotinh, is_claimed, week_start)
      VALUES (?, ?, 0, ?, ?, ?, ?, 0, ?)
    `);
        const insertTx = database_1.default.transaction(() => {
            for (const quest of selected) {
                insertStmt.run(userId, quest.id, quest.required, Math.round(quest.rewardCoin * scaling), Math.round(quest.rewardTuVi * scaling), Math.round(quest.rewardNgotinh * scaling), weekStart);
            }
        });
        insertTx();
        const newRows = database_1.default.prepare(`
      SELECT * FROM weekly_quests WHERE user_id = ? AND week_start = ?
    `).all(userId, weekStart);
        return newRows.map(q => ({
            ...q,
            definition: exports.WEEKLY_QUEST_POOL.find(p => p.id === q.quest_id)
        })).filter(q => q.definition);
    }
    /**
     * Cập nhật tiến trình nhiệm vụ
     */
    updateProgress(userId, questId, amount = 1) {
        const weekStart = this.getWeekStart();
        database_1.default.prepare(`
      UPDATE weekly_quests
      SET progress = MIN(required, progress + ?)
      WHERE user_id = ? AND quest_id = ? AND week_start = ? AND is_claimed = 0
    `).run(amount, userId, questId, weekStart);
    }
    /**
     * Nhận thưởng nhiệm vụ hoàn thành
     */
    claimQuest(userId, questId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const weekStart = this.getWeekStart();
        const quest = database_1.default.prepare(`
      SELECT * FROM weekly_quests
      WHERE user_id = ? AND quest_id = ? AND week_start = ? AND is_claimed = 0
    `).get(userId, questId, weekStart);
        if (!quest)
            return { success: false, message: 'Nhiệm vụ không tồn tại hoặc đã nhận thưởng.' };
        if (quest.progress < quest.required) {
            return { success: false, message: `Nhiệm vụ chưa hoàn thành! (${quest.progress}/${quest.required})` };
        }
        const def = exports.WEEKLY_QUEST_POOL.find(p => p.id === questId);
        // Tier bonus: 3/5=x1, 4/5=x1.2, 5/5=x1.5
        const allQuests = this.getOrAssignQuests(userId);
        const completedCount = allQuests.filter(q => q.progress >= q.required).length;
        let tierMult = 1.0;
        if (completedCount >= 5)
            tierMult = 1.5;
        else if (completedCount >= 4)
            tierMult = 1.2;
        const finalCoin = Math.round(quest.reward_coin * tierMult);
        const finalExp = Math.round(quest.reward_exp * tierMult);
        const finalNgotinh = Math.round(quest.reward_ngotinh * tierMult);
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE weekly_quests SET is_claimed = 1 WHERE id = ?').run(quest.id);
            UserRepository_1.userRepository.update(userId, {
                coin_ha_pham: user.coin_ha_pham + finalCoin,
                tu_vi: Math.min(user.tu_vi + finalExp, user.exp_needed),
                ngotinh: (user.ngotinh || 0) + finalNgotinh
            });
        })();
        let msg = `✅ **${def?.emoji || '📋'} ${def?.name || questId}** hoàn thành!\n🟤 +${finalCoin} LT | 🌿 +${finalExp} Tu Vi | 🧘 +${finalNgotinh} Ngộ Tính`;
        if (tierMult > 1)
            msg += `\n🎯 **Tier Bonus x${tierMult}** (${completedCount}/5 hoàn thành)`;
        // Check if all 5 completed → streak update
        if (completedCount >= 5) {
            const streakInfo = this.updateStreak(userId);
            msg += `\n🔥 **Chuỗi x${streakInfo.current_streak}** tuần liên tiếp!`;
            if (streakInfo.current_streak >= 4) {
                // Streak bonus: 4+ weeks → 200 KNB
                const knbBonus = 200;
                UserRepository_1.userRepository.update(userId, { knb: user.knb + knbBonus });
                msg += `\n💎 **Thưởng Chuỗi!** +${knbBonus} KNB + danh hiệu "Tinh Nghĩa"!`;
            }
        }
        return { success: true, message: msg };
    }
    /**
     * Cập nhật streak tuần
     */
    updateStreak(userId) {
        const thisWeek = this.getWeekDateString();
        const lastWeek = this.getLastWeekDateString();
        const streak = this.getStreak(userId);
        let newStreak = 1;
        if (streak.last_completed_week === thisWeek) {
            newStreak = streak.current_streak; // Already counted
        }
        else if (streak.last_completed_week === lastWeek) {
            newStreak = streak.current_streak + 1;
        }
        database_1.default.prepare(`
      INSERT INTO weekly_quest_streaks (user_id, current_streak, longest_streak, last_completed_week)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = MAX(weekly_quest_streaks.longest_streak, excluded.current_streak),
        last_completed_week = excluded.last_completed_week
    `).run(userId, newStreak, newStreak, thisWeek);
        return this.getStreak(userId);
    }
    getStreak(userId) {
        let row = database_1.default.prepare('SELECT * FROM weekly_quest_streaks WHERE user_id = ?').get(userId);
        if (!row) {
            return { user_id: userId, current_streak: 0, longest_streak: 0, last_completed_week: null };
        }
        return row;
    }
    /**
     * Lấy tổng kết tuần
     */
    getWeeklySummary(userId) {
        const weekStart = this.getWeekStart();
        const quests = database_1.default.prepare(`
      SELECT * FROM weekly_quests WHERE user_id = ? AND week_start = ? ORDER BY id ASC
    `).all(userId, weekStart);
        if (quests.length === 0)
            return '📊 **Tổng Kết Tuần** — Chưa có nhiệm vụ tuần này.';
        const totalAssigned = quests.length;
        const totalCompleted = quests.filter(q => q.progress >= q.required).length;
        const totalClaimed = quests.filter(q => q.is_claimed === 1).length;
        const streak = this.getStreak(userId);
        let totalCoin = 0, totalExp = 0, totalNgotinh = 0;
        for (const q of quests.filter(q => q.is_claimed)) {
            totalCoin += q.reward_coin;
            totalExp += q.reward_exp;
            totalNgotinh += q.reward_ngotinh;
        }
        let msg = `📊 **Tổng Kết Tuần**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📋 Nhiệm vụ: **${totalCompleted}/${totalAssigned}** hoàn thành\n`;
        msg += `🎁 Đã nhận: **${totalClaimed}**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🟤 +${totalCoin} LT | 🌿 +${totalExp} Tu Vi | 🧘 +${totalNgotinh} Ngộ Tính\n`;
        msg += `🔥 Chuỗi: **${streak.current_streak}** tuần | Tối đa: **${streak.longest_streak}** tuần`;
        return msg;
    }
    /**
     * Kiểm tra và hiển thị progress cho 1 quest cụ thể
     */
    getQuestProgress(userId, questId) {
        const weekStart = this.getWeekStart();
        const quest = database_1.default.prepare(`
      SELECT * FROM weekly_quests WHERE user_id = ? AND quest_id = ? AND week_start = ?
    `).get(userId, questId, weekStart);
        if (!quest)
            return 'Nhiệm vụ không tồn tại.';
        const def = exports.WEEKLY_QUEST_POOL.find(p => p.id === questId);
        return `${def?.emoji || ''} **${def?.name || questId}**: ${quest.progress}/${quest.required}`;
    }
}
exports.weeklyQuestService = new WeeklyQuestService();
