"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const SystemConfigService_1 = require("./SystemConfigService");
const LeylineService_1 = require("./LeylineService");
const constants_1 = require("../utils/constants");
class MarketService {
    getTodaysDateUtc() {
        return new Date().toISOString().slice(0, 10);
    }
    getMinPriceForLevel(level) {
        const realm = (0, constants_1.getRealmDetails)(level);
        const minPrices = [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        return minPrices[Math.min(realm.majorIndex, minPrices.length - 1)];
    }
    getDailyTracking(userId) {
        const date = this.getTodaysDateUtc();
        const row = database_1.default.prepare(`
      SELECT sell_count, total_sales, total_tax FROM market_daily_tracking
      WHERE user_id = ? AND date = ?
    `).get(userId, date);
        return row || { sell_count: 0, total_sales: 0, total_tax: 0 };
    }
    checkDailySellLimit(userId) {
        const max = 20;
        const tracking = this.getDailyTracking(userId);
        return { canSell: tracking.sell_count < max, count: tracking.sell_count, max };
    }
    incrementSellCount(userId) {
        const date = this.getTodaysDateUtc();
        database_1.default.prepare(`
      INSERT INTO market_daily_tracking (user_id, date, sell_count, total_sales, total_tax)
      VALUES (?, ?, 1, 0, 0)
      ON CONFLICT(user_id, date) DO UPDATE SET
        sell_count = sell_count + 1
    `).run(userId, date);
    }
    recordCompletedSale(userId, price, tax) {
        const date = this.getTodaysDateUtc();
        database_1.default.prepare(`
      INSERT INTO market_daily_tracking (user_id, date, sell_count, total_sales, total_tax)
      VALUES (?, ?, 0, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        total_sales = total_sales + ?,
        total_tax = total_tax + ?
    `).run(userId, date, price, tax, price, tax);
    }
    /**
     * Tạo đấu giá với thời gian đếm ngược
     */
    createAuction(userId, inventoryId, startingBid, quantity = 1, durationMinutes = 5) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item || item.user_id !== userId)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        if (item.is_equipped === 1)
            return { success: false, message: 'Vật phẩm đang đeo, tháo ra trước!' };
        if (item.quantity < quantity)
            return { success: false, message: 'Không đủ số lượng!' };
        if (startingBid <= 0)
            return { success: false, message: 'Giá khởi điểm phải > 0!' };
        const minPrice = this.getMinPriceForLevel(user.level);
        if (startingBid < minPrice)
            return { success: false, message: `Cảnh giới của đạo hữu yêu cầu giá khởi điểm tối thiểu **${minPrice} Linh Thạch**!` };
        const limit = this.checkDailySellLimit(userId);
        if (!limit.canSell)
            return { success: false, message: `Đã đạt giới hạn bán **${limit.max} vật phẩm/ngày**! Vui lòng chờ ngày mới.` };
        // Phí đăng ký đấu giá 100 Linh Thạch
        if (user.coin_ha_pham < 100)
            return { success: false, message: 'Cần 100 Linh Thạch phí đăng ký đấu giá!' };
        // Giới hạn thời gian đấu giá: 1-60 phút
        const clampedDuration = Math.max(1, Math.min(60, durationMinutes));
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + clampedDuration * 60;
        const tx = database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 100 });
            let finalInvId = inventoryId;
            if (item.quantity > quantity) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, inventoryId);
                const insertRes = database_1.default.prepare(`
          INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, stars, enhance_level, created_at)
          VALUES ('market', ?, ?, 0, NULL, ?, ?, ?, ?)
        `).run(item.item_id, quantity, item.custom_stats, item.stars, item.enhance_level || 0, now);
                finalInvId = insertRes.lastInsertRowid;
            }
            else {
                database_1.default.prepare("UPDATE inventories SET user_id = 'market' WHERE id = ?").run(inventoryId);
            }
            const result = database_1.default.prepare(`
        INSERT INTO market_listings (seller_id, inventory_id, item_id, quantity, price_type, price,
          listing_type, current_bid, min_bid_increment, listed_at, expires_at, status)
        VALUES (?, ?, ?, ?, 'ha_pham', ?, 'auction', ?, 50, ?, ?, 'active')
      `).run(userId, finalInvId, item.item_id, quantity, startingBid, startingBid, now, expiresAt);
            this.incrementSellCount(userId);
            SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'create_auction', {
                listingId: result.lastInsertRowid,
                itemName: item.name,
                startingBid,
                durationMinutes
            });
        })();
        return {
            success: true,
            message: `🔨 **Đấu giá thành công!** **${quantity}x ${item.name}** với giá khởi điểm **${startingBid} Linh Thạch**!\n⏳ Thời gian: **${durationMinutes} phút**\n💸 Phí đăng ký: -100 Linh Thạch`,
            listingId: database_1.default.prepare("SELECT id FROM market_listings WHERE seller_id = ? AND status = 'active' AND listing_type = 'auction' ORDER BY id DESC LIMIT 1").get(userId)?.id
        };
    }
    /**
     * Tạo tin bán giá cố định
     */
    createFixedListing(userId, inventoryId, price, quantity = 1) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item || item.user_id !== userId)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        if (item.is_equipped === 1)
            return { success: false, message: 'Vật phẩm đang đeo, tháo ra trước!' };
        if (item.quantity < quantity)
            return { success: false, message: `Không đủ số lượng! (Có: ${item.quantity})` };
        if (price <= 0)
            return { success: false, message: 'Giá phải > 0!' };
        const minPrice = this.getMinPriceForLevel(user.level);
        if (price < minPrice)
            return { success: false, message: `Cảnh giới của đạo hữu yêu cầu giá bán tối thiểu **${minPrice} Linh Thạch**!` };
        const limit = this.checkDailySellLimit(userId);
        if (!limit.canSell)
            return { success: false, message: `Đã đạt giới hạn bán **${limit.max} vật phẩm/ngày**! Vui lòng chờ ngày mới.` };
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + 7 * 24 * 3600;
        let listingId;
        database_1.default.transaction(() => {
            let finalInvId = inventoryId;
            if (item.quantity > quantity) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, inventoryId);
                const insertRes = database_1.default.prepare(`
          INSERT INTO inventories (user_id, item_id, quantity, is_equipped, custom_stats, stars, enhance_level, created_at)
          VALUES ('market', ?, ?, 0, ?, ?, ?, ?)
        `).run(item.item_id, quantity, item.custom_stats, item.stars, item.enhance_level || 0, now);
                finalInvId = insertRes.lastInsertRowid;
            }
            else {
                database_1.default.prepare("UPDATE inventories SET user_id = 'market' WHERE id = ?").run(inventoryId);
            }
            const res = database_1.default.prepare(`
        INSERT INTO market_listings (seller_id, inventory_id, item_id, quantity, price_type, price,
          listing_type, listed_at, expires_at, status)
        VALUES (?, ?, ?, ?, 'ha_pham', ?, 'fixed', ?, ?, 'active')
      `).run(userId, finalInvId, item.item_id, quantity, price, now, expiresAt);
            listingId = res.lastInsertRowid;
            this.incrementSellCount(userId);
        })();
        return {
            success: true,
            message: `🏪 Treo bán **${quantity}x ${item.name}** giá **${price} Linh Thạch**!`,
            listingId
        };
    }
    /**
     * Mua trực tiếp tin giá cố định
     */
    buyFixedListing(userId, listingId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const listing = database_1.default.prepare("SELECT * FROM market_listings WHERE id = ? AND status = 'active' AND listing_type = 'fixed'")
            .get(listingId);
        if (!listing)
            return { success: false, message: 'Tin không tồn tại hoặc đã bán!' };
        if (listing.seller_id === userId)
            return { success: false, message: 'Không thể tự mua đồ của mình! Dùng `/vanbaolau huy` để gỡ.' };
        if (user.coin_ha_pham < listing.price)
            return { success: false, message: `Thiếu tiền! (Cần: ${listing.price}, Có: ${user.coin_ha_pham})` };
        const seller = UserRepository_1.userRepository.get(listing.seller_id);
        // 2% thuế giao dịch, Leyline Buff Kinh Tế giảm 10% thuế
        let taxRate = 0.02;
        if (LeylineService_1.leylineService.isBuffActive('kinhte')) {
            taxRate = 0.018;
        }
        const tax = Math.round(listing.price * taxRate);
        const payout = listing.price - tax;
        const now = Math.floor(Date.now() / 1000);
        let itemName = listing.item_id;
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - listing.price });
            if (seller)
                UserRepository_1.userRepository.update(listing.seller_id, { coin_ha_pham: seller.coin_ha_pham + payout });
            // Nộp thuế vào tài khoản hệ thống
            const marketUser = UserRepository_1.userRepository.get('market');
            if (marketUser)
                UserRepository_1.userRepository.update('market', { coin_ha_pham: marketUser.coin_ha_pham + tax });
            database_1.default.prepare("UPDATE market_listings SET status = 'sold' WHERE id = ?").run(listingId);
            const marketItem = database_1.default.prepare('SELECT * FROM inventories WHERE id = ?').get(listing.inventory_id);
            if (marketItem) {
                const itemDef = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(listing.item_id);
                if (itemDef)
                    itemName = itemDef.name;
                const buyerInv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
                const existing = buyerInv.find(i => i.item_id === listing.item_id && i.is_equipped === 0 && i.equipable === 0);
                if (existing) {
                    database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?').run(listing.quantity, existing.id);
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(listing.inventory_id);
                }
                else {
                    database_1.default.prepare("UPDATE inventories SET user_id = ? WHERE id = ?").run(userId, listing.inventory_id);
                }
            }
            // Ghi lịch sử
            database_1.default.prepare(`
        INSERT INTO market_transaction_history (user_id, type, listing_id, item_id, quantity, price, tax, counterparty_id, created_at)
        VALUES (?, 'buy', ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, listingId, listing.item_id, listing.quantity, listing.price, tax, listing.seller_id, now);
            database_1.default.prepare(`
        INSERT INTO market_transaction_history (user_id, type, listing_id, item_id, quantity, price, tax, counterparty_id, created_at)
        VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?)
      `).run(listing.seller_id, listingId, listing.item_id, listing.quantity, payout, tax, userId, now);
            this.recordCompletedSale(listing.seller_id, listing.price, tax);
        })();
        return { success: true, message: `🎉 Mua thành công **${listing.quantity}x ${itemName}** giá **${listing.price} LT** (thuế: ${tax} LT)!` };
    }
    /**
     * Hủy tin đăng bán (fixed/auction nếu chưa ai đặt giá)
     */
    cancelListing(userId, listingId) {
        const listing = database_1.default.prepare("SELECT * FROM market_listings WHERE id = ? AND status = 'active'")
            .get(listingId);
        if (!listing)
            return { success: false, message: 'Tin không tồn tại hoặc đã giao dịch xong!' };
        if (listing.seller_id !== userId)
            return { success: false, message: 'Không phải tin của bạn!' };
        if (listing.listing_type === 'auction' && listing.current_bidder_id)
            return { success: false, message: 'Đã có người đặt giá, không thể hủy!' };
        database_1.default.transaction(() => {
            database_1.default.prepare("UPDATE market_listings SET status = 'cancelled' WHERE id = ?").run(listingId);
            const marketItem = database_1.default.prepare('SELECT * FROM inventories WHERE id = ?').get(listing.inventory_id);
            if (marketItem) {
                const sellerInv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
                const existing = sellerInv.find(i => i.item_id === listing.item_id && i.is_equipped === 0 && i.equipable === 0);
                if (existing) {
                    database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?').run(listing.quantity, existing.id);
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(listing.inventory_id);
                }
                else {
                    database_1.default.prepare("UPDATE inventories SET user_id = ? WHERE id = ?").run(userId, listing.inventory_id);
                }
            }
        })();
        return { success: true, message: `✅ Đã hủy tin #${listingId}. Vật phẩm đã về hành trang.` };
    }
    /**
     * Đặt giá trong đấu giá
     */
    placeBid(listingId, userId, bidAmount) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const listing = database_1.default.prepare("SELECT * FROM market_listings WHERE id = ? AND status = 'active' AND listing_type = 'auction'")
            .get(listingId);
        if (!listing)
            return { success: false, message: 'Đấu giá không tồn tại hoặc đã kết thúc!' };
        const now = Math.floor(Date.now() / 1000);
        if (listing.expires_at <= now) {
            return { success: false, message: 'Phiên đấu giá đã kết thúc! Dùng `/vanbaolau danhsach` để xem các phiên mới.' };
        }
        if (listing.seller_id === userId)
            return { success: false, message: 'Không thể tự đấu giá vật phẩm của mình!' };
        const currentHighest = listing.current_bid || listing.price;
        const minBid = currentHighest + listing.min_bid_increment;
        if (bidAmount < minBid)
            return { success: false, message: `Giá đặt tối thiểu: **${minBid} Linh Thạch**!` };
        if (user.coin_ha_pham < bidAmount)
            return { success: false, message: `Không đủ Linh Thạch! (Có: ${user.coin_ha_pham}, Cần: ${bidAmount})` };
        // Hoàn trả tiền cho bidder cũ nếu có
        const tx = database_1.default.transaction(() => {
            if (listing.current_bidder_id && listing.current_bid) {
                const oldBidder = UserRepository_1.userRepository.get(listing.current_bidder_id);
                if (oldBidder) {
                    UserRepository_1.userRepository.update(listing.current_bidder_id, {
                        coin_ha_pham: oldBidder.coin_ha_pham + listing.current_bid
                    });
                }
            }
            // Khóa tiền của bidder mới
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - bidAmount });
            // Cập nhật listing
            database_1.default.prepare(`
        UPDATE market_listings SET current_bid = ?, current_bidder_id = ?, bid_count = bid_count + 1,
          expires_at = MAX(expires_at, ? + 30) -- Gia hạn 30 giây nếu đặt phút cuối
        WHERE id = ?
      `).run(bidAmount, userId, now, listingId);
            // Ghi lịch sử
            database_1.default.prepare(`
        INSERT INTO market_transaction_history (user_id, type, listing_id, item_id, quantity, price, counterparty_id, created_at)
        VALUES (?, 'auction_bid', ?, ?, 1, ?, ?, ?)
      `).run(userId, listingId, listing.item_id, bidAmount, listing.seller_id, now);
        })();
        return {
            success: true,
            message: `🔨 **Đặt giá thành công!** **${bidAmount} Linh Thạch** cho **${listing.item_id}**!\n⏳ Thời gian còn lại: **${Math.max(0, Math.floor((listing.expires_at - now) / 60))} phút**`
        };
    }
    /**
     * Kết thúc đấu giá - trao vật phẩm cho người thắng
     */
    finalizeAuction(listingId) {
        try {
            const listing = database_1.default.prepare("SELECT * FROM market_listings WHERE id = ? AND listing_type = 'auction' AND status = 'active'")
                .get(listingId);
            if (!listing)
                return;
            const now = Math.floor(Date.now() / 1000);
            if (!listing.current_bidder_id) {
                // Không ai đặt giá - trả về cho seller
                database_1.default.prepare("UPDATE market_listings SET status = 'expired' WHERE id = ?").run(listingId);
                const marketItem = database_1.default.prepare('SELECT * FROM inventories WHERE id = ?').get(listing.inventory_id);
                if (marketItem) {
                    database_1.default.prepare("UPDATE inventories SET user_id = ? WHERE id = ?").run(listing.seller_id, listing.inventory_id);
                }
                return;
            }
            const buyer = UserRepository_1.userRepository.get(listing.current_bidder_id);
            const seller = UserRepository_1.userRepository.get(listing.seller_id);
            if (!buyer || !seller) {
                database_1.default.prepare("UPDATE market_listings SET status = 'error' WHERE id = ?").run(listingId);
                return;
            }
            // 2% thuế giao dịch, Leyline Buff Kinh Tế giảm 10% thuế
            let taxRate = 0.02;
            if (LeylineService_1.leylineService.isBuffActive('kinhte')) {
                taxRate = 0.018;
            }
            const tax = Math.round(listing.current_bid * taxRate);
            const payout = listing.current_bid - tax;
            const tx = database_1.default.transaction(() => {
                // Ghi nhận thanh toán: tiền đã khóa từ bidder, chỉ cần chuyển cho seller
                UserRepository_1.userRepository.update(listing.seller_id, { coin_ha_pham: seller.coin_ha_pham + payout });
                // Nộp thuế vào tài khoản hệ thống
                const marketUser = UserRepository_1.userRepository.get('market');
                if (marketUser)
                    UserRepository_1.userRepository.update('market', { coin_ha_pham: marketUser.coin_ha_pham + tax });
                // Chuyển vật phẩm
                const marketItem = database_1.default.prepare('SELECT * FROM inventories WHERE id = ?').get(listing.inventory_id);
                if (marketItem) {
                    const buyerInv = InventoryRepository_1.inventoryRepository.getUserInventory(listing.current_bidder_id);
                    const existing = buyerInv.find(i => i.item_id === listing.item_id &&
                        i.is_equipped === 0 &&
                        i.equipable === 0);
                    if (existing) {
                        database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?').run(listing.quantity, existing.id);
                        database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(listing.inventory_id);
                    }
                    else {
                        database_1.default.prepare("UPDATE inventories SET user_id = ? WHERE id = ?").run(listing.current_bidder_id, listing.inventory_id);
                    }
                }
                database_1.default.prepare("UPDATE market_listings SET status = 'sold' WHERE id = ?").run(listingId);
                // Lịch sử cho người mua
                database_1.default.prepare(`
        INSERT INTO market_transaction_history (user_id, type, listing_id, item_id, quantity, price, tax, counterparty_id, created_at)
        VALUES (?, 'auction_win', ?, ?, ?, ?, ?, ?, ?)
      `).run(listing.current_bidder_id, listingId, listing.item_id, listing.quantity, listing.current_bid, tax, listing.seller_id, now);
                // Lịch sử cho người bán
                database_1.default.prepare(`
        INSERT INTO market_transaction_history (user_id, type, listing_id, item_id, quantity, price, tax, counterparty_id, created_at)
        VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?)
      `).run(listing.seller_id, listingId, listing.item_id, listing.quantity, payout, tax, listing.current_bidder_id, now);
                this.recordCompletedSale(listing.seller_id, listing.current_bid, tax);
                SystemConfigService_1.systemConfigService.writeAuditLog(listing.current_bidder_id, 'auction_win', {
                    listingId,
                    itemId: listing.item_id,
                    price: listing.current_bid,
                    tax
                });
            })();
        }
        catch (e) {
            console.error(`[MarketService] finalizeAuction #${listingId} error:`, e);
        }
    }
    /**
     * Thêm vật phẩm vào watchlist
     */
    addWatchlist(userId, itemId, minRarity = 'common', maxPrice = 999999999) {
        const existing = database_1.default.prepare("SELECT id FROM market_watchlist WHERE user_id = ? AND item_id = ?").get(userId, itemId);
        if (existing)
            return { success: false, message: 'Vật phẩm đã có trong danh sách theo dõi!' };
        const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(itemId);
        if (!item)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO market_watchlist (user_id, item_id, min_rarity, max_price, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, itemId, minRarity, maxPrice, now);
        return { success: true, message: `🔔 Đã thêm **${item.name}** vào danh sách theo dõi! Sẽ nhận thông báo khi có tin đăng phù hợp.` };
    }
    /**
     * Xóa vật phẩm khỏi watchlist
     */
    removeWatchlist(userId, watchlistId) {
        const entry = database_1.default.prepare("SELECT id, item_id FROM market_watchlist WHERE id = ? AND user_id = ?").get(watchlistId, userId);
        if (!entry)
            return { success: false, message: 'Không tìm thấy mục theo dõi!' };
        const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(entry.item_id);
        database_1.default.prepare("DELETE FROM market_watchlist WHERE id = ?").run(watchlistId);
        return { success: true, message: `Đã xóa **${item?.name || entry.item_id}** khỏi danh sách theo dõi.` };
    }
    /**
     * Bật/tắt auto-bid cho một mục watchlist
     */
    setAutoBid(userId, watchlistId, enabled, maxPrice = 0) {
        const entry = database_1.default.prepare("SELECT * FROM market_watchlist WHERE id = ? AND user_id = ?").get(watchlistId, userId);
        if (!entry)
            return { success: false, message: 'Không tìm thấy mục theo dõi!' };
        database_1.default.prepare("UPDATE market_watchlist SET auto_bid_enabled = ?, auto_bid_max_price = ? WHERE id = ?")
            .run(enabled ? 1 : 0, maxPrice, watchlistId);
        return {
            success: true,
            message: enabled
                ? `🤖 **Auto-bid bật!** Tự động đặt giá lên đến **${maxPrice} Linh Thạch** cho vật phẩm này.`
                : '🔕 Đã tắt auto-bid.'
        };
    }
    /**
     * Khởi động scheduler tự động kiểm tra & kết thúc đấu giá hết hạn và auto-bid
     */
    startScheduler() {
        const { CronManager } = require('../utils/CronManager');
        // Chạy mỗi 30 giây
        CronManager.registerTask('market_scheduler', 30000, () => {
            this.finalizeExpiredAuctions();
            this.checkAutoBids();
        });
    }
    /**
     * Kết thúc tất cả đấu giá đã hết hạn
     */
    finalizeExpiredAuctions() {
        const now = Math.floor(Date.now() / 1000);
        const expired = database_1.default.prepare("SELECT id FROM market_listings WHERE listing_type = 'auction' AND status = 'active' AND expires_at <= ?").all(now);
        for (const listing of expired) {
            this.finalizeAuction(listing.id);
        }
        return expired.length;
    }
    /**
     * Kiểm tra và thực thi auto-bid cho tất cả watchlist
     */
    checkAutoBids() {
        const watchlistEntries = database_1.default.prepare("SELECT w.*, u.name FROM market_watchlist w JOIN users u ON w.user_id = u.discord_id WHERE w.auto_bid_enabled = 1").all();
        for (const entry of watchlistEntries) {
            // Tìm listing active phù hợp
            const listing = database_1.default.prepare(`
        SELECT * FROM market_listings 
        WHERE item_id = ? AND status = 'active' AND listing_type = 'auction'
          AND seller_id != ?
        ORDER BY 
          CASE WHEN current_bid IS NOT NULL THEN current_bid ELSE price END ASC
        LIMIT 1
      `).get(entry.item_id, entry.user_id);
            if (!listing)
                continue;
            const currentPrice = listing.current_bid || listing.price;
            const user = UserRepository_1.userRepository.get(entry.user_id);
            if (!user)
                continue;
            // Nếu giá hiện tại + increment <= max_price, và user đủ tiền
            const autoBidMax = entry.auto_bid_max_price || 999999999;
            const nextBid = currentPrice + (listing.min_bid_increment || 50);
            if (nextBid <= autoBidMax && user.coin_ha_pham >= nextBid) {
                this.placeBid(listing.id, entry.user_id, nextBid);
            }
        }
    }
    /**
     * Lấy lịch sử giao dịch của người dùng
     */
    getTransactionHistory(userId, limit = 20) {
        return database_1.default.prepare(`
      SELECT t.*, i.name as item_name 
      FROM market_transaction_history t
      LEFT JOIN items i ON t.item_id = i.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(userId, limit);
    }
    /**
     * Tìm kiếm vật phẩm đang bán
     */
    searchListings(options) {
        const conditions = ["m.status = 'active'"];
        const params = [];
        const page = options.page || 1;
        const limit = options.limit || 10;
        if (options.query) {
            conditions.push("(t.name LIKE ? OR t.id LIKE ?)");
            params.push(`%${options.query}%`, `%${options.query}%`);
        }
        if (options.type) {
            conditions.push("t.type = ?");
            params.push(options.type);
        }
        if (options.rarity) {
            conditions.push("t.rarity = ?");
            params.push(options.rarity);
        }
        if (options.minPrice !== undefined) {
            conditions.push("(CASE WHEN m.current_bid IS NOT NULL THEN m.current_bid ELSE m.price END) >= ?");
            params.push(options.minPrice);
        }
        if (options.maxPrice !== undefined) {
            conditions.push("(CASE WHEN m.current_bid IS NOT NULL THEN m.current_bid ELSE m.price END) <= ?");
            params.push(options.maxPrice);
        }
        if (options.listingType) {
            conditions.push("m.listing_type = ?");
            params.push(options.listingType);
        }
        const whereClause = conditions.join(' AND ');
        // Đếm tổng
        const countResult = database_1.default.prepare(`
      SELECT COUNT(*) as c FROM market_listings m
      JOIN items t ON m.item_id = t.id
      WHERE ${whereClause}
    `).get(...params);
        const totalCount = countResult.c;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const offset = (page - 1) * limit;
        // Sort
        let orderBy = 'm.listed_at DESC';
        if (options.sortBy === 'price_asc')
            orderBy = 'COALESCE(m.current_bid, m.price) ASC';
        else if (options.sortBy === 'price_desc')
            orderBy = 'COALESCE(m.current_bid, m.price) DESC';
        else if (options.sortBy === 'oldest')
            orderBy = 'm.listed_at ASC';
        const listings = database_1.default.prepare(`
      SELECT m.*, u.name as seller_name, t.name as item_name, t.rarity as item_rarity, 
        t.type as item_type, t.description, i.stars, i.custom_stats
      FROM market_listings m
      JOIN users u ON m.seller_id = u.discord_id
      LEFT JOIN inventories i ON m.inventory_id = i.id
      JOIN items t ON m.item_id = t.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
        return { listings, totalCount, page, totalPages };
    }
    /**
     * Lấy tất cả listing đấu giá đang active
     */
    getActiveAuctions() {
        const now = Math.floor(Date.now() / 1000);
        return database_1.default.prepare("SELECT * FROM market_listings WHERE listing_type = 'auction' AND status = 'active' AND expires_at > ? ORDER BY expires_at ASC").all(now);
    }
    /**
     * Tính phí môi giới (broker fee) 5%
     */
    calculateBrokerFee(amount) {
        return Math.round(amount * 0.05);
    }
    /**
     * Tạo sự kiện chợ trời (đấu giá định kỳ hàng tuần)
     */
    createAuctionEvent(name, durationHours = 48) {
        const now = Math.floor(Date.now() / 1000);
        const existing = database_1.default.prepare("SELECT id FROM auction_events WHERE status IN ('upcoming', 'active')").get();
        if (existing)
            return { success: false, message: 'Đã có sự kiện đấu giá đang diễn ra hoặc sắp diễn ra!' };
        database_1.default.prepare(`
      INSERT INTO auction_events (name, started_at, ended_at, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(name, now, now + durationHours * 3600, now);
        const eventId = database_1.default.prepare('SELECT id FROM auction_events ORDER BY id DESC LIMIT 1').get().id;
        return { success: true, message: `🎪 **Sự kiện ${name} đã bắt đầu!** Thời gian: ${durationHours} giờ. Phí môi giới giảm còn 5%!`, eventId };
    }
    /**
     * Kết thúc sự kiện chợ trời
     */
    endAuctionEvent(eventId) {
        const event = database_1.default.prepare("SELECT * FROM auction_events WHERE id = ? AND status = 'active'").get(eventId);
        if (!event)
            return { success: false, message: 'Sự kiện không tồn tại hoặc đã kết thúc!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare("UPDATE auction_events SET status = 'ended', ended_at = ? WHERE id = ?").run(now, eventId);
        return { success: true, message: `🎪 Sự kiện **${event.name}** đã kết thúc!` };
    }
    /**
     * Lấy thông tin sự kiện đấu giá đang hoạt động
     */
    getActiveAuctionEvent() {
        const event = database_1.default.prepare("SELECT * FROM auction_events WHERE status = 'active' LIMIT 1").get();
        if (!event)
            return null;
        const now = Math.floor(Date.now() / 1000);
        const remainingHours = Math.max(0, Math.round((event.ended_at - now) / 3600 * 10) / 10);
        return {
            id: event.id,
            name: event.name,
            startedAt: event.started_at,
            endsAt: event.ended_at,
            remainingHours,
        };
    }
    // ─── Buy Orders (Ủy Thác Thu Mua) ───
    /**
     * Tạo đơn ủy thác thu mua
     */
    createBuyOrder(userId, itemId, quantity, unitPrice) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        if (quantity <= 0 || quantity > 999)
            return { success: false, message: 'Số lượng từ 1 đến 999!' };
        if (unitPrice <= 0)
            return { success: false, message: 'Giá phải > 0!' };
        const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(itemId);
        if (!item)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        const totalCost = quantity * unitPrice;
        const minPrice = this.getMinPriceForLevel(user.level);
        if (unitPrice < minPrice)
            return { success: false, message: `Cảnh giới yêu cầu giá tối thiểu **${minPrice} LT**/đơn vị!` };
        // Ký quỹ 10%
        const deposit = Math.round(totalCost * 0.10);
        const totalDeduct = totalCost + deposit;
        if (user.coin_ha_pham < totalDeduct) {
            return { success: false, message: `Không đủ Linh Thạch! (Cần: ${totalDeduct} LT gồm ${deposit} LT ký quỹ, Có: ${user.coin_ha_pham} LT)` };
        }
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + 7 * 24 * 3600; // 7 ngày
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - totalDeduct });
            const res = database_1.default.prepare(`
        INSERT INTO buy_orders (user_id, item_id, quantity, price_per_unit, total_cost, deposit, filled_quantity, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
      `).run(userId, itemId, quantity, unitPrice, totalCost, deposit, now, expiresAt);
            SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'create_buy_order', { orderId: res.lastInsertRowid, itemId, quantity, unitPrice, deposit });
        })();
        return {
            success: true,
            message: `📜 **Đã tạo đơn ủy thác!** Mua **${quantity}x ${item.name}** giá **${unitPrice} LT**/đơn vị.\n💰 Đã khấu trừ: **${totalCost} LT** (tiền hàng) + **${deposit} LT** (ký quỹ 10%).\n⏳ Hiệu lực: **7 ngày**.`,
            orderId: database_1.default.prepare('SELECT id FROM buy_orders WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId)?.id
        };
    }
    /**
     * Bán vào đơn ủy thác (người bán match với buy order)
     */
    fillBuyOrder(userId, orderId, quantity) {
        const seller = UserRepository_1.userRepository.get(userId);
        if (!seller)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const order = database_1.default.prepare("SELECT * FROM buy_orders WHERE id = ? AND status = 'active'").get(orderId);
        if (!order)
            return { success: false, message: 'Đơn ủy thác không tồn tại hoặc đã hoàn tất!' };
        if (order.user_id === userId)
            return { success: false, message: 'Không thể tự bán vào đơn ủy thác của mình!' };
        const remaining = order.quantity - order.filled_quantity;
        if (quantity > remaining)
            return { success: false, message: `Chỉ cần **${remaining}** vật phẩm nữa!` };
        // Kiểm tra người bán có đủ item không
        const sellerInv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const item = sellerInv.find(i => i.item_id === order.item_id && i.is_equipped === 0);
        if (!item || item.quantity < quantity)
            return { success: false, message: `Không đủ **${order.item_id}** trong hành trang!` };
        const buyer = UserRepository_1.userRepository.get(order.user_id);
        const payout = quantity * order.price_per_unit;
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            // Người bán nhận tiền
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: seller.coin_ha_pham + payout });
            // Chuyển item từ seller tới buyer
            const buyerInv = InventoryRepository_1.inventoryRepository.getUserInventory(order.user_id);
            const existing = buyerInv.find(i => i.item_id === order.item_id && i.is_equipped === 0 && i.equipable === 0);
            if (existing) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, item.id);
                if (item.quantity - quantity <= 0) {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
                }
            }
            else {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, item.id);
                if (item.quantity - quantity <= 0) {
                    database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
                }
                database_1.default.prepare("INSERT INTO inventories (user_id, item_id, quantity, created_at) VALUES (?, ?, ?, ?)")
                    .run(order.user_id, order.item_id, quantity, now);
            }
            // Cập nhật buy order
            const newFilled = order.filled_quantity + quantity;
            const newStatus = newFilled >= order.quantity ? 'completed' : 'active';
            database_1.default.prepare('UPDATE buy_orders SET filled_quantity = ?, status = ? WHERE id = ?')
                .run(newFilled, newStatus, orderId);
            // Nếu hoàn tất, trả lại ký quỹ cho buyer
            if (newStatus === 'completed') {
                if (buyer) {
                    UserRepository_1.userRepository.update(order.user_id, { coin_ha_pham: buyer.coin_ha_pham + order.deposit });
                }
            }
            // Ghi log
            const buyerName = buyer?.name || 'Không xác định';
            SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'fill_buy_order', { orderId, itemId: order.item_id, quantity, payout, buyerId: order.user_id });
        })();
        const itemName = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(order.item_id);
        return {
            success: true,
            message: `✅ **Bán thành công!** Đã bán **${quantity}x ${itemName?.name || order.item_id}** vào đơn ủy thác #${orderId}.\n💰 Nhận **${payout} LT**.`
        };
    }
    /**
     * Hủy đơn ủy thác thu mua (mất ký quỹ)
     */
    cancelBuyOrder(userId, orderId) {
        const order = database_1.default.prepare("SELECT * FROM buy_orders WHERE id = ? AND user_id = ?").get(orderId, userId);
        if (!order)
            return { success: false, message: 'Đơn ủy thác không tồn tại!' };
        if (order.status !== 'active')
            return { success: false, message: 'Đơn ủy thác đã hoàn tất hoặc bị hủy!' };
        const filled = order.filled_quantity;
        const unfilledQty = order.quantity - filled;
        const refund = unfilledQty * order.price_per_unit; // Hoàn tiền hàng chưa mua được
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            const user = UserRepository_1.userRepository.get(userId);
            if (user) {
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + refund });
            }
            database_1.default.prepare("UPDATE buy_orders SET status = 'cancelled' WHERE id = ?").run(orderId);
            SystemConfigService_1.systemConfigService.writeAuditLog(userId, 'cancel_buy_order', { orderId, refund, depositLost: order.deposit });
        })();
        return {
            success: true,
            message: `🚫 **Đã hủy đơn ủy thác #${orderId}.**\n💰 Hoàn lại: **${refund} LT** (${unfilledQty} x ${order.price_per_unit} LT).\n💸 Mất ký quỹ: **${order.deposit} LT**.`
        };
    }
    /**
     * Lấy danh sách buy orders đang active
     */
    getActiveBuyOrders(page = 1, limit = 10) {
        const countResult = database_1.default.prepare("SELECT COUNT(*) as c FROM buy_orders WHERE status = 'active'").get();
        const totalCount = countResult.c;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const offset = (page - 1) * limit;
        const orders = database_1.default.prepare(`
      SELECT b.*, u.name as buyer_name, i.name as item_name
      FROM buy_orders b
      JOIN users u ON b.user_id = u.discord_id
      LEFT JOIN items i ON b.item_id = i.id
      WHERE b.status = 'active'
      ORDER BY b.price_per_unit DESC, b.created_at ASC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
        return { orders, totalCount, page, totalPages };
    }
    /**
     * Lấy buy orders của user
     */
    getUserBuyOrders(userId) {
        return database_1.default.prepare(`
      SELECT b.*, i.name as item_name
      FROM buy_orders b
      LEFT JOIN items i ON b.item_id = i.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(userId);
    }
}
exports.marketService = new MarketService();
