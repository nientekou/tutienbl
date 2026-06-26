// V13 D-01: Đồng Hành (Dao Companion)
import db from '../database/database';

interface CompanionDef {
  type: string;
  name: string;
  element: string;
  passive: string;
  passiveDesc: string;
  unlockReq: string;
}

const COMPANIONS: CompanionDef[] = [
  { type: 'hoa_linh', name: 'Hỏa Linh', element: 'Hỏa', passive: 'low_hp_atk_boost', passiveDesc: 'HP<30% → +25% ATK', unlockReq: 'start' },
  { type: 'thuy_linh', name: 'Thủy Linh', element: 'Thủy', passive: 'hp_regen', passiveDesc: 'Heal 2% max HP mỗi hiệp', unlockReq: 'level_30' },
  { type: 'loi_linh', name: 'Lôi Linh', element: 'Lôi', passive: 'stun_chance', passiveDesc: '10% chance stun enemy 1 lượt', unlockReq: 'prestige_1' },
  { type: 'phong_linh', name: 'Phong Linh', element: 'Phong', passive: 'speed_boost', passiveDesc: '+15% speed, first strike guarantee', unlockReq: 'achievement' },
  // V15 D-01: 4 new companions
  { type: 'tho_linh', name: 'Thổ Linh', element: 'Thổ', passive: 'thorns_def', passiveDesc: '+15% DEF, thorns 5% (phản 5% damage)', unlockReq: 'level_60' },
  { type: 'kim_linh', name: 'Kim Linh', element: 'Kim', passive: 'ignore_def', passiveDesc: '+10% ignore DEF on attacks', unlockReq: 'prestige_2' },
  { type: 'moc_linh', name: 'Mộc Linh', element: 'Mộc', passive: 'hp_regen_high', passiveDesc: 'Regen 3% HP khi HP > 50%', unlockReq: 'chain_hunt_3' },
  { type: 'hu_linh', name: 'Hư Linh', element: 'Hư', passive: 'debuff_immune', passiveDesc: 'Immune 1 debuff mỗi hiệp', unlockReq: 'all_beasts' },
];

const MAX_LEVEL = 20;
const XP_PER_LEVEL = 50;

class CompanionService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS companion (
        user_id TEXT NOT NULL,
        companion_type TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        evolved INTEGER DEFAULT 0,
        equipped INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, companion_type)
      );
    `);
  }

  public getUnlockedCompanions(userId: string): CompanionDef[] {
    this.initTable();
    const rows = db.prepare('SELECT companion_type FROM companion WHERE user_id = ?').all(userId) as { companion_type: string }[];
    const unlocked = new Set(rows.map(r => r.companion_type));
    return COMPANIONS.filter(c => {
      if (c.unlockReq === 'start') return true;
      return unlocked.has(c.type);
    });
  }

  public getCompanion(userId: string, type: string): { level: number; xp: number; evolved: number } | null {
    this.initTable();
    return db.prepare('SELECT level, xp, evolved FROM companion WHERE user_id = ? AND companion_type = ?')
      .get(userId, type) as any || null;
  }

  public getEquipped(userId: string): CompanionDef | null {
    this.initTable();
    const row = db.prepare('SELECT companion_type FROM companion WHERE user_id = ? AND equipped = 1')
      .get(userId) as { companion_type: string } | undefined;
    if (!row) return null;
    return COMPANIONS.find(c => c.type === row.companion_type) || null;
  }

  public equip(userId: string, type: string): { success: boolean; message: string } {
    this.initTable();
    const existing = this.getCompanion(userId, type);
    if (!existing) return { success: false, message: 'Chưa sở hữu companion này.' };
    db.prepare('UPDATE companion SET equipped = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE companion SET equipped = 1 WHERE user_id = ? AND companion_type = ?').run(userId, type);
    return { success: true, message: `Đã trang bị ${COMPANIONS.find(c => c.type === type)?.name || type}.` };
  }

  public addXp(userId: string, type: string, amount: number): { levelUp: boolean; newLevel: number; evolved: boolean } {
    this.initTable();
    const comp = this.getCompanion(userId, type);
    if (!comp) return { levelUp: false, newLevel: 1, evolved: false };

    let xp = comp.xp + amount;
    let level = comp.level;
    let levelUp = false;
    let evolved = false;

    while (xp >= XP_PER_LEVEL * level && level < MAX_LEVEL) {
      xp -= XP_PER_LEVEL * level;
      level++;
      levelUp = true;
    }

    if (level >= MAX_LEVEL && !comp.evolved) {
      db.prepare('UPDATE companion SET evolved = 1 WHERE user_id = ? AND companion_type = ?').run(userId, type);
      evolved = true;
    }

    db.prepare('UPDATE companion SET level = ?, xp = ? WHERE user_id = ? AND companion_type = ?')
      .run(level, xp, userId, type);

    return { levelUp, newLevel: level, evolved };
  }

  public unlock(userId: string, type: string): { success: boolean; message: string } {
    this.initTable();
    if (this.getCompanion(userId, type)) return { success: false, message: 'Đã sở hữu.' };
    db.prepare('INSERT INTO companion (user_id, companion_type, level, xp, evolved, equipped) VALUES (?, ?, 1, 0, 0, 0)')
      .run(userId, type);
    const def = COMPANIONS.find(c => c.type === type);
    return { success: true, message: `Đã mở khóa **${def?.name || type}**!` };
  }

  public getCombatPassive(userId: string): { passive: string; value: number } | null {
    const equipped = this.getEquipped(userId);
    if (!equipped) return null;
    const comp = this.getCompanion(userId, equipped.type);
    if (!comp) return null;
    const scale = 1 + (comp.level - 1) * 0.05;
    return { passive: equipped.passive, value: scale };
  }

  public getDescription(userId: string): string {
    const comps = this.getUnlockedCompanions(userId);
    let msg = '**Đồng Hành**\n';
    for (const c of comps) {
      const comp = this.getCompanion(userId, c.type);
      const equipped = this.getEquipped(userId)?.type === c.type;
      const status = equipped ? ' ⚔️' : '';
      msg += `${status} **${c.name}** (${c.element}) — Level ${comp?.level || 1}/${MAX_LEVEL}\n  ${c.passiveDesc}\n`;
    }
    return msg;
  }
}

export const companionService = new CompanionService();
