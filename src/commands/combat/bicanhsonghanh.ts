import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { secretRealmService } from '../../services/SecretRealmService';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

export default class BiKinhSongHanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('bicanhsonghanh')
        .setDescription('Bí Cảnh Song Hành — Phó bản hợp tác 2 người')
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
      return;
    }

    const canEnter = secretRealmService.canEnter(userId);
    const config = secretRealmService.getConfig();
    const entries = secretRealmService.getEntriesThisWeek(userId);

    const descContent = [
      `🎫 Lượt tuần này: **${entries}/${config.maxEntries}**`,
      `💰 Phí tổn: **${config.entryCost}** Thể Lực`
    ];

    if (!canEnter.eligible) {
      descContent.push(`\n❌ **Điều kiện chưa đạt:** ${canEnter.reason}`);
    } else {
      descContent.push(
        `\n👥 **Thưởng Đồng Bộ Hợp Tác:**\n` +
        `• 🔥 Cùng hệ: **+15%** sát thương\n` +
        `• ⚡ Khắc hệ: **+25%** sát thương\n` +
        `• 💖 Đạo lữ: **+10%** toàn bộ chỉ số`
      );
    }

    const embed = container(V2_COLORS.mystic, [
      header(`🌀 Bí Cảnh Song Hành — ${config.name}`, config.description),
      separator(),
      body(descContent.join('\n'))
    ]);

    if (canEnter.eligible) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bicanhsonghanh_enter_${userId}`)
          .setLabel('Vào Bí Cảnh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌀'),
      );
      await interaction.editReply(toV2Payload([embed], [row]));
    } else {
      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
