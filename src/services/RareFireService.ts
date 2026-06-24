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
}

export const rareFireService = new RareFireService();
