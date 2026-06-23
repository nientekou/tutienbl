import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export interface QuestChainStep {
  id: string;
  name: string;
  description: string;
  objectiveType: 'kill' | 'collect' | 'craft' | 'explore' | 'pvp_win';
  objectiveTarget: number;
  objectiveCount: number;
  rewardExp: number;
  rewardCoins: number;
  rewardItems?: { id: string; qty: number }[];
}

export interface QuestChain {
  id: string;
  name: string;
  description: string;
  steps: QuestChainStep[];
  finalRewardTitle?: string;
  finalRewardExp: number;
  finalRewardCoins: number;
}

export const QUEST_CHAINS: QuestChain[] = [
  {
    id: 'chain_1',
    name: 'Tân Thủ Thí Luyện',
    description: 'Thử thách dành cho tu sĩ mới nhập môn',
    steps: [
      { id: 'chain_1_step_1', name: 'Thu Thập', description: 'Thu thập 10 Linh Thảo', objectiveType: 'collect', objectiveTarget: 10, objectiveCount: 10, rewardExp: 500, rewardCoins: 200 },
      { id: 'chain_1_step_2', name: 'Chiến Đấu', description: 'Tiêu diệt 5 yêu thú', objectiveType: 'kill', objectiveTarget: 5, objectiveCount: 5, rewardExp: 1000, rewardCoins: 500 },
      { id: 'chain_1_step_3', name: 'Luyện Đan', description: 'Luyện chế 3 viên đan dược', objectiveType: 'craft', objectiveTarget: 3, objectiveCount: 3, rewardExp: 1500, rewardCoins: 800 },
    ],
    finalRewardExp: 5000,
    finalRewardCoins: 2000,
  },
  {
    id: 'chain_2',
    name: 'Thám Hiểm Viễn Cổ',
    description: 'Khám phá bí mật thượng cổ',
    steps: [
      { id: 'chain_2_step_1', name: 'Khảo Cổ', description: 'Hoàn thành 3 lần khảo cổ', objectiveType: 'explore', objectiveTarget: 3, objectiveCount: 3, rewardExp: 2000, rewardCoins: 1000 },
      { id: 'chain_2_step_2', name: 'Đấu Trường', description: 'Thắng 5 trận quyết đấu', objectiveType: 'pvp_win', objectiveTarget: 5, objectiveCount: 5, rewardExp: 3000, rewardCoins: 2000 },
    ],
    finalRewardExp: 10000,
    finalRewardCoins: 5000,
  },
  {
    id: 'chain_3',
    name: 'Thần Binh Xuất Thế',
    description: 'Rèn luyện thần binh',
    steps: [
      { id: 'chain_3_step_1', name: 'Nguyên Liệu', description: 'Thu thập 20 Huyền Thiết Sa', objectiveType: 'collect', objectiveTarget: 20, objectiveCount: 20, rewardExp: 5000, rewardCoins: 3000 },
      { id: 'chain_3_step_2', name: 'Rèn Luyện', description: 'Cường hóa trang bị 10 lần', objectiveType: 'craft', objectiveTarget: 10, objectiveCount: 10, rewardExp: 8000, rewardCoins: 5000 },
    ],
    finalRewardTitle: 'Thần Binh',
    finalRewardExp: 20000,
    finalRewardCoins: 10000,
  },
];

interface ChainProgressRow {
  user_id: string;
  chain_id: string;
  step_index: number;
  progress: number;
  completed: number;
  finished_at: number | null;
}

class QuestChainService {
  public startChain(userId: string, chainId: string): { success: boolean; message: string } {
    const chain = QUEST_CHAINS.find(c => c.id === chainId);
    if (!chain) return { success: false, message: '❌ Chuỗi nhiệm vụ không tồn tại.' };

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật.' };

    const existing = db.prepare('SELECT * FROM quest_chain_progress WHERE user_id = ? AND chain_id = ?').get(userId, chainId) as ChainProgressRow | undefined;
    if (existing) {
      if (existing.completed) return { success: false, message: '❌ Đạo hữu đã hoàn thành chuỗi nhiệm vụ này rồi.' };
      return { success: false, message: '❌ Đạo hữu đã bắt đầu chuỗi nhiệm vụ này rồi. Hãy tiếp tục hoàn thành các bước.' };
    }

    db.prepare(`
      INSERT INTO quest_chain_progress (user_id, chain_id, step_index, progress, completed, finished_at)
      VALUES (?, ?, 0, 0, 0, NULL)
    `).run(userId, chainId);

    return { success: true, message: `✅ Đã bắt đầu chuỗi nhiệm vụ **${chain.name}**!` };
  }

  public getProgress(userId: string): { chainId: string; stepIndex: number; progress: number; completed: boolean } | null {
    const row = db.prepare(`
      SELECT * FROM quest_chain_progress WHERE user_id = ? AND completed = 0 ORDER BY step_index ASC LIMIT 1
    `).get(userId) as ChainProgressRow | undefined;

    if (!row) return null;
    return { chainId: row.chain_id, stepIndex: row.step_index, progress: row.progress, completed: row.completed === 1 };
  }

  public getDetailedProgress(userId: string): (ChainProgressRow & { chain: QuestChain })[] {
    const chainData = QUEST_CHAINS;
    const rows = db.prepare(`
      SELECT * FROM quest_chain_progress WHERE user_id = ?
    `).all(userId) as ChainProgressRow[];

    return rows.map(r => {
      const chain = chainData.find(c => c.id === r.chain_id);
      return { ...r, chain: chain! };
    }).filter(r => r.chain);
  }

