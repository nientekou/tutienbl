# KẾ HOẠCH TRIỂN KHAI TỔNG THỂ — Tu Tiên V2 Massive Update

## PHỤ THUỘC & THỨ TỰ

```
Phase 1: Infrastructure (nền móng — không phụ thuộc hệ thống mới)
  1A  Action Handler Registry       → tách interactionCreate.ts
  1B  Shared Middleware              → checks, validation, helpers
  1C  Cache Layer centralized        → CacheService.ts
  1D  Duplicate cleanup              → xóa dongphu/tongmon/kynang trùng
  1E  DB index optimization          → thêm 15+ indexes

Phase 2: 5 Hệ thống ưu tiên (phụ thuộc Phase 1)
  2A  Kỳ ngộ + Thiên kiếp          → CultivationService enhancement
  2B  Tâm ma + Ngộ đạo              → Inner Demon + Dao system
  2C  Dị hỏa + Dị thú              → Rare Flames + Rare Beasts
  2D  Đấu trường xếp hạng          → Arena rework
  2E  Thế giới Boss nâng cấp       → World Boss rework

Phase 3: Balance (chạy song song Phase 2)
  3A  Stat formula overhaul
  3B  Linh Can RNG fix
  3C  Enhancement destruction → 5%
  3D  Economy sink/source rebalance

Phase 4: UI Migration (phụ thuộc 1A, song song 2-3)
  4A  V2 Component Factory library
  4B  Command migration 70 files
  4C  Navigation redesign

Phase 5: Retention (phụ thuộc Phase 2)
  5B  Login reward overhaul
  5C  Achievement expansion
```

---

## PHẦN 1: CODE QUALITY REWORK

### 1A. Action Handler Registry

**Mục tiêu**: Biến interactionCreate.ts (3773 dòng) thành dispatcher ~400 dòng + 8 handler files mới.

#### File mới: `src/handlers/interactions/InteractionRegistry.ts` (~150 dòng)

```typescript
import { Interaction } from 'discord.js';
import { InteractionLock } from '../../services/InteractionLock';
import { db } from '../../database/database';

export type HandlerFn = (
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
) => Promise<void>;

interface HandlerEntry {
  prefixes: string[];
  fn: HandlerFn;
  public?: boolean;
}

export class InteractionRegistry {
  private routes: HandlerEntry[] = [];
  private fallbackFn?: HandlerFn;

  on(prefixes: string[], fn: HandlerFn, public_ = false): this {
    this.routes.push({ prefixes, fn, public: public_ });
    return this;
  }

  onFallback(fn: HandlerFn): this {
    this.fallbackFn = fn;
    return this;
  }

  async dispatch(interaction: Interaction, action: string, parts: string[], userId: string): Promise<boolean> {
    for (const r of this.routes) {
      if (r.prefixes.includes(action)) {
        await r.fn(interaction, action, parts, userId);
        return true;
      }
    }
    if (this.fallbackFn) {
      await this.fallbackFn(interaction, action, parts, userId);
      return true;
    }
    return false;
  }

  isPublic(action: string): boolean {
    return this.routes.some(r => r.prefixes.includes(action) && r.public);
  }
}

export const registry = new InteractionRegistry();
```

#### File mới: `src/handlers/interactions/middleware.ts` (~100 dòng)

```typescript
import { Interaction, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { db } from '../../database/database';
import { safeV2Update } from '../../utils/uiSystem';
import { userRepository } from '../../database/repositories/UserRepository';

export interface Ctx {
  interaction: Interaction;
  userId: string;
  parts: string[];
  user?: any;
}

export async function loadUser(ctx: Ctx): Promise<boolean> {
  const row = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(ctx.userId);
  if (!row) {
    await safeV2Update(ctx.interaction,
      [{ description: '❌ Chưa tạo nhân vật. Dùng `/taonhanvat` để bắt đầu.' }]);
    return false;
  }
  ctx.user = row;
  return true;
}

export async function checkInjury(ctx: Ctx): Promise<boolean> {
  if (!ctx.user) return true;
  const now = Math.floor(Date.now() / 1000);
  if (ctx.user.injury_end && ctx.user.injury_end > now) {
    const left = ctx.user.injury_end - now;
    const m = Math.ceil(left / 60);
    await safeV2Update(ctx.interaction,
      [{ description: `❌ Đang bị thương — còn ${m} phút.` }]);
    return false;
  }
  return true;
}

export async function requireChecks(
  ctx: Ctx,
  fns: Array<(c: Ctx) => Promise<boolean>>,
  body: () => Promise<void>
): Promise<void> {
  for (const fn of fns) {
    if (!(await fn(ctx))) return;
  }
  await body();
}
```

#### File mới: `src/handlers/interactions/EquipmentInteractionHandler.ts` (~300 dòng)

Di chuyển các action: `cuonghoa`, `dotpha`, `suachua`, `equip`, `unequip`, `trangbi`, `enhance_*`, `forge_*`, `repair_*`

#### File mới: `src/handlers/interactions/BossInteractionHandler.ts` (~180 dòng)

Di chuyển: `worldbossattack`, `bossinfo`, `bossreward`, `elitejoin`, `elitecreate`, `elitefight`

#### File mới: `src/handlers/interactions/MarketInteractionHandler.ts` (~200 dòng)

Di chuyển: `shopbuy`, `sknbuy`, `thanhtly`, `marketlist`, `marketbuy`, `trade`, `traveler_*`, `buyorder`

#### File mới: `src/handlers/interactions/AchievementInteractionHandler.ts` (~120 dòng)

Di chuyển: `thanhtuu`, `achieveclaim`, `titleselect`, `dest_*`

#### File mới: `src/handlers/interactions/SocialInteractionHandler.ts` (~150 dòng)

Di chuyển: `accept_marriage`, `reject_marriage`, `sectcreate`, `sectjoin`, `brotherhood_*`, `mentor_*`

#### File mới: `src/handlers/interactions/NavigationInteractionHandler.ts` (~200 dòng)

Di chuyển: `hosotab`, `hosoback`, `hosolb`, `tuido`, `invprev`, `invnext`, `invselect`, `page_*`, `pb_*`

#### File mới: `src/handlers/interactions/CombatInteractionHandler.ts` (~250 dòng)

Di chuyển: `duelaccept`, `duelrefuse`, `duelchoose`, `duellichsu`, `bicanh*`, `pvp*`, `guildwar*`, `sectwar*`

#### File đã có, cần sửa: `CultivationInteractionHandler.ts` (~476 dòng → mở rộng thêm ~200 dòng)

Thêm actions mới từ 2A/2B: `kyngo_choose`, `kyngo_view`, `tamMa_fight`, `tamMa_retreat`, `ngoDao_activate`

#### interactionCreate.ts sau refactor (~400-500 dòng)

```typescript
// src/events/interactionCreate.ts — SAU MIGRATION

import { registry } from '../handlers/interactions/InteractionRegistry';
import { InteractionLock } from '../services/InteractionLock';
import { db } from '../database/database';
import { safeV2Update, toV2Payload } from '../utils/uiSystem';

// Import all handlers to register them
import '../handlers/interactions/handlers'; // side-effect import registers everything

const PUBLIC_ACTIONS = ['worldbossattack', 'duelaccept', 'trade', 'bg_*'];

function parseCustomId(customId: string): { action: string; parts: string[]; userId: string } {
  const parts = customId.split('_');
  const userId = parts[parts.length - 1];
  const actionParts = parts.slice(0, -1);
  return { action: actionParts.join('_'), parts, userId };
}

export async function handleInteraction(interaction: any) {
  if (interaction.isAutocomplete()) {
    // ... autocomplete logic giữ nguyên
    return;
  }

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // Pre-checks: ban, maintenance, lock
  const userId = interaction.user.id;
  const banned = db.prepare('SELECT 1 FROM banned_users WHERE user_id = ?').get(userId);
  if (banned) return;

  if (!registry.isPublic(interaction.customId)) {
    if (!await InteractionLock.acquire(userId)) return;
  }

  const { action, parts, userId: targetUserId } = parseCustomId(interaction.customId);

  // Ownership check (trừ public actions)
  const isPublic = PUBLIC_ACTIONS.some(p => interaction.customId.startsWith(p));
  if (!isPublic) {
    const ownershipUserId = parts[parts.length - 1];
    if (ownershipUserId !== interaction.user.id) return;
  }

  await registry.dispatch(interaction, action, parts, targetUserId);
}
```

#### File mới: `src/handlers/interactions/handlers.ts` — Registry bootstrap

```typescript
// src/handlers/interactions/handlers.ts
import { registry } from './InteractionRegistry';
import { handleCultivationAction } from './CultivationInteractionHandler';
import { handleProfileAction } from './ProfileInteractionHandler';
import { handleEquipmentAction } from './EquipmentInteractionHandler';
import { handleBossAction } from './BossInteractionHandler';
import { handleMarketAction } from './MarketInteractionHandler';
import { handleAchievementAction } from './AchievementInteractionHandler';
import { handleSocialAction } from './SocialInteractionHandler';
import { handleNavigationAction } from './NavigationInteractionHandler';
import { handleCombatAction } from './CombatInteractionHandler';
import { handleLifeAction } from './LifeInteractionHandler';
import { handleCasinoAction } from './CasinoInteractionHandler';

// Cultivation — ~45 actions
registry.on(
  ['luanhoiconfirm', 'luanhoicancel', 'ycanhawaken', 'tuluyen', 'dotpha',
   'loi', 'taytuynav', 'tamphap_select', 'tamphap_activate',
   'kyngo_choose', 'kyngo_view', 'tamMa_fight', 'tamMa_retreat', 'ngoDao_activate'],
  handleCultivationAction
);

// Equipment & Enhancement — ~20 actions
registry.on(
  ['cuonghoa', 'dotpha_confirm', 'suachua', 'equip', 'unequip',
   'enhance_confirm', 'enhance_select', 'forge_confirm', 'repair_use'],
  handleEquipmentAction
);

// Boss & Elite — ~10 actions
registry.on(
  ['worldbossattack', 'bossinfo', 'elitejoin', 'elitecreate', 'elitefight'],
  handleBossAction, true
);

// Market & Trading — ~15 actions
registry.on(
  ['shopbuy', 'sknbuy', 'thanhtly', 'marketlist', 'marketbuy',
   'trade', 'traveler_buy_item', 'traveler_refuse', 'buyorder'],
  handleMarketAction
);

// Achievement & Destiny — ~8 actions
registry.on(
  ['thanhtuu', 'achieveclaim', 'titleselect', 'dest_select', 'dest_confirm'],
  handleAchievementAction
);

// Social — ~10 actions
registry.on(
  ['accept_marriage', 'reject_marriage', 'sectcreate', 'sectjoin',
   'brotherhood_accept', 'brotherhood_refuse', 'mentor_accept'],
  handleSocialAction
);

// Navigation & Profile — ~15 actions
registry.on(
  ['hosotab', 'hosoback', 'hosolb', 'tuido', 'invprev', 'invnext',
   'invselect', 'page_next', 'page_prev', 'pb_select', 'pb_play'],
  handleNavigationAction
);

// PvP Combat — ~12 actions
registry.on(
  ['duelaccept', 'duelrefuse', 'duelchoose', 'duellichsu',
   'bicanh', 'guildwar_join', 'sectwar_join'],
  handleCombatAction
);

// Life skills — delegates to existing
registry.on(['alch'], handleLifeAction);

// Casino — delegates to existing
registry.on(['casinoplay', 'casinodouble', 'casinocollect'], handleCasinoAction);
```

---

### 1B. Shared Middleware (đã mô tả ở trên trong middleware.ts)

Các functions tái sử dụng:
- `loadUser(ctx)` — kiểm tra user tồn tại
- `checkInjury(ctx)` — kiểm tra đang bị thương
- `requireChecks(ctx, [loadUser, checkInjury], bodyFn)` — chain checks

---

### 1C. Cache Layer

#### File mới: `src/services/CacheService.ts` (~120 dòng)

```typescript
interface CacheEntry<T> { data: T; expiresAt: number; }

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private gcTimer: NodeJS.Timeout;

  constructor(private defaultTtlMs = 30_000) {
    this.gcTimer = setInterval(() => this.gc(), 60_000);
  }

  get<T = any>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  invalidatePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  invalidateExact(key: string): void { this.store.delete(key); }

  private gc() {
    const now = Date.now();
    for (const [k, v] of [...this.store.entries()]) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }
}

export const cacheService = new CacheService();
```

**Cache keys pattern**:
- `user:{discord_id}` → user row (60s TTL)
- `stats:{userId}` → computed ActiveStats (30s TTL)
- `boss:current` → current world boss (10s TTL)
- `leaderboard:{type}` → leaderboard data (5min TTL)
- `item:{itemId}` → item catalog row (5min TTL)

**Wiring vào existing services**:
- `InventoryService.getActiveStats()` — check cache trước khi compute
- `UserRepository.findById()` — cache user row
- `CombatService.getCurrentBoss()` — cache boss state
- `LeaderboardService` — dùng cacheService thay vì internal cache

---

### 1D. Duplicate Cleanup

| Vấn đề | Xử lý |
|---------|-------|
| `src/commands/general/dongphu.ts` + `src/commands/life/dongphu.ts` | Giữ `life/dongphu.ts`, xóa `general/dongphu.ts`, cập nhật CommandHandler import |
| `src/commands/general/tongmon.ts` + `src/commands/life/tongmon.ts` | Giữ `life/tongmon.ts`, xóa `general/tongmon.ts` |
| `src/commands/general/kynang.ts` x2 | Kiểm tra nội dung, xóa bản trùng |

---

### 1E. DB Index Optimization

Thêm vào `initDatabase()` sau tất cả table creation:

