"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldBossReworkService = void 0;
const database_1 = __importDefault(require("../database/database"));
const worldBossReworkConstants_1 = require("../config/worldBossReworkConstants");
class WorldBossReworkService {
    checkPhaseTransition(bossId) {
        const boss = database_1.default.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId);
        if (!boss)
            return false;
        const hpPercent = (boss.hp / boss.max_hp) * 100;
        const currentPhase = boss.phase || 1;
        for (const phase of worldBossReworkConstants_1.BOSS_PHASES) {
            if (phase.phase > currentPhase && hpPercent <= phase.hpThreshold) {
                database_1.default.prepare(`
          UPDATE world_boss SET phase = ?, current_weakness = ?,
            atk = CAST(atk * ? AS INTEGER), def = CAST(def * ? AS INTEGER)
          WHERE id = ?
        `).run(phase.phase, phase.weakness, phase.statMultiplier.atk, phase.statMultiplier.def, bossId);
                return true;
            }
        }
        return false;
    }
    calculateDamageWithCounter(baseDamage, playerElement, bossWeakness, playerUsedSkillElement) {
        if (playerUsedSkillElement === bossWeakness || playerElement === bossWeakness) {
            return Math.floor(baseDamage * worldBossReworkConstants_1.BOSS_COUNTER_BONUS);
        }
        return baseDamage;
    }
    recordPhaseDamage(userId, bossId, phase, damage) {
        const contrib = database_1.default.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
            .get(userId, bossId);
        if (!contrib)
            return;
        const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
        phaseDmg[phase] = (phaseDmg[phase] || 0) + damage;
        const mvpScore = Object.values(phaseDmg).reduce((s, v) => s + v, 0);
        database_1.default.prepare('UPDATE world_boss_contributions SET phase_damages = ?, mvp_score = ? WHERE user_id = ? AND boss_id = ?')
            .run(JSON.stringify(phaseDmg), mvpScore, userId, bossId);
    }
    getMVPScore(userId, bossId) {
        const contrib = database_1.default.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
            .get(userId, bossId);
        if (!contrib)
            return 0;
        const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
        return (phaseDmg[1] || 0) * 1.0 + (phaseDmg[2] || 0) * 1.5 + (phaseDmg[3] || 0) * 2.0;
    }
    getBossInfo(bossId) {
        const boss = database_1.default.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId);
        if (!boss)
            return null;
        const phase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1)) || worldBossReworkConstants_1.BOSS_PHASES[0];
        return {
            ...boss,
            phaseInfo: phase,
            hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
            nextPhaseThreshold: worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1)?.hpThreshold ?? 0
        };
    }
}
exports.worldBossReworkService = new WorldBossReworkService();
