"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.caveService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const itemConstants_1 = require("../config/itemConstants");
class CaveService {
    getCave(userId) {
        let cave = database_1.default.prepare('SELECT * FROM user_caves WHERE user_id = ?').get(userId);
        if (!cave) {
            database_1.default.prepare(`
        INSERT INTO user_caves (user_id, level, decoration, spring_level, spring_available, last_spring_collect, last_raid_time, trap_item_id)
        VALUES (?, 1, '[]', 1, 1, '', 0, NULL)
      `).run(userId);
            cave = database_1.default.prepare('SELECT * FROM user_caves WHERE user_id = ?').get(userId);
        }
        // Reset daily spring
        const today = new Date().toDateString();
        if (cave.last_spring_collect !== today) {
            let maxSpring = 1;
            if (cave.level === 2)
                maxSpring = 2;
            else if (cave.level === 3)
                maxSpring = 2;
            else if (cave.level === 4)
                maxSpring = 3;
            else if (cave.level >= 5)
                maxSpring = 3;
            database_1.default.prepare('UPDATE user_caves SET spring_available = ?, last_spring_collect = ? WHERE user_id = ?')
                .run(maxSpring, today, userId);
            cave.spring_available = maxSpring;
            cave.last_spring_collect = today;
        }
        return cave;
    }
    getUpgradeCost(level) {
        if (level === 1)
            return { lt: 1000, knb: 0, reqItems: [] };
        if (level === 2)
            return { lt: 5000, knb: 0, reqItems: [{ id: itemConstants_1.ITEMS.MATERIAL_IRON_1, quantity: 10 }] };
        if (level === 3)
            return { lt: 20000, knb: 0, reqItems: [{ id: 'material_herb_1', quantity: 20 }] };
        if (level === 4)
            return { lt: 0, knb: 50, reqItems: [] };
        return null;
    }
    collectSpring(userId) {
        const cave = this.getCave(userId);
        if (cave.spring_available <= 0) {
            return { success: false, message: 'Đã cạn kiệt Linh Tuyền hôm nay. Hãy quay lại vào ngày mai!' };
        }
        const { cultivationService } = require('./CultivationService');
        cultivationService.claimIdleCultivation(userId);
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        // Tính % Tu vi dựa theo cấp động phủ
        let expPercent = 0.05;
        if (cave.level >= 5)
            expPercent = 0.08;
        const gainedExp = Math.round(user.exp_needed * expPercent);
        const newTuVi = Math.min(user.tu_vi + gainedExp, user.exp_needed);
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE user_caves SET spring_available = spring_available - 1 WHERE user_id = ?').run(userId);
            UserRepository_1.userRepository.update(userId, { tu_vi: newTuVi });
        })();
        return { success: true, message: `🌊 Đạo hữu ngâm mình trong Linh Tuyền, cảm nhận linh khí dồi dào chảy vào kinh mạch! Nhận được **+${gainedExp}** Tu Vi.` };
    }
}
exports.caveService = new CaveService();
