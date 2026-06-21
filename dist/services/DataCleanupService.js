"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataCleanupService = exports.DataCleanupService = void 0;
const database_1 = __importDefault(require("../database/database"));
const CronManager_1 = require("../utils/CronManager");
class DataCleanupService {
    /**
     * Khởi động scheduler dọn dẹp dữ liệu tự động
     */
    startScheduler() {
        // Chạy dọn dẹp mỗi 12 tiếng (43200000 ms)
        CronManager_1.CronManager.registerTask('auto_cleanup', 43200000, () => {
            this.cleanupOldData();
        });
        // Chạy dọn dẹp một lần lúc khởi động (delay 1 phút để tránh làm nặng lúc khởi động)
        setTimeout(() => {
            this.cleanupOldData();
        }, 60000);
    }
    /**
     * Dọn dẹp các dữ liệu cũ không cần thiết để giảm tải DB
     */
    cleanupOldData() {
        try {
            console.log(`[DataCleanupService] 🧹 Đang bắt đầu dọn dẹp dữ liệu cũ...`);
            const now = Math.floor(Date.now() / 1000);
            const thirtyDaysAgo = now - 30 * 24 * 3600;
            const sevenDaysAgo = now - 7 * 24 * 3600;
            const tx = database_1.default.transaction(() => {
                // 1. Dọn dẹp lịch sử đấu giá (chợ trời) cũ hơn 30 ngày
                const marketHistoryRes = database_1.default.prepare('DELETE FROM market_transaction_history WHERE created_at < ?').run(thirtyDaysAgo);
                // 2. Dọn dẹp lịch sử quyết đấu cũ hơn 30 ngày
                const duelHistoryRes = database_1.default.prepare('DELETE FROM duel_history WHERE fought_at < ?').run(thirtyDaysAgo);
                // 3. Dọn dẹp tin đăng Vạn Bảo Lâu đã kết thúc/hủy cũ hơn 7 ngày
                const marketListingsRes = database_1.default.prepare("DELETE FROM market_listings WHERE status IN ('cancelled', 'sold', 'expired') AND listed_at < ?").run(sevenDaysAgo);
                // 4. Dọn dẹp cooldown bí cảnh cũ hơn 7 ngày
                const dungeonRes = database_1.default.prepare('DELETE FROM dungeon_cooldowns WHERE last_entry_at < ?').run(sevenDaysAgo);
                return {
                    marketHistory: marketHistoryRes.changes,
                    duelHistory: duelHistoryRes.changes,
                    marketListings: marketListingsRes.changes,
                    dungeons: dungeonRes.changes
                };
            });
            const stats = tx();
            console.log(`[DataCleanupService] ✅ Dọn dẹp hoàn tất:`);
            console.log(` - ${stats.marketHistory} lịch sử giao dịch chợ`);
            console.log(` - ${stats.duelHistory} lịch sử quyết đấu`);
            console.log(` - ${stats.marketListings} tin đăng Vạn Bảo Lâu`);
            console.log(` - ${stats.dungeons} bản ghi cooldown bí cảnh`);
            return stats;
        }
        catch (error) {
            console.error(`[DataCleanupService] ❌ Lỗi khi dọn dẹp dữ liệu:`, error);
            return null;
        }
    }
}
exports.DataCleanupService = DataCleanupService;
exports.dataCleanupService = new DataCleanupService();
