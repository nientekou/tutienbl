/**
 * Webhook/Notification Service
 * Gửi thông báo Discord khi có sự kiện lớn trong game
 */

import db from '../database/database';

interface WebhookEvent {
  type: string;
  message: string;
  importance: 'low' | 'medium' | 'high';
  timestamp: number;
}

class WebhookService {
  /**
   * Ghi sự kiện vào bảng notifications để sau này xử lý
   */
  public logEvent(type: string, message: string, importance: 'low' | 'medium' | 'high' = 'medium'): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO notifications (type, message, importance, created_at, is_sent)
      VALUES (?, ?, ?, ?, 0)
    `).run(type, message, importance, now);
  }

  /**
   * Lấy các sự kiện chưa gửi
   */
  public getPendingEvents(): WebhookEvent[] {
    return db.prepare(`
      SELECT * FROM notifications WHERE is_sent = 0 ORDER BY importance DESC, created_at ASC LIMIT 10
    `).all() as WebhookEvent[];
  }

  /**
   * Đánh dấu sự kiện đã gửi
   */
  public markSent(event: WebhookEvent): void {
    db.prepare('UPDATE notifications SET is_sent = 1 WHERE rowid = ?').run((event as any).rowid);
  }

  /**
   * Gọi webhook cho các sự kiện quan trọng — thông báo boss chết, đột phá lớn
   */
  public async notifyMajorEvent(title: string, description: string, color: number = 0xe67e22): Promise<void> {
    // Lấy webhook URL từ config (nếu có)
    const config = db.prepare("SELECT value FROM system_config WHERE key = 'webhook_url'").get() as { value: string } | undefined;
    if (!config || !config.value) return;

    try {
      const { WebhookClient, EmbedBuilder } = require('discord.js');
      const webhook = new WebhookClient({ url: config.value });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

      await webhook.send({ embeds: [embed] });
    } catch (e) {
      console.error('[Webhook] Lỗi gửi webhook:', e);
    }
  }
}

export const webhookService = new WebhookService();
