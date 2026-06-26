import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// B-03: Pet Expansion — Mood, Personality, Combo, Collection

type PetPersonality = 'friendly' | 'lazy' | 'aggressive';

const PERSONALITY_BONUSES: Record<PetPersonality, { stat: string; value: number; description: string }> = {
  friendly: { stat: 'exp_bonus', value: 0.05, description: '+5% EXP từ tu luyện' },
  lazy: { stat: 'hp_bonus', value: 0.08, description: '+8% HP' },
  aggressive: { stat: 'atk_bonus', value: 0.06, description: '+6% ATK' },
};

const ELEMENT_COMBO_BONUS = 0.15; // +15% element damage when 2 pets same element

interface PetMoodEffect {
  moodLevel: string;
  range: [number, number];
  effect: string;
  passiveModifier: number;
}

const MOOD_EFFECTS: PetMoodEffect[] = [
  { moodLevel: 'Rất vui', range: [80, 100], effect: '+10% passive effect', passiveModifier: 1.10 },
  { moodLevel: 'Vui vẻ', range: [60, 79], effect: '+5% passive effect', passiveModifier: 1.05 },
  { moodLevel: 'Bình thường', range: [40, 59], effect: 'No bonus', passiveModifier: 1.0 },
  { moodLevel: 'Buồn', range: [20, 39], effect: '-5% passive effect', passiveModifier: 0.95 },
  { moodLevel: 'Rất buồn', range: [0, 19], effect: '-10% passive effect', passiveModifier: 0.90 },
];

class PetExpansionService {
  /**
   * B-03: Initialize pet with random personality and mood
   */
  initPet(petId: number): void {
    const personalities: PetPersonality[] = ['friendly', 'lazy', 'aggressive'];
    const personality = personalities[Math.floor(Math.random() * 3)];
    const mood = 50 + Math.floor(Math.random() * 21); // 50-70 starting mood

    db.prepare('UPDATE pets SET personality = ?, mood = ? WHERE id = ?')
      .run(personality, mood, petId);
  }

  /**
   * B-03: Get pet mood effect
   */
  getMoodEffect(mood: number): PetMoodEffect {
    for (const effect of MOOD_EFFECTS) {
      if (mood >= effect.range[0] && mood <= effect.range[1]) return effect;
    }
    return MOOD_EFFECTS[2]; // Default: bình thường
  }

  /**
   * B-03: Feed pet — increase mood
   */
  feedPet(userId: string, petId: number): { success: boolean; message: string } {
    const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as any;
    if (!pet) return { success: false, message: '❌ Sủng thú không tồn tại!' };

    const newMood = Math.min(100, (pet.mood || 50) + 15);
    db.prepare('UPDATE pets SET mood = ? WHERE id = ?').run(newMood, petId);

    const moodEffect = this.getMoodEffect(newMood);
    return {
      success: true,
      message: `🍖 **${pet.name}** đã được cho ăn! Mood: **${moodEffect.moodLevel}** (${newMood}/100)\n${moodEffect.effect}`
    };
  }

  /**
   * B-03: Play with pet — increase mood more but costs stamina
   */
  playWithPet(userId: string, petId: number): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Chưa tạo nhân vật!' };
    if (user.stamina < 5) return { success: false, message: '❌ Không đủ Thể Lực! (Cần 5)' };

    const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as any;
    if (!pet) return { success: false, message: '❌ Sủng thú không tồn tại!' };

    const newMood = Math.min(100, (pet.mood || 50) + 25);
    userRepository.update(userId, { stamina: user.stamina - 5 });
    db.prepare('UPDATE pets SET mood = ? WHERE id = ?').run(newMood, petId);

