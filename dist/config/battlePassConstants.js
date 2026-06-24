"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BP_REWARDS = exports.BP_EXP_SOURCES = exports.BP_SEASON_DAYS = exports.BP_EXP_PER_TIER = exports.BP_MAX_TIER = void 0;
exports.BP_MAX_TIER = 50;
exports.BP_EXP_PER_TIER = 100;
exports.BP_SEASON_DAYS = 30;
exports.BP_EXP_SOURCES = {
    daily_quest: 20,
    weekly_quest: 50,
    arena_win: 5,
    dungeon_clear: 10,
    boss_attack: 15,
    craft: 10,
    work: 3,
    cultivation_tick: 1
};
exports.BP_REWARDS = [
    { tier: 1, free: [{ type: 'ngotinh', amount: 20 }], premium: [{ type: 'ngotinh', amount: 50 }] },
    { tier: 2, free: [{ type: 'coins', amount: 500 }], premium: [{ type: 'coins', amount: 1500 }] },
    { tier: 3, free: [{ type: 'item', id: 'pill_hp_1', amount: 5 }], premium: [{ type: 'item', id: 'pill_hp_1', amount: 15 }] },
    { tier: 5, free: [{ type: 'item', id: 'iron', amount: 10 }], premium: [{ type: 'item', id: 'iron', amount: 30 }] },
    { tier: 7, free: [{ type: 'ngotinh', amount: 50 }], premium: [{ type: 'ngotinh', amount: 150 }] },
    { tier: 10, free: [{ type: 'item', id: 'mythril', amount: 5 }], premium: [{ type: 'item', id: 'mythril', amount: 15 }] },
    { tier: 15, free: [{ type: 'ngotinh', amount: 100 }], premium: [{ type: 'ngotinh', amount: 300 }] },
    { tier: 20, free: [{ type: 'item', id: 'tinh_thiet', amount: 3 }], premium: [{ type: 'item', id: 'tinh_thiet', amount: 10 }] },
    { tier: 25, free: [{ type: 'ngotinh', amount: 200 }], premium: [{ type: 'ngotinh', amount: 500 }] },
    { tier: 30, free: [{ type: 'item', id: 'herb_rare_1', amount: 5 }], premium: [{ type: 'item', id: 'herb_rare_1', amount: 15 }] },
    { tier: 35, free: [{ type: 'ngotinh', amount: 300 }], premium: [{ type: 'ngotinh', amount: 800 }] },
    { tier: 40, free: [{ type: 'item', id: 'tinh_thach_shard', amount: 3 }], premium: [{ type: 'item', id: 'tinh_thach_shard', amount: 10 }] },
    { tier: 45, free: [{ type: 'ngotinh', amount: 500 }], premium: [{ type: 'ngotinh', amount: 1000 }] },
    { tier: 50, free: [{ type: 'ngotinh', amount: 1000 }], premium: [{ type: 'ngotinh', amount: 2000 }] },
];
