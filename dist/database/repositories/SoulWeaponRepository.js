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
        const result = database_1.default.prepare(`
      INSERT INTO soul_weapons (user_id, name, type, level, exp, created_at)
      VALUES (?, ?, ?, 1, 0, ?)
    `).run(userId, name, type, now);
        return result.lastInsertRowid;
    }
    updateLevelExp(id, level, exp) {
        database_1.default.prepare('UPDATE soul_weapons SET level = ?, exp = ? WHERE id = ?').run(level, exp, id);
    }
}
exports.soulWeaponRepository = new SoulWeaponRepository();
