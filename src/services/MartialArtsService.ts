import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { MARTIAL_ARTS, MARTIAL_ART_FUSIONS, MASTERY_LEVELS, ELEMENT_COUNTERS, ELEMENT_ADVANTAGE_BONUS, ELEMENT_DISADVANTAGE_PENALTY, type MartialArtDef, type MartialArtElement } from '../config/martialArtsConstants';

// E-01: Martial Arts System

interface UserMartialArt {
  userId: string;
  artId: string;
  level: number;
  mastery: number;
  masteryExp: number;
}

class MartialArtsService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_martial_arts (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        art_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        mastery INTEGER DEFAULT 1,
        mastery_exp INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, art_id)
      );
    `);
  }

  /**
   * E-01: Learn a martial art
   */
  learnArt(userId: string, artId: string): { success: boolean; message: string } {
    this.initTable();
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Không tìm thấy người dùng!' };

    const art = MARTIAL_ARTS.find(a => a.id === artId);
    if (!art) return { success: false, message: 'Võ công không tồn tại!' };

    if (user.level < art.unlockLevel) {
      return { success: false, message: `Cần cấp ${art.unlockLevel} (hiện tại: ${user.level})` };
    }

    const existing = db.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?')
      .get(userId, artId);
    if (existing) return { success: false, message: 'Đã học võ công này rồi!' };

    db.prepare('INSERT INTO user_martial_arts (user_id, art_id, level, mastery, mastery_exp) VALUES (?, ?, 1, 1, 0)')
      .run(userId, artId);

    return { success: true, message: `Đã học **${art.name}**!` };
  }

  /**
   * E-01: Get user's martial arts
   */
  getUserArts(userId: string): (UserMartialArt & { def: MartialArtDef })[] {
    this.initTable();
    const rows = db.prepare('SELECT * FROM user_martial_arts WHERE user_id = ?')
      .all(userId) as UserMartialArt[];

    return rows.map(r => {
      const def = MARTIAL_ARTS.find(a => a.id === r.artId)!;
      return { ...r, def };
    }).filter(r => r.def);
  }

  /**
   * E-01: Get martial art bonuses for combat
   */
  getArtBonuses(userId: string): { statBonuses: Record<string, number>; effects: { type: string; value: number; duration: number }[] } {
    const arts = this.getUserArts(userId);
    const statBonuses: Record<string, number> = {};
    const effects: { type: string; value: number; duration: number }[] = [];

    for (const art of arts) {
      const masteryBonus = MASTERY_LEVELS[art.mastery - 1]?.bonus || 0;
      const totalBonus = art.def.statBonus.value * (1 + masteryBonus);

      statBonuses[art.def.statBonus.stat] = (statBonuses[art.def.statBonus.stat] || 0) + totalBonus;
      effects.push({
        type: art.def.effect.type,
        value: art.def.effect.value * (1 + masteryBonus),
        duration: art.def.effect.duration
      });
    }

    return { statBonuses, effects };
  }

  /**
   * E-01: Get element advantage
   */
  getElementAdvantage(attackerElement: MartialArtElement, defenderElement: MartialArtElement): number {
    const counter = ELEMENT_COUNTERS[attackerElement];
    if (counter === defenderElement) return ELEMENT_ADVANTAGE_BONUS;
    if (ELEMENT_COUNTERS[defenderElement] === attackerElement) return -ELEMENT_DISADVANTAGE_PENALTY;
    return 0;
  }

  /**
   * E-01: Fusion two martial arts
   */
  fuseArts(userId: string, art1Id: string, art2Id: string): { success: boolean; message: string; newArt?: MartialArtDef } {
    this.initTable();

    const fusion = MARTIAL_ART_FUSIONS.find(f =>
      (f.ingredient1 === art1Id && f.ingredient2 === art2Id) ||
      (f.ingredient1 === art2Id && f.ingredient2 === art1Id)
    );

    if (!fusion) return { success: false, message: 'Các võ công này không thể dung hợp!' };

    // Check if user has both arts
    const art1 = db.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?').get(userId, art1Id);
    const art2 = db.prepare('SELECT * FROM user_martial_arts WHERE user_id = ? AND art_id = ?').get(userId, art2Id);

    if (!art1 || !art2) return { success: false, message: 'Cần cả hai võ công để dung hợp!' };

    // Check success rate
    if (Math.random() > fusion.successRate) {
      return { success: false, message: `Dung hợp thất bại! Công pháp vẫn còn giữ nguyên.` };
    }

    // Success: remove both, add result
    db.prepare('DELETE FROM user_martial_arts WHERE user_id = ? AND art_id = ?').run(userId, art1Id);
    db.prepare('DELETE FROM user_martial_arts WHERE user_id = ? AND art_id = ?').run(userId, art2Id);
    db.prepare('INSERT INTO user_martial_arts (user_id, art_id, level, mastery, mastery_exp) VALUES (?, ?, 1, 1, 0)')
      .run(userId, fusion.result);

    const newArt = MARTIAL_ARTS.find(a => a.id === fusion.result);
    return { success: true, message: `Dung hợp thành công! Đã học **${newArt?.name || fusion.result}**!`, newArt: newArt || undefined };
  }

  /**
   * E-01: Get martial arts description for UI
   */
  getMartialArtsDescription(userId: string): string {
    const arts = this.getUserArts(userId);

    let msg = `🧘 **Công Pháp**\n`;
    msg += `📊 Đã học: **${arts.length}**/${MARTIAL_ARTS.length}\n\n`;

    if (arts.length > 0) {
      msg += `**Võ Công của bạn:**\n`;
      for (const art of arts) {
        const elementEmoji: Record<string, string> = { 'Hoa': '🔥', 'Thuy': '💧', 'Moc': '🌿', 'Kim': '⚔️', 'Tho': '🪨', 'Loi': '⚡', 'Phong': '🌀' };
        msg += `${elementEmoji[art.def.element] || '❓'} **${art.def.name}** (Tier ${art.def.tier}) — Tinh Thông ${art.mastery}/10\n`;
        msg += `   ${art.def.description}\n`;
        msg += `   Bonus: +${Math.round(art.def.statBonus.value * 100)}% ${art.def.statBonus.stat}\n`;
        msg += `   Effect: ${art.def.effect.type} (+${Math.round(art.def.effect.value * 100)}%, ${art.def.effect.duration} lượt)\n\n`;
      }
    }

    return msg;
  }
}

export const martialArtsService = new MartialArtsService();
