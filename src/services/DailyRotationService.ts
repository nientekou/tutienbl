import db from '../database/database';

// A-01: Daily Rotation System

interface DailyRotation {
  date: string;
  specialDungeon: string;
  bossRotation: string;
  craftingBonus: string;
  explorationBonus: string;
  pvpBonus: string;
}

const DUNGEONS = [
  { id: 'dungeon_fire', name: 'Địa Đàng Hỏa Ngục', element: 'Hỏa', reward: 'Hỏa Thạch + Nguyên Liệu Hỏa' },
  { id: 'dungeon_water', name: 'Động Thủy Mê Cung', element: 'Thủy', reward: 'Thủy Thạch + Nguyên Liệu Thủy' },
  { id: 'dungeon_earth', name: 'Hang Đất Sét', element: 'Thổ', reward: 'Thổ Thạch + Nguyên Liệu Thổ' },
  { id: 'dungeon_wind', name: 'Thung Lũng Gió', element: 'Phong', reward: 'Phong Thạch + Nguyên Liệu Phong' },
  { id: 'dungeon_lightning', name: 'Chớp Sấm Sét', element: 'Lôi', reward: 'Lôi Thạch + Nguyên Liệu Lôi' },
];

const BOSSES = [
  { id: 'boss_hoa_long', name: 'Hỏa Long', element: 'Hỏa', drop: 'Vảy Hỏa Long' },
  { id: 'boss_thuy_rong', name: 'Thủy Long', element: 'Thủy', drop: 'Vảy Thủy Long' },
  { id: 'bossTho_tuong', name: 'Thổ Tượng', element: 'Thổ', drop: 'Vảy Thổ Long' },
  { id: 'boss_phong_than', name: 'Phong Thần', element: 'Phong', drop: 'Vảy Phong Long' },
  { id: 'boss_loi_tinh', name: 'Lôi Tinh', element: 'Lôi', drop: 'Vảy Lôi Long' },
];

const CRAFTING_BONUSES = [
  { type: 'alchemy', name: 'Ngày Luyện Đan', bonus: 'Nhân đôi cơ hội luyện đan phẩm chất cao' },
  { type: 'forging', name: 'Ngày Rèn Đúc', bonus: 'Nhân đôi cơ hội rèn đúc phẩm chất cao' },
  { type: 'cooking', name: 'Ngày Nấu Nướng', bonus: 'Nhân đôi cơ hội nấu nướng phẩm chất cao' },
];

const EXPLORATION_BONUSES = [
  { zone: 1, name: 'Rừng Sương Mù', bonus: 'Nhân đôi vật phẩm rơi' },
  { zone: 2, name: 'Núi Đá Tuyết', bonus: '+50% cơ hội nguyên liệu hiếm' },
  { zone: 3, name: 'Thung Lũng Rồng', bonus: 'Nhân đôi kinh nghiệm' },
  { zone: 4, name: 'Hang Hổ', bonus: '+100% tỉ lệ rơi vật phẩm' },
  { zone: 5, name: 'Vực Sâu Vô Đáy', bonus: 'Nhân ba cơ hội huyền thoại' },
];

const PVP_BONUSES = [
  { element: 'Hỏa', name: 'Hệ Hỏa', bonus: '+20% sát thương Hỏa trong PvP' },
  { element: 'Thủy', name: 'Hệ Thủy', bonus: '+20% sát thương Thủy trong PvP' },
  { element: 'Thổ', name: 'Hệ Thổ', bonus: '+20% phòng thủ Thổ trong PvP' },
  { element: 'Kim', name: 'Hệ Kim', bonus: '+20% bạo kích Kim trong PvP' },
  { element: 'Lôi', name: 'Hệ Lôi', bonus: '+20% tốc độ Lôi trong PvP' },
  { element: 'Phong', name: 'Hệ Phong', bonus: '+20% né tránh Phong trong PvP' },
  { element: 'Mộc', name: 'Hệ Mộc', bonus: '+20% hồi phục Mộc trong PvP' },
];

