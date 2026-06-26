// V13 D-02: Thiên Kho Bảo Vật (Heavenly Treasure Vault)
import db from '../database/database';

interface VaultBuff {
  id: string;
  name: string;
  description: string;
  stat: string;
  value: number;
}

const VAULT_BUFFS: VaultBuff[] = [
  { id: 'atk', name: 'Hỏa Chi Lực', description: '+15% ATK', stat: 'atk_percent', value: 0.15 },
  { id: 'hp', name: 'Thủy Chi Ward', description: '+10% max HP', stat: 'hp_percent', value: 0.10 },
  { id: 'heal', name: 'Thuốc Hồi Phục', description: 'Heal 50% HP', stat: 'heal', value: 0.50 },
  { id: 'element', name: 'Nguyên Tố Gia Tốc', description: '+20% element damage', stat: 'element_damage', value: 0.20 },
  { id: 'reflect', name: 'Phản Chí', description: '+10% reflect', stat: 'reflect', value: 0.10 },
  { id: 'def', name: 'Thổ Chi Giáp', description: '+15% DEF', stat: 'def_percent', value: 0.15 },
];

class TreasureVaultService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS treasure_vault (
        user_id TEXT NOT NULL,
        best_floor INTEGER DEFAULT 0,
        current_floor INTEGER DEFAULT 0,
        active_buffs TEXT DEFAULT '[]',
        active INTEGER DEFAULT 0,
        last_run_date TEXT,
        PRIMARY KEY (user_id)
      );
    `);
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public canEnter(userId: string): { eligible: boolean; reason: string } {
    this.initTable();
    const row = db.prepare('SELECT active, last_run_date FROM treasure_vault WHERE user_id = ?')
      .get(userId) as { active: number; last_run_date: string } | undefined;
    if (row?.active) return { eligible: false, reason: 'Đang trong Thiên Kho.' };
    if (row?.last_run_date === this.getToday()) return { eligible: false, reason: 'Đã dùng lượt hôm nay.' };
    return { eligible: true, reason: '' };
  }

  public start(userId: string): { floor: number; buffs: VaultBuff[] } {
    this.initTable();
    db.prepare(`
      INSERT INTO treasure_vault (user_id, best_floor, current_floor, active_buffs, active, last_run_date)
      VALUES (?, 0, 1, '[]', 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET current_floor = 1, active_buffs = '[]', active = 1, last_run_date = excluded.last_run_date
    `).run(userId, this.getToday());
    return { floor: 1, buffs: [] };
  }

  public getRandomBuffs(count: number = 3): VaultBuff[] {
    const shuffled = [...VAULT_BUFFS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  public chooseBuff(userId: string, buffId: string): void {
    this.initTable();
    const row = db.prepare('SELECT active_buffs FROM treasure_vault WHERE user_id = ? AND active = 1')
      .get(userId) as { active_buffs: string } | undefined;
    if (!row) return;
    const buffs = JSON.parse(row.active_buffs);
    buffs.push(buffId);
    db.prepare('UPDATE treasure_vault SET active_buffs = ? WHERE user_id = ? AND active = 1')
      .run(JSON.stringify(buffs), userId);
  }

  public advanceFloor(userId: string, won: boolean): { nextFloor: number; runEnd: boolean; bestFloor: number } {
    this.initTable();
    if (!won) {
      const row = db.prepare('SELECT best_floor, current_floor FROM treasure_vault WHERE user_id = ? AND active = 1')
        .get(userId) as { best_floor: number; current_floor: number };
      const best = Math.max(row.best_floor, row.current_floor);
      db.prepare('UPDATE treasure_vault SET active = 0, best_floor = ? WHERE user_id = ? AND active = 1')
        .run(best, userId);
      return { nextFloor: row.current_floor, runEnd: true, bestFloor: best };
    }

    const row = db.prepare('SELECT current_floor, best_floor FROM treasure_vault WHERE user_id = ? AND active = 1')
      .get(userId) as { current_floor: number; best_floor: number };
    const nextFloor = row.current_floor + 1;
    const best = Math.max(row.best_floor, row.current_floor);

    if (nextFloor > 50) {
      db.prepare('UPDATE treasure_vault SET active = 0, best_floor = ? WHERE user_id = ? AND active = 1')
        .run(best, userId);
      return { nextFloor, runEnd: true, bestFloor: best };
    }

    db.prepare('UPDATE treasure_vault SET current_floor = ?, best_floor = ? WHERE user_id = ? AND active = 1')
      .run(nextFloor, best, userId);
    return { nextFloor, runEnd: false, bestFloor: best };
  }

  public getActiveBuffs(userId: string): string[] {
    this.initTable();
    const row = db.prepare('SELECT active_buffs FROM treasure_vault WHERE user_id = ? AND active = 1')
      .get(userId) as { active_buffs: string } | undefined;
    return row ? JSON.parse(row.active_buffs) : [];
  }

  public getDescription(userId: string): string {
    this.initTable();
    const row = db.prepare('SELECT * FROM treasure_vault WHERE user_id = ?')
      .get(userId) as any;
    const best = row?.best_floor || 0;
    const active = row?.active === 1;
    const buffs = active ? this.getActiveBuffs(userId) : [];
    let msg = `📦 **Thiên Kho Bảo Vật** — Best Floor: **${best}**/50\n`;
    if (active) {
      msg += `Floor hiện tại: **${row.current_floor}**\n`;
      msg += `Buffs: ${buffs.map((b: string) => VAULT_BUFFS.find(vb => vb.id === b)?.name || b).join(', ') || 'Không có'}\n`;
    }
    return msg;
  }
}

export const treasureVaultService = new TreasureVaultService();
