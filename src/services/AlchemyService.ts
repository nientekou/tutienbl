import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { achievementService } from './AchievementService';
import { ITEMS } from '../config/itemConstants';

export interface AlchemyRecipe {
  id: string;
  name: string;
  targetPillId: string;
  requiredMaterials: { itemId: string; quantity: number }[];
  costCoin: number;
  staminaCost: number;
  requiredAlchemyLevel: number;
  baseSuccessRate: number; // 0.0 to 1.0
  expGained: number;
}

// ponytail: tăng base success rate 5-15% so với trước để expected profit >= 0
// Công thức: expected output value >= material cost + coin cost
export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: 'recipe_tuvi',
    name: 'Luyện Khí Đan',
    targetPillId: ITEMS.PILL_ALCHEMY_TUVI,
    requiredMaterials: [{ itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }],
    costCoin: 100,
    staminaCost: 10,
    requiredAlchemyLevel: 1,
    baseSuccessRate: 0.75,
    expGained: 10
  },
  {
    id: 'recipe_loi',
    name: 'Ngự Lôi Đan',
    targetPillId: ITEMS.PILL_ALCHEMY_ANTI_LOI,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 10 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 2 }
    ],
    costCoin: 400,
    staminaCost: 15,
    requiredAlchemyLevel: 2,
    baseSuccessRate: 0.60,
    expGained: 35
  },
  {
    id: 'recipe_break',
    name: 'Thanh Tâm Đan',
    targetPillId: ITEMS.PILL_ALCHEMY_BREAK,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 3 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 3 }
    ],
    costCoin: 250,
    staminaCost: 15,
    requiredAlchemyLevel: 2,
    baseSuccessRate: 0.65,
    expGained: 25
  },
  {
    id: 'recipe_stamina',
    name: 'Bổ Thiên Đan',
    targetPillId: ITEMS.PILL_ALCHEMY_STAMINA,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 },
      { itemId: ITEMS.ITEM_FRAGMENT, quantity: 1 }
    ],
    costCoin: 500,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.55,
    expGained: 50
  },
  {
    id: 'recipe_stamina_1',
    name: 'Hồi Thể Đan - Sơ Cấp',
    targetPillId: ITEMS.PILL_STAMINA_1,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 3 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 1 }
    ],
    costCoin: 100,
    staminaCost: 10,
    requiredAlchemyLevel: 1,
    baseSuccessRate: 0.75,
    expGained: 15
  },
  {
    id: 'recipe_stamina_2',
    name: 'Hồi Thể Đan - Trung Cấp',
    targetPillId: ITEMS.PILL_STAMINA_2,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 3 }
    ],
    costCoin: 200,
    staminaCost: 15,
    requiredAlchemyLevel: 2,
    baseSuccessRate: 0.65,
    expGained: 30
  },
  {
    id: 'recipe_stamina_3',
    name: 'Hồi Thể Đan - Cao Cấp',
    targetPillId: ITEMS.PILL_STAMINA_3,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 10 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 1 }
    ],
    costCoin: 400,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.55,
    expGained: 60
  },
  {
    id: 'recipe_linh_tuyen',
    name: 'Linh Tuyền Phù',
    targetPillId: ITEMS.PILL_LINH_TUYEN,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 10 },
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 3 }
    ],
    costCoin: 1500,
    staminaCost: 30,
    requiredAlchemyLevel: 5,
    baseSuccessRate: 0.40,
    expGained: 100
  },
  {
    id: 'recipe_nhan_tu',
    name: 'Nhàn Tu Đan',
    targetPillId: ITEMS.PILL_NHAN_TU,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 20 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 5 }
    ],
    costCoin: 3000,
    staminaCost: 40,
    requiredAlchemyLevel: 8,
    baseSuccessRate: 0.35,
    expGained: 150
  },
  {
    id: 'recipe_hp_max_perm',
    name: 'Huyết Nguyên Đan',
    targetPillId: ITEMS.PILL_HP_MAX_PERM,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 5 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 5 }
    ],
    costCoin: 1000,
    staminaCost: 25,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.45,
    expGained: 100
  },
  {
    id: 'recipe_mp_50',
    name: 'Hư Không Đan',
    targetPillId: ITEMS.PILL_MP_50,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_VOID_HERB, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 10 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.45,
    expGained: 80
  },
  {
    id: 'recipe_speed_buff',
    name: 'Thiên Phong Đan',
    targetPillId: ITEMS.PILL_SPEED_BUFF,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_WIND_LEAF, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 10 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.45,
    expGained: 80
  },
  {
    id: 'recipe_cuu_chuyen',
    name: 'Cửu Chuyển Hoàn Hồn Đan',
    targetPillId: ITEMS.PILL_CUU_CHUYEN,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_TUYET_LIEN, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 1500,
    staminaCost: 25,
    requiredAlchemyLevel: 4,
    baseSuccessRate: 0.40,
    expGained: 150
  },
  {
    id: 'recipe_ngo_dong',
    name: 'Ngô Đồng Trường Sinh Đan',
    targetPillId: ITEMS.PILL_NGO_DONG,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_NGODONG, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 2000,
    staminaCost: 30,
    requiredAlchemyLevel: 4,
    baseSuccessRate: 0.35,
    expGained: 200
  },
  {
    id: 'recipe_huyen_am',
    name: 'Huyền Âm Kiếp Đan',
    targetPillId: ITEMS.PILL_HUYEN_AM,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINGZHI, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 1800,
    staminaCost: 25,
    requiredAlchemyLevel: 4,
    baseSuccessRate: 0.37,
    expGained: 180
  },
  {
    id: 'recipe_tay_tuy',
    name: 'Tẩy Tủy Đan',
    targetPillId: ITEMS.PILL_TAY_TUY,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 10 },
      { itemId: ITEMS.MATERIAL_VOID_HERB, quantity: 10 },
      { itemId: ITEMS.MATERIAL_WIND_LEAF, quantity: 10 },
      { itemId: ITEMS.MATERIAL_TUYET_LIEN, quantity: 5 }
    ],
    costCoin: 5000,
    staminaCost: 50,
    requiredAlchemyLevel: 5,
    baseSuccessRate: 0.30,
    expGained: 500
  },
  {
    id: 'recipe_protect_hoa',
    name: 'Hỏa Linh Đan',
    targetPillId: ITEMS.PILL_PROTECT_HOA,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 3 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.50,
    expGained: 80
  },
  {
    id: 'recipe_protect_thuy',
    name: 'Thủy Nguyên Đan',
    targetPillId: ITEMS.PILL_PROTECT_THUY,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_VOID_HERB, quantity: 3 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.50,
    expGained: 80
  },
  {
    id: 'recipe_protect_moc',
    name: 'Mộc Linh Hoàn',
    targetPillId: ITEMS.PILL_PROTECT_MOC,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_TUYET_LIEN, quantity: 3 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.50,
    expGained: 80
  },
  {
    id: 'recipe_protect_kim',
    name: 'Kim Cương Đan',
    targetPillId: ITEMS.PILL_PROTECT_KIM,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 8 },
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 3 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.50,
    expGained: 80
  },
  {
    id: 'recipe_protect_tho',
    name: 'Địa Thổ Đan',
    targetPillId: ITEMS.PILL_PROTECT_THO,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 8 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 3 }
    ],
    costCoin: 800,
    staminaCost: 20,
    requiredAlchemyLevel: 3,
    baseSuccessRate: 0.50,
    expGained: 80
  },
  {
    id: 'recipe_co_duyen',
    name: 'Cơ Duyên Đan',
    targetPillId: ITEMS.PILL_CO_DUYEN,
    requiredMaterials: [
      { itemId: ITEMS.MATERIAL_NGODONG, quantity: 5 },
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 10 }
    ],
    costCoin: 2000,
    staminaCost: 30,
    requiredAlchemyLevel: 4,
    baseSuccessRate: 0.35,
    expGained: 150
  }
];

