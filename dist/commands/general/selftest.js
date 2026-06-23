"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const database_1 = __importDefault(require("../../database/database"));
const uiSystem_1 = require("../../utils/uiSystem");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const itemConstants_1 = require("../../config/itemConstants");
class SelfTestCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('selftest')
            .setDescription('[Admin] Kiểm tra toàn bộ hệ thống bot')
            .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator));
    }
    async execute(client, interaction) {
        // interactionCreate.ts đã deferReply (public), dùng editReply
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }
        const results = [];
        const run = async (name, fn) => {
            const t = Date.now();
            try {
                const detail = (await fn()) || '';
                results.push({ name, ok: true, detail, ms: Date.now() - t });
            }
            catch (e) {
                results.push({ name, ok: false, detail: e?.message || String(e), ms: Date.now() - t });
            }
        };
        const t0 = Date.now();
        // ── Database ──
        await run('DB — Kết nối', async () => {
            const r = database_1.default.prepare('SELECT 1 as ok').get();
            if (r?.ok !== 1)
                throw new Error('Query failed');
        });
        await run('DB — Integrity', async () => {
            const r = database_1.default.prepare('PRAGMA integrity_check').get();
            if (r?.['integrity_check'] !== 'ok')
                throw new Error(JSON.stringify(r));
        });
        await run('DB — Tables', async () => {
            const tables = database_1.default.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            return `${tables.length} tables`;
        });
        await run('DB — Users count', async () => {
            const cnt = database_1.default.prepare('SELECT count(*) as cnt FROM users').get().cnt;
            return `${cnt} users`;
        });
        await run('DB — Items count', async () => {
            const cnt = database_1.default.prepare('SELECT count(*) as cnt FROM items').get().cnt;
            return `${cnt} items`;
        });
        // ── Commands ──
        await run('Commands — Loaded', async () => {
            return `${client.commands.size} commands`;
        });
        // ── Item Constants ──
        await run('ITEMS — Constants', async () => {
            const keys = Object.keys(itemConstants_1.ITEMS);
            return `${keys.length} constants`;
        });
        // ── Repositories ──
        await run('UserRepo — get(nonexist)', async () => {
            const u = UserRepository_1.userRepository.get('0');
            if (u !== null)
                throw new Error(`Expected null, got ${JSON.stringify(u)}`);
        });
        await run('InventoryRepo — get(nonexist)', async () => {
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory('0');
            if (inv.length !== 0)
                throw new Error(`Expected 0, got ${inv.length}`);
        });
        // ── V2 UI System ──
        await run('V2 — embedToV2', async () => {
            const embed = new discord_js_1.EmbedBuilder().setTitle('Test').setDescription('Hello');
            const c = (0, uiSystem_1.embedToV2)(embed);
            if (!c)
                throw new Error('No container');
        });
        await run('V2 — toV2Payload', async () => {
            const p = (0, uiSystem_1.toV2Payload)([new discord_js_1.EmbedBuilder().setTitle('Test')]);
            if (!p.components || !p.flags)
                throw new Error('Missing components/flags');
        });
        // ── Build report ──
        const passed = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;
        const totalMs = Date.now() - t0;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🧪 Báo Cáo Tự Kiểm Tra Hệ Thống')
            .setColor(failed === 0 ? uiSystem_1.EMBED_COLORS.SUCCESS : uiSystem_1.EMBED_COLORS.ERROR)
            .setDescription(`✅ **${passed}** / **${results.length}** — ${failed > 0 ? `❌ ${failed} thất bại` : 'Tất cả thành công'}`)
            .setFooter({ text: `⏱ ${totalMs}ms` })
            .setTimestamp();
        const lines = results.map(r => `${r.ok ? '✅' : '❌'} **${r.name}** _(${r.ms}ms)_ — ${r.detail || (r.ok ? 'OK' : 'FAIL')}`);
        for (let i = 0; i < lines.length; i += 10) {
            embed.addFields({
                name: i === 0 ? '📋 Kết quả chi tiết' : '📋 (tiếp)',
                value: lines.slice(i, i + 10).join('\n'),
            });
        }
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], []));
    }
}
exports.default = SelfTestCommand;
