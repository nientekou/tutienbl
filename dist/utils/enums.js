"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemType = exports.InteractionAction = void 0;
/**
 * Định nghĩa các hành động Interaction (Nút bấm, Select Menu, Modal)
 */
var InteractionAction;
(function (InteractionAction) {
    // Sinh hoạt
    InteractionAction["WORK"] = "lamviecwork";
    // Hành trang
    InteractionAction["INVENTORY_PAGINATION_PREV"] = "invprev";
    InteractionAction["INVENTORY_PAGINATION_NEXT"] = "invnext";
    InteractionAction["INVENTORY_USE_EQUIP"] = "invselect";
    InteractionAction["UNEQUIP"] = "unequip";
    InteractionAction["EQUIP"] = "equip";
    InteractionAction["USE_ITEM"] = "use";
    // Hồ sơ
    InteractionAction["HOSO_ACTION"] = "hosoaction";
    InteractionAction["HOSO_BACK"] = "hosoback";
    InteractionAction["HOSO_TUIDO"] = "tuido";
    // Lỗi & Giao tiếp
    InteractionAction["LOI"] = "loi";
    // Cửa hàng & Kỹ năng
    InteractionAction["SHOP_BUY"] = "shopbuy";
    InteractionAction["SKILL_BOOK_BUY"] = "sknbuy";
    // World Boss
    InteractionAction["WORLD_BOSS_ATTACK"] = "worldbossattack";
    // Quyết Đấu
    InteractionAction["DUEL_ACCEPT"] = "duelaccept";
    InteractionAction["DUEL_REFUSE"] = "duelrefuse";
    InteractionAction["DUEL_CHOOSE"] = "duelchoose";
    InteractionAction["DUEL_HISTORY"] = "duellichsu";
    // Giao dịch & Khác
    InteractionAction["TRADE"] = "trade";
    InteractionAction["REPAIR"] = "suachua";
    InteractionAction["SECT_CREATE"] = "sectcreate";
})(InteractionAction || (exports.InteractionAction = InteractionAction = {}));
/**
 * Phân loại vật phẩm
 */
var ItemType;
(function (ItemType) {
    ItemType["PILL"] = "pill";
    ItemType["EQUIPMENT"] = "equipment";
    ItemType["MATERIAL"] = "material";
    ItemType["CHEST"] = "chest";
    ItemType["SEED"] = "seed";
    ItemType["TALISMAN"] = "talisman";
    ItemType["RECIPE"] = "recipe";
    ItemType["SKILL_BOOK"] = "skill_book";
    ItemType["QUEST_ITEM"] = "quest_item";
    ItemType["OTHER"] = "other";
})(ItemType || (exports.ItemType = ItemType = {}));