    const moodEffect = this.getMoodEffect(newMood);
    return {
      success: true,
      message: `🎾 **${pet.name}** vui chơi cùng đạo hữu! Mood: **${moodEffect.moodLevel}** (${newMood}/100)\n-5 Thể Lực | ${moodEffect.effect}`
    };
  }

  /**
   * B-03: Get pet personality bonus
   */
  getPersonalityBonus(personality: string): { stat: string; value: number; description: string } {
    return PERSONALITY_BONUSES[personality as PetPersonality] || PERSONALITY_BONUSES.friendly;
  }

  /**
   * B-03: Check element combo — 2 deployed pets same element → +15% element damage
   */
  hasElementCombo(userId: string): { active: boolean; element?: string; bonus?: number } {
    const pets = db.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').all(userId) as any[];
    if (pets.length < 2) return { active: false };

    // Check if any 2 deployed pets share element
    for (let i = 0; i < pets.length; i++) {
      for (let j = i + 1; j < pets.length; j++) {
        if (pets[i].element && pets[j].element && pets[i].element === pets[j].element && pets[i].element !== 'none') {
          return { active: true, element: pets[i].element, bonus: ELEMENT_COMBO_BONUS };
        }
      }
    }
    return { active: false };
  }

  /**
   * B-03: Get collection book summary
   */
  getCollectionBook(userId: string): { total: number; collected: number; byRarity: Record<string, number> } {
    const pets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as any[];
    const uniqueTypes = new Set(pets.map(p => p.template_id));
    const byRarity: Record<string, number> = {};

    for (const pet of pets) {
      byRarity[pet.rarity] = (byRarity[pet.rarity] || 0) + 1;
    }

    return {
      total: uniqueTypes.size,
      collected: pets.length,
      byRarity
    };
  }

  /**
   * B-03: Get pet daily quest suggestions
   */
  getDailyPetQuests(userId: string): string[] {
    const pets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as any[];
    const quests: string[] = [];

    if (pets.length > 0) {
      quests.push('🍖 Cho sủng thú ăn (dùng lệnh pet)');
      quests.push('🎾 Chơi với sủng thú (dùng lệnh pet)');
    }
    if (pets.length >= 2) {
      quests.push('⚔️ Deploy 2 sủng thú cùng element để nhận combo bonus');
    }

    return quests;
  }

  /**
   * B-03: Decay mood over time (call periodically)
   */
  decayMood(): void {
    // Decay all pets by 2 mood per hour
    db.prepare('UPDATE pets SET mood = MAX(0, mood - 2) WHERE mood > 0').run();
  }

  // === C-01: Pet World — Training, Collection Book Details ===

  /**
   * C-01: Train pet — costs materials, grants EXP
   */
  trainPet(userId: string, petId: number, materialId: string, amount: number): { success: boolean; message: string } {
    const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as any;
    if (!pet) return { success: false, message: '❌ Sủng thú không tồn tại!' };

    // Check material
    const mat = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, materialId) as any;
    if (!mat || mat.quantity < amount) {
      return { success: false, message: `❌ Không đủ nguyên liệu! (Cần ${amount}, có ${mat?.quantity || 0})` };
    }

    // Grant EXP
    const expGained = amount * 10;
    const newExp = (pet.exp || 0) + expGained;
    const needed = pet.level * 80;

    if (newExp >= needed) {
      const newLevel = pet.level + 1;
      db.prepare('UPDATE pets SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - needed, petId);
      db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?')
        .run(amount, mat.id);

      return {
        success: true,
        message: `🏋️ **${pet.name}** training thành công!\n+${expGained} EXP → Level **${newLevel}**!`
      };
    }

    db.prepare('UPDATE pets SET exp = ? WHERE id = ?').run(newExp, petId);
    db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?')
      .run(amount, mat.id);

    return {
      success: true,
      message: `🏋️ **${pet.name}** training +${expGained} EXP (${newExp}/${needed})`
    };
  }

  /**
   * C-01: Get detailed collection book
   */
  getDetailedCollectionBook(userId: string): {
    totalTypes: number;
    totalPets: number;
    byRarity: Record<string, number>;
    byElement: Record<string, number>;
    highestLevel: number;
    totalStars: number;
  } {
    const pets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as any[];
    const uniqueTypes = new Set(pets.map(p => p.template_id));
    const byRarity: Record<string, number> = {};
    const byElement: Record<string, number> = {};
    let highestLevel = 0;
    let totalStars = 0;

    for (const pet of pets) {
      byRarity[pet.rarity] = (byRarity[pet.rarity] || 0) + 1;
      byElement[pet.element || 'none'] = (byElement[pet.element || 'none'] || 0) + 1;
      highestLevel = Math.max(highestLevel, pet.level || 1);
      totalStars += pet.stars || 1;
    }

    return {
      totalTypes: uniqueTypes.size,
      totalPets: pets.length,
      byRarity,
      byElement,
      highestLevel,
      totalStars
    };
  }

  /**
   * C-01: Get pet combat info
   */
  getPetCombatInfo(userId: string, petId: number): {
    name: string;
    stats: { atk: number; def: number; hp: number };
    passive: string;
    passiveValue: number;
    moodEffect: string;
    personalityBonus: string;
  } | null {
    const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as any;
    if (!pet) return null;

    const def = require('../config/rareBeastConstants').RARE_BEASTS.find((b: any) => b.type === pet.template_id);
    if (!def) return null;

    const starIdx = Math.min((pet.stars || 1) - 1, def.evolveBonus.length - 1);
    const evolveBonus = def.evolveBonus[starIdx] || { atk: 0, def: 0, hp: 0 };
    const levelMult = 1 + (pet.level - 1) * 0.015;
    const moodEffect = this.getMoodEffect(pet.mood || 50);
    const personalityBonus = this.getPersonalityBonus(pet.personality || 'friendly');

    return {
      name: pet.beast_name,
      stats: {
        atk: Math.floor((def.baseAtk + evolveBonus.atk) * levelMult * moodEffect.passiveModifier),
        def: Math.floor((def.baseDef + evolveBonus.def) * levelMult * moodEffect.passiveModifier),
        hp: Math.floor((def.baseHp + evolveBonus.hp) * levelMult * moodEffect.passiveModifier),
      },
      passive: def.passiveSkill,
      passiveValue: Math.floor((pet.stars || 1) * 2 + (pet.level || 1) * 0.5),
      moodEffect: moodEffect.effect,
      personalityBonus: personalityBonus.description,
    };
  }
}

export const petExpansionService = new PetExpansionService();
