import { soulWeaponRepository, SoulWeapon } from '../database/repositories/SoulWeaponRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import db from '../database/database';
import { ActiveStats } from './InventoryService';

// W9-07: Soul Weapon Evolution Stages
const EVOLUTION_STAGES = [
  { stage: 1, name: 'Vũ Khí Cơ Bản', levelRange: [1, 20], skillSlots: 0 },
  { stage: 2, name: 'Linh Khí', levelRange: [21, 40], skillSlots: 1 },
  { stage: 3, name: 'Tinh Khí', levelRange: [41, 60], skillSlots: 2 },
  { stage: 4, name: 'Thần Khí', levelRange: [61, 80], skillSlots: 3 },
  { stage: 5, name: 'Tiên Khí', levelRange: [81, 100], skillSlots: 3 },
];

// W9-07: Soul Weapon Skill definitions
const SOUL_WEAPON_SKILLS = [
  { id: 'sw_crit_passive', name: 'Kiếm Khí Bạo', type: 'passive', description: '+3% Bạo Kích', value: 0.03, unlockStage: 2 },
  { id: 'sw_lifesteal_passive', name: 'Hấp Huyết', type: 'passive', description: '+2% Hút Máu', value: 0.02, unlockStage: 2 },
  { id: 'sw_burst_trigger', name: 'Phá Đòn', type: 'trigger', description: '10% cơ hội gây +20% sát thương', value: 0.20, chance: 0.10, unlockStage: 3 },
  { id: 'sw_extra_hit_trigger', name: 'Nhất Kiếm Phệ', type: 'trigger', description: '8% cơ hội đánh thêm', value: 1, chance: 0.08, unlockStage: 3 },
  { id: 'sw_ignore_def_ult', name: 'Vô Kiếm', type: 'ultimate', description: 'Bỏ qua 25% phòng thủ trong 1 đòn', value: 0.25, unlockStage: 4 },
  { id: 'sw_double_dmg_ult', name: 'Song Kiếm', type: 'ultimate', description: 'Nhân đôi sát thương trong 1 đòn', value: 2.0, unlockStage: 4 },
  { id: 'sw_domain_ult', name: 'Kiếm Giới', type: 'ultimate', description: '+30% toàn bộ sát thương trong 3 lượt', value: 0.30, unlockStage: 5 },
];

class SoulWeaponService {
  private readonly MAX_LEVEL = 100;

  // Cần bao nhiêu exp để thăng cấp? (Cấp * 50)
  public getExpRequired(level: number): number {
    return level * 50;
  }

  // Nuốt trang bị rác để tăng EXP
  public feedItems(userId: string, inventoryIds: number[]): { success: boolean; message: string; expGained: number; levelUp: number } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { success: false, message: 'Đạo hữu chưa có Pháp Bảo Bản Mệnh!', expGained: 0, levelUp: 0 };
    if (sw.level >= this.MAX_LEVEL) return { success: false, message: 'Pháp Bảo đã đạt cấp tối đa!', expGained: 0, levelUp: 0 };

    if (inventoryIds.length === 0) return { success: false, message: 'Vui lòng chọn ít nhất 1 vật phẩm để tế luyện!', expGained: 0, levelUp: 0 };

    let totalExpGained = 0;
    let itemsDestroyed = 0;
    
    const tx = db.transaction(() => {
      for (const invId of inventoryIds) {
        // Chỉ lấy trang bị (equipable = 1) hoặc nguyên liệu
        const item = db.prepare(`
          SELECT i.id, i.quantity, i.is_equipped, t.rarity, t.type
          FROM inventories i
          JOIN items t ON i.item_id = t.id
          WHERE i.id = ? AND i.user_id = ?
        `).get(invId, userId) as any;

        if (!item || item.is_equipped === 1) continue;

        // Tính EXP dựa trên độ hiếm
        let expPerItem = 1;
        if (item.rarity === 'uncommon') expPerItem = 2;
        if (item.rarity === 'rare') expPerItem = 5;
        if (item.rarity === 'epic') expPerItem = 20;
        if (item.rarity === 'legendary') expPerItem = 100;

        totalExpGained += (expPerItem * item.quantity);
        itemsDestroyed += item.quantity;
        
        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
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
      } else {
        break;
      }
    }

    // Nếu đạt max cấp, reset exp
    if (currentLevel >= this.MAX_LEVEL) {
      currentLevel = this.MAX_LEVEL;
      currentExp = 0;
    }

    soulWeaponRepository.updateLevelExp(sw.id, currentLevel, currentExp);

    let msg = `✨ Đã hiến tế **${itemsDestroyed}** vật phẩm. Pháp bảo **${sw.name}** nhận được **${totalExpGained} Tu Vi**!`;
    if (levelUps > 0) msg += `\n🎉 **Bạo phát!** Pháp bảo đột phá **${levelUps}** cấp, đạt **Lv${currentLevel}**!`;

    return { success: true, message: msg, expGained: totalExpGained, levelUp: levelUps };
  }

