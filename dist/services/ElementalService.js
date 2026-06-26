"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.elementalService = void 0;
const database_1 = __importDefault(require("../database/database"));
// Element counter relationships (circular)
const COUNTER_MAP = {
    'Hoa': 'Kim', 'Kim': 'Moc', 'Moc': 'Tho', 'Tho': 'Thuy', 'Thuy': 'Hoa',
    'Loi': 'Thuy', 'Phong': 'Loi',
};
const ELEMENT_NAMES = {
    'Hoa': 'Hoa', 'Thuy': 'Thuy', 'Moc': 'Moc', 'Kim': 'Kim',
    'Tho': 'Tho', 'Loi': 'Loi', 'Phong': 'Phong'
};
const ELEMENT_EMOJI = {
    'Hoa': '🔥', 'Thuy': '💧', 'Moc': '🌿', 'Kim': '⚔️',
    'Tho': '🪨', 'Loi': '⚡', 'Phong': '🌀'
};
class ElementalService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS elemental_mastery (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        element TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, element)
      );
    `);
    }
    /**
     * E-03: Get element advantage
     */
    getAdvantage(attacker, defender) {
        const counter = COUNTER_MAP[attacker];
        if (counter === defender) {
            return { damage: 0.25, description: `${ELEMENT_EMOJI[attacker]} > ${ELEMENT_EMOJI[defender]}: +25% damage` };
        }
        if (COUNTER_MAP[defender] === attacker) {
            return { damage: -0.25, description: `${ELEMENT_EMOJI[attacker]} < ${ELEMENT_EMOJI[defender]}: -25% damage` };
        }
        return { damage: 0, description: 'Không có ưu thế nguyên tố' };
    }
    /**
     * E-03: Get elemental mastery
     */
    getMastery(userId, element) {
        this.initTable();
        let row = database_1.default.prepare('SELECT * FROM elemental_mastery WHERE user_id = ? AND element = ?')
            .get(userId, element);
        if (!row) {
            database_1.default.prepare('INSERT INTO elemental_mastery (user_id, element, level, exp) VALUES (?, ?, 1, 0)')
                .run(userId, element);
            row = database_1.default.prepare('SELECT * FROM elemental_mastery WHERE user_id = ? AND element = ?')
                .get(userId, element);
        }
        return row;
    }
    /**
     * E-03: Add elemental mastery EXP
     */
    addMasteryExp(userId, element, exp) {
        this.initTable();
        const mastery = this.getMastery(userId, element);
        const newExp = mastery.exp + exp;
        const needed = mastery.level * 100;
        if (newExp >= needed && mastery.level < 10) {
            const newLevel = mastery.level + 1;
            database_1.default.prepare('UPDATE elemental_mastery SET level = ?, exp = ? WHERE user_id = ? AND element = ?')
                .run(newLevel, newExp - needed, userId, element);
            return { levelUp: true, newLevel };
        }
        database_1.default.prepare('UPDATE elemental_mastery SET exp = ? WHERE user_id = ? AND element = ?')
            .run(Math.min(newExp, needed), userId, element);
        return { levelUp: false, newLevel: mastery.level };
    }
    /**
     * E-03: Get mastery bonus
     */
    getMasteryBonus(userId, element) {
        const mastery = this.getMastery(userId, element);
        return mastery.level * 0.02; // +2% per level
    }
    /**
     * E-03: Get all elemental masteries
     */
    getAllMasteries(userId) {
        const elements = ['Hoa', 'Thuy', 'Moc', 'Kim', 'Tho', 'Loi', 'Phong'];
        return elements.map(el => {
            const mastery = this.getMastery(userId, el);
            return { element: el, level: mastery.level, exp: mastery.exp, bonus: this.getMasteryBonus(userId, el) };
        });
    }
    /**
     * E-03: Get elemental description for UI
     */
    getElementalDescription(userId) {
        const masteries = this.getAllMasteries(userId);
        let msg = `🌀 **Tinh Thông Nguyên Tố**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const m of masteries) {
            const emoji = ELEMENT_EMOJI[m.element];
            const bonus = Math.round(m.bonus * 100);
            msg += `${emoji} **${m.element}**: Cấp ${m.level}/10 (+${bonus}% sát thương)\n`;
        }
        msg += `\n**Element Counters:**\n`;
        msg += `🔥 > ⚔️ > 🌿 > 🪨 > 💧 > 🔥\n`;
        msg += `⚡ > 💧, 🌀 > ⚡\n`;
        return msg;
    }
}
exports.elementalService = new ElementalService();
