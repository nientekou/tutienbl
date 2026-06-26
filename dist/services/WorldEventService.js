"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldEventService = void 0;
const database_1 = __importDefault(require("../database/database"));
const discord_js_1 = require("discord.js");
const uiSystem_1 = require("../utils/uiSystem");
const BroadcastService_1 = require("./BroadcastService");
const EVENT_DEFINITIONS = {
    world_boss: {
        name: 'Boss Xuất Hiện',
        description: 'Một Boss hùng mạnh xuất hiện! Tất cả tu sĩ cùng nhau tiêu diệt!',
        duration: 30 * 60, // 30 minutes
        rewards: 'Top cống hiến: Vật phẩm hiếm + KNB\nTất cả: EXP + Linh Thạch'
    },
    leyline_surge: {
        name: 'Linh Mạch Dâng Trào',
        description: 'Linh mạch địa đồ đang dâng trào! Nhân 3 điểm cống hiến!',
        duration: 15 * 60, // 15 minutes
        rewards: 'x3 điểm cống hiến cho mọi hoạt động'
    },
    thien_kiep: {
        name: 'Thiên Kiếp',
        description: 'Một vị tu sĩ đang trải qua thiên kiếp! Cầu nguyện cho họ!',
        duration: 10 * 60, // 10 minutes
        rewards: 'Nếu vượt qua: +50% EXP trong 1h\nNếu thất bại: -20% EXP trong 30p'
    },
    seasonal: {
        name: 'Sự Kiện Mùa',
        description: 'Sự kiện đặc biệt theo mùa đang diễn ra!',
        duration: 60 * 60, // 1 hour
        rewards: 'x2 phần thưởng cho mọi hoạt động'
    }
};
class WorldEventService {
    client = null;
    schedulerInterval = null;
    startScheduler(client) {
        this.client = client;
        if (this.schedulerInterval)
            return;
        this.schedulerInterval = setInterval(() => {
            try {
                this.checkAndTriggerEvents();
            }
            catch (err) {
                console.error('[WorldEventService] Scheduler error:', err);
            }
        }, 60_000);
    }
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS world_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        rewards TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS world_event_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        contribution INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        UNIQUE(event_id, user_id)
      );
    `);
    }
    /**
     * A-01: Check and trigger events (call periodically)
     */
    checkAndTriggerEvents() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const triggered = [];
        // Check if any active event
        const activeEvent = database_1.default.prepare("SELECT * FROM world_events WHERE status = 'active' AND end_time > ? LIMIT 1").get(now);
        if (activeEvent)
            return []; // Event still active
        // Roll for new event (10% chance per check)
        if (Math.random() > 0.10)
            return [];
        // Choose event type
        const eventTypes = ['world_boss', 'leyline_surge', 'thien_kiep', 'seasonal'];
        const weights = [30, 40, 20, 10]; // Probability weights
        const totalWeight = weights.reduce((s, w) => s + w, 0);
        let rand = Math.random() * totalWeight;
        let eventType = 'leyline_surge';
        for (let i = 0; i < eventTypes.length; i++) {
            rand -= weights[i];
            if (rand <= 0) {
                eventType = eventTypes[i];
                break;
            }
        }
        const def = EVENT_DEFINITIONS[eventType];
        const eventId = `event_${now}_${eventType}`;
        database_1.default.prepare(`
      INSERT INTO world_events (id, type, name, description, start_time, end_time, status, rewards, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(eventId, eventType, def.name, def.description, now, now + def.duration, def.rewards, now);
        const event = {
            id: eventId,
            type: eventType,
            name: def.name,
            description: def.description,
            startTime: now,
            endTime: now + def.duration,
            status: 'active',
            rewards: def.rewards
        };
        triggered.push(event);
        // Announce event
        this.announceEvent(event);
        return triggered;
    }
    /**
     * A-01: Get active event
     */
    getActiveEvent() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        return database_1.default.prepare("SELECT * FROM world_events WHERE status = 'active' AND end_time > ? LIMIT 1")
            .get(now);
    }
    /**
     * A-01: Participate in event
     */
    participate(userId, contribution = 100) {
        this.initTable();
        const event = this.getActiveEvent();
        if (!event)
            return { success: false, message: '❌ Không có sự kiện nào đang diễn ra!' };
        const existing = database_1.default.prepare('SELECT * FROM world_event_participants WHERE event_id = ? AND user_id = ?')
            .get(event.id, userId);
        if (existing) {
            database_1.default.prepare('UPDATE world_event_participants SET contribution = contribution + ? WHERE event_id = ? AND user_id = ?')
                .run(contribution, event.id, userId);
        }
        else {
            database_1.default.prepare('INSERT INTO world_event_participants (event_id, user_id, contribution) VALUES (?, ?, ?)')
                .run(event.id, userId, contribution);
        }
        return { success: true, message: `🎯 Đã đóng góp **${contribution}** vào sự kiện **${event.name}**!` };
    }
    /**
     * A-01: Get event leaderboard
     */
    getEventLeaderboard(eventId, limit = 10) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT wep.*, u.name FROM world_event_participants wep
      JOIN users u ON wep.user_id = u.discord_id
      WHERE wep.event_id = ?
      ORDER BY wep.contribution DESC
      LIMIT ?
    `).all(eventId, limit);
        return rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            contribution: r.contribution
        }));
    }
    /**
     * A-01: Get event description
     */
    getEventDescription() {
        const event = this.getActiveEvent();
        if (!event)
            return '🌍 Hiện tại không có sự kiện nào đang diễn ra.';
        const timeLeft = Math.max(0, event.endTime - Math.floor(Date.now() / 1000));
        const minutes = Math.floor(timeLeft / 60);
        let msg = `🌍 **SỰ KIỆN ĐANG DIỄN RA!**\n`;
        msg += `📢 **${event.name}**\n`;
        msg += `${event.description}\n\n`;
        msg += `⏰ Còn **${minutes}** phút\n`;
        msg += `🎁 **Phần thưởng:** ${event.rewards}\n`;
        msg += `\n*Dùng \`/sukien donggop\` để đóng góp!*`;
        return msg;
    }
    /**
     * A-01: Announce event to all guilds
     */
    async announceEvent(event) {
        console.log(`🌍 [SỰ KIỆN THẾ GIỚI] ${event.name}: ${event.description}`);
        if (!this.client)
            return;
        const guilds = database_1.default.prepare('SELECT guild_id FROM guild_configs WHERE event_channel_id IS NOT NULL OR guide_channel_id IS NOT NULL').all();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🌍 ${event.name}`)
            .setDescription(event.description)
            .addFields({ name: '⏰ Thời gian', value: `${Math.floor((event.endTime - event.startTime) / 60)} phút`, inline: true }, { name: '🎁 Phần thưởng', value: event.rewards, inline: false })
            .setColor(uiSystem_1.EMBED_COLORS.GOLD)
            .setTimestamp();
        for (const g of guilds) {
            await BroadcastService_1.broadcastService.broadcast(this.client, g.guild_id, embed);
        }
    }
    /**
     * A-01: Get event history
     */
    getEventHistory(limit = 10) {
        this.initTable();
        return database_1.default.prepare('SELECT * FROM world_events ORDER BY created_at DESC LIMIT ?')
            .all(limit);
    }
    // === B-06: Event System Deep ===
    /**
     * B-06: Get more event types
     */
    getMoreEventTypes() {
        return [
            { id: 'fishing_contest', name: 'Giải Câu Cá', description: 'Câu được con cá lớn nhất!', duration: 60 * 60, rewards: 'Cá + KNB' },
            { id: 'treasure_hunt', name: 'Săn Kho Báu', description: 'Tìm kho báu ẩn giấu!', duration: 30 * 60, rewards: 'Vật phẩm hiếm + Linh Thạch' },
            { id: 'pvp_tournament', name: 'Giải Đấu PvP', description: 'Tranh tài vinh quang!', duration: 120 * 60, rewards: 'Danh hiệu + KNB' },
            { id: 'crafting_marathon', name: 'Điêu Luyện Marathon', description: 'Chế tạo thật nhiều vật phẩm!', duration: 60 * 60, rewards: 'Nguyên liệu chế tạo + EXP' },
            { id: 'exploration_rush', name: 'Thám Hiểm Cấp Tốc', description: 'Khám phá thật nhiều địa điểm!', duration: 60 * 60, rewards: 'Nguyên liệu hiếm + EXP' },
        ];
    }
    /**
     * B-06: Get event calendar
     */
    getEventCalendar() {
        const calendar = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(now.getTime() + i * 86400000);
            const vn = new Date(date.getTime() + 7 * 3600000);
            const dateStr = vn.toISOString().slice(0, 10);
            const events = [];
            if (i === 0)
                events.push('Xoay Vòng Hàng Ngày');
            if (i === 1)
                events.push('Làm Mới Hàng Tuần');
            if (i === 3)
                events.push('Chiến Tranh Tông Môn');
            if (i === 5)
                events.push('Giải Đấu Hàng Tuần');
            calendar.push({ date: dateStr, events });
        }
        return calendar;
    }
    /**
     * B-06: Get event description for UI
     */
    getEventDeepDescription() {
        let msg = `🌍 **Sự Kiện Thế Giới**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        const active = this.getActiveEvent();
        if (active) {
            const timeLeft = Math.max(0, active.endTime - Math.floor(Date.now() / 1000));
            msg += `📢 **Đang hoạt động:** ${active.name} (${Math.floor(timeLeft / 60)}p)\n`;
        }
        else {
            msg += `📢 Không có sự kiện nào đang hoạt động\n`;
        }
        msg += `\n**Loại Sự Kiện:**\n`;
        const allTypes = [...Object.entries(EVENT_DEFINITIONS).map(([k, v]) => ({ id: k, name: v.name, duration: v.duration })),
            ...this.getMoreEventTypes()];
        for (const et of allTypes) {
            msg += `• ${et.name} (${Math.floor(et.duration / 60)}phút)\n`;
        }
        return msg;
    }
}
exports.worldEventService = new WorldEventService();
