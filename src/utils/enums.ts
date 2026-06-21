/**
 * Định nghĩa các hành động Interaction (Nút bấm, Select Menu, Modal)
 */
export enum InteractionAction {
  // Sinh hoạt
  WORK = 'lamviecwork',
  
  // Hành trang
  INVENTORY_PAGINATION_PREV = 'invprev',
  INVENTORY_PAGINATION_NEXT = 'invnext',
  INVENTORY_USE_EQUIP = 'invselect',
  UNEQUIP = 'unequip',
  EQUIP = 'equip',
  USE_ITEM = 'use',
  
  // Hồ sơ
  HOSO_ACTION = 'hosoaction',
  HOSO_BACK = 'hosoback',
  HOSO_TUIDO = 'tuido',
  
  // Lỗi & Giao tiếp
  LOI = 'loi',
  
  // Cửa hàng & Kỹ năng
  SHOP_BUY = 'shopbuy',
  SKILL_BOOK_BUY = 'sknbuy',
  
  // World Boss
  WORLD_BOSS_ATTACK = 'worldbossattack',
  
  // Quyết Đấu
  DUEL_ACCEPT = 'duelaccept',
  DUEL_REFUSE = 'duelrefuse',
  DUEL_CHOOSE = 'duelchoose',
  DUEL_HISTORY = 'duellichsu',
  
  // Giao dịch & Khác
  TRADE = 'trade',
  REPAIR = 'suachua',
  SECT_CREATE = 'sectcreate',
}

/**
 * Phân loại vật phẩm
 */
export enum ItemType {
  PILL = 'pill',
  EQUIPMENT = 'equipment',
  MATERIAL = 'material',
  CHEST = 'chest',
  SEED = 'seed',
  TALISMAN = 'talisman',
  RECIPE = 'recipe',
  SKILL_BOOK = 'skill_book',
  QUEST_ITEM = 'quest_item',
  OTHER = 'other',
}