```typescript
// Performance indexes — batch add
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_inv_user_item ON inventories(user_id, item_id);
  CREATE INDEX IF NOT EXISTS idx_inv_equipped ON inventories(user_id, is_equipped);
  CREATE INDEX IF NOT EXISTS idx_inv_slot ON inventories(user_id, equipment_slot);
  CREATE INDEX IF NOT EXISTS idx_dungeon_cd ON dungeon_cooldowns(user_id, dungeon_id);
  CREATE INDEX IF NOT EXISTS idx_arena_elo ON arena_profiles(elo DESC);
  CREATE INDEX IF NOT EXISTS idx_boss_contrib ON world_boss_contributions(boss_id);
  CREATE INDEX IF NOT EXISTS idx_daily_quest_user ON daily_quests(user_id, assigned_at);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_market_item ON market_listings(item_id, status);
  CREATE INDEX IF NOT EXISTS idx_achieve_user ON user_achievements(user_id, unlocked);
  CREATE INDEX IF NOT EXISTS idx_pet_user ON pets(user_id, is_deployed);
  CREATE INDEX IF NOT EXISTS idx_heart_law_user ON user_heart_laws(user_id);
  CREATE INDEX IF NOT EXISTS idx_destiny_user ON user_destinies(user_id);
  CREATE INDEX IF NOT EXISTS idx_skill_user ON user_skills(user_id);
  CREATE INDEX IF NOT EXISTS idx_quest_chain_user ON quest_chain_progress(user_id);
`);
```

---

## PHẦN 2: 5 HỆ THỐNG ƯU TIÊN

### 2A. Kỳ ngộ + Thiên kiếp (Random Cultivation Events + Tribulation Enhancement)

#### Bảng mới

```sql
-- Sự kiện tu luyện ngẫu nhiên
CREATE TABLE IF NOT EXISTS ky_ngo_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL DEFAULT '{}',   -- JSON: title, description, choices[]
  selected_choice TEXT,                     -- NULL = chưa chọn
  result_data TEXT,                         -- JSON: {success, message, effects[]}
  completed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyngo_user ON ky_ngo_events(user_id, completed);

-- Mở rộng active_tribulations
ALTER TABLE active_tribulations ADD COLUMN mood TEXT DEFAULT 'normal';
-- mood: 'blessed' (+15% resist), 'normal', 'cursed' (-15% resist, +25% dmg)

ALTER TABLE active_tribulations ADD COLUMN dao_bonus INTEGER DEFAULT 0;
-- dao points earned during this tribulation
```

#### Items mới (thêm vào seedItems)

```typescript
// Trong seedItems()
{ id: 'talisman_ky_ngo', name: 'Thiên Cơ Phù', type: 'talisman', rarity: 'epic',
  description: 'Thu hút kỳ ngộ khi tu luyện', stats: JSON.stringify({cultivation_event_chance: 0.15}),
  value_ha_pham: 500, usable: 1, equipable: 1 },
{ id: 'item_ngu_lon', name: 'Ngũ Lôi Tịnh Thể Đan', type: 'pill', rarity: 'legendary',
  description: 'Tăng 50% tỷ lệ vượt thiên kiếp', stats: JSON.stringify({tribulation_resist_bonus: 50}),
  value_ha_pham: 2000, usable: 1, equipable: 0 },
```

#### Constants mới: `src/config/kyNgoConstants.ts` (~180 dòng)

```typescript
export interface KyNgoEvent {
  type: string;
  title: string;
  description: string;
  choices: KyNgoChoice[];
  minRealm: number;
  weight: number;
  cooldownHours: number;
}

export interface KyNgoChoice {
  id: string;
  label: string;
  successRate: number;        // 0-1, modified by luck/linhCan
  successReward: EffectDef;
  failurePenalty: EffectDef;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface EffectDef {
  type: 'cultivation_speed' | 'breakthrough_rate' | 'exp' | 'tu_vi' | 'stat_temp' | 'qi_deviation';
  value: number;
  duration?: number;          // in hours, null = permanent
}

export const KY_NGO_EVENTS: KyNgoEvent[] = [
  {
    type: 'breakthrough_inspiration',
    title: '💡 Đột Phát Linh Quang',
    description: 'Đang tu luyện, ngươi cảm thấy một tia sáng lóe lên trong tâm trí…',
    choices: [
      {
        id: 'seize', label: '🔵 Chớp lấy cảm ngộ',
        successRate: 0.6,
        successReward: { type: 'breakthrough_rate', value: 25 },
        failurePenalty: { type: 'qi_deviation', value: 10 },
        riskLevel: 'medium'
      },
      {
        id: 'steady', label: '🟢稳扎稳打 (tu luyện bình thường)',
        successRate: 0.95,
        successReward: { type: 'cultivation_speed', value: 10, duration: 24 },
        failurePenalty: { type: 'exp', value: -50 },
        riskLevel: 'low'
      }
    ],
    minRealm: 0, weight: 30, cooldownHours: 12
  },
  {
    type: 'wandering_cultivator',
    title: '🧑‍🦳 Lữ Hành Giả Du Già',
    description: 'Một lữ hành già nua xuất hiện, ánh mắt thâm thúy: "Tiểu hữu, ta có một vật trao tặng…"',
    choices: [
      {
        id: 'accept', label: '🔵 Nhận vật phẩm',
        successRate: 0.5,
        successReward: { type: 'exp', value: 500 },
        failurePenalty: { type: 'stat_temp', value: -20 }, // -20% ATK 1h
        riskLevel: 'medium'
      },
      {
        id: 'decline', label: '⚪ Từ chối lịch sự',
        successRate: 1.0,
        successReward: { type: 'cultivation_speed', value: 5, duration: 12 },
        failurePenalty: { type: 'exp', value: -10 },
        riskLevel: 'low'
      },
      {
        id: 'rob', label: '🔴 Cướp lấy!',
        successRate: 0.15,
        successReward: { type: 'exp', value: 2000 },
        failurePenalty: { type: 'qi_deviation', value: 30 },
        riskLevel: 'high'
      }
    ],
    minRealm: 5, weight: 20, cooldownHours: 24
  },
  {
    type: 'meditation_insight',
    title: '🧘 Minh Tâm Kiến Tính',
    description: 'Trong lúc nhập định, ngươi cảm nhận được một sợi dây liên kết với thiên đạo…',
    choices: [
      {
        id: 'deep', label: '🔵 Nhập định sâu',
        successRate: 0.4,
        successReward: { type: 'tu_vi', value: 200 },
        failurePenalty: { type: 'qi_deviation', value: 15 },
        riskLevel: 'medium'
      },
      {
        id: 'observe', label: '🟢 Quan sát rồi xuất định',
        successRate: 0.9,
        successReward: { type: 'cultivation_speed', value: 15, duration: 6 },
        failurePenalty: { type: 'exp', value: -30 },
        riskLevel: 'low'
      }
    ],
    minRealm: 10, weight: 25, cooldownHours: 8
  },
  {
    type: 'ancient_formation',
    title: '🏛️ Trận Pháp Cổ Đại',
    description: 'Ngươi phát hiện một trận pháp cổ đại ẩn trong hang động…',
    choices: [
      {
        id: 'study', label: '🔵 Nghiên cứu trận pháp',
        successRate: 0.35,
        successReward: { type: 'breakthrough_rate', value: 35 },
        failurePenalty: { type: 'qi_deviation', value: 20 },
        riskLevel: 'medium'
      },
      {
        id: 'absorb', label: '🔴 Hấp thụ linh khí trong trận',
        successRate: 0.25,
        successReward: { type: 'tu_vi', value: 500 },
        failurePenalty: { type: 'qi_deviation', value: 40 },
        riskLevel: 'high'
      },
      {
        id: 'leave', label: '⚪ Rời đi an toàn',
        successRate: 1.0,
        successReward: { type: 'exp', value: 100 },
        failurePenalty: { type: 'exp', value: -10 },
        riskLevel: 'low'
      }
    ],
    minRealm: 15, weight: 15, cooldownHours: 48
  }
];
```

#### Service mới: `src/services/KyNgoService.ts` (~350 dòng)

```typescript
import { db } from '../database/database';
import { KY_NGO_EVENTS, KyNgoEvent } from '../config/kyNgoConstants';
import { cacheService } from './CacheService';

class KyNgoService {
  private COOLDOWN_KEY_PREFIX = 'kyngo_cd:';

  /**
   * Roll for random event during cultivation
   * Called from CultivationService.practice() and TribulationService.handleAction()
   */
  maybeTriggerEvent(userId: string, userLevel: number, luck: number): KyNgoEvent | null {
    // Check cooldown
    const lastEvent = cacheService.get<number>(`${this.COOLDOWN_KEY_PREFIX}${userId}`);
    if (lastEvent) return null;

    // Filter events by realm requirement
    const eligible = KY_NGO_EVENTS.filter(e => userLevel >= e.minRealm);
    if (!eligible.length) return null;

    // Weighted random selection
    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
    const roll = Math.random() * totalWeight;
    let cumul = 0;
    for (const evt of eligible) {
      cumul += evt.weight;
      if (roll <= cumul) return evt;
    }
    return null;
  }

