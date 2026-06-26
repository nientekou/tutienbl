"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataIntegrity = void 0;
const database_1 = __importDefault(require("../database/database"));
class DataIntegrity {
    initTable() {
        database_1.default.exec(`
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
    logAudit(userId, action, table, recordId, oldValue, newValue) {
        this.initTable();
        database_1.default.prepare('INSERT INTO audit_trail (user_id, action, table_name, record_id, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(userId, action, table, recordId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, Math.floor(Date.now() / 1000));
    }
    /**
     * C-03: Get audit trail
     */
    getAuditTrail(userId, limit = 50) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM audit_trail WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
            .all(userId, limit);
    }
    /**
     * C-03: Validate data before saving
     */
    validateData(data, rules) {
        const errors = [];
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
    backupDatabase() {
        try {
            const backupPath = `./data/backup_${Date.now()}.db`;
            database_1.default.backup(backupPath);
            return { success: true, message: `Backup created: ${backupPath}` };
        }
        catch (error) {
            return { success: false, message: `Backup failed: ${error.message}` };
        }
    }
    /**
     * C-03: Get data integrity description
     */
    getDataIntegrityDescription() {
        let msg = `🔒 **Data Integrity**\n`;
        msg += `📊 Audit Trail: Active\n`;
        msg += `💾 Backup System: Available\n`;
        msg += `✅ Data Validation: Enabled\n`;
        return msg;
    }
}
exports.dataIntegrity = new DataIntegrity();
