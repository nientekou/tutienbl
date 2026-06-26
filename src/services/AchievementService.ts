import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { systemConfigService } from './SystemConfigService';

export interface Achievement {
  id: string;
  name: string;
  category: 'tu_luyen' | 'chien_dau' | 'pvp' | 'sung_thu' | 'sinh_hoat' | 'hidden';
  description: string;
  icon: string;
  target_value: number;
  reward_title: string | null;
  reward_exp: number;
  reward_coins: number;
  sort_order: number;
  // B-05: Achievement Points
  points: number;
  is_hidden: number; // 0 or 1
}

export interface UserAchievement {
  id: number;
  user_id: string;
  achievement_id: string;
  progress: number;
  is_completed: number;
  completed_at: number | null;
}

export interface AchievementWithProgress extends Achievement {
  progress: number;
  is_completed: boolean;
  completed_at: number | null;
}

class AchievementService {
  /**
   * Lấy thông tin một thành tựu
   */
  getAchievement(id: string): Achievement | null {
    return db.prepare('SELECT * FROM achievements WHERE id = ?').get(id) as Achievement | null;
  }

  /**
   * Lấy tất cả thành tựu (đã sắp xếp)
   */
  getAllAchievements(): Achievement[] {
    return db.prepare('SELECT * FROM achievements ORDER BY sort_order ASC').all() as Achievement[];
  }

  /**
   * Lấy thành tựu theo danh mục
   */
  getAchievementsByCategory(category: string): Achievement[] {
    return db.prepare('SELECT * FROM achievements WHERE category = ? ORDER BY sort_order ASC').all(category) as Achievement[];
  }

  /**
   * Lấy thành tựu của người dùng kèm trạng thái
   */
  getUserAchievements(userId: string): AchievementWithProgress[] {
    const allAchievements = this.getAllAchievements();
    const userAchievements = db.prepare(
      'SELECT * FROM user_achievements WHERE user_id = ?'
    ).all(userId) as UserAchievement[];

    const uaMap = new Map<string, UserAchievement>();
    for (const ua of userAchievements) {
      uaMap.set(ua.achievement_id, ua);
    }

    return allAchievements.map(a => {
      const ua = uaMap.get(a.id);
      return {
        ...a,
        progress: ua?.progress || 0,
        is_completed: (ua?.is_completed || 0) === 1,
        completed_at: ua?.completed_at || null
      };
    });
  }

  /**
   * Lấy thành tựu đã hoàn thành của người dùng
   */
  getCompletedAchievements(userId: string): AchievementWithProgress[] {
    return this.getUserAchievements(userId).filter(a => a.is_completed);
  }

  /**
   * Đếm số thành tựu đã hoàn thành
   */
  countCompleted(userId: string): number {
    const result = db.prepare(
      "SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ? AND is_completed = 1"
    ).get(userId) as { c: number };
    return result.c;
  }

  /**
   * Cập nhật tiến trình thành tựu và tự động trao thưởng nếu đủ điều kiện
   * @returns Mảng các thành tựu vừa được mở khóa (có phần thưởng)
   */
  updateProgress(userId: string, achievementId: string, progressIncrement: number = 1): Achievement[] {
    const achievement = this.getAchievement(achievementId);
    if (!achievement) return [];

    // Kiểm tra user có tồn tại không
    const user = userRepository.get(userId);
    if (!user) return [];

    const newlyUnlocked: Achievement[] = [];
    const pendingAuditLogs: Array<{ action: string; details: object }> = [];

    const tx = db.transaction(() => {
      // Lấy hoặc tạo bản ghi user_achievement
      let ua = db.prepare(
        'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
      ).get(userId, achievementId) as UserAchievement | undefined;

      if (!ua) {
        db.prepare(`
          INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, completed_at)
          VALUES (?, ?, 0, 0, NULL)
        `).run(userId, achievementId);
        ua = {
          id: 0,
          user_id: userId,
          achievement_id: achievementId,
          progress: 0,
          is_completed: 0,
          completed_at: null
        };
      }

      // Đã hoàn thành rồi thì không cập nhật (trừ khi bị lỗi null completed_at thì tự sửa lỗi/trao thưởng)
      if (ua.is_completed === 1) {
        if (ua.completed_at === null) {
          const now = Math.floor(Date.now() / 1000);
          db.prepare(
            'UPDATE user_achievements SET completed_at = ? WHERE user_id = ? AND achievement_id = ?'
          ).run(now, userId, achievementId);
          this.awardReward(userId, achievement, now, pendingAuditLogs);
          newlyUnlocked.push(achievement);
        }
        return;
      }

      // Cập nhật tiến trình
      const newProgress = Math.min(ua.progress + progressIncrement, achievement.target_value);
      db.prepare(
        'UPDATE user_achievements SET progress = ? WHERE user_id = ? AND achievement_id = ?'
      ).run(newProgress, userId, achievementId);

      // Kiểm tra xem có đạt thành tựu không
      if (newProgress >= achievement.target_value && ua.is_completed === 0) {
        const now = Math.floor(Date.now() / 1000);
        db.prepare(
          'UPDATE user_achievements SET is_completed = 1, completed_at = ? WHERE user_id = ? AND achievement_id = ?'
        ).run(now, userId, achievementId);

        // Trao thưởng
        this.awardReward(userId, achievement, now, pendingAuditLogs);
        newlyUnlocked.push(achievement);
      }
    })();

    // Ghi audit log SAU khi transaction commit — tránh SQLITE_BUSY
    for (const log of pendingAuditLogs) {
      systemConfigService.writeAuditLog(userId, log.action, log.details);
    }

    return newlyUnlocked;
  }

