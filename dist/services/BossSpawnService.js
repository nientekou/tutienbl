"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossSpawnService = exports.BossSpawnService = void 0;
const discord_js_1 = require("discord.js");
const database_1 = __importDefault(require("../database/database"));
const constants_1 = require("../utils/constants");
const uiSystem_1 = require("../utils/uiSystem");
class BossSpawnService {
    schedulerInterval = null;
    /**
     * Khởi động scheduler chạy ngầm quét kiểm tra Boss mỗi 15 giây
     */
    startScheduler(client) {
        const { CronManager } = require('../utils/CronManager');
        CronManager.registerTask('world_boss_spawner', 15000, async () => {
            await this.checkBossSpawn(client);
        });
    }
    /**
     * Kiểm tra trạng thái hồi sinh của Boss
     */
    async checkBossSpawn(client) {
        const boss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
        if (!boss)
            return;
        const now = Math.floor(Date.now() / 1000);
        const respawnCooldown = 60; // 1 phút hồi sinh phục vụ thử nghiệm và demo live
        // Daily reset logic: if the boss's last_spawned_at is from a previous calendar day, reset it to level 1
        const lastSpawnedDate = new Date((boss.last_spawned_at || 0) * 1000).toDateString();
        const todayDate = new Date().toDateString();
        if (lastSpawnedDate !== todayDate) {
            const nextLevel = 1;
            const newMaxHp = 5000;
            const newAtk = 80;
            const newDef = 50;
            database_1.default.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
            // Xóa bảng đóng góp sát thương cũ
            database_1.default.prepare("DELETE FROM world_boss_contributions").run();
            const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
            console.log(`[BossSpawnService] 👹 Daily Reset: Boss thế giới đã hồi sinh về Cấp 1! HP: ${updatedBoss.max_hp}`);
            // Gửi thông báo tới toàn bộ các guild
            await this.broadcastBossSpawn(client, updatedBoss);
            return;
        }
        if (boss.status === 'defeated') {
            const elapsed = now - (boss.defeated_at || 0);
            if (elapsed >= respawnCooldown) {
                // Tiến hành hồi sinh Boss ở cấp độ tiếp theo
                const nextLevel = boss.level + 1;
                const newMaxHp = Math.round(5000 * Math.pow(1.2, nextLevel - 1));
                const newAtk = Math.round(80 * Math.pow(1.15, nextLevel - 1));
                const newDef = Math.round(50 * Math.pow(1.15, nextLevel - 1));
                database_1.default.prepare(`
          UPDATE world_boss
          SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
          WHERE id = 'world_boss_current'
        `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);
                // Xóa bảng đóng góp sát thương cũ
                database_1.default.prepare("DELETE FROM world_boss_contributions").run();
                const updatedBoss = database_1.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
                console.log(`[BossSpawnService] 👹 Boss thế giới đã hồi sinh! Cấp độ: ${updatedBoss.level}, HP: ${updatedBoss.max_hp}`);
                // Gửi thông báo tới toàn bộ các guild
                await this.broadcastBossSpawn(client, updatedBoss);
            }
        }
        else if (boss.status === 'active') {
            // Nếu boss đang hoạt động nhưng chưa có tin nhắn thông báo nào được lưu
            const activeAnnouncementsCount = database_1.default.prepare('SELECT COUNT(*) as count FROM boss_announcements').get().count;
            if (activeAnnouncementsCount === 0) {
                console.log(`[BossSpawnService] 👹 Phát hiện Boss đang hoạt động nhưng chưa phát thông điệp. Đang phát thông báo...`);
                await this.broadcastBossSpawn(client, boss);
            }
        }
    }
    /**
     * Phát thông báo Boss xuất thế đến các guild đã cấu hình
     */
    async broadcastBossSpawn(client, boss) {
        // Dọn dẹp các tin nhắn cũ phòng trường hợp rác
        database_1.default.prepare('DELETE FROM boss_announcements').run();
        const guilds = database_1.default.prepare('SELECT guild_id, boss_channel_id FROM guild_configs').all();
        for (const gConfig of guilds) {
            try {
                const guild = client.guilds.cache.get(gConfig.guild_id) || await client.guilds.fetch(gConfig.guild_id);
                if (!guild)
                    continue;
                if (!gConfig.boss_channel_id || gConfig.boss_channel_id === 'null' || !/^\d{17,20}$/.test(gConfig.boss_channel_id))
                    continue;
                const channel = guild.channels.cache.get(gConfig.boss_channel_id) || await guild.channels.fetch(gConfig.boss_channel_id);
                if (!channel || !channel.isTextBased())
                    continue;
                const embed = this.createBossEmbed(boss);
                const row = this.createBossComponents();
                const msg = await channel.send({
                    content: '🔔 **THƯỢNG CỔ MA THẦN XUẤT THẾ!**',
                    embeds: [embed],
                    components: [row]
                });
                database_1.default.prepare('INSERT INTO boss_announcements (guild_id, channel_id, message_id) VALUES (?, ?, ?)')
                    .run(guild.id, channel.id, msg.id);
            }
            catch (err) {
                console.error(`[BossSpawnService] Lỗi phát thông báo Boss tại Guild ${gConfig.guild_id}:`, err);
            }
        }
    }
    /**
     * Cập nhật tin nhắn HP Boss ở các Guild
     */
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
                        const embed = new discord_js_1.EmbedBuilder()
                            .setTitle(`💀 WORLD BOSS ĐÃ BỊ TIÊU DIỆT - LEVEL ${boss.level}`)
                            .setColor(uiSystem_1.EMBED_COLORS.NEUTRAL)
                            .setDescription(`👹 **${boss.name}** đã bị tiêu diệt hoàn toàn! Tinh phách ma thú tan rã. Thiên địa tạm thời quy về thái bình.\n\n*Hồi sinh sau: 1 phút.*`)
                            .setTimestamp();
                        await msg.edit({ embeds: [embed], components: [] });
                    }
                    else {
                        const embed = this.createBossEmbed(boss);
                        await msg.edit({ embeds: [embed] });
                    }
                }
                catch (msgErr) {
                    // Tin nhắn bị xóa thủ công
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
    /**
     * Phát bảng xếp hạng và danh sách phần thưởng khi diệt boss
     */
    async broadcastBossDefeatedLogs(client, boss, rewardsLogs) {
        const guilds = database_1.default.prepare('SELECT boss_channel_id FROM guild_configs').all();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🏆 BẢNG PHONG THẦN THẢO PHẠT BOSS - LEVEL ${boss.level}`)
            .setColor(uiSystem_1.EMBED_COLORS.GOLD)
            .setDescription(`👹 **${boss.name}** đã ngã xuống! Linh khí tản mát hóa thành tài bảo ban thưởng cho các đệ tử dũng cảm:\n\n` +
            (rewardsLogs.length > 0 ? rewardsLogs.join('\n') : '*Không có đệ tử nào tham gia thảo phạt.*'))
            .setTimestamp();
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
                await channel.send({ embeds: [embed] });
            }
            catch (err) {
                console.error(`[BossSpawnService] Lỗi gửi kết quả Boss tại Guild ${gConfig.guild_id}:`, err);
            }
        }
    }
    /**
     * Tạo Embed thông tin Boss
     */
    createBossEmbed(boss) {
        const progressBar = (0, constants_1.getProgressBar)(boss.hp, boss.max_hp, 15);
        return new discord_js_1.EmbedBuilder()
            .setTitle(`👹 WORLD BOSS XUẤT THẾ - LEVEL ${boss.level}`)
            .setColor(uiSystem_1.EMBED_COLORS.ERROR)
            .setDescription(`⚠️ **CẢNH BÁO TAM GIỚI:** **${boss.name}** đang tàn phá thế giới! Mau liên thủ trảm ma vệ đạo!\n\n` +
            `🩸 **Trạng thái Sinh Lực (HP):** ${progressBar} (\`${boss.hp}/${boss.max_hp}\` HP)\n` +
            `⚔️ **Công Kích:** \`${boss.atk}\` | 🛡️ **Phòng Thủ:** \`${boss.def}\``)
            .setFooter({ text: 'Bấm nút ⚔️ Tấn Công bên dưới để trực tiếp tham chiến!' })
            .setTimestamp();
    }
    /**
     * Tạo nút bấm chiến đấu
     */
    createBossComponents() {
        return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('worldbossattack_global')
            .setLabel('⚔️ Tấn Công')
            .setStyle(discord_js_1.ButtonStyle.Danger));
    }
}
exports.BossSpawnService = BossSpawnService;
exports.bossSpawnService = new BossSpawnService();
