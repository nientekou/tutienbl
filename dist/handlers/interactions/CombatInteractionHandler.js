"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCombatAction = handleCombatAction;
const discord_js_1 = require("discord.js");
async function handleCombatAction(interaction, action, parts, userId) {
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
                await interaction.reply({ content: result.success ? result.message : `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        if (action === 'bicanh') {
            const { SocialHandler } = require('./SocialHandler');
            await SocialHandler.handle(interaction, action, parts, userId);
            return;
        }
    }
    catch (error) {
        console.error(`[CombatInteractionHandler] Lỗi xử lý action ${action}:`, error);
    }
}
