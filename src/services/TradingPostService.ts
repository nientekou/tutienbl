// V16 C-02: Trading Post (Chợ Đồng Hành)
import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

class TradingPostService {
  private initTable(): void {
    db.exec(`
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

  public createListing(userId: string, itemId: string, itemName: string, quantity: number, price: number, durationHours: number = 48): { success: boolean; message: string; listingId?: number } {
    this.initTable();
    if (price < 100) return { success: false, message: '❌ Giá tối thiểu 100 LT.' };
    if (quantity < 1) return { success: false, message: '❌ Số lượng tối thiểu 1.' };

    const now = Math.floor(Date.now() / 1000);
    const info = db.prepare(
      'INSERT INTO trading_posts (seller_id, item_id, item_name, quantity, ask_price, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, itemId, itemName, quantity, price, 'pending', now, now + durationHours * 3600);

    return { success: true, message: `Đã đăng **${quantity}x ${itemName}** với giá ${price} LT.`, listingId: info.lastInsertRowid as number };
  }

  public acceptTrade(userId: string, listingId: number): { success: boolean; message: string } {
    this.initTable();
    const listing = db.prepare('SELECT * FROM trading_posts WHERE id = ? AND status = ?').get(listingId, 'pending') as any;
    if (!listing) return { success: false, message: '❌ Giao dịch không tồn tại hoặc đã hoàn thành.' };
    if (listing.seller_id === userId) return { success: false, message: '❌ Không thể mua vật phẩm của mình.' };

    const buyer = userRepository.get(userId);
    if (!buyer) return { success: false, message: '❌ Chưa tạo nhân vật.' };
    if (buyer.coin_ha_pham < listing.ask_price) return { success: false, message: `❌ Không đủ ${listing.ask_price} LT.` };

    // Execute trade
    const tax = Math.ceil(listing.ask_price * 0.03); // 3% tax
    const sellerReceive = listing.ask_price - tax;

    userRepository.update(userId, { coin_ha_pham: buyer.coin_ha_pham - listing.ask_price });
    userRepository.update(listing.seller_id, { coin_ha_pham: (userRepository.get(listing.seller_id)?.coin_ha_pham || 0) + sellerReceive });

    db.prepare('UPDATE trading_posts SET buyer_id = ?, status = ? WHERE id = ?')
      .run(userId, 'completed', listingId);

    return { success: true, message: `✅ Đã mua **${listing.quantity}x ${listing.item_name}** với ${listing.ask_price} LT! (Thuế: ${tax} LT)` };
  }

  public getActiveListings(): { id: number; itemName: string; quantity: number; price: number; seller: string; timeLeft: string }[] {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const rows = db.prepare(
      'SELECT * FROM trading_posts WHERE status = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 20'
    ).all('pending', now) as any[];

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

  public getListingDescription(): string {
    const listings = this.getActiveListings();
    if (listings.length === 0) return '🏪 **Chợ Đồng Hành** — Chưa có vật phẩm nào.';
    let msg = '🏪 **Chợ Đồng Hành**\n\n';
    for (const l of listings) {
      msg += `• **${l.quantity}x ${l.itemName}** — ${l.price} LT (Còn ${l.timeLeft})\n`;
    }
    return msg;
  }
}

export const tradingPostService = new TradingPostService();
