// ==================== GAME CONSTANTS ====================
// Centralized game balance and configuration constants.
// Import from here instead of hardcoding values in service logic.

export const GAME_CONSTANTS = {
  // Stamina & MP Recovery
  STAMINA_RECOVERY_SECONDS: 60,
  MP_RECOVERY_SECONDS: 30,
  MAX_STAMINA: 500,

  // Interaction & Cooldowns
  INTERACTION_LOCK_MS: 1200,
  WORLD_BOSS_ATTACK_COOLDOWN_SECONDS: 600,
  BOSS_RESPAWN_SECONDS: 30,

  // Combat
  INJURY_DURATION_SECONDS: 900,
  CRIT_MULTIPLIER: 1.5,
  CRIT_BASE_CHANCE: 0.05,

  // Cultivation
  BREAKTHROUGH_BASE_RATE: 65,
  BREAKTHROUGH_RATE_DECAY: 12,
  BREAKTHROUGH_MIN_RATE: 8,
  LUCK_BONUS_PER_POINT: 0.002,
  BEQUAN_COST_MULTIPLIER: 200,

  // Enhancement
  ENHANCE_STAT_MULTIPLIER: 0.10,
  ENHANCE_DESTRUCTION_CHANCE: 0.05,  // Reduced from 15% → 5%, progressive from +13

  // Economy
  DAILY_BOSS_NGOTINH_PER_ATTACK: 3,
  DISCOUNT_ORTHODOX: 0.90,
  MARKET_TAX_RATE: 0.05,               // 5% tax on market sales (was 2%)
  SECT_CREATE_COST_LT: 800,            // 800 Linh Thach to create sect (was 500)
  ENHANCE_COST_LT_PER_LEVEL: 150,      // 150 LT per enhance level (was 100)
  WORK_COIN_MULTIPLIER: 0.8,           // 20% less coins from work
  NEW_PLAYER_BONUS_HOURS: 48,          // Double EXP for first 48h
  NEW_PLAYER_DROP_RATE_BONUS: 1.5,     // 50% more drops for first 48h

  // Cache TTLs
  COMBAT_LOG_CACHE_TTL_MS: 600_000,
  INTERACTION_LOCK_TTL_MS: 300_000,
  USER_CACHE_TTL_MS: 60_000,
  STATS_CACHE_TTL_MS: 30_000,

  // Cleanup intervals
  CLEANUP_INTERVAL_MS: 60_000,
} as const;
