# PLAN: Phát triển Vạn Thế Tu Tiên — Kết quả

## Đã hoàn thành (10/12 tasks)

### Balance (4/4)
| Task | Mô tả | Files |
|------|-------|-------|
| T1 | Breakthrough rates: *10, min 15%, pity +20% sau 3 fail, giảm penalty realm>=5 | CultivationService.ts, UserRepository.ts, database.ts |
| T2 | Stamina: 2/min passive, voice cap 80, Linh Tuyền Phù pill | UserRepository.ts, VoiceRecoveryService.ts, AlchemyService.ts, InventoryService.ts, database.ts |
| T3 | Enhance: giảm ~40% cost +10~15, tăng rate 15%→20%/8%, bỏ drop on fail | EnhanceService.ts |
| T4 | Offline: threshold 12h, decay 30%, Nhàn Tu Đan no decay 24h | CultivationService.ts, AlchemyService.ts, InventoryService.ts, database.ts |

### Features (4/5)
| Task | Mô tả | Files |
|------|-------|-------|
| T5 | Daily Login: streak 1-30, auto-claim DM, title rewards | DailyLoginService.ts (mới), database.ts, interactionCreate.ts |
| T6 | Hidden Treasures: map_fragment drops từ adventure (30%) + exploration (10%) | lamviec.ts, ExplorationService.ts |
| T7 | PvP Season: tier Kim/Bạc/Đồng, KNB + title rewards | ArenaService.ts |
| T8 | Sect Succession: /tongmon phophu + truyenngoi, deputy_id column | SectService.ts, tongmon.ts, database.ts |

### Optimization (2/3)
| Task | Mô tả | Files |
|------|-------|-------|
| T9 | CaveService: level 4 dùng KNB thay vì LT placeholder | CaveService.ts, interactionCreate.ts, dongphu.ts |
| T10 | Combat log DRY: combatLogUtils.ts thay 3 blocks trùng lặp | combatLogUtils.ts (mới), interactionCreate.ts |

## Chưa hoàn thành (2 tasks — độ phức tạp L)
- **T11**: Mở rộng Soul Weapon (awakening, evolution, combat integration)
- **T12**: Tách interactionCreate.ts thành modular handlers
