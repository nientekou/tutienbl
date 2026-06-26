"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiCheatService = void 0;
const database_1 = __importDefault(require("../database/database"));
class AntiCheatService {
    initTable() {
        database_1.default.exec(`
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
    checkRateLimit(userId, action, maxPerMinute = 30) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - 60; // 1 minute window
        const entry = database_1.default.prepare('SELECT * FROM rate_limits WHERE user_id = ? AND action = ?')
            .get(userId, action);
        if (!entry || entry.windowStart < windowStart) {
            // New window
            database_1.default.prepare('INSERT OR REPLACE INTO rate_limits (user_id, action, count, window_start) VALUES (?, ?, 1, ?)')
                .run(userId, action, now);
            return true;
        }
        if (entry.count >= maxPerMinute) {
            this.logAnomaly(userId, 'rate_limit_exceeded', `Action: ${action}, Count: ${entry.count}`);
            return false;
        }
        database_1.default.prepare('UPDATE rate_limits SET count = count + 1 WHERE user_id = ? AND action = ?')
            .run(userId, action);
        return true;
    }
    /**
     * C-01: Validate input
     */
    validateInput(value, type, options) {
        if (type === 'string') {
            if (typeof value !== 'string')
                return { valid: false, message: 'Chuỗi không hợp lệ' };
            if (options?.minLength && value.length < options.minLength)
                return { valid: false, message: `Quá ngắn (tối thiểu ${options.minLength})` };
            if (options?.maxLength && value.length > options.maxLength)
                return { valid: false, message: `Quá dài (tối đa ${options.maxLength})` };
        }
        else if (type === 'number') {
            if (typeof value !== 'number' || isNaN(value))
                return { valid: false, message: 'Số không hợp lệ' };
            if (options?.min !== undefined && value < options.min)
                return { valid: false, message: `Quá nhỏ (tối thiểu ${options.min})` };
            if (options?.max !== undefined && value > options.max)
                return { valid: false, message: `Quá lớn (tối đa ${options.max})` };
        }
        else if (type === 'enum') {
            if (!options?.enumValues?.includes(value))
                return { valid: false, message: 'Giá trị enum không hợp lệ' };
        }
        return { valid: true, message: 'Hợp lệ' };
    }
    /**
     * C-01: Log anomaly
     */
    logAnomaly(userId, type, details) {
        this.initTable();
        database_1.default.prepare('INSERT INTO anomaly_log (user_id, type, details, timestamp) VALUES (?, ?, ?, ?)')
            .run(userId, type, details, Math.floor(Date.now() / 1000));
    }
    /**
     * C-01: Get anomaly log
     */
    getAnomalyLog(userId, limit = 10) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM anomaly_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
            .all(userId, limit);
    }
    /**
     * C-01: Get anti-cheat description
     */
    getAntiCheatDescription(userId) {
        const anomalies = this.getAnomalyLog(userId);
        let msg = `🛡️ **Anti-Cheat Status**\n`;
        if (anomalies.length === 0) {
            msg += `✅ No suspicious activity detected.`;
        }
        else {
            msg += `⚠️ **${anomalies.length}** suspicious activities logged:\n`;
            for (const a of anomalies.slice(0, 5)) {
                msg += `• ${a.type}: ${a.details}\n`;
            }
        }
        return msg;
    }
}
exports.antiCheatService = new AntiCheatService();
