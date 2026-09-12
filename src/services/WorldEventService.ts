import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { leylineService } from './LeylineService';
import { TuTienClient } from '../client/TuTienClient';
import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../utils/uiSystem';
import { broadcastService } from './BroadcastService';

// A-01: Dynamic World Events

type EventType = 'world_boss' | 'leyline_surge' | 'thien_kiep' | 'seasonal' | 'thien_ha_dai_chien';

interface WorldEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  status: 'active' | 'ended';
  rewards: string;
}

const EVENT_DEFINITIONS: Record<EventType, { name: string; description: string; duration: number; rewards: string }> = {
  world_boss: {
    name: 'Thiên Ngoại Dị Thú',
    description: 'Thiên địa chợt rung chuyển, dị thú từ ngoài cõi giáng thế. Yêu khí cuồn cuộn, sát cơ phủ kín một phương. Chư vị đạo hữu, hãy hợp lực trừ họa!',
    duration: 30 * 60,
    rewards: 'Người lập đại công: Kỳ trân dị bảo + CPLT\nChư tu sĩ tham chiến: Tu vi + Linh Thạch'
  },
  leyline_surge: {
    name: 'Linh Triều Dâng Thế',
    description: 'Địa mạch chuyển mình, linh khí trong thiên hạ cuồn cuộn dâng trào. Trong thời khắc này, người thuận thế mà tu, tất được thiên địa trợ lực.',
    duration: 15 * 60,
    rewards: 'Mọi hoạt động nhận **x3** Cống Hiến'
  },
  thien_kiep: {
    name: 'Thiên Kiếp Lâm Thế',
    description: 'Lôi vân tụ đỉnh, thiên uy giáng thế. Có một vị Đạo Hữu đang đứng trước cửa ải sinh tử của mình. Thiên kiếp đã mở, người ngoài không thể thay thế, chỉ có thể đứng bên cầu nguyện.',
    duration: 10 * 60,
    rewards: 'Nếu vượt kiếp: Tu vi nhận +50% trong 1 giờ\nNếu độ kiếp thất bại: Tu vi nhận -20% trong 30 phút'
  },
  seasonal: {
    name: 'Thiên Thời Luân Chuyển',
    description: 'Xuân thu thay đổi, thiên thời luân chuyển. Khí vận một phương theo đó mà thịnh, vạn vật cũng được thiên địa ban thêm một phần cơ duyên.',
    duration: 60 * 60,
    rewards: 'Mọi hoạt động nhận **x2** phần thưởng'
  },
  // V16 C-04: Thiên Hạ Đại Chiến — monthly 72-hour server-wide competition
  thien_ha_dai_chien: {
    name: 'Thiên Hạ Tranh Phong',
    description: 'Thiên hạ phong vân nổi sóng, chư phương thế lực cùng hội tụ. Một trận tranh phong, luận thực lực, đo khí vận. Ai có thể áp quần hùng, danh chấn Thương Mang?',
    duration: 72 * 60 * 60,
    rewards: 'Đệ Nhất: Danh hiệu "Thiên Hạ Vô Địch" + 500 CPLT\nTam Cường: 300 CPLT + Kỳ trân dị bảo\nThập Cường: 100 CPLT + Thiên tài địa bảo'
  }
};

class WorldEventService {
  private client: TuTienClient | null = null;
  private schedulerInterval: NodeJS.Timeout | null = null;

  public startScheduler(client: TuTienClient): void {
    this.client = client;
    if (this.schedulerInterval) return;
    this.schedulerInterval = setInterval(() => {
      try {
        this.checkAndTriggerEvents();
      } catch (err) {
        console.error('[WorldEventService] Scheduler error:', err);
      }
    }, 60_000);
  }

