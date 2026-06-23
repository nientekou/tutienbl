"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const PvPService_1 = require("../../services/PvPService");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
class PvPBangXepHangCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('pvpbxh')
            .setDescription('Bảng xếp hạng Phong Thần - Đấu trường PvP.')
            .addSubcommand(sub => sub
            .setName('bangxephang')
            .setDescription('Xem top 10 tu sĩ mạnh nhất mùa giải hiện tại.'))
            .addSubcommand(sub => sub
            .setName('thongtin')
            .setDescription('Xem thông tin xếp hạng PvP của bản thân.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'bangxephang') {
            const season = PvPService_1.pvpService.getCurrentSeason();
            const now = Math.floor(Date.now() / 1000);
            const seasonStart = new Date(season.started_at * 1000).toLocaleDateString('vi-VN');
            const leaderboard = PvPService_1.pvpService.getLeaderboard(10);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🏆 PHONG THẦN BẢNG - ĐẤU TRƯỜNG PVP')
                .setColor(uiSystem_1.EMBED_COLORS.GOLD)
                .setDescription(`**Mùa giải:** #${season.season_number} | **Bắt đầu:** ${seasonStart}\n\n` +
                `Bảng xếp hạng những tu sĩ có thực lực chiến đấu PvP mạnh nhất tiên giới. Hãy tham gia quyết đấu để leo hạng và nhận thưởng cuối mùa!\n` +
                `\n*Xếp hạng dựa trên điểm Phong Thần (ELO).*`)
                .setTimestamp();
            if (leaderboard.length === 0) {
                embed.addFields({
                    name: '📊 Bảng Xếp Hạng',
                    value: '*Chưa có dữ liệu PvP mùa này. Hãy dùng lệnh `/quyetau` để bắt đầu quyết đấu!*'
                });
            }
            else {
                let rankingText = '';
                for (const entry of leaderboard) {
                    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
                    const winRateEmoji = entry.win_rate >= 70 ? '🔥' : entry.win_rate >= 50 ? '✅' : '📉';
                    rankingText +=
                        `${medal} **${entry.name}** [${entry.realm}]\n` +
                            `　　• 🎖️ **${entry.pvp_points}** điểm | Thắng **${entry.pvp_wins}**/Thua **${entry.pvp_losses}** ${winRateEmoji} **${entry.win_rate}%**\n`;
                }
                embed.addFields({ name: '📊 Bảng Xếp Hạng', value: rankingText });
            }
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (sub === 'thongtin') {
            const profile = PvPService_1.pvpService.getPlayerProfile(userId);
            if (!profile) {
                await interaction.editReply({
                    content: '❌ Không thể tải thông tin PvP của đạo hữu.'
                });
                return;
            }
            const { fullName } = (0, constants_1.getRealmDetails)(user.level);
            const rankText = profile.rank
                ? profile.rank <= 3 ? `🏆 Hạng **${profile.rank}** (Top 3!)` : `#${profile.rank}`
                : 'Chưa xếp hạng';
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚔️ THÔNG TIN PVP - ${user.name}`)
                .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
                .setDescription(`**Cảnh giới:** ${fullName}\n` +
                `**Xếp hạng hiện tại:** ${rankText}\n` +
                `**Điểm Phong Thần:** 🎖️ **${profile.points}**\n\n` +
                `**Thành tích:**\n` +
                `• 🏅 Thắng: **${profile.wins}** trận\n` +
                `• 💀 Bại: **${profile.losses}** trận\n` +
                `• 📊 Tỷ lệ thắng: **${profile.winRate}%**\n\n` +
                `*Sử dụng /quyetau để khiêu chiến các tu sĩ khác và leo hạng!*`)
                .setFooter({ text: `Mùa giải #${PvPService_1.pvpService.getCurrentSeason().season_number}` })
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = PvPBangXepHangCommand;
