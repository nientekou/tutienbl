"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nineHeavensService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const CombatEngine_1 = require("./CombatEngine");
const InventoryService_1 = require("./InventoryService");
const BloodlineService_1 = require("./BloodlineService");
class NineHeavensService {
    // Cấu hình 9 tầng tháp
    FLOORS = {
        1: {
            name: 'Thạch Đầu Nhân',
            hp: 2500, atk: 120, def: 60, speed: 90, dodge: 0.05, crit: 0.05, critRes: 0.05, element: 'Thổ',
            ruleDesc: '🚫 **Độc Hành:** Sủng thú bị cấm xuất chiến hỗ trợ.',
            minLevel: 30
        },
        2: {
            name: 'Huyền Thiết Ma Binh',
            hp: 4000, atk: 180, def: 100, speed: 100, dodge: 0.05, crit: 0.05, critRes: 0.10, element: 'Kim',
            ruleDesc: '🚫 **Cấm Khí:** Vô hiệu hóa toàn bộ trang bị vật phẩm (vũ khí, giáp, phụ kiện, tọa kỵ). Chỉ dùng chỉ số thô của tu sĩ.',
            minLevel: 35
        },
        3: {
            name: 'Hỏa Diễm Tinh Linh',
            hp: 6000, atk: 250, def: 120, speed: 110, dodge: 0.08, crit: 0.10, critRes: 0.05, element: 'Hỏa',
            ruleDesc: '⚡ **Phản Thương:** Kẻ địch phản chấn **20%** sát thương nhận vào.',
            minLevel: 40
        },
        4: {
            name: 'Thiên Cực Thần Thú',
            hp: 9999999, atk: 350, def: 200, speed: 120, dodge: 0.05, crit: 0.05, critRes: 0.20, element: 'Thủy',
            ruleDesc: '⏳ **Sinh Tồn:** Đạo hữu cần tử thủ sống sót qua **10 hiệp** trước sức tấn công điên cuồng của Boss.',
            minLevel: 45
        },
        5: {
            name: 'Huyễn Ảnh Quỷ Cơ',
            hp: 8000, atk: 300, def: 180, speed: 130, dodge: 0.12, crit: 0.15, critRes: 0.08, element: 'Phong',
            ruleDesc: '💔 **Tuyệt Cảnh:** Bắt đầu trận chiến chỉ với đúng **1 HP** duy nhất.',
            minLevel: 50
        },
        6: {
            name: 'Lôi Tinh Cổ Thú',
            hp: 10000, atk: 400, def: 220, speed: 140, dodge: 0.05, crit: 0.10, critRes: 0.10, element: 'Lôi',
            ruleDesc: '🚫 **Nguyên Lực:** Cấm sử dụng toàn bộ Kỹ năng linh căn chủ động (chỉ đánh thường và kích hoạt linh căn).',
            minLevel: 55
        },
        7: {
            name: 'Vực Sâu Quỷ Vương',
            hp: 15000, atk: 550, def: 300, speed: 120, dodge: 0.05, crit: 0.10, critRes: 0.15, element: 'Hỏa',
            ruleDesc: '⚠️ **Suy Nhược:** Đạo hữu bị suy giảm **-50%** Công kích và **-50%** Phòng thủ.',
            minLevel: 60
        },
        8: {
            name: 'Phong Bạo Điểu',
            hp: 22000, atk: 750, def: 400, speed: 300, dodge: 0.15, crit: 0.20, critRes: 0.10, element: 'Phong',
            ruleDesc: '⚡ **Thần Tốc:** Kẻ địch sở hữu tốc độ siêu phàm (**300 Tốc độ**).',
            minLevel: 65
        },
        9: {
            name: 'Cửu Trùng Thần Tôn',
            hp: 35000, atk: 1000, def: 600, speed: 180, dodge: 0.10, crit: 0.20, critRes: 0.20, element: 'Vô',
            ruleDesc: '👑 **Cửu Trùng Đỉnh:** Cấm mang Pet, giảm **-20%** Công kích đạo hữu, kẻ địch phản chấn **15%** sát thương.',
            minLevel: 70
        }
    };
    /**
     * Sinh key tuần hiện tại YYYY-W(1-53)
     */
    getWeekKey() {
        const d = new Date();
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const result = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
        return `${d.getFullYear()}-W${result}`;
    }
    /**
     * Lấy hoặc tạo mới tiến trình leo tháp của user
     */
    getProgress(userId) {
        const weekKey = this.getWeekKey();
        let row = database_1.default.prepare('SELECT * FROM nine_heavens_progress WHERE user_id = ?').get(userId);
        if (!row) {
            database_1.default.prepare(`
        INSERT INTO nine_heavens_progress (user_id, highest_floor, attempts_this_week, last_reset_week)
        VALUES (?, 0, 0, ?)
      `).run(userId, weekKey);
            row = { user_id: userId, highest_floor: 0, attempts_this_week: 0, last_reset_week: weekKey };
        }
        else {
            // Kiểm tra reset tuần
            if (row.last_reset_week !== weekKey) {
                database_1.default.prepare('UPDATE nine_heavens_progress SET attempts_this_week = 0, last_reset_week = ? WHERE user_id = ?')
                    .run(weekKey, userId);
                row.attempts_this_week = 0;
                row.last_reset_week = weekKey;
            }
        }
        return row;
    }
    /**
     * Mua thêm lượt khiêu chiến tháp bằng Linh thạch (1,000 Linh Thạch)
     */
    buyExtraAttempt(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const progress = this.getProgress(userId);
        if (user.coin_ha_pham < 1000) {
            return { success: false, message: `Đạo hữu không đủ Linh thạch! Cần **1,000** Linh Thạch để mua thêm lượt khiêu chiến (Hiện có **${user.coin_ha_pham.toLocaleString()}**).` };
        }
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 1000 });
            database_1.default.prepare('UPDATE nine_heavens_progress SET attempts_this_week = attempts_this_week - 1 WHERE user_id = ?').run(userId);
        })();
        const updatedProgress = this.getProgress(userId);
        return {
            success: true,
            message: '✅ Mua thêm lượt khiêu chiến Cửu Trùng Tháp thành công! Đã khấu trừ **1,000 Linh Thạch**.',
            progress: updatedProgress
        };
    }
    /**
     * Bắt đầu khiêu chiến tầng tháp tiếp theo
     */
    enterFloorChallenge(userId, forceBuy = false) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const progress = this.getProgress(userId);
        const nextFloor = progress.highest_floor + 1;
        if (nextFloor > 9) {
            return { success: false, message: '🎉 Đạo hữu đã xuất sắc phá đảo tất cả 9 tầng Cửu Trùng Tháp rồi!' };
        }
        const floorConfig = this.FLOORS[nextFloor];
        if (user.level < floorConfig.minLevel) {
            return { success: false, message: `❌ Tầng **${nextFloor}** yêu cầu cấp độ tối thiểu phải đạt **Cấp ${floorConfig.minLevel}**!` };
        }
        // Kiểm tra lượt khiêu chiến miễn phí tuần này (3 lượt)
        if (progress.attempts_this_week >= 3 && !forceBuy) {
            return {
                success: false,
                requireBuy: true,
                message: `⚠️ Đạo hữu đã hết **3 lượt khiêu chiến miễn phí** tuần này!\nCó muốn tiêu hao **1,000 Linh Thạch** để mua thêm lượt không?`
            };
        }
        // Nếu đồng ý mua lượt bằng Linh Thạch
        if (progress.attempts_this_week >= 3 && forceBuy) {
            const buyRes = this.buyExtraAttempt(userId);
            if (!buyRes.success) {
                return { success: false, message: buyRes.message };
            }
        }
        // ─── THIẾT LẬP THUỘC TÍNH CHIẾN ĐẤU CHO PLAYER ───
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        // Lấy sủng thú xuất chiến
        const petRaw = database_1.default.prepare('SELECT name, base_atk, mutations, skills FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId);
        let pet = null;
        if (petRaw) {
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            let skillsArr = [];
            try {
                mutations = JSON.parse(petRaw.mutations || '{}');
            }
            catch (e) { }
            try {
                skillsArr = JSON.parse(petRaw.skills || '[]');
            }
            catch (e) { }
            pet = { name: petRaw.name, atk: petRaw.base_atk + (mutations.bonus_atk || 0), skills: skillsArr };
        }
        // Lấy các kỹ năng đang trang bị
        const equippedSkillsQuery = database_1.default.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId);
        const equippedSkills = equippedSkillsQuery.map(s => {
            const { SKILL_DETAILS } = require('../commands/general/kynang');
            const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
            return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
        });
        const bdl = BloodlineService_1.bloodlineService.getUserBloodline(userId);
        const { soulImprintService } = require('./SoulImprintService');
        let playerCombatant = {
            name: user.name,
            hp: activeStats.hp,
            maxHp: activeStats.hp,
            atk: activeStats.atk,
            def: activeStats.def,
            crit: activeStats.crit,
            critRes: activeStats.critRes,
            luck: activeStats.luck,
            speed: activeStats.speed ?? 100,
            dodge: activeStats.dodge ?? 0.05,
            linhCan: user.linh_can,
            equippedSkills: equippedSkills,
            bloodline: bdl ? { id: bdl.bloodline_id, name: bdl.name, level: bdl.level, passives: bdl.passives, rage_effect: bdl.rage_effect, rage_cooldown: bdl.rage_cooldown || 0 } : undefined,
            hasOai: soulImprintService.hasOaiActive(userId),
            userId: userId,
            level: user.level
        };
        // Tính cấp độ trung bình của server để scale quái
        const avgLevelRow = database_1.default.prepare('SELECT AVG(level) as avg_level FROM users').get();
        const avgLevel = avgLevelRow?.avg_level ? Math.floor(avgLevelRow.avg_level) : 1;
        const multiplier = Math.max(1.0, 1.0 + (avgLevel - floorConfig.minLevel) * 0.02);
        let enemyCombatant = {
            name: `${floorConfig.name} (Cửu Trùng Tháp Tầng ${nextFloor})`,
            hp: Math.round(floorConfig.hp * multiplier),
            maxHp: Math.round(floorConfig.hp * multiplier),
            atk: Math.round(floorConfig.atk * multiplier),
            def: Math.round(floorConfig.def * multiplier),
            crit: floorConfig.crit,
            critRes: floorConfig.critRes,
            speed: floorConfig.speed,
            dodge: floorConfig.dodge,
            luck: 10,
            element: floorConfig.element,
            isNineHeavensFloor5: nextFloor === 5,
            isNineHeavensFloor9: nextFloor === 9
        };
        // ─── ÁP DỤNG LUẬT ĐẶC BIỆT CỦA TỪNG TẦNG ───
        let isSurvival = false;
        let maxRounds = 30;
        if (nextFloor === 1) {
            // Độc Hành: Cấm Pet
            pet = null;
        }
        else if (nextFloor === 2) {
            // Cấm Khí: Naked (chỉ dùng chỉ số thô + ý cảnh)
            const baseStats = {
                hp: user.base_hp,
                atk: user.base_atk,
                def: user.base_def,
                crit: user.base_crit,
                critRes: user.base_crit_res,
                luck: user.base_luck,
                speed: user.base_speed ?? 100,
                dodge: user.base_dodge ?? 0.05
            };
            // Cộng hưởng từ Ý Cảnh
            try {
                const yCanh = JSON.parse(user.y_canh || '{}');
                if (yCanh.KiemY)
                    baseStats.atk += Math.round(user.base_atk * (yCanh.KiemY * 0.03));
                if (yCanh.BatDietY)
                    baseStats.hp += Math.round(user.base_hp * (yCanh.BatDietY * 0.03));
                if (yCanh.HuyenQuyY)
                    baseStats.def += Math.round(user.base_def * (yCanh.HuyenQuyY * 0.03));
            }
            catch (e) { }
            playerCombatant.hp = baseStats.hp;
            playerCombatant.maxHp = baseStats.hp;
            playerCombatant.atk = baseStats.atk;
            playerCombatant.def = baseStats.def;
            playerCombatant.crit = baseStats.crit;
            playerCombatant.critRes = baseStats.critRes;
            playerCombatant.luck = baseStats.luck;
            playerCombatant.speed = baseStats.speed;
            playerCombatant.dodge = baseStats.dodge;
        }
        else if (nextFloor === 3) {
            // Phản Thương: Enemy reflects 20%
            enemyCombatant.reflectRate = 0.20;
        }
        else if (nextFloor === 4) {
            // Sinh Tồn: Cần sống sót 10 hiệp
            isSurvival = true;
            maxRounds = 10;
        }
        else if (nextFloor === 5) {
            // Tuyệt Cảnh: 1 HP
            playerCombatant.hp = 1;
        }
        else if (nextFloor === 6) {
            // Nguyên Lực: Cấm active skills
            playerCombatant.equippedSkills = [];
        }
        else if (nextFloor === 7) {
            // Suy Nhược: Player ATK & DEF -50%
            playerCombatant.atk = Math.round(playerCombatant.atk * 0.5);
            playerCombatant.def = Math.round(playerCombatant.def * 0.5);
        }
        else if (nextFloor === 8) {
            // Thần Tốc: Enemy speed is already set to 300 in configuration
        }
        else if (nextFloor === 9) {
            // Cửu Trùng Đỉnh: Cấm Pet, Player ATK -20%, Enemy reflects 15%
            pet = null;
            playerCombatant.atk = Math.round(playerCombatant.atk * 0.8);
            enemyCombatant.reflectRate = 0.15;
        }
        // Chạy trận đấu
        const combatResult = CombatEngine_1.CombatEngine.run(playerCombatant, enemyCombatant, pet ? { name: pet.name, atk: pet.atk } : null, maxRounds, false, isSurvival);
        // Lưu cooldown nộ nếu có
        if (playerCombatant.bloodline && playerCombatant.bloodline.rage_cooldown > 0) {
            BloodlineService_1.bloodlineService.updateRageCooldown(userId, playerCombatant.bloodline.rage_cooldown);
        }
        const now = Math.floor(Date.now() / 1000);
        let rewardsLog = '';
        database_1.default.transaction(() => {
            // Tăng số lượt thử tuần này
            database_1.default.prepare('UPDATE nine_heavens_progress SET attempts_this_week = attempts_this_week + 1 WHERE user_id = ?').run(userId);
            if (combatResult.winner === 'player') {
                // Vượt tầng thành công!
                database_1.default.prepare('UPDATE nine_heavens_progress SET highest_floor = ? WHERE user_id = ?').run(nextFloor, userId);
                // Phát thưởng vĩnh viễn và linh thạch/KNB khích lệ
                let extraLoot = '';
                const statsUpdates = {};
                if (nextFloor === 1) {
                    extraLoot = '🗡️ **+10 Công kích (ATK) vĩnh viễn**';
                    statsUpdates.base_atk = user.base_atk + 10;
                }
                else if (nextFloor === 2) {
                    extraLoot = '💚 **+100 Sinh lực (HP) vĩnh viễn**';
                    statsUpdates.base_hp = user.base_hp + 100;
                }
                else if (nextFloor === 3) {
                    extraLoot = '🛡️ **+5 Phòng thủ (DEF) vĩnh viễn**';
                    statsUpdates.base_def = user.base_def + 5;
                }
                else if (nextFloor === 4) {
                    extraLoot = '💥 **+1% Bạo kích (Crit) vĩnh viễn**';
                    statsUpdates.base_crit = user.base_crit + 0.01;
                }
                else if (nextFloor === 5) {
                    extraLoot = '🌀 **+1% Né tránh (Dodge) vĩnh viễn**';
                    statsUpdates.base_dodge = (user.base_dodge ?? 0.05) + 0.01;
                }
                else if (nextFloor === 6) {
                    extraLoot = '⚡ **+10 Tốc độ (Speed) vĩnh viễn**';
                    statsUpdates.base_speed = (user.base_speed ?? 100) + 10;
                }
                else if (nextFloor === 7) {
                    extraLoot = '🗡️ **+15 Công kích (ATK) vĩnh viễn**';
                    statsUpdates.base_atk = user.base_atk + 15;
                }
                else if (nextFloor === 8) {
                    extraLoot = '🛡️ **+2% Kháng bạo (CritRes) vĩnh viễn**';
                    statsUpdates.base_crit_res = user.base_crit_res + 0.02;
                }
                else if (nextFloor === 9) {
                    extraLoot = '👑 **+250 HP, +20 ATK, +10 DEF vĩnh viễn**';
                    statsUpdates.base_hp = user.base_hp + 250;
                    statsUpdates.base_atk = user.base_atk + 20;
                    statsUpdates.base_def = user.base_def + 10;
                }
                const lthapReward = nextFloor * 2000;
                const knbReward = nextFloor * 2;
                const titleReward = nextFloor === 9 ? '\n👑 **Danh hiệu Thiên Trụ đã được phong tặng!**' : '';
                UserRepository_1.userRepository.update(userId, {
                    coin_ha_pham: user.coin_ha_pham + lthapReward,
                    knb: user.knb + knbReward,
                    ...statsUpdates
                });
                // Phong vương danh hiệu "Thiên Trụ" tại tầng 9
                if (nextFloor === 9) {
                    const existingTitle = database_1.default.prepare('SELECT id FROM user_titles WHERE user_id = ? AND title = ?').get(userId, 'Thiên Trụ');
                    if (!existingTitle) {
                        database_1.default.prepare(`
              INSERT INTO user_titles (user_id, title, source, unlocked_at)
              VALUES (?, 'Thiên Trụ', 'nine_heavens', ?)
            `).run(userId, now);
                    }
                    if (user.title === 'Tán Tu' || !user.title) {
                        UserRepository_1.userRepository.update(userId, { title: 'Thiên Trụ' });
                    }
                }
                // Cộng EXP cho Bản Mệnh Pháp Bảo
                let artifactMessage = '';
                const artifactRes = InventoryService_1.inventoryService.addArtifactExp(userId, 100 * nextFloor);
                if (artifactRes && artifactRes.message) {
                    artifactMessage = `\n• ${artifactRes.message}`;
                }
                rewardsLog = `🎉 **VƯỢT THÁP THÀNH CÔNG TẦNG ${nextFloor}!**\n` +
                    `• Thần quang tẩy tủy: ${extraLoot}\n` +
                    `• Phần thưởng khích lệ: +**${lthapReward.toLocaleString()} Linh Thạch** & +**${knbReward} KNB**!` +
                    artifactMessage +
                    titleReward;
            }
        })();
        return {
            success: true,
            message: combatResult.winner === 'player' ? 'Thành Công' : 'Thất Bại',
            combatResult,
            rewardsLog
        };
    }
}
exports.nineHeavensService = new NineHeavensService();
