import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository as invRepo } from '../database/repositories/InventoryRepository';
import { ITEMS } from '../config/itemConstants';

export interface EnhanceConfig {
  level: number;       // Cấp độ hiện tại (ví dụ: 0 -> muốn lên 1)
  successRate: number; // Tỷ lệ thành công (0.0 đến 1.0)
  costLinhThach: number;
  costShards: number;
  dropOnFail: boolean;
}

export class EnhanceService {
  // Cấu hình cường hóa từ cấp hiện tại lên cấp tiếp theo (level + 1)
  // Cấu hình cường hóa đã tăng độ khó
  private config: Record<number, EnhanceConfig> = {
    0: { level: 0, successRate: 1.00, costLinhThach: 100, costShards: 1, dropOnFail: false },
    1: { level: 1, successRate: 1.00, costLinhThach: 250, costShards: 1, dropOnFail: false },
    2: { level: 2, successRate: 1.00, costLinhThach: 500, costShards: 2, dropOnFail: false },
    3: { level: 3, successRate: 1.00, costLinhThach: 1000, costShards: 2, dropOnFail: false },
    4: { level: 4, successRate: 1.00, costLinhThach: 2000, costShards: 3, dropOnFail: false },
    5: { level: 5, successRate: 0.30, costLinhThach: 4000, costShards: 4, dropOnFail: false },
    6: { level: 6, successRate: 0.30, costLinhThach: 8000, costShards: 5, dropOnFail: false },
    7: { level: 7, successRate: 0.30, costLinhThach: 16000, costShards: 5, dropOnFail: false },
    8: { level: 8, successRate: 0.30, costLinhThach: 32000, costShards: 6, dropOnFail: false },
    9: { level: 9, successRate: 0.30, costLinhThach: 65000, costShards: 7, dropOnFail: false },
    10: { level: 10, successRate: 0.12, costLinhThach: 150000, costShards: 8, dropOnFail: true },
    11: { level: 11, successRate: 0.12, costLinhThach: 300000, costShards: 9, dropOnFail: true },
    12: { level: 12, successRate: 0.12, costLinhThach: 600000, costShards: 10, dropOnFail: true },
    13: { level: 13, successRate: 0.10, costLinhThach: 1200000, costShards: 12, dropOnFail: true },
    14: { level: 14, successRate: 0.05, costLinhThach: 2500000, costShards: 15, dropOnFail: true }
  };

  /**
   * Lấy cấu hình cho cấp cường hóa tiếp theo của trang bị
   */
  public getEnhanceConfig(currentLevel: number): EnhanceConfig | null {
    return this.config[currentLevel] || null;
  }

