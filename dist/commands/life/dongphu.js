"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCaveEmbed = buildCaveEmbed;
exports.buildCaveComponents = buildCaveComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const CaveService_1 = require("../../services/CaveService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const database_1 = __importDefault(require("../../database/database"));
function buildCaveEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor('#e74c3c')
            .setDescription('Đạo hữu chưa khởi tạo nhân vật.');
    }
    const cave = CaveService_1.caveService.getCave(userId);
    // Tính toán buff tu vi
    let expBuff = 1;
    if (cave.level === 2)
        expBuff = 2;
    if (cave.level === 3)
        expBuff = 4;
    if (cave.level === 4)
        expBuff = 6;
    if (cave.level >= 5)
        expBuff = 10;
    // Hồi phục Linh Tuyền tối đa hàng ngày để hiển thị thông tin
    let maxSpring = 1;
    if (cave.level === 2)
        maxSpring = 2;
    else if (cave.level === 3)
        maxSpring = 2;
    else if (cave.level === 4)
        maxSpring = 3;
    else if (cave.level >= 5)
        maxSpring = 3;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🏔️ ĐỘNG PHỦ CÁ NHÂN - ${user.name}`)
        .setDescription(`Đây là không gian thiền định và hấp thụ tinh hoa linh khí của đạo hữu. Nâng cấp động phủ giúp tăng tốc độ hấp thu linh khí và số lần ngâm mình Linh Tuyền.`)
        .setColor('#2ecc71')
        .setTimestamp();
    embed.addFields([
        { name: 'Cấp Động Phủ', value: `Lv.${cave.level}/5`, inline: true },
        { name: 'Hiệu Ứng Tu Luyện', value: `+${expBuff}% Tu Vi khi Thiền Định`, inline: true },
        { name: 'Linh Tuyền Hằng Ngày', value: `💧 **${cave.spring_available}/${maxSpring}** lượt hôm nay`, inline: true }
    ]);
    // Nâng Cấp Yêu Cầu
    const nextLevel = cave.level + 1;
    const cost = CaveService_1.caveService.getUpgradeCost(cave.level);
    if (cost) {
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        let upgradeReqText = '';
        if (cost.lt > 0)
            upgradeReqText += `• Chi phí: **${cost.lt}** Linh Thạch Hạ Phẩm (Đang có: **${user.coin_ha_pham}**)\n`;
        if (cost.knb > 0)
            upgradeReqText += `• Chi phí: **${cost.knb}** KNB (Đang có: **${user.knb}**)\n`;
        if (cost.reqItems.length > 0) {
            upgradeReqText += `• Nguyên liệu yêu cầu:\n`;
            cost.reqItems.forEach(req => {
                const itemInfo = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(req.id);
                const name = itemInfo ? itemInfo.name : req.id;
                const userItem = inv.find(i => i.item_id === req.id && i.is_equipped === 0);
                const userQty = userItem ? userItem.quantity : 0;
                const hasEnough = userQty >= req.quantity;
                upgradeReqText += `  ${hasEnough ? '✅' : '❌'} ${name}: **${userQty}/${req.quantity}**\n`;
            });
        }
        else {
            upgradeReqText += `• Không yêu cầu nguyên liệu đặc biệt.\n`;
        }
        embed.addFields({ name: `⬆️ Yêu Cầu Nâng Cấp Động Phủ (Lên Cấp ${nextLevel})`, value: upgradeReqText, inline: false });
    }
    else {
        embed.addFields({ name: `⬆️ Yêu Cầu Nâng Cấp`, value: `🎉 **Động Phủ đã đạt cấp tối đa (Cấp 5)!** Linh khí sung túc, tịnh thất chí cao.`, inline: false });
    }
    return embed;
}
function buildCaveComponents(userId) {
    const cave = CaveService_1.caveService.getCave(userId);
    const cost = CaveService_1.caveService.getUpgradeCost(cave.level);
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphuspring_${userId}`)
        .setLabel('🌊 Ngâm Linh Tuyền')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setDisabled(cave.spring_available <= 0), new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphuupgrade_${userId}`)
        .setLabel('⬆️ Nâng Cấp')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setDisabled(!cost));
    return [row];
}
class DongPhuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dongphu')
            .setDescription('Quản lý Động Phủ Cá Nhân của bạn.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật!' });
            return;
        }
        const embed = buildCaveEmbed(userId);
        const components = buildCaveComponents(userId);
        await interaction.editReply({ embeds: [embed], components });
    }
}
exports.default = DongPhuCommand;
