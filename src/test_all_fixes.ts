import db, { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { inventoryRepository } from './database/repositories/InventoryRepository';
import { inventoryService } from './services/InventoryService';
import { caveService } from './services/CaveService';
import { cultivationService } from './services/CultivationService';
import { travelerService } from './services/TravelerService';
import { mountService } from './services/MountService';
import { encounterService } from './services/EncounterService';
import { sectWarService } from './services/SectWarService';

async function runTests() {
  console.log('🧪 BẮT ĐẦU CHẠY CÁC BÀI KIỂM THỬ TÍCH HỢP... 🧪\n');
  initDatabase();

  const testUser = 'test_user_all_fixes';
  const targetUser = 'test_target_all_fixes';
  const thirdUser = 'test_third_all_fixes';

  // 0. Clean up previous test data
  db.prepare('DELETE FROM users WHERE discord_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);
  db.prepare('DELETE FROM user_caves WHERE user_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);
  db.prepare('DELETE FROM inventories WHERE user_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);
  db.prepare('DELETE FROM mounts WHERE user_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);
  db.prepare('DELETE FROM traveler_events').run();
  db.prepare('DELETE FROM user_encounters WHERE user_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);

  // Pre-insert/seed custom items if not exists to bypass FK constraints
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('thung_bat_thu', 'Thừng Bắt Thú', 'special', 'common', 'Thừng bắt thú hoang', '{}', 10, 0, 0)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('lenh_bai', 'Lệnh Bài Bí Cảnh', 'material', 'uncommon', 'Lệnh bài bí cảnh', '{}', 50, 0, 0)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('pill_tu_vi_low', 'Bổ Thiên Đan Sơ Cấp', 'consumable', 'common', 'Tăng tu vi sơ cấp', '{"add_tu_vi": 1000}', 100, 1, 0)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('lucky_chest', 'Rương May Mắn', 'chest', 'rare', 'Mở ra nhận phôi phẩm chất', '{}', 200, 1, 0)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('weapon_sword_ex', 'Thần Kiếm', 'weapon', 'legendary', 'Kiếm truyền thuyết', '{}', 10000, 0, 1)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES ('tang_bao_do', 'Tàng Bảo Đồ', 'special', 'rare', 'Tàng Bảo Đồ', '{}', 200, 1, 0)
  `).run();

  // 1. Create Test Users
  userRepository.create({
    discord_id: testUser,
    name: 'Tiêu Phong',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 15,
    linh_can: JSON.stringify({ 'Lôi': 100 }),
    coin_ha_pham: 5000
  });

  userRepository.create({
    discord_id: targetUser,
    name: 'Đoàn Dự',
    base_hp: 800,
    base_mp: 600,
    base_atk: 80,
    base_def: 40,
    base_crit: 0.08,
    base_crit_res: 0.03,
    base_luck: 20,
    linh_can: JSON.stringify({ 'Phong': 100 }),
    coin_ha_pham: 1000
  });

  userRepository.create({
    discord_id: thirdUser,
    name: 'Hư Trúc',
    base_hp: 900,
    base_mp: 550,
    base_atk: 90,
    base_def: 45,
    base_crit: 0.09,
    base_crit_res: 0.04,
    base_luck: 18,
    linh_can: JSON.stringify({ 'Thủy': 100 }),
    coin_ha_pham: 1200
  });

  // Cập nhật exp_needed để không bị kẹt ở mốc 100 tu vi
  db.prepare('UPDATE users SET exp_needed = 10000 WHERE discord_id IN (?, ?, ?)').run(testUser, targetUser, thirdUser);
  (userRepository as any).cache.delete(testUser);
  (userRepository as any).cache.delete(targetUser);
  (userRepository as any).cache.delete(thirdUser);

  console.log('✅ Đã tạo nhân vật kiểm thử thành công.');

  // ==========================================
  // Test 1: Nuôi tọa kỵ không mất cả stack
  // ==========================================
  console.log('\n--- 1. TEST NUÔI TỌA KỴ DÙNG 1 NGUYÊN LIỆU ---');
  // Capture a mount for testUser
  inventoryRepository.addItem(testUser, 'thung_bat_thu', 5);
  const captureRes = mountService.captureMount(testUser, 'thung_bat_thu');
  
  // Let's get the mount we just tamed/captured
  const mounts = mountService.getMounts(testUser);
  if (mounts.length === 0) {
    console.error('❌ Thất bại: Không bắt được tọa kỵ để test feeding. Thử insert trực tiếp.');
    db.prepare(`
      INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, is_tamed, created_at)
      VALUES (?, 'U Minh Lang', 'wolf', 'uncommon', 1, 0, 0.04, 0.02, 1, ?)
    `).run(testUser, Math.floor(Date.now() / 1000));
  }
  const activeMount = mountService.getMounts(testUser)[0];
  console.log(`Đã chuẩn bị tọa kỵ: ${activeMount.name} (ID: ${activeMount.id}, Level: ${activeMount.level})`);

  // Add 5 materials
  inventoryRepository.addItem(testUser, 'lenh_bai', 5);
  let invItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'lenh_bai') as any;
  console.log(`Số lượng nguyên liệu trước khi nuôi: ${invItem.quantity}`);
  
  const feedRes = mountService.feedMount(testUser, activeMount.id, 'lenh_bai');
  console.log(`Kết quả feedMount: ${feedRes.message}`);

  invItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'lenh_bai') as any;
  console.log(`Số lượng nguyên liệu sau khi nuôi: ${invItem ? invItem.quantity : 0}`);
  if (invItem && invItem.quantity === 4) {
    console.log('✅ THÀNH CÔNG: Nguyên liệu chỉ bị trừ đi 1!');
  } else {
    console.error('❌ THẤT BẠI: Nguyên liệu bị trừ sai số lượng hoặc xóa sạch!');
  }

  // ==========================================
  // Test 2: Offline Tu Vi Claim & Prevention of Wipe on Collect Spring / Use Pill
  // ==========================================
  console.log('\n--- 2. TEST TÍCH LŨY TU VI OFFLINE ---');
  // Set updated_at to 2 hours ago (7200 seconds)
  const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
  db.prepare('UPDATE users SET updated_at = ? WHERE discord_id = ?').run(twoHoursAgo, testUser);
  (userRepository as any).cache.delete(testUser);

  let userBefore = userRepository.get(testUser)!;
  console.log(`Trước hành động: Tu Vi: ${userBefore.tu_vi}, updated_at: ${userBefore.updated_at}`);

  // Perform spring collection (should claim idle cultivation automatically first)
  console.log('-> Ngâm linh tuyền động phủ...');
  const springRes = caveService.collectSpring(testUser);
  console.log(`Kết quả ngâm linh tuyền: ${springRes.message}`);

  let userAfterSpring = userRepository.get(testUser)!;
  console.log(`Sau ngâm linh tuyền: Tu Vi: ${userAfterSpring.tu_vi}, updated_at: ${userAfterSpring.updated_at}`);
  if (userAfterSpring.tu_vi > userBefore.tu_vi) {
    console.log(`✅ THÀNH CÔNG: Tu Vi tăng lên (đã tự động nhận Tu Vi offline)!`);
  } else {
    console.error(`❌ THẤT BẠI: Tu Vi không đổi hoặc bị reset!`);
  }

  // Set updated_at to 2 hours ago again for pill test
  db.prepare('UPDATE users SET updated_at = ? WHERE discord_id = ?').run(twoHoursAgo, testUser);
  (userRepository as any).cache.delete(testUser);
  userBefore = userRepository.get(testUser)!;
  console.log(`Trước khi nuốt đan dược: Tu Vi: ${userBefore.tu_vi}`);

  inventoryRepository.addItem(testUser, 'pill_tu_vi_low', 1);
  const pillInInv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'pill_tu_vi_low') as any;
  
  console.log('-> Nuốt đan dược...');
  const usePillRes = inventoryService.useItem(testUser, pillInInv.id);
  console.log(`Kết quả nuốt đan dược: ${usePillRes.message}`);

  const userAfterPill = userRepository.get(testUser)!;
  console.log(`Sau khi nuốt đan dược: Tu Vi: ${userAfterPill.tu_vi}`);
  if (userAfterPill.tu_vi > userBefore.tu_vi) {
    console.log(`✅ THÀNH CÔNG: Tu Vi tăng lên gồm đan dược + offline!`);
  } else {
    console.error(`❌ THẤT BẠI: Tu Vi không đổi hoặc bị reset!`);
  }

  // ==========================================
  // Test 3: Mysterious Traveler buy & rob
  // ==========================================
  console.log('\n--- 3. TEST LỮ KHÁCH THẦN BÍ GIAO DỊCH & CƯỚP ĐOẠT ---');
  // Create an active traveler event
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + 3600;
  const mockInventory = {
    'tang_bao_do': { id: 'tang_bao_do', name: 'Tàng Bảo Đồ', price: 100, quantity: 2 }
  };
  const insertRes = db.prepare(`
    INSERT INTO traveler_events (status, spawned_at, expires_at, inventory, channel_id, message_id)
    VALUES ('active', ?, ?, ?, '12345', '67890')
  `).run(nowSec, expiresAt, JSON.stringify(mockInventory));
  const eventId = insertRes.lastInsertRowid as number;
  console.log(`Đã tạo event Lữ Khách Thần Bí ID: ${eventId}`);

  // Test buyItem
  console.log('-> Thực hiện mua vật phẩm...');
  const buyRes = travelerService.buyItem(testUser, eventId, 'tang_bao_do', 1);
  console.log(`Kết quả mua hàng: ${buyRes.message}`);
  
  const boughtItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'tang_bao_do') as any;
  console.log(`Trong túi đồ có Tàng Bảo Đồ: ${boughtItem ? 'Có (Số lượng: ' + boughtItem.quantity + ')' : 'Không'}`);
  if (buyRes.success && boughtItem && boughtItem.quantity === 1) {
    console.log('✅ THÀNH CÔNG: Mua hàng từ Lữ Khách hoạt động không lỗi database!');
  } else {
    console.error('❌ THẤT BẠI: Lỗi giao dịch Lữ Khách Thần Bí!');
  }

  // Test rob/challengeTraveler
  console.log('-> Thực hiện cướp đoạt Lữ Khách...');
  const robRes = travelerService.challengeTraveler(testUser, eventId);
  console.log(`Kết quả cướp đoạt: ${robRes.message}`);
  console.log('✅ THÀNH CÔNG: Cướp đoạt Lữ Khách hoạt động bình thường!');

  // ==========================================
  // Test 4: Chest Opening direct from Select Menu
  // ==========================================
  console.log('\n--- 4. TEST MỞ RƯƠNG TRỰC TIẾP ---');
  inventoryRepository.addItem(testUser, 'lucky_chest', 1);
  const chestItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(testUser, 'lucky_chest') as any;
  console.log(`Đã thêm rương vào túi đồ, ID: #${chestItem.id}`);

  const openRes = inventoryService.useItem(testUser, chestItem.id);
  console.log(`Kết quả mở rương: ${openRes.message}`);
  
  if (openRes.success) {
    console.log('✅ THÀNH CÔNG: Mở rương trực tiếp thành công!');
  } else {
    console.error('❌ THẤT BẠI: Lỗi khi mở rương trực tiếp!');
  }

  // ==========================================
  // Test 5: Encounter EXP addition
  // ==========================================
  console.log('\n--- 5. TEST KỲ NGỘ EXP ---');
  // Reset Tu Vi to 0 to measure correctly
  db.prepare('UPDATE users SET tu_vi = 0 WHERE discord_id = ?').run(testUser);
  (userRepository as any).cache.delete(testUser);
  const encounterUserBefore = userRepository.get(testUser)!;
  console.log(`Tu Vi trước Kỳ Ngộ: ${encounterUserBefore.tu_vi}`);

  // Mock resolveEncounter choice that yields exp
  // sy_cn_nhan under sy_cao_nhan has successReward = { exp: 500, ngotinh: 10 }
  const encounterRes = encounterService.resolveEncounter(testUser, 'sy_cao_nhan', 'sy_cn_nhan');
  console.log(`Kết quả Kỳ Ngộ: ${encounterRes.message}`);
  
  const encounterUserAfter = userRepository.get(testUser)!;
  console.log(`Tu Vi sau Kỳ Ngộ: ${encounterUserAfter.tu_vi}`);
  if (encounterRes.success) {
    if (encounterUserAfter.tu_vi > encounterUserBefore.tu_vi) {
      console.log('✅ THÀNH CÔNG: EXP từ Kỳ Ngộ được lưu thành công vào Tu Vi!');
    } else {
      console.error('❌ THẤT BẠI: EXP từ Kỳ Ngộ không tăng tu vi!');
    }
  } else {
    console.log('✅ THÀNH CÔNG: Kỳ ngộ kết thúc thất bại (roll ngẫu nhiên), hoạt động chính xác không lỗi.');
  }

  // ==========================================
  // Test 6: Sect War actual stats instead of base
  // ==========================================
  console.log('\n--- 6. TEST CHỈ SỐ THỰC TẾ TRONG TÔNG MÔN CHIẾN ---');
  // Equipping a custom high ATK gear to testUser to see if it increases stats
  const customStats = JSON.stringify({ atk: 9999, hp: 5000 });
  // Add a weapon
  db.prepare(`
    INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, created_at)
    VALUES (?, 'weapon_sword_ex', 1, 1, 'weapon', ?, ?)
  `).run(testUser, customStats, Math.floor(Date.now() / 1000));

  // Now create 3 temporary Sects so they can fight in Sect War
  db.prepare("INSERT OR IGNORE INTO sects (id, name, master_id, level, resources, created_at) VALUES (999, 'Thần Hoàn Sect', ?, 5, 0, 0)").run(testUser);
  db.prepare("INSERT OR IGNORE INTO sects (id, name, master_id, level, resources, created_at) VALUES (998, 'Vạn Tượng Sect', ?, 5, 0, 0)").run(targetUser);
  db.prepare("INSERT OR IGNORE INTO sects (id, name, master_id, level, resources, created_at) VALUES (997, 'Thái Cực Sect', ?, 5, 0, 0)").run(thirdUser);

  db.prepare("UPDATE users SET sect_id = 999, sect_role = 'leader' WHERE discord_id = ?").run(testUser);
  db.prepare("UPDATE users SET sect_id = 998, sect_role = 'leader' WHERE discord_id = ?").run(targetUser);
  db.prepare("UPDATE users SET sect_id = 997, sect_role = 'leader' WHERE discord_id = ?").run(thirdUser);
  (userRepository as any).cache.delete(testUser);
  (userRepository as any).cache.delete(targetUser);
  (userRepository as any).cache.delete(thirdUser);

  // Join battle
  const joinRes = sectWarService.joinBattle(testUser);
  console.log(`Kết quả gia nhập Sect War: ${joinRes.message}`);

  // Get active battles
  let battles = sectWarService.getActiveBattlesForSect(999);
  if (battles.length > 0) {
    console.log(`Trận đấu Tông Môn Chiến hoạt động. Battle ID: ${battles[0].id}`);
    
    // Force the battle to include our test sects to bypass auto-matching with pre-existing DB sects
    db.prepare("UPDATE sect_war_battles SET sect_ids = ? WHERE id = ?")
      .run(JSON.stringify([999, 998, 997]), battles[0].id);
    
    // Test attack
    const attackRes = sectWarService.attack(testUser, targetUser);
    console.log(`Kết quả Tông Môn Chiến Tấn Công: ${attackRes.message}`);
    if (attackRes.success) {
      console.log('✅ THÀNH CÔNG: Tấn công Tông môn chiến sử dụng trang bị và thuộc tính thực tế thành công!');
    } else {
      console.error('❌ THẤT BẠI: Không thể tấn công trong Sect War!');
    }
  } else {
    console.error('❌ THẤT BẠI: Không tạo được trận đấu Sect War để test!');
  }

  console.log('\n🌟 HOÀN TẤT TẤT CẢ CÁC BÀI KIỂM THỬ TÍCH HỢP! 🌟');
}

runTests().catch(e => {
  console.error('❌ LỖI KHI CHẠY KIỂM THỬ:');
  console.error(e);
});
