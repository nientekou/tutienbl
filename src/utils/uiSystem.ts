import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  Routes,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

// ==================== COLOR SYSTEM ====================

export const UI_COLORS = {
  PRIMARY: 0x8a2be2 as const,
  SUCCESS: 0x2ecc71 as const,
  DANGER: 0xe74c3c as const,
  WARNING: 0xf39c12 as const,
  INFO: 0x3498db as const,
  GOLD: 0xffd700 as const,
  MYSTIC: 0x9b59b6 as const,
  NEUTRAL: 0x95a5a6 as const,
  ROMANCE: 0xff69b4 as const,
  DUNGEON: 0x2980b9 as const,
  CAVE: 0x1abc9c as const,
  DARK: 0x2c3e50 as const,
  BLOODLINE: 0x8b0000 as const,
  REINCARNATION: 0xd35400 as const,
  WORK: 0xe67e22 as const,
} as const;

export type UIColor = (typeof UI_COLORS)[keyof typeof UI_COLORS];

// ==================== STATUS INDICATORS ====================

export const STATUS = {
  SUCCESS: { emoji: '✅', label: 'Thành công', color: UI_COLORS.SUCCESS },
  ERROR: { emoji: '❌', label: 'Thất bại', color: UI_COLORS.DANGER },
  WARNING: { emoji: '⚠️', label: 'Cảnh báo', color: UI_COLORS.WARNING },
  INFO: { emoji: 'ℹ️', label: 'Thông tin', color: UI_COLORS.INFO },
  LOCKED: { emoji: '🔒', label: 'Khóa', color: UI_COLORS.NEUTRAL },
  ACTIVE: { emoji: '🟢', label: 'Hoạt động', color: UI_COLORS.SUCCESS },
  INACTIVE: { emoji: '🔴', label: 'Tắt', color: UI_COLORS.DANGER },
  PENDING: { emoji: '⏳', label: 'Chờ', color: UI_COLORS.WARNING },
} as const;

// ==================== V2 HELPERS ====================

export const V2_FLAG = MessageFlags.IsComponentsV2;



// ==================== INTERACTIVE COMPONENT HELPERS ====================

export function buildButton(
  customId: string,
  label: string,
  style: ButtonStyle = ButtonStyle.Secondary,
  options?: { emoji?: string; disabled?: boolean },
): ButtonBuilder {
  const btn = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(options?.emoji ? `${options.emoji} ${label}` : label)
    .setStyle(style);
  if (options?.disabled) btn.setDisabled(true);
  return btn;
}

export function buildBackButton(userId: string, label: string = 'Quay lại'): ButtonBuilder {
  return buildButton(`hosoback_${userId}`, label, ButtonStyle.Secondary, { emoji: '🔙' });
}

export function buildPrimaryButton(
  customId: string,
  label: string,
  emoji?: string,
  disabled?: boolean,
): ButtonBuilder {
  return buildButton(customId, label, ButtonStyle.Primary, { emoji, disabled });
}

export function buildSuccessButton(
  customId: string,
  label: string,
  emoji?: string,
  disabled?: boolean,
): ButtonBuilder {
  return buildButton(customId, label, ButtonStyle.Success, { emoji, disabled });
}

export function buildDangerButton(
  customId: string,
  label: string,
  emoji?: string,
  disabled?: boolean,
): ButtonBuilder {
  return buildButton(customId, label, ButtonStyle.Danger, { emoji, disabled });
}

export function buildActionRow<T extends ButtonBuilder | StringSelectMenuBuilder>(
  ...components: T[]
): ActionRowBuilder<T> {
  return new ActionRowBuilder<T>().addComponents(...components);
}

// ==================== PAGINATION ====================

export function buildPaginationButtons(
  prefix: string,
  page: number,
  totalPages: number,
  userId: string,
  backButton?: { id: string; label: string; emoji?: string },
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (backButton) {
    row.addComponents(
      buildButton(backButton.id, backButton.label, ButtonStyle.Secondary, { emoji: backButton.emoji }),
    );
  }
  row.addComponents(
    buildButton(
      `${prefix}_${page - 1}_${userId}`,
      'Trang Trước',
      ButtonStyle.Primary,
      { emoji: '◀', disabled: page <= 1 },
    ),
    buildButton(
      `${prefix}_${page + 1}_${userId}`,
      'Trang Sau',
      ButtonStyle.Primary,
      { emoji: '▶', disabled: page >= totalPages },
    ),
  );
  return row;
}

