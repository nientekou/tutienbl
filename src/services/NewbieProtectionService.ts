import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

const NEWBIE_PROTECTION_DAYS = 7;
const NEWBIE_MAX_LEVEL = 10;
const MENTOR_EXP_SHARE = 0.10;
const MENTOR_COIN_SHARE = 0.05;

export interface MentorInfo {
  mentorId: string;
  studentId: string;
  startedAt: number;
}

class NewbieProtectionService {
  /**
   * Kiểm tra người chơi có đang được bảo hộ không
   */
  public isProtected(userId: string): boolean {
    const user = userRepository.get(userId);
    if (!user) return false;

    // Bảo hộ theo thời gian (7 ngày đầu)
    const now = Math.floor(Date.now() / 1000);
    const accountAge = now - user.created_at;
    const protectionPeriod = NEWBIE_PROTECTION_DAYS * 24 * 3600;
    if (accountAge < protectionPeriod) return true;

    // Bảo hộ theo cấp độ (dưới level 10)
    if (user.level < NEWBIE_MAX_LEVEL) return true;

    return false;
  }

  /**
   * Lấy hệ số EXP buff cho người mới
   */
  public getExpMultiplier(userId: string): number {
    if (this.isProtected(userId)) return 2.0;
    return 1.0;
  }

  /**
   * Lấy số ngày còn lại được bảo hộ
   */
  public getRemainingProtectionDays(userId: string): number {
    const user = userRepository.get(userId);
    if (!user) return 0;

    const now = Math.floor(Date.now() / 1000);
    const accountAge = now - user.created_at;
    const protectionPeriod = NEWBIE_PROTECTION_DAYS * 24 * 3600;
    const remaining = protectionPeriod - accountAge;
    if (remaining <= 0 && user.level >= NEWBIE_MAX_LEVEL) return 0;

    const daysFromTime = Math.ceil(remaining / 86400);
    if (daysFromTime > 0) return daysFromTime;

    // Nếu hết thời gian nhưng còn level thấp
    if (user.level < NEWBIE_MAX_LEVEL) return -1; // vĩnh viễn đến khi đạt level

    return 0;
  }

  // ─── Sư Đồ (Mentor) System ───

  /**
   * Đăng ký sư đồ
   */
  public registerMentor(studentId: string, mentorId: string): { success: boolean; message: string } {
    const student = userRepository.get(studentId);
    const mentor = userRepository.get(mentorId);
    if (!student || !mentor) return { success: false, message: 'Người chơi không tồn tại!' };
    if (studentId === mentorId) return { success: false, message: 'Không thể tự nhận mình làm sư phụ!' };
    if (mentor.level < student.level + 10) return { success: false, message: 'Sư phụ phải cao hơn đồ đệ ít nhất 10 cấp!' };
    if (!this.isProtected(studentId)) return { success: false, message: 'Người chơi này không cần bảo hộ nữa!' };

    // Kiểm tra đã có sư đồ chưa
    const existing = db.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId) as any;
    if (existing) return { success: false, message: 'Người chơi này đã có sư phụ!' };

    // Giới hạn số đồ đệ tối đa
    const studentCount = db.prepare('SELECT COUNT(*) as c FROM mentors WHERE mentor_id = ?').get(mentorId) as { c: number };
    if (studentCount.c >= 3) return { success: false, message: 'Sư phụ đã nhận đủ 3 đồ đệ!' };

    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO mentors (mentor_id, student_id, started_at) VALUES (?, ?, ?)').run(mentorId, studentId, now);

    return {
      success: true,
      message: `🤝 **Kết duyên sư đồ thành công!** <@${mentorId}> nhận <@${studentId}> làm đồ đệ.\n📈 Đồ đệ nhận **x2 EXP/LT** khi được bảo hộ.\n🎁 Sư phụ nhận **${MENTOR_EXP_SHARE * 100}% EXP** và **${MENTOR_COIN_SHARE * 100}% Linh Thạch** từ mọi hoạt động của đồ đệ.`
    };
  }

  /**
   * Kiểm tra có phải sư đồ không
   */
  public getMentorInfo(studentId: string): MentorInfo | null {
    const row = db.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId) as any;
    if (!row) return null;
    return { mentorId: row.mentor_id, studentId: row.student_id, startedAt: row.started_at };
  }

  /**
   * Lấy danh sách đồ đệ
   */
  public getStudents(mentorId: string): MentorInfo[] {
    return db.prepare('SELECT * FROM mentors WHERE mentor_id = ? ORDER BY started_at ASC').all(mentorId) as MentorInfo[];
  }

  /**
   * Chia sẻ kinh nghiệm cho sư phụ khi đồ đệ nhận EXP
   */
  public shareExperienceToMentor(studentId: string, expGained: number, coinsGained: number): void {
    const mentorInfo = this.getMentorInfo(studentId);
    if (!mentorInfo) return;

    const mentor = userRepository.get(mentorInfo.mentorId);
    if (!mentor) return;

    const mentorExp = Math.round(expGained * MENTOR_EXP_SHARE);
    const mentorCoins = Math.round(coinsGained * MENTOR_COIN_SHARE);

    if (mentorExp > 0 || mentorCoins > 0) {
      db.transaction(() => {
        userRepository.update(mentorInfo.mentorId, {
          tu_vi: mentor.tu_vi + mentorExp,
          coin_ha_pham: mentor.coin_ha_pham + mentorCoins,
        });
      })();
    }
  }

  /**
   * Hủy sư đồ
   */
  public removeMentor(studentId: string): { success: boolean; message: string } {
    const existing = db.prepare('SELECT * FROM mentors WHERE student_id = ?').get(studentId) as any;
    if (!existing) return { success: false, message: 'Không tìm thấy quan hệ sư đồ!' };

    db.prepare('DELETE FROM mentors WHERE student_id = ?').run(studentId);
    return { success: true, message: '🗡️ **Đã đoạn tuyệt sư đồ!**' };
  }
}

export const newbieProtectionService = new NewbieProtectionService();
