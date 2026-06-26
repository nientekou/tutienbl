"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bloodlineService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AchievementService_1 = require("./AchievementService");
const itemConstants_1 = require("../config/itemConstants");
class BloodlineService {
    getAllBloodlines() {
        return database_1.default.prepare('SELECT * FROM bloodlines').all();
    }
    getUserBloodline(userId) {
        const row = database_1.default.prepare(`
      SELECT ub.*, b.name, b.description, b.passives, b.weakness, b.rage_effect
      FROM user_bloodlines ub
      JOIN bloodlines b ON ub.bloodline_id = b.id
      WHERE ub.user_id = ?
    `).get(userId);
        if (!row)
            return null;
        return {
            ...row,
            passives: JSON.parse(row.passives || '{}'),
            weakness: JSON.parse(row.weakness || '{}'),
            rage_effect: JSON.parse(row.rage_effect || '{}'),
        };
    }
    chooseBloodline(userId, bloodlineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        if (user.level < 10)
            return { success: false, message: 'Cần đạt Cấp 10 để giác tỉnh Huyết Mạch!' };
        const existing = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (existing)
            return { success: false, message: 'Đạo hữu đã giác tỉnh Huyết Mạch rồi! Hãy dùng Huyết Mạch Chuyển Hóa Đan để thay đổi.' };
        const bloodline = database_1.default.prepare('SELECT * FROM bloodlines WHERE id = ?').get(bloodlineId);
        if (!bloodline)
            return { success: false, message: 'Huyết mạch không tồn tại!' };
        if (user.coin_ha_pham < 500)
            return { success: false, message: 'Thiếu 500 Linh Thạch phí giác tỉnh!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 500 });
            database_1.default.prepare(`
        INSERT INTO user_bloodlines (user_id, bloodline_id, level, exp, activated_at, rage_cooldown)
        VALUES (?, ?, 1, 0, ?, 0)
      `).run(userId, bloodlineId, now);
        })();
        // Kiểm tra thành tựu Thiên Mệnh Chi Tử
        AchievementService_1.achievementService.setProgress(userId, 'tl_19', 1);
        return { success: true, message: `🩸 Chúc mừng! Đạo hữu đã giác tỉnh thành công **${bloodline.name}**!` };
    }
    changeBloodline(userId, newBloodlineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const existing = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (!existing)
            return { success: false, message: 'Đạo hữu chưa giác tỉnh Huyết Mạch! Dùng /huyetmach chon để giác tỉnh.' };
        const bloodline = database_1.default.prepare('SELECT * FROM bloodlines WHERE id = ?').get(newBloodlineId);
        if (!bloodline)
            return { success: false, message: 'Huyết mạch mới không tồn tại!' };
        const requiredItem = itemConstants_1.ITEMS.ITEM_BLOODLINE_PILL;
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const item = inv.find(i => i.item_id === requiredItem && i.is_equipped === 0);
        if (!item || item.quantity < 1) {
            return { success: false, message: 'Đạo hữu cần 1 viên **Huyết Mạch Chuyển Hóa Đan** để thay đổi huyết mạch!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            if (item.quantity > 1) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(item.id);
            }
            else {
                database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
            }
            database_1.default.prepare(`
        UPDATE user_bloodlines 
        SET bloodline_id = ?, level = 1, exp = 0, activated_at = ?, rage_cooldown = 0
        WHERE user_id = ?
      `).run(newBloodlineId, now, userId);
        })();
        // Kiểm tra thành tựu Thiên Mệnh Chi Tử
        AchievementService_1.achievementService.setProgress(userId, 'tl_19', 1);
        return { success: true, message: `🩸 Đạo hữu đã chuyển đổi thành công sang **${bloodline.name}**. Huyết mạch tu vi quay về cấp 1!` };
    }
    addExp(userId, expAmount) {
        const ub = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (!ub)
            return;
        if (ub.level >= 50)
            return; // Max level
        let currentExp = ub.exp;
        let currentLevel = ub.level;
        currentExp += expAmount;
        let expNeeded = currentLevel * 200;
        while (currentExp >= expNeeded && currentLevel < 50) {
            currentExp -= expNeeded;
            currentLevel++;
            expNeeded = currentLevel * 200;
        }
        if (currentLevel >= 50) {
            currentLevel = 50;
            currentExp = 0;
        }
        database_1.default.prepare('UPDATE user_bloodlines SET level = ?, exp = ? WHERE user_id = ?').run(currentLevel, currentExp, userId);
    }
    getActivePassives(ub) {
        const result = {};
        const passives = ub.passives;
        // levels = ['1', '10', '25', '50']
        const breakpoints = [1, 10, 25, 50];
        for (const bp of breakpoints) {
            if (ub.level >= bp && passives[bp.toString()]) {
                const p = passives[bp.toString()];
                result[p.stat] = p.value;
            }
        }
        return result;
    }
    updateRageCooldown(userId, newCooldown) {
        database_1.default.prepare('UPDATE user_bloodlines SET rage_cooldown = ? WHERE user_id = ?').run(newCooldown, userId);
    }
    // === P5-02: Bloodline Trials ===
    getWeekKey() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const day = vn.getUTCDay() || 7;
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return vn.toISOString().slice(0, 10);
    }
    /**
     * P5-02: Kiểm tra còn lượt trial không
     */
    getTrialInfo(userId) {
        const weekKey = this.getWeekKey();
        let row = database_1.default.prepare('SELECT * FROM bloodline_trials WHERE user_id = ? AND week_key = ?').get(userId, weekKey);
        if (!row) {
            database_1.default.prepare('INSERT INTO bloodline_trials (user_id, bloodline_id, week_key, trials_used, max_trials) VALUES (?, ?, ?, 0, 3)').run(userId, '', weekKey);
            row = database_1.default.prepare('SELECT * FROM bloodline_trials WHERE user_id = ? AND week_key = ?').get(userId, weekKey);
        }
        return {
            used: row.trials_used,
            max: row.max_trials,
            canEnter: row.trials_used < row.max_trials
        };
    }
    /**
     * P5-02: Vào Bloodline Trial — mô phỏng fight dựa trên bloodline type
     * Returns trial result with rewards
     */
    enterTrial(userId) {
        const ub = this.getUserBloodline(userId);
        if (!ub)
            return { success: false, message: 'Đạo hữu chưa kích hoạt Huyết Mạch!' };
        if (ub.level < 25) {
            return { success: false, message: `Cần Huyết Mạch cấp 25+ để mở khóa Thử Thách Huyết Mạch (hiện cấp ${ub.level}).` };
        }
        const trialInfo = this.getTrialInfo(userId);
        if (!trialInfo.canEnter) {
            return { success: false, message: `Đã hết lượt Thử Thách tuần này (${trialInfo.used}/${trialInfo.max}).` };
        }
        // Simple trial result based on bloodline level
        const successChance = Math.min(0.5 + ub.level * 0.01, 0.95); // 50-95% based on level
        const isWin = Math.random() < successChance;
        const weekKey = this.getWeekKey();
        database_1.default.prepare('UPDATE bloodline_trials SET trials_used = trials_used + 1 WHERE user_id = ? AND week_key = ?').run(userId, weekKey);
        if (isWin) {
            const expReward = 200 + ub.level * 50;
            this.addExp(userId, expReward);
            const materials = ['bloodline_stone', 'bloodline_crystal', 'bloodline_essence'];
            const material = materials[Math.floor(Math.random() * materials.length)];
            const trialNames = {
                'long_huyet': 'Thử Thách Long Huyết — Vampire lifesteal',
                'phuong_hoang': 'Thử Thách Phượng Hoàng — Die & revive',
                'con_luan': 'Thử Thách Côn Luân — Endurance 20 hiệp',
                'bach_ho': 'Thử Thách Bạch Hổ — Kill in 5 hiệp',
                'thanh_long': 'Thử Thách Thanh Long — Speed trial',
                'huyen_vu': 'Thử Thách Huyền Vũ — Shield-only'
            };
            return {
                success: true,
                message: `⚔️ **${trialNames[ub.bloodline_id] || 'Thử Thách Huyết Mạch'}** — THÀNH CÔNG!\n+${expReward} EXP Huyết Mạch | +1 ${material}`,
                expReward,
                materialReward: material
            };
        }
        return {
            success: true,
            message: `⚔️ **Thử Thách Huyết Mạch** — THẤT BẠI! Huyết Mạch chưa đủ mạnh. Thử lại tuần sau!`
        };
    }
    // === A-05: Bloodline Trials Expansion ===
    /**
     * A-05: Get trial chapters for a bloodline
     */
    getTrialChapters(bloodlineId) {
        const chapters = {
            'long_huyet': [
                { chapter: 1, name: 'Long Huyết — Hấp Huyết', description: 'Phải hút máu để tồn tại', minLevel: 25, rewards: '+5% hút máu' },
                { chapter: 2, name: 'Long Huyết — Long Tức', description: 'Hồi phục 50% HP mỗi hiệp', minLevel: 35, rewards: '+10% hút máu' },
                { chapter: 3, name: 'Long Huyết — Long Vương', description: 'Đánh bại Boss Long Vương', minLevel: 45, rewards: '+15% hút máu' },
            ],
            'phuong_hoang': [
                { chapter: 1, name: 'Phượng Hoàng — Niết Bàn', description: 'Chết và hồi sinh 1 lần', minLevel: 25, rewards: '+5% tỷ lệ hồi sinh' },
                { chapter: 2, name: 'Phượng Hoàng — Hỏa Phượng', description: '+50% sát thương khi hồi sinh', minLevel: 35, rewards: '+10% tỷ lệ hồi sinh' },
                { chapter: 3, name: 'Phượng Hoàng — Phượng Hoàng', description: 'Hồi sinh với đầy HP', minLevel: 45, rewards: '+15% tỷ lệ hồi sinh' },
            ],
            'con_luan': [
                { chapter: 1, name: 'Côn Luân — Chịu Đựng', description: 'Sống sót 10 hiệp', minLevel: 25, rewards: '+5% giảm sát thương' },
                { chapter: 2, name: 'Côn Luân — Bất Tử', description: 'Sống sót 15 hiệp', minLevel: 35, rewards: '+10% giảm sát thương' },
                { chapter: 3, name: 'Côn Luân — Vạn Kiếp', description: 'Sống sót 20 hiệp', minLevel: 45, rewards: '+15% giảm sát thương' },
            ],
            'bach_ho': [
                { chapter: 1, name: 'Bạch Hổ — Sát Phạt', description: 'Tiêu diệt trong 5 hiệp', minLevel: 25, rewards: '+5% tỷ lệ chí mạng' },
                { chapter: 2, name: 'Bạch Hổ — Bạch Hổ', description: 'Tiêu diệt trong 3 hiệp', minLevel: 35, rewards: '+10% tỷ lệ chí mạng' },
                { chapter: 3, name: 'Bạch Hổ — Hổ Vương', description: 'Tiêu diệt trong 2 hiệp', minLevel: 45, rewards: '+15% tỷ lệ chí mạng' },
            ],
            'thanh_long': [
                { chapter: 1, name: 'Thanh Long — Tốc Độ', description: 'Nhanh hơn địch 3 lần', minLevel: 25, rewards: '+5% tốc độ' },
                { chapter: 2, name: 'Thanh Long — Thanh Long', description: 'Nhanh hơn địch 5 lần', minLevel: 35, rewards: '+10% tốc độ' },
                { chapter: 3, name: 'Thanh Long — Long Vương', description: 'Nhanh hơn địch 7 lần', minLevel: 45, rewards: '+15% tốc độ' },
            ],
            'huyen_vu': [
                { chapter: 1, name: 'Huyền Vũ — Khiên', description: 'Sống sót chỉ dùng khiên', minLevel: 25, rewards: '+5% lượng khiên' },
                { chapter: 2, name: 'Huyền Vũ — Huyền Vũ', description: 'Sống sót 10 hiệp chỉ dùng khiên', minLevel: 35, rewards: '+10% lượng khiên' },
                { chapter: 3, name: 'Huyền Vũ — Thần Thú', description: 'Sống sót 15 hiệp chỉ dùng khiên', minLevel: 45, rewards: '+15% lượng khiên' },
            ],
        };
        return chapters[bloodlineId] || [];
    }
    /**
     * A-05: Get trial leaderboard
     */
    getTrialLeaderboard(bloodlineId, limit = 10) {
        const rows = database_1.default.prepare(`
      SELECT bt.user_id, u.name, bt.trials_used as chapter, bt.completed_at
      FROM bloodline_trials bt
      JOIN users u ON bt.user_id = u.discord_id
      WHERE bt.bloodline_id = ?
      ORDER BY bt.trials_used DESC, bt.completed_at ASC
      LIMIT ?
    `).all(bloodlineId, limit);
        return rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            chapter: r.chapter,
            completedAt: r.completed_at
        }));
    }
    /**
     * A-05: Get bloodline trial description
     */
    getTrialDescription(userId) {
        const ub = this.getUserBloodline(userId);
        if (!ub)
            return '❌ Chưa có Huyết Mạch!';
        const chapters = this.getTrialChapters(ub.bloodline_id);
        const trialInfo = this.getTrialInfo(userId);
        let msg = `⚔️ **Thử Thách Huyết Mạch** — ${ub.name}\n`;
        msg += `📊 Level: **${ub.level}** | Lượt tuần: **${trialInfo.used}/${trialInfo.max}**\n\n`;
        for (const ch of chapters) {
            const completed = ub.level >= ch.minLevel;
            msg += `${completed ? '✅' : '🔒'} **Chapter ${ch.chapter}:** ${ch.name}\n`;
            msg += `   ${ch.description} | Reward: ${ch.rewards}\n`;
        }
        return msg;
    }
}
exports.bloodlineService = new BloodlineService();
