"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldBossReworkService = void 0;
const database_1 = __importDefault(require("../database/database"));
const worldBossReworkConstants_1 = require("../config/worldBossReworkConstants");
const CacheService_1 = require("./CacheService");
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
        const nextPhase = worldBossReworkConstants_1.BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1);
        return {
            ...boss,
            phaseInfo: phase,
            hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
            nextPhaseThreshold: nextPhase?.hpThreshold ?? 0,
            currentWeakness: boss.current_weakness || phase.weakness,
            abilities: phase.abilities
        };
    }
    distributeRewards(bossId) {
        const contributions = database_1.default.prepare(`
      SELECT * FROM world_boss_contributions WHERE boss_id = ? ORDER BY mvp_score DESC
    `).all(bossId);
        if (!contributions.length)
            return { totalRewarded: 0, mvp: null, lastHit: null, topPlayers: [] };
        const totalRewarded = contributions.length;
        let mvpUserId = null;
        let lastHitUserId = null;
        const topPlayers = [];
        // Find MVP (highest mvp_score)
        const mvp = contributions[0];
        if (mvp && mvp.mvp_score > 0)
            mvpUserId = mvp.user_id;
        // Find last hit
        const lastHitter = contributions.find(c => c.last_hit === 1);
        if (lastHitter)
            lastHitUserId = lastHitter.user_id;
        database_1.default.transaction(() => {
            contributions.forEach((c, idx) => {
                const rank = idx + 1;
                let reward = worldBossReworkConstants_1.BOSS_REWARDS.participation;
                let rewardLabel = 'Tham gia';
                if (c.user_id === mvpUserId) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.mvp;
                    rewardLabel = 'MVP';
                }
                else if (c.user_id === lastHitUserId) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.last_hit;
                    rewardLabel = 'Chóp cuối';
                }
                else if (rank <= 3) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.top3;
                    rewardLabel = 'Top 3';
                }
                else if (rank <= 10) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.top10;
                    rewardLabel = 'Top 10';
                }
                else if (c.damage > 0) {
                    reward = worldBossReworkConstants_1.BOSS_REWARDS.participation;
                    rewardLabel = 'Tham gia';
                }
                if (reward.ngotinh > 0) {
                    database_1.default.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
                        .run(reward.ngotinh, c.user_id);
                }
                if (reward.coins > 0) {
                    database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?')
                        .run(reward.coins, c.user_id);
                }
                if (rank <= 10) {
                    topPlayers.push({ userId: c.user_id, rank, reward: `${reward.ngotinh} Ngt, ${reward.coins} coins (${rewardLabel})` });
                }
            });
            // Clear contributions for this boss
            database_1.default.prepare('DELETE FROM world_boss_contributions WHERE boss_id = ?').run(bossId);
        })();
        CacheService_1.cacheService.invalidatePrefix('boss:');
        return { totalRewarded, mvp: mvpUserId, lastHit: lastHitUserId, topPlayers };
    }
    getSpectators(bossId) {
        return database_1.default.prepare(`
      SELECT s.*, u.name FROM arena_spectators s
      JOIN users u ON s.viewer_id = u.discord_id
      WHERE s.match_id = ?
    `).all(bossId);
    }
}
exports.worldBossReworkService = new WorldBossReworkService();