  /**
   * Trao thưởng khi hoàn thành thành tựu
   */
  private awardReward(userId: string, achievement: Achievement, timestamp: number, pendingAuditLogs?: Array<{ action: string; details: object }>): void {
    const user = userRepository.get(userId);
    if (!user) return;

    // Thưởng EXP (Tu Vi)
    if (achievement.reward_exp > 0) {
      const newTuVi = user.tu_vi + achievement.reward_exp;
      userRepository.update(userId, { tu_vi: newTuVi });
    }

    // Thưởng coins
    if (achievement.reward_coins > 0) {
      userRepository.update(userId, {
        coin_ha_pham: user.coin_ha_pham + achievement.reward_coins
      });
    }

    // Trao danh hiệu đặc biệt
    if (achievement.reward_title) {
      // Kiểm tra đã có title chưa
      const existing = db.prepare(
        'SELECT id FROM user_titles WHERE user_id = ? AND title = ?'
      ).get(userId, achievement.reward_title) as any;

      if (!existing) {
        db.prepare(`
          INSERT INTO user_titles (user_id, title, source, unlocked_at)
          VALUES (?, ?, 'achievement', ?)
        `).run(userId, achievement.reward_title, timestamp);

        // Tự động equip title nếu chưa có title đặc biệt
        if (user.title === 'Tán Tu' || !user.title) {
          userRepository.update(userId, { title: achievement.reward_title });
        }
      }
    }

    // Ghi audit log (deferred nếu có transaction)
    const auditDetails = {
      achievementId: achievement.id,
      name: achievement.name,
      rewardExp: achievement.reward_exp,
      rewardCoins: achievement.reward_coins,
      rewardTitle: achievement.reward_title
    };
    if (pendingAuditLogs) {
      pendingAuditLogs.push({ action: 'achievement_unlocked', details: auditDetails });
    } else {
      systemConfigService.writeAuditLog(userId, 'achievement_unlocked', auditDetails);
    }
  }

  /**
   * Đặt danh hiệu (title) hiện tại cho người dùng
   */
  setTitle(userId: string, title: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật!' };

    // Kiểm tra title có trong danh sách đã mở khóa không
    const hasTitle = db.prepare(
      'SELECT id FROM user_titles WHERE user_id = ? AND title = ?'
    ).get(userId, title) as any;

    if (!hasTitle) {
      return { success: false, message: `❌ Danh hiệu **${title}** chưa được mở khóa!` };
    }

    userRepository.update(userId, { title });
    return { success: true, message: `✅ Đã đặt danh hiệu thành **${title}**!` };
  }

  /**
   * Lấy danh sách danh hiệu đã mở khóa
   */
  getUserTitles(userId: string): { title: string; source: string; unlocked_at: number }[] {
    return db.prepare(
      'SELECT title, source, unlocked_at FROM user_titles WHERE user_id = ? ORDER BY unlocked_at DESC'
    ).all(userId) as any[];
  }

