// V13 B-01: Thiên Kiếp Vô Cực (Infinite Heavenly Tribulation)
// ponytail: separate service to avoid conflict with existing TribulationService (breakthrough system)
import db from '../database/database';

interface TribulationModifier {
  id: string;
  name: string;
  description: string;
  effect: string;
}

const MODIFIERS: TribulationModifier[] = [
  { id: 'burn', name: 'Thiêu Đốt', description: 'Cả 2 nhận burn mỗi hiệp', effect: 'both_burn' },
  { id: 'no_heal', name: 'Cấm Chữa', description: 'Không thể heal', effect: 'no_heal' },
  { id: 'lightning', name: 'Lôi Phạt', description: 'Mỗi 3 hiệp, lightning damage cho cả 2', effect: 'periodic_lightning' },
  { id: 'damage_down', name: 'Hư Hại', description: 'Equipment stats -20%', effect: 'equip_debuff' },
  { id: 'tanky', name: 'Thổ Nhưỡng', description: 'DEF +50% cho cả 2', effect: 'def_boost' },
  { id: 'no_skill', name: 'Phong Bế', description: 'Không dùng skill, chỉ basic attack', effect: 'no_skill' },
];

const TIERS = [
  { tier: 1, name: 'Luyện Khí', floors: 10, baseHp: 5000, baseAtk: 300, baseDef: 200 },
  { tier: 2, name: 'Trúc Cơ', floors: 10, baseHp: 15000, baseAtk: 800, baseDef: 500 },
  { tier: 3, name: 'Kim Đan', floors: 10, baseHp: 40000, baseAtk: 2000, baseDef: 1200 },
  { tier: 4, name: 'Nguyên Anh', floors: 10, baseHp: 100000, baseAtk: 5000, baseDef: 3000 },
  { tier: 5, name: 'Hóa Thần', floors: 10, baseHp: 250000, baseAtk: 12000, baseDef: 7000 },
  { tier: 6, name: 'Luyện Hư', floors: 10, baseHp: 600000, baseAtk: 30000, baseDef: 18000 },
  { tier: 7, name: 'Hợp Thể', floors: 10, baseHp: 1500000, baseAtk: 70000, baseDef: 42000 },
  { tier: 8, name: 'Đại Thừa', floors: 10, baseHp: 3500000, baseAtk: 160000, baseDef: 96000 },
  { tier: 9, name: 'Đăng Tiên', floors: 10, baseHp: 8000000, baseAtk: 350000, baseDef: 210000 },
];

const DAILY_ATTEMPTS_FREE = 5;

