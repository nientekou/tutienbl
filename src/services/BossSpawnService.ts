import { TuTienClient } from '../client/TuTienClient';
import db from '../database/database';
import { WorldBossEntity } from '../utils/types';
import { buildBossSpawnContainer, buildBossDefeatedContainer } from '../commands/combat/worldboss';
import { toV2Payload } from '../utils/uiSystem';
import { EmbedBuilder } from 'discord.js';

export class BossSpawnService {
  private schedulerInterval: NodeJS.Timeout | null = null;

  public startScheduler(client: TuTienClient): void {
    const { CronManager } = require('../utils/CronManager');
    CronManager.registerTask('world_boss_spawner', 15000, async () => {
      await this.checkBossSpawn(client);
    });
  }

  public async checkBossSpawn(client: TuTienClient): Promise<void> {
    const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity | undefined;
    if (!boss) return;

    const now = Math.floor(Date.now() / 1000);
    const respawnCooldown = 45;

    const lastSpawnedDate = new Date((boss.last_spawned_at || 0) * 1000).toDateString();
    const todayDate = new Date().toDateString();
    if (lastSpawnedDate !== todayDate) {
      const newMaxHp = 5000;
      db.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = 80, def = 50, level = 1, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL,
            phase = 1, current_weakness = 'Hỏa'
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, now);
      db.prepare("DELETE FROM world_boss_contributions").run();

      const updatedBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity;
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

        db.prepare(`
          UPDATE world_boss
          SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL,
              phase = 1, current_weakness = 'Hỏa'
          WHERE id = 'world_boss_current'
        `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
        db.prepare("DELETE FROM world_boss_contributions").run();

        const updatedBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity;
        console.log(`[BossSpawnService] 👹 Boss thế giới đã hồi sinh! Cấp: ${updatedBoss.level}, HP: ${updatedBoss.max_hp}`);
        await this.broadcastBossSpawn(client, updatedBoss);
      }
    } else if (boss.status === 'active') {
      const activeCount = (db.prepare('SELECT COUNT(*) as count FROM boss_announcements').get() as { count: number }).count;
      if (activeCount === 0) {
        await this.broadcastBossSpawn(client, boss);
      }
    }
  }

  public async broadcastBossSpawn(client: TuTienClient, boss: WorldBossEntity): Promise<void> {
    db.prepare('DELETE FROM boss_announcements').run();
    const guilds = db.prepare('SELECT guild_id, boss_channel_id FROM guild_configs').all() as any[];

    for (const gConfig of guilds) {
      try {
        const guild = client.guilds.cache.get(gConfig.guild_id) || await client.guilds.fetch(gConfig.guild_id);
        if (!guild) continue;
        if (!gConfig.boss_channel_id || gConfig.boss_channel_id === 'null' || !/^\d{17,20}$/.test(gConfig.boss_channel_id)) continue;
        const channel = guild.channels.cache.get(gConfig.boss_channel_id) || await guild.channels.fetch(gConfig.boss_channel_id);
        if (!channel || !channel.isTextBased()) continue;

        const payload = buildBossSpawnContainer(boss);
        const msg = await (channel as any).send(payload);
        db.prepare('INSERT INTO boss_announcements (guild_id, channel_id, message_id) VALUES (?, ?, ?)').run(guild.id, channel.id, msg.id);
      } catch (err) {
        console.error(`[BossSpawnService] Lỗi phát thông báo Boss tại Guild ${gConfig.guild_id}:`, err);
      }
    }
  }

  public async updateBossEmbeds(client: TuTienClient, boss: WorldBossEntity): Promise<void> {
    const announcements = db.prepare('SELECT * FROM boss_announcements').all() as any[];

    for (const ann of announcements) {
      try {
        const guild = client.guilds.cache.get(ann.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(ann.channel_id);
        if (!channel || !channel.isTextBased()) continue;

        try {
          const msg = await channel.messages.fetch(ann.message_id);
          if (!msg) continue;

          if (boss.status === 'defeated') {
            const payload = buildBossDefeatedContainer(boss, []);
            await msg.edit(payload);
          } else {
            const payload = buildBossSpawnContainer(boss);
            await msg.edit(payload);
          }
        } catch (msgErr) {
          db.prepare('DELETE FROM boss_announcements WHERE message_id = ?').run(ann.message_id);
        }
      } catch (err) {
        console.error(`[BossSpawnService] Không thể cập nhật tin nhắn Boss cho Guild ${ann.guild_id}:`, err);
      }
    }

    if (boss.status === 'defeated') {
      db.prepare('DELETE FROM boss_announcements').run();
    }
  }

  public async broadcastBossDefeatedLogs(client: TuTienClient, boss: WorldBossEntity, rewardsLogs: string[]): Promise<void> {
    const guilds = db.prepare('SELECT boss_channel_id FROM guild_configs').all() as any[];
    const payload = buildBossDefeatedContainer(boss, rewardsLogs);

    for (const gConfig of guilds) {
      try {
        const guild = client.guilds.cache.get(gConfig.guild_id);
        if (!guild) continue;
        if (!gConfig.boss_channel_id || gConfig.boss_channel_id === 'null' || !/^\d{17,20}$/.test(gConfig.boss_channel_id)) continue;
        const channel = guild.channels.cache.get(gConfig.boss_channel_id);
        if (!channel || !channel.isTextBased()) continue;
        await (channel as any).send(payload);
      } catch (err) {
        console.error(`[BossSpawnService] Lỗi gửi kết quả Boss tại Guild ${gConfig.guild_id}:`, err);
      }
    }
  }
}

export const bossSpawnService = new BossSpawnService();
