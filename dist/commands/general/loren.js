"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BlacksmithService_1 = require("../../services/BlacksmithService");
class LoRenCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('loren')
            .setDescription('Lò Rèn Tiên Giới - Tinh Luyện & Phân Rã Trang Bị')
            .addSubcommand(sub => sub.setName('phan-ra')
            .setDescription('Nung chảy trang bị rác để lấy Huyền Thiết')
            .addStringOption(opt => opt.setName('ids').setDescription('Danh sách Mã hành trang trang bị (VD: 12,34,56)').setRequired(true)))
            .addSubcommand(sub => sub.setName('tinh-luyen')
            .setDescription('Đập thăng sao trang bị (Tốn Huyền Thiết & Linh Thạch)')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm trong túi đồ').setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'phan-ra') {
            const idsStr = interaction.options.getString('ids', true);
            const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length === 0) {
                await interaction.reply({ content: '❌ Định dạng ID không hợp lệ. Ví dụ đúng: 12, 34, 56', ephemeral: true });
                return;
            }
            const result = BlacksmithService_1.blacksmithService.dismantleItem(userId, ids);
            await interaction.reply({ content: result.message });
        }
        else if (sub === 'tinh-luyen') {
            const invId = interaction.options.getInteger('inventory_id', true);
            const result = BlacksmithService_1.blacksmithService.refineItem(userId, invId);
            if (result.success) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🔨 Tinh Luyện Trang Bị')
                    .setColor('#f1c40f')
                    .setDescription(result.message)
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ content: result.message });
            }
        }
    }
}
exports.default = LoRenCommand;
