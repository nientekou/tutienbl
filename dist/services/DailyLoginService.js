"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyLoginService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const LOGIN_REWARDS = [
    { day: 1, coins: 100, exp: 50 },
    { day: 2, coins: 150, exp: 75 },
    { day: 3, coins: 200, exp: 100, itemId: 'pill_tu_vi_low', itemName: 'Sơ Cấp Tụ Khí Đan' },
    { day: 4, coins: 250, exp: 125 },
    { day: 5, coins: 300, exp: 150 },
    { day: 6, coins: 400, exp: 200, itemId: 'pill_hp_1', itemName: 'Hồi Huyết Đan - Hạ Phẩm' },
    { day: 7, coins: 1000, exp: 500, title: 'Khách Quý Thiên Đường' },
    { day: 14, coins: 2000, exp: 1000, itemId: 'pill_break_minor_1', itemName: 'Tụ Khí Đan' },
    { day: 21, coins: 3000, exp: 1500, itemId: 'pill_stamina_1', itemName: 'Hồi Thể Đan - Sơ Cấp' },
    { day: 30, coins: 5000, exp: 3000, title: 'Loyal Disciple', itemId: 'pill_break_1', itemName: 'Trúc Cơ Đan' },
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
            return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật!' };
        }
        const today = new Date().toLocaleDateString('en-CA');
        let record = database_1.default.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId);
        if (!record) {
            database_1.default.prepare('INSERT INTO user_daily_logins (user_id, streak, last_login_date, total_logins) VALUES (?, 0, ?, 0)').run(userId, '');
            record = { user_id: userId, streak: 0, last_login_date: '', total_logins: 0 };
        }
        if (record.last_login_date === today) {
            return { success: false, message: '📅 Đạo hữu đã nhận thưởng đăng nhập hôm nay rồi!' };
        }
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
        let newStreak = record.last_login_date === yesterday ? record.streak + 1 : 1;
        const reward = this.getRewardForDay(newStreak);
        if (!reward) {
            return { success: false, message: 'Không tìm thấy phần thưởng!' };
        }
        database_1.default.prepare('UPDATE user_daily_logins SET streak = ?, last_login_date = ?, total_logins = total_logins + 1 WHERE user_id = ?')
            .run(newStreak, today, userId);
        if (reward.coins > 0) {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.coins });
        }
        if (reward.exp > 0) {
            UserRepository_1.userRepository.update(userId, { tu_vi: user.tu_vi + reward.exp });
        }
        if (reward.itemId) {
            InventoryRepository_1.inventoryRepository.addItem(userId, reward.itemId, 1, null);
        }
        if (reward.title) {
            database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
                .run(userId, reward.title, 'daily_login', Math.floor(Date.now() / 1000));
        }
        let msg = `📅 **ĐĂNG NHẬP THÀNH CÔNG!** Streak: **${newStreak}** ngày\n`;
        msg += `┌─ Phần thưởng:\n`;
        if (reward.coins > 0)
            msg += `│ • **+${reward.coins}** Hạ Phẩm Linh Thạch 🟤\n`;
        if (reward.exp > 0)
            msg += `│ • **+${reward.exp}** Tu Vi 🌿\n`;
        if (reward.itemName)
            msg += `│ • **${reward.itemName}** 🎁\n`;
        if (reward.title)
            msg += `│ • Danh hiệu: **${reward.title}** 🏆\n`;
        msg += `└─ Tiếp tục đăng nhập ngày mai để nhận thưởng lớn hơn!`;
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
