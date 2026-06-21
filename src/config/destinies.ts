export type DestinyType = 'atk_percent' | 'def_percent' | 'hp_percent' | 'crit_rate' | 'crit_damage' | 'dodge_rate' | 'speed_bonus';

export type DestinyRarity = 'thuong' | 'hiem' | 'cuc_pham' | 'tien_pham';

export interface DestinyConfig {
  id: DestinyType;
  name: string;
  description: string;
  icon: string;
  baseValue: number;      // Giá trị cộng ở lv1 (Phần trăm: ví dụ 0.05 = 5%)
  scalePerLevel: number;  // Giá trị cộng thêm mỗi level
}

export const DESTINY_TYPES: Record<DestinyType, DestinyConfig> = {
  atk_percent: {
    id: 'atk_percent',
    name: 'Kiếm Tâm',
    description: 'Tăng Công Kích cơ bản (%)',
    icon: '⚔️',
    baseValue: 0.03,      // 3%
    scalePerLevel: 0.01   // +1% mỗi cấp
  },
  def_percent: {
    id: 'def_percent',
    name: 'Huyền Quy',
    description: 'Tăng Phòng Thủ cơ bản (%)',
    icon: '🛡️',
    baseValue: 0.03,
    scalePerLevel: 0.01
  },
  hp_percent: {
    id: 'hp_percent',
    name: 'Sinh Mệnh',
    description: 'Tăng Sinh Lực tối đa (%)',
    icon: '❤️',
    baseValue: 0.05,      // 5%
    scalePerLevel: 0.015  // +1.5% mỗi cấp
  },
  crit_rate: {
    id: 'crit_rate',
    name: 'Cuồng Bạo',
    description: 'Tăng Tỉ lệ Bạo Kích (%)',
    icon: '🔥',
    baseValue: 0.02,      // 2%
    scalePerLevel: 0.005  // +0.5% mỗi cấp
  },
  crit_damage: {
    id: 'crit_damage',
    name: 'Tàn Sát',
    description: 'Tăng Sát thương Bạo Kích (%)',
    icon: '💥',
    baseValue: 0.05,      // 5%
    scalePerLevel: 0.02   // +2% mỗi cấp
  },
  dodge_rate: {
    id: 'dodge_rate',
    name: 'Linh Động',
    description: 'Tăng Tỉ lệ Né Tránh (%)',
    icon: '💨',
    baseValue: 0.02,      // 2%
    scalePerLevel: 0.005  // +0.5% mỗi cấp
  },
  speed_bonus: {
    id: 'speed_bonus',
    name: 'Lôi Điện',
    description: 'Tăng Tốc độ xuất chiêu (%)',
    icon: '⚡',
    baseValue: 0.03,      // 3%
    scalePerLevel: 0.01   // +1% mỗi cấp
  }
};

export const DESTINY_RARITY_MULTIPLIER: Record<DestinyRarity, number> = {
  thuong: 1.0,     // Hệ số 1x
  hiem: 1.5,       // Hệ số 1.5x
  cuc_pham: 2.5,   // Hệ số 2.5x
  tien_pham: 4.0   // Hệ số 4x (Cực mạnh)
};

export const DESTINY_GACHA_COST = 10000; // 10k Hạ Phẩm Linh Thạch mỗi lần bốc
export const DESTINY_MAX_LEVEL = 10;

// Tính kinh nghiệm cần để lên cấp tiếp theo
export function getDestinyExpNeeded(level: number, rarity: DestinyRarity): number {
  const baseExp = 100 * level * level;
  const multiplier = DESTINY_RARITY_MULTIPLIER[rarity];
  return Math.round(baseExp * multiplier);
}

// Kinh nghiệm rác nhận được khi phân rã
export function getDestinyScrapExp(level: number, rarity: DestinyRarity): number {
  return Math.round(100 * DESTINY_RARITY_MULTIPLIER[rarity] + (level - 1) * 50);
}
