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

  // === P2-05: Couple Dungeon ===

  /**
   * P2-05: Lấy thông tin couple dungeon cho 1 user
   */
  public getCoupleDungeonInfo(userId: string): { coupleId: number; dailyRuns: number; bestFloor: number; currentFloor: number } | null {
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (!couple) return null;

    const today = new Date().toISOString().slice(0, 10);
    let dungeonRow = db.prepare('SELECT * FROM couple_dungeons WHERE couple_id = ? AND user_id = ?').get(couple.id, userId) as any;

    if (!dungeonRow) {
      db.prepare('INSERT INTO couple_dungeons (couple_id, user_id, current_floor, daily_runs, last_run_date, best_floor) VALUES (?, ?, 1, 0, ?, 0)').run(couple.id, userId, today);
      dungeonRow = db.prepare('SELECT * FROM couple_dungeons WHERE couple_id = ? AND user_id = ?').get(couple.id, userId) as any;
    }

    // Reset daily runs if new day
    if (dungeonRow.last_run_date !== today) {
      db.prepare('UPDATE couple_dungeons SET daily_runs = 0, current_floor = 1, last_run_date = ? WHERE couple_id = ? AND user_id = ?').run(today, couple.id, userId);
      dungeonRow.daily_runs = 0;
      dungeonRow.current_floor = 1;
    }

    return {
      coupleId: couple.id,
      dailyRuns: dungeonRow.daily_runs,
      bestFloor: dungeonRow.best_floor,
      currentFloor: dungeonRow.current_floor
    };
  }

  /**
   * P2-05: Vào đôi bí cảnh (daily limit 2)
   */
  public enterCoupleDungeon(userId: string): { success: boolean; message: string } {
    const info = this.getCoupleDungeonInfo(userId);
    if (!info) return { success: false, message: 'Đạo hữu chưa có Đạo Lữ!' };

    if (info.dailyRuns >= 2) {
      return { success: false, message: 'Đã hết lượt Đôi Bí Cảnh hôm nay (2/2).' };
    }

    db.prepare('UPDATE couple_dungeons SET daily_runs = daily_runs + 1 WHERE couple_id = ? AND user_id = ?').run(info.coupleId, userId);

    const floor = info.currentFloor;
    let rewardMsg = '';

    if (floor <= 3) {
      // Simple floor rewards
      const expReward = 500 * floor;
      const intimacyReward = 5 * floor;

      // Add rewards to both partners
      const couple = coupleRepository.getCoupleById(info.coupleId);
      if (couple) {
        userRepository.update(couple.user1_id, { tu_vi: Math.min((db.prepare('SELECT tu_vi FROM users WHERE discord_id = ?').get(couple.user1_id) as any).tu_vi + expReward, (db.prepare('SELECT exp_needed FROM users WHERE discord_id = ?').get(couple.user1_id) as any).exp_needed) });
        userRepository.update(couple.user2_id, { tu_vi: Math.min((db.prepare('SELECT tu_vi FROM users WHERE discord_id = ?').get(couple.user2_id) as any).tu_vi + expReward, (db.prepare('SELECT exp_needed FROM users WHERE discord_id = ?').get(couple.user2_id) as any).exp_needed) });
        coupleRepository.updateIntimacy(info.coupleId, intimacyReward);
      }

      const newBest = Math.max(info.bestFloor, floor);
      db.prepare('UPDATE couple_dungeons SET current_floor = current_floor + 1, best_floor = ? WHERE couple_id = ? AND user_id = ?').run(newBest, info.coupleId, userId);

      rewardMsg = `+${expReward} Tu Vi | +${intimacyReward} Hảo Cảm`;
    }

    return {
      success: true,
      message: `💕 **Đôi Bí Cảnh Tầng ${floor}** — Hoàn thành!\n${rewardMsg}\n👉 Tầng tiếp theo: **Tầng ${floor + 1}**`
    };
  }

  /**
   * P2-05: Xem thông tin Đôi Bí Cảnh
   */
  public getCoupleDungeonDescription(userId: string): string {
    const info = this.getCoupleDungeonInfo(userId);
    if (!info) return '❌ Đạo hữu chưa có Đạo Lữ để vào Đôi Bí Cảnh!';

    return `💕 **Đôi Bí Cảnh**\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 Tầng hiện tại: **${info.currentFloor}**\n` +
      `🏆 Tầng cao nhất: **${info.bestFloor}**\n` +
      `⚡ Lượt hôm nay: **${info.dailyRuns}/2**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Dùng \`/doibicanh vao\` để vào Đôi Bí Cảnh.*`;
  }

  // === W9-08: Enhanced Couple System ===

  /**
   * W9-08: Intimacy decay — -1% per day if no interaction
   */
  public applyIntimacyDecay(): void {
    try {
      const couples = db.prepare('SELECT * FROM couples').all() as any[];
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;

      for (const couple of couples) {
        // Check if any interaction in last 24h
        const lastInteraction = db.prepare(`
          SELECT MAX(last_dual_cultivation) as last FROM couples WHERE id = ?
        `).get(couple.id) as any;

        if (lastInteraction && lastInteraction.last < oneDayAgo) {
          const decay = Math.max(0, Math.floor(couple.intimacy * 0.01)); // -1%
          if (decay > 0) {
            db.prepare('UPDATE couples SET intimacy = MAX(0, intimacy - ?) WHERE id = ?')
              .run(decay, couple.id);
          }
        }
      }
    } catch (e) {
      console.error('[CoupleService] Intimacy decay error:', e);
    }
  }

  /**
   * W9-08: Get couple achievements
   */
  public getCoupleAchievements(userId: string): string[] {
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (!couple) return [];

    const achievements: string[] = [];

    // Milestones
    if (couple.intimacy >= 100) achievements.push('💕 **Thân mật 100** — Đôi tình nhân');
    if (couple.intimacy >= 500) achievements.push('💖 **Thân mật 500** — Đôi vợ chồng son');
    if (couple.intimacy >= 1000) achievements.push('❤️‍🔥 **Thân mật 1000** — Đôi ngọctypeorm');
    if (couple.intimacy >= 5000) achievements.push('💕 **Thân mật 5000** — Đôi thiên nhiên');

    // Anniversary
    const daysTogether = Math.floor((Date.now() / 1000 - couple.marriage_date) / 86400);
    if (daysTogether >= 30) achievements.push(`📅 **30 ngày** — Kỷ niệm 1 tháng`);
    if (daysTogether >= 100) achievements.push(`📅 **100 ngày** — Kỷ niệm 100 ngày`);
    if (daysTogether >= 365) achievements.push(`📅 **365 ngày** — Kỷ niệm 1 năm`);

    // Dungeon
    try {
      const dungeonInfo = db.prepare('SELECT MAX(best_floor) as best FROM couple_dungeons WHERE couple_id = ?')
        .get(couple.id) as any;
      if (dungeonInfo && dungeonInfo.best >= 3) achievements.push('🏯 **Đôi Bí Cảnh** — Vượt qua 3 tầng');
    } catch {}

    return achievements;
  }

  /**
   * W9-08: Enhanced anniversary milestones (50, 100, 200, 365 days)
   */
  public checkAnniversaryMilestonesV2(userId: string): string {
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (!couple) return '';

    const daysTogether = Math.floor((Date.now() / 1000 - couple.marriage_date) / 86400);
    const milestones = [50, 100, 200, 365];
    let msg = '';

    for (const m of milestones) {
      if (daysTogether >= m) {
        const claimedKey = `anniversary_${m}`;
        try {
          const user = userRepository.get(userId);
          if (!user) continue;
          const yCanh = JSON.parse(user.y_canh || '{}');
          if (!yCanh[claimedKey]) {
            // Award milestone
            const rewards: Record<number, { coins: number; knb: number; title: string }> = {
              50: { coins: 500000, knb: 5, title: `Kỷ niệm ${m} ngày` },
              100: { coins: 1000000, knb: 10, title: `Tình sâu ${m} ngày` },
              200: { coins: 2000000, knb: 20, title: `Vĩnh Hằng ${m} ngày` },
              365: { coins: 5000000, knb: 50, title: `Tình Yêu Bất Diệt` },
            };
            const reward = rewards[m];
            yCanh[claimedKey] = 1;
            userRepository.update(userId, {
              y_canh: JSON.stringify(yCanh),
              coin_ha_pham: user.coin_ha_pham + reward.coins,
              knb: user.knb + reward.knb
            });
            msg += `🎉 **Kỷ niệm ${m} ngày!** +${reward.coins.toLocaleString()} LT, +${reward.knb} KNB, Danh hiệu "${reward.title}"\n`;
          }
        } catch {}
      }
    }

    return msg;
  }

  // === B-03: Marriage Enhancement — Joint Skills & Couple Quests ===

  /**
   * B-03: Use joint skill (dual cultivation bonus)
   */
  useJointSkill(userId: string, skillType: string): { success: boolean; message: string } {
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (!couple) return { success: false, message: '❌ Chưa có Đạo Lữ!' };

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Chưa tạo nhân vật!' };

    const JOINT_SKILLS: Record<string, { name: string; cost: number; effect: string; value: number }> = {
      dual_cultivation: { name: 'Song Tu', cost: 0, effect: 'exp_bonus', value: 0.30 },
      combined_attack: { name: 'Hợp Kích', cost: 50, effect: 'damage', value: 2.0 },
      healing_bond: { name: 'Tình Duyên Trị Liệu', cost: 30, effect: 'heal', value: 0.15 },
    };

    const skill = JOINT_SKILLS[skillType];
    if (!skill) return { success: false, message: '❌ Kỹ năng không tồn tại!' };

    if (user.stamina < skill.cost) {
      return { success: false, message: `❌ Không đủ Thể Lực! (Cần ${skill.cost})` };
    }

    if (skill.cost > 0) {
      userRepository.update(userId, { stamina: user.stamina - skill.cost });
    }

    return {
      success: true,
      message: `💕 **${skill.name}** — Kích hoạt thành công!\n${skill.effect}: +${Math.round(skill.value * 100)}%`
    };
  }

  /**
   * B-03: Get couple quests
   */
  getCoupleQuests(userId: string): { id: string; name: string; description: string; progress: number; target: number; reward: string }[] {
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (!couple) return [];

    // Simple quest tracking based on intimacy milestones
    const quests = [
      { id: 'cq_intimacy_100', name: 'Tình Đầu', description: 'Đạt 100 thân mật', target: 100, reward: '500 LT + 5 KNB' },
      { id: 'cq_intimacy_500', name: 'Tình Sâu', description: 'Đạt 500 thân mật', target: 500, reward: '2000 LT + 20 KNB' },
      { id: 'cq_intimacy_1000', name: 'Tình Vĩnh Cửu', description: 'Đạt 1000 thân mật', target: 1000, reward: '5000 LT + 50 KNB' },
      { id: 'cq_days_30', name: 'Kỷ Niệm 30 Ngày', description: 'Cùng nhau 30 ngày', target: 30, reward: '1000 LT + 10 KNB' },
      { id: 'cq_days_100', name: 'Tình Yêu 100 Ngày', description: 'Cùng nhau 100 ngày', target: 100, reward: '5000 LT + 50 KNB' },
    ];

    const daysTogether = Math.floor((Date.now() / 1000 - couple.marriage_date) / 86400);

    return quests.map(q => ({
      ...q,
      progress: q.id.includes('intimacy') ? couple.intimacy : daysTogether,
    }));
  }

  /**
   * B-03: Get joint skill description
   */
  getJointSkillsDescription(): string {
    return `💕 **Kỹ Năng Đôi:**\n\n` +
      `🧘 **Song Tu** — +30% EXP cho cả 2 (0 TL)\n` +
      `⚔️ **Hợp Kích** — +100% damage 1 đòn (50 TL)\n` +
      `💚 **Tình Duyên Trị Liệu** — Hồi 15% HP cho partner (30 TL)\n\n` +
      `*Dùng lệnh couple để kích hoạt*`;
  }
}

export const coupleService = new CoupleService();
