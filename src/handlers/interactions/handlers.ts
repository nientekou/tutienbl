import { Interaction } from 'discord.js';
import { registry, type HandlerFn } from './InteractionRegistry';
import { CultivationInteractionHandler } from './CultivationInteractionHandler';
import { LifeQuestHandler } from './LifeQuestHandler';
import { SocialHandler } from './SocialHandler';
import { LifeInteractionHandler } from './LifeInteractionHandler';
import { CasinoInteractionHandler } from './CasinoInteractionHandler';
import { TradeInteractionHandler } from './TradeInteractionHandler';
import { handleBossCombatAction } from './BossCombatHandler';
import { handleMarketAction } from './MarketHandler';
import { handleNavigationAction } from './NavigationHandler';
import { handleNoituAction } from './NoituHandler';

const wrap = (cls: { handle: Function }): HandlerFn =>
  ((interaction, action, parts, userId) => cls.handle(interaction, action, parts, userId)) as HandlerFn;

registry.on(
  ['luanhoiconfirm', 'luanhoicancel', 'ycanhawaken', 'tuluyen', 'dotpha',
   'loi', 'taytuynav', 'taytuyexecute', 'taytuy', 'select', 'confirmalignment',
   'dotpharisk', 'dotphastabilize',
   'tamphap_select', 'tamphap_activate',
   'kyngo_choose', 'kyngo_view', 'tamMa_fight', 'tamMa_retreat', 'ngoDao_activate',
   'ngotinh_activate', 'ngotinh_reroll_execute'],
  wrap(CultivationInteractionHandler)
);

registry.on(
  ['enhance_select', 'enhance_confirm', 'enhance_cancel',
   'linhmach_select', 'linhmach_close',
   'dungkynang_select', 'dungkynang_cancel',
   'destiny_equip', 'destiny_unequip',
   'titleswitch', 'pb'],
  handleEquipmentAction as HandlerFn
);

registry.on(
  ['worldbossattack', 'worldbosslogs', 'worldbossrefresh', 'worldbossheal',
   'wbhealconfirm', 'wbhealcancel', 'worldbosslb', 'worldbossleave',
   'bossshop', 'bossshop_buy', 'worldbossnav',
   'sanyeuthulogs',
   'joinparty', 'leaveparty', 'startparty',
   'edenter', 'edattack', 'edretreat',
   'lapdoi'],
  handleBossCombatAction as HandlerFn,
  true
);

registry.on(
  ['shopbuy', 'sknbuy', 'shopnav', 'shop', 'shopsearch',
   'shopkynangnav', 'vanbaolaunav',
   'traveler_buy', 'traveler_buy_item', 'traveler_rob',
   'doitienselect', 'doitienmodal',
   'shopbuymodal', 'shopsearchmodal'],
  handleMarketAction as HandlerFn
);

registry.on(
  ['thanhtuu', 'achieveclaim', 'titleselect', 'dest_select', 'dest_confirm'],
  handleAchievementAction as HandlerFn
);

registry.on(
  ['sectestablishnav', 'sectleave', 'sectrefresh', 'sectupgrade',
   'bicanhnaav', 'bicanhselect', 'bicanhreact', 'bicanhlogs', 'bicanhback',
   'ycanhnaav', 'luanhoinnav', 'sungthunaav', 'sungthu', 'sanyeuthunaav',
   'trangbinaav', 'quyetau', 'leothapnav', 'leothap', 'leothapcard',
   'marriageaccept', 'marriagerefuse', 'guildwar', 'sectwarattack', 'sectwarrefresh',
   'toakynav', 'suachua', 'spiritinteract', 'spiritnav',
   'sectjoinselect', 'sectdonateselect', 'sectcreate',
   'anky_select', 'arenanav', 'arena_find', 'arena_top', 'arena_history'],
  wrap(SocialHandler)
);

registry.on(
  ['hosotab', 'hosoback', 'hosolb', 'tuido', 'invprev', 'invnext',
   'invselect', 'mountprev', 'mountnext', 'spiritprev', 'spiritnext',
   'achprev', 'achnext', 'page_next', 'page_prev', 'pb_select', 'pb_play',
   'tonmonnav', 'dongphunav', 'dongphu_spring', 'dongphu_harvest',
   'dongphu_up_spring', 'dongphu_up_meridian', 'dongphu_up_array'],
  handleNavigationAction as HandlerFn
);

registry.on(
  ['duelaccept', 'duelrefuse', 'duelchoose', 'dueluseitem', 'duellichsu',
   'bicanh', 'guildwar_join', 'sectwar_join',
   'pvp', 'arena_ranked', 'arena_streak', 'arena_rewards_claim'],
  handleCombatAction
);

registry.on(['alch'], wrap(LifeInteractionHandler));
registry.on(['casinoplay', 'casinodouble', 'casinoopposite', 'casinoreplay'], wrap(CasinoInteractionHandler));
registry.on(['trade'], wrap(TradeInteractionHandler));
registry.on(['noituskip'], handleNoituAction as HandlerFn);

registry.on([
  'linhdienharvest', 'linhdienunlock', 'linhdienrefresh', 'linhdiennav',
  'dongphuspring', 'dongphuupgrade',
  'chetaonav', 'craftclaim', 'craftrefresh', 'luyendannav', 'luyenkhinav',
  'lamviecnav', 'lamviecwork',
  'nhiemvunav', 'nhiemvuclaim',
  'chainstart', 'chainclaim',

  // Giữ cả hai tên để tương thích với customId cũ/mới.
  'khambhanav', 'khambhastart', 'khambhaclaim', 'khambhaevent',
  'khamphanav', 'khamphastart', 'khamphaclaim', 'khamphaevent',

  'encounter',
  'linhdiengieoselect', 'linhdienspeedupselect', 'linhdiencareselect',
  'craftselect', 'luyenkhiselect',
  'bicanhsonghanh_enter', 'hoidong',

  // V17 — action không chứa dấu "_" để khớp parser customId hiện tại.
  'bangpick', 'bangclaim',

  'sectcouncil_vote_yes', 'sectcouncil_vote_no'
], wrap(LifeQuestHandler));

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

function handleHuongDanAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  const { handleHuongDanAction: fn } = require('./HuongDanInteractionHandler');
  return fn(interaction, action, parts, userId);
}

registry.on(['huongdan'], handleHuongDanAction as HandlerFn);
