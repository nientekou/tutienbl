import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { monthlyLeaderboardService } from '../../services/MonthlyLeaderboardService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

class VinhDanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('vinhdanh')
        .setDescription('Bảng Vinh Danh Tháng — Xem xếp hạng các đạo hữu')
        .addStringOption(opt =>
          opt.setName('danhmuc')
            .setDescription('Danh mục xếp hạng')
            .setRequired(false)
            .addChoices(
              { name: '🌀 Tu Vi', value: 'tuvi' },
              { name: '⚔️ Đấu Trường', value: 'arena' },
              { name: '🗼 Thiên Cung', value: 'tower' },
              { name: '🏆 Thành Tựu', value: 'achievement' },
            )
        )
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const category = (interaction.options.getString('danhmuc') || 'tuvi') as any;
    const desc = monthlyLeaderboardService.getDescription(category);

    const embed = new EmbedBuilder()
      .setTitle('👑 Bảng Vinh Danh Tháng')
      .setColor(EMBED_COLORS.GOLD)
      .setDescription(desc)
      .setTimestamp();

    // Show player's own rank
    const rankInfo = monthlyLeaderboardService.getPlayerRank(userId, category);
    if (rankInfo) {
      embed.setFooter({ text: `Hạng của đạo hữu: #${rankInfo.rank} (${rankInfo.value.toLocaleString()} điểm)` });
    }

    await interaction.reply(toV2Payload([embed]));
  }
}

export default new VinhDanhCommand();