class InfiniteTribulationService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS infinite_tribulation_progress (
        user_id TEXT NOT NULL,
        tier INTEGER DEFAULT 1,
        floor INTEGER DEFAULT 1,
        best_tier INTEGER DEFAULT 0,
        best_floor INTEGER DEFAULT 0,
        attempts_today INTEGER DEFAULT 0,
        attempts_date TEXT,
        PRIMARY KEY (user_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS infinite_tribulation_points (
        user_id TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        PRIMARY KEY (user_id)
      );
    `);
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public getProgress(userId: string): { tier: number; floor: number; bestTier: number; bestFloor: number; attemptsLeft: number } {
    this.initTable();
    const today = this.getToday();
    let row = db.prepare('SELECT * FROM infinite_tribulation_progress WHERE user_id = ?').get(userId) as any;
    if (!row) {
      db.prepare('INSERT INTO infinite_tribulation_progress (user_id, tier, floor, best_tier, best_floor, attempts_today, attempts_date) VALUES (?, 1, 1, 0, 0, 0, ?)')
        .run(userId, today);
      row = db.prepare('SELECT * FROM infinite_tribulation_progress WHERE user_id = ?').get(userId) as any;
    }

    if (row.attempts_date !== today) {
      db.prepare('UPDATE infinite_tribulation_progress SET attempts_today = 0, attempts_date = ? WHERE user_id = ?')
        .run(today, userId);
      row.attempts_today = 0;
    }

    const attemptsLeft = DAILY_ATTEMPTS_FREE - row.attempts_today;
    return { tier: row.tier, floor: row.floor, bestTier: row.best_tier, bestFloor: row.best_floor, attemptsLeft };
  }

  public canEnter(userId: string): { eligible: boolean; reason: string } {
    const prog = this.getProgress(userId);
    if (prog.attemptsLeft <= 0) return { eligible: false, reason: 'Đã hết lượt miễn phí hôm nay.' };
    return { eligible: true, reason: '' };
  }

  public getEnemyForFloor(tier: number, floor: number): { hp: number; atk: number; def: number; modifier: TribulationModifier } {
    const tierDef = TIERS[tier - 1] || TIERS[0];
    const scale = 1 + (floor - 1) * 0.15;
    const isBoss = floor === tierDef.floors;
    const bossMult = isBoss ? 2.0 : 1.0;
    const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

    return {
      hp: Math.floor(tierDef.baseHp * scale * bossMult),
      atk: Math.floor(tierDef.baseAtk * scale * bossMult),
      def: Math.floor(tierDef.baseDef * scale * bossMult),
      modifier,
    };
  }

  public recordFloor(userId: string, tier: number, floor: number, won: boolean): { pointsEarned: number; tierClear: boolean; nextFloor: number; nextTier: number } {
    this.initTable();
    const tierDef = TIERS[tier - 1] || TIERS[0];

    if (!won) {
      db.prepare('UPDATE infinite_tribulation_progress SET attempts_today = attempts_today + 1 WHERE user_id = ?').run(userId);
      return { pointsEarned: 0, tierClear: false, nextFloor: floor, nextTier: tier };
    }

    let nextFloor = floor + 1;
    let nextTier = tier;
    let tierClear = false;

    if (nextFloor > tierDef.floors) {
      tierClear = true;
      nextTier = Math.min(tier + 1, 9);
      nextFloor = 1;
    }

    db.prepare(`
      UPDATE infinite_tribulation_progress
      SET tier = ?, floor = ?, best_tier = MAX(best_tier, ?), best_floor = CASE WHEN ? > best_tier THEN ? WHEN ? = best_tier THEN MAX(best_floor, ?) ELSE best_floor END, attempts_today = attempts_today + 1
      WHERE user_id = ?
    `).run(nextTier, nextFloor, tier, tier, floor, tier, floor, userId);

    const points = floor * tier * 10;
    db.prepare(`
      INSERT INTO infinite_tribulation_points (user_id, points) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET points = points + excluded.points
    `).run(userId, points);

    return { pointsEarned: points, tierClear, nextFloor, nextTier };
  }

  public getPoints(userId: string): number {
    this.initTable();
    const row = db.prepare('SELECT points FROM infinite_tribulation_points WHERE user_id = ?').get(userId) as { points: number } | undefined;
    return row?.points ?? 0;
  }

  public getDescription(userId: string): string {
    const prog = this.getProgress(userId);
    const points = this.getPoints(userId);
    const tierDef = TIERS[prog.tier - 1];

    let msg = `⚡ **Thiên Kiếp Vô Cực** — Tier **${prog.tier}** (${tierDef?.name || '?'}) | Floor **${prog.floor}**\n`;
    msg += `🏆 Best: Tier ${prog.bestTier} / Floor ${prog.bestFloor}\n`;
    msg += `🎫 Lượt còn lại: **${prog.attemptsLeft}**/${DAILY_ATTEMPTS_FREE}\n`;
    msg += `💎 Điểm: **${points}**\n`;

    if (prog.tier <= 9) {
      const enemy = this.getEnemyForFloor(prog.tier, prog.floor);
      msg += `\n**Floor ${prog.floor}** — ${enemy.modifier.name}: ${enemy.modifier.description}\n`;
      msg += `Enemy: HP ${enemy.hp.toLocaleString()} | ATK ${enemy.atk.toLocaleString()} | DEF ${enemy.def.toLocaleString()}\n`;
    }

    return msg;
  }
}

export const infiniteTribulationService = new InfiniteTribulationService();
