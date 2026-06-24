"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankedArenaService = void 0;
const database_1 = __importDefault(require("../database/database"));
const arenaConstants_1 = require("../config/arenaConstants");
class RankedArenaService {
    getProfile(userId) {
        let profile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
        if (!profile) {
            database_1.default.prepare(`INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak) VALUES (?, ?, 0, 0, 0)`)
                .run(userId, arenaConstants_1.STARTING_ELO);
            profile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
        }
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
    updateElo(winnerId, loserId) {
        const winner = database_1.default.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(winnerId);
        const loser = database_1.default.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(loserId);
        if (!winner || !loser)
            return { winnerGain: 0, loserLoss: 0 };
        const expectedWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
        const winnerGain = Math.max(5, Math.round(arenaConstants_1.K_FACTOR * (1 - expectedWinner)));
        const loserLoss = Math.min(-5, Math.round(arenaConstants_1.K_FACTOR * (0 - (1 - expectedWinner))));
        database_1.default.prepare('UPDATE arena_profiles SET elo = elo + ?, wins = wins + 1, win_streak = win_streak + 1, highest_streak = MAX(highest_streak, win_streak + 1) WHERE user_id = ?')
            .run(winnerGain, winnerId);
        database_1.default.prepare('UPDATE arena_profiles SET elo = elo + ?, losses = losses + 1, win_streak = 0 WHERE user_id = ?')
            .run(loserLoss, loserId);
        return { winnerGain, loserLoss: Math.abs(loserLoss) };
    }
    canFight(userId) {
        const profile = this.getProfile(userId);
        if (!profile)
            return { allowed: false, reason: 'Chưa có hồ sơ đấu trường!' };
        return { allowed: true };
    }
    getLeaderboard(limit = 10) {
        return database_1.default.prepare(`
      SELECT ap.*, u.name as ten_nhan_vat
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC
      LIMIT ?
    `).all(limit);
    }
}
exports.rankedArenaService = new RankedArenaService();
