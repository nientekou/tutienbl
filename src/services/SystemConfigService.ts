import db from '../database/database';

export class SystemConfigService {
  /**
   * Kiểm tra xem hệ thống có đang ở chế độ bảo trì hay không.
   */
  public isMaintenanceMode(): boolean {
    try {
      const row = db.prepare("SELECT value FROM system_config WHERE key = 'maintenance_mode'").get() as { value: string } | undefined;
      return row ? row.value === '1' : false;
    } catch (e) {
      console.error('Lỗi khi kiểm tra chế độ bảo trì:', e);
      return false;
    }
  }

  /**
   * Bật hoặc tắt chế độ bảo trì.
   */
  public setMaintenanceMode(enabled: boolean): void {
    const value = enabled ? '1' : '0';
    db.prepare(`
      INSERT INTO system_config (key, value)
      VALUES ('maintenance_mode', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(value);
  }

  /**
   * Ghi nhận log giao dịch nhạy cảm để điều tra nếu cần.
   */
  public writeAuditLog(userId: string, action: string, details: string | object): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, action, detailsStr, now);
    } catch (e) {
      console.error('Lỗi khi ghi log giao dịch:', e);
    }
  }
}

export const systemConfigService = new SystemConfigService();
