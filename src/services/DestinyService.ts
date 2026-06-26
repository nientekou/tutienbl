import { destinyRepository, UserDestinyEntity } from '../database/repositories/DestinyRepository';
import { userRepository } from '../database/repositories/UserRepository';
import {
  DESTINY_TYPES, DESTINY_GACHA_COST, DESTINY_FOCUS_COST,
  DestinyRarity, DestinyType, DESTINY_MAX_LEVEL,
  getDestinyExpNeeded, getDestinyScrapExp,
  DESTINY_PITY_SOFT, DESTINY_PITY_HARD, DESTINY_PITY_SOFT_RATE,
  DESTINY_SCRAP_SHARDS, DESTINY_BUY_COST_SHARDS,
  DESTINY_RARITY_MULTIPLIER
} from '../config/destinies';

export class DestinyService {
  /**
   * Tính toán tối đa slot được trang bị dựa vào Cảnh Giới
   */
  public getMaxSlotsByRealm(realm: string): number {
    if (realm.includes('Luyện Khí')) return 0;
    if (realm.includes('Trúc Cơ')) return 1;
    if (realm.includes('Kim Đan')) return 2;
    if (realm.includes('Nguyên Anh')) return 3;
    if (realm.includes('Hóa Thần')) return 4;
    if (realm.includes('Luyện Hư')) return 5;
    return 6;
  }

  /**
   * Roll Bốc Quẻ (Gacha) 1 lần
   * P1-08: Soft pity at 100 (+1%/roll), hard pity at 150 (guaranteed tien_pham)
   */
  public rollGacha(userId: string, useFocus: boolean = false): { success: boolean; message: string; destiny?: UserDestinyEntity } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật' };

    const cost = useFocus ? DESTINY_FOCUS_COST : DESTINY_GACHA_COST;
    if (user.coin_ha_pham < cost) {
      return { success: false, message: `Không đủ Linh Thạch. Bốc quẻ cần **${cost}** Hạ Phẩm Linh Thạch.` };
    }

