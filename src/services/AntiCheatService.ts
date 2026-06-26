import db from '../database/database';

// C-01: Anti-Cheat System

interface RateLimitEntry {
  userId: string;
  action: string;
  count: number;
  windowStart: number;
}

interface AnomalyEntry {
  userId: string;
  type: string;
  details: string;
  timestamp: number;
}

class AntiCheatService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        window_start INTEGER NOT NULL,
        PRIMARY KEY(user_id, action)
      );

      CREATE TABLE IF NOT EXISTS anomaly_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  /**
   * C-01: Check rate limit
   */
  checkRateLimit(userId: string, action: string, maxPerMinute: number = 30): boolean {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 60; // 1 minute window

    const entry = db.prepare('SELECT * FROM rate_limits WHERE user_id = ? AND action = ?')
      .get(userId, action) as RateLimitEntry | undefined;

    if (!entry || entry.windowStart < windowStart) {
      // New window
      db.prepare('INSERT OR REPLACE INTO rate_limits (user_id, action, count, window_start) VALUES (?, ?, 1, ?)')
        .run(userId, action, now);
      return true;
    }

    if (entry.count >= maxPerMinute) {
      this.logAnomaly(userId, 'rate_limit_exceeded', `Action: ${action}, Count: ${entry.count}`);
      return false;
    }

    db.prepare('UPDATE rate_limits SET count = count + 1 WHERE user_id = ? AND action = ?')
      .run(userId, action);
    return true;
  }

  /**
   * C-01: Validate input
   */
  validateInput(value: any, type: 'string' | 'number' | 'enum', options?: { minLength?: number; maxLength?: number; min?: number; max?: number; enumValues?: any[] }): { valid: boolean; message: string } {
    if (type === 'string') {
      if (typeof value !== 'string') return { valid: false, message: 'Chuỗi không hợp lệ' };
      if (options?.minLength && value.length < options.minLength) return { valid: false, message: `Quá ngắn (tối thiểu ${options.minLength})` };
      if (options?.maxLength && value.length > options.maxLength) return { valid: false, message: `Quá dài (tối đa ${options.maxLength})` };
    } else if (type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) return { valid: false, message: 'Số không hợp lệ' };
      if (options?.min !== undefined && value < options.min) return { valid: false, message: `Quá nhỏ (tối thiểu ${options.min})` };
      if (options?.max !== undefined && value > options.max) return { valid: false, message: `Quá lớn (tối đa ${options.max})` };
    } else if (type === 'enum') {
      if (!options?.enumValues?.includes(value)) return { valid: false, message: 'Giá trị enum không hợp lệ' };
    }

    return { valid: true, message: 'Hợp lệ' };
  }

  /**
   * C-01: Log anomaly
   */
  logAnomaly(userId: string, type: string, details: string): void {
    this.initTable();
    db.prepare('INSERT INTO anomaly_log (user_id, type, details, timestamp) VALUES (?, ?, ?, ?)')
      .run(userId, type, details, Math.floor(Date.now() / 1000));
  }

  /**
   * C-01: Get anomaly log
   */
  getAnomalyLog(userId: string, limit: number = 10): AnomalyEntry[] {
    this.initTable();
    return db.prepare('SELECT * FROM anomaly_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(userId, limit) as AnomalyEntry[];
  }

  /**
   * C-01: Get anti-cheat description
   */
  getAntiCheatDescription(userId: string): string {
    const anomalies = this.getAnomalyLog(userId);

    let msg = `🛡️ **Anti-Cheat Status**\n`;
    if (anomalies.length === 0) {
      msg += `✅ No suspicious activity detected.`;
    } else {
      msg += `⚠️ **${anomalies.length}** suspicious activities logged:\n`;
      for (const a of anomalies.slice(0, 5)) {
        msg += `• ${a.type}: ${a.details}\n`;
      }
    }

    return msg;
  }
}

export const antiCheatService = new AntiCheatService();
