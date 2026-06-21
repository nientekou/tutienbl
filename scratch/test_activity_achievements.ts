import { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { achievementService } from '../src/services/AchievementService';
import { combatService } from '../src/services/CombatService';
import { explorationService } from '../src/services/ExplorationService';
import { performHunt } from '../src/commands/general/sanyeuthu';
import db from '../src/database/database';
import assert from 'assert';

console.log('--- STARTING ACTIVITY ACHIEVEMENTS VERIFICATION ---');

try {
  initDatabase();

  const testUserId = '888888888888888888';

  // Cleanup old test data
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUserId);
  db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM user_titles WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM explorations WHERE user_id = ?').run(testUserId);

  // Create new test user
  userRepository.create({
    discord_id: testUserId,
    name: 'Chiến Thần Test',
    base_hp: 5000,
    base_mp: 1000,
    base_atk: 500,
    base_def: 300,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 }),
    coin_ha_pham: 10000,
    knb: 0
  });

  const user = userRepository.get(testUserId)!;
  console.log(`✅ Created test user: ${user.name}`);

  // ==========================================
  // TEST 1: WORLD BOSS ACHIEVEMENTS
  // ==========================================
  console.log('\n--- 1. Testing World Boss Achievements ---');
  
  // Record 3 attacks
  combatService.recordBossAttack(testUserId, 1, 100);
  combatService.recordBossAttack(testUserId, 1, 120);
  combatService.recordBossAttack(testUserId, 1, 150);

  let userAchs = achievementService.getUserAchievements(testUserId);
  let cd5 = userAchs.find(a => a.id === 'cd_5')!;
  let cd6 = userAchs.find(a => a.id === 'cd_6')!;
  let cd7 = userAchs.find(a => a.id === 'cd_7')!;

  console.log(`Boss Attacks progress -> cd_5: ${cd5.progress}/${cd5.target_value}, cd_6: ${cd6.progress}, cd_7: ${cd7.progress}`);
  assert.strictEqual(cd5.progress, 3, 'cd_5 progress should be 3');
  assert.strictEqual(cd6.progress, 3, 'cd_6 progress should be 3');
  assert.strictEqual(cd7.progress, 3, 'cd_7 progress should be 3');
  console.log('✅ World Boss attack achievements tracked successfully!');

  // Record 2 kills
  combatService.recordBossKill(testUserId, 1);
  combatService.recordBossKill(testUserId, 2);

  userAchs = achievementService.getUserAchievements(testUserId);
  let cd8 = userAchs.find(a => a.id === 'cd_8')!;
  let cd9 = userAchs.find(a => a.id === 'cd_9')!;

  console.log(`Boss Kills progress -> cd_8: ${cd8.progress}/${cd8.target_value}, cd_9: ${cd9.progress}/${cd9.target_value}`);
  assert.strictEqual(cd8.progress, 1, 'cd_8 progress should be capped at 1');
  assert.strictEqual(cd9.progress, 2, 'cd_9 progress should be 2');
  assert(cd8.is_completed, 'cd_8 (target 1) should be completed');
  console.log('✅ World Boss kill achievements tracked successfully!');

  // ==========================================
  // TEST 2: EXPLORATION ACHIEVEMENTS
  // ==========================================
  console.log('\n--- 2. Testing Exploration Achievements ---');

  // Insert 5 completed explorations
  for (let i = 0; i < 5; i++) {
    db.prepare(`
      INSERT INTO explorations (user_id, location_id, start_time, end_time, stamina_cost, status)
      VALUES (?, 'van_thu_son', 0, 0, 20, 'completed')
    `).run(testUserId);
  }

  // Trigger update progress
  (explorationService as any).updateExplorationAchievements(testUserId);

  userAchs = achievementService.getUserAchievements(testUserId);
  let cd10 = userAchs.find(a => a.id === 'cd_10')!;
  let cd11 = userAchs.find(a => a.id === 'cd_11')!;

  console.log(`Exploration progress -> cd_10: ${cd10.progress}/${cd10.target_value}, cd_11: ${cd11.progress}/${cd11.target_value}`);
  assert.strictEqual(cd10.progress, 5, 'cd_10 progress should be 5');
  assert.strictEqual(cd11.progress, 5, 'cd_11 progress should be 5');
  console.log('✅ Exploration achievements tracked successfully!');

  // ==========================================
  // TEST 3: HUNT ACHIEVEMENTS
  // ==========================================
  console.log('\n--- 3. Testing Yêu Thú Hunt Achievements ---');

  // Perform 2 hunts
  userRepository.update(testUserId, { stamina: 100 });
  const huntRes1 = performHunt(testUserId);
  console.log(`Hunt 1 result: ${huntRes1.message}`);
  
  userRepository.update(testUserId, { stamina: 100 });
  const huntRes2 = performHunt(testUserId);
  console.log(`Hunt 2 result: ${huntRes2.message}`);

  userAchs = achievementService.getUserAchievements(testUserId);
  let cd12 = userAchs.find(a => a.id === 'cd_12')!;
  let cd13 = userAchs.find(a => a.id === 'cd_13')!;

  console.log(`Hunt progress -> cd_12: ${cd12.progress}/${cd12.target_value}, cd_13: ${cd13.progress}/${cd13.target_value}`);
  assert.strictEqual(cd12.progress, 2, 'cd_12 progress should be 2');
  assert.strictEqual(cd13.progress, 2, 'cd_13 progress should be 2');
  console.log('✅ Yêu Thú Hunt achievements tracked successfully!');

  // Cleanup
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUserId);
  db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM user_titles WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM explorations WHERE user_id = ?').run(testUserId);

  console.log('\n🎉 ALL ACTIVITY ACHIEVEMENT FIXES VERIFIED SUCCESSFULLY! 🎉');
} catch (error) {
  console.error('❌ Verification failed:', error);
  process.exit(1);
}
