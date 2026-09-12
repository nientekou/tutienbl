import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { getRealmDetails } from '../utils/constants';
import { ITEMS } from '../config/itemConstants';
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { EMBED_COLORS } from '../utils/uiSystem';

export interface TravelerItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export class TravelerService {
  private possibleItems = [
    { id: ITEMS.TINH_THACH_SHARD, name: 'Mảnh Tinh Thạch', price: 100, minQty: 1, maxQty: 5 },
    { id: ITEMS.LENH_BAI, name: 'Lệnh Bài Bí Cảnh', price: 50, minQty: 2, maxQty: 10 },
    { id: ITEMS.PILL_ALCHEMY_STAMINA, name: 'Bổ Thiên Đan', price: 30, minQty: 3, maxQty: 15 },
    { id: ITEMS.TANG_BAO_DO, name: 'Tàng Bảo Đồ (Hiếm)', price: 200, minQty: 1, maxQty: 3 }
  ];

  /**
   * Spawn Lão Nhân Thần Bí ngẫu nhiên
   */
  public async spawnTraveler(client: Client, channelId: string): Promise<boolean> {
    // Xóa/fled các Lão Nhân cũ nếu có
    db.prepare("UPDATE traveler_events SET status = 'fled' WHERE status = 'active'").run();

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = nowSec + 3600; // Tồn tại 1 tiếng

    // Tạo túi đồ bán ngẫu nhiên (chọn 2-3 món)
    const inventory: Record<string, TravelerItem> = {};
    const numItems = Math.floor(Math.random() * 2) + 2; // 2 hoặc 3 món
    const shuffled = [...this.possibleItems].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numItems; i++) {
      const itemDef = shuffled[i];
      const qty = Math.floor(Math.random() * (itemDef.maxQty - itemDef.minQty + 1)) + itemDef.minQty;
      inventory[itemDef.id] = {
        id: itemDef.id,
        name: itemDef.name,
        price: itemDef.price,
        quantity: qty
      };
    }

    const result = db.prepare(`
      INSERT INTO traveler_events (status, spawned_at, expires_at, inventory, channel_id, message_id)
      VALUES ('active', ?, ?, ?, ?, '')
    `).run(nowSec, expiresAt, JSON.stringify(inventory), channelId);

    const eventId = result.lastInsertRowid;

