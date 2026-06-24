import { ButtonInteraction, StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { userRepository } from '../../database/repositories/UserRepository';
import { getAchievementCategoryEmbed, getAchievementCategoryComponents } from '../../commands/general/thanhtuu';
import { toV2Payload, safeV2Update } from '../../utils/uiSystem';

type AchInteraction = ButtonInteraction | StringSelectMenuInteraction;

export async function handleAchievementAction(
  interaction: AchInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    const targetUserId = userId;

    if (action === 'thanhtuu') {
      const { achievementService } = require('../../services/AchievementService');
      const embed = getAchievementCategoryEmbed(targetUserId, 'general', 1);
      const components = getAchievementCategoryComponents(targetUserId, 'general', 1, (embed as any).totalPages || 1);
      await safeV2Update(interaction, [(embed as any).embed || embed], components);
      return;
    }

    if (action === 'achieveclaim') {
      const achievementId = parts[1];
      const { achievementService } = require('../../services/AchievementService');
      const result = achievementService.claimReward(targetUserId, achievementId);
      await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'titleselect') {
      const titleName = parts.slice(1).join('_').replace(/_/g, ' ');
      const { achievementService } = require('../../services/AchievementService');
      const result = achievementService.setTitle(targetUserId, titleName);
      await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'dest_select' || action === 'dest_confirm') {
      const { destinyRepository } = require('../../database/repositories/DestinyRepository');
      if (action === 'dest_select' && interaction.isStringSelectMenu()) {
        const destinyId = parseInt(interaction.values[0], 10);
        const result = destinyRepository.equipDestiny(targetUserId, destinyId);
        await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
      }
      return;
    }
  } catch (error) {
    console.error(`[AchievementInteractionHandler] Lỗi xử lý action ${action}:`, error);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable()) {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
}
