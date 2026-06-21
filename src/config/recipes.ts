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
      { itemId: 'material_linh_thao_1', quantity: 3 },
      { itemId: 'material_nhan_sam_1', quantity: 1 }
    ],
    product: {
      itemId: 'pill_break_minor_1',
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
      { itemId: 'material_linh_thao_1', quantity: 6 },
      { itemId: 'material_nhan_sam_1', quantity: 2 }
    ],
    product: {
      itemId: 'pill_break_minor_2',
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
      { itemId: 'material_linh_thao_1', quantity: 15 },
      { itemId: 'material_nhan_sam_1', quantity: 5 }
    ],
    product: {
      itemId: 'pill_break_minor_3',
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
      { itemId: 'material_linh_thao_1', quantity: 5 },
      { itemId: 'material_nhan_sam_1', quantity: 1 } // Thay thế bằng giấy bùa nếu có sau
    ],
    product: {
      itemId: 'talisman_anti_loi',
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
      { itemId: 'material_linh_thao_1', quantity: 3 }
    ],
    product: {
      itemId: 'pill_tu_vi_low',
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
      { itemId: 'material_linh_thao_1', quantity: 2 },
      { itemId: 'material_nhan_sam_1', quantity: 1 }
    ],
    product: {
      itemId: 'pill_hp_2',
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
      { itemId: 'material_linh_thao_1', quantity: 5 },
      { itemId: 'material_nhan_sam_1', quantity: 2 }
    ],
    product: {
      itemId: 'pill_break_1',
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
      { itemId: 'material_iron_1', quantity: 10 },
      { itemId: 'material_nhan_sam_1', quantity: 2 }
    ],
    product: {
      itemId: 'weapon_sword_2',
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
      { itemId: 'material_iron_1', quantity: 8 },
      { itemId: 'material_nhan_sam_1', quantity: 3 }
    ],
    product: {
      itemId: 'armor_robe_2',
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
      { itemId: 'material_iron_1', quantity: 20 },
      { itemId: 'material_mythril_1', quantity: 5 },
      { itemId: 'material_tinh_thiet_1', quantity: 1 }
    ],
    product: {
      itemId: 'weapon_sword_3',
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
      { itemId: 'material_iron_1', quantity: 15 },
      { itemId: 'material_mythril_1', quantity: 8 },
      { itemId: 'material_tinh_thiet_1', quantity: 1 }
    ],
    product: {
      itemId: 'armor_robe_3',
      quantity: 1
    },
    description: 'Huyền giáp ngưng tụ thần quang bảo vệ nguyên thần, tăng +100 Phòng Thủ và +300 Sinh Lực.'
  }
};