  // === W9-07: Soul Weapon Evolution ===

  /**
   * W9-07: Get current evolution stage based on level
   */
  getEvolutionStage(level: number): typeof EVOLUTION_STAGES[0] {
    for (let i = EVOLUTION_STAGES.length - 1; i >= 0; i--) {
      if (level >= EVOLUTION_STAGES[i].levelRange[0]) return EVOLUTION_STAGES[i];
    }
    return EVOLUTION_STAGES[0];
  }

  /**
   * W9-07: Check if weapon can evolve to next stage
   */
  canEvolve(userId: string): { canEvolve: boolean; nextStage?: typeof EVOLUTION_STAGES[0]; requirement?: string } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { canEvolve: false };

    const currentStage = this.getEvolutionStage(sw.level);
    const nextStageIdx = EVOLUTION_STAGES.findIndex(s => s.stage === currentStage.stage + 1);
    if (nextStageIdx === -1) return { canEvolve: false }; // Already max stage

    const nextStage = EVOLUTION_STAGES[nextStageIdx];

    // Check level requirement
    if (sw.level < nextStage.levelRange[0]) {
      return { canEvolve: false, nextStage, requirement: `Cần level ${nextStage.levelRange[0]}` };
    }

    // Stage 4+ has 30% failure chance
    if (currentStage.stage >= 4 && Math.random() < 0.30) {
      return { canEvolve: false, requirement: 'Tiến hóa thất bại! Nguyên liệu bị mất.' };
    }

