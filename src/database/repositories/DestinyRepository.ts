import db from '../database';
import { DestinyType, DestinyRarity } from '../../config/destinies';

export interface UserDestinyEntity {
  id: number;
  user_id: string;
  destiny_id: DestinyType;
  rarity: DestinyRarity;
  level: number;
  exp: number;
  is_equipped: number;
  slot: number;
  created_at: number;
}

export interface DestinyPityRow {
  user_id: string;
  pull_count: number;
  last_pull_at: number;
}

export class DestinyRepository {
  /**
   * Lấy toàn bộ mệnh cách của người dùng
   */
  public getUserDestinies(userId: string): UserDestinyEntity[] {
    return db.prepare('SELECT * FROM user_destinies WHERE user_id = ? ORDER BY is_equipped DESC, level DESC').all(userId) as UserDestinyEntity[];
  }

  /**
   * Lấy một mệnh cách bằng ID
   */
  public get(id: number): UserDestinyEntity | null {
    return (db.prepare('SELECT * FROM user_destinies WHERE id = ?').get(id) as UserDestinyEntity) || null;
  }

  /**
   * Thêm mệnh cách mới — trả về entity vừa tạo
   */
  public addDestiny(userId: string, destinyId: DestinyType, rarity: DestinyRarity): UserDestinyEntity {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      INSERT INTO user_destinies (user_id, destiny_id, rarity, level, exp, is_equipped, slot, created_at)
      VALUES (?, ?, ?, 1, 0, 0, 0, ?)
    `).run(userId, destinyId, rarity, now);
    return this.get(result.lastInsertRowid as number)!;
  }

  /**
   * Xóa mệnh cách (khi bị hiến tế)
   */
  public deleteDestiny(id: number): void {
    db.prepare('DELETE FROM user_destinies WHERE id = ?').run(id);
  }

  /**
   * Cập nhật thông tin mệnh cách
   */
  public update(id: number, data: Partial<UserDestinyEntity>): void {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    if (fields.length === 0) return;

    db.prepare(`UPDATE user_destinies SET ${fields} WHERE id = ?`).run(...values, id);
  }

  /**
   * Tháo mệnh cách ở một slot cụ thể của user
   */
  public unequipSlot(userId: string, slot: number): void {
    db.prepare('UPDATE user_destinies SET is_equipped = 0, slot = 0 WHERE user_id = ? AND slot = ?').run(userId, slot);
  }

  // === P1-08: Pity System ===

  public getPity(userId: string): DestinyPityRow {
    let row = db.prepare('SELECT * FROM destiny_pity WHERE user_id = ?').get(userId) as DestinyPityRow | undefined;
    if (!row) {
      db.prepare('INSERT INTO destiny_pity (user_id, pull_count, last_pull_at) VALUES (?, 0, 0)').run(userId);
      row = db.prepare('SELECT * FROM destiny_pity WHERE user_id = ?').get(userId) as DestinyPityRow;
    }
    return row!;
  }

  public incrementPity(userId: string): void {
    db.prepare('UPDATE destiny_pity SET pull_count = pull_count + 1, last_pull_at = ? WHERE user_id = ?')
      .run(Math.floor(Date.now() / 1000), userId);
  }

  public resetPity(userId: string): void {
    db.prepare('UPDATE destiny_pity SET pull_count = 0 WHERE user_id = ?').run(userId);
  }

  /**
   * Đếm số lượng mệnh cách theo rarity
   */
  public countByRarity(userId: string, rarity: DestinyRarity): number {
    const row = db.prepare('SELECT COUNT(*) as c FROM user_destinies WHERE user_id = ? AND rarity = ?').get(userId, rarity) as { c: number };
    return row.c;
  }
}

export const destinyRepository = new DestinyRepository();
