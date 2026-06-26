"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const database_1 = __importDefault(require("../database/database"));
class NotificationService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'info',
        emoji TEXT DEFAULT '📌',
        is_read INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notif_user ON user_notifications(user_id, is_read, created_at);

      CREATE TABLE IF NOT EXISTS user_notification_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        urgent_enabled INTEGER DEFAULT 1,
        important_enabled INTEGER DEFAULT 1,
        info_enabled INTEGER DEFAULT 1,
        push_enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS notification_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        notification_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
    }
    addNotification(userId, title, message, category = 'info', emoji = '📌') {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO user_notifications (user_id, title, message, category, emoji, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
            .run(userId, title, message, category, emoji, now);
    }
    getUnread(userId, limit = 20) {
        this.initTable();
        const settings = this.getSettings(userId);
        return database_1.default.prepare('SELECT * FROM user_notifications WHERE user_id = ? AND is_read = 0 AND category IN (?, ?, ?) ORDER BY created_at DESC LIMIT ?')
            .all(userId, settings.urgentEnabled ? 'urgent' : '__none__', settings.importantEnabled ? 'important' : '__none__', settings.infoEnabled ? 'info' : '__none__', limit);
    }
    getAll(userId, limit = 50) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
            .all(userId, limit);
    }
    markRead(userId, notifId) {
        this.initTable();
        if (notifId) {
            database_1.default.prepare('UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, userId);
            this.recordHistory(userId, notifId, 'read');
        }
        else {
            database_1.default.prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
        }
    }
    getUnreadCount(userId) {
        this.initTable();
        const settings = this.getSettings(userId);
        const row = database_1.default.prepare('SELECT COUNT(*) as c FROM user_notifications WHERE user_id = ? AND is_read = 0 AND category IN (?, ?, ?)')
            .get(userId, settings.urgentEnabled ? 'urgent' : '__none__', settings.importantEnabled ? 'important' : '__none__', settings.infoEnabled ? 'info' : '__none__');
        return row.c;
    }
    getNotificationsDescription(userId) {
        const unread = this.getUnread(userId, 10);
        const count = this.getUnreadCount(userId);
        if (count === 0)
            return '🔔 **Thông Báo** — Không có thông báo mới.';
        let msg = `🔔 **Thông Báo** (${count} chưa đọc)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const n of unread) {
            const catEmoji = n.category === 'urgent' ? '🔴' : n.category === 'important' ? '🟡' : '🟢';
            const timeAgo = this.getTimeAgo(n.timestamp);
            msg += `${catEmoji} ${n.emoji} **${n.title}**\n└ ${n.message} (${timeAgo})\n`;
        }
        msg += `\n*Dùng \`/thongbao\` để xem tất cả*`;
        return msg;
    }
    urgentNotification(userId, title, message) {
        this.addNotification(userId, title, message, 'urgent', '🚨');
    }
    cleanup() {
        this.initTable();
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
        database_1.default.prepare('DELETE FROM user_notifications WHERE created_at < ? AND is_read = 1').run(thirtyDaysAgo);
    }
    // === A-01: Enhanced features ===
    /**
     * A-01: Get notification settings
     */
    getSettings(userId) {
        this.initTable();
        let row = database_1.default.prepare('SELECT * FROM user_notification_settings WHERE user_id = ?').get(userId);
        if (!row) {
            database_1.default.prepare('INSERT INTO user_notification_settings (user_id) VALUES (?)').run(userId);
            row = { userId, urgentEnabled: true, importantEnabled: true, infoEnabled: true, pushEnabled: true };
        }
        return row;
    }
    /**
     * A-01: Update notification settings
     */
    updateSettings(userId, settings) {
        this.initTable();
        const current = this.getSettings(userId);
        const updated = { ...current, ...settings };
        database_1.default.prepare(`
      INSERT INTO user_notification_settings (user_id, urgent_enabled, important_enabled, info_enabled, push_enabled)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        urgent_enabled = excluded.urgent_enabled,
        important_enabled = excluded.important_enabled,
        info_enabled = excluded.info_enabled,
        push_enabled = excluded.push_enabled
    `).run(userId, updated.urgentEnabled ? 1 : 0, updated.importantEnabled ? 1 : 0, updated.infoEnabled ? 1 : 0, updated.pushEnabled ? 1 : 0);
    }
    /**
     * A-01: Record notification history
     */
    recordHistory(userId, notificationId, action) {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO notification_history (user_id, notification_id, action, timestamp) VALUES (?, ?, ?, ?)')
            .run(userId, notificationId, action, now);
    }
    /**
     * A-01: Get notification history
     */
    getHistory(userId, limit = 20) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM notification_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
            .all(userId, limit);
    }
    /**
     * A-01: Get notifications by category
     */
    getByCategory(userId, category, limit = 20) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM user_notifications WHERE user_id = ? AND category = ? ORDER BY created_at DESC LIMIT ?')
            .all(userId, category, limit);
    }
    /**
     * A-01: Get notification stats
     */
    getStats(userId) {
        this.initTable();
        const total = database_1.default.prepare('SELECT COUNT(*) as c FROM user_notifications WHERE user_id = ?').get(userId);
        const unread = database_1.default.prepare('SELECT COUNT(*) as c FROM user_notifications WHERE user_id = ? AND is_read = 0').get(userId);
        const byCategory = {};
        const categories = ['urgent', 'important', 'info'];
        for (const cat of categories) {
            const row = database_1.default.prepare('SELECT COUNT(*) as c FROM user_notifications WHERE user_id = ? AND category = ?').get(userId, cat);
            byCategory[cat] = row.c;
        }
        return { total: total.c, unread: unread.c, byCategory };
    }
    /**
     * A-01: Get notification description for settings UI
     */
    getSettingsDescription(userId) {
        const settings = this.getSettings(userId);
        const stats = this.getStats(userId);
        let msg = `🔔 **Notification Settings**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🔴 Urgent: **${settings.urgentEnabled ? 'ON' : 'OFF'}**\n`;
        msg += `🟡 Important: **${settings.importantEnabled ? 'ON' : 'OFF'}**\n`;
        msg += `🟢 Info: **${settings.infoEnabled ? 'ON' : 'OFF'}**\n`;
        msg += `📱 Push: **${settings.pushEnabled ? 'ON' : 'OFF'}**\n\n`;
        msg += `**Stats:**\n`;
        msg += `• Total: **${stats.total}**\n`;
        msg += `• Unread: **${stats.unread}**\n`;
        msg += `• Urgent: **${stats.byCategory.urgent || 0}**\n`;
        msg += `• Important: **${stats.byCategory.important || 0}**\n`;
        msg += `• Info: **${stats.byCategory.info || 0}**\n`;
        return msg;
    }
    getTimeAgo(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - timestamp;
        if (diff < 60)
            return 'vua xong';
        if (diff < 3600)
            return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400)
            return `${Math.floor(diff / 3600)}h trước`;
        return `${Math.floor(diff / 86400)} ngày trước`;
    }
    // === V16 E-04: Smart Notifications ===
    sendSmartNotification(userId, title, message, priority) {
        // Check user notification settings
        const settings = this.getNotificationSettings(userId);
        if (priority === 'urgent' || (priority === 'important' && settings.important) || (priority === 'info' && settings.info)) {
            this.addNotification(userId, title, message, priority);
        }
    }
    getNotificationSettings(userId) {
        try {
            const row = database_1.default.prepare('SELECT * FROM user_notification_settings WHERE user_id = ?')
                .get(userId);
            if (row)
                return { urgent: true, important: row.important_enabled !== 0, info: row.info_enabled !== 0 };
        }
        catch { }
        return { urgent: true, important: true, info: false };
    }
    getSmartNotificationDescription(userId) {
        const settings = this.getNotificationSettings(userId);
        return `**Cài Đặt Thông Báo:**\n` +
            `🔴 Khẩn cấp: Luôn bật\n` +
            `🟡 Quan trọng: ${settings.important ? '✅ Bật' : '❌ Tắt'}\n` +
            `🔵 Thông tin: ${settings.info ? '✅ Bật' : '❌ Tắt'}`;
    }
}
exports.notificationService = new NotificationService();
