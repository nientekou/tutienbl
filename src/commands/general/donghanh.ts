import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { companionService } from '../../services/CompanionService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class DongHanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('donghanh')
        .setDescription('Đồng Hành — Xem, trang bị và bồi dưỡng tâm linh')
        .addSubcommand(sub =>
          sub.setName('list').setDescription('Xem danh sách Đồng Hành đã sở hữu')
        )
        .addSubcommand(sub =>
          sub.setName('equip').setDescription('Trang bị một Đồng Hành')
            .addStringOption(opt => opt.setName('type').setDescription('Loại Đồng Hành').setRequired(true)
              .addChoices(
                { name: 'Hỏa Linh', value: 'hoa_linh' },
                { name: 'Thủy Linh', value: 'thuy_linh' },
                { name: 'Lôi Linh', value: 'loi_linh' },
                { name: 'Phong Linh', value: 'phong_linh' },
              ))
        )
        .addSubcommand(sub =>
          sub.setName('info').setDescription('Xem chi tiết Đồng Hành đang trang bị')
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

    if (subcommand === 'list') {
      const desc = companionService.getDescription(userId);
      const embed = new EmbedBuilder()
        .setTitle('🐉 Đồng Hành')
        .setColor(EMBED_COLORS.CAVE)
        .setDescription(desc)
        .setTimestamp();

      const equipped = companionService.getEquipped(userId);
      if (equipped) {
        embed.setFooter({ text: `Đang trang bị: ${equipped.name}` });
      }

      await interaction.reply(toV2Payload([embed]));
      return;
    }

    if (subcommand === 'equip') {
      const type = interaction.options.getString('type', true);
      const result = companionService.equip(userId, type);
      await interaction.reply({ content: result.message, ephemeral: !result.success });
      return;
    }

    if (subcommand === 'info') {
      const equipped = companionService.getEquipped(userId);
      if (!equipped) {
        await interaction.reply({ content: '❌ Chưa trang bị Đồng Hành nào. Dùng `/donghanh list` để xem danh sách.', ephemeral: true });
        return;
      }

      const passive = companionService.getCombatPassive(userId);
      const embed = new EmbedBuilder()
        .setTitle(`🐉 ${equipped.name}`)
        .setColor(EMBED_COLORS.CAVE)
        .setDescription(
          `**Hệ:** ${equipped.element}\n` +
          `**Passive:** ${equipped.passiveDesc}\n` +
          (passive ? `**Giá trị hiện tại:** ${Math.round(passive.value * 100)}%` : '')
        )
        .setTimestamp();

      await interaction.reply(toV2Payload([embed]));
    }
  }
}
