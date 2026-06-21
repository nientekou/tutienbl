import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export class EquipmentService {
  /**
   * Giám Định Phôi Trang Bị
   */
  public appraisePhoi(userId: string, inventoryId: number): { success: boolean; message: string; rewardItemName?: string } {
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

    if (user.coin_ha_pham < 50) {
      return { success: false, message: 'Không đủ Linh Thạch để giám định! (Phí giám định: **50** Linh Thạch).' };
    }

    // Xác định loại phôi (vũ khí hay đạo bào) và phẩm chất (f -> sss)
    const parts = item.item_id.split('_');
    const phoiType = parts[1]; // 'weapon' hoặc 'armor'
    const phoiGrade = parts[2]; // 'f', 'd', 'c', 'b', 'a', 's', 'ss', 'sss'

    // Ánh xạ thành phẩm
    let targetItemId = '';
    if (phoiType === 'weapon') {
      targetItemId = `weapon_sword_${phoiGrade}`;
    } else if (phoiType === 'armor') {
      targetItemId = `armor_robe_${phoiGrade}`;
    } else if (phoiType === 'accessory') {
      const rand = Math.random();
      if (rand < 0.33) targetItemId = 'ring_1';
      else if (rand < 0.66) targetItemId = 'necklace_1';
      else targetItemId = 'amulet_1';
    } else if (phoiType === 'mount') {
      const rand = Math.random();
      if (rand < 0.5) targetItemId = 'mount_sword_1';
      else targetItemId = 'mount_beast_1';
    }

    // Kiểm tra thành phẩm tồn tại trong DB items
    const staticItem = db.prepare('SELECT name, rarity FROM items WHERE id = ?').get(targetItemId) as { name: string; rarity: string } | undefined;
    if (!staticItem) {
      return { success: false, message: 'Thành phẩm rèn đúc của phôi này thất truyền trong thiên địa.' };
    }

    // Tạo chỉ số phụ ngẫu nhiên
    const customStats = this.generateCustomStats(phoiGrade);

    // Chạy Transaction an toàn
    const appraiseTx = db.transaction(() => {
      // Trừ 50 Linh thạch
      db.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - 50 WHERE discord_id = ?').run(userId);
      
      // Xóa 1 phôi
      inventoryRepository.removeItemById(inventoryId, 1);
      
      // Thêm thành phẩm giám định
      inventoryRepository.addItem(userId, targetItemId, 1, customStats ? JSON.stringify(customStats) : null);
    });

    appraiseTx();

    let statsDescription = '';
    if (customStats) {
      statsDescription = '\n✨ **Chỉ số phụ thức tỉnh:**' +
        (customStats.atk ? `\n• Công kích: **+${customStats.atk}**` : '') +
        (customStats.def ? `\n• Phòng ngự: **+${customStats.def}**` : '') +
        (customStats.hp ? `\n• Sinh lực: **+${customStats.hp}**` : '') +
        (customStats.crit ? `\n• Bạo kích: **+${(customStats.crit * 100).toFixed(1)}%**` : '') +
        (customStats.luck ? `\n• May mắn: **+${customStats.luck}**` : '');
    }

    return {
      success: true,
      message: `🔮 **Giám định thành công!** Đạo hữu tiêu tốn 50 Linh Thạch chế tác phôi **${item.name}** thành **${staticItem.name}**!${statsDescription}`,
      rewardItemName: staticItem.name
    };
  }

  /**
   * Phân Giải Trang Bị Nhận Mảnh
   */
  public salvageEquipment(userId: string, inventoryId: number): { success: boolean; message: string; fragmentsGained?: number } {
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

    // Tính toán mảnh nhận được theo phẩm chất
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

    // Cộng thêm mảnh dựa trên số sao đã nâng
    if (item.stars > 0) {
      const starCosts = [10, 20, 50, 100, 250];
      let investment = 0;
      for (let i = 0; i < item.stars; i++) {
        investment += starCosts[i];
      }
      fragmentsGained += Math.round(investment * 0.7); // Hoàn trả 70% mảnh nâng sao
    }

    const salvageTx = db.transaction(() => {
      inventoryRepository.removeItemById(inventoryId, 1);
      inventoryRepository.addItem(userId, 'item_fragment', fragmentsGained);
    });

    salvageTx();

    return {
      success: true,
      message: `⚙️ **Phân giải thành công!** Đạo hữu nghiền nát **${item.name}** thành bột cát linh khí, thu hoạch được **+${fragmentsGained}** Mảnh Trang Bị!`,
      fragmentsGained
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
    const fragments = userInventory.find(i => i.item_id === 'item_fragment');
    if (!fragments || fragments.quantity < cost) {
      return { success: false, message: `Không đủ Mảnh Trang Bị để nâng sao! (Yêu cầu: **${cost}**, Đạo hữu hiện có: **${fragments ? fragments.quantity : 0}** mảnh).` };
    }

    const nextStars = currentStars + 1;

    const upgradeTx = db.transaction(() => {
      inventoryRepository.removeItem(userId, 'item_fragment', cost);
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
    const fragments = userInventory.find(i => i.item_id === 'item_fragment');
    if (!fragments || fragments.quantity < cost) {
      return { success: false, message: `Không đủ Mảnh Trang Bị để ghép! (Yêu cầu: **${cost}**, Hiện có: **${fragments ? fragments.quantity : 0}** mảnh).` };
    }

    // Chọn ngẫu nhiên loại trang bị và rèn
    const phoiGrade = rarity.toLowerCase(); // 's', 'ss', 'sss'
    const isWeapon = Math.random() < 0.5;
    const targetItemId = isWeapon ? `weapon_sword_${phoiGrade}` : `armor_robe_${phoiGrade}`;

    const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(targetItemId) as { name: string } | undefined;
    if (!staticItem) {
      return { success: false, message: 'Công thức ghép bị thất lạc!' };
    }

    const customStats = this.generateCustomStats(phoiGrade);

    const craftTx = db.transaction(() => {
      inventoryRepository.removeItem(userId, 'item_fragment', cost);
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
}

export const equipmentService = new EquipmentService();
