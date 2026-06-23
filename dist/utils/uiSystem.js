"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBED_COLORS = exports.V2_FLAG = exports.STATUS = exports.UI_COLORS = void 0;
exports.buildButton = buildButton;
exports.buildBackButton = buildBackButton;
exports.buildPrimaryButton = buildPrimaryButton;
exports.buildSuccessButton = buildSuccessButton;
exports.buildDangerButton = buildDangerButton;
exports.buildActionRow = buildActionRow;
exports.buildPaginationButtons = buildPaginationButtons;
exports.buildSelectMenu = buildSelectMenu;
exports.formatNumber = formatNumber;
exports.embedToV2 = embedToV2;
exports.toV2Payload = toV2Payload;
exports.textToV2 = textToV2;
exports.toV2TextPayload = toV2TextPayload;
exports.toV2TextUpdate = toV2TextUpdate;
exports.toV2Update = toV2Update;
exports.toLegacyUpdate = toLegacyUpdate;
const discord_js_1 = require("discord.js");
// ==================== COLOR SYSTEM ====================
exports.UI_COLORS = {
    PRIMARY: 0x8a2be2,
    SUCCESS: 0x2ecc71,
    DANGER: 0xe74c3c,
    WARNING: 0xf39c12,
    INFO: 0x3498db,
    GOLD: 0xffd700,
    MYSTIC: 0x9b59b6,
    NEUTRAL: 0x95a5a6,
    ROMANCE: 0xff69b4,
    DUNGEON: 0x2980b9,
    CAVE: 0x1abc9c,
    DARK: 0x2c3e50,
    BLOODLINE: 0x8b0000,
    REINCARNATION: 0xd35400,
    WORK: 0xe67e22,
};
// ==================== STATUS INDICATORS ====================
exports.STATUS = {
    SUCCESS: { emoji: '✅', label: 'Thành công', color: exports.UI_COLORS.SUCCESS },
    ERROR: { emoji: '❌', label: 'Thất bại', color: exports.UI_COLORS.DANGER },
    WARNING: { emoji: '⚠️', label: 'Cảnh báo', color: exports.UI_COLORS.WARNING },
    INFO: { emoji: 'ℹ️', label: 'Thông tin', color: exports.UI_COLORS.INFO },
    LOCKED: { emoji: '🔒', label: 'Khóa', color: exports.UI_COLORS.NEUTRAL },
    ACTIVE: { emoji: '🟢', label: 'Hoạt động', color: exports.UI_COLORS.SUCCESS },
    INACTIVE: { emoji: '🔴', label: 'Tắt', color: exports.UI_COLORS.DANGER },
    PENDING: { emoji: '⏳', label: 'Chờ', color: exports.UI_COLORS.WARNING },
};
// ==================== V2 HELPERS ====================
exports.V2_FLAG = discord_js_1.MessageFlags.IsComponentsV2;
// ==================== INTERACTIVE COMPONENT HELPERS ====================
function buildButton(customId, label, style = discord_js_1.ButtonStyle.Secondary, options) {
    const btn = new discord_js_1.ButtonBuilder()
        .setCustomId(customId)
        .setLabel(options?.emoji ? `${options.emoji} ${label}` : label)
        .setStyle(style);
    if (options?.disabled)
        btn.setDisabled(true);
    return btn;
}
function buildBackButton(userId, label = 'Quay lại') {
    return buildButton(`hosoback_${userId}`, label, discord_js_1.ButtonStyle.Secondary, { emoji: '🔙' });
}
function buildPrimaryButton(customId, label, emoji, disabled) {
    return buildButton(customId, label, discord_js_1.ButtonStyle.Primary, { emoji, disabled });
}
function buildSuccessButton(customId, label, emoji, disabled) {
    return buildButton(customId, label, discord_js_1.ButtonStyle.Success, { emoji, disabled });
}
function buildDangerButton(customId, label, emoji, disabled) {
    return buildButton(customId, label, discord_js_1.ButtonStyle.Danger, { emoji, disabled });
}
function buildActionRow(...components) {
    return new discord_js_1.ActionRowBuilder().addComponents(...components);
}
// ==================== PAGINATION ====================
function buildPaginationButtons(prefix, page, totalPages, userId, backButton) {
    const row = new discord_js_1.ActionRowBuilder();
    if (backButton) {
        row.addComponents(buildButton(backButton.id, backButton.label, discord_js_1.ButtonStyle.Secondary, { emoji: backButton.emoji }));
    }
    row.addComponents(buildButton(`${prefix}_${page - 1}_${userId}`, 'Trang Trước', discord_js_1.ButtonStyle.Primary, { emoji: '◀', disabled: page <= 1 }), buildButton(`${prefix}_${page + 1}_${userId}`, 'Trang Sau', discord_js_1.ButtonStyle.Primary, { emoji: '▶', disabled: page >= totalPages }));
    return row;
}
// ==================== SELECT MENU HELPERS ====================
function buildSelectMenu(customId, placeholder, options) {
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder);
    for (const opt of options) {
        const label = opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label;
        const builder = new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(opt.value);
        if (opt.description)
            builder.setDescription(opt.description);
        menu.addOptions(builder);
    }
    return menu;
}
// ==================== FORMAT HELPERS ====================
function formatNumber(n) {
    if (n === 0)
        return '0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
        return sign + (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    }
    if (abs >= 1_000_000) {
        return sign + (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }
    if (abs >= 10_000) {
        return sign + (abs / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
    }
    return sign + abs.toLocaleString('en-US');
}
/** Convert an EmbedBuilder into a structured V2 Container.
 *  Smart layout: Header → Separator → Body → Separator → Footer.
 *  Separators are only added when both adjacent sections have content.
 *  Consecutive inline fields are grouped on one line separated by │.
 *  ponytail: 4000-char limit per TextDisplay — embed authors must keep content short. */
function embedToV2(embed) {
    const d = embed.data;
    const container = new discord_js_1.ContainerBuilder();
    container.setAccentColor(d.color ?? exports.UI_COLORS.PRIMARY);
    // ── Header ──
    const headerParts = [];
    if (d.author?.name)
        headerParts.push(`### ${d.author.name}`);
    if (d.title)
        headerParts.push(`# ${d.title}`);
    // ── Body ──
    // Each non-inline field gets a blank line before it for visual breathing room.
    // Inline grouping only when value is single-line (no \n) — multi-line inline
    // fields become standalone since they can't share a line cleanly.
    // ponytail: single-line heuristic works for 95% of cases. If a command ever
    // wants multi-line inline fields grouped, pass an explicit `v2Inline: true`
    // meta-flag on the embed (not yet implemented).
    const bodyParts = [];
    if (d.description)
        bodyParts.push(d.description);
    if (d.fields?.length) {
        let inlineGroup = [];
        for (const f of d.fields) {
            if (f.inline && !f.value.includes('\n')) {
                inlineGroup.push(f);
            }
            else {
                if (inlineGroup.length) {
                    if (bodyParts.length)
                        bodyParts.push('');
                    bodyParts.push(inlineGroup.map(f => `**${f.name}:** ${f.value}`).join(' │ '));
                    inlineGroup = [];
                }
                if (bodyParts.length)
                    bodyParts.push('');
                bodyParts.push(`**${f.name}:** ${f.value}`);
            }
        }
        if (inlineGroup.length) {
            if (bodyParts.length)
                bodyParts.push('');
            bodyParts.push(inlineGroup.map(f => `**${f.name}:** ${f.value}`).join(' │ '));
        }
    }
    // ── Footer ──
    const footerParts = [];
    if (d.footer?.text)
        footerParts.push(d.footer.text);
    if (d.timestamp) {
        const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
        footerParts.push(`<t:${ts}:R>`);
    }
    // ── Assemble with smart separators ──
    const hasHeader = headerParts.length > 0;
    const hasBody = bodyParts.length > 0;
    const hasFooter = footerParts.length > 0;
    if (hasHeader) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(headerParts.join('\n')));
    }
    if (hasHeader && hasBody) {
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    }
    if (hasBody) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(bodyParts.join('\n')));
    }
    if (hasBody && hasFooter) {
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    }
    if (hasFooter) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(footerParts.join(' • ')));
    }
    if (!hasHeader && !hasBody && !hasFooter) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('\u200b'));
    }
    return container;
}
/** Convert `{ embeds, components }` to V2 message create payload (includes V2 flag). */
function toV2Payload(embeds, rows, extraFlags) {
    return { components: [...embeds.map(embedToV2), ...(rows ?? [])], flags: exports.V2_FLAG | (extraFlags ?? 0) };
}
/** Build a V2 Container holding only a plain text line. Used for text-only V2
 *  messages (close/cancel notices, simple confirmations) where mixing a legacy
 *  `content` field with V2 components throws MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2. */
