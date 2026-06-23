import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload, embedToV2 } from '../../utils/uiSystem';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { ITEMS } from '../../config/itemConstants';

export default class SelfTestCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('selftest')
        .setDescription('[Admin] Kiểm tra toàn bộ hệ thống bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    // interactionCreate.ts đã deferReply (public), dùng editReply
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    type R = { name: string; ok: boolean; detail: string; ms: number };
    const results: R[] = [];
    const run = async (name: string, fn: () => Promise<string | void>) => {
      const t = Date.now();
      try {
        const detail = (await fn()) || '';
        results.push({ name, ok: true, detail, ms: Date.now() - t });
      } catch (e: any) {
        results.push({ name, ok: false, detail: e?.message || String(e), ms: Date.now() - t });
      }
    };

    const t0 = Date.now();

    // ── Database ──
    await run('DB — Kết nối', async () => {
      const r = db.prepare('SELECT 1 as ok').get() as any;
      if (r?.ok !== 1) throw new Error('Query failed');
    });

    await run('DB — Integrity', async () => {
      const r = db.prepare('PRAGMA integrity_check').get() as any;
      if (r?.['integrity_check'] !== 'ok') throw new Error(JSON.stringify(r));
    });

    await run('DB — Tables', async () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      return `${tables.length} tables`;
    });

    await run('DB — Users count', async () => {
      const cnt = (db.prepare('SELECT count(*) as cnt FROM users').get() as any).cnt;
      return `${cnt} users`;
    });

    await run('DB — Items count', async () => {
      const cnt = (db.prepare('SELECT count(*) as cnt FROM items').get() as any).cnt;
      return `${cnt} items`;
    });

    // ── Commands ──
    await run('Commands — Loaded', async () => {
      return `${client.commands.size} commands`;
    });

    // ── Item Constants ──
    await run('ITEMS — Constants', async () => {
      const keys = Object.keys(ITEMS);
      return `${keys.length} constants`;
    });

    // ── Repositories ──
    await run('UserRepo — get(nonexist)', async () => {
      const u = userRepository.get('0');
      if (u !== null) throw new Error(`Expected null, got ${JSON.stringify(u)}`);
    });

    await run('InventoryRepo — get(nonexist)', async () => {
      const inv = inventoryRepository.getUserInventory('0');
      if (inv.length !== 0) throw new Error(`Expected 0, got ${inv.length}`);
    });

    // ── V2 UI System ──
    await run('V2 — embedToV2', async () => {
      const embed = new EmbedBuilder().setTitle('Test').setDescription('Hello');
      const c = embedToV2(embed);
      if (!c) throw new Error('No container');
    });

    await run('V2 — toV2Payload', async () => {
      const p = toV2Payload([new EmbedBuilder().setTitle('Test')]);
      if (!p.components || !p.flags) throw new Error('Missing components/flags');
    });

    // ── Build report ──
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const totalMs = Date.now() - t0;

    const embed = new EmbedBuilder()
      .setTitle('🧪 Báo Cáo Tự Kiểm Tra Hệ Thống')
      .setColor(failed === 0 ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
      .setDescription(`✅ **${passed}** / **${results.length}** — ${failed > 0 ? `❌ ${failed} thất bại` : 'Tất cả thành công'}`)
      .setFooter({ text: `⏱ ${totalMs}ms` })
      .setTimestamp();

    const lines = results.map(r =>
      `${r.ok ? '✅' : '❌'} **${r.name}** _(${r.ms}ms)_ — ${r.detail || (r.ok ? 'OK' : 'FAIL')}`
    );

    for (let i = 0; i < lines.length; i += 10) {
      embed.addFields({
        name: i === 0 ? '📋 Kết quả chi tiết' : '📋 (tiếp)',
        value: lines.slice(i, i + 10).join('\n'),
      });
    }

    await interaction.editReply(toV2Payload([embed], []));
  }
}
