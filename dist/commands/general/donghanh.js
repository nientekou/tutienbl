"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const CompanionService_1 = require("../../services/CompanionService");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
class DongHanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('donghanh')
            .setDescription('Đồng Hành — Xem, trang bị và bồi dưỡng tâm linh')
            .addSubcommand(sub => sub.setName('list').setDescription('Xem danh sách Đồng Hành đã sở hữu'))
            .addSubcommand(sub => sub.setName('equip').setDescription('Trang bị một Đồng Hành')
            .addStringOption(opt => opt.setName('type').setDescription('Loại Đồng Hành').setRequired(true)
            .addChoices({ name: 'Hỏa Linh', value: 'hoa_linh' }, { name: 'Thủy Linh', value: 'thuy_linh' }, { name: 'Lôi Linh', value: 'loi_linh' }, { name: 'Phong Linh', value: 'phong_linh' })))
            .addSubcommand(sub => sub.setName('info').setDescription('Xem chi tiết Đồng Hành đang trang bị')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
            return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            const desc = CompanionService_1.companionService.getDescription(userId);
            const content = [
                (0, v2Components_1.header)('🐉 Đồng Hành Chi Lộ', 'Đồng hành tu tiên trợ chiến gia tăng công kích lực và hộ thân cường độ.'),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)(desc)
            ];
            const equipped = CompanionService_1.companionService.getEquipped(userId);
            if (equipped) {
                content.push((0, v2Components_1.separator)());
                content.push((0, v2Components_1.body)(`🛡️ **Đang xuất chiến:** ${equipped.name}`));
            }
            const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, content);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
            return;
        }
        if (subcommand === 'equip') {
            const type = interaction.options.getString('type', true);
            const result = CompanionService_1.companionService.equip(userId, type);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (subcommand === 'info') {
            const equipped = CompanionService_1.companionService.getEquipped(userId);
            if (!equipped) {
                await interaction.editReply({ content: '❌ Chưa trang bị Đồng Hành nào. Dùng `/donghanh list` để xem danh sách.' });
                return;
            }
            const passive = CompanionService_1.companionService.getCombatPassive(userId);
            const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
                (0, v2Components_1.header)(`🐉 Đồng Hành: ${equipped.name}`, `Hệ nguyên tố: **${equipped.element}**`),
                (0, v2Components_1.separator)(),
                (0, v2Components_1.body)(`• **Nội tại:** ${equipped.passiveDesc}\n` +
                    (passive ? `• **Giá trị cường độ hiện tại:** **${Math.round(passive.value * 100)}%**` : ''))
            ]);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = DongHanhCommand;
