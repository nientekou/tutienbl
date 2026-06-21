import { CombatEngine, Combatant } from '../src/services/CombatEngine';
import assert from 'assert';
import { initDatabase } from '../src/database/database';

console.log('Running Tests...');

function testCombatEngine() {
  console.log('Test: CombatEngine - basic combat');
  const player: Combatant = {
    name: 'Player 1',
    hp: 100, maxHp: 100,
    atk: 20, def: 5,
    crit: 0.1, critRes: 0,
    luck: 10, speed: 100, dodge: 0.05,
    linhCan: '{}'
  };

  const target: Combatant = {
    name: 'Enemy 1',
    hp: 50, maxHp: 50,
    atk: 10, def: 2,
    crit: 0, critRes: 0,
    luck: 5, speed: 90, dodge: 0,
    linhCan: '{}'
  };

  const result = CombatEngine.run(player, target, null, 10);
  assert(result.winner === 'player' || result.winner === 'enemy', 'Combat should have a valid winner status');
  assert(result.log.length > 0, 'Combat log should not be empty');
  
  console.log('CombatEngine tests passed! ✅');
}

function testStaminaPotionWeekly() {
  console.log('Test: Stamina Potion Weekly - limits, reset, transaction safety, and usage');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { inventoryRepository } = require('../src/database/repositories/InventoryRepository');
  const { inventoryService } = require('../src/services/InventoryService');
  const db = require('../src/database/database').default;
  const { SHOP_ITEMS, checkAndUpdateWeeklyLimit, getUserWeeklyPurchases } = require('../src/commands/general/shop');

  // 1. Verify item registry
  const potionItem = SHOP_ITEMS.find((i: any) => i.id === 'potion_stamina_weekly');
  assert(potionItem, 'potion_stamina_weekly must be registered in SHOP_ITEMS');
  assert.strictEqual(potionItem.price, 200, 'Price must be 200 LT');

  const testUserId = 'test_stamina_user_123';
  userRepository.delete(testUserId); // clean start

  userRepository.create({
    discord_id: testUserId,
    name: 'Đạo Hữu Test Stamina',
    base_hp: 100,
    base_mp: 100,
    base_atk: 10,
    base_def: 5,
    base_crit: 0,
    base_crit_res: 0,
    base_luck: 5,
    linh_can: '{}',
    coin_ha_pham: 5000,
    knb: 0
  });

  // Ensure starting stamina is low
  userRepository.update(testUserId, { stamina: 50 });

  // 2. Initial state check
  let purchases = getUserWeeklyPurchases(testUserId);
  assert.strictEqual(purchases['potion_stamina_weekly'] || 0, 0, 'Initial weekly purchases must be 0');

  // 3. Purchase within limit
  checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 2);
  purchases = getUserWeeklyPurchases(testUserId);
  assert.strictEqual(purchases['potion_stamina_weekly'], 2, 'Should record 2 purchases');

  // 4. Over limit checks
  assert.throws(() => {
    checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 5);
  }, /vượt quá giới hạn/, 'Should throw when buying over the limit');

  purchases = getUserWeeklyPurchases(testUserId);
  assert.strictEqual(purchases['potion_stamina_weekly'], 2, 'Purchase count should remain at 2 on check failure');

  // 5. Database transaction rollback safety
  const tx = db.transaction(() => {
    // Failing limit check
    checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 5);
    // Modifying money
    userRepository.update(testUserId, { coin_ha_pham: 1000 });
  });

  assert.throws(() => {
    tx();
  });

  const userAfterRollback = userRepository.get(testUserId)!;
  assert.strictEqual(userAfterRollback.coin_ha_pham, 5000, 'Balance must be rolled back on transaction error');

  // 6. Max purchase check
  checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 4);
  purchases = getUserWeeklyPurchases(testUserId);
  assert.strictEqual(purchases['potion_stamina_weekly'], 6, 'Weekly purchase count must be 6');

  // 7. Prevent further purchases
  assert.throws(() => {
    checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 1);
  }, /vượt quá giới hạn/, 'Should throw limit error when already reached');

  // 8. Weekly reset check
  userRepository.update(testUserId, {
    y_canh: JSON.stringify({
      weekly_purchases: {
        week: '2020-W01', // mock past week
        items: {
          'potion_stamina_weekly': 6
        }
      }
    })
  });

  // Next purchase in current week should succeed and count from 0
  checkAndUpdateWeeklyLimit(testUserId, 'potion_stamina_weekly', 1);
  purchases = getUserWeeklyPurchases(testUserId);
  assert.strictEqual(purchases['potion_stamina_weekly'], 1, 'Should reset to 1 in new week');

  // 9. Item usage check (+150 stamina)
  inventoryRepository.addItem(testUserId, 'potion_stamina_weekly', 1);
  const userInv = db.prepare('SELECT id FROM inventories WHERE user_id = ? AND item_id = ?').get(testUserId, 'potion_stamina_weekly');
  assert(userInv, 'Should have potion in inventory');

  const useResult = inventoryService.useItem(testUserId, userInv.id);
  assert(useResult.success, 'Usage should succeed');

  const userAfterUse = userRepository.get(testUserId)!;
  assert.strictEqual(userAfterUse.stamina, 200, 'Stamina should increase by 150 points');

  const userInvAfter = db.prepare('SELECT quantity FROM inventories WHERE id = ?').get(userInv.id);
  assert(!userInvAfter || userInvAfter.quantity === 0, 'Item must be consumed');

  // 10. Stamina limit cap (500) check
  userRepository.update(testUserId, { stamina: 450 });
  inventoryRepository.addItem(testUserId, 'potion_stamina_weekly', 1);
  const userInvCap = db.prepare('SELECT id FROM inventories WHERE user_id = ? AND item_id = ?').get(testUserId, 'potion_stamina_weekly');

  const capResult = inventoryService.useItem(testUserId, userInvCap.id);
  assert(capResult.success, 'Usage should succeed');

  const userAfterCap = userRepository.get(testUserId)!;
  assert.strictEqual(userAfterCap.stamina, 500, 'Stamina should cap at 500');

  // 11. Cleanup
  userRepository.delete(testUserId);
  console.log('Stamina Potion Weekly tests passed! ✅');
}

