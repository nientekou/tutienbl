"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeInteractionHandler = void 0;
const TradeService_1 = require("../../services/TradeService");
class TradeInteractionHandler {
    static async handle(interaction, action, parts, targetUserId) {
        const tradeId = parts.slice(2).join('_');
        const subAction = parts[1]; // 'accept', 'cancel', 'lock', 'confirm'
        const trade = TradeService_1.tradeService.getTrade(tradeId);
        if (!trade) {
            await interaction.reply({ content: '❌ Giao dịch này không tồn tại hoặc đã kết thúc.', ephemeral: true });
            return;
        }
        const userId = interaction.user.id;
        if (subAction === 'accept') {
            const res = TradeService_1.tradeService.acceptTrade(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
                return;
            }
            const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
            if (ui) {
                await interaction.update({ embeds: ui.embeds, components: ui.components });
            }
        }
        else if (subAction === 'cancel') {
            const res = TradeService_1.tradeService.cancelTrade(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
                return;
            }
            await interaction.update({ content: `❌ Giao dịch đã bị hủy bởi <@${userId}>.`, embeds: [], components: [] });
        }
        else if (subAction === 'lock') {
            const res = TradeService_1.tradeService.toggleLock(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
                return;
            }
            const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
            if (ui) {
                await interaction.update({ embeds: ui.embeds, components: ui.components });
            }
        }
        else if (subAction === 'confirm') {
            const res = TradeService_1.tradeService.toggleConfirm(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
                return;
            }
            if (res.isComplete) {
                await interaction.update({ content: `🎉 **${res.message}**`, embeds: [], components: [] });
            }
            else {
                const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
                if (ui) {
                    await interaction.update({ embeds: ui.embeds, components: ui.components });
                }
            }
        }
    }
}
exports.TradeInteractionHandler = TradeInteractionHandler;
