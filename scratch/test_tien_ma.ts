import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { cultivationService } from '../src/services/CultivationService';
import { tribulationService } from '../src/services/TribulationService';
import { pvpService } from '../src/services/PvPService';
import { inventoryService } from '../src/services/InventoryService';
import { performWork } from '../src/commands/general/lamviec';
import { getRealmDetails } from '../src/utils/constants';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG HỆ THỐNG TIÊN MA & TẨU HỎA NHẬP MA... 🧪\n');
  initDatabase();

  const testUser1 = 'test_user_tien_ma_1';
  const testUser2 = 'test_user_tien_ma_2';

  // Clean up
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser1);
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser2);
  db.prepare('DELETE FROM audit_logs WHERE user_id IN (?, ?)').run(testUser1, testUser2);
  (userRepository as any).cache.delete(testUser1);
  (userRepository as any).cache.delete(testUser2);

  // 1. Tạo nhân vật test
  console.log('1. Khởi tạo 2 tu sĩ thử nghiệm...');
  userRepository.create({
    discord_id: testUser1,
    name: 'Đường Tam',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 }),
    coin_ha_pham: 100000
  });

  userRepository.create({
    discord_id: testUser2,
    name: 'Lâm Động',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Thủy': 100 }),
    coin_ha_pham: 100000
  });

  let u1 = userRepository.get(testUser1)!;
  let u2 = userRepository.get(testUser2)!;

  // Verify alignment initial values
  assert(u1.alignment === 'neutral', 'Đạo thống khởi tạo phải là neutral');

  // Verify Tán Tu (Neutral) +5% Dodge buff
  const activeStatsNeutral1 = inventoryService.getActiveStats(testUser1)!;
  assert(activeStatsNeutral1.dodge === 0.10, `Tán Tu phải được tăng +5% Né tránh cơ bản (0.05 -> 0.10) (Nhận được: ${activeStatsNeutral1.dodge})`);

  // 2. Kiểm thử Rào Cản Cấp Độ chọn Đạo Thống (<39)
  console.log('\n2. Kiểm tra điều kiện cấp độ (Cấp 39 - Trúc Cơ) khi chọn Đạo Thống...');
  db.prepare('UPDATE users SET level = 38 WHERE discord_id = ?').run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  u1 = userRepository.get(testUser1)!;
  assert(u1.level === 38, 'Level hiện tại phải là 38');
  assert(u1.level < 39, 'Cấp 38 không đủ điều kiện nhập Chính/Ma Đạo');

  // Nâng lên cấp 39
  db.prepare('UPDATE users SET level = 39 WHERE discord_id = ?').run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  u1 = userRepository.get(testUser1)!;
  assert(u1.level === 39, 'Cấp 39 đủ điều kiện chọn Đạo Thống');

  // 3. Kiểm thử thuộc tính Chính Đạo (Orthodox)
  console.log('\n3. Kiểm tra buff thuộc tính của Chính Đạo...');
  db.prepare("UPDATE users SET alignment = 'orthodox' WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  
  const neutralStats = cultivationService.calculateStatsForLevel(77, u1.linh_can, 'neutral');
  const orthodoxStats = cultivationService.calculateStatsForLevel(77, u1.linh_can, 'orthodox');
  
  assert(orthodoxStats.def === Math.round(neutralStats.def * 1.10), 'Chính Đạo phải được tăng +10% Phòng ngự');
  assert(orthodoxStats.atk === neutralStats.atk, 'Chính Đạo không được buff Công kích');

  const activeStatsOrtho = inventoryService.getActiveStats(testUser1)!;
  assert(activeStatsOrtho.dodge === 0.05, `Chính Đạo không được cộng +5% Né tránh (Nhận được: ${activeStatsOrtho.dodge})`);

  // 4. Kiểm thử Bế Quan Đột Phá được giảm 10% chi phí cho Chính Đạo
  console.log('\n4. Kiểm tra giảm phí Bế Quan cho Chính Đạo...');
  // Neutral bequan cost: level 77 -> 77 * 200 = 15400
  // Orthodox bequan cost: 77 * 200 * 0.9 = 13860
  db.prepare("UPDATE users SET alignment = 'neutral', level = 77, coin_ha_pham = 0, tu_vi = 1000000, exp_needed = 1000 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  let res = cultivationService.breakthrough(testUser1, 'bequan');
  assert(res.success === false && res.message.includes('15400'), 'Neutral Bế Quan phí phải là 15400');

  db.prepare("UPDATE users SET alignment = 'orthodox', level = 77, coin_ha_pham = 0, tu_vi = 1000000, exp_needed = 1000 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  res = cultivationService.breakthrough(testUser1, 'bequan');
  assert(res.success === false && res.message.includes('13860'), 'Chính Đạo Bế Quan phí phải là 13860 (giảm 10%)');

  // 5. Kiểm thử giảm sát thương Lôi Kiếp cho Chính Đạo (-10% damage)
  console.log('\n5. Kiểm tra giảm sát thương Lôi Kiếp cho Chính Đạo...');
  // Level 76 (Trúc Cơ Kỳ Tầng 38) -> majorIndex = 1
  db.prepare("UPDATE users SET level = 76, alignment = 'orthodox' WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  
  const statsOrthoLK = inventoryService.getActiveStats(testUser1)!;
  const baseDmgOrtho = Math.round(40 + 1 * 50 + statsOrthoLK.hp * 0.06);
  const expectedOrthoDmg = Math.round(baseDmgOrtho * 0.90);

  tribulationService.start(testUser1, 'Đường Tam', 1);
  let state = (tribulationService as any).activeTribulations.get(testUser1);
  assert(state.damagePerBolt === expectedOrthoDmg, `Sát thương lôi kiếp Chính Đạo phải là ${expectedOrthoDmg} (Nhận được: ${state.damagePerBolt})`);
  (tribulationService as any).activeTribulations.delete(testUser1);

  // 6. Kiểm thử tăng 5% Linh Thạch khi làm việc (/lamviec) của Chính Đạo
  console.log('\n6. Kiểm tra tăng +5% Linh Thạch khi làm việc của Chính Đạo...');
  const originalRandom = Math.random;
  const originalNow = Date.now;
  
  let customNow = 1700000000;
  Date.now = () => customNow * 1000;
  Math.random = () => 0.5; // Mining coins = Math.floor(0.5 * 21) + 10 = 20.
  
  // Neutral làm việc
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 0, stamina = 500 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  performWork(testUser1, 'mining');
  let userNow = userRepository.get(testUser1)!;
  assert(userNow.coin_ha_pham === 20, `Neutral làm việc nhận 20 Linh Thạch (Thực tế: ${userNow.coin_ha_pham})`);

  // Bypass cooldown
  customNow += 100;
  // Orthodox làm việc (+5% Linh Thạch): 20 * 1.05 = 21
  db.prepare("UPDATE users SET alignment = 'orthodox', coin_ha_pham = 0, stamina = 500 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  performWork(testUser1, 'mining');
  userNow = userRepository.get(testUser1)!;
  assert(userNow.coin_ha_pham === 21, `Chính Đạo làm việc nhận 21 Linh Thạch (Thực tế: ${userNow.coin_ha_pham})`);

  Math.random = originalRandom;
  Date.now = originalNow;

  // 7. Kiểm thử thuộc tính Ma Đạo (Demonic)
  console.log('\n7. Kiểm tra buff thuộc tính của Ma Đạo...');
  db.prepare("UPDATE users SET alignment = 'demonic' WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  
  const demonicStats = cultivationService.calculateStatsForLevel(77, u1.linh_can, 'demonic');
  assert(demonicStats.atk === Math.round(neutralStats.atk * 1.10), 'Ma Đạo phải được tăng +10% Công kích');
  assert(demonicStats.crit === parseFloat((neutralStats.crit + 0.05).toFixed(3)), 'Ma Đạo phải được tăng +5% Chí mạng');
  assert(demonicStats.def === neutralStats.def, 'Ma Đạo không được buff Phòng ngự');

  // 8. Kiểm thử tăng tốc độ tu luyện của Ma Đạo (+15% speed)
  console.log('\n8. Kiểm tra tăng tốc độ tu luyện của Ma Đạo (+15%)...');
  Math.random = () => 0.5; // baseGained = Math.floor(0.5 * 16) + 10 = 18.
  
  // Neutral thiền định chủ động
  db.prepare("UPDATE users SET alignment = 'neutral', tu_vi = 0, exp_needed = 10000, stamina = 500 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  let practiceRes = cultivationService.practice(testUser1);
  const neutralGained = practiceRes.gained!;
  
  // Demonic thiền định chủ động (x1.15)
  db.prepare("UPDATE users SET alignment = 'demonic', tu_vi = 0, exp_needed = 10000, stamina = 500 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  practiceRes = cultivationService.practice(testUser1);
  const demonicGained = practiceRes.gained!;
  
  assert(demonicGained === Math.round(neutralGained * 1.15), `Ma Đạo thiền định phải nhận x1.15 Linh khí (Neutral: ${neutralGained}, Demonic: ${demonicGained})`);

  // Kiểm tra tu vi nhàn rỗi (Offline Cultivation)
  const timeNow = Math.floor(Date.now() / 1000);
  // Neutral
  db.prepare("UPDATE users SET alignment = 'neutral', tu_vi = 0, exp_needed = 10000, updated_at = ? WHERE discord_id = ?").run(timeNow - 1000, testUser1);
  (userRepository as any).cache.delete(testUser1);
  let claimRes = cultivationService.claimIdleCultivation(testUser1)!;
  const neutralIdle = claimRes.gained;

  // Demonic
  db.prepare("UPDATE users SET alignment = 'demonic', tu_vi = 0, exp_needed = 10000, updated_at = ? WHERE discord_id = ?").run(timeNow - 1000, testUser1);
  (userRepository as any).cache.delete(testUser1);
  claimRes = cultivationService.claimIdleCultivation(testUser1)!;
  const demonicIdle = claimRes.gained;

  assert(demonicIdle === Math.floor(neutralIdle * 1.15), `Ma Đạo tu luyện offline phải nhận x1.15 (Neutral: ${neutralIdle}, Demonic: ${demonicIdle})`);

  Math.random = originalRandom;

  // 9. Kiểm thử tăng sát thương Lôi Kiếp cho Ma Đạo (+15% damage)
  console.log('\n9. Kiểm tra tăng sát thương Lôi Kiếp cho Ma Đạo...');
  // Level 76 (Trúc Cơ Kỳ Tầng 38)
  db.prepare("UPDATE users SET level = 76, alignment = 'demonic' WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  
  const statsDemoLK = inventoryService.getActiveStats(testUser1)!;
  const baseDmgDemo = Math.round(40 + 1 * 50 + statsDemoLK.hp * 0.06);
  const expectedDemoDmg = Math.round(baseDmgDemo * 1.15);

  tribulationService.start(testUser1, 'Đường Tam', 1);
  state = (tribulationService as any).activeTribulations.get(testUser1);
  assert(state.damagePerBolt === expectedDemoDmg, `Sát thương lôi kiếp Ma Đạo phải là ${expectedDemoDmg} (Nhận được: ${state.damagePerBolt})`);
  (tribulationService as any).activeTribulations.delete(testUser1);

  // 10. Kiểm thử cướp đoạt Linh Thạch PvP của Ma Đạo (+10% stolen, nâng cap lên 15000)
  console.log('\n10. Kiểm tra cướp đoạt Linh Thạch PvP của Ma Đạo (+10%)...');
  Math.random = () => 0; // stealPercent = 0.02 base
  
  // Winner neutral, Loser neutral (100,000 coins)
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 0, pvp_points = 1000 WHERE discord_id = ?").run(testUser1);
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 100000, pvp_points = 1000 WHERE discord_id = ?").run(testUser2);
  (userRepository as any).cache.delete(testUser1);
  (userRepository as any).cache.delete(testUser2);
  let pvpRes = pvpService.recordMatch(testUser1, testUser2);
  assert(pvpRes.coinsStolen === 2000, `Neutral cướp 2% từ 100K: 2000 (Thực tế: ${pvpRes.coinsStolen})`);

  // Winner demonic (+10% -> 12%), Loser neutral (100,000 coins)
  db.prepare("UPDATE users SET alignment = 'demonic', coin_ha_pham = 0, pvp_points = 1000 WHERE discord_id = ?").run(testUser1);
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 100000, pvp_points = 1000 WHERE discord_id = ?").run(testUser2);
  (userRepository as any).cache.delete(testUser1);
  (userRepository as any).cache.delete(testUser2);
  pvpRes = pvpService.recordMatch(testUser1, testUser2);
  assert(pvpRes.coinsStolen === 12000, `Ma Đạo cướp 12% từ 100K: 12000 (Thực tế: ${pvpRes.coinsStolen})`);

  // Capped test
  // Winner neutral cướp tối đa 5000
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 0, pvp_points = 1000 WHERE discord_id = ?").run(testUser1);
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 500000, pvp_points = 1000 WHERE discord_id = ?").run(testUser2);
  (userRepository as any).cache.delete(testUser1);
  (userRepository as any).cache.delete(testUser2);
  pvpRes = pvpService.recordMatch(testUser1, testUser2);
  assert(pvpRes.coinsStolen === 5000, `Neutral cướp từ 500K bị giới hạn cap 5000 (Thực tế: ${pvpRes.coinsStolen})`);

  // Winner demonic cướp tối đa 15000
  db.prepare("UPDATE users SET alignment = 'demonic', coin_ha_pham = 0, pvp_points = 1000 WHERE discord_id = ?").run(testUser1);
  db.prepare("UPDATE users SET alignment = 'neutral', coin_ha_pham = 500000, pvp_points = 1000 WHERE discord_id = ?").run(testUser2);
  (userRepository as any).cache.delete(testUser1);
  (userRepository as any).cache.delete(testUser2);
  pvpRes = pvpService.recordMatch(testUser1, testUser2);
  assert(pvpRes.coinsStolen === 15000, `Ma Đạo cướp từ 500K bị giới hạn cap 15000 (Thực tế: ${pvpRes.coinsStolen})`);

  Math.random = originalRandom;

  // 11. Kiểm thử +5% tỷ lệ đột phá tự nhiên của Tán Tu (Neutral) và phạt -5% của Ma Đạo
  console.log('\n11. Kiểm tra tỷ lệ đột phá của Tán Tu (+5%) và Ma Đạo (-5%)...');
  db.prepare("UPDATE users SET level = 1, alignment = 'neutral', tu_vi = 100000, exp_needed = 100 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  // majorIndex = 0. baseRate = 90%. luckBonus = 10 * 0.002 = 0.02 (2%).
  // Tán Tu (Neutral): 90 + 2 + 5 = 97%
  let brRes = cultivationService.breakthrough(testUser1, false);
  assert(brRes.rate === 97, `Tỷ lệ đột phá Tán Tu phải là 97% (Nhận được: ${brRes.rate})`);

  db.prepare("UPDATE users SET level = 1, alignment = 'demonic', tu_vi = 100000, exp_needed = 100 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  // Demonic rate: 90 + 2 - 5 = 87%
  brRes = cultivationService.breakthrough(testUser1, false);
  assert(brRes.rate === 87, `Tỷ lệ đột phá Ma Đạo phải là 87% (Nhận được: ${brRes.rate})`);

  // 12. Kiểm thử Sự Kiện Tẩu Hỏa Nhập Ma (Đột Phá Bị Quấy Nhiễu)
  console.log('\n12. Kiểm tra Sự Kiện Quấy Nhiễu giảm -15% tỷ lệ đột phá...');
  db.prepare("UPDATE users SET level = 1, alignment = 'orthodox', tu_vi = 100000, exp_needed = 100 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  // Orthodox (alignmentRateMod = 0) với quấy nhiễu: 92 - 15 = 77%
  brRes = cultivationService.breakthrough(testUser1, false, false, true);
  assert(brRes.rate === 77, `Tỷ lệ đột phá khi bị quấy nhiễu phải giảm 15% xuống còn 77% (Nhận được: ${brRes.rate})`);

  // 13. Kiểm thử trạng thái Tẩu Hỏa Nhập Ma khi đột phá quấy nhiễu thất bại
  console.log('\n13. Kiểm tra áp dụng trạng thái Tẩu Hỏa Nhập Ma trong 30 phút khi thất bại...');
  // Mock Math.random to always fail (return 99)
  Math.random = () => 0.99; // Roll = 99 > 77 rate.
  
  db.prepare("UPDATE users SET level = 1, alignment = 'orthodox', tu_vi = 100000, exp_needed = 100, qi_deviation_until = 0 WHERE discord_id = ?").run(testUser1);
  (userRepository as any).cache.delete(testUser1);
  
  brRes = cultivationService.breakthrough(testUser1, false, false, true);
  assert(brRes.success === false, 'Đột phá mạo hiểm phải thất bại');
  
  let updatedUser = userRepository.get(testUser1)!;
  const timeLimit = Math.floor(Date.now() / 1000) + 1700;
  assert(updatedUser.qi_deviation_until > timeLimit, 'qi_deviation_until phải được thiết lập ~30 phút tương lai');

  // 14. Kiểm thử phạt của trạng thái Tẩu Hỏa Nhập Ma
  console.log('\n14. Kiểm tra các hạn chế khi bị Tẩu Hỏa Nhập Ma...');
  // Thiền định chủ động bị khóa
  let practiceRes2 = cultivationService.practice(testUser1);
  assert(practiceRes2.success === false && practiceRes2.message.includes('TẨU HỎA NHẬP MA'), 'Không thể thiền định chủ động khi đang bị Tẩu Hỏa Nhập Ma');

  // Offline tu luyện giảm 50% hiệu suất
  Math.random = originalRandom;
  const timeNow2 = Math.floor(Date.now() / 1000);
  
  // Measure normal baseline first (Qi Deviation = 0)
  db.prepare("UPDATE users SET tu_vi = 0, exp_needed = 10000, qi_deviation_until = 0, updated_at = ? WHERE discord_id = ?").run(timeNow2 - 1000, testUser1);
  (userRepository as any).cache.delete(testUser1);
  const baselineClaim = cultivationService.claimIdleCultivation(testUser1)!;
  const normalIdleAtCurrentLevel = baselineClaim.gained;

  // Now measure with Qi Deviation
  db.prepare("UPDATE users SET tu_vi = 0, exp_needed = 10000, qi_deviation_until = ?, updated_at = ? WHERE discord_id = ?").run(timeNow2 + 1800, timeNow2 - 1000, testUser1);
  (userRepository as any).cache.delete(testUser1);
  claimRes = cultivationService.claimIdleCultivation(testUser1)!;
  
  assert(claimRes.gained === Math.floor(normalIdleAtCurrentLevel * 0.5), `Hiệu suất offline tu luyện phải bị giảm 50% (Bình thường: ${normalIdleAtCurrentLevel}, Khi tẩu hỏa: ${claimRes.gained})`);

  console.log('\n🌟 TOÀN BỘ BÀI KIỂM THỬ ĐÃ THÀNH CÔNG RỰC RỠ! 🌟');
}

runTests().catch(e => {
  console.error('\n❌ BÀI KIỂM THỬ THẤT BẠI VỚI LỖI:');
  console.error(e);
  process.exit(1);
});
