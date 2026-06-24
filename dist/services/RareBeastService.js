"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rareBeastService = void 0;
const database_1 = __importDefault(require("../database/database"));
const rareBeastConstants_1 = require("../config/rareBeastConstants");
const CacheService_1 = require("./CacheService");
class RareBeastService {
    attemptTame(userId, beastType, luckBonus) {
        const def = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beastType);
        if (!def)
            return { success: false };
        const existing = database_1.default.prepare('SELECT id FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (existing)
            return { success: false };
        const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
        if (Math.random() > rate)
            return { success: false };
        const info = database_1.default.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, level, skills)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, beastType, def.name, def.rarity, JSON.stringify([def.passiveSkill]));
        return { success: true, beast: { id: info.lastInsertRowid, ...def } };
    }
    equip(userId, beastType) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast)
            return false;
        database_1.default.prepare('UPDATE rare_beasts SET equipped = 0 WHERE user_id = ?').run(userId);
        database_1.default.prepare('UPDATE rare_beasts SET equipped = 1 WHERE id = ?').run(beast.id);
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
        return true;
    }
    getEquippedBonuses(userId) {
        const cached = CacheService_1.cacheService.get(`rarebeast:${userId}`);
        if (cached)
            return cached;
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId);
        if (!beast) {
            const empty = { atk: 0, def: 0, hp: 0, passive: '', passiveValue: 0 };
            CacheService_1.cacheService.set(`rarebeast:${userId}`, empty, 30_000);
            return empty;
        }
        const def = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beast.beast_type);
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
        CacheService_1.cacheService.set(`rarebeast:${userId}`, result, 30_000);
        return result;
    }
    evolve(userId, beastType) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast || (beast.stars || 1) >= 5)
            return { success: false, newStars: beast?.stars ?? 0 };
        const newStars = (beast.stars || 1) + 1;
        database_1.default.prepare('UPDATE rare_beasts SET stars = ? WHERE id = ?').run(newStars, beast.id);
        CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
        return { success: true, newStars };
    }
    feedExp(userId, beastType, exp) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast)
            return { levelUp: false, newLevel: 0 };
        const newExp = (beast.exp || 0) + exp;
        const needed = beast.level * 100;
        if (newExp >= needed) {
            const newLevel = beast.level + 1;
            database_1.default.prepare('UPDATE rare_beasts SET level = ?, exp = ? WHERE id = ?')
                .run(newLevel, newExp - needed, beast.id);
            CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
            return { levelUp: true, newLevel };
        }
        database_1.default.prepare('UPDATE rare_beasts SET exp = ? WHERE id = ?').run(newExp, beast.id);
        return { levelUp: false, newLevel: beast.level };
    }
    getUserBeasts(userId) {
        return database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ?').all(userId);
    }
}
exports.rareBeastService = new RareBeastService();
