import db from '../database/database';

// A-03: Monthly Season System

interface MonthlySeason {
  month: number;
  year: number;
  theme: string;
  element: string;
  dungeon: string;
  boss: string;
  rewards: string;
}

const SEASON_THEMES: { month: number; theme: string; element: string; dungeon: string; boss: string; rewards: string }[] = [
  { month: 1, theme: 'Mùa Băng Giá', element: 'Thuy', dungeon: 'Động Băng Sơn', boss: 'Huyền Băng Long', rewards: 'Tinh Thể Băng + Giáp Hàn Băng' },
  { month: 2, theme: 'Mùa Trăm Hoa', element: 'Moc', dungeon: 'Rừng Linh Khí', boss: 'Cổ Mộc Tinh', rewards: 'Linh Khí Tự Nhiên + Khiên Lá Thần' },
  { month: 3, theme: 'Mùa Phong Lôi', element: 'Loi', dungeon: 'Đỉnh Sấm Sét', boss: 'Lôi Thần', rewards: 'Lôi Thạch + Kiếm Sấm Sét' },
  { month: 4, theme: 'Mùa Đất Trỗi Dậy', element: 'Tho', dungeon: 'Hầm Mỏ Sâu', boss: 'Thổ Cự Nhân', rewards: 'Thổ Hạch + Giáp Đá' },
  { month: 5, theme: 'Mùa Lửa Thiêng', element: 'Hoa', dungeon: 'Lòng Núi Lửa', boss: 'Phượng Hoàng Lửa', rewards: 'Hỏa Ngọc + Kiếm Liệt Diễm' },
  { month: 6, theme: 'Mùa Gió Múa', element: 'Phong', dungeon: 'Thiên Không Thần Điện', boss: 'Phong Long', rewards: 'Lông Gió + Hài Cuồng Phong' },
  { month: 7, theme: 'Mùa Luyện Kim', element: 'Kim', dungeon: 'Pháo Đài Sắt', boss: 'Kim Thiết Nhân', rewards: 'Khoáng Thạch Kim + Khiên Thép' },
  { month: 8, theme: 'Mùa U Ám', element: 'Vo', dungeon: 'Vực Tối', boss: 'Hắc Ám Hoàng Đế', rewards: 'Tinh Hoa Bóng Tối + Đao Hư Vô' },
  { month: 9, theme: 'Mùa Thu Hoạch', element: 'Moc', dungeon: 'Trăng Mùa Màng', boss: 'Hồn Mùa Màng', rewards: 'Phúc Lành Thu Hoạch + Vương Miện Tự Nhiên' },
  { month: 10, theme: 'Mùa Trăng Máu', element: 'Hoa', dungeon: 'Huyết Thần Điện', boss: 'Quái Thú Trăng Máu', rewards: 'Huyết Ngọc + Huyết Đao' },
  { month: 11, theme: 'Mùa Băng Quay Về', element: 'Thuy', dungeon: 'Vương Tọa Băng Giá', boss: 'Băng Vương', rewards: 'Tinh Thể Băng + Vương Miện Băng' },
  { month: 12, theme: 'Mùa Tận Thế', element: 'Vo', dungeon: 'Thử Thách Cuối Cùng', boss: 'Tận Thế Ma Vương', rewards: 'Nguyên Liệu Toàn Bộ + Danh Hiệu Độc Quyền' },
];

class MonthlySeasonService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_seasons (
        month INTEGER,
        year INTEGER,
        theme TEXT NOT NULL,
        element TEXT NOT NULL,
        dungeon TEXT NOT NULL,
        boss TEXT NOT NULL,
        rewards TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        PRIMARY KEY(month, year)
      );

      CREATE TABLE IF NOT EXISTS user_season_progress (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, month, year)
      );
    `);
  }

  /**
   * A-03: Get current month's season
   */
  getCurrentSeason(): MonthlySeason {
    this.initTable();
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const month = vn.getUTCMonth() + 1;
    const year = vn.getUTCFullYear();

    // Get or create season
    let season = db.prepare('SELECT * FROM monthly_seasons WHERE month = ? AND year = ?').get(month, year) as any;
    if (!season) {
      const themeDef = SEASON_THEMES.find(t => t.month === month) || SEASON_THEMES[0];
      db.prepare(`
        INSERT INTO monthly_seasons (month, year, theme, element, dungeon, boss, rewards, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(month, year, themeDef.theme, themeDef.element, themeDef.dungeon, themeDef.boss, themeDef.rewards, Math.floor(Date.now() / 1000));
      season = db.prepare('SELECT * FROM monthly_seasons WHERE month = ? AND year = ?').get(month, year);
    }

    return season;
  }

  /**
   * A-03: Get season description for UI
   */
  getSeasonDescription(): string {
    const season = this.getCurrentSeason();
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const lastDay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 0));
    const daysLeft = Math.ceil((lastDay.getTime() - vn.getTime()) / 86400000);

    let msg = `📅 **Mùa Giải Hàng Tháng** — ${season.theme}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎯 **Chủ Đề:** ${season.theme}\n`;
    msg += `⚡ **Ngũ Hành:** ${season.element}\n`;
    msg += `🏯 **Phó Bản:** ${season.dungeon}\n`;
    msg += `👹 **Thủ Lĩnh:** ${season.boss}\n`;
    msg += `🎁 **Phần Thưởng:** ${season.rewards}\n`;
    msg += `⏰ Còn **${daysLeft}** ngày\n`;

    return msg;
  }

  /**
   * A-03: Update user season progress
   */
  updateProgress(userId: string, score: number): void {
    this.initTable();
    const season = this.getCurrentSeason();

    const existing = db.prepare('SELECT * FROM user_season_progress WHERE user_id = ? AND month = ? AND year = ?')
      .get(userId, season.month, season.year) as any;

    if (existing) {
      db.prepare('UPDATE user_season_progress SET score = score + ?, completed = completed + 1 WHERE user_id = ? AND month = ? AND year = ?')
        .run(score, userId, season.month, season.year);
    } else {
      db.prepare('INSERT INTO user_season_progress (user_id, month, year, score, completed) VALUES (?, ?, ?, ?, 1)')
        .run(userId, season.month, season.year, score);
    }
  }

  /**
   * A-03: Get season leaderboard
   */
  getSeasonLeaderboard(limit: number = 10): { userId: string; name: string; score: number; completed: number }[] {
    this.initTable();
    const season = this.getCurrentSeason();

    const rows = db.prepare(`
      SELECT usp.*, u.name FROM user_season_progress usp
      JOIN users u ON usp.user_id = u.discord_id
      WHERE usp.month = ? AND usp.year = ?
      ORDER BY usp.score DESC
      LIMIT ?
    `).all(season.month, season.year, limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      score: r.score,
      completed: r.completed
    }));
  }

  /**
   * A-03: Get days left in season
   */
  getDaysLeft(): number {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const lastDay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 0));
    return Math.ceil((lastDay.getTime() - vn.getTime()) / 86400000);
  }
}

export const monthlySeasonService = new MonthlySeasonService();
