"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIFFICULTY_MULT = exports.AWAKENING_DROP_TABLE = void 0;
// Awakening Material Drop Sources & Economy (V13 A-08)
const itemConstants_1 = require("./itemConstants");
exports.AWAKENING_DROP_TABLE = [
    // Linh Túy Giác Tỉnh (Skill Mastery Awakening)
    { material: itemConstants_1.AWAKENING_MATERIALS.SKILL_AWAKEN, source: 'elite_dungeon', dropRate: 0.25, minDifficulty: 1 },
    { material: itemConstants_1.AWAKENING_MATERIALS.SKILL_AWAKEN, source: 'secret_realm', dropRate: 0.35, minDifficulty: 0 },
    { material: itemConstants_1.AWAKENING_MATERIALS.SKILL_AWAKEN, source: 'tribulation', dropRate: 0.40, minDifficulty: 2 },
    // Máu Thú Nguyên (Beast Bloodline)
    { material: itemConstants_1.AWAKENING_MATERIALS.BEAST_BLOODLINE, source: 'pet_battle', dropRate: 0.20, minDifficulty: 0 },
    { material: itemConstants_1.AWAKENING_MATERIALS.BEAST_BLOODLINE, source: 'exploration', dropRate: 0.15, minDifficulty: 1 },
    { material: itemConstants_1.AWAKENING_MATERIALS.BEAST_BLOODLINE, source: 'beast_taming', dropRate: 1.00, minDifficulty: 0 }, // guaranteed dupe → 1 material
    // Thiên Mệnh Tinh Hỏa (Destiny Awaken)
    { material: itemConstants_1.AWAKENING_MATERIALS.DESTINY_AWAKEN, source: 'secret_realm', dropRate: 0.30, minDifficulty: 1 },
    { material: itemConstants_1.AWAKENING_MATERIALS.DESTINY_AWAKEN, source: 'tribulation', dropRate: 0.40, minDifficulty: 2 },
    { material: itemConstants_1.AWAKENING_MATERIALS.DESTINY_AWAKEN, source: 'world_boss', dropRate: 0.15, minDifficulty: 0 }, // MVP only
    // Vũ Khí Chi Hồn (Soul Weapon Awaken)
    { material: itemConstants_1.AWAKENING_MATERIALS.SOUL_WEAPON_AWAKEN, source: 'world_boss', dropRate: 0.20, minDifficulty: 0 },
    { material: itemConstants_1.AWAKENING_MATERIALS.SOUL_WEAPON_AWAKEN, source: 'arena_season', dropRate: 0.30, minDifficulty: 1 },
    { material: itemConstants_1.AWAKENING_MATERIALS.SOUL_WEAPON_AWAKEN, source: 'secret_realm', dropRate: 0.25, minDifficulty: 2 },
];
// Difficulty multiplier on drop rates
exports.DIFFICULTY_MULT = {
    0: 1.0, // easy
    1: 1.25, // normal
    2: 1.5, // hard
    3: 2.0, // nightmare
};
