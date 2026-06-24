"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tamMaService = void 0;
const database_1 = __importDefault(require("../database/database"));
const tamMaConstants_1 = require("../config/tamMaConstants");
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
    fightDemon(userId, demonId, playerStats) {
        const row = database_1.default.prepare('SELECT * FROM inner_demons WHERE id = ? AND user_id = ?')
            .get(demonId, userId);
        if (!row || row.defeated)
            return { victory: false, log: ['Tâm ma đã bị tiêu diệt hoặc không tồn tại!'], daoType: '', daoPoints: 0 };
        const demonDef = tamMaConstants_1.INNER_DEMON_TYPES.find(d => d.type === row.demon_type);
        const log = [];
        let playerHp = playerStats.hp;
        let demonHp = row.power * 5;
        const demonAtk = row.power;
        const demonDefense = Math.floor(row.power * 0.6);
        const elementAdvantage = {
            kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim'
        };
        for (let round = 1; round <= 20; round++) {
            const playerDmg = Math.max(1, Math.floor(playerStats.atk * (0.8 + Math.random() * 0.4) - demonDefense * 0.5));
            demonHp -= playerDmg;
            log.push(`H#${round}: Đạo hữu tấn công -${playerDmg} HP`);
            if (demonHp <= 0)
                break;
            const demonDmg = Math.max(1, Math.floor(demonAtk * (0.8 + Math.random() * 0.4) - playerStats.def * 0.5));
            playerHp -= demonDmg;
            log.push(`M#${round}: ${demonDef.name} tấn công -${demonDmg} HP`);
            if (playerHp <= 0)
                break;
        }
        const victory = demonHp <= 0;
        if (victory) {
            database_1.default.prepare('UPDATE inner_demons SET defeated = 1, defeated_at = ? WHERE id = ?')
                .run(Math.floor(Date.now() / 1000), demonId);
            this.addDaoPoints(userId, demonDef.reward.daoType, demonDef.reward.points);
            database_1.default.prepare('UPDATE users SET qi_deviation = MAX(0, COALESCE(qi_deviation, 0) - 10) WHERE discord_id = ?')
                .run(userId);
            log.push(`✅ **Thắng!** Nhận ${demonDef.reward.points} điểm ${demonDef.reward.daoType}`);
        }
        else {
            database_1.default.prepare(`UPDATE users SET qi_deviation = MIN(100, COALESCE(qi_deviation, 0) + ?) WHERE discord_id = ?`)
                .run(demonDef.failurePenalty.qiDeviation, userId);
            log.push(`❌ **Bại!** Lệch tâm +${demonDef.failurePenalty.qiDeviation}`);
        }
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        return { victory, log, daoType: demonDef.reward.daoType, daoPoints: victory ? demonDef.reward.points : 0 };
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
