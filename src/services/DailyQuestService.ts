import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// ==================== ĐỊNH NGHĨA NHIỆM VỤ ====================
export interface QuestDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  required: number;
  rewardCoin: number;
  rewardTuVi: number;
  rewardNgotinh: number;
  category: 'combat' | 'life' | 'social' | 'special';
}

export const QUEST_POOL: QuestDefinition[] = [
  {
    id: 'daily_tuluyen',
    name: 'Cần Cù Tu Luyện',
    emoji: '🧘',
    description: 'Thực hiện Thiền Định tu luyện 3 lần trong ngày.',
    required: 3,
    rewardCoin: 100,
    rewardTuVi: 300,
    rewardNgotinh: 2,
    category: 'life'
  },
  {
    id: 'daily_bicanh',
    name: 'Chinh Phục Bí Cảnh',
    emoji: '🔮',
    description: 'Hoàn thành 2 lần khiêu chiến Bí Cảnh bất kể kết quả.',
    required: 2,
    rewardCoin: 200,
    rewardTuVi: 500,
    rewardNgotinh: 5,
    category: 'combat'
  },
  {
    id: 'daily_leothap',
    name: 'Leo Tháp Vô Hạn',
    emoji: '🏯',
    description: 'Leo lên 1 tầng mới trong Tháp Vô Hạn.',
    required: 1,
    rewardCoin: 150,
    rewardTuVi: 400,
    rewardNgotinh: 3,
    category: 'combat'
  },
  {
    id: 'daily_lamviec',
    name: 'Chuyên Cần Lao Động',
    emoji: '⛏️',
    description: 'Làm việc kiếm Linh Thạch 3 lần trong ngày.',
    required: 3,
    rewardCoin: 180,
    rewardTuVi: 200,
    rewardNgotinh: 2,
    category: 'life'
  },
  {
    id: 'daily_khambha',
    name: 'Lữ Hành Thiên Địa',
    emoji: '🗺️',
    description: 'Hoàn thành 1 chuyến thám hiểm dã ngoại.',
    required: 1,
    rewardCoin: 250,
    rewardTuVi: 600,
    rewardNgotinh: 8,
    category: 'life'
  },
  {
    id: 'daily_pvp',
    name: 'Thách Đấu Đồng Đạo',
    emoji: '⚔️',
    description: 'Tham gia 1 trận quyết đấu với tu sĩ khác.',
    required: 1,
    rewardCoin: 200,
    rewardTuVi: 400,
    rewardNgotinh: 5,
    category: 'social'
  },
  {
    id: 'daily_tongmon',
    name: 'Phụng Hiến Môn Phái',
    emoji: '☯️',
    description: 'Quyên góp Linh Thạch cho Tông Môn ít nhất 1 lần.',
    required: 1,
    rewardCoin: 120,
    rewardTuVi: 250,
    rewardNgotinh: 3,
    category: 'social'
  },
  {
    id: 'daily_luyendan',
    name: 'Luyện Chế Linh Đan',
    emoji: '🌿',
    description: 'Luyện chế thành công 1 viên đan dược.',
    required: 1,
    rewardCoin: 300,
    rewardTuVi: 500,
    rewardNgotinh: 6,
    category: 'life'
  },
  {
    id: 'daily_sungthu',
    name: 'Phái Linh Thú Chiến Đấu',
    emoji: '🐉',
    description: 'Xuất chiến linh thú sủng vật 1 lần.',
    required: 1,
    rewardCoin: 100,
    rewardTuVi: 200,
    rewardNgotinh: 2,
    category: 'life'
  },
  {
    id: 'daily_worldboss',
    name: 'Chiến Thần Thảo Phạt',
    emoji: '👹',
    description: 'Tấn công Boss Thế Giới 1 lần.',
    required: 1,
    rewardCoin: 400,
    rewardTuVi: 800,
    rewardNgotinh: 10,
    category: 'combat'
  }
];

interface DailyQuestRow {
  id: number;
  user_id: string;
  quest_id: string;
  progress: number;
  required: number;
  reward_coin: number;
  reward_exp: number;
  reward_ngotinh: number;
  is_claimed: number;
  assigned_at: number;
  expires_at: number;
}

