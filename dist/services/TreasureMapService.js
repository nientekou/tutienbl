"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.treasureMapService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
class TreasureMapService {
    /**
     * Sinh ra một tọa độ kho báu ngẫu nhiên khi dùng Tàng Bảo Đồ
     */
    generateMap(userId, rarity = 'rare') {
        const x = Math.floor(Math.random() * 1000) + 1;
        const y = Math.floor(Math.random() * 1000) + 1;
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO user_treasure_maps (user_id, coord_x, coord_y, rarity, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, x, y, rarity, now);
        return { x, y };
    }
    /**
     * Lấy danh sách Tàng Bảo Đồ chưa đào
     */
    getActiveMaps(userId) {
        return database_1.default.prepare(`
      SELECT * FROM user_treasure_maps 
      WHERE user_id = ? AND is_found = 0
    `).all(userId);
    }
    /**
     * Đào kho báu tại tọa độ
     */
    digTreasure(userId, x, y) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        if ((user.stamina || 0) < 10) {
            return { success: false, message: 'Không đủ Thể Lực! Cần ít nhất 10 Thể Lực để tiến hành đào bới.' };
        }
        // Trừ 10 Thể lực mỗi lần cuốc
        UserRepository_1.userRepository.update(userId, { stamina: (user.stamina || 0) - 10 });
        const activeMaps = this.getActiveMaps(userId);
        if (activeMaps.length === 0) {
            return { success: false, message: 'Đạo hữu không có Tàng Bảo Đồ nào, đào bới vô ích (Tốn 10 Thể Lực).' };
        }
        // Khoảng sai số cho phép là ±5 để bớt khó
        const tolerance = 5;
        let foundMap = null;
        for (const map of activeMaps) {
            if (Math.abs(map.coord_x - x) <= tolerance && Math.abs(map.coord_y - y) <= tolerance) {
                foundMap = map;
                break;
            }
        }
        if (!foundMap) {
            // Gợi ý cho map đầu tiên để user dễ tìm
            const targetMap = activeMaps[0];
            const dx = targetMap.coord_x - x;
            const dy = targetMap.coord_y - y;
            let hint = '';
            if (Math.abs(dx) > Math.abs(dy)) {
                hint = dx > 0 ? 'Phía Đông (X lớn hơn)' : 'Phía Tây (X nhỏ hơn)';
            }
            else {
                hint = dy > 0 ? 'Phía Bắc (Y lớn hơn)' : 'Phía Nam (Y nhỏ hơn)';
            }
            return {
                success: false,
                message: `❌ Đào trúng đất đá vô dụng (Tốn 10 Thể Lực).\n*Gợi ý: Cảm nhận được linh khí phát ra từ hướng **${hint}**.*`
            };
        }
        // Tìm thấy
        database_1.default.prepare('UPDATE user_treasure_maps SET is_found = 1 WHERE id = ?').run(foundMap.id);
        // Phát thưởng dựa trên độ hiếm
        const rewards = this.getRewardsByRarity(foundMap.rarity);
        // Áp dụng thưởng
        let rewardText = [];
        if (rewards.coins) {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + rewards.coins });
            rewardText.push(`🟤 **${rewards.coins}** Hạ Phẩm Linh Thạch`);
        }
        if (rewards.items) {
            for (const item of rewards.items) {
                InventoryRepository_1.inventoryRepository.addItem(userId, item.id, item.qty);
                rewardText.push(`🎁 **${item.id}** x${item.qty}`); // In thực tế nên query item name
            }
        }
        return {
            success: true,
            foundMapId: foundMap.id,
            message: `🎉 **TUYỆT VỜI!** Đạo hữu đã đào trúng Kho Báu ẩn tại tọa độ [${foundMap.coord_x}, ${foundMap.coord_y}]!\n\n**Chiến lợi phẩm:**\n${rewardText.join('\n')}`
        };
    }
    getRewardsByRarity(rarity) {
        switch (rarity) {
            case 'epic':
                return { coins: 5000, items: [{ id: 'material_tinh_thiet_1', qty: 5 }, { id: 'phoi_weapon_b', qty: 1 }] };
            case 'rare':
                return { coins: 2000, items: [{ id: 'material_nhan_sam_1', qty: 3 }] };
            case 'legendary':
                return { coins: 15000, items: [{ id: 'phoi_weapon_a', qty: 1 }, { id: 'material_iron_1', qty: 10 }] };
            default: // common
                return { coins: 500, items: [{ id: 'material_linh_thao_1', qty: 2 }] };
        }
    }
}
exports.treasureMapService = new TreasureMapService();
