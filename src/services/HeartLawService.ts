import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export interface HeartLaw {
  id: string;
  name: string;
  description: string;
  base_effect: string; // JSON: {type: 'atk_percent', value: 0.05}
  element: 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ' | 'Vô' | 'Lôi' | 'Phong';
}

export interface UserHeartLaw {
  user_id: string;
  heart_law_id: string;
  level: number;
  fragments: number;
  is_equipped: number; // 0, 1, 2, 3
}

export interface HeartLawWithProgress extends HeartLaw {
  level: number;
  fragments: number;
  is_equipped: number;
}

// P1-07: Heart Law Set Bonus definitions
interface HeartLawSetAbility {
  element: string;
  name: string;
  description: string;
  buff: { type: string; value: number; rounds: number };
  nerf: { type: string; value: number; rounds: number };
}

const HOA = 'Hỏa';
const THUY = 'Thủy';
const MOC = 'Mộc';
const THO = 'Thổ';
const KIM = 'Kim';
const LOI = 'Lôi';
const PHONG = 'Phong';
const VO = 'Vô';

const HEART_LAW_SET_ABILITIES: Record<string, HeartLawSetAbility> = {
  [HOA]: {
    element: HOA,
    name: 'Hỏa Phương Phẫn Nộ',
    description: '+25% ATK 1 round NHƯNG -10% DEF round đó',
    buff: { type: 'atk_percent', value: 0.25, rounds: 1 },
    nerf: { type: 'def_percent', value: -0.10, rounds: 1 }
  },
  [THUY]: {
    element: THUY,
    name: 'Thủy Long Hồi Thiên',
    description: '+20% HP heal NHƯNG costs 20% MP',
    buff: { type: 'heal_percent', value: 0.20, rounds: 1 },
    nerf: { type: 'mp_cost_percent', value: 0.20, rounds: 1 }
  },
  [MOC]: {
    element: MOC,
    name: 'Mừc Linh Hấp Thụ',
    description: '+15% lifesteal 2 rounds NHƯNG -10% ATK',
    buff: { type: 'lifesteal', value: 0.15, rounds: 2 },
    nerf: { type: 'atk_percent', value: -0.10, rounds: 2 }
  },
  [THO]: {
    element: THO,
    name: 'Thổ Thân Hộ Thể',
    description: '+25% DEF 2 rounds NHƯNG -8% Speed',
    buff: { type: 'def_percent', value: 0.25, rounds: 2 },
    nerf: { type: 'speed_percent', value: -0.08, rounds: 2 }
  },
  [KIM]: {
    element: KIM,
    name: 'Kim Tình Sát Lục',
    description: '+20% Crit Rate 1 round NHƯNG -15% CritRes',
    buff: { type: 'crit_rate', value: 0.20, rounds: 1 },
    nerf: { type: 'crit_res', value: -0.15, rounds: 1 }
  },
  [LOI]: {
    element: LOI,
    name: 'Lơi Đình Vạn Quân',
    description: 'Choáng kẻ địch 1 lượt NHƯNG tốn 30% MP',
    buff: { type: 'stun', value: 1, rounds: 1 },
    nerf: { type: 'mp_cost_percent', value: 0.30, rounds: 1 }
  },
  [PHONG]: {
    element: PHONG,
    name: 'Phong Hành Vô Tích',
    description: '+20% dodge 2 rounds NHƯNG -10% DEF',
    buff: { type: 'dodge_rate', value: 0.20, rounds: 2 },
    nerf: { type: 'def_percent', value: -0.10, rounds: 2 }
  }
};

class HeartLawService {
  /**
   * Lấy thông tin một Tâm Pháp từ database
   */
  public getHeartLaw(id: string): HeartLaw | null {
    return db.prepare('SELECT * FROM heart_laws WHERE id = ?').get(id) as HeartLaw | null;
  }

  /**
   * Lấy tất cả Tâm Pháp hệ thống
   */
  public getAllHeartLaws(): HeartLaw[] {
    return db.prepare('SELECT * FROM heart_laws').all() as HeartLaw[];
  }

  /**
   * Lấy tiến trình Tâm Pháp của một user
   */
  public getUserHeartLaws(userId: string): HeartLawWithProgress[] {
    const all = this.getAllHeartLaws();
    const userHL = db.prepare('SELECT * FROM user_heart_laws WHERE user_id = ?').all(userId) as UserHeartLaw[];

    const userHLMap = new Map<string, UserHeartLaw>();
    for (const hl of userHL) {
      userHLMap.set(hl.heart_law_id, hl);
    }

    return all.map(l => {
      const uhl = userHLMap.get(l.id);
      return {
        ...l,
        level: uhl?.level || 0,
        fragments: uhl?.fragments || 0,
        is_equipped: uhl?.is_equipped || 0
      };
    });
  }

  /**
   * Lấy danh sách 3 Tâm Pháp đang trang bị
   */
  public getEquippedHeartLaws(userId: string): HeartLawWithProgress[] {
    return this.getUserHeartLaws(userId).filter(l => l.is_equipped > 0).sort((a, b) => a.is_equipped - b.is_equipped);
  }

