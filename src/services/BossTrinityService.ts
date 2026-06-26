// V13 B-03: Tam Tinh Liên Đài (Boss Trinity)
import db from '../database/database';

interface TrinityBoss {
  id: number;
  name: string;
  element: string;
  immuneElements: string[];
  weakElements: string[];
  baseHp: number;
  baseAtk: number;
  baseDef: number;
}

const TRINITY_BOSSES: TrinityBoss[] = [
  { id: 1, name: 'Hỏa Ma Vương', element: 'Hỏa', immuneElements: ['Hỏa'], weakElements: ['Thủy'], baseHp: 50000, baseAtk: 3000, baseDef: 2000 },
  { id: 2, name: 'Thủy Tinh Nữ', element: 'Thủy', immuneElements: ['Thủy'], weakElements: ['Lôi'], baseHp: 60000, baseAtk: 3500, baseDef: 2500 },
  { id: 3, name: 'Hỏa Thủy Song Đế', element: 'Hỏa', immuneElements: ['Hỏa', 'Thủy'], weakElements: ['Mộc', 'Kim'], baseHp: 80000, baseAtk: 4000, baseDef: 3000 },
];

interface TrinityRun {
  user_id: string;
  date: string;
  boss_index: number;
  enrages: number;
  completed: boolean;
}

class BossTrinityService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS boss_trinity_runs (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        boss_index INTEGER DEFAULT 0,
        enrages INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, date)
      );
    `);
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public canEnter(userId: string, userLevel: number): { eligible: boolean; reason: string } {
    this.initTable();
    if (userLevel < 100) return { eligible: false, reason: 'Cần level 100+' };
    const today = this.getToday();
    const run = db.prepare('SELECT completed FROM boss_trinity_runs WHERE user_id = ? AND date = ?')
      .get(userId, today) as { completed: number } | undefined;
    if (run?.completed) return { eligible: false, reason: 'Đã hoàn thành Tam Tinh Liên Đài hôm nay.' };
    return { eligible: true, reason: '' };
  }

  public getBoss(bossIndex: number): TrinityBoss | null {
    return TRINITY_BOSSES[bossIndex] || null;
  }

  public getProgress(userId: string): TrinityRun | null {
    this.initTable();
    const today = this.getToday();
    return db.prepare('SELECT * FROM boss_trinity_runs WHERE user_id = ? AND date = ?')
      .get(userId, today) as TrinityRun | null;
  }

  /**
   * Called after combat with a trinity boss.
   * Determines if boss was enraged and updates progress.
   */
  public recordCombatResult(userId: string, bossIndex: number, usedImmuneElement: boolean): { nextBoss: number | null; enrageTriggered: boolean; allCleared: boolean } {
    this.initTable();
    const today = this.getToday();
    let run = this.getProgress(userId);
    if (!run) {
      db.prepare('INSERT INTO boss_trinity_runs (user_id, date, boss_index, enrages, completed) VALUES (?, ?, 0, 0, 0)')
        .run(userId, today);
      run = this.getProgress(userId)!;
    }

    let enrages = run.enrages;
    let enrageTriggered = false;

    if (usedImmuneElement) {
      enrages++;
      enrageTriggered = true;
    }

    const nextBoss = bossIndex + 1;
    const allCleared = bossIndex >= 2; // 0-indexed, 3 bosses

    if (allCleared) {
      db.prepare('UPDATE boss_trinity_runs SET enrages = ?, completed = 1, boss_index = 3 WHERE user_id = ? AND date = ?')
        .run(enrages, userId, today);
    } else {
      db.prepare('UPDATE boss_trinity_runs SET enrages = ?, boss_index = ? WHERE user_id = ? AND date = ?')
        .run(enrages, nextBoss, userId, today);
    }

    return { nextBoss: allCleared ? null : nextBoss, enrageTriggered, allCleared };
  }

  public getEfficiency(userId: string): 'perfect' | 'good' | 'normal' {
    const run = this.getProgress(userId);
    if (!run || !run.completed) return 'normal';
    if (run.enrages === 0) return 'perfect';
    if (run.enrages === 1) return 'good';
    return 'normal';
  }

  public getRewardsMultiplier(userId: string): number {
    const eff = this.getEfficiency(userId);
    if (eff === 'perfect') return 3.0;
    if (eff === 'good') return 2.0;
    return 1.0;
  }

  public getDescription(userId: string): string {
    const run = this.getProgress(userId);
    let msg = '**Tam Tinh Liên Đài** — 3 Boss tuần tự\n';
    msg += 'Mỗi boss immune 1 element, yếu element khác.\n';
    msg += 'Dùng element immune → boss enraged (+50% ATK, +30% DEF)\n\n';

    for (let i = 0; i < 3; i++) {
      const boss = TRINITY_BOSSES[i];
      const cleared = run && ((run.completed && i <= run.boss_index) || i < run!.boss_index);
      const status = cleared ? '✅' : run?.boss_index === i ? '⚔️' : '🔒';
      msg += `${status} **${boss.name}** — Immune: ${boss.immuneElements.join(', ')} | Yếu: ${boss.weakElements.join(', ')}\n`;
    }

    if (run?.completed) {
      const eff = this.getEfficiency(userId);
      const mult = this.getRewardsMultiplier(userId);
      msg += `\nKết quả: **${eff.toUpperCase()}** (${run.enrages} enrages) → x${mult} rewards`;
    }

    return msg;
  }
}

export const bossTrinityService = new BossTrinityService();
