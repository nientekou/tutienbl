import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { caveGuardService } from '../../services/CaveGuardService';
import { EMBED_COLORS } from '../../utils/uiSystem';
import db from '../../database/database';

export default class TromDuocCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('tromduoc')
        .setDescription('Trộm dược liệu từ động phủ / quản lý linh thú canh giữ.')
        .addSubcommand(sub =>
          sub
            .setName('thuchien')
            .setDescription('Đột nhập động phủ ngẫu nhiên để trộm dược liệu.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin linh thú canh giữ động phủ của bạn.')
        )
        .addSubcommand(sub =>
          sub
            .setName('gan')
            .setDescription('Gán sủng thú canh giữ động phủ.')
            .addIntegerOption(opt =>
              opt.setName('beast_id')
                .setDescription('ID sủng thú (xem trong /sungthu)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('bo')
            .setDescription('Bỏ canh giữ động phủ.')
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

    if (sub === 'thuchien') {
      const result = caveGuardService.stealHerbs(userId);
      const embed = new EmbedBuilder()
        .setTitle(result.success ? '🕵️ Trộm Dược Liệu' : '❌ Trộm Thất Bại')
        .setColor(result.success ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
        .setDescription(result.message);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'thongtin') {
      const info = caveGuardService.getGuardInfo(userId);
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Linh Thú Hộ Vệ')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(info)
        .setFooter({ text: 'Dùng /tromduoc gan beast_id:<ID> để đặt canh giữ' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'gan') {
      const beastId = interaction.options.getInteger('beast_id', true);
      const result = caveGuardService.assignGuard(userId, beastId);
      if (result.success) {
        await interaction.editReply({ content: result.message });
      } else {
        await interaction.editReply({ content: result.message });
      }
      return;
    }

    if (sub === 'bo') {
      const result = caveGuardService.removeGuard(userId);
      await interaction.editReply({ content: result.message });
    }
  }
}
