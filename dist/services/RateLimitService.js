"use strict";
// C-04: Rate Limiting
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitService = void 0;
class RateLimitService {
    limits = new Map();
    configs = {
        default: { maxPerMinute: 30, maxPerHour: 500, maxPerDay: 5000 },
        combat: { maxPerMinute: 10, maxPerHour: 200, maxPerDay: 2000 },
        trading: { maxPerMinute: 5, maxPerHour: 100, maxPerDay: 1000 },
        social: { maxPerMinute: 20, maxPerHour: 300, maxPerDay: 3000 },
    };
    /**
     * C-04: Check rate limit
     */
    checkRateLimit(userId, action = 'default') {
        const config = this.configs[action] || this.configs.default;
        const key = `${userId}:${action}`;
        const now = Date.now();
        const minuteStart = Math.floor(now / 60000) * 60000;
        const hourStart = Math.floor(now / 3600000) * 3600000;
        const dayStart = Math.floor(now / 86400000) * 86400000;
        let entry = this.limits.get(key);
        if (!entry) {
            entry = { minuteCount: 0, hourCount: 0, dayCount: 0, minuteStart, hourStart, dayStart };
            this.limits.set(key, entry);
        }
        // Reset counters if window changed
        if (entry.minuteStart < minuteStart) {
            entry.minuteCount = 0;
            entry.minuteStart = minuteStart;
        }
        if (entry.hourStart < hourStart) {
            entry.hourCount = 0;
            entry.hourStart = hourStart;
        }
        if (entry.dayStart < dayStart) {
            entry.dayCount = 0;
            entry.dayStart = dayStart;
        }
        // Check limits
        if (entry.minuteCount >= config.maxPerMinute) {
            return { allowed: false, retryAfter: 60 - Math.floor((now - entry.minuteStart) / 1000) };
        }
        if (entry.hourCount >= config.maxPerHour) {
            return { allowed: false, retryAfter: 3600 - Math.floor((now - entry.hourStart) / 1000) };
        }
        if (entry.dayCount >= config.maxPerDay) {
            return { allowed: false, retryAfter: 86400 - Math.floor((now - entry.dayStart) / 1000) };
        }
        // Increment counters
        entry.minuteCount++;
        entry.hourCount++;
        entry.dayCount++;
        return { allowed: true };
    }
    /**
     * C-04: Get rate limit stats
     */
    getRateLimitStats(userId) {
        const stats = {};
        for (const [key, entry] of this.limits) {
            if (key.startsWith(userId)) {
                const action = key.split(':')[1];
                stats[action] = { minute: entry.minuteCount, hour: entry.hourCount, day: entry.dayCount };
            }
        }
        return stats;
    }
    /**
     * C-04: Get rate limit description
     */
    getRateLimitDescription() {
        let msg = `⏱️ **Rate Limits**\n`;
        for (const [action, config] of Object.entries(this.configs)) {
            msg += `• ${action}: ${config.maxPerMinute}/min, ${config.maxPerHour}/hour, ${config.maxPerDay}/day\n`;
        }
        return msg;
    }
}
exports.rateLimitService = new RateLimitService();