class DailyRotationService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_rotations (
        date TEXT PRIMARY KEY,
        dungeon_id TEXT NOT NULL,
        boss_id TEXT NOT NULL,
        crafting_type TEXT NOT NULL,
        exploration_zone INTEGER NOT NULL,
        pvp_element TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * A-01: Get or create today's rotation
   */
  getTodayRotation(): DailyRotation {
    this.initTable();
    const today = this.getTodayString();

    let rotation = db.prepare('SELECT * FROM daily_rotations WHERE date = ?').get(today) as any;
    if (!rotation) {
      // Generate new rotation based on date hash
      const hash = this.dateHash(today);
      const dungeon = DUNGEONS[hash % DUNGEONS.length];
      const boss = BOSSES[(hash + 1) % BOSSES.length];
      const crafting = CRAFTING_BONUSES[(hash + 2) % CRAFTING_BONUSES.length];
      const exploration = EXPLORATION_BONUSES[(hash + 3) % EXPLORATION_BONUSES.length];
      const pvp = PVP_BONUSES[(hash + 4) % PVP_BONUSES.length];

      db.prepare(`
        INSERT INTO daily_rotations (date, dungeon_id, boss_id, crafting_type, exploration_zone, pvp_element, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(today, dungeon.id, boss.id, crafting.type, exploration.zone, pvp.element, Math.floor(Date.now() / 1000));

      rotation = { dungeon_id: dungeon.id, boss_id: boss.id, crafting_type: crafting.type, exploration_zone: exploration.zone, pvp_element: pvp.element };
    }

    return {
      date: today,
      specialDungeon: rotation.dungeon_id,
      bossRotation: rotation.boss_id,
      craftingBonus: rotation.crafting_type,
      explorationBonus: rotation.exploration_zone,
      pvpBonus: rotation.pvp_element
    };
  }

  /**
   * A-01: Get rotation details for UI
   */
  getRotationDescription(): string {
    const rotation = this.getTodayRotation();

    const dungeon = DUNGEONS.find(d => d.id === rotation.specialDungeon);
    const boss = BOSSES.find(b => b.id === rotation.bossRotation);
    const crafting = CRAFTING_BONUSES.find(c => c.type === rotation.craftingBonus);
    const exploration = EXPLORATION_BONUSES.find(e => String(e.zone) === String(rotation.explorationBonus));
    const pvp = PVP_BONUSES.find(p => p.element === rotation.pvpBonus);

    let msg = `🔄 **Luân Phiên Hằng Ngày** — ${rotation.date}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏯 **Phó Bản:** ${dungeon?.name || rotation.specialDungeon}\n`;
    msg += `   └ Hệ: ${dungeon?.element} | Phần Thưởng: ${dungeon?.reward}\n`;
    msg += `👹 **Boss:** ${boss?.name || rotation.bossRotation}\n`;
    msg += `   └ Hệ: ${boss?.element} | Rơi: ${boss?.drop}\n`;
    msg += `⚒️ **Chế Tạo:** ${crafting?.name || rotation.craftingBonus}\n`;
    msg += `   └ Thưởng: ${crafting?.bonus}\n`;
    msg += `🗺️ **Thám Hiểm:** ${exploration?.name || rotation.explorationBonus}\n`;
    msg += `   └ Thưởng: ${exploration?.bonus}\n`;
    msg += `⚔️ **PvP:** ${pvp?.name || rotation.pvpBonus}\n`;
    msg += `   └ Thưởng: ${pvp?.bonus}\n`;

    return msg;
  }

  /**
   * A-01: Check if a specific bonus is active
   */
  isDungeonBonusActive(dungeonId: string): boolean {
    const rotation = this.getTodayRotation();
    return rotation.specialDungeon === dungeonId;
  }

  isCraftingBonusActive(craftType: string): boolean {
    const rotation = this.getTodayRotation();
    return rotation.craftingBonus === craftType;
  }

  isExplorationBonusActive(zone: number): boolean {
    const rotation = this.getTodayRotation();
    return Number(rotation.explorationBonus) === zone;
  }

  isPvpBonusActive(element: string): boolean {
    const rotation = this.getTodayRotation();
    return rotation.pvpBonus === element;
  }

  /**
   * A-01: Get bonus multiplier for active rotation
   */
  getBonusMultiplier(type: string, id: string): number {
    const rotation = this.getTodayRotation();

    switch (type) {
      case 'dungeon': return rotation.specialDungeon === id ? 2.0 : 1.0;
      case 'crafting': return rotation.craftingBonus === id ? 1.5 : 1.0;
      case 'exploration': return String(rotation.explorationBonus) === String(id) ? 2.0 : 1.0;
      case 'pvp': return rotation.pvpBonus === id ? 1.2 : 1.0;
      default: return 1.0;
    }
  }

  private getTodayString(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    return vn.toISOString().slice(0, 10);
  }

  private dateHash(dateStr: string): number {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      const char = dateStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const dailyRotationService = new DailyRotationService();
