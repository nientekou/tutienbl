import { ButtonInteraction } from 'discord.js';
import { tradeService } from '../../services/TradeService';

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
      await interaction.reply({ content: '❌ Giao dịch này không tồn tại hoặc đã kết thúc.', ephemeral: true });
      return;
    }

    const userId = interaction.user.id;

    if (subAction === 'accept') {
      const res = tradeService.acceptTrade(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      const ui = tradeService.renderTradeUI(tradeId);
      if (ui) {
        await interaction.update({ embeds: ui.embeds, components: ui.components });
      }
    } 
    
    else if (subAction === 'cancel') {
      const res = tradeService.cancelTrade(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      await interaction.update({ content: `❌ Giao dịch đã bị hủy bởi <@${userId}>.`, embeds: [], components: [] });
    } 
    
    else if (subAction === 'lock') {
      const res = tradeService.toggleLock(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      const ui = tradeService.renderTradeUI(tradeId);
      if (ui) {
        await interaction.update({ embeds: ui.embeds, components: ui.components });
      }
    } 
    
    else if (subAction === 'confirm') {
      const res = tradeService.toggleConfirm(tradeId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      if (res.isComplete) {
        await interaction.update({ content: `🎉 **${res.message}**`, embeds: [], components: [] });
      } else {
        const ui = tradeService.renderTradeUI(tradeId);
        if (ui) {
          await interaction.update({ embeds: ui.embeds, components: ui.components });
        }
      }
    }
  }
}
