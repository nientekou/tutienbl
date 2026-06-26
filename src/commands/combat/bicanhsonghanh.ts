import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { secretRealmService } from '../../services/SecretRealmService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

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
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const canEnter = secretRealmService.canEnter(userId);
    const config = secretRealmService.getConfig();
    const entries = secretRealmService.getEntriesThisWeek(userId);

    let desc = `🌀 **Bí Cảnh Song Hành** — ${config.name}\n`;
    desc += `${config.description}\n\n`;
    desc += `🎫 Lượt: **${entries}/${config.maxEntries}**/tuần\n`;
    desc += `💰 Phí: **${config.entryCost}** Thể Lực\n\n`;

    if (!canEnter.eligible) {
      desc += `❌ ${canEnter.reason}`;
    } else {
      desc += `Cần partner online. Thưởng đồng bộ:\n`;
      desc += `• Cùng hệ: +15% sát thương\n`;
      desc += `• Khắc hệ: +25% sát thương\n`;
      desc += `• Đạo lữ: +10% toàn chỉ số\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🌀 Bí Cảnh Song Hành')
      .setColor(EMBED_COLORS.MYSTIC)
      .setDescription(desc)
      .setTimestamp();

    if (canEnter.eligible) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bicanhsonghanh_enter_${userId}`)
          .setLabel('Vào Bí Cảnh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌀'),
      );
      await interaction.reply(toV2Payload([embed], [row]));
    } else {
      await interaction.reply(toV2Payload([embed]));
    }
  }
}
