import { coupleRepository, Couple } from '../database/repositories/CoupleRepository';
import { userRepository } from '../database/repositories/UserRepository';
import db from '../database/database';
import { ITEMS } from '../config/itemConstants';

class CoupleService {
  // Thực hiện song tu
  public dualCultivate(coupleId: number): { success: boolean; message: string } {
    const couple = coupleRepository.getCoupleById(coupleId);
    if (!couple) return { success: false, message: 'Đạo hữu chưa kết Đạo Lữ!' };

    const now = Math.floor(Date.now() / 1000);
    const ONE_DAY = 24 * 3600;

    if (now - couple.last_dual_cultivation < ONE_DAY) {
      const remain = ONE_DAY - (now - couple.last_dual_cultivation);
      const hours = Math.floor(remain / 3600);
      const mins = Math.floor((remain % 3600) / 60);
      return { success: false, message: `Hôm nay đã song tu rồi! Đợi thêm ${hours}h ${mins}m nữa.` };
    }

    const u1 = userRepository.get(couple.user1_id);
    const u2 = userRepository.get(couple.user2_id);
    if (!u1 || !u2) return { success: false, message: 'Lỗi không tìm thấy Đạo Lữ!' };

    // Tính lượng EXP nhận được: Dựa trên cấp độ cao nhất
    const maxLevel = Math.max(u1.level, u2.level);
    const expGain = maxLevel * 100 + Math.floor(couple.intimacy / 10); // Hảo cảm càng cao, tu vi càng nhiều

    const tx = db.transaction(() => {
      userRepository.update(u1.discord_id, { tu_vi: u1.tu_vi + expGain, intimacy: couple.intimacy + 10, last_songtu_at: now });
      userRepository.update(u2.discord_id, { tu_vi: u2.tu_vi + expGain, intimacy: couple.intimacy + 10, last_songtu_at: now });
      coupleRepository.updateLastDualCultivation(coupleId, now);
      coupleRepository.updateIntimacy(coupleId, 10); // Tăng 10 điểm hảo cảm sau mỗi lần song tu
    });
    tx();

    // Kiểm tra mốc kỷ niệm
    const anniversaryMsg = this.checkAnniversaryMilestones(couple);

    return {
      success: true,
      message: `💞 Vận hành [Âm Dương Giao Thái Quyết] thành công!\nCả hai nhận được **+${expGain} Tu Vi** và **+10 Hảo Cảm**.${anniversaryMsg ? `\n\n${anniversaryMsg}` : ''}`
    };
  }

  /**
   * Kiểm tra mốc kỷ niệm ngày cưới: 100, 200, 500 ngày
   */
  public checkAnniversaryMilestones(couple: Couple): string {
    const now = Math.floor(Date.now() / 1000);
    const daysTogether = Math.floor((now - couple.marriage_date) / 86400);

    const milestones = [
      { days: 100, reward: 500000, knb: 5, title: 'Trăm Ngày Hạnh Phúc', label: '💍 **100 Ngày Tơ Duyên**' },
      { days: 200, reward: 1000000, knb: 10, title: 'Đôi Hồn Gắn Kết', label: '💖 **200 Ngày Yêu Thương**' },
      { days: 500, reward: 3000000, knb: 30, title: 'Thiên Duyên Vĩnh Cửu', label: '🌟 **500 Ngày Thiên Địa Chứng Hôn**' },
    ];

    for (const ms of milestones) {
      if (daysTogether < ms.days) continue;

      // Kiểm tra xem đã nhận mốc này chưa (dùng y_canh của user1)
      const u1 = userRepository.get(couple.user1_id);
      const u2 = userRepository.get(couple.user2_id);
      if (!u1 || !u2) continue;

      let yCanh1: any = {};
      try { yCanh1 = JSON.parse(u1.y_canh || '{}'); } catch (e) { console.warn('[CoupleService] Failed to parse y_canh for user1 anniversary:', e); }
      const msKey = `anniversary_${ms.days}`;
      if (yCanh1[msKey]) continue; // Đã nhận rồi

      // Trao phần thưởng cho cả hai
      db.transaction(() => {
        const { inventoryRepository } = require('../database/repositories/InventoryRepository');
        const nowTs = Math.floor(Date.now() / 1000);

        // User 1
        userRepository.update(u1.discord_id, {
          coin_ha_pham: u1.coin_ha_pham + ms.reward,
          knb: u1.knb + ms.knb
        });
        inventoryRepository.addItem(u1.discord_id, ITEMS.PILL_ALCHEMY_TUVI, 5);
        db.prepare("INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, 'anniversary', ?)").run(u1.discord_id, ms.title, nowTs);

        // User 2
        userRepository.update(u2.discord_id, {
          coin_ha_pham: u2.coin_ha_pham + ms.reward,
          knb: u2.knb + ms.knb
        });
        inventoryRepository.addItem(u2.discord_id, ITEMS.PILL_ALCHEMY_TUVI, 5);
        db.prepare("INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, 'anniversary', ?)").run(u2.discord_id, ms.title, nowTs);

        // Đánh dấu đã nhận trong y_canh của cả hai
        yCanh1[msKey] = true;
        userRepository.update(u1.discord_id, { y_canh: JSON.stringify(yCanh1) });
        let yCanh2: any = {};
        try { yCanh2 = JSON.parse(u2.y_canh || '{}'); } catch (e) { console.warn('[CoupleService] Failed to parse y_canh for user2 anniversary:', e); }
        yCanh2[msKey] = true;
        userRepository.update(u2.discord_id, { y_canh: JSON.stringify(yCanh2) });
      })();

      return `🎊 ${ms.label}: Hai đạo hữu đã bên nhau **${ms.days} ngày**! Nhận phần thưởng đặc biệt: **${(ms.reward / 1000).toFixed(0)}k LT**, **+${ms.knb} KNB**, **5x Luyện Khí Đan** và danh hiệu **${ms.title}**! 🎊`;
    }

    return '';
  }

  // Kiểm tra mốc kỷ niệm từ thông tin Đạo Lữ (không cần song tu)
  public checkAnniversaryOnInfo(coupleId: number): string {
    const couple = coupleRepository.getCoupleById(coupleId);
    if (!couple) return '';
    return this.checkAnniversaryMilestones(couple);
  }

  // Tặng quà tăng hảo cảm
  public giveGift(coupleId: number, giftValue: number): { success: boolean; message: string } {
    const couple = coupleRepository.getCoupleById(coupleId);
    if (!couple) return { success: false, message: 'Đạo hữu chưa kết Đạo Lữ!' };

    coupleRepository.updateIntimacy(coupleId, giftValue);
    userRepository.update(couple.user1_id, { intimacy: couple.intimacy + giftValue });
    userRepository.update(couple.user2_id, { intimacy: couple.intimacy + giftValue });
    return { success: true, message: `🎁 Đã tặng quà thành công, tăng **+${giftValue} Hảo Cảm**!` };
  }
}

export const coupleService = new CoupleService();
