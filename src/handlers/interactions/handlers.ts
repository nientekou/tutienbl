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
  ((interaction, action, parts, userId) =>
    cls.handle(interaction, action, parts, userId)) as HandlerFn;

// ============================================================
// CULTIVATION
// ============================================================

registry.on(
  [
    'luanhoiconfirm',
    'luanhoicancel',
    'ycanhawaken',
    'tuluyen',
    'dotpha',
    'loi',
    'taytuynav',
    'taytuyexecute',
    'taytuy',
    'select',
    'confirmalignment',
    'dotpharisk',
    'dotphastabilize',
    'tamphap_select',
    'tamphap_activate',
    'kyngo_choose',
    'kyngo_view',
    'tamMa_fight',
    'tamMa_retreat',
    'ngoDao_activate',
    'ngotinh_activate',
    'ngotinh_reroll_execute'
  ],
  wrap(CultivationInteractionHandler)
);

// ============================================================
// EQUIPMENT & ENHANCEMENT
// ============================================================

registry.on(
  [
    'enhance_select',
    'enhance_confirm',
    'enhance_cancel',
    'linhmach_select',
    'linhmach_close',
    'dungkynang_select',
    'dungkynang_cancel',
    'destiny_equip',
    'destiny_unequip',
    'titleswitch',
    'pb'
  ],
  handleEquipmentAction as HandlerFn
);

// ============================================================
// BOSS & ELITE
// Public interactions
// ============================================================

registry.on(
  [
    'worldbossattack',
    'worldbosslogs',
    'worldbossrefresh',
    'worldbossheal',
    'wbhealconfirm',
    'wbhealcancel',
    'worldbosslb',
    'worldbossleave',
    'bossshop',
    'bossshop_buy',
    'worldbossnav',
    'sanyeuthulogs',
    'joinparty',
    'leaveparty',
    'startparty',
    'edenter',
    'edattack',
    'edretreat',
    'lapdoi'
  ],
  handleBossCombatAction as HandlerFn,
  true
);

// ============================================================
// MARKET & TRADING
// ============================================================

registry.on(
  [
    'shopbuy',
    'sknbuy',
    'shopnav',
    'shop',
    'shopsearch',
    'shopkynangnav',
    'vanbaolaunav',
    'traveler_buy',
    'traveler_buy_item',
    'traveler_rob',
    'doitienselect',
    'doitienmodal',
    'shopbuymodal',
    'shopsearchmodal'
  ],
  handleMarketAction as HandlerFn
);

// ============================================================
// ACHIEVEMENT & DESTINY
// ============================================================

registry.on(
  [
    'thanhtuu',
    'achieveclaim',
    'titleselect',
    'dest_select',
    'dest_confirm'
  ],
  handleAchievementAction as HandlerFn
);

// ============================================================
// SOCIAL
// ============================================================

registry.on(
  [
    'sectestablishnav',
    'sectleave',
    'sectrefresh',
    'sectupgrade',

    'bicanhnaav',
    'bicanhselect',
    'bicanhreact',
    'bicanhlogs',
    'bicanhback',

    'ycanhnaav',
    'luanhoinnav',
    'sungthunaav',
    'sungthu',
    'sanyeuthunaav',

    'trangbinaav',
    'quyetau',

    'leothapnav',
    'leothap',
    'leothapcard',

    'marriageaccept',
    'marriagerefuse',

    'guildwar',
    'sectwarattack',
    'sectwarrefresh',

    'toakynav',
    'suachua',

    'spiritinteract',
    'spiritnav',

    'sectjoinselect',
    'sectdonateselect',
    'sectcreate',

    'anky_select',

    'arenanav',
    'arena_find',
    'arena_top',
    'arena_history'
  ],
  wrap(SocialHandler)
);

// ============================================================
// NAVIGATION & PROFILE
// ============================================================

registry.on(
  [
    'hosotab',
    'hosoback',
    'hosolb',

    'tuido',
    'invprev',
    'invnext',
    'invselect',

    'mountprev',
    'mountnext',

    'spiritprev',
    'spiritnext',

    'achprev',
    'achnext',

    'page_next',
    'page_prev',

    'pb_select',
    'pb_play',

    'tonmonnav',

    'dongphunav',
    'dongphu_spring',
    'dongphu_harvest',
    'dongphu_up_spring',
    'dongphu_up_meridian',
    'dongphu_up_array'
  ],
  handleNavigationAction as HandlerFn
);

// ============================================================
// PVP COMBAT
// ============================================================

registry.on(
  [
    'duelaccept',
    'duelrefuse',
    'duelchoose',
    'dueluseitem',
    'duellichsu',

    'bicanh',

    'guildwar_join',
    'sectwar_join',

    'pvp',

    'arena_ranked',
    'arena_streak',
    'arena_rewards_claim'
  ],
  handleCombatAction
);

