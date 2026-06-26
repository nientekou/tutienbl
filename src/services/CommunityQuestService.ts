import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { ITEMS } from '../config/itemConstants';

export interface CommunityQuestDefinition {
  id: string;
  name: string;
  description: string;
  objectiveType: 'boss_kill' | 'total_exp' | 'total_pvp' | 'total_mining' | 'total_beast_tame' | 'total_donate';
  totalRequired: number;
  rewardPerPlayer: { exp: number; coins: number; items?: { id: string; qty: number }[] };
  durationHours: number;
}

// P4-04: Expanded quest pool with more types
const COMMUNITY_QUEST_POOL: CommunityQuestDefinition[] = [
  {
    id: 'cq_boss',
    name: 'Thảo Phạt Yêu Vương',
    description: 'Cả máy chủ cùng tiêu diệt Boss Thế Giới',
    objectiveType: 'boss_kill',
    totalRequired: 3,
    rewardPerPlayer: { exp: 5000, coins: 2000 },
    durationHours: 24,
  },
  {
    id: 'cq_exp',
    name: 'Đại Tu Luyện',
    description: 'Toàn bộ tu sĩ tích lũy tu vi',
    objectiveType: 'total_exp',
    totalRequired: 50000,
    rewardPerPlayer: { exp: 10000, coins: 5000 },
    durationHours: 48,
  },
  {
    id: 'cq_pvp',
    name: 'Võ Lâm Đại Hội',
    description: 'Các tu sĩ quyết đấu khắp thiên hạ',
    objectiveType: 'total_pvp',
    totalRequired: 100,
    rewardPerPlayer: { exp: 8000, coins: 3000, items: [{ id: ITEMS.PILL_TU_VI_LOW, qty: 3 }] },
    durationHours: 36,
  },
  {
    id: 'cq_mining',
    name: 'Linh Thạch Động',
    description: 'Toàn server khai thác 50,000 Linh Thạch qua làm việc',
    objectiveType: 'total_mining',
    totalRequired: 50000,
    rewardPerPlayer: { exp: 3000, coins: 1000 },
    durationHours: 48,
  },
  {
    id: 'cq_beast',
    name: 'Thú Kiếm Hiệp',
    description: 'Toàn server thu phục 20 Linh Thú',
    objectiveType: 'total_beast_tame',
    totalRequired: 20,
    rewardPerPlayer: { exp: 4000, coins: 1500 },
    durationHours: 36,
  },
  {
    id: 'cq_donate',
    name: 'Quyên Góp Vạn Dân',
    description: 'Toàn server quyên góp 5,000 Linh Thạch cho Tông Môn',
    objectiveType: 'total_donate',
    totalRequired: 5000,
    rewardPerPlayer: { exp: 3000, coins: 800 },
    durationHours: 24,
  },
];

interface CommunityQuestRow {
  id: string;
  name: string;
  description: string;
  objective_type: string;
  total_required: number;
  current_progress: number;
  reward_exp: number;
  reward_coins: number;
  reward_items: string;
  started_at: number;
  ends_at: number;
  status: string;
}

interface ParticipantRow {
  id: number;
  quest_id: string;
  user_id: string;
  contribution: number;
  claimed: number;
}

class CommunityQuestService {
  public startRandomQuest(): CommunityQuestRow | null {
    const def = COMMUNITY_QUEST_POOL[Math.floor(Math.random() * COMMUNITY_QUEST_POOL.length)];
    const now = Math.floor(Date.now() / 1000);
    const endsAt = now + def.durationHours * 3600;

    db.prepare(`
      INSERT OR REPLACE INTO community_quests (id, name, description, objective_type, total_required, current_progress, reward_exp, reward_coins, reward_items, started_at, ends_at, status)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'active')
    `).run(def.id, def.name, def.description, def.objectiveType, def.totalRequired, def.rewardPerPlayer.exp, def.rewardPerPlayer.coins, JSON.stringify(def.rewardPerPlayer.items || []), now, endsAt);

    return this.getActiveQuest();
  }

