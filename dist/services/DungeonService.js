"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dungeonService = exports.DungeonService = void 0;
const CombatService_1 = require("./CombatService");
const DungeonRepository_1 = require("../database/repositories/DungeonRepository");
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const InventoryService_1 = require("./InventoryService");
const constants_1 = require("../utils/constants");
class DungeonService {
    // Danh sách 10 Đại Bí Cảnh tương ứng cảnh giới
    dungeons = [
        {
            id: 'dungeon_1',
            name: '⚒️ Tây Sơn Huyệt Động (Luyện Khí)',
            monsterName: 'Linh Hầu Tây Sơn',
            minLevel: 1,
            monsterStats: { hp: 200, maxHp: 200, mp: 50, atk: 25, def: 10, crit: 0.05, critRes: 0.0, luck: 8 },
            rewards: {
                minCoins: 15,
                maxCoins: 35,
                drops: [
                    { itemId: 'pill_hp_1', name: 'Hồi Huyết Đan - Hạ Phẩm', chance: 0.50 },
                    { itemId: 'seed_linh_thao_1', name: 'Hạt Giống Linh Thảo', chance: 0.30 },
                    { itemId: 'material_iron_1', name: 'Huyền Thiết Sa', chance: 0.20 }
                ]
            }
        },
        {
            id: 'dungeon_2',
            name: '🐊 Thiết Giáp Thâm Uyên (Trúc Cơ)',
            monsterName: 'Thiết Giáp Ngạc Ngư',
            minLevel: 39,
            monsterStats: { hp: 800, maxHp: 800, mp: 100, atk: 75, def: 40, crit: 0.05, critRes: 0.03, luck: 10 },
            rewards: {
                minCoins: 50,
                maxCoins: 120,
                drops: [
                    { itemId: 'pill_hp_2', name: 'Hồi Huyết Đan - Trung Phẩm', chance: 0.40 },
                    { itemId: 'pill_break_1', name: 'Trúc Cơ Đan', chance: 0.25 }
                ]
            }
        },
        {
            id: 'dungeon_3',
            name: '🔥 Xích Viêm Hỏa Địa (Kim Đan)',
            monsterName: 'Hỏa Diệm Sư Tử',
            minLevel: 77,
            monsterStats: { hp: 2000, maxHp: 2000, mp: 300, atk: 210, def: 100, crit: 0.08, critRes: 0.05, luck: 15 },
            rewards: {
                minCoins: 150,
                maxCoins: 300,
                drops: [
                    { itemId: 'pill_hp_2', name: 'Hồi Huyết Đan - Trung Phẩm', chance: 0.50 },
                    { itemId: 'pill_break_1', name: 'Trúc Cơ Đan', chance: 0.35 }
                ]
            }
        },
        {
            id: 'dungeon_4',
            name: '💀 Vạn Quỷ Cự Khê (Nguyên Anh)',
            monsterName: 'Hắc Yêu Quỷ Vương',
            minLevel: 115,
            monsterStats: { hp: 5000, maxHp: 5000, mp: 500, atk: 550, def: 280, crit: 0.10, critRes: 0.08, luck: 20 },
            rewards: {
                minCoins: 400,
                maxCoins: 800,
                drops: [
                    { itemId: 'talisman_speed_1', name: 'Thần Hành Phù', chance: 0.40 },
                    { itemId: 'pill_break_1', name: 'Trúc Cơ Đan', chance: 0.30 }
                ]
            }
        },
        {
            id: 'dungeon_5',
            name: '❄️ Hàn Băng Cực Vực (Hóa Thần)',
            monsterName: 'Băng Sương Cự Long',
            minLevel: 153,
            monsterStats: { hp: 12000, maxHp: 12000, mp: 1000, atk: 1200, def: 600, crit: 0.12, critRes: 0.10, luck: 25 },
            rewards: {
                minCoins: 800,
                maxCoins: 1500,
                drops: [
                    { itemId: 'talisman_speed_1', name: 'Thần Hành Phù', chance: 0.50 },
                    { itemId: 'pill_hp_2', name: 'Hồi Huyết Đan - Trung Phẩm', chance: 0.60 }
                ]
            }
        },
        {
            id: 'dungeon_6',
            name: '⚡ Cửu Tiêu Lôi Trì (Luyện Hư)',
            monsterName: 'Lôi Điệp Thần Thú',
            minLevel: 191,
            monsterStats: { hp: 28000, maxHp: 28000, mp: 2000, atk: 2500, def: 1200, crit: 0.15, critRes: 0.12, luck: 30 },
            rewards: {
                minCoins: 1500,
                maxCoins: 3000,
                drops: [
                    { itemId: 'material_iron_1', name: 'Huyền Thiết Sa', chance: 0.80 }
                ]
            }
        },
        {
            id: 'dungeon_7',
            name: '🌌 Hư Không Thâm Uyên (Hợp Thể)',
            monsterName: 'Hư Không Thôn Phệ Giả',
            minLevel: 229,
            monsterStats: { hp: 60000, maxHp: 60000, mp: 4000, atk: 5000, def: 2400, crit: 0.15, critRes: 0.15, luck: 35 },
            rewards: {
                minCoins: 3000,
                maxCoins: 6000,
                drops: [
                    { itemId: 'pill_break_1', name: 'Trúc Cơ Đan', chance: 0.50 }
                ]
            }
        },
        {
            id: 'dungeon_8',
            name: '🏛️ Hồng Hoang Cổ Điện (Đại Thừa)',
            monsterName: 'Hồng Hoang Chiến Thần',
            minLevel: 267,
            monsterStats: { hp: 120000, maxHp: 120000, mp: 8000, atk: 10000, def: 4800, crit: 0.20, critRes: 0.18, luck: 40 },
            rewards: {
                minCoins: 6000,
                maxCoins: 12000,
                drops: [
                    { itemId: 'weapon_sword_1', name: 'Thanh Phong Kiếm', chance: 0.30 }
                ]
            }
        },
        {
            id: 'dungeon_9',
            name: '⛈️ Thiên Kiếp Đạo Trường (Độ Kiếp)',
            monsterName: 'Lôi Kiếp Cự Nhân',
            minLevel: 305,
            monsterStats: { hp: 250000, maxHp: 250000, mp: 15000, atk: 20000, def: 10000, crit: 0.25, critRes: 0.20, luck: 50 },
            rewards: {
                minCoins: 12000,
                maxCoins: 25000,
                drops: [
                    { itemId: 'armor_robe_1', name: 'Đạo Bào Thanh Lam', chance: 0.30 }
                ]
            }
        },
        {
            id: 'dungeon_10',
            name: '👑 Chí Tôn Cực Cảnh (Đăng Tiên)',
            monsterName: 'Chí Tôn Linh Ảnh',
            minLevel: 343,
            monsterStats: { hp: 500000, maxHp: 500000, mp: 30000, atk: 45000, def: 20000, crit: 0.30, critRes: 0.25, luck: 60 },
            rewards: {
                minCoins: 25000,
                maxCoins: 50000,
                drops: [
                    { itemId: 'pill_break_1', name: 'Trúc Cơ Đan', chance: 1.00 }
                ]
            }
        }
    ];
    /**
     * Chạy phụ bản Bí Cảnh PvE
     */
    runDungeon(userId, dungeonId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh `/taonhanvat`!' };
        }
        const dungeon = this.dungeons.find(d => d.id === dungeonId);
        if (!dungeon) {
            return { success: false, message: 'Bí Cảnh không tồn tại.' };
        }
        // 1. Kiểm tra Cảnh Giới tối thiểu
        if (user.level < dungeon.minLevel) {
            const reqRealm = (0, constants_1.getRealmDetails)(dungeon.minLevel);
            return {
                success: false,
                message: `Cảnh giới của đạo hữu quá thấp! Bí cảnh yêu cầu tối thiểu: **${reqRealm.fullName}**`
            };
        }
        // 2. Kiểm tra Cooldown lượt đi hàng ngày (Tối đa 3 lượt)
        const cooldown = DungeonRepository_1.dungeonRepository.getCooldown(userId, dungeonId);
        if (cooldown.daily_entries >= 3) {
            return {
                success: false,
                message: `Đạo hữu đã dùng hết **3/3** lượt thám hiểm Bí Cảnh này trong ngày hôm nay. Hãy quay lại vào ngày mai!`
            };
        }
        // 3. Chuẩn bị chỉ số người chơi (Kèm theo Buff trang bị đeo đồ)
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (!activeStats) {
            return { success: false, message: 'Lỗi đồng bộ chỉ số nhân vật.' };
        }
        const playerCombatant = {
            name: user.name,
            hp: activeStats.hp,
            maxHp: activeStats.hp,
            mp: activeStats.mp,
            atk: activeStats.atk,
            def: activeStats.def,
            crit: activeStats.crit,
            critRes: activeStats.critRes,
            luck: activeStats.luck
        };
        const monsterCombatant = {
            name: dungeon.monsterName,
            ...dungeon.monsterStats
        };
        // 4. Thực thi chiến đấu
        const fightResult = CombatService_1.combatService.simulateFight(playerCombatant, monsterCombatant);
        // Tăng số lượt đi (Dù thắng hay thua đều tốn lượt)
        DungeonRepository_1.dungeonRepository.incrementEntry(userId, dungeonId);
        if (!fightResult.success) {
            return {
                success: false,
                winner: fightResult.winner,
                logs: fightResult.logs,
                message: `❌ **Thất Bại!** Đạo hữu đã bị đánh bại bởi **${dungeon.monsterName}**. Hãy nâng cao tu vi hoặc cường hóa trang bị để thử lại!`
            };
        }
        // 5. Tính toán và phát phần thưởng khi THẮNG CUỘC
        const earnedCoins = Math.floor(Math.random() * (dungeon.rewards.maxCoins - dungeon.rewards.minCoins + 1)) + dungeon.rewards.minCoins;
        const dropItems = [];
        for (const drop of dungeon.rewards.drops) {
            if (Math.random() <= drop.chance) {
                InventoryRepository_1.inventoryRepository.addItem(userId, drop.itemId, 1);
                dropItems.push(drop.name);
            }
        }
        // Cộng Linh Thạch vào tài khoản tu sĩ
        UserRepository_1.userRepository.update(userId, {
            coin_ha_pham: user.coin_ha_pham + earnedCoins
        });
        return {
            success: true,
            winner: fightResult.winner,
            logs: fightResult.logs,
            rewards: {
                coins: earnedCoins,
                items: dropItems
            },
            message: `🎉 **Chiến Thắng!** Đạo hữu đánh bại **${dungeon.monsterName}** thám hiểm Bí Cảnh thành công!`
        };
    }
}
exports.DungeonService = DungeonService;
exports.dungeonService = new DungeonService();
