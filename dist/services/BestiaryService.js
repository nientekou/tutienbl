"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bestiaryService = void 0;
// V13 E-02: Sách Yêu Khoa (Bestiary)
const database_1 = __importDefault(require("../database/database"));
class BestiaryService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS bestiary (
        user_id TEXT NOT NULL,
        enemy_id TEXT NOT NULL,
        enemy_name TEXT NOT NULL,
        zone TEXT DEFAULT '',
        element TEXT DEFAULT '',
        times_defeated INTEGER DEFAULT 0,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        PRIMARY KEY (user_id, enemy_id)
      );
    `);
    }
    recordKill(userId, enemyId, enemyName, zone, element) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO bestiary (user_id, enemy_id, enemy_name, zone, element, times_defeated, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, enemy_id) DO UPDATE SET
        times_defeated = times_defeated + 1,
        last_seen = excluded.last_seen
    `).run(userId, enemyId, enemyName, zone, element, now, now);
    }
    getEntries(userId, zone) {
        this.initTable();
        if (zone) {
            return database_1.default.prepare('SELECT * FROM bestiary WHERE user_id = ? AND zone = ? ORDER BY enemy_name')
                .all(userId, zone);
        }
        return database_1.default.prepare('SELECT * FROM bestiary WHERE user_id = ? ORDER BY zone, enemy_name')
            .all(userId);
    }
    getZoneProgress(userId, zone) {
        this.initTable();
        const defeated = database_1.default.prepare('SELECT COUNT(*) as c FROM bestiary WHERE user_id = ? AND zone = ? AND times_defeated > 0')
            .get(userId, zone);
        // Total enemies in zone — approximate from all players' bestiary
        const total = database_1.default.prepare('SELECT COUNT(DISTINCT enemy_id) as c FROM bestiary WHERE zone = ?')
            .get(zone);
        return {
            defeated: defeated.c,
            total: total.c || 1,
            completionRate: total.c > 0 ? defeated.c / total.c : 0,
        };
    }
    getCompletionReward(userId, zone) {
        const progress = this.getZoneProgress(userId, zone);
        const entries = this.getEntries(userId, zone);
        const allDefeated = entries.length > 0 && entries.every(e => e.times_defeated > 0);
        const allMastered = entries.length > 0 && entries.every(e => e.times_defeated >= 10);
        return { completed: allDefeated, masterCompleted: allMastered };
    }
    getDescription(userId) {
        const entries = this.getEntries(userId);
        if (entries.length === 0)
            return '📖 **Sách Yêu Khoa** — Chưa ghi nhận enemy nào.';
        // Group by zone
        const byZone = {};
        for (const e of entries) {
            const z = e.zone || 'Khác';
            if (!byZone[z])
                byZone[z] = [];
            byZone[z].push(e);
        }
        let msg = `📖 **Sách Yêu Khoa** — ${entries.length} enemy đã gặp\n\n`;
        for (const [zone, zoneEntries] of Object.entries(byZone)) {
            const defeated = zoneEntries.filter(e => e.times_defeated > 0).length;
            msg += `**${zone}**: ${defeated}/${zoneEntries.length} ✅\n`;
        }
        return msg;
    }
}
exports.bestiaryService = new BestiaryService();
