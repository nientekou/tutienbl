"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMUNITY_QUEST_POOL = exports.communityQuestService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const itemConstants_1 = require("../config/itemConstants");
const COMMUNITY_QUEST_POOL = [
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
        rewardPerPlayer: { exp: 8000, coins: 3000, items: [{ id: itemConstants_1.ITEMS.PILL_TU_VI_LOW, qty: 3 }] },
        durationHours: 36,
    },
];
exports.COMMUNITY_QUEST_POOL = COMMUNITY_QUEST_POOL;
class CommunityQuestService {
    startRandomQuest() {
        const def = COMMUNITY_QUEST_POOL[Math.floor(Math.random() * COMMUNITY_QUEST_POOL.length)];
        const now = Math.floor(Date.now() / 1000);
        const endsAt = now + def.durationHours * 3600;
        database_1.default.prepare(`
      INSERT OR REPLACE INTO community_quests (id, name, description, objective_type, total_required, current_progress, reward_exp, reward_coins, reward_items, started_at, ends_at, status)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'active')
    `).run(def.id, def.name, def.description, def.objectiveType, def.totalRequired, def.rewardPerPlayer.exp, def.rewardPerPlayer.coins, JSON.stringify(def.rewardPerPlayer.items || []), now, endsAt);
        return this.getActiveQuest();
    }
    getActiveQuest() {
        const now = Math.floor(Date.now() / 1000);
        const quest = database_1.default.prepare(`
      SELECT * FROM community_quests WHERE status = 'active' AND ends_at > ?
    `).get(now);
        return quest || null;
    }
    contribute(userId, amount, objectiveType) {
        const quest = this.getActiveQuest();
        if (!quest)
            return;
        if (quest.objective_type !== objectiveType)
            return;
        if (quest.status !== 'active')
            return;
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE community_quests SET current_progress = MIN(total_required, current_progress + ?) WHERE id = ?').run(amount, quest.id);
            const existing = database_1.default.prepare('SELECT * FROM community_quest_participants WHERE quest_id = ? AND user_id = ?').get(quest.id, userId);
            if (existing) {
                database_1.default.prepare('UPDATE community_quest_participants SET contribution = contribution + ? WHERE quest_id = ? AND user_id = ?').run(amount, quest.id, userId);
            }
            else {
                database_1.default.prepare('INSERT INTO community_quest_participants (quest_id, user_id, contribution) VALUES (?, ?, ?)').run(quest.id, userId, amount);
            }
        })();
    }
    checkAndComplete() {
        const quest = this.getActiveQuest();
        if (!quest)
            return null;
        if (quest.current_progress < quest.total_required)
            return null;
        database_1.default.prepare('UPDATE community_quests SET status = ? WHERE id = ?').run('completed', quest.id);
        const participants = database_1.default.prepare('SELECT * FROM community_quest_participants WHERE quest_id = ?').all(quest.id);
        const rewardItems = JSON.parse(quest.reward_items || '[]');
        for (const p of participants) {
            const user = UserRepository_1.userRepository.get(p.user_id);
            if (!user)
                continue;
            UserRepository_1.userRepository.update(p.user_id, {
                tu_vi: Math.min(user.tu_vi + quest.reward_exp, user.exp_needed),
                coin_ha_pham: user.coin_ha_pham + quest.reward_coins,
            });
            for (const item of rewardItems) {
                InventoryRepository_1.inventoryRepository.addItem(p.user_id, item.id, item.qty);
            }
            database_1.default.prepare('UPDATE community_quest_participants SET claimed = 1 WHERE quest_id = ? AND user_id = ?').run(quest.id, p.user_id);
        }
        return quest;
    }
    getParticipantContribution(userId, questId) {
        const row = database_1.default.prepare('SELECT contribution FROM community_quest_participants WHERE quest_id = ? AND user_id = ?').get(questId, userId);
        return row?.contribution || 0;
    }
    getActiveQuestWithParticipant(userId) {
        const quest = this.getActiveQuest();
        if (!quest)
            return { quest: null, contribution: 0 };
        const contribution = this.getParticipantContribution(userId, quest.id);
        return { quest, contribution };
    }
    getQuestHistory(userId, limit = 5) {
        const quests = database_1.default.prepare(`
      SELECT cq.* FROM community_quests cq
      INNER JOIN community_quest_participants cqp ON cqp.quest_id = cq.id
      WHERE cqp.user_id = ? AND cq.status = 'completed'
      ORDER BY cq.ended_at DESC
      LIMIT ?
    `).all(userId, limit);
        return quests;
    }
}
exports.communityQuestService = new CommunityQuestService();
