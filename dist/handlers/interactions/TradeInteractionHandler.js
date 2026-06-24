"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeInteractionHandler = void 0;
const discord_js_1 = require("discord.js");
const TradeService_1 = require("../../services/TradeService");
const uiSystem_1 = require("../../utils/uiSystem");
class TradeInteractionHandler {
    static async handle(interaction, action, parts, targetUserId) {
        const tradeId = parts.slice(2).join('_');
        const subAction = parts[1]; // 'accept', 'cancel', 'lock', 'confirm'
        const trade = TradeService_1.tradeService.getTrade(tradeId);
        if (!trade) {
            await interaction.reply({ content: '❌ Giao dịch này không tồn tại hoặc đã kết thúc.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const userId = interaction.user.id;
        if (subAction === 'accept') {
            const res = TradeService_1.tradeService.acceptTrade(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
            if (ui) {
                await (0, uiSystem_1.safeV2Update)(interaction, ui.embeds, ui.components);
            }
        }
        else if (subAction === 'cancel') {
            const res = TradeService_1.tradeService.cancelTrade(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            await (0, uiSystem_1.safeV2Update)(interaction, [new discord_js_1.EmbedBuilder().setDescription(`❌ Giao dịch đã bị hủy bởi <@${userId}>.`)], []);
        }
        else if (subAction === 'lock') {
            const res = TradeService_1.tradeService.toggleLock(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
            if (ui) {
                await (0, uiSystem_1.safeV2Update)(interaction, ui.embeds, ui.components);
            }
        }
        else if (subAction === 'confirm') {
            const res = TradeService_1.tradeService.toggleConfirm(tradeId, userId);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            if (res.isComplete) {
                await (0, uiSystem_1.safeV2Update)(interaction, [new discord_js_1.EmbedBuilder().setDescription(`🎉 **${res.message}**`)], []);
            }
            else {
                const ui = TradeService_1.tradeService.renderTradeUI(tradeId);
                if (ui) {
                    await (0, uiSystem_1.safeV2Update)(interaction, ui.embeds, ui.components);
                }
            }
        }
    }
}
exports.TradeInteractionHandler = TradeInteractionHandler;
