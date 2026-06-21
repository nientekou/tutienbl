import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { caveService, UserCave } from './CaveService';

export class CaveEnhancementService {
  /**
   * Lấy chi phí nâng cấp cho từng loại công trình
   */
  public getUpgradeCost(type: 'spring' | 'meridian' | 'array', currentLevel: number): { lt: number; shards: number } {
    if (type === 'spring') {
      // Cấp 1 -> 10
      return {
        lt: currentLevel * 5000,
        shards: currentLevel * 5
      };
    } else if (type === 'meridian') {
      // Cấp 0 -> 10
      const nextLevel = currentLevel + 1;
      return {
        lt: nextLevel * 6000,
        shards: nextLevel * 6
      };
    } else {
      // Hộ Pháp Trận: Cấp 0 -> 10
      const nextLevel = currentLevel + 1;
      return {
        lt: nextLevel * 8000,
        shards: nextLevel * 8
      };
    }
  }

  /**
   * Thăng cấp công trình trong Động Phủ
   */
  public upgradeBuilding(userId: string, type: 'spring' | 'meridian' | 'array'): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại!' };

    const cave = caveService.getCave(userId) as any;
    const currentLevel = type === 'spring' ? cave.spring_level : type === 'meridian' ? cave.meridian_level : cave.array_level;

    if (currentLevel >= 10) {
      return { success: false, message: 'Công trình này đã đạt cấp độ tối đa (cấp 10)!' };
    }

    const cost = this.getUpgradeCost(type, currentLevel);

    // Kiểm tra Linh Thạch
    if (user.coin_ha_pham < cost.lt) {
      return { success: false, message: `Thiếu Linh Thạch! Cần **${cost.lt.toLocaleString()}** Linh Thạch nhưng đạo hữu chỉ có **${user.coin_ha_pham.toLocaleString()}**.` };
    }

    // Kiểm tra nguyên liệu (Mảnh Tinh Thạch - tinh_thach_shard)
    const userInv = inventoryRepository.getUserInventory(userId);
    const shardItem = userInv.find(i => i.item_id === 'tinh_thach_shard');
    const hasShards = shardItem ? shardItem.quantity : 0;

    if (cost.shards > 0 && hasShards < cost.shards) {
      return { success: false, message: `Thiếu nguyên liệu! Cần **${cost.shards}** Mảnh Tinh Thạch nhưng đạo hữu chỉ có **${hasShards}**.` };
    }

    // Thực hiện khấu trừ và nâng cấp trong Transaction
    let success = false;
    let nextLvl = currentLevel + 1;
    try {
      db.transaction(() => {
        // Trừ Linh Thạch
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost.lt });
        
        // Trừ nguyên liệu
        if (cost.shards > 0 && shardItem) {
          inventoryRepository.removeItem(userId, shardItem.item_id, cost.shards);
        }

        // Cập nhật cấp công trình
        if (type === 'spring') {
          db.prepare('UPDATE user_caves SET spring_level = ? WHERE user_id = ?').run(nextLvl, userId);
        } else if (type === 'meridian') {
          // Khi mở khóa Linh Mạch lần đầu, đặt last_meridian_claim thành thời gian hiện tại
          const lastClaim = cave.last_meridian_claim || Math.floor(Date.now() / 1000);
          db.prepare('UPDATE user_caves SET meridian_level = ?, last_meridian_claim = ? WHERE user_id = ?')
            .run(nextLvl, lastClaim, userId);
        } else {
          db.prepare('UPDATE user_caves SET array_level = ? WHERE user_id = ?').run(nextLvl, userId);
        }
      })();
      success = true;
    } catch (e: any) {
      return { success: false, message: `Lỗi nâng cấp công trình: ${e.message}` };
    }

    const typeName = type === 'spring' ? 'Linh Tuyền' : type === 'meridian' ? 'Linh Mạch' : 'Hộ Pháp Trận';
    return {
      success: true,
      message: `🎉 Thăng cấp **${typeName}** thành công! Cấp độ hiện tại: **Cấp ${nextLvl}**.`
    };
  }

  /**
   * Tính toán lượng Linh Thạch tích lũy từ Linh Mạch
   */
  public getPendingMeridianResources(userId: string): { hours: number; amount: number } {
    const cave = caveService.getCave(userId) as any;
    const meridianLevel = cave.meridian_level || 0;
    if (meridianLevel <= 0) return { hours: 0, amount: 0 };

    const now = Math.floor(Date.now() / 1000);
    const lastClaim = cave.last_meridian_claim || now;
    const elapsedSeconds = now - lastClaim;
    const elapsedHours = elapsedSeconds / 3600;

    // Giới hạn tối đa 24 giờ tích lũy
    const hoursToClaim = Math.min(24, elapsedHours);
    const ratePerHour = 50 * meridianLevel;
    const amount = Math.floor(hoursToClaim * ratePerHour);

    return {
      hours: parseFloat(elapsedHours.toFixed(2)),
      amount
    };
  }

  /**
   * Thu hoạch tài nguyên từ Linh Mạch
   */
  public claimMeridianResources(userId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại!' };

    const cave = caveService.getCave(userId) as any;
    const meridianLevel = cave.meridian_level || 0;
    if (meridianLevel <= 0) {
      return { success: false, message: 'Đạo hữu chưa khai phá Linh Mạch! Hãy nâng cấp Linh Mạch trước.' };
    }

    const pending = this.getPendingMeridianResources(userId);
    if (pending.amount <= 0) {
      return { success: false, message: 'Linh Mạch chưa ngưng tụ đủ Linh Thạch. Hãy quay lại sau ít nhất 1 phút!' };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      db.transaction(() => {
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + pending.amount });
        db.prepare('UPDATE user_caves SET last_meridian_claim = ? WHERE user_id = ?').run(now, userId);
      })();
    } catch (e: any) {
      return { success: false, message: `Lỗi thu hoạch tài nguyên: ${e.message}` };
    }

    return {
      success: true,
      message: `🪙 Thu hoạch thành công **${pending.amount.toLocaleString()}** Linh Thạch từ Linh Mạch (đã ngưng tụ trong **${pending.hours}** giờ)!`
    };
  }
}

export const caveEnhancementService = new CaveEnhancementService();
