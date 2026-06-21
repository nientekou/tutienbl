import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export interface TreasureLocation {
  id: number;
  owner_id: string;
  coord_x: number;
  coord_y: number;
  location_name: string;
  rarity: string;
  created_at: number;
  expires_at: number;
  is_claimed: number;
}

const LOCATION_NAMES = [
  'Hang Động Tử Cấm',
  'Thánh Địa U Minh',
  'Sơn Cốc Vạn Hoa',
  'Băng Sơn Thần Bí',
  'Rừng Cổ Tích',
  'Hỏa Diệm Sơn',
  'Cổ Mộ Hoàng Đế',
  'Thần Điện Thượng Cổ',
  'Thác Ngân Nguyệt',
  'Động Tiên Bồng Lai',
  'Lăng Mộ Cổ Long',
  'Tháp Vân Tiêu',
  'Hang Yêu Tinh',
  'Linh Trì Bách Hoa',
  'Núi Băng Thiên Sơn',
];

const COMMON_MATERIALS = ['material_linh_thao_1', 'material_iron_1'];
const RARE_MATERIALS = ['material_nhan_sam_1', 'material_tinh_thiet_1'];
const EPIC_MATERIALS = ['item_pet_evolve', 'material_lingzhi', 'material_tuyet_lien'];

class MapFragmentService {
  public addFragment(userId: string): void {
    inventoryRepository.addItem(userId, 'map_fragment', 1);
  }

  public getFragmentCount(userId: string): number {
    const inv = inventoryRepository.getUserInventory(userId);
    const frag = inv.find(i => i.item_id === 'map_fragment');
    return frag ? frag.quantity : 0;
  }

  public combineFragments(userId: string): { success: boolean; message: string; location?: TreasureLocation } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Đạo hữu chưa tạo nhân vật!' };

    const count = this.getFragmentCount(userId);
    if (count < 5) {
      return { success: false, message: `❌ Cần 5 Mảnh Bản Đồ để ghép. Hiện có: **${count}/5**.` };
    }

    const removed = inventoryRepository.removeItem(userId, 'map_fragment', 5);
    if (!removed) return { success: false, message: '❌ Không thể tiêu hao Mảnh Bản Đồ.' };

    const now = Math.floor(Date.now() / 1000);
    const coordX = Math.floor(Math.random() * 1000) + 1;
    const coordY = Math.floor(Math.random() * 1000) + 1;
    const rarity = this.getRandomRarity();
    const locationName = LOCATION_NAMES[Math.floor(Math.random() * LOCATION_NAMES.length)];
    const expiresAt = now + 24 * 3600;

