import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { achievementService } from './AchievementService';
import { RECIPES, RecipeConfig } from '../config/recipes';

export interface CraftingQueueItem {
  id: number;
  recipeId: string;
  recipeName: string;
  startTime: number;
  endTime: number;
  status: 'crafting' | 'completed';
  timeRemaining: number; // in seconds
  productName?: string;
}

export class CraftingService {
  /**
   * Bắt đầu chế tạo vật phẩm (tiêu hao nguyên liệu & phí Linh Thạch)
   */
  public startCrafting(userId: string, recipeId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
    }

    const recipe = RECIPES[recipeId];
    if (!recipe) {
      return { success: false, message: 'Đơn thuốc/Bản vẽ thiết kế này không tồn tại.' };
    }

    if (user.level < recipe.minLevel) {
      return { success: false, message: `Độ hiểu biết của đạo hữu chưa đủ! Bản vẽ yêu cầu tu sĩ tối thiểu đạt cấp **${recipe.minLevel}**.` };
    }

    if (user.coin_ha_pham < recipe.cost) {
      return { success: false, message: `Đạo hữu không đủ Linh Thạch để chi trả phí đốt lò! (Yêu cầu **${recipe.cost}** Linh Thạch, có **${user.coin_ha_pham}**)` };
    }

    // Kiểm tra túi nguyên liệu
    const inv = inventoryRepository.getUserInventory(userId);
    for (const ing of recipe.ingredients) {
      const entry = inv.find(i => i.item_id === ing.itemId);
      if (!entry || entry.quantity < ing.quantity) {
        const itemDetails = db.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId) as any;
        const itemName = itemDetails ? itemDetails.name : ing.itemId;
        return { success: false, message: `Hành trang của đạo hữu thiếu nguyên liệu: **${itemName}** (Có: ${entry ? entry.quantity : 0}/${ing.quantity})` };
      }
    }

    // Trực tiếp khấu trừ nguyên liệu
    for (const ing of recipe.ingredients) {
      inventoryRepository.removeItem(userId, ing.itemId, ing.quantity);
    }

    // Khấu trừ Linh thạch
    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - recipe.cost });

    const now = Math.floor(Date.now() / 1000);
    const endTime = now + recipe.duration;

    // Ghi nhận vào hàng chờ DB
    db.prepare(`
      INSERT INTO crafting_queues (user_id, recipe_id, type, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, 'crafting')
    `).run(userId, recipeId, recipe.type, now, endTime);

    return { 
      success: true, 
      message: `🧪 Lò luyện đan/Lửa rèn khí khí phát khởi! Rèn chế **${recipe.name}** thành công. Dự kiến hoàn thành sau **${recipe.duration} giây**.` 
    };
  }

  /**
   * Lấy danh sách hàng chờ chế tạo hiện tại của người chơi
   */
  public getQueue(userId: string): CraftingQueueItem[] {
    const list = db.prepare('SELECT * FROM crafting_queues WHERE user_id = ? ORDER BY end_time ASC')
      .all(userId) as any[];

    const now = Math.floor(Date.now() / 1000);

    return list.map(item => {
      const recipe = RECIPES[item.recipe_id];
      const productDetails = recipe ? db.prepare('SELECT name FROM items WHERE id = ?').get(recipe.product.itemId) as any : null;
      const productName = productDetails ? productDetails.name : 'Vật phẩm';

      return {
        id: item.id,
        recipeId: item.recipe_id,
        recipeName: recipe ? recipe.name : 'Chưa rõ',
        startTime: item.start_time,
        endTime: item.end_time,
        status: item.end_time <= now ? 'completed' : 'crafting',
        timeRemaining: Math.max(0, item.end_time - now),
        productName
      };
    });
  }

  /**
   * Nhận tất cả vật phẩm đã chế tạo hoàn tất
   */
  public claimCraftedItems(userId: string): { success: boolean; message: string; claimed: Array<{ name: string; quantity: number }> } {
    const now = Math.floor(Date.now() / 1000);
    const queue = db.prepare('SELECT * FROM crafting_queues WHERE user_id = ? AND end_time <= ?').all(userId, now) as any[];

    if (queue.length === 0) {
      return { success: false, message: 'Lò luyện chưa có đan dược hoặc trang bị nào chín/hoàn thành!', claimed: [] };
    }

    const claimed: Array<{ name: string; quantity: number }> = [];

    const transaction = db.transaction(() => {
      for (const item of queue) {
        const recipe = RECIPES[item.recipe_id];
        if (!recipe) continue;

        // Thêm vào hòm đồ
        inventoryRepository.addItem(userId, recipe.product.itemId, recipe.product.quantity);

        const details = db.prepare('SELECT name FROM items WHERE id = ?').get(recipe.product.itemId) as any;
        const name = details ? details.name : 'Vật phẩm';

        const existing = claimed.find(c => c.name === name);
        if (existing) {
          existing.quantity += recipe.product.quantity;
        } else {
          claimed.push({ name, quantity: recipe.product.quantity });
        }

        // Xóa khỏi hàng chờ chế tạo
        db.prepare('DELETE FROM crafting_queues WHERE id = ?').run(item.id);
      }

      // Kiểm tra thành tựu chế tạo (đếm từ audit_logs)
      const totalCraft = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'craft_complete'"
      ).get(userId) as { c: number };
      const now2 = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'craft_complete', ?, ?)"
      ).run(userId, JSON.stringify({ count: queue.length }), now2);
      const newCraftCount = totalCraft.c + queue.length;
      achievementService.setProgress(userId, 'sh_8', newCraftCount);
      achievementService.setProgress(userId, 'sh_9', newCraftCount);
      achievementService.setProgress(userId, 'sh_10', newCraftCount);
    });

    transaction();

    const claimedText = claimed.map(c => `🎁 **${c.name}** x${c.quantity}`).join(', ');
    return {
      success: true,
      message: `🎉 Đạo hữu thu lò thành công, nhận được: ${claimedText}!`,
      claimed
    };
  }
}

export const craftingService = new CraftingService();
