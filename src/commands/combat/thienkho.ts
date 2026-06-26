import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { treasureVaultService } from '../../services/TreasureVaultService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

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
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const desc = treasureVaultService.getDescription(userId);
      const embed = new EmbedBuilder()
        .setTitle('📦 Thiên Kho Bảo Vật')
        .setColor(EMBED_COLORS.DUNGEON)
        .setDescription(desc)
        .setTimestamp();

      const canEnter = treasureVaultService.canEnter(userId);
      if (canEnter.eligible) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`thienkho_start_${userId}`)
            .setLabel('Vào Thiên Kho')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📦'),
        );
        await interaction.reply(toV2Payload([embed], [row]));
      } else {
        await interaction.reply(toV2Payload([embed]));
      }
      return;
    }

    if (subcommand === 'start') {
      if (user.level < 50) {
        await interaction.reply({ content: '❌ Cần cấp 50+ để vào Thiên Kho.', ephemeral: true });
        return;
      }

      const canEnter = treasureVaultService.canEnter(userId);
      if (!canEnter.eligible) {
        await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
        return;
      }

      // Check stamina
      if ((user.stamina || 0) < 100) {
        await interaction.reply({ content: '❌ Cần 100 Thể Lực để vào Thiên Kho.', ephemeral: true });
        return;
      }

      const { floor } = treasureVaultService.start(userId);
      const buffs = treasureVaultService.getRandomBuffs(3);

      const embed = new EmbedBuilder()
        .setTitle('📦 Thiên Kho Bảo Vật — Tầng 1')
        .setColor(EMBED_COLORS.DUNGEON)
        .setDescription('Chọn 1 trong 3 chỉ số tăng cường để nhận:')
        .setTimestamp();

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

      await interaction.reply(toV2Payload([embed], [row]));
    }
  }
}
