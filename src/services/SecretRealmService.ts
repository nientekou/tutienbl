// V13 B-02: Bí Cảnh Song Hành (Co-op Secret Realm)
import db from '../database/database';

type RealmVariant = 'combat' | 'puzzle' | 'treasure';

interface SecretRealmConfig {
  variant: RealmVariant;
  name: string;
  description: string;
  entryCost: number;
  maxEntries: number;
}

const REALM_CONFIGS: Record<RealmVariant, SecretRealmConfig> = {
  combat: { variant: 'combat', name: 'Song Hành', description: '2 người cùng đánh 1 boss mạnh. Combo element bonus x2.', entryCost: 100, maxEntries: 3 },
  puzzle: { variant: 'puzzle', name: 'Mê Cung', description: 'Mỗi người 1 nửa puzzle. Phải share info qua chat.', entryCost: 50, maxEntries: 3 },
  treasure: { variant: 'treasure', name: 'Kho Báu', description: 'Mỗi room 2 chest — 1 thật 1 bẫy. Cả 2 mở thật = x3 reward.', entryCost: 80, maxEntries: 3 },
};

class SecretRealmService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS secret_realm_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        partner_id TEXT,
        variant TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        week TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
    `);
  }

  private getCurrentWeek(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNum}`;
  }

  public getCurrentVariant(): RealmVariant {
    // Weekly rotation: Monday = combat, Wednesday = puzzle, Friday = treasure
    const day = new Date().getDay();
    if (day === 1 || day === 2) return 'combat';
    if (day === 3 || day === 4) return 'puzzle';
    return 'treasure';
  }

  public getEntriesThisWeek(userId: string): number {
    this.initTable();
    const week = this.getCurrentWeek();
    const row = db.prepare('SELECT COUNT(*) as count FROM secret_realm_runs WHERE user_id = ? AND week = ?')
      .get(userId, week) as { count: number };
    return row.count;
  }

  public canEnter(userId: string): { eligible: boolean; reason: string; variant: RealmVariant } {
    const variant = this.getCurrentVariant();
    const entries = this.getEntriesThisWeek(userId);
    const config = REALM_CONFIGS[variant];
    if (entries >= config.maxEntries) return { eligible: false, reason: `Đã hết ${config.maxEntries} lượt Bí Cảnh tuần này.`, variant };
    return { eligible: true, reason: '', variant };
  }

  public getConfig(variant?: RealmVariant): SecretRealmConfig {
    return REALM_CONFIGS[variant || this.getCurrentVariant()];
  }

  public getDescription(userId: string): string {
    const variant = this.getCurrentVariant();
    const config = REALM_CONFIGS[variant];
    const entries = this.getEntriesThisWeek(userId);
    return `🌀 **Bí Cảnh Song Hành** — ${config.name}\n${config.description}\n🎫 Lượt: ${entries}/${config.maxEntries}`;
  }
}

export const secretRealmService = new SecretRealmService();