  public updateProgress(userId: string, objectiveType: string, amount: number): { success: boolean; message: string } {
    const rows = db.prepare(`
      SELECT * FROM quest_chain_progress WHERE user_id = ? AND completed = 0
    `).all(userId) as ChainProgressRow[];

    if (rows.length === 0) return { success: false, message: '' };

    let updated = false;

    for (const row of rows) {
      const chain = QUEST_CHAINS.find(c => c.id === row.chain_id);
      if (!chain) continue;

      const step = chain.steps[row.step_index];
      if (!step) continue;
      if (step.objectiveType !== objectiveType) continue;
      if (row.progress >= step.objectiveTarget) continue;

      const newProgress = Math.min(step.objectiveTarget, row.progress + amount);
      db.prepare('UPDATE quest_chain_progress SET progress = ? WHERE user_id = ? AND chain_id = ?').run(newProgress, userId, row.chain_id);
      updated = true;
    }

    if (updated) return { success: true, message: '' };
    return { success: false, message: '' };
  }

  public claimStepReward(userId: string): { success: boolean; message: string } {
    const row = db.prepare(`
      SELECT * FROM quest_chain_progress WHERE user_id = ? AND completed = 0 ORDER BY step_index ASC LIMIT 1
    `).get(userId) as ChainProgressRow | undefined;

    if (!row) return { success: false, message: '❌ Đạo hữu chưa bắt đầu chuỗi nhiệm vụ nào.' };

    const chain = QUEST_CHAINS.find(c => c.id === row.chain_id);
    if (!chain) return { success: false, message: '❌ Chuỗi nhiệm vụ không tồn tại.' };

    const step = chain.steps[row.step_index];
    if (!step) return { success: false, message: '❌ Lỗi dữ liệu bước nhiệm vụ.' };

    if (row.progress < step.objectiveTarget) {
      return { success: false, message: `❌ Chưa hoàn thành bước **${step.name}** (${row.progress}/${step.objectiveTarget}).` };
    }

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật.' };

    db.transaction(() => {
      userRepository.update(userId, {
        tu_vi: Math.min(user.tu_vi + step.rewardExp, user.exp_needed),
        coin_ha_pham: user.coin_ha_pham + step.rewardCoins,
      });

      if (step.rewardItems) {
        for (const item of step.rewardItems) {
          inventoryRepository.addItem(userId, item.id, item.qty);
        }
      }

      const isLastStep = row.step_index >= chain.steps.length - 1;

      if (isLastStep) {
        userRepository.update(userId, {
          tu_vi: Math.min(user.tu_vi + chain.finalRewardExp, user.exp_needed),
          coin_ha_pham: user.coin_ha_pham + chain.finalRewardCoins,
        });

        if (chain.finalRewardTitle) {
          const userTitles = db.prepare('SELECT * FROM user_titles WHERE user_id = ? AND title = ?').get(userId, chain.finalRewardTitle);
          if (!userTitles) {
            db.prepare(`
              INSERT INTO user_titles (user_id, title, source, unlocked_at)
              VALUES (?, ?, 'quest_chain', ?)
            `).run(userId, chain.finalRewardTitle, Math.floor(Date.now() / 1000));
          }
        }

        db.prepare('UPDATE quest_chain_progress SET completed = 1, finished_at = ? WHERE user_id = ? AND chain_id = ?')
          .run(Math.floor(Date.now() / 1000), userId, row.chain_id);
      } else {
        db.prepare('UPDATE quest_chain_progress SET step_index = step_index + 1, progress = 0 WHERE user_id = ? AND chain_id = ?')
          .run(userId, row.chain_id);
      }
    })();

    const stepRewardMsg = `🟤 +${step.rewardCoins} Linh Thạch | 🌿 +${step.rewardExp} Tu Vi`;

    if (row.step_index >= chain.steps.length - 1) {
      const titlePart = chain.finalRewardTitle ? `\n🏅 **Nhận danh hiệu:** ${chain.finalRewardTitle}` : '';
      return {
        success: true,
        message: `🎉 **HOÀN THÀNH CHUỖI NHIỆM VỤ "${chain.name}"!**${titlePart}\nPhần thưởng bước: ${stepRewardMsg}\n🎁 Phần thưởng cuối: 🟤 +${chain.finalRewardCoins} Linh Thạch | 🌿 +${chain.finalRewardExp} Tu Vi`
      };
    }

    const nextStep = chain.steps[row.step_index + 1];
    return {
      success: true,
      message: `✅ **${step.name}** hoàn thành! ${stepRewardMsg}\n📋 Bước tiếp theo: **${nextStep.name}** - ${nextStep.description}`
    };
  }

  public getAvailableChains(userId: string): QuestChain[] {
    const userProgress = db.prepare(`
      SELECT chain_id, completed FROM quest_chain_progress WHERE user_id = ?
    `).all(userId) as { chain_id: string; completed: number }[];

    const completedIds = new Set(userProgress.filter(p => p.completed).map(p => p.chain_id));

    return QUEST_CHAINS.filter(c => !completedIds.has(c.id));
  }
}

export const questChainService = new QuestChainService();
