"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyChallengeService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const CHALLENGE_POOL = [
    { id: 'dc_combat_1', name: 'Sát Thủ', description: 'Đánh bại 5 kẻ thù', category: 'combat', difficulty: 'easy', target: 5, rewardCoin: 100, rewardExp: 50 },
    { id: 'dc_combat_2', name: 'Chiến Binh', description: 'Đánh bại 15 kẻ thù', category: 'combat', difficulty: 'medium', target: 15, rewardCoin: 200, rewardExp: 100 },
    { id: 'dc_combat_3', name: 'Tử Thần', description: 'Đánh bại 30 kẻ thù', category: 'combat', difficulty: 'hard', target: 30, rewardCoin: 500, rewardExp: 300 },
    { id: 'dc_life_1', name: 'Thợ Rèn', description: 'Luyện chế 3 vật phẩm', category: 'life', difficulty: 'easy', target: 3, rewardCoin: 80, rewardExp: 40 },
    { id: 'dc_life_2', name: 'Nông Dân', description: 'Thu hoạch 5 ô farm', category: 'life', difficulty: 'medium', target: 5, rewardCoin: 150, rewardExp: 80 },
    { id: 'dc_life_3', name: 'Thám Hiểm', description: 'Hoàn thành 3 chuyến thám hiểm', category: 'life', difficulty: 'hard', target: 3, rewardCoin: 400, rewardExp: 250 },
    { id: 'dc_social_1', name: 'Giao Dịch', description: 'Giao dịch 2 lần', category: 'social', difficulty: 'easy', target: 2, rewardCoin: 60, rewardExp: 30 },
    { id: 'dc_social_2', name: 'Đạo Hữu', description: 'Giúp đỡ 3 người chơi', category: 'social', difficulty: 'medium', target: 3, rewardCoin: 120, rewardExp: 60 },
    { id: 'dc_social_3', name: 'Minh Chủ', description: 'Thắng 5 trận PvP', category: 'social', difficulty: 'hard', target: 5, rewardCoin: 350, rewardExp: 200 },
    // A4: Level-gated challenges
    { id: 'dc_nightmare', name: 'Ác Mộng Bí Cảnh', description: 'Vượt Bí Cảnh độ khó Ác Mộng', category: 'combat', difficulty: 'hard', target: 1, rewardCoin: 600, rewardExp: 400, minLevel: 30 },
    { id: 'dc_nineheavens', name: 'Phá Cửa Cửu Thiên', description: 'Leo 5 tầng Cửu Thiên', category: 'combat', difficulty: 'hard', target: 5, rewardCoin: 800, rewardExp: 500, minLevel: 50 },
    { id: 'dc_worldboss2', name: 'Sát Thần', description: 'Đánh bại World Boss 2 lần', category: 'combat', difficulty: 'hard', target: 2, rewardCoin: 900, rewardExp: 600, minLevel: 80 },
    { id: 'dc_arena3', name: 'Quán Quân', description: 'Thắng 3 trận Arena', category: 'social', difficulty: 'hard', target: 3, rewardCoin: 700, rewardExp: 450, minLevel: 100 },
    { id: 'dc_dreamscape10', name: 'Du Hành Giấc Mơ', description: 'Vượt 10 tầng Vọng Tưởng', category: 'combat', difficulty: 'hard', target: 10, rewardCoin: 1000, rewardExp: 700, minLevel: 150 },
    { id: 'dc_infinite20', name: 'Thử Thách Vô Hạn', description: 'Vượt 20 tầng Infinite Dungeon', category: 'combat', difficulty: 'hard', target: 20, rewardCoin: 1200, rewardExp: 800, minLevel: 200 },
];
class DailyChallengeService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS daily_challenges (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        challenge_ids TEXT NOT NULL,
        progress TEXT DEFAULT '{}',
        completed TEXT DEFAULT '[]',
        claimed TEXT DEFAULT '[]',
        streak INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, date)
      );
    `);
    }
    /**
     * C-04: Get or assign daily challenges (3 per day)
     */
    getOrAssignChallenges(userId) {
        this.initTable();
        const today = this.getTodayString();
        let record = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
            .get(userId, today);
        if (!record) {
            // A4: Filter by player level
            const user = UserRepository_1.userRepository.get(userId);
            const playerLevel = user?.level || 1;
            const available = CHALLENGE_POOL.filter(c => !c.minLevel || playerLevel >= c.minLevel);
            // Assign 3 random challenges
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 3);
            const challengeIds = selected.map(c => c.id);
            database_1.default.prepare('INSERT INTO daily_challenges (user_id, date, challenge_ids, progress, completed, claimed) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, today, JSON.stringify(challengeIds), '{}', '[]', '[]');
            record = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
                .get(userId, today);
        }
        const challengeIds = JSON.parse(record.challenge_ids);
        const challenges = challengeIds.map(id => CHALLENGE_POOL.find(c => c.id === id)).filter(Boolean);
        const progress = JSON.parse(record.progress || '{}');
        const streak = this.getStreak(userId);
        return { challenges, progress, streak };
    }
    /**
     * C-04: Update challenge progress
     */
    updateProgress(userId, challengeId, amount = 1) {
        this.initTable();
        const today = this.getTodayString();
        const record = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
            .get(userId, today);
        if (!record)
            return { completed: false, message: 'Chưa có challenge hôm nay!' };
        const progress = JSON.parse(record.progress || '{}');
        const completed = JSON.parse(record.completed || '[]');
        if (completed.includes(challengeId))
            return { completed: true, message: 'Đã hoàn thành!' };
        const challenge = CHALLENGE_POOL.find(c => c.id === challengeId);
        if (!challenge)
            return { completed: false, message: 'Challenge không tồn tại!' };
        const newProgress = (progress[challengeId] || 0) + amount;
        progress[challengeId] = Math.min(newProgress, challenge.target);
        let msg = '';
        if (progress[challengeId] >= challenge.target && !completed.includes(challengeId)) {
            completed.push(challengeId);
            msg = `🎯 **${challenge.name}** hoàn thành!`;
        }
        database_1.default.prepare('UPDATE daily_challenges SET progress = ?, completed = ? WHERE user_id = ? AND date = ?')
            .run(JSON.stringify(progress), JSON.stringify(completed), userId, today);
        return { completed: completed.includes(challengeId), message: msg || `+${amount} progress` };
    }
    /**
     * C-04: Claim reward for completed challenge
     */
    claimReward(userId, challengeId) {
        this.initTable();
        const today = this.getTodayString();
        const record = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
            .get(userId, today);
        if (!record)
            return { success: false, message: 'Không có challenge!' };
        const completed = JSON.parse(record.completed || '[]');
        const claimed = JSON.parse(record.claimed || '[]');
        if (!completed.includes(challengeId))
            return { success: false, message: 'Challenge chưa hoàn thành!' };
        if (claimed.includes(challengeId))
            return { success: false, message: 'Đã nhận thưởng!' };
        const challenge = CHALLENGE_POOL.find(c => c.id === challengeId);
        if (!challenge)
            return { success: false, message: 'Challenge không tồn tại!' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Chưa tạo nhân vật!' };
        claimed.push(challengeId);
        // Apply streak multiplier
        const streak = this.getStreak(userId);
        let streakMult = 1.0;
        if (streak >= 30)
            streakMult = 3.0;
        else if (streak >= 14)
            streakMult = 2.0;
        else if (streak >= 7)
            streakMult = 1.5;
        const finalCoin = Math.round(challenge.rewardCoin * streakMult);
        const finalExp = Math.round(challenge.rewardExp * streakMult);
        UserRepository_1.userRepository.update(userId, {
            coin_ha_pham: user.coin_ha_pham + finalCoin,
            tu_vi: Math.min(user.tu_vi + finalExp, user.exp_needed)
        });
        if (challenge.rewardMaterial) {
            database_1.default.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, ?, 0)')
                .run(userId, challenge.rewardMaterial, challenge.rewardMaterialQty || 1);
        }
        database_1.default.prepare('UPDATE daily_challenges SET claimed = ? WHERE user_id = ? AND date = ?')
            .run(JSON.stringify(claimed), userId, today);
        let msg = `✅ **${challenge.name}** — +${finalCoin} LT, +${finalExp} EXP`;
        if (streakMult > 1)
            msg += ` (Chuỗi x${streakMult})`;
        return { success: true, message: msg };
    }
    /**
     * C-04: Get streak
     */
    getStreak(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT streak FROM daily_challenges WHERE user_id = ? ORDER BY date DESC LIMIT 1')
            .get(userId);
        return row?.streak || 0;
    }
    /**
     * C-04: Update streak (call at day end or day start)
     */
    updateStreak(userId) {
        this.initTable();
        const today = this.getTodayString();
        const yesterday = this.getYesterdayString();
        const todayRecord = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
            .get(userId, today);
        const yesterdayRecord = database_1.default.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
            .get(userId, yesterday);
        if (!todayRecord)
            return;
        const todayCompleted = JSON.parse(todayRecord.completed || '[]');
        const allComplete = todayCompleted.length >= 3; // All 3 challenges done
        let newStreak = 1;
        if (yesterdayRecord) {
            const yestCompleted = JSON.parse(yesterdayRecord.completed || '[]');
            if (yestCompleted.length >= 3) {
                newStreak = (yesterdayRecord.streak || 0) + 1;
            }
        }
        if (allComplete) {
            database_1.default.prepare('UPDATE daily_challenges SET streak = ? WHERE user_id = ? AND date = ?')
                .run(newStreak, userId, today);
        }
    }
    /**
     * C-04: Get challenge description for UI
     */
    getChallengeDescription(userId) {
        const { challenges, progress, streak } = this.getOrAssignChallenges(userId);
        let msg = `📋 **Thử Thách Hàng Ngày** (Chuỗi: **${streak}** ngày)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const c of challenges) {
            const prog = progress[c.id] || 0;
            const done = prog >= c.target;
            const status = done ? '✅' : '⬜';
            const diffEmoji = c.difficulty === 'hard' ? '🔴' : c.difficulty === 'medium' ? '🟡' : '🟢';
            msg += `${status} ${diffEmoji} **${c.name}**: ${c.description}\n`;
            msg += `   Tiến Độ: ${prog}/${c.target} | Phần thưởng: ${c.rewardCoin} LT + ${c.rewardExp} EXP\n`;
        }
        if (streak >= 7)
            msg += `\n🔥 **Thưởng Chuỗi x${streak >= 30 ? 3 : streak >= 14 ? 2 : 1.5}**`;
        return msg;
    }
    getTodayString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        return vn.toISOString().slice(0, 10);
    }
    getYesterdayString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000 - 86400000);
        return vn.toISOString().slice(0, 10);
    }
}
exports.dailyChallengeService = new DailyChallengeService();
