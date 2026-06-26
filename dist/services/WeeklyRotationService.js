"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyRotationService = void 0;
const database_1 = __importDefault(require("../database/database"));
const WEEKLY_DUNGEONS = [
    { id: 'wdungeon_fire', name: 'Hỏa Diệm Cốc', element: 'Hoa', reward: 'Tài Liệu Hỏa x2' },
    { id: 'wdungeon_water', name: 'Thủy Long Cung', element: 'Thuy', reward: 'Tài Liệu Thủy x2' },
    { id: 'wdungeon_earth', name: 'Thổ Hoàng Thành', element: 'Tho', reward: 'Tài Liệu Thổ x2' },
    { id: 'wdungeon_wind', name: 'Phong Linh Động', element: 'Phong', reward: 'Tài Liệu Phong x2' },
    { id: 'wdungeon_lightning', name: 'Lôi Kiếp Tháp', element: 'Loi', reward: 'Tài Liệu Lôi x2' },
];
const WEEKLY_BOSSES = [
    { id: 'wboss_dragon', name: 'Cổ Long', element: 'Hoa', drop: 'Long Lân' },
    { id: 'wboss_kraken', name: 'Hải Yêu Kraken', element: 'Thuy', drop: 'Hắc Mực Hải Yêu' },
    { id: 'wboss_golem', name: 'Thạch Nhân', element: 'Tho', drop: 'Thạch Tâm' },
    { id: 'wboss_phoenix', name: 'Cuồng Phong Phượng Hoàng', element: 'Loi', drop: 'Phượng Vũ' },
];
const WEEKLY_CHALLENGES = [
    { id: 'wchallenge_speed', name: 'Tốc Chiến', description: 'Vượt ải trong vòng 5 phút', reward: 'Giày Tốc Hành' },
    { id: 'wchallenge_no_damage', name: 'Vô Thương', description: 'Vượt ải mà không bị thương', reward: 'Khiên Giới' },
    { id: 'wchallenge_solo', name: 'Đơn Độc Hành', description: 'Vượt ải một mình', reward: 'Danh Hiệu Độc Hành' },
    { id: 'wchallenge_element', name: 'Ngũ Hành Thông', description: 'Vượt ải chỉ dùng một nguyên tố', reward: 'Ngũ Hành Tinh Thạch' },
    // V15 B-03: Enhanced weekly challenges with modifiers
    { id: 'wchallenge_no_heal', name: 'Cấm Chữa', description: 'Vượt ải không thể heal (trừ passive)', reward: 'Thiên Mệnh Tinh Hỏa x2' },
    { id: 'wchallenge_glass', name: 'Súng Sành', description: '+100% ATK, -50% DEF — one-shot or be one-shot', reward: 'Linh Túy Giác Tỉnh x2' },
    { id: 'wchallenge_pacifist', name: 'Vô Sát', description: 'Vượt ải chỉ dùng Guard — không tấn công', reward: 'Vũ Khí Chi Hồn x2' },
    { id: 'wchallenge_speedrun', name: 'Tốc Hành Cực Hạn', description: 'Clear boss trong 3 hiệp', reward: 'Máu Thú Nguyên x5' },
];
const MARKET_SPECIALS = [
    { category: 'equipment', discount: 0.20, name: 'Khuyến Mãi Trang Bị' },
    { category: 'materials', discount: 0.15, name: 'Khuyến Mãi Nguyên Liệu' },
    { category: 'consumables', discount: 0.25, name: 'Khuyến Mãi Vật Phẩm' },
];
const GUILD_EVENTS = [
    { id: 'guild_war', name: 'Tuần Tông Môn Chiến', description: 'Tông Môn giao tranh', reward: 'Tông Môn Cống Hiến x2' },
    { id: 'guild_craft', name: 'Tuần Luyện Khí', description: 'Thi luyện khí Tông Môn', reward: 'Nguyên Liệu Luyện Khí' },
    { id: 'guild_explore', name: 'Tuần Thám Hiểm', description: 'Thám hiểm Tông Môn', reward: 'Phần Thưởng Thám Hiểm x2' },
];
class WeeklyRotationService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS weekly_rotations (
        week_key TEXT PRIMARY KEY,
        dungeon_id TEXT NOT NULL,
        boss_id TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        market_special TEXT NOT NULL,
        guild_event TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    }
    /**
     * A-02: Get or create this week's rotation
     */
    getWeeklyRotation() {
        this.initTable();
        const weekKey = this.getWeekKey();
        let rotation = database_1.default.prepare('SELECT * FROM weekly_rotations WHERE week_key = ?').get(weekKey);
        if (!rotation) {
            const hash = this.dateHash(weekKey);
            const dungeon = WEEKLY_DUNGEONS[hash % WEEKLY_DUNGEONS.length];
            const boss = WEEKLY_BOSSES[(hash + 1) % WEEKLY_BOSSES.length];
            const challenge = WEEKLY_CHALLENGES[(hash + 2) % WEEKLY_CHALLENGES.length];
            const market = MARKET_SPECIALS[(hash + 3) % MARKET_SPECIALS.length];
            const guild = GUILD_EVENTS[(hash + 4) % GUILD_EVENTS.length];
            database_1.default.prepare(`
        INSERT INTO weekly_rotations (week_key, dungeon_id, boss_id, challenge_id, market_special, guild_event, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(weekKey, dungeon.id, boss.id, challenge.id, market.category, guild.id, Math.floor(Date.now() / 1000));
            rotation = { dungeon_id: dungeon.id, boss_id: boss.id, challenge_id: challenge.id, market_special: market.category, guild_event: guild.id };
        }
        return {
            weekKey,
            weeklyDungeon: rotation.dungeon_id,
            weeklyBoss: rotation.boss_id,
            weeklyChallenge: rotation.challenge_id,
            marketSpecial: rotation.market_special,
            guildEvent: rotation.guild_event
        };
    }
    /**
     * A-02: Get rotation description for UI
     */
    getRotationDescription() {
        const rotation = this.getWeeklyRotation();
        const dungeon = WEEKLY_DUNGEONS.find(d => d.id === rotation.weeklyDungeon);
        const boss = WEEKLY_BOSSES.find(b => b.id === rotation.weeklyBoss);
        const challenge = WEEKLY_CHALLENGES.find(c => c.id === rotation.weeklyChallenge);
        const market = MARKET_SPECIALS.find(m => m.category === rotation.marketSpecial);
        const guild = GUILD_EVENTS.find(g => g.id === rotation.guildEvent);
        let msg = `📅 **Luân Phiên Tuần Này** — Tuần ${rotation.weekKey}\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🏯 **Phó Bản Tuần Này:** ${dungeon?.name || rotation.weeklyDungeon}\n`;
        msg += `   └ Nguyên Tố: ${dungeon?.element} | Phần Thưởng: ${dungeon?.reward}\n`;
        msg += `👹 **Boss Tuần Này:** ${boss?.name || rotation.weeklyBoss}\n`;
        msg += `   └ Nguyên Tố: ${boss?.element} | Vật Rơi: ${boss?.drop}\n`;
        msg += `🎯 **Thử Thách Tuần Này:** ${challenge?.name || rotation.weeklyChallenge}\n`;
        msg += `   └ ${challenge?.description} | Phần Thưởng: ${challenge?.reward}\n`;
        msg += `🛍️ **Chợ Đen Tuần Này:** ${market?.name || rotation.marketSpecial}\n`;
        msg += `   └ Giảm Giá: ${(market?.discount || 0) * 100}%\n`;
        msg += `⚔️ **Sự Kiện Tông Môn:** ${guild?.name || rotation.guildEvent}\n`;
        msg += `   └ ${guild?.description} | Phần Thưởng: ${guild?.reward}\n`;
        return msg;
    }
    /**
     * A-02: Check if weekly bonus is active
     */
    isWeeklyBonusActive(type, id) {
        const rotation = this.getWeeklyRotation();
        switch (type) {
            case 'dungeon': return rotation.weeklyDungeon === id;
            case 'boss': return rotation.weeklyBoss === id;
            case 'market': return rotation.marketSpecial === id;
            case 'guild': return rotation.guildEvent === id;
            default: return false;
        }
    }
    /**
     * A-02: Get market discount for active category
     */
    getMarketDiscount(category) {
        const rotation = this.getWeeklyRotation();
        if (rotation.marketSpecial === category) {
            const market = MARKET_SPECIALS.find(m => m.category === category);
            return market?.discount || 0;
        }
        return 0;
    }
    getWeekKey() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const day = vn.getUTCDay() || 7;
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return vn.toISOString().slice(0, 10);
    }
    dateHash(dateStr) {
        let hash = 0;
        for (let i = 0; i < dateStr.length; i++) {
            const char = dateStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }
}
exports.weeklyRotationService = new WeeklyRotationService();
