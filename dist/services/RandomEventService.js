"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomEventService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const RANDOM_EVENTS = [
    { id: 're_lucky1', type: 'lucky_find', name: 'Kỳ Ngộ', description: 'Đạo hữu tìm thấy thứ gì đó lấp lánh!', effect: 'bonus_coins', reward: '500 Linh Thạch', chance: 0.05 },
    { id: 're_lucky2', type: 'lucky_find', name: 'Phát Hiện', description: 'Đạo hữu tìm thấy tài liệu quý hiếm!', effect: 'random_rare_item', reward: 'Nguyên Liệu Hiếm', chance: 0.03 },
    { id: 're_npc1', type: 'mysterious_npc', name: 'Cao Nhân Thần Bí', description: 'Một vị cao nhân muốn giao nhiệm vụ cho đạo hữu!', effect: 'exp_boost', reward: '1000 Tu Vi', chance: 0.02 },
    { id: 're_treasure1', type: 'hidden_treasure', name: 'Kho Báu Ẩn', description: 'Đạo hữu phát hiện một rương kho báu ẩn!', effect: 'treasure_chest', reward: '1000 Linh Thạch', chance: 0.04 },
    { id: 're_treasure2', type: 'hidden_treasure', name: 'Rương Thần Bí', description: 'Một rương thần bí hiện ra!', effect: 'mystery_chest', reward: '2000 Linh Thạch + 5 KNB', chance: 0.01 },
    { id: 're_monster1', type: 'monster_surge', name: 'Yêu Thú Xuất Hiện', description: 'Yêu thú đang tấn công!', effect: 'double_drops', reward: 'Tỷ lệ rơi đồ x2', chance: 0.03 },
    { id: 're_monster2', type: 'monster_surge', name: 'Yêu Vương', description: 'Một con yêu vương xuất hiện!', effect: 'elite_fight', reward: 'Vật phẩm hiếm', chance: 0.02 },
    { id: 're_weather1', type: 'weather_event', name: 'Bão Tố Cảnh Báo', description: 'Một cơn bão linh khí đang ập đến!', effect: 'weather_debuff', reward: 'Bùa thời tiết', chance: 0.02 },
];
class RandomEventService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS random_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        triggered_at INTEGER NOT NULL,
        completed INTEGER DEFAULT 0
      );
    `);
    }
    /**
     * A-04: Check if a random event triggers for a user
     */
    checkRandomEvent(userId, activityType) {
        this.initTable();
        // Filter events by activity type
        const relevantEvents = RANDOM_EVENTS.filter(e => {
            if (activityType === 'work' && (e.type === 'lucky_find' || e.type === 'monster_surge'))
                return true;
            if (activityType === 'explore' && (e.type === 'hidden_treasure' || e.type === 'mysterious_npc'))
                return true;
            if (activityType === 'combat' && (e.type === 'monster_surge' || e.type === 'weather_event'))
                return true;
            if (activityType === 'social' && e.type === 'mysterious_npc')
                return true;
            return false;
        });
        if (relevantEvents.length === 0)
            return null;
        // Check each event
        for (const event of relevantEvents) {
            if (Math.random() < event.chance) {
                // Record event
                database_1.default.prepare('INSERT INTO random_events (user_id, event_id, triggered_at) VALUES (?, ?, ?)')
                    .run(userId, event.id, Math.floor(Date.now() / 1000));
                return event;
            }
        }
        return null;
    }
    /**
     * A-04: Apply random event effect
     */
    applyEventEffect(userId, event) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Người dùng không tồn tại' };
        switch (event.effect) {
            case 'bonus_coins':
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + 500 });
                return { success: true, message: `🎉 +500 Linh Thach!` };
            case 'exp_boost':
                UserRepository_1.userRepository.update(userId, { tu_vi: Math.min(user.tu_vi + 1000, user.exp_needed) });
                return { success: true, message: `🎉 +1000 Tu Vi!` };
            case 'random_rare_item':
                // Would give a rare item - simplified for now
                return { success: true, message: `🎉 Tìm thấy vật phẩm quý hiếm!` };
            case 'discount_shop':
                return { success: true, message: `🎉 Thương nhân giảm giá 30%!` };
            case 'treasure_chest':
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + 1000 });
                return { success: true, message: `🎉 Mở rương kho báu: +1000 Linh Thach!` };
            case 'mystery_chest':
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + 2000, knb: user.knb + 5 });
                return { success: true, message: `🎉 Mở rương thần bí: +2000 Linh Thach, +5 KNB!` };
            case 'double_drops':
                return { success: true, message: `🎉 Tỷ lệ rơi đồ x2 trong 30 phút!` };
            case 'elite_fight':
                return { success: true, message: `🎉 Yêu thú tinh anh xuất hiện! Chuẩn bị chiến đấu!` };
            case 'weather_debuff':
                return { success: true, message: `⚠️ Bão tố! Chỉ số bị ảnh hưởng trong 15 phút.` };
            default:
                return { success: true, message: `🎉 Sự kiện đặc biệt đã kích hoạt!` };
        }
    }
    /**
     * A-04: Get event description for UI
     */
    getEventDescription(event) {
        return `🎲 **${event.name}**\n${event.description}\n🎁 Phần thưởng: ${event.reward}`;
    }
    /**
     * A-04: Get recent events for user
     */
    getRecentEvents(userId, limit = 5) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT re.event_id, re.triggered_at FROM random_events re
      WHERE re.user_id = ?
      ORDER BY re.triggered_at DESC
      LIMIT ?
    `).all(userId, limit);
        return rows.map(r => {
            const event = RANDOM_EVENTS.find(e => e.id === r.event_id);
            return { eventName: event?.name || r.event_id, triggeredAt: r.triggered_at };
        });
    }
}
exports.randomEventService = new RandomEventService();
