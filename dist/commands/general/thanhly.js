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
const itemConstants_1 = require("../../config/itemConstants");
const uiSystem_1 = require("../../utils/uiSystem");
// Ánh xạ item_id → giá mua lại từ người chơi (50% giá gốc)
const NPC_BUYBACK_PRICES = {
    // Đan dược cơ bản
    [itemConstants_1.ITEMS.PILL_HP_1]: { price: 7 },
    [itemConstants_1.ITEMS.PILL_HP_2]: { price: 25 },
    [itemConstants_1.ITEMS.PILL_TU_VI_LOW]: { price: 25 },
    [itemConstants_1.ITEMS.PILL_BREAK_1]: { price: 150 },
    [itemConstants_1.ITEMS.PILL_BREAK_MINOR_1]: { price: 40 },
    [itemConstants_1.ITEMS.PILL_BREAK_MINOR_2]: { price: 75 },
    [itemConstants_1.ITEMS.PILL_BREAK_MINOR_3]: { price: 200 },
    [itemConstants_1.ITEMS.PILL_STAMINA_1]: { price: 100 },
    [itemConstants_1.ITEMS.PILL_STAMINA_2]: { price: 250 },
    [itemConstants_1.ITEMS.PILL_STAMINA_3]: { price: 600 },
    // Bùa chú
    [itemConstants_1.ITEMS.TALISMAN_ANTI_LOI]: { price: 125 },
    [itemConstants_1.ITEMS.TALISMAN_SPEED_1]: { price: 12 },
    // Hạt giống
    [itemConstants_1.ITEMS.SEED_LINH_THAO_1]: { price: 2 },
    [itemConstants_1.ITEMS.SEED_NHAN_SAM_1]: { price: 7 },
    [itemConstants_1.ITEMS.SEED_TUYET_LIEN]: { price: 150 },
    [itemConstants_1.ITEMS.SEED_LINGZHI]: { price: 250 },
    [itemConstants_1.ITEMS.SEED_NGODONG]: { price: 400 },
    // Luyện khí
    [itemConstants_1.ITEMS.CAULDRON_LOW]: { price: 250 },
    [itemConstants_1.ITEMS.CAULDRON_MID]: { price: 1000 },
    [itemConstants_1.ITEMS.CAULDRON_HIGH]: { price: 5000 },
    // Rương
    [itemConstants_1.ITEMS.LUCKY_CHEST]: { price: 50 },
    [itemConstants_1.ITEMS.SERVER_RAID_CHEST]: { price: 5, currency: 'knb' },
    // Đạo lữ
    [itemConstants_1.ITEMS.ITEM_TAM_SINH_THACH]: { price: 2500 },
    [itemConstants_1.ITEMS.ITEM_TUYET_TINH_NUOC]: { price: 1000 },
    // Hạt giống mới
    [itemConstants_1.ITEMS.SEED_BLOOD_FLOWER]: { price: 100 },
    [itemConstants_1.ITEMS.SEED_VOID_HERB]: { price: 150 },
    [itemConstants_1.ITEMS.SEED_WIND_LEAF]: { price: 150 },
    // Nguyên liệu
    [itemConstants_1.ITEMS.MATERIAL_IRON_1]: { price: 5 },
    [itemConstants_1.ITEMS.MAT_HUYEN_THIET]: { price: 15 },
    [itemConstants_1.ITEMS.ITEM_FRAGMENT]: { price: 100 },
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
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
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
                await interaction.editReply({ content: '❌ Số lượng không hợp lệ!' });
                return;
            }
            const inv = InventoryRepository_1.inventoryRepository.get(invId);
            if (!inv) {
                await interaction.editReply({ content: '❌ Vật phẩm không tồn tại trong hành trang của bạn!' });
                return;
            }
            if (inv.is_equipped === 1) {
                await interaction.editReply({ content: '❌ Vật phẩm đang trang bị không thể bán!' });
                return;
            }
            if (inv.quantity < qty) {
                await interaction.editReply({ content: `❌ Đạo hữu chỉ có **${inv.quantity}** vật phẩm này trong hành trang!` });
                return;
            }
            const priceConfig = NPC_BUYBACK_PRICES[inv.item_id];
            if (!priceConfig) {
                await interaction.editReply({ content: '❌ NPC không thu mua vật phẩm này!' });
                return;
            }
            const totalPrice = priceConfig.price * qty;
            const now = Math.floor(Date.now() / 1000);
            database_1.default.transaction(() => {
                // Trừ vật phẩm
                inv.quantity -= qty;
                if (inv.quantity <= 0) {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
                }
                else {
                    database_1.default.prepare('UPDATE inventories SET quantity = ? WHERE id = ?').run(inv.quantity, inv.id);
                }
                // Cộng tiền
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalPrice });
                // Ghi audit log
                SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'sell_to_npc', {
                    itemId: inv.item_id,
                    quantity: qty,
                    price: totalPrice,
                    inventoryId: inv.id,
                });
            })();
            const itemName = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(inv.item_id);
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('🛒 BÁN CHO NPC THÀNH CÔNG')
                        .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
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
            .setColor(uiSystem_1.EMBED_COLORS.ORANGE)
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
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = ThanhLyCommand;
