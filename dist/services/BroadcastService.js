"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastService = void 0;
const discord_js_1 = require("discord.js");
const database_1 = __importDefault(require("../database/database"));
class BroadcastService {
    /**
     * Gửi thông báo đến kênh #thông-báo của server
     */
    async broadcast(client, guildId, embed) {
        try {
            const config = database_1.default.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
            if (!config)
                return;
            const channelId = config.guide_channel_id || config.event_channel_id;
            if (!channelId)
                return;
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        }
        catch (e) {
            console.error('Lỗi broadcast:', e);
        }
    }
    /**
     * Broadcast khi 2 đạo hữu kết hôn
     */
    async announceMarriage(client, guildId, user1Name, user2Name) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('💞 Đạo Lữ Kết Duyên')
            .setColor('#ff69b4')
            .setDescription(`Chúc mừng **${user1Name}** và **${user2Name}** đã chính thức kết thành Đạo Lữ! Thiên địa chứng giám, âm dương hòa hợp.`)
            .setTimestamp();
        await this.broadcast(client, guildId, embed);
    }
    /**
     * Broadcast khi đạt mốc kỷ niệm
     */
    async announceAnniversary(client, guildId, user1Name, user2Name, days) {
        const labels = {
            100: '💍 100 Ngày Hạnh Phúc',
            200: '💖 200 Ngày Yêu Thương',
            500: '🌟 500 Ngày Thiên Địa Chứng Hôn'
        };
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(labels[days] || `🎊 ${days} Ngày Kỷ Niệm`)
            .setColor('#ffd700')
            .setDescription(`Cặp đôi **${user1Name}** & **${user2Name}** đã bên nhau trọn **${days} ngày**! Chúc mừng hạnh phúc viên mãn!`)
            .setTimestamp();
        await this.broadcast(client, guildId, embed);
    }
    /**
     * Broadcast khi đệ tử tốt nghiệp Sư Đồ
     */
    async announceGraduation(client, guildId, mentorName, apprenticeName) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🎓 Đệ Tử Tốt Nghiệp')
            .setColor('#00ff88')
            .setDescription(`Chúc mừng **${apprenticeName}** đã tốt nghiệp dưới sự dẫn dắt của **${mentorName}**! Môn hạ xuất sư, tiền đồ rộng mở!`)
            .setTimestamp();
        await this.broadcast(client, guildId, embed);
    }
    /**
     * Broadcast khi Boss Server bị tiêu diệt
     */
    async announceBossDefeated(client, guildId, bossName, killerName) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🐉 Boss Thế Giới Đã Bị Tiêu Diệt!')
            .setColor('#ff0000')
            .setDescription(`**${bossName}** đã bị đánh bại bởi **${killerName}**! Toàn server nhận thưởng!`)
            .setTimestamp();
        await this.broadcast(client, guildId, embed);
    }
}
exports.broadcastService = new BroadcastService();
