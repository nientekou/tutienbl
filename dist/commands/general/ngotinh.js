"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const NgoTinhService_1 = require("../../services/NgoTinhService");
const uiSystem_1 = require("../../utils/uiSystem");
class NgoTinhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('ngotinh')
            .setDescription('Quản lý Ngộ Tính - kích hoạt buff tạm thời.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật! Dùng `/taonhanvat` để tạo.', ephemeral: true });
            return;
        }
        const activeBuffs = NgoTinhService_1.ngoTinhService.getActiveBuffs(userId);
        const ngotinh = user.ngotinh || 0;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('💡 Ngộ Tính - Thiên Cơ Buff')
            .setDescription(`Điểm Ngộ Tính hiện tại: **${ngotinh}** 💡\n\nDùng điểm Ngộ Tính để kích hoạt buff tạm thời:`)
            .setColor(uiSystem_1.EMBED_COLORS.INFO);
        for (const buff of NgoTinhService_1.NGO_TINH_BUFFS) {
            const active = activeBuffs.find(b => b.buffId === buff.id);
            const status = active
                ? `🟢 **Đang hoạt động** (còn ${Math.ceil(active.remaining / 60)} phút)`
                : `⚪ Chưa kích hoạt`;
            const canAfford = ngotinh >= buff.cost;
            const costText = canAfford ? `💡 ${buff.cost} NT` : `❌ ${buff.cost} NT (không đủ)`;
            embed.addFields({
                name: `${buff.emoji} ${buff.name}`,
                value: `${buff.effect}\nThời lượng: ${Math.floor(buff.duration / 60)} phút\nChi phí: ${costText}\n${status}`,
                inline: true
            });
        }
        const rows = [];
        for (let i = 0; i < NgoTinhService_1.NGO_TINH_BUFFS.length; i += 5) {
            const row = new discord_js_1.ActionRowBuilder();
            for (let j = i; j < Math.min(i + 5, NgoTinhService_1.NGO_TINH_BUFFS.length); j++) {
                const buff = NgoTinhService_1.NGO_TINH_BUFFS[j];
                const active = activeBuffs.find(b => b.buffId === buff.id);
                const disabled = !!active || ngotinh < buff.cost;
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`ngotinh_activate_${buff.id}_${userId}`)
                    .setLabel(`${buff.emoji} ${buff.name} (${buff.cost} NT)`)
                    .setStyle(disabled ? discord_js_1.ButtonStyle.Secondary : discord_js_1.ButtonStyle.Primary)
                    .setDisabled(disabled));
            }
            rows.push(row);
        }
        await interaction.reply({ embeds: [embed], components: rows });
    }
}
exports.default = NgoTinhCommand;
