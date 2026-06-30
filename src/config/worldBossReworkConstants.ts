export interface BossPhase {
  phase: number;
  hpThreshold: number;
  name: string;
  abilities: BossAbility[];
  weakness: string;
  statMultiplier: { atk: number; def: number; spd: number };
}

export interface BossAbility {
  id: string;
  name: string;
  type: 'aoe' | 'single' | 'debuff' | 'heal';
  power: number;
  cooldown: number;
  description: string;
}

// V16 B-02: V2 — 5 phases replacing the original 3-phase system
export const BOSS_PHASES: BossPhase[] = [
  {
    phase: 1,
    hpThreshold: 100,
    name: 'Sơ Khởi',
    abilities: [
      { id: 'basic_strike', name: 'Đánh thường', type: 'single', power: 1.0, cooldown: 0, description: 'Đánh thường' }
    ],
    weakness: 'hoa',
    statMultiplier: { atk: 1.0, def: 1.0, spd: 1.0 }
  },
  {
    phase: 2,
    hpThreshold: 70,
    name: 'Phẫn Nộ',
    abilities: [
      { id: 'fury_strike', name: 'Phẫn Nộ Quyền', type: 'aoe', power: 1.5, cooldown: 2, description: 'Sát thương diện rộng lớn' },
      { id: 'weaken', name: 'Suy Yếu', type: 'debuff', power: 0.3, cooldown: 3, description: '-30% Công Kích người chơi' }
    ],
    weakness: 'thuy',
    statMultiplier: { atk: 1.3, def: 1.1, spd: 1.2 }
  },
  {
    phase: 3,
    hpThreshold: 40,
    name: 'Hồi Phục',
    abilities: [
      { id: 'heal_regen', name: 'Hồi Phục Tự Nhiên', type: 'heal', power: 0.10, cooldown: 0, description: 'Hồi 10% HP mỗi hiệp' },
      { id: 'weaken', name: 'Suy Yếu', type: 'debuff', power: 0.3, cooldown: 3, description: '-30% Công Kích người chơi' }
    ],
    weakness: 'moc',
    statMultiplier: { atk: 1.5, def: 1.2, spd: 1.0 }
  },
  {
    phase: 4,
    hpThreshold: 20,
    name: 'Thôn Tính',
    abilities: [
      { id: 'element_absorb', name: 'Thôn Tính Nguyên Tố', type: 'debuff', power: 0.5, cooldown: 1, description: 'Hấp thụ sát thương nguyên tố, giảm 50%' },
      { id: 'devastation', name: 'Hủy Diệt', type: 'aoe', power: 2.0, cooldown: 3, description: 'Sát thương cực lớn' }
    ],
    weakness: 'kim',
    statMultiplier: { atk: 1.8, def: 0.8, spd: 1.3 }
  },
  {
    phase: 5,
    hpThreshold: 5,
    name: 'Tuyệt Vọng',
    abilities: [
      { id: 'oneshot_annihilate', name: 'Tận Thế Hủy Diệt', type: 'aoe', power: 10.0, cooldown: 5, description: 'Hủy diệt kẻ địch sau 5 hiệp không tiêu diệt được boss' },
      { id: 'berserk', name: 'Cuồng Chiến Tuyệt Vọng', type: 'debuff', power: 0.5, cooldown: 0, description: '+50% Công Kích, -50% Phòng Thủ' }
    ],
    weakness: 'loi',
    statMultiplier: { atk: 2.5, def: 0.5, spd: 1.5 }
  }
];

export const BOSS_REWARDS = {
  mvp:         { ngotinh: 200, coins: 5000 },
  last_hit:    { ngotinh: 100, coins: 3000 },
  top3:        { ngotinh: 150, coins: 3000 },
  top10:       { ngotinh: 100, coins: 2000 },
  milestone:   { ngotinh: 50,  coins: 1000 },
  participation: { ngotinh: 20, coins: 500 }
};

export const BOSS_COUNTER_BONUS = 1.5;
