"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dungeonRepository = exports.DungeonRepository = void 0;
const database_1 = __importDefault(require("../database"));
class DungeonRepository {
    /**
     * Lấy lượt đi phụ bản Bí Cảnh của người chơi. Tự động reset lượt nếu sang ngày mới.
     */
    getCooldown(userId, dungeonId) {
        const stmt = database_1.default.prepare('SELECT * FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?');
        const record = stmt.get(userId, dungeonId);
        const now = Math.floor(Date.now() / 1000);
        if (!record) {
            return {
                user_id: userId,
                dungeon_id: dungeonId,
                daily_entries: 0,
                last_entry_at: now
            };
        }
        // Kiểm tra và reset lượt đi nếu qua ngày mới
        const lastDate = new Date(record.last_entry_at * 1000).toDateString();
        const currentDate = new Date().toDateString();
        if (lastDate !== currentDate) {
            const resetStmt = database_1.default.prepare('UPDATE dungeon_cooldowns SET daily_entries = 0, last_entry_at = ? WHERE user_id = ? AND dungeon_id = ?');
            resetStmt.run(now, userId, dungeonId);
            record.daily_entries = 0;
            record.last_entry_at = now;
        }
        return record;
    }
    /**
     * Tăng số lượng lượt đi Bí cảnh của người chơi lên 1
     */
    incrementEntry(userId, dungeonId) {
        const now = Math.floor(Date.now() / 1000);
        const cooldown = this.getCooldown(userId, dungeonId);
        const stmt = database_1.default.prepare(`
      INSERT INTO dungeon_cooldowns (user_id, dungeon_id, daily_entries, last_entry_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, dungeon_id) DO UPDATE SET
        daily_entries = daily_entries + 1,
        last_entry_at = excluded.last_entry_at
    `);
        stmt.run(userId, dungeonId, cooldown.daily_entries + 1, now);
    }
}
exports.DungeonRepository = DungeonRepository;
exports.dungeonRepository = new DungeonRepository();
