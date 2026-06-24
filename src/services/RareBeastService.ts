import db from '../database/database';
import { RARE_BEASTS } from '../config/rareBeastConstants';
import { cacheService } from './CacheService';

class RareBeastService {
  attemptTame(userId: string, beastType: string, luckBonus: number): { success: boolean; beast?: any } {
    const def = RARE_BEASTS.find(b => b.type === beastType);
    if (!def) return { success: false };
    const existing = db.prepare('SELECT id FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType);
    if (existing) return { success: false };
    const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
    if (Math.random() > rate) return { success: false };
    const info = db.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, level, skills)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, beastType, def.name, def.rarity, JSON.stringify([def.passiveSkill]));
    return { success: true, beast: { id: info.lastInsertRowid, ...def } };
  }

  equip(userId: string, beastType: string): boolean {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return false;
    db.prepare('UPDATE rare_beasts SET equipped = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE rare_beasts SET equipped = 1 WHERE id = ?').run(beast.id);
    cacheService.invalidatePrefix(`stats:${userId}`);
    cacheService.invalidatePrefix(`rarebeast:${userId}`);
    return true;
  }

  getEquippedBonuses(userId: string): { atk: number; def: number; hp: number; passive: string; passiveValue: number } {
    const cached = cacheService.get(`rarebeast:${userId}`);
    if (cached) return cached as any;

    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId) as any;
    if (!beast) {
      const empty = { atk: 0, def: 0, hp: 0, passive: '', passiveValue: 0 };
      cacheService.set(`rarebeast:${userId}`, empty, 30_000);
      return empty;
    }

    const def = RARE_BEASTS.find(b => b.type === beast.beast_type)!;
    const starIdx = Math.min((beast.stars || 1) - 1, def.evolveBonus.length - 1);
    const evolveBonus = def.evolveBonus[starIdx] || { atk: 0, def: 0, hp: 0 };
    const levelMult = 1 + (beast.level - 1) * 0.015;

    const result = {
      atk: Math.floor((def.baseAtk + evolveBonus.atk) * levelMult),
      def: Math.floor((def.baseDef + evolveBonus.def) * levelMult),
      hp: Math.floor((def.baseHp + evolveBonus.hp) * levelMult),
      passive: def.passiveSkill,
      passiveValue: def.evolveBonus.length
    };

    cacheService.set(`rarebeast:${userId}`, result, 30_000);
    return result;
  }

  evolve(userId: string, beastType: string): { success: boolean; newStars: number } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast || (beast.stars || 1) >= 5) return { success: false, newStars: beast?.stars ?? 0 };
    const newStars = (beast.stars || 1) + 1;
    db.prepare('UPDATE rare_beasts SET stars = ? WHERE id = ?').run(newStars, beast.id);
    cacheService.invalidatePrefix(`rarebeast:${userId}`);
    return { success: true, newStars };
  }

  feedExp(userId: string, beastType: string, exp: number): { levelUp: boolean; newLevel: number } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return { levelUp: false, newLevel: 0 };
    const newExp = (beast.exp || 0) + exp;
    const needed = beast.level * 100;
    if (newExp >= needed) {
      const newLevel = beast.level + 1;
      db.prepare('UPDATE rare_beasts SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - needed, beast.id);
      cacheService.invalidatePrefix(`rarebeast:${userId}`);
      return { levelUp: true, newLevel };
    }
    db.prepare('UPDATE rare_beasts SET exp = ? WHERE id = ?').run(newExp, beast.id);
    return { levelUp: false, newLevel: beast.level };
  }

  getUserBeasts(userId: string): any[] {
    return db.prepare('SELECT * FROM rare_beasts WHERE user_id = ?').all(userId);
  }
}

export const rareBeastService = new RareBeastService();