  /** Save triggered event to DB */
  async createEvent(userId: string, event: KyNgoEvent): Promise<number> {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24h
    const info = db.prepare(`
      INSERT INTO ky_ngo_events (user_id, event_type, event_data, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, event.type, JSON.stringify({
      title: event.title,
      description: event.description,
      choices: event.choices.map(c => ({
        id: c.id, label: c.label, riskLevel: c.riskLevel
      }))
    }), expiresAt);
    return info.lastInsertRowid as number;
  }

  /** Handle player choice */
  async resolveChoice(
    eventId: number,
    userId: string,
    choiceId: string,
    luck: number,
    linhCan: string
  ): Promise<{ success: boolean; message: string; effects: any[] }> {
    const row = db.prepare('SELECT * FROM ky_ngo_events WHERE id = ? AND user_id = ?').get(eventId, userId) as any;
    if (!row || row.completed) throw new Error('Event not found or already completed');

    const data = JSON.parse(row.event_data);
    const choice = data.choices.find((c: any) => c.id === choiceId);
    if (!choice) throw new Error('Invalid choice');

    // Find full event definition
    const eventDef = KY_NGO_EVENTS.find(e => e.type === row.event_type);
    const fullChoice = eventDef?.choices.find(c => c.id === choiceId);

    // Calculate success rate with modifiers
    let successRate = fullChoice?.successRate ?? 0.5;
    successRate += luck * 0.002; // luck bonus
    // Linh Can bonus (Hỏa element helps meditation events)
    const linhCanArr = JSON.parse(linhCan || '[]');
    const hoaPct = linhCanArr.find((l: any) => l.element === 'hoa')?.percentage ?? 0;
    if (row.event_type === 'meditation_insight') successRate += hoaPct * 0.001;
    successRate = Math.min(0.95, successRate);

    const success = Math.random() < successRate;
    const effect = success ? fullChoice?.successReward : fullChoice?.failurePenalty;

    const message = success
      ? `✅ Thành công! ${(effect as any)?.type === 'exp' ? 'Nhận' : 'Tăng'} +${Math.abs((effect as any)?.value ?? 0)}`
      : `❌ Thất bại! ${(effect as any)?.type === 'qi_deviation' ? `Tăng lệch tâm +${Math.abs((effect as any)?.value ?? 0)}` : `Mất ${Math.abs((effect as any)?.value ?? 0)}`}`;

    db.prepare(`
      UPDATE ky_ngo_events SET selected_choice = ?, result_data = ?, completed = 1 WHERE id = ?
    `).run(choiceId, JSON.stringify({ success, message, effect }), eventId);

    cacheService.set(`${this.COOLDOWN_KEY_PREFIX}${userId}`, Date.now(), eventDef!.cooldownHours * 3600 * 1000);

    return { success, message, effects: effect ? [effect] : [] };
  }

  /** Apply effects to user */
  applyEffects(userId: string, effects: any[]): void {
    for (const eff of effects) {
      switch (eff.type) {
        case 'cultivation_speed':
          // Temporary buff → store in system_config or user field
          db.prepare('UPDATE users SET cultivation_speed_bonus = cultivation_speed_bonus + ? WHERE discord_id = ?')
            .run(eff.value, userId);
          if (eff.duration) {
            // Schedule removal
            setTimeout(() => {
              db.prepare('UPDATE users SET cultivation_speed_bonus = cultivation_speed_bonus - ? WHERE discord_id = ?')
                .run(eff.value, userId);
            }, eff.duration * 3600 * 1000);
          }
          break;
        case 'breakthrough_rate':
          db.prepare('UPDATE users SET breakthrough_bonus = breakthrough_bonus + ? WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'tu_vi':
          db.prepare('UPDATE users SET tu_vi = MAX(0, tu_vi + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'exp':
          db.prepare('UPDATE users SET exp = MAX(0, exp + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
        case 'qi_deviation':
          db.prepare('UPDATE users SET qi_deviation = MIN(100, qi_deviation + ?) WHERE discord_id = ?')
            .run(eff.value, userId);
          break;
      }
    }
  }

  /** Get pending events for user */
  getPendingEvents(userId: string): any[] {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`
      SELECT * FROM ky_ngo_events
      WHERE user_id = ? AND completed = 0 AND expires_at > ?
      ORDER BY created_at DESC
    `).all(userId, now);
  }
}

export const kyNgoService = new KyNgoService();
```

#### Tribulation Enhancement (sửa `TribulationService.ts`)

```typescript
// Trong TribulationService.handleAction(), thêm sau mỗi bolt:
// === KY NGO CHECK ===
import { kyNgoService } from './KyNgoService';

// After each bolt processing, before next bolt:
const event = kyNgoService.maybeTriggerEvent(userId, user.level, user.luck);
if (event) {
  const eventId = await kyNgoService.createEvent(userId, event);
  // Append tribulation mood based on event result
  state.mood = 'blessed'; // or 'cursed' based on outcome
  state.dao_bonus += 5; // Dao points earned
}

// Mood effects on tribulation:
// blessed: -15% damage per bolt
// cursed: +15% damage, but +25% dao points
```

**Files sửa**:
- `src/services/TribulationService.ts` — thêm kyNgoService.maybeTriggerEvent(), mood effects
- `src/services/CultivationService.ts` — thêm kyNgoService.maybeTriggerEvent() sau practice()
- `src/config/gameConstants.ts` — thêm KY_NGO_BASE_CHANCE: 0.08 (8% per practice tick)

**Files mới**:
- `src/config/kyNgoConstants.ts`
- `src/services/KyNgoService.ts`

**Interaction routing**: Thêm actions `kyngo_choose`, `kyngo_view` vào CultivationInteractionHandler

**Scope estimate**: ~800 dòng code mới + ~100 dòng sửa

---

### 2B. Tâm ma + Ngộ đạo (Inner Demons + Dao Comprehension)

#### Bảng mới

```sql
-- Hệ thống tâm ma
CREATE TABLE IF NOT EXISTS inner_demons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  demon_type TEXT NOT NULL,            -- 'fear' | 'doubt' | 'obsession' | 'wrath' | 'pride'
  demon_name TEXT NOT NULL,            -- Vietnamese display name
  power INTEGER NOT NULL,             -- Scales with player power
  defeated INTEGER DEFAULT 0,
  defeated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_demon_user ON inner_demons(user_id, defeated);

--悟道 points và abilities
CREATE TABLE IF NOT EXISTS dao_comprehension (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  dao_type TEXT NOT NULL,              -- 'sword_dao' | 'body_dao' | 'alchemist_dao' | 'formation_dao' | 'soul_dao'
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,            -- 1-10, unlocks passives
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, dao_type)
);

-- Mở rộng users
ALTER TABLE users ADD COLUMN qi_deviation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN total_dao_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN demon_fear INTEGER DEFAULT 0;     -- stat penalty from demon defeat
ALTER TABLE users ADD COLUMN demon_doubt INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN demon_obsession INTEGER DEFAULT 0;
```

#### Constants: `src/config/tamMaConstants.ts` (~200 dòng)

```typescript
export interface InnerDemon {
  type: string;
  name: string;
  description: string;
  element: string;
  basePower: number;       // Scaled by player level
  skills: string[];
  reward: { daoType: string; points: number };
  failurePenalty: { qiDeviation: number; statPenalty: number; statType: string };
}

export const INNER_DEMON_TYPES: InnerDemon[] = [
  {
    type: 'fear',
    name: 'Sợ Hãi Nội Tâm',
    description: 'Một bóng đen hiện ra, mang hình dáng nỗi sợ sâu xa nhất của ngươi.',
    element: 'thuy',
    basePower: 50,
    skills: ['fear_gaze', 'shadow_strike'],
    reward: { daoType: 'soul_dao', points: 10 },
    failurePenalty: { qiDeviation: 15, statPenalty: 5, statType: 'def' }
  },
  {
    type: 'doubt',
    name: 'Nghi Ngại Tâm Đạo',
    description: 'Tiếng nói vang lên: "Ngươi có chắc con đường này đúng không?"',
    element: 'phong',
    basePower: 60,
    skills: ['doubt_whisper', 'mental_shatter'],
    reward: { daoType: 'sword_dao', points: 12 },
    failurePenalty: { qiDeviation: 20, statPenalty: 8, statType: 'atk' }
  },
  {
    type: 'obsession',
    name: 'Tham Vọng Vô Đâu',
    description: 'Một phiên bản khác của ngươi xuất hiện, mạnh hơn, tàn nhẫn hơn.',
    element: 'hoa',
    basePower: 80,
    skills: ['obsession_clone', 'soul_drain'],
    reward: { daoType: 'body_dao', points: 15 },
    failurePenalty: { qiDeviation: 25, statPenalty: 10, statType: 'hp' }
  },
  {
    type: 'wrath',
    name: 'Thịnh Nộ Bất Kềm',
    description: 'Lửa giận bao phủ, ngươi cảm thấy mất kiểm soát…',
    element: 'hoa',
    basePower: 70,
    skills: ['wrath_burst', 'berserk_rage'],
    reward: { daoType: 'formation_dao', points: 14 },
    failurePenalty: { qiDeviation: 20, statPenalty: 7, statType: 'speed' }
  },
  {
    type: 'pride',
    name: 'Kiêu Ngạo Thiên Ngoại',
    description: 'Một vị thần tiên cao ngạo xuất hiện: "Nhân loại nhỏ bé, ngươi dám so với ta?"',
    element: 'loi',
    basePower: 100,
    skills: ['pride_strike', 'divine_pressure'],
    reward: { daoType: 'alchemist_dao', points: 20 },
    failurePenalty: { qiDeviation: 30, statPenalty: 12, statType: 'crit' }
  }
];

export const DAO_LEVELS: Record<string, { pointsNeeded: number; passive: string; value: number }[]> = {
  sword_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'atk_bonus', value: 5 },        // +5% ATK
    { pointsNeeded: 150, passive: 'crit_bonus', value: 3 },      // +3% Crit
    { pointsNeeded: 350, passive: 'dmg_reduce', value: 5 },      // -5% dmg taken
    { pointsNeeded: 700, passive: 'double_strike', value: 10 },  // 10% chance extra hit
    { pointsNeeded: 1200, passive: 'sword_qi', value: 15 },      // +15% all damage
    { pointsNeeded: 2000, passive: 'sword_domain', value: 20 },  // Domain: -20% enemy speed
  ],
  soul_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'mp_regen', value: 3 },
    { pointsNeeded: 150, passive: 'dodge_bonus', value: 4 },
    { pointsNeeded: 350, passive: 'mental_resist', value: 15 },  // -15% demon damage
    { pointsNeeded: 700, passive: 'soul_shield', value: 10 },    // 10% shield on entry
    { pointsNeeded: 1200, passive: 'soul_drain', value: 5 },     // 5% HP steal
    { pointsNeeded: 2000, passive: 'soul_domain', value: 20 },   // +20% all resist
  ],
  body_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'hp_bonus', value: 50 },
    { pointsNeeded: 150, passive: 'def_bonus', value: 5 },
    { pointsNeeded: 350, passive: 'regen', value: 3 },
    { pointsNeeded: 700, passive: 'thorn', value: 8 },
    { pointsNeeded: 1200, passive: 'unyielding', value: 1 },     // survive lethal once
    { pointsNeeded: 2000, passive: 'body_domain', value: 20 },
  ],
  formation_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'craft_bonus', value: 5 },
    { pointsNeeded: 150, passive: 'enhance_bonus', value: 3 },
    { pointsNeeded: 350, passive: 'exp_bonus', value: 10 },
    { pointsNeeded: 700, passive: 'trap_chance', value: 15 },
    { pointsNeeded: 1200, passive: 'formation_mastery', value: 20 },
    { pointsNeeded: 2000, passive: 'formation_domain', value: 25 },
  ],
  alchemist_dao: [
    { pointsNeeded: 0, passive: 'none', value: 0 },
    { pointsNeeded: 50, passive: 'alchemy_bonus', value: 5 },
    { pointsNeeded: 150, passive: 'pill_bonus', value: 10 },
    { pointsNeeded: 350, passive: 'rare_chance', value: 3 },
    { pointsNeeded: 700, passive: 'auto_refine', value: 1 },
    { pointsNeeded: 1200, passive: 'master_alchemist', value: 20 },
    { pointsNeeded: 2000, passive: 'alchemy_domain', value: 25 },
  ]
};

// Trigger chance: scales with realm + qi_deviation
// Base: 5% per cultivation session
// +1% per 10 qi_deviation points
// Capped at 25%
export const TAM_MA_BASE_CHANCE = 0.05;
export const TAM_MA_QI_DEV_BONUS = 0.001;
export const TAM_MA_MAX_CHANCE = 0.25;
```

#### Service mới: `src/services/TamMaService.ts` (~400 dòng)

```typescript
import { db } from '../database/database';
import { INNER_DEMON_TYPES, DAO_LEVELS, TAM_MA_BASE_CHANCE } from '../config/tamMaConstants';
import { CombatEngine, Combatant } from './CombatEngine';
import { cacheService } from './CacheService';

class TamMaService {
  /**
   * Roll for inner demon encounter during cultivation
   * Higher qi_deviation = higher chance
   */
  maybeSummonDemon(userId: string, userLevel: number, qiDeviation: number): typeof INNER_DEMON_TYPES[0] | null {
    const chance = Math.min(
      TAM_MA_MAX_CHANCE,
      TAM_MA_BASE_CHANCE + qiDeviation * 0.001
    );
    if (Math.random() > chance) return null;

    // Weighted by realm (stronger demons at higher realms)
    const eligible = INNER_DEMON_TYPES.filter(d => d.basePower <= userLevel * 3);
    if (!eligible.length) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  /** Create demon encounter record */
  summonDemon(userId: string, demon: typeof INNER_DEMON_TYPES[0], playerPower: number): number {
    const scaledPower = Math.floor(demon.basePower * (1 + playerPower / 1000));
    const info = db.prepare(`
      INSERT INTO inner_demons (user_id, demon_type, demon_name, power)
      VALUES (?, ?, ?, ?)
    `).run(userId, demon.type, demon.name, scaledPower);
    return info.lastInsertRowid as number;
  }

  /** Build combatant from demon data */
  buildDemonCombatant(demonId: number): Combatant {
    const row = db.prepare('SELECT * FROM inner_demons WHERE id = ?').get(demonId) as any;
    const def = INNER_DEMON_TYPES.find(d => d.type === row.demon_type)!;
    return {
      name: row.demon_name,
      hp: row.power * 5,
      maxHp: row.power * 5,
      atk: row.power,
      def: Math.floor(row.power * 0.6),
      crit: 10,
      critRes: 5,
      luck: 0,
      element: def.element,
      equippedSkills: def.skills.map(s => ({
        id: s, element: def.element, level: 1, name: s
      }))
    };
  }

  /** Fight inner demon */
  fightDemon(userId: string, demonId: number, playerCombatant: Combatant): {
    victory: boolean;
    log: string[];
    daoType: string;
    daoPoints: number;
  } {
    const row = db.prepare('SELECT * FROM inner_demons WHERE id = ? AND user_id = ?')
      .get(demonId, userId) as any;
    if (!row || row.defeated) throw new Error('Demon not found or already defeated');

    const demon = this.buildDemonCombatant(demonId);
    const result = CombatEngine.run(playerCombatant, demon, null, 20);

    const def = INNER_DEMON_TYPES.find(d => d.type === row.demon_type)!;

    if (result.winner === 'player') {
      db.prepare('UPDATE inner_demons SET defeated = 1, defeated_at = ? WHERE id = ?')
        .run(Math.floor(Date.now() / 1000), demonId);

      this.addDaoPoints(userId, def.reward.daoType, def.reward.points);

      // Reduce qi_deviation on victory
      db.prepare('UPDATE users SET qi_deviation = MAX(0, qi_deviation - 10) WHERE discord_id = ?')
        .run(userId);

      return {
        victory: true,
        log: result.log,
        daoType: def.reward.daoType,
        daoPoints: def.reward.points
      };
    } else {
      // Failure: stat penalty + qi_deviation increase
      db.prepare(`
        UPDATE users SET
          qi_deviation = MIN(100, qi_deviation + ?),
          ${def.failurePenalty.statType} = MAX(1, ${def.failurePenalty.statType} - ?)
        WHERE discord_id = ?
      `).run(def.failurePenalty.qiDeviation, def.failurePenalty.statPenalty, userId);

      return {
        victory: false,
        log: result.log,
        daoType: def.reward.daoType,
        daoPoints: 0
      };
    }
  }

  /** Add dao points and check level up */
  addDaoPoints(userId: string, daoType: string, points: number): void {
    const existing = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ? AND dao_type = ?')
      .get(userId, daoType) as any;

    if (existing) {
      const newPoints = existing.points + points;
      const levels = DAO_LEVELS[daoType] || [];
      const newLevel = levels.filter(l => newPoints >= l.pointsNeeded).length;
      db.prepare('UPDATE dao_comprehension SET points = ?, level = ? WHERE id = ?')
        .run(newPoints, newLevel, existing.id);
    } else {
      const levels = DAO_LEVELS[daoType] || [];
      const newLevel = levels.filter(l => points >= l.pointsNeeded).length;
      db.prepare('INSERT INTO dao_comprehension (user_id, dao_type, points, level) VALUES (?, ?, ?, ?)')
        .run(userId, daoType, points, newLevel);
    }

    db.prepare('UPDATE users SET total_dao_points = total_dao_points + ? WHERE discord_id = ?')
      .run(points, userId);

    cacheService.invalidatePrefix(`stats:${userId}`);
  }

  /** Get all dao progress for user */
  getDaoProgress(userId: string): any[] {
    return db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId);
  }

  /** Get active demon encounters */
  getActiveDemon(userId: string): any | null {
    return db.prepare('SELECT * FROM inner_demons WHERE user_id = ? AND defeated = 0')
      .get(userId) as any;
  }

  /** Apply dao passives to combat stats */
  getDaoBonuses(userId: string): Record<string, number> {
    const rows = db.prepare('SELECT * FROM dao_comprehension WHERE user_id = ?').all(userId) as any[];
    const bonuses: Record<string, number> = {};
    for (const row of rows) {
      const levels = DAO_LEVELS[row.dao_type] || [];
      const currentLevel = levels[row.level - 1];
      if (currentLevel && currentLevel.passive !== 'none') {
        bonuses[currentLevel.passive] = (bonuses[currentLevel.passive] ?? 0) + currentLevel.value;
      }
    }
    return bonuses;
  }
}

export const tamMaService = new TamMaService();
```

#### CombatEngine Integration

Sửa `CombatEngine.ts` — sau khi load heart laws, load dao bonuses:

```typescript
// Trong CombatEngine.run(), thêm vào phần init:
if (player.userId) {
  const { tamMaService } = require('./TamMaService');
  const daoBonuses = tamMaService.getDaoBonuses(player.userId);

  // Apply dao bonuses to player stats
  if (daoBonuses.atk_bonus) player.atk = Math.floor(player.atk * (1 + daoBonuses.atk_bonus / 100));
  if (daoBonuses.crit_bonus) player.crit += daoBonuses.crit_bonus;
  if (daoBonuses.dodge_bonus) player.dodge = (player.dodge ?? 0) + daoBonuses.dodge_bonus;
  if (daoBonuses.hp_bonus) { player.maxHp += daoBonuses.hp_bonus; player.hp += daoBonuses.hp_bonus; }
  // ... etc
}
```

**Files mới**: `src/config/tamMaConstants.ts`, `src/services/TamMaService.ts`
**Files sửa**: `src/services/CombatEngine.ts`, `src/services/CultivationService.ts`, `src/events/interactionCreate.ts` (thêm tamMa actions)

**Interaction routing**: Thêm `tamMa_fight`, `tamMa_retreat` vào CultivationInteractionHandler

**Scope estimate**: ~900 dòng code mới + ~50 dòng sửa

---

### 2C. Dị hỏa + Dị thú (Rare Fires + Rare Beasts)

#### Bảng mới

```sql
-- Dị hỏa (Rare Flames)
CREATE TABLE IF NOT EXISTS rare_fires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  fire_type TEXT NOT NULL,             -- 'tam_me_hoa' | 'than_tam_ly_hoa' | 'thien_hoa' | ...
  fire_name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,     -- 1-8
  level INTEGER NOT NULL DEFAULT 1,    -- 1-100, feeds with materials
  exp INTEGER DEFAULT 0,
  equipped INTEGER DEFAULT 0,         -- 0/1 (1 active slot)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, fire_type)
);

CREATE INDEX IF NOT EXISTS idx_rarefire_user ON rare_fires(user_id, equipped);

-- Dị thú (Rare Beasts) — separate from regular pets
CREATE TABLE IF NOT EXISTS rare_beasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  beast_type TEXT NOT NULL,            -- 'kim_long' | 'bach_ho' | 'than_mac' | ...
  beast_name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'rare', -- 'rare' | 'epic' | 'legendary' | 'mythic'
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 1,            -- 1-5, evolution tier
  equipped INTEGER DEFAULT 0,         -- 0/1
  skills TEXT DEFAULT '[]',           -- JSON array of skill ids
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, beast_type)
);

CREATE INDEX IF NOT EXISTS idx_rarebeast_user ON rare_beasts(user_id, equipped);
```

#### Constants: `src/config/rareFireConstants.ts` (~250 dòng)

```typescript
export interface RareFireDef {
  type: string;
  name: string;
  tier: number;
  description: string;
  alchemyBonus: number;      // +X% success rate in alchemy
  enhanceBonus: number;      // +X% success rate in enhancement
  combatPassive: string;     // effect id
  combatValue: number;
  evolveMaterials: { itemId: string; amount: number }[];
  dropSource: string;        // 'dungeon_*' | 'world_boss' | 'craft' | 'event'
}

export const RARE_FIRES: RareFireDef[] = [
  {
    type: 'tam_me_hoa',
    name: 'Tam Muội Chân Hỏa',
    tier: 1,
    description: 'Ngọn lửa cơ bản nhất, phù hợp cho người mới',
    alchemyBonus: 5,
    enhanceBonus: 3,
    combatPassive: 'burn_chance',
    combatValue: 5,
    evolveMaterials: [{ itemId: 'material_fire_shard', amount: 10 }],
    dropSource: 'dungeon_fire_1'
  },
  {
    type: 'than_tam_ly_hoa',
    name: 'Thần Tâm Ly Hỏa',
    tier: 2,
    description: 'Lửa thanh lọc tâm thần, giúp đan dược tinh khiết hơn',
    alchemyBonus: 10,
    enhanceBonus: 5,
    combatPassive: 'burn_dmg',
    combatValue: 8,
    evolveMaterials: [{ itemId: 'material_fire_shard', amount: 25 }, { itemId: 'material_phien_ma_thach', amount: 5 }],
    dropSource: 'dungeon_fire_2'
  },
  {
    type: 'thien_hoa',
    name: 'Thiên Hỏa',
    tier: 3,
    description: 'Lửa từ trời, thiêu đốt mọi thứ',
    alchemyBonus: 15,
    enhanceBonus: 8,
    combatPassive: 'burn_aoe',
    combatValue: 12,
    evolveMaterials: [{ itemId: 'material_fire_core', amount: 10 }],
    dropSource: 'world_boss'
  },
  {
    type: 'di_hoa',
    name: 'Địa Hỏa Chi Tinh',
    tier: 4,
    description: 'Tinh hoa của lửa từ sâu trong lòng đất',
    alchemyBonus: 20,
    enhanceBonus: 12,
    combatPassive: 'burn_reduce_def',
    combatValue: 15,
    evolveMaterials: [{ itemId: 'material_fire_core', amount: 20 }, { itemId: 'material_quy_nguyen', amount: 3 }],
    dropSource: 'dungeon_fire_3'
  },
  {
    type: 'nhan_ly_hoa',
    name: 'Nhân Ly Hỏa',
    tier: 5,
    description: 'Lửa separation, tách linh khí khỏi tạp chất',
    alchemyBonus: 25,
    enhanceBonus: 15,
    combatPassive: 'burn_soul',
    combatValue: 20,
    evolveMaterials: [{ itemId: 'material_loi_phap_tinh', amount: 5 }],
    dropSource: 'nine_heavens'
  },
  {
    type: 'phap_than_hoa',
    name: 'Pháp Thần Hỏa',
    tier: 6,
    description: 'Lofire của pháp khí, tăng uy lực pháp bảo lên gấp bội',
    alchemyBonus: 30,
    enhanceBonus: 20,
    combatPassive: 'burn_true_damage',
    combatValue: 25,
    evolveMaterials: [{ itemId: 'material_loi_phap_tinh', amount: 15 }, { itemId: 'material_thien_tinh', amount: 5 }],
    dropSource: 'elite_dungeon_fire'
  },
  {
    type: 'thien_tan_hoa',
    name: 'Thiên Tàn Hỏa',
    tier: 7,
    description: 'Lofire cổ đại, được lưu truyền từ thời viễn cổ',
    alchemyBonus: 35,
    enhanceBonus: 25,
    combatPassive: 'burn_immolate',
    combatValue: 30,
    evolveMaterials: [{ itemId: 'material_thien_tinh', amount: 20 }],
    dropSource: 'seasonal_event'
  },
  {
    type: 'phan_thien_hoa',
    name: 'Phản Thiên Hỏa',
    tier: 8,
    description: 'Lửa phản nghịch thiên đạo, cực kỳ hiếm và nguy hiểm',
    alchemyBonus: 45,
    enhanceBonus: 35,
    combatPassive: 'burn_annihilation',
    combatValue: 40,
    evolveMaterials: [{ itemId: 'material_loi_phap_tinh', amount: 30 }, { itemId: 'material_thien_tinh', amount: 15 }],
    dropSource: 'ultimate_dungeon'
  }
];
```

#### Constants: `src/config/rareBeastConstants.ts` (~300 dòng)

```typescript
export interface RareBeastDef {
  type: string;
  name: string;
  rarity: 'rare' | 'epic' | 'legendary' | 'mythic';
  element: string;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  passiveSkill: string;
  passiveDescription: string;
  evolveBonus: { atk: number; def: number; hp: number }[];
  tamingSource: string;
  tamingRate: number;
}

export const RARE_BEASTS: RareBeastDef[] = [
  {
    type: 'kim_long',
    name: 'Kim Long (Kim)',
    rarity: 'rare',
    element: 'tho',
    baseAtk: 30, baseDef: 40, baseHp: 200,
    passiveSkill: 'metal_resist',
    passiveDescription: '+10% kháng sát thương kim',
    evolveBonus: [
      { atk: 5, def: 8, hp: 40 },
      { atk: 10, def: 15, hp: 80 },
      { atk: 18, def: 25, hp: 150 },
      { atk: 30, def: 40, hp: 250 },
      { atk: 50, def: 60, hp: 400 }
    ],
    tamingSource: 'dungeon_metal',
    tamingRate: 0.15
  },
  {
    type: 'bach_ho',
    name: 'Bạch Hổ (Kim)',
    rarity: 'epic',
    element: 'tho',
    baseAtk: 50, baseDef: 35, baseHp: 180,
    passiveSkill: 'crit_hunt',
    passiveDescription: '+8% crit khi HP敌人 < 30%',
    evolveBonus: [
      { atk: 10, def: 6, hp: 35 },
      { atk: 20, def: 12, hp: 70 },
      { atk: 35, def: 22, hp: 130 },
      { atk: 55, def: 35, hp: 220 },
      { atk: 80, def: 55, hp: 350 }
    ],
    tamingSource: 'dungeon_metal_2',
    tamingRate: 0.08
  },
  {
    type: 'than_mac',
    name: 'Thần Mã',
    rarity: 'legendary',
    element: 'phong',
    baseAtk: 40, baseDef: 30, baseHp: 250,
    passiveSkill: 'speed_surge',
    passiveDescription: '+15% speed, +5% dodge',
    evolveBonus: [
      { atk: 8, def: 5, hp: 50 },
      { atk: 15, def: 10, hp: 100 },
      { atk: 28, def: 18, hp: 180 },
      { atk: 45, def: 30, hp: 300 },
      { atk: 70, def: 50, hp: 500 }
    ],
    tamingSource: 'world_boss_legendary',
    tamingRate: 0.03
  },
  {
    type: 'lac_hong',
    name: 'Lạc Hồng',
    rarity: 'mythic',
    element: 'hoa',
    baseAtk: 60, baseDef: 45, baseHp: 300,
    passiveSkill: 'phoenix_flame',
    passiveDescription: '+20% fire damage, revive once per battle at 15% HP',
    evolveBonus: [
      { atk: 12, def: 9, hp: 60 },
      { atk: 25, def: 18, hp: 120 },
      { atk: 45, def: 30, hp: 220 },
      { atk: 70, def: 50, hp: 380 },
      { atk: 100, def: 75, hp: 600 }
    ],
    tamingSource: 'ultimate_dungeon',
    tamingRate: 0.01
  },
  // ... 6-8 more beasts covering all elements
];
```

#### Service mới: `src/services/RareFireService.ts` (~350 dòng)

```typescript
import { db } from '../database/database';
import { RARE_FIRES } from '../config/rareFireConstants';
import { cacheService } from './CacheService';

class RareFireService {
  /**
   * Equip a rare fire (max 1 active slot)
   */
  equip(userId: string, fireType: string): boolean {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType) as any;
    if (!fire) return false;

    // Unequip current
    db.prepare('UPDATE rare_fires SET equipped = 0 WHERE user_id = ? AND equipped = 1').run(userId);
    // Equip new
    db.prepare('UPDATE rare_fires SET equipped = 1 WHERE id = ?').run(fire.id);

    cacheService.invalidatePrefix(`stats:${userId}`);
    return true;
  }

  /**
   * Get equipped fire's alchemy/enhance bonus
   */
  getEquippedBonus(userId: string): { alchemyBonus: number; enhanceBonus: number; combatPassive: string; combatValue: number } {
    const cached = cacheService.get(`rarefire_bonus:${userId}`);
    if (cached) return cached;

    const fire = db.prepare(`
      SELECT rf.*, rf.level
      FROM rare_fires rf
      WHERE rf.user_id = ? AND rf.equipped = 1
    `).get(userId) as any;

    if (!fire) {
      const empty = { alchemyBonus: 0, enhanceBonus: 0, combatPassive: '', combatValue: 0 };
      cacheService.set(`rarefire_bonus:${userId}`, empty, 30_000);
      return empty;
    }

    const def = RARE_FIRES.find(f => f.type === fire.fire_type)!;
    const levelMult = 1 + (fire.level - 1) * 0.02; // +2% per level
    const result = {
      alchemyBonus: Math.floor(def.alchemyBonus * levelMult),
      enhanceBonus: Math.floor(def.enhanceBonus * levelMult),
      combatPassive: def.combatPassive,
      combatValue: Math.floor(def.combatValue * levelMult)
    };

    cacheService.set(`rarefire_bonus:${userId}`, result, 30_000);
    return result;
  }

  /**
   * Feed fire with materials to level up
   */
  feed(userId: string, fireType: string, materialId: string, amount: number): { success: boolean; newLevel: number } {
    const fire = db.prepare('SELECT * FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType) as any;
    if (!fire) return { success: false, newLevel: 0 };

    const expPerMaterial = 10;
    const newExp = fire.exp + amount * expPerMaterial;
    const expNeeded = fire.level * 50; // scales with level

    if (newExp >= expNeeded && fire.level < 100) {
      const newLevel = fire.level + 1;
      db.prepare('UPDATE rare_fires SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - expNeeded, fire.id);
      cacheService.invalidatePrefix(`rarefire_bonus:${userId}`);
      return { success: true, newLevel };
    }

    db.prepare('UPDATE rare_fires SET exp = ? WHERE id = ?').run(newExp, fire.id);
    return { success: false, newLevel: fire.level };
  }

  /**
   * Get all fires owned by user
   */
  getUserFires(userId: string): any[] {
    return db.prepare('SELECT * FROM rare_fires WHERE user_id = ? ORDER BY tier DESC').all(userId);
  }

  /**
   * Add fire drop (from dungeon/boss)
   */
  addFire(userId: string, fireType: string): boolean {
    const def = RARE_FIRES.find(f => f.type === fireType);
    if (!def) return false;

    const existing = db.prepare('SELECT id FROM rare_fires WHERE user_id = ? AND fire_type = ?')
      .get(userId, fireType);
    if (existing) return false; // Already owned

    db.prepare(`
      INSERT INTO rare_fires (user_id, fire_type, fire_name, tier)
      VALUES (?, ?, ?, ?)
    `).run(userId, fireType, def.name, def.tier);
    return true;
  }
}

export const rareFireService = new RareFireService();
```

#### Service mới: `src/services/RareBeastService.ts` (~380 dòng)

```typescript
import { db } from '../database/database';
import { RARE_BEASTS } from '../config/rareBeastConstants';
import { cacheService } from './CacheService';

class RareBeastService {
  /**
   * Try to tame a rare beast after dungeon/boss fight
   */
  attemptTame(userId: string, beastType: string, luckBonus: number): { success: boolean; beast?: any } {
    const def = RARE_BEASTS.find(b => b.type === beastType);
    if (!def) return { success: false };

    const existing = db.prepare('SELECT id FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType);
    if (existing) return { success: false }; // Already owned

    const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
    if (Math.random() > rate) return { success: false };

    const info = db.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, element, level, skills)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(userId, beastType, def.name, def.rarity, def.element,
      JSON.stringify([def.passiveSkill]));

    return { success: true, beast: { id: info.lastInsertRowid, ...def } };
  }

  /**
   * Equip beast (max 1, separate from regular pets)
   */
  equip(userId: string, beastType: string): boolean {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return false;

    db.prepare('UPDATE rare_beasts SET equipped = 0 WHERE user_id = ? AND equipped = 1').run(userId);
    db.prepare('UPDATE rare_beasts SET equipped = 1 WHERE id = ?').run(beast.id);
    cacheService.invalidatePrefix(`stats:${userId}`);
    return true;
  }

  /**
   * Get equipped beast's combat bonuses
   */
  getEquippedBonuses(userId: string): { atk: number; def: number; hp: number; passive: string; passiveValue: number } {
    const cached = cacheService.get(`rarebeast_bonus:${userId}`);
    if (cached) return cached;

    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1')
      .get(userId) as any;

    if (!beast) {
      const empty = { atk: 0, def: 0, hp: 0, passive: '', passiveValue: 0 };
      cacheService.set(`rarebeast_bonus:${userId}`, empty, 30_000);
      return empty;
    }

    const def = RARE_BEASTS.find(b => b.type === beast.beast_type)!;
    const starIdx = Math.min(beast.stars - 1, def.evolveBonus.length - 1);
    const evolveBonus = def.evolveBonus[starIdx] || { atk: 0, def: 0, hp: 0 };
    const levelMult = 1 + (beast.level - 1) * 0.015;

    const result = {
      atk: Math.floor((def.baseAtk + evolveBonus.atk) * levelMult),
      def: Math.floor((def.baseDef + evolveBonus.def) * levelMult),
      hp: Math.floor((def.baseHp + evolveBonus.hp) * levelMult),
      passive: def.passiveSkill,
      passiveValue: def.evolveBonus.length // tier strength
    };

    cacheService.set(`rarebeast_bonus:${userId}`, result, 30_000);
    return result;
  }

  /**
   * Evolve beast with materials
   */
  evolve(userId: string, beastType: string): { success: boolean; newStars: number } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast || beast.stars >= 5) return { success: false, newStars: beast?.stars ?? 0 };

    // Evolution materials checked externally before calling this
    const newStars = beast.stars + 1;
    db.prepare('UPDATE rare_beasts SET stars = ? WHERE id = ?').run(newStars, beast.id);
    cacheService.invalidatePrefix(`rarebeast_bonus:${userId}`);
    return { success: true, newStars };
  }

  /**
   * Feed beast EXP (from battles)
   */
  feedExp(userId: string, beastType: string, exp: number): { levelUp: boolean; newLevel: number } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return { levelUp: false, newLevel: 0 };

    const newExp = beast.exp + exp;
    const needed = beast.level * 100;

    if (newExp >= needed) {
      const newLevel = beast.level + 1;
      db.prepare('UPDATE rare_beasts SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - needed, beast.id);
      cacheService.invalidatePrefix(`rarebeast_bonus:${userId}`);
      return { levelUp: true, newLevel };
    }

    db.prepare('UPDATE rare_beasts SET exp = ? WHERE id = ?').run(newExp, beast.id);
    return { levelUp: false, newLevel: beast.level };
  }

  getUserBeasts(userId: string): any[] {
    return db.prepare('SELECT * FROM rare_beasts WHERE user_id = ?').all(userId);
  }
}

export const rareBeastService = new RareBeastService();
```

#### Integration Points

- `AlchemyService.ts`: Thêm `rareFireService.getEquippedBonus(userId).alchemyBonus` vào success rate calc
- `EnhanceService.ts`: Thêm `rareFireService.getEquippedBonus(userId).enhanceBonus` vào success rate
- `CombatEngine.ts`: Thêm `rareBeastService.getEquippedBonuses(userId)` và rare fire combat passive
- `CombatService.challengeWorldBoss()`: Thêm rare beast taming chance after kill
- `EliteDungeonService`: Thêm rare fire drops from elite dungeons

**Interaction routing**: Thêm `rarefire_equip`, `rarefire_feed`, `rarebeast_equip`, `rarebeast_evolve` vào NavigationInteractionHandler

**Files mới**:
- `src/config/rareFireConstants.ts` (~250 dòng)
- `src/config/rareBeastConstants.ts` (~300 dòng)
- `src/services/RareFireService.ts` (~350 dòng)
- `src/services/RareBeastService.ts` (~380 dòng)

**Files sửa**:
- `src/services/AlchemyService.ts` (~10 dòng)
- `src/services/EnhanceService.ts` (~10 dòng)
- `src/services/CombatEngine.ts` (~30 dòng)
- `src/services/CombatService.ts` (~20 dòng)
- `src/config/itemConstants.ts` (~30 dòng — thêm rare fire materials)

**Scope estimate**: ~1,700 dòng code mới + ~70 dòng sửa

---

### 2D. Đấu Trường Xếp Hạng (Ranked Arena Rework)

#### Bảng mới + sửa

```sql
-- Mở rộng arena_profiles
ALTER TABLE arena_profiles ADD COLUMN season_wins INTEGER DEFAULT 0;
ALTER TABLE arena_profiles ADD COLUMN season_losses INTEGER DEFAULT 0;
ALTER TABLE arena_profiles ADD COLUMN season_rank TEXT DEFAULT 'bronze';
ALTER TABLE arena_profiles ADD COLUMN win_streak INTEGER DEFAULT 0;
ALTER TABLE arena_profiles ADD COLUMN highest_streak INTEGER DEFAULT 0;
ALTER TABLE arena_profiles ADD COLUMN daily_wins INTEGER DEFAULT 0;
ALTER TABLE arena_profiles ADD COLUMN daily_reset_at INTEGER DEFAULT 0;

-- Bảng season mới
CREATE TABLE IF NOT EXISTS ranked_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT DEFAULT 'active'   -- 'active' | 'ended'
);

CREATE INDEX IF NOT EXISTS idx_ranked_season ON ranked_seasons(status);

-- Bảng phần thưởng season
CREATE TABLE IF NOT EXISTS ranked_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES ranked_seasons(id),
  rank_tier TEXT NOT NULL,       -- 'gold' | 'silver' | 'bronze' | 'participation'
  min_rank INTEGER NOT NULL,
  max_rank INTEGER NOT NULL,
  rewards_json TEXT NOT NULL,    -- { items: [], currencies: {}, titles: [] }
  claimed INTEGER DEFAULT 0,
  user_id TEXT REFERENCES users(discord_id)
);

CREATE INDEX IF NOT EXISTS idx_ranked_reward_season ON ranked_rewards(season_id, user_id);

-- Bảng match history mở rộng
ALTER TABLE arena_history ADD COLUMN season_id INTEGER;
ALTER TABLE arena_history ADD COLUMN damage_log TEXT;  -- JSON: [{round, attacker, damage, skill}]
ALTER TABLE arena_history ADD COLUMN spectator_count INTEGER DEFAULT 0;

-- Spectator viewing
CREATE TABLE IF NOT EXISTS arena_spectators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  viewer_id TEXT NOT NULL REFERENCES users(discord_id),
  joined_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_spectator_match ON arena_spectators(match_id);
```

#### Constants: `src/config/arenaConstants.ts` (~120 dòng)

```typescript
export const RANK_TIERS = {
  gold:   { minElo: 1600, color: '#FFD700', name: 'Hạng Vàng',   rewards: { ngotinh: 500, coins: 10000, title: 'Vàng Đấu Trường' } },
  silver: { minElo: 1300, color: '#C0C0C0', name: 'Hạng Bạc',   rewards: { ngotinh: 300, coins: 5000, title: 'Bạc Đấu Trường' } },
  bronze: { minElo: 1000, color: '#CD7F32', name: 'Hạng Đồng',   rewards: { ngotinh: 150, coins: 2000, title: 'Đồng Đấu Trường' } },
  iron:   { minElo: 0,    color: '#808080', name: 'Hạng Sắt',    rewards: { ngotinh: 50, coins: 500 } }
} as const;

export const STREAK_BONUSES = [
  { streak: 3,  bonus: 1.1 },
  { streak: 5,  bonus: 1.25 },
  { streak: 10, bonus: 1.5 },
  { streak: 15, bonus: 2.0 },
  { streak: 20, bonus: 3.0 }
] as const;

export const DAILY_ARENA_LIMIT = 20;
export const SEASON_DURATION_DAYS = 14;
export const K_FACTOR = 32;
export const STARTING_ELO = 1000;
export const MIN_ELO_GAIN = 5;
export const MAX_ELO_LOSS = 5;
```

#### Service mới: `src/services/RankedArenaService.ts` (~400 dòng)

```typescript
import { db } from '../database/database';
import { RANK_TIERS, STREAK_BONUSES, DAILY_ARENA_LIMIT, K_FACTOR, STARTING_ELO } from '../config/arenaConstants';

class RankedArenaService {
  /**
   * Get or create arena profile
   */
  getProfile(userId: string): any {
    let profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId) as any;
    if (!profile) {
      db.prepare(`
        INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak, season_wins, season_losses, daily_wins, daily_reset_at)
        VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0)
      `).run(userId, STARTING_ELO);
      profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
    }

    // Daily reset
    const today = new Date().toISOString().split('T')[0];
    const todayTs = Math.floor(new Date(today).getTime() / 1000);
    if (profile.daily_reset_at < todayTs) {
      db.prepare('UPDATE arena_profiles SET daily_wins = 0, daily_reset_at = ? WHERE user_id = ?')
        .run(todayTs, userId);
      profile.daily_wins = 0;
    }

    return profile;
  }

  /**
   * Calculate win streak bonus multiplier
   */
  getStreakMultiplier(streak: number): number {
    let mult = 1.0;
    for (const s of STREAK_BONUSES) {
      if (streak >= s.streak) mult = s.bonus;
    }
    return mult;
  }

  /**
   * Get rank tier from ELO
   */
  getRankTier(elo: number): string {
    if (elo >= RANK_TIERS.gold.minElo) return 'gold';
    if (elo >= RANK_TIERS.silver.minElo) return 'silver';
    if (elo >= RANK_TIERS.bronze.minElo) return 'bronze';
    return 'iron';
  }

  /**
   * Update ELO after match
   */
  updateElo(winnerId: string, loserId: string): { winnerGain: number; loserLoss: number } {
    const winner = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(winnerId) as any;
    const loser = db.prepare('SELECT elo FROM arena_profiles WHERE user_id = ?').get(loserId) as any;

    const expectedWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
    const expectedLoser = 1 - expectedWinner;

    const winnerGain = Math.max(5, Math.round(K_FACTOR * (1 - expectedWinner)));
    const loserLoss = Math.min(-5, Math.round(K_FACTOR * (0 - expectedLoser)));

    db.prepare('UPDATE arena_profiles SET elo = elo + ?, wins = wins + 1, season_wins = season_wins + 1, win_streak = win_streak + 1, highest_streak = MAX(highest_streak, win_streak + 1) WHERE user_id = ?')
      .run(winnerGain, winnerId);
    db.prepare('UPDATE arena_profiles SET elo = elo + ?, losses = losses + 1, season_losses = season_losses + 1, win_streak = 0 WHERE user_id = ?')
      .run(loserLoss, loserId);

    return { winnerGain, loserLoss: Math.abs(loserLoss) };
  }

  /**
   * Check daily limit
   */
  canFight(userId: string): boolean {
    const profile = this.getProfile(userId);
    return profile.daily_wins < DAILY_ARENA_LIMIT;
  }

  /**
   * Get leaderboard for current season
   */
  getLeaderboard(limit = 10): any[] {
    return db.prepare(`
      SELECT ap.*, u.ten_nhan_vat, u.realm_index
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      ORDER BY ap.elo DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * End season: calculate final rankings, distribute rewards, soft-reset ELO
   */
  endSeason(): void {
    const activeSeason = db.prepare('SELECT * FROM ranked_seasons WHERE status = ?').get('active') as any;
    if (!activeSeason) return;

    // Final rankings
    const profiles = db.prepare(`
      SELECT ap.*, u.ten_nhan_vat
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      WHERE ap.season_wins + ap.season_losses > 0
      ORDER BY ap.elo DESC
    `).all() as any[];

    profiles.forEach((p, idx) => {
      const rank = idx + 1;
      const tier = this.getRankTier(p.elo);
      const tierDef = RANK_TIERS[tier as keyof typeof RANK_TIERS];

      // Award rewards
      db.prepare('UPDATE users SET ngotinh = ngotinh + ?, coins = coins + ? WHERE discord_id = ?')
        .run(tierDef.rewards.ngotinh, tierDef.rewards.coins, p.user_id);

      if (tierDef.rewards.title) {
        db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title) VALUES (?, ?)')
          .run(p.user_id, tierDef.rewards.title);
      }

      // Soft reset ELO
      const newElo = Math.round((p.elo + STARTING_ELO) / 2);
      db.prepare('UPDATE arena_profiles SET elo = ?, season_wins = 0, season_losses = 0 WHERE user_id = ?')
        .run(newElo, p.user_id);
    });

