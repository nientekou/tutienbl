import db from '../database/database';

// B-10: Event Calendar & Seasonal Content

type SeasonElement = 'Hoa' | 'Thuy' | 'Moc' | 'Kim' | 'Tho' | 'Loi' | 'Phong' | 'Vo';

interface SeasonDef {
  name: string;
  element: SeasonElement;
  emoji: string;
  description: string;
  buff: { stat: string; value: number };
  nerf: { stat: string; value: number };
}

const SEASONS: SeasonDef[] = [
  { name: 'Mùa Lửa', element: 'Hoa', emoji: '🔥', description: 'Lửa thiêu rực, Hỏa hệ mạnh', buff: { stat: 'atk_bonus', value: 0.05 }, nerf: { stat: 'def_bonus', value: -0.03 } },
  { name: 'Mùa Nước', element: 'Thuy', emoji: '💧', description: 'Nước dâng trào, Thủy hệ mạnh', buff: { stat: 'hp_bonus', value: 0.05 }, nerf: { stat: 'atk_bonus', value: -0.03 } },
  { name: 'Mùa Cây', element: 'Moc', emoji: '🌿', description: 'Thảm thực vật xanh tươi', buff: { stat: 'regen_bonus', value: 0.05 }, nerf: { stat: 'crit_bonus', value: -0.02 } },
  { name: 'Mùa Kim', element: 'Kim', emoji: '⚔️', description: 'Kim loại sáng ngời, Kim hệ mạnh', buff: { stat: 'crit_bonus', value: 0.03 }, nerf: { stat: 'speed_bonus', value: -0.03 } },
  { name: 'Mùa Đất', element: 'Tho', emoji: '🪨', description: 'Đất trời vững chãi', buff: { stat: 'def_bonus', value: 0.05 }, nerf: { stat: 'dodge_bonus', value: -0.03 } },
  { name: 'Mùa Sấm', element: 'Loi', emoji: '⚡', description: 'Sấm sét vang trời, Lôi hệ mạnh', buff: { stat: 'speed_bonus', value: 0.05 }, nerf: { stat: 'hp_bonus', value: -0.03 } },
  { name: 'Mùa Gió', element: 'Phong', emoji: '🌀', description: 'Gió thổi mạnh, Phong hệ mạnh', buff: { stat: 'dodge_bonus', value: 0.05 }, nerf: { stat: 'def_bonus', value: -0.03 } },
];

const SEASONAL_SHOP_ITEMS = [
  { id: 'seasonal_title', name: 'Danh Hiệu Mùa', cost: 500, type: 'title' },
  { id: 'seasonal_mount', name: 'Skin Cưỡi Mùa', cost: 1000, type: 'cosmetic' },
  { id: 'seasonal_frame', name: 'Khung Avatar Mùa', cost: 300, type: 'cosmetic' },
  { id: 'seasonal_emote', name: 'Emote Mùa', cost: 200, type: 'cosmetic' },
];

