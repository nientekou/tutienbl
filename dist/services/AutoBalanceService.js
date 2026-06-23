"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoBalanceService = void 0;
const database_1 = __importDefault(require("../database/database"));
class AutoBalanceService {
    cachedStats = null;
    CACHE_TTL = 600; // 10 phút
    calculateStats() {
        const now = Math.floor(Date.now() / 1000);
        // Tính combat power cho tất cả users
        const users = database_1.default.prepare(`
      SELECT discord_id, level, hp, max_hp, mp, max_mp, atk, def, crit, crit_res, luck, speed, dodge
      FROM users WHERE level > 0
    `).all();
        if (users.length === 0) {
            return { median: 1000, p5: 1000, p10: 1000, p30: 1000, p10_bottom: 1000, totalPlayers: 0, lastUpdated: now };
        }
        // Tính combat power cho mỗi user (simplified formula)
        const powers = users.map(u => {
            return Math.round((u.hp || 100) * 0.2 +
                (u.mp || 50) * 0.1 +
                (u.atk || 15) * 3 +
                (u.def || 10) * 5 +
                (u.crit || 0.05) * 1000 +
                (u.crit_res || 0) * 1000 +
                (u.luck || 10) * 10 +
                (u.speed || 100) * 10 +
                (u.dodge || 0.05) * 1000);
        }).sort((a, b) => a - b);
        const total = powers.length;
        const percentile = (p) => powers[Math.min(Math.floor(total * p), total - 1)];
        this.cachedStats = {
            median: percentile(0.5),
            p5: percentile(0.95), // top 5% = 95th percentile
            p10: percentile(0.90), // top 10% = 90th percentile
            p30: percentile(0.30), // bottom 30%
            p10_bottom: percentile(0.10), // bottom 10%
            totalPlayers: total,
            lastUpdated: now
        };
        return this.cachedStats;
    }
    getStats() {
        const now = Math.floor(Date.now() / 1000);
        if (this.cachedStats && (now - this.cachedStats.lastUpdated) < this.CACHE_TTL) {
            return this.cachedStats;
        }
        return this.calculateStats();
    }
    /**
     * Lấy hệ số cân bằng cho PvP (debuff top, buff yếu)
     */
    getPvPMultipliers(userId) {
        const stats = this.getStats();
        if (stats.totalPlayers < 5)
            return { atkMult: 1.0, defMult: 1.0 };
        const user = database_1.default.prepare('SELECT atk, def, hp, mp, crit, crit_res, luck, speed, dodge FROM users WHERE discord_id = ?').get(userId);
        if (!user)
            return { atkMult: 1.0, defMult: 1.0 };
        const userPower = Math.round((user.hp || 100) * 0.2 + (user.mp || 50) * 0.1 +
            (user.atk || 15) * 3 + (user.def || 10) * 5 +
            (user.crit || 0.05) * 1000 + (user.crit_res || 0) * 1000 +
            (user.luck || 10) * 10 + (user.speed || 100) * 10 +
            (user.dodge || 0.05) * 1000);
        // Top 5%: -10% ATK
        if (userPower >= stats.p5)
            return { atkMult: 0.90, defMult: 1.0 };
        // Top 10%: -5% ATK
        if (userPower >= stats.p10)
            return { atkMult: 0.95, defMult: 1.0 };
        // Bottom 10%: +20% ATK, +10% DEF
        if (userPower <= stats.p10_bottom)
            return { atkMult: 1.20, defMult: 1.10 };
        // Bottom 30%: +10% ATK, +5% DEF
        if (userPower <= stats.p30)
            return { atkMult: 1.10, defMult: 1.05 };
        // Middle: no change
        return { atkMult: 1.0, defMult: 1.0 };
    }
    /**
     * Lấy hệ số scale cho PvE (boss difficulty adjusts based on player power)
     */
    getPvEScaleFactor(userId) {
        const stats = this.getStats();
        if (stats.totalPlayers < 5 || stats.median === 0)
            return 1.0;
        const user = database_1.default.prepare('SELECT atk, def, hp, mp, crit, crit_res, luck, speed, dodge FROM users WHERE discord_id = ?').get(userId);
        if (!user)
            return 1.0;
        const userPower = Math.round((user.hp || 100) * 0.2 + (user.mp || 50) * 0.1 +
            (user.atk || 15) * 3 + (user.def || 10) * 5 +
            (user.crit || 0.05) * 1000 + (user.crit_res || 0) * 1000 +
            (user.luck || 10) * 10 + (user.speed || 100) * 10 +
            (user.dodge || 0.05) * 1000);
        const ratio = userPower / stats.median;
        if (ratio > 3.0)
            return 1.3; // Boss mạnh hơn 30%
        if (ratio > 2.0)
            return 1.15; // Boss mạnh hơn 15%
        if (ratio < 0.5)
            return 0.7; // Boss yếu hơn 30%
        if (ratio < 0.8)
            return 0.85; // Boss yếu hơn 15%
        return 1.0;
    }
    /**
     * Lấy thông tin debug về auto-balance
     */
    getDebugInfo(userId) {
        const stats = this.getStats();
        const pvp = this.getPvPMultipliers(userId);
        const pve = this.getPvEScaleFactor(userId);
        return `📊 **Auto-Balance Debug**\n` +
            `Players: ${stats.totalPlayers}\n` +
            `Median Power: ${stats.median}\n` +
            `PvP: ATK x${pvp.atkMult}, DEF x${pvp.defMult}\n` +
            `PvE Scale: x${pve}`;
    }
}
exports.autoBalanceService = new AutoBalanceService();
