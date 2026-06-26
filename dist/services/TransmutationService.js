"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transmutationService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const PrestigeService_1 = require("./PrestigeService");
// B3: Transmutation System (Prestige 7+ unlock)
// Combine 3 items of same grade → 1 item of next grade
const GRADE_ORDER = ['c', 'b', 'a', 's', 'ss', 'sss', 'ex'];
const TRANSMUTE_COST = {
    'c': 500,
    'b': 2000,
    'a': 8000,
    's': 25000,
    'ss': 80000,
    'sss': 200000,
};
class TransmutationService {
    transmute(userId, itemIds) {
        // Check prestige unlock
        if (!PrestigeService_1.prestigeService.hasPrestigeUnlock(userId, 'transmutation')) {
            return { success: false, message: '❌ Cần đạt Luân Hồi 7 để mở tính năng Dung Hợp Vật Phẩm!' };
        }
        if (itemIds.length !== 3) {
            return { success: false, message: '❌ Cần đúng 3 vật phẩm để dung hợp!' };
        }
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật!' };
        // Get all 3 items
        const items = [];
        for (const id of itemIds) {
            const inv = database_1.default.prepare('SELECT * FROM inventories WHERE id = ? AND user_id = ?').get(id, userId);
            if (!inv)
                return { success: false, message: `❌ Vật phẩm #${id} không tồn tại trong hành trang!` };
            if (inv.equipped)
                return { success: false, message: `❌ Vật phẩm #${id} đang được trang bị!` };
            const item = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(inv.item_id);
            if (!item)
                return { success: false, message: `❌ Không tìm thấy thông tin vật phẩm #${id}!` };
            items.push({ inv, item });
        }
        // Check same grade
        const grades = items.map(i => (i.item.grade || 'c').toLowerCase());
        if (new Set(grades).size !== 1) {
            return { success: false, message: '❌ Tất cả 3 vật phẩm phải cùng phẩm chất!' };
        }
        // Check same type (weapon/armor/accessory)
        const types = items.map(i => i.item.type || 'unknown');
        if (new Set(types).size !== 1) {
            return { success: false, message: '❌ Tất cả 3 vật phẩm phải cùng loại (vũ khí/giáp/phụ kiện)!' };
        }
        const currentGrade = grades[0];
        const gradeIndex = GRADE_ORDER.indexOf(currentGrade);
        if (gradeIndex < 0 || gradeIndex >= GRADE_ORDER.length - 1) {
            return { success: false, message: `❌ Không thể dung hợp phẩm ${currentGrade.toUpperCase()} cao hơn!` };
        }
        const nextGrade = GRADE_ORDER[gradeIndex + 1];
        const cost = TRANSMUTE_COST[currentGrade] || 500;
        if (user.coin_ha_pham < cost) {
            return { success: false, message: `❌ Không đủ Linh Thạch! Cần ${cost.toLocaleString()} (hiện có ${user.coin_ha_pham.toLocaleString()})` };
        }
        // Generate result item name
        const itemType = items[0].item.type || 'item';
        const resultName = `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Phẩm ${nextGrade.toUpperCase()}`;
        // Deduct cost, remove 3 items, add 1 result
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });
            for (const inv of items) {
                if (inv.inv.quantity > 1) {
                    database_1.default.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(inv.inv.id);
                }
                else {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inv.inv.id);
                }
            }
            // Add result item
            const existingResult = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, `transmuted_${nextGrade}_${itemType}`);
            if (existingResult) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity + 1 WHERE id = ?').run(existingResult.id);
            }
            else {
                database_1.default.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, 1, 0)')
                    .run(userId, `transmuted_${nextGrade}_${itemType}`);
            }
        })();
        return {
            success: true,
            message: `✨ **DUNG HỢP THÀNH CÔNG!**\n` +
                `🔗 3x ${items[0].item.name || 'Vật phẩm'} [${currentGrade.toUpperCase()}]\n` +
                `🌟 Kết quả: **${resultName}** [${nextGrade.toUpperCase()}]\n` +
                `🪙 -${cost.toLocaleString()} Linh Thạch`,
            resultItem: { name: resultName, grade: nextGrade }
        };
    }
    getTransmuteCost(grade) {
        return TRANSMUTE_COST[grade.toLowerCase()] || 500;
    }
    getNextGrade(grade) {
        const idx = GRADE_ORDER.indexOf(grade.toLowerCase());
        if (idx < 0 || idx >= GRADE_ORDER.length - 1)
            return null;
        return GRADE_ORDER[idx + 1];
    }
    // === V16 D-03: Material Transmutation ===
    MATERIAL_TIERS = [
        { id: 'herb_1', name: 'Thảo Dược Thường', tier: 1 },
        { id: 'herb_rare', name: 'Thảo Dược Quý', tier: 2 },
        { id: 'herb_legendary', name: 'Thảo Dược Huyền Thoại', tier: 3 },
        { id: 'material_common', name: 'Nguyên Liệu Thường', tier: 1 },
        { id: 'material_rare', name: 'Nguyên Liệu Quý', tier: 2 },
        { id: 'material_legendary', name: 'Nguyên Liệu Huyền Thoại', tier: 3 },
    ];
    TRANSMUTE_RATIOS = {
        1: { inputQty: 10, outputTier: 2, cost: 100 },
        2: { inputQty: 5, outputTier: 3, cost: 500 },
    };
    transmuteMaterial(userId, materialId) {
        const material = this.MATERIAL_TIERS.find(m => m.id === materialId);
        if (!material)
            return { success: false, message: '❌ Nguyên liệu không tồn tại.' };
        const ratio = this.TRANSMUTE_RATIOS[material.tier];
        if (!ratio)
            return { success: false, message: '❌ Không thể chuyển hóa nguyên liệu cấp này.' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật.' };
        if (user.coin_ha_pham < ratio.cost)
            return { success: false, message: `❌ Không đủ ${ratio.cost} LT.` };
        // Check material quantity
        const invItem = database_1.default.prepare('SELECT id, quantity FROM inventories WHERE user_id = ? AND item_id = ?')
            .get(userId, materialId);
        if (!invItem || invItem.quantity < ratio.inputQty) {
            return { success: false, message: `❌ Cần ${ratio.inputQty} ${material.name} (hiện có: ${invItem?.quantity || 0}).` };
        }
        // Find output material
        const outputMaterial = this.MATERIAL_TIERS.find(m => m.tier === ratio.outputTier && m.id.startsWith(material.id.split('_')[0]));
        if (!outputMaterial)
            return { success: false, message: '❌ Không tìm thấy nguyên liệu đích.' };
        // Transmute
        database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(ratio.inputQty, invItem.id);
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - ratio.cost });
        // Add output
        const existing = database_1.default.prepare('SELECT id, quantity FROM inventories WHERE user_id = ? AND item_id = ?')
            .get(userId, outputMaterial.id);
        if (existing) {
            database_1.default.prepare('UPDATE inventories SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
        }
        else {
            database_1.default.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, 1, 0)')
                .run(userId, outputMaterial.id);
        }
        return { success: true, message: `✅ Chuyển hóa ${ratio.inputQty}x ${material.name} → 1x ${outputMaterial.name} (${ratio.cost} LT)` };
    }
    getTransmuteInfo() {
        let msg = '🔄 **Chuyển Hóa Nguyên Liệu**\n\n';
        msg += '10x Thảo Dược Thường → 1x Thảo Dược Quý (100 LT)\n';
        msg += '5x Thảo Dược Quý → 1x Thảo Dược Huyền Thoại (500 LT)\n';
        msg += '10x Nguyên Liệu Thường → 1x Nguyên Liệu Quý (100 LT)\n';
        msg += '5x Nguyên Liệu Quý → 1x Nguyên Liệu Huyền Thoại (500 LT)\n';
        msg += '\nDùng `/chuyenhoa <material_id>` để chuyển hóa.';
        return msg;
    }
}
exports.transmutationService = new TransmutationService();
