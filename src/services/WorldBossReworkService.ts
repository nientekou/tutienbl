import db from '../database/database';
import { BOSS_PHASES, BOSS_REWARDS, BOSS_COUNTER_BONUS } from '../config/worldBossReworkConstants';

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
    return {
      ...boss,
      phaseInfo: phase,
      hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
      nextPhaseThreshold: BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1)?.hpThreshold ?? 0
    };
  }
}

export const worldBossReworkService = new WorldBossReworkService();
