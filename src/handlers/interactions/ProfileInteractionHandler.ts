import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { getHoSoTabEmbed, getHoSoAllComponents, HoSoTab } from '../../commands/general/hoso';

export class ProfileInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ) {
    if (action === 'hosotab') {
      const tabName = parts[1] as HoSoTab;
      const embed = getHoSoTabEmbed(targetUserId, tabName);
      const components = getHoSoAllComponents(targetUserId, tabName);
      await interaction.update({ embeds: [embed], components });
      return;
    }
    
    // Nút quay lại hồ sơ từ các menu khác (như tẩy tủy, lôi kiếp)
    if (action === 'hosoback') {
      const embed = getHoSoTabEmbed(targetUserId, 'chiso');
      const components = getHoSoAllComponents(targetUserId, 'chiso');
      await interaction.update({ embeds: [embed], components });
      return;
    }
  }
}
