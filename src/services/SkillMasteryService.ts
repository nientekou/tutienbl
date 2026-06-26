import db from '../database/database';

// A-03: Skill Mastery System

interface SkillMastery {
  user_id: string;
  skill_id: string;
  mastery_level: number;
  mastery_exp: number;
  chosen_path: 'offense' | 'defense' | null;
  awakened_branch: string | null;
}

const MASTERY_EXP_PER_LEVEL = 100;
const MAX_MASTERY_LEVEL = 10;

const SKILL_PATHS: Record<string, {
  offense: { name: string; description: string; bonus: string };
  defense: { name: string; description: string; bonus: string };
}> = {
  skill_fire: {
    offense: { name: 'Liệt Hỏa', description: '+15% burn damage', bonus: 'burn_damage' },
    defense: { name: 'Hỏa Hộ', description: '+10% fire resistance', bonus: 'fire_resist' },
  },
  skill_water: {
    offense: { name: 'Thủy Lãng', description: '+15% heal amount', bonus: 'heal_amount' },
    defense: { name: 'Thủy Giáp', description: '+10% water resistance', bonus: 'water_resist' },
  },
  skill_wood: {
    offense: { name: 'Mộc Tấn', description: '+15% lifesteal', bonus: 'lifesteal' },
    defense: { name: 'Mộc Giáp', description: '+10% wood resistance', bonus: 'wood_resist' },
  },
  skill_earth: {
    offense: { name: 'Thổ Đao', description: '+15% shield absorb', bonus: 'shield_absorb' },
    defense: { name: 'Thổ Giáp', description: '+10% earth resistance', bonus: 'earth_resist' },
  },
  skill_wind: {
    offense: { name: 'Phong Đao', description: '+15% dodge chance', bonus: 'dodge_chance' },
    defense: { name: 'Phong Hộ', description: '+10% wind resistance', bonus: 'wind_resist' },
  },
  skill_lightning: {
    offense: { name: 'Lôi Đao', description: '+15% stun chance', bonus: 'stun_chance' },
    defense: { name: 'Lôi Giáp', description: '+10% lightning resistance', bonus: 'lightning_resist' },
  },
};

// Skill Combos: Combine 2 skills → unlock combo skill
const SKILL_COMBOS: Record<string, { skill1: string; skill2: string; name: string; description: string; damage: number }> = {
  steam_explosion: { skill1: 'skill_fire', skill2: 'skill_water', name: 'Băng Hỏa Song Hành', description: 'Sát thương AoE + làm chậm', damage: 1.5 },
  sandstorm: { skill1: 'skill_earth', skill2: 'skill_wind', name: 'Bão Cát', description: 'Mù + sát thương', damage: 1.3 },
  thorn_storm: { skill1: 'skill_wood', skill2: 'skill_lightning', name: 'Sấm Sét Mộc', description: 'Sấm xích + gốc rễ', damage: 1.4 },
  frost_shield: { skill1: 'skill_water', skill2: 'skill_earth', name: 'Băng Thổ Hộ', description: 'Khiên + đóng băng', damage: 0.8 },
  fire_storm: { skill1: 'skill_fire', skill2: 'skill_wind', name: 'Hỏa Phong', description: 'Thiêu đốt lan + tốc độ', damage: 1.2 },
  lightning_shield: { skill1: 'skill_lightning', skill2: 'skill_earth', name: 'Lôi Thổ Giáp', description: 'Khiên + phản đòn', damage: 1.0 },
};

