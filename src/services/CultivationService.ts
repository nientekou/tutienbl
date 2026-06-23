import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import { ITEMS } from '../config/itemConstants';
import { getRealmDetails } from '../utils/constants';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { eventService } from './EventService';
import { achievementService } from './AchievementService';
import { leylineService } from './LeylineService';
import db from '../database/database';

export class CultivationService {
  /**
   * Tạo ngẫu nhiên Linh Căn cho nhân vật mới hoặc khi Tẩy Tủy
   * Tỷ lệ số lượng hệ:
   * - 1 hệ (Đơn): 5%
   * - 2 hệ (Song): 15%
   * - 3 hệ (Tam): 30%
   * - 4 hệ (Tứ): 35%
   * - 5 hệ (Ngũ): 15%
   */
  public generateLinhCan(): string {
    const rand = Math.random() * 100;
    let elementCount = 3;

    if (rand < 5) elementCount = 1;
    else if (rand < 20) elementCount = 2;
    else if (rand < 50) elementCount = 3;
    else if (rand < 85) elementCount = 4;
    else elementCount = 5;

    const basicElements = ['Hỏa', 'Thủy', 'Mộc', 'Thổ'];
    const mutantElements = ['Lôi', 'Phong'];
    const selectedElements: string[] = [];

    // Chọn các hệ linh căn
    for (let i = 0; i < elementCount; i++) {
      // 15% tỷ lệ xuất hiện hệ dị biến (Lôi, Phong)
      if (Math.random() < 0.15 && mutantElements.length > 0) {
        const idx = Math.floor(Math.random() * mutantElements.length);
        selectedElements.push(mutantElements[idx]);
        mutantElements.splice(idx, 1);
      } else if (basicElements.length > 0) {
        const idx = Math.floor(Math.random() * basicElements.length);
        selectedElements.push(basicElements[idx]);
        basicElements.splice(idx, 1);
      } else if (mutantElements.length > 0) {
        // Fallback phòng trường hợp hết hệ cơ bản
        const idx = Math.floor(Math.random() * mutantElements.length);
        selectedElements.push(mutantElements[idx]);
        mutantElements.splice(idx, 1);
      }
    }

    // Phân bổ phần trăm linh căn sao cho tổng = 100
    const percentages: number[] = [];
    if (elementCount === 1) {
      percentages.push(100);
    } else if (elementCount === 2) {
      percentages.push(50, 50);
    } else {
      const cuts: number[] = [];
      for (let i = 0; i < elementCount - 1; i++) {
        cuts.push(Math.floor(Math.random() * 98) + 1); // Cắt ngẫu nhiên từ 1 - 99
      }
      cuts.sort((a, b) => a - b);

      let prev = 0;
      for (const cut of cuts) {
        percentages.push(cut - prev);
        prev = cut;
      }
      percentages.push(100 - prev);
    }

    // Ghép kết quả thành JSON
    const linhCan: Record<string, number> = {};
    for (let i = 0; i < elementCount; i++) {
      linhCan[selectedElements[i]] = percentages[i];
    }

    return JSON.stringify(linhCan);
  }

  /**
   * Tính toán lượng EXP (Tu Vi) cần thiết để lên cấp/tầng tiếp theo
   */
  public calculateNextExp(level: number): number {
    const base = Math.round(100 * Math.pow(level, 2.2));
    if (level >= 100) {
      return Math.round(base * 0.7);
    }
    return base;
  }

  public getExpMultiplierForSource(playerLevel: number, sourceLevel: number): number {
    const diff = playerLevel - sourceLevel;
    if (diff >= 50) return 0.1;
    if (diff >= 30) return 0.3;
    if (diff >= 15) return 0.5;
    if (diff >= 5) return 0.8;
    return 1.0;
  }

  /**
   * Tính toán các chỉ số chiến đấu cơ bản dựa trên Level và Linh Căn
   */
  public calculateStatsForLevel(level: number, linhCanJson: string, alignment: string = 'neutral') {
    const { majorIndex } = getRealmDetails(level);
    // Mỗi Đại Cảnh Giới (majorIndex) sẽ cung cấp một lượng chỉ số đột phá
    // Hệ số nhân cấp độ cảnh giới: 1.0 (Luyện Khí) -> 1.5 (Trúc Cơ) -> 2.25 -> ...
    const realmMultiplier = Math.pow(1.5, majorIndex);

    // Chỉ số thô tăng theo cấp độ và nhân với cảnh giới
    let hp = Math.floor((100 + (level - 1) * 20) * realmMultiplier);
    let mp = Math.floor((50 + (level - 1) * 10) * realmMultiplier);
    let atk = Math.floor((15 + (level - 1) * 4) * realmMultiplier);
    let def = Math.floor((10 + (level - 1) * 3) * realmMultiplier);
    let crit = 0.05 + (majorIndex * 0.01); // 5% base + 1% mỗi cảnh giới
    let critRes = 0.0 + (majorIndex * 0.005);
    const luck = 10; // May mắn cố định thô
    let speed = 100;

    // Cộng hưởng từ Linh Căn
    try {
      const linhCan: Record<string, number> = JSON.parse(linhCanJson);
      for (const [element, percentage] of Object.entries(linhCan)) {
        const ratio = percentage / 100;
        switch (element) {
          case 'Lôi':
            atk += Math.round(atk * 0.20 * ratio); // 100% Lôi tăng 20% công
            speed += Math.round(20 * ratio);        // 100% Lôi tăng 20 tốc độ
            break;
          case 'Hỏa':
            atk += Math.round(atk * 0.10 * ratio); // 100% Hỏa tăng 10% công
            crit += 0.10 * ratio;                 // 100% Hỏa tăng 10% bạo kích
            break;
          case 'Phong':
            crit += 0.15 * ratio;                 // 100% Phong tăng 15% bạo kích
            break;
          case 'Thủy':
            mp += Math.round(mp * 0.25 * ratio);   // 100% Thủy tăng 25% linh lực
            break;
          case 'Mộc':
            hp += Math.round(hp * 0.15 * ratio);   // 100% Mộc tăng 15% sinh lực
            mp += Math.round(mp * 0.10 * ratio);   // 100% Mộc tăng 10% linh lực
            break;
          case 'Thổ':
            def += Math.round(def * 0.20 * ratio); // 100% Thổ tăng 20% thủ
            critRes += 0.10 * ratio;              // 100% Thổ tăng 10% kháng bạo
            break;
        }
      }
    } catch (e) {
      // Bỏ qua lỗi JSON
    }

    // Hiệu ứng Đạo Thống (Alignment)
    if (alignment === 'orthodox') {
      def = Math.round(def * 1.10); // +10% DEF
    } else if (alignment === 'demonic') {
      atk = Math.round(atk * 1.10); // +10% ATK
      crit += 0.05;                 // +5% Crit
    }

    return {
      hp,
      mp,
      atk,
      def,
      crit: parseFloat(crit.toFixed(3)),
      critRes: parseFloat(critRes.toFixed(3)),
      luck,
      speed
    };
  }