// ==================== SELECT MENU HELPERS ====================

export function buildSelectMenu(
  customId: string,
  placeholder: string,
  options: Array<{ label: string; value: string; description?: string; emoji?: string }>,
): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder);
  for (const opt of options) {
    const label = opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label;
    const builder = new StringSelectMenuOptionBuilder()
      .setLabel(label)
      .setValue(opt.value);
    if (opt.description) builder.setDescription(opt.description);
    menu.addOptions(builder);
  }
  return menu;
}

// ==================== FORMAT HELPERS ====================

export function formatNumber(n: number): string {
  if (n === 0) return '0';
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
export function embedToV2(embed: EmbedBuilder): ContainerBuilder {
  const d = embed.data;
  const container = new ContainerBuilder();
  container.setAccentColor(d.color ?? UI_COLORS.PRIMARY);

  // ── Header ──
  const headerParts: string[] = [];
  if (d.author?.name) headerParts.push(`### ${d.author.name}`);
  if (d.title) headerParts.push(`# ${d.title}`);

  // ── Body ──
  // Each non-inline field gets a blank line before it for visual breathing room.
  // Inline grouping only when value is single-line (no \n) — multi-line inline
  // fields become standalone since they can't share a line cleanly.
  // ponytail: single-line heuristic works for 95% of cases. If a command ever
  // wants multi-line inline fields grouped, pass an explicit `v2Inline: true`
  // meta-flag on the embed (not yet implemented).
  const bodyParts: string[] = [];
  if (d.description) bodyParts.push(d.description);
  if (d.fields?.length) {
    let inlineGroup: typeof d.fields = [];
    for (const f of d.fields) {
      if (f.inline && !f.value.includes('\n')) {
        inlineGroup.push(f);
      } else {
        if (inlineGroup.length) {
          if (bodyParts.length) bodyParts.push('');
          bodyParts.push(inlineGroup.map(f => `**${f.name}:** ${f.value}`).join(' │ '));
          inlineGroup = [];
        }
        if (bodyParts.length) bodyParts.push('');
        bodyParts.push(`**${f.name}:** ${f.value}`);
      }
    }
    if (inlineGroup.length) {
      if (bodyParts.length) bodyParts.push('');
      bodyParts.push(inlineGroup.map(f => `**${f.name}:** ${f.value}`).join(' │ '));
    }
  }

  // ── Footer ──
  const footerParts: string[] = [];
  if (d.footer?.text) footerParts.push(d.footer.text);
  if (d.timestamp) {
    const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
    footerParts.push(`<t:${ts}:R>`);
  }

  // ── Assemble with smart separators ──
  // ponytail: Discord V2 limits total displayable text to 4000 chars across
  // ALL TextDisplays in a message. If the body is too long, truncate it.
  // Upgrade path: paginate commands that generate large embeds.
  const MAX_TOTAL = 4000;

  const headerText = headerParts.join('\n');
  const bodyText = bodyParts.join('\n');
  const footerText = footerParts.join(' • ');

  const hasHeader = headerText.length > 0;
  const hasBody = bodyText.length > 0;
  const hasFooter = footerText.length > 0;

  // Reserve space for separators (2 chars each: \n\n)
  const sepCost = (hasHeader && hasBody ? 2 : 0) + (hasBody && hasFooter ? 2 : 0);
  // Header & footer are typically short so we keep them whole; body gets truncated if needed.
  let finalBody = bodyText;
  const overhead = headerText.length + footerText.length + sepCost;
  if (hasBody && finalBody.length + overhead > MAX_TOTAL) {
    const available = MAX_TOTAL - overhead - 3; // 3 for '...'
    if (available > 0) {
      finalBody = finalBody.slice(0, available) + '...';
    } else {
      finalBody = '';
    }
  }

  function addText(text: string) {
    if (text.length > 4000) text = text.slice(0, 3997) + '...';
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text || '\u200b'));
  }

  if (hasHeader) addText(headerText);
  if (hasHeader && hasBody && finalBody.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  }
  if (hasBody && finalBody.length > 0) addText(finalBody);
  if (hasBody && hasFooter && finalBody.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  }
  if (hasFooter) addText(footerText);

  if (!hasHeader && !(hasBody && finalBody.length > 0) && !hasFooter) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('\u200b'));
  }
  return container;
}

