import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, GuildTextBasedChannel } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import db from '../../database/database';

const CHANNELS_CONFIG = [
  { key: 'tuluyen_channel_id', name: '📜-tu-luyện', topic: '🧘 Thiền định, đột phá, xem trạng thái: /taonhanvat, /hoso, /ycanh, /luanhoi' },
  { key: 'linhdien_channel_id', name: '🌿-linh-điền', topic: '🌱 Mở đất, trồng trọt, luyện đan, rèn trang bị: /linhdien, /chetao' },
  { key: 'market_channel_id', name: '🏪-chợ-trời', topic: '🏪 Trao đổi, mua bán đạo cụ: /chotroi, /market' },
  { key: 'tongmon_channel_id', name: '🏰-tông-môn', topic: '🏰 Gia nhập tông môn, cống hiến, bảng xếp hạng: /tongmon' },
  { key: 'combat_channel_id', name: '⚡-chiến-đấu', topic: '⚡ Khiêu chiến, tỷ thí, săn yêu thú: /chien-dau, /sanyem' },
  { key: 'bicanh_channel_id', name: '⚔️-bí-cảnh', topic: '⚔️ Khiêu chiến phó bản bí cảnh: /bicanh' },
  { key: 'boss_channel_id', name: '🌋-boss-thế-giới', topic: '🌋 Boss Thế Giới xuất thế định kỳ. Click Tấn Công ngay!' },
  { key: 'event_channel_id', name: '📢-sự-kiện', topic: '📢 Thông báo sự kiện, giải đấu, hoạt động đặc biệt' },
  { key: 'chat_channel_id', name: '💬-đạo-đàn', topic: '💬 Đàm đạo tu tiên, giao lưu đạo hữu' },
  { key: 'guide_channel_id', name: '📚-hướng-dẫn', topic: '📚 Hướng dẫn tân thủ, mẹo tu luyện, câu hỏi thường gặp' },
];

function getExistingConfig(guildId: string) {
  return db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId) as any;
}

function saveConfig(guildId: string, categoryId: string, channelIds: Record<string, string>) {
  const keys = ['category_id', ...CHANNELS_CONFIG.map(c => c.key)];
  const values = [guildId, categoryId, ...CHANNELS_CONFIG.map(c => channelIds[c.key] || null)];

  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');

  db.prepare(`
    INSERT INTO guild_configs (guild_id, ${keys.join(', ')})
    VALUES (?, ${placeholders})
    ON CONFLICT(guild_id) DO UPDATE SET ${updates}
  `).run(...values);
}

