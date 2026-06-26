"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretRealmService = void 0;
// V13 B-02: Bí Cảnh Song Hành (Co-op Secret Realm)
const database_1 = __importDefault(require("../database/database"));
const REALM_CONFIGS = {
    combat: { variant: 'combat', name: 'Song Hành', description: '2 người cùng đánh 1 boss mạnh. Combo element bonus x2.', entryCost: 100, maxEntries: 3 },
    puzzle: { variant: 'puzzle', name: 'Mê Cung', description: 'Mỗi người 1 nửa puzzle. Phải share info qua chat.', entryCost: 50, maxEntries: 3 },
    treasure: { variant: 'treasure', name: 'Kho Báu', description: 'Mỗi room 2 chest — 1 thật 1 bẫy. Cả 2 mở thật = x3 reward.', entryCost: 80, maxEntries: 3 },
};
class SecretRealmService {
    initTable() {
        database_1.default.exec(`
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
    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${weekNum}`;
    }
    getCurrentVariant() {
        // Weekly rotation: Monday = combat, Wednesday = puzzle, Friday = treasure
        const day = new Date().getDay();
        if (day === 1 || day === 2)
            return 'combat';
        if (day === 3 || day === 4)
            return 'puzzle';
        return 'treasure';
    }
    getEntriesThisWeek(userId) {
        this.initTable();
        const week = this.getCurrentWeek();
        const row = database_1.default.prepare('SELECT COUNT(*) as count FROM secret_realm_runs WHERE user_id = ? AND week = ?')
            .get(userId, week);
        return row.count;
    }
    canEnter(userId) {
        const variant = this.getCurrentVariant();
        const entries = this.getEntriesThisWeek(userId);
        const config = REALM_CONFIGS[variant];
        if (entries >= config.maxEntries)
            return { eligible: false, reason: `Đã hết ${config.maxEntries} lượt Bí Cảnh tuần này.`, variant };
        return { eligible: true, reason: '', variant };
    }
    getConfig(variant) {
        return REALM_CONFIGS[variant || this.getCurrentVariant()];
    }
    getDescription(userId) {
        const variant = this.getCurrentVariant();
        const config = REALM_CONFIGS[variant];
        const entries = this.getEntriesThisWeek(userId);
        return `🌀 **Bí Cảnh Song Hành** — ${config.name}\n${config.description}\n🎫 Lượt: ${entries}/${config.maxEntries}`;
    }
}
exports.secretRealmService = new SecretRealmService();
