"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.soulWeaponService = void 0;
const SoulWeaponRepository_1 = require("../database/repositories/SoulWeaponRepository");
const database_1 = __importDefault(require("../database/database"));
class SoulWeaponService {
    MAX_LEVEL = 100;
    // Cần bao nhiêu exp để thăng cấp? (Cấp * 50)
    getExpRequired(level) {
        return level * 50;
    }
    // Nuốt trang bị rác để tăng EXP
    feedItems(userId, inventoryIds) {
        const sw = SoulWeaponRepository_1.soulWeaponRepository.getByUserId(userId);
        if (!sw)
            return { success: false, message: 'Đạo hữu chưa có Pháp Bảo Bản Mệnh!', expGained: 0, levelUp: 0 };
        if (sw.level >= this.MAX_LEVEL)
            return { success: false, message: 'Pháp Bảo đã đạt cấp tối đa!', expGained: 0, levelUp: 0 };
        if (inventoryIds.length === 0)
            return { success: false, message: 'Vui lòng chọn ít nhất 1 vật phẩm để tế luyện!', expGained: 0, levelUp: 0 };
        let totalExpGained = 0;
        let itemsDestroyed = 0;
        const tx = database_1.default.transaction(() => {
            for (const invId of inventoryIds) {
                // Chỉ lấy trang bị (equipable = 1) hoặc nguyên liệu
                const item = database_1.default.prepare(`
          SELECT i.id, i.quantity, i.is_equipped, t.rarity, t.type
          FROM inventories i
          JOIN items t ON i.item_id = t.id
          WHERE i.id = ? AND i.user_id = ?
        `).get(invId, userId);
                if (!item || item.is_equipped === 1)
                    continue;
                // Tính EXP dựa trên độ hiếm
                let expPerItem = 1;
                if (item.rarity === 'uncommon')
                    expPerItem = 2;
                if (item.rarity === 'rare')
                    expPerItem = 5;
                if (item.rarity === 'epic')
                    expPerItem = 20;
                if (item.rarity === 'legendary')
                    expPerItem = 100;
                totalExpGained += (expPerItem * item.quantity);
                itemsDestroyed += item.quantity;
                database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
            }
        });
        tx();
        if (itemsDestroyed === 0) {
            return { success: false, message: 'Không có vật phẩm nào hợp lệ để tế luyện (hoặc đang được trang bị).', expGained: 0, levelUp: 0 };
        }
        let currentExp = sw.exp + totalExpGained;
        let currentLevel = sw.level;
        let levelUps = 0;
        while (currentLevel < this.MAX_LEVEL) {
            const required = this.getExpRequired(currentLevel);
            if (currentExp >= required) {
                currentExp -= required;
                currentLevel++;
                levelUps++;
            }
            else {
                break;
            }
        }
        // Nếu đạt max cấp, reset exp
        if (currentLevel >= this.MAX_LEVEL) {
            currentLevel = this.MAX_LEVEL;
            currentExp = 0;
        }
        SoulWeaponRepository_1.soulWeaponRepository.updateLevelExp(sw.id, currentLevel, currentExp);
        let msg = `✨ Đã hiến tế **${itemsDestroyed}** vật phẩm. Pháp bảo **${sw.name}** nhận được **${totalExpGained} EXP**!`;
        if (levelUps > 0)
            msg += `\n🎉 **Bạo phát!** Pháp bảo đột phá **${levelUps}** cấp, đạt **Lv${currentLevel}**!`;
        return { success: true, message: msg, expGained: totalExpGained, levelUp: levelUps };
    }
}
exports.soulWeaponService = new SoulWeaponService();
