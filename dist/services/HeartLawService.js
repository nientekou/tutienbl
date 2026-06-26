"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartLawService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const HOA = 'Hỏa';
const THUY = 'Thủy';
const MOC = 'Mộc';
const THO = 'Thổ';
const KIM = 'Kim';
const LOI = 'Lôi';
const PHONG = 'Phong';
const VO = 'Vô';
const HEART_LAW_SET_ABILITIES = {
    [HOA]: {
        element: HOA,
        name: 'Hỏa Phương Phẫn Nộ',
        description: '+25% ATK 1 round NHƯNG -10% DEF round đó',
        buff: { type: 'atk_percent', value: 0.25, rounds: 1 },
        nerf: { type: 'def_percent', value: -0.10, rounds: 1 }
    },
    [THUY]: {
        element: THUY,
        name: 'Thủy Long Hồi Thiên',
        description: '+20% HP heal NHƯNG costs 20% MP',
        buff: { type: 'heal_percent', value: 0.20, rounds: 1 },
        nerf: { type: 'mp_cost_percent', value: 0.20, rounds: 1 }
    },
    [MOC]: {
        element: MOC,
        name: 'Mừc Linh Hấp Thụ',
        description: '+15% lifesteal 2 rounds NHƯNG -10% ATK',
        buff: { type: 'lifesteal', value: 0.15, rounds: 2 },
        nerf: { type: 'atk_percent', value: -0.10, rounds: 2 }
    },
    [THO]: {
        element: THO,
        name: 'Thổ Thân Hộ Thể',
        description: '+25% DEF 2 rounds NHƯNG -8% Speed',
        buff: { type: 'def_percent', value: 0.25, rounds: 2 },
        nerf: { type: 'speed_percent', value: -0.08, rounds: 2 }
    },
    [KIM]: {
        element: KIM,
        name: 'Kim Tình Sát Lục',
        description: '+20% Crit Rate 1 round NHƯNG -15% CritRes',
        buff: { type: 'crit_rate', value: 0.20, rounds: 1 },
        nerf: { type: 'crit_res', value: -0.15, rounds: 1 }
    },
    [LOI]: {
        element: LOI,
        name: 'Lơi Đình Vạn Quân',
        description: 'Choáng kẻ địch 1 lượt NHƯNG tốn 30% MP',
        buff: { type: 'stun', value: 1, rounds: 1 },
        nerf: { type: 'mp_cost_percent', value: 0.30, rounds: 1 }
    },
    [PHONG]: {
        element: PHONG,
        name: 'Phong Hành Vô Tích',
        description: '+20% dodge 2 rounds NHƯNG -10% DEF',
        buff: { type: 'dodge_rate', value: 0.20, rounds: 2 },
        nerf: { type: 'def_percent', value: -0.10, rounds: 2 }
    }
};
const HEART_LAW_ULTIMATES = {
    [KIM]: { element: KIM, name: 'Vạn Kiếm Quy Tông', description: '250% ATK, ignore DEF 50%', effect: 'ult_kim', damage_mult: 2.5 },
    [MOC]: { element: MOC, name: 'Thiên Địa Hồi Xuân', description: 'Heal 40% max HP + cleanse debuffs', effect: 'ult_moc' },
    [THUY]: { element: THUY, name: 'Hà Hải Quy Nguyên', description: '200% ATK + freeze 2 lượt', effect: 'ult_thuy', damage_mult: 2.0 },
    [HOA]: { element: HOA, name: 'Liệt Diễm Phá Thiên', description: '300% ATK + burn 3 lượt', effect: 'ult_hoa', damage_mult: 3.0 },
    [THO]: { element: THO, name: 'Đại Địa Hộ Thể', description: 'Shield 30% max HP + reflect 20%', effect: 'ult_tho' },
    [LOI]: { element: LOI, name: 'Lôi Đình Vạn Cấp', description: '280% ATK + stun 1 lượt', effect: 'ult_loi', damage_mult: 2.8 },
    [PHONG]: { element: PHONG, name: 'Vô Tung Vô Tích', description: '3 đòn x 100% ATK', effect: 'ult_phong', damage_mult: 3.0 },
    [VO]: { element: VO, name: 'Hư Không Niết', description: '220% ATK, ignores ALL defense', effect: 'ult_vo', damage_mult: 2.2 },
};
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
        return { success: true, message: `Lĩnh ngộ thành công Tâm Pháp **[${law.name}]** cấp 1!` };
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
        return { success: true, message: `Đã trang bị Tâm Pháp **[${target.name}]** vào ô số **${slot}**!` };
    }
    /**
     * Tháo trang bị Tâm Pháp ở cụ thể
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
        return { success: true, message: `Đã tháo Tâm Pháp **[${equipped.name}]** khỏi ô số **${slot}**!` };
    }
    /**
     * Nâng cấp Tâm Pháp hiện tại (Cấp 1 - 10)
     */
    levelUpHeartLaw(userId, lawId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const userLaws = this.getUserHeartLaws(userId);
        const target = userLaws.find(l => l.id === lawId);
        if (!target || target.level === 0) {
            return { success: false, message: 'Đạo hữu chưa lĩnh ngộ Tâm Pháp này!' };
        }
        if (target.level >= 10) {
            return { success: false, message: 'Tâm Pháp đã đạt cấp độ tối đa (cấp 10)!' };
        }
        const nextLevel = target.level + 1;
        const fragCost = target.level * 5;
        const coinCost = target.level * 1000;
        const ngoTinhCost = Math.floor(target.level / 2) + 1;
        if (target.fragments < fragCost) {
            return { success: false, message: `Không đủ mạnh ghép! Yêu cầu **${fragCost}** mạnh Tâm Pháp (Hiện có **${target.fragments}**).` };
        }
        if (user.coin_ha_pham < coinCost) {
            return { success: false, message: `Không đủ Linh Thạch! Yêu cầu **${coinCost.toLocaleString()}** Hạ Phẩm Linh Thạch (Hiện có **${user.coin_ha_pham.toLocaleString()}**).` };
        }
        if (user.ngotinh < ngoTinhCost) {
            return { success: false, message: `Không đủ Ngộ Tính! Yêu cầu **${ngoTinhCost}** điểm Ngộ Tính (Hiện có **${user.ngotinh}**).` };
        }
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, {
                coin_ha_pham: user.coin_ha_pham - coinCost,
                ngotinh: user.ngotinh - ngoTinhCost
            });
            database_1.default.prepare('UPDATE user_heart_laws SET level = ?, fragments = fragments - ? WHERE user_id = ? AND heart_law_id = ?')
                .run(nextLevel, fragCost, userId, lawId);
        })();
        return { success: true, message: `Đột phá thành công Tâm Pháp **[${target.name}]** thăng lên **Cấp ${nextLevel}**!` };
    }
    /**
     * P1-07: Tính set bonus — đếm số lượng equipped laws theo element
     */
    getSetBonuses(userId) {
        const equipped = this.getEquippedHeartLaws(userId);
        const elementCounts = {};
        for (const law of equipped) {
            if (law.element && law.element !== VO) {
                elementCounts[law.element] = (elementCounts[law.element] || 0) + 1;
            }
        }
        return Object.entries(elementCounts).map(([element, count]) => ({
            element,
            count,
            has2Set: count >= 2,
            has3Set: count >= 3,
            ability: count >= 3 ? HEART_LAW_SET_ABILITIES[element] || null : null
        })).filter(s => s.count >= 2);
    }
    /**
     * P1-07: Lấy thông tin set ability cho element cụ thể
     */
    getSetAbility(element) {
        return HEART_LAW_SET_ABILITIES[element] || null;
    }
    /**
     * Tính toán chỉ số buff Tâm Pháp đang mang (đã tính cộng hưởng huyết mạch + set bonus)
     */
    getActivePassives(userId) {
        const equipped = this.getEquippedHeartLaws(userId);
        if (equipped.length === 0)
            return [];
        let bloodlineId = '';
        try {
            const bl = database_1.default.prepare('SELECT bloodline_id FROM user_bloodlines WHERE user_id = ?').get(userId);
            if (bl)
                bloodlineId = bl.bloodline_id;
        }
        catch (e) {
            console.warn('Claude-Opus Failed to fetch user bloodline:', e);
        }
        const bloodlineElementMap = {
            'phuong_hoang': HOA,
            'huyen_vu': THUY,
            'con_luan': THO,
            'bach_ho': KIM,
            'thanh_long': MOC,
            'long_huyet': HOA
        };
        const userElement = bloodlineElementMap[bloodlineId] || VO;
        // P1-07: Calculate set bonuses for 2-set effect (+10% effect value)
        const setBonuses = this.getSetBonuses(userId);
        const setBonusElements = new Set(setBonuses.filter(s => s.has2Set).map(s => s.element));
        return equipped.map(l => {
            let effectObj = { type: '', value: 0 };
            try {
                effectObj = JSON.parse(l.base_effect);
            }
            catch (e) {
                console.warn('Claude-Opus Failed to parse heart law base_effect:', e);
            }
            let baseVal = effectObj.value * (1 + (l.level - 1) * 0.1);
            let scale = 1.0;
            if (l.element !== VO) {
                if (l.element === userElement) {
                    scale = 1.5;
                }
                else if (userElement !== VO) {
                    scale = 0.8;
                }
            }
            // P1-07: 2-set bonus: +10% effect value for same-element laws
            const setMultiplier = setBonusElements.has(l.element) ? 1.10 : 1.0;
            return {
                type: effectObj.type,
                value: baseVal * scale * setMultiplier,
                lawName: l.name,
                element: l.element,
                scale: scale * setMultiplier
            };
        });
    }
    /**
     * P1-07: Lấy mô tả set bonus cho UI
     */
    getSetBonusDescription(userId) {
        const sets = this.getSetBonuses(userId);
        if (sets.length === 0)
            return '';
        let desc = '**Thưởng Bộ Tâm Pháp:**\n';
        for (const set of sets) {
            if (set.has3Set) {
                desc += `• **${set.element}** (3-set): +10% hiệu quả + Kích hoạt **${set.ability?.name || '???'}**\n`;
                desc += `  └ ${set.ability?.description || ''}\n`;
            }
            else if (set.has2Set) {
                desc += `• **${set.element}** (2-set): +10% hiệu quả Tâm Pháp\n`;
            }
        }
        return desc;
    }
    // V13 A-05: Check if Heart Law Ultimate is available
    getUltimate(userId) {
        const equipped = this.getEquippedHeartLaws(userId);
        if (equipped.length < 3)
            return null;
        // All 3 must share same element
        const elements = equipped.map(l => l.element).filter(e => e !== VO);
        if (elements.length < 3 || new Set(elements).size !== 1)
            return null;
        // All 3 must be level >= 5
        if (!equipped.every(l => l.level >= 5))
            return null;
        return HEART_LAW_ULTIMATES[elements[0]] || null;
    }
    hasUltimate(userId) {
        return this.getUltimate(userId) !== null;
    }
}
exports.heartLawService = new HeartLawService();