    // End season record
    db.prepare('UPDATE ranked_seasons SET status = ?, ended_at = ? WHERE id = ?')
      .ended('ended', Math.floor(Date.now() / 1000), activeSeason.id);

    // Start new season
    const nextNum = (activeSeason.season_number || 0) + 1;
    db.prepare('INSERT INTO ranked_seasons (season_number, name, started_at, status) VALUES (?, ?, ?, ?)')
      .run(nextNum, `Season ${nextNum}`, Math.floor(Date.now() / 1000), 'active');
  }
}

export const rankedArenaService = new RankedArenaService();
```

**Files mới**:
- `src/config/arenaConstants.ts` (~120 dòng)
- `src/services/RankedArenaService.ts` (~400 dòng)

**Files sửa**:
- `src/services/ArenaService.ts` — refactor dùng RankedArenaService cho ELO logic
- `src/commands/combat/arena.ts` — thêm rank display, streak info, daily limit
- CronManager: thêm scheduled season end (mỗi 14 ngày)

**Interaction routing**: Thêm `arena_ranked`, `arena_streak`, `arena_rewards_claim` vào CombatInteractionHandler

**Scope estimate**: ~700 dòng code mới + ~150 dòng sửa

---

### 2E. Thế Giới Boss Nâng Cấp (World Boss Rework)

#### Bảng sửa

```sql
-- Mở rộng world_boss
ALTER TABLE world_boss ADD COLUMN phase INTEGER DEFAULT 1;
ALTER TABLE world_boss ADD COLUMN max_phases INTEGER DEFAULT 3;
ALTER TABLE world_boss ADD COLUMN abilities_json TEXT DEFAULT '[]';
ALTER TABLE world_boss ADD COLUMN weakness_rotation TEXT DEFAULT '[]';  -- JSON array of elements
ALTER TABLE world_boss ADD COLUMN current_weakness TEXT;

