import db from '../database/database';

const SEASON_DURATION_DAYS = 30;

export class BossSeasonService {
  /**
   * Lấy season hiện tại (đang active)
   */
  getCurrentSeason(): { id: number; season_number: number; started_at: number; days_left: number; total_kills: number; top_player: string | null; top_damage: number } | null {
    try {
      const season = db.prepare(`
        SELECT id, season_number, started_at, total_kills, top_damage_user, top_damage_amount
        FROM boss_seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1
      `).get() as any;
      if (!season) return null;

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
    } catch (e) {
      return null;
    }
  }

  /**
   * Kiểm tra và tạo season mới nếu cần
   */
  checkAndRotateSeason(): boolean {
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
    } catch (e) {
      console.error('[BossSeason] Error checking rotation:', e);
      return false;
    }
  }

  /**
   * Tăng kill count cho season hiện tại
   */
  incrementSeasonKills(): void {
    try {
      db.prepare(`
        UPDATE boss_seasons SET total_kills = total_kills + 1 WHERE ended_at IS NULL
      `).run();
    } catch (e) {}
  }

  /**
   * Cập nhật top damage cho season
   */
  updateSeasonTop(userId: string, damage: number): void {
    try {
      const season = db.prepare('SELECT id, top_damage_amount FROM boss_seasons WHERE ended_at IS NULL LIMIT 1').get() as any;
      if (season && damage > (season.top_damage_amount || 0)) {
        db.prepare('UPDATE boss_seasons SET top_damage_user = ?, top_damage_amount = ? WHERE id = ?')
          .run(userId, damage, season.id);
      }
    } catch (e) {}
  }

  private startNewSeason(): void {
    const seasonCount = (db.prepare('SELECT COUNT(*) as cnt FROM boss_seasons').get() as any).cnt || 0;
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO boss_seasons (season_number, started_at) VALUES (?, ?)')
      .run(seasonCount + 1, now);
  }

  private endSeason(seasonId: number): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE boss_seasons SET ended_at = ? WHERE id = ?').run(now, seasonId);
  }

  /**
   * Lấy BXH season (tổng damage từ boss_kill_log)
   */
  getSeasonLeaderboard(seasonId: number): Array<{ user_id: string; total_damage: number; kill_count: number }> {
    return db.prepare(`
      SELECT user_id, SUM(damage) as total_damage, COUNT(*) as kill_count
      FROM world_boss_contributions
      WHERE season_id = ?
      GROUP BY user_id
      ORDER BY total_damage DESC
      LIMIT 10
    `).all(seasonId) as any[];
  }
}

export const bossSeasonService = new BossSeasonService();