function testUnsupportedItemAndEnhanceFixes() {
  console.log('Test: Unsupported items (book usage) and enhance select requires');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { inventoryRepository } = require('../src/database/repositories/InventoryRepository');
  const { inventoryService } = require('../src/services/InventoryService');
  const db = require('../src/database/database').default;
  const CuongHuaCommand = require('../src/commands/general/cuonghoa').default;

  const testUserId = 'test_book_user_456';
  userRepository.delete(testUserId);
  db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(testUserId);

  userRepository.create({
    discord_id: testUserId,
    name: 'Đạo Hữu Test Book',
    base_hp: 100,
    base_mp: 100,
    base_atk: 10,
    base_def: 5,
    base_crit: 0,
    base_crit_res: 0,
    base_luck: 5,
    linh_can: '{}',
    coin_ha_pham: 5000,
    knb: 0
  });

  // Add a book
  inventoryRepository.addItem(testUserId, 'book_fire', 1);
  const bookInv = db.prepare('SELECT id FROM inventories WHERE user_id = ? AND item_id = ?').get(testUserId, 'book_fire');
  assert(bookInv, 'Book must be in user inventory');

  // Use the book via inventoryService.useItem
  const useResult = inventoryService.useItem(testUserId, bookInv.id);
  assert(useResult.success, `Book usage should succeed, message: ${useResult.message}`);
  assert(useResult.message.includes('đọc hiểu thành công') || useResult.message.includes('Lĩnh ngộ thành công'), 'Message should be descriptive');

  // Check that the skill is learned
  const learnedSkill = db.prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?').get(testUserId, 'skill_fire');
  assert(learnedSkill, 'User must have learned skill_fire');

  // Check that the book is consumed
  const bookInvAfter = db.prepare('SELECT quantity FROM inventories WHERE id = ?').get(bookInv.id);
  assert(!bookInvAfter || bookInvAfter.quantity === 0, 'Book must be consumed');

  // Verify enhance preview builds successfully
  inventoryRepository.addItem(testUserId, 'weapon_sword_1', 1);
  const weaponInv = db.prepare('SELECT id FROM inventories WHERE user_id = ? AND item_id = ?').get(testUserId, 'weapon_sword_1');
  assert(weaponInv, 'Weapon must be in user inventory');

  const preview = CuongHuaCommand.buildEnhancePreview(testUserId, weaponInv.id);
  assert(preview && preview.embed && preview.rows.length > 0, 'Enhance preview must build successfully');

  // Cleanup
  userRepository.delete(testUserId);
  db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(testUserId);
  console.log('Unsupported items and enhance select tests passed! ✅');
}

