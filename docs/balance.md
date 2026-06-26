# Balance Documentation — Vạn Thế Tu Tiên

## Power Budget Rules

### Max Total Power
- Player endgame KHÔNG được vượt quá **3x base stats**
- Per-system cap: 35% total player power

### Multiplier Stacking
```
Total Power = Base × (1 + Sum_of_All_Bonuses)
NEVER: Base × Bonus1 × Bonus2 × Bonus3
```

### Tradeoff Requirements
- Mọi buff > 10% PHẢI có corresponding nerf
- Exception: Pure cosmetic, QoL improvements

## Scarcity Tiers

| Tier | Farm Time | Example |
|------|-----------|---------|
| Common | 1-3 days | Daily quest rewards, basic pills |
| Uncommon | 1-2 weeks | Tinh Thach Shards, beast food |
| Rare | 2-4 weeks | Soul Essence, Tim Phap fragments |
| Epic | 1-2 months | Beast Evolution Pill |
| Legendary | 2-4 months | Transmutation Pill |
| Mythic | 4-6 months | Full beast collection |

## Stamina Economy
- **Total daily stamina**: 500 (GIỮ NGUYÊN)
- **New daily sinks**: 150-210 stamina
- **Player MUST choose** what to do

## Reward Scaling
- **Level scaling factor**: `1 + majorRealmIndex * 0.10`
- **Weekly rewards**: ~10-14 hours/tuần
- **Season rewards**: ~40-60 hours/tuần

## Power Budget Analysis (Level 300)

| System | Bonus | Cap |
|--------|-------|-----|
| Base Stats | 100% | — |
| Linh Can | +0-20% | Uncapped |
| Enhancement +15 | +150% | Capped |
| Heart Law 3-set | +10% + special | Capped |
| Soul Weapon | +35% | Capped |
| Reincarnation | +40% max | Capped |
| Beast | +10% | Capped |
| Rare Fire | +20% | Capped |
| **TOTAL** | **~250-300%** | **~3x max** |