  /**
   * Thêm mảnh Tâm Pháp (đại diện cho việc ghép hoặc lượm mảnh)
   */
  public addFragments(userId: string, lawId: string, amount: number): void {
    let row = db.prepare('SELECT * FROM user_heart_laws WHERE user_id = ? AND heart_law_id = ?').get(userId, lawId) as UserHeartLaw | undefined;
    if (!row) {
      db.prepare(`
        INSERT INTO user_heart_laws (user_id, heart_law_id, level, fragments, is_equipped)
        VALUES (?, ?, 0, ?, 0)
      `).run(userId, lawId, amount);
    } else {
      db.prepare('UPDATE user_heart_laws SET fragments = fragments + ? WHERE user_id = ? AND heart_law_id = ?').run(amount, userId, lawId);
    }
  }

  /**
   * Lĩnh ngộ Tâm Pháp từ mảnh ghép (cần 5 mảnh để kích hoạt cấp 1)
   */
  public learnHeartLaw(userId: string, lawId: string): { success: boolean; message: string } {
    const row = db.prepare('SELECT * FROM user_heart_laws WHERE user_id = ? AND heart_law_id = ?').get(userId, lawId) as UserHeartLaw | undefined;
    if (!row || row.fragments < 5) {
      return { success: false, message: 'Đạo hữu không đủ 5 mảnh Tâm Pháp để lĩnh ngộ!' };
    }
    if (row.level > 0) {
      return { success: false, message: 'Tâm Pháp này đã được lĩnh ngộ rồi! Hãy dùng lệnh nâng cấp.' };
    }

    db.transaction(() => {
      db.prepare('UPDATE user_heart_laws SET level = 1, fragments = fragments - 5 WHERE user_id = ? AND heart_law_id = ?').run(userId, lawId);
    })();

    const law = this.getHeartLaw(lawId)!;
    return { success: true, message: `Lĩnh ngộ thành công Tâm Pháp **[${law.name}]** cấp 1!` };
  }

  /**
   * Trang bị Tâm Pháp vào 1 ô (1, 2, 3)
   */
  public equipHeartLaw(userId: string, lawId: string, slot: number): { success: boolean; message: string } {
    if (![1, 2, 3].includes(slot)) {
      return { success: false, message: 'Chỉ có thể trang bị vào ô số 1, 2 hoặc 3!' };
    }

    const userLaws = this.getUserHeartLaws(userId);
    const target = userLaws.find(l => l.id === lawId);
    if (!target || target.level === 0) {
      return { success: false, message: 'Đạo hữu chưa lĩnh ngộ Tâm Pháp này!' };
    }

    db.transaction(() => {
      // 1. Tháo Tâm Pháp ở ô này nếu có
      db.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND is_equipped = ?').run(userId, slot);
      // 2. Tháo Tâm Pháp này ở ô khác nếu đang trang bị
      db.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND heart_law_id = ?').run(userId, lawId);
      // 3. Trang bị vào ô mong muốn
      db.prepare('UPDATE user_heart_laws SET is_equipped = ? WHERE user_id = ? AND heart_law_id = ?').run(slot, userId, lawId);
    })();

    return { success: true, message: `Đã trang bị Tâm Pháp **[${target.name}]** vào ô số **${slot}**!` };
  }

  /**
   * Tháo trang bị Tâm Pháp ở cụ thể
   */
  public unequipHeartLaw(userId: string, slot: number): { success: boolean; message: string } {
    if (![1, 2, 3].includes(slot)) {
      return { success: false, message: 'Ô trang bị không hợp lệ!' };
    }

    const equipped = this.getEquippedHeartLaws(userId).find(l => l.is_equipped === slot);
    if (!equipped) {
      return { success: false, message: `Ô số **${slot}** hiện đang trống!` };
    }

    db.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND is_equipped = ?').run(userId, slot);
    return { success: true, message: `Đã tháo Tâm Pháp **[${equipped.name}]** khỏi ô số **${slot}**!` };
  }

  /**
   * Nâng cấp Tâm Pháp hiện tại (Cấp 1 - 10)
   */
  public levelUpHeartLaw(userId: string, lawId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };

    const userLaws = this.getUserHeartLaws(userId);
    const target = userLaws.find(l => l.id === lawId);
    if (!target || target.level === 0) {
      return { success: false, message: 'Đạo hữu chưa lĩnh ngộ Tâm Pháp này!' };
    }

    if (target.level >= 10) {
      return { success: false, message: 'Tâm Pháp đã đạt cấp độ tối đa (cấp 10)!' };
    }

    const nextLevel = target.level + 1;
    const fragCost = target.level * 5;
    const coinCost = target.level * 1000;
    const ngoTinhCost = Math.floor(target.level / 2) + 1;

    if (target.fragments < fragCost) {
      return { success: false, message: `Không đủ mạnh ghép! Yêu cầu **${fragCost}** mạnh Tâm Pháp (Hiện có **${target.fragments}**).` };
    }

