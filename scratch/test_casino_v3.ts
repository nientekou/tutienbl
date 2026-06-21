import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { runCasinoGame } from '../src/commands/general/casino';

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍCH HỢP CASINO V3 (BẦU CUA & MAY MẮN) ... 🧪\n');
  initDatabase();

  const testUser = 'test_user_casino_v3';

  // 0. Cleanup old test data
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);

  // 1. Create character with 10,000 LT and 10 Luck (normal luck, no effects)
  userRepository.create({
    discord_id: testUser,
    name: 'Thần Bài Tu Sĩ',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Kim': 100 }),
    coin_ha_pham: 10000
  });

  (userRepository as any).cache.delete(testUser);

  const initialUser = userRepository.get(testUser)!;
  console.log(`👤 Nhân vật: ${initialUser.name} | Số dư: ${initialUser.coin_ha_pham} LT | May Mắn: ${initialUser.base_luck}`);

  // ==========================================
  // Test 1: Bầu Cua Tôm Cá Payout Logic (No Luck effects at 10 Luck)
  // ==========================================
  console.log('\n--- Test 1: Bầu Cua Payouts (Normal Luck: 10) ---');

  // Let's force Math.random during the Bau Cua game so we can test outcomes deterministically.
  const originalRandom = Math.random;

  // 1A. Test Lose (no matches)
  // Let the rolls be 'cua', 'tom', 'ca' (keys index match, or let's mock it)
  // keys list: ['bau', 'cua', 'tom', 'ca', 'ga', 'nai']
  // We want to force rolls: indices 1, 2, 3 -> 'cua', 'tom', 'ca'
  // Math.random calls:
  // r1: Math.floor(Math.random() * 6) -> index 1 -> Math.random() in [1/6, 2/6) e.g. 0.2
  // r2: index 2 -> Math.random() in [2/6, 3/6) e.g. 0.4
  // r3: index 3 -> Math.random() in [3/6, 4/6) e.g. 0.5
  let callIndex = 0;
  Math.random = () => {
    callIndex++;
    if (callIndex === 1) return 0.2; // -> index 1 ('cua')
    if (callIndex === 2) return 0.4; // -> index 2 ('tom')
    return 0.5; // -> index 3 ('ca')
  };

  // Bet on 'bau' (index 0) -> 0 matches -> expect complete loss
  let result = await runCasinoGame(testUser, 'baucua', 1000, 'bau');
  let u = userRepository.get(testUser)!;
  console.log(`👉 Cược 1000 LT vào Bầu. Kết quả: ${result.embed?.toJSON().description}`);
  console.log(`🪙 Số dư còn lại: ${u.coin_ha_pham} LT (Kỳ vọng: 9000)`);
  if (u.coin_ha_pham !== 9000) {
    throw new Error('Sai lệch số dư khi thua Bầu Cua!');
  }

  // 1B. Test 1 Match
  // Force rolls: 'bau' (index 0), 'cua' (index 1), 'tom' (index 2)
  // Math.random returns: 0.05, 0.2, 0.4
  callIndex = 0;
  Math.random = () => {
    callIndex++;
    if (callIndex === 1) return 0.05; // 'bau'
    if (callIndex === 2) return 0.2;  // 'cua'
    return 0.4;  // 'tom'
  };

  // Bet on 'bau' (1 match) -> expect +950 LT reward (1000 * 1 * 0.95)
  result = await runCasinoGame(testUser, 'baucua', 1000, 'bau');
  u = userRepository.get(testUser)!;
  console.log(`👉 Cược 1000 LT vào Bầu (1 trùng khớp). Kết quả: ${result.embed?.toJSON().description}`);
  console.log(`🪙 Số dư: ${u.coin_ha_pham} LT (Kỳ vọng: 9950)`);
  if (u.coin_ha_pham !== 9950) {
    throw new Error('Sai lệch số dư khi thắng 1 Bầu Cua!');
  }

  // 1C. Test 3 Matches (Jackpot)
  // Force rolls: 'bau', 'bau', 'bau'
  // Math.random returns: 0.05, 0.05, 0.05
  callIndex = 0;
  Math.random = () => 0.05;

  // Bet on 'bau' (3 matches) -> expect +2850 LT reward (1000 * 3 * 0.95)
  result = await runCasinoGame(testUser, 'baucua', 1000, 'bau');
  u = userRepository.get(testUser)!;
  console.log(`👉 Cược 1000 LT vào Bầu (3 trùng khớp). Kết quả: ${result.embed?.toJSON().description}`);
  console.log(`🪙 Số dư: ${u.coin_ha_pham} LT (Kỳ vọng: 9950 + 2850 = 12800)`);
  if (u.coin_ha_pham !== 12800) {
    throw new Error('Sai lệch số dư khi thắng 3 Bầu Cua!');
  }

  // Restore random
  Math.random = originalRandom;
  console.log('✅ TEST 1 PASSED: Payouts cho Bầu Cua (1x, 3x) hoạt động chính xác.');

  // ==========================================
  // Test 2: Luck Payout / Refund Blessings (30 Luck)
  // ==========================================
  console.log('\n--- Test 2: May Mắn Blessings (May Mắn: 30) ---');

  // Update base luck to 30 (extreme luck)
  db.transaction(() => {
    userRepository.update(testUser, { base_luck: 30 });
  })();
  (userRepository as any).cache.delete(testUser);

  // 2A. Test Loss Relief (15% refund on loss)
  // Math.random for doden is win/lose 50/50. Mock it to always lose
  Math.random = () => 0.99; // force lose on choice 'do' (if roll is den)
  result = await runCasinoGame(testUser, 'doden', 2000, 'do');
  u = userRepository.get(testUser)!;
  console.log(`👉 Đỏ Đen (May Mắn 30, Thua). Kết quả: ${result.embed?.toJSON().description}`);
  // Bet 2000. Loss should be 2000 - refund (2000 * 15% = 300) = net loss 1700
  // Expecting balance: 12800 - 1700 = 11100
  console.log(`🪙 Số dư: ${u.coin_ha_pham} LT (Kỳ vọng: 11100)`);
  if (u.coin_ha_pham !== 11100) {
    throw new Error(`Sai lệch số dư cứu trợ khi thua! Nhận được: ${u.coin_ha_pham}`);
  }

  // 2B. Test Win Bonus (10% bonus payout on win)
  // Mock to always win
  Math.random = () => 0.01; // force win on choice 'do' (if roll is do)
  result = await runCasinoGame(testUser, 'doden', 2000, 'do');
  u = userRepository.get(testUser)!;
  console.log(`👉 Đỏ Đen (May Mắn 30, Thắng). Kết quả: ${result.embed?.toJSON().description}`);
  // Bet 2000. Win should be 2000 + bonus (2000 * 10% = 200) = net win 2200
  // Expecting balance: 11100 + 2200 = 13300
  console.log(`🪙 Số dư: ${u.coin_ha_pham} LT (Kỳ vọng: 13300)`);
  if (u.coin_ha_pham !== 13300) {
    throw new Error(`Sai lệch số dư chúc phúc khi thắng! Nhận được: ${u.coin_ha_pham}`);
  }

  // Restore random
  Math.random = originalRandom;
  console.log('✅ TEST 2 PASSED: Cứu trợ May Mắn (hoàn trả khi thua) và Chúc phúc May Mắn (thưởng thêm khi thắng) hoạt động chính xác.');

  // Clean up
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  console.log('\n🧹 Đã dọn dẹp dữ liệu kiểm thử.');
  console.log('\n🌟 HOÀN THẤT KIỂM THỬ TÍCH HỢP CASINO V3 THÀNH CÔNG! 🌟');
}

runTests().catch(e => {
  console.error('❌ LỖI TRONG BÀI KIỂM THỬ:');
  console.error(e);
  process.exit(1);
});
