import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// A-06: Quest Chain System

type ChainType = 'main' | 'side' | 'guild' | 'couple' | 'mentor';

export interface QuestChain {
  id: string;
  name: string;
  type: ChainType;
  description: string;
  quests: { id: string; name: string; description: string; target: number; objectiveTarget: number; reward: number }[];
  steps: { id: string; name: string; description: string; target: number; objectiveTarget: number; reward: number }[];
  finalRewardCoins: number;
  finalRewardExp: number;
  finalRewardTitle: string;
}

export const QUEST_CHAINS: QuestChain[] = [
  {
    id: 'main_chain_1', name: 'Cốt Truyện Chính - Hồi 1', type: 'main',
    description: 'Bắt đầu hành trình tu tiên của đạo hữu',
    quests: [
      { id: 'mc1_1', name: 'Bước Đầu', description: 'Đạt cấp 10', target: 10, objectiveTarget: 10, reward: 500 },
      { id: 'mc1_2', name: 'Học Chiến Đấu', description: 'Thắng 5 trận PvP', target: 5, objectiveTarget: 5, reward: 800 },
      { id: 'mc1_3', name: 'Gia Nhập Tông Môn', description: 'Gia nhập bất kỳ tông môn nào', target: 1, objectiveTarget: 1, reward: 1000 },
      { id: 'mc1_4', name: 'Phó Bản Đầu Tiên', description: 'Vượt qua phó bản đầu tiên', target: 1, objectiveTarget: 1, reward: 1500 },
      { id: 'mc1_5', name: 'Đạt Trúc Cơ', description: 'Đạt đến cảnh giới Trúc Cơ Kỳ', target: 1, objectiveTarget: 1, reward: 3000 },
    ],
    steps: [
      { id: 'mc1_1', name: 'Bước Đầu', description: 'Đạt cấp 10', target: 10, objectiveTarget: 10, reward: 500 },
      { id: 'mc1_2', name: 'Học Chiến Đấu', description: 'Thắng 5 trận PvP', target: 5, objectiveTarget: 5, reward: 800 },
      { id: 'mc1_3', name: 'Gia Nhập Tông Môn', description: 'Gia nhập bất kỳ tông môn nào', target: 1, objectiveTarget: 1, reward: 1000 },
      { id: 'mc1_4', name: 'Phó Bản Đầu Tiên', description: 'Vượt qua phó bản đầu tiên', target: 1, objectiveTarget: 1, reward: 1500 },
      { id: 'mc1_5', name: 'Đạt Trúc Cơ', description: 'Đạt đến cảnh giới Trúc Cơ Kỳ', target: 1, objectiveTarget: 1, reward: 3000 },
    ],
    finalRewardCoins: 10000, finalRewardExp: 5000, finalRewardTitle: 'Kẻ Mở Đường'
  },
  {
    id: 'side_chain_1', name: 'Câu Chuyện Phụ: Kho Báu Thất Lạc', type: 'side',
    description: 'Tìm kho báu thất lạc trong dãy núi',
    quests: [
      { id: 'sc1_1', name: 'Tin Đồn', description: 'Nói chuyện với NPC trong thành', target: 1, objectiveTarget: 1, reward: 200 },
      { id: 'sc1_2', name: 'Tìm Kiếm', description: 'Thám hiểm 3 địa điểm', target: 3, objectiveTarget: 3, reward: 400 },
      { id: 'sc1_3', name: 'Chiến Đấu', description: 'Đánh bại kẻ canh giữ', target: 1, objectiveTarget: 1, reward: 800 },
    ],
    steps: [
      { id: 'sc1_1', name: 'Tin Đồn', description: 'Nói chuyện với NPC trong thành', target: 1, objectiveTarget: 1, reward: 200 },
      { id: 'sc1_2', name: 'Tìm Kiếm', description: 'Thám hiểm 3 địa điểm', target: 3, objectiveTarget: 3, reward: 400 },
      { id: 'sc1_3', name: 'Chiến Đấu', description: 'Đánh bại kẻ canh giữ', target: 1, objectiveTarget: 1, reward: 800 },
    ],
    finalRewardCoins: 5000, finalRewardExp: 2000, finalRewardTitle: 'Thợ Săn Kho Báu'
  },
  {
    id: 'guild_chain_1', name: 'Sứ Mệnh Tông Môn', type: 'guild',
    description: 'Giúp tông môn phát triển hùng mạnh',
    quests: [
      { id: 'gc1_1', name: 'Cống Hiến', description: 'Cống hiến 1000 cho tông môn', target: 1000, objectiveTarget: 1000, reward: 500 },
      { id: 'gc1_2', name: 'Tu Luyện', description: 'Tu luyện 5 lần', target: 5, objectiveTarget: 5, reward: 800 },
      { id: 'gc1_3', name: 'Đại Diện', description: 'Thắng 3 trận tông môn chiến', target: 3, objectiveTarget: 3, reward: 1500 },
    ],
    steps: [
      { id: 'gc1_1', name: 'Cống Hiến', description: 'Cống hiến 1000 cho tông môn', target: 1000, objectiveTarget: 1000, reward: 500 },
      { id: 'gc1_2', name: 'Tu Luyện', description: 'Tu luyện 5 lần', target: 5, objectiveTarget: 5, reward: 800 },
      { id: 'gc1_3', name: 'Đại Diện', description: 'Thắng 3 trận tông môn chiến', target: 3, objectiveTarget: 3, reward: 1500 },
    ],
    finalRewardCoins: 8000, finalRewardExp: 3000, finalRewardTitle: 'Trụ Cột Tông Môn'
  },
  {
    id: 'couple_chain_1', name: 'Hành Trình Đạo Lữ', type: 'couple',
    description: 'Phiêu lưu cùng đạo lữ của đạo hữu',
    quests: [
      { id: 'cc1_1', name: 'Song Tu', description: 'Song tu 3 lần', target: 3, objectiveTarget: 3, reward: 300 },
      { id: 'cc1_2', name: 'Đồng Chiến', description: 'Vượt tầng 3 động phủ đạo lữ', target: 1, objectiveTarget: 1, reward: 800 },
      { id: 'cc1_3', name: 'Gắn Kết', description: 'Đạt 500 thân mật độ', target: 500, objectiveTarget: 500, reward: 1500 },
    ],
    steps: [
      { id: 'cc1_1', name: 'Song Tu', description: 'Song tu 3 lần', target: 3, objectiveTarget: 3, reward: 300 },
      { id: 'cc1_2', name: 'Đồng Chiến', description: 'Vượt tầng 3 động phủ đạo lữ', target: 1, objectiveTarget: 1, reward: 800 },
      { id: 'cc1_3', name: 'Gắn Kết', description: 'Đạt 500 thân mật độ', target: 500, objectiveTarget: 500, reward: 1500 },
    ],
    finalRewardCoins: 6000, finalRewardExp: 2500, finalRewardTitle: 'Tâm Đầu Ý Hợp'
  },
  {
    id: 'mentor_chain_1', name: 'Sư Phụ Đại Nhân', type: 'mentor',
    description: 'Trở thành một bậc thầy khai tâm',
    quests: [
      { id: 'mtc1_1', name: 'Chỉ Dẫn', description: 'Giúp đỡ đồ đệ 5 lần', target: 5, objectiveTarget: 5, reward: 500 },
      { id: 'mtc1_2', name: 'Truyền Thụ', description: 'Truyền 500 EXP cho đồ đệ', target: 500, objectiveTarget: 500, reward: 800 },
      { id: 'mtc1_3', name: 'Tốt Nghiệp', description: 'Tốt nghiệp 1 đồ đệ', target: 1, objectiveTarget: 1, reward: 2000 },
    ],
    steps: [
      { id: 'mtc1_1', name: 'Chỉ Dẫn', description: 'Giúp đỡ đồ đệ 5 lần', target: 5, objectiveTarget: 5, reward: 500 },
      { id: 'mtc1_2', name: 'Truyền Thụ', description: 'Truyền 500 EXP cho đồ đệ', target: 500, objectiveTarget: 500, reward: 800 },
      { id: 'mtc1_3', name: 'Tốt Nghiệp', description: 'Tốt nghiệp 1 đồ đệ', target: 1, objectiveTarget: 1, reward: 2000 },
    ],
    finalRewardCoins: 15000, finalRewardExp: 5000, finalRewardTitle: 'Minh Sư'
  },
];

