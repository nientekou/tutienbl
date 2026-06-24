"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.battlePassService = void 0;
const database_1 = __importDefault(require("../database/database"));
const battlePassConstants_1 = require("../config/battlePassConstants");
class BattlePassService {
    addExp(userId, source, amount) {
        const expGain = amount ?? battlePassConstants_1.BP_EXP_SOURCES[source];
        const profile = this.getOrCreateProfile(userId);
        const newExp = (profile.exp || 0) + expGain;
        const tierUps = Math.floor(newExp / battlePassConstants_1.BP_EXP_PER_TIER);
        const remainExp = newExp % battlePassConstants_1.BP_EXP_PER_TIER;
        if (tierUps > 0) {
            const newTier = Math.min(battlePassConstants_1.BP_MAX_TIER, (profile.tier || 1) + tierUps);
            database_1.default.prepare('UPDATE user_battle_pass SET tier = ?, exp = ? WHERE id = ?')
                .run(newTier, remainExp, profile.id);
            return { tierUp: true, newTier };
        }
        database_1.default.prepare('UPDATE user_battle_pass SET exp = ? WHERE id = ?')
            .run(newExp, profile.id);
        return { tierUp: false, newTier: profile.tier || 1 };
    }
    getOrCreateProfile(userId) {
        const currentSeason = this.getCurrentSeason();
        let profile = database_1.default.prepare('SELECT * FROM user_battle_pass WHERE user_id = ? AND season_number = ?')
            .get(userId, currentSeason);
        if (!profile) {
            database_1.default.prepare('INSERT INTO user_battle_pass (user_id, season_number, tier, exp) VALUES (?, ?, 1, 0)')
                .run(userId, currentSeason);
            profile = database_1.default.prepare('SELECT * FROM user_battle_pass WHERE user_id = ? AND season_number = ?')
                .get(userId, currentSeason);
        }
        return profile;
    }
    claimReward(userId, tier) {
        const profile = this.getOrCreateProfile(userId);
        if ((profile.tier || 1) < tier)
            return false;
        const claimed = JSON.parse(profile.claimed_rewards || '[]');
        if (claimed.includes(tier))
            return false;
        const reward = battlePassConstants_1.BP_REWARDS.find(r => r.tier === tier);
        if (!reward)
            return false;
        for (const r of reward.free)
            this.applyReward(userId, r);
        if (profile.premium_purchased) {
            for (const r of reward.premium)
                this.applyReward(userId, r);
        }
        claimed.push(tier);
        database_1.default.prepare('UPDATE user_battle_pass SET claimed_rewards = ? WHERE id = ?')
            .run(JSON.stringify(claimed), profile.id);
        return true;
    }
    applyReward(userId, reward) {
        switch (reward.type) {
            case 'ngotinh':
                database_1.default.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?').run(reward.amount, userId);
                break;
            case 'coins':
                database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?').run(reward.amount, userId);
                break;
            case 'item':
                if (reward.id) {
                    database_1.default.prepare('INSERT INTO inventories (user_id, item_id, quantity) VALUES (?, ?, ?)')
                        .run(userId, reward.id, reward.amount);
                }
                break;
        }
    }
    getCurrentSeason() {
        const row = database_1.default.prepare('SELECT MAX(season_number) as num FROM battle_pass').get();
        return row?.num ?? 1;
    }
    getLeaderboard(limit = 10) {
        return database_1.default.prepare(`
      SELECT ubp.*, u.name as ten_nhan_vat
      FROM user_battle_pass ubp
      JOIN users u ON ubp.user_id = u.discord_id
      WHERE ubp.season_number = ?
      ORDER BY ubp.tier DESC, ubp.exp DESC
      LIMIT ?
    `).all(this.getCurrentSeason(), limit);
    }
}
exports.battlePassService = new BattlePassService();
