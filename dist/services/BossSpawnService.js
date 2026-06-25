"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossSpawnService = exports.BossSpawnService = void 0;
const database_1 = __importDefault(require("../database/database"));
const worldboss_1 = require("../commands/combat/worldboss");
class BossSpawnService {
    schedulerInterval = null;
    startScheduler(client) {
        const { CronManager } = require('../utils/CronManager');
        CronManager.registerTask('world_boss_spawner', 15000, async () => {
            await this.checkBossSpawn(client);
        });
    }
    async checkBossSpawn(client) {
        const boss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
        if (!boss)
            return;
        const now = Math.floor(Date.now() / 1000);
        const respawnCooldown = 45;
        const lastSpawnedDate = new Date((boss.last_spawned_at || 0) * 1000).toDateString();
        const todayDate = new Date().toDateString();
        if (lastSpawnedDate !== todayDate) {
            const newMaxHp = 5000;
            database_1.default.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = 80, def = 50, level = 1, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL,
            phase = 1, current_weakness = 'Hỏa'
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, now);
            database_1.default.prepare("DELETE FROM world_boss_contributions").run();
            const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
            console.log(`[BossSpawnService] 👹 Daily Reset: Boss thế giới đã hồi sinh về Cấp 1!`);
            await this.broadcastBossSpawn(client, updatedBoss);
            return;
        }
        if (boss.status === 'defeated') {
            const elapsed = now - (boss.defeated_at || 0);
            if (elapsed >= respawnCooldown) {
                const nextLevel = boss.level + 1;
                const newMaxHp = Math.round(5000 * Math.pow(1.3, nextLevel - 1));
                const newAtk = Math.round(80 * Math.pow(1.2, nextLevel - 1));
                const newDef = Math.round(50 * Math.pow(1.2, nextLevel - 1));
                database_1.default.prepare(`
          UPDATE world_boss
          SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL,
              phase = 1, current_weakness = 'Hỏa'
          WHERE id = 'world_boss_current'
        `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
                database_1.default.prepare("DELETE FROM world_boss_contributions").run();
                const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
                console.log(`[BossSpawnService] 👹 Boss thế giới đã hồi sinh! Cấp: ${updatedBoss.level}, HP: ${updatedBoss.max_hp}`);
                await this.broadcastBossSpawn(client, updatedBoss);
            }
        }
        else if (boss.status === 'active') {
            const activeCount = database_1.default.prepare('SELECT COUNT(*) as count FROM boss_announcements').get().count;
            if (activeCount === 0) {
                await this.broadcastBossSpawn(client, boss);
            }
        }
    }
    async broadcastBossSpawn(client, boss) {
        database_1.default.prepare('DELETE FROM boss_announcements').run();
        const guilds = database_1.default.prepare('SELECT guild_id, boss_channel_id FROM guild_configs').all();
        for (const gConfig of guilds) {
            try {
                const guild = client.guilds.cache.get(gConfig.guild_id);
                if (!guild) {
                    database_1.default.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(gConfig.guild_id);
                    continue;
                }
                if (!gConfig.boss_channel_id || gConfig.boss_channel_id === 'null' || !/^\d{17,20}$/.test(gConfig.boss_channel_id))
                    continue;
                const channel = guild.channels.cache.get(gConfig.boss_channel_id) || await guild.channels.fetch(gConfig.boss_channel_id).catch(() => null);
                if (!channel || !channel.isTextBased())
                    continue;
                const payload = (0, worldboss_1.buildBossSpawnContainer)(boss);
                const msg = await channel.send(payload);
                database_1.default.prepare('INSERT INTO boss_announcements (guild_id, channel_id, message_id) VALUES (?, ?, ?)').run(guild.id, channel.id, msg.id);
            }
            catch (err) {
                console.error(`[BossSpawnService] Lỗi phát thông báo Boss tại Guild ${gConfig.guild_id}:`, err);
            }
        }
    }
    async updateBossEmbeds(client, boss) {
        const announcements = database_1.default.prepare('SELECT * FROM boss_announcements').all();
        for (const ann of announcements) {
            try {
                const guild = client.guilds.cache.get(ann.guild_id);
                if (!guild)
                    continue;
                const channel = guild.channels.cache.get(ann.channel_id);
                if (!channel || !channel.isTextBased())
                    continue;
                try {
                    const msg = await channel.messages.fetch(ann.message_id);
                    if (!msg)
                        continue;
                    if (boss.status === 'defeated') {
                        const payload = (0, worldboss_1.buildBossDefeatedContainer)(boss, []);
                        await msg.edit(payload);
                    }
                    else {
                        const payload = (0, worldboss_1.buildBossSpawnContainer)(boss);
                        await msg.edit(payload);
                    }
                }
                catch (msgErr) {
                    database_1.default.prepare('DELETE FROM boss_announcements WHERE message_id = ?').run(ann.message_id);
                }
            }
            catch (err) {
                console.error(`[BossSpawnService] Không thể cập nhật tin nhắn Boss cho Guild ${ann.guild_id}:`, err);
            }
        }
        if (boss.status === 'defeated') {
            database_1.default.prepare('DELETE FROM boss_announcements').run();
        }
    }
    async broadcastBossDefeatedLogs(client, boss, rewardsLogs) {
        const guilds = database_1.default.prepare('SELECT boss_channel_id FROM guild_configs').all();
        const payload = (0, worldboss_1.buildBossDefeatedContainer)(boss, rewardsLogs);
        for (const gConfig of guilds) {
            try {
                const guild = client.guilds.cache.get(gConfig.guild_id);
                if (!guild)
                    continue;
                if (!gConfig.boss_channel_id || gConfig.boss_channel_id === 'null' || !/^\d{17,20}$/.test(gConfig.boss_channel_id))
                    continue;
                const channel = guild.channels.cache.get(gConfig.boss_channel_id);
                if (!channel || !channel.isTextBased())
                    continue;
                await channel.send(payload);
            }
            catch (err) {
                console.error(`[BossSpawnService] Lỗi gửi kết quả Boss tại Guild ${gConfig.guild_id}:`, err);
            }
        }
    }
}
exports.BossSpawnService = BossSpawnService;
exports.bossSpawnService = new BossSpawnService();
