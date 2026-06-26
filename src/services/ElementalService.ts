import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// E-03: Elemental System

type Element = 'Hoa' | 'Thuy' | 'Moc' | 'Kim' | 'Tho' | 'Loi' | 'Phong';

interface ElementalMastery {
  userId: string;
  element: Element;
  level: number;
  exp: number;
}

// Element counter relationships (circular)
const COUNTER_MAP: Record<Element, Element> = {
  'Hoa': 'Kim', 'Kim': 'Moc', 'Moc': 'Tho', 'Tho': 'Thuy', 'Thuy': 'Hoa',
  'Loi': 'Thuy', 'Phong': 'Loi',
};

const ELEMENT_NAMES: Record<Element, string> = {
  'Hoa': 'Hoa', 'Thuy': 'Thuy', 'Moc': 'Moc', 'Kim': 'Kim',
  'Tho': 'Tho', 'Loi': 'Loi', 'Phong': 'Phong'
};

const ELEMENT_EMOJI: Record<Element, string> = {
  'Hoa': '🔥', 'Thuy': '💧', 'Moc': '🌿', 'Kim': '⚔️',
  'Tho': '🪨', 'Loi': '⚡', 'Phong': '🌀'
};

class ElementalService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS elemental_mastery (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        element TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, element)
      );
    `);
  }

  /**
   * E-03: Get element advantage
   */
  getAdvantage(attacker: Element, defender: Element): { damage: number; description: string } {
    const counter = COUNTER_MAP[attacker];
    if (counter === defender) {
      return { damage: 0.25, description: `${ELEMENT_EMOJI[attacker]} > ${ELEMENT_EMOJI[defender]}: +25% damage` };
    }
    if (COUNTER_MAP[defender] === attacker) {
      return { damage: -0.25, description: `${ELEMENT_EMOJI[attacker]} < ${ELEMENT_EMOJI[defender]}: -25% damage` };
    }
    return { damage: 0, description: 'Không có ưu thế nguyên tố' };
  }

  /**
   * E-03: Get elemental mastery
   */
  getMastery(userId: string, element: Element): ElementalMastery {
    this.initTable();
    let row = db.prepare('SELECT * FROM elemental_mastery WHERE user_id = ? AND element = ?')
      .get(userId, element) as ElementalMastery | undefined;

    if (!row) {
      db.prepare('INSERT INTO elemental_mastery (user_id, element, level, exp) VALUES (?, ?, 1, 0)')
        .run(userId, element);
      row = db.prepare('SELECT * FROM elemental_mastery WHERE user_id = ? AND element = ?')
        .get(userId, element) as ElementalMastery;
    }

    return row!;
  }

  /**
   * E-03: Add elemental mastery EXP
   */
  addMasteryExp(userId: string, element: Element, exp: number): { levelUp: boolean; newLevel: number } {
    this.initTable();
    const mastery = this.getMastery(userId, element);

    const newExp = mastery.exp + exp;
    const needed = mastery.level * 100;

    if (newExp >= needed && mastery.level < 10) {
      const newLevel = mastery.level + 1;
      db.prepare('UPDATE elemental_mastery SET level = ?, exp = ? WHERE user_id = ? AND element = ?')
        .run(newLevel, newExp - needed, userId, element);
      return { levelUp: true, newLevel };
    }

    db.prepare('UPDATE elemental_mastery SET exp = ? WHERE user_id = ? AND element = ?')
      .run(Math.min(newExp, needed), userId, element);
    return { levelUp: false, newLevel: mastery.level };
  }

  /**
   * E-03: Get mastery bonus
   */
  getMasteryBonus(userId: string, element: Element): number {
    const mastery = this.getMastery(userId, element);
    return mastery.level * 0.02; // +2% per level
  }

  /**
   * E-03: Get all elemental masteries
   */
  getAllMasteries(userId: string): { element: Element; level: number; exp: number; bonus: number }[] {
    const elements: Element[] = ['Hoa', 'Thuy', 'Moc', 'Kim', 'Tho', 'Loi', 'Phong'];
    return elements.map(el => {
      const mastery = this.getMastery(userId, el);
      return { element: el, level: mastery.level, exp: mastery.exp, bonus: this.getMasteryBonus(userId, el) };
    });
  }

  /**
   * E-03: Get elemental description for UI
   */
  getElementalDescription(userId: string): string {
    const masteries = this.getAllMasteries(userId);

    let msg = `🌀 **Elemental Mastery**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const m of masteries) {
      const emoji = ELEMENT_EMOJI[m.element as Element];
      const bonus = Math.round(m.bonus * 100);
      msg += `${emoji} **${m.element}**: Level ${m.level}/10 (+${bonus}% damage)\n`;
    }

    msg += `\n**Element Counters:**\n`;
    msg += `🔥 > ⚔️ > 🌿 > 🪨 > 💧 > 🔥\n`;
    msg += `⚡ > 💧, 🌀 > ⚡\n`;

    return msg;
  }
}

export const elementalService = new ElementalService();
