import db from '../database/database';
import { CronManager } from '../utils/CronManager';

export class DataCleanupService {
  /**
   * Khởi động scheduler dọn dẹp dữ liệu tự động
   */
  public startScheduler(): void {
    // Chạy dọn dẹp mỗi 12 tiếng (43200000 ms)
    CronManager.registerTask('auto_cleanup', 43200000, () => {
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
  public cleanupOldData(): { marketHistory: number; duelHistory: number; marketListings: number; dungeons: number } | null {
    try {
      console.log(`[DataCleanupService] 🧹 Đang bắt đầu dọn dẹp dữ liệu cũ...`);
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - 30 * 24 * 3600;
      const sevenDaysAgo = now - 7 * 24 * 3600;

      const tx = db.transaction(() => {
        // 1. Dọn dẹp lịch sử đấu giá (chợ trời) cũ hơn 30 ngày
        const marketHistoryRes = db.prepare('DELETE FROM market_transaction_history WHERE created_at < ?').run(thirtyDaysAgo);
        
        // 2. Dọn dẹp lịch sử quyết đấu cũ hơn 30 ngày
        const duelHistoryRes = db.prepare('DELETE FROM duel_history WHERE fought_at < ?').run(thirtyDaysAgo);
        
        // 3. Dọn dẹp tin đăng Vạn Bảo Lâu đã kết thúc/hủy cũ hơn 7 ngày
        const marketListingsRes = db.prepare("DELETE FROM market_listings WHERE status IN ('cancelled', 'sold', 'expired') AND listed_at < ?").run(sevenDaysAgo);
        
        // 4. Dọn dẹp cooldown bí cảnh cũ hơn 7 ngày
        const dungeonRes = db.prepare('DELETE FROM dungeon_cooldowns WHERE last_entry_at < ?').run(sevenDaysAgo);

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
    } catch (error) {
      console.error(`[DataCleanupService] ❌ Lỗi khi dọn dẹp dữ liệu:`, error);
      return null;
    }
  }
}

export const dataCleanupService = new DataCleanupService();
