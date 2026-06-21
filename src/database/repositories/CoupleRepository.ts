import db from '../database';

export interface Couple {
  id: number;
  user1_id: string;
  user2_id: string;
  intimacy: number;
  marriage_date: number;
  last_dual_cultivation: number;
}

class CoupleRepository {
  public getCoupleByUserId(userId: string): Couple | undefined {
    return db.prepare('SELECT * FROM couples WHERE user1_id = ? OR user2_id = ?').get(userId, userId) as Couple | undefined;
  }

  public getCoupleById(id: number): Couple | undefined {
    return db.prepare('SELECT * FROM couples WHERE id = ?').get(id) as Couple | undefined;
  }

  public createCouple(user1Id: string, user2Id: string): number {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      INSERT INTO couples (user1_id, user2_id, intimacy, marriage_date, last_dual_cultivation)
      VALUES (?, ?, 0, ?, 0)
    `).run(user1Id, user2Id, now);
    return result.lastInsertRowid as number;
  }

  public deleteCouple(id: number): void {
    db.prepare('DELETE FROM couples WHERE id = ?').run(id);
  }

  public updateIntimacy(id: number, amount: number): void {
    db.prepare('UPDATE couples SET intimacy = intimacy + ? WHERE id = ?').run(amount, id);
  }

  public updateLastDualCultivation(id: number, timestamp: number): void {
    db.prepare('UPDATE couples SET last_dual_cultivation = ? WHERE id = ?').run(timestamp, id);
  }
}

export const coupleRepository = new CoupleRepository();
