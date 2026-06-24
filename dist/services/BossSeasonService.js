"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossSeasonService = exports.BossSeasonService = void 0;
const database_1 = __importDefault(require("../database/database"));
const SEASON_DURATION_DAYS = 30;
class BossSeasonService {
    /**
     * Lấy season hiện tại (đang active)
     */
    getCurrentSeason() {
        try {
            const season = database_1.default.prepare(`
        SELECT id, season_number, started_at, total_kills, top_damage_user, top_damage_amount
        FROM boss_seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1
      `).get();
            if (!season)
                return null;
            const now = Math.floor(Date.now() / 1000);
            const seasonEnd = season.started_at + SEASON_DURATION_DAYS * 86400;
            const daysLeft = Math.max(0, Math.ceil((seasonEnd - now) / 86400));
            return {
                id: season.id,
                season_number: season.season_number,
                started_at: season.started_at,
                days_left: daysLeft,
                total_kills: season.total_kills,
                top_player: season.top_damage_user,
                top_damage: season.top_damage_amount
            };
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Kiểm tra và tạo season mới nếu cần
     */
    checkAndRotateSeason() {
        try {
            const current = this.getCurrentSeason();
            if (!current) {
                this.startNewSeason();
                return true;
            }
            const now = Math.floor(Date.now() / 1000);
            const seasonEnd = current.started_at + SEASON_DURATION_DAYS * 86400;
            if (now >= seasonEnd) {
                this.endSeason(current.id);
                this.startNewSeason();
                return true;
            }
            return false;
        }
        catch (e) {
            console.error('[BossSeason] Error checking rotation:', e);
            return false;
        }
    }
    /**
     * Tăng kill count cho season hiện tại
     */
    incrementSeasonKills() {
        try {
            database_1.default.prepare(`
        UPDATE boss_seasons SET total_kills = total_kills + 1 WHERE ended_at IS NULL
      `).run();
        }
        catch (e) { }
    }
    /**
     * Cập nhật top damage cho season
     */
    updateSeasonTop(userId, damage) {
        try {
            const season = database_1.default.prepare('SELECT id, top_damage_amount FROM boss_seasons WHERE ended_at IS NULL LIMIT 1').get();
            if (season && damage > (season.top_damage_amount || 0)) {
                database_1.default.prepare('UPDATE boss_seasons SET top_damage_user = ?, top_damage_amount = ? WHERE id = ?')
                    .run(userId, damage, season.id);
            }
        }
        catch (e) { }
    }
    startNewSeason() {
        const seasonCount = database_1.default.prepare('SELECT COUNT(*) as cnt FROM boss_seasons').get().cnt || 0;
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO boss_seasons (season_number, started_at) VALUES (?, ?)')
            .run(seasonCount + 1, now);
    }
    endSeason(seasonId) {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('UPDATE boss_seasons SET ended_at = ? WHERE id = ?').run(now, seasonId);
    }
    /**
     * Lấy BXH season (tổng damage từ boss_kill_log)
     */
    getSeasonLeaderboard(seasonId) {
        return database_1.default.prepare(`
      SELECT user_id, SUM(damage) as total_damage, COUNT(*) as kill_count
      FROM world_boss_contributions
      WHERE season_id = ?
      GROUP BY user_id
      ORDER BY total_damage DESC
      LIMIT 10
    `).all(seasonId);
    }
}
exports.BossSeasonService = BossSeasonService;
exports.bossSeasonService = new BossSeasonService();
