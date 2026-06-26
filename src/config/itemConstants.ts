// ==================== ITEM CONSTANTS ====================
// Centralized item ID registry - all item codes used across the codebase.
// Import from here instead of hardcoding string literals.

export const ITEMS = {
  // ---- Đan dược (Pills) ----
  PILL_TU_VI_LOW: 'pill_tu_vi_low',
  PILL_HP_1: 'pill_hp_1',
  PILL_HP_2: 'pill_hp_2',
  PILL_BREAK_1: 'pill_break_1',
  PILL_BREAK_MINOR_1: 'pill_break_minor_1',
  PILL_BREAK_MINOR_2: 'pill_break_minor_2',
  PILL_BREAK_MINOR_3: 'pill_break_minor_3',
  PILL_ALCHEMY_TUVI: 'pill_alchemy_tuvi',
  PILL_ALCHEMY_BREAK: 'pill_alchemy_break',
  PILL_ALCHEMY_STAMINA: 'pill_alchemy_stamina',
  PILL_ALCHEMY_ANTI_LOI: 'pill_alchemy_anti_loi',
  PILL_STAMINA_1: 'pill_stamina_1',
  PILL_STAMINA_2: 'pill_stamina_2',
  PILL_STAMINA_3: 'pill_stamina_3',
  PILL_LINH_TUYEN: 'pill_linh_tuyen',
  PILL_NHAN_TU: 'pill_nhan_tu',
  PILL_TAY_TUY: 'pill_tay_tuy',
  PILL_Y_CANH: 'pill_y_canh',
  PILL_CUU_CHUYEN: 'pill_cuu_chuyen',
  PILL_NGO_DONG: 'pill_ngo_dong',
  PILL_HUYEN_AM: 'pill_huyen_am',
  PILL_HP_MAX_PERM: 'pill_hp_max_perm',
  PILL_MP_50: 'pill_mp_50',
  PILL_SPEED_BUFF: 'pill_speed_buff',
  PILL_CO_DUYEN: 'pill_co_duyen',
  PILL_PROTECT_HOA: 'pill_protect_hoa',
  PILL_PROTECT_THUY: 'pill_protect_thuy',
  PILL_PROTECT_MOC: 'pill_protect_moc',
  PILL_PROTECT_THO: 'pill_protect_tho',
  PILL_PROTECT_KIM: 'pill_protect_kim',
  PILL_PROTECT_PHONG: 'pill_protect_phong',
  PILL_PROTECT_LOI: 'pill_protect_loi',
  POTION_STAMINA_WEEKLY: 'potion_stamina_weekly',

  // ---- Phù lục (Talismans) ----
  TALISMAN_ANTI_LOI: 'talisman_anti_loi',
  TALISMAN_SPEED_1: 'talisman_speed_1',

  // ---- Vũ khí (Weapons) ----
  WEAPON_SWORD_1: 'weapon_sword_1',
  WEAPON_SWORD_2: 'weapon_sword_2',
  WEAPON_SWORD_3: 'weapon_sword_3',
  WEAPON_SWORD_F: 'weapon_sword_f',
  WEAPON_SWORD_D: 'weapon_sword_d',
  WEAPON_SWORD_C: 'weapon_sword_c',
  WEAPON_SWORD_B: 'weapon_sword_b',
  WEAPON_SWORD_A: 'weapon_sword_a',
  WEAPON_SWORD_S: 'weapon_sword_s',
  WEAPON_SWORD_SS: 'weapon_sword_ss',
  WEAPON_SWORD_SSS: 'weapon_sword_sss',
  WEAPON_SWORD_EX: 'weapon_sword_ex',
  WEAPON_LEGENDARY_1: 'weapon_legendary_1',
  WEAPON_LEGENDARY_2: 'weapon_legendary_2',
  WEAPON_LEGENDARY_3: 'weapon_legendary_3',
  WEAPON_LEGENDARY_4: 'weapon_legendary_4',
  WEAPON_LEGENDARY_5: 'weapon_legendary_5',

  // ---- Áo giáp (Armor) ----
  ARMOR_ROBE_1: 'armor_robe_1',
  ARMOR_ROBE_2: 'armor_robe_2',
  ARMOR_ROBE_3: 'armor_robe_3',
  ARMOR_ROBE_F: 'armor_robe_f',
  ARMOR_ROBE_D: 'armor_robe_d',
  ARMOR_ROBE_C: 'armor_robe_c',
  ARMOR_ROBE_B: 'armor_robe_b',
  ARMOR_ROBE_A: 'armor_robe_a',
  ARMOR_ROBE_S: 'armor_robe_s',
  ARMOR_ROBE_SS: 'armor_robe_ss',
  ARMOR_ROBE_SSS: 'armor_robe_sss',
  ARMOR_ROBE_EX: 'armor_robe_ex',

  // ---- Phôi (Molds/Crafting Bases) ----
  PHOI_WEAPON_F: 'phoi_weapon_f',
  PHOI_WEAPON_D: 'phoi_weapon_d',
  PHOI_WEAPON_C: 'phoi_weapon_c',
  PHOI_WEAPON_B: 'phoi_weapon_b',
  PHOI_WEAPON_A: 'phoi_weapon_a',
  PHOI_WEAPON_S: 'phoi_weapon_s',
  PHOI_WEAPON_SS: 'phoi_weapon_ss',
  PHOI_WEAPON_SSS: 'phoi_weapon_sss',
  PHOI_ARMOR_F: 'phoi_armor_f',
  PHOI_ARMOR_D: 'phoi_armor_d',
  PHOI_ARMOR_C: 'phoi_armor_c',
  PHOI_ARMOR_B: 'phoi_armor_b',
  PHOI_ARMOR_A: 'phoi_armor_a',
  PHOI_ARMOR_S: 'phoi_armor_s',
  PHOI_ARMOR_SS: 'phoi_armor_ss',
  PHOI_ARMOR_SSS: 'phoi_armor_sss',
  PHOI_ACCESSORY_S: 'phoi_accessory_s',
  PHOI_MOUNT_S: 'phoi_mount_s',

  // ---- Phụ kiện (Accessories) ----
  RING_1: 'ring_1',
  NECKLACE_1: 'necklace_1',
  AMULET_1: 'amulet_1',
  ACCESSORY_RING_1: 'accessory_ring_1',
  ACCESSORY_PENDANT_1: 'accessory_pendant_1',
  PENDANT_LINH_1: 'pendant_linh_1',
  PENDANT_LINH_2: 'pendant_linh_2',
  PENDANT_LINH_3: 'pendant_linh_3',
  RING_SPIRIT_1: 'ring_spirit_1',
  RING_SPIRIT_2: 'ring_spirit_2',
  RING_SPIRIT_3: 'ring_spirit_3',

  // ---- Vật cưỡi (Mounts) ----
  MOUNT_SWORD_1: 'mount_sword_1',
  MOUNT_BEAST_1: 'mount_beast_1',

  // ---- Nguyên liệu (Materials) ----
  MATERIAL_IRON_1: 'material_iron_1',
  MATERIAL_MYTHRIL_1: 'material_mythril_1',
  MATERIAL_TINH_THIET_1: 'material_tinh_thiet_1',
  MATERIAL_LINH_THAO_1: 'material_linh_thao_1',
  MATERIAL_NHAN_SAM_1: 'material_nhan_sam_1',
  MATERIAL_TUYET_LIEN: 'material_tuyet_lien',
  MATERIAL_LINGZHI: 'material_lingzhi',
  MATERIAL_NGODONG: 'material_ngodong',
  MATERIAL_BLOOD_FLOWER: 'material_blood_flower',
  MATERIAL_VOID_HERB: 'material_void_herb',
  MATERIAL_WIND_LEAF: 'material_wind_leaf',
  TINH_THACH_SHARD: 'tinh_thach_shard',
  LENH_BAI: 'lenh_bai',

  // ---- Hạt giống (Seeds) ----
  SEED_LINH_THAO_1: 'seed_linh_thao_1',
  SEED_NHAN_SAM_1: 'seed_nhan_sam_1',
  SEED_TUYET_LIEN: 'seed_tuyet_lien',
  SEED_LINGZHI: 'seed_lingzhi',
  SEED_NGODONG: 'seed_ngodong',
  SEED_BLOOD_FLOWER: 'seed_blood_flower',
  SEED_VOID_HERB: 'seed_void_herb',
  SEED_WIND_LEAF: 'seed_wind_leaf',

  // ---- Sách kỹ năng (Skill Books) ----
  BOOK_FIRE: 'book_fire',
  BOOK_WATER: 'book_water',
  BOOK_WOOD: 'book_wood',
  BOOK_EARTH: 'book_earth',
  BOOK_LIGHTNING: 'book_lightning',
  BOOK_WIND: 'book_wind',

  // ---- Đá mài (Repair Stones) ----
  REPAIR_STONE_LOW: 'repair_stone_low',
  REPAIR_STONE_MID: 'repair_stone_mid',
  REPAIR_STONE_HIGH: 'repair_stone_high',

  // ---- Lò luyện (Cauldrons) ----
  CAULDRON_LOW: 'cauldron_low',
  CAULDRON_MID: 'cauldron_mid',
  CAULDRON_HIGH: 'cauldron_high',

  // ---- Rương (Chests) ----
  LUCKY_CHEST: 'lucky_chest',
  CHEST_1TR5: 'chest_1tr5',
  SERVER_RAID_CHEST: 'server_raid_chest',

  // ---- Vật phẩm đặc biệt (Special Items) ----
  ITEM_FRAGMENT: 'item_fragment',
  MANH_VO_VU_KHI: 'manh_vo_vu_khi',
  MAP_FRAGMENT: 'map_fragment',
  TANG_BAO_DO: 'tang_bao_do',
  ITEM_TAM_SINH_THACH: 'item_tam_sinh_thach',
  ITEM_TUYET_TINH_NUOC: 'item_tuyet_tinh_nuoc',
  ITEM_NHAN_DINH_HON: 'item_nhan_dinh_hon',
  ITEM_NHAN_DINH_HON_KNB: 'item_nhan_dinh_hon_knb',
  ITEM_BLOODLINE_PILL: 'item_bloodline_pill',
  ITEM_BLOODLINE_PILL_KNB: 'item_bloodline_pill_knb',
  ITEM_LIFE_BIND_SCROLL: 'item_life_bind_scroll',
  ITEM_SEAL_SCROLL: 'item_seal_scroll',
  ITEM_DIVINE_MIRROR: 'item_divine_mirror',
  MAT_HUYEN_THIET: 'mat_huyen_thiet',
  ITEM_PET_EVOLVE: 'item_pet_evolve',
  ITEM_FORTUNE_ELIXIR: 'item_fortune_elixir',

  // ---- Infinite Dungeon Materials ----
  INFINITE_SHARD: 'infinite_shard',
  INFINITE_CORE: 'infinite_core',

  // ---- Prestige Materials ----
  PRESTIGE_MATERIAL: 'prestige_material',
} as const;

