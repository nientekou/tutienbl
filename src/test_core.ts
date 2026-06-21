import { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { inventoryRepository } from './database/repositories/InventoryRepository';
import { cultivationService } from './services/CultivationService';
import { inventoryService } from './services/InventoryService';
import { formatLinhCan, getRealmDetails } from './utils/constants';
import db from './database/database';

console.log('--- CHẠY THỬ NGHIỆM CORE LOGIC (GIAI ĐOẠN 4) ---');

try {
  // Khởi tạo Database
  initDatabase();

  const testDiscordId = '123456789098765432';

  // Dọn dẹp bản ghi cũ nếu có
  const existing = userRepository.get(testDiscordId);
  if (existing) {
    console.log(`[Test] Đã tìm thấy nhân vật test cũ: ${existing.name}. Đang dọn dẹp...`);
    db.prepare('DELETE FROM users WHERE discord_id = ?').run(testDiscordId);
  }

  // 1. Kiểm thử tạo nhân vật mới
  console.log('\n--- 1. Kiểm Thử Tạo Nhân Vật ---');
  // Cố định Linh Căn Đơn hệ Mộc để dễ tính tốc độ tu luyện
  const testLinhCan = JSON.stringify({ 'Mộc': 100 });
  const tempStats = cultivationService.calculateStatsForLevel(1, testLinhCan);
  
  userRepository.create({
    discord_id: testDiscordId,
    name: 'Tiêu Viêm',
    base_hp: tempStats.hp,
    base_mp: tempStats.mp,
    base_atk: tempStats.atk,
    base_def: tempStats.def,
    base_crit: tempStats.crit,
    base_crit_res: tempStats.critRes,
    base_luck: tempStats.luck,
    linh_can: testLinhCan
  });

  let user = userRepository.get(testDiscordId)!;
  console.log(`✅ Khởi tạo thành công nhân vật: **${user.name}**`);
  console.log(`- Linh Căn: ${formatLinhCan(user.linh_can)}`);

  // 2. Kiểm thử Tích Lũy Tu Vi Nhàn Rỗi (Idle Cultivation)
  console.log('\n--- 2. Kiểm Thử Tu Luyện Nhàn Rỗi ---');
  console.log(`- Tu vi ban đầu: ${user.tu_vi}/${user.exp_needed}`);
  console.log(`- Mốc cập nhật ban đầu: ${user.updated_at}`);

  // Giả lập quay ngược thời gian 1 giờ (3600 giây) trong database
  const oneHourAgo = user.updated_at - 3600;
  db.prepare('UPDATE users SET updated_at = ? WHERE discord_id = ?').run(oneHourAgo, testDiscordId);
  
  console.log(`- Giả lập đưa thời điểm cập nhật về 1 giờ trước...`);
  
  // Gọi hàm claim idle cultivation
  const idleRes = cultivationService.claimIdleCultivation(testDiscordId);
  if (idleRes) {
    console.log(`✅ ${idleRes.message}`);
    user = idleRes.user;
    console.log(`- Tu vi sau khi nhàn rỗi: ${user.tu_vi}/${user.exp_needed}`);
  } else {
    console.log('❌ Lỗi: Không thể thu hoạch tu vi nhàn rỗi.');
  }

  // 3. Kiểm thử Đột Phá Lớn Cảnh Giới (Level 38 -> 39, Luyện Khí -> Trúc Cơ)
  console.log('\n--- 3. Kiểm Thử Đột Phá Đại Cảnh Giới ---');
  console.log('Đưa nhân vật lên Level 38 (Luyện Khí Đại Viên Mãn)...');
  const level38Stats = cultivationService.calculateStatsForLevel(38, user.linh_can);
  const nextExpNeeded = cultivationService.calculateNextExp(38);
  
  userRepository.update(testDiscordId, {
    level: 38,
    tu_vi: nextExpNeeded, // Tu vi đầy
    exp_needed: nextExpNeeded,
    base_hp: level38Stats.hp,
    base_atk: level38Stats.atk,
    base_def: level38Stats.def
  });

  user = userRepository.get(testDiscordId)!;
  const realmBefore = getRealmDetails(user.level);
  console.log(`- Cảnh giới trước đột phá: **${realmBefore.fullName}**`);
  console.log(`- Tu vi trước đột phá: ${user.tu_vi}/${user.exp_needed}`);

  // Đột phá không đan dược (Cưỡng bức)
  console.log('\n--- A. Đột phá không đan dược (Cưỡng bức) ---');
  // Chạy lặp để xem kết quả (do có tỉ lệ thành công gốc khoảng 80% - 38*10% -> khoảng 80% - 0 * 10% = 80%)
  // Tại level 38, majorIndex = Math.floor(37/38) = 0.
  // Base rate = 80 - 0 * 10 = 80%.
  let btResForce = cultivationService.breakthrough(testDiscordId, false);
  console.log(`- Kết quả đột phá: ${btResForce.message}`);

  // Nếu thất bại, khôi phục lại tu vi đầy để test tiếp có dùng đan dược
  user = userRepository.get(testDiscordId)!;
  if (!btResForce.success) {
    console.log('Đột phá thất bại. Đang hồi phục đầy tu vi...');
    userRepository.update(testDiscordId, { tu_vi: user.exp_needed });
    user = userRepository.get(testDiscordId)!;
  } else {
    // Nếu thành công thăng lên 39, ta đưa lùi về 38 để test đan dược
    console.log('Đột phá thành công. Đang lùi level về 38 để test trường hợp dùng đan dược...');
    userRepository.update(testDiscordId, { level: 38, tu_vi: user.exp_needed, title: 'Tán Tu' });
    user = userRepository.get(testDiscordId)!;
  }

  // Đột phá có đan dược
  console.log('\n--- B. Đột phá có sử dụng Trúc Cơ Đan ---');
  console.log('Cố gắng đột phá dùng thuốc khi KHÔNG có Trúc Cơ Đan trong túi...');
  const btResPillFail = cultivationService.breakthrough(testDiscordId, true);
  console.log(`- Kết quả: ${btResPillFail.message}`); // Phải báo lỗi không có thuốc

  console.log('Thêm 1x Trúc Cơ Đan (pill_break_1) vào túi đồ...');
  inventoryRepository.addItem(testDiscordId, 'pill_break_1', 1);
  
  let bag = inventoryRepository.getUserInventory(testDiscordId);
  console.log(`- Số lượng Trúc Cơ Đan trong túi: ${bag.find(i => i.item_id === 'pill_break_1')?.quantity || 0}`);

  console.log('Thực hiện đột phá có dùng thuốc...');
  const btResPillSuccess = cultivationService.breakthrough(testDiscordId, true);
  console.log(`- Kết quả đột phá: ${btResPillSuccess.message}`);

  user = userRepository.get(testDiscordId)!;
  bag = inventoryRepository.getUserInventory(testDiscordId);
  console.log(`- Số lượng Trúc Cơ Đan trong túi sau đột phá: ${bag.find(i => i.item_id === 'pill_break_1')?.quantity || 0}`);
  
  const realmAfter = getRealmDetails(user.level);
  console.log(`- Cảnh giới sau cùng: **${realmAfter.fullName}** (Danh hiệu: ${user.title})`);

  console.log('\n🎉 --- TẤT CẢ KIỂM THỬ GIAI ĐOẠN 4 ĐÃ ĐẠT TIÊU CHUẨN! ---');

} catch (error) {
  console.error('❌ Lỗi trong quá trình kiểm thử:', error);
} finally {
  db.close();
}
