"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destinyService = exports.DestinyService = void 0;
const DestinyRepository_1 = require("../database/repositories/DestinyRepository");
const UserRepository_1 = require("../database/repositories/UserRepository");
const destinies_1 = require("../config/destinies");
class DestinyService {
    /**
     * Tính toán tối đa slot được trang bị dựa vào Cảnh Giới
     */
    getMaxSlotsByRealm(realm) {
        if (realm.includes('Luyện Khí'))
            return 0; // LK không có slot
        if (realm.includes('Trúc Cơ'))
            return 1;
        if (realm.includes('Kim Đan'))
            return 2;
        if (realm.includes('Nguyên Anh'))
            return 3;
        if (realm.includes('Hóa Thần'))
            return 4;
        if (realm.includes('Luyện Hư'))
            return 5;
        return 6; // Hợp Thể trở lên full 6 slot
    }
    /**
     * Roll Bốc Quẻ (Gacha) 1 lần
     * Tỷ lệ: Thường 60%, Hiếm 30%, Cực Phẩm 9%, Tiên Phẩm 1%
     */
    rollGacha(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại' };
        if (user.coin_ha_pham < destinies_1.DESTINY_GACHA_COST) {
            return { success: false, message: `Không đủ Linh Thạch. Bốc quẻ cần **${destinies_1.DESTINY_GACHA_COST}** Hạ Phẩm Linh Thạch.` };
        }
        // Trừ tiền
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - destinies_1.DESTINY_GACHA_COST });
        // Roll Rarity
        const randRarity = Math.random();
        let rarity = 'thuong';
        if (randRarity < 0.01)
            rarity = 'tien_pham';
        else if (randRarity < 0.10)
            rarity = 'cuc_pham';
        else if (randRarity < 0.40)
            rarity = 'hiem';
        // Roll Type
        const typeKeys = Object.keys(destinies_1.DESTINY_TYPES);
        const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
        DestinyRepository_1.destinyRepository.addDestiny(userId, randomType, rarity);
        return {
            success: true,
            message: `Đã tiêu hao ${destinies_1.DESTINY_GACHA_COST} Linh Thạch. Mở ra Mệnh Cách **${rarity.toUpperCase()}**!`
        };
    }
    /**
     * Tính toán tổng chỉ số cộng thêm từ tất cả Mệnh Cách đang trang bị
     */
    calculateDestinyBonus(userId) {
        const destinies = DestinyRepository_1.destinyRepository.getUserDestinies(userId).filter(d => d.is_equipped === 1);
        const bonuses = {
            atk_percent: 0,
            def_percent: 0,
            hp_percent: 0,
            crit_rate: 0,
            crit_damage: 0,
            dodge_rate: 0,
            speed_bonus: 0
        };
        for (const dest of destinies) {
            const config = destinies_1.DESTINY_TYPES[dest.destiny_id];
            if (config) {
                const totalBonus = config.baseValue + (dest.level - 1) * config.scalePerLevel;
                bonuses[dest.destiny_id] += totalBonus;
            }
        }
        return bonuses;
    }
}
exports.DestinyService = DestinyService;
exports.destinyService = new DestinyService();
