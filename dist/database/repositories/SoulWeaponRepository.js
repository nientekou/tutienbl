"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.soulWeaponRepository = void 0;
const database_1 = __importDefault(require("../database"));
class SoulWeaponRepository {
    getByUserId(userId) {
        return database_1.default.prepare('SELECT * FROM soul_weapons WHERE user_id = ?').get(userId);
    }
    create(userId, name, type) {
        const now = Math.floor(Date.now() / 1000);
        // P1-05: Random element on creation
        const elements = ['Hỏa', 'Thủy', 'Mộc', 'Kim', 'Thổ', 'Lôi', 'Phong', 'Vo'];
        const element = elements[Math.floor(Math.random() * elements.length)];
        const result = database_1.default.prepare(`
      INSERT INTO soul_weapons (user_id, name, type, level, exp, element, evolution_stage, skills_json, awakening_level, created_at)
      VALUES (?, ?, ?, 1, 0, ?, 1, '[]', 0, ?)
    `).run(userId, name, type, element, now);
        return result.lastInsertRowid;
    }
    updateLevelExp(id, level, exp) {
        database_1.default.prepare('UPDATE soul_weapons SET level = ?, exp = ? WHERE id = ?').run(level, exp, id);
    }
    // P1-05: Update evolution stage
    updateEvolution(id, stage) {
        database_1.default.prepare('UPDATE soul_weapons SET evolution_stage = ? WHERE id = ?').run(stage, id);
    }
    // P1-05: Update awakening level
    updateAwakening(id, level) {
        database_1.default.prepare('UPDATE soul_weapons SET awakening_level = ?, level = 1, evolution_stage = 1 WHERE id = ?').run(level, id);
    }
    // P1-05: Update skills
    updateSkills(id, skillsJson) {
        database_1.default.prepare('UPDATE soul_weapons SET skills_json = ? WHERE id = ?').run(skillsJson, id);
    }
}
exports.soulWeaponRepository = new SoulWeaponRepository();
