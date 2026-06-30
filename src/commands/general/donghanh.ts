import { ChatInputCommandInteraction, SlashCommandBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { companionService } from '../../services/CompanionService';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

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
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const desc = companionService.getDescription(userId);
      const content = [
        header('🐉 Đồng Hành Chi Lộ', 'Đồng hành tu tiên trợ chiến gia tăng công kích lực và hộ thân cường độ.'),
        separator(),
        body(desc)
      ];
      const equipped = companionService.getEquipped(userId);
      if (equipped) {
        content.push(separator());
        content.push(body(`🛡️ **Đang xuất chiến:** ${equipped.name}`));
      }
      const embed = container(V2_COLORS.mystic, content);

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (subcommand === 'equip') {
      const type = interaction.options.getString('type', true);
      const result = companionService.equip(userId, type);
      await interaction.editReply({ content: result.message });
      return;
    }

    if (subcommand === 'info') {
      const equipped = companionService.getEquipped(userId);
      if (!equipped) {
        await interaction.editReply({ content: '❌ Chưa trang bị Đồng Hành nào. Dùng `/donghanh list` để xem danh sách.' });
        return;
      }

      const passive = companionService.getCombatPassive(userId);
      const embed = container(V2_COLORS.mystic, [
        header(`🐉 Đồng Hành: ${equipped.name}`, `Hệ nguyên tố: **${equipped.element}**`),
        separator(),
        body(
          `• **Nội tại:** ${equipped.passiveDesc}\n` +
          (passive ? `• **Giá trị cường độ hiện tại:** **${Math.round(passive.value * 100)}%**` : '')
        )
      ]);

      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
