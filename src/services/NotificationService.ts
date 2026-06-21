import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export const NOTIFICATION_TYPES = {
  LINHDIEN_RIPE: 'linhdien_ripe',
  LINHMACH_FULL: 'linhmach_full',
  ARENA_SEASON_END: 'arena_season_end',
  APPRENTICE_MILESTONE: 'apprentice_milestone',
  ANNIVERSARY_REMINDER: 'anniversary_reminder',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

interface NotificationSettingRow {
  user_id: string;
  type: string;
  enabled: number;
}

class NotificationService {
  public setSetting(userId: string, type: string, enabled: boolean): void {
    db.prepare(`
      INSERT INTO user_notification_settings (user_id, type, enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, type) DO UPDATE SET enabled = excluded.enabled
    `).run(userId, type, enabled ? 1 : 0);
  }

  public getSettings(userId: string): Record<string, boolean> {
    const rows = db.prepare(
      'SELECT type, enabled FROM user_notification_settings WHERE user_id = ?'
    ).all(userId) as NotificationSettingRow[];

    const settings: Record<string, boolean> = {};
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      settings[type] = false;
    }

    for (const row of rows) {
      settings[row.type] = row.enabled === 1;
    }

    return settings;
  }

  public isEnabled(userId: string, type: string): boolean {
    const row = db.prepare(
      'SELECT enabled FROM user_notification_settings WHERE user_id = ? AND type = ?'
    ).get(userId, type) as NotificationSettingRow | undefined;

    if (!row) return false;
    return row.enabled === 1;
  }

  public async sendNotification(userId: string, type: string, message: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, type);
    if (!enabled) {
      console.log(`[NotificationService] ${type} notification for ${userId} is disabled, skipping.`);
      return;
    }

    const user = userRepository.get(userId);
    const userName = user?.name ?? userId;

    console.log(`[NotificationService] Sending ${type} notification to ${userName} (${userId}): ${message}`);

    if (client) {
      try {
        const dmChannel = await client.users.createDM(userId);
        await dmChannel.send(message);
        console.log(`[NotificationService] Successfully sent ${type} DM to ${userName}`);
      } catch (error) {
        console.error(`[NotificationService] Failed to send ${type} DM to ${userName}:`, error);
      }
    }
  }

  public async checkAndNotify(userId: string, client?: any): Promise<void> {
    await this.checkFarmingRipe(userId, client);
    await this.checkLeylineFull(userId, client);
    await this.checkArenaSeasonEnd(userId, client);
    await this.checkApprenticeMilestone(userId, client);
    await this.checkAnniversaryReminder(userId, client);
  }

  public async checkFarmingRipe(userId: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, NOTIFICATION_TYPES.LINHDIEN_RIPE);
    if (!enabled) return;

    try {
      const plots = db.prepare(
        'SELECT * FROM farming_plots WHERE user_id = ? AND progress >= 100 AND harvested = 0'
      ).all(userId) as any[];

      if (plots.length > 0) {
        const message = `🌾 **Linh Điện Đã Chín!** Bạn có ${plots.length} ô linh điện đã sẵn sàng thu hoạch. Hãy thu hoạch ngay để tránh lãng phí!`;
        await this.sendNotification(userId, NOTIFICATION_TYPES.LINHDIEN_RIPE, message, client);
      }
    } catch (error) {
      console.error(`[NotificationService] checkFarmingRipe error for ${userId}:`, error);
    }
  }

  public async checkLeylineFull(userId: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, NOTIFICATION_TYPES.LINHMACH_FULL);
    if (!enabled) return;

    try {
      const cave = db.prepare(
        'SELECT * FROM user_cave_meridians WHERE user_id = ?'
      ).get(userId) as any;

      if (cave) {
        const now = Math.floor(Date.now() / 1000);
        const fullSince = cave.full_since;
        if (fullSince && (now - fullSince) >= 86400) {
          const message = `⚡ **Linh Mạch Đã Đầy!** Hang động của bạn đã tích đầy linh mạch hơn 24 giờ. Hãy hấp thu ngay để không bỏ lỡ tài nguyên!`;
          await this.sendNotification(userId, NOTIFICATION_TYPES.LINHMACH_FULL, message, client);
        }
      }
    } catch (error) {
      console.error(`[NotificationService] checkLeylineFull error for ${userId}:`, error);
    }
  }

  public async checkArenaSeasonEnd(userId: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, NOTIFICATION_TYPES.ARENA_SEASON_END);
    if (!enabled) return;

    try {
      const season = db.prepare(
        'SELECT * FROM arena_seasons WHERE status = ? ORDER BY season_number DESC LIMIT 1'
      ).get('active') as any;

      if (season) {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = season.ends_at - now;
        if (timeLeft > 0 && timeLeft <= 86400) {
          const hours = Math.ceil(timeLeft / 3600);
          const message = `🏆 **Mùa Giải Đấu Sắp Kết Thúc!** Chỉ còn ${hours} giờ nữa là kết thúc mùa giải. Hãy cố gắng leo hạng ngay!`;
          await this.sendNotification(userId, NOTIFICATION_TYPES.ARENA_SEASON_END, message, client);
        }
      }
    } catch (error) {
      console.error(`[NotificationService] checkArenaSeasonEnd error for ${userId}:`, error);
    }
  }

  public async checkApprenticeMilestone(userId: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, NOTIFICATION_TYPES.APPRENTICE_MILESTONE);
    if (!enabled) return;

    try {
      const mentorships = db.prepare(
        'SELECT * FROM mentorships WHERE apprentice_id = ? AND status = ?'
      ).all(userId, 'active') as any[];

      if (mentorships.length === 0) return;

      const apprentice = userRepository.get(userId);
      if (!apprentice) return;

      const milestones = [25, 40, 50];
      for (const level of milestones) {
        if (apprentice.level === level) {
          const message = `🎓 **Chúc Mừng Đệ Tử!** Bạn đã đạt cấp độ ${level}! Một bước tiến quan trọng trên con đường tu luyện. Hãy tiếp tục cố gắng!`;
          await this.sendNotification(userId, NOTIFICATION_TYPES.APPRENTICE_MILESTONE, message, client);
          break;
        }
      }
    } catch (error) {
      console.error(`[NotificationService] checkApprenticeMilestone error for ${userId}:`, error);
    }
  }

  public async checkAnniversaryReminder(userId: string, client?: any): Promise<void> {
    const enabled = this.isEnabled(userId, NOTIFICATION_TYPES.ANNIVERSARY_REMINDER);
    if (!enabled) return;

    try {
      const user = userRepository.get(userId);
      if (!user) return;

      const createdAt = user.created_at;
      if (!createdAt) return;

      const now = Math.floor(Date.now() / 1000);
      const daysSinceCreation = Math.floor((now - createdAt) / 86400);

      if (daysSinceCreation === 99) {
        const message = `🎉 **Sinh Nhật Tu Tiên!** Ngày mai là tròn 100 ngày bạn bắt đầu tu luyện! Hãy chuẩn bị đón nhận phần thưởng đặc biệt!`;
        await this.sendNotification(userId, NOTIFICATION_TYPES.ANNIVERSARY_REMINDER, message, client);
      }
    } catch (error) {
      console.error(`[NotificationService] checkAnniversaryReminder error for ${userId}:`, error);
    }
  }

  public async sendTestNotification(userId: string, client?: any): Promise<void> {
    const message = '🔔 **Thông Báo Kiểm Tra** Đây là tin nhắn kiểm tra từ hệ thống thông báo. Cảm ơn bạn đã sử dụng dịch vụ!';
    await this.sendNotification(userId, 'test', message, client);
  }
}

export const notificationService = new NotificationService();
