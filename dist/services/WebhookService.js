"use strict";
/**
 * Webhook/Notification Service
 * Gửi thông báo Discord khi có sự kiện lớn trong game
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = void 0;
const database_1 = __importDefault(require("../database/database"));
class WebhookService {
    /**
     * Ghi sự kiện vào bảng notifications để sau này xử lý
     */
    logEvent(type, message, importance = 'medium') {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO notifications (type, message, importance, created_at, is_sent)
      VALUES (?, ?, ?, ?, 0)
    `).run(type, message, importance, now);
    }
    /**
     * Lấy các sự kiện chưa gửi
     */
    getPendingEvents() {
        return database_1.default.prepare(`
      SELECT * FROM notifications WHERE is_sent = 0 ORDER BY importance DESC, created_at ASC LIMIT 10
    `).all();
    }
    /**
     * Đánh dấu sự kiện đã gửi
     */
    markSent(event) {
        database_1.default.prepare('UPDATE notifications SET is_sent = 1 WHERE rowid = ?').run(event.rowid);
    }
    /**
     * Gọi webhook cho các sự kiện quan trọng — thông báo boss chết, đột phá lớn
     */
    async notifyMajorEvent(title, description, color = 0xe67e22) {
        // Lấy webhook URL từ config (nếu có)
        const config = database_1.default.prepare("SELECT value FROM system_config WHERE key = 'webhook_url'").get();
        if (!config || !config.value)
            return;
        try {
            const { WebhookClient, EmbedBuilder } = require('discord.js');
            const webhook = new WebhookClient({ url: config.value });
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();
            await webhook.send({ embeds: [embed] });
        }
        catch (e) {
            console.error('[Webhook] Lỗi gửi webhook:', e);
        }
    }
}
exports.webhookService = new WebhookService();
