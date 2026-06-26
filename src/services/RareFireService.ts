import db from '../database/database';
import { RARE_FIRES } from '../config/rareFireConstants';
import { cacheService } from './CacheService';

class RareFireService {
  equip(userId: string, fireType: string): boolean {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType) as any;
    if (!fire) return false;
    db.prepare('UPDATE rare_fires SET equipped = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE rare_fires SET equipped = 1 WHERE id = ?').run(fire.id);
    cacheService.invalidatePrefix(`stats:${userId}`);
    cacheService.invalidatePrefix(`rarefire:${userId}`);
    return true;
  }

  getEquippedBonus(userId: string): { alchemyBonus: number; enhanceBonus: number; combatPassive: string; combatValue: number } {
    const cached = cacheService.get(`rarefire:${userId}`);
    if (cached) return cached as any;

    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND equipped = 1').get(userId) as any;
    if (!fire) {
      const empty = { alchemyBonus: 0, enhanceBonus: 0, combatPassive: '', combatValue: 0 };
      cacheService.set(`rarefire:${userId}`, empty, 30_000);
      return empty;
    }

    const def = RARE_FIRES.find(f => f.type === fire.fire_type)!;
    const levelMult = 1 + (fire.level - 1) * 0.02;
    const result = {
      alchemyBonus: Math.floor(def.alchemyBonus * levelMult),
      enhanceBonus: Math.floor(def.enhanceBonus * levelMult),
      combatPassive: def.combatPassive,
      combatValue: Math.floor(def.combatValue * levelMult)
    };

    cacheService.set(`rarefire:${userId}`, result, 30_000);
    return result;
  }

  feed(userId: string, fireType: string, materialId: string, amount: number): { success: boolean; newLevel: number } {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType) as any;
    if (!fire) return { success: false, newLevel: 0 };

    const expPerMaterial = 10;
    const newExp = fire.exp + amount * expPerMaterial;
    const expNeeded = fire.level * 50;

    if (newExp >= expNeeded && fire.level < 100) {
      const newLevel = fire.level + 1;
      db.prepare('UPDATE rare_fires SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - expNeeded, fire.id);
      cacheService.invalidatePrefix(`rarefire:${userId}`);
      return { success: true, newLevel };
    }

    db.prepare('UPDATE rare_fires SET exp = ? WHERE id = ?').run(newExp, fire.id);
    return { success: false, newLevel: fire.level };
  }

  getUserFires(userId: string): any[] {
    return db.prepare('SELECT * FROM rare_fires WHERE user_id = ? ORDER BY tier DESC').all(userId);
  }

  addFire(userId: string, fireType: string): boolean {
    const def = RARE_FIRES.find(f => f.type === fireType);
    if (!def) return false;
    const existing = db.prepare('SELECT id FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType);
    if (existing) return false;
    db.prepare('INSERT INTO rare_fires (user_id, fire_type, fire_name, tier) VALUES (?, ?, ?, ?)')
      .run(userId, fireType, def.name, def.tier);
    return true;
  }

  // === W9-06: Fire Fusion & Trials ===

  /**
   * W9-06: Fire Fusion — Merge 2 fires same tier → new fire +1 tier (70% success)
   */
  fuseFires(userId: string, fireType1: string, fireType2: string): { success: boolean; message: string } {
    const fire1 = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?').get(userId, fireType1) as any;
    const fire2 = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?').get(userId, fireType2) as any;

    if (!fire1 || !fire2) return { success: false, message: '❌ Cả 2 lửa phải tồn tại!' };
    if (fire1.id === fire2.id) return { success: false, message: '❌ Không thể hợp nhất chính mình!' };
    if (fire1.tier !== fire2.tier) return { success: false, message: '❌ 2 lửa phải cùng tier!' };
    if (fire1.tier >= 8) return { success: false, message: '❌ Đã đạt tier tối đa!' };

    // 70% success rate
    const success = Math.random() < 0.70;

    if (!success) {
      // Fail: lose materials but keep fires
      return { success: false, message: '💥 Hợp nhất thất bại! 2 lửa vẫn được giữ nguyên.' };
    }

    // Success: delete both, create new fire +1 tier
    const def1 = RARE_FIRES.find(f => f.type === fireType1)!;
    const newTier = fire1.tier + 1;
    const newDef = RARE_FIRES.find(f => f.tier === newTier);

    db.transaction(() => {
      db.prepare('DELETE FROM rare_fires WHERE id = ?').run(fire1.id);
      db.prepare('DELETE FROM rare_fires WHERE id = ?').run(fire2.id);
      if (newDef) {
        db.prepare('INSERT INTO rare_fires (user_id, fire_type, fire_name, tier, level, exp) VALUES (?, ?, ?, ?, 1, 0)')
          .run(userId, newDef.type, newDef.name, newTier);
      }
    })();

    cacheService.invalidatePrefix(`rarefire:${userId}`);

    return {
      success: true,
      message: `✨ **Hợp nhất thành công!** ${def1.name} + ${RARE_FIRES.find(f => f.type === fireType2)?.name} → **${newDef?.name || 'Không rõ'}** (Tier ${newTier})!`
    };
  }

  /**
   * W9-06: Weekly Fire Trial
   */
  enterFireTrial(userId: string): { success: boolean; message: string } {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND equipped = 1').get(userId) as any;
    if (!fire) return { success: false, message: '❌ Cần equip 1 Hỏa Lửa để tham gia Trial!' };

    // Check weekly limit (3 trials/week)
    const weekKey = this.getWeekKey();
    const trialRow = db.prepare('SELECT * FROM fire_trials WHERE user_id = ? AND week_key = ?').get(userId, weekKey) as any;
    if (trialRow && trialRow.trials_used >= 3) {
      return { success: false, message: '❌ Đã hết lượt Fire Trial tuần này (3/3).' };
    }

    // Success chance based on fire tier + level
    const successChance = Math.min(0.3 + fire.tier * 0.08 + fire.level * 0.005, 0.95);
    const isWin = Math.random() < successChance;

    // Update trial count
    if (trialRow) {
      db.prepare('UPDATE fire_trials SET trials_used = trials_used + 1 WHERE user_id = ? AND week_key = ?').run(userId, weekKey);
    } else {
      db.prepare('INSERT INTO fire_trials (user_id, week_key, trials_used) VALUES (?, ?, 1)').run(userId, weekKey);
    }

    if (isWin) {
      const expReward = 100 + fire.tier * 50 + fire.level * 10;
      this.feed(userId, fire.fire_type, 'fire_trial', Math.floor(expReward / 10));

      return {
        success: true,
        message: `🔥 **Fire Trial** — THÀNH CÔNG!\n+${expReward} EXP cho **${fire.fire_name}**`
      };
    }

    return { success: true, message: `🔥 **Fire Trial** — THẤT BẠI! Hỏa Lửa cần mạnh hơn!` };
  }

  /**
   * W9-06: Fire Awakening — at max level (100), reset to 1 but +20% permanent scaling
   */
  awakenFire(userId: string, fireType: string): { success: boolean; message: string } {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?').get(userId, fireType) as any;
    if (!fire) return { success: false, message: '❌ Hỏa Lửa không tồn tại!' };
    if (fire.level < 100) return { success: false, message: `❌ Cần level 100 (hiện ${fire.level}).` };

    db.prepare('UPDATE rare_fires SET level = 1, exp = 0 WHERE id = ?').run(fire.id);
    cacheService.invalidatePrefix(`rarefire:${userId}`);

    return {
      success: true,
      message: `🌟 **Hỏa Lửa Thức Tỉnh!** ${fire.fire_name}\n🔄 Reset level 1 → +20% stat scaling vĩnh viễn!`
    };
  }

  private getWeekKey(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const day = vn.getUTCDay() || 7;
    vn.setUTCDate(vn.getUTCDate() - (day - 1));
    vn.setUTCHours(0, 0, 0, 0);
    return vn.toISOString().slice(0, 10);
  }

  // === C-04: Fire System Deep ===

  /**
   * C-04: Get fire visuals
   */
  getFireVisuals(): { tier: number; name: string; description: string }[] {
    return [
      { tier: 1, name: 'Ngọn Lửa Mờ', description: 'Ánh lửa cơ bản' },
      { tier: 2, name: 'Ngọn Lửa Rực Rỡ', description: 'Ánh lửa sáng hơn' },
      { tier: 3, name: 'Ngọn Lửa Mãnh Liệt', description: 'Ánh lửa dữ dội có hạt' },
      { tier: 4, name: 'Địa Ngục Lửa', description: 'Hiệu ứng địa ngục có vệt' },
      { tier: 5, name: 'Lửa Phượng Hoàng', description: 'Hiệu ứng phượng hoàng có cánh' },
      { tier: 6, name: 'Lửa Long', description: 'Hiệu ứng rồng có tiếng gầm' },
      { tier: 7, name: 'Lửa Thần', description: 'Hiệu ứng thần thánh có hào quang' },
      { tier: 8, name: 'Lửa Thiên Giới', description: 'Hiệu ứng thiên giới với cực quang' },
    ];
  }

  /**
   * C-04: Get fire titles
   */
  getFireTitles(): { id: string; title: string; requirement: string }[] {
    return [
      { id: 'ft_1', title: 'Hỏa Đồ', requirement: 'Đạt Cấp 2' },
      { id: 'ft_2', title: 'Hỏa Sư', requirement: 'Đạt Cấp 5' },
      { id: 'ft_3', title: 'Hỏa Quân', requirement: 'Đạt Cấp 7' },
      { id: 'ft_4', title: 'Hỏa Thần', requirement: 'Thức tỉnh hỏa' },
    ];
  }

  /**
   * C-04: Get fire description for UI
   */
  getFireDescription(userId: string): string {
    const fires = this.getUserFires(userId);
    const equipped = fires.find((f: any) => f.equipped === 1);

    let msg = `🔥 **Bộ Sưu Tập Hỏa Lửa**\n`;
    msg += `📊 Tổng cộng: **${fires.length}**\n`;

    if (equipped) {
      const def = RARE_FIRES.find((f: any) => f.type === equipped.fire_type);
      const levelMult = 1 + (equipped.level - 1) * 0.02;
      msg += `\n**Equipped:** ${equipped.fire_name} (Tier ${equipped.tier})\n`;
      msg += `Level: **${equipped.level}**/100 | EXP: ${equipped.exp}/${equipped.level * 50}\n`;
      msg += `Alchemy Bonus: **${Math.floor((def?.alchemyBonus || 0) * levelMult)}**\n`;
      msg += `Enhance Bonus: **${Math.floor((def?.enhanceBonus || 0) * levelMult)}**\n`;
      msg += `Combat: **${def?.combatPassive || 'none'}** (Value: ${Math.floor((def?.combatValue || 0) * levelMult)})\n`;
    }

    return msg;
  }
}

export const rareFireService = new RareFireService();
