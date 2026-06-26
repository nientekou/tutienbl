"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBlessingService = void 0;
// V15 B-01: Daily Blessing System
const database_1 = __importDefault(require("../database/database"));
const BLESSINGS = [
    { id: 'exp_blessing', name: 'Phúc Lộc Tu Vi', description: '+10% Tu Vi trong 4 giờ', stat: 'exp_bonus', value: 0.10, emoji: '🌟' },
    { id: 'drop_blessing', name: 'Phúc Lộc Vật Phẩm', description: '+10% drop rate trong 4 giờ', stat: 'drop_bonus', value: 0.10, emoji: '🍀' },
    { id: 'atk_blessing', name: 'Phúc Lộc Sát Thương', description: '+10% ATK trong 4 giờ', stat: 'atk_bonus', value: 0.10, emoji: '⚔️' },
    { id: 'def_blessing', name: 'Phúc Lộc Phòng Thủ', description: '+10% DEF trong 4 giờ', stat: 'def_bonus', value: 0.10, emoji: '🛡️' },
    { id: 'speed_blessing', name: 'Phúc Lộc Tốc Độ', description: '+10% Speed trong 4 giờ', stat: 'speed_bonus', value: 0.10, emoji: '💨' },
    { id: 'crit_blessing', name: 'Phúc Lộc Bạo Kích', description: '+10% Crit Rate trong 4 giờ', stat: 'crit_bonus', value: 0.10, emoji: '💥' },
];
const BLESSING_DURATION = 4 * 60 * 60; // 4 hours in seconds
class DailyBlessingService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS daily_blessings (
        user_id TEXT NOT NULL,
        blessing_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (user_id)
      );
    `);
    }
    getToday() {
        return new Date().toISOString().slice(0, 10);
    }
    canClaim(userId) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        // Check if already has active blessing
        const active = database_1.default.prepare('SELECT expires_at FROM daily_blessings WHERE user_id = ?')
            .get(userId);
        if (active && active.expires_at > now) {
            const mins = Math.ceil((active.expires_at - now) / 60);
            return { eligible: false, reason: `Đã có phúc lộc active. Hết sau ${mins} phút.` };
        }
        // Check daily cooldown
        const today = this.getToday();
        const claimed = database_1.default.prepare('SELECT 1 FROM daily_blessing_claims WHERE user_id = ? AND day = ?')
            .get(userId, today);
        if (claimed)
            return { eligible: false, reason: 'Đã nhận phúc lộc hôm nay rồi!' };
        return { eligible: true, reason: '' };
    }
    claim(userId) {
        const check = this.canClaim(userId);
        if (!check.eligible)
            return { success: false, message: `❌ ${check.reason}` };
        // Roll random blessing
        const blessing = BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + BLESSING_DURATION;
        this.initTable();
        database_1.default.prepare(`
      INSERT INTO daily_blessings (user_id, blessing_id, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET blessing_id = excluded.blessing_id, expires_at = excluded.expires_at
    `).run(userId, blessing.id, expiresAt);
        // Record daily claim
        database_1.default.prepare(`
      INSERT INTO daily_blessing_claims (user_id, day) VALUES (?, ?)
      ON CONFLICT(user_id, day) DO NOTHING
    `).run(userId, this.getToday());
        return {
            success: true,
            message: `${blessing.emoji} **${blessing.name}** — ${blessing.description}`,
            blessing,
        };
    }
    getActiveBlessing(userId) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const row = database_1.default.prepare('SELECT blessing_id, expires_at FROM daily_blessings WHERE user_id = ?')
            .get(userId);
        if (!row || row.expires_at <= now)
            return null;
        return BLESSINGS.find(b => b.id === row.blessing_id) || null;
    }
    getBlessingDescription(userId) {
        const active = this.getActiveBlessing(userId);
        if (!active)
            return '📭 Chưa có phúc lộc nào. Dùng `/phucloc` để nhận!';
        const now = Math.floor(Date.now() / 1000);
        const row = database_1.default.prepare('SELECT expires_at FROM daily_blessings WHERE user_id = ?').get(userId);
        const mins = row ? Math.ceil((row.expires_at - now) / 60) : 0;
        return `${active.emoji} **${active.name}** — ${active.description}\n⏰ Còn lại: ~${mins} phút`;
    }
}
exports.dailyBlessingService = new DailyBlessingService();
