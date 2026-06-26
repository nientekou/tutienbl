import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-03: Title Collection System

interface TitleDef {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'social' | 'crafting' | 'exploration' | 'special';
  bonus?: { stat: string; value: number };
  unlockCondition: string;
}

const TITLES: TitleDef[] = [
  // Combat
  { id: 'title_slayer', name: 'Thiết Sát Nhân', description: 'Giết 100 quái vật', category: 'combat', bonus: { stat: 'atk', value: 0.02 }, unlockCondition: 'kill_100' },
  { id: 'title_dragon', name: 'Ngự Long Nhân', description: 'Giết boss 50 lần', category: 'combat', bonus: { stat: 'crit', value: 0.03 }, unlockCondition: 'boss_50' },
  { id: 'title_unstoppable', name: 'Bất Tán Bất Diệt', description: 'Thắng 20 trận liên tiếp', category: 'combat', bonus: { stat: 'atk', value: 0.03 }, unlockCondition: 'win_streak_20' },
  { id: 'title_tank', name: 'Thương Nhân Bất Phá', description: 'Chịu 100k sát thương', category: 'combat', bonus: { stat: 'def', value: 0.03 }, unlockCondition: 'tank_100k' },
  { id: 'title_blitz', name: 'Tốc Tán', description: 'Thắng trận trong 3 hiệp', category: 'combat', bonus: { stat: 'speed', value: 0.02 }, unlockCondition: 'speed_win_3' },
  // Social
  { id: 'title_mentor', name: 'Đại Sư', description: 'Dạy thành công 5 đồ đệ', category: 'social', bonus: { stat: 'exp', value: 0.05 }, unlockCondition: 'mentor_5' },
  { id: 'title_lover', name: 'Nhân Duyên', description: 'Đạt 100 ngày hôn nhân', category: 'social', bonus: { stat: 'hp', value: 0.03 }, unlockCondition: 'couple_100' },
  { id: 'title_leader', name: 'Sect Trưởng', description: 'Là trưởng phái', category: 'social', bonus: { stat: 'all_stats', value: 0.02 }, unlockCondition: 'sect_leader' },
  { id: 'title_popular', name: 'Nổi Tiếng', description: 'Có 20 bạn bè', category: 'social', bonus: { stat: 'luck', value: 0.03 }, unlockCondition: 'friends_20' },
  // Crafting
  { id: 'title_master', name: 'Đại Sư', description: 'Đạt mastery 10', category: 'crafting', bonus: { stat: 'craft_speed', value: 0.10 }, unlockCondition: 'mastery_10' },
  { id: 'title_alchemist', name: 'Liên Đan Sư', description: 'Chế tạo 500 bình thuốc', category: 'crafting', bonus: { stat: 'herb_drop', value: 0.05 }, unlockCondition: 'craft_500' },
  { id: 'title_forger', name: 'Luyện Khí Sư', description: 'Ràng buộc 50 vũ khí', category: 'crafting', bonus: { stat: 'atk', value: 0.02 }, unlockCondition: 'forge_50' },
  // Exploration
  { id: 'title_explorer', name: 'Ngự Hành Giang Hồ', description: 'Khám phá 200 lần', category: 'exploration', bonus: { stat: 'dodge', value: 0.03 }, unlockCondition: 'explore_200' },
  { id: 'title_treasure', name: 'Tiên Bảo Nhân', description: 'Tìm 100 kho báu', category: 'exploration', bonus: { stat: 'luck', value: 0.05 }, unlockCondition: 'treasure_100' },
  { id: 'title_wanderer', name: 'Lãng Nhân', description: 'Đi 10 địa điểm', category: 'exploration', bonus: { stat: 'speed', value: 0.02 }, unlockCondition: 'locations_10' },
  // Special
  { id: 'title_reborn', name: 'Chuyển Sinh', description: 'Chuyển sinh 1 lần', category: 'special', bonus: { stat: 'all_stats', value: 0.03 }, unlockCondition: 'reincarnate_1' },
  { id: 'title_veteran', name: 'Lão Phong Trần', description: 'Đăng nhập 365 ngày', category: 'special', bonus: { stat: 'all_stats', value: 0.05 }, unlockCondition: 'login_365' },
  { id: 'title_legend', name: 'Huyền Thoại', description: 'Đạt top 1 bảng xếp hạng', category: 'special', bonus: { stat: 'all_stats', value: 0.05 }, unlockCondition: 'rank_1' },
  { id: 'title_collector', name: 'Người Sưu Tập', description: 'Sở hữu 50 món đồ', category: 'special', bonus: { stat: 'luck', value: 0.05 }, unlockCondition: 'items_50' },
];

