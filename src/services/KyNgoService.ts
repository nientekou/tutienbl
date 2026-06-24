import db from '../database/database';
import { KY_NGO_EVENTS, KY_NGO_BASE_CHANCE, KY_NGO_LUCK_BONUS, KY_NGO_MAX_CHANCE, KyNgoEvent, KyNgoChoice, EffectDef } from '../config/kyNgoConstants';
import { cacheService } from './CacheService';

class KyNgoService {
  private COOLDOWN_KEY = 'kyngo_cd:';

  maybeTriggerEvent(userId: string, userLevel: number, luck: number): KyNgoEvent | null {
    const cooldown = cacheService.get<number>(`${this.COOLDOWN_KEY}${userId}`);
    if (cooldown) return null;

    const chance = Math.min(KY_NGO_MAX_CHANCE, KY_NGO_BASE_CHANCE + luck * 0.001);
    if (Math.random() > chance) return null;

    const eligible = KY_NGO_EVENTS.filter(e => userLevel >= e.minRealm);
    if (!eligible.length) return null;

    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
    const roll = Math.random() * totalWeight;
    let cumul = 0;
    for (const evt of eligible) {
      cumul += evt.weight;
      if (roll <= cumul) return evt;
    }
    return null;
  }

  createEvent(userId: string, event: KyNgoEvent): number {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    const info = db.prepare(`
      INSERT INTO ky_ngo_events (user_id, event_type, event_data, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, event.type, JSON.stringify({
      title: event.title,
      description: event.description,
      choices: event.choices.map(c => ({
        id: c.id, label: c.label, riskLevel: c.riskLevel
      }))
    }), expiresAt);
    return info.lastInsertRowid as number;
  }

  resolveChoice(
    eventId: number,
    userId: string,
    choiceId: string,
    luck: number,
    linhCan: string
  ): { success: boolean; message: string; effects: EffectDef[] } {
    const row = db.prepare('SELECT * FROM ky_ngo_events WHERE id = ? AND user_id = ?').get(eventId) as any;
    if (!row || row.completed) return { success: false, message: 'Sự kiện đã kết thúc!', effects: [] };

    const eventDef = KY_NGO_EVENTS.find(e => e.type === row.event_type);
    const fullChoice = eventDef?.choices.find(c => c.id === choiceId);
    if (!fullChoice) return { success: false, message: 'Lựa chọn không hợp lệ!', effects: [] };

    let successRate = fullChoice.successRate;
    successRate += luck * KY_NGO_LUCK_BONUS;

    const linhCanArr = JSON.parse(linhCan || '[]');
    const hoaPct = linhCanArr.find((l: any) => l.element === 'hoa')?.percentage ?? 0;
    if (row.event_type === 'meditation_insight') successRate += hoaPct * 0.001;
    successRate = Math.min(0.95, successRate);

    const success = Math.random() < successRate;
    const effect = success ? fullChoice.successReward : fullChoice.failurePenalty;

    let message: string;
    if (success) {
      message = `✅ **Thành công!** ${this.describeEffect(effect)}`;
    } else {
      message = `❌ **Thất bại!** ${this.describeEffect(effect)}`;
    }

    db.prepare(`
      UPDATE ky_ngo_events SET selected_choice = ?, result_data = ?, completed = 1 WHERE id = ?
    `).run(choiceId, JSON.stringify({ success, message, effect }), eventId);

    cacheService.set(`${this.COOLDOWN_KEY}${userId}`, Date.now(), (eventDef?.cooldownHours ?? 12) * 3600 * 1000);

    return { success, message, effects: [effect] };
  }

  applyEffects(userId: string, effects: EffectDef[]): void {
    for (const eff of effects) {
      switch (eff.type) {
        case 'cultivation_speed':
          db.prepare('UPDATE users SET cultivation_speed_bonus = COALESCE(cultivation_speed_bonus, 0) + ? WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'breakthrough_rate':
          db.prepare('UPDATE users SET breakthrough_bonus = COALESCE(breakthrough_bonus, 0) + ? WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'tu_vi':
          db.prepare('UPDATE users SET tu_vi = MAX(0, tu_vi + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'exp':
          db.prepare('UPDATE users SET exp = MAX(0, exp + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'qi_deviation':
          db.prepare('UPDATE users SET qi_deviation = MIN(100, COALESCE(qi_deviation, 0) + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
      }
    }
  }

  getPendingEvents(userId: string): any[] {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`
      SELECT * FROM ky_ngo_events
      WHERE user_id = ? AND completed = 0 AND expires_at > ?
      ORDER BY created_at DESC
    `).all(userId, now);
  }

  getEventHistory(userId: string, limit = 10): any[] {
    return db.prepare(`
      SELECT * FROM ky_ngo_events
      WHERE user_id = ? AND completed = 1
      ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit);
  }

  private describeEffect(eff: EffectDef): string {
    switch (eff.type) {
      case 'cultivation_speed': return `Tốc độ tu luyện +${eff.value}%${eff.duration ? ` (${eff.duration}h)` : ''}`;
      case 'breakthrough_rate': return `Tỷ lệ đột phá +${eff.value}%`;
      case 'tu_vi': return `${eff.value > 0 ? 'Nhận' : 'Mất'} ${Math.abs(eff.value)} Tu Vi`;
      case 'exp': return `${eff.value > 0 ? 'Nhận' : 'Mất'} ${Math.abs(eff.value)} EXP`;
      case 'qi_deviation': return `Lệch tâm +${eff.value}`;
      default: return '';
    }
  }
}

export const kyNgoService = new KyNgoService();
