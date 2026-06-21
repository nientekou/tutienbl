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
    maxDailyEntries: 3,
    monster: {
      name: 'U Minh Khuyển',
      element: 'Thổ',
      hp: 150,
      maxHp: 150,
      atk: 18,
      def: 8,
      crit: 0.05,
      critRes: 0.0,
    },
    rewards: {
      exp: 100, // Tăng 100 tu vi
      coinMin: 20,
      coinMax: 40,
      loots: [
        { itemId: 'pill_hp_1', rate: 0.50, quantity: 1 },       // 50% hồi huyết đan hạ phẩm
        { itemId: 'weapon_sword_1', rate: 0.15, quantity: 1 },   // 15% kiếm gỗ thanh phong
        { itemId: 'armor_robe_1', rate: 0.15, quantity: 1 },     // 15% đạo bào thanh lam
        { itemId: 'material_iron_1', rate: 0.40, quantity: 2 },  // 40% huyền thiết sa
      ]
    }
  },
  dungeon_truc_co_1: {
    id: 'dungeon_truc_co_1',
    name: 'Huyết Ma Động (Trúc Cơ)',
    description: 'Hang động cổ xưa nhuốm đầy máu của yêu ma, sinh vật bên trong cực kỳ hung tợn.',
    minLevel: 39, // Trúc Cơ Kỳ Tầng 1
    maxDailyEntries: 3,
    monster: {
      name: 'Huyết Ma Binh',
      element: 'Hỏa',
      hp: 1500,
      maxHp: 1500,
      atk: 140,
      def: 90,
      crit: 0.08,
      critRes: 0.02,
    },
    rewards: {
      exp: 800,
      coinMin: 80,
      coinMax: 150,
      loots: [
        { itemId: 'pill_hp_2', rate: 0.50, quantity: 1 },       // 50% hồi huyết đan trung phẩm
        { itemId: 'pill_break_1', rate: 0.25, quantity: 1 },     // 25% trúc cơ đan
        { itemId: 'weapon_sword_2', rate: 0.20, quantity: 1 },   // 20% Xích Long Kiếm
        { itemId: 'armor_robe_2', rate: 0.20, quantity: 1 },     // 20% Thăng Long Đạo Bào
        { itemId: 'talisman_speed_1', rate: 0.35, quantity: 1 }, // 35% Thần Hành Phù
      ]
    }
  },
  dungeon_kim_dan_1: {
    id: 'dungeon_kim_dan_1',
    name: 'Vạn Kiếm Lăng (Kim Đan)',
    description: 'Nghĩa địa kiếm cổ ngưng tụ linh lực kiếm ý bàng bạc, Kiếm Hồn Lão Tổ tọa trấn trung tâm.',
    minLevel: 77, // Kim Đan Kỳ Tầng 1
    maxDailyEntries: 3,
    monster: {
      name: 'Kiếm Hồn Lão Tổ',
      element: 'Kim',
      hp: 8000,
      maxHp: 8000,
      atk: 500,
      def: 320,
      crit: 0.12,
      critRes: 0.05,
    },
    rewards: {
      exp: 5000,
      coinMin: 300,
      coinMax: 600,
      loots: [
        { itemId: 'weapon_sword_3', rate: 0.20, quantity: 1 },   // 20% Thiên Cổ Phán Quyết (Epic)
        { itemId: 'armor_robe_3', rate: 0.20, quantity: 1 },     // 20% Thần Quang Huyền Giáp (Epic)
        { itemId: 'pill_break_1', rate: 0.40, quantity: 2 },     // 40% x2 trúc cơ đan
        { itemId: 'talisman_speed_1', rate: 0.50, quantity: 2 }, // 50% x2 Thần Hành Phù
      ]
    }
  }
};
