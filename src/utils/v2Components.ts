import {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SectionBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, SeparatorSpacingSize, MessageFlags
} from 'discord.js';

export const V2_FLAG = MessageFlags.IsComponentsV2;

export const V2_COLORS = {
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
} as const;

export function header(title: string, description?: string): TextDisplayBuilder {
  let content = `## ${title}`;
  if (description) content += `\n${description}`;
  return new TextDisplayBuilder().setContent(content);
}

export function body(text: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(text);
}

export function separator(spacing: SeparatorSpacingSize = SeparatorSpacingSize.Small): SeparatorBuilder {
  return new SeparatorBuilder().setSpacing(spacing);
}

export function container(
  color: number,
  components: (TextDisplayBuilder | SeparatorBuilder | ActionRowBuilder<any>)[]
): ContainerBuilder {
  const c = new ContainerBuilder().setAccentColor(color);
  for (const comp of components) {
    if (comp instanceof TextDisplayBuilder) c.addTextDisplayComponents(comp);
    else if (comp instanceof SeparatorBuilder) c.addSeparatorComponents(comp);
    else if (comp instanceof ActionRowBuilder) c.addActionRowComponents(comp);
  }
  return c;
}

export function primaryBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel(label).setCustomId(customId);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function successBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel(label).setCustomId(customId);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function dangerBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel(label).setCustomId(customId);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function secondaryBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(label).setCustomId(customId);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function row(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

export function progressBar(current: number, max: number, size = 10): string {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(size * ratio);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

export function statLine(label: string, value: number | string, emoji?: string): string {
  return `${emoji ? emoji + ' ' : ''}**${label}**: ${value}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function confirmationContainer(
  title: string,
  message: string,
  confirmId: string,
  cancelId: string
): ContainerBuilder {
  return container(V2_COLORS.warning, [
    header(title),
    body(message),
    separator(),
    row(successBtn('Xác nhận', confirmId, '✅'), dangerBtn('Hủy', cancelId, '❌'))
  ]);
}

export function progressBarContainer(label: string, current: number, max: number, color: number): ContainerBuilder {
  return container(color, [
    header(label),
    body(`${progressBar(current, max, 15)} ${current}/${max} (${Math.round(current / max * 100)}%)`)
  ]);
}
