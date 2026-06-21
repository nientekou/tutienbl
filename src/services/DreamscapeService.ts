import db from '../database/database';
import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import { CombatEngine, Combatant } from './CombatEngine';
import { bloodlineService } from './BloodlineService';
import { inventoryService } from './InventoryService';

export interface DreamscapeData {
  user_id: string;
  current_floor: number;
  max_floor: number;
  score: number;
  weekly_entries: number;
  hp_remaining: number;
  last_reset: number;
}

export class DreamscapeService {
  /**
   * Khởi tạo hoặc lấy dữ liệu Dreamscape của user
   */
  public getDreamscapeData(userId: string): DreamscapeData {
    let data = db.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId) as DreamscapeData | undefined;
    if (!data) {
      db.prepare('INSERT INTO user_dreamscapes (user_id) VALUES (?)').run(userId);
      data = db.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId) as DreamscapeData;
    }

    const currentWeekStart = this.getStartOfWeek();
    if (data.last_reset < currentWeekStart) {
      // Reset tuần mới
      db.prepare('UPDATE user_dreamscapes SET current_floor = 1, score = 0, weekly_entries = 0, hp_remaining = -1, last_reset = ? WHERE user_id = ?')
        .run(currentWeekStart, userId);
      data.current_floor = 1;
      data.score = 0;
      data.weekly_entries = 0;
      data.hp_remaining = -1;
      data.last_reset = currentWeekStart;
    }

    return data;
  }

  private getStartOfWeek(): number {
    const now = new Date();
    // Set to start of current week (Monday 00:00)
    const day = now.getDay() || 7; 
    if (day !== 1) now.setHours(-24 * (day - 1));
    now.setHours(0, 0, 0, 0);
    return Math.floor(now.getTime() / 1000);
  }

  /**
   * Tạo bản sao (Shadow) của người chơi
   */
  private generateShadow(user: UserEntity, floor: number): Combatant {
    let multiplier = 1.0;
    if (floor >= 11 && floor <= 20) multiplier = 1.2;
    else if (floor >= 21 && floor <= 30) multiplier = 1.5;
    else if (floor >= 31 && floor <= 50) multiplier = 2.0;

    // Shadow không có bloodline, pet, chỉ có stats
    return {
      name: `Bóng Tối [Tầng ${floor}]`,
      hp: Math.round((user.base_hp || 100) * multiplier),
      maxHp: Math.round((user.base_hp || 100) * multiplier),
      atk: Math.round((user.base_atk || 15) * multiplier),
      def: Math.round((user.base_def || 10) * multiplier),
      crit: (user.base_crit || 0.05),
      critRes: (user.base_crit_res || 0),
      luck: 10,
      speed: (user.base_speed || 100) * multiplier,
      dodge: (user.base_dodge || 0.05)
    };
  }

  /**
   * Khiêu chiến
   */
  public challenge(userId: string): { success: boolean; message: string; log?: string[]; isWin?: boolean; currentFloor?: number } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };

    const data = this.getDreamscapeData(userId);

    if (data.current_floor > 50) {
      return { success: false, message: 'Đạo hữu đã vượt qua tầng 50, chạm tới đỉnh cao Vọng Tưởng tuần này!' };
    }

    // Nếu ở tầng 1 và chưa có máu lưu trữ -> bắt đầu lượt mới
    if (data.current_floor === 1 && data.hp_remaining === -1) {
      if (data.weekly_entries >= 3) {
        return { success: false, message: 'Đạo hữu đã hết số lần khiêu chiến Vọng Tưởng trong tuần này (3/3).' };
      }
      db.prepare('UPDATE user_dreamscapes SET weekly_entries = weekly_entries + 1 WHERE user_id = ?').run(userId);
    }

    const activeStats = inventoryService.getActiveStats(userId);
    if (!activeStats) return { success: false, message: 'Lỗi chỉ số người chơi.' };
    const startHp = data.hp_remaining !== -1 ? data.hp_remaining : activeStats.hp;

    // Lấy kỹ năng trang bị
    const equippedSkillsQuery = db.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId) as { skill_id: string, level: number }[];
    const equippedSkills = equippedSkillsQuery.map(s => {
      const { SKILL_DETAILS } = require('../commands/general/kynang');
      const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
      return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
    });

    const bdl = bloodlineService.getUserBloodline(userId);
    const playerCombatant: Combatant = {
      name: user.name,
      hp: startHp,
      maxHp: activeStats.hp,
      atk: activeStats.atk,
      def: activeStats.def,
      crit: activeStats.crit,
      critRes: activeStats.critRes,
      luck: activeStats.luck,
      speed: activeStats.speed ?? 100,
      dodge: activeStats.dodge ?? 0.05,
      linhCan: user.linh_can,
      equippedSkills: equippedSkills,
      bloodline: bdl ? { id: bdl.bloodline_id, name: bdl.name, level: bdl.level, passives: bdl.passives, rage_effect: bdl.rage_effect, rage_cooldown: bdl.rage_cooldown || 0 } : undefined,
      hasOai: require('./SoulImprintService').soulImprintService.hasOaiActive(userId)
    };

    const shadow = this.generateShadow(user, data.current_floor);

    // Chạy trận đấu với isDreamscape = true
    const result = CombatEngine.run(playerCombatant, shadow, null, 15, true);

    const isWin = result.winner === 'player';
    let message = '';
    
    if (isWin) {
      const scoreGain = (data.current_floor * 1000) + Math.round((result.playerEndingHp / activeStats.hp) * 500) + (result.rounds * 50) + (data.current_floor % 10 === 0 ? 2000 : 0);
      const newScore = data.score + scoreGain;
      const nextFloor = data.current_floor + 1;
      const maxFloor = Math.max(data.max_floor, data.current_floor);

      db.prepare(`
        UPDATE user_dreamscapes 
        SET current_floor = ?, max_floor = ?, score = ?, hp_remaining = ?
        WHERE user_id = ?
      `).run(nextFloor, maxFloor, newScore, result.playerEndingHp, userId);

      message = `🎉 Đạo hữu đã đánh bại Bóng Tối Tầng ${data.current_floor}! Nhận **+${scoreGain}** Điểm Vọng Tưởng.\n\n⚠️ Đạo hữu còn lại **${result.playerEndingHp}/${activeStats.hp}** HP để bước vào tầng tiếp theo!`;
    } else {
      // Thua -> kết thúc run
      db.prepare(`
        UPDATE user_dreamscapes 
        SET current_floor = 1, hp_remaining = -1
        WHERE user_id = ?
      `).run(userId);
      
      message = `💀 Đạo hữu đã bị đánh bại bởi Bóng Tối Tầng ${data.current_floor} và bị đẩy ra khỏi Bí Cảnh. Kết thúc vòng lặp.`;
    }

    return {
      success: true,
      message,
      log: result.log,
      isWin,
      currentFloor: data.current_floor
    };
  }

  public getLeaderboard(limit = 10) {
    return db.prepare(`
      SELECT d.user_id, d.score, d.max_floor, u.name 
      FROM user_dreamscapes d
      JOIN users u ON d.user_id = u.discord_id
      WHERE d.score > 0
      ORDER BY d.score DESC, d.max_floor DESC
      LIMIT ?
    `).all(limit) as { user_id: string; score: number; max_floor: number; name: string }[];
  }
  
  public resetDreamscape(userId: string) {
    // Cho phép người chơi tự reset về tầng 1 nếu đang kẹt
    const data = this.getDreamscapeData(userId);
    if (data.current_floor === 1 && data.hp_remaining === -1) {
      return { success: false, message: 'Đạo hữu đang ở Tầng 1 và chưa bắt đầu khiêu chiến, không cần thiết lập lại.' };
    }
    db.prepare('UPDATE user_dreamscapes SET current_floor = 1, hp_remaining = -1 WHERE user_id = ?').run(userId);
    return { success: true, message: 'Đã đầu hàng Bóng Tối. Vòng lặp hiện tại đã kết thúc, máu và tầng đã được đặt lại.' };
  }
}

export const dreamscapeService = new DreamscapeService();
