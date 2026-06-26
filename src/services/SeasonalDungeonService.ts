import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-01: Seasonal Dungeon System

interface SeasonalDungeonDef {
  month: number;
  name: string;
  boss: string;
  element: string;
  rewards: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const SEASONAL_DUNGEONS: SeasonalDungeonDef[] = [
  { month: 1, name: 'Frozen Cavern', boss: 'Ice Wyrm', element: 'Thuy', rewards: 'Ice Crystals + Frost Armor', difficulty: 'medium' },
  { month: 2, name: 'Enchanted Forest', boss: 'Ancient Treant', element: 'Moc', rewards: 'Nature Essences + Leaf Shield', difficulty: 'easy' },
  { month: 3, name: 'Thunder Peak', boss: 'Storm Lord', element: 'Loi', rewards: 'Lightning Stones + Thunder Blade', difficulty: 'hard' },
  { month: 4, name: 'Deep Mine', boss: 'Earth Titan', element: 'Tho', rewards: 'Earth Cores + Stone Armor', difficulty: 'medium' },
  { month: 5, name: 'Volcano Core', boss: 'Fire Phoenix', element: 'Hoa', rewards: 'Fire Gems + Flame Sword', difficulty: 'hard' },
  { month: 6, name: 'Sky Temple', boss: 'Wind Dragon', element: 'Phong', rewards: 'Wind Feathers + Gale Boots', difficulty: 'medium' },
  { month: 7, name: 'Iron Fortress', boss: 'Metal Golem', element: 'Kim', rewards: 'Metal Ores + Steel Shield', difficulty: 'hard' },
  { month: 8, name: 'Shadow Realm', boss: 'Dark Emperor', element: 'Vo', rewards: 'Shadow Essence + Void Blade', difficulty: 'hard' },
  { month: 9, name: 'Harvest Moon', boss: 'Harvest Spirit', element: 'Moc', rewards: 'Harvest Blessings + Nature Crown', difficulty: 'easy' },
  { month: 10, name: 'Blood Temple', boss: 'Blood Moon Beast', element: 'Hoa', rewards: 'Blood Gems + Crimson Blade', difficulty: 'hard' },
  { month: 11, name: 'Frozen Throne', boss: 'Frost King', element: 'Thuy', rewards: 'Frost Crystals + Ice Crown', difficulty: 'medium' },
  { month: 12, name: 'Final Trial', boss: 'Year End Boss', element: 'Vo', rewards: 'All Materials + Exclusive Title', difficulty: 'hard' },
];

class SeasonalDungeonService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS seasonal_dungeon_progress (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        best_time INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, month, year)
      );
    `);
  }

  /**
   * B-01: Get current seasonal dungeon
   */
  getCurrentDungeon(): SeasonalDungeonDef {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const month = vn.getUTCMonth() + 1;
    return SEASONAL_DUNGEONS.find(d => d.month === month) || SEASONAL_DUNGEONS[0];
  }

  /**
   * B-01: Get seasonal dungeon description
   */
  getDungeonDescription(userId: string): string {
    const dungeon = this.getCurrentDungeon();
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const lastDay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 0));
    const daysLeft = Math.ceil((lastDay.getTime() - vn.getTime()) / 86400000);

    let msg = `🏯 **Seasonal Dungeon** — ${dungeon.name}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👹 **Boss:** ${dungeon.boss}\n`;
    msg += `⚡ **Element:** ${dungeon.element}\n`;
    msg += `⭐ **Difficulty:** ${dungeon.difficulty}\n`;
    msg += `🎁 **Rewards:** ${dungeon.rewards}\n`;
    msg += `⏰ Còn **${daysLeft}** ngày\n`;

    return msg;
  }

  /**
   * B-01: Complete seasonal dungeon
   */
  completeDungeon(userId: string): { success: boolean; message: string } {
    this.initTable();
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const month = vn.getUTCMonth() + 1;
    const year = vn.getUTCFullYear();

    const existing = db.prepare('SELECT * FROM seasonal_dungeon_progress WHERE user_id = ? AND month = ? AND year = ?')
      .get(userId, month, year) as any;

    if (existing?.completed) {
      return { success: false, message: 'Already completed this season!' };
    }

    db.prepare(`
      INSERT INTO seasonal_dungeon_progress (user_id, month, year, completed, best_time, claimed)
      VALUES (?, ?, ?, 1, 0, 0)
      ON CONFLICT(user_id, month, year) DO UPDATE SET completed = 1
    `).run(userId, month, year);

    const dungeon = this.getCurrentDungeon();
    return { success: true, message: `**${dungeon.name}** đã hoàn thành! Phần thưởng: ${dungeon.rewards}` };
  }
}

export const seasonalDungeonService = new SeasonalDungeonService();
