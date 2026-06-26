"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyQuestService = exports.QUEST_POOL = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const constants_1 = require("../utils/constants");
exports.QUEST_POOL = [
    {
        id: 'daily_tuluyen',
        name: 'Cần Cù Tu Luyện',
        emoji: '🧘',
        description: 'Thực hiện Thiền Định tu luyện 3 lần trong ngày.',
        required: 3,
        rewardCoin: 100,
        rewardTuVi: 300,
        rewardNgotinh: 2,
        category: 'life'
    },
    {
        id: 'daily_bicanh',
        name: 'Chinh Phục Bí Cảnh',
        emoji: '🔮',
        description: 'Hoàn thành 2 lần khiêu chiến Bí Cảnh bất kể kết quả.',
        required: 2,
        rewardCoin: 200,
        rewardTuVi: 500,
        rewardNgotinh: 5,
        category: 'combat'
    },
    {
        id: 'daily_leothap',
        name: 'Leo Tháp Vô Hạn',
        emoji: '🏯',
        description: 'Leo lên 1 tầng mới trong Tháp Vô Hạn.',
        required: 1,
        rewardCoin: 150,
        rewardTuVi: 400,
        rewardNgotinh: 3,
        category: 'combat'
    },
    {
        id: 'daily_lamviec',
        name: 'Chuyên Cần Lao Động',
        emoji: '⛏️',
        description: 'Làm việc kiếm Linh Thạch 3 lần trong ngày.',
        required: 3,
        rewardCoin: 180,
        rewardTuVi: 200,
        rewardNgotinh: 2,
        category: 'life'
    },
    {
        id: 'daily_khampha',
        name: 'Lữ Hành Thiên Địa',
        emoji: '🗺️',
        description: 'Hoàn thành 1 chuyến thám hiểm dã ngoại.',
        required: 1,
        rewardCoin: 250,
        rewardTuVi: 600,
        rewardNgotinh: 8,
        category: 'life'
    },
    {
        id: 'daily_pvp',
        name: 'Thách Đấu Đồng Đạo',
        emoji: '⚔️',
        description: 'Tham gia 1 trận quyết đấu với tu sĩ khác.',
        required: 1,
        rewardCoin: 200,
        rewardTuVi: 400,
        rewardNgotinh: 5,
        category: 'social'
    },
    {
        id: 'daily_tongmon',
        name: 'Phụng Hiến Môn Phái',
        emoji: '☯️',
        description: 'Quyên góp Linh Thạch cho Tông Môn ít nhất 1 lần.',
        required: 1,
        rewardCoin: 120,
        rewardTuVi: 250,
        rewardNgotinh: 3,
        category: 'social'
    },
    {
        id: 'daily_luyendan',
        name: 'Luyện Chế Linh Đan',
        emoji: '🌿',
        description: 'Luyện chế thành công 1 viên đan dược.',
        required: 1,
        rewardCoin: 300,
        rewardTuVi: 500,
        rewardNgotinh: 6,
        category: 'life'
    },
    {
        id: 'daily_sungthu',
        name: 'Phái Linh Thú Chiến Đấu',
        emoji: '🐉',
        description: 'Xuất chiến linh thú sủng vật 1 lần.',
        required: 1,
        rewardCoin: 100,
        rewardTuVi: 200,
        rewardNgotinh: 2,
        category: 'life'
    },
    {
        id: 'daily_worldboss',
        name: 'Chiến Thần Thảo Phạt',
        emoji: '👹',
        description: 'Tấn công Boss Thế Giới 1 lần.',
        required: 1,
        rewardCoin: 400,
        rewardTuVi: 800,
        rewardNgotinh: 10,
        category: 'combat'
    },
    // B2: Realm-gated quests (Realm 3+ = level 77+)
    {
        id: 'daily_nineheavens',
        name: 'Phá Cửa Cửu Thiên',
        emoji: '🏯',
        description: 'Vượt qua 1 tầng Cửu Thiên.',
        required: 1,
        rewardCoin: 500,
        rewardTuVi: 1000,
        rewardNgotinh: 12,
        category: 'combat',
        minRealm: 3
    },
    {
        id: 'daily_dreamscape',
        name: 'Du Hành Vọng Tưởng',
        emoji: '🌀',
        description: 'Vượt qua 3 tầng Vọng Tưởng.',
        required: 3,
        rewardCoin: 400,
        rewardTuVi: 800,
        rewardNgotinh: 10,
        category: 'combat',
        minRealm: 3
    },
    {
        id: 'daily_sectwar',
        name: 'Chiến Trường Tông Môn',
        emoji: '⚔️',
        description: 'Tham gia 1 trận Chiến Tranh Tông Môn.',
        required: 1,
        rewardCoin: 600,
        rewardTuVi: 1200,
        rewardNgotinh: 15,
        category: 'social',
        minRealm: 5
    },
    {
        id: 'daily_infinite',
        name: 'Thử Thách Vô Hạn',
        emoji: '♾️',
        description: 'Vượt qua 5 tầng Dungeon Vô Hạn.',
        required: 5,
        rewardCoin: 500,
        rewardTuVi: 1000,
        rewardNgotinh: 12,
        category: 'combat',
        minRealm: 5
    },
    {
        id: 'daily_arena',
        name: 'Quật Khởi Đấu Trường',
        emoji: '🏟️',
        description: 'Thắng 2 trận Đấu Trường.',
        required: 2,
        rewardCoin: 700,
        rewardTuVi: 1500,
        rewardNgotinh: 18,
        category: 'combat',
        minRealm: 7
    },
    {
        id: 'daily_tournament',
        name: 'Tham Dự Giải Đấu',
        emoji: '🏆',
        description: 'Tham gia 1 giải đấu hàng tuần.',
        required: 1,
        rewardCoin: 800,
        rewardTuVi: 2000,
        rewardNgotinh: 20,
        category: 'combat',
        minRealm: 8
    }
];
// P2-04: Elite quest multiplier and chance
const ELITE_QUEST_CHANCE = 0.15; // 15% chance per quest slot
const ELITE_MULTIPLIER = 2; // x2 reward for elite quests
const ELITE_REQ_MULTIPLIER = 2; // x2 required count for elite quests
class DailyQuestService {
    /**
     * Lấy timestamp đầu ngày (0h00 theo UTC+7)
     */
    getTodayStartTimestamp() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        vn.setUTCHours(0, 0, 0, 0);
        return Math.floor((vn.getTime() - 7 * 3600000) / 1000);
    }
    /**
     * Lấy ngày hôm nay dạng YYYY-MM-DD (UTC+7)
     */
    getTodayDateString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        return vn.toISOString().slice(0, 10);
    }
    /**
     * Lấy ngày hôm qua dạng YYYY-MM-DD (UTC+7)
     */
    getYesterdayDateString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000 - 86400000);
        return vn.toISOString().slice(0, 10);
    }
    /**
     * P2-04: Level scaling factor — gentle scaling theo majorRealmIndex
     */
    getLevelScaling(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return 1.0;
        const { majorIndex } = (0, constants_1.getRealmDetails)(user.level);
        return 1 + majorIndex * 0.10;
    }
    /**
     * P2-04: Lấy streak hiện tại
     */
    getStreak(userId) {
        const row = database_1.default.prepare('SELECT * FROM daily_quest_streaks WHERE user_id = ?').get(userId);
        if (!row) {
            return { user_id: userId, current_streak: 0, longest_streak: 0, last_completed_date: null };
        }
        return row;
    }
    /**
     * Lấy hoặc tạo mới bộ nhiệm vụ hàng ngày (3 nhiệm vụ ngẫu nhiên/ngày)
     * P2-04: Thêm Elite Quest chance (15%, x2 reward, x2 required)
     */
    getOrAssignQuests(userId) {
        const nowDay = this.getTodayStartTimestamp();
        // Kiểm tra nhiệm vụ hôm nay
        const existing = database_1.default.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ?
    `).all(userId, nowDay);
        if (existing.length > 0) {
            return existing.map(q => ({
                ...q,
                definition: exports.QUEST_POOL.find(p => p.id === q.quest_id)
            })).filter(q => q.definition);
        }
        // B2: Filter quests by player realm
        const user = UserRepository_1.userRepository.get(userId);
        const playerRealm = user ? Math.floor(user.level / 38) : 0; // 38 levels per realm
        const availableQuests = exports.QUEST_POOL.filter(q => !q.minRealm || playerRealm >= q.minRealm);
        // Tạo mới 3 nhiệm vụ ngẫu nhiên
        const shuffled = [...availableQuests].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);
        const expiresAt = nowDay + 86400; // Hết hạn lúc 0h ngày mai
        const insertStmt = database_1.default.prepare(`
      INSERT OR IGNORE INTO daily_quests
        (user_id, quest_id, progress, required, reward_coin, reward_exp, reward_ngotinh, is_claimed, is_elite, assigned_at, expires_at)
      VALUES (?, ?, 0, ?, ?, ?, ?, 0, ?, ?, ?)
    `);
        const insertTx = database_1.default.transaction(() => {
            for (const quest of selected) {
                // P2-04: 15% chance elite quest — harder target, x2 reward
                const isElite = Math.random() < ELITE_QUEST_CHANCE ? 1 : 0;
                const reqMultiplier = isElite ? ELITE_REQ_MULTIPLIER : 1;
                const rewardMultiplier = isElite ? ELITE_MULTIPLIER : 1;
                insertStmt.run(userId, quest.id, quest.required * reqMultiplier, Math.round(quest.rewardCoin * rewardMultiplier), Math.round(quest.rewardTuVi * rewardMultiplier), Math.round(quest.rewardNgotinh * rewardMultiplier), isElite, nowDay, expiresAt);
            }
        });
        insertTx();
        const newRows = database_1.default.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ?
    `).all(userId, nowDay);
        return newRows.map(q => ({
            ...q,
            definition: exports.QUEST_POOL.find(p => p.id === q.quest_id)
        })).filter(q => q.definition);
    }
    /**
     * Cập nhật tiến trình nhiệm vụ
     */
    updateProgress(userId, questId, amount = 1) {
        const nowDay = this.getTodayStartTimestamp();
        database_1.default.prepare(`
      UPDATE daily_quests
      SET progress = MIN(required, progress + ?)
      WHERE user_id = ? AND quest_id = ? AND assigned_at >= ? AND is_claimed = 0
    `).run(amount, userId, questId, nowDay);
    }
    /**
     * P2-04: Kiểm tra tất cả quest hôm nay đã hoàn thành chưa
     */
    areAllQuestsCompleted(userId) {
        const nowDay = this.getTodayStartTimestamp();
        const quests = database_1.default.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ?
    `).all(userId, nowDay);
        return quests.length > 0 && quests.every(q => q.progress >= q.required);
    }
    /**
     * P2-04: Cập nhật streak khi hoàn thành tất cả quest trong ngày
     */
    updateStreak(userId) {
        const today = this.getTodayDateString();
        const yesterday = this.getYesterdayDateString();
        const streak = this.getStreak(userId);
        let newStreak = 1;
        let isStreakReset = false;
        if (streak.last_completed_date === today) {
            // Đã hoàn thành hôm nay rồi, không thay đổi streak
            newStreak = streak.current_streak;
        }
        else if (streak.last_completed_date === yesterday) {
            // Liên tục từ hôm qua
            newStreak = streak.current_streak + 1;
        }
        else {
            // Bị gián đoạn
            newStreak = 1;
            isStreakReset = true;
        }
        const isWeekBonus = newStreak >= 7 && newStreak % 7 === 0;
        database_1.default.prepare(`
      INSERT INTO daily_quest_streaks (user_id, current_streak, longest_streak, last_completed_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = MAX(daily_quest_streaks.longest_streak, excluded.current_streak),
        last_completed_date = excluded.last_completed_date
    `).run(userId, newStreak, newStreak, today);
        return { streak: newStreak, isStreakReset, isWeekBonus };
    }
    /**
     * Nhận thưởng nhiệm vụ hoàn thành
     * P2-04: Level scaling + Perfect day bonus + Streak bonus
     */
    claimQuest(userId, questId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const nowDay = this.getTodayStartTimestamp();
        const quest = database_1.default.prepare(`
      SELECT * FROM daily_quests
      WHERE user_id = ? AND quest_id = ? AND assigned_at >= ? AND is_claimed = 0
    `).get(userId, questId, nowDay);
        if (!quest)
            return { success: false, message: 'Nhiệm vụ không tồn tại hoặc đã nhận thưởng.' };
        if (quest.progress < quest.required) {
            return { success: false, message: `Nhiệm vụ chưa hoàn thành! (${quest.progress}/${quest.required})` };
        }
        const def = exports.QUEST_POOL.find(p => p.id === questId);
        const scaling = this.getLevelScaling(userId);
        // P2-04: Level scaling applied to rewards
        let rewardCoin = Math.round(quest.reward_coin * scaling);
        let rewardExp = Math.round(quest.reward_exp * scaling);
        let rewardNgotinh = Math.round(quest.reward_ngotinh * scaling);
        let resultMessage = `✅ **${def?.emoji || '🎁'} ${def?.name || questId}** hoàn thành!`;
        resultMessage += `\n🟤 +${rewardCoin} Linh Thạch | 🌿 +${rewardExp} Tu Vi | 🧘 +${rewardNgotinh} Ngộ Tính`;
        if (quest.is_elite) {
            resultMessage += `\n⭐ **Nhiệm Vụ Tinh Anh!** x2 phần thưởng`;
        }
        // P2-04: Calculate Perfect Day + Streak bonuses BEFORE transaction
        let perfectBonusCoin = 0, perfectBonusExp = 0, perfectBonusNgotinh = 0;
        let streakBonusCoin = 0, streakBonusExp = 0, streakBonusNgotinh = 0;
        let streakInfo = { streak: 0, isWeekBonus: false };
        // Temporarily mark quest as claimed to check areAllQuestsCompleted
        // (we check progress, not is_claimed, so this is safe)
        if (this.areAllQuestsCompleted(userId)) {
            streakInfo = this.updateStreak(userId);
            perfectBonusCoin = Math.round(rewardCoin * 0.3);
            perfectBonusExp = Math.round(rewardExp * 0.3);
            perfectBonusNgotinh = Math.round(rewardNgotinh * 0.3);
            resultMessage += `\n🎉 **Perfect Day!** Hoàn thành tất cả 3 nhiệm vụ → +30% thưởng!`;
            resultMessage += `\n🟤 +${perfectBonusCoin} | 🌿 +${perfectBonusExp} | 🧘 +${perfectBonusNgotinh}`;
            if (streakInfo.isWeekBonus) {
                streakBonusCoin = Math.round(rewardCoin * 0.5);
                streakBonusExp = Math.round(rewardExp * 0.5);
                streakBonusNgotinh = Math.round(rewardNgotinh * 0.5);
                resultMessage += `\n🔥 **Chuỗi x${streakInfo.streak}!** Tuần hoàn hảo → x1.5 thưởng!`;
                resultMessage += `\n🟤 +${streakBonusCoin} | 🌿 +${streakBonusExp} | 🧘 +${streakBonusNgotinh}`;
            }
            else {
                resultMessage += `\n🔥 Chuỗi: ${streakInfo.streak}/7 ngày`;
            }
        }
        // Single atomic transaction: claim + give all rewards
        const totalCoin = rewardCoin + perfectBonusCoin + streakBonusCoin;
        const totalExp = rewardExp + perfectBonusExp + streakBonusExp;
        const totalNgotinh = rewardNgotinh + perfectBonusNgotinh + streakBonusNgotinh;
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE daily_quests SET is_claimed = 1 WHERE id = ?').run(quest.id);
            UserRepository_1.userRepository.update(userId, {
                coin_ha_pham: user.coin_ha_pham + totalCoin,
                tu_vi: Math.min(user.tu_vi + totalExp, user.exp_needed),
                ngotinh: (user.ngotinh || 0) + totalNgotinh
            });
        })();
        // V12 D-01: Season Pass EXP for daily quest completion
        try {
            const { eventCalendarService } = require('./EventCalendarService');
            eventCalendarService.addSeasonPassExp(userId, 5);
        }
        catch (_) { }
        return { success: true, message: resultMessage };
    }
    /**
     * P2-04: Weekly Summary — hiển thị tổng kết tuần
     */
    getWeeklySummary(userId) {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        // Lấy 7 ngày gần nhất
        const weekStart = new Date(vn);
        weekStart.setUTCDate(vn.getUTCDate() - 6);
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekStartTs = Math.floor((weekStart.getTime() - 7 * 3600000) / 1000);
        const quests = database_1.default.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ? ORDER BY assigned_at ASC
    `).all(userId, weekStartTs);
        if (quests.length === 0) {
            return '📊 **Tổng Kết Tuần**\nChưa có nhiệm vụ nào trong tuần này.';
        }
        // Tính toán
        const totalAssigned = quests.length;
        const totalCompleted = quests.filter(q => q.progress >= q.required).length;
        const totalClaimed = quests.filter(q => q.is_claimed === 1).length;
        const eliteCompleted = quests.filter(q => q.is_elite && q.progress >= q.required).length;
        // Tính tổng rewards đã claim
        let totalCoin = 0, totalExp = 0, totalNgotinh = 0;
        for (const q of quests.filter(q => q.is_claimed)) {
            totalCoin += q.reward_coin;
            totalExp += q.reward_exp;
            totalNgotinh += q.reward_ngotinh;
        }
        const streak = this.getStreak(userId);
        const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
        let msg = `📊 **Tổng Kết Tuần** (7 ngày gần nhất)\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📋 Nhiệm vụ được giao: **${totalAssigned}**\n`;
        msg += `✅ Hoàn thành: **${totalCompleted}/${totalAssigned}** (${completionRate}%)\n`;
        msg += `🎁 Đã nhận thưởng: **${totalClaimed}**\n`;
        if (eliteCompleted > 0) {
            msg += `⭐ Nhiệm Vụ Tinh Anh hoàn thành: **${eliteCompleted}**\n`;
        }
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🟤 Linh Thạch: **+${totalCoin}**\n`;
        msg += `🌿 Tu Vi: **+${totalExp}**\n`;
        msg += `🧘 Ngộ Tính: **+${totalNgotinh}**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔥 Streak hiện tại: **${streak.current_streak}** ngày\n`;
        msg += `🏆 Streak dài nhất: **${streak.longest_streak}** ngày`;
        return msg;
    }
    /**
     * Lấy số giây còn lại đến reset
     */
    getSecondsToReset() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const tomorrowVN = new Date(vn);
        tomorrowVN.setUTCDate(vn.getUTCDate() + 1);
        tomorrowVN.setUTCHours(0, 0, 0, 0);
        const tomorrowUTC = new Date(tomorrowVN.getTime() - 7 * 3600000);
        return Math.floor((tomorrowUTC.getTime() - now.getTime()) / 1000);
    }
}
exports.dailyQuestService = new DailyQuestService();
