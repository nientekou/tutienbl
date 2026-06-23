"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYCanhEmbed = getYCanhEmbed;
exports.getYCanhComponents = getYCanhComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
function getYCanhEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('🔮 CẢNH GIỚI Ý CẢNH')
            .setColor('#d35400')
            .setDescription('Chưa khởi tạo nhân vật.');
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
    return new discord_js_1.EmbedBuilder()
        .setTitle(`🔮 THÁP Ý CẢNH & ĐẠO QUẢ - ${user.name}`)
        .setColor('#9b59b6')
        .setDescription(desc)
        .addFields({
        name: `⚔️ Kiếm Ý (Cấp ${kiemY}/10)`,
        value: kiemY > 0 ? `Buff **+${kiemY * 3}%** base Công Kích.` : '`Chưa thức tỉnh` *(+3% Công Kích mỗi cấp)*',
        inline: false
    }, {
        name: `🩸 Bất Diệt Ý (Cấp ${batDietY}/10)`,
        value: batDietY > 0 ? `Buff **+${batDietY * 3}%** base Sinh Lực.` : '`Chưa thức tỉnh` *(+3% Sinh Lực mỗi cấp)*',
        inline: false
    }, {
        name: `🛡️ Huyền Quy Ý (Cấp ${huyenQuyY}/10)`,
        value: huyenQuyY > 0 ? `Buff **+${huyenQuyY * 3}%** base Phòng Thủ.` : '`Chưa thức tỉnh` *(+3% Phòng Thủ mỗi cấp)*',
        inline: false
    })
        .setFooter({ text: 'Ý Cảnh đạt cấp tối đa 10 sẽ được hoàn trả tài nguyên khi quay trúng.' })
        .setTimestamp();
}
function getYCanhComponents(userId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`ycanhawaken_${userId}`)
        .setLabel('🧘 Ngộ Ý Cảnh')
        .setStyle(discord_js_1.ButtonStyle.Primary));
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
        const embed = getYCanhEmbed(discordId);
        const row = getYCanhComponents(discordId);
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
}
exports.default = YCanhCommand;
