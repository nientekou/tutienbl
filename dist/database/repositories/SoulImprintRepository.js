"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.soulImprintRepository = void 0;
const database_1 = __importDefault(require("../database"));
class SoulImprintRepository {
    getUserImprints(userId) {
        return database_1.default.prepare('SELECT * FROM soul_imprints WHERE user_id = ?').all(userId);
    }
    getImprint(id) {
        return database_1.default.prepare('SELECT * FROM soul_imprints WHERE id = ?').get(id);
    }
    getImprintByItemId(userId, itemId) {
        return database_1.default.prepare('SELECT * FROM soul_imprints WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    }
    create(userId, itemId, itemName, itemSlot, itemRarity, imprintStats, setGroup, setSlot) {
        const now = Math.floor(Date.now() / 1000);
        const result = database_1.default.prepare(`
      INSERT INTO soul_imprints (user_id, item_id, item_name, item_slot, item_rarity, imprint_stats, set_group, set_slot, is_bound, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(userId, itemId, itemName, itemSlot, itemRarity, imprintStats, setGroup, setSlot, now);
        return result.lastInsertRowid;
    }
    delete(id) {
        database_1.default.prepare('DELETE FROM soul_imprints WHERE id = ?').run(id);
    }
    updateOwner(id, newUserId) {
        database_1.default.prepare('UPDATE soul_imprints SET user_id = ?, is_bound = 1 WHERE id = ?').run(newUserId, id);
    }
}
exports.soulImprintRepository = new SoulImprintRepository();
