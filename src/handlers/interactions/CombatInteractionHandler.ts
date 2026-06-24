import { ButtonInteraction, StringSelectMenuInteraction, MessageFlags } from 'discord.js';

type CombatInteraction = ButtonInteraction | StringSelectMenuInteraction;

export async function handleCombatAction(
  interaction: CombatInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    // PvP duel actions → delegate to DuelInteractionHandler
    if (['duelaccept', 'duelrefuse', 'duelchoose', 'dueluseitem', 'duellichsu'].includes(action)) {
      const { DuelInteractionHandler } = require('./DuelInteractionHandler');
      await DuelInteractionHandler.handle(interaction, action, parts);
      return;
    }

    // Guild war / Sect war → delegate to SocialHandler
    if (['guildwar_join', 'sectwar_join'].includes(action)) {
      const { SocialHandler } = require('./SocialHandler');
      await SocialHandler.handle(interaction, action, parts, userId);
      return;
    }

    // Arena / PvP ranked
    if (['pvp', 'arena_ranked', 'arena_streak', 'arena_rewards_claim'].includes(action)) {
      const { rankedArenaService } = require('../../services/RankedArenaService');
      const { pvpService } = require('../../services/PvPService');
      if (action === 'pvp') {
        const result = await pvpService.startMatch(userId);
        await interaction.reply({ content: result.success ? result.message : `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (action === 'bicanh') {
      const { SocialHandler } = require('./SocialHandler');
      await SocialHandler.handle(interaction, action, parts, userId);
      return;
    }
  } catch (error) {
    console.error(`[CombatInteractionHandler] Lỗi xử lý action ${action}:`, error);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable()) {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
}