// A-01: Skill Mastery Awakening — 2 branches per skill at mastery 10
const SKILL_AWAKENING_BRANCHES: Record<string, {
  branch_a: { name: string; description: string; effect: string };
  branch_b: { name: string; description: string; effect: string };
}> = {
  skill_fire: {
    branch_a: { name: 'Liệt Hỏa Bùng Nổ', description: '+30% damage, burn 2 lượt', effect: 'fire_burst' },
    branch_b: { name: 'Hỏa Dung Lôi Động', description: 'AOE 50% damage cho tất cả kẻ địch', effect: 'fire_aoe' },
  },
  skill_water: {
    branch_a: { name: 'Băng Phong Vạn Vật', description: 'Freeze enemy 1 lượt', effect: 'water_freeze' },
    branch_b: { name: 'Thủy Linh Thẩm Thấu', description: 'Ignore 30% DEF', effect: 'water_penetrate' },
  },
  skill_wood: {
    branch_a: { name: 'Mộc Hấp Huyết Sâu', description: 'Hút 35% sát thương (thay vì 20%)', effect: 'wood_lifesteal_plus' },
    branch_b: { name: 'Thiên Địa Hồi Xuân', description: 'Heal bản thân 25% max HP', effect: 'wood_heal_burst' },
  },
  skill_earth: {
    branch_a: { name: 'Đại Địa Hộ Thể', description: 'Shield 25% max HP + reflect 15%', effect: 'earth_shield_plus' },
    branch_b: { name: 'Thổ Nộ Chấn Thiên', description: 'Stun enemy 2 lượt + 100% ATK damage', effect: 'earth_stun_burst' },
  },
  skill_wind: {
    branch_a: { name: 'Vô Tung Vô Tích', description: 'Guaranteed dodge + buff dodge 30% 2 lượt', effect: 'wind_dodge_plus' },
    branch_b: { name: 'Phong Hành Vạn Lý', description: '+40% speed 3 lượt, attack trước mọi enemy', effect: 'wind_speed_plus' },
  },
  skill_lightning: {
    branch_a: { name: 'Lôi Phạt Thiên Kinh', description: '+50% damage, stun 1 lượt', effect: 'lightning_burst' },
    branch_b: { name: 'Lôi Đình Liên Hoàn', description: '3 đòn liên tiếp, mỗi đòn 80% ATK', effect: 'lightning_chain' },
  },
};

// A-04: Skill Variants — each skill has 2-3 variants
const SKILL_VARIANTS: Record<string, { id: string; name: string; description: string; type: 'damage' | 'utility' | 'defense' }[]> = {
  skill_fire: [
    { id: 'fire_burn', name: 'Liệt Hỏa Thiêu Đốt', description: 'Gây burn 3 turns', type: 'damage' },
    { id: 'fire_explosion', name: 'Liệt Hỏa Bùng Nổ', description: 'AOE damage', type: 'damage' },
    { id: 'fire_shield', name: 'Liệt Hỏa Hộ', description: 'Tạo lửa bảo hộ', type: 'defense' },
  ],
  skill_water: [
    { id: 'water_heal', name: 'Thủy Linh Hồi Phục', description: 'Hồi 20% HP', type: 'utility' },
    { id: 'water_cleanse', name: 'Thủy Linh Thanh Tẩy', description: 'Xóa debuff', type: 'utility' },
    { id: 'water_shield', name: 'Thủy Giáp', description: 'Tạo shield 15% HP', type: 'defense' },
  ],
  skill_wood: [
    { id: 'wood_lifesteal', name: 'Mộc Hấp Huyết', description: 'Hút 20% sát thương', type: 'damage' },
    { id: 'wood_heal', name: 'Mộc Hồi Phục', description: 'Hồi 15% HP mỗi turn', type: 'utility' },
    { id: 'wood_thorn', name: 'Mộc Gai', description: 'Phản 10% sát thương', type: 'defense' },
  ],
  skill_earth: [
    { id: 'earth_shield', name: 'Thổ Giáp', description: 'Tạo shield 20% HP', type: 'defense' },
    { id: 'earth_taunt', name: 'Thổ Khiêu Khích', description: 'Khiêu khích enemy 2 turns', type: 'utility' },
    { id: 'earth_stun', name: 'Thổ Đánh Choáng', description: 'Choáng enemy 1 turn', type: 'utility' },
  ],
  skill_wind: [
    { id: 'wind_dodge', name: 'Phong Hành Né', description: '+30% dodge 2 turns', type: 'defense' },
    { id: 'wind_speed', name: 'Phong Hành Tốc', description: '+20% speed 3 turns', type: 'utility' },
    { id: 'wind_knockback', name: 'Phong Hành Đánh Lùi', description: 'Đánh lùi enemy 1 turn', type: 'utility' },
  ],
  skill_lightning: [
    { id: 'lightning_stun', name: 'Lôi Phạt Choáng', description: 'Choáng enemy 1 turn', type: 'utility' },
    { id: 'lightning_damage', name: 'Lôi Phạt Sát Thương', description: '+50% sát thương 1 lượt', type: 'damage' },
    { id: 'lightning_chain', name: 'Lôi Phạt Liên Hoàn', description: 'Gây sát thương 3 lần', type: 'damage' },
  ],
};

