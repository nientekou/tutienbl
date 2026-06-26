"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pvpService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const constants_1 = require("../utils/constants");
const AchievementService_1 = require("./AchievementService");
class PvPService {
    /**
     * Lấy thông tin mùa giải hiện tại
     */
    getCurrentSeason() {
        let season = database_1.default.prepare("SELECT * FROM pvp_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        if (!season) {
            // Tạo mùa giải mới
            const now = Math.floor(Date.now() / 1000);
            const lastSeason = database_1.default.prepare("SELECT season_number FROM pvp_seasons ORDER BY season_number DESC LIMIT 1").get();
            const seasonNumber = (lastSeason?.season_number || 0) + 1;
            database_1.default.prepare(`
        INSERT INTO pvp_seasons (season_number, started_at, status)
        VALUES (?, ?, 'active')
      `).run(seasonNumber, now);
            season = database_1.default.prepare("SELECT * FROM pvp_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        }
        return season;
    }
    /**
     * Lấy bảng xếp hạng top N
     */
    getLeaderboard(limit = 10) {
        const users = database_1.default.prepare(`
      SELECT discord_id, name, level, pvp_points, pvp_wins, pvp_losses, title
      FROM users
      WHERE discord_id != 'market'
      ORDER BY pvp_points DESC
      LIMIT ?
    `).all(limit);
        return users.map((u, i) => {
            const totalGames = u.pvp_wins + u.pvp_losses;
            return {
                rank: i + 1,
                discord_id: u.discord_id,
                name: u.name,
                level: u.level,
                realm: (0, constants_1.getRealmDetails)(u.level).realmName,
                pvp_points: u.pvp_points,
                pvp_wins: u.pvp_wins,
                pvp_losses: u.pvp_losses,
                win_rate: totalGames > 0 ? Math.round((u.pvp_wins / totalGames) * 100) : 0,
                title: u.title
            };
        });
    }
    /**
     * Ghi nhận kết quả trận đấu PvP và xử lý Cướp Đoạt Linh Thạch
     * Trả về thông tin điểm số và linh thạch cướp được
     */
    recordMatch(winnerId, loserId) {
        const ELO_K = 32;
        const winner = UserRepository_1.userRepository.get(winnerId);
        const loser = UserRepository_1.userRepository.get(loserId);
        if (!winner || !loser)
            return { pvpGain: 0, pvpLoss: 0, coinsStolen: 0 };
        const wPoints = winner.pvp_points || 0;
        const lPoints = loser.pvp_points || 0;
        const expectedWinner = 1 / (1 + Math.pow(10, (lPoints - wPoints) / 400));
        const expectedLoser = 1 - expectedWinner;
        const winnerGain = Math.round(ELO_K * (1 - expectedWinner));
        const loserLoss = Math.round(ELO_K * (0 - expectedLoser));
        // Đảm bảo không mất quá nhiều điểm
        const finalLoserLoss = Math.max(loserLoss, -50);
        // Cướp Đoạt Linh Thạch (Phá Sản PvP) - Cướp 2% đến 5% Linh Thạch Hạ Phẩm của người thua
        let stealPercent = (Math.floor(Math.random() * 4) + 2) / 100; // 0.02 - 0.05
        let maxStolen = 5000;
        if (winner.alignment === 'demonic') {
            stealPercent += 0.10; // Ma Đạo cướp thêm 10%
            maxStolen = 15000; // Nâng hạn mức cướp tối đa cho Ma Đạo
        }
        let stolenCoins = Math.floor(loser.coin_ha_pham * stealPercent);
        if (stolenCoins > maxStolen)
            stolenCoins = maxStolen;
        // Đảm bảo không cướp được nếu người thua không có tiền
        if (stolenCoins < 0)
            stolenCoins = 0;
        UserRepository_1.userRepository.update(winnerId, {
            pvp_points: Math.max(0, (winner.pvp_points || 0) + winnerGain),
            pvp_wins: (winner.pvp_wins || 0) + 1,
            coin_ha_pham: winner.coin_ha_pham + stolenCoins
        });
        UserRepository_1.userRepository.update(loserId, {
            pvp_points: Math.max(0, (loser.pvp_points || 0) + finalLoserLoss),
            pvp_losses: (loser.pvp_losses || 0) + 1,
            coin_ha_pham: Math.max(0, loser.coin_ha_pham - stolenCoins)
        });
        // Kiểm tra thành tựu PvP
        const newWins = (winner.pvp_wins || 0) + 1;
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_1', newWins);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_2', newWins);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_3', newWins);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_4', newWins);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_5', newWins);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_6', (winner.pvp_points || 0) + winnerGain);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_7', (winner.pvp_points || 0) + winnerGain);
        AchievementService_1.achievementService.setProgress(winnerId, 'pvp_8', (winner.pvp_points || 0) + winnerGain);
        // V12 D-01: Season Pass EXP for PvP win
        try {
            const { eventCalendarService } = require('./EventCalendarService');
            eventCalendarService.addSeasonPassExp(winnerId, 8);
        }
        catch (_) { }
        // Cập nhật audit log
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO audit_logs (user_id, action, details, created_at)
      VALUES (?, 'pvp_match', ?, ?)
    `).run(winnerId, JSON.stringify({
            type: 'win',
            opponent: loserId,
            pointsGained: winnerGain,
            seasonPoints: (winner.pvp_points || 0) + winnerGain
        }), now);
        database_1.default.prepare(`
      INSERT INTO audit_logs (user_id, action, details, created_at)
      VALUES (?, 'pvp_match', ?, ?)
    `).run(loserId, JSON.stringify({
            type: 'loss',
            opponent: winnerId,
            pointsLost: Math.abs(finalLoserLoss),
            seasonPoints: Math.max(0, (loser.pvp_points || 0) + finalLoserLoss),
            coinsLost: stolenCoins
        }), now);
        return {
            pvpGain: winnerGain,
            pvpLoss: finalLoserLoss,
            coinsStolen: stolenCoins
        };
    }
    /**
     * Thông tin PvP cá nhân
     */
    getPlayerProfile(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return null;
        // Tính hạng
        const rankResult = database_1.default.prepare(`
      SELECT COUNT(*) + 1 as rank FROM users
      WHERE pvp_points > ? AND discord_id != 'market'
    `).get(user.pvp_points);
        const totalGames = user.pvp_wins + user.pvp_losses;
        return {
            points: user.pvp_points,
            wins: user.pvp_wins,
            losses: user.pvp_losses,
            winRate: totalGames > 0 ? Math.round((user.pvp_wins / totalGames) * 100) : 0,
            rank: rankResult.rank
        };
    }
}
exports.pvpService = new PvPService();