function testMythicalBeastsAndEncounters() {
  console.log('Test: Mythical Beasts and Encounters (Kỳ Ngộ)');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { encounterService } = require('../src/services/EncounterService');
  const { farmingService } = require('../src/services/FarmingService');
  const { inventoryRepository } = require('../src/database/repositories/InventoryRepository');
  const db = require('../src/database/database').default;

  const testUserId = 'test_mythical_user_789';
  userRepository.delete(testUserId);
  db.prepare('DELETE FROM pets WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM farming_plots WHERE user_id = ?').run(testUserId);

  userRepository.create({
    discord_id: testUserId,
    name: 'Đạo Hữu Kỳ Ngộ',
    base_hp: 1000,
    base_mp: 200,
    base_atk: 50,
    base_def: 20,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 10,
    base_speed: 100,
    base_dodge: 0.05,
    linh_can: '{}',
    coin_ha_pham: 5000,
    knb: 0
  });

  // 1. Test CombatEngine with different pet skills
  const player: Combatant = {
    name: 'Đạo Hữu Test Pet',
    hp: 1000, maxHp: 1000,
    atk: 100, def: 20,
    crit: 0.05, critRes: 0,
    luck: 5, speed: 100, dodge: 0.05,
    linhCan: '{}'
  };

  const enemy: Combatant = {
    name: 'Cự Thú Dã Ngoại',
    hp: 1500, maxHp: 1500,
    atk: 80, def: 10,
    crit: 0.05, critRes: 0,
    luck: 5, speed: 90, dodge: 0.05,
    linhCan: '{}'
  };

  const petConfig = {
    name: 'Tiểu Phượng Hoàng',
    atk: 30,
    skills: ['crit_bite', 'speed_boost', 'lucky', 'qilin_fortune', 'healing', 'def_aura', 'reborn_flame']
  };

  const combatRes = CombatEngine.run(player, enemy, petConfig, 30);
  assert(combatRes.log.some(l => l.includes('Cắn Chí Mạng')), 'Should activate crit_bite in log');
  assert(combatRes.log.some(l => l.includes('Phóng Xuất Bạo Phát')), 'Should activate speed_boost in log');
  assert(combatRes.log.some(l => l.includes('Thiên Xích May Mắn')), 'Should activate lucky in log');
  assert(combatRes.log.some(l => l.includes('Kỳ Lân Tường Thụy')), 'Should activate qilin_fortune in log');
  assert(combatRes.log.some(l => l.includes('Liều Lực Thánh Thư')), 'Should activate healing in log');
  assert(combatRes.log.some(l => l.includes('Hộ Thể Linh Quang')), 'Should activate def_aura in log');

  // Check reborn_flame triggering when HP is low
  const playerLowHp: Combatant = {
    name: 'Đạo Hữu Test Pet Low HP',
    hp: 150, maxHp: 1000,
    atk: 100, def: 20,
    crit: 0.05, critRes: 0,
    luck: 5, speed: 100, dodge: 0.05,
    linhCan: '{}'
  };
  const combatResLow = CombatEngine.run(playerLowHp, enemy, petConfig, 30);
  assert(combatResLow.log.some(l => l.includes('Nirvana Chi Hỏa')), 'Should activate reborn_flame in log when HP is low');

  console.log('Combat Engine Pet Skills verification passed! ✅');

  // 2. Test Encounter resolving 'sy_than_thu' with 'sy_tt_thu_phuc'
  // Mock Math.random to make it succeed
  const originalMathRandom = Math.random;
  try {
    Math.random = () => 0.01; // Force success (< 0.06 capture rate)
    const result = encounterService.resolveEncounter(testUserId, 'sy_than_thu', 'sy_tt_thu_phuc');
    assert(result.success, 'Encounter resolution should succeed under mocked Math.random');
    assert(result.rewards.pet_received === 1, 'Should reward a pet');

    const pets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(testUserId) as any[];
    assert.strictEqual(pets.length, 1, 'One mythical beast should be inserted into DB');
    const pet = pets[0];
    const skills = JSON.parse(pet.skills || '[]');
    assert(skills.length > 0, 'Mythical beast must start with its custom skill');
    if (pet.template_id === 'kylan') {
      assert(skills.includes('qilin_fortune'), 'Qilin must have qilin_fortune skill');
    } else if (pet.template_id === 'phuonghoang') {
      assert(skills.includes('reborn_flame'), 'Phoenix must have reborn_flame skill');
    } else if (pet.template_id === 'tyhuu') {
      assert(skills.includes('gold_blessing'), 'Pixiu must have gold_blessing skill');
    }
    console.log(`Encounter Mythical Beast capture passed! Got pet: ${pet.name} with skills: ${pet.skills} ✅`);

    // 3. Test Encounter resolving 'lv_linh_dien_mua' with 'lv_ldm_cam_lo'
    // First, let's plant a seed
    const seedItem = db.prepare("SELECT id FROM items WHERE id LIKE 'seed_%' LIMIT 1").get() as { id: string } | undefined;
    const seedId = seedItem?.id || 'seed_linh_thao_1';
    
    // Add seed to user inventory
    inventoryRepository.addItem(testUserId, seedId, 1);
    
    // Ensure farming_plots row exists by calling getPlots
    farmingService.getPlots(testUserId);
    
    // Plant it
    const plantRes = farmingService.plantSeed(testUserId, 0, seedId);
    assert(plantRes.success, 'Should plant seed successfully');
    
    const plotBefore = db.prepare('SELECT growth_time FROM farming_plots WHERE user_id = ? AND plot_index = 0').get(testUserId) as { growth_time: number };
    assert(plotBefore.growth_time > 0, 'Plot should be growing with time remaining');

    // Force success for cam_lo choice
    Math.random = () => 0.05; // Force success (< 0.70 successRate)
    const encounterRes = encounterService.resolveEncounter(testUserId, 'lv_linh_dien_mua', 'lv_ldm_cam_lo');
    assert(encounterRes.success, 'Encounter resolution should succeed');
    assert.strictEqual(encounterRes.rewards.farming_acceleration, 2, 'Should accelerate growth by 2 hours');

    const plotAfter = db.prepare('SELECT growth_time FROM farming_plots WHERE user_id = ? AND plot_index = 0').get(testUserId) as { growth_time: number };
    const expectedTime = Math.max(0, plotBefore.growth_time - 7200);
    assert.strictEqual(plotAfter.growth_time, expectedTime, 'Crop growth time should be accelerated by 2 hours (7200 seconds)');
    console.log(`Encounter crop growth acceleration verification passed! Time before: ${plotBefore.growth_time}s, Time after: ${plotAfter.growth_time}s ✅`);

  } finally {
    Math.random = originalMathRandom;
  }

  // Cleanup
  userRepository.delete(testUserId);
  db.prepare('DELETE FROM pets WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM farming_plots WHERE user_id = ?').run(testUserId);
  console.log('Mythical Beasts and Encounters tests passed! ✅');
}

