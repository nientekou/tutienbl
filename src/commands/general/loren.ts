import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { blacksmithService } from '../../services/BlacksmithService';

export default class LoRenCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('loren')
        .setDescription('Lò Rèn Tiên Giới - Tinh Luyện & Phân Rã Trang Bị')
        .addSubcommand(sub =>
          sub.setName('phan-ra')
            .setDescription('Nung chảy trang bị rác để lấy Huyền Thiết')
            .addStringOption(opt => opt.setName('ids').setDescription('Danh sách Mã hành trang trang bị (VD: 12,34,56)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('tinh-luyen')
            .setDescription('Đập thăng sao trang bị (Tốn Huyền Thiết & Linh Thạch)')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm trong túi đồ').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) { await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true }); return; }

    const sub = interaction.options.getSubcommand();

    if (sub === 'phan-ra') {
      const idsStr = interaction.options.getString('ids', true);
      const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      if (ids.length === 0) {
        await interaction.reply({ content: '❌ Định dạng ID không hợp lệ. Ví dụ đúng: 12, 34, 56', ephemeral: true });
        return;
      }

      const result = blacksmithService.dismantleItem(userId, ids);
      await interaction.reply({ content: result.message });

    } else if (sub === 'tinh-luyen') {
      const invId = interaction.options.getInteger('inventory_id', true);
      
      const result = blacksmithService.refineItem(userId, invId);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('🔨 Tinh Luyện Trang Bị')
          .setColor('#f1c40f')
          .setDescription(result.message)
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({ content: result.message });
      }
    }
  }
}
