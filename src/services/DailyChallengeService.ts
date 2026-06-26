import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// C-04: Daily Challenge System

interface ChallengeDef {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'life' | 'social';
  difficulty: 'easy' | 'medium' | 'hard';
  target: number;
  rewardCoin: number;
  rewardExp: number;
  rewardMaterial?: string;
  rewardMaterialQty?: number;
}

const CHALLENGE_POOL: ChallengeDef[] = [
  { id: 'dc_combat_1', name: 'Sát Thủ', description: 'Đánh bại 5 kẻ thù', category: 'combat', difficulty: 'easy', target: 5, rewardCoin: 100, rewardExp: 50 },
  { id: 'dc_combat_2', name: 'Chiến Binh', description: 'Đánh bại 15 kẻ thù', category: 'combat', difficulty: 'medium', target: 15, rewardCoin: 200, rewardExp: 100 },
  { id: 'dc_combat_3', name: 'Tử Thần', description: 'Đánh bại 30 kẻ thù', category: 'combat', difficulty: 'hard', target: 30, rewardCoin: 500, rewardExp: 300 },
  { id: 'dc_life_1', name: 'Thợ Rèn', description: 'Luyện chế 3 vật phẩm', category: 'life', difficulty: 'easy', target: 3, rewardCoin: 80, rewardExp: 40 },
  { id: 'dc_life_2', name: 'Nông Dân', description: 'Thu hoạch 5 ô farm', category: 'life', difficulty: 'medium', target: 5, rewardCoin: 150, rewardExp: 80 },
  { id: 'dc_life_3', name: 'Thám Hiểm', description: 'Hoàn thành 3 chuyến thám hiểm', category: 'life', difficulty: 'hard', target: 3, rewardCoin: 400, rewardExp: 250 },
  { id: 'dc_social_1', name: 'Giao Dịch', description: 'Giao dịch 2 lần', category: 'social', difficulty: 'easy', target: 2, rewardCoin: 60, rewardExp: 30 },
  { id: 'dc_social_2', name: 'Đạo Hữu', description: 'Giúp đỡ 3 người chơi', category: 'social', difficulty: 'medium', target: 3, rewardCoin: 120, rewardExp: 60 },
  { id: 'dc_social_3', name: 'Minh Chủ', description: 'Thắng 5 trận PvP', category: 'social', difficulty: 'hard', target: 5, rewardCoin: 350, rewardExp: 200 },
];

interface DailyChallengeRow {
  user_id: string;
  date: string;
  challenge_ids: string;
  progress: string;
  completed: string;
  claimed: string;
  streak: number;
}