export class AlchemyService {
  /**
   * Lấy danh sách công thức luyện đan
   */
  public getRecipes(): AlchemyRecipe[] {
    return ALCHEMY_RECIPES;
  }

  /**
   * Thực hiện Luyện Đan
   */
  public craftPill(
    userId: string,
    recipeId: string,
    cauldronInventoryId?: number,
    quantity: number = 1
  ): { success: boolean; message: string; isLevelUp?: boolean; evolved?: boolean } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    }

    if (quantity < 1 || quantity > 2) {
      return { success: false, message: 'Số lượng chế tác không hợp lệ.' };
    }

    // Kiểm tra thương thế
    const now = Math.floor(Date.now() / 1000);
    if (user.injury_end_time && user.injury_end_time > now) {
      const remain = user.injury_end_time - now;
      return { success: false, message: `Đạo hữu đang bị trọng thương, không thể luyện đan! (Còn lại **${remain} giây**).` };
    }

    const recipe = ALCHEMY_RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      return { success: false, message: 'Công thức luyện đan này không tồn tại.' };
    }

    // 1. Kiểm tra cấp độ luyện đan
    const userAlchemyLevel = user.alchemy_level || 1;
    if (userAlchemyLevel < recipe.requiredAlchemyLevel) {
      return { success: false, message: `Trình độ Luyện Đan của đạo hữu chưa đủ! (Yêu cầu cấp: **${recipe.requiredAlchemyLevel}**, Hiện tại: **${userAlchemyLevel}**).` };
    }

    // 2. Kiểm tra Thể lực
    const totalStaminaCost = recipe.staminaCost * quantity;
    if (user.stamina < totalStaminaCost) {
      return { success: false, message: `Thể lực không đủ để luyện đan x${quantity}! (Yêu cầu: **${totalStaminaCost}**, Hiện tại: **${user.stamina}**).` };
    }

    // 3. Kiểm tra Linh Thạch
    const totalCostCoin = recipe.costCoin * quantity;
    if (user.coin_ha_pham < totalCostCoin) {
      return { success: false, message: `Linh Thạch không đủ để trả phí lò lửa x${quantity}! (Yêu cầu: **${totalCostCoin}**, Hiện tại: **${user.coin_ha_pham}**).` };
    }

    // 4. Kiểm tra nguyên liệu trong hành trang
    const inventory = inventoryRepository.getUserInventory(userId);
    for (const mat of recipe.requiredMaterials) {
      const invItem = inventory.find(i => i.item_id === mat.itemId);
      const reqQty = mat.quantity * quantity;
      if (!invItem || invItem.quantity < reqQty) {
        const itemInfo = db.prepare('SELECT name FROM items WHERE id = ?').get(mat.itemId) as { name: string } | undefined;
        const itemName = itemInfo ? itemInfo.name : mat.itemId;
        return { success: false, message: `Thiếu nguyên liệu luyện đan: **${itemName}** (Yêu cầu: **${reqQty}**, Hiện có: **${invItem ? invItem.quantity : 0}**).` };
      }
    }

    // 5. Kiểm tra Lò Luyện Đan
    let successBonus = 0.0;
    let cauldronItem: any = null;

    if (cauldronInventoryId) {
      cauldronItem = inventoryRepository.get(cauldronInventoryId);
      if (!cauldronItem || cauldronItem.user_id !== userId || cauldronItem.type !== 'cauldron') {
        return { success: false, message: 'Lò luyện đan đã chọn không hợp lệ hoặc không có trong túi đồ!' };
      }
      try {
        const stats = JSON.parse(cauldronItem.stats || '{}');
        successBonus = stats.success_rate_bonus || 0.0;
      } catch (e) {
        // bỏ qua
      }
    }

    // Kiểm tra chế tạo x2 chỉ cho phép Linh Sư hoặc dùng Lò Luyện Đan Cao Cấp
    if (quantity === 2) {
      const isLinhSu = userAlchemyLevel >= 3;
      const hasHighCauldron = cauldronItem && cauldronItem.item_id === ITEMS.CAULDRON_HIGH;
      if (!isLinhSu && !hasHighCauldron) {
        return { success: false, message: '❌ Cần đạt trình độ Linh Sư (Cấp 3 Luyện Đan) hoặc sử dụng Lò Luyện Đan Thượng Phẩm để chế tác x2 cùng lúc!' };
      }
    }

    // Tính toán tỷ lệ thành công cuối cùng
    // Level chênh lệch buff: +2% mỗi cấp
    const levelDiff = userAlchemyLevel - recipe.requiredAlchemyLevel;
    const levelBonus = levelDiff * 0.02;

    // Cộng hưởng từ Luyện Đan Đường của Tông Môn
    let sectBonus = 0.0;
    if (user.sect_id) {
      try {
        const sect = db.prepare('SELECT dan_duong_level FROM sects WHERE id = ?').get(user.sect_id) as { dan_duong_level: number } | undefined;
        if (sect && sect.dan_duong_level) {
          sectBonus = sect.dan_duong_level * 0.02; // +2% mỗi cấp
        }
      } catch (e) { console.warn('[AlchemyService] Failed to fetch sect dan_duong_level:', e); }
    }

    // Cộng hưởng Hỏa Linh Căn (+0.1% tỷ lệ thành công / điểm Hỏa Linh Căn)
    let hoaLinhCan = 0;
    try {
      const lc = JSON.parse(user.linh_can || '{}');
      hoaLinhCan = lc['Hỏa'] || 0;
    } catch (e) { console.warn('[AlchemyService] Failed to parse linh_can for Hoa element:', e); }
    const hoaBonus = hoaLinhCan * 0.001; // +0.1% mỗi điểm Hỏa Linh Căn

    let rareFireBonus = 0;
    try {
      const { rareFireService } = require('./RareFireService');
      rareFireBonus = rareFireService.getEquippedBonus(userId).alchemyBonus;
    } catch {}
    const finalSuccessRate = Math.min(0.95, recipe.baseSuccessRate + successBonus + levelBonus + sectBonus + hoaBonus + rareFireBonus);

    // Trừ Thể Lực và Linh Thạch trước
    const postStamina = user.stamina - totalStaminaCost;
    const postCoin = user.coin_ha_pham - totalCostCoin;
    userRepository.update(userId, { stamina: postStamina, coin_ha_pham: postCoin });

    // Trừ nguyên liệu
    for (const mat of recipe.requiredMaterials) {
      inventoryRepository.removeItem(userId, mat.itemId, mat.quantity * quantity);
    }

    let successCount = 0;
    let evolvedCount = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = Math.random();
      if (roll <= finalSuccessRate) {
        successCount++;
        if (Math.random() < 0.05) {
          evolvedCount++;
        }
      }
    }

    const staticPill = db.prepare('SELECT name FROM items WHERE id = ?').get(recipe.targetPillId) as { name: string };
    const rewardName = staticPill.name;

    if (successCount > 0) {
      if (evolvedCount > 0) {
        inventoryRepository.addItem(userId, recipe.targetPillId, evolvedCount, JSON.stringify({ evolved: true }));
      }
      if (successCount - evolvedCount > 0) {
        inventoryRepository.addItem(userId, recipe.targetPillId, successCount - evolvedCount, null);
      }

      // Tăng EXP luyện đan
      let currentExp = user.alchemy_exp || 0;
      let currentLevel = user.alchemy_level || 1;
      const totalExpGained = recipe.expGained * quantity;
      currentExp += totalExpGained;

      const expNeeded = currentLevel * 100;
      let isLevelUp = false;
      if (currentExp >= expNeeded) {
        currentLevel += 1;
        currentExp -= expNeeded;
        isLevelUp = true;
      }

      userRepository.update(userId, {
        alchemy_level: currentLevel,
        alchemy_exp: currentExp
      });

      // Kiểm tra thành tựu luyện đan (đếm từ audit_logs)
      const now2 = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'alchemy_craft', ?, ?)"
      ).run(userId, JSON.stringify({ recipeId, successCount, quantity }), now2);

      const totalAlchemy = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'alchemy_craft'"
      ).get(userId) as { c: number };
      const newAlchemyCount = totalAlchemy.c;
      achievementService.setProgress(userId, 'sh_3', newAlchemyCount);
      achievementService.setProgress(userId, 'sh_4', newAlchemyCount);
      achievementService.setProgress(userId, 'sh_5', newAlchemyCount);
      achievementService.setProgress(userId, 'sh_16', newAlchemyCount);

      let responseMsg = `🎉 **Luyện đan hoàn tất!** Đạo hữu đã luyện chế thành công **${successCount}x ${rewardName}**${evolvedCount > 0 ? ` (trong đó có ${evolvedCount} viên Biến Dị 🧬)` : ''}!\n`;
      if (successCount < quantity) {
        responseMsg += `⚠️ Có **${quantity - successCount}** mẻ bị nổ lò thất bại do dược lực không ổn định.\n`;
      }
      responseMsg += `📈 Nhận **+${totalExpGained}** Tu Vi Luyện Đan (Hiện tại: **${currentExp}/${currentLevel * 100}**).`;
      if (isLevelUp) {
        responseMsg += `\n🌟 **Chúc mừng!** Đạo hữu đột phá Luyện Đan Thuật thăng lên **Cấp ${currentLevel} Luyện Đan Sư**!`;
      }

      return { success: true, message: responseMsg, isLevelUp, evolved: evolvedCount > 0 };
    } else {
      // Thất bại hoàn toàn -> Nổ lò!
      // Trọng thương tỷ lệ thuận với cấp độ yêu cầu của công thức (15, 30, 45, 60 phút)
      const injuryMinutes = recipe.requiredAlchemyLevel * 15;
      const injuryDuration = injuryMinutes * 60;
      const injuryEnd = now + injuryDuration;
      userRepository.update(userId, { injury_end_time: injuryEnd });

      let cauldronDestructionMsg = '';
      if (cauldronItem) {
        let breakChance = 0;
        if (cauldronItem.item_id === ITEMS.CAULDRON_LOW) breakChance = 0.25;
        else if (cauldronItem.item_id === ITEMS.CAULDRON_MID) breakChance = 0.10;
        else if (cauldronItem.item_id === ITEMS.CAULDRON_HIGH) breakChance = 0.05;

        if (Math.random() < breakChance) {
          inventoryRepository.removeItemById(cauldronItem.id, 1);
          cauldronDestructionMsg = `\n🔥 Do linh hỏa phản phệ dữ dội, chiếc **${cauldronItem.name}** của đạo hữu đã bị nứt vỡ thành tro bụi!`;
        }
      }

      return {
        success: false,
        message: `💥 **Nổ lò!** Độc hỏa và linh khí bạo tẩu giăng đầy luyện đan phòng! Đạo hữu luyện chế x${quantity} thất bại hoàn toàn, tiêu hao toàn bộ nguyên liệu, bị phế thương kinh mạch (Trọng thương **${injuryMinutes} phút**).${cauldronDestructionMsg}`
      };
    }
  }
}

export const alchemyService = new AlchemyService();
