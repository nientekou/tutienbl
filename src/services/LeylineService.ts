import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { Client, TextChannel } from 'discord.js';

export type LeylineType = 'tuluyen' | 'chiendau' | 'thuthap' | 'kinhte' | 'tongmon';

export interface LeylineData {
  id: string;
  current_energy: number;
  max_energy: number;
  buff_active_until: number;
  last_decay_at: number;
}

export interface UserLeylineData {
  user_id: string;
  channeling_target: string | null;
  channeling_cooldown: number;
  hourly_contributions: string;
  last_contribution_hour: number;
}

export class LeylineService {
  private discordClient: Client | null = null;

  public init(client: Client) {
    this.discordClient = client;

    // Đăng ký tiến trình chạy ngầm mỗi giờ để trừ năng lượng (Decay)
    setInterval(() => {
      this.processDecay();
    }, 60 * 60 * 1000);

    // B-01: Leyline Surges — check mỗi phút
    setInterval(() => {
      this.checkSurges();
    }, 60 * 1000);

    // Chạy decay lần đầu lúc khởi động
    this.processDecay();
  }

  public getLeyline(id: LeylineType): LeylineData | undefined {
    return db.prepare('SELECT * FROM leylines WHERE id = ?').get(id) as LeylineData | undefined;
  }

  public getAllLeylines(): LeylineData[] {
    return db.prepare('SELECT * FROM leylines').all() as LeylineData[];
  }

  public getUserLeyline(userId: string): UserLeylineData {
    let data = db.prepare('SELECT * FROM user_leylines WHERE user_id = ?').get(userId) as UserLeylineData | undefined;
    if (!data) {
      db.prepare('INSERT INTO user_leylines (user_id) VALUES (?)').run(userId);
      data = db.prepare('SELECT * FROM user_leylines WHERE user_id = ?').get(userId) as UserLeylineData;
    }
    return data;
  }

  public isBuffActive(id: LeylineType): boolean {
    const data = this.getLeyline(id);
    if (!data) return false;
    return data.buff_active_until > Math.floor(Date.now() / 1000);
  }

  public setChanneling(userId: string, target: LeylineType | null): { success: boolean; message: string } {
    const data = this.getUserLeyline(userId);
    const nowSec = Math.floor(Date.now() / 1000);

    if (data.channeling_cooldown > nowSec) {
      const remainMins = Math.ceil((data.channeling_cooldown - nowSec) / 60);
      return { success: false, message: `Thuật dẫn dòng chưa hồi phục. Đạo hữu cần chờ ${remainMins} phút nữa.` };
    }

    db.prepare('UPDATE user_leylines SET channeling_target = ?, channeling_cooldown = ? WHERE user_id = ?')
      .run(target, nowSec + (6 * 3600), userId); // Cooldown 6h

    return { success: true, message: target ? `Đã tập trung dẫn dòng linh khí vào linh mạch **${target}**.` : `Đã hủy dẫn dòng linh khí.` };
  }

  /**
   * Thêm năng lượng vào linh mạch từ các hoạt động của người chơi
   */
  public addEnergy(userId: string, type: LeylineType, baseAmount: number) {
    const user = userRepository.get(userId);
    if (!user) return;

    const data = this.getUserLeyline(userId);
    let targetLeyline = type;
    let amount = Math.round(baseAmount * (1 + (user.level / 100)));

    // Channeling Logic
    if (data.channeling_target) {
      if (data.channeling_target === type) {
        amount = Math.round(amount * 1.5); // +150% nếu đang dẫn dòng vào đúng mạch này
      } else {
        return; // Không nạp vào các mạch khác nếu đang dẫn dòng
      }
    }

    const currentHour = Math.floor(Date.now() / 3600000);
    let hourlyContribs: Record<string, number> = {};

    if (data.last_contribution_hour === currentHour) {
      try { hourlyContribs = JSON.parse(data.hourly_contributions); } catch(e) { console.warn('[LeylineService] Failed to parse hourly_contributions:', e); }
    } else {
      hourlyContribs = {};
    }

    const currentContrib = hourlyContribs[targetLeyline] || 0;
    if (currentContrib >= 100) return; // Đạt giới hạn 100 energy/giờ cho mạch này

    const spaceLeft = 100 - currentContrib;
    const actualAdd = Math.min(amount, spaceLeft);

    hourlyContribs[targetLeyline] = currentContrib + actualAdd;

    db.prepare('UPDATE user_leylines SET hourly_contributions = ?, last_contribution_hour = ? WHERE user_id = ?')
      .run(JSON.stringify(hourlyContribs), currentHour, userId);

    // Nạp vào Leyline
    const leyline = this.getLeyline(targetLeyline);
    if (!leyline) return;

    // Nếu buff đang chạy thì không nạp được
    if (leyline.buff_active_until > Math.floor(Date.now() / 1000)) return;

    db.prepare('UPDATE leylines SET current_energy = MIN(current_energy + ?, max_energy) WHERE id = ?')
      .run(actualAdd, targetLeyline);

    // Kiểm tra và Kích hoạt Buff
    this.checkAndActivateBuff(targetLeyline);
  }

