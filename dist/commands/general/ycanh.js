"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYCanhEmbed = getYCanhEmbed;
exports.getYCanhComponents = getYCanhComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const v2Components_1 = require("../../utils/v2Components");
function getYCanhEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return (0, v2Components_1.container)(0x8E44AD, [
            (0, v2Components_1.header)('🔮 CẢNH GIỚI Ý CẢNH'),
            (0, v2Components_1.body)('Chưa khởi tạo nhân vật.'),
        ]);
    }
    let yCanhMap = {};
    try {
        yCanhMap = JSON.parse(user.y_canh || '{}');
    }
    catch (e) {
        yCanhMap = {};
    }
    const kiemY = yCanhMap.KiemY || 0;
    const batDietY = yCanhMap.BatDietY || 0;
    const huyenQuyY = yCanhMap.HuyenQuyY || 0;
    const desc = `*Ý Cảnh là sự lĩnh ngộ tối cao về võ học và thiên địa quy luật. Thức tỉnh Ý Cảnh giúp tu sĩ gia tăng phần trăm chỉ số sức mạnh vĩnh viễn.*\n\n` +
        `🧘 **Ngộ Tính Hiện Có:** \`${user.ngotinh}\` Điểm\n` +
        `🪙 **Linh Thạch Hạ Phẩm:** \`${user.coin_ha_pham}\` viên\n\n` +
        `*Yêu cầu Ngộ Ý Cảnh:* Tiêu hao **5** Ngộ Tính (ưu tiên) hoặc **500** Linh Thạch Hạ Phẩm.\n` +
        `*(Ngộ tính nhận được khi Thiền Định hoặc chinh phục Bí Cảnh/World Boss)*\n`;
    return (0, v2Components_1.container)(0x9b59b6, [
        (0, v2Components_1.header)(`🔮 THÁP Ý CẢNH & ĐẠO QUẢ - ${user.name}`),
        (0, v2Components_1.body)(desc),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`⚔️ Kiếm Ý (Cấp ${kiemY}/10)\n` +
            (kiemY > 0 ? `Buff **+${kiemY * 3}%** base Công Kích.` : '`Chưa thức tỉnh` *(+3% Công Kích mỗi cấp)*')),
        (0, v2Components_1.body)(`🩸 Bất Diệt Ý (Cấp ${batDietY}/10)\n` +
            (batDietY > 0 ? `Buff **+${batDietY * 3}%** base Sinh Lực.` : '`Chưa thức tỉnh` *(+3% Sinh Lực mỗi cấp)*')),
        (0, v2Components_1.body)(`🛡️ Huyền Quy Ý (Cấp ${huyenQuyY}/10)\n` +
            (huyenQuyY > 0 ? `Buff **+${huyenQuyY * 3}%** base Phòng Thủ.` : '`Chưa thức tỉnh` *(+3% Phòng Thủ mỗi cấp)*')),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)('Ý Cảnh đạt cấp tối đa 10 sẽ được hoàn trả tài nguyên khi quay trúng.'),
    ]);
}
function getYCanhComponents(userId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`ycanhawaken_${userId}`)
        .setLabel('🧘 Ngộ Ý Cảnh')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
}
class YCanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('ycanh')
            .setDescription('Xem và thức tỉnh/nâng cấp Ý Cảnh (intent) của đạo hữu.'));
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
        const comp = getYCanhEmbed(discordId);
        const row = getYCanhComponents(discordId);
        await interaction.editReply({ components: [comp, row], flags: v2Components_1.V2_FLAG });
    }
}
exports.default = YCanhCommand;
