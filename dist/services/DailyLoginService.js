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
// Tiered login rewards: Days 1-7 Low, 8-14 Mid, 15-21 High, 22-28 Special, 29-30 Legendary
const LOGIN_REWARDS = [
    { day: 1, coins: 100, exp: 50 },
    { day: 2, coins: 150, exp: 75 },
    { day: 3, coins: 200, exp: 100, itemId: itemConstants_1.ITEMS.PILL_TU_VI_LOW, itemName: 'Sơ Cấp Tụ Khí Đan' },
    { day: 4, coins: 250, exp: 125 },
    { day: 5, coins: 300, exp: 150 },
    { day: 6, coins: 400, exp: 200, itemId: itemConstants_1.ITEMS.PILL_HP_1, itemName: 'Hồi Huyết Đan - Hạ Phẩm' },
    { day: 7, coins: 1000, exp: 500, title: 'Khách Quý Thiên Đường' },
    { day: 8, coins: 500, exp: 300, itemId: itemConstants_1.ITEMS.MATERIAL_IRON_1, itemName: 'Sắt Qúy' },
    { day: 10, coins: 800, exp: 500, itemId: itemConstants_1.ITEMS.PILL_HP_2, itemName: 'Hồi Huyết Đan - Trung Phẩm' },
    { day: 12, coins: 1000, exp: 600, itemId: itemConstants_1.ITEMS.MATERIAL_MYTHRIL_1, itemName: 'Mithril' },
    { day: 14, coins: 2000, exp: 1000, itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_1, itemName: 'Tụ Khí Đan' },
    { day: 15, coins: 1500, exp: 800, itemId: itemConstants_1.ITEMS.PILL_STAMINA_1, itemName: 'Hồi Thể Đan - Sơ Cấp' },
    { day: 17, coins: 1800, exp: 900, itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_2, itemName: 'Phá Cảnh Đan - Sơ' },
    { day: 19, coins: 2200, exp: 1100, itemId: itemConstants_1.ITEMS.PILL_BREAK_MINOR_3, itemName: 'Phá Cảnh Đan - Trung' },
    { day: 21, coins: 3000, exp: 1500, itemId: itemConstants_1.ITEMS.PILL_STAMINA_2, itemName: 'Hồi Thể Đan - Trung Phẩm' },
    { day: 22, coins: 2500, exp: 1200, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_TUVI, itemName: 'Luyện Đan Tụ Khí Đan' },
    { day: 24, coins: 3000, exp: 1500, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_BREAK, itemName: 'Luyện Đan Phá Cảnh Đan' },
    { day: 26, coins: 3500, exp: 1800, itemId: itemConstants_1.ITEMS.PILL_HP_MAX_PERM, itemName: 'Thiên Niên Huyết Đan' },
    { day: 28, coins: 4000, exp: 2000, itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_STAMINA, itemName: 'Luyện Đan Hồi Thể Đan' },
    { day: 29, coins: 5000, exp: 2500, itemId: itemConstants_1.ITEMS.PILL_BREAK_1, itemName: 'Trúc Cơ Đan' },
    { day: 30, coins: 8000, exp: 5000, title: 'Loyal Disciple', itemId: itemConstants_1.ITEMS.PILL_CUU_CHUYEN, itemName: 'Cửu Chuyển Hồi Xuân Đan' },
];
class DailyLoginService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_daily_logins (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        streak INTEGER DEFAULT 0,
        last_login_date TEXT,
        total_logins INTEGER DEFAULT 0,
        PRIMARY KEY(user_id)
      );
    `);
    }
    claimLogin(userId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'âŒ Äáº¡o há»¯u chÆ°a khá»Ÿi táº¡o nhÃ¢n váº­t!' };
        }
        const today = new Date().toLocaleDateString('en-CA');
        let record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record) {
            database_1.default.prepare('INSERT INTO user_daily_logins (user_id, streak, last_login_date, total_logins) VALUES (?, 0, ?, 0)').run(userId, '');
            record = { user_id: userId, streak: 0, last_login_date: '', total_logins: 0 };
        }
        if (record.last_login_date === today) {
            return { success: false, message: 'ðŸ“… Äáº¡o há»¯u Ä‘Ã£ nháº­n thÆ°á»Ÿng Ä‘Äƒng nháº­p hÃ´m nay rá»“i!' };
        }
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
        let newStreak = record.last_login_date === yesterday ? record.streak + 1 : 1;
        const reward = this.getRewardForDay(newStreak);
        if (!reward) {
            return { success: false, message: 'KhÃ´ng tÃ¬m tháº¥y pháº§n thÆ°á»Ÿng!' };
        }
        database_1.default.prepare('UPDATE user_daily_logins SET streak = ?, last_login_date = ?, total_logins = total_logins + 1 WHERE user_id = ?')
            .run(newStreak, today, userId);
        if (reward.coins > 0) {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.coins });
        }
        if (reward.exp > 0) {
            UserRepository_1.userRepository.update(userId, { tu_vi: Math.min(user.tu_vi + reward.exp, user.exp_needed) });
        }
        if (reward.itemId) {
            InventoryRepository_1.inventoryRepository.addItem(userId, reward.itemId, 1, null);
        }
        if (reward.title) {
            database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
                .run(userId, reward.title, 'daily_login', Math.floor(Date.now() / 1000));
        }
        let msg = `ðŸ“… **ÄÄ‚NG NHáº¬P THÃ€NH CÃ”NG!** Streak: **${newStreak}** ngÃ y\n`;
        msg += `â”Œâ”€ Pháº§n thÆ°á»Ÿng:\n`;
        if (reward.coins > 0)
            msg += `â”‚ â€¢ **+${reward.coins}** Háº¡ Pháº©m Linh Tháº¡ch ðŸŸ¤\n`;
        if (reward.exp > 0)
            msg += `â”‚ â€¢ **+${reward.exp}** Tu Vi ðŸŒ¿\n`;
        if (reward.itemName)
            msg += `â”‚ â€¢ **${reward.itemName}** ðŸŽ\n`;
        if (reward.title)
            msg += `â”‚ â€¢ Danh hiá»‡u: **${reward.title}** ðŸ†\n`;
        msg += `â””â”€ Tiáº¿p tá»¥c Ä‘Äƒng nháº­p ngÃ y mai Ä‘á»ƒ nháº­n thÆ°á»Ÿng lá»›n hÆ¡n!`;
        return { success: true, message: msg, reward };
    }
    getLoginInfo(userId) {
        this.initTable();
        let record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record) {
            return { streak: 0, totalLogins: 0, nextReward: LOGIN_REWARDS[0] };
        }
        const nextDay = record.streak + 1;
        const nextReward = LOGIN_REWARDS.find(r => r.day === nextDay) || LOGIN_REWARDS[LOGIN_REWARDS.length - 1];
        return { streak: record.streak, totalLogins: record.total_logins, nextReward };
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
