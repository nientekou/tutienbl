import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { ITEMS, getWeaponByGrade, getArmorByGrade } from '../config/itemConstants';

export class EquipmentService {
  /**
   * Giám Định Phôi Trang Bị
   */
  public appraisePhoi(userId: string, inventoryId: number, qty: number = 1): { success: boolean; message: string; rewardItemName?: string } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    }

    const item = inventoryRepository.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại trong túi đồ.' };
    }

    if (item.type !== 'phoi') {
      return { success: false, message: 'Vật phẩm này không phải là Phôi Trang Bị!' };
    }

    const actualQty = Math.min(qty, item.quantity);
    if (actualQty <= 0) {
      return { success: false, message: 'Số lượng giám định không hợp lệ.' };
    }

    const cost = 50 * actualQty;
    if (user.coin_ha_pham < cost) {
      return { success: false, message: `Không đủ Linh Thạch để giám định! (Phí giám định: **${cost}** Linh Thạch cho ${actualQty} phôi).` };
    }

    // Xác định loại phôi (vũ khí hay đạo bào) và phẩm chất (f -> sss)
    const parts = item.item_id.split('_');
    const phoiType = parts[1]; // 'weapon' hoặc 'armor'
    const phoiGrade = parts[2]; // 'f', 'd', 'c', 'b', 'a', 's', 'ss', 'sss'

    const itemsToAdd: Array<{ userId: string; itemId: string; quantity: number; customStats: string | null }> = [];
    let lastRewardItemName = '';

    for (let i = 0; i < actualQty; i++) {
      let targetItemId = '';
      if (phoiType === 'weapon') {
        targetItemId = getWeaponByGrade(phoiGrade);
      } else if (phoiType === 'armor') {
        targetItemId = getArmorByGrade(phoiGrade);
      } else if (phoiType === 'accessory') {
        const rand = Math.random();
        if (rand < 0.33) targetItemId = ITEMS.RING_1;
        else if (rand < 0.66) targetItemId = ITEMS.NECKLACE_1;
        else targetItemId = ITEMS.AMULET_1;
      } else if (phoiType === 'mount') {
        const rand = Math.random();
        if (rand < 0.5) targetItemId = ITEMS.MOUNT_SWORD_1;
        else targetItemId = ITEMS.MOUNT_BEAST_1;
      }

      const staticItem = db.prepare('SELECT name, rarity FROM items WHERE id = ?').get(targetItemId) as { name: string; rarity: string } | undefined;
      if (!staticItem) {
        return { success: false, message: 'Thành phẩm rèn đúc của phôi này thất truyền trong thiên địa.' };
      }

      lastRewardItemName = staticItem.name;
      const customStats = this.generateCustomStats(phoiGrade);
      itemsToAdd.push({
        userId,
        itemId: targetItemId,
        quantity: 1,
        customStats: customStats ? JSON.stringify(customStats) : null
      });
    }

    // Chạy Transaction an toàn
    const appraiseTx = db.transaction(() => {
      // Trừ Linh thạch
      db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? WHERE discord_id = ?').run(cost, userId);
      
      // Xóa phôi
      inventoryRepository.removeItemById(inventoryId, actualQty);
      
      // Thêm thành phẩm giám định
      inventoryRepository.addMultipleItems(itemsToAdd);
    });

    appraiseTx();

    return {
      success: true,
      message: `🔮 **Giám định thành công!** Đạo hữu tiêu tốn **${cost}** Linh Thạch chế tác x${actualQty} phôi **${item.name}** thành trang bị tương ứng thành công!`,
      rewardItemName: lastRewardItemName
    };
  }

  /**
   * Phân Giải Trang Bị Nhận Mảnh
   */
  public salvageEquipment(userId: string, inventoryId: number, qty: number = 1): { success: boolean; message: string; fragmentsGained?: number } {
    const item = inventoryRepository.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại.' };
    }

    if (item.equipable !== 1) {
      return { success: false, message: 'Vật phẩm này không phải trang bị, không thể phân giải!' };
    }

    if (item.is_equipped === 1) {
      return { success: false, message: 'Trang bị đang đeo trên người, tháo ra trước khi phân giải!' };
    }

    const actualQty = Math.min(qty, item.quantity);
    if (actualQty <= 0) {
      return { success: false, message: 'Số lượng phân giải không hợp lệ.' };
    }

    // Tính toán mảnh nhận được theo phẩm chất
    let baseFragments = 1;
    if (item.item_id.endsWith('_ex')) {
      baseFragments = 500;
    } else if (item.rarity === 'common') {
      baseFragments = 1;
    } else if (item.rarity === 'uncommon') {
      baseFragments = 3;
    } else if (item.rarity === 'rare') {
      baseFragments = 10;
    } else if (item.rarity === 'epic') {
      baseFragments = 35;
    } else if (item.rarity === 'legendary') {
      baseFragments = 120;
    }

    let fragmentsGained = baseFragments * actualQty;

    // Cộng thêm mảnh dựa trên số sao đã nâng
    if (item.stars > 0) {
      const starCosts = [10, 20, 50, 100, 250];
      let investment = 0;
      for (let i = 0; i < item.stars; i++) {
        investment += starCosts[i];
      }
      fragmentsGained += Math.round(investment * 0.7) * actualQty; // Hoàn trả 70% mảnh nâng sao
    }

    const salvageTx = db.transaction(() => {
      inventoryRepository.removeItemById(inventoryId, actualQty);
      inventoryRepository.addItem(userId, ITEMS.ITEM_FRAGMENT, fragmentsGained);
    });

    salvageTx();

    return {
      success: true,
      message: `⚙️ **Phân giải thành công!** Đạo hữu nghiền nát x${actualQty} **${item.name}** thành bột cát linh khí, thu hoạch được **+${fragmentsGained}** Mảnh Trang Bị!`,
      fragmentsGained
    };
  }

  /**
   * Phân Giải Trang Bị Hàng Loạt
   */
  public salvageEquipmentBulk(userId: string, targetRarity: string): { success: boolean; message: string; fragmentsGained?: number } {
    const RARITY_ORDER: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5
    };

    const targetOrder = RARITY_ORDER[targetRarity.toLowerCase()];
    if (!targetOrder) {
      return { success: false, message: 'Phẩm chất không hợp lệ.' };
    }

    const allItems = inventoryRepository.getUserInventory(userId);
    const salvageable = allItems.filter(item => {
      if (item.equipable !== 1) return false;
      if (item.is_equipped === 1) return false;
      if (item.is_life_bound === 1) return false;
      const order = RARITY_ORDER[item.rarity.toLowerCase()] || 0;
      return order <= targetOrder;
    });

    if (salvageable.length === 0) {
      return { success: false, message: `Không tìm thấy trang bị nào chưa đeo và không bản mệnh có phẩm chất từ **${targetRarity.toUpperCase()}** trở xuống!` };
    }

    let totalFragmentsGained = 0;
    const itemsToRemove: number[] = [];

    for (const item of salvageable) {
      let fragmentsGained = 1;
      if (item.item_id.endsWith('_ex')) {
        fragmentsGained = 500;
      } else if (item.rarity === 'common') {
        fragmentsGained = 1;
      } else if (item.rarity === 'uncommon') {
        fragmentsGained = 3;
      } else if (item.rarity === 'rare') {
        fragmentsGained = 10;
      } else if (item.rarity === 'epic') {
        fragmentsGained = 35;
      } else if (item.rarity === 'legendary') {
        fragmentsGained = 120;
      }

      if (item.stars > 0) {
        const starCosts = [10, 20, 50, 100, 250];
        let investment = 0;
        for (let i = 0; i < item.stars; i++) {
          investment += starCosts[i];
        }
        fragmentsGained += Math.round(investment * 0.7);
      }

      totalFragmentsGained += fragmentsGained * item.quantity;
      itemsToRemove.push(item.id);
    }

    const salvageTx = db.transaction(() => {
      for (const invId of itemsToRemove) {
        // Lấy thông tin quantity hiện tại để xóa đúng
        const it = inventoryRepository.get(invId);
        if (it) {
          inventoryRepository.removeItemById(invId, it.quantity);
        }
      }
      inventoryRepository.addItem(userId, ITEMS.ITEM_FRAGMENT, totalFragmentsGained);
    });

    salvageTx();

    return {
      success: true,
      message: `⚙️ **Phân giải hàng loạt thành công!** Đạo hữu đã phân giải **${salvageable.length}** trang bị phẩm chất từ **${targetRarity.toUpperCase()}** trở xuống, thu hoạch được **+${totalFragmentsGained}** Mảnh Trang Bị!`,
      fragmentsGained: totalFragmentsGained
    };
  }

  /**
   * Nâng Sao Trang Bị
   */
  public upgradeStars(userId: string, inventoryId: number): { success: boolean; message: string; newStars?: number } {
    const item = inventoryRepository.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Trang bị không tồn tại.' };
    }

    if (item.equipable !== 1) {
      return { success: false, message: 'Chỉ có trang bị mới có thể nâng sao!' };
    }

    const currentStars = item.stars || 0;
    if (currentStars >= 5) {
      return { success: false, message: 'Trang bị đã đạt tối đa **5 sao**, không thể cường hóa thêm!' };
    }

    const starCosts = [10, 20, 50, 100, 250];
    const cost = starCosts[currentStars];

    // Đếm số mảnh hiện có
    const userInventory = inventoryRepository.getUserInventory(userId);
    const fragments = userInventory.find(i => i.item_id === ITEMS.ITEM_FRAGMENT);
    if (!fragments || fragments.quantity < cost) {
      return { success: false, message: `Không đủ Mảnh Trang Bị để nâng sao! (Yêu cầu: **${cost}**, Đạo hữu hiện có: **${fragments ? fragments.quantity : 0}** mảnh).` };
    }

    const nextStars = currentStars + 1;

    const upgradeTx = db.transaction(() => {
      inventoryRepository.removeItem(userId, ITEMS.ITEM_FRAGMENT, cost);
      inventoryRepository.updateStars(inventoryId, nextStars);
    });

    upgradeTx();

    return {
      success: true,
      message: `⭐ **Nâng sao thành công!** Đạo hữu tiêu tốn **${cost}** Mảnh Trang Bị, đúc luyện **${item.name}** thăng lên **Cấp ${nextStars} Sao**! (+${nextStars * 20}% thuộc tính cơ bản).`,
      newStars: nextStars
    };
  }

  /**
   * Ghép Trang Bị Hiếm SSS
   */
  public craftEquipment(userId: string, rarity: 'S' | 'SS' | 'SSS'): { success: boolean; message: string; rewardItemName?: string } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    }

    let cost = 100;
    if (rarity === 'SS') cost = 300;
    if (rarity === 'SSS') cost = 1000;

    const userInventory = inventoryRepository.getUserInventory(userId);
    const fragments = userInventory.find(i => i.item_id === ITEMS.ITEM_FRAGMENT);
    if (!fragments || fragments.quantity < cost) {
      return { success: false, message: `Không đủ Mảnh Trang Bị để ghép! (Yêu cầu: **${cost}**, Hiện có: **${fragments ? fragments.quantity : 0}** mảnh).` };
    }

    // Chọn ngẫu nhiên loại trang bị và rèn
    const phoiGrade = rarity.toLowerCase(); // 's', 'ss', 'sss'
    const isWeapon = Math.random() < 0.5;
    const targetItemId = isWeapon ? getWeaponByGrade(phoiGrade) : getArmorByGrade(phoiGrade);

    const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(targetItemId) as { name: string } | undefined;
    if (!staticItem) {
      return { success: false, message: 'Công thức ghép bị thất lạc!' };
    }

    const customStats = this.generateCustomStats(phoiGrade);

    const craftTx = db.transaction(() => {
      inventoryRepository.removeItem(userId, ITEMS.ITEM_FRAGMENT, cost);
      inventoryRepository.addItem(userId, targetItemId, 1, customStats ? JSON.stringify(customStats) : null);
    });

    craftTx();

    return {
      success: true,
      message: `🛠️ **Ghép thành công!** Đạo hữu tiêu dùng **${cost}** Mảnh Trang Bị, dung hợp thành công linh khí đúc ra trang bị thần phẩm **${staticItem.name}**!`,
      rewardItemName: staticItem.name
    };
  }

  /**
   * Tạo dòng chỉ số ngẫu nhiên theo bậc phôi
   */
  private generateCustomStats(grade: string): any {
    const stats: any = {};
    const lowerGrade = grade.toLowerCase();

    if (lowerGrade === 'f' || lowerGrade === 'd') {
      return null; // Không có dòng ẩn
    }

    const rollStat = (type: string, min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const types = ['atk', 'def', 'hp', 'crit', 'luck'];

    let lines = 1;
    if (lowerGrade === 'c' || lowerGrade === 'b') lines = 1;
    else if (lowerGrade === 'a' || lowerGrade === 's') lines = 2;
    else if (lowerGrade === 'ss' || lowerGrade === 'sss') lines = 3;
    else if (lowerGrade === 'ex') lines = 4;

    const chosenTypes = new Set<string>();
    while (chosenTypes.size < lines) {
      chosenTypes.add(types[Math.floor(Math.random() * types.length)]);
    }

    for (const statType of chosenTypes) {
      if (statType === 'atk') {
        if (lowerGrade === 'c') stats.atk = rollStat('atk', 2, 6);
        else if (lowerGrade === 'b') stats.atk = rollStat('atk', 5, 15);
        else if (lowerGrade === 'a') stats.atk = rollStat('atk', 10, 30);
        else if (lowerGrade === 's') stats.atk = rollStat('atk', 20, 50);
        else if (lowerGrade === 'ss') stats.atk = rollStat('atk', 40, 100);
        else if (lowerGrade === 'sss') stats.atk = rollStat('atk', 80, 200);
        else if (lowerGrade === 'ex') stats.atk = rollStat('atk', 150, 400);
      } else if (statType === 'def') {
        if (lowerGrade === 'c') stats.def = rollStat('def', 1, 4);
        else if (lowerGrade === 'b') stats.def = rollStat('def', 3, 10);
        else if (lowerGrade === 'a') stats.def = rollStat('def', 6, 20);
        else if (lowerGrade === 's') stats.def = rollStat('def', 12, 35);
        else if (lowerGrade === 'ss') stats.def = rollStat('def', 25, 70);
        else if (lowerGrade === 'sss') stats.def = rollStat('def', 50, 150);
        else if (lowerGrade === 'ex') stats.def = rollStat('def', 100, 300);
      } else if (statType === 'hp') {
        if (lowerGrade === 'c') stats.hp = rollStat('hp', 10, 30);
        else if (lowerGrade === 'b') stats.hp = rollStat('hp', 25, 80);
        else if (lowerGrade === 'a') stats.hp = rollStat('hp', 60, 200);
        else if (lowerGrade === 's') stats.hp = rollStat('hp', 120, 400);
        else if (lowerGrade === 'ss') stats.hp = rollStat('hp', 250, 800);
        else if (lowerGrade === 'sss') stats.hp = rollStat('hp', 500, 1500);
        else if (lowerGrade === 'ex') stats.hp = rollStat('hp', 1000, 3000);
      } else if (statType === 'crit') {
        let critVal = 0.01;
        if (lowerGrade === 'a') critVal = 0.01 + Math.random() * 0.02;
        else if (lowerGrade === 's') critVal = 0.02 + Math.random() * 0.03;
        else if (lowerGrade === 'ss') critVal = 0.03 + Math.random() * 0.05;
        else if (lowerGrade === 'sss') critVal = 0.05 + Math.random() * 0.07;
        else if (lowerGrade === 'ex') critVal = 0.08 + Math.random() * 0.12;
        stats.crit = parseFloat(critVal.toFixed(3));
      } else if (statType === 'luck') {
        if (lowerGrade === 's') stats.luck = rollStat('luck', 1, 3);
        else if (lowerGrade === 'ss') stats.luck = rollStat('luck', 2, 6);
        else if (lowerGrade === 'sss') stats.luck = rollStat('luck', 5, 15);
        else if (lowerGrade === 'ex') stats.luck = rollStat('luck', 10, 30);
      }
    }

    return stats;
  }

  /**
   * Giám Định Hàng Loạt Toàn Bộ Phôi
   */
  public appraisePhoiBulk(userId: string): { success: boolean; message: string; count?: number } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    }

    const allItems = inventoryRepository.getUserInventory(userId);
    const phois = allItems.filter(item => item.type === 'phoi' && item.quantity > 0);

    if (phois.length === 0) {
      return { success: false, message: 'Không tìm thấy Phôi Trang Bị nào trong hành trang!' };
    }

    let totalQty = 0;
    for (const p of phois) {
      totalQty += p.quantity;
    }

    const cost = 50 * totalQty;
    if (user.coin_ha_pham < cost) {
      return { success: false, message: `Không đủ Linh Thạch để giám định hàng loạt! (Yêu cầu: **${cost}** Linh Thạch cho ${totalQty} phôi, đạo hữu hiện có: **${user.coin_ha_pham}**).` };
    }

    const itemsToAdd: Array<{ userId: string; itemId: string; quantity: number; customStats: string | null }> = [];

    for (const p of phois) {
      const parts = p.item_id.split('_');
      const phoiType = parts[1]; // 'weapon', 'armor', 'accessory', 'mount'
      const phoiGrade = parts[2]; // grade

      for (let i = 0; i < p.quantity; i++) {
        let targetItemId = '';
        if (phoiType === 'weapon') {
          targetItemId = getWeaponByGrade(phoiGrade);
        } else if (phoiType === 'armor') {
          targetItemId = getArmorByGrade(phoiGrade);
        } else if (phoiType === 'accessory') {
          const rand = Math.random();
          if (rand < 0.33) targetItemId = ITEMS.RING_1;
          else if (rand < 0.66) targetItemId = ITEMS.NECKLACE_1;
          else targetItemId = ITEMS.AMULET_1;
        } else if (phoiType === 'mount') {
          const rand = Math.random();
          if (rand < 0.5) targetItemId = ITEMS.MOUNT_SWORD_1;
          else targetItemId = ITEMS.MOUNT_BEAST_1;
        }

        const customStats = this.generateCustomStats(phoiGrade);
        itemsToAdd.push({
          userId,
          itemId: targetItemId,
          quantity: 1,
          customStats: customStats ? JSON.stringify(customStats) : null
        });
      }
    }

    // Run transaction
    const appraiseTx = db.transaction(() => {
      // Trừ Linh thạch
      db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? WHERE discord_id = ?').run(cost, userId);
      
      // Xóa tất cả phôi
      for (const p of phois) {
        inventoryRepository.removeItemById(p.id, p.quantity);
      }
      
      // Thêm thành phẩm
      inventoryRepository.addMultipleItems(itemsToAdd);
    });

    appraiseTx();

    return {
      success: true,
      message: `🔮 **Giám định hàng loạt thành công!** Đạo hữu tiêu tốn **${cost}** Linh Thạch, giám định thành công **${totalQty}** phôi trang bị các loại!`,
      count: totalQty
    };
  }
}

export const equipmentService = new EquipmentService();
