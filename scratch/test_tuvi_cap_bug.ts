import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { inventoryRepository } from '../src/database/repositories/InventoryRepository';
import { inventoryService } from '../src/services/InventoryService';

async function main() {
  console.log('🧪 BẮT ĐẦU TEST LỖI CẮN THUỐC KHI ĐẦY TU VI... 🧪\n');
  initDatabase();

  const testUser = 'test_user_tuvi_bug';
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);

  // Tạo nhân vật test ở level 10, Tu Vi đã đầy (15849/15849)
  userRepository.create({
    discord_id: testUser,
    name: 'Thử Nghiệm Giả',
    base_hp: 200,
    base_mp: 100,
    base_atk: 30,
    base_def: 15,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 })
  });

  // Cập nhật thủ công Tu Vi lên 15849 (exp_needed cho level 10)
  db.prepare('UPDATE users SET level = 10, tu_vi = 15849, exp_needed = 15849 WHERE discord_id = ?').run(testUser);
  
  // Clear cache để repository đọc lại từ DB
  (userRepository as any).cache.delete(testUser);

  const user = userRepository.get(testUser)!;
  console.log(`Trước khi uống: Level: ${user.level}, Tu Vi: ${user.tu_vi}/${user.exp_needed}`);

  // Thêm Luyện Khí Đan
  inventoryRepository.addItem(testUser, 'pill_alchemy_tuvi', 1);
  const inv = inventoryRepository.getUserInventory(testUser);
  const pillItem = inv.find((i: any) => i.item_id === 'pill_alchemy_tuvi')!;
  console.log(`Đã thêm Luyện Khí Đan, ID: #${pillItem.id}, Số lượng: ${pillItem.quantity}`);

  const useRes = inventoryService.useItem(testUser, pillItem.id);
  console.log(`Kết quả sử dụng thuốc: Success: ${useRes.success}, Message: "${useRes.message}"`);

  // Kiểm tra DB trực tiếp sau khi dùng
  const dbUser = db.prepare('SELECT level, tu_vi, exp_needed FROM users WHERE discord_id = ?').get(testUser) as any;
  console.log(`DB User sau khi uống thuốc: Tu Vi: ${dbUser.tu_vi}/${dbUser.exp_needed}`);

  const invAfter = inventoryRepository.getUserInventory(testUser);
  const pillItemAfter = invAfter.find((i: any) => i.item_id === 'pill_alchemy_tuvi');
  console.log(`Số lượng Luyện Khí Đan còn lại: ${pillItemAfter ? pillItemAfter.quantity : 0}`);

  console.log('\n🌟 HOÀN TẤT KIỂM THỬ 🌟');
}

main().catch(e => console.error(e));