    if (user.coin_ha_pham < coinCost) {
      return { success: false, message: `Không đủ Linh Thạch! Yêu cầu **${coinCost.toLocaleString()}** Hạ Phẩm Linh Thạch (Hiện có **${user.coin_ha_pham.toLocaleString()}**).` };
    }

    if (user.ngotinh < ngoTinhCost) {
      return { success: false, message: `Không đủ Ngộ Tính! Yêu cầu **${ngoTinhCost}** điểm Ngộ Tính (Hiện có **${user.ngotinh}**).` };
    }

    db.transaction(() => {
      userRepository.update(userId, {
        coin_ha_pham: user.coin_ha_pham - coinCost,
        ngotinh: user.ngotinh - ngoTinhCost
      });
      db.prepare('UPDATE user_heart_laws SET level = ?, fragments = fragments - ? WHERE user_id = ? AND heart_law_id = ?')
        .run(nextLevel, fragCost, userId, lawId);
    })();

    return { success: true, message: `Đột phá thành công Tâm Pháp **[${target.name}]** thăng lên **Cấp ${nextLevel}**!` };
  }

  /**
   * P1-07: Tính set bonus — đếm số lượng equipped laws theo element
   */
  public getSetBonuses(userId: string): { element: string; count: number; has2Set: boolean; has3Set: boolean; ability: HeartLawSetAbility | null }[] {
    const equipped = this.getEquippedHeartLaws(userId);
    const elementCounts: Record<string, number> = {};

    for (const law of equipped) {
      if (law.element && law.element !== VO) {
        elementCounts[law.element] = (elementCounts[law.element] || 0) + 1;
      }
    }

    return Object.entries(elementCounts).map(([element, count]) => ({
      element,
      count,
      has2Set: count >= 2,
      has3Set: count >= 3,
      ability: count >= 3 ? HEART_LAW_SET_ABILITIES[element] || null : null
    })).filter(s => s.count >= 2);
  }

  /**
   * P1-07: Lấy thông tin set ability cho element cụ thể
   */
  public getSetAbility(element: string): HeartLawSetAbility | null {
    return HEART_LAW_SET_ABILITIES[element] || null;
  }

  /**
   * Tính toán chỉ số buff Tâm Pháp đang mang (đã tính cộng hưởng huyết mạch + set bonus)
   */
  public getActivePassives(userId: string): { type: string; value: number; lawName: string; element: string; scale: number }[] {
    const equipped = this.getEquippedHeartLaws(userId);
    if (equipped.length === 0) return [];

    let bloodlineId = '';
    try {
      const bl = db.prepare('SELECT bloodline_id FROM user_bloodlines WHERE user_id = ?').get(userId) as { bloodline_id: string } | undefined;
      if (bl) bloodlineId = bl.bloodline_id;
    } catch(e) { console.warn('Claude-Opus Failed to fetch user bloodline:', e); }

    const bloodlineElementMap: Record<string, string> = {
      'phuong_hoang': HOA,
      'huyen_vu': THUY,
      'con_luan': THO,
      'bach_ho': KIM,
      'thanh_long': MOC,
      'long_huyet': HOA
    };

    const userElement = bloodlineElementMap[bloodlineId] || VO;

    // P1-07: Calculate set bonuses for 2-set effect (+10% effect value)
    const setBonuses = this.getSetBonuses(userId);
    const setBonusElements = new Set(setBonuses.filter(s => s.has2Set).map(s => s.element));

    return equipped.map(l => {
      let effectObj = { type: '', value: 0 };
      try {
        effectObj = JSON.parse(l.base_effect);
      } catch(e) { console.warn('Claude-Opus Failed to parse heart law base_effect:', e); }

      let baseVal = effectObj.value * (1 + (l.level - 1) * 0.1);
      let scale = 1.0;

      if (l.element !== VO) {
        if (l.element === userElement) {
          scale = 1.5;
        } else if (userElement !== VO) {
          scale = 0.8;
        }
      }

      // P1-07: 2-set bonus: +10% effect value for same-element laws
      const setMultiplier = setBonusElements.has(l.element) ? 1.10 : 1.0;

      return {
        type: effectObj.type,
        value: baseVal * scale * setMultiplier,
        lawName: l.name,
        element: l.element,
        scale: scale * setMultiplier
      };
    });
  }

  /**
   * P1-07: Lấy mô tả set bonus cho UI
   */
  public getSetBonusDescription(userId: string): string {
    const sets = this.getSetBonuses(userId);
    if (sets.length === 0) return '';

    let desc = '**Thưởng Bộ Tâm Pháp:**\n';
    for (const set of sets) {
      if (set.has3Set) {
        desc += `• **${set.element}** (3-set): +10% hiệu quả + Kích hoạt **${set.ability?.name || '???'}**\n`;
        desc += `  └ ${set.ability?.description || ''}\n`;
      } else if (set.has2Set) {
        desc += `• **${set.element}** (2-set): +10% hiệu quả Tâm Pháp\n`;
      }
    }
    return desc;
  }
}

export const heartLawService = new HeartLawService();
