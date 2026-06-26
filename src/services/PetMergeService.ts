import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { prestigeService } from './PrestigeService';

// B2: Pet Merge System (Prestige 3+ unlock)

const MERGE_COST = 5000; // Linh Thạch
const MIN_PET_LEVEL = 5;
const MERGE_STAT_MULT = 1.1; // 10% bonus on combined stats

interface PetMergeResult {
  success: boolean;
  message: string;
  mergedPet?: { name: string; element: string; atk: number; def: number; hp: number };
}

class PetMergeService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_pet_merges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        pet1_id INTEGER NOT NULL,
        pet2_id INTEGER NOT NULL,
        result_name TEXT,
        result_element TEXT,
        result_atk INTEGER,
        result_def INTEGER,
        result_hp INTEGER,
        merged_at INTEGER DEFAULT 0
      );
    `);
  }

  mergePets(userId: string, pet1Id: number, pet2Id: number): PetMergeResult {
    this.initTable();

    // Check prestige unlock
    if (!prestigeService.hasPrestigeUnlock(userId, 'pet_merge_slot')) {
      return { success: false, message: '❌ Cần đạt Luân Hồi 3 để mở tính năng Dung Hợp Linh Thú!' };
    }

    if (pet1Id === pet2Id) {
      return { success: false, message: '❌ Không thể dung hợp 2 linh thú giống nhau!' };
    }

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Chưa tạo nhân vật!' };

    if (user.coin_ha_pham < MERGE_COST) {
      return { success: false, message: `❌ Không đủ Linh Thạch! Cần ${MERGE_COST.toLocaleString()} (hiện có ${user.coin_ha_pham.toLocaleString()})` };
    }

    // Get both pets
    const pet1 = db.prepare('SELECT * FROM mounts WHERE id = ? AND user_id = ?').get(pet1Id, userId) as any;
    const pet2 = db.prepare('SELECT * FROM mounts WHERE id = ? AND user_id = ?').get(pet2Id, userId) as any;

    if (!pet1 || !pet2) {
      return { success: false, message: '❌ Một hoặc cả hai linh thú không tồn tại!' };
    }

    if (!pet1.is_tamed || !pet2.is_tamed) {
      return { success: false, message: '❌ Cả hai linh thú phải được thuần hóa!' };
    }

    if (pet1.level < MIN_PET_LEVEL || pet2.level < MIN_PET_LEVEL) {
      return { success: false, message: `❌ Cả hai linh thú phải đạt cấp ${MIN_PET_LEVEL} trở lên!` };
    }

    // Calculate merged stats
    const baseSpeedByRarity: Record<string, number> = { common: 0.02, uncommon: 0.04, rare: 0.07, epic: 0.10, legendary: 0.15 };
    const baseAtkByRarity: Record<string, number> = { common: 20, uncommon: 30, rare: 40, epic: 55, legendary: 70 };
    const baseDefByRarity: Record<string, number> = { common: 15, uncommon: 25, rare: 35, epic: 45, legendary: 60 };
    const baseHpByRarity: Record<string, number> = { common: 150, uncommon: 200, rare: 250, epic: 300, legendary: 400 };

    const getRarityIndex = (r: string) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(r);
    const higherRarityPet = getRarityIndex(pet1.rarity) >= getRarityIndex(pet2.rarity) ? pet1 : pet2;
    const mergedElement = higherRarityPet.template_id; // Use the higher rarity pet's template as base

    const avgLevel = (pet1.level + pet2.level) / 2;
    const rarityKey = higherRarityPet.rarity;

    const mergedAtk = Math.round((baseAtkByRarity[rarityKey] || 30) * avgLevel * MERGE_STAT_MULT);
    const mergedDef = Math.round((baseDefByRarity[rarityKey] || 25) * avgLevel * MERGE_STAT_MULT);
    const mergedHp = Math.round((baseHpByRarity[rarityKey] || 200) * avgLevel * MERGE_STAT_MULT);

    const mergedName = `${pet1.name} + ${pet2.name}`;

    // Deduct cost, delete both pets, create merged pet
    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - MERGE_COST });

      db.prepare('DELETE FROM mounts WHERE id = ? AND user_id = ?').run(pet1Id, userId);
      db.prepare('DELETE FROM mounts WHERE id = ? AND user_id = ?').run(pet2Id, userId);

      db.prepare(`
        INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, is_tamed, skills, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, 0, 1, '[]', ?)
      `).run(userId, mergedName, higherRarityPet.template_id, higherRarityPet.rarity,
        Math.round(avgLevel), Math.round(baseSpeedByRarity[rarityKey] * avgLevel * MERGE_STAT_MULT * 100) / 100,
        Math.floor(Date.now() / 1000));

      db.prepare(`
        INSERT INTO user_pet_merges (user_id, pet1_id, pet2_id, result_name, result_element, result_atk, result_def, result_hp, merged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, pet1Id, pet2Id, mergedName, mergedElement, mergedAtk, mergedDef, mergedHp, Math.floor(Date.now() / 1000));
    })();

    return {
      success: true,
      message: `🎉 **DUNG HỢP THÀNH CÔNG!**\n` +
        `🔗 ${pet1.name} (Lv.${pet1.level}) + ${pet2.name} (Lv.${pet2.level})\n` +
        `🌟 Kết quả: **${mergedName}** [${higherRarityPet.rarity}]\n` +
        `⚔️ ATK: ${mergedAtk} | 🛡️ DEF: ${mergedDef} | ❤️ HP: ${mergedHp}\n` +
        `🪙 -${MERGE_COST.toLocaleString()} Linh Thạch`,
      mergedPet: { name: mergedName, element: mergedElement, atk: mergedAtk, def: mergedDef, hp: mergedHp }
    };
  }

  getMergeHistory(userId: string): { pet1: string; pet2: string; result: string; at: number }[] {
    this.initTable();
    const rows = db.prepare('SELECT * FROM user_pet_merges WHERE user_id = ? ORDER BY merged_at DESC LIMIT 10')
      .all(userId) as any[];
    return rows.map(r => ({
      pet1: `Pet #${r.pet1_id}`,
      pet2: `Pet #${r.pet2_id}`,
      result: r.result_name,
      at: r.merged_at
    }));
  }
}

export const petMergeService = new PetMergeService();
