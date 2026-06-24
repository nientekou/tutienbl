export interface RareBeastDef {
  type: string;
  name: string;
  rarity: 'rare' | 'epic' | 'legendary' | 'mythic';
  element: string;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  passiveSkill: string;
  passiveDescription: string;
  evolveBonus: { atk: number; def: number; hp: number }[];
  tamingRate: number;
}

export const RARE_BEASTS: RareBeastDef[] = [
  {
    type: 'kim_long',
    name: 'Kim Long',
    rarity: 'rare',
    element: 'kim',
    baseAtk: 30, baseDef: 40, baseHp: 200,
    passiveSkill: 'metal_resist',
    passiveDescription: '+10% kháng sát thương kim',
    evolveBonus: [
      { atk: 5, def: 8, hp: 40 },
      { atk: 10, def: 15, hp: 80 },
      { atk: 18, def: 25, hp: 150 },
      { atk: 30, def: 40, hp: 250 },
      { atk: 50, def: 60, hp: 400 }
    ],
    tamingRate: 0.15
  },
  {
    type: 'bach_ho',
    name: 'Bạch Hổ',
    rarity: 'epic',
    element: 'kim',
    baseAtk: 50, baseDef: 35, baseHp: 180,
    passiveSkill: 'crit_hunt',
    passiveDescription: '+8% crit khi HP địch < 30%',
    evolveBonus: [
      { atk: 10, def: 6, hp: 35 },
      { atk: 20, def: 12, hp: 70 },
      { atk: 35, def: 22, hp: 130 },
      { atk: 55, def: 35, hp: 220 },
      { atk: 80, def: 55, hp: 350 }
    ],
    tamingRate: 0.08
  },
  {
    type: 'thien_ma',
    name: 'Thiên Mã',
    rarity: 'legendary',
    element: 'phong',
    baseAtk: 40, baseDef: 30, baseHp: 250,
    passiveSkill: 'speed_surge',
    passiveDescription: '+15% speed, +5% dodge',
    evolveBonus: [
      { atk: 8, def: 5, hp: 50 },
      { atk: 15, def: 10, hp: 100 },
      { atk: 28, def: 18, hp: 180 },
      { atk: 45, def: 30, hp: 300 },
      { atk: 70, def: 50, hp: 500 }
    ],
    tamingRate: 0.03
  },
  {
    type: 'lac_hong',
    name: 'Lạc Hồng',
    rarity: 'mythic',
    element: 'hoa',
    baseAtk: 60, baseDef: 45, baseHp: 300,
    passiveSkill: 'phoenix_flame',
    passiveDescription: '+20% fire damage, hồi sinh 1 lần/trận',
    evolveBonus: [
      { atk: 12, def: 9, hp: 60 },
      { atk: 25, def: 18, hp: 120 },
      { atk: 45, def: 30, hp: 220 },
      { atk: 70, def: 50, hp: 380 },
      { atk: 100, def: 75, hp: 600 }
    ],
    tamingRate: 0.01
  },
  {
    type: 'bach_lan',
    name: 'Bạch Lân',
    rarity: 'rare',
    element: 'thuy',
    baseAtk: 25, baseDef: 45, baseHp: 220,
    passiveSkill: 'water_shield',
    passiveDescription: '+8% shields khi HP thấp',
    evolveBonus: [
      { atk: 4, def: 10, hp: 45 },
      { atk: 8, def: 18, hp: 90 },
      { atk: 15, def: 28, hp: 160 },
      { atk: 25, def: 42, hp: 270 },
      { atk: 40, def: 65, hp: 430 }
    ],
    tamingRate: 0.12
  },
  {
    type: 'hoc_nghich',
    name: 'Hắc Nghịch',
    rarity: 'epic',
    element: 'tho',
    baseAtk: 45, baseDef: 50, baseHp: 200,
    passiveSkill: 'earth_fortify',
    passiveDescription: '+12% DEF, +5% HP regen',
    evolveBonus: [
      { atk: 8, def: 12, hp: 40 },
      { atk: 16, def: 22, hp: 80 },
      { atk: 28, def: 35, hp: 150 },
      { atk: 45, def: 50, hp: 250 },
      { atk: 65, def: 75, hp: 400 }
    ],
    tamingRate: 0.06
  }
];
