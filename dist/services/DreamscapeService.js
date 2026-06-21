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
class DreamscapeService {
    /**
     * Khởi tạo hoặc lấy dữ liệu Dreamscape của user
     */
    getDreamscapeData(userId) {
        let data = database_1.default.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId);
        if (!data) {
            database_1.default.prepare('INSERT INTO user_dreamscapes (user_id) VALUES (?)').run(userId);
            data = database_1.default.prepare('SELECT * FROM user_dreamscapes WHERE user_id = ?').get(userId);
        }
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
     */
    generateShadow(user, floor) {
        let multiplier = 1.0;
        if (floor >= 11 && floor <= 20)
            multiplier = 1.2;
        else if (floor >= 21 && floor <= 30)
            multiplier = 1.5;
        else if (floor >= 31 && floor <= 50)
            multiplier = 2.0;
        // Shadow không có bloodline, pet, chỉ có stats
        return {
            name: `Bóng Tối [Tầng ${floor}]`,
            hp: Math.round((user.base_hp || 100) * multiplier),
            maxHp: Math.round((user.base_hp || 100) * multiplier),
            atk: Math.round((user.base_atk || 15) * multiplier),
            def: Math.round((user.base_def || 10) * multiplier),
            crit: (user.base_crit || 0.05),
            critRes: (user.base_crit_res || 0),
            luck: 10,
            speed: (user.base_speed || 100) * multiplier,
            dodge: (user.base_dodge || 0.05)
        };
    }
    /**
     * Khiêu chiến
     */
    challenge(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại.' };
        const data = this.getDreamscapeData(userId);
        if (data.current_floor > 50) {
            return { success: false, message: 'Đạo hữu đã vượt qua tầng 50, chạm tới đỉnh cao Vọng Tưởng tuần này!' };
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
        const playerCombatant = {
            name: user.name,
            hp: startHp,
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
            hasOai: require('./SoulImprintService').soulImprintService.hasOaiActive(userId)
        };
        const shadow = this.generateShadow(user, data.current_floor);
        // Chạy trận đấu với isDreamscape = true
        const result = CombatEngine_1.CombatEngine.run(playerCombatant, shadow, null, 15, true);
        const isWin = result.winner === 'player';
        let message = '';
        if (isWin) {
            const scoreGain = (data.current_floor * 1000) + Math.round((result.playerEndingHp / activeStats.hp) * 500) + (result.rounds * 50) + (data.current_floor % 10 === 0 ? 2000 : 0);
            const newScore = data.score + scoreGain;
            const nextFloor = data.current_floor + 1;
            const maxFloor = Math.max(data.max_floor, data.current_floor);
            database_1.default.prepare(`
        UPDATE user_dreamscapes 
        SET current_floor = ?, max_floor = ?, score = ?, hp_remaining = ?
        WHERE user_id = ?
      `).run(nextFloor, maxFloor, newScore, result.playerEndingHp, userId);
            message = `🎉 Đạo hữu đã đánh bại Bóng Tối Tầng ${data.current_floor}! Nhận **+${scoreGain}** Điểm Vọng Tưởng.\n\n⚠️ Đạo hữu còn lại **${result.playerEndingHp}/${activeStats.hp}** HP để bước vào tầng tiếp theo!`;
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
