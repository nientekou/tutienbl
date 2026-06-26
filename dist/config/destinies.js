"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESTINY_BUY_COST_SHARDS = exports.DESTINY_SCRAP_SHARDS = exports.DESTINY_PITY_SOFT_RATE = exports.DESTINY_PITY_HARD = exports.DESTINY_PITY_SOFT = exports.DESTINY_MAX_LEVEL = exports.DESTINY_FOCUS_COST = exports.DESTINY_GACHA_COST = exports.DESTINY_RARITY_MULTIPLIER = exports.DESTINY_TYPES = void 0;
exports.getDestinyExpNeeded = getDestinyExpNeeded;
exports.getDestinyScrapExp = getDestinyScrapExp;
exports.DESTINY_TYPES = {
    atk_percent: {
        id: 'atk_percent',
        name: 'Kiếm Tâm',
        description: 'Tăng Công Kích cơ bản (%)',
        icon: '⚔️',
        baseValue: 0.03, // 3%
        scalePerLevel: 0.01 // +1% mỗi cấp
    },
    def_percent: {
        id: 'def_percent',
        name: 'Huyền Quy',
        description: 'Tăng Phòng Thủ cơ bản (%)',
        icon: '🛡️',
        baseValue: 0.03,
        scalePerLevel: 0.01
    },
    hp_percent: {
        id: 'hp_percent',
        name: 'Sinh Mệnh',
        description: 'Tăng Sinh Lực tối đa (%)',
        icon: '❤️',
        baseValue: 0.05, // 5%
        scalePerLevel: 0.015 // +1.5% mỗi cấp
    },
    crit_rate: {
        id: 'crit_rate',
        name: 'Cuồng Bạo',
        description: 'Tăng Tỉ lệ Bạo Kích (%)',
        icon: '🔥',
        baseValue: 0.02, // 2%
        scalePerLevel: 0.005 // +0.5% mỗi cấp
    },
    crit_damage: {
        id: 'crit_damage',
        name: 'Tàn Sát',
        description: 'Tăng Sát thương Bạo Kích (%)',
        icon: '💥',
        baseValue: 0.05, // 5%
        scalePerLevel: 0.02 // +2% mỗi cấp
    },
    dodge_rate: {
        id: 'dodge_rate',
        name: 'Linh Động',
        description: 'Tăng Tỉ lệ Né Tránh (%)',
        icon: '💨',
        baseValue: 0.02, // 2%
        scalePerLevel: 0.005 // +0.5% mỗi cấp
    },
    speed_bonus: {
        id: 'speed_bonus',
        name: 'Lôi Điện',
        description: 'Tăng Tốc độ xuất chiêu (%)',
        icon: '⚡',
        baseValue: 0.03, // 3%
        scalePerLevel: 0.01 // +1% mỗi cấp
    }
};
exports.DESTINY_RARITY_MULTIPLIER = {
    thuong: 1.0, // Hệ số 1x
    hiem: 1.5, // Hệ số 1.5x
    cuc_pham: 2.5, // Hệ số 2.5x
    tien_pham: 4.0 // Hệ số 4x (Cực mạnh)
};
exports.DESTINY_GACHA_COST = 10000; // 10k Hạ Phẩm Linh Thạch mỗi lần bốc
exports.DESTINY_FOCUS_COST = 15000; // 15k khi dùng Fate Focus (1.5x)
exports.DESTINY_MAX_LEVEL = 10;
// P1-08: Pity System
exports.DESTINY_PITY_SOFT = 100; // Soft pity bắt đầu tại 100 rolls
exports.DESTINY_PITY_HARD = 150; // Hard pity guarantee tại 150 rolls
exports.DESTINY_PITY_SOFT_RATE = 0.01; // +1% per roll sau soft pity
// P1-08: Scrap & Fragment System
exports.DESTINY_SCRAP_SHARDS = {
    thuong: 10,
    hiem: 25,
    cuc_pham: 60,
    tien_pham: 150
};
exports.DESTINY_BUY_COST_SHARDS = 500; // Mua 1 destiny thường bằng shards
// Tính kinh nghiệm cần để lên cấp tiếp theo
function getDestinyExpNeeded(level, rarity) {
    const baseExp = 100 * level * level;
    const multiplier = exports.DESTINY_RARITY_MULTIPLIER[rarity];
    return Math.round(baseExp * multiplier);
}
// Kinh nghiệm rác nhận được khi phân rã
function getDestinyScrapExp(level, rarity) {
    return Math.round(100 * exports.DESTINY_RARITY_MULTIPLIER[rarity] + (level - 1) * 50);
}
