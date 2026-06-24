import db from '../database/database';
import { INNER_DEMON_TYPES, DAO_LEVELS, DAO_TYPES, TAM_MA_BASE_CHANCE, TAM_MA_QI_DEV_BONUS, TAM_MA_MAX_CHANCE, InnerDemonDef, DaoType } from '../config/tamMaConstants';
import { CombatEngine, Combatant } from './CombatEngine';
import { cacheService } from './CacheService';

class TamMaService {
  maybeSummonDemon(userId: string, userLevel: number, qiDeviation: number): InnerDemonDef | null {
    const chance = Math.min(TAM_MA_MAX_CHANCE, TAM_MA_BASE_CHANCE + (qiDeviation || 0) * TAM_MA_QI_DEV_BONUS);
    if (Math.random() > chance) return null;

    const eligible = INNER_DEMON_TYPES.filter(d => d.basePower <= userLevel * 3);
    if (!eligible.length) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  summonDemon(userId: string, demon: InnerDemonDef, playerPower: number): number {
    const scaledPower = Math.floor(demon.basePower * (1 + playerPower / 1000));
    const info = db.prepare(`
      INSERT INTO inner_demons (user_id, demon_type, demon_name, power)
      VALUES (?, ?, ?, ?)
    `).run(userId, demon.type, demon.name, scaledPower);
    return info.lastInsertRowid as number;
  }

  fightDemon(userId: string, demonId: number, playerCombatant: Combatant): { victory: boolean; log: string[]; daoType: string; daoPoints: number } {
    const row = db.prepare('SELECT * FROM inner_demons WHERE id = ? AND user_id = ?')
      .get(demonId, userId) as any;
    if (!row || row.defeated) return { victory: false, log: ['Tâm ma đã bị tiêu diệt hoặc không tồn tại!'], daoType: '', daoPoints: 0 };

    const demonDef = INNER_DEMON_TYPES.find(d => d.type === row.demon_type)!;

    // Build demon as CombatEngine Combatant
    const demonCombatant: Combatant = {
      name: row.demon_name,
      hp: row.power * 5,
      maxHp: row.power * 5,
      atk: row.power,
      def: Math.floor(row.power * 0.6),
      crit: 10,
      critRes: 5,
      luck: 0,
      element: demonDef.element,
      equippedSkills: demonDef.skills.map(s => ({
        id: s, element: demonDef.element, level: 1, name: s
      }))
    };

    // Use full CombatEngine for consistent combat mechanics
    const result = CombatEngine.run(playerCombatant, demonCombatant, null, 20);
    const victory = result.winner === 'player';

    if (victory) {
      db.prepare('UPDATE inner_demons SET defeated = 1, defeated_at = ? WHERE id = ?')
        .run(Math.floor(Date.now() / 1000), demonId);
      this.addDaoPoints(userId, demonDef.reward.daoType, demonDef.reward.points);
      db.prepare('UPDATE users SET qi_deviation = MAX(0, COALESCE(qi_deviation, 0) - 10) WHERE discord_id = ?')
        .run(userId);
      result.log.push(`✅ **Thắng!** Nhận ${demonDef.reward.points} điểm ${demonDef.reward.daoType}`);
    } else {
      db.prepare(`UPDATE users SET qi_deviation = MIN(100, COALESCE(qi_deviation, 0) + ?) WHERE discord_id = ?`)
        .run(demonDef.failurePenalty.qiDeviation, userId);
      result.log.push(`❌ **Bại!** Lệch tâm +${demonDef.failurePenalty.qiDeviation}`);
    }

    cacheService.invalidatePrefix(`stats:${userId}`);

    return { victory, log: result.log, daoType: demonDef.reward.daoType, daoPoints: victory ? demonDef.reward.points : 0 };
  }

  addDaoPoints(userId: string, daoType: string, points: number): void {
    const existing = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ? AND dao_type = ?')
      .get(userId, daoType) as any;

    if (existing) {
      const newPoints = existing.points + points;
      const levels = DAO_LEVELS[daoType] || [];
      const newLevel = levels.filter(l => newPoints >= l.pointsNeeded).length;
      db.prepare('UPDATE dao_comprehension SET points = ?, level = ? WHERE id = ?')
        .run(newPoints, newLevel, existing.id);
    } else {
      const levels = DAO_LEVELS[daoType] || [];
      const newLevel = levels.filter(l => points >= l.pointsNeeded).length;
      db.prepare('INSERT INTO dao_comprehension (user_id, dao_type, points, level) VALUES (?, ?, ?, ?)')
        .run(userId, daoType, points, newLevel);
    }

    db.prepare('UPDATE users SET total_dao_points = COALESCE(total_dao_points, 0) + ? WHERE discord_id = ?')
      .run(points, userId);
  }

  getDaoProgress(userId: string): any[] {
    return db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId);
  }

  getActiveDemon(userId: string): any | null {
    return db.prepare('SELECT * FROM inner_demons WHERE user_id = ? AND defeated = 0')
      .get(userId) as any;
  }

  getDemonHistory(userId: string, limit = 10): any[] {
    return db.prepare('SELECT * FROM inner_demons WHERE user_id = ? AND defeated = 1 ORDER BY defeated_at DESC LIMIT ?')
      .all(userId, limit);
  }

  getDaoBonuses(userId: string): Record<string, number> {
    const cacheKey = `dao_bonus:${userId}`;
    const cached = cacheService.get<Record<string, number>>(cacheKey);
    if (cached) return cached;

    const rows = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId) as any[];
    const bonuses: Record<string, number> = {};
    for (const row of rows) {
      const levels = DAO_LEVELS[row.dao_type] || [];
      const currentLevel = levels[row.level - 1];
      if (currentLevel && currentLevel.passive !== 'none') {
        bonuses[currentLevel.passive] = (bonuses[currentLevel.passive] ?? 0) + currentLevel.value;
      }
    }

    cacheService.set(cacheKey, bonuses, 60_000);
    return bonuses;
  }
}

export const tamMaService = new TamMaService();
