"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossBountyService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
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
    refreshBounties() {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + 86400; // 24h
        // Check if existing non-expired bounties exist
        const existing = database_1.default.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at DESC LIMIT 5
    `).all(now);
        if (existing.length >= 5)
            return existing;
        // Generate 5 new bounties
        const newBounties = [];
        const insertStmt = database_1.default.prepare(`
      INSERT INTO boss_bounties (bounty_type, difficulty, target_desc, required, reward_exp, reward_coin, reward_tokens, reward_materials, restriction, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertTx = database_1.default.transaction(() => {
            // Delete old bounties
            database_1.default.prepare('DELETE FROM boss_bounties WHERE expires_at <= ?').run(now);
            for (let i = 0; i < 5; i++) {
                const diff = this.rollDifficulty();
                const template = BOUNTY_TARGETS[diff][Math.floor(Math.random() * BOUNTY_TARGETS[diff].length)];
                const required = template.requiredBase + Math.floor(Math.random() * 3);
                const scaling = 1.0; // Could scale with server average level
                const rewardExp = Math.round((diff === 'legendary' ? 6000 : diff === 'epic' ? 4000 : diff === 'rare' ? 2500 : 1000) * scaling);
                const rewardCoin = diff === 'legendary' ? 200 : diff === 'epic' ? 600 : diff === 'rare' ? 300 : 100;
                const tokens = TOKEN_REWARDS[diff] || 10;
                const restriction = diff === 'legendary'
                    ? this.rollRestriction()
                    : null;
                const desc = template.desc.replace('{n}', String(required));
                const result = insertStmt.run(template.type, diff, desc, required, rewardExp, rewardCoin, tokens, null, restriction, now, expiresAt);
                newBounties.push({ id: result.lastInsertRowid });
            }
        });
        insertTx();
        return database_1.default.prepare('SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at ASC').all(now);
    }
    /**
     * Lấy 5 bounty hiện tại cho user
     */
    getActiveBounties(userId) {
        const now = Math.floor(Date.now() / 1000);
        const bounties = database_1.default.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? ORDER BY created_at ASC LIMIT 5
    `).all(now);
        // Ensure user has completion rows for all active bounties
        for (const b of bounties) {
            const existing = database_1.default.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, b.id);
            if (!existing) {
                database_1.default.prepare(`
          INSERT INTO user_bounty_completions (user_id, bounty_id, progress, is_completed, is_claimed)
          VALUES (?, ?, 0, 0, 0)
        `).run(userId, b.id);
            }
        }
        return bounties.map(b => {
            const userProgress = database_1.default.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, b.id);
            return { ...b, userProgress: userProgress || null };
        });
    }
    /**
     * Cập nhật tiến trình bounty
     */
    updateProgress(userId, bountyType, amount = 1) {
        const now = Math.floor(Date.now() / 1000);
        const messages = [];
        const activeBounties = database_1.default.prepare(`
      SELECT * FROM boss_bounties WHERE expires_at > ? AND bounty_type = ?
    `).all(now, bountyType);
        for (const bounty of activeBounties) {
            const completion = database_1.default.prepare(`
        SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ?
      `).get(userId, bounty.id);
            if (!completion || completion.is_completed)
                continue;
            const newProgress = Math.min(bounty.required, completion.progress + amount);
            database_1.default.prepare(`
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
    claimBounty(userId, bountyId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const bounty = database_1.default.prepare('SELECT * FROM boss_bounties WHERE id = ?').get(bountyId);
        if (!bounty)
            return { success: false, message: 'Bounty không tồn tại.' };
        const completion = database_1.default.prepare(`
      SELECT * FROM user_bounty_completions WHERE user_id = ? AND bounty_id = ? AND is_completed = 1 AND is_claimed = 0
    `).get(userId, bountyId);
        if (!completion)
            return { success: false, message: 'Bounty chưa hoàn thành hoặc đã nhận thưởng.' };
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE user_bounty_completions SET is_claimed = 1 WHERE id = ?').run(completion.id);
            UserRepository_1.userRepository.update(userId, {
                tu_vi: Math.min(user.tu_vi + bounty.reward_exp, user.exp_needed),
                coin_ha_pham: user.coin_ha_pham + bounty.reward_coin,
                bounty_tokens: (user.bounty_tokens || 0) + bounty.reward_tokens
            });
        })();
        const diffEmoji = bounty.difficulty === 'legendary' ? '🟡' : bounty.difficulty === 'epic' ? '🟣' : bounty.difficulty === 'rare' ? '🔵' : '⚪';
        return {
            success: true,
            message: `${diffEmoji} **Bounty hoàn thành!** ${bounty.target_desc}\n🟤 +${bounty.reward_coin} LT | 🌿 +${bounty.reward_exp} Tu Vi | 🎫 +${bounty.reward_tokens} Token`
        };
    }
    /**
     * Lấy thông tin Token Shop
     */
    getTokenShopInfo(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        const tokens = user?.bounty_tokens || 0;
        let msg = `🎫 **Cửa Hàng Token Săn Thưởng** (Hiện có: **${tokens}** token)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const item of TOKEN_SHOP) {
            const canBuy = tokens >= item.cost ? '✅' : '❌';
            msg += `${canBuy} **${item.name}** — ${item.cost} token\n`;
        }
        return msg;
    }
    rollDifficulty() {
        const rand = Math.random() * 100;
        if (rand < 5)
            return 'legendary';
        if (rand < 20)
            return 'epic';
        if (rand < 50)
            return 'rare';
        return 'common';
    }
    rollRestriction() {
        const restrictions = ['solo_only', 'no_heal', 'fast_kill', 'element_only'];
        return restrictions[Math.floor(Math.random() * restrictions.length)];
    }
}
exports.bossBountyService = new BossBountyService();