  /**
   * Tính lại tiến trình thành tựu Ý Cảnh tổng (dùng khi xem thành tựu)
   */
  public recalculateYCanhAchievement(userId: string): Achievement[] {
    const user = userRepository.get(userId);
    if (!user) return [];

    let yCanhMap: Record<string, number> = {};
    try {
      yCanhMap = JSON.parse(user.y_canh || '{}');
    } catch (e) { console.warn('[AchievementService] Failed to parse y_canh for achievement tracking:', e); }

    const totalYCLevels = Object.values(yCanhMap).reduce((a: number, b: number) => a + b, 0);
    return this.setProgress(userId, 'tl_18', totalYCLevels);
  }

  /**
   * Kiểm tra và fix các thành tựu bị kẹt (đủ điều kiện nhưng progress = 0)
   * @returns Danh sách thành tựu vừa được fix
   */
  public fixStuckAchievements(userId: string): Achievement[] {
    const user = userRepository.get(userId);
    if (!user) return [];

    const fixed: Achievement[] = [];

    // 1. Level achievements (tl_1 to tl_8)
    const levelAchievements = [
      { id: 'tl_1', req: 10 }, { id: 'tl_2', req: 25 }, { id: 'tl_3', req: 50 },
      { id: 'tl_4', req: 100 }, { id: 'tl_5', req: 150 }, { id: 'tl_6', req: 200 },
      { id: 'tl_7', req: 300 }, { id: 'tl_8', req: 380 },
    ];
    for (const la of levelAchievements) {
      if (user.level >= la.req) {
        const result = this.setProgress(userId, la.id, la.req);
        fixed.push(...result);
      }
    }

    // 2. Y Canh achievement (tl_18)
    const ycResult = this.recalculateYCanhAchievement(userId);
    fixed.push(...ycResult);

    // 3. Bloodline achievement (tl_19)
    const { bloodlineService } = require('./BloodlineService');
    const bloodline = bloodlineService.getUserBloodline(userId);
    if (bloodline) {
      const result = this.setProgress(userId, 'tl_19', 1);
      fixed.push(...result);
    }

    // 4. Sect achievement
    if (user.sect_id) {
      const result = this.setProgress(userId, 'sh_1', 1);
      fixed.push(...result);
    }

    // 5. PvP achievements
    if (user.pvp_wins >= 1) {
      const result = this.setProgress(userId, 'pvp_1', user.pvp_wins);
      fixed.push(...result);
    }
    if (user.pvp_wins >= 10) {
      const result = this.setProgress(userId, 'pvp_2', user.pvp_wins);
      fixed.push(...result);
    }

    // 6. Reincarnation achievement
    if (user.luan_hoi_count > 0) {
      const result = this.setProgress(userId, 'tl_9', user.luan_hoi_count);
      fixed.push(...result);
    }

    return fixed;
  }

  /**
   * Kiểm tra nhiều thành tựu cùng lúc (dùng khi cần check bulk)
   * @returns Các thành tựu vừa được mở khóa
   */
  updateMultipleProgress(userId: string, updates: { achievementId: string; increment?: number }[]): Achievement[] {
    const allNewlyUnlocked: Achievement[] = [];
    for (const update of updates) {
      const unlocked = this.updateProgress(userId, update.achievementId, update.increment || 1);
      allNewlyUnlocked.push(...unlocked);
    }
    return allNewlyUnlocked;
  }

  /**
   * Kiểm tra và trao thành tựu dựa trên level (gọi khi người dùng tăng cấp)
   */
  checkLevelAchievements(userId: string, level: number): Achievement[] {
    const achievements = [
      { id: 'tl_1', req: 10 },
      { id: 'tl_2', req: 25 },
      { id: 'tl_3', req: 50 },
      { id: 'tl_4', req: 100 },
      { id: 'tl_5', req: 150 },
      { id: 'tl_6', req: 200 },
      { id: 'tl_7', req: 300 },
      { id: 'tl_8', req: 380 },
    ];
    const newlyUnlocked: Achievement[] = [];
    for (const a of achievements) {
      if (level >= a.req) {
        const unlocked = this.updateProgress(userId, a.id, a.req); // Set đủ target_value
        newlyUnlocked.push(...unlocked);
      }
    }
    return newlyUnlocked;
  }

