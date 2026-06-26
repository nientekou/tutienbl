import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { achievementService } from './AchievementService';
import { ITEMS } from '../config/itemConstants';

export interface Bloodline {
  id: string;
  name: string;
  description: string;
  passives: string; // JSON
  weakness: string; // JSON
  rage_effect: string; // JSON
}

export interface UserBloodline {
  user_id: string;
  bloodline_id: string;
  level: number;
  exp: number;
  activated_at: number;
  rage_cooldown: number;
  evolution_stage?: number; // V16 A-04: 1-3
}

class BloodlineService {
  public getAllBloodlines(): Bloodline[] {
    return db.prepare('SELECT * FROM bloodlines').all() as Bloodline[];
  }

  public getUserBloodline(userId: string): (UserBloodline & { name: string, description: string, passives: any, weakness: any, rage_effect: any }) | null {
    const row = db.prepare(`
      SELECT ub.*, b.name, b.description, b.passives, b.weakness, b.rage_effect
      FROM user_bloodlines ub
      JOIN bloodlines b ON ub.bloodline_id = b.id
      WHERE ub.user_id = ?
    `).get(userId) as any;

    if (!row) return null;
    return {
      ...row,
      passives: JSON.parse(row.passives || '{}'),
      weakness: JSON.parse(row.weakness || '{}'),
      rage_effect: JSON.parse(row.rage_effect || '{}'),
    };
  }

