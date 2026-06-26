import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-01: Housing System

interface HouseType {
  id: string;
  name: string;
  description: string;
  price: number;
  slots: number;
}

interface FurnitureDef {
  id: string;
  name: string;
  description: string;
  bonus: { stat: string; value: number };
  price: number;
}

const HOUSE_TYPES: HouseType[] = [
  { id: 'house_basic', name: 'Nhà Gỗ', description: 'Một căn nhà gỗ đơn sơ', price: 10000, slots: 5 },
  { id: 'house_stone', name: 'Nhà Đá', description: 'Một căn nhà đá vững chắc', price: 50000, slots: 8 },
  { id: 'house_mansion', name: 'Lâu Đài', description: 'Một lâu đài tráng lệ', price: 200000, slots: 12 },
];

const FURNITURE_LIST: FurnitureDef[] = [
  { id: 'furn_bed', name: 'Giường Ngủ', description: '+5% hồi HP', bonus: { stat: 'hp_regen', value: 0.05 }, price: 1000 },
  { id: 'furn_table', name: 'Bàn Làm Việc', description: '+5% tốc độ chế tạo', bonus: { stat: 'craft_speed', value: 0.05 }, price: 1500 },
  { id: 'furn_chair', name: 'Ghế Thư Giãn', description: '+5% EXP từ thiền định', bonus: { stat: 'med_exp', value: 0.05 }, price: 800 },
  { id: 'furn_bookshelf', name: 'Kệ Sách', description: '+3% tất cả chỉ số', bonus: { stat: 'all_stats', value: 0.03 }, price: 3000 },
  { id: 'furn_painting', name: 'Tranh Vẽ', description: '+5% may mắn', bonus: { stat: 'luck', value: 0.05 }, price: 2000 },
  { id: 'furn_fireplace', name: 'Lò Hơi', description: '+5% sát thương hoả', bonus: { stat: 'fire_dmg', value: 0.05 }, price: 2500 },
  { id: 'furn_garden', name: 'Vườn Nhỏ', description: '+10% tỷ lệ rơi thảo dược', bonus: { stat: 'herb_drop', value: 0.10 }, price: 5000 },
  { id: 'furn_trophy', name: 'Kỷ Niệm', description: '+5% tất cả chỉ số', bonus: { stat: 'all_stats', value: 0.05 }, price: 10000 },
];

interface DecorationDef {
  id: string;
  name: string;
  description: string;
  bonus: { stat: string; value: number };
  price: number;
}

const DECORATIONS: DecorationDef[] = [
  { id: 'deco_banner', name: 'Cờ Phái', description: 'Cờ phái huyền bí', bonus: { stat: 'all_stats', value: 0.01 }, price: 8000 },
  { id: 'deco_lantern', name: 'Đèn Lồng', description: 'Đèn lồng sáng chói', bonus: { stat: 'luck', value: 0.03 }, price: 3000 },
  { id: 'deco_sword_rack', name: 'Kệ Gươm', description: 'Kệ hiển thị vũ khí', bonus: { stat: 'atk', value: 0.02 }, price: 12000 },
  { id: 'deco_fountain', name: 'Phun Nước', description: 'Phun nước thần tính', bonus: { stat: 'hp_regen', value: 0.03 }, price: 15000 },
  { id: 'deco_statue', name: 'Tượng Phật', description: 'Tượng Phật an nhiên', bonus: { stat: 'def', value: 0.02 }, price: 20000 },
];

