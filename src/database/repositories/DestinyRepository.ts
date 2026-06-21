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
   * Thêm mệnh cách mới
   */
  public addDestiny(userId: string, destinyId: DestinyType, rarity: DestinyRarity): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO user_destinies (user_id, destiny_id, rarity, level, exp, is_equipped, slot, created_at)
      VALUES (?, ?, ?, 1, 0, 0, 0, ?)
    `).run(userId, destinyId, rarity, now);
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
}

export const destinyRepository = new DestinyRepository();
