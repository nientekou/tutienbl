"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tamMaService = void 0;
const database_1 = __importDefault(require("../database/database"));
const tamMaConstants_1 = require("../config/tamMaConstants");
const CombatEngine_1 = require("./CombatEngine");
const CacheService_1 = require("./CacheService");
class TamMaService {
    maybeSummonDemon(userId, userLevel, qiDeviation) {
        const chance = Math.min(tamMaConstants_1.TAM_MA_MAX_CHANCE, tamMaConstants_1.TAM_MA_BASE_CHANCE + (qiDeviation || 0) * tamMaConstants_1.TAM_MA_QI_DEV_BONUS);
        if (Math.random() > chance)
            return null;
        const eligible = tamMaConstants_1.INNER_DEMON_TYPES.filter(d => d.basePower <= userLevel * 3);
        if (!eligible.length)
            return null;
        return eligible[Math.floor(Math.random() * eligible.length)];
    }
    summonDemon(userId, demon, playerPower) {
        const scaledPower = Math.floor(demon.basePower * (1 + playerPower / 1000));
        const info = database_1.default.prepare(`
      INSERT INTO inner_demons (user_id, demon_type, demon_name, power)
      VALUES (?, ?, ?, ?)
    `).run(userId, demon.type, demon.name, scaledPower);
        return info.lastInsertRowid;
    }
    fightDemon(userId, demonId, playerCombatant) {
        const row = database_1.default.prepare('SELECT * FROM inner_demons WHERE id = ? AND user_id = ?')
            .get(demonId, userId);
        if (!row || row.defeated)
            return { victory: false, log: ['Tâm ma đã bị tiêu diệt hoặc không tồn tại!'], daoType: '', daoPoints: 0 };
        const demonDef = tamMaConstants_1.INNER_DEMON_TYPES.find(d => d.type === row.demon_type);
        // Build demon as CombatEngine Combatant
        const demonCombatant = {
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
        const result = CombatEngine_1.CombatEngine.run(playerCombatant, demonCombatant, null, 20);
        const victory = result.winner === 'player';
        if (victory) {
            database_1.default.prepare('UPDATE inner_demons SET defeated = 1, defeated_at = ? WHERE id = ?')
                .run(Math.floor(Date.now() / 1000), demonId);
            this.addDaoPoints(userId, demonDef.reward.daoType, demonDef.reward.points);
            database_1.default.prepare('UPDATE users SET qi_deviation = MAX(0, COALESCE(qi_deviation, 0) - 10) WHERE discord_id = ?')
                .run(userId);
            result.log.push(`✅ **Thắng!** Nhận ${demonDef.reward.points} điểm ${demonDef.reward.daoType}`);
        }
        else {
            database_1.default.prepare(`UPDATE users SET qi_deviation = MIN(100, COALESCE(qi_deviation, 0) + ?) WHERE discord_id = ?`)
                .run(demonDef.failurePenalty.qiDeviation, userId);
            result.log.push(`❌ **Bại!** Lệch tâm +${demonDef.failurePenalty.qiDeviation}`);
        }
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        return { victory, log: result.log, daoType: demonDef.reward.daoType, daoPoints: victory ? demonDef.reward.points : 0 };
    }
    addDaoPoints(userId, daoType, points) {
        const existing = database_1.default.prepare('SELECT * FROM dao_comprehension WHERE user_id = ? AND dao_type = ?')
            .get(userId, daoType);
        if (existing) {
            const newPoints = existing.points + points;
            const levels = tamMaConstants_1.DAO_LEVELS[daoType] || [];
            const newLevel = levels.filter(l => newPoints >= l.pointsNeeded).length;
            database_1.default.prepare('UPDATE dao_comprehension SET points = ?, level = ? WHERE id = ?')
                .run(newPoints, newLevel, existing.id);
        }
        else {
            const levels = tamMaConstants_1.DAO_LEVELS[daoType] || [];
            const newLevel = levels.filter(l => points >= l.pointsNeeded).length;
            database_1.default.prepare('INSERT INTO dao_comprehension (user_id, dao_type, points, level) VALUES (?, ?, ?, ?)')
                .run(userId, daoType, points, newLevel);
        }
        database_1.default.prepare('UPDATE users SET total_dao_points = COALESCE(total_dao_points, 0) + ? WHERE discord_id = ?')
            .run(points, userId);
    }
    getDaoProgress(userId) {
        return database_1.default.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId);
    }
    getActiveDemon(userId) {
        return database_1.default.prepare('SELECT * FROM inner_demons WHERE user_id = ? AND defeated = 0')
            .get(userId);
    }
    getDemonHistory(userId, limit = 10) {
        return database_1.default.prepare('SELECT * FROM inner_demons WHERE user_id = ? AND defeated = 1 ORDER BY defeated_at DESC LIMIT ?')
            .all(userId, limit);
    }
    getDaoBonuses(userId) {
        const cacheKey = `dao_bonus:${userId}`;
        const cached = CacheService_1.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const rows = database_1.default.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId);
        const bonuses = {};
        for (const row of rows) {
            const levels = tamMaConstants_1.DAO_LEVELS[row.dao_type] || [];
            const currentLevel = levels[row.level - 1];
            if (currentLevel && currentLevel.passive !== 'none') {
                bonuses[currentLevel.passive] = (bonuses[currentLevel.passive] ?? 0) + currentLevel.value;
            }
        }
        CacheService_1.cacheService.set(cacheKey, bonuses, 60_000);
        return bonuses;
    }
}
exports.tamMaService = new TamMaService();
