"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKhamPhaEmbed = getKhamPhaEmbed;
exports.getKhamPhaComponents = getKhamPhaComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const ExplorationService_1 = require("../../services/ExplorationService");
const uiSystem_1 = require("../../utils/uiSystem");
const constants_1 = require("../../utils/constants");
/**
 * Tạo Embed hiển thị bản đồ dã ngoại
 */
function getKhamPhaEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const active = ExplorationService_1.explorationService.getActiveExploration(userId);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🗺️ BẢN ĐỒ DÃ NGOẠI - KHÁM PHÁ TIÊN GIỚI')
        .setColor(uiSystem_1.EMBED_COLORS.ORANGE)
        .setTimestamp();
    if (active) {
        const now = Math.floor(Date.now() / 1000);
        const loc = ExplorationService_1.EXPLORATION_LOCATIONS[active.location_id];
        const remaining = Math.max(0, active.end_time - now);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const status = active.status === 'event_pending' ? '⚡ Đang chờ xử lý kỳ ngộ!' : `⏳ Còn **${mins}p ${secs}s** nữa trở về`;
        embed.setDescription(`Đạo hữu đang trên hành trình thám hiểm...\n\n` +
            `📍 **Điểm đến:** ${loc?.emoji || '🗺️'} **${loc?.name || active.location_id}**\n` +
            `${status}\n\n` +
            `*Sử dụng nút ✅ Về Lấy Thưởng khi hành trình hoàn thành.*`);
        return embed;
    }
    const realmInfo = user ? (0, constants_1.getRealmDetails)(user.level) : null;
    const stamina = user?.stamina || 0;
    embed.setDescription(`Ngoài cửa tông môn, thiên địa bao la chứa đựng vô số cơ duyên đang chờ đợi đạo hữu khám phá!\n\n` +
        `🧘 **Thể Lực hiện có:** **${stamina}/500**\n` +
        `🏔️ **Cảnh giới:** ${realmInfo?.fullName || 'Không xác định'}\n\n` +
        `*Chọn địa điểm muốn thám hiểm từ các nút bên dưới.*`);
    // Liệt kê các địa điểm
    for (const loc of Object.values(ExplorationService_1.EXPLORATION_LOCATIONS)) {
        const canExplore = (user?.level || 0) >= loc.minLevel && stamina >= loc.staminaCost;
        const lockText = (user?.level || 0) < loc.minLevel
            ? ` 🔒 *(Yêu cầu cảnh giới ${loc.minLevel})*`
            : !canExplore ? ` *(Không đủ thể lực)*` : '';
        const timeText = `${Math.floor(loc.travelTime / 60)} phút`;
        embed.addFields({
            name: `${loc.emoji} ${loc.name}${lockText}`,
            value: `${loc.description}\n⏳ **${timeText}** | 🧘 **-${loc.staminaCost}** Thể Lực | ☠️ Rủi ro: **${Math.round(loc.dangerRate * 100)}%**`,
            inline: false
        });
    }
    embed.setFooter({ text: 'Mỗi hành trình chỉ có thể thực hiện một địa điểm. Thể Lực hồi phục tự động theo thời gian.' });
    return embed;
}
/**
 * Tạo các Components nút bấm cho Bản Đồ
 */
function getKhamPhaComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const active = ExplorationService_1.explorationService.getActiveExploration(userId);
    const stamina = user?.stamina || 0;
    const level = user?.level || 1;
    const rows = [];
    if (active) {
        const now = Math.floor(Date.now() / 1000);
        const isReady = now >= active.end_time || active.status === 'event_pending';
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`khamphaclaim_${userId}`)
            .setLabel(active.status === 'event_pending' ? '⚡ Xử Lý Kỳ Ngộ' : '✅ Về Lấy Thưởng')
            .setStyle(isReady ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!isReady), new discord_js_1.ButtonBuilder()
            .setCustomId(`hosoback_${userId}`)
            .setLabel('🔙 Quay Lại Hồ Sơ')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        rows.push(row);
        return rows;
    }
    // Chia các địa điểm thành 2 hàng (max 5 nút mỗi hàng)
    const locs = Object.values(ExplorationService_1.EXPLORATION_LOCATIONS);
    const row1 = new discord_js_1.ActionRowBuilder();
    const row2 = new discord_js_1.ActionRowBuilder();
    locs.forEach((loc, i) => {
        const canExplore = level >= loc.minLevel && stamina >= loc.staminaCost;
        const btn = new discord_js_1.ButtonBuilder()
            .setCustomId(`khamphastart_${loc.id}_${userId}`)
            .setLabel(`${loc.emoji} ${loc.name}`)
            .setStyle(canExplore ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!canExplore);
        if (i < 3)
            row1.addComponents(btn);
        else
            row2.addComponents(btn);
    });
    if (row1.components.length > 0)
        rows.push(row1);
    if (row2.components.length > 0)
        rows.push(row2);
    // Back button in its own row (always, to avoid >5 buttons per row)
    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(backRow);
    return rows;
}
class KhamPhaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('khampha')
            .setDescription('Khám phá bản đồ dã ngoại, tìm kiếm cơ duyên và kỳ trân dị bảo.')
            .addSubcommand(sub => sub
            .setName('bando')
            .setDescription('Mở bản đồ dã ngoại để thám hiểm.'))
            .addSubcommand(sub => sub
            .setName('toado')
            .setDescription('Đào kho báu tại tọa độ chỉ định (Cần Tàng Bảo Đồ).')
            .addIntegerOption(opt => opt.setName('x').setDescription('Tọa độ X').setRequired(true))
            .addIntegerOption(opt => opt.setName('y').setDescription('Tọa độ Y').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('tangbaodo')
            .setDescription('Xem danh sách các Tàng Bảo Đồ đang sở hữu.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Dùng `/taonhanvat` để bắt đầu.' });
            return;
        }
        const subcmd = interaction.options.getSubcommand(false) || 'bando';
        if (subcmd === 'bando') {
            const embed = getKhamPhaEmbed(userId);
            const rows = getKhamPhaComponents(userId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], rows));
        }
        else if (subcmd === 'tangbaodo') {
            const { treasureMapService } = require('../../services/TreasureMapService');
            const maps = treasureMapService.getActiveMaps(userId);
            if (maps.length === 0) {
                await interaction.editReply({ content: '📜 Đạo hữu hiện không có Tàng Bảo Đồ nào chưa đào.' });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🗺️ Danh Sách Tàng Bảo Đồ')
                .setColor(uiSystem_1.EMBED_COLORS.GOLD)
                .setDescription('Danh sách các tọa độ kho báu đạo hữu đang nắm giữ:\n\n' +
                maps.map((m, i) => `**${i + 1}.** Tọa độ: **[X: ${m.coord_x}, Y: ${m.coord_y}]** (Độ hiếm: ${m.rarity.toUpperCase()})`).join('\n'))
                .setFooter({ text: 'Dùng lệnh /khampha toado [x] [y] để tiến hành đào!' });
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'toado') {
            const x = interaction.options.getInteger('x', true);
            const y = interaction.options.getInteger('y', true);
            const { treasureMapService } = require('../../services/TreasureMapService');
            const result = treasureMapService.digTreasure(userId, x, y);
            await interaction.editReply({ content: result.message });
        }
    }
}
exports.default = KhamPhaCommand;
