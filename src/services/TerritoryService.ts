// V17 C-02: Territorial Conquest (Trận Chiến Chiếm Thành)
import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { sectService } from './SectService';

interface Territory {
  id: string;
  name: string;
  description: string;
  bonus: string;
  bonusStat: { stat: string; value: number };
}

const TERRITORIES: Territory[] = [
  { id: 'linh_tien_son', name: 'Linh Tiên Sơn', description: 'Sản sinh Linh Thạch', bonus: '+20% LT từ daily quest', bonusStat: { stat: 'coin_ha_pham', value: 0.2 }, },
  { id: 'ma_than_dien', name: 'Ma Thần Điện', description: 'Tăng ATK', bonus: '+10% ATK', bonusStat: { stat: 'base_atk', value: 0.1 }, },
  { id: 'van_thao_cac', name: 'Vạn Thảo Các', description: 'Sản sinh Thảo Dược quý', bonus: '+20% herb drop rate', bonusStat: { stat: 'herb_drop', value: 0.2 }, },
];

class TerritoryService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS territory_control (
        territory_id TEXT PRIMARY KEY,
        guild_id INTEGER,
        claimed_at INTEGER NOT NULL,
        war_scheduled INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS territory_war_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        territory_id TEXT NOT NULL,
        guild_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        damage INTEGER DEFAULT 0,
        healed INTEGER DEFAULT 0,
        UNIQUE(territory_id, user_id)
      );
    `);
  }

  public getTerritories(): Territory[] {
    return TERRITORIES;
  }

  public getControlStatus(): { territory: Territory; controller: { guildId: number; name: string } | null }[] {
    this.initTable();
    return TERRITORIES.map(t => {
      const row = db.prepare('SELECT * FROM territory_control WHERE territory_id = ?').get(t.id) as any;
      if (!row || !row.guild_id) {
        return { territory: t, controller: null };
      }
      const guild = db.prepare('SELECT name FROM sects WHERE id = ?').get(row.guild_id) as { name: string } | undefined;
      return { territory: t, controller: guild ? { guildId: row.guild_id, name: guild.name } : null };
    });
  }

  public claimTerritory(territoryId: string, guildId: number): { success: boolean; message: string } {
    this.initTable();
    const existing = db.prepare('SELECT * FROM territory_control WHERE territory_id = ?').get(territoryId) as any;
    if (existing?.guild_id) return { success: false, message: '❌ Thánh địa đã có chủ.' };
    db.prepare('INSERT INTO territory_control (territory_id, guild_id, claimed_at) VALUES (?, ?, ?) ON CONFLICT(territory_id) DO UPDATE SET guild_id = ?, claimed_at = ?')
      .run(territoryId, guildId, Math.floor(Date.now() / 1000), guildId, Math.floor(Date.now() / 1000));
    return { success: true, message: `✅ Chiếm lĩnh thành công!` };
  }

  public joinWar(territoryId: string, userId: string, guildId: number): { success: boolean; message: string } {
    this.initTable();
    const existing = db.prepare('SELECT * FROM territory_war_participants WHERE territory_id = ? AND user_id = ?')
      .get(territoryId, userId) as any;
    if (existing) return { success: false, message: '❌ Đã tham gia trận này.' };
    db.prepare('INSERT INTO territory_war_participants (territory_id, guild_id, user_id) VALUES (?, ?, ?)')
      .run(territoryId, guildId, userId);
    return { success: true, message: '✅ Đã ghi danh tham gia chiến trường!' };
  }

  public recordDamage(territoryId: string, userId: string, damage: number): void {
    db.prepare('UPDATE territory_war_participants SET damage = damage + ? WHERE territory_id = ? AND user_id = ?')
      .run(damage, territoryId, userId);
  }

  public getWarResults(territoryId: string): { winnerGuildId: number | null; topContributors: { userId: string; damage: number }[] } {
    this.initTable();
    const participants = db.prepare(
      'SELECT guild_id, user_id, SUM(damage) as total_damage FROM territory_war_participants WHERE territory_id = ? GROUP BY guild_id ORDER BY total_damage DESC'
    ).all(territoryId) as any[];
    if (participants.length === 0) return { winnerGuildId: null, topContributors: [] };
    const winner = participants[0];
    const topContributors = db.prepare(
      'SELECT user_id, damage FROM territory_war_participants WHERE territory_id = ? ORDER BY damage DESC LIMIT 5'
    ).all(territoryId) as any[];
    return { winnerGuildId: winner.guild_id, topContributors };
  }

  public getTerritoryBonuses(userId: string, guildId: number | null): Record<string, number> {
    if (!guildId) return {};
    const controlled = this.getControlStatus().filter(c => c.controller?.guildId === guildId);
    const bonuses: Record<string, number> = {};
    for (const c of controlled) {
      bonuses[c.territory.bonusStat.stat] = (bonuses[c.territory.bonusStat.stat] || 0) + c.territory.bonusStat.value;
    }
    return bonuses;
  }

  public getDescription(): string {
    const status = this.getControlStatus();
    let msg = '🏰 **Trận Chiến Chiếm Thành**\n\n';
    for (const s of status) {
      const controllerText = s.controller ? `**${s.controller.name}** (ID: ${s.controller.guildId})` : '*Vô chủ*';
      msg += `${s.territory.name}: ${controllerText}\n└ ${s.territory.description}\n`;
    }
    msg += '\nChiến trường mở cửa 21:00 Chủ Nhật hằng tuần.';
    return msg;
  }
}

export const territoryService = new TerritoryService();