    // Trừ tiền
    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });

    // P1-08: Pity system
    const pity = destinyRepository.getPity(userId);
    let rarity: DestinyRarity = 'thuong';

    // Hard pity: 150 rolls → guaranteed tien_pham
    if (pity.pull_count + 1 >= DESTINY_PITY_HARD) {
      rarity = 'tien_pham';
    } else {
      // Soft pity: after 100 rolls, +1% per roll to tien_pham rate
      const softPityBonus = pity.pull_count >= DESTINY_PITY_SOFT
        ? (pity.pull_count - DESTINY_PITY_SOFT + 1) * DESTINY_PITY_SOFT_RATE
        : 0;

      const randRarity = Math.random();
      const adjustedTienPhamRate = 0.01 + softPityBonus;
      const adjustedCucPhamRate = 0.10 + softPityBonus * 0.5;

      if (randRarity < adjustedTienPhamRate) rarity = 'tien_pham';
      else if (randRarity < adjustedCucPhamRate) rarity = 'cuc_pham';
      else if (randRarity < 0.40) rarity = 'hiem';
    }

    // Roll Type
    let typeKeys = Object.keys(DESTINY_TYPES) as DestinyType[];
    // P1-08: Focus mode — halve the pool (pick 1 element to boost)
    if (useFocus) {
      // Focus: boost the user's most-used element or random
      const focusElements: DestinyType[] = ['atk_percent', 'def_percent', 'hp_percent'];
      const focusedType = focusElements[Math.floor(Math.random() * focusElements.length)];
      // 50% chance to get focused type, 50% random from pool
      if (Math.random() < 0.5) {
        const destiny = destinyRepository.addDestiny(userId, focusedType, rarity);
        destinyRepository.incrementPity(userId);
        if (rarity !== 'thuong') destinyRepository.resetPity(userId);
        return {
          success: true,
          message: `🎯 **Fate Focus** — Mệnh Cách **${DESTINY_TYPES[focusedType].name}** [${rarity.toUpperCase()}]!`,
          destiny
        };
      }
    }

    const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const destiny = destinyRepository.addDestiny(userId, randomType, rarity);

    // Update pity
    destinyRepository.incrementPity(userId);
    // Reset pity on rare+ pull
    if (rarity !== 'thuong') {
      destinyRepository.resetPity(userId);
    }

    const pityMsg = pity.pull_count + 1 >= DESTINY_PITY_SOFT
      ? ` (Pity: ${pity.pull_count + 1}/${DESTINY_PITY_HARD})`
      : '';

    return {
      success: true,
      message: `Đã tiêu hao ${cost} Linh Thạch. Mở ra Mệnh Cách **${DESTINY_TYPES[randomType].name}** [${rarity.toUpperCase()}]!${pityMsg}`,
      destiny
    };
  }

  /**
   * P1-08: Phân rã mệnh cách → nhận Destiny Shards
   */
  public scrapDestiny(userId: string, destinyId: number): { success: boolean; message: string } {
    const destiny = destinyRepository.get(destinyId);
    if (!destiny || destiny.user_id !== userId) {
      return { success: false, message: 'Mệnh Cách không tồn tại hoặc không thuộc về đạo hữu.' };
    }
    if (destiny.is_equipped) {
      return { success: false, message: 'Phải tháo Mệnh Cách khỏi trang bị trước khi phân rã.' };
    }

    const shardsGained = DESTINY_SCRAP_SHARDS[destiny.rarity];
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };

    db.transaction(() => {
      destinyRepository.deleteDestiny(destinyId);
      userRepository.update(userId, { destiny_shards: (user.destiny_shards || 0) + shardsGained });
    })();

    return {
      success: true,
      message: `Đã phân rã Mệnh Cách **${DESTINY_TYPES[destiny.destiny_id].name}** [${destiny.rarity.toUpperCase()}] → nhận **${shardsGained}** Mảnh Mệnh Cách.`
    };
  }

  /**
   * P1-08: Mua mệnh cách bằng Destiny Shards
   */
  public buyDestiny(userId: string, destinyType: DestinyType): { success: boolean; message: string; destiny?: UserDestinyEntity } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };

    if ((user.destiny_shards || 0) < DESTINY_BUY_COST_SHARDS) {
      return { success: false, message: `Không đủ Mảnh Mệnh Cách. Cần **${DESTINY_BUY_COST_SHARDS}** mảnh.` };
    }

    // Give a random rarity with weighted rates
    const rand = Math.random();
    let rarity: DestinyRarity = 'thuong';
    if (rand < 0.01) rarity = 'tien_pham';
    else if (rand < 0.10) rarity = 'cuc_pham';
    else if (rand < 0.40) rarity = 'hiem';

    const destiny = destinyRepository.addDestiny(userId, destinyType, rarity);
    userRepository.update(userId, { destiny_shards: user.destiny_shards - DESTINY_BUY_COST_SHARDS });

    return {
      success: true,
      message: `Đã dùng **${DESTINY_BUY_COST_SHARDS}** Mảnh Mệnh Cách mua **${DESTINY_TYPES[destinyType].name}** [${rarity.toUpperCase()}]!`,
      destiny
    };
  }

  /**
   * P1-08: Destiny Awakening — at level 10, merge 5 duplicate commons → 1 rare of same type
   */
  public awakenDestiny(userId: string, destinyId: number): { success: boolean; message: string; destiny?: UserDestinyEntity } {
    const destiny = destinyRepository.get(destinyId);
    if (!destiny || destiny.user_id !== userId) {
      return { success: false, message: 'Mệnh Cách không tồn tại hoặc không thuộc về đạo hữu.' };
    }
    if (destiny.level < DESTINY_MAX_LEVEL) {
      return { success: false, message: `Mệnh Cách phải đạt cấp ${DESTINY_MAX_LEVEL} mới có thể thức tỉnh.` };
    }
    if (destiny.rarity !== 'thuong' && destiny.rarity !== 'hiem') {
      return { success: false, message: 'Chỉ có thể thức tỉnh Mệnh Cách Thường hoặc Hiếm.' };
    }

    // Need 5 duplicates of same type at level 1
    const allDestinies = destinyRepository.getUserDestinies(userId);
    const duplicates = allDestinies.filter(d =>
      d.id !== destinyId &&
      d.destiny_id === destiny.destiny_id &&
      d.rarity === destiny.rarity &&
      d.level === 1 &&
      d.is_equipped === 0
    );

    if (duplicates.length < 5) {
      return { success: false, message: `Cần **5** Mệnh Cách '${DESTINY_TYPES[destiny.destiny_id].name}' [${destiny.rarity}] cấp 1 khác. Hiện có: ${duplicates.length}/5.` };
    }

    // Upgrade rarity
    const newRarity: DestinyRarity = destiny.rarity === 'thuong' ? 'hiem' : 'cuc_pham';

    db.transaction(() => {
      // Delete 5 duplicates
      for (const dup of duplicates.slice(0, 5)) {
        destinyRepository.deleteDestiny(dup.id);
      }
      // Upgrade the original
      destinyRepository.update(destinyId, {
        rarity: newRarity,
        level: 1,
        exp: 0
      });
    })();

    const newDestiny = destinyRepository.get(destinyId)!;

    return {
      success: true,
      message: `✨ **Thức Tỉnh** Mệnh Cách **${DESTINY_TYPES[destiny.destiny_id].name}** → **${newRarity.toUpperCase()}**! Đã tiêu hao 5 mệnh cách trùng.`,
      destiny: newDestiny
    };
  }

  /**
   * Tính toán tổng chỉ số cộng thêm từ tất cả Mệnh Cách đang trang bị
   */
  public calculateDestinyBonus(userId: string): Record<string, number> {
    const destinies = destinyRepository.getUserDestinies(userId).filter(d => d.is_equipped === 1);
    const bonuses: Record<string, number> = {
      atk_percent: 0,
      def_percent: 0,
      hp_percent: 0,
      crit_rate: 0,
      crit_damage: 0,
      dodge_rate: 0,
      speed_bonus: 0
    };

    for (const dest of destinies) {
      const config = DESTINY_TYPES[dest.destiny_id];
      if (config) {
        // P1-08: Apply rarity multiplier to bonus calculation
        const rarityMult = DESTINY_RARITY_MULTIPLIER[dest.rarity] || 1.0;
        const totalBonus = (config.baseValue + (dest.level - 1) * config.scalePerLevel) * rarityMult;
        bonuses[dest.destiny_id] += totalBonus;
      }
    }

    return bonuses;
  }
}

// Need db import for transaction
import db from '../database/database';

export const destinyService = new DestinyService();
