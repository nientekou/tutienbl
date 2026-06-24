import { userRepository } from '../database/repositories/UserRepository';
import { getRealmDetails } from '../utils/constants';
import { inventoryRepository as invRepo, InventoryItem } from '../database/repositories/InventoryRepository';
import db from '../database/database';
import { ITEMS, isWeaponId, isArmorId, isSeedId, getPhoiWeaponByGrade, getPhoiArmorByGrade, getWeaponByGrade, getArmorByGrade } from '../config/itemConstants';


export interface ActiveStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  crit: number;
  critRes: number;
  luck: number;
  speed: number;
  dodge: number;
  block_chance: number;
  elementResonance?: ElementResonanceInfo | null;
}

export interface ElementResonanceInfo {
  element: string;
  buff?: string;
  resonance: boolean;
  buffs: string[];
  // Các chỉ số cộng hưởng
  atkPercent?: number;
  hpPercent?: number;
  defPercent?: number;
  critBonus?: number;
  critDmgBonus?: number;
  armorPierce?: number;
  lifesteal?: number;
  hpRegenPercent?: number;
  dodgeBonus?: number;
  accuracyBonus?: number;
  controlBonus?: number;
  burnChance?: number;
  controlResist?: number;
  thornsPercent?: number;
}

export class InventoryService {
  private statsCache = new Map<string, { stats: ActiveStats, cachedAt: number }>();
  private readonly STATS_CACHE_TTL_MS = 30000; // 30 seconds

  /**
   * Tính toán cộng hưởng Linh Căn với kỹ năng/tâm pháp đang trang bị
   */
  public computeElementResonance(userId: string): ElementResonanceInfo {
    const user = userRepository.get(userId);
    if (!user) return { element: '', resonance: false, buffs: [] };

    // 1. Tìm linh căn mạnh nhất
    let linhCan: Record<string, number> = {};
    try { linhCan = JSON.parse(user.linh_can); } catch { return { element: '', resonance: false, buffs: [] }; }

    const elements = Object.entries(linhCan).sort((a, b) => b[1] - a[1]);
    if (elements.length === 0) return { element: '', resonance: false, buffs: [] };

    const strongestElement = elements[0][0];
    const strongestPct = elements[0][1];

    // 2. Kiểm tra kỹ năng đang trang bị có cùng hệ không
    const equippedSkills = db.prepare("SELECT skill_id FROM user_skills WHERE user_id = ? AND is_equipped = 1").all(userId) as { skill_id: string }[];

    const SKILL_DETAILS: Record<string, { name: string; element: string; desc: string }> = {
      skill_fire: { name: 'Liệt Diễm Quyết 🔥', element: 'Hỏa', desc: '' },
      skill_water: { name: 'Thủy Linh Quyết 💧', element: 'Thủy', desc: '' },
      skill_wood: { name: 'Hấp Huyết Quyết 🌿', element: 'Mộc', desc: '' },
      skill_earth: { name: 'Thổ Giáp Quyết 🪨', element: 'Thổ', desc: '' },
      skill_wind: { name: 'Phong Hành Quyết 🌀', element: 'Phong', desc: '' },
      skill_lightning: { name: 'Lôi Phạt Quyết ⚡', element: 'Lôi', desc: '' }
    };

    const hasMatchingSkill = equippedSkills.some(s => {
      const detail = SKILL_DETAILS[s.skill_id];
      return detail && detail.element === strongestElement;
    });

    // 3. Kiểm tra tâm pháp đang trang bị có cùng hệ không
    const equippedHeartLaws = db.prepare(`
      SELECT hl.id, hl.name, hl.element
      FROM user_heart_laws uhl
      JOIN heart_laws hl ON uhl.heart_law_id = hl.id
      WHERE uhl.user_id = ? AND uhl.is_equipped > 0
    `).all(userId) as { id: string; name: string; element: string }[];

    const hasMatchingHeartLaw = equippedHeartLaws.some(hl => hl.element === strongestElement);

    // 4. Nếu có cộng hưởng
    const resonance = (hasMatchingSkill || hasMatchingHeartLaw) && strongestPct >= 40;
    if (!resonance) {
      return { element: strongestElement, resonance: false, buffs: [] };
    }

    // 5. Tra bảng buff theo linh căn
    const result: ElementResonanceInfo = {
      element: strongestElement,
      resonance: true,
      buffs: [],
      atkPercent: 0,
      hpPercent: 0,
      defPercent: 0,
      critBonus: 0,
      critDmgBonus: 0,
      armorPierce: 0,
      lifesteal: 0,
      hpRegenPercent: 0,
      dodgeBonus: 0,
      accuracyBonus: 0,
      controlBonus: 0,
      burnChance: 0,
      controlResist: 0,
      thornsPercent: 0,
    };

    switch (strongestElement) {
      case 'Kim':
        result.atkPercent = 0.15;
        result.armorPierce = 0.10;
        result.critBonus = 0.05;
        result.buff = 'Kim +15% Vật Công, +10% Xuyên Giáp, +5% Bạo Kích';
        result.buffs = ['+15% Vật Công', '+10% Xuyên Giáp', '+5% Bạo Kích'];
        break;
      case 'Mộc':
        result.hpPercent = 0.10;
        result.lifesteal = 0.05;
        result.hpRegenPercent = 0.02;
        result.buff = 'Mộc +10% Max HP, +5% Hút Máu, Hồi 2% HP/lượt';
        result.buffs = ['+10% Max HP', '+5% Hút Máu', 'Hồi 2% HP/lượt'];
        break;
      case 'Thủy':
        result.dodgeBonus = 0.15;
        result.accuracyBonus = 0.10;
        result.controlBonus = 0.05;
        result.buff = 'Thủy +15% Thân Pháp, +10% Chính Xác, +5% Khống Chế';
        result.buffs = ['+15% Thân Pháp', '+10% Chính Xác', '+5% Khống Chế'];
        break;
      case 'Hỏa':
        result.atkPercent = 0.15;
        result.critDmgBonus = 0.15;
        result.burnChance = 0.15;
        result.buff = 'Hỏa +15% Pháp Công, +15% Sát Thương Bạo Kích, 15% Thiêu Đốt';
        result.buffs = ['+15% Pháp Công', '+15% Sát Thương Bạo Kích', '15% Thiêu Đốt'];
        break;
      case 'Thổ':
        result.defPercent = 0.20;
        result.controlResist = 0.10;
        result.thornsPercent = 0.08;
        result.buff = 'Thổ +20% Phòng Thủ, +10% Kháng Khống Chế, +8% Phản Thương';
        result.buffs = ['+20% Phòng Thủ', '+10% Kháng Khống Chế', '+8% Phản Thương'];
        break;
      default:
        result.buff = '';
        result.buffs = [];
    }

    return result;
  }

