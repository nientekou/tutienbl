import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { gemSocketService } from '../../services/GemSocketService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class KhamNgocCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('khamngoc')
        .setDescription('Khảm nạm Linh Ngọc vào trang bị.')
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin ngọc và lỗ khảm.')
        )
        .addSubcommand(sub =>
          sub
            .setName('kham')
            .setDescription('Khảm ngọc vào trang bị.')
            .addIntegerOption(opt =>
              opt.setName('inventory_id')
                .setDescription('ID trang bị trong hành trang')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('ngoc')
                .setDescription('Loại ngọc muốn khảm')
                .setRequired(true)
                .addChoices(
                  { name: 'Hỏa Ngọc Cấp 1', value: 'gem_fire_1' },
                  { name: 'Hỏa Ngọc Cấp 2', value: 'gem_fire_2' },
                  { name: 'Hỏa Ngọc Cấp 3', value: 'gem_fire_3' },
                  { name: 'Thủy Ngọc Cấp 1', value: 'gem_water_1' },
                  { name: 'Thủy Ngọc Cấp 2', value: 'gem_water_2' },
                  { name: 'Thủy Ngọc Cấp 3', value: 'gem_water_3' },
                  { name: 'Thổ Ngọc Cấp 1', value: 'gem_earth_1' },
                  { name: 'Thổ Ngọc Cấp 2', value: 'gem_earth_2' },
                  { name: 'Thổ Ngọc Cấp 3', value: 'gem_earth_3' },
                  { name: 'Lôi Ngọc Cấp 1', value: 'gem_thunder_1' },
                  { name: 'Lôi Ngọc Cấp 2', value: 'gem_thunder_2' },
                  { name: 'Lôi Ngọc Cấp 3', value: 'gem_thunder_3' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('thao')
            .setDescription('Tháo ngọc khỏi trang bị.')
            .addIntegerOption(opt =>
              opt.setName('inventory_id')
                .setDescription('ID trang bị')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName('lo')
                .setDescription('Số lỗ (1-3)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(3)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('nangcap')
            .setDescription('Nâng cấp 3 viên ngọc cùng loại.')
            .addStringOption(opt =>
              opt.setName('ngoc')
                .setDescription('Loại ngọc muốn nâng cấp')
                .setRequired(true)
                .addChoices(
                  { name: 'Hỏa Ngọc Cấp 1 (→ Cấp 2)', value: 'gem_fire_1' },
                  { name: 'Hỏa Ngọc Cấp 2 (→ Cấp 3)', value: 'gem_fire_2' },
                  { name: 'Thủy Ngọc Cấp 1 (→ Cấp 2)', value: 'gem_water_1' },
                  { name: 'Thủy Ngọc Cấp 2 (→ Cấp 3)', value: 'gem_water_2' },
                  { name: 'Thổ Ngọc Cấp 1 (→ Cấp 2)', value: 'gem_earth_1' },
                  { name: 'Thổ Ngọc Cấp 2 (→ Cấp 3)', value: 'gem_earth_2' },
                  { name: 'Lôi Ngọc Cấp 1 (→ Cấp 2)', value: 'gem_thunder_1' },
                  { name: 'Lôi Ngọc Cấp 2 (→ Cấp 3)', value: 'gem_thunder_2' }
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
        .setTitle('💎 Khảm Nạm Linh Ngọc')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(gemSocketService.getGemInfo());
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'kham') {
      const invId = interaction.options.getInteger('inventory_id', true);
      const gemId = interaction.options.getString('ngoc', true);
      const inv = inventoryRepository.get(invId);
      if (!inv || inv.user_id !== userId) {
        await interaction.editReply({ content: '❌ Vật phẩm không tồn tại trong hành trang.' });
        return;
      }
      const result = gemSocketService.socketGem(userId, invId, gemId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Khảm Ngọc Thành Công')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
      return;
    }

    if (sub === 'thao') {
      const invId = interaction.options.getInteger('inventory_id', true);
      const slot = interaction.options.getInteger('lo', true) - 1;
      const result = gemSocketService.unsocketGem(userId, invId, slot);
      if (result.success) {
        await interaction.editReply({ content: result.message });
      } else {
        await interaction.editReply({ content: result.message });
      }
      return;
    }

    if (sub === 'nangcap') {
      const gemId = interaction.options.getString('ngoc', true);
      const result = gemSocketService.upgradeGem(userId, gemId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Nâng Cấp Ngọc Thành Công')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
