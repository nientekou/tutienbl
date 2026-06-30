"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const MonthlyLeaderboardService_1 = require("../../services/MonthlyLeaderboardService");
const uiSystem_1 = require("../../utils/uiSystem");
class VinhDanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('vinhdanh')
            .setDescription('Bảng Vinh Danh Tháng — Xem xếp hạng các đạo hữu')
            .addStringOption(opt => opt.setName('danhmuc')
            .setDescription('Danh mục xếp hạng')
            .setRequired(false)
            .addChoices({ name: '🌀 Tu Vi', value: 'tuvi' }, { name: '⚔️ Đấu Trường', value: 'arena' }, { name: '🗼 Thiên Cung', value: 'tower' }, { name: '🏆 Thành Tựu', value: 'achievement' })));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
            return;
        }
        const category = (interaction.options.getString('danhmuc') || 'tuvi');
        const desc = MonthlyLeaderboardService_1.monthlyLeaderboardService.getDescription(category);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('👑 Bảng Vinh Danh Tháng')
            .setColor(uiSystem_1.EMBED_COLORS.GOLD)
            .setDescription(desc)
            .setTimestamp();
        // Show player's own rank
        const rankInfo = MonthlyLeaderboardService_1.monthlyLeaderboardService.getPlayerRank(userId, category);
        if (rankInfo) {
            embed.setFooter({ text: `Hạng của đạo hữu: #${rankInfo.rank} (${rankInfo.value.toLocaleString()} điểm)` });
        }
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = new VinhDanhCommand();
