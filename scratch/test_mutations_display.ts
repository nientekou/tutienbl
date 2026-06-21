import db, { initDatabase } from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { getSungThuEmbed } from '../src/commands/general/sungthu';

async function runTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ THÀNH VIÊN HIỂN THỊ LINH THÚ TÌNH TÚ... 🧪\n');
  initDatabase();

  const testUser = 'test_user_pets';

  // 0. Cleanup old test data
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM pets WHERE user_id = ?').run(testUser);

  // 1. Create a test character
  userRepository.create({
    discord_id: testUser,
    name: 'Thú Vương Lão Tổ',
    base_hp: 1000,
    base_mp: 500,
    base_atk: 100,
    base_def: 50,
    base_crit: 0.1,
    base_crit_res: 0.05,
    base_luck: 15,
    linh_can: JSON.stringify({ 'Hỏa': 100 }),
    coin_ha_pham: 10000
  });

  // 2. Create a pet with mutations
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO pets (
      user_id, name, template_id, rarity, level, exp,
      base_hp, base_atk, base_def, is_deployed, skills,
      parent_1, parent_2, gender, mutations, created_at
    ) VALUES (
      ?, 'Hỏa Kỳ Lân', 'ky_lan', 'epic', 10, 0,
      1000, 150, 70, 0, '[]',
      NULL, NULL, 0, '{"stars":3,"bonus_atk":35,"bonus_def":15,"bonus_hp":200}', ?
    )
  `).run(testUser, now);

  // 3. Generate embed and assert contents
  const embed = getSungThuEmbed(testUser);
  const data = embed.toJSON();
  
  console.log('--- Embed Fields ---');
  console.log(JSON.stringify(data.fields, null, 2));
  console.log('--------------------');

  const field = data.fields?.[0];
  if (!field) {
    throw new Error('Lỗi: Embed không có trường thông tin linh thú!');
  }

  if (!field.name.includes('Hỏa Kỳ Lân [★★★]')) {
    throw new Error('Lỗi: Tiêu đề không hiển thị đúng Tinh Túc [★★★]!');
  }

  if (!field.value.includes('Công **150** (+35)') || !field.value.includes('Thủ **70** (+15)') || !field.value.includes('HP **1000** (+200)')) {
    throw new Error('Lỗi: Các chỉ số đột phá (+35, +15, +200) không được hiển thị đúng!');
  }

  console.log('✅ TEST PASSED: Sủng Thú Tinh Túc & Chỉ số đột phá hiển thị chính xác!');

  // Clean up
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM pets WHERE user_id = ?').run(testUser);
  console.log('\n🧹 Đã dọn dẹp dữ liệu kiểm thử.');
  console.log('\n🌟 HOÀN THẤT KIỂM THỬ SỦNG THÚ THÀNH CÔNG! 🌟');
}

runTests().catch(e => {
  console.error('❌ LỖI TRONG BÀI KIỂM THỬ:');
  console.error(e);
  process.exit(1);
});
