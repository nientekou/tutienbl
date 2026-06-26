import db from '../database/database';

// A-03: Skill Mastery System

interface SkillMastery {
  user_id: string;
  skill_id: string;
  mastery_level: number;
  mastery_exp: number;
  chosen_path: 'offense' | 'defense' | null;
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
    { id: 'wood_lifesteal', name: 'Mộc Hấp Huyết', description: 'Hút 20% damage', type: 'damage' },
    { id: 'wood_heal', name: 'Mộc Hồi Phục', description: 'Hồi 15% HP mỗi turn', type: 'utility' },
    { id: 'wood_thorn', name: 'Mộc Gai', description: 'Phản 10% damage', type: 'defense' },
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
    { id: 'lightning_damage', name: 'Lôi Phạt Sát Thương', description: '+50% damage 1 turn', type: 'damage' },
    { id: 'lightning_chain', name: 'Lôi Phạt Liên Hoàn', description: 'Gây damage 3 lần', type: 'damage' },
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
        PRIMARY KEY(user_id, skill_id)
      );
    `);
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
  getMasteryBonus(userId: string, skillId: string): { damageMult: number; cooldownReduction: number; extraEffect: string } {
    const mastery = this.getMastery(userId, skillId);

    // Each mastery level: +2% damage, -1% cooldown
    const damageMult = 1.0 + (mastery.mastery_level - 1) * 0.02;
    const cooldownReduction = (mastery.mastery_level - 1) * 0.01;

    let extraEffect = '';
    if (mastery.chosen_path && SKILL_PATHS[skillId]) {
      const pathInfo = SKILL_PATHS[skillId][mastery.chosen_path];
      extraEffect = pathInfo?.bonus || '';
    }

    return { damageMult, cooldownReduction, extraEffect };
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

    let msg = `📊 **Mastery** — Level **${mastery.mastery_level}**/${MAX_MASTERY_LEVEL}\n`;
    msg += `EXP: ${mastery.mastery_exp}/${needed} (${progress}%)\n`;
    msg += `Bonus: +${(mastery.mastery_level - 1) * 2}% damage, -${(mastery.mastery_level - 1)}% cooldown\n`;

    if (mastery.chosen_path) {
      const pathInfo = SKILL_PATHS[skillId]?.[mastery.chosen_path];
      msg += `Path: **${pathInfo?.name || mastery.chosen_path}** — ${pathInfo?.description || ''}\n`;
    } else if (mastery.mastery_level >= 5) {
      msg += `🔓 Đã mở path selection (dùng \`/kynang path ${skillId}\`)\n`;
    }

    return msg;
  }
}

export const skillMasteryService = new SkillMasteryService();