  /**
   * Tính toán tốc độ tu luyện dựa trên Linh Căn (Đơn/Song linh căn tu luyện nhanh hơn)
   */
  public getCultivationSpeedMultiplier(linhCanJson: string): number {
    try {
      const data = Object.keys(JSON.parse(linhCanJson)).length;
      if (data === 1) return 1.5;  // Đơn Linh Căn: 1.5x
      if (data === 2) return 1.25; // Song Linh Căn: 1.25x
      if (data === 3) return 1.1;  // Tam Linh Căn: 1.1x
      if (data === 4) return 1.0;  // Tứ Linh Căn: 1.0x
      return 0.9;                  // Ngũ Linh Căn: 0.9x
    } catch (e) {
      return 1.0;
    }
  }

  /**
   * Tính toán và nhận tu vi tích lũy nhàn rỗi (Idle Cultivation)
   */
  public claimIdleCultivation(discordId: string): { gained: number; message: string; user: UserEntity } | null {
    const user = userRepository.get(discordId);
    if (!user) return null;

    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - user.updated_at;

    // Yêu cầu tối thiểu 10 giây để nhận linh khí nhàn rỗi
    if (diffSeconds < 10) {
      return { gained: 0, message: '', user };
    }

    const { minorLevel } = getRealmDetails(user.level);
    
    // Nếu tu sĩ đã đạt cực hạn (tu vi đầy) -> không thể tích lũy thêm tu vi idle
    if (user.tu_vi >= user.exp_needed) {
      // Cập nhật lại updated_at để tránh tích lũy dồn ép
      userRepository.update(discordId, { updated_at: now });
      const limitMsg = minorLevel === 38
        ? 'Tu vi của đạo hữu đã đạt cực hạn cảnh giới lớn. Cần **Đột Phá** để tiếp tục tích lũy Linh khí nhàn rỗi!'
        : `Tu vi của đạo hữu đã đạt cực hạn tầng ${minorLevel}. Cần thực hiện lệnh \`/dotpha\` để tiếp tục tích lũy Linh khí nhàn rỗi!`;
      return { gained: 0, message: limitMsg, user: userRepository.get(discordId)! };
    }

    // Tốc độ tích lũy: base speed tăng theo cấp độ (ví dụ: 0.05 + level * 0.01 tu vi/giây)
    const baseSpeed = 0.05 + user.level * 0.01;
    let sectLinhTratBonus = 0.0;
    if (user.sect_id) {
      try {
        const sect = db.prepare('SELECT tu_linh_level FROM sects WHERE id = ?').get(user.sect_id) as { tu_linh_level: number } | undefined;
        if (sect && sect.tu_linh_level) {
          sectLinhTratBonus = sect.tu_linh_level * 0.05; // +5% mỗi cấp
        }
      } catch (e) { console.warn('[CultivationService] Failed to fetch sect tu_linh_level:', e); }
    }
    const { caveService } = require('./CaveService');
    let caveExpBuff = 0.0;
    try {
      const cave = caveService.getCave(discordId);
      const springLvl = cave.spring_level || 1;
      caveExpBuff = springLvl * 0.02;
    } catch (e) { console.warn('[CultivationService] Failed to fetch cave spring level:', e); }

    const speedMultiplier = this.getCultivationSpeedMultiplier(user.linh_can) + (user.luan_hoi_count * 0.25) + sectLinhTratBonus + caveExpBuff;
    
    // Leyline Buff Tu Luyện (+20% EXP)
    let leylineExpBuff = leylineService.isBuffActive('tuluyen') ? 1.2 : 1.0;
    
    // Tương tác Động Phủ: Nếu có Động Phủ và Leyline Tu Luyện đang bật -> Động Phủ x1.5 thay vì buff chung 1.2
    let isCaveMultiplier = false;
    try {
      const { caveService } = require('./CaveService');
      const cave = caveService.getCave(discordId);
      if (cave && cave.level >= 1 && leylineExpBuff > 1.0) {
        leylineExpBuff = 1.5;
        isCaveMultiplier = true;
      }
    } catch (e) { console.warn('[CultivationService] Failed to check cave-leyline interaction:', e); }

    // Double EXP Weekend: x2 Tu Vi nhàn rỗi
    const eventMultiplier = eventService.isDoubleExpActive() ? 2 : 1;

    let heartLawExpBuff = 1.0;
    try {
      const { heartLawService } = require('./HeartLawService');
      const activePassives = heartLawService.getActivePassives(discordId);
      const expBoostHL = activePassives.find((hl: any) => hl.type === 'exp_boost');
      if (expBoostHL) {
        heartLawExpBuff += expBoostHL.value;
      }
    } catch (e) { console.warn('[CultivationService] Failed to get heart law exp boost:', e); }

    // Hiệu ứng Đạo Thống (Alignment) & Tẩu Hỏa Nhập Ma
    let alignmentSpeedMultiplier = 1.0;
    if (user.alignment === 'demonic') {
      alignmentSpeedMultiplier = 1.15; // Ma Đạo: x1.15 cultivation speed
    }

    let isQiDeviated = false;
    if (user.qi_deviation_until && user.qi_deviation_until > now) {
      alignmentSpeedMultiplier *= 0.5; // Giảm 50% hiệu suất
      isQiDeviated = true;
    }

    // Hồi phục offline có decay: >6h (21600s) hiệu suất giảm 50%
    // Kiểm tra Nhàn Tu Đan buff
    let idleNoDecay = false;
    try {
      const yCanhData = JSON.parse(user.y_canh || '{}');
      if (yCanhData.idle_no_decay_until && yCanhData.idle_no_decay_until > now) {
        idleNoDecay = true;
      }
    } catch (e) { console.warn('[CultivationService] Failed to parse y_canh for idle_no_decay:', e); }

    const normalSeconds = idleNoDecay ? diffSeconds : Math.min(diffSeconds, 21600);
    const decaySeconds = idleNoDecay ? 0 : Math.max(0, diffSeconds - 21600);

    const normalGained = normalSeconds * baseSpeed * speedMultiplier * leylineExpBuff * eventMultiplier * heartLawExpBuff * alignmentSpeedMultiplier;
    const decayGained = decaySeconds * baseSpeed * speedMultiplier * leylineExpBuff * eventMultiplier * heartLawExpBuff * 0.4 * alignmentSpeedMultiplier;
    const idleGained = Math.floor(normalGained + decayGained);

    if (idleGained <= 0) {
      return { gained: 0, message: '', user };
    }

    const cappedNewTuVi = Math.min(user.tu_vi + idleGained, user.exp_needed);
    const actualGained = cappedNewTuVi - user.tu_vi;

    // Cập nhật tu vi và updated_at
    userRepository.update(discordId, {
      tu_vi: cappedNewTuVi,
      updated_at: now
    });

    const updatedUser = userRepository.get(discordId)!;

    let message = '';
    if (actualGained > 0) {
      let decayNote = diffSeconds > 21600 && !idleNoDecay ? ' *(Hiệu suất thiền định giảm 50% sau 6 giờ ngoại tuyến)*' : '';
      if (idleNoDecay) {
        decayNote = ' *(Nhàn Tu Đan: không giảm hiệu suất ngoại tuyến)*';
      }
      if (isQiDeviated) {
        decayNote += ' ⚠️ *(Hiệu suất tu luyện giảm 50% do đang bị Tẩu Hỏa Nhập Ma)*';
      }
      message = `🧘 **Nhàn Rỗi:** Trong lúc đạo hữu ngoại tuyến, cơ thể tự động vận hành đại chu thiên hấp thu linh khí, tích lũy thêm **+${actualGained}** Tu Vi!${decayNote}`;
    }

    return {
      gained: actualGained,
      message,
      user: updatedUser
    };
  }

