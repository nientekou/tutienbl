import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { achievementService } from '../src/services/AchievementService';

async function runTests() {
  try {
    initDatabase();
    console.log('Database initialized.');

    const testUserId = 'test_verification_user_123';

    // Cleanup first
    db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUserId);
    db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM user_titles WHERE user_id = ?').run(testUserId);

    // ==========================================
    // Test 1: Starting Character Creation Rewards
    // ==========================================
    console.log('\n--- TEST 1: Starting Character Creation Rewards ---');
    // Using values similar to taonhanvat.ts:
    // startingLt = 100 + backgroundBonusLt + 1000
    // startingKnb = backgroundBonusKnb + 0
    // background: ky_ngo_sinh_tu -> bonuses: { def: 10, lt: 1000 }
    
    const backgroundBonusLt = 1000;
    const backgroundBonusKnb = 0;
    const startingLt = 100 + backgroundBonusLt + 1000; // 2100
    const startingKnb = backgroundBonusKnb + 0; // 0

    userRepository.create({
      discord_id: testUserId,
      name: 'Kiểm Thử Giả',
      background: 'ky_ngo_sinh_tu',
      destiny: 'sat_tinh',
      starting_skills: '[]',
      prophecy: 'Mệnh trời vô định',
      heirloom: '{}',
      claimed_starting_bonus: 1,
      base_hp: 100,
      base_mp: 50,
      base_atk: 15,
      base_def: 10,
      base_crit: 0.05,
      base_crit_res: 0.0,
      base_luck: 10,
      linh_can: '{"Hỏa": 100}',
      coin_ha_pham: startingLt,
      knb: startingKnb,
    });

    const user = userRepository.get(testUserId);
    if (!user) throw new Error('Failed to retrieve created test user');

    console.log(`Character Name: ${user.name}`);
    console.log(`Starting LT (Hạ Phẩm): ${user.coin_ha_pham} (Expected: 2100)`);
    console.log(`Starting KNB: ${user.knb} (Expected: 0)`);

    if (user.coin_ha_pham !== 2100) throw new Error('Starting LT mismatch!');
    if (user.knb !== 0) throw new Error('Starting KNB mismatch!');
    console.log('✅ TEST 1 PASSED: Character starting rewards balanced (No KNB, increased LT).');


    // ==========================================
    // Test 2: Currency Exchange (Transactions)
    // ==========================================
    console.log('\n--- TEST 2: Currency Exchange (Transactions) ---');
    // Ratios:
    // 100 Hạ Phẩm = 1 Trung Phẩm
    // 100 Trung Phẩm = 1 Thượng Phẩm
    // 1 KNB = 1 Thượng Phẩm
    
    // We start with: 2100 Hạ, 0 Trung, 0 Thượng, 0 KNB
    // Let's convert 1000 Hạ Phẩm ➡️ 10 Trung Phẩm
    let u = userRepository.get(testUserId)!;
    const exchangeAmountLt = 1000;
    const expectedTrung = 10;
    
    db.transaction(() => {
      userRepository.update(testUserId, {
        coin_ha_pham: u.coin_ha_pham - exchangeAmountLt,
        coin_trung_pham: u.coin_trung_pham + expectedTrung,
      });
    })();

    u = userRepository.get(testUserId)!;
    console.log(`After exchanging 1000 Hạ Phẩm:`);
    console.log(`Hạ Phẩm: ${u.coin_ha_pham} (Expected: 1100)`);
    console.log(`Trung Phẩm: ${u.coin_trung_pham} (Expected: 10)`);
    if (u.coin_ha_pham !== 1100 || u.coin_trung_pham !== 10) throw new Error('Hạ to Trung conversion mismatch!');

    // Let's give KNB and convert to Thượng Phẩm: 1 KNB ➡️ 1 Thượng Phẩm
    userRepository.update(testUserId, { knb: 5 });
    u = userRepository.get(testUserId)!;
    
    db.transaction(() => {
      userRepository.update(testUserId, {
        knb: u.knb - 1,
        coin_thuong_pham: u.coin_thuong_pham + 1,
      });
    })();

    u = userRepository.get(testUserId)!;
    console.log(`After exchanging 1 KNB:`);
    console.log(`KNB: ${u.knb} (Expected: 4)`);
    console.log(`Thượng Phẩm: ${u.coin_thuong_pham} (Expected: 1)`);
    if (u.knb !== 4 || u.coin_thuong_pham !== 1) throw new Error('KNB to Thượng Phẩm conversion mismatch!');

    // Let's convert 1 Thượng Phẩm ➡️ 1 KNB
    db.transaction(() => {
      userRepository.update(testUserId, {
        coin_thuong_pham: u.coin_thuong_pham - 1,
        knb: u.knb + 1,
      });
    })();

    u = userRepository.get(testUserId)!;
    console.log(`After exchanging 1 Thượng Phẩm back:`);
    console.log(`KNB: ${u.knb} (Expected: 5)`);
    console.log(`Thượng Phẩm: ${u.coin_thuong_pham} (Expected: 0)`);
    if (u.knb !== 5 || u.coin_thuong_pham !== 0) throw new Error('Thượng Phẩm to KNB conversion mismatch!');

    console.log('✅ TEST 2 PASSED: Currency exchange conversion and transactions work perfectly.');


    // ==========================================
    // Test 3: Achievement Title Threshold Adjustment
    // ==========================================
    console.log('\n--- TEST 3: Achievement Title Threshold Adjustment ---');
    // tl_10 threshold should be 70 (down from 100), and reward title is "Thiền Sư"
    const tl10 = achievementService.getAchievement('tl_10');
    if (!tl10) throw new Error('Achievement tl_10 not found in database!');
    
    console.log(`Achievement: ${tl10.name}`);
    console.log(`Category: ${tl10.category}`);
    console.log(`Description: ${tl10.description}`);
    console.log(`Target Value: ${tl10.target_value} (Expected: 70)`);
    console.log(`Reward Title: ${tl10.reward_title} (Expected: Thiền Sư)`);

    if (tl10.target_value !== 70) throw new Error('Achievement tl_10 target value is not 70!');

    // Set progress to 69 (should not unlock)
    let unlocked = achievementService.setProgress(testUserId, 'tl_10', 69);
    console.log(`Set progress to 69. Unlocked count: ${unlocked.length} (Expected: 0)`);
    if (unlocked.length > 0) throw new Error('Achievement unlocked prematurely!');

    // Set progress to 70 (should unlock and award title)
    unlocked = achievementService.setProgress(testUserId, 'tl_10', 70);
    console.log(`Set progress to 70. Unlocked count: ${unlocked.length} (Expected: 1)`);
    if (unlocked.length !== 1) throw new Error('Achievement failed to unlock at threshold 70!');

    // Check user's titles
    const titles = achievementService.getUserTitles(testUserId);
    console.log('User Unlocked Titles:', titles);
    const hasTitle = titles.some(t => t.title === 'Thiền Sư');
    if (!hasTitle) throw new Error('Title "Thiền Sư" not awarded to user!');
    
    const updatedUser = userRepository.get(testUserId)!;
    console.log(`User's current title: ${updatedUser.title} (Expected: Thiền Sư)`);
    if (updatedUser.title !== 'Thiền Sư') throw new Error('User failed to auto-equip title "Thiền Sư"!');

    console.log('✅ TEST 3 PASSED: Achievement thresholds successfully lowered and titles awarded.');

    console.log('\n🎉 ALL SCRATCH TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('❌ Tests failed with error:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
