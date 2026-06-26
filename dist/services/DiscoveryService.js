"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoveryService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const HIDDEN_LOCATIONS = [
    { id: 'hl_1', name: 'Phế Tích Cổ Đại', description: 'Tàn tích của một nền văn minh thượng cổ', minLevel: 20, reward: 'Cổ Vật', discovered: false },
    { id: 'hl_2', name: 'Hang Pha Lê', description: 'Hang động chứa đầy pha lê quý hiếm', minLevel: 40, reward: 'Mảnh Pha Lê', discovered: false },
    { id: 'hl_3', name: 'Long Sào', description: 'Hang ổ của một con cổ long', minLevel: 60, reward: 'Trứng Rồng', discovered: false },
    { id: 'hl_4', name: 'Suối Linh Khí', description: 'Dòng suối với khả năng chữa thương', minLevel: 30, reward: 'Nước Linh Khí', discovered: false },
    { id: 'hl_5', name: 'Thư Các Cấm Kỵ', description: 'Thư viện chứa tri thức cấm kỵ', minLevel: 50, reward: 'Bí Tịch Cấm Kỵ', discovered: false },
];
const HIDDEN_NPCS = [
    { id: 'hn_1', name: 'Lão Giả Thần Bí', description: 'Một lão già với trí tuệ thượng cổ', quest: 'Chuyển tin nhắn', reward: '500 Tu Vi' },
    { id: 'hn_2', name: 'Lữ Khách Lạc Đường', description: 'Một lữ khách đang tìm đường về', quest: 'Tìm đường về nhà', reward: '1000 Linh Thạch' },
    { id: 'hn_3', name: 'Thương Nhân U Linh', description: 'Một thương nhân từ thế giới bên kia', quest: 'Trao đổi vật phẩm quý hiếm', reward: 'Vật Phẩm Hiếm' },
];
const HIDDEN_ITEMS = [
    { id: 'hi_1', name: 'Đồng Cổ', description: 'Một đồng xu từ thời thượng cổ', effect: '+10% EXP trong 1h' },
    { id: 'hi_2', name: 'Linh Thạch Nguyên Khí', description: 'Một viên đá thấm đẫm linh khí', effect: '+5% toàn thuộc tính trong 30p' },
    { id: 'hi_3', name: 'Bùa May Mắn', description: 'Tăng may mắn tạm thời', effect: '+10 May Mắn trong 1h' },
];
class DiscoveryService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS user_discoveries (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        discovery_type TEXT NOT NULL,
        discovery_id TEXT NOT NULL,
        discovered_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, discovery_type, discovery_id)
      );
    `);
    }
    /**
     * A-07: Get hidden locations
     */
    getHiddenLocations(userId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        const userLevel = user?.level || 1;
        const discovered = database_1.default.prepare('SELECT discovery_id FROM user_discoveries WHERE user_id = ? AND discovery_type = ?')
            .all(userId, 'location');
        const discoveredSet = new Set(discovered.map(d => d.discovery_id));
        return HIDDEN_LOCATIONS.map(loc => ({
            ...loc,
            discovered: discoveredSet.has(loc.id),
            reward: discoveredSet.has(loc.id) ? loc.reward : '???'
        })).filter(loc => userLevel >= loc.minLevel || loc.discovered);
    }
    /**
     * A-07: Discover a location
     */
    discoverLocation(userId, locationId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Người dùng không tồn tại' };
        const location = HIDDEN_LOCATIONS.find(l => l.id === locationId);
        if (!location)
            return { success: false, message: 'Địa điểm không tồn tại' };
        if (user.level < location.minLevel) {
            return { success: false, message: `Cần cấp ${location.minLevel} (hiện tại: ${user.level})` };
        }
        const existing = database_1.default.prepare('SELECT * FROM user_discoveries WHERE user_id = ? AND discovery_type = ? AND discovery_id = ?')
            .get(userId, 'location', locationId);
        if (existing)
            return { success: false, message: 'Đã khám phá trước đó!' };
        database_1.default.prepare('INSERT INTO user_discoveries (user_id, discovery_type, discovery_id, discovered_at) VALUES (?, ?, ?, ?)')
            .run(userId, 'location', locationId, Math.floor(Date.now() / 1000));
        return { success: true, message: `🗺️ Đã khám phá **${location.name}**! Phần thưởng: ${location.reward}` };
    }
    /**
     * A-07: Get hidden NPCs
     */
    getHiddenNPCs() {
        return HIDDEN_NPCS;
    }
    /**
     * A-07: Get hidden items
     */
    getHiddenItems() {
        return HIDDEN_ITEMS;
    }
    /**
     * A-07: Get discovery stats
     */
    getDiscoveryStats(userId) {
        this.initTable();
        const locations = database_1.default.prepare('SELECT COUNT(*) as c FROM user_discoveries WHERE user_id = ? AND discovery_type = ?').get(userId, 'location');
        const npcs = database_1.default.prepare('SELECT COUNT(*) as c FROM user_discoveries WHERE user_id = ? AND discovery_type = ?').get(userId, 'npc');
        const items = database_1.default.prepare('SELECT COUNT(*) as c FROM user_discoveries WHERE user_id = ? AND discovery_type = ?').get(userId, 'item');
        return { locations: locations.c, npcs: npcs.c, items: items.c };
    }
    /**
     * A-07: Get discovery description for UI
     */
    getDiscoveryDescription(userId) {
        const stats = this.getDiscoveryStats(userId);
        const locations = this.getHiddenLocations(userId);
        let msg = `🗺️ **Hệ Thống Khám Phá**\n`;
        msg += `📍 Địa điểm đã phát hiện: **${stats.locations}/${HIDDEN_LOCATIONS.length}**\n`;
        msg += `👤 NPC đã gặp: **${stats.npcs}/${HIDDEN_NPCS.length}**\n`;
        msg += `🎁 Vật phẩm đã tìm: **${stats.items}/${HIDDEN_ITEMS.length}**\n\n`;
        msg += `**Địa Điểm Ẩn:**\n`;
        for (const loc of locations) {
            msg += `${loc.discovered ? '✅' : '❓'} **${loc.name}** (Cấp ${loc.minLevel})\n`;
        }
        return msg;
    }
}
exports.discoveryService = new DiscoveryService();
