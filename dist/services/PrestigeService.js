"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prestigeService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
// D-01: Prestige System
const MAX_PRESTIGE_LEVEL = 10;
const PRESTIGE_STAT_BONUS = 0.05; // +5% per prestige level
const MAX_PRESTIGE_BONUS = 0.50; // Max +50% from prestige
const PRESTIGE_UNLOCKS = [
    { id: 'nightmare_diff', name: 'Độ Khó Ác Mộng', description: 'Mở khóa độ khó Ác Mộng cho Bí Cảnh', requiredLevel: 1, emoji: '💀' },
    { id: 'skill_slot_5', name: 'Slot Kỹ Năng Thứ 5', description: 'Mở thêm 1 slot kỹ năng trang bị', requiredLevel: 2, emoji: '🎯' },
    { id: 'pet_merge_slot', name: 'Slot Dung Hợp Linh Thú', description: 'Mở slot dung hợp linh thú', requiredLevel: 3, emoji: '🐾' },
    { id: 'prestige_dungeon', name: 'Phó Bản Hư Không', description: 'Mở Phó Bản Hư Không Luân Hồi (3 tầng, reset hàng tuần)', requiredLevel: 5, emoji: '🌀' },
    { id: 'transmutation', name: 'Dung Hợp Vật Phẩm', description: 'Gộp 3 vật phẩm cùng phẩm thành 1 phẩm cao hơn', requiredLevel: 7, emoji: '⚗️' },
    { id: 'prestige_title', name: 'Danh Hiệu Thiên Đạo', description: 'Nhận danh hiệu "Thiên Đạo Đại Vương" + hào quang độc quyền', requiredLevel: 10, emoji: '👑' },
];
const PRESTIGE_SHOP_ITEMS = [
    { id: 'prestige_aura', name: 'Hào Quang Phi Thăng', description: 'Hào quang cho nhân vật', cost: 5, type: 'cosmetic', emoji: '✨' },
    { id: 'prestige_title', name: 'Danh Hiệu Phi Thăng', description: 'Danh hiệu "Thiên Đạo Đệ Nhất"', cost: 10, type: 'title', emoji: '🏆' },
    { id: 'prestige_mount', name: 'Tọa Kỵ Phi Thăng', description: 'Ngoại hình tọa kỵ độc quyền', cost: 20, type: 'cosmetic', emoji: '🐉' },
    { id: 'auto_battle', name: 'Tự Động Chiến Đấu', description: '10 vé auto-battle', cost: 3, type: 'convenience', emoji: '⚔️' },
    { id: 'instant_craft', name: 'Luyện Chế Tức Thì', description: '5 lần luyện chế không chờ', cost: 2, type: 'convenience', emoji: '⚒️' },
    { id: 'prestige_exp_boost', name: 'Tăng Tốc Tu Luyện', description: '+10% EXP trong 24h', cost: 8, type: 'convenience', emoji: '🌿' },
    // C1: New shop items
    { id: 'spirit_stone', name: 'Linh Thạch Tinh Hoa', description: 'Tăng vĩnh viễn 5% Linh Thạch nhận được', cost: 15, type: 'permanent', emoji: '💎' },
    { id: 'extra_pet_slot', name: 'Slot Linh Thú', description: 'Mở thêm 1 slot_linh_thu', cost: 25, type: 'permanent', emoji: '🐾' },
    { id: 'skill_reset_scroll', name: 'Cuộn Đánh Lại Kỹ Năng', description: 'Reset toàn bộ điểm kỹ năng', cost: 5, type: 'consumable', emoji: '🔄' },
    { id: 'prestige_scroll', name: 'Cuộn Prestige', description: 'Giảm 20 cấp yêu cầu để Prestige tiếp', cost: 30, type: 'consumable', emoji: '📜' },
];
class PrestigeService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS prestige_data (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        prestige_level INTEGER DEFAULT 0,
        prestige_tokens INTEGER DEFAULT 0,
        total_prestige_time INTEGER DEFAULT 0,
        prestige_unlocks TEXT DEFAULT '[]'
      );
    `);
        // A5: Add column if missing (migration)
        try {
            database_1.default.exec(`ALTER TABLE prestige_data ADD COLUMN prestige_unlocks TEXT DEFAULT '[]'`);
        }
        catch (_) { /* column exists */ }
    }
    /**
     * D-01: Get prestige data
     */
    getPrestigeData(userId) {
        this.initTable();
        let row = database_1.default.prepare('SELECT * FROM prestige_data WHERE user_id = ?').get(userId);
        if (!row) {
            database_1.default.prepare('INSERT INTO prestige_data (user_id, prestige_level, prestige_tokens, total_prestige_time) VALUES (?, 0, 0, 0)')
                .run(userId);
            row = database_1.default.prepare('SELECT * FROM prestige_data WHERE user_id = ?').get(userId);
        }
        return row;
    }
    /**
     * D-01: Can prestige? (Must be max level 380)
     */
    canPrestige(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { can: false, reason: 'Chưa tạo nhân vật!' };
        if (user.level < 380) {
            return { can: false, reason: `Cần cấp 380 (hiện ${user.level})` };
        }
        const prestige = this.getPrestigeData(userId);
        if (prestige.prestige_level >= MAX_PRESTIGE_LEVEL) {
            return { can: false, reason: `Đã đạt Luân Hồi tối đa (${MAX_PRESTIGE_LEVEL})` };
        }
        return { can: true, reason: 'Đủ điều kiện Luân Hồi!' };
    }
    /**
     * D-01: Perform prestige — reset level, gain prestige level + tokens
     */
    prestige(userId) {
        const { can, reason } = this.canPrestige(userId);
        if (!can)
            return { success: false, message: `❌ ${reason}` };
        const user = UserRepository_1.userRepository.get(userId);
        const prestige = this.getPrestigeData(userId);
        const newPrestigeLevel = prestige.prestige_level + 1;
        const tokensEarned = newPrestigeLevel * 5; // More tokens for higher prestige
        database_1.default.transaction(() => {
            // Reset user to level 1
            UserRepository_1.userRepository.update(userId, {
                level: 1,
                tu_vi: 0,
                exp_needed: 100
            });
            // Update prestige data
            database_1.default.prepare(`
        INSERT INTO prestige_data (user_id, prestige_level, prestige_tokens, total_prestige_time)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
          prestige_level = excluded.prestige_level,
          prestige_tokens = prestige_tokens + excluded.prestige_tokens,
          total_prestige_time = total_prestige_time + 1
      `).run(userId, newPrestigeLevel, tokensEarned);
        })();
        const bonusPercent = Math.min(newPrestigeLevel * 5, 50);
        // A5: Check for new unlocks
        const newUnlocks = PRESTIGE_UNLOCKS.filter(u => u.requiredLevel === newPrestigeLevel);
        if (newUnlocks.length > 0) {
            const existingUnlocks = JSON.parse(prestige.prestige_unlocks || '[]');
            for (const unlock of newUnlocks) {
                if (!existingUnlocks.includes(unlock.id)) {
                    existingUnlocks.push(unlock.id);
                }
            }
            database_1.default.prepare('UPDATE prestige_data SET prestige_unlocks = ? WHERE user_id = ?')
                .run(JSON.stringify(existingUnlocks), userId);
        }
        return {
            success: true,
            message: `🌟 **LUÂN HỒI THÀNH CÔNG!**\n` +
                `🔄 Cấp Luân Hồi: **${newPrestigeLevel}**/${MAX_PRESTIGE_LEVEL}\n` +
                `📈 **+${bonusPercent}%** toàn bộ chỉ số (tối đa +50%)\n` +
                `🎫 +${tokensEarned} Phiếu Luân Hồi\n` +
                `🔄 Đã reset về Cấp 1`
        };
    }
    /**
     * D-01: Get prestige stat bonuses
     */
    getPrestigeBonuses(userId) {
        const prestige = this.getPrestigeData(userId);
        const bonus = Math.min(prestige.prestige_level * PRESTIGE_STAT_BONUS, MAX_PRESTIGE_BONUS);
        return {
            atk: bonus,
            def: bonus,
            hp: bonus,
            speed: bonus
        };
    }
    /**
     * D-01: Get prestige shop items
     */
    getShopItems() {
        return PRESTIGE_SHOP_ITEMS;
    }
    /**
     * D-01: Buy from prestige shop
     */
    buyFromShop(userId, itemId) {
        const item = PRESTIGE_SHOP_ITEMS.find(i => i.id === itemId);
        if (!item)
            return { success: false, message: '❌ Item không tồn tại!' };
        const prestige = this.getPrestigeData(userId);
        if (prestige.prestige_tokens < item.cost) {
            return { success: false, message: `❌ Không đủ Phiếu Luân Hồi! (Cần ${item.cost}, có ${prestige.prestige_tokens})` };
        }
        database_1.default.prepare('UPDATE prestige_data SET prestige_tokens = prestige_tokens - ? WHERE user_id = ?')
            .run(item.cost, userId);
        // Apply reward based on type
        if (item.type === 'title') {
            database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
                .run(userId, item.name, 'prestige', Math.floor(Date.now() / 1000));
        }
        return {
            success: true,
            message: `✅ Đã mua **${item.name}**! (-${item.cost} Phiếu Luân Hồi)`
        };
    }
    /**
     * D-01: Get prestige description for UI
     */
    getPrestigeDescription(userId) {
        const prestige = this.getPrestigeData(userId);
        const bonus = Math.min(prestige.prestige_level * 5, 50);
        const { can } = this.canPrestige(userId);
        let msg = `🌟 **Hệ Thống Luân Hồi**\n`;
        msg += `📊 Cấp: **${prestige.prestige_level}**/${MAX_PRESTIGE_LEVEL}\n`;
        msg += `📈 Thưởng: **+${bonus}%** toàn bộ chỉ số\n`;
        msg += `🎫 Phiếu: **${prestige.prestige_tokens}**\n`;
        msg += `🔄 Total prestiges: **${prestige.total_prestige_time}**\n\n`;
        if (can) {
            msg += `✅ **Sẵn sàng Luân Hồi!** Dùng \`/prestige\` để thực hiện.`;
        }
        else if (prestige.prestige_level >= MAX_PRESTIGE_LEVEL) {
            msg += `🏆 **Đã đạt Luân Hồi tối đa!**`;
        }
        else {
            msg += `❌ Cần cấp 380 để Luân Hồi.`;
        }
        return msg;
    }
    // === A5: Prestige Unlocks ===
    hasPrestigeUnlock(userId, unlockId) {
        const prestige = this.getPrestigeData(userId);
        const unlocks = JSON.parse(prestige.prestige_unlocks || '[]');
        return unlocks.includes(unlockId);
    }
    getPrestigeUnlocks(userId) {
        const prestige = this.getPrestigeData(userId);
        const unlocks = JSON.parse(prestige.prestige_unlocks || '[]');
        const unlocked = PRESTIGE_UNLOCKS.filter(u => unlocks.includes(u.id));
        const locked = PRESTIGE_UNLOCKS.filter(u => !unlocks.includes(u.id));
        return { unlocked, locked };
    }
    getUnlocksDescription(userId) {
        const { unlocked, locked } = this.getPrestigeUnlocks(userId);
        let msg = `🌟 **Mở Khóa Luân Hồi**\n`;
        if (unlocked.length > 0) {
            msg += `\n✅ **Đã mở khóa:**\n`;
            for (const u of unlocked) {
                msg += `${u.emoji} **${u.name}** — ${u.description}\n`;
            }
        }
        if (locked.length > 0) {
            msg += `\n🔒 **Chưa mở khóa:**\n`;
            for (const u of locked) {
                msg += `${u.emoji} **${u.name}** — Luân Hồi ${u.requiredLevel}\n`;
            }
        }
        return msg;
    }
    /**
     * D-01: Get prestige leaderboard
     */
    getLeaderboard(limit = 10) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT pd.*, u.name FROM prestige_data pd
      JOIN users u ON pd.user_id = u.discord_id
      ORDER BY pd.prestige_level DESC, pd.prestige_tokens DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            prestigeLevel: r.prestige_level,
            tokens: r.prestige_tokens
        }));
    }
}
exports.prestigeService = new PrestigeService();
