import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// C-01: Player Guilds System

interface PlayerGuild {
  id: number;
  name: string;
  leaderId: string;
  description: string;
  createdAt: number;
}

class PlayerGuildService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_guilds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        leader_id TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_guild_members (
        guild_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        PRIMARY KEY(guild_id, user_id)
      );
    `);
  }

  /**
   * C-01: Create player guild
   */
  createGuild(userId: string, name: string, description: string = ''): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'User not found' };

    // Check if already in a guild
    const existing = db.prepare('SELECT * FROM player_guild_members WHERE user_id = ?').get(userId);
    if (existing) return { success: false, message: 'Already in a guild!' };

    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare('INSERT INTO player_guilds (name, leader_id, description, created_at) VALUES (?, ?, ?, ?)')
      .run(name, userId, description, now);

    db.prepare('INSERT INTO player_guild_members (guild_id, user_id, joined_at, role) VALUES (?, ?, ?, ?)')
      .run(result.lastInsertRowid, userId, now, 'leader');

    return { success: true, message: `Guild **${name}** created!` };
  }

  /**
   * C-01: Join player guild
   */
  joinGuild(userId: string, guildId: number): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'User not found' };

    const existing = db.prepare('SELECT * FROM player_guild_members WHERE user_id = ?').get(userId);
    if (existing) return { success: false, message: 'Already in a guild!' };

    const guild = db.prepare('SELECT * FROM player_guilds WHERE id = ?').get(guildId) as PlayerGuild;
    if (!guild) return { success: false, message: 'Guild not found!' };

    const memberCount = db.prepare('SELECT COUNT(*) as c FROM player_guild_members WHERE guild_id = ?').get(guildId) as { c: number };
    if (memberCount.c >= 20) return { success: false, message: 'Guild full (max 20)!' };

    db.prepare('INSERT INTO player_guild_members (guild_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(guildId, userId, Math.floor(Date.now() / 1000));

    return { success: true, message: `Joined guild **${guild.name}**!` };
  }

  /**
   * C-01: Get guild info
   */
  getGuildInfo(guildId: number): { name: string; leader: string; members: number; description: string } | null {
    this.initTable();
    const guild = db.prepare('SELECT * FROM player_guilds WHERE id = ?').get(guildId) as PlayerGuild;
    if (!guild) return null;

    const leader = userRepository.get(guild.leaderId);
    const memberCount = db.prepare('SELECT COUNT(*) as c FROM player_guild_members WHERE guild_id = ?').get(guildId) as { c: number };

    return {
      name: guild.name,
      leader: leader?.name || 'Unknown',
      members: memberCount.c,
      description: guild.description
    };
  }

  /**
   * C-01: Get user's guild
   */
  getUserGuild(userId: string): { guildId: number; guildName: string; role: string } | null {
    this.initTable();
    const member = db.prepare(`
      SELECT pgm.guild_id, pg.name, pgm.role
      FROM player_guild_members pgm
      JOIN player_guilds pg ON pgm.guild_id = pg.id
      WHERE pgm.user_id = ?
    `).get(userId) as any;

    return member || null;
  }

  /**
   * C-01: Get guild description
   */
  getGuildDescription(userId: string): string {
    const guild = this.getUserGuild(userId);
    if (!guild) return '❌ Chưa có Guild!';

    let msg = `🏰 **Guild: ${guild.guildName}**\n`;
    msg += `👑 Role: ${guild.role}\n`;

    const info = this.getGuildInfo(guild.guildId);
    if (info) {
      msg += `📊 Members: ${info.members}/20\n`;
      msg += `📝 ${info.description || 'No description'}\n`;
    }

    return msg;
  }
}

export const playerGuildService = new PlayerGuildService();
