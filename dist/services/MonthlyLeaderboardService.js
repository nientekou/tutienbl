"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthlyLeaderboardService = void 0;
// V13 B-04: Monthly Prestige Leaderboard
const database_1 = __importDefault(require("../database/database"));
const MONTHLY_REWARDS = [
    { rank: 1, title: 'Vô Địch Tháng', knb: 50 },
    { rank: 2, title: 'Bá Vương Tháng', knb: 30 },
    { rank: 3, title: 'Quán Quân Tháng', knb: 20 },
];
const CATEGORY_NAMES = {
    tuvi: 'Tu Vi',
    arena: 'Đấu Trường',
    tower: 'Thiên Cung',
    achievement: 'Thành Tựu',
};
class MonthlyLeaderboardService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS monthly_leaderboard (
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        month TEXT NOT NULL,
        PRIMARY KEY (user_id, category, month)
      );
    `);
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS monthly_leaderboard_archive (
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        month TEXT NOT NULL,
        rank INTEGER,
        PRIMARY KEY (user_id, category, month)
      );
    `);
    }
    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    recordValue(userId, category, value) {
        this.initTable();
        const month = this.getCurrentMonth();
        database_1.default.prepare(`
      INSERT INTO monthly_leaderboard (user_id, category, value, month)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, category, month) DO UPDATE SET value = MAX(value, excluded.value)
    `).run(userId, category, value, month);
    }
    getLeaderboard(category, limit = 10) {
        this.initTable();
        const month = this.getCurrentMonth();
        const rows = database_1.default.prepare(`
      SELECT ml.user_id, ml.value, u.username
      FROM monthly_leaderboard ml
      JOIN users u ON ml.user_id = u.discord_id
      WHERE ml.category = ? AND ml.month = ?
      ORDER BY ml.value DESC
      LIMIT ?
    `).all(category, month, limit);
        return rows.map((r, i) => ({ rank: i + 1, user_id: r.user_id, username: r.username, value: r.value }));
    }
    getPlayerRank(userId, category) {
        this.initTable();
        const month = this.getCurrentMonth();
        const row = database_1.default.prepare('SELECT value FROM monthly_leaderboard WHERE user_id = ? AND category = ? AND month = ?').get(userId, category, month);
        if (!row)
            return null;
        const rankRow = database_1.default.prepare('SELECT COUNT(*) as rank FROM monthly_leaderboard WHERE category = ? AND month = ? AND value > ?').get(category, month, row.value);
        const totalRow = database_1.default.prepare('SELECT COUNT(*) as total FROM monthly_leaderboard WHERE category = ? AND month = ?').get(category, month);
        return { rank: rankRow.rank + 1, value: row.value, total: totalRow.total };
    }
    monthlyReset() {
        this.initTable();
        const month = this.getCurrentMonth();
        // Archive current month
        const archived = database_1.default.prepare(`
      INSERT OR REPLACE INTO monthly_leaderboard_archive
      SELECT user_id, category, value, month,
        (SELECT COUNT(*) + 1 FROM monthly_leaderboard m2
         WHERE m2.category = monthly_leaderboard.category
         AND m2.month = monthly_leaderboard.month
         AND m2.value > monthly_leaderboard.value) as rank
      FROM monthly_leaderboard
      WHERE month = ?
    `).run(month);
        // Clear current month
        database_1.default.prepare('DELETE FROM monthly_leaderboard WHERE month = ?').run(month);
        return { archived: archived.changes };
    }
    getDescription(category) {
        const entries = this.getLeaderboard(category);
        const catName = CATEGORY_NAMES[category];
        if (entries.length === 0)
            return `📊 **${catName}** — Chưa có dữ liệu tháng này.`;
        let msg = `📊 **Bảng Vinh Danh Tháng — ${catName}**\n`;
        for (const e of entries) {
            const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
            msg += `${medal} **${e.username}**: ${e.value.toLocaleString()}\n`;
        }
        return msg;
    }
}
exports.monthlyLeaderboardService = new MonthlyLeaderboardService();