-- Mở rộng world_boss_contributions
ALTER TABLE world_boss_contributions ADD COLUMN phase_damages TEXT DEFAULT '{}'; -- JSON {1: dmg, 2: dmg, 3: dmg}
ALTER TABLE world_boss_contributions ADD COLUMN mvp_score INTEGER DEFAULT 0;
ALTER TABLE world_boss_contributions ADD COLUMN last_hit INTEGER DEFAULT 0;

-- Bảng guild boss tracking
CREATE TABLE IF NOT EXISTS boss_guild_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_id INTEGER NOT NULL,
  sect_id INTEGER NOT NULL,
  total_damage INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(boss_id, sect_id)
);

CREATE INDEX IF NOT EXISTS idx_boss_guild ON boss_guild_contributions(boss_id);
```

#### Constants: `src/config/worldBossReworkConstants.ts` (~200 dòng)

```typescript
export interface BossPhase {
  phase: number;
  hpThreshold: number;        // % of max HP to trigger
  name: string;
  abilities: BossAbility[];
  weakness: string;           // element
  statMultiplier: { atk: number; def: number; spd: number };
}

export interface BossAbility {
  id: string;
  name: string;
  type: 'aoe' | 'single' | 'debuff' | 'heal';
  power: number;
  cooldown: number;           // rounds between uses
  description: string;
}

