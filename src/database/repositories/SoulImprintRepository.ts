import db from '../database';

export interface SoulImprint {
  id: number;
  user_id: string;
  item_id: string;
  item_name: string;
  item_slot: string;
  item_rarity: string;
  imprint_stats: string; // JSON: {atk: 15, hp: 50}
  set_group: string; // 'weapon' | 'armor' | 'accessory'
  set_slot: number;
  is_bound: number; // 0 | 1
  created_at: number;
}

class SoulImprintRepository {
  public getUserImprints(userId: string): SoulImprint[] {
    return db.prepare('SELECT * FROM soul_imprints WHERE user_id = ?').all(userId) as SoulImprint[];
  }

  public getImprint(id: number): SoulImprint | undefined {
    return db.prepare('SELECT * FROM soul_imprints WHERE id = ?').get(id) as SoulImprint | undefined;
  }

  public getImprintByItemId(userId: string, itemId: string): SoulImprint | undefined {
    return db.prepare('SELECT * FROM soul_imprints WHERE user_id = ? AND item_id = ?').get(userId, itemId) as SoulImprint | undefined;
  }

  public create(
    userId: string,
    itemId: string,
    itemName: string,
    itemSlot: string,
    itemRarity: string,
    imprintStats: string,
    setGroup: string,
    setSlot: number
  ): number {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      INSERT INTO soul_imprints (user_id, item_id, item_name, item_slot, item_rarity, imprint_stats, set_group, set_slot, is_bound, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(userId, itemId, itemName, itemSlot, itemRarity, imprintStats, setGroup, setSlot, now);
    return result.lastInsertRowid as number;
  }

  public delete(id: number): void {
    db.prepare('DELETE FROM soul_imprints WHERE id = ?').run(id);
  }

  public updateOwner(id: number, newUserId: string): void {
    db.prepare('UPDATE soul_imprints SET user_id = ?, is_bound = 1 WHERE id = ?').run(newUserId, id);
  }
}

export const soulImprintRepository = new SoulImprintRepository();
