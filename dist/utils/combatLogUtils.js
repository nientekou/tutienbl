"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCombatLog = renderCombatLog;
async function renderCombatLog(interaction, logs, title) {
    if (!logs || logs.length === 0) {
        await interaction.reply({ content: '❌ Không tìm thấy nhật ký trận đấu này.', ephemeral: true });
        return;
    }
    const logText = logs.join('\n');
    if (logText.length <= 2000) {
        await interaction.reply({ content: `📖 **${title}:**\n${logText}`, ephemeral: true });
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
        await interaction.reply({ content: chunks[0], ephemeral: true });
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ content: chunks[i], ephemeral: true });
        }
    }
}
