import db from '../database/database';
import { BOSS_PHASES, BOSS_REWARDS, BOSS_COUNTER_BONUS } from '../config/worldBossReworkConstants';
import { cacheService } from './CacheService';

class WorldBossReworkService {
  checkPhaseTransition(bossId: string): boolean {
    const boss = db.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId) as any;
    if (!boss) return false;
    const hpPercent = (boss.hp / boss.max_hp) * 100;
    const currentPhase = boss.phase || 1;
    for (const phase of BOSS_PHASES) {
      if (phase.phase > currentPhase && hpPercent <= phase.hpThreshold) {
        db.prepare(`
          UPDATE world_boss SET phase = ?, current_weakness = ?,
            atk = CAST(atk * ? AS INTEGER), def = CAST(def * ? AS INTEGER)
          WHERE id = ?
        `).run(phase.phase, phase.weakness, phase.statMultiplier.atk, phase.statMultiplier.def, bossId);
        return true;
      }
    }
    return false;
  }

  calculateDamageWithCounter(baseDamage: number, playerElement: string, bossWeakness: string, playerUsedSkillElement: string): number {
    if (playerUsedSkillElement === bossWeakness || playerElement === bossWeakness) {
      return Math.floor(baseDamage * BOSS_COUNTER_BONUS);
    }
    return baseDamage;
  }

  recordPhaseDamage(userId: string, bossId: string, phase: number, damage: number): void {
    const contrib = db.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
      .get(userId, bossId) as any;
    if (!contrib) return;
    const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
    phaseDmg[phase] = (phaseDmg[phase] || 0) + damage;
    const mvpScore = Object.values(phaseDmg).reduce((s: number, v: any) => s + v, 0) as number;
    db.prepare('UPDATE world_boss_contributions SET phase_damages = ?, mvp_score = ? WHERE user_id = ? AND boss_id = ?')
      .run(JSON.stringify(phaseDmg), mvpScore, userId, bossId);
  }

  getMVPScore(userId: string, bossId: string): number {
    const contrib = db.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
      .get(userId, bossId) as any;
    if (!contrib) return 0;
    const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
    return (phaseDmg[1] || 0) * 1.0 + (phaseDmg[2] || 0) * 1.5 + (phaseDmg[3] || 0) * 2.0;
  }

  getBossInfo(bossId: string): any {
    const boss = db.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId) as any;
    if (!boss) return null;
    const phase = BOSS_PHASES.find(p => p.phase === (boss.phase || 1)) || BOSS_PHASES[0];
    const nextPhase = BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1);
    return {
      ...boss,
      phaseInfo: phase,
      hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
      nextPhaseThreshold: nextPhase?.hpThreshold ?? 0,
      currentWeakness: boss.current_weakness || phase.weakness,
      abilities: phase.abilities
    };
  }

  distributeRewards(bossId: string): { totalRewarded: number; mvp: string | null; lastHit: string | null; topPlayers: { userId: string; rank: number; reward: string }[] } {
    const contributions = db.prepare(`
      SELECT * FROM world_boss_contributions WHERE boss_id = ? ORDER BY mvp_score DESC
    `).all(bossId) as any[];

    if (!contributions.length) return { totalRewarded: 0, mvp: null, lastHit: null, topPlayers: [] };

    const totalRewarded = contributions.length;
    let mvpUserId: string | null = null;
    let lastHitUserId: string | null = null;
    const topPlayers: { userId: string; rank: number; reward: string }[] = [];

    // Find MVP (highest mvp_score)
    const mvp = contributions[0];
    if (mvp && mvp.mvp_score > 0) mvpUserId = mvp.user_id;

    // Find last hit
    const lastHitter = contributions.find(c => c.last_hit === 1);
    if (lastHitter) lastHitUserId = lastHitter.user_id;

    db.transaction(() => {
      contributions.forEach((c, idx) => {
        const rank = idx + 1;
        let reward = BOSS_REWARDS.participation;
        let rewardLabel = 'Tham gia';

        if (c.user_id === mvpUserId) {
          reward = BOSS_REWARDS.mvp;
          rewardLabel = 'MVP';
        } else if (c.user_id === lastHitUserId) {
          reward = BOSS_REWARDS.last_hit;
          rewardLabel = 'Chóp cuối';
        } else if (rank <= 3) {
          reward = BOSS_REWARDS.top3;
          rewardLabel = 'Top 3';
        } else if (rank <= 10) {
          reward = BOSS_REWARDS.top10;
          rewardLabel = 'Top 10';
        } else if (c.damage > 0) {
          reward = BOSS_REWARDS.participation;
          rewardLabel = 'Tham gia';
        }

        if (reward.ngotinh > 0) {
          db.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
            .run(reward.ngotinh, c.user_id);
        }
        if (reward.coins > 0) {
          db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?')
            .run(reward.coins, c.user_id);
        }

        if (rank <= 10) {
          topPlayers.push({ userId: c.user_id, rank, reward: `${reward.ngotinh} Ngt, ${reward.coins} coins (${rewardLabel})` });
        }
      });

      // Clear contributions for this boss
      db.prepare('DELETE FROM world_boss_contributions WHERE boss_id = ?').run(bossId);
    })();

    cacheService.invalidatePrefix('boss:');
    return { totalRewarded, mvp: mvpUserId, lastHit: lastHitUserId, topPlayers };
  }

  getSpectators(bossId: string): any[] {
    return db.prepare(`
      SELECT s.*, u.name FROM arena_spectators s
      JOIN users u ON s.viewer_id = u.discord_id
      WHERE s.match_id = ?
    `).all(bossId);
  }
}

export const worldBossReworkService = new WorldBossReworkService();
