// V13 C-03: PvP Spectator Mode
import db from '../database/database';
import { CombatResult } from './CombatEngine';

interface SpectatorMatch {
  id: number;
  player1_id: string;
  player1_name: string;
  player2_id: string;
  player2_name: string;
  result_json: string;
  winner_id: string;
  created_at: number;
  spectator_count: number;
}

class PvPSpectatorService {
  private initTable(): void {
    db.exec(`
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

  public recordMatch(
    player1Id: string, player1Name: string,
    player2Id: string, player2Name: string,
    result: CombatResult, winnerId: string
  ): number {
    this.initTable();
    const info = db.prepare(`
      INSERT INTO arena_match_history (player1_id, player1_name, player2_id, player2_name, result_json, winner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(player1Id, player1Name, player2Id, player2Name, JSON.stringify(result), winnerId);
    return info.lastInsertRowid as number;
  }

  public getMatchHistory(userId: string, limit: number = 10): SpectatorMatch[] {
    this.initTable();
    return db.prepare(`
      SELECT * FROM arena_match_history
      WHERE player1_id = ? OR player2_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(userId, userId, limit) as SpectatorMatch[];
  }

  public getMatch(matchId: number): SpectatorMatch | null {
    this.initTable();
    return db.prepare('SELECT * FROM arena_match_history WHERE id = ?')
      .get(matchId) as SpectatorMatch || null;
  }

  public incrementSpectators(matchId: number): void {
    this.initTable();
    db.prepare('UPDATE arena_match_history SET spectator_count = spectator_count + 1 WHERE id = ?')
      .run(matchId);
  }

  public getTopEloPlayers(limit: number = 10): { userId: string; username: string; elo: number; tier: string }[] {
    this.initTable();
    const rows = db.prepare(`
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
    `).all(limit) as { userId: string; username: string; elo: number; tier: string }[];
    return rows;
  }

  public getMatchSummary(match: SpectatorMatch): string {
    const result: CombatResult = JSON.parse(match.result_json);
    const winnerName = match.winner_id === match.player1_id ? match.player1_name : match.player2_name;

    let msg = `⚔️ **${match.player1_name}** vs **${match.player2_name}**\n`;
    msg += `🏆 Người thắng: **${winnerName}**\n`;
    msg += `📊 Kết quả: Player HP ${result.playerEndingHp} | Enemy HP ${result.enemyEndingHp}\n`;
    msg += `⏱️ ${result.rounds} hiệp | Damage: ${result.totalDamageDealt.toLocaleString()}\n`;
    msg += `👁️ ${match.spectator_count} lượt xem`;

    return msg;
  }
}

export const pvPSpectatorService = new PvPSpectatorService();
