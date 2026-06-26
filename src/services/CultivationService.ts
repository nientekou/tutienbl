import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import { ITEMS } from '../config/itemConstants';
import { GAME_CONSTANTS } from '../config/gameConstants';
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
  /**
   * @param pityCount - Số lần roll liên tiếp không có element nào >=40%.
   *   Khi >= LINH_CAN_PITY_THRESHOLD, guarantee element cao nhất >= LINH_CAN_PITY_MIN_ELEMENT%.
   */
  public generateLinhCan(pityCount: number = 0): string {
    const rand = Math.random() * 100;
    let elementCount = 2;

    // BIG UPDATE: Linh Can RNG rework - more single/dual, less quad+
    if (rand < 15) elementCount = 1;       // 15% single (was 5%)
    else if (rand < 65) elementCount = 2;  // 50% dual (was 15%)
    else if (rand < 90) elementCount = 3;  // 25% triple (was 30%)
    else elementCount = 4;                  // 10% quad (was 35% quad + 15% penta)

    const basicElements = ['Hỏa', 'Thủy', 'Mộc', 'Kim', 'Thổ']; // ponytail: thêm Kim (trước 4 elements)
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

    // Minimum guarantee: ensure at least 1 element ≥ 10%
    const maxElement = Object.values(linhCan).reduce((a, b) => Math.max(a, b), 0);
    if (maxElement < 10 && elementCount > 0) {
      const keys = Object.keys(linhCan);
      const boostAmount = 10 - maxElement;
      linhCan[keys[0]] += boostAmount;
      // Reduce the weakest element to compensate
      if (keys.length > 1) {
        const weakest = keys.reduce((a, b) => linhCan[a] < linhCan[b] ? a : b);
        linhCan[weakest] = Math.max(1, linhCan[weakest] - boostAmount);
      }
    }

    // B02: Linh Can Pity System — sau N roll không element nào >=40%, guarantee element cao nhất >=35%
    const pityThreshold = GAME_CONSTANTS.LINH_CAN_PITY_THRESHOLD;
    const pityMinElement = GAME_CONSTANTS.LINH_CAN_PITY_MIN_ELEMENT;
    if (pityCount >= pityThreshold) {
      // Tìm element hiện tại có % cao nhất
      const keys = Object.keys(linhCan);
      if (keys.length > 0) {
        const highestKey = keys.reduce((a, b) => linhCan[a] > linhCan[b] ? a : b);
        const deficit = pityMinElement - linhCan[highestKey];
        if (deficit > 0) {
          linhCan[highestKey] = pityMinElement;
          // Trừ deficit từ element thấp nhất
          const weakestKey = keys.filter(k => k !== highestKey).reduce((a, b) => linhCan[a] < linhCan[b] ? a : b, keys.filter(k => k !== highestKey)[0] || highestKey);
          if (weakestKey !== highestKey) {
            linhCan[weakestKey] = Math.max(1, linhCan[weakestKey] - deficit);
          }
        }
      }
    }

    return JSON.stringify(linhCan);
  }

  /**
   * Tính toán lượng EXP (Tu Vi) cần thiết để lên cấp/tầng tiếp theo
   */
  public calculateNextExp(level: number): number {
    const base = Math.round(100 * Math.pow(level, 2.5));
    if (level >= 200) {
      return Math.round(base * 0.5);
    }
    if (level >= 100) {
      return Math.round(base * 0.6);
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
    // Hệ số nhân cấp độ cảnh giới: 1.0 (Luyện Khí) -> 2.0 (Trúc Cơ) -> 3.0 -> ... -> 10.0 (Đăng Tiên)
    const realmMultiplier = 1 + majorIndex * 1.0;

    // Chỉ số thô tăng theo cấp độ và nhân với cảnh giới
    let hp = Math.floor((100 + (level - 1) * 20) * realmMultiplier);
    let mp = Math.floor((50 + (level - 1) * 10) * realmMultiplier);
    let atk = Math.floor((15 + (level - 1) * 4) * realmMultiplier);
    let def = Math.floor((10 + (level - 1) * 3) * realmMultiplier);
    let crit = 0.05 + (majorIndex * 0.01); // 5% base + 1% mỗi cảnh giới
    let critRes = 0.0 + (majorIndex * 0.005);
    const luck = 10 + majorIndex * 2; // ponytail: scale theo realm (trước hardcode 10)
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
          case 'Kim':
            atk += Math.round(atk * 0.15 * ratio); // 100% Kim tăng 15% công
            crit += 0.05 * ratio;                 // 100% Kim tăng 5% bạo kích
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

    // Tốc độ tích lũy: base speed tăng theo cấp độ (P7-03: tiny increase from 0.01 to 0.011)
    const baseSpeed = 0.05 + user.level * 0.011;
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
      // B04: Unified cave buff — capped at 10%
      caveExpBuff = Math.min(springLvl * 0.02, 0.10);
    } catch (e) { console.warn('[CultivationService] Failed to fetch cave spring level:', e); }

    const speedMultiplier = this.getCultivationSpeedMultiplier(user.linh_can) + Math.min(user.luan_hoi_count * 0.20, 1.5) + sectLinhTratBonus + caveExpBuff;

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

    // Clean expired kyngo buffs
    try {
      const { kyNgoService } = require('./KyNgoService');
      kyNgoService.cleanExpiredBuffs(discordId);
    } catch {}

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
      // B04: Unified cave buff — same formula as claimIdleCultivation
      const springLvl = cave.spring_level || 1;
      caveExpBuff = Math.min(springLvl * 0.02, 0.10);
    } catch(e) { console.warn('[CultivationService] Failed to fetch cave level for practice buff:', e); }

    const speedMultiplier = this.getCultivationSpeedMultiplier(user.linh_can) + Math.min(user.luan_hoi_count * 0.20, 1.5) + sectLinhTratBonus + caveExpBuff;
    
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

    // Kỳ Ngộ trigger
    try {
      const { kyNgoService } = require('./KyNgoService');
      const event = kyNgoService.maybeTriggerEvent(discordId, user.level, user.base_luck ?? 0);
      if (event) {
        kyNgoService.createEvent(discordId, event);
      }
    } catch {}

    // Tâm Ma trigger — higher qi_deviation = higher chance
    try {
      const { tamMaService } = require('./TamMaService');
      const uAny = user as any;
      const qiDev = uAny.qi_deviation ?? 0;
      const demon = tamMaService.maybeSummonDemon(discordId, user.level, qiDev);
      if (demon) {
        const playerPower = (user.base_atk ?? 0) + (user.base_def ?? 0) + (user.base_hp ?? 0);
        tamMaService.summonDemon(discordId, demon, playerPower);
      }
    } catch {}

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
      achievementService.setProgress(discordId, 'tl_14', user.ngotinh + 1);
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
  public reincarnate(discordId: string, daoTamElement?: string): { success: boolean; message: string; user?: UserEntity } {
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

    // P5-01: Reincarnation V2 — Đạo Tâm choices with tradeoffs
    let daoTamData: any = null;
    let daoTamMsg = '';
    if (daoTamElement && ['Hỏa', 'Thủy', 'Phong'].includes(daoTamElement)) {
      const daoTamDefs: Record<string, { buffs: Record<string, number>; nerfs: Record<string, number> }> = {
        'Hỏa': { buffs: { atk_percent: 0.08, crit_rate: 0.03 }, nerfs: { hp_percent: -0.10, def_percent: -0.05 } },
        'Thủy': { buffs: { hp_percent: 0.12, def_percent: 0.08 }, nerfs: { atk_percent: -0.08, speed_percent: -0.03 } },
        'Phong': { buffs: { speed_percent: 0.08, dodge_rate: 0.05 }, nerfs: { hp_percent: -0.10, def_percent: -0.05 } }
      };

      // Check existing Dao Tam level (max 5)
      let currentLevel = 0;
      if (user.dao_tam) {
        try {
          const existing = JSON.parse(user.dao_tam);
          if (existing.element === daoTamElement) currentLevel = existing.level || 0;
        } catch {}
      }
      const newLevel = Math.min(currentLevel + 1, 5);

      // Stack cap: max +40% per stat total
      const cappedBuffs: Record<string, number> = {};
      for (const [stat, val] of Object.entries(daoTamDefs[daoTamElement].buffs)) {
        cappedBuffs[stat] = Math.min(val * newLevel, 0.40);
      }

      daoTamData = {
        element: daoTamElement,
        level: newLevel,
        buffs: cappedBuffs,
        nerfs: daoTamDefs[daoTamElement].nerfs
      };
      daoTamMsg = `\n🔮 Đạo Tâm **${daoTamElement}** cấp ${newLevel}: +${Math.round(cappedBuffs[Object.keys(cappedBuffs)[0]] * 100)}% ${Object.keys(cappedBuffs)[0]}`;
    }

    // P5-01: Reincarnation EXP Bonus — nerfed to +20% per count, capped at +150%
    const expBonusPercent = Math.min(newLuanHoiCount * 20, 150);

    // P5-01: Reincarnation Token
    const newTokens = (user.reincarnation_tokens || 0) + 1;

    // P5-01: Reincarnation Milestones
    let milestoneMsg = '';
    if (newLuanHoiCount === 1) milestoneMsg = '\n🎯 Đời đầu: Nhận **+20% Tu Vi** vĩnh viễn!';
    else if (newLuanHoiCount === 3) milestoneMsg = '\n🏆 Đời 3: Unlock danh hiệu **"Tái Sinh"**!';
    else if (newLuanHoiCount === 10) milestoneMsg = '\n🐉 Đời 10: Unlock skin cưỡi **Phượng Hoàng**!';
    else if (newLuanHoiCount === 15) milestoneMsg = '\n👑 Đời 15: Unlock danh hiệu huyền thoại **"Vô Cực"**!';

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
      qi_deviation_until: 0,
      reincarnation_tokens: newTokens,
      dao_tam: daoTamData ? JSON.stringify(daoTamData) : user.dao_tam
    });

    const updatedUser = userRepository.get(discordId)!;

    // Ghi log giao dịch
    const { systemConfigService } = require('./SystemConfigService');
    systemConfigService.writeAuditLog(discordId, 'reincarnate', {
      luanHoiCount: newLuanHoiCount,
      oldLinhCan: user.linh_can,
      newLinhCan,
      daoTam: daoTamElement || 'none'
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
      message: `🎉 **LUÂN HỒI THÀNH CÔNG!** Đạo hữu đã chuyển thế trùng sinh!\n` +
        `• Danh hiệu: **${updatedUser.title}**\n` +
        `• Tu Vi Thưởng: **+${expBonusPercent}%** vĩnh viễn (capped +150%)\n` +
        `• Phiếu: **${newTokens}** (dùng tại Cửa Hàng Luân Hồi)` +
        daoTamMsg + milestoneMsg + achieveText,
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

  // === A-01: Cultivation Milestone System ===

  /**
   * A-01: Get realm-specific bonuses based on major realm index
   * Permanent +3% to specific stat per major realm achieved
   */
  public getRealmBonuses(level: number): { stat: string; value: number; realm: string }[] {
    const { majorIndex, realmName } = getRealmDetails(level);
    const bonuses: { stat: string; value: number; realm: string }[] = [];

    // Each major realm gives +3% to a specific stat
    const realmStatMap: Record<number, { stat: string; value: number }> = {
      0: { stat: 'hp', value: 0.03 },      // Luyện Khí: +3% HP
      1: { stat: 'atk', value: 0.03 },      // Trúc Cơ: +3% ATK
      2: { stat: 'def', value: 0.03 },      // Kim Đan: +3% DEF
      3: { stat: 'crit', value: 0.03 },     // Nguyên Anh: +3% Crit
      4: { stat: 'speed', value: 0.03 },    // Hóa Thần: +3% Speed
      5: { stat: 'hp', value: 0.05 },       // Luyện Hư: +5% HP (endgame)
      6: { stat: 'atk', value: 0.05 },      // Hợp Thể: +5% ATK (endgame)
      7: { stat: 'all', value: 0.03 },      // Đại乘: +3% all stats (endgame)
      8: { stat: 'all', value: 0.05 },      // Tam Thiên: +5% all stats (endgame)
    };

    for (let i = 0; i <= majorIndex; i++) {
      const bonus = realmStatMap[i];
      if (bonus) {
        bonuses.push({ stat: bonus.stat, value: bonus.value, realm: realmName });
      }
    }

    return bonuses;
  }

  /**
   * A-01: Get breakthrough challenge description for each major realm
   */
  public getBreakthroughChallenge(majorIndex: number): { name: string; description: string; restriction: string } {
    const challenges = [
      { name: 'Luyện Khí → Trúc Cơ', description: 'Vượt qua 3 yêu quái liên tiếp', restriction: 'Không có restriction' },
      { name: 'Trúc Cơ → Kim Đan', description: 'Vượt qua trial trong 10 hiệp', restriction: 'Không dùng vật phẩm' },
      { name: 'Kim Đan → Nguyên Anh', description: 'Giải đố linh lực', restriction: 'Không dùng kỹ năng active' },
      { name: 'Nguyên Anh → Hóa Thần', description: 'Đánh bại bản sao của chính mình', restriction: 'HP chỉ hồi phục 1 lần' },
      { name: 'Hóa Thần → Luyện Hư', description: 'Vượt qua 5 tầng trial', restriction: 'Mỗi tầng có restriction riêng' },
      { name: 'Luyện Hư → Hợp Thể', description: 'Đánh bại Boss Thần', restriction: 'Không dùng pet' },
      { name: 'Hợp Thể → Đại Thừa', description: 'Vượt qua trial cực khó', restriction: 'Tất cả restriction' },
      { name: 'Đại Thừa → Tam Thiên', description: 'Cuối cùng — Trial của Thiên Đạo', restriction: 'Không dùng bất kỳ buff nào' },
    ];

    return challenges[majorIndex] || challenges[0];
  }

  /**
   * A-01: Get total realm bonuses as stat multipliers
   */
  public getRealmBonusMultipliers(level: number): Record<string, number> {
    const bonuses = this.getRealmBonuses(level);
    const multipliers: Record<string, number> = { hp: 1.0, atk: 1.0, def: 1.0, crit: 1.0, speed: 1.0 };

    for (const bonus of bonuses) {
      if (bonus.stat === 'all') {
        for (const key of Object.keys(multipliers)) {
          multipliers[key] += bonus.value;
        }
      } else if (multipliers[bonus.stat] !== undefined) {
        multipliers[bonus.stat] += bonus.value;
      }
    }

    return multipliers;
  }

  // === C-01: Reincarnation V4 ===

  /**
   * C-01: Get additional Dao Tam choices
   */
  getDaoTamChoices(): { element: string; name: string; buffs: Record<string, number>; nerfs: Record<string, number>; description: string }[] {
    return [
      {
        element: 'Hỏa', name: 'Hỏa Đạo Tâm',
        buffs: { atk_percent: 0.08, crit_rate: 0.03 },
        nerfs: { hp_percent: -0.10, def_percent: -0.05 },
        description: '+8% Công Kích, +3% Bạo Kích nhưng -10% Sinh Lực, -5% Phòng Thủ'
      },
      {
        element: 'Thủy', name: 'Thủy Đạo Tâm',
        buffs: { hp_percent: 0.12, def_percent: 0.08 },
        nerfs: { atk_percent: -0.08, speed_percent: -0.03 },
        description: '+12% Sinh Lực, +8% Phòng Thủ nhưng -8% Công Kích, -3% Tốc Độ'
      },
      {
        element: 'Phong', name: 'Phong Đạo Tâm',
        buffs: { speed_percent: 0.08, dodge_rate: 0.05 },
        nerfs: { hp_percent: -0.10, def_percent: -0.05 },
        description: '+8% Tốc Độ, +5% Né Tránh nhưng -10% Sinh Lực, -5% Phòng Thủ'
      },
    ];
  }

  /**
   * C-01: Get reincarnation shop items
   */
  getReincarnationShopItems(): { id: string; name: string; cost: number; type: string; description: string }[] {
    return [
      { id: 'ri_title', name: 'Danh Hiệu Trùng Sinh', cost: 3, type: 'title', description: 'Danh hiệu Trùng Sinh' },
      { id: 'ri_cosmetic', name: 'Hào Quang Luân Hồi', cost: 5, type: 'cosmetic', description: 'Hào Quang Luân Hồi' },
      { id: 'ri_mount', name: 'Tọa Kỵ Luân Hồi', cost: 8, type: 'cosmetic', description: 'Ngoại Hình Tọa Kỵ' },
      { id: 'ri_convenience', name: 'Tăng Tốc Tu Luyện', cost: 2, type: 'convenience', description: '+20% tu luyện trong 24h' },
      { id: 'ri_material', name: 'Vật Liệu Luân Hồi', cost: 4, type: 'material', description: 'Nguyên liệu chế tạo hiếm' },
    ];
  }

  /**
   * C-01: Get reincarnation milestones
   */
  getReincarnationMilestones(): { count: number; reward: string; title?: string }[] {
    return [
      { count: 1, reward: '+20% tu luyện' },
      { count: 3, reward: 'Danh Hiệu Trùng Sinh', title: 'Trùng Sinh' },
      { count: 5, reward: 'Cửa Hàng Luân Hồi Cấp 2' },
      { count: 10, reward: 'Ngoại Hình Phượng Hoàng', title: 'Phượng Hoàng' },
      { count: 15, reward: 'Danh hiệu Vô Cực huyền thoại', title: 'Vô Cực' },
    ];
  }

  /**
   * C-01: Get reincarnation description for UI
   */
  getReincarnationDescription(userId: string): string {
    const user = userRepository.get(userId);
    if (!user) return 'Chưa tạo nhân vật!';

    const count = user.luan_hoi_count || 0;
    const bonus = Math.min(count * 20, 150);
    const tokens = user.reincarnation_tokens || 0;
    const daoTam = user.dao_tam ? JSON.parse(user.dao_tam) : null;

    let msg = `🔄 **Luân Hồi** — Đời ${count}\n`;
    msg += `📈 Tu Vi Thưởng: +${bonus}% (tối đa +150%)\n`;
    msg += `🎫 Phiếu: ${tokens}\n`;

    if (daoTam) {
      msg += `🔮 Dao Tam: ${daoTam.element} cấp ${daoTam.level}\n`;
    }

    msg += `\n**Milestones:**\n`;
    for (const m of this.getReincarnationMilestones()) {
      const achieved = count >= m.count;
      msg += `${achieved ? '✅' : '🔒'} Đời ${m.count}: ${m.reward}\n`;
    }

    return msg;
  }
}
export const cultivationService = new CultivationService();

