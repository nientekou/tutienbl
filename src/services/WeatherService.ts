import db from '../database/database';
import { WEATHERS, WEATHER_CHANGE_INTERVAL_HOURS, WEATHER_EFFECT_CAP, WeatherType, WeatherDef } from '../config/weatherConstants';

interface WeatherState {
  guild_id: string;
  current_weather: WeatherType;
  changed_at: number;
  next_change: number;
}

class WeatherService {
  private initTable(): void {
    db.exec(`
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
  public getCurrentWeather(guildId: string): WeatherDef {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);

    let state = db.prepare('SELECT * FROM guild_weather WHERE guild_id = ?').get(guildId) as WeatherState | undefined;

    if (!state || now >= state.next_change) {
      // Roll new weather
      const newWeather = this.rollWeather();
      const nextChange = now + WEATHER_CHANGE_INTERVAL_HOURS * 3600;

      if (state) {
        db.prepare('UPDATE guild_weather SET current_weather = ?, changed_at = ?, next_change = ? WHERE guild_id = ?')
          .run(newWeather, now, nextChange, guildId);
      } else {
        db.prepare('INSERT INTO guild_weather (guild_id, current_weather, changed_at, next_change) VALUES (?, ?, ?, ?)')
          .run(guildId, newWeather, now, nextChange);
      }

      return WEATHERS[newWeather];
    }

    return WEATHERS[state.current_weather];
  }

  /**
   * B-06: Get weather effects as stat bonuses
   */
  // ponytail: non-combat effects (alchemy, drop, tribulation, exploration) bypass the combat cap
  private readonly NON_COMBAT_EFFECTS = new Set(['alchemy_bonus', 'drop_bonus', 'tribulation_exp_bonus', 'exploration_speed_bonus']);

  public getWeatherEffects(guildId: string): Record<string, number> {
    const weather = this.getCurrentWeather(guildId);
    const effects: Record<string, number> = {};

    for (const eff of weather.effects) {
      if (this.NON_COMBAT_EFFECTS.has(eff.stat)) {
        effects[eff.stat] = eff.value;
      } else {
        effects[eff.stat] = Math.max(-WEATHER_EFFECT_CAP, Math.min(WEATHER_EFFECT_CAP, eff.value));
      }
    }

    return effects;
  }

  /**
   * B-06: Get time remaining until next weather change
   */
  getTimeToNextChange(guildId: string): number {
    this.initTable();
    const state = db.prepare('SELECT next_change FROM guild_weather WHERE guild_id = ?').get(guildId) as { next_change: number } | undefined;
    if (!state) return 0;
    return Math.max(0, state.next_change - Math.floor(Date.now() / 1000));
  }

  /**
   * B-06: Format weather info for display
   */
  public getWeatherDescription(guildId: string): string {
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
    msg += `\n🔄 Thay đổi mỗi ${WEATHER_CHANGE_INTERVAL_HOURS}h`;

    return msg;
  }

  /**
   * B-06: Get weather forecast (what weather is likely next)
   */
  public getForecast(guildId: string): string {
    const current = this.getCurrentWeather(guildId);
    const totalWeight = Object.values(WEATHERS).reduce((sum, w) => sum + w.rarity, 0);

    let forecast = `**Dự báo thời tiết:**\n`;
    const sorted = Object.values(WEATHERS).sort((a, b) => b.rarity - a.rarity);

    for (const w of sorted) {
      const chance = Math.round((w.rarity / totalWeight) * 100);
      const isCurrent = w.id === current.id;
      forecast += `${w.emoji} ${w.name}: **${chance}%**${isCurrent ? ' ← hiện tại' : ''}\n`;
    }

    return forecast;
  }

  private rollWeather(): WeatherType {
    const totalWeight = Object.values(WEATHERS).reduce((sum, w) => sum + w.rarity, 0);
    let rand = Math.random() * totalWeight;

    for (const weather of Object.values(WEATHERS)) {
      rand -= weather.rarity;
      if (rand <= 0) return weather.id;
    }

    return 'sunny';
  }
}

export const weatherService = new WeatherService();
