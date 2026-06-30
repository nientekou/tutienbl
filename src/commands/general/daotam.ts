import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { daoHeartService } from '../../services/DaoHeartService';
import { EMBED_COLORS } from '../../utils/uiSystem';

const PATH_CHOICES = [
  { name: '🌀 Chính Đạo — DEF +10%, Breakthrough +5%', value: 'chinh_dao' },
  { name: '🔥 Ma Đạo — ATK +15%, Cultivation Speed +10%', value: 'ma_dao' },
  { name: '⚖️ Trung Đạo — All Stats +5%, Breakthrough +5%', value: 'trung_dao' },
];

export default class DaoTamCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('daotam')
        .setDescription('Hệ thống Đạo Tâm — chọn path và mở passive nodes.')
        .addSubcommand(sub =>
          sub
            .setName('xem')
            .setDescription('Xem trạng thái Đạo Tâm hiện tại.')
        )
        .addSubcommand(sub =>
          sub
            .setName('chon')
            .setDescription('Chọn Đạo Tâm (Chính Đạo / Ma Đạo / Trung Đạo).')
            .addStringOption(opt =>
              opt.setName('path')
                .setDescription('Con đường tu đạo')
                .setRequired(true)
                .addChoices(...PATH_CHOICES.map(c => ({ name: c.name, value: c.value })))
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('mokhoa')
            .setDescription('Mở khóa node trong cây Đạo Tâm.')
            .addIntegerOption(opt =>
              opt.setName('node')
                .setDescription('Số thứ tự node (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)
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

    if (sub === 'xem') {
      const description = daoHeartService.getDescription(userId);
      const pathId = daoHeartService.getPath(userId);
      const embed = new EmbedBuilder()
        .setTitle('🌀 Đạo Tâm')
        .setColor(pathId === 'chinh_dao' ? EMBED_COLORS.SUCCESS : pathId === 'ma_dao' ? EMBED_COLORS.ERROR : EMBED_COLORS.INFO)
        .setDescription(description);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'chon') {
      const pathId = interaction.options.getString('path', true);
      const result = daoHeartService.choosePath(userId, pathId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Đã Chọn Đạo Tâm')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
      return;
    }

    if (sub === 'mokhoa') {
      const nodeIndex = interaction.options.getInteger('node', true) - 1;
      const result = daoHeartService.unlockNode(userId, nodeIndex);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Mở Khóa Node')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
