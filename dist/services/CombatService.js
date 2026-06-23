"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatService = exports.CombatService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const InventoryService_1 = require("./InventoryService");
const EventService_1 = require("./EventService");
const AchievementService_1 = require("./AchievementService");
const BloodlineService_1 = require("./BloodlineService");
const LeylineService_1 = require("./LeylineService");
const dungeons_1 = require("../config/dungeons");
const CombatEngine_1 = require("./CombatEngine");
const AutoBalanceService_1 = require("./AutoBalanceService");
const itemConstants_1 = require("../config/itemConstants");
// Biến dùng để gửi log về durability (dùng trong narrative)
const durabilityAlertThreshold = 30;
class CombatService {
    /**
     * Lấy thông tin trạng thái World Boss hiện tại, tự động hồi sinh nếu quá CD
     */
    getCurrentBoss() {
        const boss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
        if (!boss)
            throw new Error('World boss not found in database');
        const now = Math.floor(Date.now() / 1000);
        const respawnCooldown = 30; // 30 giây hồi sinh cho Boss kế tiếp
        // Daily reset logic: if the boss's last_spawned_at is from a previous calendar day, reset it to level 1
        const lastSpawnedDate = new Date((boss.last_spawned_at || 0) * 1000).toDateString();
        const todayDate = new Date().toDateString();
        if (lastSpawnedDate !== todayDate) {
            const nextLevel = 1;
            const newMaxHp = 5000;
            const newAtk = 80;
            const newDef = 50;
            database_1.default.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
            // Xóa sạch đóng góp sát thương của Boss cũ
            database_1.default.prepare("DELETE FROM world_boss_contributions").run();
            const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
            return {
                name: updatedBoss.name,
                hp: updatedBoss.hp,
                maxHp: updatedBoss.max_hp,
                atk: updatedBoss.atk,
                def: updatedBoss.def,
                level: updatedBoss.level,
                status: updatedBoss.status,
                defeatedBy: null
            };
        }
        if (boss.status === 'defeated') {
            const elapsed = now - (boss.defeated_at || 0);
            if (elapsed >= respawnCooldown) {
                // Hồi sinh boss ở Level tiếp theo
                const nextLevel = boss.level + 1;
                const newMaxHp = Math.round(5000 * Math.pow(1.2, nextLevel - 1));
                const newAtk = Math.round(80 * Math.pow(1.15, nextLevel - 1));
                const newDef = Math.round(50 * Math.pow(1.15, nextLevel - 1));
                database_1.default.prepare(`
          UPDATE world_boss
          SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
          WHERE id = 'world_boss_current'
        `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
                // Xóa sạch đóng góp sát thương của Boss cũ
                database_1.default.prepare("DELETE FROM world_boss_contributions").run();
                const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
                return {
                    name: updatedBoss.name,
                    hp: updatedBoss.hp,
                    maxHp: updatedBoss.max_hp,
                    atk: updatedBoss.atk,
                    def: updatedBoss.def,
                    level: updatedBoss.level,
                    status: updatedBoss.status,
                    defeatedBy: null
                };
            }
            else {
                return {
                    name: boss.name,
                    hp: 0,
                    maxHp: boss.max_hp,
                    atk: boss.atk,
                    def: boss.def,
                    level: boss.level,
                    status: 'defeated',
                    defeatedBy: boss.defeated_by,
                    respawnTimeRemaining: respawnCooldown - elapsed
                };
            }
        }
        return {
            name: boss.name,
            hp: boss.hp,
            maxHp: boss.max_hp,
            atk: boss.atk,
            def: boss.def,
            level: boss.level,
            status: boss.status,
            defeatedBy: null
        };
    }
    /**
     * Thực hiện khiêu chiến phó bản Bí Cảnh
     */
    challengeDungeon(userId, dungeonId, difficulty = 'thường', playerBuffApplied = false, monsterBuffApplied = false) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat`.' };
        }
        const dungeon = dungeons_1.DUNGEONS[dungeonId];
        if (!dungeon) {
            return { success: false, message: 'Bí Cảnh này không tồn tại trong truyền thuyết!' };
        }
        if (user.level < dungeon.minLevel) {
            return {
                success: false,
                message: `Tu vi của đạo hữu quá thấp để tiến vào đây! Cần đạt **cấp ${dungeon.minLevel}** (hoặc cảnh giới tương đương).`
            };
        }
        // Kiểm tra số lượt khiêu chiến hàng ngày
        const now = Math.floor(Date.now() / 1000);
        const cd = database_1.default.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
            .get(userId, dungeonId);
        let entriesToday = 0;
        if (cd) {
            const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
            const nowDate = new Date().toDateString();
            if (cdDate === nowDate) {
                entriesToday = cd.daily_entries;
            }
        }
        if (entriesToday >= dungeon.maxDailyEntries) {
            return {
                success: false,
                message: `Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)`
            };
        }
        // Lấy chỉ số chiến đấu thực tế
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (!activeStats) {
            return { success: false, message: 'Không thể tính toán thuộc tính chiến đấu của đạo hữu.' };
        }
        // Hệ số độ khó
        let diffMultHp = 1.0;
        let diffMultAtk = 1.0;
        let diffMultDef = 1.0;
        let diffRewardMult = 1.0;
        switch (difficulty) {
            case 'dễ':
                diffMultHp = 0.8;
                diffMultAtk = 0.8;
                diffMultDef = 0.8;
                diffRewardMult = 0.8;
                break;
            case 'khó':
                diffMultHp = 1.4;
                diffMultAtk = 1.3;
                diffMultDef = 1.3;
                diffRewardMult = 1.5;
                break;
            case 'ác_mộng':
                diffMultHp = 2.0;
                diffMultAtk = 1.8;
                diffMultDef = 1.8;
                diffRewardMult = 2.5;
                break;
            case 'thường':
            default:
                diffMultHp = 1.0;
                diffMultAtk = 1.0;
                diffMultDef = 1.0;
                diffRewardMult = 1.0;
                break;
        }
        // Chỉ số quái vật cơ bản sau nhân hệ số độ khó
        let monsterHp = Math.round(dungeon.monster.hp * diffMultHp);
        let monsterAtk = Math.round(dungeon.monster.atk * diffMultAtk);
        let monsterDef = Math.round(dungeon.monster.def * diffMultDef);
        // Áp dụng bùa chú quyết sách lựa chọn khắc chế
        let playerAtk = activeStats.atk;
        // Leyline Buff Chiến Đấu (+10% ATK)
        if (LeylineService_1.leylineService.isBuffActive('chiendau')) {
            playerAtk = Math.round(playerAtk * 1.1);
        }
        let playerDef = activeStats.def;
        if (playerBuffApplied) {
            // +50% ATK & DEF
            playerAtk = Math.round(playerAtk * 1.5);
            playerDef = Math.round(playerDef * 1.5);
        }
        if (monsterBuffApplied) {
            // Quái vật nhận +100% ATK
            monsterAtk = Math.round(monsterAtk * 2.0);
        }
        // Lấy sủng thú xuất chiến
        const petRaw = database_1.default.prepare('SELECT name, base_atk, mutations FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId);
        let pet = undefined;
        if (petRaw) {
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            try {
                mutations = JSON.parse(petRaw.mutations || '{}');
            }
            catch (e) {
                console.warn('[CombatService] Failed to parse pet mutations:', e);
            }
            pet = { name: petRaw.name, base_atk: petRaw.base_atk + (mutations.bonus_atk || 0) };
        }
        // Lấy các kỹ năng đang trang bị
        const equippedSkillsQuery = database_1.default.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId);
        const equippedSkills = equippedSkillsQuery.map(s => {
            const { SKILL_DETAILS } = require('../commands/general/kynang');
            const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
            return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
        });
        const bdl1 = BloodlineService_1.bloodlineService.getUserBloodline(userId);
        const { soulImprintService } = require('./SoulImprintService');
        const playerCombatant = {
            name: user.name,
            hp: activeStats.hp,
            maxHp: activeStats.hp,
            atk: playerAtk,
            def: playerDef,
            crit: activeStats.crit,
            critRes: activeStats.critRes,
            luck: activeStats.luck,
            speed: activeStats.speed ?? 100,
            dodge: activeStats.dodge ?? 0.05,
            linhCan: user.linh_can,
            equippedSkills: equippedSkills,
            bloodline: bdl1 ? { id: bdl1.bloodline_id, name: bdl1.name, level: bdl1.level, passives: bdl1.passives, rage_effect: bdl1.rage_effect, rage_cooldown: bdl1.rage_cooldown || 0 } : undefined,
            hasOai: soulImprintService.hasOaiActive(userId),
            userId: userId,
            level: user.level
        };
        // Tăng tốc độ né tránh quái vật theo bậc dungeon
        let monsterSpeed = 90;
        let monsterDodge = 0.05;
        if (dungeonId.includes('truc_co')) {
            monsterSpeed = 115;
            monsterDodge = 0.08;
        }
        else if (dungeonId.includes('kim_dan')) {
            monsterSpeed = 140;
            monsterDodge = 0.12;
        }
        // Nhân thêm nhẹ theo độ khó
        if (difficulty === 'khó')
            monsterSpeed = Math.round(monsterSpeed * 1.15);
        else if (difficulty === 'ác_mộng')
            monsterSpeed = Math.round(monsterSpeed * 1.3);
        const enemyCombatant = {
            name: `${dungeon.monster.name} [${difficulty.toUpperCase()}]`,
            hp: monsterHp,
            maxHp: monsterHp,
            atk: monsterAtk,
            def: monsterDef,
            crit: dungeon.monster.crit,
            critRes: dungeon.monster.critRes,
            speed: monsterSpeed,
            dodge: monsterDodge,
            luck: 10,
            element: dungeon.monster.element || 'Vô',
            level: dungeon.minLevel
        };
        // Chạy trận đấu
        const combatResult = CombatEngine_1.CombatEngine.run(playerCombatant, enemyCombatant, pet ? { name: pet.name, atk: pet.base_atk } : null, 30);
        // Cập nhật cooldown Rage nếu có
        if (playerCombatant.bloodline && playerCombatant.bloodline.rage_cooldown > 0) {
            BloodlineService_1.bloodlineService.updateRageCooldown(userId, playerCombatant.bloodline.rage_cooldown);
        }
        // Cập nhật lượt đi trong ngày
        const newEntries = entriesToday + 1;
        database_1.default.prepare(`
      INSERT INTO dungeon_cooldowns (user_id, dungeon_id, daily_entries, last_entry_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, dungeon_id) DO UPDATE SET daily_entries = excluded.daily_entries, last_entry_at = excluded.last_entry_at
    `).run(userId, dungeonId, newEntries, now);
        const dailyEntriesLeft = dungeon.maxDailyEntries - newEntries;
        // Kiểm tra thành tựu bí cảnh (đếm từ audit_logs)
        const totalDungeonAttempts = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'dungeon_run'").get(userId);
        const newAttempts = totalDungeonAttempts.c + 1;
        AchievementService_1.achievementService.setProgress(userId, 'cd_1', newAttempts);
        AchievementService_1.achievementService.setProgress(userId, 'cd_2', newAttempts);
        AchievementService_1.achievementService.setProgress(userId, 'cd_3', newAttempts);
        if (difficulty === 'ác_mộng' && combatResult.winner === 'player') {
            const totalNM = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'dungeon_nightmare'").get(userId);
            AchievementService_1.achievementService.setProgress(userId, 'cd_4', totalNM.c + 1);
        }
        // Ghi log dungeon
        const now2 = Math.floor(Date.now() / 1000);
        database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'dungeon_run', ?, ?)").run(userId, JSON.stringify({ dungeonId, difficulty, win: combatResult.winner === 'player' }), now2);
        if (difficulty === 'ác_mộng') {
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'dungeon_nightmare', ?, ?)").run(userId, JSON.stringify({ dungeonId, win: combatResult.winner === 'player' }), now2);
        }
        // Xử lý phần thưởng nếu chiến thắng
        if (combatResult.winner === 'player') {
            const baseCoin = Math.floor(Math.random() * (dungeon.rewards.coinMax - dungeon.rewards.coinMin + 1)) + dungeon.rewards.coinMin;
            const coinReward = Math.round(baseCoin * diffRewardMult);
            let expReward = Math.round(dungeon.rewards.exp * diffRewardMult);
            // Double EXP Weekend: x2 Tu Vi từ bí cảnh
            const isDoubleExp = EventService_1.eventService.isDoubleExpActive();
            if (isDoubleExp)
                expReward = Math.round(expReward * 2);
            // Newbie protection: x2 EXP cho người chơi mới
            const { newbieProtectionService } = require('./NewbieProtectionService');
            const newbieMult = newbieProtectionService.getExpMultiplier(userId);
            if (newbieMult > 1)
                expReward = Math.round(expReward * newbieMult);
            // Giới hạn tu vi không vượt mức đột phá
            const cappedNewTuVi = Math.min(user.tu_vi + expReward, user.exp_needed);
            const actualGainedExp = cappedNewTuVi - user.tu_vi;
            // Cộng tiền và tu vi
            UserRepository_1.userRepository.update(userId, {
                tu_vi: cappedNewTuVi,
                coin_ha_pham: user.coin_ha_pham + coinReward
            });
            // Tăng kinh nghiệm huyết mạch
            if (actualGainedExp > 0) {
                BloodlineService_1.bloodlineService.addExp(userId, Math.floor(actualGainedExp * 0.05));
            }
            // Phân tách phần thêm item hàng loạt
            const loots = [];
            const itemsToAdd = [];
            for (const loot of dungeon.rewards.loots) {
                // Tăng nhẹ tỷ lệ rơi đồ theo độ khó khó/ác mộng
                let activeRate = loot.rate;
                if (difficulty === 'khó')
                    activeRate *= 1.25;
                if (difficulty === 'ác_mộng')
                    activeRate *= 1.5;
                if (Math.random() < activeRate) {
                    const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(loot.itemId);
                    if (item) {
                        let customStats = null;
                        // Trang bị ngẫu nhiên phẩm chất 20%
                        if (loot.itemId.startsWith('weapon_') || loot.itemId.startsWith('armor_') || loot.itemId.startsWith('robe_')) {
                            if (Math.random() < 0.20) {
                                const bonusAtk = Math.floor(Math.random() * 8) + 2;
                                const bonusHp = Math.floor(Math.random() * 30) + 10;
                                customStats = JSON.stringify({ atk: bonusAtk, hp: bonusHp });
                            }
                        }
                        itemsToAdd.push({ userId, itemId: loot.itemId, quantity: loot.quantity, customStats });
                        loots.push({
                            id: loot.itemId,
                            name: item.name + (customStats ? ' (Tinh Luyện ✦)' : ''),
                            quantity: loot.quantity
                        });
                    }
                }
            }
            // Phần thưởng đặc hữu của độ khó Ác Mộng (Nightmare): 15% cơ hội rơi Phôi Vũ Khí / Đạo Bào SSS cực quý
            if (difficulty === 'ác_mộng' && Math.random() < 0.15) {
                const isWeapon = Math.random() < 0.5;
                const targetPhoiId = isWeapon ? itemConstants_1.ITEMS.PHOI_WEAPON_SSS : itemConstants_1.ITEMS.PHOI_ARMOR_SSS;
                const itemDetails = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(targetPhoiId);
                if (itemDetails) {
                    itemsToAdd.push({ userId, itemId: targetPhoiId, quantity: 1 });
                    loots.push({
                        id: targetPhoiId,
                        name: `🔥 ${itemDetails.name}`,
                        quantity: 1
                    });
                }
            }
            if (itemsToAdd.length > 0) {
                InventoryRepository_1.inventoryRepository.addMultipleItems(itemsToAdd);
            }
            // Giảm độ bền trang bị sau chiến đấu
            const affected = this.reduceDurabilityAfterCombat(userId, combatResult.rounds);
            // Cộng EXP cho Bản Mệnh Pháp Bảo
            let artifactMessage = undefined;
            const artifactExp = Math.round(expReward * 0.1);
            const artifactRes = InventoryService_1.inventoryService.addArtifactExp(userId, artifactExp);
            if (artifactRes && artifactRes.message) {
                artifactMessage = artifactRes.message;
            }
            return {
                success: true,
                message: 'Chiến Thắng' + (affected.length > 0 ? ` (${affected.join(', ')})` : ''),
                combatResult,
                rewards: {
                    exp: actualGainedExp,
                    coins: coinReward,
                    loots
                },
                dailyEntriesLeft,
                artifactMessage
            };
        }
        // Giảm độ bền trang bị sau khi thất bại
        this.reduceDurabilityAfterCombat(userId, Math.max(1, Math.round(combatResult.rounds * 0.5)));
        if (combatResult.playerEndingHp <= 0) {
            // Đạo hữu đã tử vong thực sự (HP = 0)
            const expLoss = Math.min(user.tu_vi, Math.round(user.exp_needed * 0.15));
            const coinLoss = Math.min(user.coin_ha_pham, Math.round(user.coin_ha_pham * 0.10));
            const thuongPhamLoss = Math.ceil((user.coin_thuong_pham || 0) * 0.05);
            let levelDropped = false;
            let newLevel = user.level;
            let nextExpNeeded = user.exp_needed;
            if ((dungeonId.includes('truc_co') || dungeonId.includes('kim_dan')) && Math.random() < 0.05 && user.level > 1) {
                newLevel = user.level - 1;
                const { cultivationService } = require('./CultivationService');
                nextExpNeeded = cultivationService.calculateNextExp(newLevel);
                levelDropped = true;
            }
            const newStamina = Math.max(0, user.stamina - 100);
            const injuryEnd = now + 2700; // 45 phút trọng thương
            if (levelDropped) {
                const { cultivationService } = require('./CultivationService');
                const newStats = cultivationService.calculateStatsForLevel(newLevel, user.linh_can);
                UserRepository_1.userRepository.update(userId, {
                    level: newLevel,
                    tu_vi: 0,
                    exp_needed: nextExpNeeded,
                    coin_ha_pham: Math.max(0, user.coin_ha_pham - coinLoss),
                    coin_thuong_pham: Math.max(0, (user.coin_thuong_pham || 0) - thuongPhamLoss),
                    stamina: newStamina,
                    injury_end_time: injuryEnd,
                    base_hp: newStats.hp,
                    base_mp: newStats.mp,
                    base_atk: newStats.atk,
                    base_def: newStats.def,
                    base_crit: newStats.crit,
                    base_crit_res: newStats.critRes,
                    base_speed: newStats.speed
                });
            }
            else {
                UserRepository_1.userRepository.update(userId, {
                    tu_vi: Math.max(0, user.tu_vi - expLoss),
                    coin_ha_pham: Math.max(0, user.coin_ha_pham - coinLoss),
                    coin_thuong_pham: Math.max(0, (user.coin_thuong_pham || 0) - thuongPhamLoss),
                    stamina: newStamina,
                    injury_end_time: injuryEnd
                });
            }
            let artifactMsg = levelDropped ? `Cảnh giới rớt xuống Cấp ${newLevel}! ` : '';
            if (thuongPhamLoss > 0) {
                artifactMsg += `Bị rơi mất ${thuongPhamLoss} Linh Thạch Thượng Phẩm! `;
            }
            artifactMsg += `Bị Trọng Thương trong 45 phút!`;
            return {
                success: true,
                message: 'Tử Vong',
                combatResult,
                dailyEntriesLeft,
                rewards: {
                    exp: levelDropped ? user.tu_vi : expLoss,
                    coins: coinLoss,
                    loots: []
                },
                artifactMessage: artifactMsg
            };
        }
        return {
            success: true,
            message: 'Bại Trận',
            combatResult,
            dailyEntriesLeft
        };
    }
    /**
     * Thực hiện khiêu chiến World Boss
     */
    challengeWorldBoss(userId, clearCooldownWithCoin = false) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat`.' };
        }
        const now = Math.floor(Date.now() / 1000);
        if (user.injury_end_time && user.injury_end_time > now) {
            const remain = user.injury_end_time - now;
            const minutes = Math.ceil(remain / 60);
            return {
                success: false,
                message: `❌ Đạo hữu đang bị **Trọng Thương**! Kinh mạch tổn hại, không thể khiêu chiến World Boss. Cần tĩnh dưỡng thêm **${minutes} phút**.`
            };
        }
        // Lấy thông tin boss và kiểm tra trạng thái hồi sinh
        this.getCurrentBoss(); // Trigger tự động hồi sinh nếu đủ thời gian
        const boss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
        if (boss.status === 'defeated') {
            const respawnTime = 30 - (Math.floor(Date.now() / 1000) - (boss.defeated_at || 0));
            return {
                success: false,
                message: `World Boss đã bị tiêu diệt! Đang ngưng tụ nguyên hồn, vui lòng đợi **${Math.max(0, respawnTime)} giây** để hồi sinh.`
            };
        }
        // Kiểm tra cooldown cá nhân (10 phút = 600 giây)
        const contrib = database_1.default.prepare("SELECT last_attack_at, attacks FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
            .get(userId);
        let isCooldown = false;
        let cdSec = 0;
        if (contrib) {
            const elapsed = now - contrib.last_attack_at;
            if (elapsed < 600) {
                isCooldown = true;
                cdSec = 600 - elapsed;
            }
        }
        if (isCooldown) {
            const attackCount = contrib ? contrib.attacks : 0;
            const clearCost = 100 * Math.pow(2, attackCount);
            if (clearCooldownWithCoin) {
                if (user.coin_ha_pham < clearCost) {
                    return { success: false, message: `Đạo hữu không đủ linh thạch để xóa thời gian chờ khiêu chiến! (Cần ${clearCost} Linh thạch, hiện có: ${user.coin_ha_pham})` };
                }
                // Trừ linh thạch
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - clearCost });
            }
            else {
                return {
                    success: false,
                    message: `Kinh mạch đạo hữu chưa hồi phục hoàn toàn! Vui lòng đợi **${cdSec} giây** hoặc dùng **${clearCost} Linh thạch** để tẩy CD khiêu chiến.`,
                    cooldownRemaining: cdSec
                };
            }
        }
        // Lấy chỉ số của người chơi
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (!activeStats) {
            return { success: false, message: 'Lỗi tính toán chỉ số nhân vật.' };
        }
        // Lấy sủng thú trợ chiến
        const petRaw = database_1.default.prepare('SELECT name, base_atk, mutations FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId);
        let pet = undefined;
        if (petRaw) {
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            try {
                mutations = JSON.parse(petRaw.mutations || '{}');
            }
            catch (e) {
                console.warn('[CombatService] Failed to parse pet mutations:', e);
            }
            pet = { name: petRaw.name, base_atk: petRaw.base_atk + (mutations.bonus_atk || 0) };
        }
        // Lấy các kỹ năng đang trang bị
        const equippedSkillsQuery = database_1.default.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId);
        const equippedSkills = equippedSkillsQuery.map(s => {
            const { SKILL_DETAILS } = require('../commands/general/kynang');
            const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
            return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
        });
        const bdl2 = BloodlineService_1.bloodlineService.getUserBloodline(userId);
        // Leyline Buff Chiến Đấu (+10% ATK)
        let playerAtk = activeStats.atk;
        if (LeylineService_1.leylineService.isBuffActive('chiendau')) {
            playerAtk = Math.round(playerAtk * 1.1);
        }
        const { soulImprintService } = require('./SoulImprintService');
        const playerCombatant = {
            name: user.name,
            hp: activeStats.hp,
            maxHp: activeStats.hp,
            atk: playerAtk,
            def: activeStats.def,
            crit: activeStats.crit,
            critRes: activeStats.critRes,
            luck: activeStats.luck,
            speed: activeStats.speed ?? 100,
            dodge: activeStats.dodge ?? 0.05,
            linhCan: user.linh_can,
            equippedSkills: equippedSkills,
            bloodline: bdl2 ? { id: bdl2.bloodline_id, name: bdl2.name, level: bdl2.level, passives: bdl2.passives, rage_effect: bdl2.rage_effect, rage_cooldown: bdl2.rage_cooldown || 0 } : undefined,
            hasOai: soulImprintService.hasOaiActive(userId),
            userId: userId,
            level: user.level
        };
        // Auto-balance PvE: boss scale theo player power
        const pveScale = AutoBalanceService_1.autoBalanceService.getPvEScaleFactor(userId);
        const enemyCombatant = {
            name: boss.name,
            hp: Math.round(boss.hp * pveScale),
            maxHp: Math.round(boss.max_hp * pveScale),
            atk: Math.round(boss.atk * pveScale),
            def: Math.round(boss.def * pveScale),
            crit: boss.crit,
            critRes: boss.critRes,
            luck: 20,
            element: 'Hỏa',
            level: boss.level
        };
        // Khiêu chiến tối đa 15 hiệp với World Boss để giới hạn sát thương mỗi lượt
        const combatResult = CombatEngine_1.CombatEngine.run(playerCombatant, enemyCombatant, pet ? { name: pet.name, atk: pet.base_atk } : null, 15);
        // Cập nhật cooldown Rage nếu có
        if (playerCombatant.bloodline && playerCombatant.bloodline.rage_cooldown > 0) {
            BloodlineService_1.bloodlineService.updateRageCooldown(userId, playerCombatant.bloodline.rage_cooldown);
        }
        let damageDealt = combatResult.totalDamageDealt;
        // Catch-up buff: player yếu được +50% damage nếu ATK < boss DEF * 0.5
        const pAtk = playerCombatant.atk;
        if (pAtk < enemyCombatant.def * 0.5) {
            damageDealt = Math.round(damageDealt * 1.5);
        }
        // Minimum damage: mỗi player gây ít nhất 0.5% HP boss
        const minDamage = Math.round(boss.max_hp * 0.005);
        damageDealt = Math.max(minDamage, damageDealt);
        const newBossHp = Math.max(0, boss.hp - damageDealt);
        const isDefeated = newBossHp <= 0;
        // Cập nhật HP của World Boss
        if (isDefeated) {
            database_1.default.prepare("UPDATE world_boss SET hp = 0, status = 'defeated', defeated_at = ?, defeated_by = ? WHERE id = 'world_boss_current'")
                .run(now, userId);
        }
        else {
            database_1.default.prepare("UPDATE world_boss SET hp = ? WHERE id = 'world_boss_current'").run(newBossHp);
        }
        // Cập nhật đóng góp sát thương của người chơi
        const playerContrib = database_1.default.prepare("SELECT damage, attacks FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
            .get(userId);
        if (playerContrib) {
            database_1.default.prepare(`
        UPDATE world_boss_contributions
        SET damage = damage + ?, attacks = attacks + 1, last_attack_at = ?
        WHERE user_id = ? AND boss_id = 'world_boss_current'
      `).run(damageDealt, now, userId);
        }
        else {
            database_1.default.prepare(`
        INSERT INTO world_boss_contributions (user_id, boss_id, damage, attacks, last_attack_at)
        VALUES (?, 'world_boss_current', ?, 1, ?)
      `).run(userId, damageDealt, now);
        }
        let rewardsLogs = [];
        // Nếu tiêu diệt thành công World Boss -> Phát thưởng
        if (isDefeated) {
            rewardsLogs = this.distributeWorldBossRewards(boss.level, userId);
        }
        // Cập nhật tiến trình sự kiện weekly_boss_rush
        const activeEvents = EventService_1.eventService.getActiveEvents();
        const weeklyBossEvent = activeEvents.find(e => e.type === 'weekly_boss');
        if (weeklyBossEvent) {
            EventService_1.eventService.updateProgress(weeklyBossEvent.id, userId, damageDealt);
        }
        // Kiểm tra thành tựu world boss
        this.recordBossAttack(userId, boss.level, damageDealt);
        if (isDefeated) {
            this.recordBossKill(userId, boss.level);
        }
        // Cập nhật Chấn Thương
        const updates = {};
        const reflectDmg = Math.round(damageDealt * 0.05 + boss.atk * 0.1);
        const injuryChance = activeStats.hp < (boss.atk * 5) ? 0.25 : 0.08;
        const isInjured = Math.random() < injuryChance;
        if (isInjured) {
            updates.injury_end_time = now + 900; // 15 phút trọng thương
        }
        if (Object.keys(updates).length > 0) {
            UserRepository_1.userRepository.update(userId, updates);
        }
        // Thêm feedback vào logs của combat
        combatResult.log.push(`\n⚡ **Phản Phệ:** Đạo hữu chịu **-${reflectDmg}** sát thương phản chấn từ Boss thế giới!`);
        if (isInjured) {
            combatResult.log.push(`🚨 **Chấn Thương:** Đạo hữu bị **Trọng Thương trong 15 phút** do sinh lực cạn kiệt!`);
        }
        return {
            success: true,
            message: isDefeated ? 'Boss Bị Tiêu Diệt!' : 'Khiêu Chiến Thành Công',
            combatResult,
            damageDealt,
            isDefeated,
            rewardsLogs
        };
    }
    /**
     * Ghi nhận lượt tấn công World Boss và cập nhật tiến trình thành tựu
     */
    recordBossAttack(userId, bossLevel, damageDealt) {
        try {
            const now = Math.floor(Date.now() / 1000);
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'boss_attack', ?, ?)").run(userId, JSON.stringify({ bossLevel, damageDealt }), now);
            const totalBossAttacks = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'boss_attack'").get(userId);
            AchievementService_1.achievementService.setProgress(userId, 'cd_5', totalBossAttacks.c);
            AchievementService_1.achievementService.setProgress(userId, 'cd_6', totalBossAttacks.c);
            AchievementService_1.achievementService.setProgress(userId, 'cd_7', totalBossAttacks.c);
        }
        catch (e) {
            console.error('[recordBossAttack Error]', e);
        }
    }
    /**
     * Ghi nhận lượt tiêu diệt World Boss và cập nhật tiến trình thành tựu
     */
    recordBossKill(userId, bossLevel) {
        try {
            const now = Math.floor(Date.now() / 1000);
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'boss_kill', ?, ?)").run(userId, JSON.stringify({ bossLevel }), now);
            const totalKills = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'boss_kill'").get(userId);
            AchievementService_1.achievementService.setProgress(userId, 'cd_8', totalKills.c);
            AchievementService_1.achievementService.setProgress(userId, 'cd_9', totalKills.c);
        }
        catch (e) {
            console.error('[recordBossKill Error]', e);
        }
    }
    /**
     * Phát thưởng World Boss cho tất cả người tham gia
     */
    distributeWorldBossRewards(bossLevel, finalBlowerId) {
        const participants = database_1.default.prepare(`
      SELECT user_id, damage 
      FROM world_boss_contributions 
      ORDER BY damage DESC
    `).all();
        const rewardsLogs = [];
        const itemsToAdd = [];
        const rewardLevelFactor = Math.min(bossLevel, 20);
        // Tính tổng damage để tính % đóng góp
        const totalDamage = participants.reduce((sum, p) => sum + p.damage, 0);
        for (let i = 0; i < participants.length; i++) {
            const p = participants[i];
            let pUser;
            try {
                pUser = UserRepository_1.userRepository.get(p.user_id);
            }
            catch (e) {
                console.error('[BossReward] Lỗi lấy user:', p.user_id, e);
                continue;
            }
            if (!pUser)
                continue;
            // Thưởng cơ bản cho tất cả người tham gia (tăng base để ai cũng có lợi)
            let gainedExp = 600 * rewardLevelFactor;
            let gainedCoins = 240 * rewardLevelFactor;
            let gainedKnb = 0;
            const itemsGained = [];
            // Bonus theo % đóng góp (từ 0% đến 100% của base)
            const dmgPercent = totalDamage > 0 ? p.damage / totalDamage : 0;
            gainedExp += Math.round(360 * rewardLevelFactor * dmgPercent);
            gainedCoins += Math.round(180 * rewardLevelFactor * dmgPercent);
            // Phân chia theo hạng đóng góp (thu hẹp gap, top vẫn hơn nhưng không bỏ xa)
            if (i === 0) { // Top 1
                gainedExp += 360 * rewardLevelFactor;
                gainedCoins += 180 * rewardLevelFactor;
                gainedKnb = Math.min(2 + Math.floor(rewardLevelFactor / 5), 7);
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.SERVER_RAID_CHEST, quantity: 1 });
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.PILL_BREAK_1, quantity: 1 });
                itemsGained.push('1x Rương Boss Thế Giới', '1x Rương Cơ Duyên', '1x Trúc Cơ Đan');
            }
            else if (i === 1) { // Top 2
                gainedExp += 240 * rewardLevelFactor;
                gainedCoins += 120 * rewardLevelFactor;
                gainedKnb = Math.min(1 + Math.floor(rewardLevelFactor / 6), 4);
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.PILL_BREAK_1, quantity: 1 });
                itemsGained.push('1x Rương Cơ Duyên', '1x Trúc Cơ Đan');
            }
            else if (i === 2) { // Top 3
                gainedExp += 180 * rewardLevelFactor;
                gainedCoins += 90 * rewardLevelFactor;
                gainedKnb = Math.min(1 + Math.floor(rewardLevelFactor / 8), 3);
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.PILL_BREAK_1, quantity: 1 });
                itemsGained.push('1x Rương Cơ Duyên', '1x Trúc Cơ Đan');
            }
            else if (i <= 5) { // Top 4-5
                gainedExp += 120 * rewardLevelFactor;
                gainedCoins += 60 * rewardLevelFactor;
                if (Math.random() < 0.5)
                    gainedKnb = 1;
                if (Math.random() < 0.5) {
                    itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                    itemsGained.push('1x Rương Cơ Duyên');
                }
            }
            else if (i <= 10) { // Top 6-10
                gainedExp += 60 * rewardLevelFactor;
                gainedCoins += 30 * rewardLevelFactor;
                if (Math.random() < 0.35) {
                    itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                    itemsGained.push('1x Rương Cơ Duyên');
                }
            }
            else {
                // Top 11+: vẫn nhận thêm ít phần thưởng + 25% rương
                gainedExp += 30 * rewardLevelFactor;
                gainedCoins += 12 * rewardLevelFactor;
                if (Math.random() < 0.25) {
                    itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.LUCKY_CHEST, quantity: 1 });
                    itemsGained.push('1x Rương Cơ Duyên');
                }
            }
            // Thưởng kết liễu (Last Hit)
            if (p.user_id === finalBlowerId) {
                gainedCoins += 120 * rewardLevelFactor;
                const lastHitKnb = Math.min(1 + Math.floor(rewardLevelFactor / 8), 3);
                gainedKnb += lastHitKnb;
                itemsToAdd.push({ userId: p.user_id, itemId: itemConstants_1.ITEMS.SERVER_RAID_CHEST, quantity: 1 });
                itemsGained.push('1x Rương Boss Thế Giới (Trảm Sát ⚡)');
            }
            // Cập nhật tu vi, coin và KNB
            try {
                const cappedTuVi = Math.min(pUser.tu_vi + gainedExp, pUser.exp_needed);
                UserRepository_1.userRepository.update(p.user_id, {
                    tu_vi: cappedTuVi,
                    coin_ha_pham: pUser.coin_ha_pham + gainedCoins,
                    knb: pUser.knb + gainedKnb
                });
                const actualGainedExp = cappedTuVi - pUser.tu_vi;
                if (actualGainedExp > 0) {
                    BloodlineService_1.bloodlineService.addExp(p.user_id, Math.floor(actualGainedExp * 0.05));
                }
            }
            catch (e) {
                console.error('[BossReward] Lỗi cập nhật reward cho:', p.user_id, e);
            }
            const itemsText = itemsGained.length > 0 ? ` + 🎁 [${itemsGained.join(', ')}]` : '';
            const knbText = gainedKnb > 0 ? `, +**${gainedKnb}** KNB` : '';
            rewardsLogs.push(`🏅 **Hạng ${i + 1}**: **${pUser.name}** (gây ${p.damage} dmg) nhận: +**${gainedExp}** Tu Vi, +**${gainedCoins}** Linh Thạch${knbText}${itemsText}`);
        }
        if (itemsToAdd.length > 0) {
            try {
                InventoryRepository_1.inventoryRepository.addMultipleItems(itemsToAdd);
            }
            catch (e) {
                console.error('[BossReward] Lỗi add items:', e);
            }
        }
        return rewardsLogs;
    }
    /**
     * Giảm độ bền trang bị của người chơi sau khi chiến đấu
     * @param userId ID người chơi
     * @param combatRounds Số hiệp đã đánh
     * @param durabilityCostPerRound Lượng độ bền mất mỗi hiệp
     * @returns Danh sách tên trang bị bị giảm độ bền
     */
    reduceDurabilityAfterCombat(userId, combatRounds, durabilityCostPerRound = 3) {
        const affectedItems = [];
        try {
            const equipped = database_1.default.prepare(`
        SELECT i.id, i.item_id, i.durability, t.name
        FROM inventories i
        JOIN items t ON i.item_id = t.id
        WHERE i.user_id = ? AND i.is_equipped = 1
      `).all(userId);
            if (equipped.length === 0)
                return [];
            const reduceAmount = Math.min(20, Math.max(1, combatRounds * durabilityCostPerRound));
            for (const item of equipped) {
                if (item.durability <= 0)
                    continue; // Đã hỏng rồi
                InventoryRepository_1.inventoryRepository.reduceDurability(item.id, reduceAmount);
                const newDurability = Math.max(0, item.durability - reduceAmount);
                if (newDurability <= 0) {
                    affectedItems.push(`💔 **${item.name}** (hỏng)`);
                }
                else if (newDurability <= durabilityAlertThreshold) {
                    affectedItems.push(`⚠️ **${item.name}** (còn ${newDurability}/100)`);
                }
            }
            return affectedItems;
        }
        catch (e) {
            console.error('[reduceDurabilityAfterCombat Error]', e);
            return [];
        }
    }
    /**
     * Lấy danh sách bảng xếp hạng đóng góp World Boss hiện tại
     */
    getBossContributions() {
        const list = database_1.default.prepare(`
      SELECT c.user_id, c.damage, c.attacks, u.name
      FROM world_boss_contributions c
      JOIN users u ON c.user_id = u.discord_id
      ORDER BY c.damage DESC
      LIMIT 10
    `).all();
        return list.map(item => ({
            name: item.name,
            damage: item.damage,
            attacks: item.attacks
        }));
    }
}
exports.CombatService = CombatService;
exports.combatService = new CombatService();
