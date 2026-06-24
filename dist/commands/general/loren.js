"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BlacksmithService_1 = require("../../services/BlacksmithService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const v2Components_1 = require("../../utils/v2Components");
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
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('ID vật phẩm trong hành trang').setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'phan-ra') {
            const idsStr = interaction.options.getString('ids', true);
            const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length === 0) {
                await interaction.editReply({ content: '❌ Định dạng ID không hợp lệ. Ví dụ đúng: 12, 34, 56' });
                return;
            }
            const result = BlacksmithService_1.blacksmithService.dismantleItem(userId, ids);
            await interaction.editReply({ content: result.message });
        }
        else if (sub === 'tinh-luyen') {
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const invRow = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invRow || invRow.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const result = BlacksmithService_1.blacksmithService.refineItem(userId, invRow.id);
            if (result.success) {
                const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [
                    (0, v2Components_1.header)('🔨 Tinh Luyện Trang Bị'),
                    (0, v2Components_1.body)(result.message),
                ]);
                await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
            }
            else {
                await interaction.editReply({ content: result.message });
            }
        }
    }
}
exports.default = LoRenCommand;