    // Thông báo ra kênh
    try {
      if (!/^\d{17,20}$/.test(channelId)) {
        console.error('[TravelerService] Invalid channelId (not a snowflake):', channelId);
        return false;
      }
      const channel = (client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('<:laonhan:1548386545298309140> Thanh Huyền Lão Nhân Xuất Hiện!')
          .setDescription(
              'Một lão nhân tóc bạc trắng, thân khoác thanh bào, chẳng rõ từ phương nào mà đến. ' +
              'Thoạt nhìn chỉ thấy thần thái điềm nhiên, nhưng người có nhãn lực ắt nhận ra đạo vận quanh thân sâu không thể dò.\n\n' +
              'Lão nhân mang theo một túi càn khôn, bên trong cất giữ không ít kỳ trân dị bảo. ' +
              'Nghe nói lão chỉ lưu lại nơi này một thời gian ngắn, tìm kiếm những người hữu duyên để trao đổi bảo vật.\n\n' +
              'Cơ duyên đã gặp, có giữ được hay không còn tùy vào bản lĩnh của mỗi người.\n\n' +
              '*(Lão nhân sẽ rời đi sau 1 giờ hoặc khi kỳ trân trong túi được trao đổi hết.)*'
)          .setColor(EMBED_COLORS.DARK_PURPLE)
          .addFields(
            { name: '### <:tvp2:1547866124924883044> Kỳ Trân', value: Object.values(inventory).map(i => `- **${i.name}** (Còn: ${i.quantity}) - Giá: ${i.price} LT`).join('\n') }
          )
          .setFooter({ text: 'Chú ý: Cướp đoạt Lão Nhân có tỷ lệ rớt cấp nếu thất bại!' });

        const buyButton = new ButtonBuilder()
          .setCustomId(`traveler_buy_${eventId}`)
          .setLabel('💰 Giao Dịch')
          .setStyle(ButtonStyle.Success);

        const robButton = new ButtonBuilder()
          .setCustomId(`traveler_rob_${eventId}`)
          .setLabel('⚔️ Đoạt Bảo')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buyButton, robButton);

        const msg = await channel.send({ embeds: [embed], components: [row] });

        // Cập nhật message_id
        db.prepare('UPDATE traveler_events SET message_id = ? WHERE id = ?').run(msg.id, eventId);
        return true;
      }
    } catch (e) {
      console.error('[TravelerService] Error sending spawn message:', e);
    }
    return false;
  }

  /**
   * Mua vật phẩm từ Lão Nhân
   */
  public buyItem(userId: string, eventId: number, itemId: string, quantity: number): { success: boolean, message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo Hữu chưa khởi tạo nhân vật!' };

    // Transaction để đảm bảo tính nguyên vẹn (Race condition)
    let result = { success: false, message: 'Lỗi giao dịch.' };
    
    db.transaction(() => {
      const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
      if (!event || event.status !== 'active') {
        result = { success: false, message: 'Lão Nhân đã rời đi hoặc sự kiện đã kết thúc!' };
        return;
      }

      let inventory: Record<string, TravelerItem> = {};
      try {
        inventory = JSON.parse(event.inventory || '{}');
      } catch (e) { console.warn('[Thanh Huyền Lão Nhân] Mở rương thất bại:', e); }

      const item = inventory[itemId];
      if (!item) {
        result = { success: false, message: 'Lão Nhân không bán vật phẩm này!' };
        return;
      }

      if (item.quantity < quantity) {
        result = { success: false, message: `Lão Nhân chỉ còn lại **${item.quantity}** ${item.name}!` };
        return;
      }

      const totalCost = item.price * quantity;
      if (user.coin_ha_pham < totalCost) {
        result = { success: false, message: `Đạo Hữu không đủ linh thạch! (Cần ${totalCost} LT, hiện có ${user.coin_ha_pham} LT)` };
        return;
      }

      // Trừ tiền, thêm đồ (Giả lập thêm đồ qua InventoryService hoặc repository)
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - totalCost });
      
      // Thêm item
      const { inventoryRepository } = require('../database/repositories/InventoryRepository');
      inventoryRepository.addItem(userId, itemId, quantity);

      // Cập nhật Inventory của Lão Nhân
      item.quantity -= quantity;
      
      let newStatus = event.status;
      // Kiểm tra xem đã hết sạch hàng chưa
      const totalRemaining = Object.values(inventory).reduce((acc, curr) => acc + curr.quantity, 0);
      if (totalRemaining <= 0) {
        newStatus = 'sold_out';
      }

      db.prepare('UPDATE traveler_events SET inventory = ?, status = ? WHERE id = ?')
        .run(JSON.stringify(inventory), newStatus, eventId);

      result = { 
        success: true, 
        message: `Đạo Hữu đã mua thành công **${quantity}x ${item.name}** với giá **${totalCost} Linh thạch**!` 
      };
    })();

    return result;
  }

  /**
   * Cướp Lão Nhân
   */
  public challengeTraveler(userId: string, eventId: number): { success: boolean, message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo Hữu chưa khởi tạo nhân vật!' };

    let result = { success: false, message: 'Lỗi chiến đấu.' };

    db.transaction(() => {
      const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
      if (!event || event.status !== 'active') {
        result = { success: false, message: 'Lão Nhân đã không còn ở đây nữa!' };
        return;
      }

      // Tỷ lệ thắng 15% để cân bằng.
      const winChance = 0.15; 
      const isWin = Math.random() < winChance;

      if (isWin) {
        // Gom hết đồ còn lại
        let inventory: Record<string, TravelerItem> = {};
        try { inventory = JSON.parse(event.inventory || '{}'); } catch (e) { console.warn('[TravelerService] Failed to parse traveler loot inventory:', e); }

        const itemsLooted: string[] = [];
        const { inventoryRepository } = require('../database/repositories/InventoryRepository');
        
        for (const [id, item] of Object.entries(inventory)) {
          if (item.quantity > 0) {
            inventoryRepository.addItem(userId, item.id, item.quantity);
            itemsLooted.push(`**${item.quantity}x ${item.name}**`);
          }
        }

        db.prepare("UPDATE traveler_events SET status = 'defeated', inventory = '{}' WHERE id = ?").run(eventId);

        result = { 
          success: true, 
          message: `### ⚔️ Đạo Hữu đã thắng trận!\nThanh Huyền Lão Nhân khẽ vuốt râu, trên môi thoáng hiện một nụ cười khó hiểu. Lão không nói thắng bại, chỉ tiện tay để lại túi càn khôn rồi xoay người rời bước.\nChẳng biết từ lúc nào, bóng áo xanh đã hòa vào mây xa. Đến khi Đạo Hữu nhìn lại, nơi ấy chỉ còn gió nhẹ phất qua.\nNhận được: ${itemsLooted.length > 0 ? itemsLooted.join(', ') : 'Không có gì'}` 
        };
      } else {
        // Trừ 1 level
        const currentRealm = getRealmDetails(user.level);
        let newLevel = user.level - 1;
        if (newLevel < 1) newLevel = 1; // Khong rớt dưới 1

        const newRealm = getRealmDetails(newLevel);
        const { cultivationService } = require('./CultivationService');
        const newExpNeeded = cultivationService.calculateNextExp(newLevel);
        
        userRepository.update(userId, { level: newLevel, tu_vi: 0, exp_needed: newExpNeeded });

        result = {
          success: false,
          message: `### ☠️ Một chiêu đã phân thắng bại.\nThanh Huyền Lão Nhân chỉ khẽ phất tay áo. Đạo vận quanh thân chợt ép xuống, khiến Đạo Hữu khí huyết đảo nghịch, kinh mạch chấn động, tu vi tổn hao.\nCảnh giới rớt xuống **${newRealm.realmName}**!`
        };
      }
    })();

    return result;
  }

  /**
   * Khởi tạo service và cronjob kiểm tra spawn ngẫu nhiên mỗi giờ
   */
  public init(client: Client) {
    // Spawn ngay lần đầu khi bot khởi động (sau 30s)
    setTimeout(() => this.checkRandomSpawn(client), 30_000);
    setInterval(() => {
      this.checkRandomSpawn(client);
    }, 30 * 60 * 1000); // Mỗi 30 phút chạy 1 lần
  }

  /**
   * Cronjob kiểm tra spawn ngẫu nhiên
   */
  public checkRandomSpawn(client: Client) {
    const guilds = db.prepare('SELECT guild_id, event_channel_id, tuluyen_channel_id, interaction_count FROM guild_configs').all() as any[];
    for (const g of guilds) {
      if (!client.guilds.cache.has(g.guild_id)) {
        db.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(g.guild_id);
        continue;
      }
      const targetChannelId = g.event_channel_id || g.tuluyen_channel_id;
      if (!targetChannelId) continue;

      const activity = g.interaction_count || 0;
      // Tỷ lệ xuất hiện cơ bản 10%, mỗi lượt tương tác tăng thêm 2% cơ hội, tối đa 60%
      const chance = Math.min(0.60, 0.10 + activity * 0.02);

      if (Math.random() < chance) {
        this.spawnTraveler(client, targetChannelId);
      }

      // Khấu hao (decay) điểm hoạt động 30% mỗi 30 phút
      const newActivity = Math.floor(activity * 0.7);
      db.prepare('UPDATE guild_configs SET interaction_count = ? WHERE guild_id = ?').run(newActivity, g.guild_id);
    }
  }
}

export const travelerService = new TravelerService();
