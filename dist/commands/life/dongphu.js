"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDongPhuEmbed = buildDongPhuEmbed;
exports.buildDongPhuComponents = buildDongPhuComponents;
exports.buildCaveEmbed = buildCaveEmbed;
exports.buildCaveComponents = buildCaveComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const CaveService_1 = require("../../services/CaveService");
const CaveEnhancementService_1 = require("../../services/CaveEnhancementService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const database_1 = __importDefault(require("../../database/database"));
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
const CAVE_RANKS = [
    'Bình Thường',
    'Phàm Nhân Động Phủ',
    'Linh Địa Động Phủ',
    'Tiên Gia Động Phủ',
    'Động Thiên Phúc Địa',
    'Vạn Thế Tiên Cung'
];
function buildDongPhuEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const cave = CaveService_1.caveService.getCave(userId);
    const springLvl = cave.spring_level || 1;
    const meridianLvl = cave.meridian_level || 0;
    const arrayLvl = cave.array_level || 0;
    const pending = CaveEnhancementService_1.caveEnhancementService.getPendingMeridianResources(userId);
    const nextSpringCost = CaveEnhancementService_1.caveEnhancementService.getUpgradeCost('spring', springLvl);
    const nextMeridianCost = CaveEnhancementService_1.caveEnhancementService.getUpgradeCost('meridian', meridianLvl);
    const nextArrayCost = CaveEnhancementService_1.caveEnhancementService.getUpgradeCost('array', arrayLvl);
    const rankName = CAVE_RANKS[Math.min(cave.level, CAVE_RANKS.length - 1)];
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
        (0, v2Components_1.header)(`🏰 ĐỘNG PHỦ TIÊN GIA — ${user.name}`, `*Nơi tụ hội linh khí thiên địa, bồi đắp căn cơ và khai thác tiên thạch tự nhiên của tu sĩ.*\n\n🏛️ Phẩm cấp Động Phủ: **Cấp ${cave.level} — ${rankName}**\n🟤 Linh Thạch hiện có: **${user.coin_ha_pham.toLocaleString()}** LT`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`🌊 **Linh Tuyền (Cấp ${springLvl}/10):**\n` +
            `• Hiệu quả: **+${(springLvl * 2)}%** EXP Tu Luyện Nhàn Rỗi.\n` +
            `• Lượt tắm hôm nay: **${cave.spring_available}** lượt.\n` +
            (springLvl < 10 ? `• Nâng cấp: **${nextSpringCost.lt.toLocaleString()}** LT + **${nextSpringCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`')),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`⚡ **Linh Mạch (Cấp ${meridianLvl}/10):**\n` +
            `• Hiệu quả: Tự sinh **+${(meridianLvl * 50)}** Linh Thạch / giờ.\n` +
            `• Tích lũy hiện tại: **${pending.amount.toLocaleString()}** Linh Thạch (Tích lũy ${pending.hours} giờ).\n` +
            (meridianLvl < 10 ? `• Nâng cấp: **${nextMeridianCost.lt.toLocaleString()}** LT + **${nextMeridianCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`')),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`🛡️ **Hộ Pháp Trận (Cấp ${arrayLvl}/10):**\n` +
            `• Hiệu quả: Giảm **-${(arrayLvl * 5)}%** sát thương Thiên Kiếp khi đột phá.\n` +
            (arrayLvl < 10 ? `• Nâng cấp: **${nextArrayCost.lt.toLocaleString()}** LT + **${nextArrayCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`')),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)('*Dùng các nút tương tác bên dưới để quản lý Động Phủ.*')
    ]);
}
function buildDongPhuComponents(userId) {
    const cave = CaveService_1.caveService.getCave(userId);
    const springLvl = cave.spring_level || 1;
    const meridianLvl = cave.meridian_level || 0;
    const arrayLvl = cave.array_level || 0;
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphu_spring_${userId}`)
        .setLabel('🌊 Tắm Linh Tuyền')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setDisabled(cave.spring_available <= 0), new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphu_harvest_${userId}`)
        .setLabel('🪙 Thu Hoạch Linh Mạch')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setDisabled(meridianLvl <= 0), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphu_up_spring_${userId}`)
        .setLabel('🔼 Nâng Linh Tuyền')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(springLvl >= 10), new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphu_up_meridian_${userId}`)
        .setLabel('🔼 Nâng Linh Mạch')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(meridianLvl >= 10), new discord_js_1.ButtonBuilder()
        .setCustomId(`dongphu_up_array_${userId}`)
        .setLabel('🔼 Nâng Hộ Pháp Trận')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(arrayLvl >= 10));
    return [row1, row2];
}
function buildCaveEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi', 'Đạo hữu chưa khởi tạo nhân vật.')
        ]);
    }
    const cave = CaveService_1.caveService.getCave(userId);
    let expBuff = 1;
    if (cave.level === 2)
        expBuff = 2;
    if (cave.level === 3)
        expBuff = 4;
    if (cave.level === 4)
        expBuff = 6;
    if (cave.level >= 5)
        expBuff = 10;
    let maxSpring = 1;
    if (cave.level === 2)
        maxSpring = 2;
    else if (cave.level === 3)
        maxSpring = 2;
    else if (cave.level === 4)
        maxSpring = 3;
    else if (cave.level >= 5)
        maxSpring = 3;
    const content = [
        (0, v2Components_1.header)(`🏔️ ĐỘNG PHỦ CÁ NHÂN — ${user.name}`, `Đây là không gian thiền định và hấp thụ tinh hoa linh khí của đạo hữu. Nâng cấp động phủ giúp tăng tốc độ hấp thu linh khí và số lần ngâm mình Linh Tuyền.\n\n• Cấp Động Phủ: Lv.${cave.level}/5\n• Hiệu Ứng Tu Luyện: +${expBuff}% Tu Vi khi Thiền Định\n• Linh Tuyền Hằng Ngày: 💧 **${cave.spring_available}/${maxSpring}** lượt hôm nay`)
    ];
    const nextLevel = cave.level + 1;
    const cost = CaveService_1.caveService.getUpgradeCost(cave.level);
    content.push((0, v2Components_1.separator)());
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
                const userItem = inv.find((i) => i.item_id === req.id && i.is_equipped === 0);
                const userQty = userItem ? userItem.quantity : 0;
                const hasEnough = userQty >= req.quantity;
                upgradeReqText += `  ${hasEnough ? '✅' : '❌'} ${name}: **${userQty}/${req.quantity}**\n`;
            });
        }
        else {
            upgradeReqText += `• Không yêu cầu nguyên liệu đặc biệt.\n`;
        }
        content.push((0, v2Components_1.body)(`⬆️ **Yêu Cầu Nâng Cấp Động Phủ (Lên Cấp ${nextLevel}):**\n${upgradeReqText}`));
    }
    else {
        content.push((0, v2Components_1.body)(`⬆️ **Yêu Cầu Nâng Cấp:**\n🎉 **Động Phủ đã đạt cấp tối đa (Cấp 5)!** Linh khí sung túc, tịnh thất tối cao.`));
    }
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.success, content);
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
        .setDisabled(!cost), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    return [row];
}
class DongPhuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dongphu')
            .setDescription('Quản lý Động Phủ Tiên Gia, khai thác tài nguyên và ngâm Linh Tuyền.')
            .addSubcommand(sub => sub.setName('trangthai')
            .setDescription('Xem trạng thái, bố cục và cấp độ các công trình trong Động Phủ.'))
            .addSubcommand(sub => sub.setName('thuhoach')
            .setDescription('Thu hoạch Linh Thạch ngưng tụ từ Linh Mạch.'))
            .addSubcommand(sub => sub.setName('nangcap')
            .setDescription('Thăng cấp công trình trong Động Phủ.')
            .addStringOption(opt => opt.setName('congtrinh')
            .setDescription('Chọn công trình muốn thăng cấp.')
            .setRequired(true)
            .addChoices({ name: '🌊 Linh Tuyền', value: 'spring' }, { name: '⚡ Linh Mạch', value: 'meridian' }, { name: '🛡️ Hộ Pháp Trận', value: 'array' }))));
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
        const sub = interaction.options.getSubcommand();
        if (sub === 'trangthai') {
            const embed = buildDongPhuEmbed(discordId);
            const components = buildDongPhuComponents(discordId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
        }
        else if (sub === 'thuhoach') {
            const result = CaveEnhancementService_1.caveEnhancementService.claimMeridianResources(discordId);
            if (result.success) {
                await interaction.editReply({ content: result.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }
        else if (sub === 'nangcap') {
            const building = interaction.options.getString('congtrinh', true);
            const result = CaveEnhancementService_1.caveEnhancementService.upgradeBuilding(discordId, building);
            if (result.success) {
                await interaction.editReply({ content: result.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }
    }
}
exports.default = DongPhuCommand;