  /**
    * Tính toán toàn bộ chỉ số thực tế của tu sĩ (Base + Điểm Trang Bị + Ý Cảnh + Tông Môn + Cộng Hưởng Linh Căn)
    */
  public getActiveStats(userId: string): ActiveStats | null {
    const now = Date.now();
    const cached = this.statsCache.get(userId);
    if (cached && now - cached.cachedAt < this.STATS_CACHE_TTL_MS) {
      return { ...cached.stats };
    }
    const user = userRepository.get(userId);
    if (!user) return null;

    const stats: ActiveStats = {
      hp: user.base_hp,
      mp: user.base_mp,
      atk: user.base_atk,
      def: user.base_def,
      crit: user.base_crit,
      critRes: user.base_crit_res,
      luck: user.base_luck,
      speed: user.base_speed ?? 100,
      dodge: (user.base_dodge ?? 0.05) + ((user.alignment === 'neutral' || !user.alignment) ? 0.05 : 0),
      block_chance: 0.05,
    };

    // Cộng hưởng từ Ý Cảnh (Ý Cảnh & Đạo Quả)
    try {
      const yCanh: Record<string, number> = JSON.parse(user.y_canh || '{}');
      if (yCanh.KiemY) {
        stats.atk += Math.round(user.base_atk * (yCanh.KiemY * 0.03)); // 3% base ATK mỗi cấp Kiếm Ý
      }
      if (yCanh.BatDietY) {
        stats.hp += Math.round(user.base_hp * (yCanh.BatDietY * 0.03)); // 3% base HP mỗi cấp Bất Diệt Ý
      }
      if (yCanh.HuyenQuyY) {
        stats.def += Math.round(user.base_def * (yCanh.HuyenQuyY * 0.03)); // 3% base DEF mỗi cấp Huyền Quy Ý
      }
    } catch (e) {
      // Bỏ qua lỗi JSON
    }

    // Cộng hưởng từ Tông Môn
    if (user.sect_id) {
      try {
        const sect = db.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id) as { level: number } | undefined;
        if (sect) {
          stats.atk += Math.round(user.base_atk * (sect.level * 0.02)); // +2% ATK mỗi cấp Tông môn
          stats.def += Math.round(user.base_def * (sect.level * 0.02)); // +2% DEF mỗi cấp Tông môn
          stats.hp += Math.round(user.base_hp * (sect.level * 0.02));   // +2% HP mỗi cấp Tông môn
        }
      } catch (e) {
        // Bỏ qua lỗi SQL
      }
    }

    // Lấy danh sách trang bị đang đeo
    const inventory = invRepo.getUserInventory(userId);
    const equippedItems = inventory.filter(i => i.is_equipped === 1);

    const multipliers = {
      hp: 1,
      mp: 1,
      atk: 1,
      def: 1,
      speed: 1
    };