  private initTable(): void {
    db.exec(`
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
   * V16 C-04: Also checks/schedules Thiên Hạ Đại Chiến monthly
   */
  checkAndTriggerEvents(): WorldEvent[] {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const triggered: WorldEvent[] = [];

    // End expired events (especially the 72h Thiên Hạ Đại Chiến)
    const endedEvents = db.prepare(
      "SELECT * FROM world_events WHERE status = 'active' AND end_time <= ?"
    ).all(now) as WorldEvent[];
    for (const e of endedEvents) {
      db.prepare("UPDATE world_events SET status = 'ended' WHERE id = ?").run(e.id);
      if (e.type === 'thien_ha_dai_chien') this.endThienHaDaiChien(e);
    }

    // Check if any active event remains
    const activeEvent = db.prepare("SELECT * FROM world_events WHERE status = 'active' AND end_time > ? LIMIT 1").get(now) as WorldEvent | undefined;
    if (activeEvent) return [];

    // V16 C-04: Schedule Thiên Hạ Đại Chiến on the 1st of every month
    const vnDate = new Date(now * 1000 + 7 * 3600000);
    const dayOfMonth = vnDate.getUTCDate();
    const monthStart = new Date(Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), 1, 0, 0, 0));
    const monthStartTs = Math.floor(monthStart.getTime() / 1000);
    const alreadyTriggeredThisMonth = db.prepare(
      "SELECT id FROM world_events WHERE type = 'thien_ha_dai_chien' AND start_time >= ? LIMIT 1"
    ).get(monthStartTs);

    if (dayOfMonth === 1 && !alreadyTriggeredThisMonth) {
      const eventId = `thien_ha_dai_chien_${monthStartTs}`;
      const def = EVENT_DEFINITIONS.thien_ha_dai_chien;
      db.prepare(`
        INSERT INTO world_events (id, type, name, description, start_time, end_time, status, rewards, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(eventId, 'thien_ha_dai_chien', def.name, def.description, now, now + def.duration, def.rewards, now);

      const event: WorldEvent = {
        id: eventId, type: 'thien_ha_dai_chien', name: def.name,
        description: def.description, startTime: now,
        endTime: now + def.duration, status: 'active', rewards: def.rewards
      };
      triggered.push(event);
      this.announceEvent(event);
      return triggered;
    }

    // Roll for new event (10% chance per check)
    if (Math.random() > 0.10) return [];

    // Choose event type
    const eventTypes: EventType[] = ['world_boss', 'leyline_surge', 'thien_kiep', 'seasonal'];
    const weights = [30, 40, 20, 10]; // Probability weights
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * totalWeight;
    let eventType: EventType = 'leyline_surge';

    for (let i = 0; i < eventTypes.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        eventType = eventTypes[i];
        break;
      }
    }

    const def = EVENT_DEFINITIONS[eventType];
    const eventId = `event_${now}_${eventType}`;

    db.prepare(`
      INSERT INTO world_events (id, type, name, description, start_time, end_time, status, rewards, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(eventId, eventType, def.name, def.description, now, now + def.duration, def.rewards, now);

    const event: WorldEvent = {
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
  getActiveEvent(): WorldEvent | null {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    return db.prepare("SELECT * FROM world_events WHERE status = 'active' AND end_time > ? LIMIT 1")
      .get(now) as WorldEvent | null;
  }

  /**
   * A-01: Participate in event
   */
  participate(userId: string, contribution: number = 100): { success: boolean; message: string } {
    this.initTable();
    const event = this.getActiveEvent();
    if (!event) return { success: false, message: '❌ Không có sự kiện nào đang diễn ra!' };

    const existing = db.prepare('SELECT * FROM world_event_participants WHERE event_id = ? AND user_id = ?')
      .get(event.id, userId) as any;

    if (existing) {
      db.prepare('UPDATE world_event_participants SET contribution = contribution + ? WHERE event_id = ? AND user_id = ?')
        .run(contribution, event.id, userId);
    } else {
      db.prepare('INSERT INTO world_event_participants (event_id, user_id, contribution) VALUES (?, ?, ?)')
        .run(event.id, userId, contribution);
    }

    return { success: true, message: `🎯 Đã đóng góp **${contribution}** vào sự kiện **${event.name}**!` };
  }

  /**
   * A-01: Get event leaderboard
   */
  getEventLeaderboard(eventId: string, limit: number = 10): { userId: string; name: string; contribution: number }[] {
    this.initTable();
    const rows = db.prepare(`
      SELECT wep.*, u.name FROM world_event_participants wep
      JOIN users u ON wep.user_id = u.discord_id
      WHERE wep.event_id = ?
      ORDER BY wep.contribution DESC
      LIMIT ?
    `).all(eventId, limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      contribution: r.contribution
    }));
  }

  /**
   * A-01: Get event description
   */
  getEventDescription(): string {
    const event = this.getActiveEvent();
    if (!event) return '<:thongbao:1547880257279889450> Hiện tại không có sự kiện nào đang diễn ra.';

    const timeLeft = Math.max(0, event.endTime - Math.floor(Date.now() / 1000));
    const minutes = Math.floor(timeLeft / 60);

    let msg = `<:thongbao:1547880257279889450> **SỰ KIỆN ĐANG DIỄN RA!**\n`;
    msg += `<:thongbao:1547880257279889450> **${event.name}**\n`;
    msg += `${event.description}\n\n`;
    msg += `⏰ Còn **${minutes}** phút\n`;
    msg += `<:qua4:1547881540372009021> **Phần thưởng:** ${event.rewards}\n`;
    msg += `\n*Dùng \`/sukien donggop\` để đóng góp!*`;

    return msg;
  }

  /**
   * A-01: Announce event to all guilds
   */
  private async announceEvent(event: WorldEvent): Promise<void> {
    console.log(`<:thongbao:1547880257279889450> [SỰ KIỆN THẾ GIỚI] ${event.name}: ${event.description}`);

    if (!this.client) return;

    const guilds = db.prepare('SELECT guild_id FROM guild_configs WHERE event_channel_id IS NOT NULL OR guide_channel_id IS NOT NULL').all() as any[];
    const embed = new EmbedBuilder()
      .setTitle(`<:thongbao:1547880257279889450> ${event.name}`)
      .setDescription(event.description)
      .addFields(
        { name: '⏰ Thời gian', value: `${Math.floor((event.endTime - event.startTime) / 60)} phút`, inline: true },
        { name: '<:qua4:1547881540372009021> Phần thưởng', value: event.rewards, inline: false }
      )
      .setColor(EMBED_COLORS.GOLD)
      .setTimestamp();

    for (const g of guilds) {
      await broadcastService.broadcast(this.client, g.guild_id, embed);
    }
  }

  /**
   * A-01: Get event history
   */
  getEventHistory(limit: number = 10): WorldEvent[] {
    this.initTable();
    return db.prepare('SELECT * FROM world_events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as WorldEvent[];
  }

  // === B-06: Event System Deep ===

  /**
   * B-06: Get more event types
   */
  getMoreEventTypes(): { id: string; name: string; description: string; duration: number; rewards: string }[] {
    return [
      { id: 'fishing_contest', name: 'Triều Sinh Tranh Ngư', description: 'Triều dâng sinh vạn tượng, kỳ ngư theo dòng mà xuất thế. Ai có thể câu được linh ngư lớn nhất, người ấy sẽ đứng đầu bảng hôm nay.', duration: 60 * 60, rewards: 'Cá + CPLT' },
      { id: 'treasure_hunt', name: 'Tầm Bảo Thiên Cơ', description: 'Thiên cơ chợt hiện, bảo vật thất lạc năm xưa lần lượt lộ dấu. Cơ duyên đã đến, chỉ xem ai đủ bản lĩnh tìm ra trước.!', duration: 30 * 60, rewards: 'Vật phẩm hiếm + Linh Thạch' },
      { id: 'pvp_tournament', name: 'Quần Hùng Tranh Phong', description: 'Quần hùng hội tụ, chư phương tranh phong. Một trận luận cao thấp, một kiếm định danh giữa Thương Mang.', duration: 120 * 60, rewards: 'Danh hiệu + CPLT' },
      { id: 'crafting_marathon', name: 'Bách Luyện Đấu Khí', description: 'Lô hỏa không tắt, khí phôi liên thành. Đây là lúc các vị luyện khí sư phô bày tạo nghệ, xem ai có thể luyện thành nhiều pháp vật nhất.', duration: 60 * 60, rewards: 'Nguyên liệu chế tạo + Tu Vi' },
    ];
  }

  /**
   * B-06: Get event calendar
   */
  getEventCalendar(): { date: string; events: string[] }[] {
    const calendar: { date: string; events: string[] }[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * 86400000);
      const vn = new Date(date.getTime() + 7 * 3600000);
      const dateStr = vn.toISOString().slice(0, 10);

      const events: string[] = [];
      if (i === 0) events.push('Xoay Vòng Hàng Ngày');
      if (i === 1) events.push('Làm Mới Hàng Tuần');
      if (i === 3) events.push('Chiến Tranh Tông Môn');
      if (i === 5) events.push('Giải Đấu Hàng Tuần');

      calendar.push({ date: dateStr, events });
    }

    return calendar;
  }

  /**
   * V16 C-04: End Thiên Hạ Đại Chiến — distribute rewards to top contributors
   */
  private endThienHaDaiChien(event: WorldEvent): void {
    const participants = db.prepare(`
      SELECT wep.*, u.name FROM world_event_participants wep
      JOIN users u ON wep.user_id = u.discord_id
      WHERE wep.event_id = ? AND wep.claimed = 0
      ORDER BY wep.contribution DESC
      LIMIT 10
    `).all(event.id) as any[];

    if (participants.length === 0) return;

    db.transaction(() => {
      participants.forEach((p, idx) => {
        const rank = idx + 1;
        let coins = 0;
        let knb = 0;
        let bonusNgotinh = 0;

        if (rank === 1) { coins = 10000; knb = 500; bonusNgotinh = 200; }
        else if (rank <= 3) { coins = 5000; knb = 300; bonusNgotinh = 100; }
        else if (rank <= 10) { coins = 2000; knb = 100; bonusNgotinh = 50; }

        userRepository.update(p.user_id, {
          coin_ha_pham: (p.coin_ha_pham || 0) + coins,
          knb: (p.knb || 0) + knb,
          ngotinh: (p.ngotinh || 0) + bonusNgotinh,
        });
        db.prepare("UPDATE world_event_participants SET claimed = 1 WHERE id = ?").run(p.id);
      });
    })();

    console.log(`🏆 [Thiên Hạ Đại Chiến] Đã kết thúc, ${participants.length} người nhận thưởng.`);
  }

  /**
   * B-06: Get event description for UI
   */
  getEventDeepDescription(): string {
    let msg = `<:thongbao:1547880257279889450> **Sự Kiện Thế Giới**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    const active = this.getActiveEvent();
    if (active) {
      const timeLeft = Math.max(0, active.endTime - Math.floor(Date.now() / 1000));
      msg += `<:thongbao:1547880257279889450> **Đang hoạt động:** ${active.name} (${Math.floor(timeLeft / 60)}p)\n`;
    } else {
      msg += `<:thongbao:1547880257279889450> Không có sự kiện nào đang hoạt động\n`;
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

export const worldEventService = new WorldEventService();
