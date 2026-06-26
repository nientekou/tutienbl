"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyLoginService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const itemConstants_1 = require("../config/itemConstants");
// B-08: Enhanced 30-day cycle with better milestones
const LOGIN_REWARDS = [
    { day: 1, coins: 100, exp: 50 },
    { day: 2, coins: 150, exp: 75 },
    { day: 3, coins: 200, exp: 100, itemId: itemConstants_1.ITEMS.PILL_TU_VI_LOW, itemName: 'Sơ Cấp Tụ Khí Đan' },
    { day: 4, coins: 250, exp: 125 },
    { day: 5, coins: 300, exp: 150 },
    { day: 6, coins: 400, exp: 200, itemId: itemConstants_1.ITEMS.PILL_HP_1, itemName: 'Hồi Huyết Đan - Hạ Phẩm' },
    { day: 7, coins: 1000, exp: 500, title: 'Khách Quý Thiên Đường', itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_1, itemName: 'Tụ Khí Đan' },
    { day: 8, coins: 500, exp: 300, itemId: itemConstants_1.ITEMS.MATERIAL_IRON_1, itemName: 'Sắt Qúy' },
    { day: 10, coins: 800, exp: 500, itemId: itemConstants_1.ITEMS.PILL_HP_2, itemName: 'Hồi Huyết Đan - Trung Phẩm' },
    { day: 12, coins: 1000, exp: 600, itemId: itemConstants_1.ITEMS.MATERIAL_MYTHRIL_1, itemName: 'Mithril' },
    { day: 14, coins: 2000, exp: 1000, itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_2, itemName: 'Phá Cảnh Đan - Sơ', title: 'Kỳ Dự Thiên Mệnh' },
    { day: 15, coins: 1500, exp: 800, itemId: itemConstants_1.ITEMS.PILL_STAMINA_1, itemName: 'Hồi Thể Đan - Sơ Cấp' },
    { day: 17, coins: 1800, exp: 900, itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_3, itemName: 'Phá Cảnh Đan - Trung' },
    { day: 19, coins: 2200, exp: 1100, itemId: itemConstants_1.ITEMS.PILL_STAMINA_2, itemName: 'Hồi Thể Đan - Trung Phẩm' },
    { day: 21, coins: 3000, exp: 1500, title: 'Phúc Lạc Thiên Tiên', itemId: itemConstants_1.ITEMS.PILL_HP_MAX_PERM, itemName: 'Thiên Niên Huyết Đan' },
    { day: 22, coins: 2500, exp: 1200, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_TUVI, itemName: 'Luyện Đan Tụ Khí Đan' },
    { day: 24, coins: 3000, exp: 1500, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_BREAK, itemName: 'Luyện Đan Phá Cảnh Đan' },
    { day: 26, coins: 3500, exp: 1800, itemId: itemConstants_1.ITEMS.PILL_BREAK_1, itemName: 'Trúc Cơ Đan' },
    { day: 28, coins: 4000, exp: 2000, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_STAMINA, itemName: 'Luyện Đan Hồi Thể Đan' },
    { day: 29, coins: 5000, exp: 2500, itemId: itemConstants_1.ITEMS.PILL_CUU_CHUYEN, itemName: 'Cửu Chuyển Hồi Xuân Đan' },
    { day: 30, coins: 8000, exp: 5000, title: 'Vạn Kiếp Bất Diệt', itemId: itemConstants_1.ITEMS.PILL_BREAK_1, itemName: 'Trúc Cơ Đan' },
];
class DailyLoginService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_daily_logins (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        streak INTEGER DEFAULT 0,
        last_login_date TEXT,
        total_logins INTEGER DEFAULT 0,
        streak_shields INTEGER DEFAULT 0,
        PRIMARY KEY(user_id)
      );
    `);
        // B-08: Add streak_shields column if missing
        try {
            database_1.default.exec(`ALTER TABLE user_daily_logins ADD COLUMN streak_shields INTEGER DEFAULT 0`);
        }
        catch (e) { }
    }
    /**
     * B-08: Calculate streak multiplier
     * 7 days = x1.5, 14 days = x2, 30 days = x3
     */
    getStreakMultiplier(streak) {
        if (streak >= 30)
            return 3.0;
        if (streak >= 14)
            return 2.0;
        if (streak >= 7)
            return 1.5;
        return 1.0;
    }
    claimLogin(userId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật!' };
        }
        const today = new Date().toLocaleDateString('en-CA');
        let record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record) {
            database_1.default.prepare('INSERT INTO user_daily_logins (user_id, streak, last_login_date, total_logins, streak_shields) VALUES (?, 0, ?, 0, 0)').run(userId, '');
            record = { user_id: userId, streak: 0, last_login_date: '', total_logins: 0, streak_shields: 0 };
        }
        if (record.last_login_date === today) {
            return { success: false, message: '📅 Đạo hữu đã nhận thưởng đăng nhập hôm nay rồi!' };
        }
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
        let newStreak = record.last_login_date === yesterday ? record.streak + 1 : 1;
        let shieldUsed = false;
        // B-08: Streak Shield — miss 1 day but don't reset if have shield
        if (record.last_login_date !== yesterday && record.last_login_date !== today) {
            if (record.streak_shields > 0) {
                newStreak = record.streak + 1; // Maintain streak
                record.streak_shields--;
                shieldUsed = true;
            }
        }
        const reward = this.getRewardForDay(newStreak);
        if (!reward) {
            return { success: false, message: 'Không tìm thấy phần thưởng!' };
        }
        // B-08: Streak multiplier
        const multiplier = this.getStreakMultiplier(newStreak);
        const finalCoins = Math.round(reward.coins * multiplier);
        const finalExp = Math.round(reward.exp * multiplier);
        database_1.default.prepare('UPDATE user_daily_logins SET streak = ?, last_login_date = ?, total_logins = total_logins + 1, streak_shields = ? WHERE user_id = ?')
            .run(newStreak, today, record.streak_shields, userId);
        if (finalCoins > 0) {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + finalCoins });
        }
        if (finalExp > 0) {
            UserRepository_1.userRepository.update(userId, { tu_vi: Math.min(user.tu_vi + finalExp, user.exp_needed) });
        }
        if (reward.itemId) {
            InventoryRepository_1.inventoryRepository.addItem(userId, reward.itemId, 1, null);
        }
        if (reward.title) {
            database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
                .run(userId, reward.title, 'daily_login', Math.floor(Date.now() / 1000));
        }
        let msg = `📅 **ĐĂNG NHẬP THÀNH CÔNG!** Streak: **${newStreak}** ngày\n`;
        if (shieldUsed)
            msg += `🛡️ **Streak Shield** đã giữ streak của đạo hữu!\n`;
        if (multiplier > 1)
            msg += `🔥 **Streak Bonus x${multiplier}** (${newStreak} ngày liên tiếp!)\n`;
        msg += `┌─── Phần thưởng:\n`;
        if (finalCoins > reward.coins)
            msg += `│ • **+${finalCoins}** Linh Thạch 🟤 (${reward.coins} × ${multiplier})\n`;
        else if (finalCoins > 0)
            msg += `│ • **+${finalCoins}** Linh Thạch 🟤\n`;
        if (finalExp > reward.exp)
            msg += `│ • **+${finalExp}** Tu Vi 🌿 (${reward.exp} × ${multiplier})\n`;
        else if (finalExp > 0)
            msg += `│ • **+${finalExp}** Tu Vi 🌿\n`;
        if (reward.itemName)
            msg += `│ • **${reward.itemName}** 🎁\n`;
        if (reward.title)
            msg += `│ • Danh hiệu: **${reward.title}** 🏆\n`;
        msg += `└── Tiếp tục đăng nhập ngày mai để nhận thưởng lớn hơn!`;
        return { success: true, message: msg, reward, multiplier };
    }
    /**
     * B-08: Use a streak shield (earned from achievements or special events)
     */
    useStreakShield(userId) {
        this.initTable();
        const record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record || record.streak_shields <= 0) {
            return { success: false, message: 'Không có Streak Shield nào!' };
        }
        return { success: true, message: `🛡️ Đã kích hoạt Streak Shield! (${record.streak_shields - 1} shield còn lại)` };
    }
    /**
     * B-08: Get login info with multiplier and shield info
     */
    getLoginInfo(userId) {
        this.initTable();
        let record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record) {
            return { streak: 0, totalLogins: 0, nextReward: LOGIN_REWARDS[0], multiplier: 1.0, shields: 0 };
        }
        const nextDay = record.streak + 1;
        const nextReward = LOGIN_REWARDS.find(r => r.day === nextDay) || LOGIN_REWARDS[LOGIN_REWARDS.length - 1];
        return {
            streak: record.streak,
            totalLogins: record.total_logins,
            nextReward,
            multiplier: this.getStreakMultiplier(record.streak),
            shields: record.streak_shields || 0
        };
    }
    /**
     * B-08: Get streak leaderboard
     */
    getStreakLeaderboard(limit = 10) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT ul.user_id, ul.streak, ul.total_logins, u.name
      FROM user_daily_logins ul
      JOIN users u ON ul.user_id = u.discord_id
      ORDER BY ul.streak DESC, ul.total_logins DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            streak: r.streak,
            totalLogins: r.total_logins
        }));
    }
    getRewardForDay(day) {
        for (let i = LOGIN_REWARDS.length - 1; i >= 0; i--) {
            if (day >= LOGIN_REWARDS[i].day) {
                return LOGIN_REWARDS[i];
            }
        }
        return LOGIN_REWARDS[0];
    }
}
exports.dailyLoginService = new DailyLoginService();
