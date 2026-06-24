"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rareFireService = void 0;
const database_1 = __importDefault(require("../database/database"));
const rareFireConstants_1 = require("../config/rareFireConstants");
const CacheService_1 = require("./CacheService");
class RareFireService {
    equip(userId, fireType) {
        const fire = database_1.default.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
            .get(userId, fireType);
        if (!fire)
            return false;
        database_1.default.prepare('UPDATE rare_fires SET equipped = 0 WHERE user_id = ?').run(userId);
        database_1.default.prepare('UPDATE rare_fires SET equipped = 1 WHERE id = ?').run(fire.id);
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        CacheService_1.cacheService.invalidatePrefix(`rarefire:${userId}`);
        return true;
    }
    getEquippedBonus(userId) {
        const cached = CacheService_1.cacheService.get(`rarefire:${userId}`);
        if (cached)
            return cached;
        const fire = database_1.default.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND equipped = 1').get(userId);
        if (!fire) {
            const empty = { alchemyBonus: 0, enhanceBonus: 0, combatPassive: '', combatValue: 0 };
            CacheService_1.cacheService.set(`rarefire:${userId}`, empty, 30_000);
            return empty;
        }
        const def = rareFireConstants_1.RARE_FIRES.find(f => f.type === fire.fire_type);
        const levelMult = 1 + (fire.level - 1) * 0.02;
        const result = {
            alchemyBonus: Math.floor(def.alchemyBonus * levelMult),
            enhanceBonus: Math.floor(def.enhanceBonus * levelMult),
            combatPassive: def.combatPassive,
            combatValue: Math.floor(def.combatValue * levelMult)
        };
        CacheService_1.cacheService.set(`rarefire:${userId}`, result, 30_000);
        return result;
    }
    feed(userId, fireType, materialId, amount) {
        const fire = database_1.default.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
            .get(userId, fireType);
        if (!fire)
            return { success: false, newLevel: 0 };
        const expPerMaterial = 10;
        const newExp = fire.exp + amount * expPerMaterial;
        const expNeeded = fire.level * 50;
        if (newExp >= expNeeded && fire.level < 100) {
            const newLevel = fire.level + 1;
            database_1.default.prepare('UPDATE rare_fires SET level = ?, exp = ? WHERE id = ?')
                .run(newLevel, newExp - expNeeded, fire.id);
            CacheService_1.cacheService.invalidatePrefix(`rarefire:${userId}`);
            return { success: true, newLevel };
        }
        database_1.default.prepare('UPDATE rare_fires SET exp = ? WHERE id = ?').run(newExp, fire.id);
        return { success: false, newLevel: fire.level };
    }
    getUserFires(userId) {
        return database_1.default.prepare('SELECT * FROM rare_fires WHERE user_id = ? ORDER BY tier DESC').all(userId);
    }
    addFire(userId, fireType) {
        const def = rareFireConstants_1.RARE_FIRES.find(f => f.type === fireType);
        if (!def)
            return false;
        const existing = database_1.default.prepare('SELECT id FROM rare_fires WHERE user_id = ? AND fire_type = ?')
            .get(userId, fireType);
        if (existing)
            return false;
        database_1.default.prepare('INSERT INTO rare_fires (user_id, fire_type, fire_name, tier) VALUES (?, ?, ?, ?)')
            .run(userId, fireType, def.name, def.tier);
        return true;
    }
}
exports.rareFireService = new RareFireService();