  private checkAndActivateBuff(id: LeylineType) {
    const data = this.getLeyline(id);
    if (!data) return;

    if (data.current_energy >= data.max_energy && data.buff_active_until <= Math.floor(Date.now() / 1000)) {
      const nowSec = Math.floor(Date.now() / 1000);
      const expire = nowSec + (2 * 3600); // Buff 2h
      db.prepare('UPDATE leylines SET buff_active_until = ?, current_energy = 0 WHERE id = ?').run(expire, id);

      // Gửi thông báo đến kênh world event (nếu có thể)
      this.announceBuff(id);
    }
  }

  private announceBuff(id: LeylineType) {
    if (!this.discordClient) return;
    
    const names: Record<string, string> = {
      'tuluyen': 'Tu Luyện (+20% EXP)',
      'chiendau': 'Chiến Đấu (+10% ATK)',
      'thuthap': 'Thu Thập (+25% Tỷ lệ Rơi Đồ)',
      'kinhte': 'Kinh Tế (-10% Phí Chợ Trời)',
      'tongmon': 'Tông Môn (+15% Điểm Cống Hiến)'
    };

    const msg = `🌟 **[LINH MẠCH ĐỊA ĐỒ]** Năng lượng Linh mạch **${names[id] || id}** đã tích tụ đến cực hạn và bùng nổ!\nToàn bộ tu sĩ trên đại lục sẽ nhận được phúc khí trong **2 giờ** tới!`;

    // Gửi tin nhắn vào kênh global event của tất cả guild (Giả lập)
    try {
      const configs = db.prepare('SELECT guild_id, event_channel_id FROM guild_configs WHERE event_channel_id IS NOT NULL').all() as any[];
      configs.forEach(conf => {
        const guild = this.discordClient!.guilds.cache.get(conf.guild_id);
        if (guild) {
          const channel = guild.channels.cache.get(conf.event_channel_id) as TextChannel;
          if (channel) channel.send(msg).catch(()=>null);
        }
      });
    } catch(e) {
      console.error('Announce Leyline Buff Error:', e);
    }
  }

  private processDecay() {
    const leylines = this.getAllLeylines();
    const nowSec = Math.floor(Date.now() / 1000);

    for (const l of leylines) {
      // Nếu buff đang chạy, không bị decay
      if (l.buff_active_until > nowSec) continue;

      // Decay sau 12h không đầy (tăng gấp đôi tốc độ decay từ 24h xuống 12h)
      if (nowSec - l.last_decay_at >= 12 * 3600) {
        const decayAmount = Math.floor(l.max_energy * 0.2);
        db.prepare('UPDATE leylines SET current_energy = MAX(0, current_energy - ?), last_decay_at = ? WHERE id = ?')
          .run(decayAmount, nowSec, l.id);
      }
    }
  }

  /**
   * Kiểm tra xem người chơi có linh căn hợp hệ với linh mạch đang buff không
   * Tu Luyện -> Mộc, Chiến Đấu -> Hỏa, Thu Thập -> Thủy, Kinh Tế -> Kim, Tông Môn -> Thổ
   */
  public isLeylineElementMatch(linhCanJson?: string): boolean {
    if (!linhCanJson) return false;
    const mapping: Record<LeylineType, string> = {
      'tuluyen': 'Mộc',
      'chiendau': 'Hỏa',
      'thuthap': 'Thủy',
      'kinhte': 'Kim',
      'tongmon': 'Thổ'
    };

    try {
      const linhCan = JSON.parse(linhCanJson || '{}');
      for (const [key, element] of Object.entries(mapping)) {
        if (this.isBuffActive(key as LeylineType) && linhCan[element]) {
          return true; // Có linh căn khớp với linh mạch đang buff
        }
      }
    } catch (e) {
      // Ignored
    }
    return false;
  }

  // === B-01: Leyline Surges & History ===

  private surgeTableInit = false;

  private initSurgeTable(): void {
    if (this.surgeTableInit) return;
    db.exec(`
      CREATE TABLE IF NOT EXISTS leyline_surges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leyline_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        was_contaminated INTEGER DEFAULT 0
      );
    `);
    this.surgeTableInit = true;
  }

