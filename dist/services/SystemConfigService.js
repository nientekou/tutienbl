"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfigService = exports.SystemConfigService = void 0;
const database_1 = __importDefault(require("../database/database"));
class SystemConfigService {
    /**
     * Kiểm tra xem hệ thống có đang ở chế độ bảo trì hay không.
     */
    isMaintenanceMode() {
        try {
            const row = database_1.default.prepare("SELECT value FROM system_config WHERE key = 'maintenance_mode'").get();
            return row ? row.value === '1' : false;
        }
        catch (e) {
            console.error('Lỗi khi kiểm tra chế độ bảo trì:', e);
            return false;
        }
    }
    /**
     * Bật hoặc tắt chế độ bảo trì.
     */
    setMaintenanceMode(enabled) {
        const value = enabled ? '1' : '0';
        database_1.default.prepare(`
      INSERT INTO system_config (key, value)
      VALUES ('maintenance_mode', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(value);
    }
    /**
     * Ghi nhận log giao dịch nhạy cảm để điều tra nếu cần.
     */
    writeAuditLog(userId, action, details) {
        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
                database_1.default.prepare(`
          INSERT INTO audit_logs (user_id, action, details, created_at)
          VALUES (?, ?, ?, ?)
        `).run(userId, action, detailsStr, now);
                return;
            }
            catch (e) {
                if (e?.code === 'SQLITE_BUSY' && attempt < maxRetries) {
                    continue;
                }
                console.error('Lỗi khi ghi log giao dịch:', e);
                return;
            }
        }
    }
}
exports.SystemConfigService = SystemConfigService;
exports.systemConfigService = new SystemConfigService();
