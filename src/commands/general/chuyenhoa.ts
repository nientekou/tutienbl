import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { transmutationService } from '../../services/TransmutationService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class ChuyenHoaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('chuyenhoa')
        .setDescription('Chuyển hóa nguyên liệu cấp thấp thành cấp cao hơn.')
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin chuyển hóa nguyên liệu.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thuchien')
            .setDescription('Thực hiện chuyển hóa nguyên liệu.')
            .addStringOption(opt =>
              opt.setName('loai')
                .setDescription('Loại nguyên liệu muốn chuyển hóa')
                .setRequired(true)
                .addChoices(
                  { name: 'Thảo Dược Thường → Quý (10:1, 100 LT)', value: 'herb_1' },
                  { name: 'Thảo Dược Quý → Huyền Thoại (5:1, 500 LT)', value: 'herb_rare' },
                  { name: 'Nguyên Liệu Thường → Quý (10:1, 100 LT)', value: 'material_common' },
                  { name: 'Nguyên Liệu Quý → Huyền Thoại (5:1, 500 LT)', value: 'material_rare' }
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
      const info = transmutationService.getTransmuteInfo();
      const embed = new EmbedBuilder()
        .setTitle('🔄 Chuyển Hóa Nguyên Liệu')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(info.replace(/\n/g, '\n'))
        .setFooter({ text: 'Dùng /chuyenhoa thuchien để thực hiện' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'thuchien') {
      const materialId = interaction.options.getString('loai', true);
      const result = transmutationService.transmuteMaterial(userId, materialId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Chuyển Hóa Thành Công')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
    }
  }
}
