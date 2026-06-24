export const RANK_TIERS = {
  gold:   { minElo: 1600, color: '#FFD700', name: 'Hạng Vàng',   rewards: { ngotinh: 500, coins: 10000, title: 'Vàng Đấu Trường' } },
  silver: { minElo: 1300, color: '#C0C0C0', name: 'Hạng Bạc',   rewards: { ngotinh: 300, coins: 5000, title: 'Bạc Đấu Trường' } },
  bronze: { minElo: 1000, color: '#CD7F32', name: 'Hạng Đồng',   rewards: { ngotinh: 150, coins: 2000, title: 'Đồng Đấu Trường' } },
  iron:   { minElo: 0,    color: '#808080', name: 'Hạng Sắt',    rewards: { ngotinh: 50, coins: 500 } }
} as const;

export const STREAK_BONUSES = [
  { streak: 3,  bonus: 1.1 },
  { streak: 5,  bonus: 1.25 },
  { streak: 10, bonus: 1.5 },
  { streak: 15, bonus: 2.0 },
  { streak: 20, bonus: 3.0 }
] as const;

export const DAILY_ARENA_LIMIT = 20;
export const SEASON_DURATION_DAYS = 14;
export const K_FACTOR = 32;
export const STARTING_ELO = 1000;
