import db, { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { destinyService } from './services/DestinyService';
import { destinyRepository } from './database/repositories/DestinyRepository';

async function testMenhCach() {
  console.log('🔮 Bắt đầu kiểm tra Mệnh Cách...');
  initDatabase();

  const testUser = 'test_user_menhcach';
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM user_destinies WHERE user_id = ?').run(testUser);

  userRepository.create({
    discord_id: testUser,
    name: 'Mệnh Cách Tử',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 }),
    coin_ha_pham: 50000
  });

  const user = userRepository.get(testUser)!;
  console.log(`Đã tạo test user: ${user.name}, Linh Thạch: ${user.coin_ha_pham}`);

  // Test boi-que
  console.log('-> Đang bốc quẻ (rollGacha)...');
  try {
    const rollRes = destinyService.rollGacha(testUser);
    console.log(`RollGacha Result: Success=${rollRes.success}, Message=${rollRes.message}`);
  } catch (e) {
    console.error('❌ Lỗi khi bốc quẻ:', e);
  }

  // Test tu-do
  console.log('-> Đang kiểm tra túi đồ Mệnh Cách...');
  try {
    const destinies = destinyRepository.getUserDestinies(testUser);
    console.log(`Đã bốc quẻ được ${destinies.length} mệnh cách.`);
    
    // Test slot count
    const maxSlots = destinyService.getMaxSlotsByRealm('Trúc Cơ Kỳ');
    console.log(`Max slots cho Trúc Cơ Kỳ: ${maxSlots}`);
  } catch (e) {
    console.error('❌ Lỗi khi đọc tủ đồ:', e);
  }
}

testMenhCach().catch(e => console.error(e));