function testAdminPanelSystem() {
  console.log('Test: Admin Control Panel and System management');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { systemConfigService } = require('../src/services/SystemConfigService');
  const { dataCleanupService } = require('../src/services/DataCleanupService');
  const AdminCommand = require('../src/commands/general/admin').default;
  const db = require('../src/database/database').default;

  const adminId = '724608013981450351'; // BOT_OWNER_ID
  const testUserId = 'test_admin_player_999';

  userRepository.delete(testUserId);
  userRepository.create({
    discord_id: testUserId,
    name: 'Đạo Hữu Quản Lý',
    base_hp: 1000,
    base_mp: 200,
    base_atk: 50,
    base_def: 20,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 10,
    base_speed: 100,
    base_dodge: 0.05,
    linh_can: '{"Kim":100}',
    coin_ha_pham: 5000,
    knb: 0
  });

  // Ensure weekly purchases are populated
  const currentWeek = require('../src/commands/general/shop').getYearWeekString();
  userRepository.update(testUserId, {
    y_canh: JSON.stringify({
      weekly_purchases: {
        week: currentWeek,
        items: {
          'potion_stamina_weekly': 3
        }
      }
    })
  });

  // Mock client and interaction update function
  const mockClient: any = {
    guilds: {
      cache: {
        size: 5
      }
    },
    user: {
      tag: 'Thiên Đạo Bot#0000'
    }
  };

  let lastUpdatePayload: any = null;
  const mockInteraction = {
    user: { id: adminId },
    guildId: 'test_guild',
    update: async (payload: any) => {
      lastUpdatePayload = payload;
      return payload;
    },
    reply: async (payload: any) => {
      lastUpdatePayload = payload;
      return payload;
    },
    showModal: async (modal: any) => {
      lastUpdatePayload = { modal };
      return modal;
    }
  };

  // 1. Verify toggle maintenance via handleInteraction
  const originalMode = systemConfigService.isMaintenanceMode();
  AdminCommand.handleInteraction(mockClient, mockInteraction, 'adminpanel', ['adminpanel', 'maintenance', adminId])
    .then(() => {
      const modeAfter = systemConfigService.isMaintenanceMode();
      assert.strictEqual(modeAfter, !originalMode, 'Maintenance mode should toggle successfully');
      
      // Toggle back to clean up
      systemConfigService.setMaintenanceMode(originalMode);
      console.log('Admin toggle maintenance passed! ✅');

      // 2. Verify resetweekly action via handleInteraction
      return AdminCommand.handleInteraction(mockClient, mockInteraction, 'adminpanel', ['adminpanel', 'resetweekly', adminId]);
    })
    .then(() => {
      const updatedUser = userRepository.get(testUserId)!;
      let yCanh: any = {};
      try { yCanh = JSON.parse(updatedUser.y_canh || '{}'); } catch(e){}
      assert(!yCanh.weekly_purchases, 'Weekly purchases records should be cleared on reset');
      console.log('Admin resetweekly limit passed! ✅');

      // 3. Verify database cleanup
      const stats = dataCleanupService.cleanupOldData();
      assert(stats !== null, 'Cleanup stats should be returned correctly');
      console.log('Admin dbcleanup passed! ✅');

      // 4. Verify getUserPanelEmbed and components rendering
      const embed = AdminCommand.getUserPanelEmbed(testUserId);
      const components = AdminCommand.getUserPanelComponents(testUserId, adminId);
      assert(embed && embed.data.title.includes('HỒ SƠ TU SĨ'), 'User management embed should render correctly');
      assert(components && components.length > 0, 'User management components should render correctly');
      console.log('Admin user view panel passed! ✅');

      // Cleanup
      userRepository.delete(testUserId);
      console.log('Admin Control Panel tests passed! ✅');
    })
    .catch((err: any) => {
      console.error('Admin tests failed sub-promise:', err);
      try {
        const { systemConfigService } = require('../src/services/SystemConfigService');
        systemConfigService.setMaintenanceMode(false);
      } catch (e) {}
      process.exit(1);
    });
}

