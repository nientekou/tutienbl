import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { blacksmithService } from '../../services/BlacksmithService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';

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
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('ID vật phẩm trong hành trang').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) { await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'}); return; }

    const sub = interaction.options.getSubcommand();

    if (sub === 'phan-ra') {
      const idsStr = interaction.options.getString('ids', true);
      const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      if (ids.length === 0) {
        await interaction.editReply({ content: '❌ Định dạng ID không hợp lệ. Ví dụ đúng: 12, 34, 56'});
        return;
      }

      const result = blacksmithService.dismantleItem(userId, ids);
      await interaction.editReply({ content: result.message });

    } else if (sub === 'tinh-luyen') {
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const invRow = inventoryRepository.get(inventoryId) as { id: number; user_id: string } | undefined;
      if (!invRow || invRow.user_id !== userId) {
        await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!`});
        return;
      }
      
      const result = blacksmithService.refineItem(userId, invRow.id);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('🔨 Tinh Luyện Trang Bị')
          .setColor('#f1c40f')
          .setDescription(result.message)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
