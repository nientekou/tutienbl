import db from '../database';

export interface SoulWeapon {
  id: number;
  user_id: string;
  name: string;
  type: 'kiem' | 'dinh' | 'an';
  level: number;
  exp: number;
  created_at: number;
  // P1-05: New fields
  element: string;
  evolution_stage: number;
  skills_json: string;
  awakening_level: number;
  skin_id: string | null;
  // V13 A-06: Awakened form
  awakened_form: string | null;
}

class SoulWeaponRepository {
  public getByUserId(userId: string): SoulWeapon | undefined {
    return db.prepare('SELECT * FROM soul_weapons WHERE user_id = ?').get(userId) as SoulWeapon | undefined;
  }

  public create(userId: string, name: string, type: 'kiem' | 'dinh' | 'an'): number {
    const now = Math.floor(Date.now() / 1000);
    // P1-05: Random element on creation
    const elements = ['Hỏa', 'Thủy', 'Mộc', 'Kim', 'Thổ', 'Lôi', 'Phong', 'Vo'];
    const element = elements[Math.floor(Math.random() * elements.length)];
    const result = db.prepare(`
      INSERT INTO soul_weapons (user_id, name, type, level, exp, element, evolution_stage, skills_json, awakening_level, created_at)
      VALUES (?, ?, ?, 1, 0, ?, 1, '[]', 0, ?)
    `).run(userId, name, type, element, now);
    return result.lastInsertRowid as number;
  }

  public updateLevelExp(id: number, level: number, exp: number): void {
    db.prepare('UPDATE soul_weapons SET level = ?, exp = ? WHERE id = ?').run(level, exp, id);
  }

  // P1-05: Update evolution stage
  public updateEvolution(id: number, stage: number): void {
    db.prepare('UPDATE soul_weapons SET evolution_stage = ? WHERE id = ?').run(stage, id);
  }

  // P1-05: Update awakening level
  public updateAwakening(id: number, level: number): void {
    db.prepare('UPDATE soul_weapons SET awakening_level = ?, level = 1, evolution_stage = 1 WHERE id = ?').run(level, id);
  }

  // P1-05: Update skills
  public updateSkills(id: number, skillsJson: string): void {
    db.prepare('UPDATE soul_weapons SET skills_json = ? WHERE id = ?').run(skillsJson, id);
  }
}

export const soulWeaponRepository = new SoulWeaponRepository();
