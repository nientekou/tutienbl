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
const v2Components_1 = require("../../utils/v2Components");
/**
 * Tạo Embed hiển thị thông tin Tông Môn
 */
function getSectEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi', 'Đạo hữu chưa khởi tạo nhân vật.')
        ]);
    }
    // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
    if (!user.sect_id) {
        const content = [
            (0, v2Components_1.header)('☯️ Tiên Giới Tông Môn — Tán Tu Chí Lộ', 'Đạo hữu hiện đang là một Tán Tu tự do tự tại, chưa gia nhập môn phái nào.\n\nGia nhập Tông Môn giúp đạo hữu kết giao đồng đạo, cống hiến xây dựng môn phái và tăng cấp uy danh môn hạ!')
        ];
        const topSects = SectService_1.sectService.getTopSects();
        content.push((0, v2Components_1.separator)());
        if (topSects.length > 0) {
            const listText = topSects
                .map((s, i) => `🔹 **${s.name}** (Cấp ${s.level}) — Trưởng môn: *${s.master_name}* (${s.member_count}/${s.member_limit} đệ tử)`)
                .join('\n');
            content.push((0, v2Components_1.body)(`🌟 **Các Tông Môn Đang Tuyển Đệ Tử:**\n${listText}`));
        }
        else {
            content.push((0, v2Components_1.body)('🌟 **Các Tông Môn Đang Tuyển Đệ Tử:**\n*Hiện chưa có Tông Môn nào được sáng lập trong server.*'));
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)('🪙 **Chi Phí Sáng Lập Môn Phái:**\n💵 **500 Linh Thạch Hạ Phẩm**'));
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.dark, content);
    }
    // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
    const sect = SectService_1.sectService.getSectDetails(user.sect_id);
    if (!sect) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi', 'Không thể truy vấn thông tin Tông Môn.')
        ]);
    }
    const expBar = (0, constants_1.getProgressBar)(sect.exp, sect.level * 1000, 10);
    const memberList = sect.members
        .slice(0, 10)
        .map((m, i) => {
        const isMaster = m.discord_id === sect.master_id;
        const role = isMaster ? '👑 [Tông Chủ]' : '🔸 [Đệ Tử]';
        return `${i + 1}. ${role} **${m.name}** (Cấp ${m.level}) — Cống hiến: **${m.sect_contribution}**`;
    })
        .join('\n');
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.primary, [
        (0, v2Components_1.header)(`☯️ Môn Phái: ${sect.name} (Cấp ${sect.level})`, `*"${sect.description}"*`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`👤 **Tông Chủ:** ${sect.master_name}\n` +
            `👥 **Thành Viên:** **${sect.member_count}/${sect.member_limit}** đệ tử\n` +
            `🪙 **Ngân Khố Môn Phái:** **${sect.resources}** Linh Thạch\n` +
            `🏵️ **Cơ Duyên Bản Thân:** ⭐ **${user.sect_contribution}** cống hiến`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`🏰 **Cơ Sở Vật Chất Tông Môn:**\n` +
            `• **Tụ Linh Trận:** Cấp **${sect.tu_linh_level}/5** (+${sect.tu_linh_level * 5}% EXP Tu Luyện)\n` +
            `• **Luyện Đan Đường:** Cấp **${sect.dan_duong_level}/5** (+${sect.dan_duong_level * 2}% Tỷ lệ Luyện Đan)`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`✨ **Tiến Trình Thăng Cấp:**\n${expBar} (${sect.exp}/${sect.level * 1000} XP)`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`📜 **Danh Sách Đệ Tử Tông Môn:**\n${memberList || '*Không có thành viên.*'}`)
    ]);
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
        const btnRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`sectestablishnav_${userId}`)
            .setLabel('🆕 Sáng Lập Tông Môn (500 LThạch)')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setDisabled(user.coin_ha_pham < 500));
        rows.push(btnRow);
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
        const donateSelect = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`sectdonateselect_${userId}`)
            .setPlaceholder('🪙 Cống hiến Linh Thạch vào Ngân khố...');
        donateSelect.addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 50 Linh Thạch').setValue('50'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 200 Linh Thạch').setValue('200'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Quyên góp 500 Linh Thạch').setValue('500'));
        if (user.coin_ha_pham < 50) {
            donateSelect.setDisabled(true).setPlaceholder('🪙 Không đủ Linh Thạch để cống hiến (Tối thiểu 50)');
        }
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(donateSelect));
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
