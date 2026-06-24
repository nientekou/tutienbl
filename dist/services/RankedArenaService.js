"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankedArenaService = void 0;
const database_1 = __importDefault(require("../database/database"));
const arenaConstants_1 = require("../config/arenaConstants");
const CacheService_1 = require("./CacheService");
class RankedArenaService {
    PROFILE_CACHE_TTL = 60_000;
    getProfile(userId) {
        const cached = CacheService_1.cacheService.get(`arena_profile:${userId}`);
        if (cached)
            return cached;
        let profile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
        if (!profile) {
            database_1.default.prepare(`
        INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak, daily_wins, daily_reset_at)
        VALUES (?, ?, 0, 0, 0, 0, 0)
      `).run(userId, arenaConstants_1.STARTING_ELO);
            profile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
        }
        // Daily reset (midnight VN)
        const now = new Date();
        const vnNow = new Date(now.getTime() + 7 * 3600000);
        const todayStr = vnNow.toISOString().split('T')[0];
        const todayTs = Math.floor(new Date(todayStr).getTime() / 1000);
        if ((profile.daily_reset_at || 0) < todayTs) {
            database_1.default.prepare('UPDATE arena_profiles SET daily_wins = 0, daily_reset_at = ? WHERE user_id = ?')
                .run(todayTs, userId);
            profile.daily_wins = 0;
            profile.daily_reset_at = todayTs;
        }
        CacheService_1.cacheService.set(`arena_profile:${userId}`, profile, this.PROFILE_CACHE_TTL);
        return profile;
    }
    getStreakMultiplier(streak) {
        let mult = 1.0;
        for (const s of arenaConstants_1.STREAK_BONUSES) {
            if (streak >= s.streak)
                mult = s.bonus;
        }
        return mult;
    }
    getRankTier(elo) {
        if (elo >= arenaConstants_1.RANK_TIERS.gold.minElo)
            return 'gold';
        if (elo >= arenaConstants_1.RANK_TIERS.silver.minElo)
            return 'silver';
        if (elo >= arenaConstants_1.RANK_TIERS.bronze.minElo)
            return 'bronze';
        return 'iron';
    }
    getRankDisplay(elo) {
        const tier = this.getRankTier(elo);
        const def = arenaConstants_1.RANK_TIERS[tier];
        return { tier, name: def.name, color: def.color };
    }
    canFight(userId) {
        const profile = this.getProfile(userId);
        if (!profile)
            return { allowed: false, reason: 'Chưa có hồ sơ đấu trường!' };
        if (profile.daily_wins >= arenaConstants_1.DAILY_ARENA_LIMIT) {
            return { allowed: false, reason: `Đã hết ${arenaConstants_1.DAILY_ARENA_LIMIT} lượt thắng hôm nay!` };
        }
        return { allowed: true };
    }
    recordWin(winnerId, loserId) {
        const winnerProfile = this.getProfile(winnerId);
        const loserProfile = this.getProfile(loserId);
        database_1.default.prepare(`
      UPDATE arena_profiles SET
        season_wins = season_wins + 1,
        win_streak = win_streak + 1,
        highest_streak = MAX(highest_streak, win_streak + 1),
        daily_wins = daily_wins + 1
      WHERE user_id = ?
    `).run(winnerId);
        if (loserProfile) {
            database_1.default.prepare(`
        UPDATE arena_profiles SET
          season_losses = season_losses + 1,
          win_streak = 0
        WHERE user_id = ?
      `).run(loserId);
        }
        CacheService_1.cacheService.invalidateExact(`arena_profile:${winnerId}`);
        CacheService_1.cacheService.invalidateExact(`arena_profile:${loserId}`);
    }
    updateElo(winnerId, loserId) {
        const winner = database_1.default.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(winnerId);
        const loser = database_1.default.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(loserId);
        if (!winner || !loser)
            return { winnerGain: 0, loserLoss: 0 };
        const expectedWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
        let winnerGain = Math.max(5, Math.round(arenaConstants_1.K_FACTOR * (1 - expectedWinner)));
        let loserLoss = Math.min(-5, Math.round(arenaConstants_1.K_FACTOR * (0 - (1 - expectedWinner))));
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
        database_1.default.prepare('UPDATE arena_profiles SET elo = MAX(0, elo + ?) WHERE user_id = ?')
            .run(winnerGain, winnerId);
        database_1.default.prepare('UPDATE arena_profiles SET elo = MAX(0, elo + ?) WHERE user_id = ?')
            .run(loserLoss, loserId);
        CacheService_1.cacheService.invalidateExact(`arena_profile:${winnerId}`);
        CacheService_1.cacheService.invalidateExact(`arena_profile:${loserId}`);
        return { winnerGain, loserLoss: Math.abs(loserLoss) };
    }
    getLeaderboard(limit = 10) {
        const cached = CacheService_1.cacheService.get('arena_leaderboard');
        if (cached)
            return cached;
        const results = database_1.default.prepare(`
      SELECT ap.*, u.name as ten_nhan_vat, u.realm_index
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC
      LIMIT ?
    `).all(limit);
        CacheService_1.cacheService.set('arena_leaderboard', results, 120_000);
        return results;
    }
    getSeasonStats(userId) {
        const profile = this.getProfile(userId);
        return {
            wins: profile.season_wins || 0,
            losses: profile.season_losses || 0,
            streak: profile.win_streak || 0,
            highestStreak: profile.highest_streak || 0,
            rank: this.getRankDisplay(profile.elo).name
        };
    }
    endSeason() {
        const players = database_1.default.prepare(`
      SELECT * FROM arena_profiles WHERE season_wins > 0 OR season_losses > 0
      ORDER BY elo DESC
    `).all();
        const topPlayers = [];
        database_1.default.transaction(() => {
            players.forEach((p, idx) => {
                const rank = idx + 1;
                const tier = this.getRankTier(p.elo);
                const tierDef = arenaConstants_1.RANK_TIERS[tier];
                // Award currency
                if (tierDef.rewards.ngotinh > 0) {
                    database_1.default.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
                        .run(tierDef.rewards.ngotinh, p.user_id);
                }
                if (tierDef.rewards.coins > 0) {
                    database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?')
                        .run(tierDef.rewards.coins, p.user_id);
                }
                // Award title
                if ('title' in tierDef.rewards && tierDef.rewards.title) {
                    database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
                        .run(p.user_id, tierDef.rewards.title, 'arena_season', Math.floor(Date.now() / 1000));
                }
                // Soft reset ELO: (elo + 1000) / 2
                const resetElo = Math.max(arenaConstants_1.STARTING_ELO, Math.floor((p.elo + arenaConstants_1.STARTING_ELO) / 2));
                database_1.default.prepare(`
          UPDATE arena_profiles SET
            elo = ?, season_wins = 0, season_losses = 0,
            win_streak = 0, daily_wins = 0
          WHERE user_id = ?
        `).run(resetElo, p.user_id);
                if (rank <= 10) {
                    topPlayers.push({ userId: p.user_id, rank, tier, reward: `${tierDef.rewards.ngotinh} Ngt, ${tierDef.rewards.coins} coins` });
                }
            });
        })();
        // Clear caches
        CacheService_1.cacheService.invalidatePrefix('arena_profile:');
        CacheService_1.cacheService.invalidateExact('arena_leaderboard');
        return { totalRewarded: players.length, topPlayers };
    }
}
exports.rankedArenaService = new RankedArenaService();