class EventCalendarService {
  /**
   * B-10: Get current season based on month
   */
  getCurrentSeason(): SeasonDef & { month: number; daysLeft: number } {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const month = vn.getUTCMonth(); // 0-11

    // Map month to season (cycle through 7 seasons, repeat)
    const seasonIndex = month % SEASONS.length;
    const season = SEASONS[seasonIndex];

    // Calculate days left in month
    const lastDay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 0));
    const daysLeft = Math.ceil((lastDay.getTime() - vn.getTime()) / 86400000);

    return { ...season, month, daysLeft };
  }

  /**
   * B-10: Get season buff/nerf effects
   */
  getSeasonEffects(): Record<string, number> {
    const season = this.getCurrentSeason();
    return {
      [season.buff.stat]: season.buff.value,
      [season.nerf.stat]: season.nerf.value,
    };
  }

  /**
   * B-10: Get seasonal shop items
   */
  getSeasonalShop(): typeof SEASONAL_SHOP_ITEMS {
    return SEASONAL_SHOP_ITEMS;
  }

  /**
   * B-10: Get countdown to next season
   */
  getCountdown(): string {
    const season = this.getCurrentSeason();
    return `📅 **${season.emoji} ${season.name}** — Còn **${season.daysLeft}** ngày`;
  }

  /**
   * B-10: Get seasonal description for UI
   */
  getSeasonDescription(): string {
    const season = this.getCurrentSeason();

    let msg = `${season.emoji} **${season.name}** (${season.element})\n`;
    msg += `${season.description}\n\n`;
    msg += `**Hiệu ứng mùa:**\n`;
    msg += `• ${season.buff.stat}: **+${Math.round(season.buff.value * 100)}%**\n`;
    msg += `• ${season.nerf.stat}: **${Math.round(season.nerf.value * 100)}%**\n\n`;
    msg += `⏰ Còn **${season.daysLeft}** ngày\n\n`;
    msg += `**Cửa Hàng Mùa:** Dùng \`/sukien\` để xem`;
    return msg;
  }

  // === D-03: Season V2 — Season Pass, Seasonal Content ===

  /**
   * D-03: Season Pass tiers and rewards
   */
  private getSeasonPassTiers(): { tier: number; freeReward: string; premiumReward: string; expRequired: number }[] {
    return [
      { tier: 1, freeReward: '100 LT', premiumReward: '150 LT + 5 KNB', expRequired: 0 },
      { tier: 5, freeReward: '500 LT + 3 đan dược', premiumReward: '750 LT + 5 KNB + 5 đan dược', expRequired: 500 },
      { tier: 10, freeReward: '1000 LT + 5 Tinh Thạch', premiumReward: '1500 LT + 10 KNB + 5 Tinh Thạch', expRequired: 1500 },
      { tier: 15, freeReward: '1500 LT + thức ăn linh thú', premiumReward: '2250 LT + 15 KNB + thức ăn linh thú', expRequired: 3000 },
      { tier: 20, freeReward: '2000 LT + 10 Tinh Thạch', premiumReward: '3000 LT + 20 KNB + 10 Tinh Thạch', expRequired: 5000 },
      { tier: 25, freeReward: '3000 LT + túi dược liệu hiếm', premiumReward: '4500 LT + 25 KNB + dược liệu hiếm', expRequired: 8000 },
      { tier: 30, freeReward: '5000 LT + tinh hoa linh hồn', premiumReward: '7500 LT + 50 KNB + tinh hoa linh hồn', expRequired: 12000 },
      { tier: 35, freeReward: '500 Ngộ Tính + mảnh tâm pháp', premiumReward: '750 Ngộ Tính + mảnh tâm pháp', expRequired: 17000 },
      { tier: 40, freeReward: '5000 LT + 15 Tinh Thạch', premiumReward: '7500 LT + 30 KNB + 15 Tinh Thạch', expRequired: 23000 },
      { tier: 45, freeReward: '500 Ngộ Tính + tinh hoa linh hồn', premiumReward: '750 Ngộ Tính + tinh hoa linh hồn', expRequired: 30000 },
      { tier: 50, freeReward: '100 KNB + Danh Hiệu Mùa + 20 Tinh Thạch', premiumReward: '150 KNB + Tọa Kỵ Mùa + Danh Hiệu Mùa Cao Cấp + 20 Tinh Thạch', expRequired: 40000 },
    ];
  }

  /**
   * D-03: Get season pass progress
   */
  getSeasonPassProgress(userId: string): { tier: number; exp: number; nextTierExp: number; freeClaimed: boolean; premiumClaimed: boolean } {
    const row = db.prepare('SELECT * FROM user_season_pass WHERE user_id = ?').get(userId) as any;
    if (!row) return { tier: 0, exp: 0, nextTierExp: 500, freeClaimed: false, premiumClaimed: false };

    const tiers = this.getSeasonPassTiers();
    const currentTier = tiers.find(t => row.exp < t.expRequired) || tiers[tiers.length - 1];
    const prevTier = tiers[tiers.indexOf(currentTier) - 1];

    return {
      tier: prevTier ? prevTier.tier : 0,
      exp: row.exp,
      nextTierExp: currentTier.expRequired,
      freeClaimed: row.free_claimed === 1,
      premiumClaimed: row.premium_claimed === 1
    };
  }

  /**
   * D-03: Add season pass EXP
   */
  addSeasonPassExp(userId: string, exp: number): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_season_pass (
        user_id TEXT PRIMARY KEY,
        exp INTEGER DEFAULT 0,
        free_claimed INTEGER DEFAULT 0,
        premium_claimed INTEGER DEFAULT 0
      );
    `);

    const existing = db.prepare('SELECT * FROM user_season_pass WHERE user_id = ?').get(userId) as any;
    if (existing) {
      db.prepare('UPDATE user_season_pass SET exp = exp + ? WHERE user_id = ?').run(exp, userId);
    } else {
      db.prepare('INSERT INTO user_season_pass (user_id, exp) VALUES (?, ?)').run(userId, exp);
    }
  }

  /**
   * D-03: Get seasonal quests (5 per season)
   */
  getSeasonalQuests(): { id: string; name: string; description: string; target: number; reward: string }[] {
    const season = this.getCurrentSeason();
    return [
      { id: `sq_${season.element}_1`, name: `Thử Thách ${season.name}`, description: `Hoàn thành 10 trận chiến trong mùa ${season.name}`, target: 10, reward: '500 LT + Season Token' },
      { id: `sq_${season.element}_2`, name: `Săn Mùa`, description: `Thu thập 20 vật liệu mùa`, target: 20, reward: '1000 LT + Season Token' },
      { id: `sq_${season.element}_3`, name: `Chiến Thần Mùa`, description: `Thắng 5 PvP trong mùa`, target: 5, reward: '1500 LT + 5 KNB' },
      { id: `sq_${season.element}_4`, name: `Thợ Rèn Mùa`, description: `Luyện chế 5 vật phẩm mùa`, target: 5, reward: '800 LT + Season Token' },
      { id: `sq_${season.element}_5`, name: `Hoàn Thành Mùa`, description: `Hoàn thành tất cả quest mùa`, target: 4, reward: '5000 LT + 20 KNB + Season Title' },
    ];
  }

  /**
   * D-03: Get season pass description
   */
  getSeasonPassDescription(userId: string): string {
    const progress = this.getSeasonPassProgress(userId);
    const tiers = this.getSeasonPassTiers();
    const currentTierIdx = tiers.findIndex(t => progress.exp < t.expRequired);
    const currentTier = currentTierIdx >= 0 ? tiers[currentTierIdx] : tiers[tiers.length - 1];

    let msg = `🎫 **Season Pass**\n`;
    msg += `📊 EXP: **${progress.exp}**/${progress.nextTierExp}\n`;
    msg += `🏆 Tier: **${progress.tier}**/50\n\n`;

    // Show next 3 tiers
    const nextTiers = tiers.slice(currentTierIdx, currentTierIdx + 3);
    for (const t of nextTiers) {
      const isUnlocked = progress.exp >= t.expRequired;
      msg += `${isUnlocked ? '✅' : '🔒'} Tier ${t.tier}: ${t.freeReward}\n`;
    }

    msg += `\n*Cùng tích lũy EXP qua các hoạt động để mở khóa!*`;
    return msg;
  }

  // === V16 B-04: Seasonal Events ===
  private readonly SEASONAL_EVENTS: { id: string; name: string; season: string; month: number; duration: number; description: string; rewards: string; effects: { expBonus: number; atkBonus: number; defBonus: number; pvpDmgBonus: number; craftBonus: number; dropBonus: number; questBonus: number } }[] = [
    { id: 'spring_phoenix', name: 'Hội Phượng Hoàng', season: 'spring', month: 3, duration: 14, description: 'Special dungeon + mount skin', rewards: 'Phượng Hoàng Tọa Kỵ Skin + 50 KNB', effects: { expBonus: 0.50, atkBonus: 0.10, defBonus: 0, pvpDmgBonus: 0, craftBonus: 0, dropBonus: 0.10, questBonus: 0.25 } },
    { id: 'summer_thunder', name: 'Lôi Đạo Đại Hội', season: 'summer', month: 6, duration: 14, description: 'PvP tournament + exclusive title', rewards: '"Lôi Đạo Vương" Title + 100 KNB', effects: { expBonus: 0, atkBonus: 0, defBonus: 0, pvpDmgBonus: 0.30, craftBonus: 0, dropBonus: 0, questBonus: 0.50 } },
    { id: 'autumn_harvest', name: 'Thuộc Nguyên Festival', season: 'autumn', month: 9, duration: 14, description: 'Crafting bonus + rare materials', rewards: '3x Awakening Materials + 50 KNB', effects: { expBonus: 0.25, atkBonus: 0, defBonus: 0, pvpDmgBonus: 0, craftBonus: 0.20, dropBonus: 0.50, questBonus: 0.25 } },
    { id: 'winter_trial', name: 'Băng Phong Trials', season: 'winter', month: 12, duration: 14, description: 'Survival challenge + cosmetic rewards', rewards: 'Băng Phong Avatar Frame + 100 KNB', effects: { expBonus: 0, atkBonus: 0, defBonus: 0.30, pvpDmgBonus: 0, craftBonus: 0, dropBonus: 0.25, questBonus: 0.50 } },
  ];

  public getCurrentSeasonalEvent(): (typeof this.SEASONAL_EVENTS[0]) | null {
    const now = new Date();
    const month = now.getMonth() + 1;
    // Check if current date falls within the event's 14-day window starting month's 1st
    const event = this.SEASONAL_EVENTS.find(e => e.month === month);
    if (!event) return null;
    const dayOfMonth = now.getDate();
    if (dayOfMonth > event.duration) return null;
    return event;
  }

  /**
   * V16 B-04: Get active seasonal event effects for gameplay integration
   */
  public getSeasonalEventEffects(): Record<string, number> {
    const event = this.getCurrentSeasonalEvent();
    if (!event) return {};
    return {
      exp_bonus: event.effects.expBonus,
      atk_bonus: event.effects.atkBonus,
      def_bonus: event.effects.defBonus,
      pvp_dmg_bonus: event.effects.pvpDmgBonus,
      craft_bonus: event.effects.craftBonus,
      drop_bonus: event.effects.dropBonus,
      quest_bonus: event.effects.questBonus,
    };
  }

  public hasSeasonalEvent(): boolean {
    return this.getCurrentSeasonalEvent() !== null;
  }

  /**
   * V16 B-04: Get a specific effect modifier (0 if not active or effect not present)
   */
  public getSeasonalEffect(key: string): number {
    const effects = this.getSeasonalEventEffects();
    return effects[key] || 0;
  }

  public getSeasonalEventDescription(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    const dayOfMonth = now.getDate();

    let msg = '🌸 **Sự Kiện Theo Mùa**\n\n';
    for (const event of this.SEASONAL_EVENTS) {
      const isActive = event.month === month && dayOfMonth <= event.duration;
      const status = isActive ? '🟢 ĐANG DIỄN RA' : '⚪ Chờ đến lượt';
      msg += `${isActive ? '🟢' : '⚪'} **${event.name}** — Tháng ${event.month}\n`;
      msg += `  ${event.description}\n`;
      msg += `  Phần thưởng: ${event.rewards}\n`;
      if (isActive) msg += `  ⏰ Còn lại: ${Math.max(0, event.duration - dayOfMonth)} ngày\n`;
      msg += '\n';
    }
    return msg;
  }
}

export const eventCalendarService = new EventCalendarService();
