import { blacksmithService } from './src/services/BlacksmithService';
import { userRepository } from './src/database/repositories/UserRepository';
import { inventoryRepository } from './src/database/repositories/InventoryRepository';
import { initDatabase } from './src/database/database';

async function test() {
  initDatabase();
  const userId = '724608013981450351'; // User hoocshiismee.

  // Cấp tài nguyên
  userRepository.update(userId, { coin_ha_pham: 5000, stamina: 340, level: 100, forging_level: 1 });
  inventoryRepository.addItem(userId, 'material_iron_1', 100);
  inventoryRepository.addItem(userId, 'material_mythril_1', 100);
  inventoryRepository.addItem(userId, 'material_tinh_thiet_1', 10);

  console.log("=== BẮT ĐẦU TEST LUYỆN KHÍ ===");
  
  for (let i = 0; i < 5; i++) {
    const res = blacksmithService.forgeItem(userId, 'recipe_weapon_sword_3');
    console.log(`Lần ${i + 1}:`, res.message.replace(/\n/g, ' '));
  }

  // Kiểm tra túi đồ
  const inv = inventoryRepository.getUserInventory(userId);
  const swords = inv.filter(i => i.item_id === 'weapon_sword_3');
  console.log("=== TÚI ĐỒ (Thiên Cổ Phán Quyết) ===");
  swords.forEach(s => {
    console.log(`- Số lượng: ${s.quantity}, Custom Stats: ${s.custom_stats}`);
  });
}

test();
