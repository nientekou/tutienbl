"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InteractionRegistry_1 = require("./InteractionRegistry");
const CultivationInteractionHandler_1 = require("./CultivationInteractionHandler");
const LifeQuestHandler_1 = require("./LifeQuestHandler");
const SocialHandler_1 = require("./SocialHandler");
const LifeInteractionHandler_1 = require("./LifeInteractionHandler");
const CasinoInteractionHandler_1 = require("./CasinoInteractionHandler");
const TradeInteractionHandler_1 = require("./TradeInteractionHandler");
const BossCombatHandler_1 = require("./BossCombatHandler");
const MarketHandler_1 = require("./MarketHandler");
const NavigationHandler_1 = require("./NavigationHandler");
const NoituHandler_1 = require("./NoituHandler");
// Handler wrappers to bridge static class methods with HandlerFn signature
const wrap = (cls) => ((interaction, action, parts, userId) => cls.handle(interaction, action, parts, userId));
// Cultivation — ~45 actions
InteractionRegistry_1.registry.on(['luanhoiconfirm', 'luanhoicancel', 'ycanhawaken', 'tuluyen', 'dotpha',
    'loi', 'taytuynav', 'taytuyexecute', 'taytuy', 'select', 'confirmalignment',
    'dotpharisk', 'dotphastabilize',
    'tamphap_select', 'tamphap_activate',
    'kyngo_choose', 'kyngo_view', 'tamMa_fight', 'tamMa_retreat', 'ngoDao_activate',
    'ngotinh_activate', 'ngotinh_reroll_execute'], wrap(CultivationInteractionHandler_1.CultivationInteractionHandler));
// Equipment & Enhancement — ~12 actions
InteractionRegistry_1.registry.on(['enhance_select', 'enhance_confirm', 'enhance_cancel',
    'linhmach_select', 'linhmach_close',
    'dungkynang_select', 'dungkynang_cancel',
    'destiny_equip', 'destiny_unequip',
    'titleswitch',
    'pb'], handleEquipmentAction);
// Boss & Elite — ~10 actions (public)
InteractionRegistry_1.registry.on(['worldbossattack', 'worldbosslogs', 'worldbossrefresh', 'worldbossheal',
    'wbhealconfirm', 'wbhealcancel', 'worldbosslb', 'worldbossleave',
    'bossshop', 'bossshop_buy', 'worldbossnav',
    'sanyeuthulogs',
    'joinparty', 'leaveparty', 'startparty',
    'edenter', 'edattack', 'edretreat',
    'lapdoi'], BossCombatHandler_1.handleBossCombatAction, true);
// Market & Trading — ~15 actions
InteractionRegistry_1.registry.on(['shopbuy', 'sknbuy', 'shopnav', 'shop', 'shopsearch',
    'shopkynangnav', 'vanbaolaunav',
    'traveler_buy', 'traveler_buy_item', 'traveler_rob',
    'doitienselect', 'doitienmodal',
    'shopbuymodal', 'shopsearchmodal'], MarketHandler_1.handleMarketAction);
// Achievement & Destiny — ~8 actions
InteractionRegistry_1.registry.on(['thanhtuu', 'achieveclaim', 'titleselect', 'dest_select', 'dest_confirm'], handleAchievementAction);
// Social — ~25 actions
InteractionRegistry_1.registry.on(['sectestablishnav', 'sectleave', 'sectrefresh', 'sectupgrade',
    'bicanhnaav', 'bicanhselect', 'bicanhreact', 'bicanhlogs', 'bicanhback',
    'ycanhnaav', 'luanhoinnav', 'sungthunaav', 'sungthu', 'sanyeuthunaav',
    'trangbinaav', 'quyetau', 'leothapnav', 'leothap', 'leothapcard',
    'marriageaccept', 'marriagerefuse', 'guildwar', 'sectwarattack', 'sectwarrefresh',
    'toakynav', 'suachua', 'spiritinteract', 'spiritnav',
    'sectjoinselect', 'sectdonateselect', 'sectcreate',
    'anky_select',
    'arenanav', 'arena_find', 'arena_top', 'arena_history'], wrap(SocialHandler_1.SocialHandler));
