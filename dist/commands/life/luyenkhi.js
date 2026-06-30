"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLuyenKhiEmbed = getLuyenKhiEmbed;
exports.getLuyenKhiComponents = getLuyenKhiComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const BlacksmithService_1 = require("../../services/BlacksmithService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
class LuyenKhiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('luyenkhi')
            .setDescription('Mở phòng rèn đúc trang bị (Blacksmithing)'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const embed = getLuyenKhiEmbed(userId);
        if (!embed) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const components = getLuyenKhiComponents(userId);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
    }
}
exports.default = LuyenKhiCommand;
function getLuyenKhiEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user)
        return null;
    const anyUser = user;
    const level = anyUser.forging_level || 1;
    const exp = anyUser.forging_exp || 0;
    const expNeeded = level * 150;
    const expBar = (0, constants_1.getProgressBar)(exp, expNeeded, 10);
    const content = [
        (0, v2Components_1.header)('🛠️ PHÒNG RÈN ĐÚC (LUYỆN KHÍ SƯ)', `Đạo hiệu: **${user.name}**\nCảnh Giới Luyện Khí: **Cấp ${level} Luyện Khí Sư**\nTiến Độ EXP: ${expBar} **(${exp}/${expNeeded})**\n\n*Sử dụng khoáng thạch và linh thạch để rèn đúc trang bị, đạo bào, vũ khí siêu cấp. Hãy chọn một công thức rèn ở menu bên dưới!*`)
    ];
    const recipes = BlacksmithService_1.blacksmithService.getRecipes();
    const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
    const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);
    if (visibleRecipes.length === 0) {
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)('Chưa có công thức rèn nào phù hợp với cảnh giới của đạo hữu.'));
    }
    else {
        visibleRecipes.forEach(r => {
            const isLocked = user.level < r.minLevel;
            const title = `${isLocked ? '🔒' : '⚒️'} **${r.name}** ${isLocked ? `(Yêu cầu: Cấp độ ${r.minLevel})` : ''}`;
            const ingredientsText = r.ingredients
                .map(ing => {
                const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId);
                const entry = inv.find(i => i.item_id === ing.itemId && i.is_equipped === 0);
                const count = entry ? entry.quantity : 0;
                const hasEnough = count >= ing.quantity;
                return `  ${hasEnough ? '✅' : '❌'} ${item ? item.name : ing.itemId}: **${count}/${ing.quantity}**`;
            })
                .join('\n');
            const descText = `• Mô tả: *${r.description}*\n` +
                `• Chi phí: **${r.cost}** Linh Thạch │ **15** Thể Lực\n` +
                `• Nguyên liệu yêu cầu:\n${ingredientsText}`;
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`${title}\n${descText}`));
        });
    }
    content.push((0, v2Components_1.separator)());
    content.push((0, v2Components_1.body)(`*Thể lực hiện tại: **${user.stamina}/500** │ Linh Thạch: **${user.coin_ha_pham}***`));
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
}
function getLuyenKhiComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const rows = [];
    if (!user)
        return rows;
    const recipes = BlacksmithService_1.blacksmithService.getRecipes();
    const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);
    if (visibleRecipes.length > 0) {
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`luyenkhiselect_1_${userId}`)
            .setPlaceholder('🛠️ Chọn công thức rèn trang bị');
        for (const r of visibleRecipes) {
            const isLocked = user.level < r.minLevel;
            const labelStr = isLocked ? `[KHÓA] ${r.name}` : `[Cấp ${r.minLevel}] ${r.name}`;
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(labelStr)
                .setValue(r.id)
                .setDescription(`Tốn ${r.cost} LT & 15 Thể Lực.`));
        }
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
    }
    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(backRow);
    return rows;
}
