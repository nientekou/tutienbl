# Đánh Giá Mã Nguồn & Góp Ý — Vạn Thế Tu Tiên Bot

> Ngày: 2026-06-22
> Phạm vi: Toàn bộ mã nguồn `src/`, cấu trúc dự án, và kiến trúc tổng thể

---

## 1. Tổng Quan Dự Án

- **Bot Discord RPG chủ đề Tu Tiên** với 62 services, 54 commands general, 9 commands combat, 5 commands life
- **Tech stack**: TypeScript, discord.js v14, better-sqlite3, vitest
- **Quy mô**: ~3300 dòng `interactionCreate.ts`, ~2300 dòng `database.ts`, 62 service files
- **10 Tasks đã hoàn thành** (cân bằng phe, bảng phong thần, casino, ủy thác, buff linh căn, shop, kinh tế, newbie protection, performance, API)

---

## 2. Vấn Đề Kiến Trúc (Architecture)

### 2.1. `interactionCreate.ts` — God File (~3300 dòng)
**Vấn đề**: File này xử lý TẤT CẢ interaction handlers cho cả bot. Với ~3300 dòng, đây là bottleneck lớn nhất về maintainability.

**Góp ý**:
- Tách thành `InteractionRouter` — dispatch theo `customId` prefix
- Mỗi domain có handler riêng: `CultivationInteractionHandler`, `CombatInteractionHandler`, `MarketInteractionHandler`, `ShopInteractionHandler`, etc.
- Đã có 6 handlers trong `src/handlers/interactions/` nhưng interactionCreate.ts vẫn chứa logic trực tiếp → cần migrate hết sang các handlers đó

### 2.2. `database.ts` — Monolith (~2400 dòng)
**Vấn đề**: File chứa CẢ schema definition, migrations, seed data trong một file duy nhất.

**Góp ý**:
- Tách schema definitions vào `database/schema.ts` (chỉ CREATE TABLE)
- Tách migrations vào `database/migrations/` (file riêng cho mỗi giai đoạn)
- Tách seed data vào `database/seeds/` (items, achievements, heart_laws, bloodlines)
- Dùng migration version tracking thay vì `PRAGMA table_info` check từng cột

### 2.3. Thiếu Dependency Injection
**Vấn đề**: Các services import trực tiếp nhau (hard-coded imports). Ví dụ `CombatService` import `inventoryService`, `eventService`, `achievementService`, `bloodlineService`, `leylineService` trực tiếp.

**Góp ý**:
- Service locator pattern hoặc constructor injection
- Giúp dễ test isolation và tránh circular dependencies

### 2.4. Singleton Pattern Tràn Lan
**Vấn đề**: Hầu hết services export singleton (`export const xxxService = new XxxService()`). TuTienClient cũng dùng `static instance`.

**Góp ý**:
- Chấp nhận được cho bot nhỏ, nhưng cần đảm bảo không có state mutation không mong muốn
- `InventoryService` có `statsCache` instance-level → OK nhưng nếu scale lên cần Redis

---

## 3. Vấn Đề Hiệu Năng (Performance)

### 3.1. SQLite WAL Mode — Đã Tốt
Đã dùng `journal_mode = WAL` và `synchronous = NORMAL` — đúng best practices.

### 3.2. Cache Chưa Đồng Bộ
**Vấn đề**:
- `UserRepository`: cache 1 phút
- `InventoryService`: cache stats 30 giây
- `LeaderboardService`: cache 5 phút
- Nhưng **không có cache invalidation cross-service**. Khi user cập nhật stats, InventoryService cache cũ vẫn valid.

**Góp ý**:
- Implement cache invalidation khi user data thay đổi
- Hoặc dùng event-driven: emit `userStatsChanged` để invalidate các cache liên quan

### 3.3. interactionCreate.ts Import Hell
**Vấn đề**: File này import ~40+ services/commands. Mỗi lần hot reload phải reload toàn bộ.

**Góp ý**:
- Lazy imports cho các handlers ít dùng
- Tree-shaking nếu chuyển sang ESM

### 3.4. Database Queries N+1
**Vấn đề**: Nhiều nơi query user rồi query inventory rồi query skills... tuần tự.

**Góp ý**:
- Dùng JOIN queries khi cần load nhiều dữ liệu liên quan
- Bulk queries cho leaderboard, guild war participants

---

## 4. Vấn Đề Bảo Mật (Security)

