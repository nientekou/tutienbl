"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const EXP_PER_LEVEL = 100;
const MAX_LEVEL = 10;
class MountService {
    getMounts(userId) {
        return database_1.default.prepare('SELECT * FROM mounts WHERE user_id = ? ORDER BY level DESC, rarity DESC').all(userId);
    }
    getActiveMount(userId) {
        return database_1.default.prepare('SELECT * FROM mounts WHERE user_id = ? AND is_active = 1').get(userId) || null;
    }
    getMount(id, userId) {
        return database_1.default.prepare('SELECT * FROM mounts WHERE id = ? AND user_id = ?').get(id, userId) || null;
    }
    activateMount(userId, mountId) {
        const mount = this.getMount(mountId, userId);
        if (!mount)
            return { success: false, message: 'Tọa kỵ không tồn tại!' };
        if (!mount.is_tamed)
            return { success: false, message: 'Tọa kỵ chưa được thuần hóa, không thể cưỡi!' };
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE mounts SET is_active = 0 WHERE user_id = ?').run(userId);
            database_1.default.prepare('UPDATE mounts SET is_active = 1 WHERE id = ? AND user_id = ?').run(mountId, userId);
        })();
        return { success: true, message: `🐎 Đã cưỡi **${mount.name}**! Tốc độ làm việc +${Math.round(mount.speed_bonus * 100)}%, Thể lực tiết kiệm +${Math.round(mount.stamina_save * 100)}%.` };
    }
    deactivateMount(userId) {
        const active = this.getActiveMount(userId);
        if (!active)
            return { success: false, message: 'Đạo hữu không cưỡi tọa kỵ nào!' };
        database_1.default.prepare('UPDATE mounts SET is_active = 0 WHERE user_id = ?').run(userId);
        return { success: true, message: `🐎 Đã thu hồi **${active.name}** về mãnh thú các.` };
    }
    feedMount(userId, mountId, materialItemId, qty = 1) {
        const mount = this.getMount(mountId, userId);
        if (!mount)
            return { success: false, message: 'Tọa kỵ không tồn tại!' };
        if (mount.level >= MAX_LEVEL) {
            return { success: false, message: `**${mount.name}** đã đạt cấp tối đa (${MAX_LEVEL})!` };
        }
        const inv = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, materialItemId);
        if (!inv || inv.quantity < 1)
            return { success: false, message: 'Không có nguyên liệu để nuôi!' };
        const item = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(materialItemId);
        const rarityExp = { common: 15, uncommon: 30, rare: 50, epic: 80, legendary: 150 };
        const expGain = rarityExp[item?.rarity] || 15;
        let newLevel = mount.level;
        let remainingExp = mount.exp;
        let leveledUp = false;
        let consumedCount = 0;
        const maxConsume = Math.min(qty, inv.quantity);
        for (let i = 0; i < maxConsume; i++) {
            if (newLevel >= MAX_LEVEL) {
                break;
            }
            remainingExp += expGain;
            consumedCount++;
            let expNeeded = (newLevel < 1 ? 1 : newLevel) * EXP_PER_LEVEL;
            while (remainingExp >= expNeeded && newLevel < MAX_LEVEL) {
                remainingExp -= expNeeded;
                newLevel++;
                leveledUp = true;
                expNeeded = (newLevel < 1 ? 1 : newLevel) * EXP_PER_LEVEL;
            }
        }
        if (consumedCount === 0) {
            return { success: false, message: `**${mount.name}** đã đạt cấp tối đa (${MAX_LEVEL})!` };
        }
        // Tính bonus mới dựa trên level
        const baseSpeedByRarity = { common: 0.02, uncommon: 0.04, rare: 0.07, epic: 0.10, legendary: 0.15 };
        const baseStaminaByRarity = { common: 0.01, uncommon: 0.02, rare: 0.04, epic: 0.06, legendary: 0.10 };
        const baseSpeed = baseSpeedByRarity[mount.rarity] || 0.02;
        const baseStamina = baseStaminaByRarity[mount.rarity] || 0.01;
        const newSpeedBonus = Math.min(baseSpeed * newLevel, 0.5);
        const newStaminaSave = Math.min(baseStamina * newLevel, 0.3);
        let newTamed = mount.is_tamed;
        if (!newTamed && newLevel >= 1) {
            newTamed = 1;
        }
        database_1.default.transaction(() => {
            if (inv.quantity > consumedCount) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(consumedCount, inv.id);
            }
            else {
                database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
            }
            database_1.default.prepare('UPDATE mounts SET exp = ?, level = ?, speed_bonus = ?, stamina_save = ?, is_tamed = ? WHERE id = ? AND user_id = ?')
                .run(remainingExp, newLevel, newSpeedBonus, newStaminaSave, newTamed, mountId, userId);
        })();
        const totalExpGained = consumedCount * expGain;
        let msg = `🍖 **${mount.name}** hấp thụ x${consumedCount} **${item?.name || materialItemId}**, nhận **+${totalExpGained}** EXP!`;
        if (!mount.is_tamed && newTamed) {
            msg += `\n🎉 **THUẦN HÓA THÀNH CÔNG!** Đạo hữu đã có thể cưỡi tọa kỵ này.`;
        }
        else if (leveledUp) {
            msg += `\n⬆️ **Thăng cấp: ${newLevel}** | Tốc độ: +${Math.round(newSpeedBonus * 100)}% | Tiết kiệm: +${Math.round(newStaminaSave * 100)}%`;
        }
        return {
            success: true,
            message: msg,
            leveledUp,
        };
    }
    calculateExpProgress(mount) {
        const levelToUse = mount.level < 1 ? 1 : mount.level;
        const needed = levelToUse * EXP_PER_LEVEL;
        return { current: mount.exp, needed, pct: Math.min(100, Math.round((mount.exp / needed) * 100)) };
    }
    captureMount(userId, consumeItemId) {
        // Tiêu hao Thừng Bắt Thú
        const inv = database_1.default.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, consumeItemId);
        if (!inv || inv.quantity < 1) {
            return { success: false, message: 'Đạo hữu không có Thừng Bắt Thú (item_id: thung_bat_thu)!' };
        }
        const mountsConfig = [
            { id: 'horse', name: 'Huyết Hãn Mã', rarity: 'common', prob: 0.5 },
            { id: 'wolf', name: 'U Minh Lang', rarity: 'uncommon', prob: 0.3 },
            { id: 'tiger', name: 'Xích Viêm Hổ', rarity: 'rare', prob: 0.15 },
            { id: 'dragon', name: 'Giao Long', rarity: 'epic', prob: 0.04 },
            { id: 'kirin', name: 'Hỏa Kỳ Lân', rarity: 'legendary', prob: 0.01 }
        ];
        let roll = Math.random();
        let selectedMount = mountsConfig[0];
        for (const m of mountsConfig) {
            if (roll < m.prob) {
                selectedMount = m;
                break;
            }
            roll -= m.prob;
        }
        // Tỷ lệ bắt thành công dựa trên rarity
        const catchRate = { common: 0.8, uncommon: 0.6, rare: 0.4, epic: 0.2, legendary: 0.05 };
        const successRate = catchRate[selectedMount.rarity];
        database_1.default.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(inv.id);
        if (inv.quantity - 1 <= 0) {
            database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
        }
        if (Math.random() > successRate) {
            return { success: false, message: `💥 Đạo hữu đã phát hiện **${selectedMount.name}** [${selectedMount.rarity}] nhưng nó đã vùng vẫy thoát khỏi Thừng Bắt Thú!` };
        }
        const res = database_1.default.prepare(`
      INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, is_tamed, created_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?)
    `).run(userId, selectedMount.name, selectedMount.id, selectedMount.rarity, Math.floor(Date.now() / 1000));
        return {
            success: true,
            message: `🎉 Chúc mừng! Đạo hữu đã tóm được **${selectedMount.name}** [${selectedMount.rarity}]! (ID: ${res.lastInsertRowid})\n⚠️ Tọa kỵ vẫn còn hoang dại, hãy dùng \`/toaky nuoiduong\` để thuần hóa.`,
            mount: selectedMount
        };
    }
    // === Mount Skills ===
    getMountSkills(mount) {
        const skillDefs = {
            horse: [
                { id: 'gallop', name: 'Vun Vút', description: 'Tăng tốc độ 20% trong 3 lượt', requiredLevel: 3 },
                { id: 'endurance', name: 'Đại Lực', description: 'Giảm tiêu hao thể lực 30%', requiredLevel: 6 },
            ],
            wolf: [
                { id: 'hunt', name: 'Sát Hại', description: 'Tăng 15% sát thương khi khám phá', requiredLevel: 3 },
                { id: 'pack', name: 'Đồng Đội', description: 'Tăng 10% tất cả stats khi có 3+ tọa kỵ', requiredLevel: 6 },
            ],
            tiger: [
                { id: 'pounce', name: 'Vượt Đội', description: '50% cơ hội tránh cuốc khi bắt', requiredLevel: 3 },
                { id: 'roar', name: 'Hổ Hiệu', description: 'Giảm 15% DEF của quái khi tham gia combat', requiredLevel: 6 },
            ],
            dragon: [
                { id: 'fly', name: 'Bay', description: 'Giảm 50% thời gian di chuyển', requiredLevel: 3 },
                { id: 'breath', name: 'Phun Lửa', description: 'AoE burn 5% HP 3 lượt khi combat', requiredLevel: 6 },
            ],
            kirin: [
                { id: 'blessing', name: 'Phúc Lợi', description: 'Tăng 20% EXP nhận được', requiredLevel: 3 },
                { id: 'teleport', name: 'Tích Tồn', description: 'Dịch chuyển đến bất kỳ địa điểm nào', requiredLevel: 6 },
            ],
        };
        return (skillDefs[mount.template_id] || []).filter(s => mount.level >= s.requiredLevel);
    }
    // === Mount Collection ===
    getCollection(userId) {
        const mounts = this.getMounts(userId);
        const discovered = [...new Set(mounts.map(m => m.template_id))];
        const bonuses = {};
        // Collection milestones
        const milestones = [
            { count: 3, bonus: 'all_stats', value: 0.01 },
            { count: 5, bonus: 'all_stats', value: 0.02 },
            { count: 5, bonus: 'luck', value: 0.03 },
        ];
        for (const ms of milestones) {
            if (discovered.length >= ms.count) {
                bonuses[ms.bonus] = (bonuses[ms.bonus] || 0) + ms.value;
            }
        }
        return { total: discovered.length, discovered, bonuses };
    }
    // === Mount Racing (weekly event) ===
    raceMount(userId, mountId) {
        const mount = this.getMount(mountId, userId);
        if (!mount)
            return { success: false, message: 'Tọa kỵ không tồn tại' };
        if (!mount.is_tamed)
            return { success: false, message: 'Tọa kỵ chưa được thuần hóa' };
        // Racing uses mount stats to determine outcome
        const speedScore = mount.speed_bonus * 100 + mount.level * 5 + Math.random() * 20;
        const targetScore = 30 + Math.random() * 40; // random target between 30-70
        const won = speedScore >= targetScore;
        const reward = won ? Math.round(500 + mount.level * 200 + mount.speed_bonus * 1000) : Math.round(100 + mount.level * 50);
        const user = UserRepository_1.userRepository.get(userId);
        if (user) {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward });
        }
        return {
            success: true,
            message: won
                ? `🏆 **${mount.name}** về nhất! Điểm: ${Math.round(speedScore)} vs ${Math.round(targetScore)}. Thưởng: ${reward} Linh Thạch!`
                : `😤 **${mount.name}** không đủ tốc độ. Điểm: ${Math.round(speedScore)} vs ${Math.round(targetScore)}. Thưởng an ủi: ${reward} Linh Thạch.`,
            reward,
        };
    }
}
exports.mountService = new MountService();
