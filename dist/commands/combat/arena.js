"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArenaProfileEmbed = getArenaProfileEmbed;
exports.getArenaProfileComponents = getArenaProfileComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const ArenaService_1 = require("../../services/ArenaService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const database_1 = __importDefault(require("../../database/database"));
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
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
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật, vui lòng dùng lệnh `/taonhanvat`.' });
            return;
        }
        if (subcommand === 'profile') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const targetId = targetUser.id;
            const comp = getArenaProfileEmbed(targetId);
            if (!comp) {
                await interaction.editReply({ content: '❌ Người chơi này chưa tạo nhân vật.' });
                return;
            }
            const comps = getArenaProfileComponents(interaction.user.id);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([comp], comps));
        }
        else if (subcommand === 'find') {
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
            const comp = (0, v2Components_1.container)(isWin ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
                (0, v2Components_1.header)('⚔️ KẾT QUẢ ĐẤU TRƯỜNG'),
                (0, v2Components_1.body)(`**${user.name}** (ELO: ${oldChallengerProfile.elo}) 🆚 **${oUser.name}** (ELO: ${oldOpponentProfile.elo})\n\n${resultText}`),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)([
                    (0, v2Components_1.statLine)('Trận chiến kéo dài', `${matchResult.result.rounds} hiệp`),
                    (0, v2Components_1.statLine)('Tổng sát thương', `${matchResult.result.totalDamageDealt}`),
                ].join('\n')),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)('Chi tiết trận đấu được đính kèm trong file.'),
            ]);
            await interaction.editReply({ ...(0, uiSystem_1.toV2Payload)([comp]), files: [attachment] });
        }
        else if (subcommand === 'top') {
            const topPlayers = ArenaService_1.arenaService.getLeaderboard(10);
            if (topPlayers.length === 0) {
                await interaction.editReply({ content: '📭 Bảng xếp hạng Đấu Trường hiện tại trống rỗng.' });
                return;
            }
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
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [
                (0, v2Components_1.header)('🏆 BẢNG XẾP HẠNG ĐẤU TRƯỜNG (TOP 10)'),
                (0, v2Components_1.body)(description),
            ]);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([comp]));
        }
        else if (subcommand === 'history') {
            const history = database_1.default.prepare(`
        SELECT * FROM arena_history 
        WHERE challenger_id = ? OR opponent_id = ?
        ORDER BY created_at DESC 
        LIMIT 5
      `).all(userId, userId);
            if (history.length === 0) {
                await interaction.editReply({ content: '📭 Đạo hữu chưa tham gia trận đấu nào.' });
                return;
            }
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
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
                (0, v2Components_1.header)('📜 Lịch Sử Đấu Trường (5 Trận Gần Nhất)'),
                (0, v2Components_1.body)(desc),
            ]);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([comp]));
        }
    }
}
exports.default = ArenaCommand;
function getArenaProfileEmbed(targetId) {
    const targetProfile = UserRepository_1.userRepository.get(targetId);
    if (!targetProfile)
        return null;
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
    const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.warning, [
        (0, v2Components_1.header)(`⚔️ Hồ Sơ Đấu Trường: ${targetProfile.name}`),
        ...(shieldText ? [(0, v2Components_1.body)(shieldText)] : []),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)([
            (0, v2Components_1.statLine)('🏆 Điểm ELO', `**${profile.elo}**`),
            (0, v2Components_1.statLine)('🔥 Chuỗi Thắng', `${profile.win_streak}`),
            (0, v2Components_1.statLine)('📈 ELO Kỷ Lục', `${profile.highest_elo}`),
            (0, v2Components_1.statLine)('⚔️ Trận Đấu', `Thắng: ${profile.wins} | Thua: ${profile.losses}`),
            (0, v2Components_1.statLine)('📊 Tỉ Lệ Thắng', `${winRate}%`),
            (0, v2Components_1.statLine)('🏅 Xếp Hạng Mùa Trước', profile.last_season_rank > 0 ? `#${profile.last_season_rank}` : 'Chưa xếp hạng'),
        ].join('\n')),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`Mùa Giải: ${profile.season_id}`),
    ]);
    return comp;
}
function getArenaProfileComponents(userId) {
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`arena_find_${userId}`)
        .setLabel('⚡ Tìm Đối Thủ')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId(`arena_history_${userId}`)
        .setLabel('📜 Lịch Sử Đấu')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId(`arena_top_${userId}`)
        .setLabel('🏆 Bảng Xếp Hạng')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    return [row];
}