export interface RewardTier {
  tier: 'mvp' | 'last_hit' | 'top3' | 'top10' | 'milestone' | 'participation';
  condition: string;
  rewards: { ngotinh: number; coins: number; items?: { id: string; amount: number }[] };
}

export const BOSS_PHASES: BossPhase[] = [
  {
    phase: 1,
    hpThreshold: 100,
    name: 'Giai Đoạn 1 — Ủng hộ',
    abilities: [
      { id: 'basic_strike', name: 'Đánh thường', type: 'single', power: 1.0, cooldown: 0, description: 'Đánh thường vào mục tiêu' }
    ],
    weakness: 'hoa',
    statMultiplier: { atk: 1.0, def: 1.0, spd: 1.0 }
  },
  {
    phase: 2,
    hpThreshold: 60,
    name: 'Giai Đoạn 2 — Phẫn nộ',
    abilities: [
      { id: 'fury_strike', name: 'Phẫn Nộ Quyền', type: 'aoe', power: 1.5, cooldown: 2, description: 'AOE damage lớn, tất cả player nhận sát thương' },
      { id: 'weaken', name: 'Yếu Đuối', type: 'debuff', power: 0.3, cooldown: 3, description: '-30% ATK cho player trong 2 round' }
    ],
    weakness: 'thuy',
    statMultiplier: { atk: 1.3, def: 1.1, spd: 1.2 }
  },
  {
    phase: 3,
    hpThreshold: 25,
    name: 'Giai Đoạn 3 — Tuyệt Vọng',
    abilities: [
      { id: 'devastation', name: 'Hủy Diệt', type: 'aoe', power: 2.0, cooldown: 3, description: 'Sát thương cực lớn, có thể kill player' },
      { id: 'regenerate', name: 'Hồi Sinh', type: 'heal', power: 0.15, cooldown: 4, description: 'Hồi 15% HP' },
      { id: 'berserk', name: 'Cuồng Chiến', type: 'debuff', power: 0.5, cooldown: 5, description: '+50% ATK, -30% DEF' }
    ],
    weakness: 'loi',
    statMultiplier: { atk: 1.6, def: 0.8, spd: 1.5 }
  }
];

export const BOSS_REWARDS: RewardTier[] = [
  {
    tier: 'mvp',
    condition: 'highest_damage_dealt',
    rewards: { ngotinh: 200, coins: 5000, items: [{ id: 'item_rare_fire_shard', amount: 3 }] }
  },
  {
    tier: 'last_hit',
    condition: 'final_blow',
    rewards: { ngotinh: 100, coins: 3000, items: [{ id: 'item_rare_fire_shard', amount: 2 }] }
  },
  {
    tier: 'top3',
    condition: 'rank_2_3',
    rewards: { ngotinh: 150, coins: 3000, items: [{ id: 'item_rare_fire_shard', amount: 1 }] }
  },
  {
    tier: 'top10',
    condition: 'rank_4_10',
    rewards: { ngotinh: 100, coins: 2000 }
  },
  {
    tier: 'milestone',
    condition: 'damage_1_percent',
    rewards: { ngotinh: 50, coins: 1000 }
  },
  {
    tier: 'participation',
    condition: 'attacked_once',
    rewards: { ngotinh: 20, coins: 500 }
  }
];

export const BOSS_COUNTER_BONUS = 1.5; // 50% extra damage when using correct element
```

#### Service mới: `src/services/WorldBossReworkService.ts` (~350 dòng)

```typescript
import { db } from '../database/database';
import { BOSS_PHASES, BOSS_REWARDS, BOSS_COUNTER_BONUS } from '../config/worldBossReworkConstants';

class WorldBossReworkService {
  /**
   * Check if boss should transition to next phase
   */
  checkPhaseTransition(bossId: number): boolean {
    const boss = db.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId) as any;
    if (!boss) return false;

    const hpPercent = (boss.hp / boss.max_hp) * 100;
    const currentPhase = boss.phase || 1;

    for (const phase of BOSS_PHASES) {
      if (phase.phase > currentPhase && hpPercent <= phase.hpThreshold) {
        // Phase transition!
        db.prepare(`
          UPDATE world_boss SET phase = ?, current_weakness = ?,
            atk = CAST(atk * ? AS INTEGER),
            def = CAST(def * ? AS INTEGER)
          WHERE id = ?
        `).run(phase.phase, phase.weakness,
          phase.statMultiplier.atk, phase.statMultiplier.def, bossId);

        return true;
      }
    }
    return false;
  }

  /**
   * Calculate damage with element counter bonus
   */
  calculateDamageWithCounter(
    baseDamage: number,
    playerElement: string,
    bossWeakness: string,
    playerUsedSkillElement: string
  ): number {
    if (playerUsedSkillElement === bossWeakness || playerElement === bossWeakness) {
      return Math.floor(baseDamage * BOSS_COUNTER_BONUS);
    }
    return baseDamage;
  }

  /**
   * Track phase-specific damage for MVP calculation
   */
  recordPhaseDamage(userId: string, bossId: number, phase: number, damage: number): void {
    const contrib = db.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
      .get(userId, bossId) as any;
    if (!contrib) return;

    const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
    phaseDmg[phase] = (phaseDmg[phase] || 0) + damage;
    const mvpScore = Object.values(phaseDmg).reduce((s: number, v: any) => s + v, 0) as number;

    db.prepare('UPDATE world_boss_contributions SET phase_damages = ?, mvp_score = ? WHERE user_id = ? AND boss_id = ?')
      .run(JSON.stringify(phaseDmg), mvpScore, userId, bossId);
  }

  /**
   * Calculate MVP score (weighted: phase 1 = 1x, phase 2 = 1.5x, phase 3 = 2x)
   */
  getMVPScore(userId: string, bossId: number): number {
    const contrib = db.prepare('SELECT * FROM world_boss_contributions WHERE user_id = ? AND boss_id = ?')
      .get(userId, bossId) as any;
    if (!contrib) return 0;

    const phaseDmg = JSON.parse(contrib.phase_damages || '{}');
    return (phaseDmg[1] || 0) * 1.0 +
           (phaseDmg[2] || 0) * 1.5 +
           (phaseDmg[3] || 0) * 2.0;
  }

  /**
   * Distribute rewards after boss death
   */
  async distributeRewards(bossId: number, finalBlowerId: string): Promise<void> {
    const contributions = db.prepare(`
      SELECT c.*, u.ten_nhan_vat, u.sect_id
      FROM world_boss_contributions c
      JOIN users u ON c.user_id = u.discord_id
      WHERE c.boss_id = ?
      ORDER BY c.mvp_score DESC
    `).all(bossId) as any[];

    const guildDmg: Record<number, { damage: number; count: number }> = {};

    for (let i = 0; i < contributions.length; i++) {
      const c = contributions[i];
      const rank = i + 1;

      // Collect guild data
      if (c.sect_id) {
        if (!guildDmg[c.sect_id]) guildDmg[c.sect_id] = { damage: 0, count: 0 };
        guildDmg[c.sect_id].damage += c.total_damage;
        guildDmg[c.sect_id].count++;
      }

      let rewards = { ngotinh: 20, coins: 500 };
      let rewardTier = 'participation';

      // Determine reward tier
      if (c.user_id === finalBlowerId) {
        rewards = BOSS_REWARDS.find(r => r.tier === 'last_hit')!.rewards;
        rewardTier = 'last_hit';
      } else if (rank === 1) {
        rewards = BOSS_REWARDS.find(r => r.tier === 'mvp')!.rewards;
        rewardTier = 'mvp';
      } else if (rank <= 3) {
        rewards = BOSS_REWARDS.find(r => r.tier === 'top3')!.rewards;
        rewardTier = 'top3';
      } else if (rank <= 10) {
        rewards = BOSS_REWARDS.find(r => r.tier === 'top10')!.rewards;
        rewardTier = 'top10';
      } else if (c.total_damage >= 100) {
        rewards = BOSS_REWARDS.find(r => r.tier === 'milestone')!.rewards;
        rewardTier = 'milestone';
      }

      // Apply rewards
      db.prepare('UPDATE users SET ngotinh = ngotinh + ?, coins = coins + ? WHERE discord_id = ?')
        .run(rewards.ngotinh, rewards.coins, c.user_id);

      // Item rewards
      if ('items' in rewards && rewards.items) {
        for (const item of rewards.items) {
          db.prepare('INSERT INTO inventories (user_id, item_id, quantity) VALUES (?, ?, ?)')
            .run(c.user_id, item.id, item.amount);
        }
      }

      // Record reward claim
      db.prepare(`
        INSERT INTO boss_attack_log (boss_id, user_id, damage, reward_tier, log_data)
        VALUES (?, ?, ?, ?, ?)
      `).run(bossId, c.user_id, c.total_damage, rewardTier, JSON.stringify(rewards));
    }

    // Guild rewards
    for (const [sectId, data] of Object.entries(guildDmg)) {
      db.prepare(`
        INSERT OR REPLACE INTO boss_guild_contributions (boss_id, sect_id, total_damage, member_count)
        VALUES (?, ?, ?, ?)
      `).run(bossId, parseInt(sectId), data.damage, data.count);

      // Guild bonus: 10% of total damage as guild funds
      const guildBonus = Math.floor(data.damage * 0.1);
      db.prepare('UPDATE sects SET funds = funds + ? WHERE id = ?')
        .run(guildBonus, parseInt(sectId));
    }
  }

  /**
   * Get current boss info for display
   */
  getBossInfo(bossId: number): any {
    const boss = db.prepare('SELECT * FROM world_boss WHERE id = ?').get(bossId) as any;
    if (!boss) return null;

    const phase = BOSS_PHASES.find(p => p.phase === (boss.phase || 1)) || BOSS_PHASES[0];
    return {
      ...boss,
      phaseInfo: phase,
      hpPercent: Math.round((boss.hp / boss.max_hp) * 100),
      nextPhaseThreshold: BOSS_PHASES.find(p => p.phase === (boss.phase || 1) + 1)?.hpThreshold ?? 0
    };
  }
}

export const worldBossReworkService = new WorldBossReworkService();
```

**Files mới**:
- `src/config/worldBossReworkConstants.ts` (~200 dòng)
- `src/services/WorldBossReworkService.ts` (~350 dòng)

**Files sửa**:
- `src/services/CombatService.ts` — gọi worldBossReworkService.checkPhaseTransition() sau mỗi hit, dùng calculateDamageWithCounter()
- `src/services/BossSpawnService.ts` — thêm phase init khi spawn boss mới
- `src/commands/combat/worldboss.ts` — hiển thị phase info, weakness, element counter indicator

**Scope estimate**: ~700 dòng code mới + ~100 dòng sửa

---

## PHẦN 3: BALANCE REWORK

### 3A. Stat Formula Overwrite

**File sửa**: `src/services/CombatEngine.ts`

```
Công thức hiện tại:
  defRatio = enemyDef / (playerAtk + enemyDef)
  reduction = min(0.80, defRatio)
  baseDamage = max(1, playerAtk * (1 - reduction))
  baseDamage *= (0.9 + random * 0.2)

Công thức mới:
  defRatio = enemyDef / (playerAtk * 0.7 + enemyDef)  // Giảm weight DEF
  reduction = min(0.70, defRatio)                       // Cap giảm từ 80% → 70%
  baseDamage = max(1, playerAtk * (1 - reduction))
  baseDamage *= (0.95 + random * 0.1)                  // Variance giảm từ 20% → 5%
```

**File sửa**: `src/config/gameConstants.ts`

```typescript
DAMAGE_DEF_RATIO_ATK_MULT: 0.7,       // NEW
DAMAGE_REDUCTION_CAP: 0.70,            // WAS: implicit 0.80
DAMAGE_VARIANCE_LOW: 0.95,            // WAS: 0.9
DAMAGE_VARIANCE_HIGH: 0.1,            // WAS: 0.2
```

### 3B. Linh Can RNG Fix

**File sửa**: `src/database/database.ts` (seedLinhsCan function hoặc wherever linh can generated)

```
Phân phối hiện tại (giả định):
  5% single element (100%)
  85% multi-element (40-60/20-30/5-15)
  10% mixed

Phân phối mới:
  15% single element (≥80%)
  50% dual element (50/30ish)
  25% triple element (40/30/20ish)
  10% quad+ (30/25/20/15ish)
```

### 3C. Enhancement Destruction

**File sửa**: `src/config/gameConstants.ts`

```typescript
ENHANCE_DESTRUCTION_CHANCE: 0.05,  // WAS: 0.15 (15% → 5%)
// Alternative: progressive destruction
// level 1-5: 2%, level 6-10: 5%, level 11-15: 10%, level 16-20: 15%
```

**File sửa**: `src/services/EnhanceService.ts` — dùng progressive rate thay vì flat rate

### 3D. Economy Rebalance

**File sửa**: `src/config/gameConstants.ts`

```typescript
// Sink increases
SECT_CREATE_COST_LT: 800,           // WAS: 500
MARKET_TAX_RATE: 0.10,              // NEW: 10% tax on market sales
ENHANCE_COST_LT_PER_LEVEL: 150,     // WAS: 100 (tăng chi phí cường hóa)

