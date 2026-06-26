"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretSkillService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const SECRET_SKILLS = [
    { id: 'ss_time_stop', name: 'Dừng Thời Gian', description: 'Đóng băng kẻ địch 1 lượt', effect: 'stun_1', cooldown: 8, mpCost: 50, unlockCondition: 'level', unlockValue: 50, element: 'Phong' },
    { id: 'ss_life_drain', name: 'Ấn Mạng', description: 'Hút 20% máu kẻ địch', effect: 'drain_20', cooldown: 6, mpCost: 40, unlockCondition: 'level', unlockValue: 40, element: 'Moc' },
    { id: 'ss_mirror_shield', name: 'Kính Phản', description: 'Phản xạ 100% sát thương', effect: 'reflect_100', cooldown: 10, mpCost: 60, unlockCondition: 'level', unlockValue: 60, element: 'Kim' },
    { id: 'ss_phoenix_revive', name: 'Phượng Hoả', description: 'Tự động hồi sinh 1 lần/trận', effect: 'revive', cooldown: 20, mpCost: 80, unlockCondition: 'level', unlockValue: 80, element: 'Hoa' },
    { id: 'ss_shadow_clone', name: 'Ảnh Phân Thân', description: 'Tạo bản sao gây thêm sát thương', effect: 'clone', cooldown: 8, mpCost: 50, unlockCondition: 'level', unlockValue: 50, element: 'Phong' },
    { id: 'ss_element_burst', name: 'Nguyên Tố', description: 'Sát thương nguyên tố lớn', effect: 'burst', cooldown: 10, mpCost: 60, unlockCondition: 'level', unlockValue: 70, element: 'Hoa' },
    { id: 'ss_armor_break', name: 'Phá Giáp', description: 'Bỏ qua phòng thủ kẻ địch', effect: 'armor_break', cooldown: 6, mpCost: 40, unlockCondition: 'level', unlockValue: 40, element: 'Kim' },
    { id: 'ss_speed_surge', name: 'Tốc Hành', description: 'Tăng gấp đôi tốc độ 3 lượt', effect: 'haste_3', cooldown: 8, mpCost: 50, unlockCondition: 'level', unlockValue: 50, element: 'Phong' },
    { id: 'ss_crit_strike', name: 'Bạo Kích', description: 'Chí mạng 100% trong 1 lượt', effect: 'guaranteed_crit', cooldown: 6, mpCost: 40, unlockCondition: 'level', unlockValue: 40, element: 'Kim' },
    { id: 'ss_ultimate_shield', name: 'Vô Địch', description: 'Chặn toàn bộ sát thương 1 lượt', effect: 'invincible_1', cooldown: 15, mpCost: 70, unlockCondition: 'level', unlockValue: 90, element: 'Tho' },
];
class SecretSkillService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_secret_skills (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL,
        unlocked INTEGER DEFAULT 0,
        last_used INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, skill_id)
      );
    `);
    }
    /**
     * E-04: Check if skill is unlocked
     */
    isUnlocked(userId, skillId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT * FROM user_secret_skills WHERE user_id = ? AND skill_id = ?')
            .get(userId, skillId);
        return row?.unlocked === true;
    }
    /**
     * E-04: Unlock a secret skill
     */
    unlockSkill(userId, skillId) {
        this.initTable();
        const skill = SECRET_SKILLS.find(s => s.id === skillId);
        if (!skill)
            return { success: false, message: 'Kỹ năng không tồn tại' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Người dùng không tồn tại' };
        // Check unlock condition
        if (skill.unlockCondition === 'level' && user.level < skill.unlockValue) {
            return { success: false, message: `Cần cấp ${skill.unlockValue} (hiện tại: ${user.level})` };
        }
        const existing = database_1.default.prepare('SELECT * FROM user_secret_skills WHERE user_id = ? AND skill_id = ?')
            .get(userId, skillId);
        if (existing?.unlocked === true)
            return { success: false, message: 'Kỹ năng này đã được mở khoá!' };
        database_1.default.prepare('INSERT OR REPLACE INTO user_secret_skills (user_id, skill_id, unlocked) VALUES (?, ?, 1)')
            .run(userId, skillId);
        return { success: true, message: `Đã mở khoá **${skill.name}**!` };
    }
    /**
     * E-04: Use a secret skill
     */
    useSkill(userId, skillId) {
        this.initTable();
        const skill = SECRET_SKILLS.find(s => s.id === skillId);
        if (!skill)
            return { success: false, message: 'Kỹ năng không tồn tại', effect: '' };
        if (!this.isUnlocked(userId, skillId)) {
            return { success: false, message: 'Kỹ năng chưa được mở khoá!', effect: '' };
        }
        // Check cooldown
        const row = database_1.default.prepare('SELECT * FROM user_secret_skills WHERE user_id = ? AND skill_id = ?')
            .get(userId, skillId);
        const now = Math.floor(Date.now() / 1000);
        if (row.lastUsed + skill.cooldown * 60 > now) {
            const remaining = Math.ceil((row.lastUsed + skill.cooldown * 60 - now) / 60);
            return { success: false, message: `Hồi chiêu: ${remaining} phút`, effect: '' };
        }
        // Check MP
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || (user.mp || 0) < skill.mpCost) {
            return { success: false, message: `Cần ${skill.mpCost} MP (có ${user?.mp || 0})`, effect: '' };
        }
        // Use skill
        UserRepository_1.userRepository.update(userId, { mp: (user.mp || 0) - skill.mpCost });
        database_1.default.prepare('UPDATE user_secret_skills SET last_used = ? WHERE user_id = ? AND skill_id = ?')
            .run(now, userId, skillId);
        return { success: true, message: `Đã dùng **${skill.name}**!`, effect: skill.effect };
    }
    /**
     * E-04: Get user's secret skills
     */
    getUserSkills(userId) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        return SECRET_SKILLS.map(skill => {
            const row = database_1.default.prepare('SELECT * FROM user_secret_skills WHERE user_id = ? AND skill_id = ?')
                .get(userId, skill.id);
            return {
                skill,
                unlocked: row?.unlocked === true,
                onCooldown: row ? (row.lastUsed + skill.cooldown * 60 > now) : false
            };
        });
    }
    /**
     * E-04: Get secret skills description for UI
     */
    getSecretSkillsDescription(userId) {
        const skills = this.getUserSkills(userId);
        let msg = `🔮 **Bi Truyen Ky Thuat**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const s of skills) {
            const status = s.unlocked ? (s.onCooldown ? '⏳' : '✅') : '🔒';
            const elementEmoji = { 'Hoa': '🔥', 'Thuy': '💧', 'Moc': '🌿', 'Kim': '⚔️', 'Tho': '🪨', 'Loi': '⚡', 'Phong': '🌀' };
            msg += `${status} ${elementEmoji[s.skill.element] || '❓'} **${s.skill.name}**\n`;
            msg += `   ${s.skill.description}\n`;
            msg += `   Hồi chiêu: ${s.skill.cooldown}ph | MP: ${s.skill.mpCost}\n`;
            if (!s.unlocked)
                msg += `   Mở khóa: Cấp ${s.skill.unlockValue}\n`;
            msg += `\n`;
        }
        return msg;
    }
}
exports.secretSkillService = new SecretSkillService();
