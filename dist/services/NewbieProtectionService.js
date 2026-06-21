"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newbieProtectionService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const NEWBIE_PROTECTION_DAYS = 7;
const NEWBIE_MAX_LEVEL = 10;
const MENTOR_EXP_SHARE = 0.10;
const MENTOR_COIN_SHARE = 0.05;
class NewbieProtectionService {
    /**
     * Kiểm tra người chơi có đang được bảo hộ không
     */
    isProtected(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return false;
        // Bảo hộ theo thời gian (7 ngày đầu)
        const now = Math.floor(Date.now() / 1000);
        const accountAge = now - user.created_at;
        const protectionPeriod = NEWBIE_PROTECTION_DAYS * 24 * 3600;
        if (accountAge < protectionPeriod)
            return true;
        // Bảo hộ theo cấp độ (dưới level 10)
        if (user.level < NEWBIE_MAX_LEVEL)
            return true;
        return false;
    }
    /**
     * Lấy hệ số EXP buff cho người mới
     */
    getExpMultiplier(userId) {
        if (this.isProtected(userId))
            return 2.0;
        return 1.0;
    }
    /**
     * Lấy số ngày còn lại được bảo hộ
     */
    getRemainingProtectionDays(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return 0;
        const now = Math.floor(Date.now() / 1000);
        const accountAge = now - user.created_at;
        const protectionPeriod = NEWBIE_PROTECTION_DAYS * 24 * 3600;
        const remaining = protectionPeriod - accountAge;
        if (remaining <= 0 && user.level >= NEWBIE_MAX_LEVEL)
            return 0;
        const daysFromTime = Math.ceil(remaining / 86400);
        if (daysFromTime > 0)
            return daysFromTime;
        // Nếu hết thời gian nhưng còn level thấp
        if (user.level < NEWBIE_MAX_LEVEL)
            return -1; // vĩnh viễn đến khi đạt level
        return 0;
    }
    // ─── Sư Đồ (Mentor) System ───
    /**
     * Đăng ký sư đồ
     */
    registerMentor(studentId, mentorId) {
        const student = UserRepository_1.userRepository.get(studentId);
        const mentor = UserRepository_1.userRepository.get(mentorId);
        if (!student || !mentor)
            return { success: false, message: 'Người chơi không tồn tại!' };
        if (studentId === mentorId)
            return { success: false, message: 'Không thể tự nhận mình làm sư phụ!' };
        if (mentor.level < student.level + 10)
            return { success: false, message: 'Sư phụ phải cao hơn đồ đệ ít nhất 10 cấp!' };
        if (!this.isProtected(studentId))
            return { success: false, message: 'Người chơi này không cần bảo hộ nữa!' };
        // Kiểm tra đã có sư đồ chưa
        const existing = database_1.default.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId);
        if (existing)
            return { success: false, message: 'Người chơi này đã có sư phụ!' };
        // Giới hạn số đồ đệ tối đa
        const studentCount = database_1.default.prepare('SELECT COUNT(*) as c FROM mentors WHERE mentor_id = ?').get(mentorId);
        if (studentCount.c >= 3)
            return { success: false, message: 'Sư phụ đã nhận đủ 3 đồ đệ!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO mentors (mentor_id, student_id, started_at) VALUES (?, ?, ?)').run(mentorId, studentId, now);
        return {
            success: true,
            message: `🤝 **Kết duyên sư đồ thành công!** <@${mentorId}> nhận <@${studentId}> làm đồ đệ.\n📈 Đồ đệ nhận **x2 EXP/LT** khi được bảo hộ.\n🎁 Sư phụ nhận **${MENTOR_EXP_SHARE * 100}% EXP** và **${MENTOR_COIN_SHARE * 100}% Linh Thạch** từ mọi hoạt động của đồ đệ.`
        };
    }
    /**
     * Kiểm tra có phải sư đồ không
     */
    getMentorInfo(studentId) {
        const row = database_1.default.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId);
        if (!row)
            return null;
        return { mentorId: row.mentor_id, studentId: row.student_id, startedAt: row.started_at };
    }
    /**
     * Lấy danh sách đồ đệ
     */
    getStudents(mentorId) {
        return database_1.default.prepare('SELECT * FROM mentors WHERE mentor_id = ? ORDER BY started_at ASC').all(mentorId);
    }
    /**
     * Chia sẻ kinh nghiệm cho sư phụ khi đồ đệ nhận EXP
     */
    shareExperienceToMentor(studentId, expGained, coinsGained) {
        const mentorInfo = this.getMentorInfo(studentId);
        if (!mentorInfo)
            return;
        const mentor = UserRepository_1.userRepository.get(mentorInfo.mentorId);
        if (!mentor)
            return;
        const mentorExp = Math.round(expGained * MENTOR_EXP_SHARE);
        const mentorCoins = Math.round(coinsGained * MENTOR_COIN_SHARE);
        if (mentorExp > 0 || mentorCoins > 0) {
            database_1.default.transaction(() => {
                UserRepository_1.userRepository.update(mentorInfo.mentorId, {
                    tu_vi: mentor.tu_vi + mentorExp,
                    coin_ha_pham: mentor.coin_ha_pham + mentorCoins,
                });
            })();
        }
    }
    /**
     * Hủy sư đồ
     */
    removeMentor(studentId) {
        const existing = database_1.default.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId);
        if (!existing)
            return { success: false, message: 'Không tìm thấy quan hệ sư đồ!' };
        database_1.default.prepare('DELETE FROM mentors WHERE student_id = ?').run(studentId);
        return { success: true, message: '🗡️ **Đã đoạn tuyệt sư đồ!**' };
    }
}
exports.newbieProtectionService = new NewbieProtectionService();