  /**
   * Đặt thẳng progress cho thành tựu (dùng khi cần check giá trị tuyệt đối)
   */
  setProgress(userId: string, achievementId: string, currentValue: number): Achievement[] {
    const achievement = this.getAchievement(achievementId);
    if (!achievement) return [];

    const ua = db.prepare(
      'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
    ).get(userId, achievementId) as UserAchievement | undefined;

    const progress = Math.min(currentValue, achievement.target_value);

    if (!ua) {
      const isCompleted = progress >= achievement.target_value ? 1 : 0;
      const now = Math.floor(Date.now() / 1000);
      const completedAt = isCompleted ? now : null;
      db.prepare(`
        INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, achievementId, progress, isCompleted, completedAt);

      if (isCompleted) {
        this.awardReward(userId, achievement, now);
        return [achievement];
      }
    } else if (ua.is_completed === 0) {
      db.prepare(
        'UPDATE user_achievements SET progress = ? WHERE user_id = ? AND achievement_id = ?'
      ).run(progress, userId, achievementId);

      if (progress >= achievement.target_value) {
        const now = Math.floor(Date.now() / 1000);
        db.prepare(
          'UPDATE user_achievements SET is_completed = 1, completed_at = ? WHERE user_id = ? AND achievement_id = ?'
        ).run(now, userId, achievementId);
        this.awardReward(userId, achievement, now);
        return [achievement];
      }
    } else if (ua.is_completed === 1 && ua.completed_at === null) {
      // Tự sửa lỗi nếu trước đây đã hoàn thành nhưng chưa được lưu completed_at (chưa nhận quà)
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        'UPDATE user_achievements SET completed_at = ? WHERE user_id = ? AND achievement_id = ?'
      ).run(now, userId, achievementId);
      this.awardReward(userId, achievement, now);
      return [achievement];
    }

    return [];
  }

  // === B-05: Achievement Points System ===

  /**
   * B-05: Tính tổng achievement points của user
   */
  getTotalPoints(userId: string): number {
    const completed = this.getCompletedAchievements(userId);
    return completed.reduce((sum, a) => sum + (a.points || 0), 0);
  }

  /**
   * B-05: Get achievement description with points for profile
   */
  getAchievementSummary(userId: string): string {
    const total = this.getAllAchievements().length;
    const completed = this.countCompleted(userId);
    const points = this.getTotalPoints(userId);
    return `🏆 ${completed}/${total} thành tựu (${points} điểm)`;
  }

  /**
   * B-05: Hidden achievement definitions
   */
  private readonly HIDDEN_ACHIEVEMENTS = [
    { id: 'hidden_1', name: 'Vô Cực', icon: '♾️', description: 'Vượt qua tầng 100+ Tháp Trấn Yêu', target: 100, points: 10 },
    { id: 'hidden_2', name: 'Thương Nhân', icon: '💰', description: 'Kiếm 1,000,000 Linh Thạch từ chợ trời', target: 1000000, points: 8 },
    { id: 'hidden_3', name: 'Phúc Lạc', icon: '🌟', description: '100 ngày đăng nhập liên tiếp', target: 100, points: 10 },
    { id: 'hidden_4', name: 'Sát Thủ', icon: '🗡️', description: 'Thắng 100 trận tỷ thí liên tiếp', target: 100, points: 9 },
    { id: 'hidden_5', name: 'Đại Đan Sư', icon: '⚗️', description: 'Luyện chế 500 đan dược', target: 500, points: 7 },
    { id: 'hidden_6', name: 'Thú Vương', icon: '🐉', description: 'Sở hữu 15+ linh thú', target: 15, points: 8 },
    { id: 'hidden_7', name: 'Hỏa Thần', icon: '🔥', description: 'Đạt Hỏa Lửa cấp 8', target: 1, points: 9 },
    { id: 'hidden_8', name: 'Bất Tử', icon: '💀', description: 'Luân hồi 10 lần', target: 10, points: 10 },
    { id: 'hidden_9', name: 'Tông Sư', icon: '☯️', description: 'Tốt nghiệp 10 đệ tử', target: 10, points: 8 },
    { id: 'hidden_10', name: 'Thiên Hạ Đệ Nhất', icon: '👑', description: 'Đạt top 1 trên bảng xếp hạng', target: 1, points: 10 },
  ];

  /**
   * B-05: Check and award hidden achievements
   */
  checkHiddenAchievements(userId: string): Achievement[] {
    const user = userRepository.get(userId);
    if (!user) return [];

    const unlocked: Achievement[] = [];

    // hidden_1: Tower floor 100+
    try {
      const towerProgress = db.prepare('SELECT max_floor FROM roguelike_progress WHERE user_id = ?').get(userId) as any;
      if (towerProgress && towerProgress.max_floor >= 100) {
        const result = this.updateProgress(userId, 'hidden_1', 1);
        unlocked.push(...result);
      }
    } catch {}

    // hidden_3: Login streak 100
    try {
      const loginRecord = db.prepare('SELECT streak FROM user_daily_logins WHERE user_id = ?').get(userId) as any;
      if (loginRecord && loginRecord.streak >= 100) {
        const result = this.updateProgress(userId, 'hidden_3', 1);
        unlocked.push(...result);
      }
    } catch {}

    // hidden_6: Beast count 15+
    try {
      const beastCount = db.prepare('SELECT COUNT(*) as c FROM rare_beasts WHERE user_id = ?').get(userId) as { c: number };
      if (beastCount.c >= 15) {
        const result = this.updateProgress(userId, 'hidden_6', 1);
        unlocked.push(...result);
      }
    } catch {}

    // hidden_8: Reincarnation 10
    if (user.luan_hoi_count >= 10) {
      const result = this.updateProgress(userId, 'hidden_8', 1);
      unlocked.push(...result);
    }

    // hidden_9: Mentor graduated 10
    try {
      const gradCount = db.prepare("SELECT COUNT(*) as c FROM mentorships WHERE mentor_id = ? AND status = 'graduated'").get(userId) as { c: number };
      if (gradCount.c >= 10) {
        const result = this.updateProgress(userId, 'hidden_9', 1);
        unlocked.push(...result);
      }
    } catch {}

    return unlocked;
  }

  // === D-04: Achievement V3 — Categories, Chains, Points Shop ===

  /**
   * D-04: Get achievements by category with stats
   */
  getCategoryStats(userId: string): { category: string; total: number; completed: number; points: number }[] {
    const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat', 'hidden'];
    const allAchievements = this.getAllAchievements();

    return categories.map(cat => {
      const catAchievements = allAchievements.filter(a => a.category === cat);
      const completedCat = catAchievements.filter(a => {
        const ua = db.prepare('SELECT is_completed FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
          .get(userId, a.id) as any;
        return ua?.is_completed === 1;
      });

      return {
        category: cat,
        total: catAchievements.length,
        completed: completedCat.length,
        points: completedCat.reduce((sum, a) => sum + (a.points || 0), 0)
      };
    });
  }

  /**
   * D-04: Achievement chain — multi-part achievements
   */
  private readonly ACHIEVEMENT_CHAINS = [
    {
      id: 'chain_battle',
      name: 'Chiến Binh',
      parts: [
        { id: 'chain_battle_1', name: 'Chiến Binh Tập Sự', target: 10, reward: 100 },
        { id: 'chain_battle_2', name: 'Chiến Binh Lão Luyện', target: 100, reward: 500 },
        { id: 'chain_battle_3', name: 'Chiến Binh Huyền Thoại', target: 1000, reward: 2000 },
      ]
    },
    {
      id: 'chain_explore',
      name: 'Thám Hiểm Viên',
      parts: [
        { id: 'chain_explore_1', name: 'Người Mới', target: 5, reward: 100 },
        { id: 'chain_explore_2', name: 'Thám Hiểm Gia', target: 25, reward: 500 },
        { id: 'chain_explore_3', name: 'Bậc Thầy Thám Hiểm', target: 100, reward: 2000 },
      ]
    },
    {
      id: 'chain_craft',
      name: 'Đại Đan Sư',
      parts: [
        { id: 'chain_craft_1', name: 'Đan Sư Mới', target: 10, reward: 100 },
        { id: 'chain_craft_2', name: 'Đan Sư Giỏi', target: 50, reward: 500 },
        { id: 'chain_craft_3', name: 'Đại Đan Sư', target: 200, reward: 2000 },
      ]
    },
  ];

  /**
   * D-04: Get achievement chains
   */
  getAchievementChains(userId: string): { chainId: string; chainName: string; parts: { id: string; name: string; progress: number; target: number; completed: boolean; reward: number }[] }[] {
    return this.ACHIEVEMENT_CHAINS.map(chain => ({
      chainId: chain.id,
      chainName: chain.name,
      parts: chain.parts.map(part => {
        const ua = db.prepare('SELECT progress, is_completed FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
          .get(userId, part.id) as any;

        return {
          id: part.id,
          name: part.name,
          progress: ua?.progress || 0,
          target: part.target,
          completed: ua?.is_completed === 1,
          reward: part.reward
        };
      })
    }));
  }

  /**
   * D-04: Achievement points shop
   */
  private readonly POINTS_SHOP_ITEMS = [
    { id: 'shop_aura', name: 'Hào Quang Thành Tựu', cost: 50, type: 'cosmetic' },
    { id: 'shop_title', name: 'Danh Hiệu Đặc Biệt', cost: 100, type: 'title' },
    { id: 'shop_exp_boost', name: 'Tăng Tốc EXP 24h', cost: 30, type: 'convenience' },
    { id: 'shop_linh_thach', name: '5000 Linh Thạch', cost: 20, type: 'currency' },
  ];

  /**
   * D-04: Get points shop items
   */
  getPointsShopItems(): { id: string; name: string; cost: number; type: string }[] {
    return this.POINTS_SHOP_ITEMS;
  }

  /**
   * D-04: Buy from points shop
   */
  buyFromPointsShop(userId: string, itemId: string): { success: boolean; message: string } {
    const item = this.POINTS_SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { success: false, message: '❌ Vật phẩm không tồn tại!' };

    const points = this.getTotalPoints(userId);
    if (points < item.cost) {
      return { success: false, message: `❌ Không đủ điểm! (Cần ${item.cost}, có ${points})` };
    }

    // Apply reward
    if (item.type === 'currency') {
      const user = userRepository.get(userId);
      if (user) {
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + 5000 });
      }
    } else if (item.type === 'title') {
      db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
        .run(userId, item.name, 'achievement', Math.floor(Date.now() / 1000));
    }

    return { success: true, message: `✅ Đã mua **${item.name}**! (-${item.cost} điểm)` };
  }

  /**
   * D-04: Get achievement description for UI
   */
  getAchievementDescription(userId: string): string {
    const stats = this.getCategoryStats(userId);
    const points = this.getTotalPoints(userId);
    const completed = this.countCompleted(userId);
    const total = this.getAllAchievements().length;

    let msg = `🏆 **Thành Tựu** — ${completed}/${total} (${points} điểm)\n\n`;

    const categoryNames: Record<string, string> = {
      tu_luyen: '🧘 Tu Luyện',
      chien_dau: '⚔️ Chiến Đấu',
      pvp: '🏆 PvP',
      sung_thu: '🐉 Sủng Thú',
      sinh_hoat: '🏠 Sinh Hoạt',
      hidden: '🔮 Ẩn'
    };

    for (const s of stats) {
      if (s.total > 0) {
        const bar = '█'.repeat(Math.round(s.completed / s.total * 10)) + '░'.repeat(10 - Math.round(s.completed / s.total * 10));
        msg += `${categoryNames[s.category] || s.category}: ${bar} ${s.completed}/${s.total} (${s.points} điểm)\n`;
      }
    }

    return msg;
  }

  // === A-05: Achievement Rotation ===

  /**
   * A-05: Get weekly achievements (5 per week, rotating)
   */
  getWeeklyAchievements(): { id: string; name: string; description: string; target: number; reward: number }[] {
    const weekKey = this.getWeekKey();
    const hash = this.dateHash(weekKey);

    const allWeekly = [
      { id: 'wa_combat_1', name: 'Chiến Đấu Hàng Tuần', description: 'Thắng 10 trận PvP', target: 10, reward: 200 },
      { id: 'wa_explore_1', name: 'Thám Hiểm Hàng Tuần', description: 'Hoàn thành 5 lần thám hiểm', target: 5, reward: 150 },
      { id: 'wa_craft_1', name: 'Chế Tạo Hàng Tuần', description: 'Chế tạo 10 vật phẩm', target: 10, reward: 180 },
      { id: 'wa_social_1', name: 'Giao Lưu Hàng Tuần', description: 'Giúp đỡ 5 người chơi khác', target: 5, reward: 120 },
      { id: 'wa_progress_1', name: 'Tu Luyện Hàng Tuần', description: 'Đạt 10000 Tu Vi', target: 10000, reward: 250 },
      { id: 'wa_combat_2', name: 'Sát Thủ Hàng Tuần', description: 'Tiêu diệt 50 yêu thú', target: 50, reward: 220 },
      { id: 'wa_explore_2', name: 'Thợ Săn Kho Báu', description: 'Tìm 3 kho báu', target: 3, reward: 200 },
      { id: 'wa_craft_2', name: 'Đại Sư Chế Tạo', description: 'Chế tạo 1 vật phẩm Huyền Thoại', target: 1, reward: 300 },
      { id: 'wa_social_2', name: 'Sư Phụ Hàng Tuần', description: 'Hướng dẫn đồ đệ 3 lần', target: 3, reward: 180 },
      { id: 'wa_progress_2', name: 'Thăng Cấp Hàng Tuần', description: 'Tăng 5 cấp', target: 5, reward: 200 },
    ];

    // Select 5 based on week hash
    const selected: typeof allWeekly = [];
    const indices = new Set<number>();
    while (selected.length < 5 && indices.size < allWeekly.length) {
      const idx = (hash + selected.length) % allWeekly.length;
      if (!indices.has(idx)) {
        indices.add(idx);
        selected.push(allWeekly[idx]);
      }
    }

    return selected;
  }

  /**
   * A-05: Get seasonal achievements (10 per season)
   */
  getSeasonalAchievements(): { id: string; name: string; description: string; target: number; reward: number }[] {
    const month = new Date().getMonth() + 1;

    return [
      { id: `sa_${month}_1`, name: 'Chiến Đấu Mùa', description: 'Thắng 50 trận PvP trong mùa', target: 50, reward: 500 },
      { id: `sa_${month}_2`, name: 'Thám Hiểm Mùa', description: 'Hoàn thành 20 lần thám hiểm', target: 20, reward: 400 },
      { id: `sa_${month}_3`, name: 'Chế Tạo Mùa', description: 'Chế tạo 50 vật phẩm', target: 50, reward: 450 },
      { id: `sa_${month}_4`, name: 'Giao Lưu Mùa', description: 'Giúp đỡ 20 người chơi', target: 20, reward: 350 },
      { id: `sa_${month}_5`, name: 'Tu Luyện Mùa', description: 'Đạt 50000 Tu Vi', target: 50000, reward: 600 },
      { id: `sa_${month}_6`, name: 'Sưu Tầm Mùa', description: 'Thu thập 10 vật phẩm hiếm', target: 10, reward: 500 },
      { id: `sa_${month}_7`, name: 'Chiến Binh Mùa', description: 'Tiêu diệt 200 yêu thú', target: 200, reward: 550 },
      { id: `sa_${month}_8`, name: 'Sư Phụ Mùa', description: 'Hướng dẫn 5 đồ đệ', target: 5, reward: 400 },
      { id: `sa_${month}_9`, name: 'Môn Chủ Mùa', description: 'Quyên góp 10000 cho môn phái', target: 10000, reward: 450 },
      { id: `sa_${month}_10`, name: 'Quán Quân Mùa', description: 'Chiến thắng một giải đấu', target: 1, reward: 700 },
    ];
  }

  /**
   * A-05: Get hidden achievements (5 new ones)
   */
  getHiddenAchievements(): { id: string; name: string; description: string; target: number; reward: number }[] {
    return [
      { id: 'ha_secret_1', name: 'Thám Tử', description: 'Khám phá địa điểm ẩn', target: 1, reward: 300 },
      { id: 'ha_secret_2', name: 'Người Giải Mã', description: 'Giải mã 3 nhiệm vụ NPC thần bí', target: 3, reward: 400 },
      { id: 'ha_secret_3', name: 'Vận May', description: 'Kích hoạt 10 sự kiện ngẫu nhiên', target: 10, reward: 350 },
      { id: 'ha_secret_4', name: 'Cao Thủ Sự Kiện', description: 'Hoàn thành 5 sự kiện mùa', target: 5, reward: 500 },
      { id: 'ha_secret_5', name: 'Vua Khám Phá', description: 'Tìm tất cả vật phẩm ẩn', target: 10, reward: 600 },
    ];
  }

  /**
   * A-05: Check weekly achievement progress
   */
  checkWeeklyAchievements(userId: string): { id: string; progress: number; target: number; completed: boolean }[] {
    const weekly = this.getWeeklyAchievements();
    return weekly.map(a => {
      const ua = db.prepare('SELECT progress FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
        .get(userId, a.id) as any;
      const progress = ua?.progress || 0;
      return { id: a.id, progress, target: a.target, completed: progress >= a.target };
    });
  }

  private getWeekKey(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const day = vn.getUTCDay() || 7;
    vn.setUTCDate(vn.getUTCDate() - (day - 1));
    vn.setUTCHours(0, 0, 0, 0);
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

export const achievementService = new AchievementService();
