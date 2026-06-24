"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAchievementAction = handleAchievementAction;
const discord_js_1 = require("discord.js");
const thanhtuu_1 = require("../../commands/general/thanhtuu");
const uiSystem_1 = require("../../utils/uiSystem");
async function handleAchievementAction(interaction, action, parts, userId) {
    try {
        const targetUserId = userId;
        if (action === 'thanhtuu') {
            const { achievementService } = require('../../services/AchievementService');
            const embed = (0, thanhtuu_1.getAchievementCategoryEmbed)(targetUserId, 'general', 1);
            const components = (0, thanhtuu_1.getAchievementCategoryComponents)(targetUserId, 'general', 1, embed.totalPages || 1);
            await (0, uiSystem_1.safeV2Update)(interaction, [embed.embed || embed], components);
            return;
        }
        if (action === 'achieveclaim') {
            const achievementId = parts[1];
            const { achievementService } = require('../../services/AchievementService');
            const result = achievementService.claimReward(targetUserId, achievementId);
            await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (action === 'titleselect') {
            const titleName = parts.slice(1).join('_').replace(/_/g, ' ');
            const { achievementService } = require('../../services/AchievementService');
            const result = achievementService.setTitle(targetUserId, titleName);
            await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (action === 'dest_select' || action === 'dest_confirm') {
            const { destinyRepository } = require('../../database/repositories/DestinyRepository');
            if (action === 'dest_select' && interaction.isStringSelectMenu()) {
                const destinyId = parseInt(interaction.values[0], 10);
                const result = destinyRepository.equipDestiny(targetUserId, destinyId);
                await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
    }
    catch (error) {
        console.error(`[AchievementInteractionHandler] Lỗi xử lý action ${action}:`, error);
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
