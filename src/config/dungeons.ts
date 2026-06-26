import { ITEMS } from './itemConstants';

export interface MonsterConfig {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  crit: number;
  critRes: number;
  element?: string;
}

export interface LootConfig {
  itemId: string;
  rate: number; // Tỷ lệ rơi (0 -> 1)
  quantity: number;
}

export interface DungeonConfig {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  minPrestige?: number; // C5: Prestige gate
  maxDailyEntries: number;
  monster: MonsterConfig;
  rewards: {
    exp: number;
    coinMin: number;
    coinMax: number;
    loots: LootConfig[];
  };
}

export const DUNGEONS: Record<string, DungeonConfig> = {
  dungeon_luyen_khi_1: {
    id: 'dungeon_luyen_khi_1',
    name: 'U Minh Cốc (Luyện Khí)',
    description: 'Thung lũng u ám bao phủ bởi sương mù độc, là nơi thích hợp cho tu sĩ Luyện Khí Kỳ rèn luyện.',
    minLevel: 1,
    maxDailyEntries: 5, // ponytail: tăng từ 3→5
    monster: {
      name: 'U Minh Khuyển',
      element: 'Thổ',
      hp: 188,
      maxHp: 188,
      atk: 23,
      def: 10,
      crit: 0.05,
      critRes: 0.0,
    },
    rewards: {
      exp: 100,
      coinMin: 26, // ponytail: +30% (trước 20)
      coinMax: 52, // ponytail: +30% (trước 40)
      loots: [
        { itemId: ITEMS.PILL_HP_1, rate: 0.50, quantity: 1 },       // 50% hồi huyết đan hạ phẩm
        { itemId: ITEMS.WEAPON_SWORD_1, rate: 0.15, quantity: 1 },   // 15% kiếm gỗ thanh phong
        { itemId: ITEMS.ARMOR_ROBE_1, rate: 0.15, quantity: 1 },     // 15% đạo bào thanh lam
        { itemId: ITEMS.MATERIAL_IRON_1, rate: 0.40, quantity: 2 },  // 40% huyền thiết sa
      ]
    }
  },
  dungeon_truc_co_1: {
    id: 'dungeon_truc_co_1',
    name: 'Huyết Ma Động (Trúc Cơ)',
    description: 'Hang động cổ xưa nhuốm đầy máu của yêu ma, sinh vật bên trong cực kỳ hung tợn.',
    minLevel: 39,
    maxDailyEntries: 5, // ponytail: tăng từ 3→5
    monster: {
      name: 'Huyết Ma Binh',
      element: 'Hỏa',
      hp: 1875,
      maxHp: 1875,
      atk: 175,
      def: 113,
      crit: 0.08,
      critRes: 0.02,
    },
    rewards: {
      exp: 800,
      coinMin: 104, // ponytail: +30% (trước 80)
      coinMax: 195, // ponytail: +30% (trước 150)
      loots: [
        { itemId: ITEMS.PILL_HP_2, rate: 0.50, quantity: 1 },       // 50% hồi huyết đan trung phẩm
        { itemId: ITEMS.PILL_BREAK_1, rate: 0.25, quantity: 1 },     // 25% trúc cơ đan
        { itemId: ITEMS.WEAPON_SWORD_2, rate: 0.20, quantity: 1 },   // 20% Xích Long Kiếm
        { itemId: ITEMS.ARMOR_ROBE_2, rate: 0.20, quantity: 1 },     // 20% Thăng Long Đạo Bào
        { itemId: ITEMS.TALISMAN_SPEED_1, rate: 0.35, quantity: 1 }, // 35% Thần Hành Phù
      ]
    }
  },
  dungeon_kim_dan_1: {
    id: 'dungeon_kim_dan_1',
    name: 'Vạn Kiếm Lăng (Kim Đan)',
    description: 'Nghĩa địa kiếm cổ ngưng tụ linh lực kiếm ý bàng bạc, Kiếm Hồn Lão Tổ tọa trấn trung tâm.',
    minLevel: 77,
    maxDailyEntries: 5, // ponytail: tăng từ 3→5
    monster: {
      name: 'Kiếm Hồn Lão Tổ',
      element: 'Kim',
      hp: 10000,
      maxHp: 10000,
      atk: 625,
      def: 400,
      crit: 0.12,
      critRes: 0.05,
    },
    rewards: {
      exp: 5000,
      coinMin: 390, // ponytail: +30% (trước 300)
      coinMax: 780, // ponytail: +30% (trước 600)
      loots: [
        { itemId: ITEMS.WEAPON_SWORD_3, rate: 0.20, quantity: 1 },   // 20% Thiên Cổ Phán Quyết (Epic)
        { itemId: ITEMS.ARMOR_ROBE_3, rate: 0.20, quantity: 1 },     // 20% Thăng Quang Huyền Giáp (Epic)
        { itemId: ITEMS.PILL_BREAK_1, rate: 0.40, quantity: 2 },     // 40% x2 trúc cơ đan
        { itemId: ITEMS.TALISMAN_SPEED_1, rate: 0.50, quantity: 2 }, // 50% x2 Thần Hành Phù
        { itemId: ITEMS.SEED_VOID_HERB, rate: 0.20, quantity: 1 },   // 20% hạt hư không thảo
      ]
    }
  },

  // C5: Prestige-Exclusive Dungeon
  prestige_void: {
    id: 'prestige_void',
    name: 'Hư Không Prestige',
    description: 'Phó bản chỉ dành cho đạo hữu đã Prestige 3+. Hư Không Ma Quân canh giữ những bí mật của thiên đạo.',
    minLevel: 1,
    minPrestige: 3,
    maxDailyEntries: 2,
    monster: {
      name: 'Hư Không Ma Quân',
      element: 'Vô',
      hp: 8000,
      maxHp: 8000,
      atk: 200,
      def: 120,
      crit: 0.15,
      critRes: 0.10,
    },
    rewards: {
      exp: 2000,
      coinMin: 500,
      coinMax: 1000,
      loots: [
        { itemId: 'prestige_material', rate: 0.30, quantity: 1 },
        { itemId: 'tinh_thach_shard', rate: 0.50, quantity: 2 },
        { itemId: ITEMS.PILL_BREAK_1, rate: 0.40, quantity: 1 },
      ]
    }
  }
};
