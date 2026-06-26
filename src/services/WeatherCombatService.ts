import { weatherService } from './WeatherService';
import { Combatant } from './CombatEngine';

// B-06: Weather Combat Integration
// Applies weather effects to combat stats before CombatEngine.run()

class WeatherCombatService {
  /**
   * Apply weather effects to a Combatant's stats before combat
   * Returns a modified copy of the combatant with weather bonuses applied
   */
  applyWeatherToCombatant(combatant: Combatant, guildId: string): Combatant {
    const effects = weatherService.getWeatherEffects(guildId);
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

    // V14 D-03: Weather elemental damage bonuses
    if (effects['loi_damage_bonus']) {
      (modified as any).weatherElementBonus = { element: 'Loi', value: effects['loi_damage_bonus'] };
    } else if (effects['thuy_damage_bonus']) {
      (modified as any).weatherElementBonus = { element: 'Thuy', value: effects['thuy_damage_bonus'] };
    }

    return modified;
  }

  /**
   * Get weather combat description for log
   */
  getWeatherCombatLog(guildId: string): string | null {
    const effects = weatherService.getWeatherEffects(guildId);
    const entries = Object.entries(effects).filter(([_, v]) => v !== 0);

    if (entries.length === 0) return null;

    const weather = weatherService.getCurrentWeather(guildId);
    let msg = `${weather.emoji} **[Thoi Tiet - ${weather.name}]** `;
    const parts = entries.map(([stat, val]) => {
      const sign = val > 0 ? '+' : '';
      return `${stat} ${sign}${Math.round(val * 100)}%`;
    });
    msg += parts.join(', ');

    return msg;
  }
}

export const weatherCombatService = new WeatherCombatService();