class SkillMasteryService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_mastery (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL,
        mastery_level INTEGER DEFAULT 1,
        mastery_exp INTEGER DEFAULT 0,
        chosen_path TEXT DEFAULT NULL,
        awakened_branch TEXT DEFAULT NULL,
        PRIMARY KEY(user_id, skill_id)
      );
    `);
    // ponytail: add column if missing (migrated from V12)
    try { db.exec(`ALTER TABLE skill_mastery ADD COLUMN awakened_branch TEXT DEFAULT NULL`); } catch {}
  }

  /**
   * A-03: Get mastery level for a skill
   */
  getMastery(userId: string, skillId: string): SkillMastery {
    this.initTable();
    let row = db.prepare('SELECT * FROM skill_mastery WHERE user_id = ? AND skill_id = ?')
      .get(userId, skillId) as SkillMastery | undefined;

    if (!row) {
      db.prepare('INSERT INTO skill_mastery (user_id, skill_id, mastery_level, mastery_exp) VALUES (?, ?, 1, 0)')
        .run(userId, skillId);
      row = db.prepare('SELECT * FROM skill_mastery WHERE user_id = ? AND skill_id = ?')
        .get(userId, skillId) as SkillMastery;
    }

    return row!;
  }

  /**
   * A-03: Add mastery EXP (call after using skill in combat)
   */
  addMasteryExp(userId: string, skillId: string, exp: number = 10): { levelUp: boolean; newLevel: number } {
    this.initTable();
    const mastery = this.getMastery(userId, skillId);

    const newExp = mastery.mastery_exp + exp;
    const needed = MASTERY_EXP_PER_LEVEL * mastery.mastery_level;

    if (newExp >= needed && mastery.mastery_level < MAX_MASTERY_LEVEL) {
      const newLevel = mastery.mastery_level + 1;
      db.prepare('UPDATE skill_mastery SET mastery_level = ?, mastery_exp = ? WHERE user_id = ? AND skill_id = ?')
        .run(newLevel, newExp - needed, userId, skillId);
      return { levelUp: true, newLevel };
    }

    db.prepare('UPDATE skill_mastery SET mastery_exp = ? WHERE user_id = ? AND skill_id = ?')
      .run(Math.min(newExp, needed), userId, skillId);
    return { levelUp: false, newLevel: mastery.mastery_level };
  }

  /**
   * A-03: Choose skill path (offense or defense)
   */
  choosePath(userId: string, skillId: string, path: 'offense' | 'defense'): { success: boolean; message: string } {
    this.initTable();
    const mastery = this.getMastery(userId, skillId);

    if (mastery.mastery_level < 5) {
      return { success: false, message: `❌ Cần mastery level 5+ để chọn path (hiện level ${mastery.mastery_level}).` };
    }

    if (mastery.chosen_path) {
      return { success: false, message: '❌ Đã chọn path rồi! Không thể thay đổi.' };
    }

    db.prepare('UPDATE skill_mastery SET chosen_path = ? WHERE user_id = ? AND skill_id = ?')
      .run(path, userId, skillId);

    const pathInfo = SKILL_PATHS[skillId]?.[path];
    return { success: true, message: `✅ Đã chọn path **${pathInfo?.name || path}**!\n${pathInfo?.description || ''}` };
  }

  /**
   * A-03: Get mastery bonus for combat
   */
  getMasteryBonus(userId: string, skillId: string): { damageMult: number; cooldownReduction: number; extraEffect: string; awakenedEffect: string } {
    const mastery = this.getMastery(userId, skillId);

    // Each mastery level: +2% damage, -1% cooldown
    const damageMult = 1.0 + (mastery.mastery_level - 1) * 0.02;
    const cooldownReduction = (mastery.mastery_level - 1) * 0.01;

    let extraEffect = '';
    if (mastery.chosen_path && SKILL_PATHS[skillId]) {
      const pathInfo = SKILL_PATHS[skillId][mastery.chosen_path];
      extraEffect = pathInfo?.bonus || '';
    }

    // A-01: Awakening effect
    let awakenedEffect = '';
    if (mastery.awakened_branch && SKILL_AWAKENING_BRANCHES[skillId]) {
      const branch = mastery.awakened_branch === 'a'
        ? SKILL_AWAKENING_BRANCHES[skillId].branch_a
        : SKILL_AWAKENING_BRANCHES[skillId].branch_b;
      awakenedEffect = branch?.effect || '';
    }

    return { damageMult, cooldownReduction, extraEffect, awakenedEffect };
  }

  /**
   * A-01: Get available awakening branches for a skill
   */
  getAwakeningBranches(skillId: string): { branch_a: { name: string; description: string }; branch_b: { name: string; description: string } } | null {
    return SKILL_AWAKENING_BRANCHES[skillId] || null;
  }

  /**
   * A-01: Check if skill is eligible for awakening
   */
  canAwaken(userId: string, skillId: string): { eligible: boolean; reason: string } {
    const mastery = this.getMastery(userId, skillId);
    if (mastery.mastery_level < MAX_MASTERY_LEVEL) {
      return { eligible: false, reason: `Cần mastery level ${MAX_MASTERY_LEVEL} (hiện ${mastery.mastery_level})` };
    }
    if (mastery.awakened_branch) {
      return { eligible: false, reason: 'Đã giác tĩnh rồi!' };
    }
    // Check material
    try {
      const { inventoryService } = require('./InventoryService');
      if (!inventoryService.canGetAwakeningMaterial(userId, 'material_linh_tuy_giac_tinh')) {
        return { eligible: false, reason: 'Đã đạt giới hạn vật phẩm giác tĩnh hôm nay (5/ngày)' };
      }
    } catch {}
    return { eligible: true, reason: '' };
  }

  /**
   * A-01: Awaken a skill — choose branch_a or branch_b
   */
  awakenSkill(userId: string, skillId: string, branch: 'a' | 'b'): { success: boolean; message: string } {
    const check = this.canAwaken(userId, skillId);
    if (!check.eligible) return { success: false, message: `❌ ${check.reason}` };

    const branches = SKILL_AWAKENING_BRANCHES[skillId];
    if (!branches) return { success: false, message: '❌ Skill này không có nhánh giác tĩnh.' };

    const chosen = branch === 'a' ? branches.branch_a : branches.branch_b;

    // Spend material
    try {
      const { inventoryService } = require('./InventoryService');
      inventoryService.recordAwakeningMaterial(userId, 'material_linh_tuy_giac_tinh');
    } catch {}

    db.prepare('UPDATE skill_mastery SET awakened_branch = ? WHERE user_id = ? AND skill_id = ?')
      .run(branch, userId, skillId);

    return {
      success: true,
      message: `✨ **GIÁC TỈNH THÀNH CÔNG!**\nSkill đã chọn nhánh: **${chosen.name}**\n${chosen.description}`,
    };
  }

  /**
   * A-03: Check if player has unlocked a skill combo
   */
  getUnlockedCombos(userId: string): { id: string; name: string; description: string }[] {
    const unlocked: { id: string; name: string; description: string }[] = [];

    for (const [comboId, combo] of Object.entries(SKILL_COMBOS)) {
      const m1 = this.getMastery(userId, combo.skill1);
      const m2 = this.getMastery(userId, combo.skill2);

      if (m1.mastery_level >= 3 && m2.mastery_level >= 3) {
        unlocked.push({ id: comboId, name: combo.name, description: combo.description });
      }
    }

    return unlocked;
  }

  /**
   * A-03: Get mastery description for UI
   */
  getMasteryDescription(userId: string, skillId: string): string {
    const mastery = this.getMastery(userId, skillId);
    const needed = MASTERY_EXP_PER_LEVEL * mastery.mastery_level;
    const progress = Math.round((mastery.mastery_exp / needed) * 100);

    let msg = `📊 **Tinh Thông** — Cấp **${mastery.mastery_level}**/${MAX_MASTERY_LEVEL}\n`;
    msg += `Tu Vi: ${mastery.mastery_exp}/${needed} (${progress}%)\n`;
    msg += `Thưởng: +${(mastery.mastery_level - 1) * 2}% sát thương, -${(mastery.mastery_level - 1)}% hồi chiêu\n`;

    if (mastery.chosen_path) {
      const pathInfo = SKILL_PATHS[skillId]?.[mastery.chosen_path];
      msg += `Path: **${pathInfo?.name || mastery.chosen_path}** — ${pathInfo?.description || ''}\n`;
    } else if (mastery.mastery_level >= 5) {
      msg += `🔓 Đã mở path selection (dùng \`/kynang path ${skillId}\`)\n`;
    }

    // A-01: Awakening status
    if (mastery.awakened_branch) {
      const branches = SKILL_AWAKENING_BRANCHES[skillId];
      if (branches) {
        const branch = mastery.awakened_branch === 'a' ? branches.branch_a : branches.branch_b;
        msg += `✨ **GIÁC TỈNH:** ${branch.name} — ${branch.description}\n`;
      }
    } else if (mastery.mastery_level >= MAX_MASTERY_LEVEL) {
      msg += `🔓 Đã mở giác tĩnh (dùng \`/kynang giactinh ${skillId}\`)\n`;
    }

    return msg;
  }
}

export const skillMasteryService = new SkillMasteryService();
