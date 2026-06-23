"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const EquipmentService_1 = require("../../services/EquipmentService");
class TrangBiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('trangbi')
            .setDescription('Quản lý trang bị: Giám định, Phân giải, Nâng sao, Ghép.')
            .addSubcommand(sub => sub
            .setName('giamdinh')
            .setDescription('Giám định phôi rèn đúc thành trang bị thực tế (phí 50 Linh thạch).')
            .addIntegerOption(opt => opt
            .setName('inventory_id')
            .setDescription('ID vật phẩm trong hành trang cần giám định.')
            .setRequired(true))
            .addIntegerOption(opt => opt
            .setName('soluong')
            .setDescription('Số lượng phôi muốn giám định.')
            .setRequired(false)))
            .addSubcommand(sub => sub
            .setName('giamdinhhangloat')
            .setDescription('Giám định toàn bộ phôi trong hành trang (phí 50 Linh thạch/phôi).'))
            .addSubcommand(sub => sub
            .setName('phangiai')
            .setDescription('Phân giải trang bị không dùng để lấy Mảnh Trang Bị.')
            .addIntegerOption(opt => opt
            .setName('inventory_id')
            .setDescription('ID vật phẩm trong hành trang cần phân giải.')
            .setRequired(true))
            .addIntegerOption(opt => opt
            .setName('soluong')
            .setDescription('Số lượng trang bị muốn phân giải (mặc định là 1).')
            .setRequired(false)))
            .addSubcommand(sub => sub
            .setName('nangsao')
            .setDescription('Sử dụng Mảnh Trang Bị để nâng cấp sao cho trang bị (+20% chỉ số mỗi sao, max 5 sao).')
            .addIntegerOption(opt => opt
            .setName('inventory_id')
            .setDescription('ID vật phẩm trong hành trang muốn nâng sao.')
            .setRequired(true)))
            .addSubcommand(sub => sub
            .setName('ghep')
            .setDescription('Ghép Mảnh Trang Bị thành trang bị thần phẩm phẩm chất S/SS/SSS.')
            .addStringOption(opt => opt
            .setName('rarity')
            .setDescription('Phẩm chất muốn ghép (S - 100 mảnh, SS - 300 mảnh, SSS - 1000 mảnh).')
            .setRequired(true)
            .addChoices({ name: 'Phẩm S (100 Mảnh)', value: 'S' }, { name: 'Phẩm SS (300 Mảnh)', value: 'SS' }, { name: 'Phẩm SSS (1000 Mảnh)', value: 'SSS' })))
            .addSubcommand(sub => sub
            .setName('phangiaihangloat')
            .setDescription('Phân giải hàng loạt trang bị chưa đeo và không bản mệnh theo phẩm chất chỉ định trở xuống.')
            .addStringOption(opt => opt
            .setName('rarity')
            .setDescription('Phẩm chất cao nhất muốn phân giải (ví dụ: rare).')
            .setRequired(true)
            .addChoices({ name: 'Common (Phẩm Thường)', value: 'common' }, { name: 'Uncommon (Phẩm Nhã)', value: 'uncommon' }, { name: 'Rare (Phẩm Tốt)', value: 'rare' }, { name: 'Epic (Phẩm Kỷ Vật)', value: 'epic' }, { name: 'Legendary (Phẩm Truyền Thuyết)', value: 'legendary' }))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'giamdinh') {
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            const invItem = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invItem || invItem.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const res = EquipmentService_1.equipmentService.appraisePhoi(userId, invItem.id, qty);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
        if (sub === 'giamdinhhangloat') {
            const res = EquipmentService_1.equipmentService.appraisePhoiBulk(userId);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
        if (sub === 'phangiai') {
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            const invItem = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invItem || invItem.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const res = EquipmentService_1.equipmentService.salvageEquipment(userId, invItem.id, qty);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
        if (sub === 'nangsao') {
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const invItem = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invItem || invItem.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const res = EquipmentService_1.equipmentService.upgradeStars(userId, invItem.id);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
        if (sub === 'ghep') {
            const rarity = interaction.options.getString('rarity', true);
            const res = EquipmentService_1.equipmentService.craftEquipment(userId, rarity);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
        if (sub === 'phangiaihangloat') {
            const rarity = interaction.options.getString('rarity', true);
            const res = EquipmentService_1.equipmentService.salvageEquipmentBulk(userId, rarity);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ Thất bại: ${res.message}` });
            }
            return;
        }
    }
}
exports.default = TrangBiCommand;
