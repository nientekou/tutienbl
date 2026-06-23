"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.soulImprintService = exports.SoulImprintService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const SoulImprintRepository_1 = require("../database/repositories/SoulImprintRepository");
const itemConstants_1 = require("../config/itemConstants");
class SoulImprintService {
    /**
     * Xác định nhóm bộ (set group) dựa trên ID vật phẩm
     */
    getSetGroup(itemId) {
        if (itemId.startsWith('weapon_sword'))
            return 'weapon';
        if (itemId.startsWith('armor_robe'))
            return 'armor';
        if (itemId.startsWith('ring') || itemId.startsWith('necklace') || itemId.startsWith('amulet'))
            return 'accessory';
        return 'other';
    }
    /**
     * Xác định vị trí trong bộ (set slot) dựa trên phẩm chất/grade của vật phẩm
     */
    getSetSlot(itemId) {
        const parts = itemId.split('_');
        const grade = parts[parts.length - 1];
        const mapping = {
            'f': 1, 'd': 2, 'c': 3, 'b': 4, 'a': 5, 's': 6, 'ss': 7, 'sss': 8, 'ex': 9
        };
        return mapping[grade] || 1;
    }
    /**
     * Tính toán chỉ số cộng thêm vĩnh viễn từ toàn bộ Ấn Ký của người chơi
     */
    getImprintStats(userId) {
        const imprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(userId);
        const totalStats = {};
        for (const imp of imprints) {
            try {
                const stats = JSON.parse(imp.imprint_stats);
                for (const [key, val] of Object.entries(stats)) {
                    totalStats[key] = (totalStats[key] || 0) + val;
                }
            }
            catch (e) {
                // Bỏ qua lỗi cú pháp JSON
            }
        }
        return totalStats;
    }
    /**
     * Tính toán chỉ số cộng thêm từ các bộ sưu tập Ấn Ký
     * - 3 món độc nhất trong bộ: +15 ATK
     * - 4 món độc nhất trong bộ: +30 ATK + 2% Crit Rate
     * - 6 món độc nhất trong bộ: +50 ATK + 5% Crit Rate + skill "Oai" (5% choáng)
     */
    getSetBonuses(userId) {
        const imprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(userId);
        // Gom nhóm Ấn Ký theo set_group và lọc unique item_id để tránh spam cùng 1 món
        const groups = {};
        for (const imp of imprints) {
            if (!groups[imp.set_group]) {
                groups[imp.set_group] = new Set();
            }
            groups[imp.set_group].add(imp.item_id);
        }
        let totalAtk = 0;
        let totalCrit = 0;
        let hasOai = false;
        for (const [groupName, itemSet] of Object.entries(groups)) {
            const count = itemSet.size;
            if (count >= 6) {
                totalAtk += 50;
                totalCrit += 0.05;
                hasOai = true;
            }
            else if (count >= 4) {
                totalAtk += 30;
                totalCrit += 0.02;
            }
            else if (count >= 3) {
                totalAtk += 15;
            }
        }
        return { atk: totalAtk, crit: totalCrit, hasOai };
    }
    /**
     * Kiểm tra người chơi có kích hoạt kỹ năng "Oai" hay không
     */
    hasOaiActive(userId) {
        return this.getSetBonuses(userId).hasOai;
    }
    /**
     * Tiến hành Ấn Ký Linh Hồn một trang bị
     */
    imprintItem(userId, inventoryId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
        if (user.level < 50) {
            return { success: false, message: 'Đạo hữu cần đạt tối thiểu cấp **50** (Cảnh giới Nguyên Anh) để sử dụng Ấn Ký Linh Hồn!' };
        }
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item || item.user_id !== userId) {
            return { success: false, message: 'Trang bị không tồn tại trong túi đồ.' };
        }
        if (item.equipable !== 1) {
            return { success: false, message: 'Vật phẩm này không phải là trang bị!' };
        }
        if (item.is_equipped === 1) {
            return { success: false, message: 'Trang bị đang đeo trên người. Hãy tháo ra trước khi ấn ký!' };
        }
        if (item.stars !== 5) {
            return { success: false, message: 'Chỉ trang bị đã đạt tối đa **5 Sao** (max level) mới có thể tiến hành Ấn Ký Linh Hồn!' };
        }
        // Kiểm tra số lượng Ấn Ký hiện tại
        const currentImprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(userId);
        if (currentImprints.length >= 50) {
            return { success: false, message: 'Đạo hữu đã đạt giới hạn tối đa **50** Ấn Ký Linh Hồn!' };
        }
        // Kiểm tra xem đã có ấn ký cho trang bị này chưa (tránh trùng lắp UNIQUE item_id)
        const existingImprint = SoulImprintRepository_1.soulImprintRepository.getImprintByItemId(userId, item.item_id);
        if (existingImprint) {
            return { success: false, message: `Đạo hữu đã có sẵn Ấn Ký của trang bị **${item.name}** rồi, không thể ấn ký thêm món trùng lặp!` };
        }
        // Chi phí: 5,000 LT + 10 Mảnh Trang Bị (item_fragment)
        if (user.coin_ha_pham < 5000) {
            return { success: false, message: 'Không đủ Linh Thạch để ấn ký! (Yêu cầu: **5,000** Linh Thạch).' };
        }
        const userInventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const fragments = userInventory.find(i => i.item_id === itemConstants_1.ITEMS.ITEM_FRAGMENT);
        if (!fragments || fragments.quantity < 10) {
            return { success: false, message: `Không đủ Mảnh Trang Bị để ấn ký! (Yêu cầu: **10** Mảnh, đạo hữu hiện có: **${fragments ? fragments.quantity : 0}**).` };
        }
        // Tính toán chỉ số lưu giữ: Base stats * 2.0 (vì trang bị 5 sao tăng 100% chỉ số gốc) + Custom stats
        const baseStats = JSON.parse(item.base_stats || '{}');
        const customStats = item.custom_stats ? JSON.parse(item.custom_stats) : {};
        const imprintStats = {};
        const allKeys = new Set([...Object.keys(baseStats), ...Object.keys(customStats)]);
        for (const key of allKeys) {
            const baseVal = (baseStats[key] || 0) * 2.0;
            const customVal = customStats[key] || 0;
            imprintStats[key] = Math.round(baseVal + customVal);
        }
        const setGroup = this.getSetGroup(item.item_id);
        const setSlot = this.getSetSlot(item.item_id);
        let result = { success: false, message: 'Lỗi ấn ký.' };
        database_1.default.transaction(() => {
            // Trừ Linh Thạch
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 5000 });
            // Trừ Mảnh Trang Bị
            InventoryRepository_1.inventoryRepository.removeItem(userId, itemConstants_1.ITEMS.ITEM_FRAGMENT, 10);
            // Tiêu hủy trang bị
            InventoryRepository_1.inventoryRepository.removeItemById(inventoryId, 1);
            // Thêm vào soul_imprints
            SoulImprintRepository_1.soulImprintRepository.create(userId, item.item_id, item.name, item.equipment_slot || 'other', item.rarity, JSON.stringify(imprintStats), setGroup, setSlot);
            result = {
                success: true,
                message: `✨ **Ấn Ký Linh Hồn Thành Công!** Đạo hữu đã tiêu hủy **${item.name}** để đúc thành **Ấn Ký Linh Hồn**, giữ lại toàn bộ chỉ số gia tăng vĩnh viễn!`
            };
        })();
        return result;
    }
    /**
     * Giao dịch (Tặng) Ấn Ký cho đạo hữu khác (chỉ 1 lần duy nhất, sau đó bound)
     */
    tradeImprint(fromUserId, toUserId, imprintId) {
        const fromUser = UserRepository_1.userRepository.get(fromUserId);
        const toUser = UserRepository_1.userRepository.get(toUserId);
        if (!fromUser || !toUser) {
            return { success: false, message: 'Đạo hữu hoặc đối phương chưa khởi tạo nhân vật!' };
        }
        const imprint = SoulImprintRepository_1.soulImprintRepository.getImprint(imprintId);
        if (!imprint || imprint.user_id !== fromUserId) {
            return { success: false, message: 'Ấn ký này không thuộc sở hữu của đạo hữu.' };
        }
        if (imprint.is_bound === 1) {
            return { success: false, message: 'Ấn ký này đã từng được giao dịch trước đó và hiện tại đã bị liên kết (Bound), không thể giao dịch tiếp!' };
        }
        // Kiểm tra giới hạn của người nhận
        const receiverImprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(toUserId);
        if (receiverImprints.length >= 50) {
            return { success: false, message: 'Đối phương đã đạt giới hạn tối đa **50** Ấn Ký Linh Hồn!' };
        }
        // Kiểm tra xem người nhận đã có ấn ký của trang bị này chưa
        const existingImprint = SoulImprintRepository_1.soulImprintRepository.getImprintByItemId(toUserId, imprint.item_id);
        if (existingImprint) {
            return { success: false, message: `Đối phương đã có sẵn Ấn Ký của trang bị **${imprint.item_name}** rồi, không thể nhận thêm!` };
        }
        SoulImprintRepository_1.soulImprintRepository.updateOwner(imprintId, toUserId);
        return {
            success: true,
            message: `🤝 **Giao dịch thành công!** Đạo hữu đã truyền thụ Ấn Ký **${imprint.item_name}** cho **${toUser.name}**! Ấn ký này hiện tại đã bị liên kết vĩnh viễn với đạo hữu đó.`
        };
    }
}
exports.SoulImprintService = SoulImprintService;
exports.soulImprintService = new SoulImprintService();
