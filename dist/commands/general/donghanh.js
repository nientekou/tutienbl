"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const CompanionService_1 = require("../../services/CompanionService");
const uiSystem_1 = require("../../utils/uiSystem");
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
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
            return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            const desc = CompanionService_1.companionService.getDescription(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🐉 Đồng Hành')
                .setColor(uiSystem_1.EMBED_COLORS.CAVE)
                .setDescription(desc)
                .setTimestamp();
            const equipped = CompanionService_1.companionService.getEquipped(userId);
            if (equipped) {
                embed.setFooter({ text: `Đang trang bị: ${equipped.name}` });
            }
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed]));
            return;
        }
        if (subcommand === 'equip') {
            const type = interaction.options.getString('type', true);
            const result = CompanionService_1.companionService.equip(userId, type);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (subcommand === 'info') {
            const equipped = CompanionService_1.companionService.getEquipped(userId);
            if (!equipped) {
                await interaction.reply({ content: '❌ Chưa trang bị Đồng Hành nào. Dùng `/donghanh list` để xem danh sách.', ephemeral: true });
                return;
            }
            const passive = CompanionService_1.companionService.getCombatPassive(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🐉 ${equipped.name}`)
                .setColor(uiSystem_1.EMBED_COLORS.CAVE)
                .setDescription(`**Hệ:** ${equipped.element}\n` +
                `**Passive:** ${equipped.passiveDesc}\n` +
                (passive ? `**Giá trị hiện tại:** ${Math.round(passive.value * 100)}%` : ''))
                .setTimestamp();
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = DongHanhCommand;
