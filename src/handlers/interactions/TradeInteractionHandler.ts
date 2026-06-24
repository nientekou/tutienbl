import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { tradeService } from '../../services/TradeService';
import { safeV2Update } from '../../utils/uiSystem';

export class TradeInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ) {
    const tradeId = parts.slice(2).join('_');
    const subAction = parts[1]; // 'accept', 'cancel', 'lock', 'confirm'

    const trade = tradeService.getTrade(tradeId);
    if (!trade) {
      await interaction.reply({ content: '❌ Giao dịch này không tồn tại hoặc đã kết thúc.', flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.user.id;

    if (subAction === 'accept') {
      const res = tradeService.acceptTrade(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const ui = tradeService.renderTradeUI(tradeId);
      if (ui) {
        await safeV2Update(interaction, ui.embeds, ui.components);
      }
    } 
    
    else if (subAction === 'cancel') {
      const res = tradeService.cancelTrade(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      await safeV2Update(interaction, [new EmbedBuilder().setDescription(`❌ Giao dịch đã bị hủy bởi <@${userId}>.`)], []);
    } 
    
    else if (subAction === 'lock') {
      const res = tradeService.toggleLock(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const ui = tradeService.renderTradeUI(tradeId);
      if (ui) {
        await safeV2Update(interaction, ui.embeds, ui.components);
      }
    } 
    
    else if (subAction === 'confirm') {
      const res = tradeService.toggleConfirm(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (res.isComplete) {
        await safeV2Update(interaction, [new EmbedBuilder().setDescription(`🎉 **${res.message}**`)], []);
      } else {
        const ui = tradeService.renderTradeUI(tradeId);
        if (ui) {
          await safeV2Update(interaction, ui.embeds, ui.components);
        }
      }
    }
  }
}
