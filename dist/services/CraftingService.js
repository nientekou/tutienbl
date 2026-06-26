"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.craftingService = exports.CraftingService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AchievementService_1 = require("./AchievementService");
const recipes_1 = require("../config/recipes");
class CraftingService {
    /**
     * Bắt đầu chế tạo vật phẩm (tiêu hao nguyên liệu & phí Linh Thạch)
     */
    startCrafting(userId, recipeId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        }
        const recipe = recipes_1.RECIPES[recipeId];
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
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        for (const ing of recipe.ingredients) {
            const entry = inv.find(i => i.item_id === ing.itemId);
            if (!entry || entry.quantity < ing.quantity) {
                const itemDetails = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId);
                const itemName = itemDetails ? itemDetails.name : ing.itemId;
                return { success: false, message: `Hành trang của đạo hữu thiếu nguyên liệu: **${itemName}** (Có: ${entry ? entry.quantity : 0}/${ing.quantity})` };
            }
        }
        // Trực tiếp khấu trừ nguyên liệu
        for (const ing of recipe.ingredients) {
            InventoryRepository_1.inventoryRepository.removeItem(userId, ing.itemId, ing.quantity);
        }
        // Khấu trừ Linh thạch
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - recipe.cost });
        const now = Math.floor(Date.now() / 1000);
        const endTime = now + recipe.duration;
        // Ghi nhận vào hàng chờ DB
        database_1.default.prepare(`
      INSERT INTO crafting_queues (user_id, recipe_id, type, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, 'crafting')
    `).run(userId, recipeId, recipe.type, now, endTime);
        return {
            success: true,
            message: `🧪 Lò luyện đan/Lửa rèn khí phát khởi! Rèn chế **${recipe.name}** thành công. Dự kiến hoàn thành sau **${recipe.duration} giây**.`
        };
    }
    /**
     * Lấy danh sách hàng chờ chế tạo hiện tại của người chơi
     */
    getQueue(userId) {
        const list = database_1.default.prepare('SELECT * FROM crafting_queues WHERE user_id = ? ORDER BY end_time ASC')
            .all(userId);
        const now = Math.floor(Date.now() / 1000);
        return list.map(item => {
            const recipe = recipes_1.RECIPES[item.recipe_id];
            const productDetails = recipe ? database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(recipe.product.itemId) : null;
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
    claimCraftedItems(userId) {
        const now = Math.floor(Date.now() / 1000);
        const queue = database_1.default.prepare('SELECT * FROM crafting_queues WHERE user_id = ? AND end_time <= ?').all(userId, now);
        if (queue.length === 0) {
            return { success: false, message: 'Lò luyện chưa có đan dược hoặc trang bị nào chín/hoàn thành!', claimed: [] };
        }
        const claimed = [];
        const transaction = database_1.default.transaction(() => {
            for (const item of queue) {
                const recipe = recipes_1.RECIPES[item.recipe_id];
                if (!recipe)
                    continue;
                // Thêm vào hòm đồ
                InventoryRepository_1.inventoryRepository.addItem(userId, recipe.product.itemId, recipe.product.quantity);
                const details = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(recipe.product.itemId);
                const name = details ? details.name : 'Vật phẩm';
                const existing = claimed.find(c => c.name === name);
                if (existing) {
                    existing.quantity += recipe.product.quantity;
                }
                else {
                    claimed.push({ name, quantity: recipe.product.quantity });
                }
                // Xóa khỏi hàng chờ chế tạo
                database_1.default.prepare('DELETE FROM crafting_queues WHERE id = ?').run(item.id);
            }
            // Kiểm tra thành tựu chế tạo (đếm từ audit_logs)
            const totalCraft = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'craft_complete'").get(userId);
            const now2 = Math.floor(Date.now() / 1000);
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'craft_complete', ?, ?)").run(userId, JSON.stringify({ count: queue.length }), now2);
            const newCraftCount = totalCraft.c + queue.length;
            AchievementService_1.achievementService.setProgress(userId, 'sh_8', newCraftCount);
            AchievementService_1.achievementService.setProgress(userId, 'sh_9', newCraftCount);
            AchievementService_1.achievementService.setProgress(userId, 'sh_10', newCraftCount);
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
exports.CraftingService = CraftingService;
exports.craftingService = new CraftingService();
