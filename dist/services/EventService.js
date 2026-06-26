"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventService = exports.EVENT_TEMPLATES = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const SystemConfigService_1 = require("./SystemConfigService");
const itemConstants_1 = require("../config/itemConstants");
// Định nghĩa các sự kiện mẫu
exports.EVENT_TEMPLATES = [
    {
        id: 'weekly_boss_rush',
        name: 'Thảo Phạt Ma Vương',
        type: 'weekly_boss',
        description: 'Tuần này Ma Vương tái thế! Cả server cùng tham gia thảo phạt để nhận thưởng đặc biệt. Tích lũy sát thương để đạt các mốc phần thưởng!',
        durationHours: 168, // 7 ngày
        rewards: [
            { type: 'coin', amount: 5000 },
            { type: 'tuvi', amount: 10000 },
            { type: 'item', itemId: itemConstants_1.ITEMS.LUCKY_CHEST, amount: 3 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_TUVI, amount: 5 }
        ],
        repeatable: 'weekly'
    },
    {
        id: 'double_exp_weekend',
        name: 'Cuồng Phong Tu Luyện',
        type: 'double_exp',
        description: '⚠️ CUỐI TUẦN EXP X2! Trong thời gian diễn ra sự kiện, tất cả Tu Vi nhận được từ thiền định, luyện đan, làm việc và bí cảnh được nhân đôi!',
        durationHours: 48, // 2 ngày (thứ 7-CN)
        rewards: [
            { type: 'tuvi', amount: 0 } // 0 = buff multiplier, not direct reward
        ],
        repeatable: 'weekly'
    },
    {
        id: 'mid_autumn_festival',
        name: 'Tết Trung Thu',
        type: 'seasonal',
        description: '🌕 Lễ hội Trung Thu! Tham gia các hoạt động để nhận Nguyệt Bính và các vật phẩm giới hạn!',
        durationHours: 72, // 3 ngày
        rewards: [
            { type: 'coin', amount: 10000 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_TUVI, amount: 10 },
        ],
        repeatable: 'once'
    },
    {
        id: 'mini_game_race',
        name: 'Đại Hội Linh Thú',
        type: 'mini_game',
        description: '🏁 Đại Hội Linh Thú hàng tháng! Đua linh thú để giành giải thưởng lớn. Ai có sủng thú mạnh nhất?',
        durationHours: 24,
        rewards: [
            { type: 'coin', amount: 3000 },
            { type: 'ngotinh', amount: 50 },
            { type: 'item', itemId: itemConstants_1.ITEMS.ITEM_FRAGMENT, amount: 20 }
        ],
        repeatable: 'monthly'
    }
];
class EventService {
    schedulerInterval = null;
    // Cache trong bộ nhớ cho double exp
    doubleExpActive = false;
    eventCache = new Map();
    /**
     * Khởi động scheduler kiểm tra sự kiện mỗi 60 giây
     */
    startScheduler() {
        if (this.schedulerInterval)
            return;
        console.log('[EventService] ⏳ Khởi động Scheduler quét sự kiện định kỳ...');
        // Kiểm tra và tạo sự kiện ngay lập tức khi khởi động
        this.checkEvents();
        this.schedulerInterval = setInterval(() => {
            try {
                this.checkEvents();
            }
            catch (err) {
                console.error('[EventService] Lỗi scheduler:', err);
            }
        }, 60000); // 60s quét 1 lần
    }
    /**
     * Làm mới cache sự kiện
     */
    refreshEventCache() {
        this.eventCache.clear();
        const activeEvents = database_1.default.prepare("SELECT * FROM events WHERE status = 'active'").all();
        for (const ev of activeEvents) {
            this.eventCache.set(ev.id, ev);
        }
        this.doubleExpActive = activeEvents.some(e => e.type === 'double_exp');
    }
    /**
     * Kiểm tra và cập nhật trạng thái sự kiện
     */
    checkEvents() {
        const now = Math.floor(Date.now() / 1000);
        // Kết thúc sự kiện quá hạn
        database_1.default.prepare("UPDATE events SET status = 'ended' WHERE status = 'active' AND ended_at <= ?").run(now);
        // Kích hoạt sự kiện đến hạn
        database_1.default.prepare("UPDATE events SET status = 'active' WHERE status = 'upcoming' AND started_at <= ? AND ended_at > ?").run(now, now);
        // Tự động tạo sự kiện định kỳ nếu chưa có
        this.autoCreateEvents(now);
        this.refreshEventCache();
    }
    /**
     * Tự động tạo sự kiện định kỳ
     */
    autoCreateEvents(now) {
        // Weekly Boss: Reset mỗi thứ 2
        const weeklyBossExists = database_1.default.prepare("SELECT id FROM events WHERE type = 'weekly_boss' AND status IN ('upcoming', 'active')").get();
        if (!weeklyBossExists) {
            const template = exports.EVENT_TEMPLATES.find(e => e.id === 'weekly_boss_rush');
            const startOfWeek = this.getNextWeekStart();
            this.createEvent(template, startOfWeek, startOfWeek + template.durationHours * 3600);
        }
        // Double EXP Weekend: Thứ 7-CN
        const doubleExpExists = database_1.default.prepare("SELECT id FROM events WHERE type = 'double_exp' AND status IN ('upcoming', 'active')").get();
        if (!doubleExpExists) {
            const template = exports.EVENT_TEMPLATES.find(e => e.id === 'double_exp_weekend');
            const nextWeekend = this.getNextWeekendStart();
            this.createEvent(template, nextWeekend, nextWeekend + template.durationHours * 3600);
        }
        // V12 D-02: Monthly Pet Race — auto-create at start of each month
        const currentMonth = new Date().getMonth();
        const monthlyRaceExists = database_1.default.prepare("SELECT id FROM events WHERE type = 'mini_game' AND name LIKE '%Linh Thu%' AND started_at >= ?").get(this.getMonthStart(now));
        if (!monthlyRaceExists) {
            const template = exports.EVENT_TEMPLATES.find(e => e.id === 'mini_game_race');
            if (template) {
                const monthStart = this.getMonthStart(now);
                this.createEvent(template, monthStart, monthStart + template.durationHours * 3600);
            }
        }
    }
    getMonthStart(now) {
        const d = new Date(now * 1000);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    }
    /**
     * Tạo sự kiện mới
     */
    createEvent(template, startTime, endTime) {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT OR IGNORE INTO events (id, name, type, description, started_at, ended_at, rewards_config, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`${template.id}_${startTime}`, template.name, template.type, template.description, startTime, endTime, JSON.stringify(template.rewards), now);
    }
    /**
     * Lấy danh sách sự kiện đang hoạt động
     */
    getActiveEvents() {
        return Array.from(this.eventCache.values());
    }
    /**
     * Kiểm tra double exp có đang active không
     */
    isDoubleExpActive() {
        return this.doubleExpActive;
    }
    /**
     * Lấy thông tin sự kiện theo ID
     */
    getEvent(eventId) {
        const cached = this.eventCache.get(eventId);
        if (cached)
            return cached;
        return database_1.default.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    }
    /**
     * Người chơi tham gia sự kiện
     */
    joinEvent(eventId, userId) {
        const event = this.getEvent(eventId);
        if (!event)
            return { success: false, message: 'Sự kiện không tồn tại!' };
        if (event.status !== 'active')
            return { success: false, message: 'Sự kiện này chưa bắt đầu hoặc đã kết thúc!' };
        const existing = database_1.default.prepare("SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?").get(eventId, userId);
        if (existing)
            return { success: false, message: 'Đạo hữu đã tham gia sự kiện này rồi!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO event_participants (event_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(eventId, userId, now);
        SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'event_join', { eventId, eventName: event.name });
        return { success: true, message: `🎉 Đạo hữu đã tham gia sự kiện **${event.name}**! Hãy tích cực hoạt động để nhận thưởng!` };
    }
    /**
     * Cập nhật tiến trình sự kiện
     */
    updateProgress(eventId, userId, amount = 1) {
        database_1.default.prepare(`
      UPDATE event_participants SET progress = progress + ?, score = score + ?
      WHERE event_id = ? AND user_id = ?
    `).run(amount, amount, eventId, userId);
    }
    /**
     * Nhận thưởng sự kiện
     */
    claimRewards(eventId, userId) {
        const participant = database_1.default.prepare("SELECT * FROM event_participants WHERE event_id = ? AND user_id = ? AND rewards_claimed = 0").get(eventId, userId);
        if (!participant)
            return { success: false, message: 'Đạo hữu chưa tham gia sự kiện này hoặc đã nhận thưởng rồi!' };
        const event = this.getEvent(eventId);
        if (!event)
            return { success: false, message: 'Sự kiện không tồn tại!' };
        if (event.status !== 'ended')
            return { success: false, message: 'Sự kiện chưa kết thúc! Hãy chờ đến khi sự kiện kết thúc để nhận thưởng.' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        let rewards;
        try {
            rewards = JSON.parse(event.rewards_config || '[]');
        }
        catch {
            rewards = [];
        }
        const rewardMessages = [];
        const isDoubleExp = event.type === 'double_exp';
        database_1.default.transaction(() => {
            for (const reward of rewards) {
                if (reward.type === 'coin' && reward.amount && reward.amount > 0) {
                    UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.amount });
                    rewardMessages.push(`+${reward.amount} Linh Thạch`);
                }
                if (reward.type === 'tuvi' && reward.amount && reward.amount > 0) {
                    const multiplier = isDoubleExp ? 2 : 1;
                    const actualAmount = reward.amount * multiplier;
                    const capped = Math.min(user.tu_vi + actualAmount, user.exp_needed);
                    UserRepository_1.userRepository.update(userId, { tu_vi: capped });
                    rewardMessages.push(`+${actualAmount} Tu Vi`);
                }
                if (reward.type === 'ngotinh' && reward.amount) {
                    UserRepository_1.userRepository.update(userId, { ngotinh: (user.ngotinh || 0) + reward.amount });
                    rewardMessages.push(`+${reward.amount} Ngộ Tính`);
                }
                if (reward.type === 'item' && reward.itemId && reward.amount) {
                    InventoryRepository_1.inventoryRepository.addItem(userId, reward.itemId, reward.amount);
                    const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(reward.itemId);
                    rewardMessages.push(`${reward.amount}x ${item?.name || reward.itemId}`);
                }
            }
            database_1.default.prepare("UPDATE event_participants SET rewards_claimed = 1 WHERE id = ?").run(participant.id);
        })();
        return {
            success: true,
            message: `🎉 **Nhận thưởng sự kiện ${event.name} thành công!**\n${rewardMessages.join(' | ')}`,
            rewards: rewardMessages
        };
    }
    /**
     * Lấy thông tin chi tiết sự kiện cho embed
     */
    getEventInfo(event) {
        const now = Math.floor(Date.now() / 1000);
        let timeLeft = '';
        if (event.status === 'upcoming') {
            const diff = event.started_at - now;
            const hours = Math.floor(diff / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            timeLeft = `Bắt đầu sau: ${hours}h ${mins}m`;
        }
        else if (event.status === 'active') {
            const diff = event.ended_at - now;
            const hours = Math.floor(diff / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            timeLeft = `Còn lại: ${hours}h ${mins}m`;
        }
        else {
            timeLeft = 'Đã kết thúc';
        }
        const participantCount = database_1.default.prepare("SELECT COUNT(*) as c FROM event_participants WHERE event_id = ?").get(event.id).c;
        return { timeLeft, participantCount };
    }
    /**
     * Lấy thứ 2 đầu tuần tiếp theo (0h UTC+7)
     */
    getNextWeekStart() {
        const now = new Date();
        const vnNow = new Date(now.getTime() + 7 * 3600000);
        const dayOfWeek = vnNow.getUTCDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        const nextMonday = new Date(vnNow);
        nextMonday.setUTCDate(vnNow.getUTCDate() + daysUntilMonday);
        nextMonday.setUTCHours(0, 0, 0, 0);
        return Math.floor((nextMonday.getTime() - 7 * 3600000) / 1000);
    }
    /**
     * Lấy thứ 7 đầu tiên tiếp theo
     */
    getNextWeekendStart() {
        const now = new Date();
        const vnNow = new Date(now.getTime() + 7 * 3600000);
        const dayOfWeek = vnNow.getUTCDay();
        let daysUntilSat = 0;
        // Nếu đã là thứ 7 (6) hoặc CN (0)
        if (dayOfWeek === 6)
            daysUntilSat = 0; // Hôm nay là thứ 7
        else if (dayOfWeek === 0)
            daysUntilSat = 6; // CN -> thứ 7 tuần sau
        else
            daysUntilSat = 6 - dayOfWeek; // Các ngày khác
        const nextSat = new Date(vnNow);
        nextSat.setUTCDate(vnNow.getUTCDate() + daysUntilSat);
        nextSat.setUTCHours(0, 0, 0, 0);
        return Math.floor((nextSat.getTime() - 7 * 3600000) / 1000);
    }
    /**
     * Bật/tắt sự kiện Nhân Đôi EXP thủ công từ quản trị
     */
    toggleDoubleExpManual(active) {
        const now = Math.floor(Date.now() / 1000);
        if (active) {
            const hasActive = database_1.default.prepare("SELECT id FROM events WHERE type = 'double_exp' AND status = 'active'").get();
            if (!hasActive) {
                database_1.default.prepare(`
          INSERT INTO events (id, name, type, description, started_at, ended_at, status, rewards_config, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', '[]', ?)
        `).run('manual_double_exp_' + now, 'Nhân Đôi Tu Vi (Admin Kích Hoạt)', 'double_exp', 'Sự kiện x2 Tu Vi được kích hoạt thủ công bởi Thiên Đạo Chủ.', now - 3600, now + 86400 * 7, now);
            }
        }
        else {
            database_1.default.prepare("UPDATE events SET status = 'ended' WHERE type = 'double_exp' AND status = 'active'").run();
        }
        this.refreshEventCache();
    }
}
exports.eventService = new EventService();
