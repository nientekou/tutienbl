import db, { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { inventoryRepository } from './database/repositories/InventoryRepository';
import { inventoryService } from './services/InventoryService';
import { caveService } from './services/CaveService';
import { cultivationService } from './services/CultivationService';

async function testSpringAndPill() {
  console.log('🧪 BẮT ĐẦU TEST LINH TUYỀN & CẮN THUỐC... 🧪\n');
  initDatabase();

  const testUser = 'test_user_spring_pill';
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM user_caves WHERE user_id = ?').run(testUser);
  db.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);

  // Tạo nhân vật test
  userRepository.create({
    discord_id: testUser,
    name: 'Tu Luyện Giả',
    base_hp: 200,
    base_mp: 100,
    base_atk: 30,
    base_def: 15,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 })
  });

  const user = userRepository.get(testUser)!;
  console.log(`Ban đầu: Level: ${user.level}, Tu Vi: ${user.tu_vi}/${user.exp_needed}`);

  // Test Linh Tuyền Động Phủ
  console.log('\n--- TEST LINH TUYỀN ---');
  const collectRes = caveService.collectSpring(testUser);
  console.log(`Collect Spring Result: ${collectRes.message}`);

  // Kiểm tra DB trực tiếp
  let dbUser = db.prepare('SELECT tu_vi, updated_at FROM users WHERE discord_id = ?').get(testUser) as any;
  console.log(`DB User sau khi ngâm Linh Tuyền: Tu Vi: ${dbUser.tu_vi}, updated_at: ${dbUser.updated_at}`);

  // Kiểm tra qua userRepository.get (sẽ dùng cache hoặc DB)
  let repoUser = userRepository.get(testUser)!;
  console.log(`Repo User sau khi ngâm Linh Tuyền: Tu Vi: ${repoUser.tu_vi}, updated_at: ${repoUser.updated_at}`);

  // Mô phỏng claimIdleCultivation trong /hoso
  const claimRes = cultivationService.claimIdleCultivation(testUser);
  console.log(`Claim Idle Cultivation: gained: ${claimRes?.gained}, user.tu_vi: ${claimRes?.user.tu_vi}`);

  // Test Cắn Thuốc
  console.log('\n--- TEST CẮN THUỐC ---');
  inventoryRepository.addItem(testUser, 'pill_tu_vi_low', 2);
  const inv = inventoryRepository.getUserInventory(testUser);
  const pillItem = inv.find((i: any) => i.item_id === 'pill_tu_vi_low')!;
  console.log(`Đã thêm thuốc, ID: #${pillItem.id}, Số lượng: ${pillItem.quantity}`);

  const useRes = inventoryService.useItem(testUser, pillItem.id);
  console.log(`Use Item Result: ${useRes.message}`);

  // Kiểm tra DB trực tiếp
  dbUser = db.prepare('SELECT tu_vi, updated_at FROM users WHERE discord_id = ?').get(testUser) as any;
  console.log(`DB User sau khi cắn thuốc lần 1: Tu Vi: ${dbUser.tu_vi}, updated_at: ${dbUser.updated_at}`);

  // Kiểm tra qua userRepository.get
  repoUser = userRepository.get(testUser)!;
  console.log(`Repo User sau khi cắn thuốc lần 1: Tu Vi: ${repoUser.tu_vi}, updated_at: ${repoUser.updated_at}`);

  // Mô phỏng claimIdleCultivation lần nữa
  const claimRes2 = cultivationService.claimIdleCultivation(testUser);
  console.log(`Claim Idle Cultivation 2: gained: ${claimRes2?.gained}, user.tu_vi: ${claimRes2?.user.tu_vi}`);

  console.log('\n🌟 HOÀN TẤT TEST LINH TUYỀN & CẮN THUỐC 🌟');
}

testSpringAndPill().catch(e => console.error(e));