  /**
   * Thực hiện cường hóa trang bị
   */
  public enhanceItem(userId: string, inventoryId: number): { success: boolean; message: string; newLevel?: number } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };

    const item = invRepo.get(inventoryId);
    if (!item) return { success: false, message: 'Không tìm thấy trang bị này trong hành trang!' };
    if (item.equipable !== 1 || item.type !== 'equipment') {
      return { success: false, message: 'Vật phẩm này không phải là trang bị có thể cường hóa!' };
    }

    const currentLevel = item.enhance_level || 0;
    if (currentLevel >= 15) {
      return { success: false, message: 'Trang bị này đã đạt cấp cường hóa tối đa (+15)!' };
    }

    const cfg = this.getEnhanceConfig(currentLevel);
    if (!cfg) return { success: false, message: 'Cấu hình cường hóa cho cấp độ này không tồn tại!' };

    // Tìm Mảnh Tinh Thạch trong túi người chơi
    const userInventory = invRepo.getUserInventory(userId);
    const shardItem = userInventory.find(i => i.item_id === ITEMS.TINH_THACH_SHARD);
    const shardQty = shardItem ? shardItem.quantity : 0;

    if (shardQty < cfg.costShards) {
      return { 
        success: false, 
        message: `Đạo hữu không đủ Mảnh Tinh Thạch! (Cần **${cfg.costShards}** cái, hiện có **${shardQty}** cái).` 
      };
    }

    if (user.coin_ha_pham < cfg.costLinhThach) {
      return { 
        success: false, 
        message: `Đạo hữu không đủ Hạ Phẩm Linh Thạch! (Cần **${cfg.costLinhThach}** LT, hiện có **${user.coin_ha_pham}** LT).` 
      };
    }

    let result = { success: false, message: 'Lỗi hệ thống khi cường hóa.', newLevel: currentLevel };

    db.transaction(() => {
      // Khấu trừ Linh thạch của người chơi
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cfg.costLinhThach });

      // Khấu trừ Mảnh Tinh Thạch của người chơi
      if (shardItem) {
        if (shardItem.quantity > cfg.costShards) {
          db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?')
            .run(cfg.costShards, shardItem.id);
        } else {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(shardItem.id);
        }
      }

      // Gieo xúc xắc tỷ lệ
      const roll = Math.random();
      const isSuccess = roll < cfg.successRate;

      if (isSuccess) {
        const nextLevel = currentLevel + 1;
        invRepo.updateEnhanceLevel(inventoryId, nextLevel);
        result = {
          success: true,
          message: `✨ **[CƯỜNG HÓA THÀNH CÔNG]**\\nChúc mừng đạo hữu cường hóa thành công **${item.name}** lên **+${nextLevel}**!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`,
          newLevel: nextLevel
        };
      } else {
        let nextLevel = currentLevel;
        let failMsg = `☠️ **[CƯỜNG HÓA THẤT BẠI]**\\nĐại trận cường hóa thất bại, linh lực phân rã! **${item.name}** giữ nguyên cấp **+${currentLevel}**.\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;

        // Rủi ro vỡ nát hoặc tổn hại độ bền tối đa từ cấp +11 trở lên
        if (currentLevel >= 11 && Math.random() < 0.15) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(inventoryId);
          failMsg = `💥 **[CƯỜNG HÓA THẤT BẠI - TRANG BỊ VỠ NÁT]**\\nLinh lực phản bộc cực mạnh làm chấn vỡ hoàn toàn **${item.name}** thành cát bụi! Mất đi trang bị vĩnh viễn!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
          nextLevel = 0;
        } else {
          if (cfg.dropOnFail) {
            nextLevel = Math.max(10, currentLevel - 1); // Rớt xuống tối thiểu là +10
            invRepo.updateEnhanceLevel(inventoryId, nextLevel);
            
            if (currentLevel >= 11) {
              // Giảm độ bền tối đa vĩnh viễn 10 điểm
              const currentMaxDurability = item.max_durability || 100;
              const newMaxDurability = Math.max(10, currentMaxDurability - 10);
              db.prepare('UPDATE inventories SET max_durability = ?, durability = MIN(durability, ?) WHERE id = ?')
                .run(newMaxDurability, newMaxDurability, inventoryId);
              failMsg = `☠️ **[CƯỜNG HÓA THẤT BẠI - TỔN HẠI TRANG BỊ]**\\nĐại trận cường hóa thất bại tàn nhẫn! **${item.name}** bị rớt cấp xuống **+${nextLevel}** và bị **giảm 10 điểm độ bền tối đa vĩnh viễn** (Độ bền tối đa còn: ${newMaxDurability}/100)!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
            } else {
              failMsg = `☠️ **[CƯỜNG HÓA THẤT BẠI - BỊ RỚT CẤP]**\\nĐại trận cường hóa thất bại tàn khốc! **${item.name}** bị rớt cấp xuống **+${nextLevel}**!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
            }
          }
        }

        result = {
          success: false,
          message: failMsg,
          newLevel: nextLevel
        };
      }
    })();

    return result;
  }
}

export const enhanceService = new EnhanceService();
