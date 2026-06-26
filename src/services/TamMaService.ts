import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
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

  // === P5-03: Dao Skills Expansion ===

  /**
   * P5-03: Lấy danh sách Dao skills đã unlock
   * Tier 3: Active skill, Tier 7: Ultimate skill
   */
  public getActiveDaoSkills(userId: string): { daoType: string; level: number; skill: { type: string; name: string; description: string } }[] {
    const rows = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ? AND level >= 3').all(userId) as any[];

    const daoSkillDefs: Record<string, { tier3: { name: string; description: string }; tier7: { name: string; description: string } }> = {
      sword_dao: {
        tier3: { name: 'Kiếm Khí Hộ Thể', description: '+10% sát thương kiếm hệ trong 3 hiệp' },
        tier7: { name: 'Vạn Kiếm Quy Tông', description: 'Ultimate: Gây sát thương gấp đôi 1 lần, ignores 50% DEF' }
      },
      soul_dao: {
        tier3: { name: 'Hồn Phù Chú', description: 'Choáng kẻ địch 1 lượt, 30% tỷ lệ' },
        tier7: { name: 'Hồn Diệt', description: 'Ultimate: Phá hủy 30% HP enemy, ignore shield' }
      },
      body_dao: {
        tier3: { name: 'Thiết Bố Sam', description: '+20% DEF trong 2 hiệp, không thể bị crit' },
        tier7: { name: 'Bất Tử Thân', description: 'Ultimate: Hồi phục 50% HP, miễn tử 1 đòn' }
      },
      formation_dao: {
        tier3: { name: 'Pháp Trận Hộ Mệnh', description: 'Tạo shield absorbs 15% HP trong 3 hiệp' },
        tier7: { name: 'Trận Lục Đạo', description: 'Ultimate: Reflect 50% sát thương trong 2 hiệp' }
      },
      alchemist_dao: {
        tier3: { name: 'Đan Dược Bùng Nổ', description: 'Sử dụng 1 viên đan dược miễn phí trong combat' },
        tier7: { name: 'Thiên Đan', description: 'Ultimate: Hồi phục 100% HP + +30% ATK trong 2 hiệp' }
      }
    };

    const skills: { daoType: string; level: number; skill: { type: string; name: string; description: string } }[] = [];

    for (const row of rows) {
      const def = daoSkillDefs[row.dao_type];
      if (!def) continue;

      if (row.level >= 7) {
        skills.push({ daoType: row.dao_type, level: row.level, skill: { type: 'ultimate', ...def.tier7 } });
      } else if (row.level >= 3) {
        skills.push({ daoType: row.dao_type, level: row.level, skill: { type: 'active', ...def.tier3 } });
      }
    }

    return skills;
  }

  /**
   * P5-03: Lấy mô tả Dao progress cho UI
   */
  public getDaoDescription(userId: string): string {
    const rows = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId) as any[];
    if (rows.length === 0) return 'Chưa có Dao nào được lĩnh ngộ.';

    let desc = '**Tiến Trình Đạo Giới:**\n';
    for (const row of rows) {
      const levels = DAO_LEVELS[row.dao_type] || [];
      const maxLevel = levels.length;
      const nextLevel = levels[row.level] || null;
      const currentLevel = levels[row.level - 1];

      desc += `• **${row.dao_type}**: Level ${row.level}/${maxLevel} (${row.points} điểm)`;
      if (nextLevel) {
        desc += ` — Cần ${nextLevel.pointsNeeded - row.points} điểm nữa để lên level`;
      } else {
        desc += ` — **MAX LEVEL**`;
      }
      if (currentLevel && currentLevel.passive !== 'none') {
        desc += ` [${currentLevel.passive}: +${currentLevel.value}]`;
      }
      desc += '\n';
    }

    const skills = this.getActiveDaoSkills(userId);
    if (skills.length > 0) {
      desc += '\n**Kỹ Năng Đạo Giới:**\n';
      for (const s of skills) {
        desc += `• ${s.skill.type === 'ultimate' ? '⚡' : '🎯'} **${s.skill.name}** (${s.daoType} Lv${s.level}): ${s.skill.description}\n`;
      }
    }

    return desc;
  }

  // === A-06: Dao Comprehension Deep ===

  /**
   * A-06: Get cross-dao synergy bonuses
   */
  getCrossDaoSynergy(userId: string): { dao1: string; dao2: string; synergy: string; bonus: string }[] {
    const rows = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ? AND level >= 2').all(userId) as any[];
    const synergies: { dao1: string; dao2: string; synergy: string; bonus: string }[] = [];

    const SYNERGY_MAP: Record<string, { name: string; bonus: string }> = {
      'sword_dao+body_dao': { name: 'Kiếm Thể Hợp Nhất', bonus: '+10% sát thương + 5% hút máu' },
      'soul_dao+formation_dao': { name: 'Hồn Trận Liên Kết', bonus: '+10% sát thương kỹ năng + 5% giảm hồi chiêu' },
      'alchemist_dao+body_dao': { name: 'Đan Thể Song Tu', bonus: '+10% chất lượng chế tạo + 5% HP' },
      'sword_dao+soul_dao': { name: 'Kiếm Hồn Hợp Nhất', bonus: '+10% sát thương chí mạng + 5% bạo kích' },
      'formation_dao+alchemist_dao': { name: 'Trận Đan Hợp Nhất', bonus: '+10% tốc độ chế tạo + 5% sát thương' },
      'body_dao+soul_dao': { name: 'Thể Hồn Hợp Nhất', bonus: '+10% HP + 5% toàn bộ chỉ số' },
    };

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const key1 = `${rows[i].dao_type}+${rows[j].dao_type}`;
        const key2 = `${rows[j].dao_type}+${rows[i].dao_type}`;
        const synergy = SYNERGY_MAP[key1] || SYNERGY_MAP[key2];

        if (synergy) {
          synergies.push({
            dao1: rows[i].dao_type,
            dao2: rows[j].dao_type,
            synergy: synergy.name,
            bonus: synergy.bonus
          });
        }
      }
    }

    return synergies;
  }

  /**
   * A-06: Dao Shop
   */
  getDaoShopItems(): { id: string; name: string; cost: number; type: string; description: string }[] {
    return [
      { id: 'dao_pill', name: 'Đan Dược Đạo Giải', cost: 100, type: 'consumable', description: '+50% tu luyện trong 1h' },
      { id: 'dao_scroll', name: 'Cuốn Pháp Thuật', cost: 200, type: 'skill', description: 'Mở khóa kỹ năng ngẫu nhiên' },
      { id: 'dao_stone', name: 'Đá Đạo Giải', cost: 150, type: 'material', description: 'Nguyên liệu cho tiến hóa Đạo' },
      { id: 'dao_title', name: 'Danh Hiệu Đạo Giải', cost: 300, type: 'title', description: 'Danh hiệu đặc biệt' },
      { id: 'dao_cosmetic', name: 'Hào Quang Đạo Giải', cost: 500, type: 'cosmetic', description: 'Hào Quang Luân Hồi' },
    ];
  }

  /**
   * A-06: Buy from Dao shop
   */
  buyFromDaoShop(userId: string, itemId: string): { success: boolean; message: string } {
    const items = this.getDaoShopItems();
    const item = items.find(i => i.id === itemId);
    if (!item) return { success: false, message: 'Vật phẩm không tồn tại!' };

    const totalPoints = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM dao_comprehension WHERE user_id = ?')
      .get(userId) as { total: number };

    if (totalPoints.total < item.cost) {
      return { success: false, message: `Không đủ Điểm Đạo! (Cần ${item.cost}, có ${totalPoints.total})` };
    }

    db.prepare('UPDATE dao_comprehension SET points = points - ? WHERE user_id = ? AND points >= ?')
      .run(item.cost, userId, item.cost);

    if (item.type === 'title') {
      db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
        .run(userId, item.name, 'dao', Math.floor(Date.now() / 1000));
    } else if (item.type === 'consumable') {
      const user = userRepository.get(userId);
      if (user) {
        userRepository.update(userId, { tu_vi: Math.min(user.tu_vi + 5000, user.exp_needed) });
      }
    }

    return { success: true, message: `Đã mua **${item.name}**! (-${item.cost} Điểm Đạo)` };
  }
}

export const tamMaService = new TamMaService();
