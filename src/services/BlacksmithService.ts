import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { RECIPES, RecipeConfig } from '../config/recipes';
import { achievementService } from './AchievementService';

export class BlacksmithService {
  /**
   * Lấy danh sách công thức rèn khí (forging)
   */
  public getRecipes(): RecipeConfig[] {
    return Object.values(RECIPES).filter(r => r.type === 'forging');
  }

  /**
   * Thực hiện Rèn Khí
   */
  public forgeItem(
    userId: string,
    recipeId: string
  ): { success: boolean; message: string; isLevelUp?: boolean; isMasterpiece?: boolean } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    }

    // Kiểm tra thương thế
    const now = Math.floor(Date.now() / 1000);
    if (user.injury_end_time && user.injury_end_time > now) {
      const remain = user.injury_end_time - now;
      return { success: false, message: `Đạo hữu đang bị trọng thương, không thể rèn khí! (Còn lại **${remain} giây**).` };
    }

    const recipe = RECIPES[recipeId];
    if (!recipe || recipe.type !== 'forging') {
      return { success: false, message: 'Công thức rèn không tồn tại.' };
    }

    // 1. Kiểm tra cấp độ
    const userLevel = user.level || 1;
    if (userLevel < recipe.minLevel) {
      return { success: false, message: `Cảnh giới của đạo hữu chưa đủ để rèn vật phẩm này!` };
    }

    // 2. Kiểm tra Thể lực
    const staminaCost = 15; // Mặc định tốn 15 thể lực mỗi lần rèn
    if (user.stamina < staminaCost) {
      return { success: false, message: `Thể lực không đủ để rèn khí! (Yêu cầu: **${staminaCost}**, Hiện tại: **${user.stamina}**).` };
    }

    // 3. Kiểm tra Linh Thạch
    if (user.coin_ha_pham < recipe.cost) {
      return { success: false, message: `Linh Thạch không đủ để chi trả chi phí rèn! (Yêu cầu: **${recipe.cost}**, Hiện tại: **${user.coin_ha_pham}**).` };
    }

    // 4. Kiểm tra nguyên liệu trong hành trang
    const inventory = inventoryRepository.getUserInventory(userId);
    for (const mat of recipe.ingredients) {
      const invItem = inventory.find(i => i.item_id === mat.itemId && i.is_equipped === 0);
      if (!invItem || invItem.quantity < mat.quantity) {
        const itemInfo = db.prepare('SELECT name FROM items WHERE id = ?').get(mat.itemId) as { name: string } | undefined;
        const itemName = itemInfo ? itemInfo.name : mat.itemId;
        return { success: false, message: `Thiếu khoáng thạch: **${itemName}** (Yêu cầu: **${mat.quantity}**, Hiện có: **${invItem ? invItem.quantity : 0}**).` };
      }
    }

    // 5. Tính toán thành công & Cực phẩm
    const userForgingLevel = user.forging_level || 1;
    
    // Tỷ lệ thành công cơ bản (70% - 95%)
    let baseSuccess = 0.70;
    if (recipe.minLevel > 30) baseSuccess = 0.65;
    if (recipe.minLevel > 60) baseSuccess = 0.60;

    let sectBonus = 0;
    if (user.sect_id) {
      const sect = db.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id) as any;
      if (sect) {
        try {
          const b = JSON.parse(sect.buildings || '{}');
          if (b.loren) sectBonus = b.loren * 0.02; // +2% mỗi cấp
        } catch(e) { console.warn('[BlacksmithService] Failed to parse sect buildings for loren bonus:', e); }
      }
    }

    const levelBonus = userForgingLevel * 0.01; // +1% thành công mỗi cấp Luyện Khí Sư
    const finalSuccessRate = Math.min(0.95, baseSuccess + levelBonus + sectBonus);

    const roll = Math.random();
    const isSuccess = roll <= finalSuccessRate;

    // Trừ Thể Lực và Linh Thạch
    const postStamina = user.stamina - staminaCost;
    const postCoin = user.coin_ha_pham - recipe.cost;
    userRepository.update(userId, { stamina: postStamina, coin_ha_pham: postCoin });

    // Trừ nguyên liệu
    for (const mat of recipe.ingredients) {
      inventoryRepository.removeItem(userId, mat.itemId, mat.quantity);
    }

    if (isSuccess) {
      // Xác suất ra cực phẩm (15% + 0.5% mỗi cấp rèn)
      const masterpieceChance = 0.15 + (userForgingLevel * 0.005);
      const isMasterpiece = Math.random() <= masterpieceChance;
      
      let rewardName = '';
      const staticItem = db.prepare('SELECT name, stats FROM items WHERE id = ?').get(recipe.product.itemId) as { name: string, stats: string };
      rewardName = staticItem.name;

      if (isMasterpiece) {
        // Sinh ra chỉ số Cực Phẩm ngẫu nhiên
        try {
          const baseStats = JSON.parse(staticItem.stats || '{}');
          const customStats: any = {};
          
          // Tính giá trị buff thêm (0.5 lần chỉ số gốc)
          for (const key of Object.keys(baseStats)) {
            const val = baseStats[key] * 0.5;
            // Nếu là số thập phân (như crit, dodge) thì giữ lại 3 chữ số, ngược lại làm tròn
            if (val > 0) {
              customStats[key] = Number.isInteger(baseStats[key]) ? Math.round(val) : parseFloat(val.toFixed(3));
            }
          }

          // Random thêm 1 dòng thuộc tính hiếm
          const rareAttributes = [
            { key: 'hp', value: 500, label: 'Sinh Lực (+500)' },
            { key: 'atk', value: 50, label: 'Công Kích (+50)' },
            { key: 'def', value: 50, label: 'Phòng Thủ (+50)' },
            { key: 'crit', value: 0.05, label: 'Bạo Kích (+5%)' },
            { key: 'dodge', value: 0.05, label: 'Né Tránh (+5%)' }
          ];
          const rareAttr = rareAttributes[Math.floor(Math.random() * rareAttributes.length)];
          customStats[rareAttr.key] = (customStats[rareAttr.key] || 0) + rareAttr.value;

          customStats.is_masterpiece = true;
          customStats.forge_bonus = true; // ponytail: đồ tự rèn +2%
          
          inventoryRepository.addItem(userId, recipe.product.itemId, 1, JSON.stringify(customStats));
          rewardName = `✨ **[CỰC PHẨM] ${rewardName}** (Thêm: ${rareAttr.label})`;
        } catch (e) {
          inventoryRepository.addItem(userId, recipe.product.itemId, 1, null);
        }
      } else {
        inventoryRepository.addItem(userId, recipe.product.itemId, 1, JSON.stringify({ forge_bonus: true })); // ponytail: đồ tự rèn +2%
      }

      // Tăng EXP Luyện Khí Sư
      let currentExp = user.forging_exp || 0;
      let currentLevel = user.forging_level || 1;
      const expGained = 15; // 15 exp mỗi lần rèn thành công
      currentExp += expGained;

      const expNeeded = currentLevel * 150;
      let isLevelUp = false;
      if (currentExp >= expNeeded) {
        currentLevel += 1;
        currentExp -= expNeeded;
        isLevelUp = true;
      }

      userRepository.update(userId, {
        forging_level: currentLevel,
        forging_exp: currentExp
      });

      let responseMsg = `🎉 **Rèn đúc thành công!** Đạo hữu thu được **1x ${rewardName}**!\n`;
      responseMsg += `📈 Nhận **+${expGained}** Tu Vi Luyện Khí Sư (Hiện tại: **${currentExp}/${currentLevel * 150}**).`;
      if (isLevelUp) {
        responseMsg += `\n🌟 **Chúc mừng!** Đạo hữu đột phá Luyện Khí Đạo thăng lên **Cấp ${currentLevel} Luyện Khí Sư**!`;
      }

      return { success: true, message: responseMsg, isLevelUp, isMasterpiece };
    } else {
      // Thất bại
      return {
        success: false,
        message: `💥 **Rèn đúc thất bại!** Lửa lò không đều khiến tinh thạch vỡ vụn. Đạo hữu mất toàn bộ nguyên liệu và phí rèn.`
      };
    }
  }

  /**
   * Phân Rã Trang Bị (Lấy Huyền Thiết)
   */
  public dismantleItem(userId: string, inventoryIds: number[]): { success: boolean; message: string } {
    if (inventoryIds.length === 0) return { success: false, message: 'Vui lòng chọn ít nhất 1 vật phẩm!' };

    let totalHuyenThiet = 0;
    let itemsDestroyed = 0;

    const tx = db.transaction(() => {
      for (const invId of inventoryIds) {
        const item = db.prepare(`
          SELECT i.id, i.quantity, i.is_equipped, t.rarity, t.type
          FROM inventories i
          JOIN items t ON i.item_id = t.id
          WHERE i.id = ? AND i.user_id = ?
        `).get(invId, userId) as any;

        if (!item || item.is_equipped === 1 || item.type !== 'equipment') continue;

        let htGain = 0;
        if (item.rarity === 'common') htGain = 1;
        if (item.rarity === 'uncommon') htGain = 3;
        if (item.rarity === 'rare') htGain = 10;
        if (item.rarity === 'epic') htGain = 50;
        if (item.rarity === 'legendary') htGain = 200;

        totalHuyenThiet += (htGain * item.quantity);
        itemsDestroyed += item.quantity;

        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      }

      if (totalHuyenThiet > 0) {
        // Cộng Huyền Thiết vào người chơi. Do Huyền Thiết là nguyên liệu, ta lưu nó vào inventory.
        // ID Huyền Thiết: mat_huyen_thiet
        const existing = db.prepare("SELECT id FROM inventories WHERE user_id = ? AND item_id = 'mat_huyen_thiet'").get(userId) as any;
        if (existing) {
          db.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?').run(totalHuyenThiet, existing.id);
        } else {
          db.prepare(`
            INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, created_at)
            VALUES (?, 'mat_huyen_thiet', ?, 0, NULL, ?)
          `).run(userId, totalHuyenThiet, Math.floor(Date.now() / 1000));
        }
      }
    });

    tx();

    if (itemsDestroyed === 0) {
      return { success: false, message: 'Không có trang bị nào hợp lệ để phân rã.' };
    }

    return { success: true, message: `🔥 Đã nung chảy **${itemsDestroyed}** trang bị. Đạo hữu thu được **${totalHuyenThiet} Huyền Thiết**!` };
  }

  /**
   * Tinh Luyện Trang Bị (Đập Sao)
   */
  public refineItem(userId: string, inventoryId: number): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };

    const item = db.prepare(`
      SELECT i.*, t.name, t.type
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.id = ? AND i.user_id = ?
    `).get(inventoryId, userId) as any;

    if (!item) return { success: false, message: 'Trang bị không tồn tại.' };
    if (item.type !== 'equipment') return { success: false, message: 'Chỉ có thể tinh luyện trang bị!' };
    
    const currentStars = item.stars || 0;
    if (currentStars >= 5) return { success: false, message: 'Trang bị đã đạt cấp Tinh Luyện tối đa (5 Sao)!' };

    // ponytail: giảm LT cost (trước 50K)
    const htNeeded = (currentStars + 1) * 10;
    const ltNeeded = (currentStars + 1) * 10000;

    if (user.coin_ha_pham < ltNeeded) return { success: false, message: `Không đủ Linh Thạch! (Cần: ${ltNeeded})` };

    const htItem = db.prepare("SELECT * FROM inventories WHERE user_id = ? AND item_id = 'mat_huyen_thiet'").get(userId) as any;
    if (!htItem || htItem.quantity < htNeeded) {
      return { success: false, message: `Không đủ Huyền Thiết! (Cần: ${htNeeded}, Có: ${htItem ? htItem.quantity : 0})` };
    }

    // Tỷ lệ thành công: 0->1: 100%, 1->2: 80%, 2->3: 60%, 3->4: 40%, 4->5: 20%
    const rates = [1.0, 0.8, 0.6, 0.4, 0.2];
    const successRate = rates[currentStars];

    const roll = Math.random();
    const isSuccess = roll <= successRate;

    const tx = db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - ltNeeded });
      db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(htNeeded, htItem.id);

      if (isSuccess) {
        db.prepare('UPDATE inventories SET stars = stars + 1 WHERE id = ?').run(item.id);
      } else {
        // Rớt sao nếu đang ở +3 trở lên (50% rớt)
        if (currentStars >= 3 && Math.random() < 0.5) {
          db.prepare('UPDATE inventories SET stars = stars - 1 WHERE id = ?').run(item.id);
        }
      }
    });

    tx();

    if (isSuccess) {
      return { success: true, message: `🌟 **[TINH LUYỆN THÀNH CÔNG]**\nTrang bị **${item.name}** đã thăng lên **+${currentStars + 1} Sao**!\nChi phí: -${ltNeeded} LT, -${htNeeded} Huyền Thiết.` };
    } else {
      let msg = `💥 **[TINH LUYỆN THẤT BẠI]**\nLửa lò rèn bùng lên mất kiểm soát! Tiêu hao: -${ltNeeded} LT, -${htNeeded} Huyền Thiết.`;
      if (currentStars >= 3) msg += '\n⚠️ *Hên là trang bị chưa bị rớt sao...* (Hoặc đã rớt nếu bạn quá xui).';
      return { success: false, message: msg };
    }
  }
}

export const blacksmithService = new BlacksmithService();