### 4.1. Hardcoded Client ID trong deploy.ts
```typescript
client.user = { id: process.env.CLIENT_ID || '1250367332247506984' } as any;
```
Client ID mặc định bị hardcode. Nên loại bỏ fallback này.

### 4.2. Thiếu Input Validation cho User Input
**Vấn đề**: Nhiều command nhận `getString()`, `getInteger()` từ Discord interaction mà không validate kỹ.

**Góp ý**:
- Tạo centralized validation utils (đã có `ValidationUtils.ts` nhưng chưa dùng phổ biến)
- Validate tất cả user input ở边界界 trước khi vào service logic

### 4.3. API Server Không Có Auth
**Vấn đề**: `ApiServer.ts` mở REST API read-only mà không có authentication.

**Góp ý**:
- Thêm API key hoặc JWT cho các endpoint nhạy cảm
- Rate limiting
- Chỉ expose user_id khi có authorization

### 4.4. Database Backup Không Encrypt
**Vấn đề**: Backup plain `.db` file vào `data/backups/`.

**Góp ý**:
- Xem xét encrypt backup nếu chứa PII
- Ít nhất đảm bảo `.gitignore`cludes `data/backups/`

---

## 5. Vấn Đề Code Quality

### 5.1. Test Coverage Rất Thấp
**Vấn đề**: Chỉ có 1 test file `CombatEngine.test.ts` (45 dòng, 1 test case). Toàn bộ bot 62 services nhưng chỉ test CombatEngine.

**Góp ý**:
- Viết unit tests cho critical paths: CultivationService, InventoryService, MarketService, ArenaService
- Viết integration tests cho database operations
- Mock better-sqlite3 cho tests (hiện tại tests chạy trên real DB)
- Target: >60% coverage cho services

### 5.2. Test Files Trong src/
**Vấn đề**: Có ~12 test files nằm trong `src/` (test_combat.ts, test_core.ts, test_life.ts...) thay vì `tests/`.

**Góp ý**:
- Di chuyển tất cả test files vào `tests/`
- Hoặc dùng vitest workspace để phân tách

### 5.3. `any` Type Usage
**Vấn đề**: Nhiều nơi dùng `as any`, `any[]`, particularly in database queries.

**Góp ý**:
- Định nghĩa interfaces cho tất cả DB query results
- Dùng generic types cho repository pattern

### 5.4. Console.log Debug Trong Production
**Vấn đề**: `database.ts` có `verbose: console.log` cho better-sqlite3, plus nhiều `console.log` debug scattered.

**Góp ý**:
- Dùng structured logging (winston/pino)
- Separate debug/production log levels
- `verbose: console.log` nên tắt ở production

### 5.5. Hardcoded Magic Numbers
**Vấn đề**: Constants như `1200` (InteractionLock cooldown), `5000` (boss base HP), `0.15` (mutant element chance)... nằm rải rác.

**Góp ý**:
- Tập trung vào `src/utils/constants.ts` hoặc config files
- Game balance values nên ở config riêng (`config/balance.ts`)

### 5.6. Thiếu Error Boundary
**Vấn đề**: Nhiều service methods không có try-catch, hoặc catch rồi chỉ `console.error`.

**Góp ý**:
- Thêm global error handler cho unhandled rejections
- Service layer nên có consistent error propagation
- Discord interactions nên có fallback error message cho user

---

## 6. Vấn Đề Database Design

### 6.1. Migration System Không Có Versioning
**Vấn đề**: Dùng `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` pattern. Không có migration version tracking.

**Góp ý**:
- Tạo bảng `schema_migrations` với version number
- Mỗi migration là một file riêng có up/down
- Running migrations on startup với version check

### 6.2. JSON Columns Phổ Biến
**Vấn đề**: Nhiều cột JSON (`linh_can`, `y_canh`, `buffs`, `skills`, `decoration`, `stats`, `custom_stats`...).

**Góp ý**:
- JSON columns OK cho SQLite nhưng khó query
- Xem xét normalize cho các cột cần filter/sort (ví dụ: pet skills)
- Thêm check constraints cho JSON format nếu có thể

### 6.3. Thiếu Soft Delete
**Vấn đề**: Dùng `ON DELETE CASCADE` everywhere. Xóa user sẽ xóa hết data.

**Góp ý**:
- Soft delete cho user accounts (thêm `deleted_at` column)
- Giữ data cho analytics/debugging

---

