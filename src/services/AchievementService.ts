import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export interface Achievement {
  id: string;
  name: string;
  category: 'tu_luyen' | 'chien_dau' | 'pvp' | 'sung_thu' | 'sinh_hoat';
  description: string;
  icon: string;
  target_value: number;
  reward_title: string | null;
  reward_exp: number;
  reward_coins: number;
  sort_order: number;
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
          this.awardReward(userId, achievement, now);
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
        this.awardReward(userId, achievement, now);
        newlyUnlocked.push(achievement);
      }
    })();

    return newlyUnlocked;
  }

  /**
   * Trao thưởng khi hoàn thành thành tựu
   */
  private awardReward(userId: string, achievement: Achievement, timestamp: number): void {
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

    // Ghi audit log
    const { systemConfigService } = require('./SystemConfigService');
    systemConfigService.writeAuditLog(userId, 'achievement_unlocked', {
      achievementId: achievement.id,
      name: achievement.name,
      rewardExp: achievement.reward_exp,
      rewardCoins: achievement.reward_coins,
      rewardTitle: achievement.reward_title
    });
  }

  /**
   * Đặt danh hiệu (title) hiện tại cho người dùng
   */
  setTitle(userId: string, title: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Nhân vật không tồn tại!' };

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
    } catch (e) {}

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
}

export const achievementService = new AchievementService();
