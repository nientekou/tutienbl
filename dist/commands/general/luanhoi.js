"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLuanHoiEmbed = getLuanHoiEmbed;
exports.getLuanHoiComponents = getLuanHoiComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const v2Components_1 = require("../../utils/v2Components");
function getLuanHoiEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return (0, v2Components_1.container)(0x8E44AD, [
            (0, v2Components_1.header)('🌌 LUÂN HỒI CHUYỂN THẾ'),
            (0, v2Components_1.body)('Chưa khởi tạo nhân vật.'),
        ]);
    }
    const currentLuanHoi = user.luan_hoi_count || 0;
    const desc = `🌌 **CƠ DUYÊN NGHỊCH THIÊN CHUYỂN THẾ LUÂN HỒI**\n\n` +
        `*Khi tu sĩ đạt tới Đăng Tiên Kỳ - Tầng 38 (Cấp 380), cơ thể đã tiệm cận thiên địa quy luật, có thể lựa chọn tự bạo tu vi kiếp này để bước qua Lục Đạo Luân Hồi, bắt đầu chuyển thế trùng sinh.*\n\n` +
        `⚡ **Điều Kiện Luân Hồi:** Đạt Cấp **380** (Hiện tại: Cấp **${user.level}**)\n\n` +
        `🎁 **Đặc Quyền Vĩnh Viễn Sau Khi Luân Hồi:**\n` +
        `- 🧘 Tốc độ tu luyện nhàn rỗi tăng vĩnh viễn: **+25%** (Hiện tại: +${currentLuanHoi * 25}%)\n` +
        `- 📜 Nhận Đạo Hiệu đặc biệt: **Luân Hồi Chi Chủ - Đời ${currentLuanHoi + 1}**\n` +
        `- 🪙 Giữ nguyên toàn bộ Linh Thạch Hạ/Trung/Thượng Phẩm, Kim Nguyên Bảo.\n` +
        `- 💼 Giữ nguyên toàn bộ Túi Đồ (Trang bị, nguyên liệu, đan dược).\n` +
        `- ☯️ Tẩy tủy nhận một Linh Căn mới ngẫu nhiên.\n\n` +
        `⚠️ **Lưu Ý:** Tu vi và Cảnh giới sẽ được reset về **Luyện Khí Kỳ - Tầng 1 (Cấp 1)**. Đạo hữu có muốn nghịch thiên cải mệnh, đi vào Luân Hồi?`;
    const isEligible = user.level >= 380;
    return (0, v2Components_1.container)(isEligible ? 0x9b59b6 : 0x95a5a6, [
        (0, v2Components_1.header)(`🌌 LUÂN HỒI CHUYỂN THẾ - ${user.name}`),
        (0, v2Components_1.body)(desc),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(isEligible ? 'Nhấn nút phía dưới để xác nhận đi vào Luân Hồi đại trận!' : 'Hãy tiếp tục tu luyện đạt Đăng Tiên Kỳ Đại Viên Mãn!'),
    ]);
}
function getLuanHoiComponents(userId, isEligible) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`luanhoiconfirm_${userId}`)
        .setLabel('🌌 Đi Vào Luân Hồi')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setDisabled(!isEligible), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
}
class LuanHoiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('luanhoi')
            .setDescription('Tiến hành Luân Hồi Chuyển Thế khi đạt cảnh giới tối cao (Cấp 380).'));
    }
    async execute(client, interaction) {
        const discordId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(discordId);
        if (!user) {
            await interaction.editReply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!'
            });
            return;
        }
        const comp = getLuanHoiEmbed(discordId);
        const row = getLuanHoiComponents(discordId, user.level >= 380);
        await interaction.editReply({ components: [comp, row], flags: v2Components_1.V2_FLAG });
    }
}
exports.default = LuanHoiCommand;