    for (const item of equippedItems) {
      try {
        // Tính hệ số độ bền: nếu durability <= 0, chỉ được 50% chỉ số
        const durability = item.durability ?? 100;
        const durabilityMult = durability > 0 ? 1.0 : 0.5;

        const baseBonus = JSON.parse(item.base_stats || '{}');
        const starMult = 1 + (item.stars || 0) * 0.20;
        const enhanceMult = 1 + (item.enhance_level || 0) * 0.10;
        const boundMult = item.is_life_bound === 1 ? 1 + (item.bound_level || 1) * 0.05 : 1.0;

        const bonus = {
          hp: Math.round((baseBonus.hp || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          mp: Math.round((baseBonus.mp || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          atk: Math.round((baseBonus.atk || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          def: Math.round((baseBonus.def || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          crit: (baseBonus.crit || 0) * starMult * enhanceMult * durabilityMult * boundMult,
          crit_res: (baseBonus.crit_res || 0) * starMult * enhanceMult * durabilityMult * boundMult,
          luck: Math.round((baseBonus.luck || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          speed: Math.round((baseBonus.speed || 0) * starMult * enhanceMult * durabilityMult * boundMult),
          dodge: (baseBonus.dodge || 0) * starMult * enhanceMult * durabilityMult * boundMult,
          hp_percent: (baseBonus.hp_percent || 0) * starMult * enhanceMult * durabilityMult,
          mp_percent: (baseBonus.mp_percent || 0) * starMult * enhanceMult * durabilityMult,
          atk_percent: (baseBonus.atk_percent || 0) * starMult * enhanceMult * durabilityMult,
          def_percent: (baseBonus.def_percent || 0) * starMult * enhanceMult * durabilityMult,
          speed_percent: (baseBonus.speed_percent || 0) * starMult * enhanceMult * durabilityMult
        };

        if (bonus.hp) stats.hp += bonus.hp;
        if (bonus.mp) stats.mp += bonus.mp;
        if (bonus.atk) stats.atk += bonus.atk;
        if (bonus.def) stats.def += bonus.def;
        if (bonus.crit) stats.crit += bonus.crit;
        if (bonus.crit_res) stats.critRes += bonus.crit_res;
        if (bonus.luck) stats.luck += bonus.luck;
        if (bonus.speed) stats.speed += bonus.speed;
        if (bonus.dodge) stats.dodge += bonus.dodge;

        if (bonus.hp_percent) multipliers.hp += bonus.hp_percent;
        if (bonus.mp_percent) multipliers.mp += bonus.mp_percent;
        if (bonus.atk_percent) multipliers.atk += bonus.atk_percent;
        if (bonus.def_percent) multipliers.def += bonus.def_percent;
        if (bonus.speed_percent) multipliers.speed += bonus.speed_percent;

        // Cộng thêm từ chỉ số rèn ngẫu nhiên (nếu có)
        if (item.custom_stats) {
          const customBonus = JSON.parse(item.custom_stats);
          if (customBonus.hp) stats.hp += Math.round(customBonus.hp * durabilityMult * boundMult);
          if (customBonus.mp) stats.mp += Math.round(customBonus.mp * durabilityMult * boundMult);
          if (customBonus.atk) stats.atk += Math.round(customBonus.atk * durabilityMult * boundMult);
          if (customBonus.def) stats.def += Math.round(customBonus.def * durabilityMult * boundMult);
          if (customBonus.crit) stats.crit += customBonus.crit * durabilityMult * boundMult;
          if (customBonus.luck) stats.luck += Math.round(customBonus.luck * durabilityMult * boundMult);
          if (customBonus.speed) stats.speed += Math.round(customBonus.speed * durabilityMult * boundMult);
          if (customBonus.dodge) stats.dodge += customBonus.dodge * durabilityMult * boundMult;
          
          if (customBonus.hp_percent) multipliers.hp += customBonus.hp_percent * durabilityMult;
          if (customBonus.mp_percent) multipliers.mp += customBonus.mp_percent * durabilityMult;
          if (customBonus.atk_percent) multipliers.atk += customBonus.atk_percent * durabilityMult;
          if (customBonus.def_percent) multipliers.def += customBonus.def_percent * durabilityMult;
          if (customBonus.speed_percent) multipliers.speed += customBonus.speed_percent * durabilityMult;

          // ponytail: đồ tự rèn +2% all stats
          if (customBonus.forge_bonus === true) {
            multipliers.hp += 0.02;
            multipliers.mp += 0.02;
            multipliers.atk += 0.02;
            multipliers.def += 0.02;
            multipliers.speed += 0.02;
          }
        }
      } catch (e) {
        // Bỏ qua lỗi JSON
      }
    }

    // --- Tính năng Ấn Ký Linh Hồn (Soul Imprint) ---
    try {
      const { soulImprintService } = require('./SoulImprintService');
      const imprintStats = soulImprintService.getImprintStats(userId);
      for (const [key, val] of Object.entries(imprintStats)) {
        const v = val as number;
        if (key === 'hp') stats.hp += v;
        else if (key === 'mp') stats.mp += v;
        else if (key === 'atk') stats.atk += v;
        else if (key === 'def') stats.def += v;
        else if (key === 'crit') stats.crit += v;
        else if (key === 'crit_res') stats.critRes += v;
        else if (key === 'luck') stats.luck += v;
        else if (key === 'speed') stats.speed += v;
        else if (key === 'dodge') stats.dodge += v;
        else if (key === 'hp_percent') multipliers.hp += v;
        else if (key === 'mp_percent') multipliers.mp += v;
        else if (key === 'atk_percent') multipliers.atk += v;
        else if (key === 'def_percent') multipliers.def += v;
        else if (key === 'speed_percent') multipliers.speed += v;
      }

      const setBonuses = soulImprintService.getSetBonuses(userId);
      stats.atk += setBonuses.atk;
      stats.crit += setBonuses.crit;
    } catch (e) { console.warn('[InventoryService] Failed to calculate soul imprint stats:', e); }

    // --- Tính năng Mệnh Cách (Destiny) ---
    try {
      const { destinyService } = require('./DestinyService');
      const destinyBonus = destinyService.calculateDestinyBonus(userId);
      multipliers.hp += destinyBonus.hp_percent || 0;
      multipliers.atk += destinyBonus.atk_percent || 0;
      multipliers.def += destinyBonus.def_percent || 0;
      multipliers.speed += destinyBonus.speed_bonus || 0;
      stats.crit += destinyBonus.crit_rate || 0;
      stats.dodge += destinyBonus.dodge_rate || 0;
    } catch (e) { console.warn('[InventoryService] Failed to calculate destiny bonus:', e); }

    // --- Tính năng Pháp Bảo Bản Mệnh ---
    try {
      const { soulWeaponRepository } = require('../database/repositories/SoulWeaponRepository');
      const sw = soulWeaponRepository.getByUserId(userId);
      if (sw) {
        if (sw.type === 'kiem') {
          stats.atk += sw.level * 10;
          stats.crit += (sw.level * 0.001); 
        } else if (sw.type === 'dinh') {
          stats.def += sw.level * 10;
          stats.hp += sw.level * 100;
          stats.critRes += (sw.level * 0.001); 
        } else if (sw.type === 'an') {
          stats.hp += sw.level * 150;
          stats.speed += sw.level * 2;
          stats.dodge += (sw.level * 0.001); 
        }
      }
    } catch (e) { console.warn('[InventoryService] Failed to fetch soul weapon stats:', e); }

    // --- Tính năng Đạo Lữ (Song Tu) ---
    try {
      const { coupleRepository } = require('../database/repositories/CoupleRepository');
      const couple = coupleRepository.getCoupleByUserId(userId);
      if (couple) {
        const buffPercent = Math.floor(couple.intimacy / 100) * 0.01;
        if (buffPercent > 0) {
          const finalBuff = Math.min(0.20, buffPercent);
          multipliers.hp += finalBuff;
          multipliers.atk += finalBuff;
        }
      }
    } catch (e) { console.warn('[InventoryService] Failed to calculate couple (dao lu) buff:', e); }

    // --- Tính năng Danh Hiệu (Title Buffs) ---
    if (user.title) {
      if (user.title === 'Thiên Trụ') {
        multipliers.hp += 0.05;
        multipliers.atk += 0.05;
        multipliers.def += 0.05;
      } else if (user.title === 'Thánh Địa Bá Chủ') {
        multipliers.atk += 0.05;
      } else if (user.title === 'Chiến Thần Vô Song') {
        multipliers.atk += 0.08;
      } else if (user.title === 'Truyền Thừa Danh Môn') {
        multipliers.def += 0.05;
      }
    }

    // --- Cộng Hưởng Linh Căn (Element Resonance) ---
    const resonance = this.computeElementResonance(userId);
    if (resonance.resonance) {
      if (resonance.atkPercent) multipliers.atk += resonance.atkPercent;
      if (resonance.hpPercent) multipliers.hp += resonance.hpPercent;
      if (resonance.defPercent) multipliers.def += resonance.defPercent;
      if (resonance.critBonus) stats.crit += resonance.critBonus;
      if (resonance.dodgeBonus) stats.dodge += resonance.dodgeBonus;
      stats.elementResonance = resonance;
    } else {
      stats.elementResonance = resonance; // lưu cả khi không resonance để hiển thị
    }

    // Áp dụng % multipliers vào final stats
    stats.hp = Math.round(stats.hp * multipliers.hp);
    stats.mp = Math.round(stats.mp * multipliers.mp);
    stats.atk = Math.round(stats.atk * multipliers.atk);
    stats.def = Math.round(stats.def * multipliers.def);
    stats.speed = Math.round(stats.speed * multipliers.speed);

    this.statsCache.set(userId, { stats: { ...stats }, cachedAt: now });

    return stats;
  }

  public invalidateStatsCache(userId: string): void {
    this.statsCache.delete(userId);
  }

  /**
   * Đeo trang bị từ túi đồ
   */
  public equipItem(userId: string, inventoryId: number): { success: boolean; message: string } {
    const item = invRepo.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại trong túi đồ của đạo hữu.' };
    }

    if (item.equipable !== 1) {
      return { success: false, message: 'Vật phẩm này không thể trang bị!' };
    }

    if (item.is_equipped === 1) {
      return { success: false, message: 'Đạo hữu đã trang bị vật phẩm này rồi.' };
    }

    // Xác định slot trang bị dựa trên ID vật phẩm
    let slot = 'weapon';
    if (isWeaponId(item.item_id)) slot = 'weapon';
    else if (isArmorId(item.item_id) || item.item_id.startsWith('robe_')) slot = 'armor';
    else if (item.item_id.startsWith('ring_')) slot = 'ring';
    else if (item.item_id.startsWith('necklace_')) slot = 'necklace';
    else if (item.item_id.startsWith('amulet_')) slot = 'amulet';
    else if (item.item_id.startsWith('pendant_') || item.item_id.startsWith('boi_pham_')) slot = 'pendant';
    else if (item.item_id.startsWith('mount_')) slot = 'mount';
    else slot = 'treasure'; // Pháp bảo

    // Tìm và tháo trang bị cũ trong slot đó (nếu có)
    const currentlyEquipped = invRepo.getEquippedInSlot(userId, slot);
    if (currentlyEquipped) {
      invRepo.updateEquipmentStatus(currentlyEquipped.id, 0, null);
    }

    // Đeo trang bị mới
    invRepo.updateEquipmentStatus(inventoryId, 1, slot);

    return { 
      success: true, 
      message: `Đạo hữu đã trang bị **${item.name}** vào ô **[${slot.toUpperCase()}]**!` 
    };
  }

  /**
   * Tháo trang bị đang đeo
   */
  public unequipItem(userId: string, inventoryId: number): { success: boolean; message: string } {
    const item = invRepo.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại.' };
    }

    if (item.is_equipped !== 1) {
      return { success: false, message: 'Trang bị này hiện không được đạo hữu mặc trên người.' };
    }

    invRepo.updateEquipmentStatus(inventoryId, 0, null);
    return { success: true, message: `Đạo hữu đã tháo **${item.name}** ra khỏi người.` };
  }

  /**
   * Trang bị vật phẩm bằng item_id (string)
   */
  public equipItemByItemId(userId: string, itemId: string): { success: boolean; message: string } {
    const item = invRepo.getByUserIdAndItemId(userId, itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại trong túi đồ của đạo hữu.' };
    }
    return this.equipItem(userId, item.id);
  }

  /**
   * Tháo trang bị bằng item_id (string)
   */
  public unequipItemByItemId(userId: string, itemId: string): { success: boolean; message: string } {
    const item = invRepo.getByUserIdAndItemId(userId, itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại.' };
    }
    return this.unequipItem(userId, item.id);
  }

  /**
   * Sử dụng vật phẩm bằng item_id (string)
   */
  public useItemByItemId(userId: string, itemId: string): { success: boolean; message: string } {
    const item = invRepo.getByUserIdAndItemId(userId, itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại trong túi đồ.' };
    }
    return this.useItem(userId, item.id);
  }

  /**
   * Sử dụng vật phẩm đan dược hoặc phù lục từ túi đồ
   */
  public useItem(userId: string, inventoryId: number): { success: boolean; message: string } {
    const item = invRepo.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại trong túi đồ.' };
    }

    if (item.usable !== 1) {
      return { success: false, message: 'Vật phẩm này không thể sử dụng trực tiếp.' };
    }

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };

    try {
      const stats = JSON.parse(item.base_stats || '{}');

      // 1. Nếu là vật phẩm phụ trợ, nguyên liệu sửa chữa hoặc bùa gia tốc -> chặn không cho dùng trực tiếp
      const catalystItems: string[] = [
        ITEMS.PILL_BREAK_1,
        ITEMS.PILL_BREAK_MINOR_1,
        ITEMS.PILL_BREAK_MINOR_2,
        ITEMS.PILL_BREAK_MINOR_3,
        ITEMS.PILL_ALCHEMY_BREAK,
        ITEMS.PILL_ALCHEMY_ANTI_LOI,
        ITEMS.TALISMAN_ANTI_LOI,
        ITEMS.TALISMAN_SPEED_1,
        ITEMS.REPAIR_STONE_LOW,
        ITEMS.REPAIR_STONE_MID,
        ITEMS.REPAIR_STONE_HIGH,
        ITEMS.ITEM_NHAN_DINH_HON,
        ITEMS.ITEM_BLOODLINE_PILL,
        ITEMS.TINH_THACH_SHARD,
        ITEMS.ITEM_FRAGMENT,
        ITEMS.MANH_VO_VU_KHI
      ];

      const isPhoi = item.item_id.startsWith('phoi_');

      if (catalystItems.includes(item.item_id) || isPhoi) {
        let usageHelp = '';
        if (item.item_id === ITEMS.PILL_BREAK_1 || item.item_id === ITEMS.PILL_ALCHEMY_BREAK) {
          usageHelp = `chất xúc tác hỗ trợ đột phá cảnh giới lớn (ví dụ: Luyện Khí Kỳ -> Trúc Cơ Kỳ) khi thực hiện lệnh \`/dotpha\`!`;
        } else if (item.item_id.startsWith('pill_break_minor_')) {
          usageHelp = `chất xúc tác tăng tỷ lệ thành công khi đột phá tầng nhỏ trong giao diện lệnh \`/dotpha\`!`;
        } else if (item.item_id === ITEMS.PILL_ALCHEMY_ANTI_LOI || item.item_id === ITEMS.TALISMAN_ANTI_LOI) {
          usageHelp = `vật phẩm hộ thân giúp chống đỡ lôi kiếp, giảm thiểu sát thương nhận vào khi vượt Thiên Kiếp!`;
        } else if (item.item_id === ITEMS.TALISMAN_SPEED_1) {
          usageHelp = `bùa gia tốc để rút ngắn thời gian thám hiểm trong lệnh \`/khambha\` hoặc thúc đẩy linh dược tăng trưởng trong lệnh \`/linhdien\`!`;
        } else if (item.item_id.startsWith('repair_stone_')) {
          usageHelp = `nguyên liệu dưỡng thạch dùng để sửa chữa pháp bảo/đạo bảo bị hao mòn độ bền qua lệnh \`/suachua\`!`;
        } else if (item.item_id === ITEMS.ITEM_NHAN_DINH_HON) {
          usageHelp = `tín vật định tình linh thiêng để tiến hành cầu hôn và lập kết đạo lữ với tu sĩ khác qua lệnh \`/ketduyen\`!`;
        } else if (item.item_id === ITEMS.ITEM_BLOODLINE_PILL) {
          usageHelp = `linh đan nghịch thiên cải mệnh dùng để thay đổi (reset) Huyết Mạch Thượng Cổ của đạo hữu trong giao diện lệnh \`/huyetmach\`!`;
        } else if (item.item_id === ITEMS.TINH_THACH_SHARD) {
          usageHelp = `nguyên liệu tinh thạch chứa năng lượng linh khí dồi dào, dùng làm chất xúc tác quý khi thức tỉnh Khí Linh hoặc cường hóa nâng sao trang bị!`;
        } else if (item.item_id === ITEMS.ITEM_FRAGMENT || item.item_id === ITEMS.MANH_VO_VU_KHI) {
          usageHelp = `mảnh vỡ trang bị dùng để rèn ghép chế tác thành các phôi trang bị cao cấp hơn trong giao diện lệnh \`/trangbi ghep\`!`;
        } else if (isPhoi) {
          usageHelp = `phôi trang bị chỉ có thể mang giám định thành trang bị thực tế tại Luyện Khí Phường qua lệnh \`/trangbi giamdinh\`!`;
        }

        return {
          success: false,
          message: `Vật phẩm **${item.name}** chỉ có thể sử dụng làm ${usageHelp} Không thể sử dụng trực tiếp qua lệnh này.`
        };
      }

      // 2. Nếu là đan dược tăng Tu Vi
      if (stats.add_tu_vi || item.item_id === ITEMS.PILL_ALCHEMY_TUVI) {
        // Nhận Tu Vi offline trước để tránh bị reset mất
        const { cultivationService } = require('./CultivationService');
        cultivationService.claimIdleCultivation(userId);

        const freshUser = userRepository.get(userId)!;
        const { minorLevel } = getRealmDetails(freshUser.level);
        if (freshUser.tu_vi >= freshUser.exp_needed) {
          if (minorLevel === 38) {
            return { 
              success: false,
              message: `Tu vi của đạo hữu đã đạt cực hạn tầng ${minorLevel}, vui lòng thực hiện lệnh \`/dotpha\` để đột phá lên tầng tiếp theo trước khi dùng thuốc!`
            };
          }
        }

        // Kiểm tra biến dị
        let isEvolved = false;
        if (item.custom_stats) {
          try {
            const cs = JSON.parse(item.custom_stats);
            if (cs.evolved) isEvolved = true;
          } catch (e) { console.warn('[InventoryService] Failed to parse custom_stats for TuVi pill evolution:', e); }
        }

        const baseAdded = stats.add_tu_vi || 1000;
        const added = isEvolved ? baseAdded * 2 : baseAdded;
        const newTuVi = Math.min(freshUser.tu_vi + added, freshUser.exp_needed);
        userRepository.update(userId, { tu_vi: newTuVi });
        
        // Trừ 1 vật phẩm khỏi túi
        invRepo.removeItemById(inventoryId, 1);

        return { 
          success: true, 
          message: `Đạo hữu uống **${item.name}${isEvolved ? ' (Biến Dị 🧬)' : ''}**, đan dược hóa linh khí len lỏi khắp kinh mạch, tăng trực tiếp **+${added}** Tu Vi!` 
        };
      }

      // 3. Nếu là Đan Dược hồi thể lực (stamina)
      if (item.item_id === ITEMS.PILL_ALCHEMY_STAMINA || item.item_id === ITEMS.PILL_STAMINA_1 || item.item_id === ITEMS.PILL_STAMINA_2 || item.item_id === ITEMS.PILL_STAMINA_3) {
        // Kiểm tra biến dị
        let isEvolved = false;
        if (item.custom_stats) {
          try {
            const cs = JSON.parse(item.custom_stats);
            if (cs.evolved) isEvolved = true;
          } catch (e) { console.warn('[InventoryService] Failed to parse custom_stats for stamina pill evolution:', e); }
        }

        let yCanh: any = {};
        try {
          yCanh = JSON.parse(user.y_canh || '{}');
        } catch (e) {
          yCanh = {};
        }

        const today = new Date().toISOString().split('T')[0]; // Định dạng YYYY-MM-DD
        if (!yCanh.stamina_pills_today) {
          yCanh.stamina_pills_today = { date: today, count: 0 };
        }

        if (yCanh.stamina_pills_today.date !== today) {
          yCanh.stamina_pills_today.date = today;
          yCanh.stamina_pills_today.count = 0;
        }

        if (yCanh.stamina_pills_today.count >= 3) {
          return {
            success: false,
            message: `Đạo hữu đã sử dụng tối đa **3 viên** Đan Dược hồi thể lực trong ngày hôm nay! Hãy đợi qua ngày mai để dùng tiếp.`
          };
        }

        const baseRestore = stats.restore_stamina || 100;
        const restoreAmount = isEvolved ? baseRestore * 2 : baseRestore;
        const newStamina = Math.min(500, user.stamina + restoreAmount);

        yCanh.stamina_pills_today.count += 1;

        // Cập nhật Database
        db.transaction(() => {
          userRepository.update(userId, { stamina: newStamina, y_canh: JSON.stringify(yCanh) });
          invRepo.removeItemById(inventoryId, 1);
        })();

        return {
          success: true,
          message: `💊 Đạo hữu nuốt vào **${item.name}${isEvolved ? ' (Biến Dị 🧬)' : ''}**, khí huyết toàn thân bừng bừng sức sống, hồi phục **+${restoreAmount}** Thể Lực! (Hôm nay đã dùng: **${yCanh.stamina_pills_today.count}/3** viên).`
        };
      }

      // 3.5. Nếu là Bình Thể Lực Giới Hạn Tuần (potion_stamina_weekly)
      if (item.item_id === ITEMS.POTION_STAMINA_WEEKLY) {
        const restoreAmount = stats.restore_stamina || 150;
        const newStamina = Math.min(500, user.stamina + restoreAmount);

        db.transaction(() => {
          userRepository.update(userId, { stamina: newStamina });
          invRepo.removeItemById(inventoryId, 1);
        })();

        return {
          success: true,
          message: `💊 Đạo hữu uống **${item.name}**, cảm nhận dòng năng lượng thanh khiết bộc phát khắp tứ chi, hồi phục **+${restoreAmount}** Thể Lực! (Thể lực hiện có: **${newStamina}/500**)`
        };
      }

      // 3.6. Linh Tuyền Phù (no daily limit)
      if (item.item_id === ITEMS.PILL_LINH_TUYEN) {
        const restoreAmount = stats.restore_stamina || 200;
        const newStamina = Math.min(500, user.stamina + restoreAmount);

        db.transaction(() => {
          userRepository.update(userId, { stamina: newStamina });
          invRepo.removeItemById(inventoryId, 1);
        })();

        return {
          success: true,
          message: `💊 Đạo hữu sử dụng **${item.name}**, linh khí thanh tịnh tràn đầy thân thể, hồi phục **+${restoreAmount}** Thể Lực! (Thể lực hiện có: **${newStamina}/500**)`
        };
      }

      // 3.7. Nhàn Tu Đan (no offline decay for 24h)
      if (item.item_id === ITEMS.PILL_NHAN_TU) {
        const now = Math.floor(Date.now() / 1000);
        const yCanhData = JSON.parse(user.y_canh || '{}');
        yCanhData.idle_no_decay_until = now + 86400;

        db.transaction(() => {
          userRepository.update(userId, { y_canh: JSON.stringify(yCanhData) });
          invRepo.removeItemById(inventoryId, 1);
        })();

        return {
          success: true,
          message: `💊 Đạo hữu sử dụng **${item.name}**, tâm trí an định như nước, tu luyện ngoại tuyến sẽ không bị suy giảm hiệu suất trong **24 giờ**!`
        };
      }

      // --- Tẩy Tủy Đan ---
      if (item.item_id === ITEMS.PILL_TAY_TUY) {
        const { cultivationService } = require('./CultivationService');
        const newLinhCanJson = cultivationService.generateLinhCan();
        const newStats = cultivationService.calculateStatsForLevel(user.level, newLinhCanJson);

        db.transaction(() => {
          userRepository.update(userId, {
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
          invRepo.removeItemById(inventoryId, 1);
        })();

        const { formatLinhCan } = require('../utils/constants');
        const formattedLinhCan = formatLinhCan(newLinhCanJson);
        return {
          success: true,
          message: `🌀 **Tẩy Tủy Thành Công!** Đạo hữu uống Tẩy Tủy Đan, dược lực rửa sạch tạp chất kinh mạch, tái tạo Linh Căn mới: ${formattedLinhCan}`
        };
      }

      // --- Ý Cảnh Đan ---
      if (item.item_id === ITEMS.PILL_Y_CANH) {
        db.transaction(() => {
          userRepository.update(userId, { ngotinh: user.ngotinh + 30 });
          invRepo.removeItemById(inventoryId, 1);
        })();
        return {
          success: true,
          message: `💊 **Ngộ Ý Thành Công!** Đạo hữu uống Ý Cảnh Đan, thần thức sáng suốt, Ngộ Tính tăng vọt **+30** điểm (Hiện có: **${user.ngotinh + 30}** Ngộ Tính)!`
        };
      }

      // --- Đan dược tăng chỉ số vĩnh viễn (HP, ATK, DEF) ---
      if (stats.add_hp_perm || stats.add_atk_perm || stats.add_def_perm) {
        // ponytail: biến dị = x1.5 hiệu quả
        let isEvolved = false;
        if (item.custom_stats) {
          try { isEvolved = JSON.parse(item.custom_stats).evolved === true; } catch (e) {}
        }
        const evolveMult = isEvolved ? 1.5 : 1.0;

        let field = '';
        let amount = 0;
        let msg = '';
        
        if (stats.add_hp_perm) {
          field = 'base_hp';
          amount = Math.round(stats.add_hp_perm * evolveMult);
          msg = `💊 **Thần Dược Tăng HP!** Đạo hữu uống **${item.name}${isEvolved ? ' (Biến Dị 🧬)' : ''}**, dược lực tẩy tủy phạt cốt, tăng vĩnh viễn **+${amount}** HP cơ bản (Hiện có: **${user.base_hp + amount}** HP)!`;
        } else if (stats.add_atk_perm) {
          field = 'base_atk';
          amount = Math.round(stats.add_atk_perm * evolveMult);
          msg = `💊 **Thần Dược Tăng ATK!** Đạo hữu uống **${item.name}${isEvolved ? ' (Biến Dị 🧬)' : ''}**, khí lực tung hoành kinh mạch, tăng vĩnh viễn **+${amount}** Công Kích cơ bản (Hiện có: **${user.base_atk + amount}** ATK)!`;
        } else if (stats.add_def_perm) {
          field = 'base_def';
          amount = Math.round(stats.add_def_perm * evolveMult);
          msg = `💊 **Thần Dược Tăng DEF!** Đạo hữu uống **${item.name}${isEvolved ? ' (Biến Dị 🧬)' : ''}**, linh lực ngưng tụ hộ thể, tăng vĩnh viễn **+${amount}** Phòng Ngự cơ bản (Hiện có: **${user.base_def + amount}** DEF)!`;
        }

        db.transaction(() => {
          userRepository.update(userId, { [field]: (user as any)[field] + amount });
          invRepo.removeItemById(inventoryId, 1);
        })();
        
        return { success: true, message: msg };
      }

      // 4. Nếu là đan dược phục hồi HP (Immersive text)
      if (stats.restore_hp) {
        invRepo.removeItemById(inventoryId, 1);
        return { 
          success: true, 
          message: `Đạo hữu sử dụng **${item.name}**, dược tính thanh mát xoa dịu lục phủ ngũ tạng, cơ thể sinh lực dồi dào!` 
        };
      }

      // Nếu là Tuyệt Tình Nước (Ly hôn)
      if (item.item_id === ITEMS.ITEM_TUYET_TINH_NUOC) {
        const { marriageService } = require('./MarriageService');
        return marriageService.divorce(userId);
      }

      // 5. Nếu là Tàng Bảo Đồ
      if (item.item_id === ITEMS.TANG_BAO_DO) {
        const { treasureMapService } = require('./TreasureMapService');
        const map = treasureMapService.generateMap(userId, item.rarity);
        invRepo.removeItemById(inventoryId, 1);
        return {
          success: true,
          message: `🗺️ Đạo hữu mở Tàng Bảo Đồ ra xem...\nMột luồng sáng hiện lên chỉ dẫn đến tọa độ **[X: ${map.x}, Y: ${map.y}]**.\n\n*Hãy dùng lệnh \`/khambha toado ${map.x} ${map.y}\` để tiến hành đào kho báu!*`
        };
      }

      // 6. Nếu là Rương
      if (item.type === 'chest') {
        const { rewards, description } = this.openChests(user.name, item.item_id, 1);
        
        db.transaction(() => {
          invRepo.removeItemById(inventoryId, 1);
          for (const r of rewards) {
            invRepo.addItem(userId, r.itemId, r.quantity, r.customStats);
          }
        })();

        return {
          success: true,
          message: `🎁 Đạo hữu mở **${item.name}**:\n${description}`
        };
      }

      // 7. Nếu là sách kỹ năng (Bí tịch)
      if (item.type === 'book') {
        const DungKyNangCommand = require('../commands/general/dungkynang').default;
        const res = DungKyNangCommand.learnSkill(userId, item.item_id);
        return { success: res.success, message: res.message };
      }
      return { success: false, message: 'Hiệu ứng vật phẩm hiện chưa được hỗ trợ.' };
    } catch (e) {
      return { success: false, message: 'Lỗi cấu hình thuộc tính vật phẩm.' };
    }
  }

  /**
   * Liên kết Huyết Tế Bản Mệnh Pháp Bảo
   */
  public bindLifeArtifact(userId: string, inventoryId: number): { success: boolean; message: string } {
    const item = invRepo.get(inventoryId);
    if (!item || item.user_id !== userId) {
      return { success: false, message: 'Vật phẩm không tồn tại.' };
    }

    if (item.equipable !== 1) {
      return { success: false, message: 'Chỉ có thể liên kết Huyết Tế trang bị hoặc pháp bảo có thể đeo trên người!' };
    }

    // Kiểm tra xem đã có Bản Mệnh Pháp Bảo nào khác chưa
    const existing = db.prepare('SELECT id, item_id FROM inventories WHERE user_id = ? AND is_life_bound = 1').get(userId) as any;
    if (existing) {
      return { success: false, message: 'Đạo hữu chỉ có thể liên kết duy nhất 1 Bản Mệnh Pháp Bảo!' };
    }

    try {
      db.prepare('UPDATE inventories SET is_life_bound = 1, bound_level = 1, bound_exp = 0 WHERE id = ?').run(inventoryId);
      return { success: true, message: `🩸 **Huyết Tế Thành Công!** Đạo hữu đã liên kết nguyên thần vĩnh viễn với **${item.name}**, khí linh nhận chủ trở thành Bản Mệnh Pháp Bảo!` };
    } catch (e: any) {
      return { success: false, message: `Lỗi kết nối Huyết Tế: ${e.message}` };
    }
  }

  /**
   * Cộng EXP cho Bản Mệnh Pháp Bảo sau trận đấu
   */
  public addArtifactExp(userId: string, exp: number): { gained: number; leveledUp: boolean; message?: string } | null {
    const boundItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND is_life_bound = 1').get(userId) as any;
    if (!boundItem) return null;

    const currentLvl = boundItem.bound_level || 1;
    const currentExp = boundItem.bound_exp || 0;
    const nextExpNeed = currentLvl * 200;

    let newExp = currentExp + exp;
    let newLvl = currentLvl;
    let leveledUp = false;

    while (newExp >= nextExpNeed) {
      newExp -= nextExpNeed;
      newLvl += 1;
      leveledUp = true;
    }

    let statsMsg = '';
    try {
      if (leveledUp) {
        // Mở khóa hoặc nâng cấp một chỉ số phụ ngẫu nhiên trong custom_stats
        let customStats: any = {};
        try { customStats = JSON.parse(boundItem.custom_stats || '{}'); } catch(e) { console.warn('[InventoryService] Failed to parse custom_stats for level-up:', e); }
        
        // Thêm ngẫu nhiên thuộc tính nhỏ
        const statsList = ['atk', 'def', 'hp', 'crit', 'luck'];
        const chosen = statsList[Math.floor(Math.random() * statsList.length)];
        
        if (chosen === 'atk') {
          customStats.atk = (customStats.atk || 0) + 5;
          statsMsg = '+5 ATK';
        } else if (chosen === 'def') {
          customStats.def = (customStats.def || 0) + 2;
          statsMsg = '+2 DEF';
        } else if (chosen === 'hp') {
          customStats.hp = (customStats.hp || 0) + 30;
          statsMsg = '+30 HP';
        } else if (chosen === 'crit') {
          customStats.crit = parseFloat(((customStats.crit || 0) + 0.005).toFixed(3));
          statsMsg = '+0.5% CRIT';
        } else if (chosen === 'luck') {
          customStats.luck = (customStats.luck || 0) + 1;
          statsMsg = '+1 LUCK';
        }

        db.prepare('UPDATE inventories SET bound_level = ?, bound_exp = ?, custom_stats = ? WHERE id = ?')
          .run(newLvl, newExp, JSON.stringify(customStats), boundItem.id);
      } else {
        db.prepare('UPDATE inventories SET bound_exp = ? WHERE id = ?').run(newExp, boundItem.id);
      }
    } catch (e) {
      console.error('Lỗi khi cộng exp Bản mệnh pháp bảo:', e);
      return null;
    }

    return {
      gained: exp,
      leveledUp,
      message: leveledUp ? `✨ Bản Mệnh Pháp Bảo **${boundItem.name}** thăng lên Cấp **${newLvl}**! Khí Linh thức tỉnh thuộc tính: **${statsMsg}**!` : undefined
    };
  }

  /**
   * Nhận thêm dòng thuộc tính ngẫu nhiên khi đột phá cảnh giới lớn
   */
  public handleBreakthroughStats(userId: string): { success: boolean; message?: string } {
    const boundItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND is_life_bound = 1').get(userId) as any;
    if (!boundItem) return { success: false };

    let customStats: any = {};
    try { customStats = JSON.parse(boundItem.custom_stats || '{}'); } catch(e) { console.warn('[InventoryService] Failed to parse custom_stats for breakthrough:', e); }

    // Thêm một dòng thuộc tính hiếm khi đột phá đại cảnh giới
    const rareStats = ['atk_percent', 'def_percent', 'hp_percent', 'speed_percent', 'dodge'];
    const chosen = rareStats[Math.floor(Math.random() * rareStats.length)];

    let statsMsg = '';
    if (chosen === 'atk_percent') {
      customStats.atk_percent = parseFloat(((customStats.atk_percent || 0) + 0.02).toFixed(3));
      statsMsg = '+2% ATK';
    } else if (chosen === 'def_percent') {
      customStats.def_percent = parseFloat(((customStats.def_percent || 0) + 0.02).toFixed(3));
      statsMsg = '+2% DEF';
    } else if (chosen === 'hp_percent') {
      customStats.hp_percent = parseFloat(((customStats.hp_percent || 0) + 0.03).toFixed(3));
      statsMsg = '+3% HP';
    } else if (chosen === 'speed_percent') {
      customStats.speed_percent = parseFloat(((customStats.speed_percent || 0) + 0.02).toFixed(3));
      statsMsg = '+2% SPD';
    } else if (chosen === 'dodge') {
      customStats.dodge = parseFloat(((customStats.dodge || 0) + 0.01).toFixed(3));
      statsMsg = '+1% DODGE';
    }

    try {
      db.prepare('UPDATE inventories SET custom_stats = ? WHERE id = ?').run(JSON.stringify(customStats), boundItem.id);
      return {
        success: true,
        message: `🌟 Bản Mệnh Pháp Bảo **${boundItem.name}** dung hợp lực lượng lôi kiếp, mở khóa dòng thuộc tính hiếm: **${statsMsg}**!`
      };
    } catch (e) {
      console.error('Lỗi khi nâng cấp thuộc tính bản mệnh khi đột phá:', e);
      return { success: false };
    }
  }

  /**
   * Hoán đổi Bản Mệnh Pháp Bảo (Huyết Tế Ma Bảng)
   */
  public swapLifeArtifact(userId: string, oldInvId: number, newInvId: number): { success: boolean; message: string } {
    const oldItem = invRepo.get(oldInvId);
    const newItem = invRepo.get(newInvId);

    if (!oldItem || oldItem.user_id !== userId || oldItem.is_life_bound !== 1) {
      return { success: false, message: 'Pháp bảo cũ không tồn tại hoặc chưa Huyết Tế Bản Mệnh.' };
    }

    if (!newItem || newItem.user_id !== userId || newItem.equipable !== 1) {
      return { success: false, message: 'Pháp bảo mới không tồn tại hoặc không thể trang bị.' };
    }

    // Bảo lưu 80% EXP cũ
    const totalOldExp = oldItem.bound_exp + (oldItem.bound_level * (oldItem.bound_level - 1) * 100);
    const preservedExp = Math.floor(totalOldExp * 0.8);

    // Tính toán cấp độ mới cho pháp bảo mới
    let newLvl = 1;
    let tempExp = preservedExp;
    while (tempExp >= newLvl * 200) {
      tempExp -= newLvl * 200;
      newLvl += 1;
    }

    try {
      db.transaction(() => {
        // Hủy liên kết cũ
        db.prepare('UPDATE inventories SET is_life_bound = 0, bound_level = 1, bound_exp = 0 WHERE id = ?').run(oldInvId);
        // Thiết lập liên kết mới
        db.prepare('UPDATE inventories SET is_life_bound = 1, bound_level = ?, bound_exp = ? WHERE id = ?')
          .run(newLvl, tempExp, newInvId);
      })();
      return {
        success: true,
        message: `🔄 **Chuyển Đổi Huyết Tế!** Đạo hữu đã dùng Huyết Tế Ma Bảng chuyển đổi Bản Mệnh Pháp Bảo sang **${newItem.name}**! Bảo lưu 80% EXP chuyển hóa thành Cấp **${newLvl}**.`
      };
    } catch (e: any) {
      return { success: false, message: `Lỗi chuyển đổi bản mệnh: ${e.message}` };
    }
  }

  private openChests(username: string, chestId: string, qty: number): { rewards: Array<{ itemId: string; quantity: number; customStats: string | null }>; description: string } {
    const rewards: Array<{ itemId: string; quantity: number; customStats: string | null }> = [];
    const summaryMap = new Map<string, { name: string; qty: number }>();

    const addReward = (itemId: string, name: string, quantity: number = 1, customStats: string | null = null) => {
      rewards.push({ itemId, quantity, customStats });
      const key = itemId + (customStats ? '_custom' : '');
      const existing = summaryMap.get(key);
      if (existing) {
        existing.qty += quantity;
      } else {
        summaryMap.set(key, { name: name + (customStats ? ' (Chỉ Số Đặc Biệt ✦)' : ''), qty: quantity });
      }
    };

    for (let i = 0; i < qty; i++) {
      if (chestId === ITEMS.LUCKY_CHEST) {
        const rand = Math.random() * 100;
        let grade = 'f';
        if (rand < 40.0) grade = 'f';
        else if (rand < 65.0) grade = 'd';
        else if (rand < 80.0) grade = 'c';
        else if (rand < 90.0) grade = 'b';
        else if (rand < 96.0) grade = 'a';
        else if (rand < 99.0) grade = 's';
        else if (rand < 99.8) grade = 'ss';
        else grade = 'sss';

        const isWeapon = Math.random() < 0.5;
        const phoiId = isWeapon ? getPhoiWeaponByGrade(grade) : getPhoiArmorByGrade(grade);
        
        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(phoiId) as { name: string } | undefined;
        const phoiName = staticItem ? staticItem.name : `Phôi phẩm ${grade.toUpperCase()}`;
        addReward(phoiId, phoiName, 1);
      } 
      else if (chestId === ITEMS.CHEST_1TR5) {
        const ssRate = 0.10;
        const sssRate = 0.05;

        const rand = Math.random();
        let grade = 'b';

        if (rand < sssRate) {
          grade = 'sss';
        } else if (rand < sssRate + ssRate) {
          grade = 'ss';
        } else if (rand < sssRate + ssRate + 0.25) {
          grade = 's';
        } else if (rand < sssRate + ssRate + 0.25 + 0.30) {
          grade = 'a';
        } else {
          grade = 'b';
        }

        const isWeapon = Math.random() < 0.5;
        const phoiId = isWeapon ? getPhoiWeaponByGrade(grade) : getPhoiArmorByGrade(grade);

        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(phoiId) as { name: string } | undefined;
        const phoiName = staticItem ? staticItem.name : `Phôi phẩm ${grade.toUpperCase()}`;
        addReward(phoiId, phoiName, 1);
      } 
      else if (chestId === ITEMS.SERVER_RAID_CHEST) {
        const rand = Math.random();
        let grade = 's';
        if (rand < 0.03) {
          grade = 'ex';
        } else if (rand < 0.15) {
          grade = 'sss';
        } else if (rand < 0.50) {
          grade = 'ss';
        } else {
          grade = 's';
        }

        const isWeapon = Math.random() < 0.5;
        const targetItemId = isWeapon ? getWeaponByGrade(grade) : getArmorByGrade(grade);

        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(targetItemId) as { name: string } | undefined;
        const itemName = staticItem ? staticItem.name : `Trang bị phẩm ${grade.toUpperCase()}`;

        const customStats = this.generateCustomStatsForChest(grade);
        addReward(targetItemId, itemName, 1, customStats ? JSON.stringify(customStats) : null);
      }
      else {
        addReward(ITEMS.MATERIAL_IRON_1, 'Huyền Thiết Sa', 1);
      }
    }

    const logs: string[] = [];
    for (const [_, info] of summaryMap.entries()) {
      logs.push(`• **${info.name}** x${info.qty}`);
    }

    const description = logs.join('\n');

    return { rewards, description };
  }

  private generateCustomStatsForChest(grade: string): any {
    const stats: any = {};
    const lowerGrade = grade.toLowerCase();
    if (lowerGrade === 'f' || lowerGrade === 'd') return null;

    const rollStat = (type: string, min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const types = ['atk', 'def', 'hp', 'crit', 'luck'];
    let lines = 1;
    if (lowerGrade === 'c' || lowerGrade === 'b') lines = 1;
    else if (lowerGrade === 'a' || lowerGrade === 's') lines = 2;
    else if (lowerGrade === 'ss' || lowerGrade === 'sss') lines = 3;
    else if (lowerGrade === 'ex') lines = 4;

    const chosenTypes = new Set<string>();
    while (chosenTypes.size < lines) {
      chosenTypes.add(types[Math.floor(Math.random() * types.length)]);
    }

    for (const statType of chosenTypes) {
      if (statType === 'atk') {
        if (lowerGrade === 'c') stats.atk = rollStat('atk', 2, 6);
        else if (lowerGrade === 'b') stats.atk = rollStat('atk', 5, 15);
        else if (lowerGrade === 'a') stats.atk = rollStat('atk', 10, 30);
        else if (lowerGrade === 's') stats.atk = rollStat('atk', 20, 50);
        else if (lowerGrade === 'ss') stats.atk = rollStat('atk', 40, 100);
        else if (lowerGrade === 'sss') stats.atk = rollStat('atk', 80, 200);
        else if (lowerGrade === 'ex') stats.atk = rollStat('atk', 150, 400);
      } else if (statType === 'def') {
        if (lowerGrade === 'c') stats.def = rollStat('def', 1, 4);
        else if (lowerGrade === 'b') stats.def = rollStat('def', 3, 10);
        else if (lowerGrade === 'a') stats.def = rollStat('def', 6, 20);
        else if (lowerGrade === 's') stats.def = rollStat('def', 12, 35);
        else if (lowerGrade === 'ss') stats.def = rollStat('def', 25, 70);
        else if (lowerGrade === 'sss') stats.def = rollStat('def', 50, 150);
        else if (lowerGrade === 'ex') stats.def = rollStat('def', 100, 300);
      } else if (statType === 'hp') {
        if (lowerGrade === 'c') stats.hp = rollStat('hp', 10, 30);
        else if (lowerGrade === 'b') stats.hp = rollStat('hp', 25, 80);
        else if (lowerGrade === 'a') stats.hp = rollStat('hp', 60, 200);
        else if (lowerGrade === 's') stats.hp = rollStat('hp', 120, 400);
        else if (lowerGrade === 'ss') stats.hp = rollStat('hp', 250, 800);
        else if (lowerGrade === 'sss') stats.hp = rollStat('hp', 500, 1500);
        else if (lowerGrade === 'ex') stats.hp = rollStat('hp', 1000, 3000);
      } else if (statType === 'crit') {
        let critVal = 0.01;
        if (lowerGrade === 'a') critVal = 0.01 + Math.random() * 0.02;
        else if (lowerGrade === 's') critVal = 0.02 + Math.random() * 0.03;
        else if (lowerGrade === 'ss') critVal = 0.03 + Math.random() * 0.05;
        else if (lowerGrade === 'sss') critVal = 0.05 + Math.random() * 0.07;
        else if (lowerGrade === 'ex') critVal = 0.08 + Math.random() * 0.12;
        stats.crit = parseFloat(critVal.toFixed(3));
      } else if (statType === 'luck') {
        if (lowerGrade === 's') stats.luck = rollStat('luck', 1, 3);
        else if (lowerGrade === 'ss') stats.luck = rollStat('luck', 2, 6);
        else if (lowerGrade === 'sss') stats.luck = rollStat('luck', 5, 15);
        else if (lowerGrade === 'ex') stats.luck = rollStat('luck', 10, 30);
      }
    }

    return stats;
  }
}

export const inventoryService = new InventoryService();