export type ItemId = typeof ITEMS[keyof typeof ITEMS];

// ---- Helper: Get dynamic item ID by grade ----
export function getWeaponByGrade(grade: string): string {
  return `weapon_sword_${grade}`;
}

export function getArmorByGrade(grade: string): string {
  return `armor_robe_${grade}`;
}

export function getPhoiWeaponByGrade(grade: string): string {
  return `phoi_weapon_${grade}`;
}

export function getPhoiArmorByGrade(grade: string): string {
  return `phoi_armor_${grade}`;
}

export function getLegendaryWeapon(num: number): string {
  return `weapon_legendary_${num}`;
}

// ---- Helper: Check item type by prefix ----
export function isWeaponId(itemId: string): boolean {
  return itemId.startsWith('weapon_');
}

export function isArmorId(itemId: string): boolean {
  return itemId.startsWith('armor_');
}

export function isSeedId(itemId: string): boolean {
  return itemId.startsWith('seed_');
}

export function isPhoiId(itemId: string): boolean {
  return itemId.startsWith('phoi_');
}

// ═══════════════════════════════════════════════════════════════════
// BIG UPDATE: New items
// ═══════════════════════════════════════════════════════════════════
export const ITEMS_RARE_FIRE_MATERIAL = 'material_rare_fire_shard';
export const ITEMS_BEAST_EGG = 'item_beast_egg';
export const ITEMS_TALISMAN_KY_NGO = 'talisman_ky_ngo';
export const ITEMS_PILL_NGU_LON = 'pill_ngu_lon';
export const ITEMS_PILL_BREAK_ANTI_LOI = 'pill_anti_loi_2';
export const ITEMS_FIRE_CORE = 'material_fire_core';
export const ITEMS_BEAST_FOOD = 'material_beast_food';
