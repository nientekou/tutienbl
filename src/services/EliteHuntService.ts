// V13 C-04: Săn Lùng Tinh Anh (Elite Hunt Event)
import db from '../database/database';

interface EliteEnemy {
  id: string;
  name: string;
  zone: string;
  element: string;
  hp: number;
  atk: number;
  def: number;
}

class EliteHuntService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS elite_hunt_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS elite_hunt_runs (
        event_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        kills INTEGER DEFAULT 0,
        damage INTEGER DEFAULT 0,
        PRIMARY KEY (event_id, user_id)
      );
    `);
  }

  public isEventActive(): boolean {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare("SELECT 1 FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
      .get(now, now);
    return !!row;
  }

  public startEvent(): void {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    db.prepare("INSERT INTO elite_hunt_events (start_time, end_time, status) VALUES (?, ?, 'active')")
      .run(now, now + 30 * 60); // 30 minutes
  }

  public recordKill(userId: string, damage: number): void {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const event = db.prepare("SELECT id FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
      .get(now, now) as { id: number } | undefined;
    if (!event) return;

    db.prepare(`
      INSERT INTO elite_hunt_runs (event_id, user_id, kills, damage) VALUES (?, ?, 1, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET kills = kills + 1, damage = damage + excluded.damage
    `).run(event.id, userId, damage);
  }

  public getLeaderboard(): { rank: number; userId: string; kills: number; damage: number }[] {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const event = db.prepare("SELECT id FROM elite_hunt_events WHERE status = 'active' AND start_time <= ? AND end_time > ?")
      .get(now, now) as { id: number } | undefined;
    if (!event) return [];

    const rows = db.prepare(
      'SELECT user_id, kills, damage FROM elite_hunt_runs WHERE event_id = ? ORDER BY kills DESC, damage DESC LIMIT 10'
    ).all(event.id) as { user_id: string; kills: number; damage: number }[];

    return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, kills: r.kills, damage: r.damage }));
  }

  public getRewards(rank: number): { ngotinh: number; coins: number; title?: string } {
    if (rank === 1) return { ngotinh: 500, coins: 5000, title: 'Tinh Anh Sư Tử' };
    if (rank <= 3) return { ngotinh: 300, coins: 3000 };
    if (rank <= 10) return { ngotinh: 200, coins: 2000 };
    return { ngotinh: 50, coins: 500 };
  }
}

export const eliteHuntService = new EliteHuntService();