/** Convert `{ embeds, components }` to V2 message create payload (includes V2 flag). */
export function toV2Payload(
  embeds: (EmbedBuilder | ContainerBuilder)[],
  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[],
  extraFlags?: number,
): { components: any[]; flags: number } {
  return { components: [...embeds.map(e => e instanceof ContainerBuilder ? e : embedToV2(e)), ...(rows ?? [])], flags: V2_FLAG | (extraFlags ?? 0) };
}

/** Build a V2 Container holding only a plain text line. Used for text-only V2
 *  messages (close/cancel notices, simple confirmations) where mixing a legacy
 *  `content` field with V2 components throws MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2. */
export function textToV2(text: string): ContainerBuilder {
  const container = new ContainerBuilder();
  let content = text || '\u200b';
  // ponytail: total displayable text across all components is capped at 4000
  if (content.length > 4000) content = content.slice(0, 3997) + '...';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  return container;
}

/** Text-only V2 create/reply payload (includes V2 flag). */
export function toV2TextPayload(
  text: string,
  extraFlags?: number,
): { components: any[]; flags: number } {
  return { components: [textToV2(text)], flags: V2_FLAG | (extraFlags ?? 0) };
}

/** Text-only V2 update payload (no flag — updates an existing V2 message). */
export function toV2TextUpdate(text: string): { components: any[] } {
  return { components: [textToV2(text)] };
}

/** Convert `{ embeds, components }` to update payload. Always returns V2 format
 *  (components-only, no embeds field). Used for interactive updates where the
 *  source message is guaranteed V2.
 *  Pass the interaction as 3rd param for type compat, ignored at runtime.
 */
export function toV2Update(
  embeds: (EmbedBuilder | ContainerBuilder)[],
  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[],
  _source?: unknown,
): { components: any[]; flags: number } {
  return { components: [...embeds.map(e => e instanceof ContainerBuilder ? e : embedToV2(e)), ...(rows ?? [])], flags: V2_FLAG };
}

/** Legacy update payload — works with interaction.update() which can't use V2. */
export function toLegacyUpdate(
  embeds: EmbedBuilder[],
  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[],
  _source?: unknown,
): { embeds: EmbedBuilder[]; components: any[] } {
  return { embeds, components: rows ?? [] };
}

// ==================== SAFE V2 UPDATE (bypass MessagePayload bug) ====================

/** Safe V2 update via raw REST — bypasses discord.js MessagePayload bug.
 *  discord.js interaction.update() always injects 'content' into body → Discord rejects V2_FLAG.
 *  This calls the interaction callback endpoint directly.
 */
export async function safeV2Update(
  interaction: { client: any; id: string; token: string },
  embeds: (EmbedBuilder | ContainerBuilder)[],
  rows?: ActionRowBuilder<MessageActionRowComponentBuilder>[],
): Promise<void> {
  const components = [...embeds.map(e => e instanceof ContainerBuilder ? e : embedToV2(e)), ...(rows ?? [])];
  await interaction.client.rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: 7, data: { components, flags: V2_FLAG } } }
  );
  (interaction as any).replied = true;
}

/** Safe V2 text update via raw REST — bypasses discord.js MessagePayload bug. */
export async function safeV2TextUpdate(
  interaction: { client: any; id: string; token: string },
  text: string,
): Promise<void> {
  const components = [textToV2(text)];
  await interaction.client.rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: 7, data: { components, flags: V2_FLAG } } }
  );
  (interaction as any).replied = true;
}

// ==================== EMBED COMPAT HELPERS ====================

export const EMBED_COLORS = {
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
} as const;

export type EmbedColor = (typeof EMBED_COLORS)[keyof typeof EMBED_COLORS];
