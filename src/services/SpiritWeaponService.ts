import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export interface SpiritWeapon {
  id: number;
  user_id: string;
  item_id: string;
  spirit_name: string;
  level: number;
  exp: number;
  affinity: number;
  skill_id: string | null;
  awakened_at: number;
}

export interface SpiritSkill {
  id: string;
  name: string;
  description: string;
  effect_type: 'crit_up' | 'dmg_reduce' | 'hp_regen' | 'atk_up' | 'def_up' | 'dodge_up';
  effect_value: number;
  min_level: number;
}

const AWAKEN_COST_LT = 50000;
const AWAKEN_COST_MATERIAL = 'material_tinh_thiet_1';
const AWAKEN_MATERIAL_QTY = 5;

class SpiritWeaponService {
  public canAwaken(itemRarity: string): boolean {
    return ['epic', 'legendary'].includes(itemRarity);
  }

  public getSpiritWeapons(userId: string): SpiritWeapon[] {
    return db.prepare('SELECT * FROM spirit_weapons WHERE user_id = ?').all(userId) as SpiritWeapon[];
  }

  public getSpiritWeapon(userId: string, itemId: string): SpiritWeapon | null {
    return db.prepare('SELECT * FROM spirit_weapons WHERE user_id = ? AND item_id = ?').get(userId, itemId) as SpiritWeapon | null;
  }

  public getAllSkills(): SpiritSkill[] {
    return db.prepare('SELECT * FROM spirit_skills ORDER BY min_level ASC').all() as SpiritSkill[];
  }

  public getSkill(skillId: string): SpiritSkill | null {
    return db.prepare('SELECT * FROM spirit_skills WHERE id = ?').get(skillId) as SpiritSkill | null;
  }

  public getAvailableSkillForLevel(level: number): SpiritSkill | null {
    const skills = this.getAllSkills();
    const owned = db.prepare(
      'SELECT skill_id FROM spirit_weapons WHERE skill_id IS NOT NULL'
    ).all() as { skill_id: string }[];
    const ownedIds = new Set(owned.map(s => s.skill_id));

    const available = skills.filter(s => s.min_level <= level && !ownedIds.has(s.id));
    if (available.length === 0) return null;

    // Random skill weighted by level proximity
    const weighted = available.map(s => ({
      skill: s,
      weight: Math.max(1, 5 - Math.abs(level - s.min_level))
    }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.skill;
    }
    return weighted[weighted.length - 1].skill;
  }

  public awaken(userId: string, inventoryId: number): { success: boolean; message: string; spirit?: SpiritWeapon } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };

    const inv = db.prepare('SELECT * FROM inventories WHERE id = ? AND user_id = ?').get(inventoryId, userId) as any;
    if (!inv) return { success: false, message: 'Trang bị không tồn tại trong túi đồ!' };

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(inv.item_id) as any;
    if (!item) return { success: false, message: 'Vật phẩm không tồn tại trong hệ thống.' };

    if (!this.canAwaken(item.rarity)) {
      return { success: false, message: `Chỉ trang bị **Epic** trở lên mới có thể thức tỉnh khí linh! (Hiện tại: **${item.rarity.toUpperCase()}**)` };
    }

    if (user.coin_ha_pham < AWAKEN_COST_LT) {
      return { success: false, message: `Cần **${AWAKEN_COST_LT.toLocaleString()}** Linh Thạch để thức tỉnh!` };
    }

    const existing = db.prepare('SELECT id FROM spirit_weapons WHERE user_id = ? AND item_id = ?').get(userId, inv.item_id);
    if (existing) return { success: false, message: 'Trang bị này đã được thức tỉnh khí linh rồi!' };

    const now = Math.floor(Date.now() / 1000);
    const spiritNames = ['Long Hồn', 'Phượng Linh', 'Hổ Phách', 'Quy Giáp', 'Kỳ Lân', 'Bạch Hổ', 'Chu Tước', 'Huyền Vũ', 'Thanh Long'];
    const spiritName = spiritNames[Math.floor(Math.random() * spiritNames.length)];

