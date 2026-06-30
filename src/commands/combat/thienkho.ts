import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { treasureVaultService } from '../../services/TreasureVaultService';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

export default class ThienKhoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('thienkho')
        .setDescription('Thiên Kho Bảo Vật — Roguelike challenge, chọn buff mỗi floor')
        .addSubcommand(sub =>
          sub.setName('info').setDescription('Xem thông tin Thiên Kho')
        )
        .addSubcommand(sub =>
          sub.setName('start').setDescription('Bắt đầu Thiên Kho (100 stamina, 1 lượt/ngày)')
        )
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const desc = treasureVaultService.getDescription(userId);
      const embed = container(V2_COLORS.mystic, [
        header('📦 Thiên Kho Bảo Vật', 'Thử thách Roguelike vượt ải chọn buff mỗi tầng để nhận bảo vật viễn cổ.'),
        separator(),
        body(desc)
      ]);

      const canEnter = treasureVaultService.canEnter(userId);
      if (canEnter.eligible) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`thienkho_start_${userId}`)
            .setLabel('Vào Thiên Kho')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📦'),
        );
        await interaction.editReply(toV2Payload([embed], [row]));
      } else {
        await interaction.editReply(toV2Payload([embed]));
      }
      return;
    }

    if (subcommand === 'start') {
      if (user.level < 50) {
        await interaction.editReply({ content: '❌ Cần cấp 50+ để vào Thiên Kho.' });
        return;
      }

      const canEnter = treasureVaultService.canEnter(userId);
      if (!canEnter.eligible) {
        await interaction.editReply({ content: `❌ ${canEnter.reason}` });
        return;
      }

      if ((user.stamina || 0) < 100) {
        await interaction.editReply({ content: '❌ Cần 100 Thể Lực để vào Thiên Kho.' });
        return;
      }

      const { floor } = treasureVaultService.start(userId);
      const buffs = treasureVaultService.getRandomBuffs(3);

      const embed = container(V2_COLORS.mystic, [
        header('📦 Thiên Kho Bảo Vật — Tầng 1', 'Chọn 1 trong 3 chỉ số tăng cường bên dưới để nhận buff cho hành trình:'),
        separator(),
        body('• Tăng cường năng lực chiến đấu vượt ải.\n• Chọn lựa thông thái sẽ giúp tiến xa hơn.')
      ]);

      const row = new ActionRowBuilder<ButtonBuilder>();
      for (let i = 0; i < buffs.length; i++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`thienkho_buff_${userId}_${buffs[i].id}`)
            .setLabel(buffs[i].name)
            .setStyle(ButtonStyle.Success)
            .setEmoji(i === 0 ? '🔥' : i === 1 ? '🛡️' : '✨'),
        );
      }

      await interaction.editReply(toV2Payload([embed], [row]));
    }
  }
}
