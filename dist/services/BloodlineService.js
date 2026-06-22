"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bloodlineService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AchievementService_1 = require("./AchievementService");
class BloodlineService {
    getAllBloodlines() {
        return database_1.default.prepare('SELECT * FROM bloodlines').all();
    }
    getUserBloodline(userId) {
        const row = database_1.default.prepare(`
      SELECT ub.*, b.name, b.description, b.passives, b.weakness, b.rage_effect
      FROM user_bloodlines ub
      JOIN bloodlines b ON ub.bloodline_id = b.id
      WHERE ub.user_id = ?
    `).get(userId);
        if (!row)
            return null;
        return {
            ...row,
            passives: JSON.parse(row.passives || '{}'),
            weakness: JSON.parse(row.weakness || '{}'),
            rage_effect: JSON.parse(row.rage_effect || '{}'),
        };
    }
    chooseBloodline(userId, bloodlineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        if (user.level < 10)
            return { success: false, message: 'Cần đạt Cấp 10 để giác tỉnh Huyết Mạch!' };
        const existing = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (existing)
            return { success: false, message: 'Đạo hữu đã giác tỉnh Huyết Mạch rồi! Hãy dùng Huyết Mạch Chuyển Hóa Đan để thay đổi.' };
        const bloodline = database_1.default.prepare('SELECT * FROM bloodlines WHERE id = ?').get(bloodlineId);
        if (!bloodline)
            return { success: false, message: 'Huyết mạch không tồn tại!' };
        if (user.coin_ha_pham < 500)
            return { success: false, message: 'Thiếu 500 Linh Thạch phí giác tỉnh!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 500 });
            database_1.default.prepare(`
        INSERT INTO user_bloodlines (user_id, bloodline_id, level, exp, activated_at, rage_cooldown)
        VALUES (?, ?, 1, 0, ?, 0)
      `).run(userId, bloodlineId, now);
        })();
        // Kiểm tra thành tựu Thiên Mệnh Chi Tử
        AchievementService_1.achievementService.setProgress(userId, 'tl_19', 1);
        return { success: true, message: `🩸 Chúc mừng! Đạo hữu đã giác tỉnh thành công **${bloodline.name}**!` };
    }
    changeBloodline(userId, newBloodlineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const existing = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (!existing)
            return { success: false, message: 'Đạo hữu chưa giác tỉnh Huyết Mạch! Dùng /huyetmach chon để giác tỉnh.' };
        const bloodline = database_1.default.prepare('SELECT * FROM bloodlines WHERE id = ?').get(newBloodlineId);
        if (!bloodline)
            return { success: false, message: 'Huyết mạch mới không tồn tại!' };
        const requiredItem = 'item_bloodline_pill'; // ID của Huyết Mạch Chuyển Hóa Đan
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const item = inv.find(i => i.item_id === requiredItem && i.is_equipped === 0);
        if (!item || item.quantity < 1) {
            return { success: false, message: 'Đạo hữu cần 1 viên **Huyết Mạch Chuyển Hóa Đan** để thay đổi huyết mạch!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            if (item.quantity > 1) {
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(item.id);
            }
            else {
                database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
            }
            database_1.default.prepare(`
        UPDATE user_bloodlines 
        SET bloodline_id = ?, level = 1, exp = 0, activated_at = ?, rage_cooldown = 0
        WHERE user_id = ?
      `).run(newBloodlineId, now, userId);
        })();
        // Kiểm tra thành tựu Thiên Mệnh Chi Tử
        AchievementService_1.achievementService.setProgress(userId, 'tl_19', 1);
        return { success: true, message: `🩸 Đạo hữu đã chuyển đổi thành công sang **${bloodline.name}**. Huyết mạch tu vi quay về cấp 1!` };
    }
    addExp(userId, expAmount) {
        const ub = database_1.default.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
        if (!ub)
            return;
        if (ub.level >= 50)
            return; // Max level
        let currentExp = ub.exp;
        let currentLevel = ub.level;
        currentExp += expAmount;
        let expNeeded = currentLevel * 200;
        while (currentExp >= expNeeded && currentLevel < 50) {
            currentExp -= expNeeded;
            currentLevel++;
            expNeeded = currentLevel * 200;
        }
        if (currentLevel >= 50) {
            currentLevel = 50;
            currentExp = 0;
        }
        database_1.default.prepare('UPDATE user_bloodlines SET level = ?, exp = ? WHERE user_id = ?').run(currentLevel, currentExp, userId);
    }
    getActivePassives(ub) {
        const result = {};
        const passives = ub.passives;
        // levels = ['1', '10', '25', '50']
        const breakpoints = [1, 10, 25, 50];
        for (const bp of breakpoints) {
            if (ub.level >= bp && passives[bp.toString()]) {
                const p = passives[bp.toString()];
                result[p.stat] = p.value;
            }
        }
        return result;
    }
    updateRageCooldown(userId, newCooldown) {
        database_1.default.prepare('UPDATE user_bloodlines SET rage_cooldown = ? WHERE user_id = ?').run(newCooldown, userId);
    }
}
exports.bloodlineService = new BloodlineService();
