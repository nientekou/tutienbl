import db from '../database/database';

// B-05: Leaderboard System Deep

type LeaderboardCategory = 'level' | 'pvp' | 'tower' | 'dungeon' | 'crafting' | 'exploration' | 'guild' | 'achievement' | 'seasonal';

interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
  level?: number;
  sectContribution?: number;
}

class LeaderboardService {
  // === Compatibility methods for existing code ===

  clearCache(): void {
    // No-op for compatibility
  }

  getTopCombatPower(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.level,
        ROUND(u.base_hp * 0.2 + u.base_mp * 0.1 + u.base_atk * 3 + u.base_def * 5 +
              u.base_crit * 1000 + u.base_crit_res * 1000 + u.base_luck * 10 +
              u.base_speed * 10 + u.base_dodge * 1000) as score
      FROM users u ORDER BY score DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopRealm(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.level, u.level as score
      FROM users u ORDER BY u.level DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopWealth(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, (u.coin_ha_pham + u.coin_trung_pham * 100) as score
      FROM users u ORDER BY score DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopSectContribution(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.sect_contribution as sectContribution, u.sect_contribution as score
      FROM users u WHERE u.sect_id IS NOT NULL ORDER BY u.sect_contribution DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopArena(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.pvp_points as score
      FROM users u ORDER BY u.pvp_points DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopAlchemy(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.alchemy_level as score
      FROM users u ORDER BY u.alchemy_level DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  getTopForging(limit: number = 100): LeaderboardEntry[] {
    return db.prepare(`
      SELECT u.discord_id as userId, u.name, u.forging_level as score
      FROM users u ORDER BY u.forging_level DESC LIMIT ?
    `).all(limit).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  }

  // === B-05: Enhanced leaderboard methods ===

  getLeaderboard(category: LeaderboardCategory, limit: number = 10): { userId: string; name: string; score: number; rank: number }[] {
    let query = '';
    switch (category) {
      case 'level':
        query = 'SELECT discord_id as userId, name, level as score FROM users ORDER BY level DESC LIMIT ?';
        break;
      case 'pvp':
        query = 'SELECT discord_id as userId, name, pvp_points as score FROM users ORDER BY pvp_points DESC LIMIT ?';
        break;
      case 'tower':
        query = 'SELECT r.user_id as userId, u.name, r.max_floor as score FROM roguelike_progress r JOIN users u ON r.user_id = u.discord_id ORDER BY r.max_floor DESC LIMIT ?';
        break;
      case 'dungeon':
        query = 'SELECT n.user_id as userId, u.name, n.highest_floor as score FROM nine_heavens_progress n JOIN users u ON n.user_id = u.discord_id ORDER BY n.highest_floor DESC LIMIT ?';
        break;
      case 'achievement':
        query = 'SELECT ua.user_id as userId, u.name, COUNT(*) as score FROM user_achievements ua JOIN users u ON ua.user_id = u.discord_id WHERE ua.is_completed = 1 GROUP BY ua.user_id ORDER BY score DESC LIMIT ?';
        break;
      default:
        query = 'SELECT discord_id as userId, name, level as score FROM users ORDER BY level DESC LIMIT ?';
    }
    const rows = db.prepare(query).all(limit) as any[];
    return rows.map((r, i) => ({ userId: r.userId, name: r.name, score: r.score, rank: i + 1 }));
  }

  getLeaderboardCategories(): { id: string; name: string; description: string; icon: string }[] {
    return [
      { id: 'level', name: 'Cấp Độ', description: 'Người chơi có cấp độ cao nhất', icon: '📊' },
      { id: 'pvp', name: 'PvP', description: 'Xếp hạng điểm PvP', icon: '⚔️' },
      { id: 'tower', name: 'Tháp', description: 'Tầng tháp cao nhất đã đạt', icon: '🏯' },
      { id: 'dungeon', name: 'Phó Bản', description: 'Tầng phó bản cao nhất đã đạt', icon: '🏰' },
      { id: 'achievement', name: 'Thành Tựu', description: 'Hoàn thành nhiều thành tựu nhất', icon: '🏆' },
    ];
  }

  getUserRank(userId: string, category: string): { rank: number; score: number; total: number } {
    const leaderboard = this.getLeaderboard(category as LeaderboardCategory, 100);
    const userEntry = leaderboard.find(e => e.userId === userId);
    return userEntry ? { rank: userEntry.rank, score: userEntry.score, total: leaderboard.length } : { rank: 0, score: 0, total: 0 };
  }

  getLeaderboardDescription(category: LeaderboardCategory): string {
    const categories = this.getLeaderboardCategories();
    const cat = categories.find(c => c.id === category);
    const leaderboard = this.getLeaderboard(category);
    let msg = `${cat?.icon || '📊'} **${cat?.name || category} Leaderboard**\n`;
    if (leaderboard.length === 0) {
      msg += 'No entries yet.';
    } else {
      for (const entry of leaderboard) {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        msg += `${medal} **${entry.name}** — ${entry.score}\n`;
      }
    }
    return msg;
  }

  // === A-03: Leaderboard Enhancement ===

  /**
   * A-03: Get rank rewards
   */
  getRankRewards(category: string): { rank: string; rewards: string }[] {
    return [
      { rank: '1', rewards: '200 KNB + danh hiệu "Vô Địch" + tọa kỳ đặc biệt' },
      { rank: '2', rewards: '100 KNB + danh hiệu "Á Quân"' },
      { rank: '3', rewards: '50 KNB + danh hiệu "Khiêu Chiến"' },
      { rank: '4-10', rewards: '20 KNB + nguyên liệu hiếm' },
      { rank: '11-50', rewards: '10 KNB' },
    ];
  }

  /**
   * A-03: Get seasonal leaderboard
   */
  getSeasonalLeaderboard(seasonId: number, limit: number = 10): { userId: string; name: string; score: number; rank: number }[] {
    const rows = db.prepare(`
      SELECT us.user_id as userId, u.name, us.score
      FROM user_season_scores us
      JOIN users u ON us.user_id = u.discord_id
      WHERE us.season_id = ?
      ORDER BY us.score DESC
      LIMIT ?
    `).all(seasonId, limit) as any[];

    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /**
   * A-03: Get guild leaderboard
   */
  getGuildLeaderboard(limit: number = 10): { guildId: number; guildName: string; memberCount: number; totalLevel: number }[] {
    const rows = db.prepare(`
      SELECT s.id as guildId, s.name as guildName, COUNT(u.discord_id) as memberCount, COALESCE(SUM(u.level), 0) as totalLevel
      FROM sects s
      LEFT JOIN users u ON s.id = u.sect_id
      GROUP BY s.id
      ORDER BY totalLevel DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows;
  }

  /**
   * A-03: Get leaderboard with rewards description
   */
  getLeaderboardWithRewards(category: string): string {
    const leaderboard = this.getLeaderboard(category as LeaderboardCategory);
    const rewards = this.getRankRewards(category);

    let msg = `📊 **${category} Leaderboard**\n`;
    if (leaderboard.length === 0) {
      msg += 'No entries yet.\n';
    } else {
      for (const entry of leaderboard.slice(0, 10)) {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        msg += `${medal} **${entry.name}** — ${entry.score}\n`;
      }
    }

    msg += `\n**Rewards:**\n`;
    for (const r of rewards) {
      msg += `• ${r.rank}: ${r.rewards}\n`;
    }

    return msg;
  }
}

export const leaderboardService = new LeaderboardService();
