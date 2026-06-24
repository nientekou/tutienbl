"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V2_COLORS = exports.V2_FLAG = void 0;
exports.header = header;
exports.body = body;
exports.separator = separator;
exports.container = container;
exports.primaryBtn = primaryBtn;
exports.successBtn = successBtn;
exports.dangerBtn = dangerBtn;
exports.secondaryBtn = secondaryBtn;
exports.row = row;
exports.progressBar = progressBar;
exports.statLine = statLine;
exports.formatNumber = formatNumber;
exports.confirmationContainer = confirmationContainer;
exports.progressBarContainer = progressBarContainer;
const discord_js_1 = require("discord.js");
exports.V2_FLAG = discord_js_1.MessageFlags.IsComponentsV2;
exports.V2_COLORS = {
    primary: 0x5865F2,
    success: 0x57F287,
    danger: 0xED4245,
    warning: 0xFEE75C,
    info: 0x00BFFF,
    gold: 0xFFD700,
    silver: 0xC0C0C0,
    bronze: 0xCD7F32,
    mystic: 0x9B59B6,
    dark: 0x2C2F33,
    bloodline: 0xE74C3C,
    reincarnation: 0x8E44AD,
    realms: [0x9B59B6, 0x3498DB, 0x2ECC71, 0xF1C40F, 0xE74C3C, 0x1ABC9C, 0xE67E22, 0x95A5A6, 0xD35400, 0x8E44AD]
};
function header(title, description) {
    let content = `## ${title}`;
    if (description)
        content += `\n${description}`;
    return new discord_js_1.TextDisplayBuilder().setContent(content);
}
function body(text) {
    return new discord_js_1.TextDisplayBuilder().setContent(text);
}
function separator(spacing = discord_js_1.SeparatorSpacingSize.Small) {
    return new discord_js_1.SeparatorBuilder().setSpacing(spacing);
}
function container(color, components) {
    const c = new discord_js_1.ContainerBuilder().setAccentColor(color);
    for (const comp of components) {
        if (comp instanceof discord_js_1.TextDisplayBuilder)
            c.addTextDisplayComponents(comp);
        else if (comp instanceof discord_js_1.SeparatorBuilder)
            c.addSeparatorComponents(comp);
        else if (comp instanceof discord_js_1.ActionRowBuilder)
            c.addActionRowComponents(comp);
    }
    return c;
}
function primaryBtn(label, customId, emoji) {
    const b = new discord_js_1.ButtonBuilder().setStyle(discord_js_1.ButtonStyle.Primary).setLabel(label).setCustomId(customId);
    if (emoji)
        b.setEmoji(emoji);
    return b;
}
function successBtn(label, customId, emoji) {
    const b = new discord_js_1.ButtonBuilder().setStyle(discord_js_1.ButtonStyle.Success).setLabel(label).setCustomId(customId);
    if (emoji)
        b.setEmoji(emoji);
    return b;
}
function dangerBtn(label, customId, emoji) {
    const b = new discord_js_1.ButtonBuilder().setStyle(discord_js_1.ButtonStyle.Danger).setLabel(label).setCustomId(customId);
    if (emoji)
        b.setEmoji(emoji);
    return b;
}
function secondaryBtn(label, customId, emoji) {
    const b = new discord_js_1.ButtonBuilder().setStyle(discord_js_1.ButtonStyle.Secondary).setLabel(label).setCustomId(customId);
    if (emoji)
        b.setEmoji(emoji);
    return b;
}
function row(...buttons) {
    return new discord_js_1.ActionRowBuilder().addComponents(...buttons);
}
function progressBar(current, max, size = 10) {
    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(size * ratio);
    return '█'.repeat(filled) + '░'.repeat(size - filled);
}
function statLine(label, value, emoji) {
    return `${emoji ? emoji + ' ' : ''}**${label}**: ${value}`;
}
function formatNumber(n) {
    if (n >= 1_000_000_000)
        return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000)
        return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)
        return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
}
function confirmationContainer(title, message, confirmId, cancelId) {
    return container(exports.V2_COLORS.warning, [
        header(title),
        body(message),
        separator(),
        row(successBtn('Xác nhận', confirmId, '✅'), dangerBtn('Hủy', cancelId, '❌'))
    ]);
}
function progressBarContainer(label, current, max, color) {
    return container(color, [
        header(label),
        body(`${progressBar(current, max, 15)} ${current}/${max} (${Math.round(current / max * 100)}%)`)
    ]);
}
