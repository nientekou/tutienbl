"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const BlacksmithService_1 = require("../../services/BlacksmithService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
class LuyenKhiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('luyenkhi')
            .setDescription('Mở phòng rèn đúc trang bị (Blacksmithing)'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const anyUser = user;
        const level = anyUser.forging_level || 1;
        const exp = anyUser.forging_exp || 0;
        const expNeeded = level * 150;
        const expBar = (0, constants_1.getProgressBar)(exp, expNeeded, 10);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🛠️ PHÒNG RÈN ĐÚC (LUYỆN KHÍ SƯ)')
            .setColor('#e67e22')
            .setDescription(`Đạo hiệu: **${user.name}**\n` +
            `Cảnh Giới Luyện Khí: **Cấp ${level} Luyện Khí Sư**\n` +
            `Tiến Trình EXP: ${expBar} **(${exp}/${expNeeded})**\n\n` +
            `*Sử dụng khoáng thạch và linh thạch để rèn đúc trang bị, đạo bào, vũ khí siêu cấp. Hãy chọn một công thức rèn ở menu bên dưới!*`)
            .setThumbnail('https://i.imgur.com/vHqAOYZ.png')
            .setFooter({ text: `Thể lực hiện tại: ${user.stamina}/500 | Linh Thạch: ${user.coin_ha_pham}` });
        const recipes = BlacksmithService_1.blacksmithService.getRecipes();
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        // Lọc công thức hiển thị được (cấp độ người chơi >= cấp công thức - 20)
        // Để không hiển thị quá nhiều
        const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);
        if (visibleRecipes.length === 0) {
            embed.addFields({ name: 'Trống', value: 'Chưa có công thức rèn nào phù hợp với cảnh giới của đạo hữu.' });
            await interaction.reply({ embeds: [embed] });
            return;
        }
        visibleRecipes.forEach(r => {
            const isLocked = user.level < r.minLevel;
            const title = `${isLocked ? '🔒' : '⚒️'} **${r.name}** ${isLocked ? `(Yêu cầu: Cấp độ ${r.minLevel})` : ''}`;
            const ingredientsText = r.ingredients
                .map(ing => {
                const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId);
                const entry = inv.find(i => i.item_id === ing.itemId && i.is_equipped === 0);
                const count = entry ? entry.quantity : 0;
                const hasEnough = count >= ing.quantity;
                return `${hasEnough ? '✅' : '❌'} ${item ? item.name : ing.itemId}: ${count}/${ing.quantity}`;
            })
                .join('\n');
            const descText = `• Mô tả: *${r.description}*\n` +
                `• Chi phí: **${r.cost}** Linh Thạch | **15** Thể Lực\n` +
                `• Nguyên liệu yêu cầu:\n${ingredientsText}`;
            embed.addFields({ name: title, value: descText, inline: false });
        });
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
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ embeds: [embed], components: [row] });
    }
}
exports.default = LuyenKhiCommand;
