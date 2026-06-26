import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

// A-01: Pet Battle System

type PetElement = 'fire' | 'water' | 'earth' | 'wind' | 'lightning' | 'wood' | 'metal';

interface PetBattlePet {
  id: number;
  name: string;
  element: PetElement;
  level: number;
  atk: number;
  def: number;
  hp: number;
  skills: string[];
}

const PET_ELEMENT_COUNTERS: Record<PetElement, PetElement> = {
  'fire': 'metal', 'metal': 'wood', 'wood': 'earth', 'earth': 'water', 'water': 'fire',
  'lightning': 'water', 'wind': 'lightning',
};

const PET_SKILLS: Record<string, { name: string; element: string; damage: number; effect: string }> = {
  fire_bite: { name: 'Hoa Can', element: 'fire', damage: 1.2, effect: 'burn' },
  water_splash: { name: 'Thuy Tuyet', element: 'water', damage: 1.0, effect: 'heal' },
  earth_shield: { name: 'Tho Giap', element: 'earth', damage: 0.8, effect: 'shield' },
  wind_gust: { name: 'Phong Gio', element: 'wind', damage: 1.1, effect: 'speed' },
  lightning_bolt: { name: 'Loi Dan', element: 'lightning', damage: 1.3, effect: 'stun' },
  wood_vine: { name: 'Moc Thang', element: 'wood', damage: 0.9, effect: 'root' },
  metal_claw: { name: 'Kim Vuot', element: 'metal', damage: 1.4, effect: 'crit' },
};

class PetBattleService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pet_battle_scores (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        last_battle_at INTEGER DEFAULT 0
      );
    `);
  }

  /**
   * A-01: Get player's battle pets
   */
  getBattlePets(userId: string): PetBattlePet[] {
    const pets = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? ORDER BY level DESC LIMIT 3').all(userId) as any[];

    return pets.map(p => ({
      id: p.id,
      name: p.beast_name,
      element: (p.element || 'fire') as PetElement,
      level: p.level || 1,
      atk: Math.round((p.base_atk || 50) * (1 + (p.level - 1) * 0.015)),
      def: Math.round((p.base_def || 30) * (1 + (p.level - 1) * 0.015)),
      hp: Math.round((p.base_hp || 200) * (1 + (p.level - 1) * 0.015)),
      skills: this.getPetSkills(p.element || 'fire')
    }));
  }

  /**
   * A-01: Get pet skills by element
   */
  private getPetSkills(element: string): string[] {
    return Object.keys(PET_SKILLS).filter(k => PET_SKILLS[k].element === element);
  }

  /**
   * A-01: Battle two pets
   */
  battlePet(userId: string, opponentId: string): { success: boolean; message: string; won?: boolean } {
    this.initTable();

    const myPets = this.getBattlePets(userId);
    const oppPets = this.getBattlePets(opponentId);

    if (myPets.length === 0) return { success: false, message: 'No pets to battle!' };
    if (oppPets.length === 0) return { success: false, message: 'Opponent has no pets!' };

    // Simple battle: compare total power with element bonuses
    let myPower = myPets.reduce((sum, p) => sum + p.atk + p.def + p.hp, 0);
    let oppPower = oppPets.reduce((sum, p) => sum + p.atk + p.def + p.hp, 0);

    // Element advantage
    for (const myPet of myPets) {
      for (const oppPet of oppPets) {
        if (PET_ELEMENT_COUNTERS[myPet.element] === oppPet.element) {
          myPower = Math.round(myPower * 1.10); // +10% for advantage
        }
      }
    }

    // Add randomness (±20%)
    myPower = Math.round(myPower * (0.8 + Math.random() * 0.4));
    oppPower = Math.round(oppPower * (0.8 + Math.random() * 0.4));

    const won = myPower > oppPower;
    const now = Math.floor(Date.now() / 1000);

    // Update scores
    this.initTable();
    db.prepare(`
      INSERT INTO pet_battle_scores (user_id, wins, losses, score, last_battle_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        wins = wins + ?, losses = losses + ?,
        score = score + ?, last_battle_at = ?
    `).run(userId, won ? 1 : 0, won ? 0 : 1, won ? 10 : 2, now,
      won ? 1 : 0, won ? 0 : 1, won ? 10 : 2, now);

    const myNames = myPets.map(p => p.name).join(', ');
    const oppNames = oppPets.map(p => p.name).join(', ');

    const msg = `⚔️ **Pet Battle**\n` +
      `🧑 ${myNames} (Power: ${Math.round(myPower)})\n` +
      `🤖 ${oppNames} (Power: ${Math.round(oppPower)})\n\n` +
      (won ? `🎉 **THẮNG!** +10 điểm Arena` : `💀 **THUA!** +2 điểm Arena`);

    return { success: true, message: msg, won };
  }

  /**
   * A-01: Get pet battle leaderboard
   */
  getLeaderboard(limit: number = 10): { userId: string; name: string; wins: number; losses: number; score: number }[] {
    this.initTable();
    const rows = db.prepare(`
      SELECT pbs.*, u.name FROM pet_battle_scores pbs
      JOIN users u ON pbs.user_id = u.discord_id
      ORDER BY pbs.score DESC, pbs.wins DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      wins: r.wins,
      losses: r.losses,
      score: r.score
    }));
  }

  /**
   * A-01: Get pet battle description
   */
  getPetBattleDescription(userId: string): string {
    const pets = this.getBattlePets(userId);

    let msg = `⚔️ **Pet Battle**\n`;
    msg += `📊 Active Pets: **${pets.length}**/3\n\n`;

    if (pets.length > 0) {
      msg += `**Sủng thú của bạn:**\n`;
      for (const p of pets) {
        const elementEmoji: Record<string, string> = { 'fire': '🔥', 'water': '💧', 'earth': '🪨', 'wind': '🌀', 'lightning': '⚡', 'wood': '🌿', 'metal': '⚔️' };
        msg += `${elementEmoji[p.element] || '❓'} **${p.name}** (Lv.${p.level}) ATK:${p.atk} DEF:${p.def} HP:${p.hp}\n`;
      }
    }

    msg += `\n**Element Counters:**\n`;
    msg += `🔥 > ⚔️ > 🌿 > 🪨 > 💧 > 🔥\n`;
    msg += `⚡ > 💧, 🌀 > ⚡\n`;

    return msg;
  }
}

export const petBattleService = new PetBattleService();
