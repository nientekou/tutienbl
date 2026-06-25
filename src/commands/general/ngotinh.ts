import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { ngoTinhService, NGO_TINH_BUFFS } from '../../services/NgoTinhService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class NgoTinhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('ngotinh')
        .setDescription('Quản lý Ngộ Tính - kích hoạt buff tạm thời.')
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật! Dùng `/taonhanvat` để tạo.' });
      return;
    }

    const activeBuffs = ngoTinhService.getActiveBuffs(userId);
    const ngotinh = user.ngotinh || 0;

    const embed = new EmbedBuilder()
      .setTitle('💡 Ngộ Tính - Thiên Cơ Buff')
      .setDescription(`Điểm Ngộ Tính hiện tại: **${ngotinh}** 💡\n\nDùng điểm Ngộ Tính để kích hoạt buff tạm thời:`)
      .setColor(EMBED_COLORS.INFO);

    for (const buff of NGO_TINH_BUFFS) {
      const active = activeBuffs.find(b => b.buffId === buff.id);
      const status = active
        ? `🟢 **Đang hoạt động** (còn ${Math.ceil(active.remaining / 60)} phút)`
        : `⚪ Chưa kích hoạt`;
      const canAfford = ngotinh >= buff.cost;
      const costText = canAfford ? `💡 ${buff.cost} NT` : `❌ ${buff.cost} NT (không đủ)`;

      embed.addFields({
        name: `${buff.emoji} ${buff.name}`,
        value: `${buff.effect}\nThời lượng: ${Math.floor(buff.duration / 60)} phút\nChi phí: ${costText}\n${status}`,
        inline: true
      });
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < NGO_TINH_BUFFS.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (let j = i; j < Math.min(i + 5, NGO_TINH_BUFFS.length); j++) {
        const buff = NGO_TINH_BUFFS[j];
        const active = activeBuffs.find(b => b.buffId === buff.id);
        const disabled = !!active || ngotinh < buff.cost;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ngotinh_activate_${buff.id}_${userId}`)
            .setLabel(`${buff.emoji} ${buff.name} (${buff.cost} NT)`)
            .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(disabled)
        );
      }
      rows.push(row);
    }

    await interaction.editReply({ embeds: [embed], components: rows });
  }
}