class TitleService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_titles (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        title_id TEXT NOT NULL,
        unlocked_at INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, title_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_title_config (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        equipped_title TEXT DEFAULT '',
        showcase TEXT DEFAULT '[]'
      );
    `);
  }

  unlockTitle(userId: string, titleId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const title = TITLES.find(t => t.id === titleId);
    if (!title) return { success: false, message: 'Danh hiệu không tồn tại' };

    const existing = db.prepare('SELECT 1 FROM user_titles WHERE user_id = ? AND title_id = ?').get(userId, titleId);
    if (existing) return { success: false, message: 'Danh hiệu này đã được mở khoá' };

    db.prepare('INSERT INTO user_titles (user_id, title_id, unlocked_at) VALUES (?, ?, ?)')
      .run(userId, titleId, Math.floor(Date.now() / 1000));

    return { success: true, message: `🏅 Mở khóa danh hiệu: **${title.name}**!` };
  }

  equipTitle(userId: string, titleId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const owned = db.prepare('SELECT 1 FROM user_titles WHERE user_id = ? AND title_id = ?').get(userId, titleId);
    if (!owned) return { success: false, message: 'Đạo hữu chưa sở hữu danh hiệu này' };

    const title = TITLES.find(t => t.id === titleId);
    db.prepare('INSERT OR REPLACE INTO user_title_config (user_id, equipped_title) VALUES (?, ?)')
      .run(userId, titleId);

    return { success: true, message: `🏅 Đã trang bị danh hiệu: **${title?.name || titleId}**!` };
  }

  getTitleBonuses(userId: string): Record<string, number> {
    this.initTable();
    const config = db.prepare('SELECT equipped_title FROM user_title_config WHERE user_id = ?').get(userId) as any;
    if (!config?.equipped_title) return {};

    const title = TITLES.find(t => t.id === config.equipped_title);
    if (!title?.bonus) return {};

    return { [title.bonus.stat]: title.bonus.value };
  }

  getOwnedTitles(userId: string): string[] {
    this.initTable();
    const rows = db.prepare('SELECT title_id FROM user_titles WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => r.title_id);
  }

  getTitleDescription(userId: string): string {
    this.initTable();
    const config = db.prepare('SELECT equipped_title FROM user_title_config WHERE user_id = ?').get(userId) as any;
    const owned = this.getOwnedTitles(userId);

    let msg = `🏅 **Danh Hiệu**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (config?.equipped_title) {
      const title = TITLES.find(t => t.id === config.equipped_title);
      msg += `Trang bị: **${title?.name || 'Không'}**\n`;
    } else {
      msg += `Chưa trang bị danh hiệu nào.\n`;
    }

    msg += `\nSở hữu: ${owned.length}/${TITLES.length}\n`;

    const categories = ['combat', 'social', 'crafting', 'exploration', 'special'] as const;
    for (const cat of categories) {
      const catTitles = TITLES.filter(t => t.category === cat);
      const catOwned = catTitles.filter(t => owned.includes(t.id));
      if (catTitles.length > 0) {
        const catName = cat === 'combat' ? 'Chiến đấu' : cat === 'social' ? 'Xã hội' : cat === 'crafting' ? 'Chế tạo' : cat === 'exploration' ? 'Khám phá' : 'Đặc biệt';
        msg += `\n**${catName}:** ${catOwned.length}/${catTitles.length}`;
        for (const t of catTitles) {
          const owned_ = owned.includes(t.id);
          msg += `\n  ${owned_ ? '🏅' : '🔒'} ${t.name} - ${t.description}`;
        }
      }
    }

    return msg;
  }
}

export const titleService = new TitleService();
