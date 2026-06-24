export interface InnerDemonDef {
  type: string;
  name: string;
  description: string;
  element: string;
  basePower: number;
  skills: string[];
  reward: { daoType: string; points: number };
  failurePenalty: { qiDeviation: number; statPenalty: number; statType: string };
}

export const INNER_DEMON_TYPES: InnerDemonDef[] = [
  {
    type: 'fear',
    name: 'Sợ Hãi Nội Tâm',
    description: 'Một bóng đen hiện ra, mang hình dáng nỗi sợ sâu xa nhất của ngươi.',
    element: 'thuy',
    basePower: 50,
    skills: ['fear_gaze', 'shadow_strike'],
    reward: { daoType: 'soul_dao', points: 10 },
    failurePenalty: { qiDeviation: 15, statPenalty: 5, statType: 'def' }
  },
  {
    type: 'doubt',
    name: 'Nghi Ngại Tâm Đạo',
    description: 'Tiếng nói vang lên: "Ngươi có chắc con đường này đúng không?"',
    element: 'phong',
    basePower: 60,
    skills: ['doubt_whisper', 'mental_shatter'],
    reward: { daoType: 'sword_dao', points: 12 },
    failurePenalty: { qiDeviation: 20, statPenalty: 8, statType: 'atk' }
  },
  {
    type: 'obsession',
    name: 'Tham Vọng Vô Đâu',
    description: 'Một phiên bản khác của ngươi xuất hiện, mạnh hơn, tàn nhẫn hơn.',
    element: 'hoa',
    basePower: 80,
    skills: ['obsession_clone', 'soul_drain'],
    reward: { daoType: 'body_dao', points: 15 },
    failurePenalty: { qiDeviation: 25, statPenalty: 10, statType: 'hp' }
  },
  {
    type: 'wrath',
    name: 'Thịnh Nộ Bất Kềm',
    description: 'Lửa giận bao phủ, ngươi cảm thấy mất kiểm soát…',
    element: 'hoa',
    basePower: 70,
    skills: ['wrath_burst', 'berserk_rage'],
    reward: { daoType: 'formation_dao', points: 14 },
    failurePenalty: { qiDeviation: 20, statPenalty: 7, statType: 'speed' }
  },
  {
    type: 'pride',
    name: 'Kiêu Ngạo Thiên Ngoại',
    description: 'Một vị thần tiên cao ngạo xuất hiện: "Nhân loại nhỏ bé, ngươi dám so với ta?"',
    element: 'loi',
    basePower: 100,
    skills: ['pride_strike', 'divine_pressure'],
    reward: { daoType: 'alchemist_dao', points: 20 },
    failurePenalty: { qiDeviation: 30, statPenalty: 12, statType: 'crit' }
  }
];

export const DAO_TYPES = ['sword_dao', 'body_dao', 'alchemist_dao', 'formation_dao', 'soul_dao'] as const;
export type DaoType = typeof DAO_TYPES[number];

export const DAO_LEVELS: Record<string, { pointsNeeded: number; passive: string; value: number }[]> = {
  sword_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'atk_bonus', value: 5 },
    { pointsNeeded: 150, passive: 'crit_bonus', value: 3 },
    { pointsNeeded: 350, passive: 'dmg_reduce', value: 5 },
    { pointsNeeded: 700, passive: 'double_strike', value: 10 },
    { pointsNeeded: 1200, passive: 'sword_qi', value: 15 },
    { pointsNeeded: 2000, passive: 'sword_domain', value: 20 },
  ],
  soul_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'mp_regen', value: 3 },
    { pointsNeeded: 150, passive: 'dodge_bonus', value: 4 },
    { pointsNeeded: 350, passive: 'mental_resist', value: 15 },
    { pointsNeeded: 700, passive: 'soul_shield', value: 10 },
    { pointsNeeded: 1200, passive: 'soul_drain', value: 5 },
    { pointsNeeded: 2000, passive: 'soul_domain', value: 20 },
  ],
  body_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'hp_bonus', value: 50 },
    { pointsNeeded: 150, passive: 'def_bonus', value: 5 },
    { pointsNeeded: 350, passive: 'regen', value: 3 },
    { pointsNeeded: 700, passive: 'thorn', value: 8 },
    { pointsNeeded: 1200, passive: 'unyielding', value: 1 },
    { pointsNeeded: 2000, passive: 'body_domain', value: 20 },
  ],
  formation_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'craft_bonus', value: 5 },
    { pointsNeeded: 150, passive: 'enhance_bonus', value: 3 },
    { pointsNeeded: 350, passive: 'exp_bonus', value: 10 },
    { pointsNeeded: 700, passive: 'trap_chance', value: 15 },
    { pointsNeeded: 1200, passive: 'formation_mastery', value: 20 },
    { pointsNeeded: 2000, passive: 'formation_domain', value: 25 },
  ],
  alchemist_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'alchemy_bonus', value: 5 },
    { pointsNeeded: 150, passive: 'pill_bonus', value: 10 },
    { pointsNeeded: 350, passive: 'rare_chance', value: 3 },
    { pointsNeeded: 700, passive: 'auto_refine', value: 1 },
    { pointsNeeded: 1200, passive: 'master_alchemist', value: 20 },
    { pointsNeeded: 2000, passive: 'alchemy_domain', value: 25 },
  ]
};

export const TAM_MA_BASE_CHANCE = 0.05;
export const TAM_MA_QI_DEV_BONUS = 0.001;
export const TAM_MA_MAX_CHANCE = 0.25;