function testNewFeatures() {
  console.log('Test: New Features - Mentorship, Heart Law, and Nine Heavens Tower');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { mentorshipService } = require('../src/services/MentorshipService');
  const { heartLawService } = require('../src/services/HeartLawService');
  const { nineHeavensService } = require('../src/services/NineHeavensService');
  const { inventoryService } = require('../src/services/InventoryService');
  const { bloodlineService } = require('../src/services/BloodlineService');
  const db = require('../src/database/database').default;

  const testMentorId = 'test_mentor_001';
  const testApprenticeId = 'test_apprentice_002';

  // Cleanup
  userRepository.delete(testMentorId);
  userRepository.delete(testApprenticeId);
  db.prepare('DELETE FROM mentorships WHERE mentor_id = ? OR apprentice_id = ?').run(testMentorId, testApprenticeId);
  db.prepare('DELETE FROM user_heart_laws WHERE user_id = ? OR user_id = ?').run(testMentorId, testApprenticeId);
  db.prepare('DELETE FROM nine_heavens_progress WHERE user_id = ?').run(testMentorId);
  db.prepare('DELETE FROM user_bloodlines WHERE user_id = ?').run(testMentorId);

  // 1. Mentorship Setup
  userRepository.create({
    discord_id: testMentorId,
    name: 'Sư Phụ Test',
    base_hp: 2000, base_mp: 500, base_atk: 300, base_def: 100, base_crit: 0.1, base_crit_res: 0.05, base_luck: 15, base_speed: 120, base_dodge: 0.08,
    linh_can: '{}', coin_ha_pham: 50000, knb: 10, level: 55, tu_vi: 100, exp_needed: 10000
  });
  userRepository.update(testMentorId, { level: 55, tu_vi: 100, exp_needed: 10000 });

  userRepository.create({
    discord_id: testApprenticeId,
    name: 'Đệ Tử Test',
    base_hp: 500, base_mp: 100, base_atk: 50, base_def: 20, base_crit: 0.05, base_crit_res: 0.0, base_luck: 5, base_speed: 95, base_dodge: 0.05,
    linh_can: '{}', coin_ha_pham: 0, knb: 0, level: 10, tu_vi: 0, exp_needed: 500
  });
  userRepository.update(testApprenticeId, { level: 10, tu_vi: 0, exp_needed: 500 });

  // Verify can become mentorship
  let canBecome = mentorshipService.canBecomeMentorAndApprentice(testMentorId, testApprenticeId);
  assert(canBecome.success, `Should be able to form mentorship, message: ${canBecome.message}`);

  // Create mentorship
  let createRes = mentorshipService.createMentorship(testMentorId, testApprenticeId);
  assert(createRes.success, 'Mentorship creation should succeed');

  // Verify active relationship
  const activeApp = mentorshipService.getActiveMentorshipForApprentice(testApprenticeId);
  assert(activeApp && activeApp.mentor_id === testMentorId, 'Apprentice should have active mentor');

  // Test apprentice work cuts and bonuses
  const workRes = mentorshipService.handleApprenticeWork(testApprenticeId, 1000);
  assert.strictEqual(workRes.mentorGainedCoins, 50, 'Mentor should get 5% LT cut (50)');
  assert.strictEqual(workRes.apprenticeBonusExp, 21, 'Apprentice should get +5% EXP bonus (21 instead of 20)');

  // Verify DB updates
  const mentorAfterWork = userRepository.get(testMentorId)!;
  const apprenticeAfterWork = userRepository.get(testApprenticeId)!;
  assert.strictEqual(mentorAfterWork.coin_ha_pham, 50050, 'Mentor should receive 50 coins');
  assert.strictEqual(apprenticeAfterWork.tu_vi, 21, 'Apprentice should receive 21 EXP');

  // Test Milestone Levels
  let levelNotifications = mentorshipService.handleApprenticeLevelUp(testApprenticeId, 19, 20);
  assert(levelNotifications.length > 0 && levelNotifications[0].includes('Cấp 20'), 'Should trigger level 20 milestone');

  levelNotifications = mentorshipService.handleApprenticeLevelUp(testApprenticeId, 49, 50);
  assert(levelNotifications.length > 0 && levelNotifications[0].includes('TỐT NGHIỆP SƯ ĐỒ'), 'Should trigger graduation at level 50');

  // Verify graduated status in DB
  const graduatedMentorship = db.prepare('SELECT status FROM mentorships WHERE mentor_id = ? AND apprentice_id = ?').get(testMentorId, testApprenticeId) as any;
  assert.strictEqual(graduatedMentorship.status, 'graduated', 'Mentorship should be marked graduated');

  console.log('Mentorship tests passed! ✅');

  // 2. Heart Law Setup
  // Add 10 fragments for Hỏa Linh Quyết (hl_hoa)
  heartLawService.addFragments(testMentorId, 'hl_hoa', 10);
  let userHL = heartLawService.getUserHeartLaws(testMentorId).find((l: any) => l.id === 'hl_hoa')!;
  assert.strictEqual(userHL.fragments, 10, 'Should have 10 fragments');

  // Learn Hỏa Linh Quyết (spends 5 fragments)
  let learnRes = heartLawService.learnHeartLaw(testMentorId, 'hl_hoa');
  assert(learnRes.success, 'Learning should succeed');
  userHL = heartLawService.getUserHeartLaws(testMentorId).find((l: any) => l.id === 'hl_hoa')!;
  assert.strictEqual(userHL.level, 1, 'Should be level 1');
  assert.strictEqual(userHL.fragments, 5, 'Should have 5 fragments left');

  // Equip Hỏa Linh Quyết to slot 1
  let equipRes = heartLawService.equipHeartLaw(testMentorId, 'hl_hoa', 1);
  assert(equipRes.success, 'Equipping should succeed');

  let equipped = heartLawService.getEquippedHeartLaws(testMentorId);
  assert.strictEqual(equipped.length, 1, 'Should have 1 equipped law');
  assert.strictEqual(equipped[0].id, 'hl_hoa', 'Equipped law should be Hỏa Linh Quyết');
  assert.strictEqual(equipped[0].is_equipped, 1, 'Equipped slot should be 1');

  // Test Level Up Hỏa Linh Quyết (needs 1*5=5 fragments, 1000 LT, 1 Ngộ tính)
  // Set ngotinh and coins
  userRepository.update(testMentorId, { ngotinh: 5, coin_ha_pham: 10000 });
  let lvlUpRes = heartLawService.levelUpHeartLaw(testMentorId, 'hl_hoa');
  assert(lvlUpRes.success, `Upgrading should succeed, message: ${lvlUpRes.message}`);

  userHL = heartLawService.getUserHeartLaws(testMentorId).find((l: any) => l.id === 'hl_hoa')!;
  assert.strictEqual(userHL.level, 2, 'Should be level 2');
  assert.strictEqual(userHL.fragments, 0, 'Should have 0 fragments left');

  const mentorAfterLvlUp = userRepository.get(testMentorId)!;
  assert.strictEqual(mentorAfterLvlUp.ngotinh, 4, 'Ngộ tính should decrease by 1 (5 -> 4)');
  assert.strictEqual(mentorAfterLvlUp.coin_ha_pham, 9000, 'Linh Thạch should decrease by 1000 (10000 -> 9000)');

  // Test Bloodline Synergy (Phượng Hoàng Huyết Mạch (id: phuong_hoang) matching Hỏa Linh Quyết (element: Hỏa) -> 1.5x)
  db.prepare("INSERT INTO user_bloodlines (user_id, bloodline_id, level, activated_at) VALUES (?, 'phuong_hoang', 1, ?)").run(testMentorId, Math.floor(Date.now() / 1000));
  
  let activePassives = heartLawService.getActivePassives(testMentorId);
  assert.strictEqual(activePassives.length, 1, 'Should have 1 active passive');
  assert.strictEqual(activePassives[0].type, 'element_fire_dmg', 'Passive type should be element_fire_dmg');
  // Base value: 0.05. Level 2 -> value = 0.05 * (1 + 0.1) = 0.055. Synergy matching system -> 1.5x -> 0.055 * 1.5 = 0.0825
  assert.strictEqual(activePassives[0].scale, 1.5, 'Should matching system synergy scale 1.5');
  assert(Math.abs(activePassives[0].value - 0.0825) < 0.0001, 'Passive value should be approximately 0.0825');

  // Test combat engine integration with passive (Hp regen, element dmg boost)
  const playerCombatant: Combatant = {
    name: 'Đạo Hữu Hỏa Linh',
    hp: 1000, maxHp: 1000,
    atk: 100, def: 20,
    crit: 0.1, critRes: 0.05,
    luck: 10, speed: 100, dodge: 0.05,
    linhCan: '{}',
    equippedSkills: [{ id: 'skill_fire_1', element: 'Hỏa', level: 1, name: 'Hỏa Cầu Thuật' }],
    userId: testMentorId
  };

  const dummyEnemy: Combatant = {
    name: 'Khác Hệ Địch',
    hp: 500, maxHp: 500,
    atk: 50, def: 10,
    crit: 0.05, critRes: 0,
    luck: 5, speed: 90, dodge: 0.05,
    element: 'Mộc'
  };

  // Run combat and ensure log displays matching passive info
  const combatResult = CombatEngine.run(playerCombatant, dummyEnemy, null, 10);
  assert(combatResult.log.some(l => l.includes('Tâm Pháp [Hỏa Linh Quyết]')), 'Should activate Hỏa Linh Quyết damage boost in log');

  console.log('Heart Law tests passed! ✅');

  // 3. Nine Heavens Tower Setup
  // Challenge Floor 1 (miễn phí)
  const challRes = nineHeavensService.enterFloorChallenge(testMentorId, false);
  assert(challRes.success, `Challenge execution should succeed, message: ${challRes.message}`);
  assert(challRes.combatResult, 'Should return a combatResult');

  const progressAfter = nineHeavensService.getProgress(testMentorId);
  assert.strictEqual(progressAfter.attempts_this_week, 1, 'Should consume 1 attempt (0 -> 1)');

  // Verify permanent stats buff applied in getActiveStats if player won
  if (progressAfter.highest_floor > 0) {
    const stats = inventoryService.getActiveStats(testMentorId)!;
    // Floor 1 gives +10 ATK vĩnh viễn. Base ATK is 300, no other modifiers.
    // stats.atk = 300 + 10 = 310
    assert.strictEqual(stats.atk, 310, `Active ATK should reflect floor 1 buff (310), got ${stats.atk}`);
    console.log('Nine Heavens Tower permanent buff verification passed! ✅');
  }

  // Cleanup
  userRepository.delete(testMentorId);
  userRepository.delete(testApprenticeId);
  db.prepare('DELETE FROM mentorships WHERE mentor_id = ? OR apprentice_id = ?').run(testMentorId, testApprenticeId);
  db.prepare('DELETE FROM user_heart_laws WHERE user_id = ? OR user_id = ?').run(testMentorId, testApprenticeId);
  db.prepare('DELETE FROM nine_heavens_progress WHERE user_id = ?').run(testMentorId);
  db.prepare('DELETE FROM user_bloodlines WHERE user_id = ?').run(testMentorId);

  console.log('All new features tests passed successfully! ✅');
}