// Source decreases
WORLD_BOSS_NGOTINH_PER_ATTACK: 2,   // WAS: 3
DAILY_QUEST_BASE_REWARD: 30,        // WAS: 50 (nếu hiện tại là 50)
WORK_COIN_REDUCTION: 0.8,           // 20% less coins from work

// Catch-up mechanics
NEW_PLAYER_EXP_BONUS_HOURS: 48,     // Double EXP trong 48h đầu
NEW_PLAYER_DROP_RATE_BONUS: 1.5,    // 50% more drops trong 48h đầu
```

---

## PHẦN 4: UI MIGRATION TO NATIVE V2

### 4A. V2 Component Factory Library

**File mới**: `src/utils/v2Components.ts` (~350 dòng)

```typescript
import {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SectionBuilder, ThumbnailBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, SeparatorSpacingSize
} from 'discord.js';

const V2_FLAG = 1 << 15; // MessageFlags.IsComponentsV2

// ===== Color Constants =====
export const V2_COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  danger: 0xED4245,
  warning: 0xFEE75C,
  info: 0x00BFFF,
  gold: 0xFFD700,
  silver: 0xC0C0C0,
  bronze: 0xCD7F32,
  realms: [0x9B59B6, 0x3498DB, 0x2ECC71, 0xF1C40F, 0xE74C3C, 0x1ABC9C, 0xE67E22, 0x95A5A6, 0xD35400, 0x8E44AD]
} as const;

// ===== Core Builders =====

export function header(title: string, description?: string): TextDisplayBuilder {
  let content = `## ${title}`;
  if (description) content += `\n${description}`;
  return new TextDisplayBuilder().setContent(content);
}

export function body(text: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(text);
}

export function separator(spacing: SeparatorSpacingSize = SeparatorSpacingSize.Small): SeparatorBuilder {
  return new SeparatorBuilder().setSpacing(spacing);
}

export function thumbnail(url: string): ThumbnailBuilder {
  return new ThumbnailBuilder().setURL(url);
}

// ===== Container Builder =====

export function container(
  color: number,
  components: (TextDisplayBuilder | SeparatorBuilder | SectionBuilder | ActionRowBuilder<any>)[]
): ContainerBuilder {
  const c = new ContainerBuilder().setAccentColor(color);
  for (const comp of components) {
    if (comp instanceof TextDisplayBuilder) c.addTextDisplayComponents(comp);
    else if (comp instanceof SeparatorBuilder) c.addSeparatorComponents(comp);
    else if (comp instanceof SectionBuilder) c.addSectionComponents(comp);
    else if (comp instanceof ActionRowBuilder) c.addActionRowComponents(comp);
  }
  return c;
}

// ===== Button Builders =====

export function button(
  style: ButtonStyle,
  label: string,
  customId: string,
  emoji?: string
): ButtonBuilder {
  const b = new ButtonBuilder().setStyle(style).setLabel(label).setCustomId(customId);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function primaryBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  return button(ButtonStyle.Primary, label, customId, emoji);
}

export function successBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  return button(ButtonStyle.Success, label, customId, emoji);
}

export function dangerBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  return button(ButtonStyle.Danger, label, customId, emoji);
}

export function secondaryBtn(label: string, customId: string, emoji?: string): ButtonBuilder {
  return button(ButtonStyle.Secondary, label, customId, emoji);
}

