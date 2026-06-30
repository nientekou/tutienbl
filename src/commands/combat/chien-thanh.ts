import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { territoryService } from '../../services/TerritoryService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class ChienThanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('chienthanh')
        .setDescription('Trận Chiến Chiếm Thành — tranh đoạt thánh địa.')
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem tình trạng các thánh địa.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thamgia')
            .setDescription('Tham gia chiến trường.')
            .addStringOption(opt =>
              opt.setName('thanhdia')
                .setDescription('Thánh địa muốn tham gia')
                .setRequired(true)
                .addChoices(
                  { name: 'Linh Tiên Sơn', value: 'linh_tien_son' },
                  { name: 'Ma Thần Điện', value: 'ma_than_dien' },
                  { name: 'Vạn Thảo Các', value: 'van_thao_cac' }
                )
            )
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

    if (sub === 'thongtin') {
      const embed = new EmbedBuilder()
        .setTitle('🏰 Chiến Thành')
        .setColor(EMBED_COLORS.GOLD)
        .setDescription(territoryService.getDescription());
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'thamgia') {
      const territoryId = interaction.options.getString('thanhdia', true);
      const guildId = user.sect_id;
      if (!guildId) {
        await interaction.editReply({ content: '❌ Cần gia nhập tông môn để tham gia chiến trường.' });
        return;
      }
      const result = territoryService.joinWar(territoryId, userId, guildId);
      if (result.success) {
        await interaction.editReply({ content: result.message });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
