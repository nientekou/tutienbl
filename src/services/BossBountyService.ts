import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { getRealmDetails } from '../utils/constants';

// P2-02: Boss Bounty Board
interface BountyRow {
  id: number;
  bounty_type: string;
  difficulty: string;
  target_desc: string;
  required: number;
  reward_exp: number;
  reward_coin: number;
  reward_tokens: number;
  reward_materials: string | null;
  restriction: string | null;
  created_at: number;
  expires_at: number;
}

interface UserBountyRow {
  id: number;
  user_id: string;
  bounty_id: number;
  progress: number;
  is_completed: number;
  is_claimed: number;
  completed_at: number | null;
}

const BOUNTY_DIFFICULTY = {
  common: { weight: 50, tokenMultiplier: 1 },
  rare: { weight: 30, tokenMultiplier: 2 },
  epic: { weight: 15, tokenMultiplier: 3 },
  legendary: { weight: 5, tokenMultiplier: 4 },
};

// Target templates per difficulty
const BOUNTY_TARGETS = {
  common: [
    { type: 'kill', desc: 'Tiêu diệt {n} yêu quái', requiredBase: 5 },
    { type: 'work', desc: 'Làm việc {n} lần', requiredBase: 3 },
    { type: 'meditate', desc: 'Thiền định {n} lần', requiredBase: 2 },
  ],
  rare: [
    { type: 'dungeon', desc: 'Hoàn thành Bí Cảnh {n} lần', requiredBase: 3 },
    { type: 'explore', desc: 'Thám hiểm {n} lần', requiredBase: 4 },
    { type: 'craft', desc: 'Luyện chế {n} đan dược', requiredBase: 3 },
  ],
  epic: [
    { type: 'elite', desc: 'Đánh bại elite enemy {n} lần', requiredBase: 2 },
    { type: 'tower', desc: 'Leo {n} tầng Tháp Vô Hạn', requiredBase: 5 },
  ],
  legendary: [
    { type: 'solo_boss', desc: 'Đánh bại Boss (Đơn Độc Nhất Bát — không pet)', requiredBase: 1 },
    { type: 'no_heal', desc: 'Đánh bại Boss (Thiết Huyết — không hồi máu)', requiredBase: 1 },
    { type: 'fast_kill', desc: 'Đánh bại Boss trong 10 hiệp (Thiên Cơ)', requiredBase: 1 },
    { type: 'element_only', desc: 'Đánh bại Boss chỉ dùng skill hệ ưu thế (Ngũ Hành剋)', requiredBase: 1 },
  ],
};

const TOKEN_REWARDS = { common: 10, rare: 25, epic: 50, legendary: 100 };
const TOKEN_SHOP = [
  { cost: 50, name: 'Vật liệu hiếm ngẫu nhiên', type: 'rare_material' },
  { cost: 150, name: 'Bộ chọn vật liệu Cực Phẩm', type: 'epic_material' },
  { cost: 500, name: 'Mảnh vũ khí Thần Thoại', type: 'legendary_fragment' },
];