    const result = db.prepare(`
      INSERT INTO treasure_locations (owner_id, coord_x, coord_y, location_name, rarity, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, coordX, coordY, locationName, rarity, now, expiresAt);

    const location: TreasureLocation = {
      id: Number(result.lastInsertRowid),
      owner_id: userId,
      coord_x: coordX,
      coord_y: coordY,
      location_name: locationName,
      rarity,
      created_at: now,
      expires_at: expiresAt,
      is_claimed: 0,
    };

    return {
      success: true,
      message: `✅ **GHÉP BẢN ĐỒ THÀNH CÔNG!**\n\nMảnh Bản Đồ hé lộ vị trí kho báu:\n📍 **${locationName}** [${coordX}, ${coordY}]\n📦 Độ hiếm: **${this.getRarityLabel(rarity)}**\n⏳ Hết hạn sau: **24 giờ**\n\nHãy nhanh chân đến đó trước khi kẻ khác cướp mất!`,
      location,
    };
  }

  public getActiveLocations(userId: string): TreasureLocation[] {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`
      SELECT * FROM treasure_locations
      WHERE owner_id = ? AND is_claimed = 0 AND expires_at > ?
      ORDER BY created_at DESC
    `).all(userId, now) as TreasureLocation[];
  }

  public getLocationById(locationId: number): TreasureLocation | null {
    return db.prepare('SELECT * FROM treasure_locations WHERE id = ?').get(locationId) as TreasureLocation | null;
  }

  public stealLocation(userId: string, locationId: number): { success: boolean; message: string } {
    const location = this.getLocationById(locationId);
    if (!location) return { success: false, message: '❌ Không tìm thấy vị trí kho báu này.' };
    if (location.owner_id === userId) return { success: false, message: '❌ Đây là kho báu của bạn! Không thể cướp của chính mình.' };
    if (location.is_claimed) return { success: false, message: '❌ Kho báu này đã bị khai thác.' };

    const now = Math.floor(Date.now() / 1000);
    if (location.expires_at <= now) return { success: false, message: '❌ Kho báu đã hết hạn (24h).' };

    const success = Math.random() < 0.5;
    if (!success) {
      return { success: false, message: `❌ **CƯỚP THẤT BẠI!**\n\nKho báu tại **${location.location_name}** được bảo vệ bởi cấm chế cổ xưa. Đạo hữu đã bị thương nhẹ khi cố gắng phá giải.\n\n*Hãy thử lại hoặc tìm kho báu khác.*` };
    }

    db.prepare('UPDATE treasure_locations SET owner_id = ?, created_at = ?, expires_at = ? WHERE id = ?')
      .run(userId, now, now + 24 * 3600, locationId);

    return {
      success: true,
      message: `✅ **CƯỚP THÀNH CÔNG!**\n\nĐạo hữu đã cướp thành công kho báu **${location.location_name}** tại [${location.coord_x}, ${location.coord_y}]!\n\n⏳ Hạn sử dụng: **24 giờ** (kể từ bây giờ)\nHãy nhanh chóng đến khai thác trước khi bị cướp lại!`,
    };
  }

  public claimLocation(userId: string, locationId: number): { success: boolean; message: string; rewards?: string[] } {
    const location = this.getLocationById(locationId);
    if (!location) return { success: false, message: '❌ Không tìm thấy vị trí kho báu này.' };
    if (location.owner_id !== userId) return { success: false, message: '❌ Đây không phải kho báu của bạn.' };
    if (location.is_claimed) return { success: false, message: '❌ Kho báu này đã được khai thác trước đó.' };

    const now = Math.floor(Date.now() / 1000);
    if (location.expires_at <= now) return { success: false, message: '❌ Kho báu đã hết hạn. Mảnh Bản Đồ đã mất đi linh khí.' };

    db.prepare('UPDATE treasure_locations SET is_claimed = 1 WHERE id = ?').run(locationId);

    const rewards = this.grantRewards(userId, location.rarity);
    return {
      success: true,
      message: `🎉 **KHAI THÁC KHO BÁU THÀNH CÔNG!**\n\nĐạo hữu đã tìm thấy kho báu tại **${location.location_name}** [${location.coord_x}, ${location.coord_y}]!\nĐộ hiếm: **${this.getRarityLabel(location.rarity)}**\n\n**Phần thưởng nhận được:**\n${rewards.join('\n')}`,
      rewards,
    };
  }

  private grantRewards(userId: string, rarity: string): string[] {
    const rewardTexts: string[] = [];
    const user = userRepository.get(userId);
    if (!user) return rewardTexts;

    switch (rarity) {
      case 'legendary': {
        const ltAmount = 50000;
        userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + ltAmount });
        rewardTexts.push(`🟤 **${ltAmount.toLocaleString()}** Hạ Phẩm Linh Thạch`);

        const knbAmount = 10;
        userRepository.update(userId, { knb: (user.knb || 0) + knbAmount });
        rewardTexts.push(`💎 **${knbAmount}** KNB`);

        inventoryRepository.addItem(userId, 'manh_vo_vu_khi', 1);
        rewardTexts.push(`🗡️ **Mảnh Vỡ Vũ Khí Huyền Thoại** x1`);
        break;
      }
      case 'epic': {
        const ltAmount = 15000;
        userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + ltAmount });
        rewardTexts.push(`🟤 **${ltAmount.toLocaleString()}** Hạ Phẩm Linh Thạch`);

        const knbAmount = 3;
        userRepository.update(userId, { knb: (user.knb || 0) + knbAmount });
        rewardTexts.push(`💎 **${knbAmount}** KNB`);

        const epicMat = EPIC_MATERIALS[Math.floor(Math.random() * EPIC_MATERIALS.length)];
        inventoryRepository.addItem(userId, epicMat, 2);
        rewardTexts.push(`🎁 Nguyên liệu Epic **x2**`);

        if (Math.random() < 0.2) {
          inventoryRepository.addItem(userId, 'item_pet_evolve', 1);
          rewardTexts.push(`🥚 **Linh Thú Tiến Hóa Đan** (Cơ hội nhận trứng thú cưng!)`);
        }
        break;
      }
      case 'rare': {
        const ltAmount = 5000;
        userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + ltAmount });
        rewardTexts.push(`🟤 **${ltAmount.toLocaleString()}** Hạ Phẩm Linh Thạch`);

        const knbAmount = 1;
        userRepository.update(userId, { knb: (user.knb || 0) + knbAmount });
        rewardTexts.push(`💎 **${knbAmount}** KNB`);

        const rareMat = RARE_MATERIALS[Math.floor(Math.random() * RARE_MATERIALS.length)];
        inventoryRepository.addItem(userId, rareMat, 2);
        rewardTexts.push(`🎁 Nguyên liệu Rare **x2**`);
        break;
      }
      default: {
        const ltAmount = 1000;
        userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + ltAmount });
        rewardTexts.push(`🟤 **${ltAmount.toLocaleString()}** Hạ Phẩm Linh Thạch`);

        const commonMat = COMMON_MATERIALS[Math.floor(Math.random() * COMMON_MATERIALS.length)];
        inventoryRepository.addItem(userId, commonMat, 3);
        rewardTexts.push(`🎁 Nguyên liệu Common **x3**`);
        break;
      }
    }

    return rewardTexts;
  }

  private getRandomRarity(): 'common' | 'rare' | 'epic' | 'legendary' {
    const rand = Math.random();
    if (rand < 0.5) return 'common';
    if (rand < 0.8) return 'rare';
    if (rand < 0.95) return 'epic';
    return 'legendary';
  }

  private getRarityLabel(rarity: string): string {
    const labels: Record<string, string> = {
      common: '🟤 Thường',
      rare: '🔵 Hiếm',
      epic: '🟣 Sử Thi',
      legendary: '🟡 Huyền Thoại',
    };
    return labels[rarity] || rarity;
  }

  public getAllActiveLocations(): TreasureLocation[] {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`
      SELECT * FROM treasure_locations
      WHERE is_claimed = 0 AND expires_at > ?
      ORDER BY created_at DESC
    `).all(now) as TreasureLocation[];
  }
}

export const mapFragmentService = new MapFragmentService();
