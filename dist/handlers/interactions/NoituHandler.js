"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNoituAction = handleNoituAction;
const discord_js_1 = require("discord.js");
const NoituService_1 = require("../../services/NoituService");
const uiSystem_1 = require("../../utils/uiSystem");
async function handleNoituAction(interaction, action, parts, userId) {
    try {
        if (action === 'noituskip') {
            const gameKey = parts.slice(1).join('_');
            if (!gameKey) {
                await interaction.reply({ content: '❌ Lỗi thiếu thông tin game.', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const gameBefore = NoituService_1.noituService.getGame(gameKey);
            const winnerName = gameBefore?.lastAnswererName || '';
            const result = NoituService_1.noituService.handleSkipVote(gameKey, interaction.user.id);
            const game = NoituService_1.noituService.getGame(gameKey);
            if (result === 'no_game') {
                await interaction.reply({ content: '❌ Không có ván Nối Từ nào!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            if (result === 'already_voted') {
                await interaction.reply({ content: 'Bạn đã bỏ phiếu bỏ qua từ này rồi!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            if (result === 'voted' && game) {
                const updatedEmbed = NoituService_1.noituService.buildSkipVoteEmbed(game);
                const updatedRow = NoituService_1.noituService.buildSkipVoteRow(gameKey);
                await (0, uiSystem_1.safeV2Update)(interaction, [updatedEmbed], [updatedRow]);
                return;
            }
            if (result === 'skip_passed') {
                if (game) {
                    const passedEmbed = NoituService_1.noituService.buildSkipPassedEmbed(winnerName, game);
                    await (0, uiSystem_1.safeV2Update)(interaction, [passedEmbed], []);
                }
                return;
            }
        }
    }
    catch (error) {
        console.error(`[NoituHandler] Lỗi xử lý action ${action}:`, error);
        try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else if (interaction.isRepliable()) {
                await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (_) { }
    }
}
