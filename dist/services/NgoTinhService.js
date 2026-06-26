"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ngoTinhService = exports.NGO_TINH_BUFFS = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
exports.NGO_TINH_BUFFS = [
    { id: 'exp_boost', name: 'Tu Vi Quả', cost: 10, duration: 3600, effect: '+30% tu vi', emoji: '🌿' },
    { id: 'luck_boost', name: 'Cơ Duyên', cost: 15, duration: 3600, effect: '+20% tỷ lệ đột phá', emoji: '🍀' },
    { id: 'crit_boost', name: 'Sát Tâm', cost: 12, duration: 1800, effect: '+15% tỷ lệ bạo kích', emoji: '💥' },
    { id: 'drop_boost', name: 'Bảo Vật', cost: 20, duration: 3600, effect: '+50% tỷ lệ rơi đồ', emoji: '💎' },
    { id: 'forge_boost', name: 'Lô Hỏa', cost: 8, duration: 1800, effect: '+10% tỷ lệ cường hóa thành công', emoji: '🔥' },
];
class NgoTinhService {
    constructor() {
        this.initTable();
    }
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_buffs (
        user_id TEXT NOT NULL,
        buff_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, buff_id)
      );
    `);
    }
    getAvailableBuffs() {
        return exports.NGO_TINH_BUFFS;
    }
    getActiveBuffs(userId) {
        const now = Math.floor(Date.now() / 1000);
        const buffs = database_1.default.prepare('SELECT buff_id, expires_at FROM user_buffs WHERE user_id = ? AND expires_at > ?').all(userId, now);
        return buffs.map(b => ({
            buffId: b.buff_id,
            expiresAt: b.expires_at,
            remaining: b.expires_at - now
        }));
    }
    isBuffActive(userId, buffId) {
        const now = Math.floor(Date.now() / 1000);
        const buff = database_1.default.prepare('SELECT expires_at FROM user_buffs WHERE user_id = ? AND buff_id = ? AND expires_at > ?').get(userId, buffId, now);
        return !!buff;
    }
    activateBuff(userId, buffId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const buff = exports.NGO_TINH_BUFFS.find(b => b.id === buffId);
        if (!buff)
            return { success: false, message: 'Buff không tồn tại!' };
        if ((user.ngotinh || 0) < buff.cost) {
            return { success: false, message: `Không đủ Ngộ Tính! Cần: ${buff.cost}, Có: ${user.ngotinh || 0}` };
        }
        // Kiểm tra đã active chưa
        if (this.isBuffActive(userId, buffId)) {
            const active = this.getActiveBuffs(userId).find(b => b.buffId === buffId);
            const remainingMin = Math.ceil((active?.remaining || 0) / 60);
            return { success: false, message: `Buff **${buff.name}** vẫn còn hiệu lực (${remainingMin} phút)!` };
        }
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + buff.duration;
        database_1.default.prepare(`
      INSERT INTO user_buffs (user_id, buff_id, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, buff_id) DO UPDATE SET expires_at = ?
    `).run(userId, buffId, expiresAt, expiresAt);
        UserRepository_1.userRepository.update(userId, { ngotinh: (user.ngotinh || 0) - buff.cost });
        const durationMin = Math.floor(buff.duration / 60);
        return {
            success: true,
            message: `${buff.emoji} Kích hoạt buff **${buff.name}** thành công! (${buff.effect}, ${durationMin} phút)\n💡 Tiêu hao: **${buff.cost}** Ngộ Tính.`
        };
    }
}
exports.ngoTinhService = new NgoTinhService();