## 7. Ý tưởng Tính Năng Mới

### 7.1. Hệ Thống Season/Event Tự Động
- **Auto Season Rotation**: Tự động reset Arena, Sect War seasons theo schedule
- **Seasonal Events**: Spring Festival, Moon Festival... với items giới hạn thời gian
- **Battle Pass**: Premium track với rewards hàng ngày

### 7.2. Social Features
- **Guild Chat**: Kênh chat nội bộ tông môn
- **Friend System**: Thêm bạn bè, gửi quà, xem profile
- **Gift System**: Gửi vật phẩm cho người chơi khác
- **Global Chat**: Kênh chat toàn server

### 7.3. Advanced Combat
- **Combo System**: Kết hợp kỹ năng theo sequence để tạo combo attacks
- **Elemental Reactions**: Phản ứng nguyên tố khi kết hợp 2+ hệ (giống Genshin)
- **PvP Ranked Seasons**: Seasons riêng với rewards theo rank
- **Tournament Mode**: Giải đấu bracket 8/16 người

### 7.4. Economic Depth
- **Auction House Real-time**: Bid real-time với countdown timer
- **Guild Treasury**: Kho quỹ chung tông môn với voting
- **Crafting Orders**: Đăng recipe, người khác craft hộ
- **Market Manipulation**: Cho phép corner market某item nhưng có anti-inflation

### 7.5. End-Game Content
- **Infinite Tower**: Leo tháp vô hạn với scaling difficulty
- **World Boss Raids**: 10+ người cùng đánh boss với phases
- **Cross-Server Arena**: PvP giữa các server (nếu scale)
- **Mythic Dungeons**: Dungeons cần party 4-5 người với mechanics phức tạp

### 7.6. Quality of Life
- **Auto-Battle**: Tự động farming với stamina cost
- **Quick Equip**: Gợi ý trang bị tốt nhất
- **Stat Calculator**: Tính toán stats trước khi equip
- **Notification System**: DM khi có event, khi hết stamina, khi có bid...
- **Daily Login Rewards**: Thưởng login hàng ngày streak

### 7.7. Anti-Cheat & Balance
- **Rate Limiting**: Giới hạn actions/phút cho mỗi user
- **Anomaly Detection**: Phát hiện behavior bất thường (farm bot)
- **Economy Monitoring**: Theo dõi inflation, adjusting drop rates
- **Leaderboard Anti-Smurf**: Detect new accounts boosting old ones

---

## 8. Kế Hoạch Refactor Ưu Tiên

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Tách interactionCreate.ts thành routers | 2-3 ngày | Maintainability ++ |
| P0 | Tách database.ts thành schema/migrations/seeds | 1-2 ngày | Maintainability ++ |
| P1 | Viết tests cho critical services | 3-5 ngày | Quality ++ |
| P1 | Implement cache invalidation | 1 ngày | Performance + |
| P1 | Tạo migration version system | 1 ngày | Reliability + |
| P2 | Loại bỏ `any` types | 2-3 ngày | Type Safety ++ |
| P2 | Structured logging | 1 ngày | Debugging ++ |
| P2 | API authentication | 1 ngày | Security + |
| P3 | Di chuyển test files | 0.5 ngày | Organization + |
| P3 | Game balance config | 0.5 ngày | Maintainability + |

---

## 9. Kết Luận

**Điểm mạnh**:
- Hệ thống game rất phong phú (62 services覆盖 nhiều tính năng RPG)
- [x] Fix compiler errors in `shop.ts`
- [x] Align getShopEmbed items rendering with Image 2 style
- [x] Redirect `doitien.ts` getDoiTienEmbed and getDoiTienComponents to unified shop
- [x] Redirect `shopkynang.ts` getShopKyNangEmbed and getShopKyNangComponents to unified shop
- [x] Clean up `interactionCreate.ts` transitions & action handlers (remove redundant backRow)
- [x] Verify type safety and run build check
- Database schema well-designed với indexes hợp lý
- Hot reload support cho development
- Codebase có structure rõ ràng (commands/services/handlers/repositories)

**Điểm yếu chính**:
- `interactionCreate.ts` quá lớn (~3300 dòng) — bottleneck maintainability
- Test coverage gần như không có
- Database migration không có versioning
- Cache invalidation chưa implement

**Ưu tiên cao nhất**: Tách interactionCreate.ts và viết tests. Hai việc này sẽ cải thiện lớn nhất chất lượng codebase.