class QuestChainService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quest_chains (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        chain_id TEXT NOT NULL,
        current_quest INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, chain_id)
      );
    `);
  }

  getAvailableChains(userId: string): QuestChain[] {
    const user = userRepository.get(userId);
    if (!user) return [];
    return QUEST_CHAINS.filter(chain => {
      if (chain.type === 'main' && user.level < 10) return false;
      if (chain.type === 'guild' && !user.sect_id) return false;
      return true;
    });
  }

  getChainProgress(userId: string, chainId: string): { currentQuest: number; progress: number; completed: boolean } {
    this.initTable();
    const row = db.prepare('SELECT * FROM quest_chains WHERE user_id = ? AND chain_id = ?')
      .get(userId, chainId) as any;
    if (!row) {
      db.prepare('INSERT INTO quest_chains (user_id, chain_id, current_quest, progress) VALUES (?, ?, 0, 0)')
        .run(userId, chainId);
      return { currentQuest: 0, progress: 0, completed: false };
    }
    return { currentQuest: row.current_quest, progress: row.progress, completed: row.completed === 1 };
  }

  updateProgress(userId: string, chainId: string, amount: number = 1): { questComplete: boolean; chainComplete: boolean; message: string } {
    this.initTable();
    const chain = QUEST_CHAINS.find(c => c.id === chainId);
    if (!chain) return { questComplete: false, chainComplete: false, message: 'Chuỗi nhiệm vụ không tồn tại' };

    const progress = this.getChainProgress(userId, chainId);
    const currentQuest = chain.quests[progress.currentQuest];
    if (!currentQuest) return { questComplete: false, chainComplete: true, message: 'Chuỗi nhiệm vụ đã hoàn thành' };

    const newProgress = progress.progress + amount;
    let questComplete = false;
    let chainComplete = false;

    if (newProgress >= currentQuest.target) {
      questComplete = true;
      if (progress.currentQuest >= chain.quests.length - 1) {
        chainComplete = true;
        db.prepare('UPDATE quest_chains SET current_quest = ?, progress = ?, completed = 1 WHERE user_id = ? AND chain_id = ?')
          .run(progress.currentQuest + 1, 0, userId, chainId);
      } else {
        db.prepare('UPDATE quest_chains SET current_quest = ?, progress = 0 WHERE user_id = ? AND chain_id = ?')
          .run(progress.currentQuest + 1, userId, chainId);
      }
    } else {
      db.prepare('UPDATE quest_chains SET progress = ? WHERE user_id = ? AND chain_id = ?')
        .run(newProgress, userId, chainId);
    }

    return {
      questComplete,
      chainComplete,
      message: questComplete ? `Nhiệm vụ "${currentQuest.name}" hoàn thành!` : `Tiến độ: ${newProgress}/${currentQuest.target}`
    };
  }

  getChainDescription(userId: string, chainId: string): string {
    const chain = QUEST_CHAINS.find(c => c.id === chainId);
    if (!chain) return 'Chuỗi nhiệm vụ không tồn tại';
    const progress = this.getChainProgress(userId, chainId);
    let msg = `📜 **${chain.name}** (${chain.type})\n${chain.description}\n\n`;
    chain.quests.forEach((q, i) => {
      const isCurrent = i === progress.currentQuest;
      const isCompleted = i < progress.currentQuest;
      const status = isCompleted ? '✅' : (isCurrent ? '⬜' : '🔒');
      msg += `${status} **${q.name}**: ${q.description}\n`;
      if (isCurrent) msg += `   Tiến độ: ${progress.progress}/${q.target} | Thưởng: ${q.reward} Tu Vi\n`;
    });
    return msg;
  }

  // === Compatibility methods for existing code ===

  /**
   * Get detailed progress for all chains (compatibility method)
   */
  getDetailedProgress(userId: string): any[] {
    this.initTable();
    return db.prepare('SELECT * FROM quest_chains WHERE user_id = ?').all(userId);
  }

  /**
   * Start a chain (compatibility method)
   */
  startChain(userId: string, chainId: string): { success: boolean; message: string } {
    const chain = QUEST_CHAINS.find(c => c.id === chainId);
    if (!chain) return { success: false, message: 'Chuỗi nhiệm vụ không tồn tại' };

    const existing = db.prepare('SELECT * FROM quest_chains WHERE user_id = ? AND chain_id = ?')
      .get(userId, chainId);
    if (existing) return { success: false, message: 'Chuỗi nhiệm vụ đã được bắt đầu' };

    db.prepare('INSERT INTO quest_chains (user_id, chain_id, current_quest, progress) VALUES (?, ?, 0, 0)')
      .run(userId, chainId);

    return { success: true, message: `Đã bắt đầu chuỗi: ${chain.name}` };
  }

  /**
   * Claim step reward (compatibility method)
   */
  claimStepReward(userId: string, chainId?: string, stepIndex?: number): { success: boolean; message: string } {
    // If no chainId provided, find the active chain for this user
    if (!chainId) {
      const activeChain = db.prepare('SELECT chain_id, current_quest FROM quest_chains WHERE user_id = ? AND completed = 0')
        .get(userId) as any;
      if (!activeChain) return { success: false, message: 'Không có chuỗi nhiệm vụ nào đang hoạt động' };
      chainId = activeChain.chain_id;
      stepIndex = activeChain.current_quest;
    }

    const chain = QUEST_CHAINS.find(c => c.id === chainId);
    if (!chain) return { success: false, message: 'Chuỗi nhiệm vụ không tồn tại' };

    const progress = this.getChainProgress(userId, chainId!);
    if (stepIndex !== undefined && stepIndex !== progress.currentQuest) return { success: false, message: 'Không phải bước này' };

    const step = chain.steps[progress.currentQuest];
    if (!step) return { success: false, message: 'Bước này không tồn tại' };

    if (progress.progress < step.target) return { success: false, message: 'Bước này chưa hoàn thành' };

    // Mark as claimed
    db.prepare('UPDATE quest_chains SET claimed = 1 WHERE user_id = ? AND chain_id = ?')
      .run(userId, chainId);

    // Award reward
    const user = userRepository.get(userId);
    if (user) {
      userRepository.update(userId, {
        coin_ha_pham: user.coin_ha_pham + step.reward,
        tu_vi: Math.min(user.tu_vi + step.reward, user.exp_needed)
      });
    }

    return { success: true, message: `Đã nhận thưởng: ${step.reward} Linh Thạch + Tu Vi` };
  }
}

export const questChainService = new QuestChainService();
