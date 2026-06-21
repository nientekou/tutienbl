import { initDatabase } from './database/database';
import { userRepository } from './database/repositories/UserRepository';
import { cultivationService } from './services/CultivationService';
import { achievementService } from './services/AchievementService';
import db from './database/database';

console.log('--- BẮT ĐẦU KIỂM THỬ SỬA LỖI THÀNH TỰU ---');

try {
  initDatabase();

  const testDiscordId = '999999999999999999';

  // 1. Dọn dẹp dữ liệu test cũ
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testDiscordId);
  db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(testDiscordId);
  db.prepare('DELETE FROM user_titles WHERE user_id = ?').run(testDiscordId);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(testDiscordId);

  // Tạo nhân vật test mới
  const testLinhCan = JSON.stringify({ 'Mộc': 100 });
  const tempStats = cultivationService.calculateStatsForLevel(1, testLinhCan);
  userRepository.create({
    discord_id: testDiscordId,
    name: 'Thần Ý Sư',
    base_hp: tempStats.hp,
    base_mp: tempStats.mp,
    base_atk: tempStats.atk,
    base_def: tempStats.def,
    base_crit: tempStats.crit,
    base_crit_res: tempStats.critRes,
    base_luck: tempStats.luck,
    linh_can: testLinhCan
  });

  const userBefore = userRepository.get(testDiscordId)!;
  console.log(`✅ Đã tạo nhân vật test: ${userBefore.name}, Coin: ${userBefore.coin_ha_pham}, Tu Vi: ${userBefore.tu_vi}`);

  // ==========================================
  // KIỂM THỬ 1: Lên cấp Ý Cảnh từ 0 tới 10
  // ==========================================
  console.log('\n--- KIỂM THỬ 1: Ngộ Ý Cảnh và Nhận Thành Tựu ---');

  // Đảm bảo đủ ngộ tính để ngộ ý cảnh liên tục
  userRepository.update(testDiscordId, { ngotinh: 100 });

  // Ta sẽ ép buộc random ý cảnh hoặc giả lập tăng ý cảnh bằng cách chỉnh sửa trực tiếp y_canh của user trong DB
  // Sau đó gọi awakenYCanh để nó đạt cấp 10
  const intents = { KiemY: 9, BatDietY: 0, HuyenQuyY: 0 };
  userRepository.update(testDiscordId, { y_canh: JSON.stringify(intents) });

  console.log('Đã cấu hình Kiếm Ý hiện tại: Cấp 9. Tiến hành Ngộ Ý Cảnh tiếp theo...');
  
  // Chúng ta sẽ chạy loop cho tới khi trúng Kiếm Ý để tăng lên 10
  let success = false;
  let attempts = 0;
  while (!success && attempts < 20) {
    attempts++;
    userRepository.update(testDiscordId, { ngotinh: 100 }); // Tiếp tế ngộ tính
    const res = cultivationService.awakenYCanh(testDiscordId);
    if (res.success && res.yCanhName === 'Kiếm Ý' && res.newLevel === 10) {
      console.log('🎉 Thăng cấp Kiếm Ý lên 10 thành công!');
      console.log(`Tin nhắn phản hồi:\n${res.message}`);
      success = true;

      // Xác minh trong DB xem thành tựu tl_15 đã được hoàn thành và có completed_at chưa
      const ua = db.prepare('SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(testDiscordId, 'tl_15') as any;
      console.log('Bản ghi thành tựu trong DB:', ua);
      if (ua && ua.is_completed === 1 && ua.completed_at !== null) {
        console.log('✅ Đạt thành tựu tl_15 thành công! Cột completed_at có giá trị:', ua.completed_at);
      } else {
        throw new Error('❌ Thất bại: Thành tựu tl_15 không được cập nhật đúng hoặc completed_at bị null!');
      }

      // Xác minh phần thưởng coin (tl_15 thưởng 50,000 hạ phẩm coin)
      const userAfter = userRepository.get(testDiscordId)!;
      console.log(`Linh Thạch sau khi đạt thành tựu: ${userAfter.coin_ha_pham} (Trước đó: 0, Trừ phí 5 ngộ tính, cộng 50,000 coin)`);
      if (userAfter.coin_ha_pham >= 50000) {
        console.log('✅ Nhận phần thưởng linh thạch thành công!');
      } else {
        throw new Error('❌ Thất bại: Không nhận được phần thưởng linh thạch!');
      }

      // Xác minh danh hiệu
      const titleExists = db.prepare('SELECT * FROM user_titles WHERE user_id = ? AND title = ?').get(testDiscordId, 'Kiếm Ý Đại Thành');
      if (titleExists) {
        console.log('✅ Nhận danh hiệu "Kiếm Ý Đại Thành" thành công!');
      } else {
        throw new Error('❌ Thất bại: Không nhận được danh hiệu!');
      }
    }
  }

  if (!success) {
    throw new Error('❌ Thất bại: Không roll trúng Kiếm Ý cấp 10 sau 20 lượt.');
  }

  // ==========================================
  // KIỂM THỬ 2: Tự sửa lỗi (Self-healing)
  // ==========================================
  console.log('\n--- KIỂM THỬ 2: Kiểm thử cơ chế tự sửa lỗi (Self-healing) ---');
  
  // Ta chèn thủ công một bản ghi thành tựu bị lỗi: is_completed = 1 nhưng completed_at = NULL
  db.prepare('DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?').run(testDiscordId, 'tl_16');
  db.prepare(`
    INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, completed_at)
    VALUES (?, 'tl_16', 10, 1, NULL)
  `).run(testDiscordId);

  // Đưa Bất Diệt Ý trong thông tin user về cấp 10
  const intents2 = { KiemY: 10, BatDietY: 10, HuyenQuyY: 0 };
  userRepository.update(testDiscordId, { y_canh: JSON.stringify(intents2), coin_ha_pham: 0 }); // Reset coin về 0

  console.log('Đã giả lập bản ghi tl_16 bị lỗi (completed_at = null, coin = 0). Gọi setProgress để kiểm tra tự sửa lỗi...');
  const healRes = achievementService.setProgress(testDiscordId, 'tl_16', 10);
  console.log('Thành tựu trả về sau khi heal:', healRes);

  if (healRes.length > 0 && healRes[0].id === 'tl_16') {
    console.log('✅ Trả về đúng thành tựu tl_16 đã được sửa lỗi!');
  } else {
    throw new Error('❌ Thất bại: Không trả về thành tựu được sửa lỗi!');
  }

  const uaHealed = db.prepare('SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(testDiscordId, 'tl_16') as any;
  console.log('Bản ghi sau khi heal:', uaHealed);
  if (uaHealed && uaHealed.completed_at !== null) {
    console.log('✅ Đã bổ sung completed_at thành công:', uaHealed.completed_at);
  } else {
    throw new Error('❌ Thất bại: completed_at vẫn bị null!');
  }

  const userAfterHeal = userRepository.get(testDiscordId)!;
  console.log(`Linh thạch sau khi heal: ${userAfterHeal.coin_ha_pham} (Yêu cầu phải cộng 50,000 coin)`);
  if (userAfterHeal.coin_ha_pham === 50000) {
    console.log('✅ Bù đắp phần thưởng linh thạch thành công!');
  } else {
    throw new Error('❌ Thất bại: Không nhận được phần thưởng linh thạch bù đắp!');
  }

  // ==========================================
  // KIỂM THỬ 3: Thông báo Thiền Định (Practice)
  // ==========================================
  console.log('\n--- KIỂM THỬ 3: Kiểm thử thông báo Thiền Định ---');
  
  // Dọn dẹp log cũ để đếm số lần thiền định
  db.prepare('DELETE FROM audit_logs WHERE user_id = ? AND action = ?').run(testDiscordId, 'practice');
  db.prepare('DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?').run(testDiscordId, 'tl_9');

  console.log('Giả lập chạy thiền định 10 lần...');
  for (let i = 0; i < 9; i++) {
    cultivationService.practice(testDiscordId);
  }

  // Lần thứ 10 sẽ đạt mốc thành tựu tl_9
  const practice10 = cultivationService.practice(testDiscordId);
  console.log(`Tin nhắn thiền định lần thứ 10:\n${practice10.message}`);

  if (practice10.message.includes('🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**') && practice10.message.includes('Thiền Định Sơ Cấp')) {
    console.log('✅ Thông báo thiền định hiển thị đúng block phần thưởng thành tựu!');
  } else {
    throw new Error('❌ Thất bại: Không có block thông báo thành tựu rõ ràng!');
  }

  console.log('\n🎉 --- TẤT CẢ KIỂM THỬ THÀNH TỰU ĐÃ THÀNH CÔNG RỰC RỠ! ---');

} catch (error) {
  console.error('❌ Lỗi trong quá trình kiểm thử:', error);
  process.exit(1);
}