// Navigation & Profile — ~15 actions
InteractionRegistry_1.registry.on(['hosotab', 'hosoback', 'hosolb', 'tuido', 'invprev', 'invnext',
    'invselect', 'mountprev', 'mountnext',
    'spiritprev', 'spiritnext',
    'achprev', 'achnext',
    'page_next', 'page_prev', 'pb_select', 'pb_play',
    'tonmonnav', 'dongphunav', 'dongphu_spring', 'dongphu_harvest',
    'dongphu_up_spring', 'dongphu_up_meridian', 'dongphu_up_array'], NavigationHandler_1.handleNavigationAction);
// PvP Combat — ~12 actions
InteractionRegistry_1.registry.on(['duelaccept', 'duelrefuse', 'duelchoose', 'dueluseitem', 'duellichsu',
    'bicanh', 'guildwar_join', 'sectwar_join',
    'pvp', 'arena_ranked', 'arena_streak', 'arena_rewards_claim'], handleCombatAction);
// Life skills
InteractionRegistry_1.registry.on(['alch'], wrap(LifeInteractionHandler_1.LifeInteractionHandler));
// Casino
InteractionRegistry_1.registry.on(['casinoplay', 'casinodouble', 'casinoopposite', 'casinoreplay'], wrap(CasinoInteractionHandler_1.CasinoInteractionHandler));
// Trade
InteractionRegistry_1.registry.on(['trade'], wrap(TradeInteractionHandler_1.TradeInteractionHandler));
// Noitu
InteractionRegistry_1.registry.on(['noituskip'], NoituHandler_1.handleNoituAction);
// LifeQuest actions
InteractionRegistry_1.registry.on([
    'linhdienharvest', 'linhdienunlock', 'linhdienrefresh', 'linhdiennav',
    'dongphuspring', 'dongphuupgrade',
    'chetaonav', 'craftclaim', 'craftrefresh', 'luyendannav',
    'luyenkhinav',
    'lamviecnav', 'lamviecwork',
    'nhiemvunav', 'nhiemvuclaim',
    'chainstart', 'chainclaim',
    'khambhanav', 'khambhastart', 'khambhaclaim', 'khambhaevent', 'encounter',
    'linhdiengieoselect', 'linhdienspeedupselect', 'linhdiencareselect',
    'craftselect', 'luyenkhiselect',
    // V15: New command button handlers
    'bicanhsonghanh_enter', 'hoidong', 'bangnghiavu_claim',
    'sectcouncil_vote_yes', 'sectcouncil_vote_no'
], wrap(LifeQuestHandler_1.LifeQuestHandler));
// Need to declare these handler functions after registry setup
// They are used above — hoisted via function declaration
function handleEquipmentAction(interaction, action, parts, userId) {
    const { handleEquipmentAction: fn } = require('./EquipmentInteractionHandler');
    return fn(interaction, action, parts, userId);
}
function handleAchievementAction(interaction, action, parts, userId) {
    const { handleAchievementAction: fn } = require('./AchievementInteractionHandler');
    return fn(interaction, action, parts, userId);
}
function handleCombatAction(interaction, action, parts, userId) {
    const { handleCombatAction: fn } = require('./CombatInteractionHandler');
    return fn(interaction, action, parts, userId);
}
// Huongdan — help system select menu
function handleHuongDanAction(interaction, action, parts, userId) {
    const { handleHuongDanAction: fn } = require('./HuongDanInteractionHandler');
    return fn(interaction, action, parts, userId);
}
InteractionRegistry_1.registry.on(['huongdan'], handleHuongDanAction);
