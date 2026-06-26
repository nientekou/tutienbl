import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { sectCouncilService } from '../../services/SectCouncilService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class HoiDongCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('hoidong')
        .setDescription('Hội Đồng Tông Môn — Đề xuất và bỏ phiếu chính sách')
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) {
      await interaction.reply({ content: '❌ Đạo hữu chưa gia nhập tông môn.', ephemeral: true });
      return;
    }

    const voting = sectCouncilService.getVotingPolicy(user.sect_id);
    const active = sectCouncilService.getActivePolicy(user.sect_id);

    let desc = '**Hội Đồng Tông Môn**\n\n';

    if (voting) {
      desc += `🗳️ **Đang bỏ phiếu:** ${voting.policy.name}\n`;
      desc += `${voting.policy.description}\n`;
      desc += `👍 Đồng ý: **${voting.votesYes}** | 👎 Abstain: **${voting.votesNo}**\n`;
      desc += `⏰ Kết thúc: <t:${voting.endTime}:R>\n`;
    } else if (active) {
      desc += `✅ **Chính sách đang active:** ${active.name}\n`;
      desc += `${active.description}\n`;
    } else {
      desc += '📭 Chưa có chính sách nào. Chỉ tông chủ có thể đề xuất.\n';
    }

    const embed = new EmbedBuilder()
      .setTitle('🏛️ Hội Đồng Tông Môn')
      .setColor(EMBED_COLORS.GOLD)
      .setDescription(desc)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (voting) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`sectcouncil_vote_yes_${userId}_${user.sect_id}`)
          .setLabel('👍 Đồng Ý')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`sectcouncil_vote_no_${userId}_${user.sect_id}`)
          .setLabel('👎 Bỏ Phiếu')
          .setStyle(ButtonStyle.Secondary),
      );
    }

    await interaction.reply(toV2Payload([embed], row.components.length > 0 ? [row] : []));
  }
}
