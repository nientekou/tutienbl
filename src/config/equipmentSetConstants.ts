// V13 A-04: Equipment Set Bonus V2
// 4 sets — 2pc = stat bonus, full set = proc effect (combat)

export interface EquipmentSet {
  id: string;
  name: string;
  pieces: number;          // total pieces in set
  bonus_2pc: { stat: string; value: number }[];
  full_set_proc: { name: string; description: string; effect: string; chance: number };
  item_ids: string[];      // item_id prefixes that belong to this set
}

export const EQUIPMENT_SETS: EquipmentSet[] = [
  {
    id: 'set_hoa_than',
    name: 'Hỏa Thần',
    pieces: 2,
    bonus_2pc: [{ stat: 'atk_percent', value: 0.10 }],
    full_set_proc: { name: 'Hỏa Trùng Kích', description: '15% tỷ lệ gây bỏng 3 lượt khi đánh trúng', effect: 'hoa_trung_kich', chance: 0.15 },
    item_ids: ['weapon_hoa_', 'armor_hoa_'],
  },
  {
    id: 'set_bang_suong',
    name: 'Băng Sương',
    pieces: 2,
    bonus_2pc: [{ stat: 'def_percent', value: 0.10 }],
    full_set_proc: { name: 'Băng Phong Vạn Vật', description: '10% tỷ lệ đóng băng 1 lượt', effect: 'bang_phong', chance: 0.10 },
    item_ids: ['weapon_thuy_', 'armor_thuy_'],
  },
  {
    id: 'set_loi_dinh',
    name: 'Lôi Đình',
    pieces: 2,
    bonus_2pc: [{ stat: 'crit', value: 0.08 }],
    full_set_proc: { name: 'Lôi Phạt Thiên Kinh', description: 'Bạo Kích kích hoạt lôi xích 30% ATK', effect: 'loi_phat', chance: 0.20 },
    item_ids: ['weapon_loi_', 'armor_loi_'],
  },
  {
    id: 'set_phong_van',
    name: 'Phong Vân',
    pieces: 2,
    bonus_2pc: [{ stat: 'speed_percent', value: 0.10 }],
    full_set_proc: { name: 'Vô Hình Vô Tích', description: '20% tỷ lệ né tránh hoàn toàn 1 đòn', effect: 'vo_hinh', chance: 0.20 },
    item_ids: ['weapon_phong_', 'armor_phong_'],
  },
];

/**
 * Check how many pieces of a set the player has equipped
 */
export function getEquippedSetCount(equippedItemIds: string[], set: EquipmentSet): number {
  return equippedItemIds.filter(itemId =>
    set.item_ids.some(prefix => itemId.startsWith(prefix))
  ).length;
}
