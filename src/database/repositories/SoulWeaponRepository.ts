import db from '../database';

export interface SoulWeapon {
  id: number;
  user_id: string;
  name: string;
  type: 'kiem' | 'dinh' | 'an';
  level: number;
  exp: number;
  created_at: number;
}

class SoulWeaponRepository {
  public getByUserId(userId: string): SoulWeapon | undefined {
    return db.prepare('SELECT * FROM soul_weapons WHERE user_id = ?').get(userId) as SoulWeapon | undefined;
  }

  public create(userId: string, name: string, type: 'kiem' | 'dinh' | 'an'): number {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      INSERT INTO soul_weapons (user_id, name, type, level, exp, created_at)
      VALUES (?, ?, ?, 1, 0, ?)
    `).run(userId, name, type, now);
    return result.lastInsertRowid as number;
  }

  public updateLevelExp(id: number, level: number, exp: number): void {
    db.prepare('UPDATE soul_weapons SET level = ?, exp = ? WHERE id = ?').run(level, exp, id);
  }
}

export const soulWeaponRepository = new SoulWeaponRepository();