function textToV2(text) {
    return new discord_js_1.ContainerBuilder().addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text || '\u200b'));
}
/** Text-only V2 create/reply payload (includes V2 flag). */
function toV2TextPayload(text, extraFlags) {
    return { components: [textToV2(text)], flags: exports.V2_FLAG | (extraFlags ?? 0) };
}
/** Text-only V2 update payload (no flag — updates an existing V2 message). */
function toV2TextUpdate(text) {
    return { components: [textToV2(text)] };
}
/** Convert `{ embeds, components }` to update payload. Always returns V2 format
 *  (components-only, no embeds field). Used for interactive updates where the
 *  source message is guaranteed V2.
 *  Pass the interaction as 3rd param for type compat, ignored at runtime.
 */
function toV2Update(embeds, rows, _source) {
    return { components: [...embeds.map(embedToV2), ...(rows ?? [])], flags: exports.V2_FLAG };
}
/** Legacy update payload — works with interaction.update() which can't use V2. */
function toLegacyUpdate(embeds, rows, _source) {
    return { embeds, components: rows ?? [] };
}
// ==================== EMBED COMPAT HELPERS ====================
exports.EMBED_COLORS = {
    ERROR: '#e74c3c',
    SUCCESS: '#2ecc71',
    INFO: '#3498db',
    WARNING: '#f1c40f',
    MYSTIC: '#9b59b6',
    DARK_PURPLE: '#8e44ad',
    GOLD: '#f1c40f',
    PRIMARY: '#8a2be2',
    NEUTRAL: '#95a5a6',
    DARK: '#34495e',
    ORANGE: '#e67e22',
    ROMANCE: '#ff69b4',
    DUNGEON: '#2980b9',
    CAVE: '#1abc9c',
    WORK: '#e67e22',
    REINCARNATION: '#d35400',
    ALERT: '#c0392b',
    LIME: '#00ff88',
    RED: '#ff0000',
    DARK_RED: '#8b0000',
};
