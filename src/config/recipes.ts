import { ITEMS } from './itemConstants';

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeConfig {
  id: string;
  name: string;
  type: 'alchemy' | 'forging'; // Luyện đan hoặc rèn khí
  minLevel: number; // Yêu cầu cấp độ
  duration: number; // Thời gian chế tạo (giây)
  cost: number; // Hao tốn Linh Thạch (hạ phẩm)
  ingredients: RecipeIngredient[];
  product: {
    itemId: string;
    quantity: number;
  };
  description: string;
}

export const RECIPES: Record<string, RecipeConfig> = {
  recipe_pill_break_minor_1: {
    id: 'recipe_pill_break_minor_1',
    name: 'Tụ Khí Đan',
    type: 'alchemy',
    minLevel: 10,
    duration: 60,
    cost: 30,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 3 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 1 }
    ],
    product: {
      itemId: ITEMS.PILL_BREAK_MINOR_1,
      quantity: 1
    },
    description: 'Hỗ trợ đột phá tầng nhỏ, tăng 15% tỷ lệ thành công.'
  },
  recipe_pill_break_minor_2: {
    id: 'recipe_pill_break_minor_2',
    name: 'Bồi Nguyên Đan',
    type: 'alchemy',
    minLevel: 30,
    duration: 120,
    cost: 60,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 6 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 2 }
    ],
    product: {
      itemId: ITEMS.PILL_BREAK_MINOR_2,
      quantity: 1
    },
    description: 'Hỗ trợ đột phá tầng nhỏ, tăng 30% tỷ lệ thành công.'
  },
  recipe_pill_break_minor_3: {
    id: 'recipe_pill_break_minor_3',
    name: 'Tạo Hóa Đan',
    type: 'alchemy',
    minLevel: 100,
    duration: 300,
    cost: 150,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 5 }
    ],
    product: {
      itemId: ITEMS.PILL_BREAK_MINOR_3,
      quantity: 1
    },
    description: 'Hỗ trợ đột phá tầng nhỏ, tăng 50% tỷ lệ thành công.'
  },
  recipe_talisman_anti_loi: {
    id: 'recipe_talisman_anti_loi',
    name: 'Tị Lôi Phù',
    type: 'alchemy',
    minLevel: 40,
    duration: 240,
    cost: 100,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 1 } // Thay thế bằng giấy bùa nếu có sau
    ],
    product: {
      itemId: ITEMS.TALISMAN_ANTI_LOI,
      quantity: 1
    },
    description: 'Chống đỡ một đạo sét của Lôi Kiếp, giảm 80% sát thương.'
  },
  recipe_pill_tu_vi_low: {
    id: 'recipe_pill_tu_vi_low',
    name: 'Sơ Cấp Tụ Khí Đan',
    type: 'alchemy',
    minLevel: 1,
    duration: 60,
    cost: 10,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 3 }
    ],
    product: {
      itemId: ITEMS.PILL_TU_VI_LOW,
      quantity: 1
    },
    description: 'Luyện đan ngưng tụ thiên địa linh khí, dùng tăng +50 Tu Vi.'
  },
  recipe_pill_hp_2: {
    id: 'recipe_pill_hp_2',
    name: 'Hồi Huyết Đan - Trung Phẩm',
    type: 'alchemy',
    minLevel: 10,
    duration: 60,
    cost: 15,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 2 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 1 }
    ],
    product: {
      itemId: ITEMS.PILL_HP_2,
      quantity: 1
    },
    description: 'Đan dược trung phẩm xoa dịu lục phủ ngũ tạng, dùng hồi phục 150 HP.'
  },
  recipe_pill_break_1: {
    id: 'recipe_pill_break_1',
    name: 'Trúc Cơ Đan',
    type: 'alchemy',
    minLevel: 30,
    duration: 120,
    cost: 50,
    ingredients: [
      { itemId: ITEMS.MATERIAL_LINH_THAO_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 2 }
    ],
    product: {
      itemId: ITEMS.PILL_BREAK_1,
      quantity: 1
    },
    description: 'Bổ trợ đột phá cảnh giới từ Luyện Khí Kỳ lên Trúc Cơ Kỳ, tăng 20% tỷ lệ thành công.'
  },
  recipe_weapon_sword_2: {
    id: 'recipe_weapon_sword_2',
    name: 'Xích Long Kiếm',
    type: 'forging',
    minLevel: 39,
    duration: 180,
    cost: 100,
    ingredients: [
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 10 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 2 }
    ],
    product: {
      itemId: ITEMS.WEAPON_SWORD_2,
      quantity: 1
    },
    description: 'Linh kiếm rèn từ vảy Xích Long, tăng +50 Công Kích.'
  },
  recipe_armor_robe_2: {
    id: 'recipe_armor_robe_2',
    name: 'Thăng Long Đạo Bào',
    type: 'forging',
    minLevel: 39,
    duration: 180,
    cost: 100,
    ingredients: [
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 8 },
      { itemId: ITEMS.MATERIAL_NHAN_SAM_1, quantity: 3 }
    ],
    product: {
      itemId: ITEMS.ARMOR_ROBE_2,
      quantity: 1
    },
    description: 'Đạo bào thêu rồng bay lượn bảo hộ hộ vệ, tăng +30 Phòng Thủ và +100 HP.'
  },
  recipe_weapon_sword_3: {
    id: 'recipe_weapon_sword_3',
    name: 'Thiên Cổ Phán Quyết',
    type: 'forging',
    minLevel: 69,
    duration: 300,
    cost: 500,
    ingredients: [
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 20 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 1 }
    ],
    product: {
      itemId: ITEMS.WEAPON_SWORD_3,
      quantity: 1
    },
    description: 'Cổ kiếm tuyệt thế có khả năng trảm tiên phạt thần, tăng +150 Công Kích và +5% Bạo Kích.'
  },
  recipe_armor_robe_3: {
    id: 'recipe_armor_robe_3',
    name: 'Thần Quang Huyền Giáp',
    type: 'forging',
    minLevel: 69,
    duration: 300,
    cost: 500,
    ingredients: [
      { itemId: ITEMS.MATERIAL_IRON_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 8 },
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 1 }
    ],
    product: {
      itemId: ITEMS.ARMOR_ROBE_3,
      quantity: 1
    },
    description: 'Huyền giáp ngưng tụ thần quang bảo vệ nguyên thần, tăng +100 Phòng Thủ và +300 Sinh Lực.'
  },
  // ponytail: thêm 4 recipe end-game để rèn không bị lỗi thời
  recipe_weapon_sword_a: {
    id: 'recipe_weapon_sword_a',
    name: 'Huyền Linh Kiếm [A]',
    type: 'forging',
    minLevel: 120,
    duration: 600,
    cost: 2000,
    ingredients: [
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 20 },
      { itemId: ITEMS.MATERIAL_BLOOD_FLOWER, quantity: 10 }
    ],
    product: {
      itemId: ITEMS.WEAPON_SWORD_A,
      quantity: 1
    },
    description: 'Linh kiếm huyền cấp giai thoại, khắc trận pháp ngũ hành tương sinh, +300 Công Kích.'
  },
  recipe_armor_robe_a: {
    id: 'recipe_armor_robe_a',
    name: 'Tử Vi Huyền Giáp [A]',
    type: 'forging',
    minLevel: 120,
    duration: 600,
    cost: 2000,
    ingredients: [
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 5 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_VOID_HERB, quantity: 10 }
    ],
    product: {
      itemId: ITEMS.ARMOR_ROBE_A,
      quantity: 1
    },
    description: 'Đạo bào tẩm linh huyết Tử Vi tinh quân, +200 Phòng Thủ, +500 HP.'
  },
  recipe_weapon_sword_s: {
    id: 'recipe_weapon_sword_s',
    name: 'Phá Quân Thương [S]',
    type: 'forging',
    minLevel: 200,
    duration: 1200,
    cost: 5000,
    ingredients: [
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 50 },
      { itemId: ITEMS.MATERIAL_WIND_LEAF, quantity: 15 },
      { itemId: ITEMS.MATERIAL_NGODONG, quantity: 10 }
    ],
    product: {
      itemId: ITEMS.WEAPON_SWORD_S,
      quantity: 1
    },
    description: 'Thần thương chí tôn Phá Quân, một thương khai thiên tích địa, +550 Công Kích, +8% Bạo Kích.'
  },
  recipe_armor_robe_s: {
    id: 'recipe_armor_robe_s',
    name: 'Bất Diệt Hoàng Giáp [S]',
    type: 'forging',
    minLevel: 200,
    duration: 1200,
    cost: 5000,
    ingredients: [
      { itemId: ITEMS.MATERIAL_TINH_THIET_1, quantity: 15 },
      { itemId: ITEMS.MATERIAL_MYTHRIL_1, quantity: 40 },
      { itemId: ITEMS.MATERIAL_TUYET_LIEN, quantity: 15 },
      { itemId: ITEMS.MATERIAL_LINGZHI, quantity: 10 }
    ],
    product: {
      itemId: ITEMS.ARMOR_ROBE_S,
      quantity: 1
    },
    description: 'Thần giáp bất diệt bảo hộ tính mạng chủ nhân, +350 Phòng Thủ, +1000 HP.'
  }
};