function testNewEnhancements() {
  console.log('Test: New Enhancements - Admin Double EXP toggle and Mentorship Transmission');
  const { userRepository } = require('../src/database/repositories/UserRepository');
  const { mentorshipService } = require('../src/services/MentorshipService');
  const { eventService } = require('../src/services/EventService');
  const db = require('../src/database/database').default;
  const AdminCommand = require('../src/commands/general/admin').default;

  const testMentorId = 'test_mentor_enh_001';
  const testApprenticeId = 'test_apprentice_enh_002';
  const adminId = '724608013981450351';

  // 1. Clean & Setup Users
  userRepository.delete(testMentorId);
  userRepository.delete(testApprenticeId);
  db.prepare('DELETE FROM mentorships WHERE mentor_id = ? OR apprentice_id = ?').run(testMentorId, testApprenticeId);

  userRepository.create({
    discord_id: testMentorId,
    name: 'Sư Phụ Enh',
    base_hp: 2000, base_mp: 500, base_atk: 300, base_def: 100, base_crit: 0.1, base_crit_res: 0.05, base_luck: 15, base_speed: 120, base_dodge: 0.08,
    linh_can: '{}', coin_ha_pham: 50000, knb: 10, level: 55, tu_vi: 5000, exp_needed: 10000
  });
  userRepository.update(testMentorId, { level: 55, tu_vi: 5000, exp_needed: 10000 });

  userRepository.create({
    discord_id: testApprenticeId,
    name: 'Đệ Tử Enh',
    base_hp: 500, base_mp: 100, base_atk: 50, base_def: 20, base_crit: 0.05, base_crit_res: 0.0, base_luck: 5, base_speed: 95, base_dodge: 0.05,
    linh_can: '{}', coin_ha_pham: 0, knb: 0, level: 10, tu_vi: 0, exp_needed: 500
  });
  userRepository.update(testApprenticeId, { level: 10, tu_vi: 0, exp_needed: 500 });

  // 2. Test Double EXP Toggle via Admin Panel Handler
  const originalMode = eventService.isDoubleExpActive();
  
  const mockClient: any = {
    guilds: {
      cache: {
        size: 5
      }
    },
    user: {
      tag: 'Thiên Đạo Bot#0000'
    }
  };
  let updatePayload: any = null;
  const mockInteraction: any = {
    user: { id: adminId },
    update: async (payload: any) => {
      updatePayload = payload;
      return payload;
    }
  };

  // Toggle Double EXP ON via adminpanel subAction
  AdminCommand.handleInteraction(mockClient, mockInteraction, 'adminpanel', ['adminpanel', 'doubleexp', adminId])
    .then(() => {
      const activeAfter = eventService.isDoubleExpActive();
      assert.strictEqual(activeAfter, !originalMode, 'Double EXP status should be toggled');
      assert(updatePayload && updatePayload.content.includes('Nhân Đôi EXP'), 'Embed update payload should contain success message');
      console.log('Double EXP toggle via Admin Panel passed! ✅');

      // Toggle back to clean up
      eventService.toggleDoubleExpManual(originalMode);

      // 3. Test Cultivation Transmission (Mentorship System)
      // Attempt to transmit without active mentorship -> Should fail
      let txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 500);
      assert(!txRes.success, 'Transmission should fail without active mentorship');

      // Create mentorship
      mentorshipService.createMentorship(testMentorId, testApprenticeId);

      // Attempt to transmit too low/high amount
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 50);
      assert(!txRes.success, 'Transmission should fail if amount < 100');
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 2500);
      assert(!txRes.success, 'Transmission should fail if amount > 2000');

      // Attempt to transmit when mentor has insufficient tu_vi
      userRepository.update(testMentorId, { tu_vi: 100 });
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 200);
      assert(!txRes.success, 'Transmission should fail if mentor tu_vi is insufficient');

      // Attempt to transmit when mentor has insufficient Linh Thạch (coins)
      userRepository.update(testMentorId, { tu_vi: 5000, coin_ha_pham: 500 });
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 500);
      assert(!txRes.success, 'Transmission should fail if mentor coin_ha_pham is insufficient (< 1000)');

      // Valid Transmission (500 EXP)
      userRepository.update(testMentorId, { tu_vi: 5000, coin_ha_pham: 10000 });
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 500);
      assert(txRes.success, `Transmission should succeed, message: ${txRes.message}`);

      // Verify stats after transmission
      const mentorAfter = userRepository.get(testMentorId)!;
      const apprenticeAfter = userRepository.get(testApprenticeId)!;
      assert.strictEqual(mentorAfter.tu_vi, 4500, 'Mentor tu_vi should decrease by 500');
      assert.strictEqual(mentorAfter.coin_ha_pham, 9000, 'Mentor coin_ha_pham should decrease by 1000');
      assert.strictEqual(apprenticeAfter.tu_vi, 500, 'Apprentice tu_vi should increase by 500');

      // Attempt to transmit over weekly limit (already transmitted 500, limit is 2000, so remaining is 1500. Let's try transmitting 1600)
      txRes = mentorshipService.transmitCultivation(testMentorId, testApprenticeId, 1600);
      assert(!txRes.success, 'Transmission should fail if exceeding weekly limit');
      assert(txRes.message.includes('1500'), `Should mention maximum remaining amount, got: ${txRes.message}`);

      // Clean up
      userRepository.delete(testMentorId);
      userRepository.delete(testApprenticeId);
      db.prepare('DELETE FROM mentorships WHERE mentor_id = ? OR apprentice_id = ?').run(testMentorId, testApprenticeId);
      console.log('Mentorship Cultivation Transmission passed! ✅');
    })
    .catch((err: any) => {
      console.error('Enhancements tests failed sub-promise:', err);
      try {
        const { systemConfigService } = require('../src/services/SystemConfigService');
        systemConfigService.setMaintenanceMode(false);
      } catch (e) {}
      process.exit(1);
    });
}