    return { canEvolve: true, nextStage };
  }

  /**
   * W9-07: Evolve weapon to next stage
   */
  evolveWeapon(userId: string): { success: boolean; message: string } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { success: false, message: '❌ Không có Pháp Bảo!' };

    const currentStage = this.getEvolutionStage(sw.level);
    const nextStageIdx = EVOLUTION_STAGES.findIndex(s => s.stage === currentStage.stage + 1);
    if (nextStageIdx === -1) return { success: false, message: '❌ Đã đạt giai đoạn tối đa!' };

    const nextStage = EVOLUTION_STAGES[nextStageIdx];
    if (sw.level < nextStage.levelRange[0]) {
      return { success: false, message: `❌ Cần level ${nextStage.levelRange[0]} để tiến hóa (hiện level ${sw.level}).` };
    }

    // Stage 4+ has 30% failure chance
    if (currentStage.stage >= 4 && Math.random() < 0.30) {
      return { success: false, message: '💥 Tiến hóa thất bại! Nguyên liệu bị mất.' };
    }

    soulWeaponRepository.updateEvolution(sw.id, nextStage.stage);

    return {
      success: true,
      message: `✨ **Pháp Bảo tiến hóa!** ${sw.name} → **${nextStage.name}** (Stage ${nextStage.stage})\n` +
        `🔓 Mở **${nextStage.skillSlots}** ô kỹ năng!`
    };
  }

  /**
   * W9-07: Get available skills for weapon
   */
  getAvailableSkills(userId: string): typeof SOUL_WEAPON_SKILLS {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return [];

    const stage = this.getEvolutionStage(sw.level);
    return SOUL_WEAPON_SKILLS.filter(s => s.unlockStage <= stage.stage);
  }

  /**
   * W9-07: Get weapon combat bonuses
   */
  getCombatBonuses(userId: string): { atk: number; def: number; hp: number } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { atk: 0, def: 0, hp: 0 };

    const stage = this.getEvolutionStage(sw.level);
    const levelMult = 1 + (sw.level - 1) * 0.02;
    const stageMult = 1 + (stage.stage - 1) * 0.15;

    // P1-05: Diminishing returns — soul weapon ATK capped at +100% of base ATK
    return {
      atk: Math.round(sw.level * 2 * levelMult * stageMult),
      def: Math.round(sw.level * 1.5 * levelMult * stageMult),
      hp: Math.round(sw.level * 10 * levelMult * stageMult)
    };
  }

  /**
   * W9-07: Weapon Awakening — at level 100, reset to level 1 but +10% all stats
   */
  awakenWeapon(userId: string): { success: boolean; message: string } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { success: false, message: '❌ Không có Pháp Bảo!' };

    if (sw.level < this.MAX_LEVEL) {
      return { success: false, message: `❌ Cần level ${this.MAX_LEVEL} để thức tỉnh (hiện level ${sw.level}).` };
    }

    const currentAwakenings = sw.awakening_level || 0;
    if (currentAwakenings >= 2) {
      return { success: false, message: '❌ Đã thức tỉnh tối đa 2 lần!' };
    }

    soulWeaponRepository.updateAwakening(sw.id, currentAwakenings + 1);

    return {
      success: true,
      message: `🌟 **Pháp Bảo Thức Tỉnh!** ${sw.name}\n` +
        `🔄 Reset về level 1, stage 1\n` +
        `📈 **+10% toàn bộ chỉ số** (Thức Tỉnh ${currentAwakenings + 1}/2)\n` +
        `✨ Weapon name/visual thay đổi!`
    };
  }

  /**
   * W9-07: Get weapon description for UI
   */
  getWeaponDescription(userId: string): string {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return '❌ Đạo hữu chưa có Pháp Bảo Bản Mệnh.';

    const stage = this.getEvolutionStage(sw.level);
    const bonuses = this.getCombatBonuses(userId);
    const skills = this.getAvailableSkills(userId);
    const awakenings = sw.awakening_level || 0;

    let msg = `⚔️ **${sw.name}** (${sw.type})\n`;
    msg += `📊 Cấp **${sw.level}**/${this.MAX_LEVEL} | Stage **${stage.stage}** (${stage.name})\n`;
    msg += `🌟 Thức Tỉnh: **${awakenings}/2**\n`;
    msg += `📈 ATK: **${bonuses.atk}** | DEF: **${bonuses.def}** | HP: **${bonuses.hp}**\n`;
    msg += `🔓 Skill slots: **${stage.skillSlots}**\n`;

    if (skills.length > 0) {
      msg += `\n**Kỹ năng:**\n`;
      for (const s of skills) {
        const typeEmoji = s.type === 'passive' ? '🔮' : s.type === 'trigger' ? '⚡' : '🔥';
        msg += `${typeEmoji} **${s.name}**: ${s.description}\n`;
      }
    }

    return msg;
  }

  // === C-02: Soul Weapon Deep ===

  /**
   * C-02: Get weapon skins
   */
  getWeaponSkins(): { id: string; name: string; description: string; requirement: string }[] {
    return [
      { id: 'skin_flame', name: 'Hỏa Luyện', description: 'Vũ khí hệ Hỏa', requirement: 'Vượt Hỏa Điện' },
      { id: 'skin_ice', name: 'Băng Luyện', description: 'Vũ khí hệ Băng', requirement: 'Vượt Băng Cung' },
      { id: 'skin_storm', name: 'Sấm Luyện', description: 'Vũ khí hệ Lôi', requirement: 'Vượt Lôi Tháp' },
      { id: 'skin_earth', name: 'Thổ Luyện', description: 'Vũ khí hệ Thổ', requirement: 'Vượt Thổ Thành' },
      { id: 'skin_legendary', name: 'Thần Thoại', description: 'Vũ khí huyền thoại', requirement: 'Đạt Giai Đoạn 5' },
    ];
  }

  /**
   * C-02: Get weapon titles
   */
  getWeaponTitles(): { id: string; title: string; requirement: string }[] {
    return [
      { id: 'wt_1', title: 'Khí Linh Sư', requirement: 'Đạt Cấp 50' },
      { id: 'wt_2', title: 'Khí Linh Huyền Thoại', requirement: 'Đạt Cấp 100' },
      { id: 'wt_3', title: 'Khí Linh Thần', requirement: 'Thức tỉnh vũ khí' },
      { id: 'wt_4', title: 'Khí Linh Tối Thượng', requirement: 'Thức tỉnh vũ khí 2 lần' },
    ];
  }

  /**
   * C-02: Get weapon description for UI
   */
  getWeaponDeepDescription(userId: string): string {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw)     return 'Chưa có Pháp Bảo!';

    const stage = this.getEvolutionStage(sw.level);
    const bonuses = this.getCombatBonuses(userId);
    const awakenings = sw.awakening_level || 0;

    let msg = `⚔️ **${sw.name}** (${sw.type})\n`;
    msg += `📊 Cấp **${sw.level}**/${this.MAX_LEVEL} | Stage **${stage.stage}** (${stage.name})\n`;
    msg += `🌟 Thức Tỉnh: **${awakenings}/2**\n`;
    msg += `📈 ATK: **${bonuses.atk}** | DEF: **${bonuses.def}** | HP: **${bonuses.hp}**\n`;
    msg += `🔓 Skill slots: **${stage.skillSlots}**\n`;

    const skills = this.getAvailableSkills(userId);
    if (skills.length > 0) {
      msg += `\n**Kỹ năng:**\n`;
      for (const s of skills) {
        const typeEmoji = s.type === 'passive' ? '🔮' : s.type === 'trigger' ? '⚡' : '🔥';
        msg += `${typeEmoji} **${s.name}**: ${s.description}\n`;
      }
    }

    return msg;
  }
}

export const soulWeaponService = new SoulWeaponService();
