"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const database_1 = __importDefault(require("../database"));
class UserRepository {
    cache = new Map();
    CACHE_TTL_MS = 60 * 1000; // 1 phút cache
    /**
     * Lấy thông tin tu sĩ theo Discord ID (tự động hồi phục Thể Lực)
     */
    get(discordId) {
        const nowMs = Date.now();
        let user = null;
        if (this.cache.has(discordId)) {
            const cached = this.cache.get(discordId);
            if (nowMs - cached.cachedAt < this.CACHE_TTL_MS) {
                user = { ...cached.data }; // Return a copy to prevent accidental mutation without calling update()
            }
            else {
                this.cache.delete(discordId);
            }
        }
        if (!user) {
            const stmt = database_1.default.prepare('SELECT * FROM users WHERE discord_id = ?');
            user = stmt.get(discordId) || null;
            if (!user)
                return null;
            this.cache.set(discordId, { data: { ...user }, cachedAt: nowMs });
        }
        // Hồi phục Thể Lực: 1 điểm mỗi 60 giây (tối đa 500)
        const now = Math.floor(Date.now() / 1000);
        const lastRecover = user.last_stamina_recover_at || user.created_at;
        if (user.stamina < 500) {
            const elapsed = now - lastRecover;
            if (elapsed >= 60) {
                const recoverAmount = Math.floor(elapsed / 60);
                const newStamina = Math.min(500, user.stamina + recoverAmount);
                const newRecoverAt = lastRecover + recoverAmount * 60;
                database_1.default.prepare('UPDATE users SET stamina = ?, last_stamina_recover_at = ?, updated_at = ? WHERE discord_id = ?')
                    .run(newStamina, newRecoverAt, now, discordId);
                user.stamina = newStamina;
                user.last_stamina_recover_at = newRecoverAt;
                user.updated_at = now;
                // Cập nhật lại cache
                if (this.cache.has(discordId)) {
                    this.cache.get(discordId).data.stamina = newStamina;
                    this.cache.get(discordId).data.last_stamina_recover_at = newRecoverAt;
                    this.cache.get(discordId).data.updated_at = now;
                }
            }
        }
        else {
            // Cập nhật lại mốc thời gian hồi phục để tránh trôi lệch
            if (lastRecover !== now && user.stamina === 500) {
                database_1.default.prepare('UPDATE users SET last_stamina_recover_at = ? WHERE discord_id = ?').run(now, discordId);
                user.last_stamina_recover_at = now;
                // Cập nhật lại cache
                if (this.cache.has(discordId)) {
                    this.cache.get(discordId).data.last_stamina_recover_at = now;
                }
            }
        }
        // Hồi phục MP: 1 điểm mỗi 30 giây (tối đa max_mp)
        if (user.mp < user.max_mp) {
            const mpElapsed = now - lastRecover;
            if (mpElapsed >= 30) {
                const mpRecoverAmount = Math.floor(mpElapsed / 30);
                const newMp = Math.min(user.max_mp, user.mp + mpRecoverAmount);
                database_1.default.prepare('UPDATE users SET mp = ?, updated_at = ? WHERE discord_id = ?')
                    .run(newMp, now, discordId);
                user.mp = newMp;
                user.updated_at = now;
                if (this.cache.has(discordId)) {
                    this.cache.get(discordId).data.mp = newMp;
                    this.cache.get(discordId).data.updated_at = now;
                }
            }
        }
        return user;
    }
    /**
     * Tạo nhân vật tu sĩ mới
     */
    create(user) {
        const now = Math.floor(Date.now() / 1000);
        const speed = user.base_speed ?? 100;
        const dodge = user.base_dodge ?? 0.05;
        const stmt = database_1.default.prepare(`
      INSERT INTO users (
        discord_id, name, title, level, tu_vi, exp_needed,
        base_hp, base_mp, base_atk, base_def, base_crit, base_crit_res, base_luck, base_speed, base_dodge, mp, max_mp,
        linh_can, coin_ha_pham, coin_trung_pham, coin_thuong_pham, knb,
        alchemy_level, alchemy_exp, forging_level, forging_exp,
        partner_id, intimacy, last_songtu_at,
        background, destiny, starting_skills,
        prophecy, heirloom, claimed_starting_bonus,
        created_at, updated_at
      ) VALUES (
        ?, ?, 'Tán Tu', 1, 0, 100,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 100,
        ?, ?, 0, 0, ?,
        1, 0, 1, 0,
        NULL, 0, 0,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);
        stmt.run(user.discord_id, user.name, user.base_hp, user.base_mp, user.base_atk, user.base_def, user.base_crit, user.base_crit_res, user.base_luck, speed, dodge, user.linh_can, user.coin_ha_pham ?? 100, user.knb ?? 0, user.background ?? '', user.destiny ?? '', user.starting_skills ?? '[]', user.prophecy ?? '', user.heirloom ?? '', user.claimed_starting_bonus ?? 0, now, now);
    }
    update(discordId, updates) {
        const keys = Object.keys(updates);
        if (keys.length === 0)
            return;
        // Tự động kiểm tra và thông báo khi tu vi đạt cực hạn
        const user = this.get(discordId);
        if (user && updates.tu_vi !== undefined && user.tu_vi < user.exp_needed && updates.tu_vi >= user.exp_needed) {
            const { notifyExpFull } = require('../../utils/constants');
            notifyExpFull(discordId).catch(() => null);
        }
        updates.updated_at = Math.floor(Date.now() / 1000);
        const updatedKeys = Object.keys(updates);
        const setClause = updatedKeys.map(k => `${k} = ?`).join(', ');
        const values = updatedKeys.map(k => updates[k]);
        values.push(discordId);
        const stmt = database_1.default.prepare(`UPDATE users SET ${setClause} WHERE discord_id = ?`);
        stmt.run(...values);
        // Invalidate cache
        this.cache.delete(discordId);
    }
    /**
     * Xóa user khỏi DB (dùng cho luân hồi hoặc reset)
     */
    delete(discordId) {
        database_1.default.prepare('DELETE FROM users WHERE discord_id = ?').run(discordId);
        this.cache.delete(discordId);
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
