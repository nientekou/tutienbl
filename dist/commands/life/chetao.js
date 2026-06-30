"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCraftingEmbed = getCraftingEmbed;
exports.getCraftingComponents = getCraftingComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const CraftingService_1 = require("../../services/CraftingService");
const recipes_1 = require("../../config/recipes");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const database_1 = __importDefault(require("../../database/database"));
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
/**
 * Tạo V2 Container hiển thị Lò Chế Tạo
 */
function getCraftingEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi'),
            (0, v2Components_1.body)('Đạo hữu chưa khởi tạo nhân vật.')
        ]);
    }
    const queue = CraftingService_1.craftingService.getQueue(userId);
    const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
    const content = [
        (0, v2Components_1.header)(`🧪 Lò Luyện Đan & Rèn Khí - ${user.name}`, 'Luyện hóa linh thảo vạn năm, rèn đúc thần sa tinh thiết tạo nên đan dược nghịch thiên.'),
        (0, v2Components_1.separator)()
    ];
    // 1. Hiển thị danh mục công thức hiện có
    const recipeEntries = Object.entries(recipes_1.RECIPES);
    let recipesText = '';
    for (const [id, r] of recipeEntries) {
        const typeLabel = r.type === 'alchemy' ? '🔮 [Luyện Đan]' : '⚒️ [Rèn Khí]';
        const ingredientsText = r.ingredients
            .map(ing => {
            const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId);
            const entry = inv.find(i => i.item_id === ing.itemId);
            const count = entry ? entry.quantity : 0;
            return `${item ? item.name : ing.itemId} (x${ing.quantity}, có x${count})`;
        })
            .join('\n• ');
        recipesText += `🔹 **${r.name}** ${typeLabel}\n` +
            `  Cấp ${r.minLevel} │ ${r.duration}s │ ${r.cost} LThạch\n` +
            `  • ${ingredientsText}\n\n`;
    }
    content.push((0, v2Components_1.body)(`**📜 Thư Mục Công Thức**\n${recipesText || '*Chưa có công thức.*'}`));
    content.push((0, v2Components_1.separator)());
    // 2. Hiển thị hàng chờ luyện lò hiện tại
    let queueText = '';
    if (queue.length > 0) {
        queue.forEach((item, index) => {
            if (item.status === 'completed') {
                queueText += `${index + 1}. ✨ **${item.recipeName}** (Hoàn thành - Chờ thu lò!)\n`;
            }
            else {
                const min = Math.floor(item.timeRemaining / 60);
                const sec = item.timeRemaining % 60;
                queueText += `${index + 1}. 🧪 **${item.recipeName}** (Đang nấu... \`${min}m ${sec}s\` còn lại)\n`;
            }
        });
    }
    else {
        queueText = '*Lò luyện hiện tại nguội lạnh, không hoạt động.*';
    }
    content.push((0, v2Components_1.body)(`**🔥 Trạng Thái Hỏa Lò**\n${queueText}`));
    content.push((0, v2Components_1.separator)());
    content.push((0, v2Components_1.body)(`💼 Linh Thạch hiện có: 🟤 **${user.coin_ha_pham.toLocaleString()}** Linh Thạch Hạ Phẩm`));
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.primary, content);
}
/**
 * Tạo các Component lò chế tạo
 */
function getCraftingComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const queue = CraftingService_1.craftingService.getQueue(userId);
    const rows = [];
    if (!user)
        return rows;
    // 1. Dropdown chọn công thức để bắt đầu luyện chế
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`craftselect_${userId}`)
        .setPlaceholder('🧪 Chọn công thức để khởi hỏa luyện chế...');
    for (const [id, r] of Object.entries(recipes_1.RECIPES)) {
        const isLocked = user.level < r.minLevel;
        const typeLabel = r.type === 'alchemy' ? 'Luyện Đan' : 'Rèn Khí';
        const label = isLocked ? `[🔒 Khóa] ${r.name} (${typeLabel})` : `${r.name} (${typeLabel})`;
        selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setDescription(`Phí: ${r.cost} LThạch | Yêu cầu cấp ${r.minLevel}`)
            .setValue(r.id));
    }
    rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
    // 2. Nút Thu lò và nút Làm mới
    const hasCompleted = queue.some(item => item.status === 'completed');
    const btnRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`craftclaim_${userId}`)
        .setLabel('✨ Thu Hoạch Thành Phẩm (Thu Lò)')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setDisabled(!hasCompleted), new discord_js_1.ButtonBuilder()
        .setCustomId(`craftrefresh_${userId}`)
        .setLabel('🔄 Làm Mới Lò')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(btnRow);
    return rows;
}
class CheTaoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('chetao')
            .setDescription('Mở Lò Luyện Đan và Rèn Khí để chế tạo vật phẩm.'));
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
        const embed = getCraftingEmbed(userId);
        const components = getCraftingComponents(userId);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
    }
}
exports.default = CheTaoCommand;
