"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDreamscapeEmbed = getDreamscapeEmbed;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const DreamscapeService_1 = require("../../services/DreamscapeService");
const InventoryService_1 = require("../../services/InventoryService");
const constants_1 = require("../../utils/constants");
function getDreamscapeEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        throw new Error('User not found');
    }
    const dsData = DreamscapeService_1.dreamscapeService.getDreamscapeData(userId);
    const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
    const maxHp = activeStats?.hp || 100;
    const currentHp = dsData.hp_remaining !== -1 ? dsData.hp_remaining : maxHp;
    const floorBar = (0, constants_1.getProgressBar)(dsData.current_floor, 50, 10);
    const hpBar = (0, constants_1.getProgressBar)(currentHp, maxHp, 10);
    const weeklyStars = '⭐'.repeat(dsData.weekly_entries) + '⚫'.repeat(3 - dsData.weekly_entries);
    // Shadow Stats Forecast
    let multiplier = 1.0;
    const floor = dsData.current_floor;
    if (floor >= 11 && floor <= 20)
        multiplier = 1.2;
    else if (floor >= 21 && floor <= 30)
        multiplier = 1.5;
    else if (floor >= 31 && floor <= 50)
        multiplier = 2.0;
    const shadowHp = Math.round((user.base_hp || 100) * multiplier);
    const shadowAtk = Math.round((user.base_atk || 15) * multiplier);
    const shadowDef = Math.round((user.base_def || 10) * multiplier);
    const shadowSpeed = (user.base_speed || 100) * multiplier;
    const hpStr = dsData.hp_remaining !== -1 ? `${dsData.hp_remaining}/${maxHp}` : `${maxHp}/${maxHp} (Chưa bắt đầu)`;
    return new discord_js_1.EmbedBuilder()
        .setTitle(`🌌 BÍ CẢNH VỌNG TƯỞNG - ${user.name}`)
        .setDescription(`Ngươi đang đối mặt với chính bản ngã của mình. Trong Vọng Tưởng, không thể sử dụng đan dược, cũng không có kỹ năng hồi máu nào có tác dụng. Sức mạnh của Bóng Tối sẽ liên tục tăng cường theo từng tầng.\n\n` +
        `🏆 **Tầng Cao Nhất (Tuần):** Tầng **${dsData.max_floor}**\n` +
        `🏅 **Điểm Số Hiện Tại:** **${dsData.score}** Điểm\n` +
        `⏳ **Lượt Khiêu Chiến Tuần:** ${weeklyStars} **(${dsData.weekly_entries}/3)**\n\n` +
        `📊 **Tiến Trình Leo Tháp:** Tầng **${floor}/50**\n` +
        `${floorBar}\n\n` +
        `🩸 **Sinh Lực Bản Thân:** **${hpStr}**\n` +
        `${hpBar}\n\n` +
        `👤 **Bóng Tối Dự Báo (Tầng ${floor}):**\n` +
        `• Sinh Lực: **${shadowHp}** HP\n` +
        `• Tấn Công: **${shadowAtk}** ATK\n` +
        `• Phòng Thủ: **${shadowDef}** DEF\n` +
        `• Tốc Độ: **${shadowSpeed}** SPD\n\n` +
        `*Gợi ý: Dùng \`/vongtuong khieuchien\` để leo tháp, hoặc \`/vongtuong dauhang\` để reset máu và quay về tầng 1.*`)
        .setColor('#9b59b6')
        .setTimestamp();
}
class VongTuongCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('vongtuong')
            .setDescription('Tiến vào Bí Cảnh Vọng Tưởng (Dreamscape) để khiêu chiến bóng tối của chính mình.')
            .addSubcommand(sub => sub.setName('thongtin')
            .setDescription('Xem thông tin Bí Cảnh Vọng Tưởng của bạn hiện tại'))
            .addSubcommand(sub => sub.setName('khieuchien')
            .setDescription('Khiêu chiến Bóng Tối ở tầng hiện tại'))
            .addSubcommand(sub => sub.setName('dauhang')
            .setDescription('Đầu hàng vòng lặp hiện tại, reset máu và quay về tầng 1'))
            .addSubcommand(sub => sub.setName('bangxephang')
            .setDescription('Xem bảng xếp hạng Vọng Tưởng tuần này')));
    }
    async execute(client, interaction) {
        const subcommand = interaction.options.getSubcommand();
        const discordId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(discordId);
        if (!user) {
            return interaction.reply({ content: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng lệnh `/taonhanvat`!', ephemeral: true });
        }
        // Yêu cầu cảnh giới tối thiểu (VD: Trúc Cơ Kỳ tầng 1 = level 39)
        if (user.level < 39) {
            return interaction.reply({ content: 'Bí Cảnh Vọng Tưởng chỉ dành cho tu sĩ từ **Trúc Cơ Kỳ** trở lên. Khí tức của đạo hữu chưa đủ mạnh để phân tách Bóng Tối!', ephemeral: true });
        }
        const dsData = DreamscapeService_1.dreamscapeService.getDreamscapeData(discordId);
        if (subcommand === 'thongtin') {
            const embed = getDreamscapeEmbed(discordId);
            return interaction.reply({ embeds: [embed] });
        }
        if (subcommand === 'khieuchien') {
            await interaction.deferReply();
            const result = DreamscapeService_1.dreamscapeService.challenge(discordId);
            if (!result.success) {
                return interaction.editReply({ content: result.message });
            }
            let battleLog = result.log ? result.log.join('\n') : '';
            if (battleLog.length > 3800) {
                battleLog = battleLog.substring(0, 3800) + '\n... (Trận chiến quá dài, đã được rút gọn) ...';
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🌌 Vọng Tưởng: Tầng ${result.currentFloor}`)
                .setDescription(`📜 **Chiến báo:**\n${battleLog}\n\n${result.message}`)
                .setColor(result.isWin ? '#2ecc71' : '#e74c3c');
            return interaction.editReply({ embeds: [embed] });
        }
        if (subcommand === 'dauhang') {
            const result = DreamscapeService_1.dreamscapeService.resetDreamscape(discordId);
            return interaction.reply({ content: result.message });
        }
        if (subcommand === 'bangxephang') {
            const leaderboard = DreamscapeService_1.dreamscapeService.getLeaderboard(10);
            if (leaderboard.length === 0) {
                return interaction.reply({ content: 'Bảng xếp hạng tuần này chưa có ai tham gia.', ephemeral: true });
            }
            let desc = '';
            leaderboard.forEach((entry, index) => {
                let medal = '🏅';
                if (index === 0)
                    medal = '🥇';
                if (index === 1)
                    medal = '🥈';
                if (index === 2)
                    medal = '🥉';
                desc += `${medal} **Top ${index + 1}:** ${entry.name} - **${entry.score} Điểm** (Max Tầng: ${entry.max_floor})\n`;
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🏆 Bảng Xếp Hạng Vọng Tưởng (Tuần)')
                .setDescription(desc)
                .setColor('#f1c40f')
                .setFooter({ text: 'Sẽ tự động trao phần thưởng và reset vào sáng Thứ 2 hàng tuần.' });
            return interaction.reply({ embeds: [embed] });
        }
    }
}
exports.default = VongTuongCommand;