export default class SetupCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Tự động kiến tạo Danh mục & kênh chuyên dụng cho game Tu Tiên')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
          sub.setName('create')
            .setDescription('Tạo mới hoặc cập nhật các kênh đạo trường'))
        .addSubcommand(sub =>
          sub.setName('reset')
            .setDescription('Xoá toàn bộ kênh cũ và tạo lại từ đầu'))
        .addSubcommand(sub =>
          sub.setName('info')
            .setDescription('Xem cấu hình kênh hiện tại của máy chủ'))
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const { guild } = interaction;
    if (!guild) {
      await interaction.editReply({ content: '❌ Lệnh này chỉ dùng trong máy chủ Discord.' });
      return;
    }

    const botMember = await guild.members.fetch(client.user!.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.editReply({
        content: '❌ Ta cần quyền **Quản Lý Kênh** (Manage Channels) để kiến tạo Đạo Trường!',
        });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'info') {
      await this.showInfo(interaction);
      return;
    }
    if (sub === 'reset') {
      await this.confirmReset(client, interaction);
      return;
    }
    await this.runSetup(client, interaction);
  }

  private async showInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    const config = getExistingConfig(interaction.guildId!);
    if (!config || !config.category_id) {
      await interaction.editReply({ content: '⚠️ Máy chủ chưa được thiết lập. Dùng `/setup create` để kiến tạo Đạo Trường.' });
      return;
    }

    const guild = interaction.guild!;
    const embed = new EmbedBuilder()
      .setTitle('📋 CẤU HÌNH ĐẠO TRƯỜNG')
      .setColor(0x2ecc71)
      .setDescription(`Danh sách kênh thuộc **${guild.name}**:`)
      .setTimestamp();

    for (const ch of CHANNELS_CONFIG) {
      const id = (config as any)[ch.key];
      embed.addFields({
        name: ch.name,
        value: id ? `<#${id}>` : '❌ Chưa tạo',
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async confirmReset(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const config = getExistingConfig(interaction.guildId!);
    if (!config?.category_id) {
      await interaction.editReply({ content: '⚠️ Chưa có cấu hình nào để reset. Dùng `/setup create` để tạo mới.' });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('confirm_reset').setLabel('🗑️ Xoá & Tạo Lại').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_reset').setLabel('❌ Huỷ').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({
      content: '⚠️ **CẢNH BÁO:** Thao tác này sẽ xoá tất cả kênh cũ trong danh mục Đạo Trường và tạo lại từ đầu. Tiếp tục?',
      components: [row],
      });

    const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;
    const collected = await interaction.channel!.awaitMessageComponent({
      filter,
      componentType: ComponentType.Button,
      time: 15000,
    }).catch(() => null);

    if (!collected || collected.customId === 'cancel_reset') {
      await interaction.editReply({ content: '✅ Đã huỷ reset.', components: [] });
      return;
    }

    // Delete old channels
    const guild = interaction.guild!;
    const category = guild.channels.cache.get(config.category_id);
    const children = guild.channels.cache.filter(c => c.parentId === config.category_id);
    for (const [, ch] of children) {
      if ('delete' in ch) await (ch as any).delete().catch(() => {});
    }
    if (category && 'delete' in category) await (category as any).delete().catch(() => {});

    await collected.update({ content: '🗑️ Đã xoá kênh cũ. Đang tạo lại...', components: [] });
    await this.runSetup(client, interaction);
  }

  private async runSetup(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const { guild } = interaction;
    if (!guild) return;
    try {
      // 1. Tạo category
      let category = guild.channels.cache.find(
        c => c.name === '🌌 ĐẠO TRƯỜNG TU TIÊN' && c.type === ChannelType.GuildCategory,
      );

      if (!category) {
        category = await guild.channels.create({
          name: '🌌 ĐẠO TRƯỜNG TU TIÊN',
          type: ChannelType.GuildCategory,
        });
      }

      // 2. Tạo các kênh
      const channelIds: Record<string, string> = {};
      for (const ch of CHANNELS_CONFIG) {
        let channel = guild.channels.cache.find(
          c => c.name === ch.name && c.parentId === category!.id && c.type === ChannelType.GuildText,
        );

        if (!channel) {
          channel = await guild.channels.create({
            name: ch.name,
            type: ChannelType.GuildText,
            parent: category!.id,
            topic: ch.topic,
          });
        }
        channelIds[ch.key] = channel.id;
      }

      // 3. Lưu config
      saveConfig(guild.id, category.id, channelIds);

      // 4. Embed kết quả
      const embed = new EmbedBuilder()
        .setTitle('🌌 KIẾN TẠO ĐẠO TRƯỜNG THÀNH CÔNG!')
        .setColor(0x2ecc71)
        .setDescription('Hệ thống đã thiết lập **10 phân khu tu luyện** tại tông môn này:')
        .setTimestamp()
        .setFooter({ text: 'Chư vị đạo hữu hãy di chuyển đến kênh tương ứng!' });

      for (const ch of CHANNELS_CONFIG) {
        embed.addFields({ name: ch.name, value: `<#${channelIds[ch.key]}>`, inline: true });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('📜 Hướng Dẫn')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/channels/@me'),
        new ButtonBuilder()
          .setLabel('🎮 Bắt Đầu')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('setup_start_game'),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });

      // 5. Gửi welcome vào channel tu luyện
      const welcomeChannel = guild.channels.cache.get(channelIds['tuluyen_channel_id']);
      if (welcomeChannel?.isTextBased()) {
        await welcomeChannel.send({
          content: `🎉 **Đại Trận Đã Mở!** Chào mừng đạo hữu gia nhập **${guild.name}**! Dùng \`/taonhanvat\` để bước vào con đường nghịch thiên tu hành!`,
        });
      }

    } catch (error) {
      console.error('[Setup Error]:', error);
      await interaction.editReply({
        content: '❌ **Lỗi:** Không thể tạo kênh. Hãy kiểm tra bot có đủ quyền `Manage Channels` và thử lại.',
      });
    }
  }
}
