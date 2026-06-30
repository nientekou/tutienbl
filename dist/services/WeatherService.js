"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherService = void 0;
const database_1 = __importDefault(require("../database/database"));
const weatherConstants_1 = require("../config/weatherConstants");
class WeatherService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS guild_weather (
        guild_id TEXT PRIMARY KEY,
        current_weather TEXT NOT NULL DEFAULT 'sunny',
        changed_at INTEGER NOT NULL,
        next_change INTEGER NOT NULL
      );
    `);
    }
    /**
     * B-06: Get current weather for a guild
     * Auto-rotate if expired
     */
    getCurrentWeather(guildId) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        let state = database_1.default.prepare('SELECT * FROM guild_weather WHERE guild_id = ?').get(guildId);
        if (!state || now >= state.next_change) {
            // Roll new weather
            const newWeather = this.rollWeather();
            const nextChange = now + weatherConstants_1.WEATHER_CHANGE_INTERVAL_HOURS * 3600;
            if (state) {
                database_1.default.prepare('UPDATE guild_weather SET current_weather = ?, changed_at = ?, next_change = ? WHERE guild_id = ?')
                    .run(newWeather, now, nextChange, guildId);
            }
            else {
                database_1.default.prepare('INSERT INTO guild_weather (guild_id, current_weather, changed_at, next_change) VALUES (?, ?, ?, ?)')
                    .run(guildId, newWeather, now, nextChange);
            }
            return weatherConstants_1.WEATHERS[newWeather];
        }
        return weatherConstants_1.WEATHERS[state.current_weather];
    }
    /**
     * B-06: Get weather effects as stat bonuses
     */
    // ponytail: non-combat effects (alchemy, drop, tribulation, exploration) bypass the combat cap
    NON_COMBAT_EFFECTS = new Set(['alchemy_bonus', 'drop_bonus', 'tribulation_exp_bonus', 'exploration_speed_bonus']);
    getWeatherEffects(guildId) {
        const weather = this.getCurrentWeather(guildId);
        const effects = {};
        for (const eff of weather.effects) {
            if (this.NON_COMBAT_EFFECTS.has(eff.stat)) {
                effects[eff.stat] = eff.value;
            }
            else {
                effects[eff.stat] = Math.max(-weatherConstants_1.WEATHER_EFFECT_CAP, Math.min(weatherConstants_1.WEATHER_EFFECT_CAP, eff.value));
            }
        }
        return effects;
    }
    /**
     * B-06: Get time remaining until next weather change
     */
    getTimeToNextChange(guildId) {
        this.initTable();
        const state = database_1.default.prepare('SELECT next_change FROM guild_weather WHERE guild_id = ?').get(guildId);
        if (!state)
            return 0;
        return Math.max(0, state.next_change - Math.floor(Date.now() / 1000));
    }
    /**
     * B-06: Format weather info for display
     */
    getWeatherDescription(guildId) {
        const weather = this.getCurrentWeather(guildId);
        const timeLeft = this.getTimeToNextChange(guildId);
        const hours = Math.floor(timeLeft / 3600);
        const mins = Math.floor((timeLeft % 3600) / 60);
        let msg = `${weather.emoji} **${weather.name}**\n`;
        msg += `${weather.description}\n\n`;
        msg += `**Hiệu ứng:**\n`;
        for (const eff of weather.effects) {
            const sign = eff.value > 0 ? '+' : '';
            const pct = Math.round(eff.value * 100);
            msg += `• ${eff.stat}: **${sign}${pct}%**\n`;
        }
        msg += `\n⏰ Thời gian còn lại: **${hours}h ${mins}p**`;
        msg += `\n🔄 Thay đổi mỗi ${weatherConstants_1.WEATHER_CHANGE_INTERVAL_HOURS}h`;
        return msg;
    }
    /**
     * B-06: Get weather forecast (what weather is likely next)
     */
    getForecast(guildId) {
        const current = this.getCurrentWeather(guildId);
        const totalWeight = Object.values(weatherConstants_1.WEATHERS).reduce((sum, w) => sum + w.rarity, 0);
        let forecast = `**Dự báo thời tiết:**\n`;
        const sorted = Object.values(weatherConstants_1.WEATHERS).sort((a, b) => b.rarity - a.rarity);
        for (const w of sorted) {
            const chance = Math.round((w.rarity / totalWeight) * 100);
            const isCurrent = w.id === current.id;
            forecast += `${w.emoji} ${w.name}: **${chance}%**${isCurrent ? ' ← hiện tại' : ''}\n`;
        }
        return forecast;
    }
    rollWeather() {
        const totalWeight = Object.values(weatherConstants_1.WEATHERS).reduce((sum, w) => sum + w.rarity, 0);
        let rand = Math.random() * totalWeight;
        for (const weather of Object.values(weatherConstants_1.WEATHERS)) {
            rand -= weather.rarity;
            if (rand <= 0)
                return weather.id;
        }
        return 'sunny';
    }
}
exports.weatherService = new WeatherService();
