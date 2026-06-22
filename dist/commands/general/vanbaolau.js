"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const MarketService_1 = require("../../services/MarketService");
const LeylineService_1 = require("../../services/LeylineService");
const database_1 = __importDefault(require("../../database/database"));
class VanBaoLauCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('vanbaolau')
            .setDescription('Vạn Bảo Lâu - Chợ giao dịch & đấu giá vật phẩm.')
            .addSubcommand(sub => sub.setName('danhsach')
            .setDescription('Xem tất cả vật phẩm đang bán trên thị trường.'))
            .addSubcommand(sub => sub.setName('ban')
            .setDescription('Treo bán vật phẩm (giá cố định).')
            .addStringOption(opt => opt.setName('item_id').setDescription('Mã vật phẩm (xem trong /tuido)').setRequired(true))
            .addIntegerOption(opt => opt.setName('gia').setDescription('Giá Linh Thạch').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng (mặc định 1)').setRequired(false)))
            .addSubcommand(sub => sub.setName('mua')
            .setDescription('Mua vật phẩm giá cố định.')
            .addIntegerOption(opt => opt.setName('listing_id').setDescription('Mã tin bán').setRequired(true)))
            .addSubcommand(sub => sub.setName('huy')
            .setDescription('Hủy tin đăng bán của bạn.')
            .addIntegerOption(opt => opt.setName('listing_id').setDescription('Mã tin bán').setRequired(true)))
            .addSubcommand(sub => sub.setName('daugia')
            .setDescription('Tạo đấu giá với thời gian đếm ngược (5 phút).')
            .addStringOption(opt => opt.setName('item_id').setDescription('Mã vật phẩm (xem trong /tuido)').setRequired(true))
            .addIntegerOption(opt => opt.setName('gia_khoi_diem').setDescription('Giá khởi điểm').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng (mặc định 1)').setRequired(false)))
            .addSubcommand(sub => sub.setName('datgia')
            .setDescription('Đặt giá trong phiên đấu giá.')
            .addIntegerOption(opt => opt.setName('listing_id').setDescription('Mã tin đấu giá').setRequired(true))
            .addIntegerOption(opt => opt.setName('gia').setDescription('Giá muốn đặt').setRequired(true)))
            .addSubcommand(sub => sub.setName('tim')
            .setDescription('Tìm kiếm vật phẩm trên Vạn Bảo Lâu.')
            .addStringOption(opt => opt.setName('ten').setDescription('Tên vật phẩm cần tìm').setRequired(false))
            .addStringOption(opt => opt.setName('loai').setDescription('Loại vật phẩm (pill/equipment/material/...)').setRequired(false)
            .addChoices({ name: 'Tất cả', value: 'all' }, { name: 'Đan dược', value: 'pill' }, { name: 'Trang bị', value: 'equipment' }, { name: 'Nguyên liệu', value: 'material' }, { name: 'Bí tịch', value: 'book' }, { name: 'Rương', value: 'chest' }, { name: 'Phôi', value: 'phoi' }))
            .addStringOption(opt => opt.setName('do_hiem').setDescription('Độ hiếm tối thiểu').setRequired(false)
            .addChoices({ name: 'Tất cả', value: 'common' }, { name: 'Uncommon trở lên', value: 'uncommon' }, { name: 'Rare trở lên', value: 'rare' }, { name: 'Epic trở lên', value: 'epic' }, { name: 'Legendary', value: 'legendary' }))
            .addIntegerOption(opt => opt.setName('gia_toi_da').setDescription('Giá tối đa').setRequired(false))
            .addStringOption(opt => opt.setName('kieu').setDescription('Kiểu giao dịch').setRequired(false)
            .addChoices({ name: 'Giá cố định', value: 'fixed' }, { name: 'Đấu giá', value: 'auction' })))
            .addSubcommand(sub => sub.setName('yeuthich')
            .setDescription('Quản lý danh sách yêu thích (theo dõi vật phẩm).')
            .addStringOption(opt => opt.setName('hanh_dong').setDescription('Hành động').setRequired(true)
            .addChoices({ name: '📋 Xem danh sách', value: 'xem' }, { name: '➕ Thêm vật phẩm', value: 'them' }, { name: '➖ Xóa vật phẩm', value: 'xoa' }))
            .addStringOption(opt => opt.setName('item_id').setDescription('Mã vật phẩm (khi thêm/xóa)').setRequired(false))
            .addIntegerOption(opt => opt.setName('watchlist_id').setDescription('ID mục yêu thích (khi xóa)').setRequired(false)))
            .addSubcommand(sub => sub.setName('lichsu')
            .setDescription('Xem lịch sử giao dịch của bạn.'))
            .addSubcommand(sub => sub.setName('autobid')
            .setDescription('Bật/tắt auto-bid cho mục yêu thích.')
            .addIntegerOption(opt => opt.setName('watchlist_id').setDescription('ID mục yêu thích').setRequired(true))
            .addIntegerOption(opt => opt.setName('gia_toi_da').setDescription('Giá tối đa auto-bid').setRequired(true)))
            .addSubcommand(sub => sub.setName('muahang')
            .setDescription('Tạo đơn ủy thác thu mua vật phẩm.')
            .addStringOption(opt => opt.setName('item_id').setDescription('Mã vật phẩm cần mua').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng mua (tối đa 999)').setRequired(true))
            .addIntegerOption(opt => opt.setName('gia').setDescription('Giá Linh Thạch/đơn vị').setRequired(true)))
            .addSubcommand(sub => sub.setName('banhang')
            .setDescription('Bán vật phẩm vào đơn ủy thác thu mua.')
            .addIntegerOption(opt => opt.setName('order_id').setDescription('Mã đơn ủy thác').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng bán').setRequired(true)))
            .addSubcommand(sub => sub.setName('huymua')
            .setDescription('Hủy đơn ủy thác thu mua của bạn.')
            .addIntegerOption(opt => opt.setName('order_id').setDescription('Mã đơn ủy thác').setRequired(true)))
            .addSubcommand(sub => sub.setName('dsmuahang')
            .setDescription('Xem danh sách đơn ủy thác thu mua đang hoạt động.')));
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
            await this.handleDanhSach(interaction, userId);
        }
        else if (sub === 'ban') {
            await this.handleBan(interaction, userId, user);
        }
        else if (sub === 'mua') {
            await this.handleMua(interaction, userId, user);
        }
        else if (sub === 'huy') {
            await this.handleHuy(interaction, userId);
        }
        else if (sub === 'daugia') {
            await this.handleDauGia(interaction, userId, user);
        }
        else if (sub === 'datgia') {
            await this.handleDatGia(interaction, userId, user);
        }
        else if (sub === 'tim') {
            await this.handleTim(interaction);
        }
        else if (sub === 'yeuthich') {
            await this.handleYeuThich(interaction, userId);
        }
        else if (sub === 'lichsu') {
            await this.handleLichSu(interaction, userId);
        }
        else if (sub === 'autobid') {
            await this.handleAutoBid(interaction, userId);
        }
        else if (sub === 'muahang') {
            await this.handleMuaHang(interaction, userId, user);
        }
        else if (sub === 'banhang') {
            await this.handleBanHang(interaction, userId);
        }
        else if (sub === 'huymua') {
            await this.handleHuyMua(interaction, userId);
        }
        else if (sub === 'dsmuahang') {
            await this.handleDsMuaHang(interaction);
        }
    }
    // ================ HANDLERS ================
    async handleDanhSach(interaction, userId) {
        const allListings = database_1.default.prepare(`
      SELECT m.*, u.name as seller_name, t.name as item_name, t.rarity as item_rarity, t.type as item_type, i.stars, i.custom_stats
      FROM market_listings m
      JOIN users u ON m.seller_id = u.discord_id
      LEFT JOIN inventories i ON m.inventory_id = i.id
      JOIN items t ON m.item_id = t.id
      WHERE m.status = 'active'
      ORDER BY m.listing_type ASC, m.listed_at DESC
      LIMIT 20
    `).all();
        const fixedListings = allListings.filter(l => l.listing_type === 'fixed');
        const auctionListings = allListings.filter(l => l.listing_type === 'auction');
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏪 VẠN BẢO LÂU - SÀN GIAO DỊCH & ĐẤU GIÁ 🏪')
            .setColor('#e67e22')
            .setDescription('Nơi giao lưu vật phẩm & đấu giá giữa các tu sĩ. Mọi giao dịch chịu 2% thuế (tối thiểu theo cảnh giới, tối đa 20 tin/ngày).\nDùng `/vanbaolau tim` để tìm kiếm nâng cao.')
            .setTimestamp();
        if (fixedListings.length > 0) {
            let fixedText = fixedListings.slice(0, 10).map(l => {
                const stars = l.stars && l.stars > 0 ? ` ⭐${l.stars}` : '';
                return `\`#${l.id}\` **${l.item_name}** x${l.quantity}${stars} • **${l.price}** LT • *${l.seller_name}*`;
            }).join('\n');
            embed.addFields({ name: `📦 GIÁ CỐ ĐỊNH (${fixedListings.length} tin)`, value: fixedText });
        }
        else {
            embed.addFields({ name: '📦 GIÁ CỐ ĐỊNH', value: '*Không có tin nào*' });
        }
        if (auctionListings.length > 0) {
            const now = Math.floor(Date.now() / 1000);
            let auctionText = auctionListings.slice(0, 10).map(l => {
                const remainMin = Math.max(0, Math.floor((l.expires_at - now) / 60));
                const curBid = l.current_bid || l.price;
                const bidder = l.current_bidder_id ? ' (có người đặt)' : ' (chưa ai đặt)';
                return `\`#${l.id}\` **${l.item_name}** • 🔨 ${curBid} LT${bidder} • ⏳ ${remainMin}ph`;
            }).join('\n');
            embed.addFields({ name: `🔨 ĐẤU GIÁ (${auctionListings.length} tin)`, value: auctionText });
        }
        else {
            embed.addFields({ name: '🔨 ĐẤU GIÁ', value: '*Không có phiên đấu giá nào*' });
        }
        embed.setFooter({ text: 'Dùng /vanbaolau daugia để tạo đấu giá, /vanbaolau datgia để đặt giá.' });
        await interaction.reply({ embeds: [embed] });
    }
    async handleBan(interaction, userId, user) {
        const itemId = interaction.options.getString('item_id', true);
        const price = interaction.options.getInteger('gia', true);
        const qty = interaction.options.getInteger('soluong') || 1;
        if (price <= 0) {
            await interaction.reply({ content: '❌ Giá phải > 0!', ephemeral: true });
            return;
        }
        if (qty <= 0) {
            await interaction.reply({ content: '❌ Số lượng phải > 0!', ephemeral: true });
            return;
        }
        const invItem = InventoryRepository_1.inventoryRepository.getByUserIdAndItemId(userId, itemId);
        if (!invItem) {
            await interaction.reply({ content: `❌ Không tìm thấy vật phẩm \`${itemId}\` trong túi đồ!`, ephemeral: true });
            return;
        }
        const result = MarketService_1.marketService.createFixedListing(userId, invItem.id, price, qty);
        if (result.success)
            LeylineService_1.leylineService.addEnergy(userId, 'kinhte', 5);
        await interaction.reply({ content: result.success ? result.message : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleMua(interaction, userId, user) {
        const listingId = interaction.options.getInteger('listing_id', true);
        const result = MarketService_1.marketService.buyFixedListing(userId, listingId);
        if (result.success)
            LeylineService_1.leylineService.addEnergy(userId, 'kinhte', 10);
        await interaction.reply({ content: result.success ? result.message : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleHuy(interaction, userId) {
        const listingId = interaction.options.getInteger('listing_id', true);
        const result = MarketService_1.marketService.cancelListing(userId, listingId);
        await interaction.reply({ content: result.success ? result.message : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleDauGia(interaction, userId, user) {
        const invId = interaction.options.getInteger('inventory_id', true);
        const startBid = interaction.options.getInteger('gia_khoi_diem', true);
        const qty = interaction.options.getInteger('soluong') || 1;
        const result = MarketService_1.marketService.createAuction(userId, invId, startBid, qty);
        if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            return;
        }
        LeylineService_1.leylineService.addEnergy(userId, 'kinhte', 5);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🔨 PHIÊN ĐẤU GIÁ MỚI')
            .setColor('#f39c12')
            .setDescription(result.message)
            .addFields({ name: 'Mã tin', value: `\`#${result.listingId}\``, inline: true })
            .setFooter({ text: 'Dùng /vanbaolau datgia để đặt giá!' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
    async handleDatGia(interaction, userId, user) {
        const listingId = interaction.options.getInteger('listing_id', true);
        const bidAmount = interaction.options.getInteger('gia', true);
        const result = MarketService_1.marketService.placeBid(listingId, userId, bidAmount);
        if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            return;
        }
        LeylineService_1.leylineService.addEnergy(userId, 'kinhte', 5);
        await interaction.reply({ content: `✅ ${result.message}` });
    }
    async handleTim(interaction) {
        const query = interaction.options.getString('ten') || undefined;
        const typeRaw = interaction.options.getString('loai') || undefined;
        const type = typeRaw === 'all' ? undefined : typeRaw;
        const rarityRaw = interaction.options.getString('do_hiem') || undefined;
        const rarity = rarityRaw === 'common' ? undefined : rarityRaw;
        const maxPrice = interaction.options.getInteger('gia_toi_da') || undefined;
        const listingType = interaction.options.getString('kieu') ?? undefined;
        const result = MarketService_1.marketService.searchListings({
            query: query || undefined,
            type: type,
            rarity: rarity,
            maxPrice: maxPrice || undefined,
            listingType: listingType,
            sortBy: 'newest',
            limit: 15
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🔍 KẾT QUẢ TÌM KIẾM: ${query || 'Tất cả'}${type ? ` (${type})` : ''}`)
            .setColor('#3498db')
            .setDescription(`Tìm thấy **${result.totalCount}** kết quả`)
            .setTimestamp();
        if (result.listings.length === 0) {
            embed.setDescription('*Không tìm thấy vật phẩm phù hợp.*');
        }
        else {
            for (const l of result.listings) {
                const now = Math.floor(Date.now() / 1000);
                const typeIcon = l.listing_type === 'auction' ? '🔨' : '📦';
                const priceText = l.listing_type === 'auction'
                    ? `Giá hiện tại: **${l.current_bid || l.price}** LT ${l.current_bidder_id ? '(có bid)' : '(chưa ai bid)'}`
                    : `Giá: **${l.price}** LT`;
                const timeLeft = l.listing_type === 'auction'
                    ? ` • ⏳ ${Math.max(0, Math.floor((l.expires_at - now) / 60))}ph`
                    : '';
                const stars = l.stars && l.stars > 0 ? ` ⭐${l.stars}` : '';
                let statsStr = '';
                if (l.custom_stats) {
                    try {
                        const parsedStats = JSON.parse(l.custom_stats);
                        const keyNames = {
                            hp: 'HP', mp: 'MP', atk: 'Công', def: 'Thủ',
                            crit: 'Bạo', crit_res: 'Kháng bạo', luck: 'May', speed: 'Tốc', dodge: 'Né'
                        };
                        const bonusEntries = [];
                        for (const [k, v] of Object.entries(parsedStats)) {
                            if (keyNames[k]) {
                                const isPercent = k.includes('percent') || k === 'crit' || k === 'crit_res' || k === 'dodge';
                                const sign = Number(v) > 0 ? '+' : '';
                                const valStr = isPercent ? `${sign}${Math.round(Number(v) * 100)}%` : `${sign}${v}`;
                                bonusEntries.push(`${keyNames[k]} ${valStr}`);
                            }
                        }
                        if (bonusEntries.length > 0)
                            statsStr = `\n└ *Chỉ số rèn:* ${bonusEntries.join(', ')}`;
                    }
                    catch (e) { }
                }
                embed.addFields({
                    name: `${typeIcon} \`#${l.id}\` **${l.item_name}** x${l.quantity}${stars} [${(l.item_rarity || '').toUpperCase()}]`,
                    value: `${priceText}${timeLeft} • *Bởi: ${l.seller_name}*${statsStr}`
                });
            }
        }
        embed.setFooter({ text: 'Dùng /vanbaolau mua hoặc /vanbaolau datgia để giao dịch.' });
        await interaction.reply({ embeds: [embed] });
    }
    async handleYeuThich(interaction, userId) {
        const action = interaction.options.getString('hanh_dong', true);
        if (action === 'xem') {
            const entries = database_1.default.prepare(`
        SELECT w.*, i.name as item_name, i.rarity as item_rarity
        FROM market_watchlist w
        JOIN items i ON w.item_id = i.id
        WHERE w.user_id = ?
        ORDER BY w.created_at DESC
      `).all(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔔 DANH SÁCH YÊU THÍCH - VẠN BẢO LÂU')
                .setColor('#e74c3c')
                .setDescription('Theo dõi các vật phẩm mong muốn. Khi có tin đăng phù hợp, bạn sẽ được thông báo!')
                .setTimestamp();
            if (entries.length === 0) {
                embed.addFields({ name: '📋 Danh sách', value: '*Chưa có vật phẩm nào. Dùng `/vanbaolau yeuthich hanh_dong: them item_id: <mã>` để thêm.*' });
            }
            else {
                let text = '';
                for (const e of entries) {
                    const autoBidStatus = e.auto_bid_enabled === 1 ? ` 🤖 Auto-bid: **${e.auto_bid_max_price}** LT` : '';
                    text += `\`#${e.id}\` **${e.item_name}** [${(e.item_rarity || '').toUpperCase()}]${autoBidStatus}\n`;
                }
                embed.addFields({ name: `📋 Danh sách (${entries.length} mục)`, value: text });
            }
            await interaction.reply({ embeds: [embed] });
        }
        else if (action === 'them') {
            const itemId = interaction.options.getString('item_id');
            if (!itemId) {
                await interaction.reply({ content: '❌ Cần nhập mã vật phẩm!', ephemeral: true });
                return;
            }
            const result = MarketService_1.marketService.addWatchlist(userId, itemId);
            await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: true });
        }
        else if (action === 'xoa') {
            const watchlistId = interaction.options.getInteger('watchlist_id');
            if (!watchlistId) {
                await interaction.reply({ content: '❌ Cần nhập ID mục yêu thích!', ephemeral: true });
                return;
            }
            const result = MarketService_1.marketService.removeWatchlist(userId, watchlistId);
            await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: true });
        }
    }
    async handleLichSu(interaction, userId) {
        const history = MarketService_1.marketService.getTransactionHistory(userId, 15);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📜 LỊCH SỬ GIAO DỊCH VẠN BẢO LÂU')
            .setColor('#9b59b6')
            .setTimestamp();
        if (history.length === 0) {
            embed.setDescription('*Chưa có giao dịch nào. Hãy tham gia mua bán trên Vạn Bảo Lâu!*');
        }
        else {
            let text = '';
            for (const h of history) {
                const actionEmoji = h.type === 'buy' ? '🟢 Mua' : h.type === 'sell' ? '🟤 Bán' : h.type === 'auction_win' ? '🏆 Trúng' : '🔨 Bid';
                const date = new Date(h.created_at * 1000).toLocaleDateString('vi-VN');
                text += `• ${actionEmoji} **${h.item_name || h.item_id}** x${h.quantity} — **${h.price}** LT (${date})\n`;
            }
            embed.setDescription(text);
        }
        await interaction.reply({ embeds: [embed] });
    }
    async handleAutoBid(interaction, userId) {
        const watchlistId = interaction.options.getInteger('watchlist_id', true);
        const maxPrice = interaction.options.getInteger('gia_toi_da', true);
        const result = MarketService_1.marketService.setAutoBid(userId, watchlistId, true, maxPrice);
        await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: true });
    }
    async handleMuaHang(interaction, userId, user) {
        const itemId = interaction.options.getString('item_id', true).trim().toLowerCase();
        const quantity = interaction.options.getInteger('soluong', true);
        const unitPrice = interaction.options.getInteger('gia', true);
        const result = MarketService_1.marketService.createBuyOrder(userId, itemId, quantity, unitPrice);
        await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleBanHang(interaction, userId) {
        const orderId = interaction.options.getInteger('order_id', true);
        const quantity = interaction.options.getInteger('soluong', true);
        const result = MarketService_1.marketService.fillBuyOrder(userId, orderId, quantity);
        await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleHuyMua(interaction, userId) {
        const orderId = interaction.options.getInteger('order_id', true);
        const result = MarketService_1.marketService.cancelBuyOrder(userId, orderId);
        await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: !result.success });
    }
    async handleDsMuaHang(interaction) {
        const { orders } = MarketService_1.marketService.getActiveBuyOrders(1, 20);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 ỦY THÁC THU MUA')
            .setColor('#3498db')
            .setTimestamp();
        if (orders.length === 0) {
            embed.setDescription('*Chưa có đơn ủy thác mua nào. Dùng `/vanbaolau muahang` để tạo!*');
        }
        else {
            let text = '';
            for (const o of orders) {
                const remaining = o.quantity - o.filled_quantity;
                text += `• **#${o.id}** ${o.item_name || o.item_id} — **${o.price_per_unit} LT**/đv | Cần **${remaining}**/${o.quantity}\n   Người mua: ${o.buyer_name}\n`;
            }
            embed.setDescription(text);
        }
        await interaction.reply({ embeds: [embed] });
    }
}
exports.default = VanBaoLauCommand;
