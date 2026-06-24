"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOSS_COUNTER_BONUS = exports.BOSS_REWARDS = exports.BOSS_PHASES = void 0;
exports.BOSS_PHASES = [
    {
        phase: 1,
        hpThreshold: 100,
        name: 'Giai Đoạn 1 — Ủng hộ',
        abilities: [
            { id: 'basic_strike', name: 'Đánh thường', type: 'single', power: 1.0, cooldown: 0, description: 'Đánh thường' }
        ],
        weakness: 'hoa',
        statMultiplier: { atk: 1.0, def: 1.0, spd: 1.0 }
    },
    {
        phase: 2,
        hpThreshold: 60,
        name: 'Giai Đoạn 2 — Phẫn nộ',
        abilities: [
            { id: 'fury_strike', name: 'Phẫn Nộ Quyền', type: 'aoe', power: 1.5, cooldown: 2, description: 'AOE damage lớn' },
            { id: 'weaken', name: 'Yếu Đuối', type: 'debuff', power: 0.3, cooldown: 3, description: '-30% ATK player' }
        ],
        weakness: 'thuy',
        statMultiplier: { atk: 1.3, def: 1.1, spd: 1.2 }
    },
    {
        phase: 3,
        hpThreshold: 25,
        name: 'Giai Đoạn 3 — Tuyệt Vọng',
        abilities: [
            { id: 'devastation', name: 'Hủy Diệt', type: 'aoe', power: 2.0, cooldown: 3, description: 'Sát thương cực lớn' },
            { id: 'regenerate', name: 'Hồi Sinh', type: 'heal', power: 0.15, cooldown: 4, description: 'Hồi 15% HP' },
            { id: 'berserk', name: 'Cuồng Chiến', type: 'debuff', power: 0.5, cooldown: 5, description: '+50% ATK, -30% DEF' }
        ],
        weakness: 'loi',
        statMultiplier: { atk: 1.6, def: 0.8, spd: 1.5 }
    }
];
exports.BOSS_REWARDS = {
    mvp: { ngotinh: 200, coins: 5000 },
    last_hit: { ngotinh: 100, coins: 3000 },
    top3: { ngotinh: 150, coins: 3000 },
    top10: { ngotinh: 100, coins: 2000 },
    milestone: { ngotinh: 50, coins: 1000 },
    participation: { ngotinh: 20, coins: 500 }
};
exports.BOSS_COUNTER_BONUS = 1.5;
