import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-04: Fashion / Cosmetic System

interface OutfitDef {
  id: string;
  name: string;
  description: string;
  slot: 'outfit' | 'hat' | 'accessory' | 'effect';
  rarity: string;
  price: number;
  bonus?: { stat: string; value: number };
}

const OUTFITS: OutfitDef[] = [
  { id: 'outfit_robe_white', name: 'Áo Trắng Phục', description: 'Áo choàng trắng tinh khôi', slot: 'outfit', rarity: 'common', price: 5000 },
  { id: 'outfit_robe_purple', name: 'Áo Tím Bất Tử', description: 'Áo choàng tím huyền bí', slot: 'outfit', rarity: 'rare', price: 20000, bonus: { stat: 'all_stats', value: 0.01 } },
  { id: 'outfit_robe_gold', name: 'Áo Vàng Chiếu Thế', description: 'Áo choàng vàng rực rỡ', slot: 'outfit', rarity: 'epic', price: 50000, bonus: { stat: 'all_stats', value: 0.02 } },
  { id: 'outfit_armor_iron', name: 'Giáp Sắt', description: 'Giáp sắt vững chắc', slot: 'outfit', rarity: 'uncommon', price: 15000, bonus: { stat: 'def', value: 0.02 } },
  { id: 'hat_crown_jade', name: 'Miện Ngọc', description: 'Miện ngọc thiên nhiên', slot: 'hat', rarity: 'rare', price: 15000, bonus: { stat: 'luck', value: 0.02 } },
  { id: 'hat_hood_shadow', name: 'Mũ Màu Bóng Tối', description: 'Mũ ẩn thân', slot: 'hat', rarity: 'uncommon', price: 10000, bonus: { stat: 'dodge', value: 0.02 } },
  { id: 'hat_halo_light', name: 'Quang Hào', description: 'Quang hào thần thánh', slot: 'hat', rarity: 'epic', price: 40000, bonus: { stat: 'hp', value: 0.03 } },
  { id: 'acc_ring_fire', name: 'Nhẫn Lửa', description: 'Nhẫn hơi thở lửa', slot: 'accessory', rarity: 'rare', price: 25000, bonus: { stat: 'fire_dmg', value: 0.03 } },
  { id: 'acc_necklace_moon', name: 'Dây Chuyền Mặt Trăng', description: 'Dây chuyền ánh sáng mặt trăng', slot: 'accessory', rarity: 'epic', price: 45000, bonus: { stat: 'med_exp', value: 0.05 } },
  { id: 'acc_ring_luck', name: 'Nhẫn Hạnh Phúc', description: 'Nhẫn mang lại may mắn', slot: 'accessory', rarity: 'uncommon', price: 12000, bonus: { stat: 'luck', value: 0.05 } },
  { id: 'fx_aura_fire', name: 'Quang Hào Phụng', description: 'Hiệu ứng lửa cháy quanh người', slot: 'effect', rarity: 'epic', price: 60000 },
  { id: 'fx_trail_ice', name: 'Dấu Vết Băng Giá', description: 'Dấu vết băng khi di chuyển', slot: 'effect', rarity: 'rare', price: 30000 },
  { id: 'fx_aura_phoenix', name: 'Quang Phượng Hoàng', description: 'Quang phượng hoàng kim phục', slot: 'effect', rarity: 'legendary', price: 100000, bonus: { stat: 'all_stats', value: 0.03 } },
];

class FashionService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_fashion (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        equipped INTEGER DEFAULT 0,
        slot TEXT DEFAULT 'outfit',
        purchased_at INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, item_id)
      );
    `);
  }

  buyOutfit(userId: string, itemId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const item = OUTFITS.find(o => o.id === itemId);
    if (!item) return { success: false, message: 'Trang phục không tồn tại' };

    const owned = db.prepare('SELECT 1 FROM user_fashion WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (owned) return { success: false, message: 'Đã sở hữu trang phục này' };

    if (user.coin_ha_pham < item.price) {
      return { success: false, message: `Không đủ Linh Thạch! Cần ${item.price}` };
    }

    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - item.price });

    db.prepare('INSERT INTO user_fashion (user_id, item_id, equipped, slot, purchased_at) VALUES (?, ?, 0, ?, ?)')
      .run(userId, itemId, item.slot, Math.floor(Date.now() / 1000));

    return { success: true, message: `👗 Mua thành công: **${item.name}**!` };
  }

  equipOutfit(userId: string, itemId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const owned = db.prepare('SELECT * FROM user_fashion WHERE user_id = ? AND item_id = ?').get(userId, itemId) as any;
    if (!owned) return { success: false, message: 'Đạo hữu không sở hữu vật phẩm này' };

    const item = OUTFITS.find(o => o.id === itemId);
    if (!item) return { success: false, message: 'Trang phục không tồn tại' };

    db.transaction(() => {
      db.prepare('UPDATE user_fashion SET equipped = 0 WHERE user_id = ? AND slot = ?').run(userId, item.slot);
      db.prepare('UPDATE user_fashion SET equipped = 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    })();

    return { success: true, message: `👗 Đã trang bị: **${item.name}**!` };
  }

  unequipSlot(userId: string, slot: string): { success: boolean; message: string } {
    this.initTable();
    db.prepare('UPDATE user_fashion SET equipped = 0 WHERE user_id = ? AND slot = ? AND equipped = 1').run(userId, slot);
    return { success: true, message: `Đã tháo trang bị ở slot ${slot}.` };
  }

  getFashionBonuses(userId: string): Record<string, number> {
    this.initTable();
    const equipped = db.prepare('SELECT item_id FROM user_fashion WHERE user_id = ? AND equipped = 1').all(userId) as any[];
    const bonuses: Record<string, number> = {};

    for (const row of equipped) {
      const item = OUTFITS.find(o => o.id === row.item_id);
      if (item?.bonus) {
        bonuses[item.bonus.stat] = (bonuses[item.bonus.stat] || 0) + item.bonus.value;
      }
    }
    return bonuses;
  }

  getFashionDescription(userId: string): string {
    this.initTable();
    const owned = db.prepare('SELECT item_id, equipped, slot FROM user_fashion WHERE user_id = ?').all(userId) as any[];

    let msg = `👗 **Thoi Trang**\n━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (owned.length === 0) {
      msg += `Chua co trang phuc nao. Mua tai \`/shop\``;
      return msg;
    }

    const slots = ['outfit', 'hat', 'accessory', 'effect'] as const;
    const slotNames: Record<string, string> = { outfit: 'Ao choang', hat: 'Mui/Non', accessory: 'Phu kien', effect: 'Hieu ung' };

    for (const slot of slots) {
      const slotItems = owned.filter(o => o.slot === slot);
      if (slotItems.length === 0) continue;

      msg += `\n**${slotNames[slot] || slot}:**\n`;
      for (const si of slotItems) {
        const item = OUTFITS.find(o => o.id === si.item_id);
        const equipped = si.equipped ? ' ✅' : '';
        msg += `• ${item?.name || si.item_id}${equipped}`;
        if (item?.bonus) msg += ` (${item.bonus.stat} +${Math.round(item.bonus.value * 100)}%)`;
        msg += '\n';
      }
    }

    return msg;
  }
}

export const fashionService = new FashionService();
