import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { inventoryRepository } from '../src/database/repositories/InventoryRepository';
import { equipmentService } from '../src/services/EquipmentService';
import { mountService } from '../src/services/MountService';
import { cultivationService } from '../src/services/CultivationService';
import { inventoryService } from '../src/services/InventoryService';
import { spiritWeaponService } from '../src/services/SpiritWeaponService';

async function testBulkOps() {
  console.log('🧪 BẮT ĐẦU TEST CÁC TÍNH NĂNG MỚI & THAO TÁC HÀNG LOẠT... 🧪\n');
  initDatabase();

  const testUser = 'test_user_bulk_ops';
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM user_caves WHERE user_id = ?').run(testUser);
  db.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);
  db.prepare('DELETE FROM mounts WHERE user_id = ?').run(testUser);

  // 1. Tạo nhân vật test
  userRepository.create({
    discord_id: testUser,
    name: 'Thần Thông Giả',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 }),
    coin_ha_pham: 10000
  });

  const user = userRepository.get(testUser)!;
  console.log(`[Khởi tạo] Level: ${user.level}, Linh Thạch: ${user.coin_ha_pham}`);

  // 2. Test Giám Định Phôi Hàng Loạt
  console.log('\n--- 1. TEST GIÁM ĐỊNH PHÔI HÀNG LOẠT ---');
  inventoryRepository.addItem(testUser, 'phoi_weapon_b', 5);
  let phoiItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'phoi_weapon_b') as any;
  console.log(`Số lượng phôi trước khi giám định: ${phoiItem.quantity}`);

  const appraiseRes = equipmentService.appraisePhoi(testUser, phoiItem.id, 3);
  console.log(`Kết quả appraisePhoi (giám định 3 phôi): ${appraiseRes.message}`);

  phoiItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'phoi_weapon_b') as any;
  console.log(`Số lượng phôi sau khi giám định: ${phoiItem ? phoiItem.quantity : 0}`);

  const createdWeapons = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id LIKE ?').all(testUser, 'weapon_sword_b%') as any[];
  const totalWeaponsCreated = createdWeapons.reduce((sum, w) => sum + w.quantity, 0);
  console.log(`Tổng số lượng kiếm phẩm B được tạo ra: ${totalWeaponsCreated} (ở ${createdWeapons.length} stacks)`);
  createdWeapons.forEach((w, idx) => {
    console.log(` Kiếm #${idx + 1} (ID: ${w.id}, Số lượng: ${w.quantity}): custom_stats = ${w.custom_stats}`);
  });

  if (phoiItem && phoiItem.quantity === 2 && totalWeaponsCreated === 3) {
    console.log('✅ THÀNH CÔNG: Giám định hàng loạt phôi trừ số lượng và tạo thành phẩm chính xác!');
  } else {
    console.error('❌ THẤT BẠI: Giám định hàng loạt hoạt động sai số lượng!');
  }

  // 3. Test Phân Giải Trang Bị Hàng Loạt
  console.log('\n--- 2. TEST PHÂN GIẢI TRANG BỊ HÀNG LOẠT ---');
  // Hãy phân giải tất cả vũ khí phẩm B trở xuống (hiện có 3 thanh kiếm vừa giám định)
  const fragmentsBefore = db.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'item_fragment') as any;
  const numFragmentsBefore = fragmentsBefore ? fragmentsBefore.quantity : 0;
  console.log(`Số lượng mảnh trang bị trước khi phân giải: ${numFragmentsBefore}`);

  const salvageRes = equipmentService.salvageEquipmentBulk(testUser, 'rare');
  console.log(`Kết quả salvageEquipmentBulk: ${salvageRes.message}`);

  const weaponsRemaining = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id LIKE ?').all(testUser, 'weapon_sword_b%') as any[];
  console.log(`Số lượng kiếm phẩm B còn lại: ${weaponsRemaining.length}`);

  const fragmentsAfter = db.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'item_fragment') as any;
  const numFragmentsAfter = fragmentsAfter ? fragmentsAfter.quantity : 0;
  console.log(`Số lượng mảnh trang bị sau khi phân giải: ${numFragmentsAfter}`);

  if (weaponsRemaining.length === 0 && numFragmentsAfter > numFragmentsBefore) {
    console.log('✅ THÀNH CÔNG: Phân giải hàng loạt trang bị thành công!');
  } else {
    console.error('❌ THẤT BẠI: Phân giải hàng loạt lỗi!');
  }

  // 4. Test Nuôi Tọa Kỵ Hàng Loạt
  console.log('\n--- 3. TEST NUÔI TỌA KỴ HÀNG LOẠT ---');
  db.prepare(`
    INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, is_tamed, created_at)
    VALUES (?, 'Hỏa Kỳ Lân', 'kirin', 'legendary', 1, 0, 0.15, 0.10, 1, ?)
  `).run(testUser, Math.floor(Date.now() / 1000));

  const mount = mountService.getMounts(testUser)[0];
  console.log(`Tọa kỵ ban đầu: ${mount.name} (Level: ${mount.level}, EXP: ${mount.exp})`);

  // Thêm 5 nguyên liệu nuôi tọa kỵ (rarity legendary: +150 EXP mỗi món)
  db.prepare(`
    INSERT INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('material_test_legendary', 'Linh Cốt Tinh Thạch', 'material', 'legendary', 'Nguyên liệu test', '{}', 1000, 0, 0)
    ON CONFLICT(id) DO NOTHING
  `).run();
  inventoryRepository.addItem(testUser, 'material_test_legendary', 5);

  const feedRes = mountService.feedMount(testUser, mount.id, 'material_test_legendary', 3);
  console.log(`Kết quả feedMount (cho ăn 3 cái): ${feedRes.message}`);

  const updatedMount = mountService.getMounts(testUser)[0];
  console.log(`Tọa kỵ sau khi cho ăn: Level: ${updatedMount.level}, EXP: ${updatedMount.exp}`);

  const remainMaterials = db.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'material_test_legendary') as any;
  console.log(`Số lượng nguyên liệu còn lại: ${remainMaterials ? remainMaterials.quantity : 0}`);

  if (remainMaterials && remainMaterials.quantity === 2 && updatedMount.level > 1) {
    console.log('✅ THÀNH CÔNG: Cho tọa kỵ ăn hàng loạt trừ đúng số lượng nguyên liệu và thăng cấp chính xác!');
  } else {
    console.error('❌ THẤT BẠI: Tọa kỵ ăn hàng loạt sai số lượng hoặc thăng cấp lỗi!');
  }

  // 5. Test Cắn Thuốc Tu Vi Khi Tại Cực Hạn (Chờ đột phá)
  console.log('\n--- 4. TEST CẮN THUỐC & TRÁNH WIPE TU VI ---');
  // Cài đặt tu vi testUser bằng đúng exp_needed (chờ đột phá)
  db.prepare('UPDATE users SET tu_vi = 1000, exp_needed = 1000, level = 38 WHERE discord_id = ?').run(testUser);
  
  // Reset cache
  (userRepository as any).cache.delete(testUser);

  let freshUser = userRepository.get(testUser)!;
  console.log(`Trước hành động: Tu Vi: ${freshUser.tu_vi}/${freshUser.exp_needed}`);

  // Thử dùng đan tu vi khi đang kẹt ở mốc đột phá (sẽ phải bị chặn lại báo lỗi đỏ)
  db.prepare(`
    INSERT INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('pill_tuvi_test', 'Luyện Khí Đan Cấp Cực', 'pill', 'rare', 'Tăng tu vi test', '{"add_tu_vi": 1000}', 1000, 1, 0)
    ON CONFLICT(id) DO NOTHING
  `).run();
  inventoryRepository.addItem(testUser, 'pill_tuvi_test', 1);
  const pillItemInInv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'pill_tuvi_test') as any;

  const usePillRes = inventoryService.useItem(testUser, pillItemInInv.id);
  console.log(`Kết quả sử dụng thuốc khi đầy tu vi: ${usePillRes.message}`);

  if (!usePillRes.success) {
    console.log('✅ THÀNH CÔNG: Đã chặn sử dụng thuốc tu vi khi tu vi đầy chờ đột phá!');
  } else {
    console.error('❌ THẤT BẠI: Thuốc vẫn được sử dụng thành công khi tu vi đã ở mức cực hạn!');
  }

  // 6. Test claimIdleCultivation khi tu vi đang vượt quá hoặc bằng exp_needed (Ví dụ có tu vi dư từ cắn thuốc trước đó)
  // Đặt tu vi vượt quá exp_needed (mô phỏng trường hợp có dư tu vi hoặc cắn thuốc ở tầng nhỏ)
  db.prepare('UPDATE users SET tu_vi = 1200, exp_needed = 1000, level = 5, updated_at = ? WHERE discord_id = ?').run(Math.floor(Date.now() / 1000) - 7200, testUser);
  (userRepository as any).cache.delete(testUser);

  const beforeClaim = userRepository.get(testUser)!;
  console.log(`Trước claimIdle: Tu Vi: ${beforeClaim.tu_vi}/${beforeClaim.exp_needed}`);

  const claimRes = cultivationService.claimIdleCultivation(testUser);
  console.log(`Kết quả claimIdleCultivation: gained: ${claimRes?.gained}, user.tu_vi: ${claimRes?.user.tu_vi}`);

  const afterClaim = userRepository.get(testUser)!;
  console.log(`Sau claimIdle: Tu Vi: ${afterClaim.tu_vi}/${afterClaim.exp_needed}`);

  if (afterClaim.tu_vi === 1200) {
    console.log('✅ THÀNH CÔNG: Tu vi không bị tụt lùi về exp_needed khi thiền định offline!');
  } else {
    console.error('❌ THẤT BẠI: Tu vi bị reset/thụt lùi về exp_needed!');
  }

  // 7. Test Nuôi Khí Linh Bằng Mã Hành Trang (Inventory ID) và các cơ chế bảo vệ
  console.log('\n--- 5. TEST NUÔI KHÍ LINH BẰNG MÃ HÀNH TRANG & BẢO VỆ ---');
  db.prepare('DELETE FROM spirit_weapons WHERE user_id = ?').run(testUser);

  // Thêm vũ khí Epic làm ký chủ khí linh
  db.prepare(`
    INSERT INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('weapon_epic_test', 'Vân Long Kiếm', 'equipment', 'epic', 'Kiếm pháp của mây rồng', '{}', 2000, 0, 1)
    ON CONFLICT(id) DO NOTHING
  `).run();
  inventoryRepository.addItem(testUser, 'weapon_epic_test', 1);
  const userWeapon = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'weapon_epic_test') as any;

  // Thức tỉnh khí linh
  db.prepare(`
    INSERT INTO spirit_weapons (user_id, item_id, spirit_name, level, exp, affinity, skill_id, awakened_at)
    VALUES (?, ?, 'Tiểu Vân', 1, 0, 50, NULL, ?)
  `).run(testUser, userWeapon.item_id, Math.floor(Date.now() / 1000));
  const spirit = spiritWeaponService.getSpiritWeapon(testUser, userWeapon.item_id)!;
  console.log(`Khí linh thức tỉnh: ${spirit.spirit_name} (Level: ${spirit.level}, EXP: ${spirit.exp})`);

  // Thêm nguyên liệu hiến tế (Common: +10 EXP mỗi món)
  db.prepare(`
    INSERT INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('material_test_spirit', 'Tinh Thạch Linh Sa', 'material', 'common', 'Cát linh khí kiểm thử', '{}', 100, 0, 0)
    ON CONFLICT(id) DO NOTHING
  `).run();
  inventoryRepository.addItem(testUser, 'material_test_spirit', 5);
  const materialItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'material_test_spirit') as any;

  // Cho ăn thành công bằng inventoryId
  const feedSpiritRes = spiritWeaponService.feedSpirit(testUser, spirit.id, materialItem.id, 3);
  console.log(`Kết quả cho ăn: ${feedSpiritRes.message}`);

  const updatedSpirit = spiritWeaponService.getSpiritWeapon(testUser, userWeapon.item_id)!;
  console.log(`Khí linh sau ăn: Level: ${updatedSpirit.level}, EXP: ${updatedSpirit.exp}`);

  const materialRemain = db.prepare('SELECT quantity FROM inventories WHERE id = ?').get(materialItem.id) as any;
  console.log(`Số lượng nguyên liệu còn lại: ${materialRemain ? materialRemain.quantity : 0}`);

  // Test bảo vệ trang bị đang đeo
  db.prepare('UPDATE inventories SET is_equipped = 1 WHERE id = ?').run(userWeapon.id);
  const feedEquippedRes = spiritWeaponService.feedSpirit(testUser, spirit.id, userWeapon.id, 1);
  console.log(`Kết quả cho ăn trang bị đang đeo: ${feedEquippedRes.message}`);

  // Test bảo vệ trang bị Bản Mệnh
  db.prepare('UPDATE inventories SET is_equipped = 0, is_life_bound = 1 WHERE id = ?').run(userWeapon.id);
  const feedBoundRes = spiritWeaponService.feedSpirit(testUser, spirit.id, userWeapon.id, 1);
  console.log(`Kết quả cho ăn trang bị Bản Mệnh: ${feedBoundRes.message}`);

  if (
    materialRemain && materialRemain.quantity === 2 && 
    updatedSpirit.exp === 30 && 
    !feedEquippedRes.success && 
    !feedBoundRes.success
  ) {
    console.log('✅ THÀNH CÔNG: Cho khí linh ăn bằng mã hành trang hoạt động đúng, bảo vệ an toàn hoạt động tuyệt hảo!');
  } else {
    console.error('❌ THẤT BẠI: Lỗi logic cho khí linh ăn hoặc bảo vệ an toàn!');
  }

  console.log('\n🌟 HOÀN TẤT TẤT CẢ CÁC BÀI KIỂM THỬ THAO TÁC HÀNG LOẠT 🌟');
}

testBulkOps().catch(console.error);
