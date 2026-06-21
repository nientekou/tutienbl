"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coupleRepository = void 0;
const database_1 = __importDefault(require("../database"));
class CoupleRepository {
    getCoupleByUserId(userId) {
        return database_1.default.prepare('SELECT * FROM couples WHERE user1_id = ? OR user2_id = ?').get(userId, userId);
    }
    getCoupleById(id) {
        return database_1.default.prepare('SELECT * FROM couples WHERE id = ?').get(id);
    }
    createCouple(user1Id, user2Id) {
        const now = Math.floor(Date.now() / 1000);
        const result = database_1.default.prepare(`
      INSERT INTO couples (user1_id, user2_id, intimacy, marriage_date, last_dual_cultivation)
      VALUES (?, ?, 0, ?, 0)
    `).run(user1Id, user2Id, now);
        return result.lastInsertRowid;
    }
    deleteCouple(id) {
        database_1.default.prepare('DELETE FROM couples WHERE id = ?').run(id);
    }
    updateIntimacy(id, amount) {
        database_1.default.prepare('UPDATE couples SET intimacy = intimacy + ? WHERE id = ?').run(amount, id);
    }
    updateLastDualCultivation(id, timestamp) {
        database_1.default.prepare('UPDATE couples SET last_dual_cultivation = ? WHERE id = ?').run(timestamp, id);
    }
}
exports.coupleRepository = new CoupleRepository();