export function row(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

// ===== Layout Helpers =====

export function progressBar(current: number, max: number, size = 10): string {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(size * ratio);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

export function statLine(label: string, value: number | string, emoji?: string): string {
  return `${emoji ? emoji + ' ' : ''}**${label}**: ${value}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ===== Common UI Patterns =====

export function profileContainer(user: any, stats: any, rank: string): ContainerBuilder {
  return container(V2_COLORS.realms[user.realm_index % 10] || V2_COLORS.primary, [
    header(`👤 ${user.ten_nhan_vat}`, `Realm: ${rank} | Level: ${user.level}`),
    separator(),
    body([
      statLine('HP', `${user.hp}/${user.max_hp}`, '❤️'),
      statLine('MP', `${user.mp}/${user.max_mp}`, '💙'),
      statLine('ATK', stats.atk, '⚔️'),
      statLine('DEF', stats.def, '🛡️'),
      statLine('CRT', `${stats.crit}%`, '💥'),
      statLine('SPD', stats.speed, '⚡'),
      statLine('LCK', stats.luck, '🍀'),
    ].join('\n'))
  ]);
}

export function progressBarContainer(label: string, current: number, max: number, color: number): ContainerBuilder {
  return container(color, [
    header(label),
    body(`${progressBar(current, max, 15)} ${current}/${max} (${Math.round(current/max*100)}%)`)
  ]);
}

export function confirmationContainer(
  title: string,
  message: string,
  confirmId: string,
  cancelId: string
): ContainerBuilder {
  return container(V2_COLORS.warning, [
    header(title),
    body(message),
    separator(),
    row(
      successBtn('Xác nhận', confirmId, '✅'),
      dangerBtn('Hủy', cancelId, '❌')
    )
  ]);
}

// ===== Send Helpers =====

export function v2Reply(interaction: any, components: ContainerBuilder[], rows: ActionRowBuilder[] = []): Promise<any> {
  return interaction.reply({
    components,
    flags: V2_FLAG
  });
}

export function v2Update(interaction: any, components: ContainerBuilder[], rows: ActionRowBuilder[] = []): Promise<any> {
  return interaction.update({
    components,
    flags: V2_FLAG
  });
}

export function v2Followup(interaction: any, components: ContainerBuilder[], rows: ActionRowBuilder[] = []): Promise<any> {
  return interaction.followUp({
    components,
    flags: V2_FLAG
  });
}
```

### 4B. Command-by-Command Migration Strategy

**Phương pháp**: Migration theo batch, mỗi batch ~10 files, test sau mỗi batch.

```
Batch 1 (Priority — high traffic):
  src/commands/general/hoso.ts
  src/commands/general/shop.ts
  src/commands/general/trangbi.ts
  src/commands/combat/worldboss.ts (đã native V2, skip)
  src/commands/combat/arena.ts
  src/commands/general/khambha.ts (tu luyện)
  src/commands/general/dung.ts (inventory)
  src/commands/general/linhcan.ts
  src/commands/general/cuonghoa.ts
  src/commands/general/dotpha.ts

Batch 2 (Services):
  src/commands/life/chetao.ts
  src/commands/life/luyenkhi.ts
  src/commands/life/linhdien.ts
  src/commands/general/sanyeuthu.ts
  src/commands/general/sungthu.ts
  src/commands/general/haithuoc.ts
  src/commands/general/suachua.ts
  src/commands/general/thanhly.ts
  src/commands/general/doitien.ts
  src/commands/general/nhiemvu.ts

Batch 3 (Social & PvP):
  src/commands/general/yentiec.ts
  src/commands/general/ketnghia.ts
  src/commands/general/tongmon.ts
  src/commands/combat/bicanh.ts
  src/commands/combat/guildwar.ts
  src/commands/combat/sectwar.ts
  src/commands/combat/pvpbxh.ts
  src/commands/combat/vongtuong.ts
  src/commands/general/daolu.ts
  src/commands/general/kyNang.ts

Batch 4 (Remaining):
  src/commands/general/leothap.ts
  src/commands/general/loren.ts
  src/commands/general/luanhoi.ts
  src/commands/general/tamphap.ts
  src/commands/general/phapbao.ts
  src/commands/general/quyetau.ts
  src/commands/general/bangphongthan.ts
  src/commands/general/vanbaolau.ts
  src/commands/general/camnang.ts
  src/commands/general/huongdan.ts
  src/commands/general/sukien.ts
  src/commands/general/quexam.ts
  src/commands/general/casino.ts
  src/commands/general/noitu.ts
  + remaining ~15 command files
```

**Migration pattern per file**:

```typescript
// TRƯỚC:
import { EmbedBuilder } from 'discord.js';
const embed = new EmbedBuilder()
  .setTitle('Hồ Sơ')
  .setColor(0x5865F2)
  .addFields({ name: 'HP', value: `${hp}/${maxHp}` });
interaction.reply({ embeds: [embed], components: rows });

// SAU:
import { container, header, body, separator, statLine, V2_COLORS, v2Reply } from '../../utils/v2Components';
const comp = container(V2_COLORS.primary, [
  header('Hồ Sơ'),
  separator(),
  body([statLine('HP', `${hp}/${maxHp}`, '❤️'), statLine('ATK', stats.atk, '⚔️')].join('\n'))
]);
v2Reply(interaction, [comp], rows);
```

### 4C. Navigation System Redesign

**File mới**: `src/utils/navigation.ts` (~200 dòng)

```typescript
import { ContainerBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { header, body, separator, primaryBtn, dangerBtn, row, V2_COLORS } from './v2Components';

export interface Tab {
  id: string;
  label: string;
  emoji: string;
  builder: () => ContainerBuilder | Promise<ContainerBuilder>;
}

export class TabbedView {
  private tabs: Tab[] = [];
  private currentTab = 0;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  addTab(tab: Tab): this {
    this.tabs.push(tab);
    return this;
  }

  async render(): Promise<{ components: ContainerBuilder[]; rows: ActionRowBuilder[] }> {
    const tab = this.tabs[this.currentTab];
    const mainContent = await tab.builder();

    // Tab bar
    const tabButtons = this.tabs.map((t, i) =>
      primaryBtn(
        `${t.emoji} ${t.label}`,
        `navtab_${t.id}_${i}_${this.userId}`,
        i === this.currentTab ? '▶️' : undefined
      )
    );

    // Navigation row
    const navRow = row(...tabButtons);

    return {
      components: [mainContent],
      rows: [navRow]
    };
  }

  setCurrentTab(index: number): void {
    this.currentTab = Math.max(0, Math.min(index, this.tabs.length - 1));
  }

  findTabById(id: string): number {
    return this.tabs.findIndex(t => t.id === id);
  }
}

export class PaginationView {
  private items: any[];
  private pageSize: number;
  private currentPage: number;
  private userId: string;
  private renderFn: (items: any[], page: number) => ContainerBuilder;

  constructor(userId: string, items: any[], pageSize: number, renderFn: (items: any[], page: number) => ContainerBuilder) {
    this.userId = userId;
    this.items = items;
    this.pageSize = pageSize;
    this.renderFn = renderFn;
    this.currentPage = 0;
  }

  get totalPages(): number {
    return Math.ceil(this.items.length / this.pageSize);
  }

  render(): { components: ContainerBuilder[]; rows: ActionRowBuilder[] } {
    const start = this.currentPage * this.pageSize;
    const pageItems = this.items.slice(start, start + this.pageSize);

    const content = this.renderFn(pageItems, this.currentPage);

    const navButtons = [];
    if (this.currentPage > 0) {
      navButtons.push(primaryBtn('◀️ Trước', `page_prev_${this.userId}`));
    }
    navButtons.push(primaryBtn(`${this.currentPage + 1}/${this.totalPages}`, 'noop'));
    if (this.currentPage < this.totalPages - 1) {
      navButtons.push(primaryBtn('Sau ▶️', `page_next_${this.userId}`));
    }

    return { components: [content], rows: [row(...navButtons)] };
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 0) this.currentPage--;
  }
}
```

**Scope estimate tổng UI**: ~1,200 dòng code mới + ~2,500 dòng sửa (migration)

---

## PHẦN 5: RETENTION SYSTEMS

### 5A. Battle Pass

#### Bảng mới

```sql
CREATE TABLE IF NOT EXISTS battle_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_number INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_battle_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  tier INTEGER DEFAULT 1,              -- Current tier (1-50)
  exp INTEGER DEFAULT 0,               -- Current tier progress
  premium_purchased INTEGER DEFAULT 0,
  claimed_rewards TEXT DEFAULT '[]',   -- JSON array of claimed tier numbers
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_bp_user_season ON user_battle_pass(user_id, season_number);
```

#### Constants: `src/config/battlePassConstants.ts` (~250 dòng)

```typescript
export const BP_MAX_TIER = 50;
export const BP_EXP_PER_TIER = 100;
export const BP_SEASON_DAYS = 30;

export const BP_EXP_SOURCES = {
  daily_quest: 20,
  weekly_quest: 50,
  arena_win: 5,
  dungeon_clear: 10,
  boss_attack: 15,
  craft: 10,
  work: 3,
  cultivation_tick: 1
} as const;

export interface BPReward {
  tier: number;
  free: { type: string; id?: string; amount: number }[];
  premium: { type: string; id?: string; amount: number }[];
}

export const BP_REWARDS: BPReward[] = [
  { tier: 1,  free: [{ type: 'ngotinh', amount: 20 }],                          premium: [{ type: 'ngotinh', amount: 50 }] },
  { tier: 2,  free: [{ type: 'coins', amount: 500 }],                           premium: [{ type: 'coins', amount: 1500 }] },
  { tier: 3,  free: [{ type: 'item', id: 'pill_hp_3', amount: 5 }],             premium: [{ type: 'item', id: 'pill_hp_3', amount: 15 }] },
  { tier: 5,  free: [{ type: 'item', id: 'material_fire_shard', amount: 5 }],   premium: [{ type: 'item', id: 'material_fire_shard', amount: 15 }] },
  { tier: 7,  free: [{ type: 'ngotinh', amount: 50 }],                          premium: [{ type: 'item', id: 'talisman_ky_ngo', amount: 1 }] },
  { tier: 10, free: [{ type: 'item', id: 'item_rare_fire_shard', amount: 3 }],  premium: [{ type: 'item', id: 'item_rare_fire_shard', amount: 10 }] },
  { tier: 15, free: [{ type: 'ngotinh', amount: 100 }],                         premium: [{ type: 'title', id: 'bp_legend_s1' }] },
  { tier: 20, free: [{ type: 'item', id: 'pill_hp_5', amount: 5 }],             premium: [{ type: 'item', id: 'pill_hp_5', amount: 20 }] },
  { tier: 25, free: [{ type: 'ngotinh', amount: 200 }],                         premium: [{ type: 'item', id: 'material_quy_nguyen', amount: 5 }] },
  { tier: 30, free: [{ type: 'item', id: 'material_fire_core', amount: 5 }],    premium: [{ type: 'item', id: 'material_fire_core', amount: 15 }] },
  { tier: 35, free: [{ type: 'ngotinh', amount: 300 }],                         premium: [{ type: 'item', id: 'cauldron_gold', amount: 1 }] },
  { tier: 40, free: [{ type: 'item', id: 'item_rare_beast_egg', amount: 1 }],   premium: [{ type: 'item', id: 'item_rare_beast_egg', amount: 3 }] },
  { tier: 45, free: [{ type: 'ngotinh', amount: 500 }],                         premium: [{ type: 'item', id: 'material_loi_phap_tinh', amount: 5 }] },
  { tier: 50, free: [{ type: 'ngotinh', amount: 1000 }],                        premium: [{ type: 'title', id: 'bp_champion_s1' }, { type: 'item', id: 'item_legendary_chest', amount: 1 }] },
  // ... fill gaps for tiers 4, 6, 8, 9, 11-14, etc.
];
```

#### Service mới: `src/services/BattlePassService.ts` (~250 dòng)

```typescript
import { db } from '../database/database';
import { BP_MAX_TIER, BP_EXP_PER_TIER, BP_EXP_SOURCES, BP_REWARDS } from '../config/battlePassConstants';

class BattlePassService {
  /**
   * Add EXP and check for tier ups
   */
  addExp(userId: string, source: keyof typeof BP_EXP_SOURCES, amount?: number): { tierUp: boolean; newTier: number } {
    const expGain = amount ?? BP_EXP_SOURCES[source];
    const profile = this.getOrCreateProfile(userId);

    const newExp = profile.exp + expGain;
    const tierUps = Math.floor(newExp / BP_EXP_PER_TIER);
    const remainExp = newExp % BP_EXP_PER_TIER;

    if (tierUps > 0) {
      const newTier = Math.min(BP_MAX_TIER, profile.tier + tierUps);
      db.prepare('UPDATE user_battle_pass SET tier = ?, exp = ? WHERE id = ?')
        .run(newTier, remainExp, profile.id);
      return { tierUp: true, newTier };
    }

    db.prepare('UPDATE user_battle_pass SET exp = ? WHERE id = ?')
      .run(newExp, profile.id);
    return { tierUp: false, newTier: profile.tier };
  }

  getOrCreateProfile(userId: string): any {
    const currentSeason = this.getCurrentSeason();
    let profile = db.prepare('SELECT * FROM user_battle_pass WHERE user_id = ? AND season_number = ?')
      .get(userId, currentSeason) as any;

    if (!profile) {
      db.prepare(`
        INSERT INTO user_battle_pass (user_id, season_number, tier, exp)
        VALUES (?, ?, 1, 0)
      `).run(userId, currentSeason);
      profile = db.prepare('SELECT * FROM user_battle_pass WHERE user_id = ? AND season_number = ?')
        .get(userId, currentSeason);
    }
    return profile;
  }

  claimReward(userId: string, tier: number): boolean {
    const profile = this.getOrCreateProfile(userId);
    if (profile.tier < tier) return false;

    const claimed = JSON.parse(profile.claimed_rewards || '[]');
    if (claimed.includes(tier)) return false;

    const reward = BP_REWARDS.find(r => r.tier === tier);
    if (!reward) return false;

    // Apply free rewards
    for (const r of reward.free) {
      this.applyReward(userId, r);
    }

    // Apply premium if purchased
    if (profile.premium_purchased) {
      for (const r of reward.premium) {
        this.applyReward(userId, r);
      }
    }

    claimed.push(tier);
    db.prepare('UPDATE user_battle_pass SET claimed_rewards = ? WHERE id = ?')
      .run(JSON.stringify(claimed), profile.id);
    return true;
  }

  private applyReward(userId: string, reward: { type: string; id?: string; amount: number }): void {
    switch (reward.type) {
      case 'ngotinh':
        db.prepare('UPDATE users SET ngotinh = ngotinh + ? WHERE discord_id = ?')
          .run(reward.amount, userId);
        break;
      case 'coins':
        db.prepare('UPDATE users SET coins = coins + ? WHERE discord_id = ?')
          .run(reward.amount, userId);
        break;
      case 'item':
        if (reward.id) {
          db.prepare('INSERT INTO inventories (user_id, item_id, quantity) VALUES (?, ?, ?)')
            .run(userId, reward.id, reward.amount);
        }
        break;
      case 'title':
        if (reward.id) {
          db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title) VALUES (?, ?)')
            .run(userId, reward.id);
        }
        break;
    }
  }

  getCurrentSeason(): number {
    const row = db.prepare('SELECT MAX(season_number) as num FROM battle_pass').get() as any;
    return row?.num ?? 1;
  }

  getLeaderboard(limit = 10): any[] {
    return db.prepare(`
      SELECT ubp.*, u.ten_nhan_vat
      FROM user_battle_pass ubp
      JOIN users u ON ubp.user_id = u.discord_id
      WHERE ubp.season_number = ?
      ORDER BY ubp.tier DESC, ubp.exp DESC
      LIMIT ?
    `).all(this.getCurrentSeason(), limit);
  }
}

export const battlePassService = new BattlePassService();
```

**Files mới**: `src/config/battlePassConstants.ts`, `src/services/BattlePassService.ts`
**Files sửa**: `src/services/DailyQuestService.ts`, `src/services/ArenaService.ts`, `src/services/CombatService.ts` — gọi battlePassService.addExp() sau mỗi action

**Scope estimate**: ~500 dòng code mới + ~30 dòng sửa

---

### 5B. Login Reward Overhaul

**File sửa**: `src/services/DailyLoginService.ts`

```
Thêm hệ thống tiered login:
- Ngày 1-7: Hạ Phẩm LT, pills
- Ngày 8-14: Trung Phẩm LT, materials
- Ngày 15-21: Thượng Phẩm LT, rare fire shards
- Ngày 22-28: Special items, beast eggs
- Ngày 29-30: Legendary items, massive currency

Kích hoạt battlePassService.addExp() mỗi ngày login.
```

### 5C. Achievement Expansion

**File sửa**: `src/database/database.ts` (seedAchievements)

```
Thêm ~30 achievements mới covering:
- Demon defeat counts (5/10/25/50)
- Dao comprehension levels
- Rare fire collection
- Rare beast taming
- Battle Pass tiers reached
- Arena win streaks
- Boss phase participation
- Ky ngo event completions
```

---

## PHẦN 6: TỔNG HỢP — FILES

### Files mới (30 files)

```
src/handlers/interactions/InteractionRegistry.ts           (~150 dòng)
src/handlers/interactions/middleware.ts                     (~100 dòng)
src/handlers/interactions/handlers.ts                       (~80 dòng)
src/handlers/interactions/EquipmentInteractionHandler.ts    (~300 dòng)
src/handlers/interactions/BossInteractionHandler.ts         (~180 dòng)
src/handlers/interactions/MarketInteractionHandler.ts       (~200 dòng)
src/handlers/interactions/AchievementInteractionHandler.ts  (~120 dòng)
src/handlers/interactions/SocialInteractionHandler.ts       (~150 dòng)
src/handlers/interactions/NavigationInteractionHandler.ts   (~200 dòng)
src/handlers/interactions/CombatInteractionHandler.ts       (~250 dòng)
src/services/CacheService.ts                                (~120 dòng)
src/services/KyNgoService.ts                                (~350 dòng)
src/services/TamMaService.ts                                (~400 dòng)
src/services/RareFireService.ts                             (~350 dòng)
src/services/RareBeastService.ts                            (~380 dòng)
src/services/RankedArenaService.ts                          (~400 dòng)
src/services/WorldBossReworkService.ts                      (~350 dòng)
src/services/BattlePassService.ts                           (~250 dòng)
src/config/kyNgoConstants.ts                                (~180 dòng)
src/config/tamMaConstants.ts                                (~200 dòng)
src/config/rareFireConstants.ts                             (~250 dòng)
src/config/rareBeastConstants.ts                            (~300 dòng)
src/config/arenaConstants.ts                                (~120 dòng)
src/config/worldBossReworkConstants.ts                      (~200 dòng)
src/config/battlePassConstants.ts                           (~250 dòng)
src/utils/v2Components.ts                                   (~350 dòng)
src/utils/navigation.ts                                     (~200 dòng)
```

### Files sửa (~45 files)

```
src/events/interactionCreate.ts         → refactor thành dispatcher (~400 dòng)
src/services/CultivationService.ts      → thêm kyNgo trigger (~20 dòng)
src/services/TribulationService.ts      → mood system, kyNgo integration (~40 dòng)
src/services/CombatEngine.ts           → dao bonuses, rare beast/fire passives (~60 dòng)
src/services/CombatService.ts          → phase tracking, counter damage (~40 dòng)
src/services/AlchemyService.ts         → rare fire alchemy bonus (~10 dòng)
src/services/EnhanceService.ts         → rare fire enhance bonus, progressive destruction (~20 dòng)
src/services/ArenaService.ts           → delegate to RankedArenaService (~30 dòng)
src/services/BossSpawnService.ts       → phase init on spawn (~15 dòng)
src/services/DailyLoginService.ts      → tiered rewards (~30 dòng)
src/services/DailyQuestService.ts      → battle pass exp triggers (~10 dòng)
src/config/gameConstants.ts            → balance constants (~30 dòng)
src/config/itemConstants.ts            → new item IDs (~30 dòng)
src/database/database.ts               → 8 new tables, indexes, migrations, seed data (~300 dòng)
src/utils/constants.ts                 → new realm/boss display data (~20 dòng)
src/handlers/interactions/CultivationInteractionHandler.ts → expand (~200 dòng)
src/handlers/interactions/ProfileInteractionHandler.ts → V2 migration (~100 dòng)
src/handlers/interactions/LifeInteractionHandler.ts → V2 migration (~50 dòng)
~35 command files                       → V2 migration (~100 dòng each avg)
```

---

## PHẦN 7: THỨ TỰ TRIỂN KHAI CHI TIẾT

```
Week 1-2: Phase 1 (Infrastructure)
  Day 1-2:   CacheService.ts + wire vào existing services
  Day 3-4:   interactionCreate.ts refactor (Phase 0 — parse/lock, registry setup)
  Day 5-7:   Migrate batch 1 handlers (cultivation + equipment + boss)
  Day 8-9:   Migrate batch 2 handlers (market + social + combat)
  Day 10:    DB indexes + duplicate cleanup + lint + tsc --noEmit

Week 3-4: Phase 2A + 2B (Cultivation Systems)
  Day 11-13: kyNgoConstants + KyNgoService + DB migration
  Day 14-16: tamMaConstants + TamMaService + CombatEngine integration
  Day 17:    CultivationInteractionHandler expansion
  Day 18-19: Test all cultivation flows
  Day 20:    tsc --noEmit + manual testing

Week 5-6: Phase 2C (Rare Fires + Beasts)
  Day 21-24: RareFireService + RareBeastService + constants
  Day 25-27: Integration into AlchemyService, EnhanceService, CombatEngine
  Day 28-29: DB migration + item constants
  Day 30:    tsc --noEmit

Week 7: Phase 2D + 2E (Arena + World Boss)
  Day 31-33: RankedArenaService + arena constants + DB
  Day 34-36: WorldBossReworkService + boss constants + DB
  Day 37:    Integration into existing ArenaService + CombatService
  Day 38:    tsc --noEmit

Week 8: Phase 3 (Balance)
  Day 39-40: Stat formula overhaul + CombatEngine changes
  Day 41:    Linh Can RNG fix
  Day 42:    Enhancement destruction reduction
  Day 43:    Economy rebalance
  Day 44:    tsc --noEmit

Week 9-12: Phase 4 (UI Migration)
  Day 45-47: v2Components.ts + navigation.ts
  Day 48-55: Batch-by-batch command migration (4 batches)
  Day 56-58: Testing + polish
  Day 59-60: tsc --noEmit

Week 13: Phase 5 (Retention)
  Day 61-63: BattlePassService + constants + DB
  Day 64:    DailyLogin overhaul
  Day 65:    Achievement expansion
  Day 66:    tsc --noEmit

Week 14: Final Integration & Testing
  Day 67-68: End-to-end testing all systems
  Day 69-70: Bug fixes, balance tuning
  Day 70:    Final tsc --noEmit + deploy
```

---

## PHẦN 8: RISK & MITIGATION

| Risk | Mitigation |
|------|-----------|
| interactionCreate.ts refactor breaks existing flows | Migrate one handler at a time, test each batch before next |
| New DB tables conflict with existing schema | Use CREATE TABLE IF NOT EXISTS, check before ALTER |
| V2 migration breaks embeds | Run existing selftest.ts after each batch migration |
| Balance changes too aggressive | Use system_config for tunable values, adjust without code changes |
| 70+ command file migration overwhelming | Prioritize high-traffic commands first, skip rarely-used ones initially |
| Performance with new systems | CacheService layer + DB indexes handle most hot paths |

---

## PHẦN 9: estimated scope

| Component | New Code | Modified Code | Files |
|-----------|----------|---------------|-------|
| Phase 1: Infrastructure | 1,200 dòng | 500 dòng | 10 mới + 5 sửa |
| Phase 2A: Kỳ ngộ | 800 dòng | 100 dòng | 2 mới + 3 sửa |
| Phase 2B: Tâm ma + Ngộ đạo | 900 dòng | 50 dòng | 2 mới + 3 sửa |
| Phase 2C: Dị hỏa + Dị thú | 1,700 dòng | 70 dòng | 4 mới + 5 sửa |
| Phase 2D: Arena rework | 700 dòng | 150 dòng | 2 mới + 3 sửa |
| Phase 2E: World Boss rework | 700 dòng | 100 dòng | 2 mới + 3 sửa |
| Phase 3: Balance | 0 dòng | 200 dòng | 0 mới + 5 sửa |
| Phase 4: UI Migration | 1,200 dòng | 2,500 dòng | 2 mới + 37 sửa |
| Phase 5: Retention | 500 dòng | 100 dòng | 2 mới + 3 sửa |
| **Tổng** | **~7,700 dòng** | **~3,770 dòng** | **~28 mới + ~64 sửa** |