    // Tìm skill khả dụng
    const skill = this.getAvailableSkillForLevel(1);

    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - AWAKEN_COST_LT });
      inventoryRepository.removeItem(userId, AWAKEN_COST_MATERIAL, AWAKEN_MATERIAL_QTY);

      db.prepare(`
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

  public feedSpirit(
    userId: string,
    spiritId: number,
    materialItemId: string
  ): {
    success: boolean;
    message: string;
    spiritName?: string;
    materialName?: string;
    expGain?: number;
    oldLevel?: number;
    newLevel?: number;
    leveledUp?: boolean;
    remainingExp?: number;
    expNeeded?: number;
    newSkillName?: string;
  } {
    const spirit = db.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId) as SpiritWeapon | null;
    if (!spirit) return { success: false, message: 'Khí linh không tồn tại!' };

    const inv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, materialItemId) as any;
    if (!inv || inv.quantity < 1) return { success: false, message: 'Không có nguyên liệu để nuôi dưỡng!' };

    // Mỗi nguyên liệu cho 10-50 EXP tùy rarity
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(materialItemId) as any;
    const rarityExp: Record<string, number> = { common: 10, uncommon: 20, rare: 35, epic: 60, legendary: 100 };
    const expGain = rarityExp[item?.rarity] || 10;

    const newExp = spirit.exp + expGain;
    const expNeeded = spirit.level * 50;
    let newLevel = spirit.level;
    let remainingExp = newExp;
    let leveledUp = false;
    let newSkillName = '';

    while (remainingExp >= expNeeded) {
      remainingExp -= expNeeded;
      newLevel++;
      leveledUp = true;
      // Check skill unlock at new level
      if (newLevel === 3 || newLevel === 5 || newLevel === 7 || newLevel === 10 || newLevel === 12) {
        const newSkill = this.getAvailableSkillForLevel(newLevel);
        if (newSkill) {
          db.prepare('UPDATE spirit_weapons SET skill_id = ? WHERE id = ?').run(newSkill.id, spiritId);
          newSkillName = newSkill.name;
        }
      }
    }

    db.transaction(() => {
      inventoryRepository.removeItem(userId, materialItemId, 1);
      db.prepare('UPDATE spirit_weapons SET exp = ?, level = ? WHERE id = ?')
        .run(remainingExp, newLevel, spiritId);
    })();

    const nextExpNeeded = newLevel * 50;

    return {
      success: true,
      message: `🍽️ **${spirit.spirit_name}** hấp thụ nguyên liệu **${item?.name || materialItemId}**, nhận **+${expGain}** EXP!${leveledUp ? `\n⬆️ **Thăng cấp: Cấp ${newLevel}**` : ''}${newSkillName ? `\n🔮 Kỹ năng mới: **${newSkillName}**` : ''}`,
      spiritName: spirit.spirit_name,
      materialName: item?.name || materialItemId,
      expGain,
      oldLevel: spirit.level,
      newLevel,
      leveledUp,
      remainingExp,
      expNeeded: nextExpNeeded,
      newSkillName: newSkillName || undefined
    };
  }

  public interact(userId: string, spiritId: number): { 
    success: boolean; 
    message: string; 
    spiritName?: string;
    affinityGain?: number;
    newAffinity?: number;
  } {
    const spirit = db.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId) as SpiritWeapon | null;
    if (!spirit) return { success: false, message: 'Khí linh không tồn tại!' };

    const affinityGain = Math.floor(Math.random() * 5) + 1;
    const newAffinity = Math.min(100, spirit.affinity + affinityGain);

    db.prepare('UPDATE spirit_weapons SET affinity = ? WHERE id = ?').run(newAffinity, spiritId);

    return {
      success: true,
      message: `💬 Tương tác với **${spirit.spirit_name}**: Độ thân thiết **+${affinityGain}** (${newAffinity}/100)`,
      spiritName: spirit.spirit_name,
      affinityGain,
      newAffinity
    };
  }

  public getCombatBonus(userId: string): SpiritSkill | null {
    const activeWeapon = db.prepare(`
      SELECT sw.* FROM spirit_weapons sw
      JOIN inventories i ON sw.item_id = i.item_id AND i.user_id = sw.user_id
      WHERE sw.user_id = ? AND i.is_equipped = 1
      LIMIT 1
    `).get(userId) as SpiritWeapon | null;

    if (!activeWeapon || !activeWeapon.skill_id) return null;
    return this.getSkill(activeWeapon.skill_id);
  }

  public evolve(userId: string, spiritId: number): { 
    success: boolean; 
    message: string; 
    oldName?: string;
    newName?: string;
  } {
    const spirit = db.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId) as SpiritWeapon | null;
    if (!spirit) return { success: false, message: 'Khí linh không tồn tại!' };

    if (spirit.level < 20) {
      return { success: false, message: `Khí linh phải đạt cấp độ **20** mới có thể tiến hóa. Hiện tại cấp **${spirit.level}**.` };
    }

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại.' };

    const costLt = 100000;
    const costItem = 'material_tinh_thiet_1';
    const costQty = 10;

    if (user.coin_ha_pham < costLt) {
      return { success: false, message: `Tiến hóa cần **${costLt.toLocaleString()}** Hạ Phẩm Linh Thạch.` };
    }

    const inv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, costItem) as any;
    if (!inv || inv.quantity < costQty) {
      return { success: false, message: `Tiến hóa cần **${costQty}x Tinh Thiết**. Đạo hữu hiện không có đủ.` };
    }

    // Logic đổi tên (vd thêm prefix Thánh, Tổ)
    const prefixes = ['Thánh ', 'Tổ ', 'Hỗn Độn ', 'Thiên '];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const newName = `${prefix}${spirit.spirit_name}`;

    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - costLt });
      inventoryRepository.removeItem(userId, costItem, costQty);
      db.prepare('UPDATE spirit_weapons SET spirit_name = ?, level = ? WHERE id = ?').run(newName, spirit.level + 1, spiritId);
    })();

    return {
      success: true,
      message: `🐉 **ĐỘT PHÁ THÀNH CÔNG!**\n\nKhí linh **${spirit.spirit_name}** đã tắm mình trong linh quang thiên địa, niết bàn trọng sinh, tiến hóa thành **${newName}**! Giới hạn sức mạnh được giải phóng!`,
      oldName: spirit.spirit_name,
      newName
    };
  }
}

export const spiritWeaponService = new SpiritWeaponService();
