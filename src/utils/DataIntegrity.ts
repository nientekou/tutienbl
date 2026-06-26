import db from '../database/database';

// C-03: Data Integrity

interface AuditEntry {
  id: number;
  userId: string;
  action: string;
  table: string;
  recordId: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

class DataIntegrity {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  /**
   * C-03: Log audit trail
   */
  logAudit(userId: string, action: string, table: string, recordId: string, oldValue?: any, newValue?: any): void {
    this.initTable();
    db.prepare('INSERT INTO audit_trail (user_id, action, table_name, record_id, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, action, table, recordId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        Math.floor(Date.now() / 1000));
  }

  /**
   * C-03: Get audit trail
   */
  getAuditTrail(userId: string, limit: number = 50): AuditEntry[] {
    this.initTable();
    return db.prepare('SELECT * FROM audit_trail WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(userId, limit) as AuditEntry[];
  }

  /**
   * C-03: Validate data before saving
   */
  validateData(data: Record<string, any>, rules: Record<string, { type: string; required?: boolean; minLength?: number; maxLength?: number }>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
      }

      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        errors.push(`${field} too short (min ${rule.minLength})`);
      }

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(`${field} too long (max ${rule.maxLength})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * C-03: Backup database
   */
  backupDatabase(): { success: boolean; message: string } {
    try {
      const backupPath = `./data/backup_${Date.now()}.db`;
      db.backup(backupPath);
      return { success: true, message: `Backup created: ${backupPath}` };
    } catch (error) {
      return { success: false, message: `Backup failed: ${(error as Error).message}` };
    }
  }

  /**
   * C-03: Get data integrity description
   */
  getDataIntegrityDescription(): string {
    let msg = `🔒 **Data Integrity**\n`;
    msg += `📊 Audit Trail: Active\n`;
    msg += `💾 Backup System: Available\n`;
    msg += `✅ Data Validation: Enabled\n`;
    return msg;
  }
}

export const dataIntegrity = new DataIntegrity();
