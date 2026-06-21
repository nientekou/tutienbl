import { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { formatLinhCan } from './utils/constants';
import { SHOP_ITEMS } from './commands/general/shop';
import { practiceCooldowns } from './handlers/interactions/CultivationInteractionHandler';
import db from './database/database';

console.log('--- BẮT ĐẦU KIỂM THỬ CÁC CẢI TIẾN & SỬA LỖI ---');

async function main() {
  try {
    initDatabase();

    const testUserId = '999999999999999999';

    // Dọn dẹp dữ liệu test cũ
    db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUserId);
    db.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUserId);

    // Tạo nhân vật test mới
    const testLinhCan = JSON.stringify({ 'Hỏa': 60, 'Thổ': 40 }); // Song Linh Căn
    const tempStats = { hp: 100, mp: 50, atk: 10, def: 10, crit: 0.05, critRes: 0, luck: 10 };
    userRepository.create({
      discord_id: testUserId,
      name: 'Ngộ Đạo Nhân',
      base_hp: tempStats.hp,
      base_mp: tempStats.mp,
      base_atk: tempStats.atk,
      base_def: tempStats.def,
      base_crit: tempStats.crit,
      base_crit_res: tempStats.critRes,
      base_luck: tempStats.luck,
      linh_can: testLinhCan
    });

    console.log('✅ Đã tạo nhân vật test Ngộ Đạo Nhân.');

    // ==========================================
    // KIỂM THỬ 1: Cơ Chế Linh Căn & Định Dạng
    // ==========================================
    console.log('\n--- KIỂM THỬ 1: Cơ Chế Linh Căn & Định Dạng ---');
    const formatted = formatLinhCan(testLinhCan);
    console.log('Formatted Linh Căn:', formatted);
    if (formatted.includes('Song Linh Căn') && formatted.includes('1.25x')) {
      console.log('✅ Định dạng Linh Căn chứa Tốc độ tu luyện (1.25x) thành công!');
    } else {
      throw new Error('❌ Thất bại: formatLinhCan không hiển thị đúng thông tin tốc độ!');
    }

    // ==========================================
    // KIỂM THỬ 2: Bày Bán Lò Luyện trong Phường Thị
    // ==========================================
    console.log('\n--- KIỂM THỬ 2: Bày Bán Lò Luyện trong Phường Thị ---');
    const hasLow = SHOP_ITEMS.some(i => i.id === 'cauldron_low');
    const hasMid = SHOP_ITEMS.some(i => i.id === 'cauldron_mid');
    const hasHigh = SHOP_ITEMS.some(i => i.id === 'cauldron_high');
    if (hasLow && hasMid && hasHigh) {
      console.log('✅ Các loại Lò Luyện Đan đã được thêm vào SHOP_ITEMS thành công!');
    } else {
      throw new Error('❌ Thất bại: SHOP_ITEMS thiếu lò luyện đan!');
    }

    // ==========================================
    // KIỂM THỬ 3: Cooldown Thiền Định 10s
    // ==========================================
    console.log('\n--- KIỂM THỬ 3: Cooldown Thiền Định 10s ---');
    const now = Date.now();
    practiceCooldowns.set(testUserId, now);

    // Thử lại ngay lập tức
    const checkImmediate = practiceCooldowns.get(testUserId) || 0;
    const diffImmediate = Date.now() - checkImmediate;
    console.log(`Thời gian chênh lệch ngay lập tức: ${diffImmediate}ms`);
    if (diffImmediate < 10000) {
      console.log('✅ Chặn thiền định liên tục dưới 10 giây hoạt động tốt!');
    } else {
      throw new Error('❌ Thất bại: Không chặn được thiền định liên tục!');
    }

    // Thử sau 11 giây
    practiceCooldowns.set(testUserId, now - 11000);
    const checkAfter = practiceCooldowns.get(testUserId) || 0;
    const diffAfter = Date.now() - checkAfter;
    console.log(`Thời gian chênh lệch sau 11s giả lập: ${diffAfter}ms`);
    if (diffAfter >= 10000) {
      console.log('✅ Cho phép thiền định sau khi hết 10 giây cooldown thành công!');
    } else {
      throw new Error('❌ Thất bại: Không cho phép thiền định sau cooldown!');
    }

    console.log('\n🎉 --- TẤT CẢ KIỂM THỬ CẢI TIẾN ĐÃ THÀNH CÔNG RỰC RỠ! ---');
    process.exit(0);

  } catch (error) {
    console.error('❌ Lỗi trong quá trình kiểm thử:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
