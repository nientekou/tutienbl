"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NOTIFICATION_TYPES = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
exports.NOTIFICATION_TYPES = {
    LINHDIEN_RIPE: 'linhdien_ripe',
    LINHMACH_FULL: 'linhmach_full',
    ARENA_SEASON_END: 'arena_season_end',
    APPRENTICE_MILESTONE: 'apprentice_milestone',
    ANNIVERSARY_REMINDER: 'anniversary_reminder',
};
class NotificationService {
    setSetting(userId, type, enabled) {
        database_1.default.prepare(`
      INSERT INTO user_notification_settings (user_id, type, enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, type) DO UPDATE SET enabled = excluded.enabled
    `).run(userId, type, enabled ? 1 : 0);
    }
    getSettings(userId) {
        const rows = database_1.default.prepare('SELECT type, enabled FROM user_notification_settings WHERE user_id = ?').all(userId);
        const settings = {};
        for (const type of Object.values(exports.NOTIFICATION_TYPES)) {
            settings[type] = false;
        }
        for (const row of rows) {
            settings[row.type] = row.enabled === 1;
        }
        return settings;
    }
    isEnabled(userId, type) {
        const row = database_1.default.prepare('SELECT enabled FROM user_notification_settings WHERE user_id = ? AND type = ?').get(userId, type);
        if (!row)
            return false;
        return row.enabled === 1;
    }
    async sendNotification(userId, type, message, client) {
        const enabled = this.isEnabled(userId, type);
        if (!enabled) {
            console.log(`[NotificationService] ${type} notification for ${userId} is disabled, skipping.`);
            return;
        }
        const user = UserRepository_1.userRepository.get(userId);
        const userName = user?.name ?? userId;
        console.log(`[NotificationService] Sending ${type} notification to ${userName} (${userId}): ${message}`);
        if (client) {
            try {
                const dmChannel = await client.users.createDM(userId);
                await dmChannel.send(message);
                console.log(`[NotificationService] Successfully sent ${type} DM to ${userName}`);
            }
            catch (error) {
                console.error(`[NotificationService] Failed to send ${type} DM to ${userName}:`, error);
            }
        }
    }
    async checkAndNotify(userId, client) {
        await this.checkFarmingRipe(userId, client);
        await this.checkLeylineFull(userId, client);
        await this.checkArenaSeasonEnd(userId, client);
        await this.checkApprenticeMilestone(userId, client);
        await this.checkAnniversaryReminder(userId, client);
    }
    async checkFarmingRipe(userId, client) {
        const enabled = this.isEnabled(userId, exports.NOTIFICATION_TYPES.LINHDIEN_RIPE);
        if (!enabled)
            return;
        try {
            const plots = database_1.default.prepare('SELECT * FROM farming_plots WHERE user_id = ? AND progress >= 100 AND harvested = 0').all(userId);
            if (plots.length > 0) {
                const message = `🌾 **Linh Điện Đã Chín!** Đạo hữu có ${plots.length} ô linh điện đã sẵn sàng thu hoạch. Hãy thu hoạch ngay để tránh lãng phí!`;
                await this.sendNotification(userId, exports.NOTIFICATION_TYPES.LINHDIEN_RIPE, message, client);
            }
        }
        catch (error) {
            console.error(`[NotificationService] checkFarmingRipe error for ${userId}:`, error);
        }
    }
    async checkLeylineFull(userId, client) {
        const enabled = this.isEnabled(userId, exports.NOTIFICATION_TYPES.LINHMACH_FULL);
        if (!enabled)
            return;
        try {
            const cave = database_1.default.prepare('SELECT * FROM user_cave_meridians WHERE user_id = ?').get(userId);
            if (cave) {
                const now = Math.floor(Date.now() / 1000);
                const fullSince = cave.full_since;
                if (fullSince && (now - fullSince) >= 86400) {
                    const message = `⚡ **Linh Mạch Đã Đầy!** Hang động của bạn đã tích đầy linh mạch hơn 24 giờ. Hãy hấp thu ngay để không bỏ lỡ tài nguyên!`;
                    await this.sendNotification(userId, exports.NOTIFICATION_TYPES.LINHMACH_FULL, message, client);
                }
            }
        }
        catch (error) {
            console.error(`[NotificationService] checkLeylineFull error for ${userId}:`, error);
        }
    }
    async checkArenaSeasonEnd(userId, client) {
        const enabled = this.isEnabled(userId, exports.NOTIFICATION_TYPES.ARENA_SEASON_END);
        if (!enabled)
            return;
        try {
            const season = database_1.default.prepare('SELECT * FROM arena_seasons WHERE status = ? ORDER BY season_number DESC LIMIT 1').get('active');
            if (season) {
                const now = Math.floor(Date.now() / 1000);
                const timeLeft = season.ends_at - now;
                if (timeLeft > 0 && timeLeft <= 86400) {
                    const hours = Math.ceil(timeLeft / 3600);
                    const message = `🏆 **Mùa Giải Đấu Sắp Kết Thúc!** Chỉ còn ${hours} giờ nữa là kết thúc mùa giải. Hãy cố gắng leo hạng ngay!`;
                    await this.sendNotification(userId, exports.NOTIFICATION_TYPES.ARENA_SEASON_END, message, client);
                }
            }
        }
        catch (error) {
            console.error(`[NotificationService] checkArenaSeasonEnd error for ${userId}:`, error);
        }
    }
    async checkApprenticeMilestone(userId, client) {
        const enabled = this.isEnabled(userId, exports.NOTIFICATION_TYPES.APPRENTICE_MILESTONE);
        if (!enabled)
            return;
        try {
            const mentorships = database_1.default.prepare('SELECT * FROM mentorships WHERE apprentice_id = ? AND status = ?').all(userId, 'active');
            if (mentorships.length === 0)
                return;
            const apprentice = UserRepository_1.userRepository.get(userId);
            if (!apprentice)
                return;
            const milestones = [25, 40, 50];
            for (const level of milestones) {
                if (apprentice.level === level) {
                    const message = `🎓 **Chúc Mừng Đệ Tử!** Đạo hữu đã đạt cấp độ ${level}! Một bước tiến quan trọng trên con đường tu luyện. Hãy tiếp tục cố gắng!`;
                    await this.sendNotification(userId, exports.NOTIFICATION_TYPES.APPRENTICE_MILESTONE, message, client);
                    break;
                }
            }
        }
        catch (error) {
            console.error(`[NotificationService] checkApprenticeMilestone error for ${userId}:`, error);
        }
    }
    async checkAnniversaryReminder(userId, client) {
        const enabled = this.isEnabled(userId, exports.NOTIFICATION_TYPES.ANNIVERSARY_REMINDER);
        if (!enabled)
            return;
        try {
            const user = UserRepository_1.userRepository.get(userId);
            if (!user)
                return;
            const createdAt = user.created_at;
            if (!createdAt)
                return;
            const now = Math.floor(Date.now() / 1000);
            const daysSinceCreation = Math.floor((now - createdAt) / 86400);
            if (daysSinceCreation === 99) {
                const message = `🎉 **Sinh Nhật Tu Tiên!** Ngày mai là tròn 100 ngày bạn bắt đầu tu luyện! Hãy chuẩn bị đón nhận phần thưởng đặc biệt!`;
                await this.sendNotification(userId, exports.NOTIFICATION_TYPES.ANNIVERSARY_REMINDER, message, client);
            }
        }
        catch (error) {
            console.error(`[NotificationService] checkAnniversaryReminder error for ${userId}:`, error);
        }
    }
    async sendTestNotification(userId, client) {
        const message = '🔔 **Thông Báo Kiểm Tra** Đây là tin nhắn kiểm tra từ hệ thống thông báo. Cảm ơn bạn đã sử dụng dịch vụ!';
        await this.sendNotification(userId, 'test', message, client);
    }
}
exports.notificationService = new NotificationService();
