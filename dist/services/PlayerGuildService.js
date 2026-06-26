"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerGuildService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
class PlayerGuildService {
    initTable() {
        database_1.default.exec(`
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
    createGuild(userId, name, description = '') {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        // Check if already in a guild
        const existing = database_1.default.prepare('SELECT * FROM player_guild_members WHERE user_id = ?').get(userId);
        if (existing)
            return { success: false, message: 'Already in a guild!' };
        const now = Math.floor(Date.now() / 1000);
        const result = database_1.default.prepare('INSERT INTO player_guilds (name, leader_id, description, created_at) VALUES (?, ?, ?, ?)')
            .run(name, userId, description, now);
        database_1.default.prepare('INSERT INTO player_guild_members (guild_id, user_id, joined_at, role) VALUES (?, ?, ?, ?)')
            .run(result.lastInsertRowid, userId, now, 'leader');
        return { success: true, message: `Guild **${name}** created!` };
    }
    /**
     * C-01: Join player guild
     */
    joinGuild(userId, guildId) {
        this.initTable();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        const existing = database_1.default.prepare('SELECT * FROM player_guild_members WHERE user_id = ?').get(userId);
        if (existing)
            return { success: false, message: 'Already in a guild!' };
        const guild = database_1.default.prepare('SELECT * FROM player_guilds WHERE id = ?').get(guildId);
        if (!guild)
            return { success: false, message: 'Guild not found!' };
        const memberCount = database_1.default.prepare('SELECT COUNT(*) as c FROM player_guild_members WHERE guild_id = ?').get(guildId);
        if (memberCount.c >= 20)
            return { success: false, message: 'Guild full (max 20)!' };
        database_1.default.prepare('INSERT INTO player_guild_members (guild_id, user_id, joined_at) VALUES (?, ?, ?)')
            .run(guildId, userId, Math.floor(Date.now() / 1000));
        return { success: true, message: `Joined guild **${guild.name}**!` };
    }
    /**
     * C-01: Get guild info
     */
    getGuildInfo(guildId) {
        this.initTable();
        const guild = database_1.default.prepare('SELECT * FROM player_guilds WHERE id = ?').get(guildId);
        if (!guild)
            return null;
        const leader = UserRepository_1.userRepository.get(guild.leaderId);
        const memberCount = database_1.default.prepare('SELECT COUNT(*) as c FROM player_guild_members WHERE guild_id = ?').get(guildId);
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
    getUserGuild(userId) {
        this.initTable();
        const member = database_1.default.prepare(`
      SELECT pgm.guild_id, pg.name, pgm.role
      FROM player_guild_members pgm
      JOIN player_guilds pg ON pgm.guild_id = pg.id
      WHERE pgm.user_id = ?
    `).get(userId);
        return member || null;
    }
    /**
     * C-01: Get guild description
     */
    getGuildDescription(userId) {
        const guild = this.getUserGuild(userId);
        if (!guild)
            return '❌ Chưa có Guild!';
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
exports.playerGuildService = new PlayerGuildService();
