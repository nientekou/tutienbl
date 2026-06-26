"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingPostService = void 0;
// V16 C-02: Trading Post (Chợ Đồng Hành)
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
class TradingPostService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS trading_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT NOT NULL,
        buyer_id TEXT,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        ask_price INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
    }
    createListing(userId, itemId, itemName, quantity, price, durationHours = 48) {
        this.initTable();
        if (price < 100)
            return { success: false, message: '❌ Giá tối thiểu 100 LT.' };
        if (quantity < 1)
            return { success: false, message: '❌ Số lượng tối thiểu 1.' };
        const now = Math.floor(Date.now() / 1000);
        const info = database_1.default.prepare('INSERT INTO trading_posts (seller_id, item_id, item_name, quantity, ask_price, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(userId, itemId, itemName, quantity, price, 'pending', now, now + durationHours * 3600);
        return { success: true, message: `Đã đăng **${quantity}x ${itemName}** với giá ${price} LT.`, listingId: info.lastInsertRowid };
    }
    acceptTrade(userId, listingId) {
        this.initTable();
        const listing = database_1.default.prepare('SELECT * FROM trading_posts WHERE id = ? AND status = ?').get(listingId, 'pending');
        if (!listing)
            return { success: false, message: '❌ Giao dịch không tồn tại hoặc đã hoàn thành.' };
        if (listing.seller_id === userId)
            return { success: false, message: '❌ Không thể mua vật phẩm của mình.' };
        const buyer = UserRepository_1.userRepository.get(userId);
        if (!buyer)
            return { success: false, message: '❌ Chưa tạo nhân vật.' };
        if (buyer.coin_ha_pham < listing.ask_price)
            return { success: false, message: `❌ Không đủ ${listing.ask_price} LT.` };
        // Execute trade
        const tax = Math.ceil(listing.ask_price * 0.03); // 3% tax
        const sellerReceive = listing.ask_price - tax;
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: buyer.coin_ha_pham - listing.ask_price });
        UserRepository_1.userRepository.update(listing.seller_id, { coin_ha_pham: (UserRepository_1.userRepository.get(listing.seller_id)?.coin_ha_pham || 0) + sellerReceive });
        database_1.default.prepare('UPDATE trading_posts SET buyer_id = ?, status = ? WHERE id = ?')
            .run(userId, 'completed', listingId);
        return { success: true, message: `✅ Đã mua **${listing.quantity}x ${listing.item_name}** với ${listing.ask_price} LT! (Thuế: ${tax} LT)` };
    }
    getActiveListings() {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        const rows = database_1.default.prepare('SELECT * FROM trading_posts WHERE status = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 20').all('pending', now);
        return rows.map(r => {
            const timeLeft = Math.max(0, r.expires_at - now);
            const hours = Math.floor(timeLeft / 3600);
            const mins = Math.floor((timeLeft % 3600) / 60);
            return {
                id: r.id,
                itemName: r.item_name,
                quantity: r.quantity,
                price: r.ask_price,
                seller: r.seller_id,
                timeLeft: `${hours}h${mins}p`,
            };
        });
    }
    getListingDescription() {
        const listings = this.getActiveListings();
        if (listings.length === 0)
            return '🏪 **Chợ Đồng Hành** — Chưa có vật phẩm nào.';
        let msg = '🏪 **Chợ Đồng Hành**\n\n';
        for (const l of listings) {
            msg += `• **${l.quantity}x ${l.itemName}** — ${l.price} LT (Còn ${l.timeLeft})\n`;
        }
        return msg;
    }
}
exports.tradingPostService = new TradingPostService();
