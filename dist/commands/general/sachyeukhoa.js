"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BestiaryService_1 = require("../../services/BestiaryService");
const uiSystem_1 = require("../../utils/uiSystem");
class SachYeuKhoaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('sachyeukhoa')
            .setDescription('Sách Yêu Khoa — Nhật ký quái vật đã gặp')
            .addStringOption(opt => opt.setName('zone')
            .setDescription('Lọc theo khu vực')
            .setRequired(false)));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
            return;
        }
        const zone = interaction.options.getString('zone') || undefined;
        const entries = BestiaryService_1.bestiaryService.getEntries(userId, zone);
        if (entries.length === 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📖 Sách Yêu Khoa')
                .setColor(uiSystem_1.EMBED_COLORS.INFO)
                .setDescription('Chưa ghi nhận enemy nào. Hãy đi chiến đấu để thu thập thông tin!')
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
            return;
        }
        // Group by zone
        const byZone = {};
        for (const e of entries) {
            const z = e.zone || 'Khác';
            if (!byZone[z])
                byZone[z] = [];
            byZone[z].push(e);
        }
        let desc = `📖 **Sách Yêu Khoa** — ${entries.length} enemy đã gặp\n\n`;
        for (const [zoneName, zoneEntries] of Object.entries(byZone)) {
            const defeated = zoneEntries.filter(e => e.times_defeated > 0).length;
            const progress = defeated === zoneEntries.length ? '✅' : `${defeated}/${zoneEntries.length}`;
            desc += `**${zoneName}** (${progress})\n`;
            for (const e of zoneEntries) {
                const status = e.times_defeated > 0 ? '✅' : '❓';
                const kills = e.times_defeated > 0 ? ` (x${e.times_defeated})` : '';
                desc += `  ${status} **${e.enemy_name}** [${e.element}]${kills}\n`;
            }
            desc += '\n';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📖 Sách Yêu Khoa')
            .setColor(uiSystem_1.EMBED_COLORS.INFO)
            .setDescription(desc.slice(0, 4000))
            .setTimestamp();
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = new SachYeuKhoaCommand();
