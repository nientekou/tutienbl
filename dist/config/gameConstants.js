"use strict";
// ==================== GAME CONSTANTS ====================
// Centralized game balance and configuration constants.
// Import from here instead of hardcoding values in service logic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONSTANTS = void 0;
exports.GAME_CONSTANTS = {
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
    ENHANCE_DESTRUCTION_CHANCE: 0.05, // Reduced from 15% → 5%, progressive from +13
    // Economy
    DAILY_BOSS_NGOTINH_PER_ATTACK: 3,
    DISCOUNT_ORTHODOX: 0.90,
    MARKET_TAX_RATE: 0.03, // 3% tax on market sales (reduced from 5% to boost trading)
    // B-02: Dynamic tax scaling based on item value
    MARKET_TAX_LOW: 0.02, // 2% for items < 500 LT
    MARKET_TAX_MID: 0.03, // 3% for items 500-5000 LT
    MARKET_TAX_HIGH: 0.05, // 5% for items > 5000 LT
    MARKET_RARE_FIND_CHANCE: 0.05, // 5% chance of "Rare Find" when selling
    SECT_CREATE_COST_LT: 800, // 800 Linh Thach to create sect
    ENHANCE_COST_LT_PER_LEVEL: 150, // 150 LT per enhance level
    WORK_COIN_MULTIPLIER: 0.8, // 20% less coins from work
    NEW_PLAYER_BONUS_HOURS: 48, // Double EXP for first 48h
    NEW_PLAYER_DROP_RATE_BONUS: 1.5, // 50% more drops for first 48h
    // Linh Can
    LINH_CAN_PITY_THRESHOLD: 10, // After N rolls without element ≥40%, guarantee ≥35%
    LINH_CAN_PITY_MIN_ELEMENT: 35, // Guaranteed minimum element % on pity roll
    LINH_CAN_MINIMUM_GUARANTEE: 10, // Every player guaranteed at least 1 element ≥10%
    // Cache TTLs
    COMBAT_LOG_CACHE_TTL_MS: 600_000,
    INTERACTION_LOCK_TTL_MS: 300_000,
    USER_CACHE_TTL_MS: 60_000,
    STATS_CACHE_TTL_MS: 30_000,
    // Cleanup intervals
    CLEANUP_INTERVAL_MS: 60_000,
    // C-06: Economy Deep
    CURRENCY_TYPES: ['linh_thach', 'knb', 'destiny_shards', 'prestige_tokens', 'dao_points', 'season_tokens', 'bounty_tokens'],
    CURRENCY_EXCHANGE_RATES: {
        linh_thach_to_knb: 10000,
        knb_to_linh_thach: 5000,
        destiny_shards_to_linh_thach: 100,
        prestige_tokens_to_knb: 5,
        dao_points_to_linh_thach: 50,
        season_tokens_to_knb: 3,
        bounty_tokens_to_linh_thach: 20,
    },
};
