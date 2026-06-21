import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { cultivationService } from '../src/services/CultivationService';
import { CombatEngine, Combatant } from '../src/services/CombatEngine';

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍCH HỢP LINH CĂN V2... 🧪\n');
  initDatabase();

  const testUser = 'test_user_linhcan';

  // 0. Cleanup old test data
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);

  // 1. Create a test character with initial stats and 10000 Hạ Phẩm Linh Thạch
  userRepository.create({
    discord_id: testUser,
    name: 'Linh Căn Đạo Sĩ',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 15,
    linh_can: JSON.stringify({ 'Hỏa': 89, 'Mộc': 11 }),
    coin_ha_pham: 10000
  });

  // Gán thêm 100 Trung Phẩm Linh Thạch và xóa cache
  db.transaction(() => {
    userRepository.update(testUser, { coin_trung_pham: 100 });
  })();
  (userRepository as any).cache.delete(testUser);

  const initialUser = userRepository.get(testUser)!;
  console.log(`👤 Tạo nhân vật thành công: ${initialUser.name}`);
  console.log(`☯️ Linh Căn ban đầu: ${initialUser.linh_can}`);
  console.log(`🪙 Số dư ban đầu: ${initialUser.coin_trung_pham} Trung Phẩm, ${initialUser.coin_ha_pham} Hạ Phẩm`);

  if (initialUser.coin_trung_pham !== 100 || initialUser.coin_ha_pham !== 10000) {
    throw new Error('Số dư khởi tạo không chính xác!');
  }

  // ==========================================
  // Test 1: Tôi luyện dùng Trung Phẩm Linh Thạch
  // ==========================================
  console.log('\n--- Test 1: Tôi luyện bằng Trung Phẩm Linh Thạch ---');
  let result = cultivationService.temperLinhCan(testUser, 'Hỏa');
  console.log(`👉 Kết quả: ${result.message}`);
  
  let u = userRepository.get(testUser)!;
  console.log(`☯️ Linh Căn sau tôi luyện: ${u.linh_can}`);
  console.log(`🪙 Số dư: ${u.coin_trung_pham} Trung Phẩm, ${u.coin_ha_pham} Hạ Phẩm`);

  let lc = JSON.parse(u.linh_can);
  if (lc['Hỏa'] !== 90 || lc['Mộc'] !== 10) {
    throw new Error(`Phân bổ Linh Căn sai lệch! Kì vọng Hỏa: 90, Mộc: 10. Thực tế Hỏa: ${lc['Hỏa']}, Mộc: ${lc['Mộc']}`);
  }
  if (u.coin_trung_pham !== 50) {
    throw new Error(`Trừ Trung Phẩm Linh Thạch sai lệch! Kì vọng: 50. Thực tế: ${u.coin_trung_pham}`);
  }
  console.log('✅ TEST 1 PASSED: Tôi luyện bằng Trung Phẩm Linh Thạch và phân bổ lại phần trăm thành công.');

  // ==========================================
  // Test 2: Tôi luyện dùng Hạ Phẩm Linh Thạch (khi hết Trung Phẩm)
  // ==========================================
  console.log('\n--- Test 2: Tôi luyện bằng Hạ Phẩm Linh Thạch (hết Trung Phẩm) ---');
  // Trừ hết Trung Phẩm còn lại để test chuyển đổi sang Hạ Phẩm
  db.transaction(() => {
    userRepository.update(testUser, { coin_trung_pham: 0 });
  })();
  (userRepository as any).cache.delete(testUser);

  result = cultivationService.temperLinhCan(testUser, 'Hỏa');
  console.log(`👉 Kết quả: ${result.message}`);
  
  u = userRepository.get(testUser)!;
  console.log(`☯️ Linh Căn sau tôi luyện: ${u.linh_can}`);
  console.log(`🪙 Số dư: ${u.coin_trung_pham} Trung Phẩm, ${u.coin_ha_pham} Hạ Phẩm`);

  lc = JSON.parse(u.linh_can);
  if (lc['Hỏa'] !== 91 || lc['Mộc'] !== 9) {
    throw new Error(`Phân bổ Linh Căn sai lệch! Kì vọng Hỏa: 91, Mộc: 9. Thực tế Hỏa: ${lc['Hỏa']}, Mộc: ${lc['Mộc']}`);
  }
  if (u.coin_ha_pham !== 5000) {
    throw new Error(`Trừ Hạ Phẩm Linh Thạch sai lệch! Kì vọng: 5000. Thực tế: ${u.coin_ha_pham}`);
  }
  console.log('✅ TEST 2 PASSED: Tự động dùng Hạ Phẩm Linh Thạch khi thiếu Trung Phẩm thành công.');

  // ==========================================
  // Test 3: Thanh lọc hoàn toàn (giảm về 0% và xóa khỏi Linh Căn)
  // ==========================================
  console.log('\n--- Test 3: Thanh lọc hệ linh căn phụ về 0% ---');
  // Hack Linh Căn về Hỏa: 99%, Mộc: 1% để test phát tôi luyện cuối
  db.transaction(() => {
    userRepository.update(testUser, { 
      linh_can: JSON.stringify({ 'Hỏa': 99, 'Mộc': 1 }),
      coin_trung_pham: 50 
    });
  })();
  (userRepository as any).cache.delete(testUser);

  result = cultivationService.temperLinhCan(testUser, 'Hỏa');
  console.log(`👉 Kết quả: ${result.message}`);

  u = userRepository.get(testUser)!;
  console.log(`☯️ Linh Căn sau tôi luyện: ${u.linh_can}`);
  console.log(`🪙 Số dư: ${u.coin_trung_pham} Trung Phẩm, ${u.coin_ha_pham} Hạ Phẩm`);

  lc = JSON.parse(u.linh_can);
  if (lc['Hỏa'] !== 100) {
    throw new Error(`Độ tinh thuần Hỏa không đạt 100%! Thực tế: ${lc['Hỏa']}`);
  }
  if ('Mộc' in lc) {
    throw new Error('Hệ Mộc đáng lẽ phải bị xóa khi giảm về 0%!');
  }

  // Kiểm tra tốc độ hấp thu linh khí sau khi thành Đơn Linh Căn (Kỳ vọng: 1.5x)
  const speedMult = cultivationService.getCultivationSpeedMultiplier(u.linh_can);
  console.log(`🚀 Tốc độ tu luyện Đơn Linh Căn: ${speedMult}x (Kỳ vọng: 1.5x)`);
  if (speedMult !== 1.5) {
    throw new Error(`Tốc độ tu luyện sai lệch! Kì vọng: 1.5. Thực tế: ${speedMult}`);
  }

  console.log('✅ TEST 3 PASSED: Hệ phụ bị thanh lọc hoàn toàn ở 0%, người chơi trở thành Đơn Linh Căn (100% Hỏa, 1.5x Tốc độ).');

  // ==========================================
  // Test 4: Giả lập Chiến đấu và Thiên Phú Thiên Linh Căn (>= 90%)
  // ==========================================
  console.log('\n--- Test 4: Giả lập Chiến đấu với Thiên Phú Thiên Linh Căn (>= 90%) ---');

  // Ta sẽ kiểm tra lần lượt các Thiên Phú Thiên Linh Căn (>= 90%) trong CombatEngine.
  // Để các thiên phú kích hoạt 100%, ta sẽ tạm thời mock Math.random.
  const originalRandom = Math.random;

  const testTalent = (linhCanObj: Record<string, number>, label: string, checkLogContains: string[]) => {
    console.log(`\nTesting ${label}...`);
    const pCombat: Combatant = {
      name: 'Thiên Tài Tu Sĩ',
      hp: 1000,
      maxHp: 1000,
      atk: 200,
      def: 80,
      crit: 0.1,
      critRes: 0.05,
      luck: 10,
      linhCan: JSON.stringify(linhCanObj),
      speed: 120,
      dodge: 0.1,
      equippedSkills: []
    };

    const eCombat: Combatant = {
      name: 'Vực Ngoại Tà Ma',
      hp: 500,
      maxHp: 500,
      atk: 120,
      def: 60,
      crit: 0.05,
      critRes: 0.0,
      luck: 5,
      speed: 100,
      dodge: 0.0,
      element: 'Thổ'
    };

    // Mock Math.random để:
    // 1. Linh căn kích hoạt (rolled < triggerChance -> 0.01 < 0.50) -> true
    // 2. Không bạo kích, không né tránh tự nhiên, v.v.
    let randomCallCount = 0;
    Math.random = () => {
      randomCallCount++;
      // Chúng ta muốn rolled < triggerChance (0.01 < 0.50) trả về true cho Linh Căn Kỹ Năng
      // Cân nhắc trả về 0.01
      return 0.01;
    };

    const matchResult = CombatEngine.run(pCombat, eCombat, null, 1);
    
    // Khôi phục Math.random tạm thời
    Math.random = originalRandom;

    // In log trận đấu để debug
    console.log('--- Combat Log (Hiệp 1) ---');
    console.log(matchResult.log.slice(0, 10).join('\n'));
    console.log('---------------------------');

    // Kiểm tra log có chứa các cụm từ mong đợi hay không
    for (const expectedText of checkLogContains) {
      const match = matchResult.log.some(line => line.includes(expectedText));
      if (!match) {
        throw new Error(`Không tìm thấy dòng chữ kì vọng trong combat log: "${expectedText}"`);
      }
    }
    console.log(`✅ ${label} kích hoạt và hoạt động chính xác!`);
  };

  // Test Hỏa Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Hỏa': 90 }, 
    'Hỏa Thiên Linh Căn', 
    [
      'Hỏa Chân Linh Căn',
      'Hỏa Thiên Linh Căn',
      'Nhân đôi thiêu đốt'
    ]
  );

  // Test Thủy Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Thủy': 90 }, 
    'Thủy Thiên Linh Căn', 
    [
      'Thủy Thiên Linh Căn',
      'hồi lại'
    ]
  );

  // Test Mộc Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Mộc': 90 }, 
    'Mộc Thiên Linh Căn', 
    [
      'Mộc Thiên Linh Căn',
      'Hấp Huyết Cổ Pháp',
      'hút máu'
    ]
  );

  // Test Thổ Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Thổ': 90 }, 
    'Thổ Thiên Linh Căn', 
    [
      'Thổ Thiên Linh Căn',
      'Thổ Giáp Thuật',
      'phòng thủ'
    ]
  );

  // Test Lôi Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Lôi': 90 }, 
    'Lôi Thiên Linh Căn', 
    [
      'Lôi Thiên Linh Căn',
      'Lôi Phạt Kinh Thiên',
      'Tê Liệt'
    ]
  );

  // Test Phong Thiên Linh Căn (>= 90%)
  testTalent(
    { 'Phong': 90 }, 
    'Phong Thiên Linh Căn', 
    [
      'Phong Thiên Linh Căn',
      'Phong Hành Bộ',
      'né tránh'
    ]
  );

  // Clean up database test data
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  console.log('\n🧹 Đã dọn dẹp dữ liệu kiểm thử.');
  console.log('\n🌟 HOÀN THẤT KIỂM THỬ TÍCH HỢP LINH CĂN V2 THÀNH CÔNG! 🌟');
}

runTests().catch(e => {
  console.error('❌ LỖI TRONG BÀI KIỂM THỬ:');
  console.error(e);
  process.exit(1);
});