  public chooseBloodline(userId: string, bloodlineId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
    if (user.level < 10) return { success: false, message: 'Cần đạt Cấp 10 để giác tỉnh Huyết Mạch!' };

    const existing = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
    if (existing) return { success: false, message: 'Đạo hữu đã giác tỉnh Huyết Mạch rồi! Hãy dùng Huyết Mạch Chuyển Hóa Đan để thay đổi.' };

    const bloodline = db.prepare('SELECT * FROM bloodlines WHERE id = ?').get(bloodlineId) as Bloodline | undefined;
    if (!bloodline) return { success: false, message: 'Huyết mạch không tồn tại!' };

    if (user.coin_ha_pham < 500) return { success: false, message: 'Thiếu 500 Linh Thạch phí giác tỉnh!' };

    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 500 });
      db.prepare(`
        INSERT INTO user_bloodlines (user_id, bloodline_id, level, exp, activated_at, rage_cooldown)
        VALUES (?, ?, 1, 0, ?, 0)
      `).run(userId, bloodlineId, now);
    })();

    // Kiểm tra thành tựu Thiên Mệnh Chi Tử
    achievementService.setProgress(userId, 'tl_19', 1);

    return { success: true, message: `🩸 Chúc mừng! Đạo hữu đã giác tỉnh thành công **${bloodline.name}**!` };
  }

  public changeBloodline(userId: string, newBloodlineId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };

    const existing = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
    if (!existing) return { success: false, message: 'Đạo hữu chưa giác tỉnh Huyết Mạch! Dùng /huyetmach chon để giác tỉnh.' };

    const bloodline = db.prepare('SELECT * FROM bloodlines WHERE id = ?').get(newBloodlineId) as Bloodline | undefined;
    if (!bloodline) return { success: false, message: 'Huyết mạch mới không tồn tại!' };

    const requiredItem = ITEMS.ITEM_BLOODLINE_PILL;
    const inv = inventoryRepository.getUserInventory(userId);
    const item = inv.find(i => i.item_id === requiredItem && i.is_equipped === 0);

    if (!item || item.quantity < 1) {
      return { success: false, message: 'Đạo hữu cần 1 viên **Huyết Mạch Chuyển Hóa Đan** để thay đổi huyết mạch!' };
    }

    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      if (item.quantity > 1) {
        db.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(item.id);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      }

      db.prepare(`
        UPDATE user_bloodlines 
        SET bloodline_id = ?, level = 1, exp = 0, activated_at = ?, rage_cooldown = 0
        WHERE user_id = ?
      `).run(newBloodlineId, now, userId);
    })();

    // Kiểm tra thành tựu Thiên Mệnh Chi Tử
    achievementService.setProgress(userId, 'tl_19', 1);

    return { success: true, message: `🩸 Đạo hữu đã chuyển đổi thành công sang **${bloodline.name}**. Huyết mạch tu vi quay về cấp 1!` };
  }

  public addExp(userId: string, expAmount: number): void {
    const ub = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId) as UserBloodline | undefined;
    if (!ub) return;
    if (ub.level >= 50) return; // Max level

    let currentExp = ub.exp;
    let currentLevel = ub.level;
    currentExp += expAmount;

    let expNeeded = currentLevel * 200;
    while (currentExp >= expNeeded && currentLevel < 50) {
      currentExp -= expNeeded;
      currentLevel++;
      expNeeded = currentLevel * 200;
    }

    if (currentLevel >= 50) {
      currentLevel = 50;
      currentExp = 0;
    }

    db.prepare('UPDATE user_bloodlines SET level = ?, exp = ? WHERE user_id = ?').run(currentLevel, currentExp, userId);
  }

  public getActivePassives(ub: UserBloodline & { passives: any }): any {
    const result: any = {};
    const passives = ub.passives;
    // levels = ['1', '10', '25', '50']
    const breakpoints = [1, 10, 25, 50];
    for (const bp of breakpoints) {
      if (ub.level >= bp && passives[bp.toString()]) {
        const p = passives[bp.toString()];
        result[p.stat] = p.value;
      }
    }
    return result;
  }

  public updateRageCooldown(userId: string, newCooldown: number): void {
    db.prepare('UPDATE user_bloodlines SET rage_cooldown = ? WHERE user_id = ?').run(newCooldown, userId);
  }

  // === P5-02: Bloodline Trials ===

  private getWeekKey(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const day = vn.getUTCDay() || 7;
    vn.setUTCDate(vn.getUTCDate() - (day - 1));
    vn.setUTCHours(0, 0, 0, 0);
    return vn.toISOString().slice(0, 10);
  }

  /**
   * P5-02: Kiểm tra còn lượt trial không
   */
  public getTrialInfo(userId: string): { used: number; max: number; canEnter: boolean } {
    const weekKey = this.getWeekKey();
    let row = db.prepare('SELECT * FROM bloodline_trials WHERE user_id = ? AND week_key = ?').get(userId, weekKey) as any;

    if (!row) {
      db.prepare('INSERT INTO bloodline_trials (user_id, bloodline_id, week_key, trials_used, max_trials) VALUES (?, ?, ?, 0, 3)').run(userId, '', weekKey);
      row = db.prepare('SELECT * FROM bloodline_trials WHERE user_id = ? AND week_key = ?').get(userId, weekKey) as any;
    }

    return {
      used: row.trials_used,
      max: row.max_trials,
      canEnter: row.trials_used < row.max_trials
    };
  }

  /**
   * P5-02: Vào Bloodline Trial — mô phỏng fight dựa trên bloodline type
   * Returns trial result with rewards
   */
  public enterTrial(userId: string): { success: boolean; message: string; expReward?: number; materialReward?: string } {
    const ub = this.getUserBloodline(userId);
    if (!ub) return { success: false, message: 'Đạo hữu chưa kích hoạt Huyết Mạch!' };

    if (ub.level < 25) {
      return { success: false, message: `Cần Huyết Mạch cấp 25+ để mở khóa Thử Thách Huyết Mạch (hiện cấp ${ub.level}).` };
    }

    const trialInfo = this.getTrialInfo(userId);
    if (!trialInfo.canEnter) {
      return { success: false, message: `Đã hết lượt Thử Thách tuần này (${trialInfo.used}/${trialInfo.max}).` };
    }

    // Simple trial result based on bloodline level
    const successChance = Math.min(0.5 + ub.level * 0.01, 0.95); // 50-95% based on level
    const isWin = Math.random() < successChance;

    const weekKey = this.getWeekKey();
    db.prepare('UPDATE bloodline_trials SET trials_used = trials_used + 1 WHERE user_id = ? AND week_key = ?').run(userId, weekKey);

    if (isWin) {
      const expReward = 200 + ub.level * 50;
      this.addExp(userId, expReward);

      const materials = ['bloodline_stone', 'bloodline_crystal', 'bloodline_essence'];
      const material = materials[Math.floor(Math.random() * materials.length)];

      const trialNames: Record<string, string> = {
        'long_huyet': 'Thử Thách Long Huyết — Vampire lifesteal',
        'phuong_hoang': 'Thử Thách Phượng Hoàng — Chết & Hồi Sinh',
        'con_luan': 'Thử Thách Côn Luân — Chịu Đựng 20 hiệp',
        'bach_ho': 'Thử Thách Bạch Hổ — Hạ Gục Trong 5 hiệp',
        'thanh_long': 'Thử Thách Thanh Long — Thử Thách Tốc Độ',
        'huyen_vu': 'Thử Thách Huyền Vũ — Chỉ Khiên'
      };

      return {
        success: true,
        message: `⚔️ **${trialNames[ub.bloodline_id] || 'Thử Thách Huyết Mạch'}** — THÀNH CÔNG!\n+${expReward} Tu Vi Huyết Mạch | +1 ${material}`,
        expReward,
        materialReward: material
      };
    }

    return {
      success: true,
      message: `⚔️ **Thử Thách Huyết Mạch** — THẤT BẠI! Huyết Mạch chưa đủ mạnh. Thử lại tuần sau!`
    };
  }

  // === A-05: Bloodline Trials Expansion ===

  /**
   * A-05: Get trial chapters for a bloodline
   */
  getTrialChapters(bloodlineId: string): { chapter: number; name: string; description: string; minLevel: number; rewards: string }[] {
    const chapters: Record<string, any[]> = {
      'long_huyet': [
        { chapter: 1, name: 'Long Huyết — Hấp Huyết', description: 'Phải hút máu để tồn tại', minLevel: 25, rewards: '+5% hút máu' },
        { chapter: 2, name: 'Long Huyết — Long Tức', description: 'Hồi phục 50% HP mỗi hiệp', minLevel: 35, rewards: '+10% hút máu' },
        { chapter: 3, name: 'Long Huyết — Long Vương', description: 'Đánh bại Boss Long Vương', minLevel: 45, rewards: '+15% hút máu' },
      ],
      'phuong_hoang': [
        { chapter: 1, name: 'Phượng Hoàng — Niết Bàn', description: 'Chết và hồi sinh 1 lần', minLevel: 25, rewards: '+5% tỷ lệ hồi sinh' },
        { chapter: 2, name: 'Phượng Hoàng — Hỏa Phượng', description: '+50% sát thương khi hồi sinh', minLevel: 35, rewards: '+10% tỷ lệ hồi sinh' },
        { chapter: 3, name: 'Phượng Hoàng — Phượng Hoàng', description: 'Hồi sinh với đầy HP', minLevel: 45, rewards: '+15% tỷ lệ hồi sinh' },
      ],
      'con_luan': [
        { chapter: 1, name: 'Côn Luân — Chịu Đựng', description: 'Sống sót 10 hiệp', minLevel: 25, rewards: '+5% giảm sát thương' },
        { chapter: 2, name: 'Côn Luân — Bất Tử', description: 'Sống sót 15 hiệp', minLevel: 35, rewards: '+10% giảm sát thương' },
        { chapter: 3, name: 'Côn Luân — Vạn Kiếp', description: 'Sống sót 20 hiệp', minLevel: 45, rewards: '+15% giảm sát thương' },
      ],
      'bach_ho': [
        { chapter: 1, name: 'Bạch Hổ — Sát Phạt', description: 'Tiêu diệt trong 5 hiệp', minLevel: 25, rewards: '+5% tỷ lệ chí mạng' },
        { chapter: 2, name: 'Bạch Hổ — Bạch Hổ', description: 'Tiêu diệt trong 3 hiệp', minLevel: 35, rewards: '+10% tỷ lệ chí mạng' },
        { chapter: 3, name: 'Bạch Hổ — Hổ Vương', description: 'Tiêu diệt trong 2 hiệp', minLevel: 45, rewards: '+15% tỷ lệ chí mạng' },
      ],
      'thanh_long': [
        { chapter: 1, name: 'Thanh Long — Tốc Độ', description: 'Nhanh hơn địch 3 lần', minLevel: 25, rewards: '+5% tốc độ' },
        { chapter: 2, name: 'Thanh Long — Thanh Long', description: 'Nhanh hơn địch 5 lần', minLevel: 35, rewards: '+10% tốc độ' },
        { chapter: 3, name: 'Thanh Long — Long Vương', description: 'Nhanh hơn địch 7 lần', minLevel: 45, rewards: '+15% tốc độ' },
      ],
      'huyen_vu': [
        { chapter: 1, name: 'Huyền Vũ — Khiên', description: 'Sống sót chỉ dùng khiên', minLevel: 25, rewards: '+5% lượng khiên' },
        { chapter: 2, name: 'Huyền Vũ — Huyền Vũ', description: 'Sống sót 10 hiệp chỉ dùng khiên', minLevel: 35, rewards: '+10% lượng khiên' },
        { chapter: 3, name: 'Huyền Vũ — Thần Thú', description: 'Sống sót 15 hiệp chỉ dùng khiên', minLevel: 45, rewards: '+15% lượng khiên' },
      ],
    };

    return chapters[bloodlineId] || [];
  }

  /**
   * A-05: Get trial leaderboard
   */
  getTrialLeaderboard(bloodlineId: string, limit: number = 10): { userId: string; name: string; chapter: number; completedAt: number }[] {
    const rows = db.prepare(`
      SELECT bt.user_id, u.name, bt.trials_used as chapter, bt.completed_at
      FROM bloodline_trials bt
      JOIN users u ON bt.user_id = u.discord_id
      WHERE bt.bloodline_id = ?
      ORDER BY bt.trials_used DESC, bt.completed_at ASC
      LIMIT ?
    `).all(bloodlineId, limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      chapter: r.chapter,
      completedAt: r.completed_at
    }));
  }

  /**
   * A-05: Get bloodline trial description
   */
  getTrialDescription(userId: string): string {
    const ub = this.getUserBloodline(userId);
    if (!ub) return '❌ Chưa có Huyết Mạch!';

    const chapters = this.getTrialChapters(ub.bloodline_id);
    const trialInfo = this.getTrialInfo(userId);

    let msg = `⚔️ **Thử Thách Huyết Mạch** — ${ub.name}\n`;
    msg += `📊 Cấp: **${ub.level}** | Lượt tuần: **${trialInfo.used}/${trialInfo.max}**\n\n`;

    for (const ch of chapters) {
      const completed = ub.level >= ch.minLevel;
      msg += `${completed ? '✅' : '🔒'} **Chapter ${ch.chapter}:** ${ch.name}\n`;
      msg += `   ${ch.description} | Phần thưởng: ${ch.rewards}\n`;
    }

    return msg;
  }

  // === V16 A-04: Bloodline Evolution (3 stages) ===
  private readonly EVOLUTION_STAGES = [
    { stage: 1, name: 'Sơ Khởi', requirement: 'default', cost: 0, bonus: 'Base bloodline stats' },
    { stage: 2, name: 'Thức Tỉnh', requirement: 'level_50', cost: 5000, bonus: '+10% bloodline stats, unlock stage 2 passive' },
    { stage: 3, name: 'Vô Cực', requirement: 'prestige_1', cost: 10000, bonus: '+20% bloodline stats, unlock stage 3 passive, unique title' },
  ];

  public getEvolutionStage(userId: string): number {
    const bl = this.getUserBloodline(userId);
    if (!bl) return 0;
    return bl.evolution_stage || 1;
  }

  public canEvolve(userId: string): { eligible: boolean; reason: string; stage: number; cost: number } {
    const bl = this.getUserBloodline(userId);
    if (!bl) return { eligible: false, reason: 'Chưa có huyết mạch.', stage: 0, cost: 0 };

    const currentStage = bl.evolution_stage || 1;
    if (currentStage >= 3) return { eligible: false, reason: 'Đã đạt giai đoạn tối đa.', stage: currentStage, cost: 0 };

    const nextStage = this.EVOLUTION_STAGES[currentStage]; // next stage info
    if (!nextStage) return { eligible: false, reason: 'Không có giai đoạn tiếp theo.', stage: currentStage, cost: 0 };

    // Check requirements
    if (nextStage.requirement === 'level_50') {
      const user = db.prepare('SELECT level FROM users WHERE discord_id = ?').get(userId) as { level: number } | undefined;
      if (!user || user.level < 50) return { eligible: false, reason: 'Cần level 50+.', stage: currentStage, cost: nextStage.cost };
    }
    if (nextStage.requirement === 'prestige_1') {
      const user = db.prepare('SELECT luan_hoi_count FROM users WHERE discord_id = ?').get(userId) as { luan_hoi_count: number } | undefined;
      if (!user || user.luan_hoi_count < 1) return { eligible: false, reason: 'Cần Luân Hồi lần 1.', stage: currentStage, cost: nextStage.cost };
    }

    return { eligible: true, reason: '', stage: currentStage, cost: nextStage.cost };
  }

  public evolve(userId: string): { success: boolean; message: string } {
    const check = this.canEvolve(userId);
    if (!check.eligible) return { success: false, message: `❌ ${check.reason}` };

    const user = db.prepare('SELECT coin_ha_pham FROM users WHERE discord_id = ?').get(userId) as { coin_ha_pham: number };
    if (user.coin_ha_pham < check.cost) return { success: false, message: `❌ Cần ${check.cost} LT (hiện có: ${user.coin_ha_pham}).` };

    const newStage = check.stage + 1;
    const stageInfo = this.EVOLUTION_STAGES[newStage - 1];

    db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? WHERE discord_id = ?').run(check.cost, userId);
    db.prepare('UPDATE user_bloodlines SET evolution_stage = ? WHERE user_id = ?').run(newStage, userId);

    return {
      success: true,
      message: `✨ **Huyết Mạch Tiến Hóa!**\nGiai đoạn ${newStage}: **${stageInfo.name}**\n${stageInfo.bonus}`,
    };
  }

  public getEvolutionDescription(userId: string): string {
    const currentStage = this.getEvolutionStage(userId);
    let msg = `🩸 **Tiến Hóa Huyết Mạch** — Giai đoạn: **${currentStage}/3**\n\n`;

    for (const stage of this.EVOLUTION_STAGES) {
      const isCurrent = stage.stage === currentStage;
      const isUnlocked = stage.stage <= currentStage;
      const status = isCurrent ? '⚡' : isUnlocked ? '✅' : '🔒';
      msg += `${status} **Giai đoạn ${stage.stage}: ${stage.name}**\n`;
      msg += `   ${stage.bonus}\n`;
      if (!isUnlocked && stage.cost > 0) msg += `   💰 Chi phí: ${stage.cost} LT\n`;
      msg += '\n';
    }
    return msg;
  }
}

export const bloodlineService = new BloodlineService();
