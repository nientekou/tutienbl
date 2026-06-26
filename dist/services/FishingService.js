"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fishingService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const FISH_LIST = [
    { id: 'fish_carp', name: 'Cá Chép', emoji: '🐟', rarity: 'common', value: 50, weight: 40, location: 'lake' },
    { id: 'fish_catfish', name: 'Cá Trê', emoji: '🐟', rarity: 'common', value: 80, weight: 30, location: 'lake' },
    { id: 'fish_salmon', name: 'Cá Hồi', emoji: '🐟', rarity: 'uncommon', value: 150, weight: 15, location: 'river' },
    { id: 'fish_lobster', name: 'Tôm Hùm', emoji: '🦞', rarity: 'uncommon', value: 200, weight: 8, location: 'ocean' },
    { id: 'fish_tuna', name: 'Cá Ngừ', emoji: '🐟', rarity: 'rare', value: 500, weight: 5, location: 'ocean' },
    { id: 'fish_whale', name: 'Cá Ông', emoji: '🐋', rarity: 'rare', value: 800, weight: 1.5, location: 'ocean' },
    { id: 'fish_turtle', name: 'Rùa Biển', emoji: '🐢', rarity: 'epic', value: 1500, weight: 0.4, location: 'ocean' },
    { id: 'fish_dragon', name: 'Cá Rồng', emoji: '🐉', rarity: 'legendary', value: 5000, weight: 0.1, location: 'deep' },
];
const FISHING_LOCATIONS = [
    { id: 'lake', name: 'Hồ Nước', description: 'Một hồ nước yên bình', fishTypes: ['common', 'uncommon'] },
    { id: 'river', name: 'Suối', description: 'Một dòng suối chảy', fishTypes: ['common', 'uncommon', 'rare'] },
    { id: 'ocean', name: 'Đại Dương', description: 'Đại dương bao la', fishTypes: ['uncommon', 'rare', 'epic'] },
    { id: 'deep', name: 'Vực Sâu', description: 'Vùng nước sâu thẳm', fishTypes: ['rare', 'epic', 'legendary'] },
];
class FishingService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS fishing_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        fish_id TEXT NOT NULL,
        rarity TEXT NOT NULL,
        value INTEGER NOT NULL,
        caught_at INTEGER NOT NULL
      );
    `);
    }
    /**
     * A-03: Fish at a location
     */
    fish(userId, locationId = 'lake') {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Người dùng không tồn tại' };
        if ((user.stamina || 0) < 10)
            return { success: false, message: 'Không đủ Thể Lực!' };
        UserRepository_1.userRepository.update(userId, { stamina: (user.stamina || 500) - 10 });
        const location = FISHING_LOCATIONS.find(l => l.id === locationId);
        if (!location)
            return { success: false, message: 'Location not found!' };
        // 15% chance of nothing
        if (Math.random() < 0.15) {
            return { success: true, message: '🎣 Nothing caught...' };
        }
        // Filter fish by location
        const availableFish = FISH_LIST.filter(f => location.fishTypes.includes(f.rarity));
        const totalWeight = availableFish.reduce((s, f) => s + f.weight, 0);
        let rand = Math.random() * totalWeight;
        let caughtFish = availableFish[0];
        for (const fish of availableFish) {
            rand -= fish.weight;
            if (rand <= 0) {
                caughtFish = fish;
                break;
            }
        }
        // Record catch
        database_1.default.prepare('INSERT INTO fishing_log (user_id, fish_id, rarity, value, caught_at) VALUES (?, ?, ?, ?, ?)')
            .run(userId, caughtFish.id, caughtFish.rarity, caughtFish.value, Math.floor(Date.now() / 1000));
        // Give reward
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + caughtFish.value });
        const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
        return {
            success: true,
            message: `🎣 Caught **${caughtFish.name}** ${caughtFish.emoji} (${rarityEmoji[caughtFish.rarity]} ${caughtFish.rarity})\n💰 +${caughtFish.value} LT`,
            fish: caughtFish
        };
    }
    /**
     * A-03: Get fishing locations
     */
    getLocations() {
        return FISHING_LOCATIONS;
    }
    /**
     * A-03: Get fishing description
     */
    getFishingDescription(userId) {
        const log = database_1.default.prepare('SELECT COUNT(*) as c FROM fishing_log WHERE user_id = ?').get(userId);
        let msg = `🎣 **Fishing**\n`;
        msg += `📊 Total caught: **${log.c}**\n\n`;
        msg += `**Locations:**\n`;
        for (const loc of FISHING_LOCATIONS) {
            msg += `• ${loc.name}: ${loc.description} (${loc.fishTypes.join(', ')})\n`;
        }
        return msg;
    }
}
exports.fishingService = new FishingService();
