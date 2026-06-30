"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const CultivationService_1 = require("../../services/CultivationService");
const TribulationService_1 = require("../../services/TribulationService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const InventoryService_1 = require("../../services/InventoryService");
const constants_1 = require("../../utils/constants");
const itemConstants_1 = require("../../config/itemConstants");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
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
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        if (user.tu_vi < user.exp_needed) {
            await interaction.editReply({
                content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Đang có: **${user.tu_vi}/${user.exp_needed}** Tu Vi). Đạo hữu hãy thiền định hoặc đi bí cảnh dã ngoại để kiếm thêm tu vi.`
            });
            return;
        }
        const { minorLevel, majorIndex, fullName } = (0, constants_1.getRealmDetails)(user.level);
        const isMajor = minorLevel === 38;
        if (!isMajor) {
            // Đột phá cấp cảnh giới nhỏ -> Hiện bảng xác nhận và tuỳ chọn đan dược
            let totalRate = CultivationService_1.CultivationService.getBreakthroughRate(majorIndex, user.base_luck);
            // BIG UPDATE §2: Karma breakthrough bonus
            try {
                const { karmaService } = require('../../services/KarmaService');
                totalRate += karmaService.getBreakthroughBonus(userId) * 100;
            }
            catch { }
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
            const getQty = (itemId) => inv.find(i => i.item_id === itemId)?.quantity || 0;
            const q1 = getQty(itemConstants_1.ITEMS.PILL_BREAK_MINOR_1);
            const q2 = getQty(itemConstants_1.ITEMS.PILL_BREAK_MINOR_2);
            const q3 = getQty(itemConstants_1.ITEMS.PILL_BREAK_MINOR_3);
            const bequanCost = user.level * 200;
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [
                (0, v2Components_1.header)(`🌟 Chuẩn Bị Đột Phá: ${fullName}`),
                (0, v2Components_1.body)(`Đạo hữu đã tích đủ linh khí, có thể thử nghiệm trùng kích bình cảnh để lên **Tầng ${minorLevel + 1}**.\n\n` +
                    `🌿 **Tu Vi hiện có:** **${user.tu_vi}/${user.exp_needed}**\n` +
                    `${(0, constants_1.getProgressBar)(user.tu_vi, user.exp_needed, 10)}\n\n` +
                    `📈 **Tỷ lệ đột phá thành công:** **${totalRate.toFixed(1)}%**\n` +
                    `${(0, constants_1.getProgressBar)(totalRate, 100, 10)}\n\n` +
                    `⚠️ **Rủi ro:** Nếu đột phá thất bại sẽ tổn hao **15% Tu Vi** hiện tại.\n\n` +
                    `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanCost}** Linh Thạch Hạ Phẩm để đảm bảo đột phá 100% thành công.\n\n` +
                    `Đạo hữu muốn dùng đan dược hay Bế Quan Đột Phá?`),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)('Nhấn nút bên dưới để tiến hành đột phá'),
            ]);
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
            await interaction.editReply((0, uiSystem_1.toV2Payload)([comp], [row]));
        }
        else {
            // Đột phá cảnh giới lớn -> Nghênh tiếp Lôi Kiếp
            const bolts = 3 + majorIndex * 2;
            const damage = Math.round(20 + majorIndex * 15);
            const stats = InventoryService_1.inventoryService.getActiveStats(userId);
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
            const getQty = (itemId) => inv.find(i => i.item_id === itemId)?.quantity || 0;
            const antiLoiQty = getQty(itemConstants_1.ITEMS.PILL_ALCHEMY_ANTI_LOI);
            const hp1Qty = getQty(itemConstants_1.ITEMS.PILL_HP_1);
            const hp2Qty = getQty(itemConstants_1.ITEMS.PILL_HP_2);
            const tiLoiQty = getQty(itemConstants_1.ITEMS.TALISMAN_ANTI_LOI);
            const oncomingKiep = TribulationService_1.tribulationService.getOncomingKiepInfo(userId);
            const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
            const bequanMajorCost = user.level * 1000;
            const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
            const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
            const comp2 = (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
                (0, v2Components_1.header)(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`),
                (0, v2Components_1.body)(`Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân kéo tới dồn dập!\n\n• Cảnh giới lớn đột phá: **${fullName}**\n• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp**\n• Uy lực ước tính: **~${damage}** sát thương mỗi đạo\n\n❤️ HP: **${hpText}** | MP: **${mpText}**\n\n💎 **Bế Quan:** **${bequanMajorCost}** Linh Thạch để bỏ qua lôi kiếp.`),
            ]);
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`loi_start_${userId}`)
                .setLabel('⚡ Nghênh Tiếp Lôi Kiếp!')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`dotpha_bequan_${userId}`)
                .setLabel(`Bế Quan (${bequanMajorCost} LThạch)`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(user.coin_ha_pham < bequanMajorCost));
            await interaction.editReply((0, uiSystem_1.toV2Payload)([comp2], [row]));
        }
    }
}
exports.default = DotPhaCommand;
