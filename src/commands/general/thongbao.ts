import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { notificationService } from '../../services/NotificationService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class ThongBaoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('thongbao')
        .setDescription('Quản lý thông báo và cài đặt thông báo.')
        .addSubcommand(sub =>
          sub
            .setName('xem')
            .setDescription('Xem danh sách thông báo.')
            .addStringOption(opt =>
              opt.setName('loai')
                .setDescription('Lọc theo loại thông báo')
                .setRequired(false)
                .addChoices(
                  { name: '🔴 Khẩn cấp', value: 'urgent' },
                  { name: '🟡 Quan trọng', value: 'important' },
                  { name: '🟢 Thông tin', value: 'info' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('doc')
            .setDescription('Đánh dấu tất cả thông báo là đã đọc.')
        )
        .addSubcommand(sub =>
          sub
            .setName('caidat')
            .setDescription('Xem và cài đặt tùy chọn thông báo.')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'xem') {
      const category = interaction.options.getString('loai');
      let notifs: any[];
      if (category) {
        notifs = notificationService.getByCategory(userId, category as any, 20);
      } else {
        notifs = notificationService.getAll(userId, 20);
      }

      if (notifs.length === 0) {
        await interaction.editReply({ content: '📭 Không có thông báo nào.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔔 Thông Báo${category ? ` (${this.getCategoryName(category)})` : ''}`)
        .setColor(EMBED_COLORS.INFO)
        .setDescription(
          notifs.map((n: any) => {
            const catEmoji = n.category === 'urgent' ? '🔴' : n.category === 'important' ? '🟡' : '🟢';
            const readStatus = n.read ? '' : ' **• MỚI**';
            return `${catEmoji} ${n.emoji} **${n.title}**${readStatus}\n└ ${n.message}`;
          }).join('\n\n')
        )
        .setFooter({ text: `Tổng: ${notifs.length} thông báo • Dùng /thongbao doc để đánh dấu đã đọc` });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'doc') {
      notificationService.markRead(userId);
      await interaction.editReply({ content: '✅ Đã đánh dấu tất cả thông báo là đã đọc.' });
      return;
    }

    if (sub === 'caidat') {
      const settingsDesc = notificationService.getSmartNotificationDescription(userId);
      const embed = new EmbedBuilder()
        .setTitle('🔔 Cài Đặt Thông Báo')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(settingsDesc);
      await interaction.editReply({ embeds: [embed] });
    }
  }

  private getCategoryName(cat: string): string {
    const map: Record<string, string> = { urgent: 'Khẩn cấp', important: 'Quan trọng', info: 'Thông tin' };
    return map[cat] || cat;
  }
}
