"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLeylineEmbed = buildLeylineEmbed;
exports.buildLeylineComponents = buildLeylineComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const LeylineService_1 = require("../../services/LeylineService");
const constants_1 = require("../../utils/constants");
const LEYLINE_NAMES = {
    'tuluyen': 'Tu Luyện (Mộc)',
    'chiendau': 'Chiến Đấu (Hỏa)',
    'thuthap': 'Thu Thập (Thủy)',
    'kinhte': 'Kinh Tế (Kim)',
    'tongmon': 'Tông Môn (Thổ)'
};
const LEYLINE_EFFECTS = {
    'tuluyen': '+20% EXP khi Tu Luyện/Làm Việc',
    'chiendau': '+10% ATK khi Săn Yêu/Bí Cảnh/PvP',
    'thuthap': '+25% Tỷ lệ rơi vật phẩm khi Khám Phá/Linh Điền',
    'kinhte': '-10% Phí giao dịch Chợ Trời',
    'tongmon': '+15% Cống hiến Tông Môn'
};
function formatDuration(remainSec) {
    if (remainSec <= 0)
        return 'Hết hạn';
    const hours = Math.floor(remainSec / 3600);
    const minutes = Math.floor((remainSec % 3600) / 60);
    if (hours > 0) {
        return `${hours} giờ ${minutes} phút`;
    }
    return `${minutes} phút`;
}
function buildLeylineEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('🌟 LINH MẠCH ĐỊA ĐỒ')
            .setColor('#e74c3c')
            .setDescription('Chưa khởi tạo nhân vật.');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const userLeyline = LeylineService_1.leylineService.getUserLeyline(userId);
    const leylines = LeylineService_1.leylineService.getAllLeylines();
    const desc = `*Linh mạch đại lục là nguồn sinh khí nuôi dưỡng tu sĩ. Mọi hành động của các tu sĩ trên server sẽ tích tụ linh khí vào các linh mạch tương ứng. Khi đầy, linh mạch sẽ bùng nổ buff toàn server trong 2 giờ.*\n\n` +
        `🧘 **Trạng thái Dẫn dòng:** ${userLeyline.channeling_target ? `Đang tập trung dẫn dòng vào **${LEYLINE_NAMES[userLeyline.channeling_target]}**` : '`Chưa dẫn dòng`'}\n` +
        `⏳ **Hồi thuật dẫn dòng:** ${userLeyline.channeling_cooldown > nowSec ? `\`${formatDuration(userLeyline.channeling_cooldown - nowSec)}\`` : '`Sẵn sàng` (Cooldown 6 giờ sau khi đổi)'}\n` +
        `*(Dẫn dòng giúp tăng +50% linh khí đóng góp cho linh mạch đó, nhưng sẽ không tích tụ vào các mạch khác)*\n`;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🌟 LINH MẠCH ĐỊA ĐỒ - THẾ GIỚI TU CHÂN`)
        .setColor('#2ecc71')
        .setDescription(desc)
        .setTimestamp();
    leylines.forEach(l => {
        const id = l.id;
        const isBuffActive = l.buff_active_until > nowSec;
        const name = LEYLINE_NAMES[id] || id;
        const effect = LEYLINE_EFFECTS[id] || '';
        const isUserChanneling = userLeyline.channeling_target === id;
        let statusText = '';
        if (isBuffActive) {
            statusText = `🟢 **ĐANG PHÁT HUY** (Còn: \`${formatDuration(l.buff_active_until - nowSec)}\`)`;
        }
        else {
            statusText = `🔴 Chưa kích hoạt | Năng lượng: \`${l.current_energy}/${l.max_energy}\`\n${(0, constants_1.getProgressBar)(l.current_energy, l.max_energy)}`;
        }
        const titleLine = `${isUserChanneling ? '⚡ ' : ''}${name} - *${effect}*`;
        embed.addFields({
            name: titleLine,
            value: `${statusText}${isUserChanneling ? ' \n*(Đạo hữu đang dẫn dòng tại đây)*' : ''}`,
            inline: false
        });
    });
    return embed;
}
function buildLeylineComponents(userId) {
    const userLeyline = LeylineService_1.leylineService.getUserLeyline(userId);
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`linhmach_select_${userId}`)
        .setPlaceholder('🧘 Chọn linh mạch để dẫn dòng...');
    Object.keys(LEYLINE_NAMES).forEach(id => {
        const isCurrent = userLeyline.channeling_target === id;
        selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(LEYLINE_NAMES[id])
            .setDescription(LEYLINE_EFFECTS[id].substring(0, 100))
            .setValue(id)
            .setDefault(isCurrent));
    });
    // Thêm tùy chọn hủy dẫn dòng
    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel('Hủy dẫn dòng')
        .setDescription('Ngừng dẫn dòng linh lực vào bất kỳ linh mạch nào')
        .setValue('cancel')
        .setDefault(userLeyline.channeling_target === null));
    const rowSelect = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
    const closeButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`linhmach_close_${userId}`)
        .setLabel('Đóng')
        .setStyle(discord_js_1.ButtonStyle.Danger);
    const rowButton = new discord_js_1.ActionRowBuilder().addComponents(closeButton);
    return [rowSelect, rowButton];
}
class LinhmachCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('linhmach')
            .setDescription('Xem trạng thái linh mạch địa đồ server và thiết lập thuật dẫn dòng linh khí.'));
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
        const embed = buildLeylineEmbed(discordId);
        const components = buildLeylineComponents(discordId);
        await interaction.editReply({ embeds: [embed], components });
    }
}
exports.default = LinhmachCommand;
