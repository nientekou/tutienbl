import { TextChannel, EmbedBuilder } from 'discord.js';
import { TuTienClient } from '../client/TuTienClient';
import db from '../database/database';

class BroadcastService {
  /**
   * Gửi thông báo đến kênh #thông-báo của server
   */
  public async broadcast(client: TuTienClient, guildId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const config = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId) as any;
      if (!config) return;

      const channelId = config.guide_channel_id || config.event_channel_id;
      if (!channelId) return;

      const channel = client.channels.cache.get(channelId) as TextChannel;
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (e) {
      console.error('Lỗi broadcast:', e);
    }
  }

  /**
   * Broadcast khi 2 đạo hữu kết hôn
   */
  public async announceMarriage(client: TuTienClient, guildId: string, user1Name: string, user2Name: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💞 Đạo Lữ Kết Duyên')
      .setColor('#ff69b4')
      .setDescription(`Chúc mừng **${user1Name}** và **${user2Name}** đã chính thức kết thành Đạo Lữ! Thiên địa chứng giám, âm dương hòa hợp.`)
      .setTimestamp();
    await this.broadcast(client, guildId, embed);
  }

  /**
   * Broadcast khi đạt mốc kỷ niệm
   */
  public async announceAnniversary(client: TuTienClient, guildId: string, user1Name: string, user2Name: string, days: number): Promise<void> {
    const labels: Record<number, string> = {
      100: '💍 100 Ngày Hạnh Phúc',
      200: '💖 200 Ngày Yêu Thương',
      500: '🌟 500 Ngày Thiên Địa Chứng Hôn'
    };
    const embed = new EmbedBuilder()
      .setTitle(labels[days] || `🎊 ${days} Ngày Kỷ Niệm`)
      .setColor('#ffd700')
      .setDescription(`Cặp đôi **${user1Name}** & **${user2Name}** đã bên nhau trọn **${days} ngày**! Chúc mừng hạnh phúc viên mãn!`)
      .setTimestamp();
    await this.broadcast(client, guildId, embed);
  }

  /**
   * Broadcast khi đệ tử tốt nghiệp Sư Đồ
   */
  public async announceGraduation(client: TuTienClient, guildId: string, mentorName: string, apprenticeName: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎓 Đệ Tử Tốt Nghiệp')
      .setColor('#00ff88')
      .setDescription(`Chúc mừng **${apprenticeName}** đã tốt nghiệp dưới sự dẫn dắt của **${mentorName}**! Môn hạ xuất sư, tiền đồ rộng mở!`)
      .setTimestamp();
    await this.broadcast(client, guildId, embed);
  }

  /**
   * Broadcast khi Boss Server bị tiêu diệt
   */
  public async announceBossDefeated(client: TuTienClient, guildId: string, bossName: string, killerName: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🐉 Boss Thế Giới Đã Bị Tiêu Diệt!')
      .setColor('#ff0000')
      .setDescription(`**${bossName}** đã bị đánh bại bởi **${killerName}**! Toàn server nhận thưởng!`)
      .setTimestamp();
    await this.broadcast(client, guildId, embed);
  }
}

export const broadcastService = new BroadcastService();
