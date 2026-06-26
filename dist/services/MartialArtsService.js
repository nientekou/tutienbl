"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.martialArtsService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const martialArtsConstants_1 = require("../config/martialArtsConstants");
class MartialArtsService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_martial_arts (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        art_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        mastery INTEGER DEFAULT 1,
        mastery_exp INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, art_id)
      );
    `);
    }
    /**
     * E-01: Learn a martial art
     */
    learnArt(userId, artId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        const art = martialArtsConstants_1.MARTIAL_ARTS.find(a => a.id === artId);
        if (!art)
            return { success: false, message: 'Martial art not found' };
        if (user.level < art.unlockLevel) {
            return { success: false, message: `Need level ${art.unlockLevel} (current: ${user.level})` };
        }
        const existing = database_1.default.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?')
            .get(userId, artId);
        if (existing)
            return { success: false, message: 'Already learned!' };
        database_1.default.prepare('INSERT INTO user_martial_arts (user_id, art_id, level, mastery, mastery_exp) VALUES (?, ?, 1, 1, 0)')
            .run(userId, artId);
        return { success: true, message: `Learned **${art.name}**!` };
    }
    /**
     * E-01: Get user's martial arts
     */
    getUserArts(userId) {
        this.initTable();
        const rows = database_1.default.prepare('SELECT * FROM user_martial_arts WHERE user_id = ?')
            .all(userId);
        return rows.map(r => {
            const def = martialArtsConstants_1.MARTIAL_ARTS.find(a => a.id === r.artId);
            return { ...r, def };
        }).filter(r => r.def);
    }
    /**
     * E-01: Get martial art bonuses for combat
     */
    getArtBonuses(userId) {
        const arts = this.getUserArts(userId);
        const statBonuses = {};
        const effects = [];
        for (const art of arts) {
            const masteryBonus = martialArtsConstants_1.MASTERY_LEVELS[art.mastery - 1]?.bonus || 0;
            const totalBonus = art.def.statBonus.value * (1 + masteryBonus);
            statBonuses[art.def.statBonus.stat] = (statBonuses[art.def.statBonus.stat] || 0) + totalBonus;
            effects.push({
                type: art.def.effect.type,
                value: art.def.effect.value * (1 + masteryBonus),
                duration: art.def.effect.duration
            });
        }
        return { statBonuses, effects };
    }
    /**
     * E-01: Get element advantage
     */
    getElementAdvantage(attackerElement, defenderElement) {
        const counter = martialArtsConstants_1.ELEMENT_COUNTERS[attackerElement];
        if (counter === defenderElement)
            return martialArtsConstants_1.ELEMENT_ADVANTAGE_BONUS;
        if (martialArtsConstants_1.ELEMENT_COUNTERS[defenderElement] === attackerElement)
            return -martialArtsConstants_1.ELEMENT_DISADVANTAGE_PENALTY;
        return 0;
    }
    /**
     * E-01: Fusion two martial arts
     */
    fuseArts(userId, art1Id, art2Id) {
        this.initTable();
        const fusion = martialArtsConstants_1.MARTIAL_ART_FUSIONS.find(f => (f.ingredient1 === art1Id && f.ingredient2 === art2Id) ||
            (f.ingredient1 === art2Id && f.ingredient2 === art1Id));
        if (!fusion)
            return { success: false, message: 'These arts cannot be fused!' };
        // Check if user has both arts
        const art1 = database_1.default.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?').get(userId, art1Id);
        const art2 = database_1.default.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?').get(userId, art2Id);
        if (!art1 || !art2)
            return { success: false, message: 'You need both martial arts to fuse!' };
        // Check success rate
        if (Math.random() > fusion.successRate) {
            return { success: false, message: `Fusion failed! Cong phap van con giu nguyen.` };
        }
        // Success: remove both, add result
        database_1.default.prepare('DELETE FROM user_martial_arts WHERE user_id = ? AND art_id = ?').run(userId, art1Id);
        database_1.default.prepare('DELETE FROM user_martial_arts WHERE user_id = ? AND art_id = ?').run(userId, art2Id);
        database_1.default.prepare('INSERT INTO user_martial_arts (user_id, art_id, level, mastery, mastery_exp) VALUES (?, ?, 1, 1, 0)')
            .run(userId, fusion.result);
        const newArt = martialArtsConstants_1.MARTIAL_ARTS.find(a => a.id === fusion.result);
        return { success: true, message: `Fusion successful! Learned **${newArt?.name || fusion.result}**!`, newArt: newArt || undefined };
    }
    /**
     * E-01: Get martial arts description for UI
     */
    getMartialArtsDescription(userId) {
        const arts = this.getUserArts(userId);
        let msg = `🧘 **Công Pháp**\n`;
        msg += `📊 Đã học: **${arts.length}**/${martialArtsConstants_1.MARTIAL_ARTS.length}\n\n`;
        if (arts.length > 0) {
            msg += `**Võ Công của bạn:**\n`;
            for (const art of arts) {
                const elementEmoji = { 'Hoa': '🔥', 'Thuy': '💧', 'Moc': '🌿', 'Kim': '⚔️', 'Tho': '🪨', 'Loi': '⚡', 'Phong': '🌀' };
                msg += `${elementEmoji[art.def.element] || '❓'} **${art.def.name}** (Tier ${art.def.tier}) — Mastery ${art.mastery}/10\n`;
                msg += `   ${art.def.description}\n`;
                msg += `   Bonus: +${Math.round(art.def.statBonus.value * 100)}% ${art.def.statBonus.stat}\n`;
                msg += `   Effect: ${art.def.effect.type} (+${Math.round(art.def.effect.value * 100)}%, ${art.def.effect.duration} lượt)\n\n`;
            }
        }
        return msg;
    }
}
exports.martialArtsService = new MartialArtsService();
