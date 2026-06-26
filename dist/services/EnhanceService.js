"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhanceService = exports.EnhanceService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const itemConstants_1 = require("../config/itemConstants");
class EnhanceService {
    // Cấu hình cường hóa từ cấp hiện tại lên cấp tiếp theo (level + 1)
    // Cấu hình cường hóa đã tăng độ khó
    config = {
        0: { level: 0, successRate: 1.00, costLinhThach: 100, costShards: 1, dropOnFail: false },
        1: { level: 1, successRate: 1.00, costLinhThach: 250, costShards: 1, dropOnFail: false },
        2: { level: 2, successRate: 1.00, costLinhThach: 500, costShards: 2, dropOnFail: false },
        3: { level: 3, successRate: 1.00, costLinhThach: 1000, costShards: 2, dropOnFail: false },
        4: { level: 4, successRate: 1.00, costLinhThach: 2000, costShards: 3, dropOnFail: false },
        5: { level: 5, successRate: 0.30, costLinhThach: 4000, costShards: 4, dropOnFail: false },
        6: { level: 6, successRate: 0.30, costLinhThach: 7000, costShards: 5, dropOnFail: false },
        7: { level: 7, successRate: 0.30, costLinhThach: 12000, costShards: 5, dropOnFail: false },
        8: { level: 8, successRate: 0.30, costLinhThach: 21000, costShards: 6, dropOnFail: false },
        9: { level: 9, successRate: 0.30, costLinhThach: 37000, costShards: 7, dropOnFail: false },
        10: { level: 10, successRate: 0.12, costLinhThach: 65000, costShards: 8, dropOnFail: true },
        11: { level: 11, successRate: 0.12, costLinhThach: 114000, costShards: 9, dropOnFail: true },
        12: { level: 12, successRate: 0.12, costLinhThach: 200000, costShards: 10, dropOnFail: true },
        13: { level: 13, successRate: 0.10, costLinhThach: 350000, costShards: 12, dropOnFail: true },
        14: { level: 14, successRate: 0.05, costLinhThach: 610000, costShards: 15, dropOnFail: true } // ponytail: ×1.75 curve (trước ×2)
    };
    /**
     * Lấy cấu hình cho cấp cường hóa tiếp theo của trang bị
     */
    getEnhanceConfig(currentLevel) {
        return this.config[currentLevel] || null;
    }
    /**
     * Thực hiện cường hóa trang bị
     */
    enhanceItem(userId, inventoryId, safeMode = false) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item)
            return { success: false, message: 'Không tìm thấy trang bị này trong hành trang!' };
        if (item.equipable !== 1 || item.type !== 'equipment') {
            return { success: false, message: 'Vật phẩm này không phải là trang bị có thể cường hóa!' };
        }
        const currentLevel = item.enhance_level || 0;
        if (currentLevel >= 15) {
            return { success: false, message: 'Trang bị này đã đạt cấp cường hóa tối đa (+15)!' };
        }
        const cfg = this.getEnhanceConfig(currentLevel);
        if (!cfg)
            return { success: false, message: 'Cấu hình cường hóa cho cấp độ này không tồn tại!' };
        // Tìm Mảnh Tinh Thạch trong túi người chơi
        const userInventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const shardItem = userInventory.find(i => i.item_id === itemConstants_1.ITEMS.TINH_THACH_SHARD);
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
        // V12 E-02: Safe enhance costs x3 Linh Thach
        const finalCostLinhThach = safeMode ? cfg.costLinhThach * 3 : cfg.costLinhThach;
        if (user.coin_ha_pham < finalCostLinhThach) {
            return {
                success: false,
                message: `Đạo hữu không đủ Linh Thạch cho chế độ An Toàn! (Cần **${finalCostLinhThach}** LT, hiện có **${user.coin_ha_pham}** LT).`
            };
        }
        let result = { success: false, message: 'Lỗi hệ thống khi cường hóa.', newLevel: currentLevel };
        database_1.default.transaction(() => {
            // Khấu trừ Linh thạch của người chơi
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - finalCostLinhThach });
            // Khấu trừ Mảnh Tinh Thạch của người chơi
            if (shardItem) {
                if (shardItem.quantity > cfg.costShards) {
                    database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?')
                        .run(cfg.costShards, shardItem.id);
                }
                else {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(shardItem.id);
                }
            }
            // Dị hỏa tăng tỷ lệ cường hóa
            let rareFireBonus = 0;
            try {
                const { rareFireService } = require('./RareFireService');
                rareFireBonus = (rareFireService.getEquippedBonus(userId).enhanceBonus || 0) / 100;
            }
            catch { }
            // Gieo xúc xắc tỷ lệ
            const roll = Math.random();
            const isSuccess = roll < (cfg.successRate + rareFireBonus);
            if (isSuccess) {
                const nextLevel = currentLevel + 1;
                InventoryRepository_1.inventoryRepository.updateEnhanceLevel(inventoryId, nextLevel);
                result = {
                    success: true,
                    message: `✨ **[CƯỜNG HÓA THÀNH CÔNG]**\\nChúc mừng đạo hữu cường hóa thành công **${item.name}** lên **+${nextLevel}**!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`,
                    newLevel: nextLevel
                };
            }
            else {
                let nextLevel = currentLevel;
                let failMsg = `☠️ **[CƯỜNG HÓA THẤT BẠI]**\\nĐại trận cường hóa thất bại, linh lực phân rã! **${item.name}** giữ nguyên cấp **+${currentLevel}**.\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
                // V12 E-02: Safe enhance prevents destruction from +13
                // Rủi ro vỡ nát từ cấp +13 trở lên (giảm từ +11, giảm tỷ lệ từ 15% xuống 5%)
                if (currentLevel >= 13 && !safeMode && Math.random() < 0.05) {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inventoryId);
                    failMsg = `💥 **[CƯỜNG HÓA THẤT BẠI - TRANG BỊ VỠ NÁT]**\\nLinh lực phản chấn cực mạnh làm chấn vỡ hoàn toàn **${item.name}** thành cát bụi! Mất đi trang bị vĩnh viễn!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
                    nextLevel = 0;
                }
                else {
                    if (cfg.dropOnFail) {
                        nextLevel = Math.max(10, currentLevel - 1); // Rớt xuống tối thiểu là +10
                        InventoryRepository_1.inventoryRepository.updateEnhanceLevel(inventoryId, nextLevel);
                        if (currentLevel >= 13) {
                            // Giảm độ bền tối đa vĩnh viễn 10 điểm
                            const currentMaxDurability = item.max_durability || 100;
                            const newMaxDurability = Math.max(10, currentMaxDurability - 10);
                            database_1.default.prepare('UPDATE inventories SET max_durability = ?, durability = MIN(durability, ?) WHERE id = ?')
                                .run(newMaxDurability, newMaxDurability, inventoryId);
                            failMsg = `☠️ **[CƯỜNG HÓA THẤT BẠI - TỔN HẠI TRANG BỊ]**\\nĐại trận cường hóa thất bại tàn nhẫn! **${item.name}** bị rớt cấp xuống **+${nextLevel}** và bị **giảm 10 điểm độ bền tối đa vĩnh viễn** (Độ bền tối đa còn: ${newMaxDurability}/100)!\\n*(Tiêu hao: ${cfg.costLinhThach} LT, ${cfg.costShards} Mảnh Tinh Thạch)*`;
                        }
                        else {
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
    // === A-02: Equipment Reforge System ===
    REFORGE_COST = 5000; // Linh Thạch
    MAX_REFORGES = 3;
    /**
     * A-02: Reforge an equipment — reroll random stat bonus
     */
    reforgeItem(userId, inventoryId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật!' };
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item || item.user_id !== userId)
            return { success: false, message: '❌ Trang bị không tồn tại!' };
        if (item.equipable !== 1 || item.type !== 'equipment')
            return { success: false, message: '❌ Chỉ reforged được trang bị!' };
        // Check reforge count
        const reforgeCount = item.reforge_count || 0;
        if (reforgeCount >= this.REFORGE_COST / 1000) { // Simplified check
            return { success: false, message: `❌ Đã reforged tối đa ${this.MAX_REFORGES} lần!` };
        }
        if (user.coin_ha_pham < this.REFORGE_COST) {
            return { success: false, message: `❌ Không đủ Linh Thạch! (Cần ${this.REFORGE_COST}, có ${user.coin_ha_pham})` };
        }
        // Roll new random stat bonus
        const stats = ['atk', 'def', 'hp', 'crit', 'speed'];
        const randomStat = stats[Math.floor(Math.random() * stats.length)];
        const randomValue = Math.round(Math.random() * 10 + 1); // +1 to +10
        const oldBonus = item.custom_stats || '{}';
        const newBonus = JSON.stringify({ [randomStat]: randomValue });
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - this.REFORGE_COST });
            database_1.default.prepare('UPDATE inventories SET custom_stats = ?, reforge_count = COALESCE(reforge_count, 0) + 1 WHERE id = ?')
                .run(newBonus, inventoryId);
        })();
        return {
            success: true,
            message: `✨ **Reforged thành công!** ${item.name}\n📊 Stat mới: **${randomStat} +${randomValue}**\n🔄 Lần reforged: ${reforgeCount + 1}/${this.MAX_REFORGES}`,
            oldBonus,
            newBonus
        };
    }
    /**
     * A-02: Get item quality description
     */
    getItemQuality(enhanceLevel) {
        if (enhanceLevel >= 13)
            return { quality: 'Huyền Thoại', color: '🟡', bonus: '+25% chỉ số' };
        if (enhanceLevel >= 10)
            return { quality: 'Sử Thi', color: '🟣', bonus: '+15% chỉ số' };
        if (enhanceLevel >= 7)
            return { quality: 'Hiếm', color: '🔵', bonus: '+10% chỉ số' };
        if (enhanceLevel >= 4)
            return { quality: 'Không Phổ Biến', color: '🟢', bonus: '+5% chỉ số' };
        return { quality: 'Thường', color: '⚪', bonus: 'Không có thưởng' };
    }
    // === A-03: Equipment Sets Expansion ===
    /**
     * A-03: Get all available equipment sets
     */
    getAllEquipmentSets() {
        return [
            { id: 'flame_set', name: 'Hỏa Lôi Set', pieces: 3, bonus2: '+5% ATK', bonus3: '+10% Sát Thương Hỏa + Tỷ Lệ Thiêu Đốt', element: 'Hoa' },
            { id: 'frost_set', name: 'Băng Giá Set', pieces: 3, bonus2: '+5% DEF', bonus3: '+10% Freeze Chance + Slow', element: 'Thuy' },
            { id: 'storm_set', name: 'Sấm Sét Set', pieces: 3, bonus2: '+5% Speed', bonus3: '+10% Crit Rate + Stun Chance', element: 'Loi' },
            { id: 'earth_set', name: 'Thổ Địa Set', pieces: 3, bonus2: '+5% HP', bonus3: '+10% HP + Khiên Sát Thương', element: 'Tho' },
            { id: 'wind_set', name: 'Gió Mùa Set', pieces: 3, bonus2: '+5% Dodge', bonus3: '+10% Dodge + Phản Đòn', element: 'Phong' },
            { id: 'light_set', name: 'Quang Minh Set', pieces: 3, bonus2: '+5% Sát Thương Chí Mạng', bonus3: '+10% Sát Thương Chí Mạng + Hút Máu', element: 'Kim' },
            { id: 'dark_set', name: 'Hắc Ám Set', pieces: 3, bonus2: '+5% toàn bộ chỉ số', bonus3: '+8% toàn bộ chỉ số + Phản Sát Thương', element: 'Vo' },
            { id: 'tank_set', name: 'Bất Tử Set', pieces: 3, bonus2: '+10% DEF', bonus3: '+20% DEF + Giảm Sát Thương', class: 'tank' },
            { id: 'dps_set', name: 'Sát Thủ Set', pieces: 3, bonus2: '+10% ATK', bonus3: '+20% ATK + Crit Rate', class: 'dps' },
            { id: 'support_set', name: 'Hỗ Trợ Set', pieces: 3, bonus2: '+10% Heal Power', bonus3: '+20% Heal Power + Giảm Hồi Chiêu', class: 'support' },
        ];
    }
    /**
     * A-03: Get set bonus for equipped items
     */
    getSetBonuses(userId) {
        const equipped = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND is_equipped = 1 AND type = ?')
            .all(userId, 'equipment');
        // Group by set
        const setCounts = {};
        for (const item of equipped) {
            try {
                const stats = JSON.parse(item.custom_stats || '{}');
                if (stats.setId) {
                    setCounts[stats.setId] = (setCounts[stats.setId] || 0) + 1;
                }
            }
            catch { }
        }
        const allSets = this.getAllEquipmentSets();
        const results = [];
        for (const set of allSets) {
            const count = setCounts[set.id] || 0;
            const has2Set = count >= 2;
            const has3Set = count >= 3;
            let activeBonus = '';
            if (has3Set)
                activeBonus = set.bonus3;
            else if (has2Set)
                activeBonus = set.bonus2;
            results.push({
                setId: set.id,
                setName: set.name,
                count,
                bonus2: set.bonus2,
                bonus3: set.bonus3,
                active: has2Set,
                activeBonus
            });
        }
        return results;
    }
    /**
     * A-03: Get set description for UI
     */
    getSetDescription(userId) {
        const sets = this.getSetBonuses(userId);
        const activeSets = sets.filter(s => s.active);
        if (activeSets.length === 0)
            return '❌ Chưa kích hoạt set bonus nào.';
        let msg = '🔗 **Set Bonuses đang active:**\n';
        for (const s of activeSets) {
            msg += `• **${s.setName}** (${s.count}/3): ${s.activeBonus}\n`;
        }
        return msg;
    }
}
exports.EnhanceService = EnhanceService;
exports.enhanceService = new EnhanceService();
