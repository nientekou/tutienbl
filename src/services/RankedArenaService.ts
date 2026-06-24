import db from '../database/database';
import { RANK_TIERS, STREAK_BONUSES, DAILY_ARENA_LIMIT, K_FACTOR, STARTING_ELO } from '../config/arenaConstants';

class RankedArenaService {
  getProfile(userId: string): any {
    let profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId) as any;
    if (!profile) {
      db.prepare(`INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak) VALUES (?, ?, 0, 0, 0)`)
        .run(userId, STARTING_ELO);
      profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
    }
    return profile;
  }

  getStreakMultiplier(streak: number): number {
    let mult = 1.0;
    for (const s of STREAK_BONUSES) {
      if (streak >= s.streak) mult = s.bonus;
    }
    return mult;
  }

  getRankTier(elo: number): string {
    if (elo >= RANK_TIERS.gold.minElo) return 'gold';
    if (elo >= RANK_TIERS.silver.minElo) return 'silver';
    if (elo >= RANK_TIERS.bronze.minElo) return 'bronze';
    return 'iron';
  }

  updateElo(winnerId: string, loserId: string): { winnerGain: number; loserLoss: number } {
    const winner = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(winnerId) as any;
    const loser = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(loserId) as any;
    if (!winner || !loser) return { winnerGain: 0, loserLoss: 0 };

    const expectedWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
    const winnerGain = Math.max(5, Math.round(K_FACTOR * (1 - expectedWinner)));
    const loserLoss = Math.min(-5, Math.round(K_FACTOR * (0 - (1 - expectedWinner))));

    db.prepare('UPDATE arena_profiles SET elo = elo + ?, wins = wins + 1, win_streak = win_streak + 1, highest_streak = MAX(highest_streak, win_streak + 1) WHERE user_id = ?')
      .run(winnerGain, winnerId);
    db.prepare('UPDATE arena_profiles SET elo = elo + ?, losses = losses + 1, win_streak = 0 WHERE user_id = ?')
      .run(loserLoss, loserId);

    return { winnerGain, loserLoss: Math.abs(loserLoss) };
  }

  canFight(userId: string): { allowed: boolean; reason?: string } {
    const profile = this.getProfile(userId);
    if (!profile) return { allowed: false, reason: 'Chưa có hồ sơ đấu trường!' };
    return { allowed: true };
  }

  getLeaderboard(limit = 10): any[] {
    return db.prepare(`
      SELECT ap.*, u.name as ten_nhan_vat
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC
      LIMIT ?
    `).all(limit);
  }
}

export const rankedArenaService = new RankedArenaService();
