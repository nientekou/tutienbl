"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const EnhanceService_1 = require("../../services/EnhanceService");
const itemConstants_1 = require("../../config/itemConstants");
const v2Components_1 = require("../../utils/v2Components");
const uiSystem_1 = require("../../utils/uiSystem");
class CuongHuaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('cuonghoa')
            .setDescription('Cường hóa trang bị để gia tăng thuộc tính cơ bản (+1 đến +15).'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Vui lòng dùng `/taonhanvat`!' });
            return;
        }
        const inventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const equipableItems = inventory.filter(i => i.equipable === 1 && i.type === 'equipment');
        if (equipableItems.length === 0) {
            await interaction.editReply({
                content: '❌ Đạo hữu không sở hữu trang bị nào trong hành trang có thể cường hóa!'
            });
            return;
        }
        const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
            (0, v2Components_1.header)('✨ THẦN THIẾT CỰC DIÊN — ĐẠI TRẬN CƯỜNG HÓA'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(`Chào mừng đạo hữu **${user.name}** đến với Đại Trận Cường Hóa!\n\n` +
                `🧘 **Quy tắc cường hóa:**\n` +
                `• **+1 đến +5**: Tỷ lệ thành công **100%**.\n` +
                `• **+6 đến +10**: Tỷ lệ thành công **50%**, thất bại không rớt cấp.\n` +
                `• **+11 đến +15**: Tỷ lệ thành công **25%**, thất bại **BỊ RỚT 1 CẤP**.\n\n` +
                `*Vui lòng chọn trang bị muốn cường hóa từ danh sách bên dưới:*\n\n` +
                `_Tiêu tốn Mảnh Tinh Thạch & Hạ Phẩm Linh Thạch._`)
        ]);
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`enhance_select_${userId}`)
            .setPlaceholder('Chọn trang bị để cường hóa...');
        // Lấy tối đa 25 trang bị để tránh giới hạn Option của Discord Select Menu
        equipableItems.slice(0, 25).forEach(item => {
            const isEquippedText = item.is_equipped === 1 ? ' [Đang mặc]' : '';
            const enhanceText = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
            const starText = item.stars > 0 ? ` ⭐${item.stars}` : '';
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(`${item.name}${enhanceText}${starText}${isEquippedText}`)
                .setDescription(`Cấp: ${item.enhance_level || 0} | ID: ${item.id}`)
                .setValue(item.id.toString()));
        });
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await (0, uiSystem_1.safeV2EditReply)(interaction, [comp], [row]);
    }
    /**
     * Tạo giao diện xem trước thông tin cường hóa của trang bị cụ thể
     */
    static buildEnhancePreview(userId, inventoryId, lastResult) {
        const user = UserRepository_1.userRepository.get(userId);
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        const currentLevel = item.enhance_level || 0;
        // Tìm Mảnh Tinh Thạch trong hành trang
        const userInventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const shardItem = userInventory.find(i => i.item_id === itemConstants_1.ITEMS.TINH_THACH_SHARD);
        const shardQty = shardItem ? shardItem.quantity : 0;
        let resultHeader = '';
        if (lastResult) {
            const bannerEmoji = lastResult.success ? '🟢' : '🔴';
            const cleanMessage = lastResult.message.replace(/\\n/g, '\n');
            resultHeader = `${bannerEmoji} **KẾT QUẢ CƯỜNG HÓA VỪA QUA:**\n${cleanMessage}\n\n`;
        }
        const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`enhance_cancel_${userId}`)
            .setLabel('🔙 Quay Lại')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        if (currentLevel >= 15) {
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
                (0, v2Components_1.header)(`✨ CƯỜNG HÓA TRANG BỊ: ${item.name} (+15)`),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)(resultHeader +
                    `🎉 Trang bị này đã đạt cấp cường hóa tối đa **+15**! Đại trận đã viên mãn, không thể gia trì thêm.`)
            ]);
            return { embed: comp, rows: [backRow] };
        }
        const cfg = EnhanceService_1.enhanceService.getEnhanceConfig(currentLevel);
        const nextLevel = currentLevel + 1;
        const successRatePct = Math.round(cfg.successRate * 100);
        const baseStats = JSON.parse(item.base_stats || '{}');
        const statUpdates = [];
        const statsToPrint = ['hp', 'mp', 'atk', 'def', 'speed', 'crit', 'dodge', 'luck'];
        const starMult = 1 + (item.stars || 0) * 0.20;
        for (const stat of statsToPrint) {
            if (baseStats[stat]) {
                const curVal = Math.round(baseStats[stat] * starMult * (1 + currentLevel * 0.1));
                const nextVal = Math.round(baseStats[stat] * starMult * (1 + nextLevel * 0.1));
                let statName = stat.toUpperCase();
                if (stat === 'hp')
                    statName = 'Máu (HP)';
                if (stat === 'mp')
                    statName = 'Chân Khí (MP)';
                if (stat === 'atk')
                    statName = 'Công Kích (ATK)';
                if (stat === 'def')
                    statName = 'Phòng Thủ (DEF)';
                if (stat === 'speed')
                    statName = 'Thân Pháp (SPEED)';
                if (stat === 'crit')
                    statName = 'Bạo Kích (CRIT)';
                if (stat === 'dodge')
                    statName = 'Né Tránh (DODGE)';
                if (stat === 'luck')
                    statName = 'May Mắn (LUCK)';
                statUpdates.push(`• **${statName}**: ${curVal} ➔ **${nextVal}** *(+10% chỉ số gốc)*`);
            }
        }
        const hasShard = shardQty >= cfg.costShards;
        const hasCoin = user.coin_ha_pham >= cfg.costLinhThach;
        const accentColor = lastResult ? (lastResult.success ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger) : (cfg.dropOnFail ? v2Components_1.V2_COLORS.danger : v2Components_1.V2_COLORS.info);
        const comp = (0, v2Components_1.container)(accentColor, [
            (0, v2Components_1.header)(`✨ ĐĂNG LÂM ĐẠI TRẬN: +${currentLevel} ➔ +${nextLevel}`),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(resultHeader +
                `Trang bị: **${item.name}**\n` +
                `Cấp độ hiện tại: **+${currentLevel}**\n` +
                `Cấp độ tiếp theo: **+${nextLevel}**\n\n` +
                `📊 **Thuộc Tính Thay Đổi:**\n${statUpdates.join('\n') || '• Không có thuộc tính cơ bản.'}\n\n` +
                `━━━ **ĐIỀU KIỆN CƯỜNG HÓA** ━━━\n` +
                `• Tỷ lệ thành công: **${successRatePct}%**\n` +
                `• Hao tốn Linh Thạch: ${hasCoin ? '✅' : '❌'} **${cfg.costLinhThach}** LT (Hiện có: ${user.coin_ha_pham} LT)\n` +
                `• Hao tốn Tinh Thạch: ${hasShard ? '✅' : '❌'} **${cfg.costShards}** Mảnh (Hiện có: ${shardQty} Mảnh)\n\n` +
                `⚠️ **Rủi ro thất bại:** ${cfg.dropOnFail ? '🚨 **BỊ RỚT 1 CẤP (Về +10)**' : '🛡️ **Giữ nguyên cấp độ**'}\n\n` +
                `_Nhấn nút Cường Hóa phía dưới để tiến hành gia trì._`)
        ]);
        const btnConfirm = new discord_js_1.ButtonBuilder()
            .setCustomId(`enhance_confirm_${inventoryId}_${userId}`)
            .setLabel('✨ Cường Hóa')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setDisabled(!hasShard || !hasCoin);
        const btnCancel = new discord_js_1.ButtonBuilder()
            .setCustomId(`enhance_cancel_${userId}`)
            .setLabel('❌ Hủy Bỏ')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const row = new discord_js_1.ActionRowBuilder().addComponents(btnConfirm, btnCancel);
        return { embed: comp, rows: [row] };
    }
}
exports.default = CuongHuaCommand;
