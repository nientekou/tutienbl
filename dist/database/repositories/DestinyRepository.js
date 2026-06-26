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
     * Thêm mệnh cách mới — trả về entity vừa tạo
     */
    addDestiny(userId, destinyId, rarity) {
        const now = Math.floor(Date.now() / 1000);
        const result = database_1.default.prepare(`
      INSERT INTO user_destinies (user_id, destiny_id, rarity, level, exp, is_equipped, slot, created_at)
      VALUES (?, ?, ?, 1, 0, 0, 0, ?)
    `).run(userId, destinyId, rarity, now);
        return this.get(result.lastInsertRowid);
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
    // === P1-08: Pity System ===
    getPity(userId) {
        let row = database_1.default.prepare('SELECT * FROM destiny_pity WHERE user_id = ?').get(userId);
        if (!row) {
            database_1.default.prepare('INSERT INTO destiny_pity (user_id, pull_count, last_pull_at) VALUES (?, 0, 0)').run(userId);
            row = database_1.default.prepare('SELECT * FROM destiny_pity WHERE user_id = ?').get(userId);
        }
        return row;
    }
    incrementPity(userId) {
        database_1.default.prepare('UPDATE destiny_pity SET pull_count = pull_count + 1, last_pull_at = ? WHERE user_id = ?')
            .run(Math.floor(Date.now() / 1000), userId);
    }
    resetPity(userId) {
        database_1.default.prepare('UPDATE destiny_pity SET pull_count = 0 WHERE user_id = ?').run(userId);
    }
    /**
     * Đếm số lượng mệnh cách theo rarity
     */
    countByRarity(userId, rarity) {
        const row = database_1.default.prepare('SELECT COUNT(*) as c FROM user_destinies WHERE user_id = ? AND rarity = ?').get(userId, rarity);
        return row.c;
    }
}
exports.DestinyRepository = DestinyRepository;
exports.destinyRepository = new DestinyRepository();
