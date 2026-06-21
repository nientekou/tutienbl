"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.caveEnhancementService = exports.CaveEnhancementService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const CaveService_1 = require("./CaveService");
class CaveEnhancementService {
    /**
     * Lấy chi phí nâng cấp cho từng loại công trình
     */
    getUpgradeCost(type, currentLevel) {
        if (type === 'spring') {
            // Cấp 1 -> 10
            return {
                lt: currentLevel * 5000,
                shards: currentLevel * 5
            };
        }
        else if (type === 'meridian') {
            // Cấp 0 -> 10
            const nextLevel = currentLevel + 1;
            return {
                lt: nextLevel * 6000,
                shards: nextLevel * 6
            };
        }
        else {
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
    upgradeBuilding(userId, type) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const cave = CaveService_1.caveService.getCave(userId);
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
        const userInv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const shardItem = userInv.find(i => i.item_id === 'tinh_thach_shard');
        const hasShards = shardItem ? shardItem.quantity : 0;
        if (cost.shards > 0 && hasShards < cost.shards) {
            return { success: false, message: `Thiếu nguyên liệu! Cần **${cost.shards}** Mảnh Tinh Thạch nhưng đạo hữu chỉ có **${hasShards}**.` };
        }
        // Thực hiện khấu trừ và nâng cấp trong Transaction
        let success = false;
        let nextLvl = currentLevel + 1;
        try {
            database_1.default.transaction(() => {
                // Trừ Linh Thạch
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost.lt });
                // Trừ nguyên liệu
                if (cost.shards > 0 && shardItem) {
                    InventoryRepository_1.inventoryRepository.removeItem(userId, shardItem.item_id, cost.shards);
                }
                // Cập nhật cấp công trình
                if (type === 'spring') {
                    database_1.default.prepare('UPDATE user_caves SET spring_level = ? WHERE user_id = ?').run(nextLvl, userId);
                }
                else if (type === 'meridian') {
                    // Khi mở khóa Linh Mạch lần đầu, đặt last_meridian_claim thành thời gian hiện tại
                    const lastClaim = cave.last_meridian_claim || Math.floor(Date.now() / 1000);
                    database_1.default.prepare('UPDATE user_caves SET meridian_level = ?, last_meridian_claim = ? WHERE user_id = ?')
                        .run(nextLvl, lastClaim, userId);
                }
                else {
                    database_1.default.prepare('UPDATE user_caves SET array_level = ? WHERE user_id = ?').run(nextLvl, userId);
                }
            })();
            success = true;
        }
        catch (e) {
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
    getPendingMeridianResources(userId) {
        const cave = CaveService_1.caveService.getCave(userId);
        const meridianLevel = cave.meridian_level || 0;
        if (meridianLevel <= 0)
            return { hours: 0, amount: 0 };
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
    claimMeridianResources(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const cave = CaveService_1.caveService.getCave(userId);
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
            database_1.default.transaction(() => {
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + pending.amount });
                database_1.default.prepare('UPDATE user_caves SET last_meridian_claim = ? WHERE user_id = ?').run(now, userId);
            })();
        }
        catch (e) {
            return { success: false, message: `Lỗi thu hoạch tài nguyên: ${e.message}` };
        }
        return {
            success: true,
            message: `🪙 Thu hoạch thành công **${pending.amount.toLocaleString()}** Linh Thạch từ Linh Mạch (đã ngưng tụ trong **${pending.hours}** giờ)!`
        };
    }
}
exports.CaveEnhancementService = CaveEnhancementService;
exports.caveEnhancementService = new CaveEnhancementService();