class DailyQuestService {
  /**
   * Lấy hoặc tạo mới bộ nhiệm vụ hàng ngày (3 nhiệm vụ ngẫu nhiên/ngày)
   */
  getOrAssignQuests(userId: string): (DailyQuestRow & { definition: QuestDefinition })[] {
    const nowDay = this.getTodayStartTimestamp();
    
    // Kiểm tra nhiệm vụ hôm nay
    const existing = db.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ?
    `).all(userId, nowDay) as DailyQuestRow[];

    if (existing.length > 0) {
      return existing.map(q => ({
        ...q,
        definition: QUEST_POOL.find(p => p.id === q.quest_id)!
      })).filter(q => q.definition);
    }

    // Tạo mới 3 nhiệm vụ ngẫu nhiên
    const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    const expiresAt = nowDay + 86400; // Hết hạn lúc 0h ngày mai

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO daily_quests 
        (user_id, quest_id, progress, required, reward_coin, reward_exp, reward_ngotinh, is_claimed, assigned_at, expires_at)
      VALUES (?, ?, 0, ?, ?, ?, ?, 0, ?, ?)
    `);

    const insertTx = db.transaction(() => {
      for (const quest of selected) {
        insertStmt.run(
          userId,
          quest.id,
          quest.required,
          quest.rewardCoin,
          quest.rewardTuVi,
          quest.rewardNgotinh,
          nowDay,
          expiresAt
        );
      }
    });
    insertTx();

    const newRows = db.prepare(`
      SELECT * FROM daily_quests WHERE user_id = ? AND assigned_at >= ?
    `).all(userId, nowDay) as DailyQuestRow[];

    return newRows.map(q => ({
      ...q,
      definition: QUEST_POOL.find(p => p.id === q.quest_id)!
    })).filter(q => q.definition);
  }

  /**
   * Cập nhật tiến trình nhiệm vụ
   */
  updateProgress(userId: string, questId: string, amount: number = 1): void {
    const nowDay = this.getTodayStartTimestamp();
    db.prepare(`
      UPDATE daily_quests 
      SET progress = MIN(required, progress + ?)
      WHERE user_id = ? AND quest_id = ? AND assigned_at >= ? AND is_claimed = 0
    `).run(amount, userId, questId, nowDay);
  }

  /**
   * Nhận thưởng nhiệm vụ hoàn thành
   */
  claimQuest(userId: string, questId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };

    const nowDay = this.getTodayStartTimestamp();
    const quest = db.prepare(`
      SELECT * FROM daily_quests 
      WHERE user_id = ? AND quest_id = ? AND assigned_at >= ? AND is_claimed = 0
    `).get(userId, questId, nowDay) as DailyQuestRow | undefined;

    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại hoặc đã nhận thưởng.' };
    if (quest.progress < quest.required) {
      return { success: false, message: `Nhiệm vụ chưa hoàn thành! (${quest.progress}/${quest.required})` };
    }

    const def = QUEST_POOL.find(p => p.id === questId);

    db.transaction(() => {
      db.prepare('UPDATE daily_quests SET is_claimed = 1 WHERE id = ?').run(quest.id);
      userRepository.update(userId, {
        coin_ha_pham: user.coin_ha_pham + quest.reward_coin,
        tu_vi: Math.min(user.tu_vi + quest.reward_exp, user.exp_needed),
        ngotinh: (user.ngotinh || 0) + quest.reward_ngotinh
      });
    })();

    return {
      success: true,
      message: `✅ **${def?.emoji || '🎁'} ${def?.name || questId}** hoàn thành!\n🟤 +${quest.reward_coin} Linh Thạch | 🌿 +${quest.reward_exp} Tu Vi | 🧘 +${quest.reward_ngotinh} Ngộ Tính`
    };
  }

  /**
   * Lấy timestamp đầu ngày (0h00 theo UTC+7)
   */
  private getTodayStartTimestamp(): number {
    const now = new Date();
    // Offset +7
    const vn = new Date(now.getTime() + 7 * 3600000);
    vn.setUTCHours(0, 0, 0, 0);
    return Math.floor((vn.getTime() - 7 * 3600000) / 1000);
  }

  /**
   * Lấy số giây còn lại đến reset
   */
  getSecondsToReset(): number {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    const tomorrowVN = new Date(vn);
    tomorrowVN.setUTCDate(vn.getUTCDate() + 1);
    tomorrowVN.setUTCHours(0, 0, 0, 0);
    const tomorrowUTC = new Date(tomorrowVN.getTime() - 7 * 3600000);
    return Math.floor((tomorrowUTC.getTime() - now.getTime()) / 1000);
  }
}

export const dailyQuestService = new DailyQuestService();