class BossBountyService {
  /**
   * Tạo bounty mới hoặc lấy bounty hiện tại
   */
  refreshBounties(): BountyRow[] {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400; // 24h

    // Check if existing non-expired bounties exist
    const existing = db.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at DESC LIMIT 5
    `).all(now) as BountyRow[];

    if (existing.length >= 5) return existing;

    // Generate 5 new bounties
    const newBounties: BountyRow[] = [];
    const insertStmt = db.prepare(`
      INSERT INTO boss_bounties (bounty_type, difficulty, target_desc, required, reward_exp, reward_coin, reward_tokens, reward_materials, restriction, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTx = db.transaction(() => {
      // Delete old bounties
      db.prepare('DELETE FROM boss_bounties WHERE expires_at <= ?').run(now);

      for (let i = 0; i < 5; i++) {
        const diff = this.rollDifficulty();
        const template = BOUNTY_TARGETS[diff as keyof typeof BOUNTY_TARGETS][
          Math.floor(Math.random() * BOUNTY_TARGETS[diff as keyof typeof BOUNTY_TARGETS].length)
        ];

        const required = template.requiredBase + Math.floor(Math.random() * 3);
        const scaling = 1.0; // Could scale with server average level
        const rewardExp = Math.round((diff === 'legendary' ? 6000 : diff === 'epic' ? 4000 : diff === 'rare' ? 2500 : 1000) * scaling);
        const rewardCoin = diff === 'legendary' ? 200 : diff === 'epic' ? 600 : diff === 'rare' ? 300 : 100;
        const tokens = TOKEN_REWARDS[diff as keyof typeof TOKEN_REWARDS] || 10;

        const restriction = diff === 'legendary'
          ? this.rollRestriction()
          : null;

        const desc = template.desc.replace('{n}', String(required));

        const result = insertStmt.run(
          template.type, diff, desc, required, rewardExp, rewardCoin, tokens,
          null, restriction, now, expiresAt
        );
        newBounties.push({ id: result.lastInsertRowid as number } as BountyRow);
      }
    });
    insertTx();

    return db.prepare('SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at ASC').all(now) as BountyRow[];
  }

  /**
   * Lấy 5 bounty hiện tại cho user
   */
  getActiveBounties(userId: string): (BountyRow & { userProgress: UserBountyRow | null })[] {
    const now = Math.floor(Date.now() / 1000);
    const bounties = db.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at ASC LIMIT 5
    `).all(now) as BountyRow[];

    // Ensure user has completion rows for all active bounties
    for (const b of bounties) {
      const existing = db.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, b.id) as UserBountyRow | undefined;
      if (!existing) {
        db.prepare(`
          INSERT INTO user_bounty_completions (user_id, bounty_id, progress, is_completed, is_claimed)
          VALUES (?, ?, 0, 0, 0)
        `).run(userId, b.id);
      }
    }

    return bounties.map(b => {
      const userProgress = db.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, b.id) as UserBountyRow | undefined;
      return { ...b, userProgress: userProgress || null };
    });
  }

  /**
   * Cập nhật tiến trình bounty
   */
  updateProgress(userId: string, bountyType: string, amount: number = 1): string[] {
    const now = Math.floor(Date.now() / 1000);
    const messages: string[] = [];

    const activeBounties = db.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? AND bounty_type = ?
    `).all(now, bountyType) as BountyRow[];

    for (const bounty of activeBounties) {
      const completion = db.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, bounty.id) as UserBountyRow | undefined;

      if (!completion || completion.is_completed) continue;

      const newProgress = Math.min(bounty.required, completion.progress + amount);
      db.prepare(`
        UPDATE user_bounty_completions SET progress = ?, is_completed = CASE WHEN ? >= ? THEN 1 ELSE 0 END, completed_at = CASE WHEN ? >= ? THEN ? ELSE NULL END
        WHERE user_id = ? AND bounty_id = ?
      `).run(newProgress, newProgress, bounty.required, newProgress, bounty.required, now, userId, bounty.id);

      if (newProgress >= bounty.required && !completion.is_completed) {
        messages.push(`🎯 **Bounty hoàn thành:** ${bounty.target_desc}! Dùng \`/bangsatthu nhan-thuong ${bounty.id}\` để nhận thưởng.`);
      }
    }

    return messages;
  }

  /**
   * Nhận thưởng bounty
   */
  claimBounty(userId: string, bountyId: number): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };

    const bounty = db.prepare('SELECT * FROM boss_bounties WHERE id = ?').get(bountyId) as BountyRow | undefined;
    if (!bounty) return { success: false, message: 'Bounty không tồn tại.' };

    const completion = db.prepare(`
      SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ? AND is_completed = 1 AND is_claimed = 0
    `).get(userId, bountyId) as UserBountyRow | undefined;

    if (!completion) return { success: false, message: 'Bounty chưa hoàn thành hoặc đã nhận thưởng.' };

    db.transaction(() => {
      db.prepare('UPDATE user_bounty_completions SET is_claimed = 1 WHERE id = ?').run(completion.id);
      userRepository.update(userId, {
        tu_vi: Math.min(user.tu_vi + bounty.reward_exp, user.exp_needed),
        coin_ha_pham: user.coin_ha_pham + bounty.reward_coin,
        bounty_tokens: (user.bounty_tokens || 0) + bounty.reward_tokens
      });
    })();

    const diffEmoji = bounty.difficulty === 'legendary' ? '🟡' : bounty.difficulty === 'epic' ? '🟣' : bounty.difficulty === 'rare' ? '🔵' : '⚪';

    return {
      success: true,
      message: `${diffEmoji} **Bounty hoàn thành!** ${bounty.target_desc}\n🟤 +${bounty.reward_coin} LT | 🌿 +${bounty.reward_exp} Tu Vi | 🎫 +${bounty.reward_tokens} Phiếu`
    };
  }

  /**
   * Lấy thông tin Token Shop
   */
  getTokenShopInfo(userId: string): string {
    const user = userRepository.get(userId);
    const tokens = user?.bounty_tokens || 0;

    let msg = `🎫 **Cửa Hàng Phiếu Săn Thưởng** (Hiện có: **${tokens}** Phiếu)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const item of TOKEN_SHOP) {
      const canBuy = tokens >= item.cost ? '✅' : '❌';
      msg += `${canBuy} **${item.name}** — ${item.cost} Phiếu\n`;
    }
    return msg;
  }

  private rollDifficulty(): string {
    const rand = Math.random() * 100;
    if (rand < 5) return 'legendary';
    if (rand < 20) return 'epic';
    if (rand < 50) return 'rare';
    return 'common';
  }

  private rollRestriction(): string {
    const restrictions = ['solo_only', 'no_heal', 'fast_kill', 'element_only'];
    return restrictions[Math.floor(Math.random() * restrictions.length)];
  }
}

export const bossBountyService = new BossBountyService();
