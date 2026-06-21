"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const SystemConfigService_1 = require("../../services/SystemConfigService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
// Ánh xạ item_id → giá mua lại từ người chơi (50% giá gốc)
const NPC_BUYBACK_PRICES = {
    // Đan dược cơ bản
    'pill_hp_1': { price: 7 },
    'pill_hp_2': { price: 25 },
    'pill_tu_vi_low': { price: 25 },
    'pill_break_1': { price: 150 },
    'pill_break_minor_1': { price: 40 },
    'pill_break_minor_2': { price: 75 },
    'pill_break_minor_3': { price: 200 },
    'pill_stamina_1': { price: 100 },
    'pill_stamina_2': { price: 250 },
    'pill_stamina_3': { price: 600 },
    // Bùa chú
    'talisman_anti_loi': { price: 125 },
    'talisman_speed_1': { price: 12 },
    // Hạt giống
    'seed_linh_thao_1': { price: 2 },
    'seed_nhan_sam_1': { price: 7 },
    'seed_tuyet_lien': { price: 150 },
    'seed_lingzhi': { price: 250 },
    'seed_ngodong': { price: 400 },
    // Luyện khí
    'cauldron_low': { price: 250 },
    'cauldron_mid': { price: 1000 },
    'cauldron_high': { price: 5000 },
    // Rương
    'lucky_chest': { price: 50 },
    'server_raid_chest': { price: 5, currency: 'knb' },
    // Đạo lữ
    'item_tam_sinh_thach': { price: 2500 },
    'item_tuyet_tinh_nuoc': { price: 1000 },
    // Nguyên liệu
    'material_iron_1': { price: 5 },
    'mat_huyen_thiet': { price: 15 },
    'item_fragment': { price: 100 },
};
class ThanhLyCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('thanhly')
            .setDescription('Thanh lý vật phẩm cho NPC để lấy Linh Thạch (50% giá gốc).')
            .addSubcommand(sub => sub
            .setName('item')
            .setDescription('Bán một vật phẩm từ hành trang.')
            .addIntegerOption(opt => opt.setName('inventory_id')
            .setDescription('Mã hành trang của vật phẩm (xem trong /tuido)')
            .setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong')
            .setDescription('Số lượng (mặc định 1)')
            .setRequired(false)))
            .addSubcommand(sub => sub
            .setName('danhsach')
            .setDescription('Xem danh sách vật phẩm NPC thu mua và giá.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'danhsach') {
            await this.handleDanhSach(interaction);
            return;
        }
        if (sub === 'item') {
            const invId = interaction.options.getInteger('inventory_id', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            if (qty <= 0) {
                await interaction.reply({ content: '❌ Số lượng không hợp lệ!', ephemeral: true });
                return;
            }
            const inv = InventoryRepository_1.inventoryRepository.get(invId);
            if (!inv || inv.user_id !== userId) {
                await interaction.reply({ content: '❌ Vật phẩm không tồn tại trong hành trang của bạn!', ephemeral: true });
                return;
            }
            if (inv.is_equipped === 1) {
                await interaction.reply({ content: '❌ Vật phẩm đang trang bị không thể bán!', ephemeral: true });
                return;
            }
            if (inv.quantity < qty) {
                await interaction.reply({ content: `❌ Bạn chỉ có **${inv.quantity}** vật phẩm này trong hành trang!`, ephemeral: true });
                return;
            }
            const priceConfig = NPC_BUYBACK_PRICES[inv.item_id];
            if (!priceConfig) {
                await interaction.reply({ content: '❌ NPC không thu mua vật phẩm này!', ephemeral: true });
                return;
            }
            const totalPrice = priceConfig.price * qty;
            const now = Math.floor(Date.now() / 1000);
            database_1.default.transaction(() => {
                // Trừ vật phẩm
                inv.quantity -= qty;
                if (inv.quantity <= 0) {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(invId);
                }
                else {
                    database_1.default.prepare('UPDATE inventories SET quantity = ? WHERE id = ?').run(inv.quantity, invId);
                }
                // Cộng tiền
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalPrice });
                // Ghi audit log
                SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'sell_to_npc', {
                    itemId: inv.item_id,
                    quantity: qty,
                    price: totalPrice,
                    inventoryId: invId,
                });
            })();
            const itemName = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(inv.item_id);
            await interaction.reply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('🛒 BÁN CHO NPC THÀNH CÔNG')
                        .setColor('#2ecc71')
                        .setDescription(`Đã bán **${qty}x ${itemName?.name || inv.item_id}** cho NPC Thương Nhân.`)
                        .addFields({ name: '💰 Thu được', value: `**+${(0, constants_1.formatNumber)(totalPrice)}** Hạ Phẩm Linh Thạch`, inline: true }, { name: '💼 Số dư mới', value: `**${(0, constants_1.formatNumber)(user.coin_ha_pham + totalPrice)}** Linh Thạch`, inline: true })
                        .setTimestamp()
                ]
            });
        }
    }
    async handleDanhSach(interaction) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 NPC THU MUA VẬT PHẨM')
            .setColor('#e67e22')
            .setDescription('Bán vật phẩm cho NPC Thương Nhân để nhận **50%** giá gốc.')
            .setTimestamp();
        const categorized = {};
        for (const [itemId, config] of Object.entries(NPC_BUYBACK_PRICES)) {
            const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(itemId);
            if (!item)
                continue;
            let cat = 'Khác';
            if (itemId.startsWith('pill_') || itemId.startsWith('potion_'))
                cat = '💊 Đan Dược';
            else if (itemId.startsWith('talisman_'))
                cat = '📜 Bùa Chú';
            else if (itemId.startsWith('seed_'))
                cat = '🌾 Hạt Giống';
            else if (itemId.startsWith('cauldron_'))
                cat = '🔥 Luyện Khí';
            else if (itemId.startsWith('lucky_') || itemId.startsWith('chest_') || itemId.startsWith('server_'))
                cat = '🎁 Rương';
            else if (itemId.startsWith('item_'))
                cat = '💍 Vật Phẩm Đặc Biệt';
            else if (itemId.startsWith('material_') || itemId.startsWith('mat_'))
                cat = '⛏️ Nguyên Liệu';
            if (!categorized[cat])
                categorized[cat] = [];
            categorized[cat].push({ id: itemId, name: item.name, price: config.price });
        }
        for (const [cat, items] of Object.entries(categorized)) {
            const value = items.map(i => `• **${i.name}** (\`${i.id}\`) → **${(0, constants_1.formatNumber)(i.price)}** LT`).join('\n');
            embed.addFields({ name: cat, value, inline: true });
        }
        await interaction.reply({ embeds: [embed] });
    }
}
exports.default = ThanhLyCommand;
