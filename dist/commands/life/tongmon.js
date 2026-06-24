"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSectEmbed = getSectEmbed;
exports.getSectComponents = getSectComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const SectService_1 = require("../../services/SectService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
/**
 * Tạo Embed hiển thị thông tin Tông Môn
 */
function getSectEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor(uiSystem_1.EMBED_COLORS.ERROR)
            .setDescription('Đạo hữu chưa khởi tạo nhân vật.');
    }
    // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
    if (!user.sect_id) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('☯️ Tiên Giới Tông Môn - Tán Tu Chí Lộ')
            .setDescription(`Đạo hữu hiện đang là một **Tán Tu** tự do tự tại, chưa gia nhập môn phái nào.\n\n` +
            `Gia nhập Tông Môn giúp đạo hữu kết giao đồng đạo, cống hiến xây dựng môn phái và tăng cấp uy danh môn hạ!`)
            .setColor(uiSystem_1.EMBED_COLORS.NEUTRAL)
            .setTimestamp();
        const topSects = SectService_1.sectService.getTopSects();
        if (topSects.length > 0) {
            const listText = topSects
                .map((s, i) => `🔹 **${s.name}** (Cấp ${s.level}) — Trưởng môn: *${s.master_name}* (${s.member_count}/${s.member_limit} đệ tử)`)
                .join('\n');
            embed.addFields({ name: '🌟 Các Tông Môn Đang Tuyển Đệ Tử', value: listText });
        }
        else {
            embed.addFields({ name: '🌟 Các Tông Môn Đang Tuyển Đệ Tử', value: '*Hiện chưa có Tông Môn nào được sáng lập trong server.*' });
        }
        embed.addFields({ name: '🪙 Chi Phí Sáng Lập Môn Phái', value: '💵 **500 Linh Thạch Hạ Phẩm**' });
        return embed;
    }
    // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
    const sect = SectService_1.sectService.getSectDetails(user.sect_id);
    if (!sect) {
        // Khôi phục an toàn
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor(uiSystem_1.EMBED_COLORS.ERROR)
            .setDescription('Không thể truy vấn thông tin Tông Môn.');
    }
    const expBar = (0, constants_1.getProgressBar)(sect.exp, sect.level * 1000, 10);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`☯️ Môn Phái: ${sect.name} (Cấp ${sect.level})`)
        .setDescription(`*"${sect.description}"*`)
        .setColor(uiSystem_1.EMBED_COLORS.INFO)
        .addFields({ name: '👤 Tông Chủ', value: sect.master_name, inline: true }, { name: '👥 Thành Viên', value: `**${sect.member_count}/${sect.member_limit}** đệ tử`, inline: true }, { name: '🪙 Ngân Khố Môn Phái', value: `**${sect.resources}** Linh Thạch`, inline: true }, { name: '🏰 Cơ Sở Vật Chất Tông Môn', value: `• **Tụ Linh Trận:** Cấp **${sect.tu_linh_level}/5** (+${sect.tu_linh_level * 5}% EXP Tu Luyện)\n• **Luyện Đan Đường:** Cấp **${sect.dan_duong_level}/5** (+${sect.dan_duong_level * 2}% Tỷ lệ Luyện Đan)` }, { name: '✨ Tiến Trình Thăng Cấp', value: `${expBar} (${sect.exp}/${sect.level * 1000} XP)` }, { name: '🏵️ Điểm Cống Hiến Cá Nhân', value: `⭐ **${user.sect_contribution}** điểm cống hiến` })
        .setTimestamp();
    // Hiển thị danh sách thành viên (tối đa 10 người)
    const memberList = sect.members
        .slice(0, 10)
        .map((m, i) => {
        const isMaster = m.discord_id === sect.master_id;
        const role = isMaster ? '👑 [Tông Chủ]' : '🔸 [Đệ Tử]';
        return `${i + 1}. ${role} **${m.name}** (Cấp ${m.level}) — Cống hiến: **${m.sect_contribution}**`;
    })
        .join('\n');
    embed.addFields({ name: '📜 Danh Sách Đệ Tử Tông Môn', value: memberList || '*Không có thành viên.*' });
    return embed;
}
/**
 * Tạo các Component tương tác cho Tông Môn
 */
function getSectComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const rows = [];
    if (!user)
        return rows;
    // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
    if (!user.sect_id) {
        // 1. Nút sáng lập Tông Môn
        const btnRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`sectestablishnav_${userId}`)
            .setLabel('🆕 Sáng Lập Tông Môn (500 LThạch)')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setDisabled(user.coin_ha_pham < 500));
        rows.push(btnRow);
        // 2. Dropdown xin gia nhập Tông môn
        const sects = SectService_1.sectService.getTopSects();
        if (sects.length > 0) {
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`sectjoinselect_${userId}`)
                .setPlaceholder('☯️ Chọn Tông Môn muốn gia nhập...');
            sects.forEach(s => {
                selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                    .setLabel(s.name)
                    .setDescription(`Cấp ${s.level} | Đệ tử: ${s.member_count}/${s.member_limit} | Trưởng môn: ${s.master_name}`)
                    .setValue(s.id.toString()));
            });
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
        }
    }
    // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
    else {
        const sect = SectService_1.sectService.getSectDetails(user.sect_id);
        const isMaster = sect ? sect.master_id === userId : false;
        // 1. Dropdown quyên góp Linh Thạch
        const donateSelect = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`sectdonateselect_${userId}`)
            .setPlaceholder('🪙 Cống hiến Linh Thạch vào Ngân khố...');
        donateSelect.addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 50 Linh Thạch').setValue('50'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 200 Linh Thạch').setValue('200'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 500 Linh Thạch').setValue('500'));
        if (user.coin_ha_pham < 50) {
            donateSelect.setDisabled(true).setPlaceholder('🪙 Không đủ Linh Thạch để cống hiến (Tối thiểu 50)');
        }
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(donateSelect));
        // 2. Nút nâng cấp công trình (Chỉ dành cho Tông Chủ)
        if (isMaster && sect) {
            const upgradeRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`sectupgrade_tuling_${userId}`)
                .setLabel('🏗️ Nâng Tụ Linh Trận')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setDisabled(sect.tu_linh_level >= 5), new discord_js_1.ButtonBuilder()
                .setCustomId(`sectupgrade_danduong_${userId}`)
                .setLabel('🏗️ Nâng Luyện Đan Đường')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setDisabled(sect.dan_duong_level >= 5));
            rows.push(upgradeRow);
        }
        // 3. Nút rời tông môn / Giải tán, Làm mới
        const btnRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`sectleave_${userId}`)
            .setLabel(isMaster ? '💥 Giải Tán Tông Môn' : '🔙 Rời Tông Môn')
            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
            .setCustomId(`sectrefresh_${userId}`)
            .setLabel('🔄 Làm Mới')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        rows.push(btnRow);
    }
    return rows;
}
class TongMonCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('tongmon')
            .setDescription('Quản lý hoặc gia nhập Tông Môn Bang Hội.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
            });
            return;
        }
        const embed = getSectEmbed(userId);
        const components = getSectComponents(userId);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
    }
}
exports.default = TongMonCommand;