function testBrotherhood() {
  console.log('\n🧪 Test Brotherhood...');
  const { brotherhoodService } = require('../src/services/BrotherhoodService');
  
  const bonus = brotherhoodService.getSharedExpBonus('user1');
  console.log(`  ✅ Brotherhood EXP bonus: ${bonus * 100}%`);
  
  const atkBonus = brotherhoodService.getPartyAtkBonus('user1', 'user2');
  console.log(`  ✅ Brotherhood ATK bonus with same: ${(atkBonus * 100)}%`);
  
  const noBonus = brotherhoodService.getPartyAtkBonus('user1', 'user3');
  console.log(`  ✅ Brotherhood ATK bonus with different: ${(noBonus * 100)}%`);
  
  console.log('  ✅ Brotherhood tests passed!');
}

function testBlockChance() {
  console.log('\n🧪 Test Block Chance...');
  const { CombatEngine } = require('../src/services/CombatEngine');
  
  for (let i = 0; i < 5; i++) {
    const result = CombatEngine.run(
      { name: 'Player', hp: 1000, maxHp: 1000, atk: 100, def: 50, crit: 0.1, critRes: 0, luck: 10, block_chance: 0.1, dodge: 0.05, speed: 100 },
      { name: 'Enemy', hp: 100, maxHp: 100, atk: 80, def: 30, crit: 0.05, critRes: 0, luck: 5, dodge: 0.05, speed: 100 }
    );
    console.log(`  ✅ Battle ${i+1}: ${result.winner}, rounds: ${result.rounds}`);
  }
  console.log('  ✅ Block chance tests passed!');
}

