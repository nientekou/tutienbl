// V16 B-01: Abyss Dungeon (Häng Void)
import db from '../database/database';

class AbyssDungeonService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS abyss_progress (
        user_id TEXT NOT NULL,
        best_floor INTEGER DEFAULT 0,
        current_floor INTEGER DEFAULT 0,
        attempts_today INTEGER DEFAULT 0,
        attempts_date TEXT,
        PRIMARY KEY (user_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS abyss_leaderboard (
        user_id TEXT NOT NULL,
        best_floor INTEGER DEFAULT 0,
        month TEXT NOT NULL,
        PRIMARY KEY (user_id, month)
      );
    `);
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  public getProgress(userId: string): { bestFloor: number; currentFloor: number; attemptsLeft: number } {
    this.initTable();
    const today = this.getToday();
    let row = db.prepare('SELECT * FROM abyss_progress WHERE user_id = ?').get(userId) as any;
    if (!row) {
      db.prepare('INSERT INTO abyss_progress (user_id, best_floor, current_floor, attempts_today, attempts_date) VALUES (?, 0, 0, 0, ?)')
        .run(userId, today);
      row = db.prepare('SELECT * FROM abyss_progress WHERE user_id = ?').get(userId) as any;
    }
    if (row.attempts_date !== today) {
      db.prepare('UPDATE abyss_progress SET attempts_today = 0, attempts_date = ? WHERE user_id = ?')
        .run(today, userId);
      row.attempts_today = 0;
    }
    return {
      bestFloor: row.best_floor,
      currentFloor: row.current_floor,
      attemptsLeft: Math.max(0, 5 - row.attempts_today),
    };
  }

  public canEnter(userId: string, userLevel: number): { eligible: boolean; reason: string } {
    if (userLevel < 80) return { eligible: false, reason: 'Cần level 80+.' };
    const prog = this.getProgress(userId);
    if (prog.attemptsLeft <= 0) return { eligible: false, reason: 'Hết lượt hôm nay.' };
    return { eligible: true, reason: '' };
  }

  public getEnemyForFloor(floor: number): { hp: number; atk: number; def: number; name: string; element: string } {
    const baseHp = 10000;
    const baseAtk = 500;
    const baseDef = 300;
    const scale = 1 + (floor - 1) * 0.15;
    const isBoss = floor % 10 === 0;
    const bossMult = isBoss ? 3.0 : 1.0;
    const elements = ['Hỏa', 'Thủy', 'Mộc', 'Thổ', 'Kim', 'Lôi', 'Phong'];
    const element = elements[floor % elements.length];

    return {
      hp: Math.floor(baseHp * scale * bossMult),
      atk: Math.floor(baseAtk * scale * bossMult),
      def: Math.floor(baseDef * scale * bossMult),
      name: isBoss ? `Abyss Boss T${Math.ceil(floor / 10)}F${floor % 10 || 10}` : `Abyss Monster F${floor}`,
      element,
    };
  }

  public recordFloor(userId: string, floor: number, won: boolean): { pointsEarned: number; nextFloor: number; runEnd: boolean } {
    this.initTable();
    const today = this.getToday();

    if (!won) {
      db.prepare('UPDATE abyss_progress SET attempts_today = attempts_today + 1 WHERE user_id = ?').run(userId);
      const prog = this.getProgress(userId);
      return { pointsEarned: 0, nextFloor: prog.currentFloor, runEnd: true };
    }

    const nextFloor = floor + 1;
    const bestRow = db.prepare('SELECT best_floor FROM abyss_progress WHERE user_id = ?').get(userId) as { best_floor: number } | undefined;
    const bestFloor = Math.max(floor, bestRow?.best_floor || 0);

    db.prepare(`
      UPDATE abyss_progress SET current_floor = ?, best_floor = MAX(best_floor, ?), attempts_today = attempts_today + 1
      WHERE user_id = ?
    `).run(nextFloor, floor, userId);

    // Update leaderboard
    const month = this.getCurrentMonth();
    db.prepare(`
      INSERT INTO abyss_leaderboard (user_id, best_floor, month) VALUES (?, ?, ?)
      ON CONFLICT(user_id, month) DO UPDATE SET best_floor = MAX(best_floor, excluded.best_floor)
    `).run(userId, bestFloor, month);

    const points = floor * 10;
    return { pointsEarned: points, nextFloor, runEnd: false };
  }

  public getLeaderboard(limit: number = 10): { rank: number; userId: string; bestFloor: number }[] {
    this.initTable();
    const month = this.getCurrentMonth();
    return db.prepare(
      'SELECT user_id as userId, best_floor as bestFloor FROM abyss_leaderboard WHERE month = ? ORDER BY best_floor DESC LIMIT ?'
    ).all(month, limit) as any[];
  }

  public getDescription(userId: string): string {
    const prog = this.getProgress(userId);
    const enemy = this.getEnemyForFloor(Math.max(1, prog.currentFloor || 1));
    let msg = `🕳️ **Häng Void** — Abyss Dungeon\n`;
    msg += `📊 Best Floor: **${prog.bestFloor}**\n`;
    msg += `📍 Current: **${prog.currentFloor || 1}**\n`;
    msg += `🎫 Lượt: **${prog.attemptsLeft}**/5\n\n`;
    msg += `Floor ${Math.max(1, prog.currentFloor || 1)}: **${enemy.name}**\n`;
    msg += `HP: ${enemy.hp.toLocaleString()} | ATK: ${enemy.atk.toLocaleString()} | DEF: ${enemy.def.toLocaleString()}\n`;
    msg += `Element: ${enemy.element}${prog.currentFloor % 10 === 0 ? ' (BOSS!)' : ''}`;
    return msg;
  }
}

export const abyssDungeonService = new AbyssDungeonService();