class DailyChallengeService {
  private initTable(): void {
    db.exec(`
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
  getOrAssignChallenges(userId: string): { challenges: ChallengeDef[]; progress: Record<string, number>; streak: number } {
    this.initTable();
    const today = this.getTodayString();

    let record = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
      .get(userId, today) as DailyChallengeRow | undefined;

    if (!record) {
      // Assign 3 random challenges
      const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3);
      const challengeIds = selected.map(c => c.id);

      db.prepare('INSERT INTO daily_challenges (user_id, date, challenge_ids, progress, completed, claimed) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, today, JSON.stringify(challengeIds), '{}', '[]', '[]');

      record = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
        .get(userId, today) as DailyChallengeRow;
    }

    const challengeIds: string[] = JSON.parse(record.challenge_ids);
    const challenges = challengeIds.map(id => CHALLENGE_POOL.find(c => c.id === id)).filter(Boolean) as ChallengeDef[];
    const progress: Record<string, number> = JSON.parse(record.progress || '{}');
    const streak = this.getStreak(userId);

    return { challenges, progress, streak };
  }

  /**
   * C-04: Update challenge progress
   */
  updateProgress(userId: string, challengeId: string, amount: number = 1): { completed: boolean; message: string } {
    this.initTable();
    const today = this.getTodayString();

    const record = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
      .get(userId, today) as DailyChallengeRow | undefined;
    if (!record) return { completed: false, message: 'Chưa có challenge hôm nay!' };

    const progress: Record<string, number> = JSON.parse(record.progress || '{}');
    const completed: string[] = JSON.parse(record.completed || '[]');

    if (completed.includes(challengeId)) return { completed: true, message: 'Đã hoàn thành!' };

    const challenge = CHALLENGE_POOL.find(c => c.id === challengeId);
    if (!challenge) return { completed: false, message: 'Challenge không tồn tại!' };

    const newProgress = (progress[challengeId] || 0) + amount;
    progress[challengeId] = Math.min(newProgress, challenge.target);

    let msg = '';
    if (progress[challengeId] >= challenge.target && !completed.includes(challengeId)) {
      completed.push(challengeId);
      msg = `🎯 **${challenge.name}** hoàn thành!`;
    }

    db.prepare('UPDATE daily_challenges SET progress = ?, completed = ? WHERE user_id = ? AND date = ?')
      .run(JSON.stringify(progress), JSON.stringify(completed), userId, today);

    return { completed: completed.includes(challengeId), message: msg || `+${amount} progress` };
  }

  /**
   * C-04: Claim reward for completed challenge
   */
  claimReward(userId: string, challengeId: string): { success: boolean; message: string } {
    this.initTable();
    const today = this.getTodayString();

    const record = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
      .get(userId, today) as DailyChallengeRow | undefined;
    if (!record) return { success: false, message: 'Không có challenge!' };

    const completed: string[] = JSON.parse(record.completed || '[]');
    const claimed: string[] = JSON.parse(record.claimed || '[]');

    if (!completed.includes(challengeId)) return { success: false, message: 'Challenge chưa hoàn thành!' };
    if (claimed.includes(challengeId)) return { success: false, message: 'Đã nhận thưởng!' };

    const challenge = CHALLENGE_POOL.find(c => c.id === challengeId);
    if (!challenge) return { success: false, message: 'Challenge không tồn tại!' };

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Chưa tạo nhân vật!' };

    claimed.push(challengeId);

    // Apply streak multiplier
    const streak = this.getStreak(userId);
    let streakMult = 1.0;
    if (streak >= 7) streakMult = 1.5;
    else if (streak >= 14) streakMult = 2.0;
    else if (streak >= 30) streakMult = 3.0;

    const finalCoin = Math.round(challenge.rewardCoin * streakMult);
    const finalExp = Math.round(challenge.rewardExp * streakMult);

    userRepository.update(userId, {
      coin_ha_pham: user.coin_ha_pham + finalCoin,
      tu_vi: Math.min(user.tu_vi + finalExp, user.exp_needed)
    });

    if (challenge.rewardMaterial) {
      db.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, ?, 0)')
        .run(userId, challenge.rewardMaterial, challenge.rewardMaterialQty || 1);
    }

    db.prepare('UPDATE daily_challenges SET claimed = ? WHERE user_id = ? AND date = ?')
      .run(JSON.stringify(claimed), userId, today);

    let msg = `✅ **${challenge.name}** — +${finalCoin} LT, +${finalExp} EXP`;
    if (streakMult > 1) msg += ` (Streak x${streakMult})`;

    return { success: true, message: msg };
  }

  /**
   * C-04: Get streak
   */
  getStreak(userId: string): number {
    this.initTable();
    const row = db.prepare('SELECT streak FROM daily_challenges WHERE user_id = ? ORDER BY date DESC LIMIT 1')
      .get(userId) as { streak: number } | undefined;
    return row?.streak || 0;
  }

  /**
   * C-04: Update streak (call at day end or day start)
   */
  updateStreak(userId: string): void {
    this.initTable();
    const today = this.getTodayString();
    const yesterday = this.getYesterdayString();

    const todayRecord = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
      .get(userId, today) as DailyChallengeRow | undefined;
    const yesterdayRecord = db.prepare('SELECT * FROM daily_challenges WHERE user_id = ? AND date = ?')
      .get(userId, yesterday) as DailyChallengeRow | undefined;

    if (!todayRecord) return;

    const todayCompleted: string[] = JSON.parse(todayRecord.completed || '[]');
    const allComplete = todayCompleted.length >= 3; // All 3 challenges done

    let newStreak = 1;
    if (yesterdayRecord) {
      const yestCompleted: string[] = JSON.parse(yesterdayRecord.completed || '[]');
      if (yestCompleted.length >= 3) {
        newStreak = (yesterdayRecord.streak || 0) + 1;
      }
    }

    if (allComplete) {
      db.prepare('UPDATE daily_challenges SET streak = ? WHERE user_id = ? AND date = ?')
        .run(newStreak, userId, today);
    }
  }

  /**
   * C-04: Get challenge description for UI
   */
  getChallengeDescription(userId: string): string {
    const { challenges, progress, streak } = this.getOrAssignChallenges(userId);

    let msg = `📋 **Thử Thách Hàng Ngày** (Streak: **${streak}** ngày)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const c of challenges) {
      const prog = progress[c.id] || 0;
      const done = prog >= c.target;
      const status = done ? '✅' : '⬜';
      const diffEmoji = c.difficulty === 'hard' ? '🔴' : c.difficulty === 'medium' ? '🟡' : '🟢';

      msg += `${status} ${diffEmoji} **${c.name}**: ${c.description}\n`;
      msg += `   Progress: ${prog}/${c.target} | Reward: ${c.rewardCoin} LT + ${c.rewardExp} EXP\n`;
    }

    if (streak >= 7) msg += `\n🔥 **Streak Bonus x${streak >= 30 ? 3 : streak >= 14 ? 2 : 1.5}**`;
    return msg;
  }

  private getTodayString(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    return vn.toISOString().slice(0, 10);
  }

  private getYesterdayString(): string {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000 - 86400000);
    return vn.toISOString().slice(0, 10);
  }
}

export const dailyChallengeService = new DailyChallengeService();
