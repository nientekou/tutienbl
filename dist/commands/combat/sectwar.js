"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const SectWarService_1 = require("../../services/SectWarService");
const database_1 = __importDefault(require("../../database/database"));
class SectWarCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('sectwar')
            .setDescription('Bang hội chiến - thi đấu Tông Môn định kỳ')
            .addSubcommand(sub => sub.setName('thongtin').setDescription('Xem thông tin mùa giải hiện tại'))
            .addSubcommand(sub => sub.setName('thamgia').setDescription('Tham gia trận đấu Bang hội chiến'))
            .addSubcommand(sub => sub.setName('tancong')
            .setDescription('Tấn công đối thủ trong trận đấu')
            .addStringOption(opt => opt.setName('player_id').setDescription('ID Discord của người chơi mục tiêu').setRequired(true)))
            .addSubcommand(sub => sub.setName('bangxephang').setDescription('Bảng xếp hạng Tông Môn trong mùa giải'))
            .addSubcommand(sub => sub.setName('lichsu').setDescription('Xem lịch sử các trận Bang hội chiến gần đây'))
            .addSubcommandGroup(group => group.setName('mo')
            .setDescription('Quản lý và chiếm đoạt Mỏ Linh Thạch')
            .addSubcommand(sub => sub.setName('xem').setDescription('Xem danh sách Mỏ Linh Thạch'))
            .addSubcommand(sub => sub.setName('chiem')
            .setDescription('Tấn công chiếm Mỏ Linh Thạch')
            .addStringOption(opt => opt.setName('mine_id').setDescription('ID của Mỏ (vd: mo_nho, mo_vua, mo_lon)').setRequired(true)))
            .addSubcommand(sub => sub.setName('thuhoach')
            .setDescription('Thu hoạch linh thạch từ mỏ đang chiếm giữ')
            .addStringOption(opt => opt.setName('mine_id').setDescription('ID của Mỏ').setRequired(true)))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const subGroup = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        if (subGroup === 'mo') {
            if (sub === 'xem') {
                const minesState = SectWarService_1.sectWarService.getMinesState();
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🏔️ BẢN ĐỒ MỎ LINH THẠCH')
                    .setColor('#3498db')
                    .setDescription('Các Tông Môn có thể chiếm mỏ để nhận Linh Thạch mỗi 4 giờ.');
                const { SECT_MINES } = require('../../services/SectWarService');
                for (const mineDef of SECT_MINES) {
                    const owner = minesState.find(m => m.mine_id === mineDef.id);
                    let statusStr = '⚪ **Chưa có người chiếm giữ**';
                    if (owner) {
                        statusStr = `🔴 **Sở hữu:** ${owner.sect_name}\n⏳ **Thu hoạch lần cuối:** <t:${owner.last_claimed_at}:R>\n💰 **Đã sinh ra:** ${owner.total_income} LT`;
                    }
                    embed.addFields({
                        name: `🔹 ${mineDef.name} (ID: \`${mineDef.id}\`)`,
                        value: `Yêu cầu Tông Môn cấp: **${mineDef.level_req}**\nSản lượng: **${mineDef.income} LT/4h**\n${statusStr}`
                    });
                }
                await interaction.reply({ embeds: [embed] });
                return;
            }
            if (sub === 'chiem') {
                const mineId = interaction.options.getString('mine_id', true);
                const result = SectWarService_1.sectWarService.captureMine(userId, mineId);
                if (result.success && result.log) {
                    const logText = result.log.slice(0, 5).join('\n') + (result.log.length > 5 ? '\n... (trận đấu diễn ra ác liệt)' : '');
                    await interaction.reply({ content: `${result.message}\n\n**Chiến báo:**\n${logText}` });
                }
                else {
                    await interaction.reply({ content: result.message, ephemeral: !result.success });
                }
                return;
            }
            if (sub === 'thuhoach') {
                const mineId = interaction.options.getString('mine_id', true);
                const result = SectWarService_1.sectWarService.claimMineIncome(userId, mineId);
                await interaction.reply({ content: result.message, ephemeral: !result.success });
                return;
            }
        }
        if (sub === 'thongtin') {
            const season = SectWarService_1.sectWarService.getOrCreateSeason();
            const leaderboard = SectWarService_1.sectWarService.getSectLeaderboard();
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚔️ BANG HỘI CHIẾN - Mùa #${season.season_number}`)
                .setColor('#e74c3c')
                .setDescription(`Trạng thái: **${season.status === 'active' ? '🟢 Đang diễn ra' : '🔴 Đã kết thúc'}**`)
                .addFields({ name: '📅 Bắt đầu', value: `<t:${season.started_at}:R>`, inline: true }, { name: '🏆 Top 5 Tông Môn', value: leaderboard.slice(0, 5).map((e, i) => `${i + 1}. **${e.sect_name}** (Cấp ${e.level}) - ${e.total_damage} dmg | ${e.total_wins} thắng`).join('\n') || '*Chưa có dữ liệu*' });
            if (user.sect_id) {
                const myScore = SectWarService_1.sectWarService.getSectWarScore(user.sect_id);
                const myAttacks = SectWarService_1.sectWarService.getUserWeeklyAttacks(userId, season.id);
                let battleInfo = 'Không có trận đấu nào đang diễn ra.';
                const activeBattles = SectWarService_1.sectWarService.getActiveBattlesForSect(user.sect_id);
                if (activeBattles.length > 0) {
                    const b = activeBattles[0];
                    // Lấy thông tin các sect trong battle
                    const sectNames = b.sect_ids.map((id) => {
                        const s = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(id);
                        return s ? s.name : 'Unknown';
                    });
                    const scoresList = b.sect_ids.map((id, idx) => {
                        return `**${sectNames[idx]}**: ${b.scores[id] || 0} điểm`;
                    });
                    // Thanh đóng góp UI (giả lập thanh progress)
                    const totalPoints = Object.values(b.scores).reduce((a, b) => a + b, 0);
                    let progressBar = '';
                    if (totalPoints > 0) {
                        const myPoints = b.scores[user.sect_id] || 0;
                        const myPercent = Math.round((myPoints / totalPoints) * 10);
                        progressBar = '\nThế trận: [' + '🟩'.repeat(myPercent) + '⬛'.repeat(10 - myPercent) + `] ${Math.round((myPoints / totalPoints) * 100)}%`;
                    }
                    battleInfo = `🔥 **Đang chiến đấu!**\nTrận: ${sectNames.join(' vs ')}\nĐiểm số: ${scoresList.join(' | ')}${progressBar}`;
                }
                embed.addFields({
                    name: '📊 Tông Môn Của Bạn',
                    value: [
                        `🏛️ **${database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(user.sect_id)?.name || 'Không rõ'}**`,
                        `⚔️ Sát thương: **${myScore.total_damage}** | Thắng: **${myScore.total_wins}** | Trận: **${myScore.total_battles}**`,
                        `🎯 Lượt tấn công còn lại: **${5 - myAttacks}/5** trong tuần`,
                        ``,
                        battleInfo
                    ].join('\n'),
                });
            }
            await interaction.reply({ embeds: [embed] });
            return;
        }
        if (sub === 'thamgia') {
            const result = SectWarService_1.sectWarService.joinBattle(userId);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (sub === 'tancong') {
            const targetId = interaction.options.getString('player_id', true);
            if (targetId === userId) {
                await interaction.reply({ content: '❌ Không thể tự tấn công bản thân!', ephemeral: true });
                return;
            }
            const result = SectWarService_1.sectWarService.attack(userId, targetId);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (sub === 'bangxephang') {
            const season = SectWarService_1.sectWarService.getOrCreateSeason();
            const leaderboard = SectWarService_1.sectWarService.getSectLeaderboard();
            if (leaderboard.length === 0) {
                await interaction.reply({ content: '📊 Chưa có dữ liệu bảng xếp hạng cho mùa này.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🏆 BẢNG XẾP HẠNG TÔNG MÔN - Mùa #${season.season_number}`)
                .setColor('#f1c40f')
                .setDescription(leaderboard.map((e, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `${medal} **${e.sect_name}** (Cấp ${e.level})\n   ⚔️ ${e.total_damage} dmg | 🏆 ${e.total_wins} thắng | 📊 ${e.total_battles} trận`;
            }).join('\n'))
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            return;
        }
        if (sub === 'lichsu') {
            const history = SectWarService_1.sectWarService.getFinishedBattlesHistory();
            if (history.length === 0) {
                await interaction.reply({ content: '📜 Chưa có dữ liệu lịch sử chiến trận nào.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`📜 LỊCH SỬ BANG HỘI CHIẾN`)
                .setColor('#95a5a6');
            for (const b of history) {
                const sectNames = b.sect_ids.map((id) => {
                    const s = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(id);
                    return s ? s.name : 'Unknown';
                });
                const scoresStr = b.sect_ids.map((id, idx) => {
                    return `${sectNames[idx]}: ${b.scores[id] || 0}`;
                }).join(' | ');
                embed.addFields({
                    name: `Trận đấu ngày <t:${b.created_at}:d>`,
                    value: `Các bên: **${sectNames.join(' vs ')}**\nĐiểm số: ${scoresStr}\nTrạng thái: Đã kết thúc <t:${b.ended_at}:R>`
                });
            }
            await interaction.reply({ embeds: [embed] });
            return;
        }
    }
}
exports.default = SectWarCommand;
