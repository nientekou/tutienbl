import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-02: Alliance System Deep

interface Alliance {
  id: number;
  name: string;
  leader_sect_id: number;
  member_sects: number[];
  created_at: number;
  status: 'active' | 'disbanded';
}

class AllianceService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alliances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        leader_sect_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS alliance_members (
        alliance_id INTEGER NOT NULL,
        sect_id INTEGER NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY(alliance_id, sect_id)
      );

      CREATE TABLE IF NOT EXISTS alliance_wars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alliance1_id INTEGER NOT NULL,
        alliance2_id INTEGER NOT NULL,
        winner_id INTEGER,
        status TEXT DEFAULT 'pending',
        start_time INTEGER,
        end_time INTEGER,
        created_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * B-02: Create alliance
   */
  createAlliance(userId: string, name: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) return { success: false, message: '❌ Must be in a sect!' };

    // Check if already in alliance
    const existing = db.prepare('SELECT * FROM alliance_members WHERE sect_id = ?').get(user.sect_id);
    if (existing) return { success: false, message: '❌ Sect already in an alliance!' };

    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare('INSERT INTO alliances (name, leader_sect_id, created_at) VALUES (?, ?, ?)')
      .run(name, user.sect_id, now);

    db.prepare('INSERT INTO alliance_members (alliance_id, sect_id, joined_at) VALUES (?, ?, ?)')
      .run(result.lastInsertRowid, user.sect_id, now);

    return { success: true, message: `🤝 Alliance **${name}** created!` };
  }

  /**
   * B-02: Join alliance
   */
  joinAlliance(userId: string, allianceId: number): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) return { success: false, message: '❌ Must be in a sect!' };

    const alliance = db.prepare('SELECT * FROM alliances WHERE id = ? AND status = ?').get(allianceId, 'active') as any;
    if (!alliance) return { success: false, message: '❌ Alliance not found!' };

    const existing = db.prepare('SELECT * FROM alliance_members WHERE sect_id = ?').get(user.sect_id);
    if (existing) return { success: false, message: '❌ Sect already in an alliance!' };

    const memberCount = db.prepare('SELECT COUNT(*) as c FROM alliance_members WHERE alliance_id = ?').get(allianceId) as { c: number };
    if (memberCount.c >= 5) return { success: false, message: '❌ Alliance full (max 5 sects)!' };

    db.prepare('INSERT INTO alliance_members (alliance_id, sect_id, joined_at) VALUES (?, ?, ?)')
      .run(allianceId, user.sect_id, Math.floor(Date.now() / 1000));

    return { success: true, message: `🤝 Joined alliance **${alliance.name}**!` };
  }

  /**
   * B-02: Get alliance info
   */
  getAllianceInfo(allianceId: number): { name: string; members: { sectId: number; sectName: string }[]; createdAt: number } | null {
    this.initTable();
    const alliance = db.prepare('SELECT * FROM alliances WHERE id = ?').get(allianceId) as any;
    if (!alliance) return null;

    const members = db.prepare('SELECT am.sect_id, s.name FROM alliance_members am JOIN sects s ON am.sect_id = s.id WHERE am.alliance_id = ?')
      .all(allianceId) as { sect_id: number; name: string }[];

    return {
      name: alliance.name,
      members: members.map(m => ({ sectId: m.sect_id, sectName: m.name })),
      createdAt: alliance.created_at
    };
  }

  /**
   * B-02: Get user's alliance
   */
  getUserAlliance(userId: string): { allianceId: number; allianceName: string; sectName: string } | null {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) return null;

    const row = db.prepare(`
      SELECT a.id as alliance_id, a.name as alliance_name, s.name as sect_name
      FROM alliance_members am
      JOIN alliances a ON am.alliance_id = a.id
      JOIN sects s ON am.sect_id = s.id
      WHERE am.sect_id = ? AND a.status = 'active'
    `).get(user.sect_id) as any;

    return row || null;
  }

  /**
   * B-02: Create alliance war
   */
  createAllianceWar(alliance1Id: number, alliance2Id: number): { success: boolean; message: string } {
    this.initTable();

    const a1 = db.prepare('SELECT * FROM alliances WHERE id = ? AND status = ?').get(alliance1Id, 'active') as any;
    const a2 = db.prepare('SELECT * FROM alliances WHERE id = ? AND status = ?').get(alliance2Id, 'active') as any;

    if (!a1 || !a2) return { success: false, message: '❌ Alliance not found!' };

    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO alliance_wars (alliance1_id, alliance2_id, status, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(alliance1Id, alliance2Id, 'active', now, now + 7 * 86400, now);

    return { success: true, message: `⚔️ Alliance War started: ${a1.name} vs ${a2.name}!` };
  }

  /**
   * B-02: Get alliance description for UI
   */
  getAllianceDescription(userId: string): string {
    const alliance = this.getUserAlliance(userId);
    if (!alliance) return '❌ Chưa có Alliance!';

    let msg = `🤝 **Alliance: ${alliance.allianceName}**\n`;
    msg += `📜 Sect: ${alliance.sectName}\n`;

    const info = this.getAllianceInfo(alliance.allianceId);
    if (info) {
      msg += `\n**Thành viên:**\n`;
      for (const m of info.members) {
        msg += `• ${m.sectName}\n`;
      }
    }

    return msg;
  }
}

export const allianceService = new AllianceService();
