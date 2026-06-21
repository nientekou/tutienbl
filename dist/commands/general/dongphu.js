"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDongPhuEmbed = buildDongPhuEmbed;
exports.buildDongPhuComponents = buildDongPhuComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const CaveService_1 = require("../../services/CaveService");
const CaveEnhancementService_1 = require("../../services/CaveEnhancementService");
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
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🏰 ĐỘNG PHỦ TIÊN GIA - ${user.name}`)
        .setColor('#1abc9c')
        .setDescription(`*Nơi tụ hội linh khí thiên địa, bồi đắp căn cơ và khai thác tiên thạch tự nhiên của tu sĩ.*\n\n` +
        `🏛️ **Phẩm cấp Động Phủ:** **Cấp ${cave.level} — ${rankName}**\n` +
        `🟤 **Linh Thạch hiện có:** **${user.coin_ha_pham.toLocaleString()}** LT\n`)
        .addFields({
        name: `🌊 Linh Tuyền (Cấp ${springLvl}/10)`,
        value: `• Hiệu quả: **+${(springLvl * 2)}%** EXP Tu Luyện Nhàn Rỗi.\n` +
            `• Lượt tắm hôm nay: **${cave.spring_available}** lượt.\n` +
            (springLvl < 10 ? `• Nâng cấp: **${nextSpringCost.lt.toLocaleString()}** LT + **${nextSpringCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
    }, {
        name: `⚡ Linh Mạch (Cấp ${meridianLvl}/10)`,
        value: `• Hiệu quả: Tự sinh **+${(meridianLvl * 50)}** Linh Thạch / giờ.\n` +
            `• Tích lũy hiện tại: **${pending.amount.toLocaleString()}** Linh Thạch (Tích lũy ${pending.hours} giờ).\n` +
            (meridianLvl < 10 ? `• Nâng cấp: **${nextMeridianCost.lt.toLocaleString()}** LT + **${nextMeridianCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
    }, {
        name: `🛡️ Hộ Pháp Trận (Cấp ${arrayLvl}/10)`,
        value: `• Hiệu quả: Giảm **-${(arrayLvl * 5)}%** sát thương Thiên Kiếp khi đột phá.\n` +
            (arrayLvl < 10 ? `• Nâng cấp: **${nextArrayCost.lt.toLocaleString()}** LT + **${nextArrayCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
    })
        .setFooter({ text: 'Dùng các nút tương tác bên dưới để quản lý Động Phủ.' })
        .setTimestamp();
    return embed;
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
        .setDisabled(meridianLvl <= 0));
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
            await interaction.reply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!',
                ephemeral: true
            });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'trangthai') {
            const embed = buildDongPhuEmbed(discordId);
            const components = buildDongPhuComponents(discordId);
            await interaction.reply({ embeds: [embed], components });
        }
        else if (sub === 'thuhoach') {
            const result = CaveEnhancementService_1.caveEnhancementService.claimMeridianResources(discordId);
            if (result.success) {
                await interaction.reply({ content: result.message });
            }
            else {
                await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            }
        }
        else if (sub === 'nangcap') {
            const building = interaction.options.getString('congtrinh', true);
            const result = CaveEnhancementService_1.caveEnhancementService.upgradeBuilding(discordId, building);
            if (result.success) {
                await interaction.reply({ content: result.message });
            }
            else {
                await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            }
        }
    }
}
exports.default = DongPhuCommand;
