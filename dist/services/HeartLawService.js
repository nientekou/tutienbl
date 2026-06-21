"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartLawService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
class HeartLawService {
    /**
     * Lấy thông tin một Tâm Pháp từ database
     */
    getHeartLaw(id) {
        return database_1.default.prepare('SELECT * FROM heart_laws WHERE id = ?').get(id);
    }
    /**
     * Lấy tất cả Tâm Pháp hệ thống
     */
    getAllHeartLaws() {
        return database_1.default.prepare('SELECT * FROM heart_laws').all();
    }
    /**
     * Lấy tiến trình Tâm Pháp của một user
     */
    getUserHeartLaws(userId) {
        const all = this.getAllHeartLaws();
        const userHL = database_1.default.prepare('SELECT * FROM user_heart_laws WHERE user_id = ?').all(userId);
        const userHLMap = new Map();
        for (const hl of userHL) {
            userHLMap.set(hl.heart_law_id, hl);
        }
        return all.map(l => {
            const uhl = userHLMap.get(l.id);
            return {
                ...l,
                level: uhl?.level || 0,
                fragments: uhl?.fragments || 0,
                is_equipped: uhl?.is_equipped || 0
            };
        });
    }
    /**
     * Lấy danh sách 3 Tâm Pháp đang trang bị
     */
    getEquippedHeartLaws(userId) {
        return this.getUserHeartLaws(userId).filter(l => l.is_equipped > 0).sort((a, b) => a.is_equipped - b.is_equipped);
    }
    /**
     * Thêm mảnh Tâm Pháp (đại diện cho việc ghép hoặc lượm mảnh)
     */
    addFragments(userId, lawId, amount) {
        let row = database_1.default.prepare('SELECT * FROM user_heart_laws WHERE user_id = ? AND heart_law_id = ?').get(userId, lawId);
        if (!row) {
            database_1.default.prepare(`
        INSERT INTO user_heart_laws (user_id, heart_law_id, level, fragments, is_equipped)
        VALUES (?, ?, 0, ?, 0)
      `).run(userId, lawId, amount);
        }
        else {
            database_1.default.prepare('UPDATE user_heart_laws SET fragments = fragments + ? WHERE user_id = ? AND heart_law_id = ?').run(amount, userId, lawId);
        }
    }
    /**
     * Lĩnh ngộ Tâm Pháp từ mảnh ghép (cần 5 mảnh để kích hoạt cấp 1)
     */
    learnHeartLaw(userId, lawId) {
        const row = database_1.default.prepare('SELECT * FROM user_heart_laws WHERE user_id = ? AND heart_law_id = ?').get(userId, lawId);
        if (!row || row.fragments < 5) {
            return { success: false, message: 'Đạo hữu không đủ 5 mảnh Tâm Pháp để lĩnh ngộ!' };
        }
        if (row.level > 0) {
            return { success: false, message: 'Tâm Pháp này đã được lĩnh ngộ rồi! Hãy dùng lệnh nâng cấp.' };
        }
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE user_heart_laws SET level = 1, fragments = fragments - 5 WHERE user_id = ? AND heart_law_id = ?').run(userId, lawId);
        })();
        const law = this.getHeartLaw(lawId);
        return { success: true, message: `🎉 Lĩnh ngộ thành công Tâm Pháp **[${law.name}]** cấp 1!` };
    }
    /**
     * Trang bị Tâm Pháp vào 1 ô (1, 2, 3)
     */
    equipHeartLaw(userId, lawId, slot) {
        if (![1, 2, 3].includes(slot)) {
            return { success: false, message: 'Chỉ có thể trang bị vào ô số 1, 2 hoặc 3!' };
        }
        const userLaws = this.getUserHeartLaws(userId);
        const target = userLaws.find(l => l.id === lawId);
        if (!target || target.level === 0) {
            return { success: false, message: 'Đạo hữu chưa lĩnh ngộ Tâm Pháp này!' };
        }
        database_1.default.transaction(() => {
            // 1. Tháo Tâm Pháp ở ô này nếu có
            database_1.default.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND is_equipped = ?').run(userId, slot);
            // 2. Tháo Tâm Pháp này ở ô khác nếu đang trang bị
            database_1.default.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND heart_law_id = ?').run(userId, lawId);
            // 3. Trang bị vào ô mong muốn
            database_1.default.prepare('UPDATE user_heart_laws SET is_equipped = ? WHERE user_id = ? AND heart_law_id = ?').run(slot, userId, lawId);
        })();
        return { success: true, message: `✅ Đã trang bị Tâm Pháp **[${target.name}]** vào ô số **${slot}**!` };
    }
    /**
     * Tháo trang bị Tâm Pháp ở ô cụ thể
     */
    unequipHeartLaw(userId, slot) {
        if (![1, 2, 3].includes(slot)) {
            return { success: false, message: 'Ô trang bị không hợp lệ!' };
        }
        const equipped = this.getEquippedHeartLaws(userId).find(l => l.is_equipped === slot);
        if (!equipped) {
            return { success: false, message: `Ô số **${slot}** hiện đang trống!` };
        }
        database_1.default.prepare('UPDATE user_heart_laws SET is_equipped = 0 WHERE user_id = ? AND is_equipped = ?').run(userId, slot);
        return { success: true, message: `✅ Đã tháo Tâm Pháp **[${equipped.name}]** khỏi ô số **${slot}**!` };
    }
    /**
     * Nâng cấp Tâm Pháp hiện tại (Cấp 1 - 10)
     */
    levelUpHeartLaw(userId, lawId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const userLaws = this.getUserHeartLaws(userId);
        const target = userLaws.find(l => l.id === lawId);
        if (!target || target.level === 0) {
            return { success: false, message: 'Đạo hữu chưa lĩnh ngộ Tâm Pháp này!' };
        }
        if (target.level >= 10) {
            return { success: false, message: 'Tâm Pháp đã đạt cấp độ tối đa (cấp 10)!' };
        }
        const nextLevel = target.level + 1;
        // Chi phí nâng cấp
        const fragCost = target.level * 5; // VD: 1->2 cần 5 mảnh, 2->3 cần 10 mảnh...
        const coinCost = target.level * 1000;
        const ngoTinhCost = Math.floor(target.level / 2) + 1; // 1->2 cần 1 ngộ tính, 2->3 cần 2 ngộ tính...
        if (target.fragments < fragCost) {
            return { success: false, message: `Không đủ mảnh ghép! Yêu cầu **${fragCost}** mảnh Tâm Pháp (Hiện có **${target.fragments}**).` };
        }
        if (user.coin_ha_pham < coinCost) {
            return { success: false, message: `Không đủ Linh Thạch! Yêu cầu **${coinCost.toLocaleString()}** Hạ Phẩm Linh Thạch (Hiện có **${user.coin_ha_pham.toLocaleString()}**).` };
        }
        if (user.ngotinh < ngoTinhCost) {
            return { success: false, message: `Không đủ Ngộ Tính! Yêu cầu **${ngoTinhCost}** điểm Ngộ Tính (Hiện có **${user.ngotinh}**).` };
        }
        database_1.default.transaction(() => {
            // Trừ tài nguyên
            UserRepository_1.userRepository.update(userId, {
                coin_ha_pham: user.coin_ha_pham - coinCost,
                ngotinh: user.ngotinh - ngoTinhCost
            });
            // Trừ mảnh & Cập nhật cấp độ
            database_1.default.prepare('UPDATE user_heart_laws SET level = ?, fragments = fragments - ? WHERE user_id = ? AND heart_law_id = ?')
                .run(nextLevel, fragCost, userId, lawId);
        })();
        return { success: true, message: `📈 Đột phá thành công Tâm Pháp **[${target.name}]** thăng lên **Cấp ${nextLevel}**!` };
    }
    /**
     * Tính toán các chỉ số buff Tâm Pháp đang mang (đã tính cộng hưởng huyết mạch)
     */
    getActivePassives(userId) {
        const equipped = this.getEquippedHeartLaws(userId);
        if (equipped.length === 0)
            return [];
        // Lấy huyết mạch của người dùng để tính cộng hưởng ngũ hành
        let bloodlineId = '';
        try {
            const bl = database_1.default.prepare('SELECT bloodline_id FROM user_bloodlines WHERE user_id = ?').get(userId);
            if (bl)
                bloodlineId = bl.bloodline_id;
        }
        catch (e) { }
        const bloodlineElementMap = {
            'phuong_hoang': 'Hỏa',
            'huyen_vu': 'Thủy',
            'con_luan': 'Thổ',
            'bach_ho': 'Kim',
            'thanh_long': 'Mộc',
            'long_huyet': 'Hỏa'
        };
        const userElement = bloodlineElementMap[bloodlineId] || 'Vô';
        return equipped.map(l => {
            let effectObj = { type: '', value: 0 };
            try {
                effectObj = JSON.parse(l.base_effect);
            }
            catch (e) { }
            // Mỗi level tăng +10% giá trị gốc: value * (1 + (level - 1) * 0.1)
            let baseVal = effectObj.value * (1 + (l.level - 1) * 0.1);
            let scale = 1.0;
            if (l.element !== 'Vô') {
                if (l.element === userElement) {
                    scale = 1.5; // Cộng hưởng ngũ hành huyết mạch -> 1.5x
                }
                else if (userElement !== 'Vô') {
                    scale = 0.8; // Khác hệ (không neutral) -> giảm 20% hiệu quả (0.8x)
                }
            }
            return {
                type: effectObj.type,
                value: baseVal * scale,
                lawName: l.name,
                element: l.element,
                scale
            };
        });
    }
}
exports.heartLawService = new HeartLawService();
