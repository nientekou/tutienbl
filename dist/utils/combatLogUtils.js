"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCombatLog = renderCombatLog;
const discord_js_1 = require("discord.js");
async function renderCombatLog(interaction, logs, title) {
    if (!logs || logs.length === 0) {
        await interaction.reply({ content: '❌ Không tìm thấy nhật ký trận đấu này.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const logText = logs.join('\n');
    if (logText.length <= 2000) {
        await interaction.reply({ content: `📖 **${title}:**\n${logText}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
    else {
        const chunks = [];
        let current = `📖 **${title} (Tiếp theo):**\n`;
        for (const line of logs) {
            if ((current + line).length > 1900) {
                chunks.push(current);
                current = line + '\n';
            }
            else {
                current += line + '\n';
            }
        }
        if (current)
            chunks.push(current);
        await interaction.reply({ content: chunks[0], flags: discord_js_1.MessageFlags.Ephemeral });
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ content: chunks[i], flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
}
