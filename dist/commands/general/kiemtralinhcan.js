"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const constants_1 = require("../../utils/constants");
class KiemTraLinhCanCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('kiemtralinhcan')
            .setDescription('Kiểm tra linh căn và căn cơ tu luyện của đạo hữu.'));
    }
    async execute(client, interaction) {
        const discordId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(discordId);
        if (!user) {
            await interaction.reply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu tiên!',
                ephemeral: true
            });
            return;
        }
        const formattedLinhCan = (0, constants_1.formatLinhCan)(user.linh_can);
        // Tính toán bồi đắp thuộc tính động
        const linhCan = JSON.parse(user.linh_can || '{}');
        const bonuses = [];
        let speedMult = 1.0;
        const len = Object.keys(linhCan).length;
        if (len === 1)
            speedMult = 1.5;
        else if (len === 2)
            speedMult = 1.25;
        else if (len === 3)
            speedMult = 1.1;
        else if (len === 4)
            speedMult = 1.0;
        else
            speedMult = 0.9;
        for (const [element, percentage] of Object.entries(linhCan)) {
            const ratio = percentage / 100;
            if (element === 'Lôi') {
                bonuses.push(`⚡ **Lôi (${percentage}%)**: +${(20 * ratio).toFixed(1)}% Công kích`);
            }
            else if (element === 'Hỏa') {
                bonuses.push(`🔥 **Hỏa (${percentage}%)**: +${(10 * ratio).toFixed(1)}% Công kích | +${(10 * ratio).toFixed(1)}% Bạo kích`);
            }
            else if (element === 'Phong') {
                bonuses.push(`🌀 **Phong (${percentage}%)**: +${(15 * ratio).toFixed(1)}% Bạo kích`);
            }
            else if (element === 'Thủy') {
                bonuses.push(`💧 **Thủy (${percentage}%)**: +${(25 * ratio).toFixed(1)}% Linh lực (MP)`);
            }
            else if (element === 'Mộc') {
                bonuses.push(`🌿 **Mộc (${percentage}%)**: +${(15 * ratio).toFixed(1)}% Sinh lực (HP) | +${(10 * ratio).toFixed(1)}% Linh lực (MP)`);
            }
            else if (element === 'Thổ') {
                bonuses.push(`🪨 **Thổ (${percentage}%)**: +${(20 * ratio).toFixed(1)}% Phòng ngự | +${(10 * ratio).toFixed(1)}% Kháng bạo`);
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`☯️ Căn Cơ Linh Căn - ${user.name}`)
            .setColor('#3498db')
            .setDescription('Linh Căn quyết định tốc độ hấp thu linh khí và thuộc tính chiêu thức chiến đấu của đạo hữu.')
            .addFields({ name: '👤 Đạo Hữu', value: user.name, inline: true }, { name: '✨ Danh Hiệu', value: user.title, inline: true }, { name: '🔮 Linh Căn Hiện Tại', value: formattedLinhCan }, { name: '🚀 Tốc Độ Hấp Thu', value: `⚡ **${speedMult}x** tốc độ tu luyện cơ sở`, inline: true }, { name: '🎭 Thuộc Tính Bồi Đắp Linh Căn', value: bonuses.length > 0 ? bonuses.join('\n') : 'Không có bồi đắp thuộc tính.' }, { name: '📖 Hướng Dẫn Cơ Chế Linh Căn', value: `• Số lượng hệ Linh Căn càng ít, tốc độ tu luyện càng nhanh (Đơn: **1.5x** | Song: **1.25x** | Tam: **1.1x** | Tứ: **1.0x** | Ngũ: **0.9x**).\n` +
                `• Phần trăm (%) của mỗi hệ quyết định hiệu lực cộng thêm thuộc tính chiến đấu của hệ đó.\n` +
                `• Hệ linh căn đặc trưng:\n` +
                `  - ⚡ **Lôi**: Tăng công kích cực mạnh.\n` +
                `  - 🔥 **Hỏa**: Tăng công kích và bạo kích.\n` +
                `  - 🌀 **Phong**: Tăng bạo kích đột phá.\n` +
                `  - 💧 **Thủy**: Tăng linh lực (MP) dồi dào.\n` +
                `  - 🌿 **Mộc**: Tăng sinh lực (HP) và linh lực (MP).\n` +
                `  - 🪨 **Thổ**: Tăng phòng ngự và kháng bạo cứng cáp.`
        })
            .setFooter({ text: 'Tẩy Tủy sẽ tốn 100 Hạ Phẩm Linh Thạch để cơ cấu lại thuộc tính!' })
            .setTimestamp();
        // Thêm nút tẩy tủy linh căn (gacha lại)
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`taytuy_${discordId}`)
            .setLabel('🌀 Tẩy Tủy Linh Căn (Phí: 100 Linh Thạch)')
            .setStyle(discord_js_1.ButtonStyle.Primary));
        await interaction.reply({ embeds: [embed], components: [row] });
    }
}
exports.default = KiemTraLinhCanCommand;