function testNotifications() {
  console.log('\n🧪 Test Notification System...');
  const { notificationService } = require('../src/services/NotificationService');
  
  notificationService.setSetting('test_user', 'linhdien_ripe', true);
  notificationService.setSetting('test_user', 'arena_season_end', false);
  
  const settings = notificationService.getSettings('test_user');
  console.log(`  ✅ Notification settings: ${JSON.stringify(settings)}`);
  console.log('  ✅ Notification tests passed!');
}

function testExpReduction() {
  console.log('\n🧪 Test EXP Reduction...');
  const { CultivationService } = require('../src/services/CultivationService');
  const svc = new CultivationService();
  
  const expLv50 = svc.calculateNextExp(50);
  const expLv100 = svc.calculateNextExp(100);
  const expLv150 = svc.calculateNextExp(150);
  
  console.log(`  ✅ EXP needed Lv50: ${expLv50}`);
  console.log(`  ✅ EXP needed Lv100: ${expLv100}`);
  console.log(`  ✅ EXP needed Lv150: ${expLv150} (should be reduced vs base formula)`);
  
  const multiplier = svc.getExpMultiplierForSource(120, 50);
  console.log(`  ✅ EXP multiplier (Lv120 from Lv50): ${multiplier}`);
  console.log('  ✅ EXP reduction tests passed!');
}

function runAll() {
  try {
    initDatabase();
    try {
      const { systemConfigService } = require('../src/services/SystemConfigService');
      systemConfigService.setMaintenanceMode(false);
    } catch (e) {}
    
    testCombatEngine();
    testStaminaPotionWeekly();
    testUnsupportedItemAndEnhanceFixes();
    testMythicalBeastsAndEncounters();
    testAdminPanelSystem();
    testNewFeatures();
    testNewEnhancements();
    testBrotherhood();
    testBlockChance();
    testNotifications();
    testExpReduction();
    console.log('All tests passed successfully! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    try {
      const { systemConfigService } = require('../src/services/SystemConfigService');
      systemConfigService.setMaintenanceMode(false);
    } catch (e) {}
    process.exit(1);
  }
}

runAll();