  public getActiveQuest(): CommunityQuestRow | null {
    const now = Math.floor(Date.now() / 1000);
    const quest = db.prepare(`
      SELECT * FROM community_quests WHERE status = 'active' AND ends_at > ?
    `).get(now) as CommunityQuestRow | undefined;

    return quest || null;
  }

  public contribute(userId: string, amount: number, objectiveType: string): void {
    const quest = this.getActiveQuest();
    if (!quest) return;
    if (quest.objective_type !== objectiveType) return;
    if (quest.status !== 'active') return;

    db.transaction(() => {
      db.prepare('UPDATE community_quests SET current_progress = MIN(total_required, current_progress + ?) WHERE id = ?').run(amount, quest.id);

      const existing = db.prepare('SELECT * FROM community_quest_participants WHERE quest_id = ? AND user_id = ?').get(quest.id, userId) as ParticipantRow | undefined;
      if (existing) {
        db.prepare('UPDATE community_quest_participants SET contribution = contribution + ? WHERE quest_id = ? AND user_id = ?').run(amount, quest.id, userId);
      } else {
        db.prepare('INSERT INTO community_quest_participants (quest_id, user_id, contribution) VALUES (?, ?, ?)').run(quest.id, userId, amount);
      }
    })();
  }

  public checkAndComplete(): CommunityQuestRow | null {
    const quest = this.getActiveQuest();
    if (!quest) return null;
    if (quest.current_progress < quest.total_required) return null;

    db.prepare('UPDATE community_quests SET status = ? WHERE id = ?').run('completed', quest.id);

    const participants = db.prepare('SELECT * FROM community_quest_participants WHERE quest_id = ? ORDER BY contribution DESC').all(quest.id) as ParticipantRow[];

    const rewardItems: { id: string; qty: number }[] = JSON.parse(quest.reward_items || '[]');

    // P4-04: Find top contributor for bonus
    const topContributor = participants.length > 0 ? participants[0] : null;

    for (const p of participants) {
      const user = userRepository.get(p.user_id);
      if (!user) continue;

      // P4-04: Top contributor gets 1.5x bonus
      const isTopContributor = topContributor && p.user_id === topContributor.user_id;
      const bonusMult = isTopContributor ? 1.5 : 1.0;

      userRepository.update(p.user_id, {
        tu_vi: Math.min(user.tu_vi + Math.round(quest.reward_exp * bonusMult), user.exp_needed),
        coin_ha_pham: user.coin_ha_pham + Math.round(quest.reward_coins * bonusMult),
      });

      for (const item of rewardItems) {
        inventoryRepository.addItem(p.user_id, item.id, item.qty);
      }

      // P4-04: Top contributor gets extra KNB
      if (isTopContributor) {
        userRepository.update(p.user_id, { knb: user.knb + 5 });
      }

      db.prepare('UPDATE community_quest_participants SET claimed = 1 WHERE quest_id = ? AND user_id = ?').run(quest.id, p.user_id);
    }

    return quest;
  }

  public getParticipantContribution(userId: string, questId: string): number {
    const row = db.prepare('SELECT contribution FROM community_quest_participants WHERE quest_id = ? AND user_id = ?').get(questId, userId) as { contribution: number } | undefined;
    return row?.contribution || 0;
  }

  public getActiveQuestWithParticipant(userId: string): { quest: CommunityQuestRow | null; contribution: number } {
    const quest = this.getActiveQuest();
    if (!quest) return { quest: null, contribution: 0 };
    const contribution = this.getParticipantContribution(userId, quest.id);
    return { quest, contribution };
  }

  public getQuestHistory(userId: string, limit: number = 5): CommunityQuestRow[] {
    const quests = db.prepare(`
      SELECT cq.* FROM community_quests cq
      INNER JOIN community_quest_participants cqp ON cqp.quest_id = cq.id
      WHERE cqp.user_id = ? AND cq.status = 'completed'
      ORDER BY cq.ends_at DESC
      LIMIT ?
    `).all(userId, limit) as CommunityQuestRow[];

    return quests;
  }
}

export const communityQuestService = new CommunityQuestService();

export { COMMUNITY_QUEST_POOL };
