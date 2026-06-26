"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dreamscapeService = exports.DreamscapeService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const CombatEngine_1 = require("./CombatEngine");
const BloodlineService_1 = require("./BloodlineService");
const InventoryService_1 = require("./InventoryService");
const DREAM_EVENTS = [
    {
        id: 'mysterious_shrine',
        name: '🛕 Đền Bí Ẩn',
        description: 'Một ngôi đền cổ xưa tỏa ra ánh sáng huyền bí giữa giấc mơ...',
        choices: [
            { id: 'heal', label: '🟢 Cầu nguyện hồi phục', effect: 'heal_percent', value: 30 },
            { id: 'atk_buff', label: '🔴 Cầu nguyện sức mạnh', effect: 'atk_buff', value: 15 },
        ]
    },
    {
        id: 'shadow_merchant',
        name: '🧑‍🌾 Thương Nhân Bóng Tối',
        description: 'M bóng dáng mờ ảo xuất hiện: "Ta có thứ ngươi cần... đổi mạng lấy sức mạnh..."',
        choices: [
            { id: 'trade_hp', label: '🔴 Đổi 20% HP lấy +5% ATK vĩnh viễn', effect: 'hp_for_atk', value: 5 },
            { id: 'decline', label: '⚪ Từ chối', effect: 'none', value: 0 },
        ]
    },
    {
        id: 'corrupted_spring',
        name: '⛲ Suối Nguyền',
        description: 'Dòng suối trong vắt nhưng tỏa ra mùi hắc ám...',
        choices: [
            { id: 'full_heal', label: '🟢 Tắm suối hồi phục toàn bộ', effect: 'full_heal', value: 0 },
            { id: 'cursed_heal', label: '🔴 Uống nước hồi phục + buff', effect: 'heal_with_curse', value: 50 },
        ]
    },
    {
        id: 'forgotten_arsenal',
        name: '⚔️ Kho Vũ Khí Bị Lãng Quên',
        description: 'Một kho vũ khí cổ đại ẩn giữa giấc mơ...',
        choices: [
            { id: 'random_buff', label: '🔵 Chọn một vũ khí ngẫu nhiên', effect: 'random_combat_buff', value: 3 },
            { id: 'leave', label: '⚪ Rời đi', effect: 'none', value: 0 },
        ]
    },
    {
        id: 'memory_fragment',
        name: '💠 Mảnh Ký Ức',
        description: 'Một mảnh ký ứcโบราณ trôi nổi, chứa đựng tri thức...',
        choices: [
            { id: 'reveal', label: '🔵 Chiêm nghiệm mảnh ký ức', effect: 'reveal_enemy', value: 3 },
            { id: 'absorb_m', label: '🔴 Hấp thụ tri thức', effect: 'exp_bonus', value: 500 },
        ]
    },
    {
        id: 'dream_gate',
        name: '🌀 Cổng Giấc Mơ',
        description: 'Một cổng xoáy giữa không trung, phát ra ánh sáng kỳ lạ...',
        choices: [
            { id: 'skip_floor', label: '🟢 Bỏ qua tầng tiếp (giữ HP)', effect: 'skip_floor', value: 1 },
            { id: 'double_score', label: '🔴 Nhận x2 điểm tầng này', effect: 'double_score', value: 2 },
        ]
    },
    {
        id: 'echo_warrior',
        name: '👤 Chiến Binh Sống Động',
        description: 'Bóng dáng một chiến binh hùng mạnh xuất hiện, thách đấu...',
        choices: [
            { id: 'fight_echo', label: '🔴 Đánh bại để nhận thưởng lớn', effect: 'fight_echo', value: 30 },
            { id: 'befriend', label: '🟢 Kết giao nhận hỗ trợ', effect: 'temp_buff', value: 20 },
        ]
    },
    {
        id: 'dream_crystal',
        name: '💎 Tinh Thể Giấc Mơ',
        description: 'Một tinh thể phát sáng lơ lửng giữa không trung...',
        choices: [
            { id: 'break_crystal', label: '🔴 Phá vỡ tinh thể', effect: 'random_reward', value: 0 },
            { id: 'meditate_crystal', label: '🟢 Thiền định bên tinh thể', effect: 'hp_regen_buff', value: 10 },
        ]
    },
];
class DreamscapeService {
    /**
     * Khởi tạo hoặc lấy dữ liệu Dreamscape của user
     */
    getDreamscapeData(userId) {
        // Ensure table has active_buffs column
        try {
            database_1.default.exec(`ALTER TABLE user_dreamscapes ADD COLUMN active_buffs TEXT DEFAULT '[]'`);
        }
        catch (_) { /* column exists */ }
        let data = database_1.default.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId);
        if (!data) {
            database_1.default.prepare('INSERT INTO user_dreamscapes (user_id, active_buffs) VALUES (?, ?)').run(userId, '[]');
            data = database_1.default.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId);
        }
        if (!data.active_buffs)
            data.active_buffs = '[]';
        const currentWeekStart = this.getStartOfWeek();
        if (data.last_reset < currentWeekStart) {
            // Reset tuần mới
            database_1.default.prepare('UPDATE user_dreamscapes SET current_floor = 1, score = 0, weekly_entries = 0, hp_remaining = -1, last_reset = ? WHERE user_id = ?')
                .run(currentWeekStart, userId);
            data.current_floor = 1;
            data.score = 0;
            data.weekly_entries = 0;
            data.hp_remaining = -1;
            data.last_reset = currentWeekStart;
        }
        return data;
    }
    // === B1: Dreamscape Event System ===
    shouldTriggerEvent(floor) {
        // Every 5 floors: guaranteed event. Otherwise 30% chance
        if (floor % 5 === 0 && floor > 0)
            return true;
        return Math.random() < 0.30;
    }
    getRandomEvent() {
        return DREAM_EVENTS[Math.floor(Math.random() * DREAM_EVENTS.length)];
    }
    applyEventChoice(userId, eventId, choiceId) {
        const event = DREAM_EVENTS.find(e => e.id === eventId);
        if (!event)
            return { success: false, message: 'Sự kiện không tồn tại!' };
        const choice = event.choices.find(c => c.id === choiceId);
        if (!choice)
            return { success: false, message: 'Lựa chọn không hợp lệ!' };
        const data = this.getDreamscapeData(userId);
        const buffs = JSON.parse(data.active_buffs || '[]');
        let msg = '';
        switch (choice.effect) {
            case 'heal_percent': {
                const healAmt = Math.round(choice.value / 100 * (data.hp_remaining > 0 ? data.hp_remaining : 1000));
                database_1.default.prepare('UPDATE user_dreamscapes SET hp_remaining = hp_remaining + ? WHERE user_id = ?').run(healAmt, userId);
                msg = `💚 Hồi phục **+${healAmt}** HP!`;
                break;
            }
            case 'full_heal': {
                const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
                const maxHp = activeStats?.hp || 1000;
                database_1.default.prepare('UPDATE user_dreamscapes SET hp_remaining = ? WHERE user_id = ?').run(maxHp, userId);
                msg = `💚 Hồi phục **toàn bộ** HP!`;
                break;
            }
            case 'atk_buff': {
                buffs.push({ type: 'atk_percent', value: choice.value, floors: 3 });
                msg = `⚔️ Tăng **+${choice.value}%** ATK trong 3 tầng!`;
                break;
            }
            case 'hp_for_atk': {
                const hpCost = Math.round(data.hp_remaining * 0.20);
                database_1.default.prepare('UPDATE user_dreamscapes SET hp_remaining = hp_remaining - ? WHERE user_id = ?').run(hpCost, userId);
                buffs.push({ type: 'atk_percent', value: choice.value, floors: -1 }); // permanent
                msg = `🔴 Mất **${hpCost}** HP, nhận **+${choice.value}%** ATK vĩnh viễn!`;
                break;
            }
            case 'heal_with_curse': {
                const activeStats2 = InventoryService_1.inventoryService.getActiveStats(userId);
                const maxHp2 = activeStats2?.hp || 1000;
                database_1.default.prepare('UPDATE user_dreamscapes SET hp_remaining = ? WHERE user_id = ?').run(maxHp2, userId);
                buffs.push({ type: 'def_percent', value: -choice.value, floors: 5 });
                msg = `💚 Hồi phục toàn bộ HP! nhưng **-${choice.value}%** DEF trong 5 tầng.`;
                break;
            }
            case 'random_combat_buff': {
                const buffTypes = ['atk_percent', 'def_percent', 'crit_percent', 'dodge_percent'];
                const buffType = buffTypes[Math.floor(Math.random() * buffTypes.length)];
                buffs.push({ type: buffType, value: choice.value, floors: choice.value });
                msg = `✨ Nhận **+${choice.value}%** ${buffType.replace('_percent', '').toUpperCase()} trong ${choice.value} tầng!`;
                break;
            }
            case 'skip_floor': {
                database_1.default.prepare('UPDATE user_dreamscapes SET current_floor = current_floor + 1 WHERE user_id = ?').run(userId);
                msg = `🌀 Đã bỏ qua tầng tiếp theo!`;
                break;
            }
            case 'double_score': {
                buffs.push({ type: 'double_score', value: 2, floors: 1 });
                msg = `✨ Điểm x2 cho tầng tiếp theo!`;
                break;
            }
            case 'temp_buff': {
                buffs.push({ type: 'all_stats_percent', value: choice.value, floors: 3 });
                msg = `🛡️ Tăng **+${choice.value}%** tất cả chỉ số trong 3 tầng!`;
                break;
            }
            case 'hp_regen_buff': {
                buffs.push({ type: 'hp_regen', value: choice.value, floors: -1 });
                msg = `💚 Hồi phục **${choice.value}%** HP mỗi hiệp vĩnh viễn!`;
                break;
            }
            default: {
                msg = `✨ Nhận phần thưởng ngẫu nhiên!`;
                break;
            }
        }
        // Save buffs
        database_1.default.prepare('UPDATE user_dreamscapes SET active_buffs = ? WHERE user_id = ?')
            .run(JSON.stringify(buffs), userId);
        return { success: true, message: msg };
    }
    getActiveBuffDescription(userId) {
        const data = this.getDreamscapeData(userId);
        const buffs = JSON.parse(data.active_buffs || '[]');
        if (buffs.length === 0)
            return '';
        let msg = `\n**Buffs đang hoạt động:**\n`;
        for (const b of buffs) {
            const suffix = b.floors === -1 ? '(vĩnh viễn)' : `(${b.floors} tầng)`;
            msg += `• ${b.type.replace('_percent', '%').replace('_', ' ')} +${b.value} ${suffix}\n`;
        }
        return msg;
    }
    getStartOfWeek() {
        const now = new Date();
        // Set to start of current week (Monday 00:00)
        const day = now.getDay() || 7;
        if (day !== 1)
            now.setHours(-24 * (day - 1));
        now.setHours(0, 0, 0, 0);
        return Math.floor(now.getTime() / 1000);
    }
    /**
     * Tạo bản sao (Shadow) của người chơi
     * P1-02: 25% chance Shadow có passive special ability
     */
    generateShadow(user, floor) {
        let multiplier = 1.0;
        if (floor >= 11 && floor <= 20)
            multiplier = 1.2;
        else if (floor >= 21 && floor <= 30)
            multiplier = 1.5;
        else if (floor >= 31 && floor <= 50)
            multiplier = 2.0;
        // P1-02: Shadow Mutations — 25% chance for special ability
        let shadowMutation;
        if (Math.random() < 0.25 && floor > 5) {
            const mutations = ['burn', 'poison', 'drain', 'thorns', 'swift'];
            shadowMutation = mutations[Math.floor(Math.random() * mutations.length)];
        }
        const shadowName = shadowMutation
            ? `Bóng Tối [Tầng ${floor}] ⚠️`
            : `Bóng Tối [Tầng ${floor}]`;
        return {
            name: shadowName,
            hp: Math.round((user.base_hp || 100) * multiplier),
            maxHp: Math.round((user.base_hp || 100) * multiplier),
            atk: Math.round((user.base_atk || 15) * multiplier),
            def: Math.round((user.base_def || 10) * multiplier),
            crit: (user.base_crit || 0.05),
            critRes: (user.base_crit_res || 0),
            luck: 10,
            speed: (user.base_speed || 100) * multiplier,
            dodge: (user.base_dodge || 0.05),
            shadowMutation
        };
    }
    /**
     * Khiêu chiến
     */
    challenge(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const data = this.getDreamscapeData(userId);
        if (data.current_floor > 50) {
            return { success: false, message: 'Đạo hữu đã vượt qua tầng 50, chạm tới đỉnh cao Vọng Tưởng tuần này!' };
        }
        // B1: Check if event should trigger before combat
        if (this.shouldTriggerEvent(data.current_floor) && data.current_floor > 1) {
            const event = this.getRandomEvent();
            return { success: true, message: '', event };
        }
        // Nếu ở tầng 1 và chưa có máu lưu trữ -> bắt đầu lượt mới
        if (data.current_floor === 1 && data.hp_remaining === -1) {
            if (data.weekly_entries >= 3) {
                return { success: false, message: 'Đạo hữu đã hết số lần khiêu chiến Vọng Tưởng trong tuần này (3/3).' };
            }
            database_1.default.prepare('UPDATE user_dreamscapes SET weekly_entries = weekly_entries + 1 WHERE user_id = ?').run(userId);
        }
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (!activeStats)
            return { success: false, message: 'Lỗi chỉ số người chơi.' };
        const startHp = data.hp_remaining !== -1 ? data.hp_remaining : activeStats.hp;
        // Lấy kỹ năng trang bị
        const equippedSkillsQuery = database_1.default.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId);
        const equippedSkills = equippedSkillsQuery.map(s => {
            const { SKILL_DETAILS } = require('../commands/general/kynang');
            const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
            return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
        });
        const bdl = BloodlineService_1.bloodlineService.getUserBloodline(userId);
        // B1: Apply active buffs to stats
        const activeBuffs = JSON.parse(data.active_buffs || '[]');
        let buffAtk = 0, buffDef = 0, buffCrit = 0, buffDodge = 0, buffAllStats = 0;
        const remainingBuffs = [];
        for (const buff of activeBuffs) {
            if (buff.floors === -1 || buff.floors > 0) {
                switch (buff.type) {
                    case 'atk_percent':
                        buffAtk += buff.value;
                        break;
                    case 'def_percent':
                        buffDef += buff.value;
                        break;
                    case 'crit_percent':
                        buffCrit += buff.value;
                        break;
                    case 'dodge_percent':
                        buffDodge += buff.value;
                        break;
                    case 'all_stats_percent':
                        buffAllStats += buff.value;
                        break;
                }
                if (buff.floors > 0) {
                    remainingBuffs.push({ ...buff, floors: buff.floors - 1 });
                }
                else {
                    remainingBuffs.push(buff); // permanent
                }
            }
        }
        // Save remaining buffs
        database_1.default.prepare('UPDATE user_dreamscapes SET active_buffs = ? WHERE user_id = ?')
            .run(JSON.stringify(remainingBuffs), userId);
        const totalBuffMult = 1 + (buffAtk + buffAllStats) / 100;
        const totalDefMult = 1 + (buffDef + buffAllStats) / 100;
        const playerCombatant = {
            name: user.name,
            hp: startHp,
            maxHp: activeStats.hp,
            atk: Math.round(activeStats.atk * totalBuffMult),
            def: Math.round(activeStats.def * totalDefMult),
            crit: activeStats.crit + (buffCrit + buffAllStats) / 100,
            critRes: activeStats.critRes,
            luck: activeStats.luck,
            speed: activeStats.speed ?? 100,
            dodge: (activeStats.dodge ?? 0.05) + (buffDodge + buffAllStats) / 100,
            linhCan: user.linh_can,
            equippedSkills: equippedSkills,
            bloodline: bdl ? { id: bdl.bloodline_id, name: bdl.name, level: bdl.level, passives: bdl.passives, rage_effect: bdl.rage_effect, rage_cooldown: bdl.rage_cooldown || 0 } : undefined,
            hasOai: require('./SoulImprintService').soulImprintService.hasOaiActive(userId)
        };
        const shadow = this.generateShadow(user, data.current_floor);
        // Chạy trận đấu với isDreamscape = true
        const result = CombatEngine_1.CombatEngine.run(playerCombatant, shadow, null, 15, true);
        const isWin = result.winner === 'player';
        let message = '';
        if (isWin) {
            let scoreGain = (data.current_floor * 1000) + Math.round((result.playerEndingHp / activeStats.hp) * 500) + (result.rounds * 50) + (data.current_floor % 10 === 0 ? 2000 : 0);
            // B1: Check for double_score buff
            const doubleBuff = activeBuffs.find((b) => b.type === 'double_score' && b.floors >= 0);
            if (doubleBuff) {
                scoreGain *= doubleBuff.value;
                doubleBuff.floors = 0; // consumed
            }
            const newScore = data.score + scoreGain;
            const nextFloor = data.current_floor + 1;
            const maxFloor = Math.max(data.max_floor, data.current_floor);
            // P1-02: Dream Dust rewards per floor
            let dreamDust = 0;
            if (data.current_floor <= 10) {
                dreamDust = 5 + Math.floor(Math.random() * 16); // 5-20
            }
            else if (data.current_floor <= 30) {
                dreamDust = 15 + Math.floor(Math.random() * 26); // 15-40
            }
            else {
                dreamDust = 30 + Math.floor(Math.random() * 51); // 30-80
            }
            // Boss floor (every 10) gives double dust
            if (data.current_floor % 10 === 0)
                dreamDust *= 2;
            database_1.default.prepare(`
        UPDATE user_dreamscapes
        SET current_floor = ?, max_floor = ?, score = ?, hp_remaining = ?
        WHERE user_id = ?
      `).run(nextFloor, maxFloor, newScore, result.playerEndingHp, userId);
            // Add dream dust to user
            UserRepository_1.userRepository.update(userId, { dream_dust: (user.dream_dust || 0) + dreamDust });
            message = `🎉 Đạo hữu đã đánh bại Bóng Tối Tầng ${data.current_floor}! Nhận **+${scoreGain}** Điểm Vọng Tưởng + **${dreamDust}** Dust Mộng.\n\n⚠️ Đạo hữu còn lại **${result.playerEndingHp}/${activeStats.hp}** HP để bước vào tầng tiếp theo!`;
        }
        else {
            // Thua -> kết thúc run
            database_1.default.prepare(`
        UPDATE user_dreamscapes 
        SET current_floor = 1, hp_remaining = -1
        WHERE user_id = ?
      `).run(userId);
            message = `💀 Đạo hữu đã bị đánh bại bởi Bóng Tối Tầng ${data.current_floor} và bị đẩy ra khỏi Bí Cảnh. Kết thúc vòng lặp.`;
        }
        return {
            success: true,
            message,
            log: result.log,
            isWin,
            currentFloor: data.current_floor
        };
    }
    getLeaderboard(limit = 10) {
        return database_1.default.prepare(`
      SELECT d.user_id, d.score, d.max_floor, u.name
      FROM user_dreamscapes d
      JOIN users u ON d.user_id = u.discord_id
      WHERE d.score > 0
      ORDER BY d.score DESC, d.max_floor DESC
      LIMIT ?
    `).all(limit);
    }
    // === C2: Weekly Leaderboard Rewards ===
    distributeWeeklyRewards() {
        const leaderboard = this.getLeaderboard(25);
        const rewards = [];
        for (let i = 0; i < leaderboard.length; i++) {
            const entry = leaderboard[i];
            const rank = i + 1;
            let reward = '';
            if (rank === 1) {
                UserRepository_1.userRepository.update(entry.user_id, { knb: (UserRepository_1.userRepository.get(entry.user_id)?.knb || 0) + 50 });
                reward = '50 KNB + Danh hiệu "Dream Walker"';
            }
            else if (rank <= 3) {
                UserRepository_1.userRepository.update(entry.user_id, { knb: (UserRepository_1.userRepository.get(entry.user_id)?.knb || 0) + 30 });
                reward = '30 KNB + Danh hiệu "Dream Scholar"';
            }
            else if (rank <= 10) {
                UserRepository_1.userRepository.update(entry.user_id, { knb: (UserRepository_1.userRepository.get(entry.user_id)?.knb || 0) + 15 });
                reward = '15 KNB';
            }
            else if (rank <= 25) {
                UserRepository_1.userRepository.update(entry.user_id, { coin_ha_pham: (UserRepository_1.userRepository.get(entry.user_id)?.coin_ha_pham || 0) + 5000 });
                reward = '5000 Linh Thạch';
            }
            if (reward) {
                rewards.push({ userId: entry.user_id, name: entry.name, rank, reward });
            }
        }
        return rewards;
    }
    resetDreamscape(userId) {
        // Cho phép người chơi tự reset về tầng 1 nếu đang kẹt
        const data = this.getDreamscapeData(userId);
        if (data.current_floor === 1 && data.hp_remaining === -1) {
            return { success: false, message: 'Đạo hữu đang ở Tầng 1 và chưa bắt đầu khiêu chiến, không cần thiết lập lại.' };
        }
        database_1.default.prepare('UPDATE user_dreamscapes SET current_floor = 1, hp_remaining = -1 WHERE user_id = ?').run(userId);
        return { success: true, message: 'Đã đầu hàng Bóng Tối. Vòng lặp hiện tại đã kết thúc, máu và tầng đã được đặt lại.' };
    }
}
exports.DreamscapeService = DreamscapeService;
exports.dreamscapeService = new DreamscapeService();
