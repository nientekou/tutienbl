"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const TribulationService_1 = require("../../services/TribulationService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const InventoryService_1 = require("../../services/InventoryService");
const constants_1 = require("../../utils/constants");
class DotPhaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dotpha')
            .setDescription('Đột phá cảnh giới tu vi khi tích lũy đầy linh khí.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        if (user.tu_vi < user.exp_needed) {
            await interaction.reply({
                content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Đang có: **${user.tu_vi}/${user.exp_needed}** Tu Vi). Đạo hữu hãy thiền định hoặc đi bí cảnh dã ngoại để kiếm thêm tu vi.`,
                ephemeral: true
            });
            return;
        }
        const { minorLevel, majorIndex, fullName } = (0, constants_1.getRealmDetails)(user.level);
        const isMajor = minorLevel === 38;
        if (!isMajor) {
            // Đột phá cấp cảnh giới nhỏ -> Hiện bảng xác nhận và tuỳ chọn đan dược
            const baseRate = Math.max(90 - majorIndex * 10, 10);
            const luckBonus = user.base_luck * 0.002;
            const totalRate = Math.min(baseRate + (luckBonus * 100), 100);
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
            const getQty = (itemId) => inv.find(i => i.item_id === itemId)?.quantity || 0;
            const q1 = getQty('pill_break_minor_1');
            const q2 = getQty('pill_break_minor_2');
            const q3 = getQty('pill_break_minor_3');
            const bequanCost = user.level * 200;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🌟 Chuẩn Bị Đột Phá: ${fullName}`)
                .setColor('#f1c40f')
                .setDescription(`Đạo hữu đã tích đủ linh khí, có thể thử nghiệm trùng kích bình cảnh để lên **Tầng ${minorLevel + 1}**.\n\n` +
                `🌿 **Tu Vi hiện có:** **${user.tu_vi}/${user.exp_needed}**\n` +
                `${(0, constants_1.getProgressBar)(user.tu_vi, user.exp_needed, 10)}\n\n` +
                `📈 **Tỷ lệ đột phá thành công:** **${totalRate.toFixed(1)}%**\n` +
                `${(0, constants_1.getProgressBar)(totalRate, 100, 10)}\n\n` +
                `⚠️ **Rủi ro:** Nếu đột phá thất bại sẽ tổn hao **15% Tu Vi** hiện tại.\n\n` +
                `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanCost}** Linh Thạch Hạ Phẩm để đảm bảo đột phá 100% thành công.\n\n` +
                `Đạo hữu muốn dùng đan dược hay Bế Quan Đột Phá?`)
                .setFooter({ text: 'Nhấn nút bên dưới để tiến hành đột phá' })
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_none_${userId}`)
                .setLabel('Không dùng đan')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_pill_break_minor_1_${userId}`)
                .setLabel(`Tụ Khí (+15%) [x${q1}]`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(q1 <= 0), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_pill_break_minor_2_${userId}`)
                .setLabel(`Bồi Nguyên (+30%) [x${q2}]`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(q2 <= 0), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_pill_break_minor_3_${userId}`)
                .setLabel(`Tạo Hóa (+50%) [x${q3}]`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(q3 <= 0), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_bequan_${userId}`)
                .setLabel(`Bế Quan (${bequanCost} LThạch)`)
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setDisabled(user.coin_ha_pham < bequanCost));
            await interaction.reply({ embeds: [embed], components: [row] });
        }
        else {
            // Đột phá cảnh giới lớn -> Nghênh tiếp Lôi Kiếp
            const bolts = 3 + majorIndex * 2;
            const damage = Math.round(20 + majorIndex * 15);
            const stats = InventoryService_1.inventoryService.getActiveStats(userId);
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
            const getQty = (itemId) => inv.find(i => i.item_id === itemId)?.quantity || 0;
            const antiLoiQty = getQty('pill_alchemy_anti_loi');
            const hp1Qty = getQty('pill_hp_1');
            const hp2Qty = getQty('pill_hp_2');
            const tiLoiQty = getQty('talisman_anti_loi');
            const oncomingKiep = TribulationService_1.tribulationService.getOncomingKiepInfo(userId);
            const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
            const bequanMajorCost = user.level * 1000;
            const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
            const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`)
                .setColor('#e74c3c')
                .setDescription(`Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân đang kéo tới dồn dập!\n\n` +
                `• Cảnh giới lớn đột phá: **${fullName}**\n` +
                `• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n` +
                `• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp** giáng xuống liên tục.\n` +
                `• Uy lực ước tính: **~${damage}** sát thương thô mỗi đạo sét.\n\n` +
                `❤️ **Trạng thái hiện tại:**\n` +
                `• Sinh Lực tối đa: **${hpText}** HP\n` +
                `• Pháp Lực tối đa: **${mpText}** MP\n\n` +
                `🎒 **Vật phẩm hộ thân hiện có trong túi:**\n` +
                `• ${oncomingKiep.pillName} 💊 (khắc chế kiếp, giảm 40%): **${protectPillQty}** viên\n` +
                `• Ngự Lôi Đan 💊 (giảm 30% sát thương): **${antiLoiQty}** viên\n` +
                `• Tị Lôi Phù 📜 (giảm 80% sát thương 1 lượt): **${tiLoiQty}** tấm\n` +
                `• Hồi Huyết Đan trung phẩm ❤️ (hồi 150 HP): **${hp2Qty}** viên\n\n` +
                `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanMajorCost}** Linh Thạch Hạ Phẩm để đột phá an toàn 100% (bỏ qua lôi kiếp).\n\n` +
                `⚠️ **Cảnh báo nguy hiểm:** Hãy chắc chắn đạo hữu đang đầy đủ HP/MP. Nếu HP về 0 giữa lôi kiếp, đạo hữu sẽ đột phá thất bại, bị **Trọng Thương (1 giờ)** và tổn thất **-30%** tu vi hiện có!`)
                .setFooter({ text: '📖 Xem thêm về Kiếp Số tại /camnang chuong3' })
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`loi_start_${userId}`)
                .setLabel('⚡ Nghênh Tiếp Lôi Kiếp!')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_bequan_${userId}`)
                .setLabel(`Bế Quan (${bequanMajorCost} LThạch)`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(user.coin_ha_pham < bequanMajorCost));
            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }
}
exports.default = DotPhaCommand;
