"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pvPSpectatorService = void 0;
// V13 C-03: PvP Spectator Mode
const database_1 = __importDefault(require("../database/database"));
class PvPSpectatorService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS arena_match_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id TEXT NOT NULL,
        player1_name TEXT NOT NULL,
        player2_id TEXT NOT NULL,
        player2_name TEXT NOT NULL,
        result_json TEXT NOT NULL,
        winner_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        spectator_count INTEGER DEFAULT 0
      );
    `);
    }
    recordMatch(player1Id, player1Name, player2Id, player2Name, result, winnerId) {
        this.initTable();
        const info = database_1.default.prepare(`
      INSERT INTO arena_match_history (player1_id, player1_name, player2_id, player2_name, result_json, winner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(player1Id, player1Name, player2Id, player2Name, JSON.stringify(result), winnerId);
        return info.lastInsertRowid;
    }
    getMatchHistory(userId, limit = 10) {
        this.initTable();
        return database_1.default.prepare(`
      SELECT * FROM arena_match_history
      WHERE player1_id = ? OR player2_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(userId, userId, limit);
    }
    getMatch(matchId) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM arena_match_history WHERE id = ?')
            .get(matchId) || null;
    }
    incrementSpectators(matchId) {
        this.initTable();
        database_1.default.prepare('UPDATE arena_match_history SET spectator_count = spectator_count + 1 WHERE id = ?')
            .run(matchId);
    }
    getTopEloPlayers(limit = 10) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT ap.user_id as userId, u.username, ap.elo,
        CASE
          WHEN ap.elo >= 1600 THEN 'gold'
          WHEN ap.elo >= 1300 THEN 'silver'
          WHEN ap.elo >= 1000 THEN 'bronze'
          ELSE 'iron'
        END as tier
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC LIMIT ?
    `).all(limit);
        return rows;
    }
    getMatchSummary(match) {
        const result = JSON.parse(match.result_json);
        const winnerName = match.winner_id === match.player1_id ? match.player1_name : match.player2_name;
        let msg = `⚔️ **${match.player1_name}** vs **${match.player2_name}**\n`;
        msg += `🏆 Người thắng: **${winnerName}**\n`;
        msg += `📊 Kết quả: Player HP ${result.playerEndingHp} | Enemy HP ${result.enemyEndingHp}\n`;
        msg += `⏱️ ${result.rounds} hiệp | Damage: ${result.totalDamageDealt.toLocaleString()}\n`;
        msg += `👁️ ${match.spectator_count} lượt xem`;
        return msg;
    }
}
exports.pvPSpectatorService = new PvPSpectatorService();