  /**
   * Thực hiện Tu Luyện tích lũy tu vi
   */
  public practice(discordId: string): { success: boolean; message: string; gained?: number; user?: UserEntity } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (user.qi_deviation_until && user.qi_deviation_until > now) {
      const remaining = user.qi_deviation_until - now;
      const minutes = Math.ceil(remaining / 60);
      return {
        success: false,
        message: `❌ **TẨU HỎA NHẬP MA!** Đạo tâm của đạo hữu đang hỗn loạn, kinh mạch điên đảo. Không thể thiền định chủ động trong **${minutes} phút** nữa!`
      };
    }

    // Giới hạn không cho tích lũy tu vi quá mức khi chưa đột phá cảnh giới lớn/tầng nhỏ
    if (user.tu_vi >= user.exp_needed) {
      return { 
        success: false, 
        message: 'Tu vi của đạo hữu đã đạt tới **Cực Hạn Đại Viên Mãn** của cảnh giới hiện tại. Cần thực hiện lệnh \`/dotpha\` để tiếp tục tu hành!' 
      };
    }

    // Tính toán lượng tu vi nhận được
    let sectLinhTratBonus = 0.0;
    if (user.sect_id) {
      try {
        const sect = db.prepare('SELECT tu_linh_level FROM sects WHERE id = ?').get(user.sect_id) as { tu_linh_level: number } | undefined;
        if (sect && sect.tu_linh_level) {
          sectLinhTratBonus = sect.tu_linh_level * 0.05; // +5% mỗi cấp
        }
      } catch (e) { console.warn('[CultivationService] Failed to fetch sect tu_linh_level:', e); }
    }
    const { caveService } = require('./CaveService');
    let caveExpBuff = 0.0;
    try {
      const cave = caveService.getCave(discordId);
      if (cave.level === 2) caveExpBuff = 0.02;
      if (cave.level === 3) caveExpBuff = 0.04;
      if (cave.level === 4) caveExpBuff = 0.06;
      if (cave.level >= 5) caveExpBuff = 0.10;
    } catch(e) { console.warn('[CultivationService] Failed to fetch cave level for practice buff:', e); }

    const speedMultiplier = this.getCultivationSpeedMultiplier(user.linh_can) + (user.luan_hoi_count * 0.25) + sectLinhTratBonus + caveExpBuff;
    
    // Leyline Buff Tu Luyện (+20% EXP)
    let leylineExpBuff = leylineService.isBuffActive('tuluyen') ? 1.2 : 1.0;

    // Double EXP Weekend: x2 Tu Vi từ thiền định
    const eventMultiplier = eventService.isDoubleExpActive() ? 2 : 1;
    const baseGained = Math.floor(Math.random() * 16) + 10; // 10 -> 25

    let heartLawExpBuff = 1.0;
    try {
      const { heartLawService } = require('./HeartLawService');
      const activePassives = heartLawService.getActivePassives(discordId);
      const expBoostHL = activePassives.find((hl: any) => hl.type === 'exp_boost');
      if (expBoostHL) {
        heartLawExpBuff += expBoostHL.value;
      }
    } catch (e) { console.warn('[CultivationService] Failed to get heart law exp boost:', e); }

    let alignmentSpeedMultiplier = 1.0;
    if (user.alignment === 'demonic') {
      alignmentSpeedMultiplier = 1.15; // Ma Đạo: x1.15 cultivation speed
    }

    const gained = Math.round(baseGained * speedMultiplier * leylineExpBuff * eventMultiplier * heartLawExpBuff * alignmentSpeedMultiplier);

