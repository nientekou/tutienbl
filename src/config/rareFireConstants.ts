export interface RareFireDef {
  type: string;
  name: string;
  tier: number;
  description: string;
  alchemyBonus: number;
  enhanceBonus: number;
  combatPassive: string;
  combatValue: number;
  evolveMaterials: { itemId: string; amount: number }[];
}

export const RARE_FIRES: RareFireDef[] = [
  {
    type: 'tam_me_hoa',
    name: 'Tam Muội Chân Hỏa',
    tier: 1,
    description: 'Ngọn lửa cơ bản nhất, phù hợp cho người mới',
    alchemyBonus: 5, enhanceBonus: 3,
    combatPassive: 'burn_chance', combatValue: 5,
    evolveMaterials: [{ itemId: 'iron', amount: 20 }]
  },
  {
    type: 'than_tam_ly_hoa',
    name: 'Thần Tâm Ly Hỏa',
    tier: 2,
    description: 'Lửa thanh lọc tâm thần, giúp đan dược tinh khiết hơn',
    alchemyBonus: 10, enhanceBonus: 5,
    combatPassive: 'burn_dmg', combatValue: 8,
    evolveMaterials: [{ itemId: 'iron', amount: 40 }, { itemId: 'mythril', amount: 10 }]
  },
  {
    type: 'thien_hoa',
    name: 'Thiên Hỏa',
    tier: 3,
    description: 'Lửa từ trời, thiêu đốt mọi thứ',
    alchemyBonus: 15, enhanceBonus: 8,
    combatPassive: 'burn_aoe', combatValue: 12,
    evolveMaterials: [{ itemId: 'mythril', amount: 20 }, { itemId: 'tinh_thiet', amount: 5 }]
  },
  {
    type: 'di_hoa',
    name: 'Địa Hỏa Chi Tinh',
    tier: 4,
    description: 'Tinh hoa của lửa từ sâu trong lòng đất',
    alchemyBonus: 20, enhanceBonus: 12,
    combatPassive: 'burn_reduce_def', combatValue: 15,
    evolveMaterials: [{ itemId: 'tinh_thiet', amount: 15 }, { itemId: 'herb_rare_1', amount: 5 }]
  },
  {
    type: 'nhan_ly_hoa',
    name: 'Nhân Ly Hỏa',
    tier: 5,
    description: 'Lửa phân tách, tách linh khí khỏi tạp chất',
    alchemyBonus: 25, enhanceBonus: 15,
    combatPassive: 'burn_soul', combatValue: 20,
    evolveMaterials: [{ itemId: 'herb_rare_1', amount: 10 }, { itemId: 'tinh_thach_shard', amount: 5 }]
  },
  {
    type: 'phap_than_hoa',
    name: 'Pháp Thần Hỏa',
    tier: 6,
    description: 'Lửa của pháp khí, tăng uy lực pháp bảo lên gấp bội',
    alchemyBonus: 30, enhanceBonus: 20,
    combatPassive: 'burn_true_damage', combatValue: 25,
    evolveMaterials: [{ itemId: 'tinh_thach_shard', amount: 10 }, { itemId: 'herb_rare_1', amount: 15 }]
  },
  {
    type: 'thien_tan_hoa',
    name: 'Thiên Tàn Hỏa',
    tier: 7,
    description: 'Lửa cổ đại, được lưu truyền từ thời viễn cổ',
    alchemyBonus: 35, enhanceBonus: 25,
    combatPassive: 'burn_immolate', combatValue: 30,
    evolveMaterials: [{ itemId: 'tinh_thach_shard', amount: 20 }, { itemId: 'mythril', amount: 30 }]
  },
  {
    type: 'phan_thien_hoa',
    name: 'Phản Thiên Hỏa',
    tier: 8,
    description: 'Lửa phản nghịch thiên đạo, cực kỳ hiếm và nguy hiểm',
    alchemyBonus: 45, enhanceBonus: 35,
    combatPassive: 'burn_annihilation', combatValue: 40,
    evolveMaterials: [{ itemId: 'tinh_thach_shard', amount: 50 }, { itemId: 'herb_rare_1', amount: 30 }]
  }
];
