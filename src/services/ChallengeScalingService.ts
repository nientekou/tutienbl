import db from '../database/database';

// A-08: Challenge Scaling System

interface ChallengeModifier {
  id: string;
  name: string;
  description: string;
  effect: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const CHALLENGE_MODIFIERS: ChallengeModifier[] = [
  { id: 'cm_speed', name: 'Tốc Độ', description: 'Hoàn thành trong 3 phút', effect: 'time_limit', difficulty: 'easy' },
  { id: 'cm_no_item', name: 'Cấm Vật Phẩm', description: 'Không được dùng vật phẩm', effect: 'no_items', difficulty: 'medium' },
  { id: 'cm_no_skill', name: 'Cấm Kỹ Năng', description: 'Không được dùng kỹ năng chủ động', effect: 'no_skills', difficulty: 'hard' },
  { id: 'cm_one_hit', name: 'Nhất Kích Tất Sát', description: 'Chết trong một đòn', effect: 'one_hit', difficulty: 'hard' },
  { id: 'cm_double_hp', name: 'HP Nhân Đôi', description: 'Kẻ địch có HP gấp đôi', effect: 'double_hp', difficulty: 'medium' },
  { id: 'cm_half_damage', name: 'Nửa Sát Thương', description: 'Gây 50% sát thương', effect: 'half_damage', difficulty: 'medium' },
];

class ChallengeScalingService {
  /**
   * A-08: Get challenge modifiers for a dungeon
   */
  getChallengeModifiers(floor: number): ChallengeModifier[] {
    // Higher floors = more modifiers
    const numModifiers = Math.min(Math.floor(floor / 10) + 1, 3);
    const shuffled = [...CHALLENGE_MODIFIERS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numModifiers);
  }

  /**
   * A-08: Apply challenge modifiers to combat stats
   */
  applyModifiers(playerStats: any, enemyStats: any, modifiers: ChallengeModifier[]): { player: any; enemy: any } {
    let modifiedPlayer = { ...playerStats };
    let modifiedEnemy = { ...enemyStats };

    for (const mod of modifiers) {
      switch (mod.effect) {
        case 'time_limit':
          // Time limit handled separately
          break;
        case 'no_items':
          modifiedPlayer.canUseItems = false;
          break;
        case 'no_skills':
          modifiedPlayer.canUseSkills = false;
          break;
        case 'one_hit':
          modifiedPlayer.hp = 1;
          break;
        case 'double_hp':
          modifiedEnemy.hp *= 2;
          modifiedEnemy.maxHp *= 2;
          break;
        case 'half_damage':
          modifiedPlayer.atk *= 0.5;
          break;
      }
    }

    return { player: modifiedPlayer, enemy: modifiedEnemy };
  }

  /**
   * A-08: Get challenge description for UI
   */
  getChallengeDescription(modifiers: ChallengeModifier[]): string {
    if (modifiers.length === 0) return 'Không có modifier thử thách nào đang hoạt động.';

    let msg = `🎯 **Modifier Thử Thách:**\n`;
    for (const mod of modifiers) {
      const diffEmoji = mod.difficulty === 'hard' ? '🔴' : mod.difficulty === 'medium' ? '🟡' : '🟢';
      msg += `${diffEmoji} **${mod.name}**: ${mod.description}\n`;
    }

    return msg;
  }

  /**
   * A-08: Calculate challenge reward multiplier
   */
  getRewardMultiplier(modifiers: ChallengeModifier[]): number {
    let mult = 1.0;
    for (const mod of modifiers) {
      if (mod.difficulty === 'hard') mult += 0.5;
      else if (mod.difficulty === 'medium') mult += 0.25;
      else mult += 0.1;
    }
    return Math.min(mult, 3.0); // Max 3x reward
  }
}

export const challengeScalingService = new ChallengeScalingService();