    // Tỷ lệ tẩu hỏa nhập ma
    let deviationChance = 0.03;
    if (user.alignment === 'demonic') deviationChance += 0.02;
    if (user.stamina < 100) deviationChance += 0.02;

    if (Math.random() < deviationChance) {
      const deviationEndTime = now + 900; // 15 phút
      userRepository.update(discordId, { qi_deviation_until: deviationEndTime });
      
      // Ghi log tẩu hỏa nhập ma
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'qi_deviation', ?, ?)"
      ).run(discordId, JSON.stringify({ reason: 'practice' }), now);

      return {
        success: false,
        message: `❌ **TẨU HỎA NHẬP MA!** Trong lúc đạo hữu đang vận hành linh khí chu thiên, một luồng ma niệm bất chợt xâm lấn thần trí, kinh mạch điên đảo, linh lực bạo tẩu! Đạo hữu bị rơi vào trạng thái Tẩu Hỏa Nhập Ma trong **15 phút** (hiệu suất tu luyện nhàn rỗi giảm 50% và không thể thiền định chủ động trong thời gian này)!`
      };
    }

    const newTuVi = Math.min(user.tu_vi + gained, user.exp_needed); // Không vượt quá exp_needed ở tầng 38
    
    // Cập nhật Database
    let ngoTinhGained = 0;
    let extraMsg = '';
    if (Math.random() < 0.15) {
      ngoTinhGained = 1;
      userRepository.update(discordId, { 
        tu_vi: newTuVi,
        ngotinh: user.ngotinh + 1
      });
      extraMsg = '\n✨ Đạo hữu trong lúc thiền định bỗng nhiên có sở ngộ, nhận được **+1 Điểm Ngộ Tính**!';
    } else {
      userRepository.update(discordId, { tu_vi: newTuVi });
    }
    const updatedUser = userRepository.get(discordId)!;

    // Ghi log để đếm số lần thiền định cho thành tựu
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'practice', ?, ?)"
    ).run(discordId, JSON.stringify({ gained }), Math.floor(Date.now() / 1000));
    const totalPractice = db.prepare(
      "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'practice'"
    ).get(discordId) as { c: number };
    const newlyUnlocked: any[] = [];
    newlyUnlocked.push(...achievementService.setProgress(discordId, 'tl_9', totalPractice.c));
    newlyUnlocked.push(...achievementService.setProgress(discordId, 'tl_10', totalPractice.c));
    newlyUnlocked.push(...achievementService.setProgress(discordId, 'tl_11', totalPractice.c));

    let achieveText = '';
    if (newlyUnlocked.length > 0) {
      const detailText = newlyUnlocked.map(a => {
        const rewardDetails: string[] = [];
        if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi 🌿`);
        if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} Linh Thạch 🟤`);
        if (a.reward_title) rewardDetails.push(`Danh hiệu: [${a.reward_title}] 🏆`);
        return `🏆 **Hoàn thành Thành Tựu:** **${a.name}**\n  └ *Phần thưởng:* ${rewardDetails.join(', ')}`;
      }).join('\n\n');
      achieveText = `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**\n${detailText}`;
    }

    return {
      success: true,
      message: `Đạo hữu nhập định thiền định, hấp thu linh khí đất trời, tích lũy thêm **+${gained}** Tu Vi!${extraMsg}${achieveText}`,
      gained,
      user: updatedUser
    };
  }

  /**
   * Thực hiện đột phá cảnh giới (Thăng cấp)
   */
  public breakthrough(discordId: string, usePill: string | boolean = false, forceSuccess: boolean = false, qiDeviationDisturbance: boolean = false): { success: boolean; isMajor: boolean; message: string; rolled?: number; rate?: number; user?: UserEntity } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, isMajor: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!' };
    }

    if (user.tu_vi < user.exp_needed) {
      return { 
        success: false, 
        isMajor: false, 
        message: `Tu vi chưa đủ tích lũy để đột phá! (Cần **${user.tu_vi}/${user.exp_needed}** Tu Vi)` 
      };
    }

    const { minorLevel, fullName, majorIndex } = getRealmDetails(user.level);
    const isMajor = minorLevel === 38; // Là đột phá Cảnh Giới lớn (ví dụ Luyện Khí sang Trúc Cơ)

    if (!isMajor) {
      // Đột phá tầng nhỏ (Minor) -> Tính toán tỷ lệ thành công
      const baseRate = Math.max(65 - majorIndex * 12, 8);
      const luckBonus = user.base_luck * 0.002; // Mỗi điểm may mắn +0.2% tỷ lệ
      
      let pillBonus = 0;
      let usedPillName = '';

      if (typeof usePill === 'string' && usePill === 'bequan') {
        let cost = user.level * 200;
        if (user.alignment === 'orthodox') {
          cost = Math.round(cost * 0.90); // Giảm 10% phí Bế Quan cho Chính Đạo
        }
        if (user.coin_ha_pham < cost) {
          return {
            success: false,
            isMajor: false,
            message: `❌ Đạo hữu không đủ Linh Thạch để Bế Quan Đột Phá! (Yêu cầu **${cost}** Hạ Phẩm Linh Thạch. Hiện có: **${user.coin_ha_pham}**)`
          };
        }
        userRepository.update(discordId, { coin_ha_pham: user.coin_ha_pham - cost });
        forceSuccess = true;
        usedPillName = 'Bế Quan Đột Phá';
      } else if (typeof usePill === 'string' && usePill !== 'none' && !forceSuccess) {
        const inv = inventoryRepository.getUserInventory(discordId);
        const pill = inv.find(i => i.item_id === usePill && i.quantity > 0);
        
        if (pill) {
          inventoryRepository.removeItem(discordId, usePill, 1);
          if (usePill === ITEMS.PILL_BREAK_MINOR_1) { pillBonus = 15; usedPillName = 'Tụ Khí Đan'; }
          else if (usePill === ITEMS.PILL_BREAK_MINOR_2) { pillBonus = 30; usedPillName = 'Bồi Nguyên Đan'; }
          else if (usePill === ITEMS.PILL_BREAK_MINOR_3) { pillBonus = 50; usedPillName = 'Tạo Hóa Đan'; }
        } else {
          return {
            success: false,
            isMajor: false,
            message: 'Đạo hữu không có đan dược này trong hành trang!'
          };
        }
      }

      let alignmentRateMod = 0;
      if (user.alignment === 'neutral' || !user.alignment) {
        alignmentRateMod = 5; // Tán Tu +5% tỷ lệ đột phá tự nhiên
      } else if (user.alignment === 'demonic') {
        alignmentRateMod = -5; // Ma Đạo -5% tỷ lệ đột phá tự nhiên
      }
      let qiDeviationPenalty = 0;
      if (qiDeviationDisturbance) {
        qiDeviationPenalty = 15; // Giảm 15% tỷ lệ đột phá do quấy nhiễu
      }

      const totalRate = forceSuccess ? 100 : Math.max(0, Math.min(baseRate + (luckBonus * 100) + pillBonus + alignmentRateMod - qiDeviationPenalty, 100));
      const rolled = forceSuccess ? 0 : Math.random() * 100;

      if (rolled <= totalRate) {
        // THÀNH CÔNG
        const nextLevel = user.level + 1;
        const nextExpNeeded = this.calculateNextExp(nextLevel);
        const newStats = this.calculateStatsForLevel(nextLevel, user.linh_can, user.alignment);

      userRepository.update(discordId, {
        level: nextLevel,
        tu_vi: 0, // Reset tu vi về 0 sau khi lên cấp
        exp_needed: nextExpNeeded,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_luck: user.base_luck,
        base_speed: newStats.speed
      });

      const updatedUser = userRepository.get(discordId)!;
      const nextRealm = getRealmDetails(nextLevel);

      // Gọi xử lý thăng cấp sư đồ
      const { mentorshipService } = require('./MentorshipService');
      const mentNotifs = mentorshipService.handleApprenticeLevelUp(discordId, user.level, nextLevel);
      let mentText = '';
      if (mentNotifs.length > 0) {
        mentText = `\n\n${mentNotifs.join('\n')}`;
      }

      // Kiểm tra thành tựu level
      const leveledUp = achievementService.checkLevelAchievements(discordId, nextLevel);
      let achieveText = '';
      if (leveledUp.length > 0) {
        const detailText = leveledUp.map(a => {
          const rewardDetails: string[] = [];
          if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi 🌿`);
          if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} Linh Thạch 🟤`);
          if (a.reward_title) rewardDetails.push(`Danh hiệu: [${a.reward_title}] 🏆`);
          return `🏆 **Hoàn thành Thành Tựu:** **${a.name}**\n  └ *Phần thưởng:* ${rewardDetails.join(', ')}`;
        }).join('\n\n');
        achieveText = `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**\n${detailText}`;
      }

      const pillText = usedPillName ? ` nhờ sự hỗ trợ của **${usedPillName}**` : '';
      return {
        success: true,
        isMajor: false,
        message: `🎉 Chúc mừng đạo hữu đột phá thành công lên **${nextRealm.fullName}**${pillText}! Các chỉ số chiến đấu được gia tăng.${achieveText}${mentText} (Tỷ lệ: ${totalRate.toFixed(1)}%, Roll: ${rolled.toFixed(1)}%)`,
        rolled,
        rate: totalRate,
        user: updatedUser
      };
      } else {
        // THẤT BẠI TẦNH NHỎ -> Phạt mất Tu Vi
        const lossAmount = Math.round(user.tu_vi * 0.20);
        const newTuVi = Math.max(user.tu_vi - lossAmount, 0);

        let qiDeviationMsg = '';
        const updates: Partial<UserEntity> = { tu_vi: newTuVi };

        // 25% cơ hội tẩu hỏa nhập ma khi thất bại tự nhiên, 100% nếu có quấy nhiễu
        if (qiDeviationDisturbance || Math.random() < 0.25) {
          const now = Math.floor(Date.now() / 1000);
          updates.qi_deviation_until = now + 1800; // 30 phút tẩu hỏa nhập ma
          qiDeviationMsg = '\n⚠️ **TẨU HỎA NHẬP MA!** Đột phá thất bại dẫn đến linh khí chu thiên nghịch chuyển, rơi vào trạng thái Tẩu Hỏa Nhập Ma trong **30 phút**! (Giảm 50% hiệu suất tu vi nhàn rỗi và không thể thiền định chủ động trong thời gian này).';
        }

        userRepository.update(discordId, updates);
        const updatedUser = userRepository.get(discordId)!;
        
        const pillText = usedPillName ? ` Mặc dù đã dùng **${usedPillName}** nhưng cơ duyên chưa tới,` : '';
        return {
          success: false,
          isMajor: false,
          message: `❌ **BÌNH CẢNH CẢN BƯỚC!** Đạo hữu đột phá thất bại!${pillText} Linh khí tiêu tán, tổn hao **-${lossAmount}** Tu Vi! (Tỷ lệ: ${totalRate.toFixed(1)}%, Roll: ${rolled.toFixed(1)}%)${qiDeviationMsg}`,
          rolled,
          rate: totalRate,
          user: updatedUser
        };
      }
    } else {
      // Đột phá Đại Cảnh Giới (Major) -> Có tỷ lệ thành công và rủi ro
      const baseRate = Math.max(55 - majorIndex * 12, 8); // Tối thiểu 8%
      const luckBonus = user.base_luck * 0.002; // Mỗi điểm may mắn +0.2% tỷ lệ
      
      let pillBonus = 0;
      let hasPill = false;

      if (typeof usePill === 'string' && usePill === 'bequan') {
        let cost = user.level * 1000;
        if (user.alignment === 'orthodox') {
          cost = Math.round(cost * 0.90); // Giảm 10% phí Bế Quan cho Chính Đạo
        }
        if (user.coin_ha_pham < cost) {
          return {
            success: false,
            isMajor: true,
            message: `❌ Đạo hữu không đủ Linh Thạch để Bế Quan Đột Phá! (Yêu cầu **${cost}** Hạ Phẩm Linh Thạch. Hiện có: **${user.coin_ha_pham}**)`
          };
        }
        userRepository.update(discordId, { coin_ha_pham: user.coin_ha_pham - cost });
        forceSuccess = true;
        hasPill = false;
      } else if (usePill && !forceSuccess) {
        // Kiểm tra xem có Trúc Cơ Đan trong túi không
        const inv = inventoryRepository.getUserInventory(discordId);
        const breakPill = inv.find(i => i.item_id === ITEMS.PILL_BREAK_1 && i.quantity > 0);
        if (breakPill) {
          hasPill = true;
          pillBonus = 20; // Tăng thêm 20%
          inventoryRepository.removeItem(discordId, ITEMS.PILL_BREAK_1, 1);
        } else {
          return {
            success: false,
            isMajor: true,
            message: 'Đạo hữu không có **Trúc Cơ Đan** trong hành trang để sử dụng!'
          };
        }
      }

      let alignmentRateMod = 0;
      if (user.alignment === 'neutral' || !user.alignment) {
        alignmentRateMod = 5; // Tán Tu +5% tỷ lệ đột phá tự nhiên
      } else if (user.alignment === 'demonic') {
        alignmentRateMod = -5; // Ma Đạo -5% tỷ lệ đột phá tự nhiên
      }

      const totalRate = forceSuccess ? 100 : Math.max(0, Math.min(baseRate + (luckBonus * 100) + pillBonus + alignmentRateMod, 99)); // Max 99%
      const rolled = forceSuccess ? 0 : Math.random() * 100;
      
      if (rolled <= totalRate) {
        // ĐỘT PHÁ THÀNH CÔNG
        const nextLevel = user.level + 1;
        const nextExpNeeded = this.calculateNextExp(nextLevel);
        const newStats = this.calculateStatsForLevel(nextLevel, user.linh_can, user.alignment);
        
        // Cập nhật danh hiệu (title) tương ứng đại cảnh mới
        const nextRealm = getRealmDetails(nextLevel);

        userRepository.update(discordId, {
          level: nextLevel,
          tu_vi: 0,
          exp_needed: nextExpNeeded,
          title: `${nextRealm.realmName} Sơ Kỳ`,
          base_hp: newStats.hp,
          base_mp: newStats.mp,
          base_atk: newStats.atk,
          base_def: newStats.def,
          base_crit: newStats.crit,
          base_crit_res: newStats.critRes,
          base_luck: user.base_luck,
          base_speed: newStats.speed,
          consecutive_fails: 0
        });

        const updatedUser = userRepository.get(discordId)!;
        const pillText = usePill === 'bequan' ? ' bằng cách Bế Quan quy mô lớn' : (hasPill ? ' nhờ sử dụng **Trúc Cơ Đan** hỗ trợ' : '');

        // Gọi xử lý thăng cấp sư đồ
        const { mentorshipService } = require('./MentorshipService');
        const mentNotifs = mentorshipService.handleApprenticeLevelUp(discordId, user.level, nextLevel);
        let mentText = '';
        if (mentNotifs.length > 0) {
          mentText = `\n\n${mentNotifs.join('\n')}`;
        }

        // Kiểm tra thành tựu level
        const leveledUp = achievementService.checkLevelAchievements(discordId, nextLevel);
        let achieveText = '';
        if (leveledUp.length > 0) {
          const detailText = leveledUp.map(a => {
            const rewardDetails: string[] = [];
            if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi 🌿`);
            if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} Linh Thạch 🟤`);
            if (a.reward_title) rewardDetails.push(`Danh hiệu: [${a.reward_title}] 🏆`);
            return `🏆 **Hoàn thành Thành Tựu:** **${a.name}**\n  └ *Phần thưởng:* ${rewardDetails.join(', ')}`;
          }).join('\n\n');
          achieveText = `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**\n${detailText}`;
        }

        // Cộng dòng thuộc tính hiếm cho Bản Mệnh Pháp Bảo
        const { inventoryService } = require('./InventoryService');
        const artifactRes = inventoryService.handleBreakthroughStats(discordId);
        let artifactText = '';
        if (artifactRes && artifactRes.success && artifactRes.message) {
          artifactText = `\n\n${artifactRes.message}`;
        }

        return {
          success: true,
          isMajor: true,
          message: `🎉 **THIÊN ĐỊA DỊ TƯỢNG!** Đạo hữu đã đột phá thành công đại cảnh giới${pillText}, tiến nhập vào **${nextRealm.fullName}**! Danh hiệu thăng cấp thành **${updatedUser.title}**! (Tỷ lệ: ${totalRate.toFixed(1)}%, Roll: ${rolled.toFixed(1)}%)${achieveText}${mentText}${artifactText}`,
          rolled,
          rate: totalRate,
          user: updatedUser
        };
      } else {
        // ĐỘT PHÁ THẤT BẠI - Bị phạt nặng
        const now = Math.floor(Date.now() / 1000);
        const lossAmount = Math.round(user.tu_vi * 0.35);
        const newTuVi = Math.max(user.tu_vi - lossAmount, 0);
        const injuryEndTime = now + 3600; // 1 giờ

        userRepository.update(discordId, { 
          tu_vi: newTuVi,
          injury_end_time: injuryEndTime
        });
        const updatedUser = userRepository.get(discordId)!;
        const pillText = hasPill ? ' Mặc dù đã dùng **Trúc Cơ Đan** nhưng vận khí kém,' : '';

        return {
          success: false,
          isMajor: true,
          message: `❌ **CẢNH GIỚI PHẢN PHỆ TÀN KHỐC!** Đạo hữu đột phá thất bại!${pillText} Linh khí bạo tẩu phá hủy kinh mạch, tổn hao **-${lossAmount}** Tu Vi và rơi vào trạng thái **Trọng Thương trong 1 giờ** (không thể làm việc, đi bí cảnh hay luyện đan)!`,
          rolled,
          rate: totalRate,
          user: updatedUser
        };
      }
    }
  }

  /**
   * Thức tỉnh hoặc nâng cấp Ý Cảnh
   */
  public awakenYCanh(discordId: string): { success: boolean; message: string; yCanhName?: string; newLevel?: number } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!' };
    }

    // Yêu cầu: 5 Ngộ Tính hoặc 500 Linh thạch hạ phẩm
    const useNgoTinh = user.ngotinh >= 5;
    if (!useNgoTinh && user.coin_ha_pham < 500) {
      return { 
        success: false, 
        message: `Đạo hữu không đủ tài nguyên để Ngộ Ý Cảnh! (Yêu cầu **5** Ngộ Tính hoặc **500** Linh Thạch Hạ Phẩm. Hiện có: **${user.ngotinh}** Ngộ Tính, **${user.coin_ha_pham}** Linh Thạch)` 
      };
    }

    // Trừ tài nguyên
    if (useNgoTinh) {
      userRepository.update(discordId, { ngotinh: user.ngotinh - 5 });
    } else {
      userRepository.update(discordId, { coin_ha_pham: user.coin_ha_pham - 500 });
    }

    // Chọn ngẫu nhiên 1 trong 3 Ý Cảnh
    const intents = [
      { key: 'KiemY', name: 'Kiếm Ý' },
      { key: 'BatDietY', name: 'Bất Diệt Ý' },
      { key: 'HuyenQuyY', name: 'Huyền Quy Ý' }
    ];
    const rolled = intents[Math.floor(Math.random() * intents.length)];

    let yCanhMap: Record<string, number> = {};
    try {
      yCanhMap = JSON.parse(user.y_canh || '{}');
    } catch (e) {
      yCanhMap = {};
    }

    const currentLevel = yCanhMap[rolled.key] || 0;
    let message = '';
    let newLevel = currentLevel;

    if (currentLevel >= 10) {
      // Hoàn trả một phần tài nguyên nếu đạt tối đa
      if (useNgoTinh) {
        userRepository.update(discordId, { ngotinh: user.ngotinh + 3 }); // Hoàn trả 3 ngộ tính
        message = `🌀 Đạo hữu ngộ ra **${rolled.name}**, nhưng Ý Cảnh này đã đạt **Cực Hạn (Cấp 10)**. Thiên địa trả lại **3** Điểm Ngộ Tính.`;
      } else {
        userRepository.update(discordId, { coin_ha_pham: user.coin_ha_pham + 300 }); // Hoàn trả 300 linh thạch
        message = `🌀 Đạo hữu ngộ ra **${rolled.name}**, nhưng Ý Cảnh này đã đạt **Cực Hạn (Cấp 10)**. Thiên địa trả lại **300** Linh Thạch Hạ Phẩm.`;
      }
    } else {
      newLevel = currentLevel + 1;
      yCanhMap[rolled.key] = newLevel;
      userRepository.update(discordId, { y_canh: JSON.stringify(yCanhMap) });

      if (currentLevel === 0) {
        message = `🎉 **THỨC TỈNH Ý CẢNH!** Đạo hữu nhập định sâu sắc, thành công thức tỉnh **${rolled.name} (Cấp 1)**!`;
      } else {
        message = `📈 **Ý CẢNH ĐỘT PHÁ!** Lĩnh ngộ của đạo hữu về **${rolled.name}** sâu sắc thêm, thăng lên **Cấp ${newLevel}**!`;
      }
    }

    // Ghi log giao dịch
    const { systemConfigService } = require('./SystemConfigService');
    systemConfigService.writeAuditLog(discordId, 'awaken_y_canh', {
      intent: rolled.key,
      oldLevel: currentLevel,
      newLevel,
      resourceUsed: useNgoTinh ? 'ngotinh' : 'coin_ha_pham'
    });

    // Kiểm tra thành tựu Ý Cảnh (dùng Map để tránh fragile index-based lookup)
    const YCANH_ACHIEVEMENT_MAP: Record<string, string> = {
      'KiemY': 'tl_15',
      'BatDietY': 'tl_16',
      'HuyenQuyY': 'tl_17'
    };
    const achieveId = YCANH_ACHIEVEMENT_MAP[rolled.key];
    const newlyUnlocked: any[] = [];
    if (achieveId && newLevel > currentLevel) {
      const unlocked = achievementService.setProgress(discordId, achieveId, newLevel);
      newlyUnlocked.push(...unlocked);
    }
    // Kiểm tra tổng level ý cảnh (cả 3 đều cấp 10)
    try {
      const totalYCLevels = Object.values(yCanhMap).reduce((a: number, b: number) => a + b, 0);
      const unlocked = achievementService.setProgress(discordId, 'tl_18', totalYCLevels);
      newlyUnlocked.push(...unlocked);
    } catch {}

    if (newlyUnlocked.length > 0) {
      const achieveText = newlyUnlocked.map(a => {
        const rewardDetails: string[] = [];
        if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi 🌿`);
        if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} Linh Thạch 🟤`);
        if (a.reward_title) rewardDetails.push(`Danh hiệu: [${a.reward_title}] 🏆`);
        return `🏆 **Hoàn thành Thành Tựu:** **${a.name}**\n  └ *Phần thưởng:* ${rewardDetails.join(', ')}`;
      }).join('\n\n');
      message += `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**\n${achieveText}`;
    }

    return {
      success: true,
      message,
      yCanhName: rolled.name,
      newLevel
    };
  }

  /**
   * Tiến hành Luân Hồi cho tu sĩ
   */
  public reincarnate(discordId: string): { success: boolean; message: string; user?: UserEntity } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!' };
    }

    if (user.level < 380) {
      return { 
        success: false, 
        message: `Đạo hữu chưa đạt tới cảnh giới cực hạn tối cao để Luân Hồi! (Yêu cầu cấp **380** - Đăng Tiên Kỳ Tầng 38. Cấp hiện tại: **${user.level}**)` 
      };
    }

    const newLuanHoiCount = user.luan_hoi_count + 1;
    const newLinhCan = this.generateLinhCan();
    const nextExpNeeded = this.calculateNextExp(1);
    
    // Tính toán chỉ số cơ bản cho level 1
    const newStats = this.calculateStatsForLevel(1, newLinhCan);

    // Cập nhật người chơi
    userRepository.update(discordId, {
      level: 1,
      tu_vi: 0,
      exp_needed: nextExpNeeded,
      title: `Luân Hồi Chi Chủ - Đời ${newLuanHoiCount}`,
      linh_can: newLinhCan,
      luan_hoi_count: newLuanHoiCount,
      base_hp: newStats.hp,
      base_mp: newStats.mp,
      base_atk: newStats.atk,
      base_def: newStats.def,
      base_crit: newStats.crit,
      base_crit_res: newStats.critRes,
      base_luck: newStats.luck,
      base_speed: newStats.speed,
      alignment: 'neutral',
      qi_deviation_until: 0
    });

    const updatedUser = userRepository.get(discordId)!;

    // Ghi log giao dịch
    const { systemConfigService } = require('./SystemConfigService');
    systemConfigService.writeAuditLog(discordId, 'reincarnate', {
      luanHoiCount: newLuanHoiCount,
      oldLinhCan: user.linh_can,
      newLinhCan
    });

    // Kiểm tra thành tựu luân hồi
    const newlyUnlocked: any[] = [];
    newlyUnlocked.push(...achievementService.updateProgress(discordId, 'tl_12', 1));
    newlyUnlocked.push(...achievementService.setProgress(discordId, 'tl_13', newLuanHoiCount));

    let achieveText = '';
    if (newlyUnlocked.length > 0) {
      const detailText = newlyUnlocked.map(a => {
        const rewardDetails: string[] = [];
        if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi 🌿`);
        if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} Linh Thạch 🟤`);
        if (a.reward_title) rewardDetails.push(`Danh hiệu: [${a.reward_title}] 🏆`);
        return `🏆 **Hoàn thành Thành Tựu:** **${a.name}**\n  └ *Phần thưởng:* ${rewardDetails.join(', ')}`;
      }).join('\n\n');
      achieveText = `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**\n${detailText}`;
    }

    return {
      success: true,
      message: `🎉 **LUÂN HỒI THÀNH CÔNG!** Đạo hữu đã chọn buông bỏ tu vi kiếp này, vượt qua lục đạo luân hồi chuyển thế trùng sinh! Nhận danh hiệu **${updatedUser.title}** và được buff vĩnh viễn **+${newLuanHoiCount * 25}%** linh khí hấp thu!${achieveText}`,
      user: updatedUser
    };
  }

  /**
   * Tôi luyện Linh Căn: Tăng 1% của hệ được chọn, giảm 1% của hệ khác có phần trăm lớn nhất.
   * Chi phí: 50 Trung Phẩm Linh Thạch (5000 Hạ Phẩm)
   */
  public temperLinhCan(discordId: string, targetElement: string): { success: boolean; message: string; user?: UserEntity } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
    }

    let linhCan: Record<string, number> = {};
    try {
      linhCan = JSON.parse(user.linh_can || '{}');
    } catch (e) {
      return { success: false, message: 'Không thể phân tích dữ liệu Linh Căn!' };
    }

    if (!(targetElement in linhCan)) {
      return { success: false, message: `Linh căn của đạo hữu không có thuộc tính **${targetElement}** để tôi luyện!` };
    }

    if (linhCan[targetElement] >= 100) {
      return { success: false, message: `Thuộc tính **${targetElement}** đã đạt tới độ thuần khiết cực hạn **100%**!` };
    }

    let costTrung = 50;
    let hasEnough = false;
    let deductMethod: 'trung' | 'ha' = 'trung';

    if (user.coin_trung_pham >= costTrung) {
      hasEnough = true;
      deductMethod = 'trung';
    } else if (user.coin_ha_pham >= costTrung * 100) {
      hasEnough = true;
      deductMethod = 'ha';
    }

    if (!hasEnough) {
      return {
        success: false,
        message: `Đạo hữu không đủ linh thạch tôi luyện! (Yêu cầu: **50** Trung Phẩm Linh Thạch hoặc **5,000** Hạ Phẩm Linh Thạch. Đạo hữu hiện có: **${user.coin_trung_pham}** Trung Phẩm, **${user.coin_ha_pham}** Hạ Phẩm)`
      };
    }

    // 1. Tăng hệ mục tiêu
    linhCan[targetElement] += 1;

    // 2. Tìm hệ khác lớn nhất để giảm
    let maxElement = '';
    let maxPct = -1;
    for (const [el, pct] of Object.entries(linhCan)) {
      if (el !== targetElement && pct > maxPct) {
        maxPct = pct;
        maxElement = el;
      }
    }

    if (maxElement) {
      linhCan[maxElement] -= 1;
      if (linhCan[maxElement] <= 0) {
        delete linhCan[maxElement];
      }
    }

    const newLinhCanJson = JSON.stringify(linhCan);

    // Tính toán lại stats
    const newStats = this.calculateStatsForLevel(user.level, newLinhCanJson);

    // Thực hiện trừ tiền và cập nhật Linh Căn trong transaction
    db.transaction(() => {
      if (deductMethod === 'trung') {
        userRepository.update(discordId, { coin_trung_pham: user.coin_trung_pham - costTrung });
      } else {
        userRepository.update(discordId, { coin_ha_pham: user.coin_ha_pham - (costTrung * 100) });
      }

      // Cập nhật người chơi
      userRepository.update(discordId, {
        linh_can: newLinhCanJson,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_luck: user.base_luck,
        base_speed: newStats.speed
      });
    })();

    const updatedUser = userRepository.get(discordId)!;
    const deductText = deductMethod === 'trung' ? `**-${costTrung}** Trung Phẩm Linh Thạch` : `**-${costTrung * 100}** Hạ Phẩm Linh Thạch`;

    return {
      success: true,
      message: `✨ **Tôi Luyện Thành Công:** Đạo hữu tiêu hao ${deductText}, tôi luyện giúp độ tinh thuần **${targetElement}** tăng lên **${updatedUser.linh_can.includes(targetElement) ? JSON.parse(updatedUser.linh_can)[targetElement] : 0}%**!`,
      user: updatedUser
    };
  }

  public static getBreakthroughRate(majorIndex: number, luck: number): number {
    const baseRate = Math.max(65 - majorIndex * 12, 8);
    const luckBonus = luck * 0.002;
    return Math.min(baseRate + luckBonus * 100, 100);
  }
}
export const cultivationService = new CultivationService();

