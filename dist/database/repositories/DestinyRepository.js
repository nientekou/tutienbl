"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.destinyRepository = exports.DestinyRepository = void 0;
const database_1 = __importDefault(require("../database"));
class DestinyRepository {
    /**
     * Lấy toàn bộ mệnh cách của người dùng
     */
    getUserDestinies(userId) {
        return database_1.default.prepare('SELECT * FROM user_destinies WHERE user_id = ? ORDER BY is_equipped DESC, level DESC').all(userId);
    }
    /**
     * Lấy một mệnh cách bằng ID
     */
    get(id) {
        return database_1.default.prepare('SELECT * FROM user_destinies WHERE id = ?').get(id) || null;
    }
    /**
     * Thêm mệnh cách mới
     */
    addDestiny(userId, destinyId, rarity) {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO user_destinies (user_id, destiny_id, rarity, level, exp, is_equipped, slot, created_at)
      VALUES (?, ?, ?, 1, 0, 0, 0, ?)
    `).run(userId, destinyId, rarity, now);
    }
    /**
     * Xóa mệnh cách (khi bị hiến tế)
     */
    deleteDestiny(id) {
        database_1.default.prepare('DELETE FROM user_destinies WHERE id = ?').run(id);
    }
    /**
     * Cập nhật thông tin mệnh cách
     */
    update(id, data) {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        if (fields.length === 0)
            return;
        database_1.default.prepare(`UPDATE user_destinies SET ${fields} WHERE id = ?`).run(...values, id);
    }
    /**
     * Tháo mệnh cách ở một slot cụ thể của user
     */
    unequipSlot(userId, slot) {
        database_1.default.prepare('UPDATE user_destinies SET is_equipped = 0, slot = 0 WHERE user_id = ? AND slot = ?').run(userId, slot);
    }
}
exports.DestinyRepository = DestinyRepository;
exports.destinyRepository = new DestinyRepository();
