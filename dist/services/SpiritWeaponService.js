"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spiritWeaponService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AWAKEN_COST_LT = 50000;
const AWAKEN_COST_MATERIAL = 'material_tinh_thiet_1';
const AWAKEN_MATERIAL_QTY = 5;
class SpiritWeaponService {
    canAwaken(itemRarity) {
        return ['epic', 'legendary'].includes(itemRarity);
    }
    getSpiritWeapons(userId) {
        return database_1.default.prepare('SELECT * FROM spirit_weapons WHERE user_id = ?').all(userId);
    }
    getSpiritWeapon(userId, itemId) {
        return database_1.default.prepare('SELECT * FROM spirit_weapons WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    }
    getAllSkills() {
        return database_1.default.prepare('SELECT * FROM spirit_skills ORDER BY min_level ASC').all();
    }
    getSkill(skillId) {
        return database_1.default.prepare('SELECT * FROM spirit_skills WHERE id = ?').get(skillId);
    }
    getAvailableSkillForLevel(level) {
        const skills = this.getAllSkills();
        const owned = database_1.default.prepare('SELECT skill_id FROM spirit_weapons WHERE skill_id IS NOT NULL').all();
        const ownedIds = new Set(owned.map(s => s.skill_id));
        const available = skills.filter(s => s.min_level <= level && !ownedIds.has(s.id));
        if (available.length === 0)
            return null;
        // Random skill weighted by level proximity
        const weighted = available.map(s => ({
            skill: s,
            weight: Math.max(1, 5 - Math.abs(level - s.min_level))
        }));
        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const w of weighted) {
            roll -= w.weight;
            if (roll <= 0)
                return w.skill;
        }
        return weighted[weighted.length - 1].skill;
    }
    awaken(userId, inventoryId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const inv = database_1.default.prepare('SELECT * FROM inventories WHERE id = ? AND user_id = ?').get(inventoryId, userId);
        if (!inv)
            return { success: false, message: 'Trang bị không tồn tại trong túi đồ!' };
        const item = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(inv.item_id);
        if (!item)
            return { success: false, message: 'Vật phẩm không tồn tại trong hệ thống.' };
        if (!this.canAwaken(item.rarity)) {
            return { success: false, message: `Chỉ trang bị **Epic** trở lên mới có thể thức tỉnh khí linh! (Hiện tại: **${item.rarity.toUpperCase()}**)` };
        }
        if (user.coin_ha_pham < AWAKEN_COST_LT) {
            return { success: false, message: `Cần **${AWAKEN_COST_LT.toLocaleString()}** Linh Thạch để thức tỉnh!` };
        }
        const existing = database_1.default.prepare('SELECT id FROM spirit_weapons WHERE user_id = ? AND item_id = ?').get(userId, inv.item_id);
        if (existing)
            return { success: false, message: 'Trang bị này đã được thức tỉnh khí linh rồi!' };
        const now = Math.floor(Date.now() / 1000);
        const spiritNames = ['Long Hồn', 'Phượng Linh', 'Hổ Phách', 'Quy Giáp', 'Kỳ Lân', 'Bạch Hổ', 'Chu Tước', 'Huyền Vũ', 'Thanh Long'];
        const spiritName = spiritNames[Math.floor(Math.random() * spiritNames.length)];
        // Tìm skill khả dụng
        const skill = this.getAvailableSkillForLevel(1);
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - AWAKEN_COST_LT });
            InventoryRepository_1.inventoryRepository.removeItem(userId, AWAKEN_COST_MATERIAL, AWAKEN_MATERIAL_QTY);
            database_1.default.prepare(`
        INSERT INTO spirit_weapons (user_id, item_id, spirit_name, level, exp, affinity, skill_id, awakened_at)
        VALUES (?, ?, ?, 1, 0, 10, ?, ?)
      `).run(userId, inv.item_id, spiritName, skill?.id || null, now);
        })();
        const spirit = this.getSpiritWeapon(userId, inv.item_id);
        return {
            success: true,
            message: `✨ **THỨC TỈNH KHÍ LINH THÀNH CÔNG!**\n\n**${spiritName}** đã thức tỉnh từ **${item.name}** [${item.rarity.toUpperCase()}]!\n${skill ? `🔮 Kỹ năng: **${skill.name}** - ${skill.description}` : '*Chưa có kỹ năng*'}`,
            spirit: spirit || undefined,
        };
    }
    feedSpirit(userId, spiritId, inventoryId, qty = 1) {
        const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
        if (!spirit)
            return { success: false, message: 'Khí linh không tồn tại!' };
        const inv = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND id = ?').get(userId, inventoryId);
        if (!inv || inv.quantity < 1)
            return { success: false, message: 'Không có nguyên liệu để nuôi dưỡng!' };
        if (inv.is_equipped === 1)
            return { success: false, message: 'Không thể hiến tế trang bị đang mặc!' };
        if (inv.is_life_bound === 1)
            return { success: false, message: 'Không thể hiến tế trang bị Bản Mệnh!' };
        const item = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(inv.item_id);
        if (!item)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        if (item.type === 'chest' || item.type === 'quest' || item.type === 'token') {
            return { success: false, message: 'Vật phẩm này không thể hiến tế cho Khí Linh!' };
        }
        const actualQty = Math.min(qty, inv.quantity);
        if (actualQty <= 0)
            return { success: false, message: 'Số lượng không hợp lệ!' };
        // Mỗi nguyên liệu cho 10-50 EXP tùy rarity
        const rarityExp = { common: 10, uncommon: 20, rare: 35, epic: 60, legendary: 100 };
        const expGain = rarityExp[item?.rarity] || 10;
        let newLevel = spirit.level;
        let remainingExp = spirit.exp;
        let leveledUp = false;
        let newSkillName = '';
        let consumedCount = 0;
        for (let i = 0; i < actualQty; i++) {
            remainingExp += expGain;
            consumedCount++;
            let expNeeded = newLevel * 50;
            while (remainingExp >= expNeeded) {
                remainingExp -= expNeeded;
                newLevel++;
                leveledUp = true;
                // Check skill unlock at new level
                if (newLevel === 3 || newLevel === 5 || newLevel === 7 || newLevel === 10 || newLevel === 12) {
                    const newSkill = this.getAvailableSkillForLevel(newLevel);
                    if (newSkill) {
                        newSkillName = newSkill.name;
                    }
                }
                expNeeded = newLevel * 50;
            }
        }
        database_1.default.transaction(() => {
            InventoryRepository_1.inventoryRepository.removeItemById(inventoryId, consumedCount);
            database_1.default.prepare('UPDATE spirit_weapons SET exp = ?, level = ? WHERE id = ?')
                .run(remainingExp, newLevel, spiritId);
            if (newSkillName) {
                const newSkill = this.getAvailableSkillForLevel(newLevel);
                if (newSkill) {
                    database_1.default.prepare('UPDATE spirit_weapons SET skill_id = ? WHERE id = ?').run(newSkill.id, spiritId);
                }
            }
        })();
        const nextExpNeeded = newLevel * 50;
        const totalExpGained = consumedCount * expGain;
        return {
            success: true,
            message: `🍽️ **${spirit.spirit_name}** hấp thụ x${consumedCount} nguyên liệu **${item?.name || inv.item_id}**, nhận **+${totalExpGained}** Tu Vi!${leveledUp ? `\n⬆️ **Thăng cấp: Cấp ${newLevel}**` : ''}${newSkillName ? `\n🔮 Kỹ năng mới: **${newSkillName}**` : ''}`,
            spiritName: spirit.spirit_name,
            materialName: item?.name || inv.item_id,
            expGain: totalExpGained,
            oldLevel: spirit.level,
            newLevel,
            leveledUp,
            remainingExp,
            expNeeded: nextExpNeeded,
            newSkillName: newSkillName || undefined
        };
    }
    interact(userId, spiritId) {
        const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
        if (!spirit)
            return { success: false, message: 'Khí linh không tồn tại!' };
        const affinityGain = Math.floor(Math.random() * 5) + 1;
        const newAffinity = Math.min(100, spirit.affinity + affinityGain);
        database_1.default.prepare('UPDATE spirit_weapons SET affinity = ? WHERE id = ?').run(newAffinity, spiritId);
        return {
            success: true,
            message: `💬 Tương tác với **${spirit.spirit_name}**: Độ thân thiết **+${affinityGain}** (${newAffinity}/100)`,
            spiritName: spirit.spirit_name,
            affinityGain,
            newAffinity
        };
    }
    getCombatBonus(userId) {
        const activeWeapon = database_1.default.prepare(`
      SELECT sw.* FROM spirit_weapons sw
      JOIN inventories i ON sw.item_id = i.item_id AND i.user_id = sw.user_id
      WHERE sw.user_id = ? AND i.is_equipped = 1
      LIMIT 1
    `).get(userId);
        if (!activeWeapon || !activeWeapon.skill_id)
            return null;
        return this.getSkill(activeWeapon.skill_id);
    }
    evolve(userId, spiritId) {
        const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
        if (!spirit)
            return { success: false, message: 'Khí linh không tồn tại!' };
        if (spirit.level < 20) {
            return { success: false, message: `Khí linh phải đạt cấp độ **20** mới có thể tiến hóa. Hiện tại cấp **${spirit.level}**.` };
        }
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Người dùng không tồn tại.' };
        const costLt = 100000;
        const costItem = 'material_tinh_thiet_1';
        const costQty = 10;
        if (user.coin_ha_pham < costLt) {
            return { success: false, message: `Tiến hóa cần **${costLt.toLocaleString()}** Hạ Phẩm Linh Thạch.` };
        }
        const inv = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, costItem);
        if (!inv || inv.quantity < costQty) {
            return { success: false, message: `Tiến hóa cần **${costQty}x Tinh Thiết**. Đạo hữu hiện không có đủ.` };
        }
        // Logic đổi tên (vd thêm prefix Thánh, Tổ)
        const prefixes = ['Thánh ', 'Tổ ', 'Hỗn Độn ', 'Thiên '];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const newName = `${prefix}${spirit.spirit_name}`;
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - costLt });
            InventoryRepository_1.inventoryRepository.removeItem(userId, costItem, costQty);
            database_1.default.prepare('UPDATE spirit_weapons SET spirit_name = ?, level = ? WHERE id = ?').run(newName, spirit.level + 1, spiritId);
        })();
        return {
            success: true,
            message: `🐉 **ĐỘT PHÁ THÀNH CÔNG!**\n\nKhí linh **${spirit.spirit_name}** đã tắm mình trong linh quang thiên địa, niết bàn trọng sinh, tiến hóa thành **${newName}**! Giới hạn sức mạnh được giải phóng!`,
            oldName: spirit.spirit_name,
            newName
        };
    }
}
exports.spiritWeaponService = new SpiritWeaponService();
