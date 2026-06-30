"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const SectCouncilService_1 = require("../../services/SectCouncilService");
const uiSystem_1 = require("../../utils/uiSystem");
class HoiDongCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('hoidong')
            .setDescription('Hội Đồng Tông Môn — Đề xuất và bỏ phiếu chính sách'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa gia nhập tông môn.' });
            return;
        }
        const voting = SectCouncilService_1.sectCouncilService.getVotingPolicy(user.sect_id);
        const active = SectCouncilService_1.sectCouncilService.getActivePolicy(user.sect_id);
        let desc = '**Hội Đồng Tông Môn**\n\n';
        if (voting) {
            desc += `🗳️ **Đang bỏ phiếu:** ${voting.policy.name}\n`;
            desc += `${voting.policy.description}\n`;
            desc += `👍 Đồng ý: **${voting.votesYes}** | 👎 Abstain: **${voting.votesNo}**\n`;
            desc += `⏰ Kết thúc: <t:${voting.endTime}:R>\n`;
        }
        else if (active) {
            desc += `✅ **Chính sách đang hoạt động:** ${active.name}\n`;
            desc += `${active.description}\n`;
        }
        else {
            desc += '📭 Chưa có chính sách nào. Chỉ tông chủ có thể đề xuất.\n';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏛️ Hội Đồng Tông Môn')
            .setColor(uiSystem_1.EMBED_COLORS.GOLD)
            .setDescription(desc)
            .setTimestamp();
        const row = new discord_js_1.ActionRowBuilder();
        if (voting) {
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`sectcouncil_vote_yes_${userId}_${user.sect_id}`)
                .setLabel('👍 Đồng Ý')
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`sectcouncil_vote_no_${userId}_${user.sect_id}`)
                .setLabel('👎 Bỏ Phiếu')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
        }
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], row.components.length > 0 ? [row] : []));
    }
}
exports.default = HoiDongCommand;