// ============================================================
// LIFE SKILLS
// ============================================================

registry.on(
  ['alch'],
  wrap(LifeInteractionHandler)
);

// ============================================================
// CASINO
// ============================================================

registry.on(
  [
    'casinoplay',
    'casinodouble',
    'casinoopposite',
    'casinoreplay'
  ],
  wrap(CasinoInteractionHandler)
);

// ============================================================
// TRADE
// ============================================================

registry.on(
  ['trade'],
  wrap(TradeInteractionHandler)
);

// ============================================================
// NỘI TU
// ============================================================

registry.on(
  ['noituskip'],
  handleNoituAction as HandlerFn
);

// ============================================================
// LIFE QUEST / DAILY SYSTEM / BOUNTY BOARD
// ============================================================

registry.on(
  [
    // --------------------------------------------------------
    // LINH ĐIỀN
    // --------------------------------------------------------

    'linhdienharvest',
    'linhdienunlock',
    'linhdienrefresh',
    'linhdiennav',

    'linhdiengieoselect',
    'linhdienspeedupselect',
    'linhdiencareselect',

    // --------------------------------------------------------
    // ĐỘNG PHỦ
    // --------------------------------------------------------

    'dongphuspring',
    'dongphuupgrade',

    // --------------------------------------------------------
    // CHẾ TẠO / LUYỆN KHÍ / LUYỆN ĐAN
    // --------------------------------------------------------

    'chetaonav',
    'craftclaim',
    'craftrefresh',
    'craftselect',

    'luyendannav',

    'luyenkhinav',
    'luyenkhiselect',

    // --------------------------------------------------------
    // LÀM VIỆC
    // --------------------------------------------------------

    'lamviecnav',
    'lamviecwork',

    // --------------------------------------------------------
    // NHIỆM VỤ CŨ
    // --------------------------------------------------------

    'nhiemvunav',
    'nhiemvuclaim',

    // --------------------------------------------------------
    // CHUỖI NHIỆM VỤ
    // --------------------------------------------------------

    'chainstart',
    'chainclaim',

    // --------------------------------------------------------
    // KHÁM PHÁ
    // --------------------------------------------------------

    'khambhanav',
    'khambhastart',
    'khambhaclaim',
    'khambhaevent',

    // Một số file cũ có thể dùng "khampha" thay vì "khambha".
    // Giữ thêm để tương thích.
    'khamphanav',
    'khamphastart',
    'khamphaclaim',
    'khamphaevent',

    // --------------------------------------------------------
    // KỲ NGỘ
    // --------------------------------------------------------

    'encounter',

    // --------------------------------------------------------
    // V15 / V17
    // --------------------------------------------------------

    'bicanhsonghanh_enter',

    'hoidong',

    // ========================================================
    // V17 — BẢNG NGHĨA VỤ
    // ========================================================

    // Select Menu: chọn đúng 3 trong 6 nghĩa vụ hôm nay
    'bangnghiavu_select',

    // Giữ claim để tương thích / nhận thưởng thủ công nếu cần
    'bangnghiavu_claim',

    // --------------------------------------------------------
    // HỘI ĐỒNG TÔNG MÔN
    // --------------------------------------------------------

    'sectcouncil_vote_yes',
    'sectcouncil_vote_no'
  ],
  wrap(LifeQuestHandler)
);

// ============================================================
// HANDLER WRAPPERS
// ============================================================

// Need to declare these handler functions after registry setup.
// Function declarations are hoisted.

// ------------------------------------------------------------
// EQUIPMENT
// ------------------------------------------------------------

function handleEquipmentAction(
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  const {
    handleEquipmentAction: fn
  } = require('./EquipmentInteractionHandler');

  return fn(
    interaction,
    action,
    parts,
    userId
  );
}

// ------------------------------------------------------------
// ACHIEVEMENT
// ------------------------------------------------------------

function handleAchievementAction(
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  const {
    handleAchievementAction: fn
  } = require('./AchievementInteractionHandler');

  return fn(
    interaction,
    action,
    parts,
    userId
  );
}

// ------------------------------------------------------------
// COMBAT
// ------------------------------------------------------------

function handleCombatAction(
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  const {
    handleCombatAction: fn
  } = require('./CombatInteractionHandler');

  return fn(
    interaction,
    action,
    parts,
    userId
  );
}

// ------------------------------------------------------------
// HƯỚNG DẪN
// ------------------------------------------------------------

function handleHuongDanAction(
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  const {
    handleHuongDanAction: fn
  } = require('./HuongDanInteractionHandler');

  return fn(
    interaction,
    action,
    parts,
    userId
  );
}

registry.on(
  ['huongdan'],
  handleHuongDanAction as HandlerFn
);
