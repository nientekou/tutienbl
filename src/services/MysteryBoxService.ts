// V15 B-04: Mystery Box Daily
import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

interface MysteryBoxReward {
  type: 'coins' | 'material' | 'rare' | 'legendary' | 'mythic';
  name: string;
  amount: number;
  emoji: string;
}

const REWARD_POOL: MysteryBoxReward[] = [
  // Coins (60%)
  { type: 'coins', name: 'Linh Thạch', amount: 500, emoji: '🪙' },
  { type: 'coins', name: 'Linh Thạch', amount: 1000, emoji: '🪙' },
  { type: 'coins', name: 'Linh Thạch', amount: 2000, emoji: '🪙' },
  // Materials (25%)
  { type: 'material', name: 'Nguyên liệu thường', amount: 5, emoji: '📦' },
  { type: 'material', name: 'Nguyên liệu hiếm', amount: 3, emoji: '📦' },
  // Rare (10%)
  { type: 'rare', name: 'Vật phẩm hiếm', amount: 1, emoji: '🔵' },
  // Legendary (4%)
  { type: 'legendary', name: 'Vật phẩm huyền thoại', amount: 1, emoji: '🟣' },
  // Mythic (1%)
  { type: 'mythic', name: 'V vật phẩm thần thoại', amount: 1, emoji: '🟡' },
];

class MysteryBoxService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mystery_box_claims (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        streak INTEGER DEFAULT 1,
        PRIMARY KEY (user_id, day)
      );
    `);
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public canClaim(userId: string): { eligible: boolean; reason: string } {
    this.initTable();
    const today = this.getToday();
    const row = db.prepare('SELECT 1 FROM mystery_box_claims WHERE user_id = ? AND day = ?')
      .get(userId, today);
    if (row) return { eligible: false, reason: 'Đã mở hộp quà hôm nay rồi!' };
    return { eligible: true, reason: '' };
  }

  public claim(userId: string): { success: boolean; message: string; reward?: MysteryBoxReward } {
    const check = this.canClaim(userId);
    if (!check.eligible) return { success: false, message: `❌ ${check.reason}` };

    const today = this.getToday();

    // Calculate streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prevStreak = db.prepare('SELECT streak FROM mystery_box_claims WHERE user_id = ? AND day = ?')
      .get(userId, yesterday) as { streak: number } | undefined;
    const streak = (prevStreak?.streak || 0) + 1;

    // Record claim
    db.prepare(`
      INSERT INTO mystery_box_claims (user_id, day, streak) VALUES (?, ?, ?)
      ON CONFLICT(user_id, day) DO NOTHING
    `).run(userId, today, streak);

    // Roll reward
    let reward: MysteryBoxReward;
    if (streak >= 7) {
      // Streak 7+: guaranteed rare+
      const rarePool = REWARD_POOL.filter(r => r.type === 'rare' || r.type === 'legendary' || r.type === 'mythic');
      reward = rarePool[Math.floor(Math.random() * rarePool.length)];
    } else {
      reward = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
    }

    // Apply reward
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Lỗi user.' };

    if (reward.type === 'coins') {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.amount });
    }

    const streakText = streak >= 7 ? `\n🔥 **Streak ${streak} ngày!** Guaranteed rare+` : `\n📅 Streak: ${streak}/7 ngày`;

    return {
      success: true,
      message: `${reward.emoji} **Mở Hộp Quà:** ${reward.name} x${reward.amount}${streakText}`,
      reward,
    };
  }

  public getDescription(userId: string): string {
    const today = this.getToday();
    const row = db.prepare('SELECT streak FROM mystery_box_claims WHERE user_id = ? AND day = ?')
      .get(userId, today) as { streak: number } | undefined;
    const claimed = !!row;
    const streak = row?.streak || 0;

    let msg = '📦 **Hộp Quà Bí Ẩn**\n';
    msg += `📅 Hôm nay: ${claimed ? '✅ Đã mở' : '❌ Chưa mở'}\n`;
    msg += `🔥 Streak: ${streak}/7 ngày${streak >= 7 ? ' (Guaranteed rare+!)' : ''}`;
    return msg;
  }
}

export const mysteryBoxService = new MysteryBoxService();
