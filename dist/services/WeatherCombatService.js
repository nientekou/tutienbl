"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherCombatService = void 0;
const WeatherService_1 = require("./WeatherService");
// B-06: Weather Combat Integration
// Applies weather effects to combat stats before CombatEngine.run()
class WeatherCombatService {
    /**
     * Apply weather effects to a Combatant's stats before combat
     * Returns a modified copy of the combatant with weather bonuses applied
     */
    applyWeatherToCombatant(combatant, guildId) {
        const effects = WeatherService_1.weatherService.getWeatherEffects(guildId);
        const modified = { ...combatant };
        // atk bonus
        if (effects['atk'] && modified.atk) {
            modified.atk = Math.round(modified.atk * (1 + effects['atk']));
        }
        // def bonus
        if (effects['def'] && modified.def) {
            modified.def = Math.round(modified.def * (1 + effects['def']));
        }
        // speed bonus
        if (effects['speed'] && modified.speed) {
            modified.speed = Math.round(modified.speed * (1 + effects['speed']));
        }
        // dodge bonus
        if (effects['dodge'] && modified.dodge) {
            modified.dodge = Math.round(modified.dodge * (1 + effects['dodge']));
        }
        // crit bonus
        if (effects['crit'] && modified.crit) {
            modified.crit = Math.min(1, modified.crit + effects['crit']);
        }
        return modified;
    }
    /**
     * Get weather combat description for log
     */
    getWeatherCombatLog(guildId) {
        const effects = WeatherService_1.weatherService.getWeatherEffects(guildId);
        const entries = Object.entries(effects).filter(([_, v]) => v !== 0);
        if (entries.length === 0)
            return null;
        const weather = WeatherService_1.weatherService.getCurrentWeather(guildId);
        let msg = `${weather.emoji} **[Thoi Tiet - ${weather.name}]** `;
        const parts = entries.map(([stat, val]) => {
            const sign = val > 0 ? '+' : '';
            return `${stat} ${sign}${Math.round(val * 100)}%`;
        });
        msg += parts.join(', ');
        return msg;
    }
}
exports.weatherCombatService = new WeatherCombatService();