class HousingService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_houses (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        house_type TEXT DEFAULT 'house_basic',
        furniture TEXT DEFAULT '[]',
        decorations TEXT DEFAULT '[]'
      );
    `);
  }

  /**
   * B-01: Buy house
   */
  buyHouse(userId: string, houseType: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const house = HOUSE_TYPES.find(h => h.id === houseType);
    if (!house) return { success: false, message: 'Nhà không tồn tại' };

    if (user.coin_ha_pham < house.price) {
      return { success: false, message: `Không đủ Linh Thạch! Cần ${house.price}` };
    }

    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - house.price });

    db.prepare('INSERT OR REPLACE INTO user_houses (user_id, house_type) VALUES (?, ?)')
      .run(userId, houseType);

    return { success: true, message: `Đã mua **${house.name}**!` };
  }

  /**
   * B-01: Buy furniture
   */
  buyFurniture(userId: string, furnitureId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const furniture = FURNITURE_LIST.find(f => f.id === furnitureId);
    if (!furniture) return { success: false, message: 'Nội thất không tồn tại' };

    if (user.coin_ha_pham < furniture.price) {
      return { success: false, message: `Không đủ Linh Thạch! Cần ${furniture.price}` };
    }

    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - furniture.price });

    // Add furniture to house
    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(userId) as any;
    if (house) {
      const currentFurniture = JSON.parse(house.furniture || '[]');
      currentFurniture.push(furnitureId);
      db.prepare('UPDATE user_houses SET furniture = ? WHERE user_id = ?')
        .run(JSON.stringify(currentFurniture), userId);
    }

    return { success: true, message: `Đã mua **${furniture.name}**!` };
  }

  /**
   * B-01: Get house bonuses
   */
  getHouseBonuses(userId: string): Record<string, number> {
    this.initTable();
    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(userId) as any;
    if (!house) return {};

    const furnitureIds: string[] = JSON.parse(house.furniture || '[]');
    const bonuses: Record<string, number> = {};

    for (const fId of furnitureIds) {
      const furniture = FURNITURE_LIST.find(f => f.id === fId);
      if (furniture) {
        bonuses[furniture.bonus.stat] = (bonuses[furniture.bonus.stat] || 0) + furniture.bonus.value;
      }
    }

    return bonuses;
  }

  /**
   * B-01: Get housing description
   */
  getHousingDescription(userId: string): string {
    this.initTable();
    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(userId) as any;

    let msg = `🏠 **Nhà Ở**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (!house) {
      msg += `Chưa có nhà. Mua tại \`/shop\``;
    } else {
      const houseType = HOUSE_TYPES.find(h => h.id === house?.house_type);
      const furnitureIds: string[] = JSON.parse(house.furniture || '[]');
      const decoIds: string[] = JSON.parse(house.decorations || '[]');

      msg += `🏠 **${houseType?.name || house.house_type}** (${houseType?.slots || 5} slots)\n`;
      msg += `🪑 **Đồ gỗ:** ${furnitureIds.length}/${houseType?.slots || 5}\n`;
      msg += `🎨 **Trang trí:** ${decoIds.length}/5\n`;

      if (furnitureIds.length > 0) {
        msg += `\n**Đồ gỗ:**\n`;
        for (const fId of furnitureIds) {
          const furniture = FURNITURE_LIST.find(f => f.id === fId);
          if (furniture) msg += `• ${furniture.name}: ${furniture.description}\n`;
        }
      }

      if (decoIds.length > 0) {
        msg += `\n**Trang trí:**\n`;
        for (const dId of decoIds) {
          const deco = DECORATIONS.find(d => d.id === dId);
          if (deco) msg += `• ${deco.name}: ${deco.description}\n`;
        }
      }
    }

    return msg;
  }

  // === Decorations ===

  buyDecoration(userId: string, decoId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const deco = DECORATIONS.find(d => d.id === decoId);
    if (!deco) return { success: false, message: 'Trang trí không tồn tại' };

    if (user.coin_ha_pham < deco.price) {
      return { success: false, message: `Không đủ Linh Thạch! Cần ${deco.price}` };
    }

    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(userId) as any;
    if (!house) return { success: false, message: 'Hãy mua nhà trước!' };

    const decos: string[] = JSON.parse(house.decorations || '[]');
    if (decos.length >= 5) return { success: false, message: 'Ô trang trí đã đầy (tối đa 5)!' };
    if (decos.includes(decoId)) return { success: false, message: 'Đã có trang trí này' };

    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - deco.price });

    decos.push(decoId);
    db.prepare('UPDATE user_houses SET decorations = ? WHERE user_id = ?')
      .run(JSON.stringify(decos), userId);

    return { success: true, message: `🎨 Mua trang trí: **${deco.name}**!` };
  }

  // === Visit Other Houses ===

  visitHouse(visitorId: string, ownerId: string): string {
    this.initTable();
    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(ownerId) as any;
    if (!house) return `🏠 Người dùng chưa có nhà.`;

    const owner = userRepository.get(ownerId);
    const houseType = HOUSE_TYPES.find(h => h.id === house?.house_type);
    const furnitureIds: string[] = JSON.parse(house.furniture || '[]');
    const decoIds: string[] = JSON.parse(house.decorations || '[]');

    let msg = `🏠 **Nhà của ${owner?.name || ownerId}**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏠 **${houseType?.name || house.house_type}**\n`;
    msg += `🪑 Đồ gỗ: ${furnitureIds.length} | Trang trí: ${decoIds.length}\n`;

    if (furnitureIds.length > 0) {
      msg += `\n**Đồ gỗ:**\n`;
      for (const fId of furnitureIds) {
        const furniture = FURNITURE_LIST.find(f => f.id === fId);
        if (furniture) msg += `• ${furniture.name}\n`;
      }
    }

    if (decoIds.length > 0) {
      msg += `\n**Trang trí:**\n`;
      for (const dId of decoIds) {
        const deco = DECORATIONS.find(d => d.id === dId);
        if (deco) msg += `• ${deco.name}\n`;
      }
    }

    return msg;
  }

  getDecorationBonuses(userId: string): Record<string, number> {
    this.initTable();
    const house = db.prepare('SELECT * FROM user_houses WHERE user_id = ?').get(userId) as any;
    if (!house) return {};

    const decoIds: string[] = JSON.parse(house.decorations || '[]');
    const bonuses: Record<string, number> = {};

    for (const dId of decoIds) {
      const deco = DECORATIONS.find(d => d.id === dId);
      if (deco) {
        bonuses[deco.bonus.stat] = (bonuses[deco.bonus.stat] || 0) + deco.bonus.value;
      }
    }

    return bonuses;
  }
}

export const housingService = new HousingService();