  /**
   * B-01: Check and trigger leyline surges every 4h
   */
  private checkSurges(): void {
    this.initSurgeTable();
    const now = Math.floor(Date.now() / 1000);
    const fourHoursAgo = now - 4 * 3600;

    // Check if there's an active surge
    const activeSurge = db.prepare('SELECT * FROM leyline_surges WHERE ends_at > ? LIMIT 1').get(now) as any;
    if (activeSurge) return; // Surge still active

    // Check last surge time
    const lastSurge = db.prepare('SELECT * FROM leyline_surges ORDER BY started_at DESC LIMIT 1').get() as any;
    if (lastSurge && (now - lastSurge.started_at) < 4 * 3600) return; // Too soon

    // Roll random leyline for surge
    const leylines: LeylineType[] = ['tuluyen', 'chiendau', 'thuthap', 'kinhte', 'tongmon'];
    const surgeLeyline = leylines[Math.floor(Math.random() * leylines.length)];
    const surgeEnd = now + 30 * 60; // 30 minutes

    db.prepare('INSERT INTO leyline_surges (leyline_id, started_at, ends_at) VALUES (?, ?, ?)')
      .run(surgeLeyline, now, surgeEnd);

    // 10% chance of contamination
    if (Math.random() < 0.10) {
      db.prepare('UPDATE leyline_surges SET was_contaminated = 1 WHERE started_at = ?').run(now);
    }

    // Announce surge
    const names: Record<string, string> = {
      'tuluyen': 'Tu Luyện', 'chiendau': 'Chiến Đấu', 'thuthap': 'Thu Thập',
      'kinhte': 'Kinh Tế', 'tongmon': 'Tông Môn'
    };
    const isContaminated = Math.random() < 0.10;
    const msg = `⚡ **[LINH MẠCH DÂNG TRÀO]** Linh mạch **${names[surgeLeyline]}** đang surging!\n` +
      `🔥 **x2 contribution reward** trong **30 phút**!\n` +
      (isContaminated ? `⚠️ **CẢNH BÁO:** Linh mạch có dấu hiệu ô nhiễm!` : '');

    try {
      const configs = db.prepare('SELECT guild_id, event_channel_id FROM guild_configs WHERE event_channel_id IS NOT NULL').all() as any[];
      configs.forEach(conf => {
        const guild = this.discordClient?.guilds.cache.get(conf.guild_id);
        if (guild) {
          const channel = guild.channels.cache.get(conf.event_channel_id) as TextChannel;
          if (channel) channel.send(msg).catch(() => null);
        }
      });
    } catch {}
  }

  /**
   * B-01: Check if a leyline is currently surging (double rewards)
   */
  public isSurging(leylineId: LeylineType): boolean {
    this.initSurgeTable();
    const now = Math.floor(Date.now() / 1000);
    const surge = db.prepare('SELECT * FROM leyline_surges WHERE leyline_id = ? AND ends_at > ? LIMIT 1')
      .get(leylineId, now) as any;
    return !!surge;
  }

  /**
   * B-01: Get surge multiplier (2x during surge)
   */
  public getSurgeMultiplier(leylineId: LeylineType): number {
    return this.isSurging(leylineId) ? 2.0 : 1.0;
  }

  /**
   * B-01: Get leyline history (last 7 days)
   */
  public getLeylineHistory(): { date: string; leylines: Record<string, number> }[] {
    this.initSurgeTable();
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const surges = db.prepare('SELECT * FROM leyline_surges WHERE started_at > ? ORDER BY started_at ASC')
      .all(sevenDaysAgo) as any[];

    const history: Record<string, Record<string, number>> = {};
    for (const s of surges) {
      const date = new Date(s.started_at * 1000).toISOString().slice(0, 10);
      if (!history[date]) history[date] = {};
      history[date][s.leyline_id] = (history[date][s.leyline_id] || 0) + 1;
    }

    return Object.entries(history).map(([date, leylines]) => ({ date, leylines }));
  }

  /**
   * B-01: Get leyline prediction based on history
   */
  public getPrediction(): string {
    const history = this.getLeylineHistory();
    const leylines: LeylineType[] = ['tuluyen', 'chiendau', 'thuthap', 'kinhte', 'tongmon'];
    const counts: Record<string, number> = {};
    let total = 0;

    for (const h of history) {
      for (const [l, c] of Object.entries(h.leylines)) {
        counts[l] = (counts[l] || 0) + c;
        total += c;
      }
    }

    if (total === 0) return '📊 Chưa đủ dữ liệu dự báo.';

    const names: Record<string, string> = {
      'tuluyen': 'Tu Luyện', 'chiendau': 'Chiến Đấu', 'thuthap': 'Thu Thập',
      'kinhte': 'Kinh Tế', 'tongmon': 'Tông Môn'
    };

    let prediction = `**Dự báo Leyline (7 ngày qua):**\n`;
    for (const l of leylines) {
      const pct = Math.round(((counts[l] || 0) / total) * 100);
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      prediction += `${names[l]}: ${bar} **${pct}%**\n`;
    }

    return prediction;
  }
}

export const leylineService = new LeylineService();
