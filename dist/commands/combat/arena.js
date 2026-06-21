"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const ArenaService_1 = require("../../services/ArenaService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const database_1 = __importDefault(require("../../database/database"));
class ArenaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('arena')
            .setDescription('Tham gia Đấu Trường (Arena) PvP')
            .addSubcommand(subcommand => subcommand
            .setName('profile')
            .setDescription('Xem hồ sơ Đấu Trường của bản thân hoặc người khác')
            .addUserOption(option => option.setName('target').setDescription('Người chơi muốn xem').setRequired(false)))
            .addSubcommand(subcommand => subcommand
            .setName('find')
            .setDescription('Tìm và khiêu chiến đối thủ có ELO tương đương'))
            .addSubcommand(subcommand => subcommand
            .setName('top')
            .setDescription('Xem Bảng Xếp Hạng Đấu Trường'))
            .addSubcommand(subcommand => subcommand
            .setName('history')
            .setDescription('Xem lịch sử các trận đấu gần đây')));
    }
    async execute(client, interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật, vui lòng dùng lệnh `/taonhanvat`.', ephemeral: true });
            return;
        }
        if (subcommand === 'profile') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const targetId = targetUser.id;
            const targetProfile = UserRepository_1.userRepository.get(targetId);
            if (!targetProfile) {
                await interaction.reply({ content: '❌ Người chơi này chưa tạo nhân vật.', ephemeral: true });
                return;
            }
            const profile = ArenaService_1.arenaService.getProfile(targetId);
            const totalMatches = profile.wins + profile.losses;
            const winRate = totalMatches > 0 ? ((profile.wins / totalMatches) * 100).toFixed(1) : '0.0';
            let shieldText = '';
            if (ArenaService_1.arenaService.isShielded(targetId)) {
                try {
                    const yCanh = JSON.parse(targetProfile.y_canh || '{}');
                    if (yCanh.shield_until) {
                        const diff = yCanh.shield_until - Math.floor(Date.now() / 1000);
                        if (diff > 0) {
                            const minutes = Math.ceil(diff / 60);
                            shieldText = `🛡️ **Hộ Giới Bài:** Đang kích hoạt (Còn **${minutes}** phút bảo hộ)`;
                        }
                    }
                }
                catch (e) { }
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚔️ Hồ Sơ Đấu Trường: ${targetProfile.name}`)
                .setDescription(shieldText || null)
                .setColor('#FFA500')
                .addFields({ name: '🏆 Điểm ELO', value: `**${profile.elo}**`, inline: true }, { name: '🔥 Chuỗi Thắng', value: `${profile.win_streak}`, inline: true }, { name: '📈 ELO Kỷ Lục', value: `${profile.highest_elo}`, inline: true }, { name: '⚔️ Trận Đấu', value: `Thắng: ${profile.wins} | Thua: ${profile.losses}`, inline: true }, { name: '📊 Tỉ Lệ Thắng', value: `${winRate}%`, inline: true }, { name: '🏅 Xếp Hạng Mùa Trước', value: profile.last_season_rank > 0 ? `#${profile.last_season_rank}` : 'Chưa xếp hạng', inline: true })
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: `Mùa Giải: ${profile.season_id}` });
            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'find') {
            await interaction.deferReply(); // Do tính toán combat có thể lâu
            const opponentId = ArenaService_1.arenaService.getMatchmaking(userId);
            if (!opponentId) {
                await interaction.editReply('❌ Đấu trường hiện tại vắng lặng, không tìm thấy đối thủ nào! Hãy quay lại sau.');
                return;
            }
            const oUser = UserRepository_1.userRepository.get(opponentId);
            if (!oUser) {
                await interaction.editReply('❌ Đối thủ bỗng nhiên bốc hơi, vui lòng thử lại.');
                return;
            }
            // Check current ELO
            const oldChallengerProfile = ArenaService_1.arenaService.getProfile(userId);
            const oldOpponentProfile = ArenaService_1.arenaService.getProfile(opponentId);
            // Fight
            const matchResult = ArenaService_1.arenaService.challenge(userId, opponentId);
            if (!matchResult.success || !matchResult.result) {
                await interaction.editReply(matchResult.message);
                return;
            }
            // Fetch new profile to get elo diff
            const newChallengerProfile = ArenaService_1.arenaService.getProfile(userId);
            const eloDiff = newChallengerProfile.elo - oldChallengerProfile.elo;
            const isWin = matchResult.result.winner === 'player';
            // Log file
            const logText = matchResult.result.log.join('\n');
            const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(logText, 'utf-8'), { name: 'combat_log.txt' });
            let resultText = '';
            if (isWin) {
                resultText = `🎉 **CHIẾN THẮNG!** Đạo hữu đã đánh bại **${oUser.name}**.\n📈 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (+${eloDiff})`;
                if (matchResult.artifactMessage) {
                    resultText += `\n\n${matchResult.artifactMessage}`;
                }
            }
            else {
                resultText = `💀 **THẤT BẠI!** Đạo hữu đã gục ngã trước **${oUser.name}**.\n📉 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (${eloDiff})`;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('⚔️ KẾT QUẢ ĐẤU TRƯỜNG')
                .setDescription(`**${user.name}** (ELO: ${oldChallengerProfile.elo}) 🆚 **${oUser.name}** (ELO: ${oldOpponentProfile.elo})\n\n${resultText}`)
                .setColor(isWin ? '#00FF00' : '#FF0000')
                .addFields({ name: 'Trận chiến kéo dài', value: `${matchResult.result.rounds} hiệp`, inline: true }, { name: 'Tổng sát thương', value: `${matchResult.result.totalDamageDealt}`, inline: true })
                .setFooter({ text: 'Chi tiết trận đấu được đính kèm trong file.' });
            await interaction.editReply({ embeds: [embed], files: [attachment] });
        }
        else if (subcommand === 'top') {
            const topPlayers = ArenaService_1.arenaService.getLeaderboard(10);
            if (topPlayers.length === 0) {
                await interaction.reply({ content: '📭 Bảng xếp hạng Đấu Trường hiện tại trống rỗng.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🏆 BẢNG XẾP HẠNG ĐẤU TRƯỜNG (TOP 10)')
                .setColor('#FFD700');
            let description = '';
            topPlayers.forEach((p, index) => {
                let rankIcon = '🏅';
                if (index === 0)
                    rankIcon = '🥇';
                else if (index === 1)
                    rankIcon = '🥈';
                else if (index === 2)
                    rankIcon = '🥉';
                description += `**${rankIcon} #${index + 1}** | **${p.name}**\n`;
                description += `└─ 🏆 ELO: **${p.elo}** | ⚔️ W/L: ${p.wins}/${p.losses} | 🔥 Chuỗi: ${p.win_streak}\n\n`;
            });
            embed.setDescription(description);
            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'history') {
            const history = database_1.default.prepare(`
        SELECT * FROM arena_history 
        WHERE challenger_id = ? OR opponent_id = ?
        ORDER BY created_at DESC 
        LIMIT 5
      `).all(userId, userId);
            if (history.length === 0) {
                await interaction.reply({ content: '📭 Đạo hữu chưa tham gia trận đấu nào.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📜 Lịch Sử Đấu Trường (5 Trận Gần Nhất)')
                .setColor('#8B4513');
            let desc = '';
            for (const h of history) {
                const isChallenger = h.challenger_id === userId;
                const isWin = h.winner_id === userId;
                const opponentId = isChallenger ? h.opponent_id : h.challenger_id;
                const oUser = UserRepository_1.userRepository.get(opponentId);
                const oName = oUser ? oUser.name : 'Vô Danh';
                const resultIcon = isWin ? '✅ Thắng' : '❌ Thua';
                const eloMod = isWin ? `+${h.elo_change}` : `-${h.elo_change}`;
                const timeStr = `<t:${h.created_at}:R>`;
                desc += `**${resultIcon}** vs **${oName}** (${eloMod} ELO) - ${timeStr}\n`;
            }
            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed] });
        }
    }
}
exports.default = ArenaCommand;
