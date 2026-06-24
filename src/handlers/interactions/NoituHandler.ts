import { ButtonInteraction, StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { noituService } from '../../services/NoituService';
import { safeV2Update } from '../../utils/uiSystem';

export async function handleNoituAction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    if (action === 'noituskip') {
      const gameKey = parts.slice(1).join('_');
      if (!gameKey) {
        await interaction.reply({ content: '❌ Lỗi thiếu thông tin game.', flags: MessageFlags.Ephemeral });
        return;
      }

      const gameBefore = noituService.getGame(gameKey);
      const winnerName = gameBefore?.lastAnswererName || '';

      const result = noituService.handleSkipVote(gameKey, interaction.user.id);
      const game = noituService.getGame(gameKey);

      if (result === 'no_game') {
        await interaction.reply({ content: '❌ Không có ván Nối Từ nào!', flags: MessageFlags.Ephemeral });
        return;
      }
      if (result === 'already_voted') {
        await interaction.reply({ content: 'Bạn đã bỏ phiếu bỏ qua từ này rồi!', flags: MessageFlags.Ephemeral });
        return;
      }
      if (result === 'voted' && game) {
        const updatedEmbed = noituService.buildSkipVoteEmbed(game);
        const updatedRow = noituService.buildSkipVoteRow(gameKey);
        await safeV2Update(interaction, [updatedEmbed], [updatedRow]);
        return;
      }
      if (result === 'skip_passed') {
        if (game) {
          const passedEmbed = noituService.buildSkipPassedEmbed(winnerName, game);
          await safeV2Update(interaction, [passedEmbed], []);
        }
        return;
      }
    }
  } catch (error) {
    console.error(`[NoituHandler] Lỗi xử lý action ${action}:`, error);
  }
}
