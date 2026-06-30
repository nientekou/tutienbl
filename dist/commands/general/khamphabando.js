"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const MapFragmentService_1 = require("../../services/MapFragmentService");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
const RARITY_EMOJI = {
    common: '🟤',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡',
};
class KhamPhaBanDoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('khamphabando')
            .setDescription('Hệ thống Mảnh Bản Đồ - Thu thập 5 mảnh để ghép thành kho báu.')
            .addSubcommand(sub => sub
            .setName('ghep')
            .setDescription('Ghép 5 Mảnh Bản Đồ để tạo ra một vị trí kho báu.'))
            .addSubcommand(sub => sub
            .setName('den')
            .setDescription('Đến vị trí kho báu để khai thác.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID của kho báu').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('cuop')
            .setDescription('Cướp kho báu của người chơi khác.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID của kho báu').setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Dùng `/taonhanvat` để bắt đầu.' });
            return;
        }
        const subcmd = interaction.options.getSubcommand(false);
        if (!subcmd) {
            await this.showStatus(interaction, userId);
            return;
        }
        if (subcmd === 'ghep') {
            await this.handleCombine(interaction, userId);
        }
        else if (subcmd === 'den') {
            await this.handleClaim(interaction, userId);
        }
        else if (subcmd === 'cuop') {
            await this.handleSteal(interaction, userId);
        }
    }
    async showStatus(interaction, userId) {
        const fragmentCount = MapFragmentService_1.mapFragmentService.getFragmentCount(userId);
        const activeLocations = MapFragmentService_1.mapFragmentService.getActiveLocations(userId);
        const content = [
            (0, v2Components_1.header)('🗺️ MẢNH BẢN ĐỒ', 'Đạo hữu thu thập Mảnh Bản Đồ qua công việc Phiêu Lưu (/lamviec adventure) và ghép chúng để tìm kiếm bảo tạng.'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(`**Mảnh Bản Đồ hiện có:** **${fragmentCount}/5**\n` +
                `*Ghép đủ 5 mảnh để khám phá vị trí kho báu hoang dã!*\n\n` +
                `**Hướng dẫn:**\n` +
                `• \`/khamphabando ghep\` - Ghép 5 mảnh thành kho báu\n` +
                `• \`/khamphabando den [id]\` - Đến khai thác kho báu\n` +
                `• \`/khamphabando cuop [id]\` - Cướp kho báu của người khác`)
        ];
        if (fragmentCount > 0) {
            const barLength = 10;
            const filled = Math.round((fragmentCount / 5) * barLength);
            const bar = '■'.repeat(filled) + '□'.repeat(Math.max(0, barLength - filled));
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`📊 **Tiến Trình:** \`${bar}\` **${fragmentCount}/5**`));
        }
        if (activeLocations.length > 0) {
            const locationList = activeLocations.map(loc => {
                const remaining = Math.max(0, loc.expires_at - Math.floor(Date.now() / 1000));
                const hours = Math.floor(remaining / 3600);
                const mins = Math.floor((remaining % 3600) / 60);
                const emoji = RARITY_EMOJI[loc.rarity] || '📦';
                return `**#${loc.id}** ${emoji} **${loc.location_name}** [${loc.coord_x}, ${loc.coord_y}]\n└ ⏳ Còn **${hours}g ${mins}p** │ ${loc.rarity.toUpperCase()}`;
            }).join('\n');
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`📍 **Kho Báu Của Đạo Hữu (${activeLocations.length}):**\n${locationList}`));
        }
        const allLocations = MapFragmentService_1.mapFragmentService.getAllActiveLocations().filter(l => l.owner_id !== userId);
        if (allLocations.length > 0) {
            const stealTargets = allLocations.slice(0, 5).map(loc => {
                const emoji = RARITY_EMOJI[loc.rarity] || '📦';
                return `**#${loc.id}** ${emoji} **${loc.location_name}** │ Chủ: <@${loc.owner_id}>`;
            }).join('\n');
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`👀 **Kho Báu Có Thể Cướp (${allLocations.length}):**\n${stealTargets}\n\n*Dùng \`/khamphabando cuop [id]\` để cướp!*`));
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`*Mảnh Bản Đồ có thể nhận ngẫu nhiên từ hoạt động Phiêu Lưu.*`));
        const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
    async handleCombine(interaction, userId) {
        const result = MapFragmentService_1.mapFragmentService.combineFragments(userId);
        await interaction.editReply({ content: result.message });
    }
    async handleClaim(interaction, userId) {
        const locationId = interaction.options.getInteger('id', true);
        const result = MapFragmentService_1.mapFragmentService.claimLocation(userId, locationId);
        const embed = (0, v2Components_1.container)(result.success ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)(result.success ? '🎉 Khai Thác Kho Báu Thành Công' : '❌ Khai Thác Thất Bại'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(result.message)
        ]);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
    async handleSteal(interaction, userId) {
        const locationId = interaction.options.getInteger('id', true);
        const result = MapFragmentService_1.mapFragmentService.stealLocation(userId, locationId);
        const embed = (0, v2Components_1.container)(result.success ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)(result.success ? '⚔️ Đoạt Bảo Thành Công' : '💢 Đoạt Bảo Thất Bại'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(result.message)
        ]);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = KhamPhaBanDoCommand;
