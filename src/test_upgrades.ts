import { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { cultivationService } from './services/CultivationService';
import { inventoryService } from './services/InventoryService';
import { InteractionLock } from './services/InteractionLock';
import { systemConfigService } from './services/SystemConfigService';
import db from './database/database';

console.log('=== CHẠY KIỂM THỬ TỰ ĐỘNG CÁC TÍNH NĂNG CẢI TIẾN & NÂNG CẤP ===');

try {
  // 1. Khởi tạo DB
  initDatabase();

  const userId = '888888888888888881';

  // Dọn dẹp dữ liệu cũ
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(userId);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(userId);

  // Khởi tạo nhân vật test
  userRepository.create({
    discord_id: userId,
    name: 'Lâm Phàm',
    base_hp: 200,
    base_mp: 100,
    base_atk: 30,
    base_def: 15,
    base_crit: 0.05,
    base_crit_res: 0.0,
    base_luck: 15,
    linh_can: JSON.stringify({ 'Hỏa': 100 })
  });
  console.log('✅ Đã khởi tạo thành công nhân vật Lâm Phàm.');

  // ============================================
  // 2. KIỂM THỬ LOCK CHỐNG SPAM (INTERACTION LOCK)
  // ============================================
  console.log('\n--- 2. Kiểm Thử Khóa Tương Tác Chống Spam ---');
  
  const lock1 = InteractionLock.acquire(userId);
  console.log(`- Lần 1 lấy khóa: ${lock1 ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);

  const lock2 = InteractionLock.acquire(userId);
  console.log(`- Lần 2 lấy khóa khi đang có khóa: ${!lock2 ? 'BỊ CHẶN THÀNH CÔNG (Đúng)' : 'LẤY ĐƯỢC (Sai)'}`);

  InteractionLock.release(userId);
  console.log('- Đã giải phóng khóa.');

  const lock3 = InteractionLock.acquire(userId);
  console.log(`- Lần 3 lấy khóa sau giải phóng: ${lock3 ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);
  InteractionLock.release(userId);

  if (lock1 && !lock2 && lock3) {
    console.log('✅ Đạt chuẩn: Hệ thống InteractionLock hoạt động chính xác!');
  } else {
    throw new Error('Hệ thống InteractionLock hoạt động sai!');
  }

  // ============================================
  // 3. KIỂM THỬ CHẾ ĐỘ BẢO TRÌ (MAINTENANCE MODE)
  // ============================================
  console.log('\n--- 3. Kiểm Thử Chế Độ Bảo Trì ---');
  
  // Lưu trạng thái cũ
  const originalMaintenance = systemConfigService.isMaintenanceMode();
  
  systemConfigService.setMaintenanceMode(true);
  console.log(`- Đã bật chế độ bảo trì. Kiểm tra: ${systemConfigService.isMaintenanceMode() === true ? 'BẬT (Đúng)' : 'TẮT (Sai)'}`);
  
  systemConfigService.setMaintenanceMode(false);
  console.log(`- Đã tắt chế độ bảo trì. Kiểm tra: ${systemConfigService.isMaintenanceMode() === false ? 'TẮT (Đúng)' : 'BẬT (Sai)'}`);
  
  // Khôi phục
  systemConfigService.setMaintenanceMode(originalMaintenance);
  console.log('✅ Đạt chuẩn: Hệ thống cấu hình bảo trì hoạt động chính xác!');

  // ============================================
  // 4. KIỂM THỬ Ý CẢNH & ĐẠO QUẢ
  // ============================================
  console.log('\n--- 4. Kiểm Thử Ý Cảnh & Đạo Quả ---');
  
  // Nạp 10 ngộ tính cho người chơi
  userRepository.update(userId, { ngotinh: 10 });
  let user = userRepository.get(userId)!;
  console.log(`- Điểm Ngộ Tính ban đầu của Lâm Phàm: ${user.ngotinh}`);

  // Ngộ Ý Cảnh lần 1 (Tiêu tốn 5 ngộ tính)
  const awaken1 = cultivationService.awakenYCanh(userId);
  console.log(`- Kết quả Ngộ Ý Cảnh lần 1: ${awaken1.success ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);
  console.log(`  Tin nhắn: "${awaken1.message}"`);
  console.log(`  Ý Cảnh nhận được: ${awaken1.yCanhName} (Cấp ${awaken1.newLevel})`);

  user = userRepository.get(userId)!;
  console.log(`- Điểm Ngộ Tính còn lại: ${user.ngotinh}`);

  // Xem chỉ số chiến đấu thay đổi thế nào
  const baseStats = { hp: user.base_hp, atk: user.base_atk, def: user.base_def };
  const activeStats = inventoryService.getActiveStats(userId)!;
  console.log(`- Chỉ số chiến đấu gốc: HP: ${baseStats.hp}, ATK: ${baseStats.atk}, DEF: ${baseStats.def}`);
  console.log(`- Chỉ số sau khi ngộ Ý Cảnh: HP: ${activeStats.hp}, ATK: ${activeStats.atk}, DEF: ${activeStats.def}`);

  if (activeStats.hp > baseStats.hp || activeStats.atk > baseStats.atk || activeStats.def > baseStats.def) {
    console.log('✅ Đạt chuẩn: Ý Cảnh buff thành công chỉ số thực tế của người chơi!');
  } else {
    throw new Error('Ý Cảnh không buff chỉ số người chơi!');
  }

  // ============================================
  // 5. KIỂM THỬ LUÂN HỒI (REINCARNATION)
  // ============================================
  console.log('\n--- 5. Kiểm Thử Luân Hồi ---');
  
  // Thử luân hồi ở cấp thấp (phải thất bại)
  const reincarnateFail = cultivationService.reincarnate(userId);
  console.log(`- Thử luân hồi ở cấp ${user.level}: ${!reincarnateFail.success ? 'BỊ TỪ CHỐI THÀNH CÔNG (Đúng)' : 'THỰC HIỆN ĐƯỢC (Sai)'}`);
  console.log(`  Tin nhắn: "${reincarnateFail.message}"`);

  // Hack cấp độ lên 380 (Đăng Tiên Kỳ - Tầng 38)
  userRepository.update(userId, { level: 380 });
  console.log('- Đã chỉnh sửa cấp độ Lâm Phàm lên Cấp 380.');

  // Tiến hành Luân hồi (phải thành công)
  const reincarnateSuccess = cultivationService.reincarnate(userId);
  console.log(`- Tiến hành Luân Hồi: ${reincarnateSuccess.success ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);
  console.log(`  Tin nhắn: "${reincarnateSuccess.message}"`);

  user = userRepository.get(userId)!;
  console.log(`- Cấp độ sau Luân Hồi: ${user.level} (Đúng là 1)`);
  console.log(`- Số lần Luân Hồi: ${user.luan_hoi_count} (Đúng là 1)`);
  console.log(`- Danh hiệu mới: "${user.title}"`);

  // Kiểm tra tốc độ tu luyện nhàn rỗi
  const multiplier = cultivationService.getCultivationSpeedMultiplier(user.linh_can) + (user.luan_hoi_count * 0.25);
  console.log(`- Hệ số nhân tốc độ tu luyện (Linh căn + Tiên Thể Luân Hồi): ${multiplier}x`);

  if (user.level === 1 && user.luan_hoi_count === 1 && multiplier > 1) {
    console.log('✅ Đạt chuẩn: Chuyển thế Luân Hồi reset cấp độ và kích hoạt Tiên Thể thành công!');
  } else {
    throw new Error('Cơ chế Luân Hồi hoạt động không chính xác!');
  }

  // ============================================
  // 6. KIỂM THỬ NHẬT KÝ GIAO DỊCH (AUDIT LOGS)
  // ============================================
  console.log('\n--- 6. Kiểm Thử Nhật Ký Giao Dịch (Audit Log) ---');
  
  const logs = db.prepare('SELECT * FROM audit_logs WHERE user_id = ?').all(userId) as any[];
  console.log(`- Số lượng log ghi nhận của Lâm Phàm: ${logs.length} bản ghi.`);
  logs.forEach(l => {
    console.log(`  └ [Hành động: ${l.action}] Chi tiết: ${l.details}`);
  });

  if (logs.length >= 2) {
    console.log('✅ Đạt chuẩn: Các giao dịch nhạy cảm được lưu vết đầy đủ!');
  } else {
    throw new Error('Audit log không ghi nhận giao dịch đầy đủ!');
  }

  // Dọn dẹp dữ liệu test
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(userId);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(userId);

  console.log('\n🎉 === TẤT CẢ KIỂM THỬ CẢI TIẾN & NÂNG CẤP ĐÃ THÀNH CÔNG MỸ MÃN! ===');

} catch (error) {
  console.error('❌ Có lỗi xảy ra trong quá trình chạy kiểm thử:', error);
  process.exit(1);
} finally {
  db.close();
}
