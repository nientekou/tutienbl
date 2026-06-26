"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mentorshipService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const AchievementService_1 = require("./AchievementService");
class MentorshipService {
    /**
     * Lấy mối quan hệ sư đồ đang hoạt động của đệ tử
     */
    getActiveMentorshipForApprentice(apprenticeId) {
        return database_1.default.prepare("SELECT * FROM mentorships WHERE apprentice_id = ? AND status = 'active'").get(apprenticeId);
    }
    /**
     * Lấy danh sách đệ tử đang hoạt động của sư phụ
     */
    getActiveApprentices(mentorId) {
        return database_1.default.prepare("SELECT * FROM mentorships WHERE mentor_id = ? AND status = 'active'").all(mentorId);
    }
    /**
     * Lấy danh sách đệ tử đã tốt nghiệp của sư phụ
     */
    getGraduatedApprentices(mentorId) {
        return database_1.default.prepare("SELECT * FROM mentorships WHERE mentor_id = ? AND status = 'graduated'").all(mentorId);
    }
    /**
     * Gửi lời mời nhận đệ tử / bái sư
     */
    canBecomeMentorAndApprentice(mentorId, apprenticeId) {
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        if (!mentor)
            return { success: false, message: 'Sư phụ chưa tạo nhân vật!' };
        if (!apprentice)
            return { success: false, message: 'Đệ tử chưa tạo nhân vật!' };
        if (mentorId === apprenticeId) {
            return { success: false, message: 'Đạo hữu không thể tự bái chính mình làm sư phụ!' };
        }
        if (mentor.level < 50) {
            return { success: false, message: 'Yêu cầu sư phụ phải đạt cấp độ 50 trở lên mới có thể thu nhận đệ tử!' };
        }
        if (apprentice.level > 30) {
            return { success: false, message: 'Chỉ có thể thu nhận tu sĩ cấp 1 đến 30 làm đệ tử!' };
        }
        // Kiểm tra đệ tử đã có sư phụ chưa
        const activeApp = this.getActiveMentorshipForApprentice(apprenticeId);
        if (activeApp) {
            return { success: false, message: 'Đệ tử này hiện đã bái sư phụ khác rồi!' };
        }
        // Kiểm tra số lượng đệ tử hiện tại của sư phụ (tối đa 3)
        const activeList = this.getActiveApprentices(mentorId);
        if (activeList.length >= 3) {
            return { success: false, message: 'Sư phụ hiện đã thu nhận đủ 3 đệ tử, không thể nhận thêm!' };
        }
        // Kiểm tra xem sư phụ có đang bị cooldown hủy sư đồ không
        let yCanh = {};
        try {
            yCanh = JSON.parse(mentor.y_canh || '{}');
        }
        catch (e) {
            console.warn('[MentorshipService] Failed to parse mentor y_canh for cooldown check:', e);
        }
        const now = Math.floor(Date.now() / 1000);
        if (yCanh.mentor_cooldown_until && yCanh.mentor_cooldown_until > now) {
            const remainSec = yCanh.mentor_cooldown_until - now;
            const hours = Math.ceil(remainSec / 3600);
            return { success: false, message: `Sư phụ đang chịu phạt do trục xuất đệ tử cũ. Vui lòng đợi ${hours} giờ nữa!` };
        }
        return { success: true, message: 'Đủ điều kiện bái sư.' };
    }
    /**
     * Tạo quan hệ Sư đồ
     */
    createMentorship(mentorId, apprenticeId) {
        const check = this.canBecomeMentorAndApprentice(mentorId, apprenticeId);
        if (!check.success)
            return check;
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO mentorships (mentor_id, apprentice_id, started_at, status)
      VALUES (?, ?, ?, 'active')
    `).run(mentorId, apprenticeId, now);
        return { success: true, message: 'Bái sư thành công! Hai đạo hữu đã chính thức kết thành Sư Đồ.' };
    }
    /**
     * Hủy bỏ quan hệ sư đồ
     */
    breakMentorship(initiatorId, targetId) {
        // Tìm mentorship đang hoạt động giữa hai người
        const row = database_1.default.prepare(`
      SELECT * FROM mentorships 
      WHERE ((mentor_id = ? AND apprentice_id = ?) 
         OR (mentor_id = ? AND apprentice_id = ?))
      AND status = 'active'
    `).get(initiatorId, targetId, targetId, initiatorId);
        if (!row) {
            return { success: false, message: 'Không tìm thấy quan hệ sư đồ đang hoạt động giữa hai người!' };
        }
        const mentorId = row.mentor_id;
        const apprenticeId = row.apprentice_id;
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        const now = Math.floor(Date.now() / 1000);
        const otherUserId = initiatorId === mentorId ? apprenticeId : mentorId;
        const otherUser = UserRepository_1.userRepository.get(otherUserId);
        // Kiểm tra offline >= 7 ngày để bypass penalty
        const isOtherOfflineLong = (now - otherUser.updated_at) >= 7 * 24 * 3600;
        database_1.default.transaction(() => {
            // Cập nhật status sang cancelled
            database_1.default.prepare("UPDATE mentorships SET status = 'cancelled' WHERE id = ?").run(row.id);
            if (!isOtherOfflineLong) {
                if (initiatorId === mentorId) {
                    // Sư phụ chủ động trục xuất đệ tử -> phạt cấm nhận đệ tử mới 48h
                    let yCanh = {};
                    try {
                        yCanh = JSON.parse(mentor.y_canh || '{}');
                    }
                    catch (e) {
                        console.warn('[MentorshipService] Failed to parse mentor y_canh for expulsion penalty:', e);
                    }
                    yCanh.mentor_cooldown_until = now + 48 * 3600;
                    UserRepository_1.userRepository.update(mentorId, { y_canh: JSON.stringify(yCanh) });
                }
                else {
                    // Đệ tử phản môn -> phạt trừ 10% tu vi
                    const newTuVi = Math.max(0, Math.floor(apprentice.tu_vi * 0.9));
                    UserRepository_1.userRepository.update(apprenticeId, { tu_vi: newTuVi });
                }
            }
        })();
        let penaltyMsg = '';
        if (!isOtherOfflineLong) {
            if (initiatorId === mentorId) {
                penaltyMsg = '\n⚠️ **Hình phạt:** Sư phụ tự ý trục xuất đệ tử sẽ bị cấm nhận đệ tử mới trong 48 giờ.';
            }
            else {
                penaltyMsg = '\n⚠️ **Hình phạt:** Đệ tử tự ý phản môn sẽ bị tổn hao 10% tu vi hiện tại.';
            }
        }
        else {
            penaltyMsg = '\nℹ️ *Do đối phương đã quy ẩn (offline > 7 ngày), thiên đạo miễn trừ mọi hình phạt.*';
        }
        return {
            success: true,
            message: `Đã hủy bỏ quan hệ sư đồ giữa **${mentor.name}** và **${apprentice.name}**!${penaltyMsg}`
        };
    }
    /**
     * Xử lý phần thưởng khi đệ tử làm việc (mining/gathering/patrolling)
     */
    handleApprenticeWork(apprenticeId, coinsGained) {
        const row = this.getActiveMentorshipForApprentice(apprenticeId);
        if (!row)
            return { mentorGainedCoins: 0, apprenticeBonusExp: 0, mentorGainedExp: 0 };
        const mentorId = row.mentor_id;
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        if (!mentor || !apprentice)
            return { mentorGainedCoins: 0, apprenticeBonusExp: 0, mentorGainedExp: 0 };
        // Đệ tử nhận được 20 EXP cơ bản khi làm việc, cộng thêm 5% bonus sư đồ
        const baseWorkExp = 20;
        let apprenticeExpBuff = 1.0;
        try {
            const { heartLawService } = require('./HeartLawService');
            const activePassives = heartLawService.getActivePassives(apprenticeId);
            const expBoostHL = activePassives.find((hl) => hl.type === 'exp_boost');
            if (expBoostHL)
                apprenticeExpBuff += expBoostHL.value;
        }
        catch (e) {
            console.warn('[MentorshipService] Failed to get apprentice heart law exp boost:', e);
        }
        let mentorExpBuff = 1.0;
        try {
            const { heartLawService } = require('./HeartLawService');
            const activePassives = heartLawService.getActivePassives(mentorId);
            const expBoostHL = activePassives.find((hl) => hl.type === 'exp_boost');
            if (expBoostHL)
                mentorExpBuff += expBoostHL.value;
        }
        catch (e) {
            console.warn('[MentorshipService] Failed to get mentor heart law exp boost:', e);
        }
        const apprenticeBonusExp = Math.round(baseWorkExp * 1.05 * apprenticeExpBuff); // +5% EXP
        const mentorGainedExp = Math.round(baseWorkExp * 0.10 * mentorExpBuff); // 10% EXP
        const mentorGainedCoins = Math.round(coinsGained * 0.05); // 5% LT
        database_1.default.transaction(() => {
            // Trao tu vi cho đệ tử
            const newAppExp = Math.min(apprentice.tu_vi + apprenticeBonusExp, apprentice.exp_needed);
            UserRepository_1.userRepository.update(apprenticeId, { tu_vi: newAppExp });
            // Trao tu vi và linh thạch cho sư phụ
            const newMentorExp = Math.min(mentor.tu_vi + mentorGainedExp, mentor.exp_needed);
            UserRepository_1.userRepository.update(mentorId, {
                tu_vi: newMentorExp,
                coin_ha_pham: mentor.coin_ha_pham + mentorGainedCoins
            });
        })();
        return { mentorGainedCoins, apprenticeBonusExp, mentorGainedExp };
    }
    /**
     * Xử lý khi đệ tử tăng cấp (kiểm tra tốt nghiệp hoặc milestone)
     */
    handleApprenticeLevelUp(apprenticeId, oldLevel, newLevel) {
        const row = this.getActiveMentorshipForApprentice(apprenticeId);
        if (!row)
            return [];
        const mentorId = row.mentor_id;
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        if (!mentor || !apprentice)
            return [];
        const notifications = [];
        const now = Math.floor(Date.now() / 1000);
        // Mốc cấp 20
        if (oldLevel < 20 && newLevel >= 20) {
            database_1.default.transaction(() => {
                UserRepository_1.userRepository.update(mentorId, { knb: mentor.knb + 1 });
                UserRepository_1.userRepository.update(apprenticeId, { knb: apprentice.knb + 1 });
                const { inventoryRepository } = require('../database/repositories/InventoryRepository');
                inventoryRepository.addItem(apprenticeId, 'pill_alchemy_tuvi', 1);
            })();
            notifications.push(`🎉 Đệ tử **${apprentice.name}** đạt **Cấp 20**! Sư phụ và đệ tử cùng nhận **+1 KNB**, đệ tử nhận thêm **1x Luyện Khí Đan**.`);
        }
        // Mốc cấp 35
        if (oldLevel < 35 && newLevel >= 35) {
            database_1.default.transaction(() => {
                UserRepository_1.userRepository.update(mentorId, { knb: mentor.knb + 3 });
                UserRepository_1.userRepository.update(apprenticeId, { knb: apprentice.knb + 3 });
                const { inventoryRepository } = require('../database/repositories/InventoryRepository');
                inventoryRepository.addItem(apprenticeId, 'pill_alchemy_tuvi', 2);
            })();
            notifications.push(`🎉 Đệ tử **${apprentice.name}** đạt **Cấp 35**! Sư phụ và đệ tử cùng nhận **+3 KNB**, đệ tử nhận thêm **2x Luyện Khí Đan**.`);
        }
        // Mốc cấp 50 (Tốt Nghiệp)
        if (oldLevel < 50 && newLevel >= 50) {
            database_1.default.transaction(() => {
                // Tốt nghiệp
                database_1.default.prepare("UPDATE mentorships SET status = 'graduated', graduated_at = ? WHERE id = ?").run(now, row.id);
                // Thưởng lớn
                UserRepository_1.userRepository.update(mentorId, { knb: mentor.knb + 10 });
                UserRepository_1.userRepository.update(apprenticeId, { knb: apprentice.knb + 5 });
                // Trao danh hiệu
                database_1.default.prepare("INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, 'Cao Nhân', 'mentorship', ?)").run(mentorId, now);
                database_1.default.prepare("INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, 'Môn Đồ', 'mentorship', ?)").run(apprenticeId, now);
                if (mentor.title === 'Tán Tu' || !mentor.title) {
                    UserRepository_1.userRepository.update(mentorId, { title: 'Cao Nhân' });
                }
                if (apprentice.title === 'Tán Tu' || !apprentice.title) {
                    UserRepository_1.userRepository.update(apprenticeId, { title: 'Môn Đồ' });
                }
            })();
            notifications.push(`🎓 **TỐT NGHIỆP SƯ ĐỒ:** Đệ tử **${apprentice.name}** xuất sắc đạt **Cấp 50** và tốt nghiệp!\n` +
                `• Sư phụ **${mentor.name}** nhận **+10 KNB** & danh hiệu **Cao Nhân**.\n` +
                `• Đệ tử nhận **+5 KNB** & danh hiệu **Môn Đồ**.`);
            // Kiểm tra danh hiệu "Truyền Thừa Danh Môn" (>= 3 đệ tử tốt nghiệp)
            const graduatedCount = database_1.default.prepare("SELECT COUNT(*) as c FROM mentorships WHERE mentor_id = ? AND status = 'graduated'").get(mentorId);
            AchievementService_1.achievementService.setProgress(mentorId, 'sh_19', graduatedCount.c);
            if (graduatedCount.c >= 3) {
                const freshMentor = UserRepository_1.userRepository.get(mentorId);
                if (freshMentor) {
                    database_1.default.prepare("INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, 'Truyền Thừa Danh Môn', 'mentorship_legendary', ?)").run(mentorId, now);
                    // Tự động gán nếu danh hiệu hiện tại thấp hơn
                    if (!freshMentor.title || freshMentor.title === 'Tán Tu' || freshMentor.title === 'Cao Nhân') {
                        UserRepository_1.userRepository.update(mentorId, { title: 'Truyền Thừa Danh Môn' });
                    }
                    notifications.push(`🏆 **TRUYỀN THỪA DANH MÔN:** Sư phụ **${mentor.name}** đã đào tạo thành công **${graduatedCount.c}** đệ tử tốt nghiệp! Nhận danh hiệu huyền thoại **Truyền Thừa Danh Môn** (+5% DEF)!`);
                }
            }
        }
        return notifications;
    }
    /**
     * Tính toán EXP bonus dựa trên số lượng đệ tử tốt nghiệp của sư phụ (mỗi người tốt nghiệp +1%, tối đa +5%)
     */
    getMentorExpBonusPercent(mentorId) {
        const graduatedList = this.getGraduatedApprentices(mentorId);
        return Math.min(5, graduatedList.length); // max +5%
    }
    /**
     * Truyền thụ tu vi từ Sư phụ sang Đệ tử
     */
    transmitCultivation(mentorId, apprenticeId, amount) {
        const activeApp = this.getActiveMentorshipForApprentice(apprenticeId);
        if (!activeApp || activeApp.mentor_id !== mentorId || activeApp.status !== 'active') {
            return { success: false, message: 'Đạo hữu và tu sĩ này không có quan hệ Sư Đồ đang hoạt động!' };
        }
        if (amount < 100 || amount > 2000) {
            return { success: false, message: 'Mỗi lần truyền thụ tu vi phải nằm trong khoảng **100** đến **2000** EXP!' };
        }
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        if (!mentor || !apprentice) {
            return { success: false, message: 'Thông tin nhân vật không hợp lệ!' };
        }
        if (mentor.tu_vi < amount) {
            return { success: false, message: `Tu vi hiện tại của sư phụ (**${mentor.tu_vi}**) không đủ để truyền thụ **${amount}** EXP!` };
        }
        if (mentor.coin_ha_pham < 1000) {
            return { success: false, message: 'Truyền thụ tu vi tiêu hao **1,000 Linh Thạch** để hộ pháp đại trận, sư phụ không đủ Linh Thạch!' };
        }
        const { getRealmDetails } = require('../utils/constants');
        const { minorLevel } = getRealmDetails(apprentice.level);
        if (minorLevel === 38 && apprentice.tu_vi >= apprentice.exp_needed) {
            return { success: false, message: 'Đệ tử đã đạt cực hạn cảnh giới lớn hiện tại. Cần đột phá trước khi nhận thêm tu vi!' };
        }
        const { getYearWeekString } = require('../commands/general/shop');
        const currentWeek = getYearWeekString();
        let yCanh = {};
        try {
            yCanh = JSON.parse(mentor.y_canh || '{}');
        }
        catch (e) {
            console.warn('[MentorshipService] Failed to parse mentor y_canh for transmission:', e);
        }
        let transRecord = yCanh.mentorship_transmission || { week: '', amount: 0 };
        if (transRecord.week !== currentWeek) {
            transRecord = { week: currentWeek, amount: 0 };
        }
        const remainingLimit = 2000 - transRecord.amount;
        if (amount > remainingLimit) {
            return {
                success: false,
                message: `Sư phụ đã truyền thụ **${transRecord.amount}/2000** tu vi tuần này. Chỉ còn có thể truyền thụ tối đa **${remainingLimit}** tu vi!`
            };
        }
        const updatedTransferred = transRecord.amount + amount;
        yCanh.mentorship_transmission = { week: currentWeek, amount: updatedTransferred };
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(mentorId, {
                tu_vi: mentor.tu_vi - amount,
                coin_ha_pham: mentor.coin_ha_pham - 1000,
                y_canh: JSON.stringify(yCanh)
            });
            const newAppTuVi = Math.min(apprentice.tu_vi + amount, apprentice.exp_needed);
            UserRepository_1.userRepository.update(apprenticeId, {
                tu_vi: newAppTuVi
            });
        })();
        return {
            success: true,
            message: `✨ **Truyền Thụ Thành Công!**\n` +
                `• Sư phụ hao tổn **-${amount} Tu Vi** và **-1,000 Linh Thạch** để hộ pháp đại trận.\n` +
                `• Đệ tử **${apprentice.name}** nhận được **+${amount} Tu Vi**!\n` +
                `• Sư phụ đã truyền thụ **${updatedTransferred}/2000** tu vi tuần này.`
        };
    }
    // === P4-02: Mentor Ranking & Titles ===
    /**
     * P4-02: Lấy ranking các sư phụ dựa trên số đệ tử đã tốt nghiệp + cấp độ đệ tử
     */
    getMentorRanking(limit = 10) {
        const rows = database_1.default.prepare(`
      SELECT
        m.mentor_id,
        u.name,
        COUNT(*) as graduated_count,
        COALESCE(SUM(u2.level), 0) as total_level
      FROM mentorships m
      JOIN users u ON m.mentor_id = u.discord_id
      LEFT JOIN users u2 ON m.apprentice_id = u2.discord_id
      WHERE m.status = 'graduated'
      GROUP BY m.mentor_id
      ORDER BY graduated_count DESC, total_level DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            mentorId: r.mentor_id,
            name: r.name,
            graduatedCount: r.graduated_count,
            totalApprenticeLevel: r.total_level,
            title: this.getMentorTitle(r.graduated_count)
        }));
    }
    /**
     * P4-02: Lấy danh hiệu sư phụ dựa trên số đệ tử tốt nghiệp
     */
    getMentorTitle(graduatedCount) {
        if (graduatedCount >= 25)
            return 'Thánh Sư';
        if (graduatedCount >= 10)
            return 'Tông Sư';
        if (graduatedCount >= 5)
            return 'Đại Đạo Sư';
        if (graduatedCount >= 1)
            return 'Đạo Sư';
        return '';
    }
    /**
     * P4-02: Lấy thống kê sư phạm của 1 sư phụ
     */
    getMentorStats(mentorId) {
        const active = this.getActiveApprentices(mentorId);
        const graduated = this.getGraduatedApprentices(mentorId);
        let totalLevel = 0;
        for (const g of graduated) {
            const user = database_1.default.prepare('SELECT level FROM users WHERE discord_id = ?').get(g.apprentice_id);
            if (user)
                totalLevel += user.level;
        }
        return {
            activeCount: active.length,
            graduatedCount: graduated.length,
            totalGraduatedLevel: totalLevel,
            title: this.getMentorTitle(graduated.length)
        };
    }
    // === B-04: Mentor V2 — Missions & Graduation ===
    missionInit = false;
    initMissions() {
        if (this.missionInit)
            return;
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS mentor_missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mentor_id TEXT NOT NULL,
        apprentice_id TEXT NOT NULL,
        mission_type TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        target INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);
        this.missionInit = true;
    }
    /**
     * B-04: Get daily mentor missions
     */
    getMentorMissions(mentorId) {
        this.initMissions();
        const today = this.getTodayString();
        const apprentices = this.getActiveApprentices(mentorId);
        if (apprentices.length === 0)
            return [];
        // Simple daily missions based on apprentice activities
        const missions = [
            { id: 'mission_help_dungeon', name: 'Giúp Đệ Tử Bí Cảnh', description: 'Giúp đệ tử vượt qua Bí Cảnh', target: 3 },
            { id: 'mission_teach_meditate', name: 'Dạy Thiền Định', description: 'Hướng dẫn đệ tử thiền định', target: 5 },
            { id: 'mission_share_wisdom', name: 'Chia Sẻ Trí Tuệ', description: 'Chia sẻ chiến đấu kinh nghiệm', target: 2 },
        ];
        // Check progress from today
        return missions.map(m => {
            const progress = database_1.default.prepare("SELECT COALESCE(SUM(progress), 0) as p FROM mentor_missions WHERE mentor_id = ? AND mission_type = ? AND created_at >= ?").get(mentorId, m.id, today);
            return {
                ...m,
                progress: progress.p
            };
        });
    }
    /**
     * B-04: Update mentor mission progress
     */
    updateMissionProgress(mentorId, missionType, amount = 1) {
        this.initMissions();
        const today = this.getTodayString();
        const existing = database_1.default.prepare("SELECT id FROM mentor_missions WHERE mentor_id = ? AND mission_type = ? AND created_at >= ?").get(mentorId, missionType, today);
        if (existing) {
            database_1.default.prepare('UPDATE mentor_missions SET progress = progress + ? WHERE id = ?')
                .run(amount, existing.id);
        }
        else {
            const targets = {
                mission_help_dungeon: 3,
                mission_teach_meditate: 5,
                mission_share_wisdom: 2,
            };
            database_1.default.prepare('INSERT INTO mentor_missions (mentor_id, apprentice_id, mission_type, progress, target, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(mentorId, '', missionType, amount, targets[missionType] || 5, Math.floor(Date.now() / 1000));
        }
    }
    /**
     * B-04: Graduate ceremony — formal graduation with rewards
     */
    graduateCeremony(mentorId, apprenticeId) {
        const mentorship = database_1.default.prepare("SELECT * FROM mentorships WHERE mentor_id = ? AND apprentice_id = ? AND status = 'active'").get(mentorId, apprenticeId);
        if (!mentorship)
            return { success: false, message: '❌ Không có mối quan hệ sư đồ active!' };
        // Update status
        database_1.default.prepare("UPDATE mentorships SET status = 'graduated', graduated_at = ? WHERE id = ?")
            .run(Math.floor(Date.now() / 1000), mentorship.id);
        // Award rewards
        const mentor = UserRepository_1.userRepository.get(mentorId);
        const apprentice = UserRepository_1.userRepository.get(apprenticeId);
        if (mentor) {
            UserRepository_1.userRepository.update(mentorId, {
                knb: mentor.knb + 10,
                coin_ha_pham: mentor.coin_ha_pham + 5000
            });
        }
        if (apprentice) {
            UserRepository_1.userRepository.update(apprenticeId, {
                knb: apprentice.knb + 5,
                coin_ha_pham: apprentice.coin_ha_pham + 2000
            });
        }
        // Title for mentor
        database_1.default.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
            .run(mentorId, 'Đạo Sư', 'mentorship', Math.floor(Date.now() / 1000));
        return {
            success: true,
            message: `🎓 **Lễ Tốt Nghiệp** hoàn thành!\n` +
                `👨‍🏫 Sư phụ **${mentor?.name}** nhận +10 KNB + 5000 LT\n` +
                `🧑‍🎓 Đệ tử **${apprentice?.name}** nhận +5 KNB + 2000 LT`
        };
    }
    getTodayString() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        return vn.toISOString().slice(0, 10);
    }
}
exports.mentorshipService = new MentorshipService();
