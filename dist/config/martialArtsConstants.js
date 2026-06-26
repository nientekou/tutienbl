"use strict";
// E-01: Martial Arts System Constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTERY_LEVELS = exports.MARTIAL_ART_FUSIONS = exports.ELEMENT_DISADVANTAGE_PENALTY = exports.ELEMENT_ADVANTAGE_BONUS = exports.ELEMENT_COUNTERS = exports.MARTIAL_ARTS = void 0;
exports.MARTIAL_ARTS = [
    { id: 'hoa_1', name: 'Hỏa Công Pháp', element: 'Hoa', tier: 1, description: 'Basic fire martial art', statBonus: { stat: 'atk', value: 0.05 }, effect: { type: 'burn', value: 0.05, duration: 2 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    { id: 'thuy_1', name: 'Thủy Công Pháp', element: 'Thuy', tier: 1, description: 'Basic water martial art', statBonus: { stat: 'hp', value: 0.05 }, effect: { type: 'heal', value: 0.10, duration: 1 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    { id: 'moc_1', name: 'Mộc Công Pháp', element: 'Moc', tier: 1, description: 'Basic wood martial art', statBonus: { stat: 'hp', value: 0.03 }, effect: { type: 'lifesteal', value: 0.10, duration: 2 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    { id: 'kim_1', name: 'Kim Công Pháp', element: 'Kim', tier: 1, description: 'Basic metal martial art', statBonus: { stat: 'crit', value: 0.03 }, effect: { type: 'crit_bonus', value: 0.10, duration: 2 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    { id: 'tho_1', name: 'Thổ Công Pháp', element: 'Tho', tier: 1, description: 'Basic earth martial art', statBonus: { stat: 'def', value: 0.05 }, effect: { type: 'shield', value: 0.15, duration: 2 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    { id: 'loi_1', name: 'Lôi Công Pháp', element: 'Loi', tier: 1, description: 'Basic lightning martial art', statBonus: { stat: 'speed', value: 0.05 }, effect: { type: 'stun', value: 1, duration: 1 }, unlockLevel: 10, mpCost: 20, cooldown: 4 },
    { id: 'phong_1', name: 'Phong Công Pháp', element: 'Phong', tier: 1, description: 'Basic wind martial art', statBonus: { stat: 'dodge', value: 0.05 }, effect: { type: 'speed_boost', value: 0.10, duration: 2 }, unlockLevel: 10, mpCost: 20, cooldown: 3 },
    // Tier 2: Fusion results
    { id: 'hoa_2', name: 'Hỏa Thủy Hỗn Hợp', element: 'Hoa', tier: 2, description: 'Enhanced fire with water instability', statBonus: { stat: 'atk', value: 0.08 }, effect: { type: 'burn', value: 0.08, duration: 3 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
    { id: 'kim_2', name: 'Kim Thổ Tấn Công', element: 'Kim', tier: 2, description: 'Metal pierces through earth armor', statBonus: { stat: 'crit', value: 0.06 }, effect: { type: 'armor_pierce', value: 0.20, duration: 2 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
    { id: 'loi_2', name: 'Lôi Phong Thần Thông', element: 'Loi', tier: 2, description: 'Lightning strikes with wind speed', statBonus: { stat: 'speed', value: 0.08 }, effect: { type: 'stun', value: 1, duration: 2 }, unlockLevel: 30, mpCost: 40, cooldown: 4 },
    { id: 'moc_2', name: 'Mộc Thủy Sinh Mệnh', element: 'Moc', tier: 2, description: 'Wood absorbs life force', statBonus: { stat: 'hp', value: 0.06 }, effect: { type: 'lifesteal', value: 0.15, duration: 3 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
    // Tier 2: Additional fusion results
    { id: 'phong_2', name: 'Phong Hỏa Luyện Thể', element: 'Phong', tier: 2, description: 'Wind carries fire to burn wider', statBonus: { stat: 'dodge', value: 0.07 }, effect: { type: 'aoe_burn', value: 0.06, duration: 2 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
    { id: 'tho_2', name: 'Thổ Kim Quyền Ngại', element: 'Tho', tier: 2, description: 'Earth reinforced by metal', statBonus: { stat: 'def', value: 0.08 }, effect: { type: 'shield', value: 0.25, duration: 2 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
    { id: 'thuy_2', name: 'Thủy Mộc Thu Phục', element: 'Thuy', tier: 2, description: 'Water nourishes wood growth', statBonus: { stat: 'hp', value: 0.08 }, effect: { type: 'regen', value: 0.05, duration: 3 }, unlockLevel: 30, mpCost: 35, cooldown: 3 },
];
exports.ELEMENT_COUNTERS = {
    'Hoa': 'Kim', 'Kim': 'Moc', 'Moc': 'Tho', 'Tho': 'Thuy', 'Thuy': 'Hoa', 'Loi': 'Thuy', 'Phong': 'Loi',
};
exports.ELEMENT_ADVANTAGE_BONUS = 0.25;
exports.ELEMENT_DISADVANTAGE_PENALTY = 0.25;
exports.MARTIAL_ART_FUSIONS = [
    { id: 'fusion_hoa_thuy', name: 'Hỏa Thủy Song Hành', ingredient1: 'hoa_1', ingredient2: 'thuy_1', result: 'hoa_2', successRate: 0.70, description: 'Combine fire and water for enhanced burn' },
    { id: 'fusion_kim_tho', name: 'Kim Thổ Hợp Nhất', ingredient1: 'kim_1', ingredient2: 'tho_1', result: 'kim_2', successRate: 0.70, description: 'Combine metal and earth for armor pierce' },
    { id: 'fusion_loi_phong', name: 'Lôi Phong Hợp Nhất', ingredient1: 'loi_1', ingredient2: 'phong_1', result: 'loi_2', successRate: 0.70, description: 'Combine lightning and wind for stun' },
    { id: 'fusion_moc_thuy', name: 'Mộc Thủy Sinh Thần', ingredient1: 'moc_1', ingredient2: 'thuy_1', result: 'moc_2', successRate: 0.70, description: 'Combine wood and water for lifesteal' },
    { id: 'fusion_hoa_phong', name: 'Hỏa Phong Luyện Thể', ingredient1: 'hoa_1', ingredient2: 'phong_1', result: 'phong_2', successRate: 0.65, description: 'Wind carries fire for wider destruction' },
    { id: 'fusion_kim_thuy', name: 'Kim Thủy Phú Hậu', ingredient1: 'kim_1', ingredient2: 'thuy_1', result: 'thuy_2', successRate: 0.65, description: 'Metal corrodes water into healing essence' },
    { id: 'fusion_tho_loi', name: 'Thổ Lôi Chấn Pháp', ingredient1: 'tho_1', ingredient2: 'loi_1', result: 'tho_2', successRate: 0.65, description: 'Earth absorbs lightning for impenetrable defense' },
];
exports.MASTERY_LEVELS = [
    { level: 1, expNeeded: 0, bonus: 0 },
    { level: 2, expNeeded: 100, bonus: 0.02 },
    { level: 3, expNeeded: 250, bonus: 0.04 },
    { level: 4, expNeeded: 500, bonus: 0.06 },
    { level: 5, expNeeded: 1000, bonus: 0.08 },
    { level: 6, expNeeded: 2000, bonus: 0.10 },
    { level: 7, expNeeded: 4000, bonus: 0.12 },
    { level: 8, expNeeded: 8000, bonus: 0.14 },
    { level: 9, expNeeded: 16000, bonus: 0.16 },
    { level: 10, expNeeded: 32000, bonus: 0.20 },
];
