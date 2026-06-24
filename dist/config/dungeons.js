"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUNGEONS = void 0;
const itemConstants_1 = require("./itemConstants");
exports.DUNGEONS = {
    dungeon_luyen_khi_1: {
        id: 'dungeon_luyen_khi_1',
        name: 'U Minh Cốc (Luyện Khí)',
        description: 'Thung lũng u ám bao phủ bởi sương mù độc, là nơi thích hợp cho tu sĩ Luyện Khí Kỳ rèn luyện.',
        minLevel: 1,
        maxDailyEntries: 3,
        monster: {
            name: 'U Minh Khuyển',
            element: 'Thổ',
            hp: 188,
            maxHp: 188,
            atk: 23,
            def: 10,
            crit: 0.05,
            critRes: 0.0,
        },
        rewards: {
            exp: 100, // Tăng 100 tu vi
            coinMin: 20,
            coinMax: 40,
            loots: [
                { itemId: itemConstants_1.ITEMS.PILL_HP_1, rate: 0.50, quantity: 1 }, // 50% hồi huyết đan hạ phẩm
                { itemId: itemConstants_1.ITEMS.WEAPON_SWORD_1, rate: 0.15, quantity: 1 }, // 15% kiếm gỗ thanh phong
                { itemId: itemConstants_1.ITEMS.ARMOR_ROBE_1, rate: 0.15, quantity: 1 }, // 15% đạo bào thanh lam
                { itemId: itemConstants_1.ITEMS.MATERIAL_IRON_1, rate: 0.40, quantity: 2 }, // 40% huyền thiết sa
            ]
        }
    },
    dungeon_truc_co_1: {
        id: 'dungeon_truc_co_1',
        name: 'Huyết Ma Động (Trúc Cơ)',
        description: 'Hang động cổ xưa nhuốm đầy máu của yêu ma, sinh vật bên trong cực kỳ hung tợn.',
        minLevel: 39, // Trúc Cơ Kỳ Tầng 1
        maxDailyEntries: 3,
        monster: {
            name: 'Huyết Ma Binh',
            element: 'Hỏa',
            hp: 1875,
            maxHp: 1875,
            atk: 175,
            def: 113,
            crit: 0.08,
            critRes: 0.02,
        },
        rewards: {
            exp: 800,
            coinMin: 80,
            coinMax: 150,
            loots: [
                { itemId: itemConstants_1.ITEMS.PILL_HP_2, rate: 0.50, quantity: 1 }, // 50% hồi huyết đan trung phẩm
                { itemId: itemConstants_1.ITEMS.PILL_BREAK_1, rate: 0.25, quantity: 1 }, // 25% trúc cơ đan
                { itemId: itemConstants_1.ITEMS.WEAPON_SWORD_2, rate: 0.20, quantity: 1 }, // 20% Xích Long Kiếm
                { itemId: itemConstants_1.ITEMS.ARMOR_ROBE_2, rate: 0.20, quantity: 1 }, // 20% Thăng Long Đạo Bào
                { itemId: itemConstants_1.ITEMS.TALISMAN_SPEED_1, rate: 0.35, quantity: 1 }, // 35% Thần Hành Phù
            ]
        }
    },
    dungeon_kim_dan_1: {
        id: 'dungeon_kim_dan_1',
        name: 'Vạn Kiếm Lăng (Kim Đan)',
        description: 'Nghĩa địa kiếm cổ ngưng tụ linh lực kiếm ý bàng bạc, Kiếm Hồn Lão Tổ tọa trấn trung tâm.',
        minLevel: 77, // Kim Đan Kỳ Tầng 1
        maxDailyEntries: 3,
        monster: {
            name: 'Kiếm Hồn Lão Tổ',
            element: 'Kim',
            hp: 10000,
            maxHp: 10000,
            atk: 625,
            def: 400,
            crit: 0.12,
            critRes: 0.05,
        },
        rewards: {
            exp: 5000,
            coinMin: 300,
            coinMax: 600,
            loots: [
                { itemId: itemConstants_1.ITEMS.WEAPON_SWORD_3, rate: 0.20, quantity: 1 }, // 20% Thiên Cổ Phán Quyết (Epic)
                { itemId: itemConstants_1.ITEMS.ARMOR_ROBE_3, rate: 0.20, quantity: 1 }, // 20% Thăng Quang Huyền Giáp (Epic)
                { itemId: itemConstants_1.ITEMS.PILL_BREAK_1, rate: 0.40, quantity: 2 }, // 40% x2 trúc cơ đan
                { itemId: itemConstants_1.ITEMS.TALISMAN_SPEED_1, rate: 0.50, quantity: 2 }, // 50% x2 Thần Hành Phù
                { itemId: itemConstants_1.ITEMS.SEED_VOID_HERB, rate: 0.20, quantity: 1 }, // 20% hạt hư không thảo
            ]
        }
    }
};
