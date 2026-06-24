import { Interaction } from 'discord.js';
import { safeV2Update } from '../../utils/uiSystem';

export interface Ctx {
  interaction: Interaction;
  userId: string;
  parts: string[];
  user?: any;
}

const db = require('../../database/database').default ?? require('../../database/database').db;

export function loadCtx(interaction: Interaction, parts: string[], userId: string): Ctx {
  return { interaction, userId, parts };
}

export async function loadUser(ctx: Ctx): Promise<boolean> {
  const row = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(ctx.userId);
  if (!row) {
    try { await safeV2Update(ctx.interaction, [{ description: '❌ Chưa tạo nhân vật. Dùng `/taonhanvat` để bắt đầu.' }] as any); } catch {}
    return false;
  }
  ctx.user = row;
  return true;
}

export async function checkInjury(ctx: Ctx): Promise<boolean> {
  if (!ctx.user) return true;
  const now = Math.floor(Date.now() / 1000);
  if (ctx.user.injury_end_time && ctx.user.injury_end_time > now) {
    const m = Math.ceil((ctx.user.injury_end_time - now) / 60);
    try { await safeV2Update(ctx.interaction, [{ description: `❌ Đang bị thương — còn ${m} phút.` }] as any); } catch {}
    return false;
  }
  return true;
}

export async function requireChecks(
  ctx: Ctx,
  fns: Array<(c: Ctx) => Promise<boolean>>,
  body: () => Promise<void>
): Promise<void> {
  for (const fn of fns) {
    if (!(await fn(ctx))) return;
  }
  await body();
}
