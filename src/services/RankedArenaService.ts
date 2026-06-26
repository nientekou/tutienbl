import db from '../database/database';
import { RANK_TIERS, STREAK_BONUSES, DAILY_ARENA_LIMIT, K_FACTOR, STARTING_ELO } from '../config/arenaConstants';
import { cacheService } from './CacheService';

class RankedArenaService {
  private PROFILE_CACHE_TTL = 60_000;

  getProfile(userId: string): any {
    const cached = cacheService.get(`arena_profile:${userId}`);
    if (cached) return cached;

    let profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId) as any;
    if (!profile) {
      db.prepare(`
        INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak, daily_wins, daily_reset_at)
        VALUES (?, ?, 0, 0, 0, 0, 0)
      `).run(userId, STARTING_ELO);
      profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
    }

    // Daily reset (midnight VN)
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 3600000);
    const todayStr = vnNow.toISOString().split('T')[0];
    const todayTs = Math.floor(new Date(todayStr).getTime() / 1000);
    if ((profile.daily_reset_at || 0) < todayTs) {
      db.prepare('UPDATE arena_profiles SET daily_wins = 0, daily_reset_at = ? WHERE user_id = ?')
        .run(todayTs, userId);
      profile.daily_wins = 0;
      profile.daily_reset_at = todayTs;
    }

    cacheService.set(`arena_profile:${userId}`, profile, this.PROFILE_CACHE_TTL);
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

  getRankDisplay(elo: number): { tier: string; name: string; color: string } {
    const tier = this.getRankTier(elo);
    const def = RANK_TIERS[tier as keyof typeof RANK_TIERS];
    return { tier, name: def.name, color: def.color };
  }

  canFight(userId: string): { allowed: boolean; reason?: string } {
    const profile = this.getProfile(userId);
    if (!profile) return { allowed: false, reason: 'Chưa có hồ sơ đấu trường!' };
    if (profile.daily_wins >= DAILY_ARENA_LIMIT) {
      return { allowed: false, reason: `Đã hết ${DAILY_ARENA_LIMIT} lượt thắng hôm nay!` };
    }
    return { allowed: true };
  }

  recordWin(winnerId: string, loserId: string): void {
    const winnerProfile = this.getProfile(winnerId);
    const loserProfile = this.getProfile(loserId);

    db.prepare(`
      UPDATE arena_profiles SET
        season_wins = season_wins + 1,
        win_streak = win_streak + 1,
        highest_streak = MAX(highest_streak, win_streak + 1),
        daily_wins = daily_wins + 1
      WHERE user_id = ?
    `).run(winnerId);

    if (loserProfile) {
      db.prepare(`
        UPDATE arena_profiles SET
          season_losses = season_losses + 1,
          win_streak = 0
        WHERE user_id = ?
      `).run(loserId);
    }

    cacheService.invalidateExact(`arena_profile:${winnerId}`);
    cacheService.invalidateExact(`arena_profile:${loserId}`);
  }

  updateElo(winnerId: string, loserId: string): { winnerGain: number; loserLoss: number } {
    const winner = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(winnerId) as any;
    const loser = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(loserId) as any;
    if (!winner || !loser) return { winnerGain: 0, loserLoss: 0 };

    const expectedWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
    let winnerGain = Math.max(5, Math.round(K_FACTOR * (1 - expectedWinner)));
    let loserLoss = Math.min(-5, Math.round(K_FACTOR * (0 - (1 - expectedWinner))));

    // Streak multiplier: bonus ELO for win streaks
    const winnerProfile = this.getProfile(winnerId);
    if (winnerProfile) {
      const streakMult = this.getStreakMultiplier(winnerProfile.win_streak);
      if (streakMult > 1) {
        winnerGain = Math.round(winnerGain * streakMult);
      }
    }

    // Clamp: winner can't gain more than +50, loser can't lose more than -50
    winnerGain = Math.min(50, winnerGain);
    loserLoss = Math.max(-50, loserLoss);

    db.prepare('UPDATE arena_profiles SET elo = MAX(0, elo + ?) WHERE user_id = ?')
      .run(winnerGain, winnerId);
    db.prepare('UPDATE arena_profiles SET elo = MAX(0, elo + ?) WHERE user_id = ?')
      .run(loserLoss, loserId);

    cacheService.invalidateExact(`arena_profile:${winnerId}`);
    cacheService.invalidateExact(`arena_profile:${loserId}`);

    return { winnerGain, loserLoss: Math.abs(loserLoss) };
  }

  getLeaderboard(limit = 10): any[] {
    const cached = cacheService.get<any[]>('arena_leaderboard');
    if (cached) return cached;

    const results = db.prepare(`
      SELECT ap.*, u.name as ten_nhan_vat, u.realm_index
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC
      LIMIT ?
    `).all(limit);

    cacheService.set('arena_leaderboard', results, 120_000);
    return results;
  }

  getSeasonStats(userId: string): { wins: number; losses: number; streak: number; highestStreak: number; rank: string } {
    const profile = this.getProfile(userId);
    return {
      wins: profile.season_wins || 0,
      losses: profile.season_losses || 0,
      streak: profile.win_streak || 0,
      highestStreak: profile.highest_streak || 0,
      rank: this.getRankDisplay(profile.elo).name
    };
  }

  endSeason(): { totalRewarded: number; topPlayers: { userId: string; rank: number; tier: string; reward: string }[] } {
    const players = db.prepare(`
      SELECT * FROM arena_profiles WHERE season_wins > 0 OR season_losses > 0
      ORDER BY elo DESC
    `).all() as any[];

    const topPlayers: { userId: string; rank: number; tier: string; reward: string }[] = [];

    db.transaction(() => {
      players.forEach((p, idx) => {
        const rank = idx + 1;
        const tier = this.getRankTier(p.elo);
        const tierDef = RANK_TIERS[tier as keyof typeof RANK_TIERS];

        // Award currency
        if (tierDef.rewards.ngotinh > 0) {
          db.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
            .run(tierDef.rewards.ngotinh, p.user_id);
        }
        if (tierDef.rewards.coins > 0) {
          db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?')
            .run(tierDef.rewards.coins, p.user_id);
        }

        // Award title
        if ('title' in tierDef.rewards && tierDef.rewards.title) {
          db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
            .run(p.user_id, tierDef.rewards.title, 'arena_season', Math.floor(Date.now() / 1000));
        }

        // Soft reset ELO: (elo + 1000) / 2
        const resetElo = Math.max(STARTING_ELO, Math.floor((p.elo + STARTING_ELO) / 2));
        db.prepare(`
          UPDATE arena_profiles SET
            elo = ?, season_wins = 0, season_losses = 0,
            win_streak = 0, daily_wins = 0
          WHERE user_id = ?
        `).run(resetElo, p.user_id);

        if (rank <= 10) {
          topPlayers.push({ userId: p.user_id, rank, tier, reward: `${tierDef.rewards.ngotinh} NT, ${tierDef.rewards.coins} coins` });
        }
      });
    })();

    // Clear caches
    cacheService.invalidatePrefix('arena_profile:');
    cacheService.invalidateExact('arena_leaderboard');

    return { totalRewarded: players.length, topPlayers };
  }

  // === V12 C-03: PvP Season Visibility ===

  getSeasonRewardsPreview(): string {
    let msg = `🏆 **Phần Thưởng Mùa Giải**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const [tier, def] of Object.entries(RANK_TIERS)) {
      const rewards = def.rewards as any;
      msg += `**${def.name}** (${def.minElo}+ ELO):\n`;
      msg += `  🎁 ${rewards.ngotinh} Ngộ Tính, ${rewards.coins} LT`;
      if (rewards.title) msg += `, Danh hiệu "${rewards.title}"`;
      msg += `\n`;
    }

    msg += `\n⏰ Mùa giải kết thúc mỗi 2 tuần. Top 10 nhận thưởng bonus!`;
    return msg;
  }

  getPlayerRankInfo(userId: string): string {
    const profile = this.getProfile(userId);
    if (!profile) return '❌ Chưa có thông tin Arena.';

    const rank = this.getRankDisplay(profile.elo);
    const tier = this.getRankTier(profile.elo);
    const tierDef = RANK_TIERS[tier as keyof typeof RANK_TIERS];

    // Find position in leaderboard
    const allProfiles = db.prepare('SELECT user_id, elo FROM arena_profiles ORDER BY elo DESC').all() as any[];
    const position = allProfiles.findIndex(p => p.user_id === userId) + 1;

    let msg = `🏆 **Thông Tin Arena**\n`;
    msg += `📊 Rank: **${rank.name}**\n`;
    msg += `📈 ELO: **${profile.elo}**\n`;
    msg += `🏅 Thứ hạng: **#${position}** / ${allProfiles.length}\n`;
    msg += `⚔️ W/L: ${profile.season_wins || 0}/${profile.season_losses || 0}\n`;
    msg += `🔥 Streak: ${profile.win_streak || 0}\n\n`;

    if (tierDef) {
      const rewards = (tierDef as any).rewards;
      msg += `🎁 **Phần thưởng cuối mùa:** ${rewards.ngotinh} NT, ${rewards.coins} LT`;
      if (rewards.title) msg += `, "${rewards.title}"`;
      msg += `\n`;
    }

    // Next rank info
    const nextTier = this.getNextTier(tier);
    if (nextTier) {
      const nextDef = RANK_TIERS[nextTier as keyof typeof RANK_TIERS];
      const eloNeeded = nextDef.minElo - profile.elo;
      if (eloNeeded > 0) {
        msg += `\n📈 Cần **+${eloNeeded} ELO** để lên **${nextDef.name}**`;
      }
    }

    return msg;
  }

  private getNextTier(currentTier: string): string | null {
    const tiers = Object.keys(RANK_TIERS);
    const idx = tiers.indexOf(currentTier);
    return idx < tiers.length - 1 ? tiers[idx + 1] : null;
  }
}

export const rankedArenaService = new RankedArenaService();
