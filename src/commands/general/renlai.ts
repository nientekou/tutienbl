import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { enhanceService } from '../../services/EnhanceService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class RenLaiCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('renlai')
        .setDescription('Rèn lại chỉ số trang bị.')
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin hệ thống rèn lại.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thuchien')
            .setDescription('Rèn lại 1 chỉ số ngẫu nhiên trên trang bị.')
            .addIntegerOption(opt =>
              opt.setName('inventory_id')
                .setDescription('ID trang bị trong hành trang (cần đang đeo)')
                .setRequired(true)
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
        .setTitle('🔧 Rèn Lại Trang Bị')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(
          'Reroll 1 chỉ số ngẫu nhiên trên trang bị với biến động ±20%.\n\n' +
          '• **Yêu cầu:** Trang bị đang đeo\n' +
          '• **Phí:** 1.000 LT + 50 Nguyên Liệu Trung Phẩm\n' +
          '• **Giới hạn:** 3 lần / trang bị\n' +
          '• **Cơ chế:** Chọn 1 stat ngẫu nhiên, dao động ±20%\n\n' +
          'Dùng `/renlai thuchien` để rèn lại.'
        )
        .setFooter({ text: 'Dùng /renlai thuchien inventory_id:<ID>' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'thuchien') {
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const invItem = inventoryRepository.get(inventoryId);
      if (!invItem || invItem.user_id !== userId) {
        await interaction.editReply({ content: '❌ Không tìm thấy trang bị trong hành trang!' });
        return;
      }

      const result = enhanceService.reforge(userId, inventoryId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Rèn Lại Thành Công')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
