import { Interaction } from 'discord.js';
import { registry, type HandlerFn } from './InteractionRegistry';
import { CultivationInteractionHandler } from './CultivationInteractionHandler';
import { ProfileInteractionHandler } from './ProfileInteractionHandler';
import { LifeQuestHandler } from './LifeQuestHandler';
import { SocialHandler } from './SocialHandler';
import { LifeInteractionHandler } from './LifeInteractionHandler';
import { CasinoInteractionHandler } from './CasinoInteractionHandler';
import { TradeInteractionHandler } from './TradeInteractionHandler';
import { handleBossCombatAction } from './BossCombatHandler';
import { handleMarketAction } from './MarketHandler';
import { handleNavigationAction } from './NavigationHandler';
import { handleNoituAction } from './NoituHandler';

// Handler wrappers to bridge static class methods with HandlerFn signature
const wrap = (cls: { handle: Function }): HandlerFn =>
  ((interaction, action, parts, userId) => cls.handle(interaction, action, parts, userId)) as HandlerFn;

// Cultivation — ~45 actions
registry.on(
  ['luanhoiconfirm', 'luanhoicancel', 'ycanhawaken', 'tuluyen', 'dotpha',
   'loi', 'taytuynav', 'taytuyexecute', 'taytuy', 'select', 'confirmalignment',
   'dotpharisk', 'dotphastabilize',
   'tamphap_select', 'tamphap_activate',
   'kyngo_choose', 'kyngo_view', 'tamMa_fight', 'tamMa_retreat', 'ngoDao_activate',
   'ngotinh_activate', 'ngotinh_reroll_execute'],
  wrap(CultivationInteractionHandler)
);

// Equipment & Enhancement — ~12 actions
registry.on(
  ['enhance_select', 'enhance_confirm', 'enhance_cancel',
   'linhmach_select', 'linhmach_close',
   'dungkynang_select', 'dungkynang_cancel',
   'destiny_equip', 'destiny_unequip',
   'titleswitch',
   'pb'],
  handleEquipmentAction as HandlerFn
);

// Boss & Elite — ~10 actions (public)
registry.on(
  ['worldbossattack', 'worldbosslogs', 'worldbossrefresh', 'worldbossheal',
   'wbhealconfirm', 'wbhealcancel', 'worldbosslb', 'worldbossleave',
   'bossshop', 'bossshop_buy', 'worldbossnav',
   'sanyeuthulogs',
   'joinparty', 'leaveparty', 'startparty',
   'edenter', 'edattack', 'edretreat',
   'lapdoi'],
  handleBossCombatAction as HandlerFn, true
);

// Market & Trading — ~15 actions
registry.on(
  ['shopbuy', 'sknbuy', 'shopnav', 'shop', 'shopsearch',
   'shopkynangnav', 'vanbaolaunav',
   'traveler_buy', 'traveler_buy_item', 'traveler_rob',
   'doitienselect', 'doitienmodal',
   'shopbuymodal', 'shopsearchmodal'],
  handleMarketAction as HandlerFn
);

// Achievement & Destiny — ~8 actions
registry.on(
  ['thanhtuu', 'achieveclaim', 'titleselect', 'dest_select', 'dest_confirm'],
  handleAchievementAction as HandlerFn
);

// Social — ~25 actions
registry.on(
  ['sectestablishnav', 'sectleave', 'sectrefresh', 'sectupgrade',
   'bicanhnaav', 'bicanhselect', 'bicanhreact', 'bicanhlogs', 'bicanhback',
   'ycanhnaav', 'luanhoinnav', 'sungthunaav', 'sungthu', 'sanyeuthunaav',
   'trangbinaav', 'quyetau', 'leothapnav',
   'marriageaccept', 'marriagerefuse', 'guildwar', 'sectwarattack', 'sectwarrefresh',
   'toakynav', 'suachua', 'spiritinteract', 'spiritnav',
   'sectjoinselect', 'sectdonateselect', 'sectcreate',
   'anky_select'],
  wrap(SocialHandler)
);

// Navigation & Profile — ~15 actions
registry.on(
  ['hosotab', 'hosoback', 'hosolb', 'tuido', 'invprev', 'invnext',
   'invselect', 'mountprev', 'mountnext',
   'spiritprev', 'spiritnext',
   'achprev', 'achnext',
   'page_next', 'page_prev', 'pb_select', 'pb_play',
   'tonmonnav', 'dongphunav', 'dongphu_spring', 'dongphu_harvest',
   'dongphu_up_spring', 'dongphu_up_meridian', 'dongphu_up_array'],
  handleNavigationAction as HandlerFn
);

// PvP Combat — ~12 actions
registry.on(
  ['duelaccept', 'duelrefuse', 'duelchoose', 'dueluseitem', 'duellichsu',
   'bicanh', 'guildwar_join', 'sectwar_join',
   'pvp', 'arena_ranked', 'arena_streak', 'arena_rewards_claim'],
  handleCombatAction
);

// Life skills
registry.on(['alch'], wrap(LifeInteractionHandler));

// Casino
registry.on(['casinoplay', 'casinodouble', 'casinoopposite', 'casinoreplay'], wrap(CasinoInteractionHandler));

// Trade
registry.on(['trade'], wrap(TradeInteractionHandler));

// Noitu
registry.on(['noituskip'], handleNoituAction as HandlerFn);

// LifeQuest actions
registry.on([
  'linhdienharvest', 'linhdienunlock', 'linhdienrefresh', 'linhdiennav',
  'dongphuspring', 'dongphuupgrade',
  'chetaonav', 'craftclaim', 'craftrefresh', 'luyendannav',
  'lamviecnav', 'lamviecwork',
  'nhiemvunav', 'nhiemvuclaim',
  'chainstart', 'chainclaim',
  'khambhanav', 'khambhastart', 'khambhaclaim', 'khambhaevent', 'encounter',
  'linhdiengieoselect', 'linhdienspeedupselect', 'linhdiencareselect',
  'craftselect', 'luyenkhiselect',
  // V15: New command button handlers
  'bicanhsonghanh_enter', 'hoidong', 'bangnghiavu_claim',
  'sectcouncil_vote_yes', 'sectcouncil_vote_no'
], wrap(LifeQuestHandler));

// Need to declare these handler functions after registry setup
// They are used above — hoisted via function declaration
function handleEquipmentAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  const { handleEquipmentAction: fn } = require('./EquipmentInteractionHandler');
  return fn(interaction, action, parts, userId);
}

function handleAchievementAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  const { handleAchievementAction: fn } = require('./AchievementInteractionHandler');
  return fn(interaction, action, parts, userId);
}

function handleCombatAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  const { handleCombatAction: fn } = require('./CombatInteractionHandler');
  return fn(interaction, action, parts, userId);
}

// Huongdan — help system select menu
function handleHuongDanAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  const { handleHuongDanAction: fn } = require('./HuongDanInteractionHandler');
  return fn(interaction, action, parts, userId);
}

registry.on(['huongdan'], handleHuongDanAction as HandlerFn);
