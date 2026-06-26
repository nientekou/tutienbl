"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eliteHuntService = void 0;
// V13 C-04: Săn Lùng Tinh Anh (Elite Hunt Event)
const database_1 = __importDefault(require("../database/database"));
class EliteHuntService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS elite_hunt_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      );
    `);
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS elite_hunt_runs (
        event_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        kills INTEGER DEFAULT 0,
        damage INTEGER DEFAULT 0,
        PRIMARY KEY (event_id, user_id)
      );
    `);
    }
    isEventActive() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const row = database_1.default.prepare("SELECT 1 FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
            .get(now, now);
        return !!row;
    }
    startEvent() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare("INSERT INTO elite_hunt_events (start_time, end_time, status) VALUES (?, ?, 'active')")
            .run(now, now + 30 * 60); // 30 minutes
    }
    recordKill(userId, damage) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const event = database_1.default.prepare("SELECT id FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
            .get(now, now);
        if (!event)
            return;
        database_1.default.prepare(`
      INSERT INTO elite_hunt_runs (event_id, user_id, kills, damage) VALUES (?, ?, 1, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET kills = kills + 1, damage = damage + excluded.damage
    `).run(event.id, userId, damage);
    }
    getLeaderboard() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const event = database_1.default.prepare("SELECT id FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
            .get(now, now);
        if (!event)
            return [];
        const rows = database_1.default.prepare('SELECT user_id, kills, damage FROM elite_hunt_runs WHERE event_id = ? ORDER BY kills DESC, damage DESC LIMIT 10').all(event.id);
        return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, kills: r.kills, damage: r.damage }));
    }
    getRewards(rank) {
        if (rank === 1)
            return { ngotinh: 500, coins: 5000, title: 'Tinh Anh Sư Tử' };
        if (rank <= 3)
            return { ngotinh: 300, coins: 3000 };
        if (rank <= 10)
            return { ngotinh: 200, coins: 2000 };
        return { ngotinh: 50, coins: 500 };
    }
}
exports.eliteHuntService = new EliteHuntService();
