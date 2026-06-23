"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.minigameService = exports.MinigameService = exports.DUEL_ACTION_META = exports.DUEL_SKILL_DEFS = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const InventoryService_1 = require("./InventoryService");
const itemConstants_1 = require("../config/itemConstants");
/**
 * Cấu hình phần thưởng cho top 3 quyết đấu hàng tuần
 */
const WEEKLY_PRIZES = [
    {
        coins: 5000, tuVi: 2000, ngotinh: 10,
        items: [{ item_id: itemConstants_1.ITEMS.REPAIR_STONE_MID, quantity: 3 }]
    },
    {
        coins: 3000, tuVi: 1000, ngotinh: 5,
        items: [{ item_id: itemConstants_1.ITEMS.REPAIR_STONE_MID, quantity: 2 }]
    },
    {
        coins: 1000, tuVi: 500, ngotinh: 3,
        items: [{ item_id: 'repair_stone_low', quantity: 1 }]
    }
];
/** Định nghĩa kỹ năng môn phái trong quyết đấu */
exports.DUEL_SKILL_DEFS = {
    skill_fire: { name: 'Liệt Diễm Quyết', element: 'Hỏa', emoji: '🔥', description: 'Thiêu đốt gây 12% ATK sát thương mỗi hiệp trong 2 hiệp', slotRate: [0.45, 0.30, 0.20] },
    skill_water: { name: 'Thủy Linh Quyết', element: 'Thủy', emoji: '💧', description: 'Hồi phục 12% HP tối đa ngay lập tức', slotRate: [0.45, 0.30, 0.20] },
    skill_wood: { name: 'Hấp Huyết Quyết', element: 'Mộc', emoji: '🌿', description: 'Chuyển hóa 30% sát thương gây ra thành HP', slotRate: [0.45, 0.30, 0.20] },
    skill_earth: { name: 'Thổ Giáp Quyết', element: 'Thổ', emoji: '🪨', description: 'Tạo khiên hấp thụ 15% HP tối đa', slotRate: [0.45, 0.30, 0.20] },
    skill_wind: { name: 'Phong Hành Quyết', element: 'Phong', emoji: '🌀', description: '80% né tránh đòn tấn công hiệp này', slotRate: [0.40, 0.25, 0.15] },
    skill_lightning: { name: 'Lôi Phạt Quyết', element: 'Lôi', emoji: '⚡', description: 'Tăng 50% sát thương, 30% làm choáng đối thủ', slotRate: [0.40, 0.25, 0.15] }
};
/** Ánh xạ hành động -> emoji & tên hiển thị */
exports.DUEL_ACTION_META = {
    xuất_kiếm: { emoji: '⚔️', name: 'Xuất Kiếm', desc: 'Tấn công mãnh liệt bằng kiếm pháp' },
    phòng_thủ: { emoji: '🛡️', name: 'Phòng Thủ', desc: 'Giáp trụ hộ thân, giảm sát thương' },
    linh_pháp: { emoji: '🔮', name: 'Linh Pháp', desc: 'Dẫn linh lực ngũ hành công kích' },
    tụ_khí: { emoji: '💫', name: 'Tụ Khí', desc: 'Ngưng tụ linh khí hồi phục & tăng lực' },
    tuyệt_kỹ: { emoji: '🔥', name: 'Tuyệt Kỹ', desc: 'Bộc phát kỹ năng môn phái 100% tỷ lệ' },
    dùng_vật_phẩm: { emoji: '💊', name: 'Vật Phẩm', desc: 'Sử dụng đan dược hoặc bùa chú' }
};
/** Ma trận khắc chế giữa các hành động (tỉ lệ sát thương) */
const DUEL_DAMAGE_MATRIX = {
    xuất_kiếm: { xuất_kiếm: 1.0, phòng_thủ: 0.4, linh_pháp: 0.9, tụ_khí: 1.5, tuyệt_kỹ: 0.8, dùng_vật_phẩm: 1.5 },
    phòng_thủ: { xuất_kiếm: 0, phòng_thủ: 0, linh_pháp: 0.5, tụ_khí: 0, tuyệt_kỹ: 0.6, dùng_vật_phẩm: 0 },
    linh_pháp: { xuất_kiếm: 0.85, phòng_thủ: 1.0, linh_pháp: 0.7, tụ_khí: 1.2, tuyệt_kỹ: 0.8, dùng_vật_phẩm: 1.2 },
    tụ_khí: { xuất_kiếm: 0, phòng_thủ: 0, linh_pháp: 0, tụ_khí: 0, tuyệt_kỹ: 0, dùng_vật_phẩm: 0 },
    tuyệt_kỹ: { xuất_kiếm: 1.2, phòng_thủ: 0.8, linh_pháp: 1.2, tụ_khí: 1.8, tuyệt_kỹ: 1.0, dùng_vật_phẩm: 1.8 },
    dùng_vật_phẩm: { xuất_kiếm: 0, phòng_thủ: 0, linh_pháp: 0, tụ_khí: 0, tuyệt_kỹ: 0, dùng_vật_phẩm: 0 }
};
const globalAny = global;
if (!globalAny.__activeDuels) {
    globalAny.__activeDuels = new Map();
}
class MinigameService {
    activeDuels = globalAny.__activeDuels;
    constructor() {
        // Dọn dẹp memory leak cho các trận quyết đấu bị bỏ quên mỗi 5 phút
        setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            for (const [duelId, duel] of this.activeDuels.entries()) {
                if (duel.status === 'expired' || duel.status === 'refused' || duel.status === 'completed') {
                    this.activeDuels.delete(duelId);
                    continue;
                }
                // Quá 5 phút từ lúc tạo mà vẫn pending -> xóa
                if (duel.status === 'pending' && now - duel.createdAt > 300) {
                    this.activeDuels.delete(duelId);
                }
                // Quá 5 phút từ lúc chấp nhận mà chưa xong -> xóa
                if (duel.status === 'accepted' && duel.acceptedAt && now - duel.acceptedAt > 300) {
                    this.activeDuels.delete(duelId);
                }
            }
        }, 300000);
    }
    /**
     * Chiêm bốc nhận thẻ xăm hàng ngày (Daily Fortune Sticks)
     */
    drawFortuneStick(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khai sinh nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.' };
        }
        const now = Math.floor(Date.now() / 1000);
        const lastExam = user.last_quexam_at || 0;
        const cooldown = 24 * 60 * 60; // 24 giờ
        if (now - lastExam < cooldown) {
            return {
                success: false,
                message: '⏳ Cơ duyên chiêm bốc hôm nay đã cạn.',
                cooldownRemaining: cooldown - (now - lastExam)
            };
        }
        // Lấy chỉ số May Mắn thực tế (bao gồm cả trang bị)
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        const currentLuck = activeStats ? activeStats.luck : user.base_luck;
        // Roll xúc sắc từ 1 đến 100 + cộng hưởng từ điểm May Mắn
        const baseRoll = Math.floor(Math.random() * 100) + 1;
        const luckBonus = Math.floor((currentLuck - 10) * 1.5);
        const score = baseRoll + luckBonus;
        let outcome;
        let title = '';
        let description = '';
        let coinDiff = 0;
        let luckDiff = 0;
        if (score >= 90) {
            outcome = 'daicat';
            title = '🔴 ĐẠI CÁT (Vạn Sự Hanh Thông) 🔴';
            description = 'Vận thế như rồng cuộn hổ ngồi, tử khí đông lai từ ngoài vạn dặm! Thích hợp mưu cầu đại đạo, luyện đan rèn khí đại thành!';
            coinDiff = Math.floor(Math.random() * 301) + 200; // +200 đến +500
            luckDiff = 2;
        }
        else if (score >= 70) {
            outcome = 'trungcat';
            title = '🟡 TRUNG CÁT (Cơ Duyên Thuận Lợi) 🟡';
            description = 'Đất trời giao hòa, linh khí dâng trào nhẹ. Đạo hữu tu luyện có phần trôi chảy, thích hợp xuất ngoại săn thú tầm bảo.';
            coinDiff = Math.floor(Math.random() * 151) + 100; // +100 đến +250
            luckDiff = 1;
        }
        else if (score >= 45) {
            outcome = 'tieucat';
            title = '🟢 TIỂU CÁT (May Mắn Nhỏ) 🟢';
            description = 'Có chút thu hoạch nhỏ, tích tiểu thành đại. Bình đạm là phúc, vạn sự trôi chảy bình an.';
            coinDiff = Math.floor(Math.random() * 71) + 50; // +50 đến +120
            luckDiff = 0;
        }
        else if (score >= 25) {
            outcome = 'binhthuong';
            title = '⚪ BÌNH THƯỜNG (Tĩnh Tâm Tu Hạnh) ⚪';
            description = 'Ngày thường vô sự, không cát không hung. Tĩnh tọa dưỡng thần, vững vàng tiến bước là thượng sách.';
            coinDiff = Math.floor(Math.random() * 31) + 10; // +10 đến +40
            luckDiff = 0;
        }
        else if (score >= 5) {
            outcome = 'hung';
            title = '⚫ HUNG (Vận Khí Ảm Đạm) ⚫';
            description = 'Hôm nay linh khí quanh thân có chút hỗn loạn. Dễ sinh cự cãi, cẩn thận đi đường vấp phải đá, tu luyện dễ lạc đường.';
            coinDiff = -(Math.floor(Math.random() * 41) + 10); // -10 đến -50
            luckDiff = -1;
        }
        else {
            outcome = 'daihung';
            title = '💀 ĐẠI HUNG (Kiếp Nạn Quấn Thân) 💀';
            description = 'Tử khí ám muội, kiếp vân giăng đầy đầu! Hôm nay cực kỳ xui xẻo, ra cửa dễ mất linh thạch, tu luyện dễ tẩu hỏa nhập ma!';
            coinDiff = -(Math.floor(Math.random() * 101) + 50); // -50 đến -150
            luckDiff = -2;
        }
        // Thực hiện cập nhật Database
        const updatedCoins = Math.max(0, user.coin_ha_pham + coinDiff);
        let updatedBaseLuck = user.base_luck + luckDiff;
        if (updatedBaseLuck > 30)
            updatedBaseLuck = 30;
        if (updatedBaseLuck < 5)
            updatedBaseLuck = 5;
        UserRepository_1.userRepository.update(userId, {
            coin_ha_pham: updatedCoins,
            base_luck: updatedBaseLuck,
            last_quexam_at: now
        });
        const finalCoinDiff = updatedCoins - user.coin_ha_pham;
        const finalLuckDiff = updatedBaseLuck - user.base_luck;
        return {
            success: true,
            message: description,
            title,
            outcome,
            coinDiff: finalCoinDiff,
            luckDiff: finalLuckDiff,
            userCoins: updatedCoins,
            userLuck: updatedBaseLuck
        };
    }
    /**
     * Tạo lời khiêu chiến quyết đấu mới
     */
    createChallenge(challengerId, targetId, wager) {
        if (challengerId === targetId) {
            return { success: false, message: 'Đạo hữu không thể tự quyết đấu với chính mình!' };
        }
        if (wager < 10) {
            return { success: false, message: 'Lượng đặt cược tối thiểu là 10 Hạ Phẩm Linh Thạch!' };
        }
        const challenger = UserRepository_1.userRepository.get(challengerId);
        const target = UserRepository_1.userRepository.get(targetId);
        if (!challenger) {
            return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
        }
        if (!target) {
            return { success: false, message: 'Đối thủ chưa có nhân vật trong thế giới này!' };
        }
        if (challenger.coin_ha_pham < wager) {
            return { success: false, message: `Đạo hữu không có đủ Linh Thạch (Hiện có **${challenger.coin_ha_pham}** / Cược **${wager}**).` };
        }
        if (target.coin_ha_pham < wager) {
            return { success: false, message: `Đối phương không đủ Linh Thạch để cược cùng đạo hữu (Đối phương hiện có **${target.coin_ha_pham}** / Cược **${wager}**).` };
        }
        // Dọn dẹp các kèo cũ hết hạn trước
        this.cleanExpiredDuels();
        // Kiểm tra xem một trong hai người chơi có đang trong kèo nào khác không
        for (const duel of this.activeDuels.values()) {
            if ((duel.status === 'pending' || duel.status === 'accepted') &&
                (duel.challengerId === challengerId || duel.targetId === challengerId ||
                    duel.challengerId === targetId || duel.targetId === targetId)) {
                return { success: false, message: 'Đạo hữu hoặc đối phương đang có một trận quyết đấu chưa hoàn thành!' };
            }
        }
        // Tính toán chỉ số quyết đấu dựa trên thực lực
        const chillerStats = InventoryService_1.inventoryService.getActiveStats(challengerId);
        const targetStats = InventoryService_1.inventoryService.getActiveStats(targetId);
        if (!chillerStats || !targetStats) {
            return { success: false, message: 'Không thể tính toán thực lực chiến đấu!' };
        }
        // Scale HP cho quyết đấu: lấy 50% HP thực tế (Tối thiểu 300) để tránh One-shot ở cấp độ cao
        const scaleHp = (hp) => Math.max(300, Math.round(hp * 0.5));
        const duelId = `duel-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newDuel = {
            id: duelId,
            challengerId,
            targetId,
            wager,
            createdAt: Math.floor(Date.now() / 1000),
            status: 'pending',
            currentRound: 1,
            maxRounds: 3,
            challengerHp: scaleHp(chillerStats.hp),
            challengerMaxHp: scaleHp(chillerStats.hp),
            targetHp: scaleHp(targetStats.hp),
            targetMaxHp: scaleHp(targetStats.hp),
            challengerBuffed: false,
            targetBuffed: false,
            challengerUltUsed: false,
            targetUltUsed: false,
            challengerEffects: {},
            targetEffects: {},
            roundLogs: [],
            roundStatus: 'waiting'
        };
        this.activeDuels.set(duelId, newDuel);
        return {
            success: true,
            message: 'Lời thách đấu đã được khởi tạo.',
            duel: newDuel
        };
    }
    /**
     * Lấy thông tin trận đấu
     */
    getDuel(duelId) {
        return this.activeDuels.get(duelId);
    }
    /**
     * Xác nhận lời quyết đấu
     */
    acceptChallenge(duelId, userId) {
        const duel = this.activeDuels.get(duelId);
        if (!duel) {
            return { success: false, message: 'Trận quyết đấu không tồn tại hoặc đã bị hủy.' };
        }
        if (duel.status !== 'pending') {
            return { success: false, message: `Trạng thái trận đấu không hợp lệ (Hiện tại: ${duel.status}).` };
        }
        if (duel.targetId !== userId) {
            return { success: false, message: 'Đạo hữu không phải là người được thách đấu!' };
        }
        const now = Math.floor(Date.now() / 1000);
        if (now - duel.createdAt > 60) {
            duel.status = 'expired';
            return { success: false, message: '⏳ Lời khiêu chiến đã hết hạn (quá 60 giây)!' };
        }
        // Kiểm tra tài chính của hai bên
        const challenger = UserRepository_1.userRepository.get(duel.challengerId);
        const target = UserRepository_1.userRepository.get(duel.targetId);
        if (!challenger || challenger.coin_ha_pham < duel.wager) {
            duel.status = 'expired';
            return { success: false, message: '❌ Khiêu chiến thất bại: Bên khiêu chiến hiện không còn đủ Linh Thạch!' };
        }
        if (!target || target.coin_ha_pham < duel.wager) {
            return { success: false, message: '❌ Thao tác bất thành: Đạo hữu không đủ Linh Thạch để ứng chiến!' };
        }
        duel.status = 'accepted';
        duel.acceptedAt = now;
        return {
            success: true,
            message: 'Ứng chiến thành công! Hãy chuẩn bị chiêu thức.',
            duel
        };
    }
    /**
     * Từ chối lời quyết đấu
     */
    refuseChallenge(duelId, userId) {
        const duel = this.activeDuels.get(duelId);
        if (!duel) {
            return { success: false, message: 'Trận quyết đấu không tồn tại hoặc đã bị hủy.' };
        }
        if (duel.status !== 'pending') {
            return { success: false, message: 'Quyết đấu không ở trạng thái chờ.' };
        }
        if (duel.targetId !== userId) {
            return { success: false, message: 'Đạo hữu không thể từ chối thay đối phương!' };
        }
        duel.status = 'refused';
        return {
            success: true,
            message: 'Từ chối thành công.',
            duel
        };
    }
    /**
     * Thực hiện ra chiêu theo hệ thống mới: Tam Hồi Linh Chiến
     */
    chooseMove(duelId, userId, choiceRaw) {
        const duel = this.activeDuels.get(duelId);
        if (!duel) {
            return { success: false, message: 'Trận quyết đấu không tồn tại hoặc đã bị hủy.' };
        }
        if (duel.status !== 'accepted') {
            return { success: false, message: 'Quyết đấu chưa được chấp thuận hoặc đã kết thúc.' };
        }
        if (duel.challengerId !== userId && duel.targetId !== userId) {
            return { success: false, message: 'Đạo hữu không thuộc trận quyết đấu này!' };
        }
        const now = Math.floor(Date.now() / 1000);
        // Hạn ra chiêu: 90s kể từ lúc nhận lời ứng chiến
        if (duel.acceptedAt && now - duel.acceptedAt > 90) {
            duel.status = 'expired';
            return { success: false, message: '⏳ Thời gian quyết đấu đã hết hạn (quá 90 giây)!' };
        }
        let choice = choiceRaw;
        let itemIdToUse = undefined;
        if (choiceRaw.startsWith('dùng_vật_phẩm_')) {
            choice = 'dùng_vật_phẩm';
            itemIdToUse = choiceRaw.replace('dùng_vật_phẩm_', '');
        }
        if (choice === 'tuyệt_kỹ') {
            const isChallenger = userId === duel.challengerId;
            if (isChallenger && duel.challengerUltUsed) {
                return { success: false, message: 'Đạo hữu đã bộc phát Tuyệt Kỹ trong trận này rồi, mỗi trận chỉ được dùng 1 lần!' };
            }
            if (!isChallenger && duel.targetUltUsed) {
                return { success: false, message: 'Đạo hữu đã bộc phát Tuyệt Kỹ trong trận này rồi, mỗi trận chỉ được dùng 1 lần!' };
            }
            const skills = this.getEquippedSkills(userId);
            if (skills.length === 0) {
                return { success: false, message: 'Đạo hữu chưa trang bị kỹ năng bản mệnh nào! Hãy dùng lệnh `/kynang` để trang bị trước khi quyết đấu.' };
            }
        }
        // Ghi nhận lựa chọn và cập nhật cờ Ult/Item
        if (userId === duel.challengerId) {
            if (duel.challengerChoice) {
                return { success: false, message: 'Đạo hữu đã ra chiêu hiệp này rồi, hãy chờ đối thủ!' };
            }
            duel.challengerChoice = choice;
            if (choice === 'tuyệt_kỹ')
                duel.challengerUltUsed = true;
            if (choice === 'dùng_vật_phẩm')
                duel.challengerUsedItemId = itemIdToUse;
        }
        else {
            if (duel.targetChoice) {
                return { success: false, message: 'Đạo hữu đã ra chiêu hiệp này rồi, hãy chờ đối thủ!' };
            }
            duel.targetChoice = choice;
            if (choice === 'tuyệt_kỹ')
                duel.targetUltUsed = true;
            if (choice === 'dùng_vật_phẩm')
                duel.targetUsedItemId = itemIdToUse;
        }
        // Nếu cả hai đã ra chiêu -> Giải quyết hiệp đấu
        if (duel.challengerChoice && duel.targetChoice) {
            duel.roundStatus = 'resolving';
            // Giải quyết hiệp đấu dựa trên chỉ số thực tế
            const roundResult = this.resolveDuelRound(duel);
            duel.roundLogs.push(roundResult.narrative);
            // Reset choice cho hiệp tiếp theo
            duel.challengerChoice = undefined;
            duel.targetChoice = undefined;
            // Kiểm tra nếu ai đó HP <= 0
            if (duel.challengerHp <= 0 || duel.targetHp <= 0) {
                duel.roundStatus = 'complete';
                return this.finalizeDuel(duel);
            }
            // Nếu đã đủ 3 hiệp -> kết thúc
            if (duel.currentRound >= duel.maxRounds) {
                duel.roundStatus = 'complete';
                return this.finalizeDuel(duel);
            }
            // Sang hiệp mới
            duel.currentRound++;
            duel.roundStatus = 'round_complete';
        }
        else {
            // Một người đã chọn, chờ người kia
            duel.roundStatus = 'waiting';
        }
        return {
            success: true,
            message: 'Ra chiêu thành công.',
            duel
        };
    }
    /**
     * Lấy danh sách kỹ năng đang trang bị của người chơi (có slot)
     */
    getEquippedSkills(userId) {
        try {
            return database_1.default.prepare('SELECT skill_id, level, equipped_slot FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId);
        }
        catch {
            return [];
        }
    }
    /**
     * Lấy element chính từ linh căn JSON
     */
    getPrimaryElement(userId) {
        try {
            const user = UserRepository_1.userRepository.get(userId);
            if (!user?.linh_can)
                return 'Vô thuộc';
            const linhCan = JSON.parse(user.linh_can);
            const keys = Object.keys(linhCan);
            if (keys.length === 0)
                return 'Vô thuộc';
            // Trả về element có số điểm cao nhất
            return keys.reduce((a, b) => (linhCan[a] > linhCan[b] ? a : b));
        }
        catch {
            return 'Vô thuộc';
        }
    }
    /**
     * Giải quyết một hiệp đấu dựa trên chỉ số thực tế và ma trận khắc chế
     */
    resolveDuelRound(duel) {
        const challengerAction = duel.challengerChoice;
        const targetAction = duel.targetChoice;
        // Lấy chỉ số thực tế của 2 người chơi
        const chillerStats = InventoryService_1.inventoryService.getActiveStats(duel.challengerId);
        const targetStats = InventoryService_1.inventoryService.getActiveStats(duel.targetId);
        let chillerAtk = chillerStats?.atk || 100;
        let targetAtk = targetStats?.atk || 100;
        // Áp dụng hình phạt Chính Đạo (-5% ATK trong PvP/Quyết Đấu)
        const challengerUser = UserRepository_1.userRepository.get(duel.challengerId);
        if (challengerUser && challengerUser.alignment === 'orthodox') {
            chillerAtk = Math.round(chillerAtk * 0.95);
        }
        const targetUser = UserRepository_1.userRepository.get(duel.targetId);
        if (targetUser && targetUser.alignment === 'orthodox') {
            targetAtk = Math.round(targetAtk * 0.95);
        }
        const chillerDef = chillerStats?.def || 50;
        const targetDef = targetStats?.def || 50;
        // === KỸ NĂNG MÔN PHÁI: Lấy skills đang trang bị + roll activation ===
        const chillerSkills = this.getEquippedSkills(duel.challengerId);
        const targetSkills = this.getEquippedSkills(duel.targetId);
        const chillerElement = this.getPrimaryElement(duel.challengerId);
        const targetElement = this.getPrimaryElement(duel.targetId);
        // Roll skill activation cho cả 2 bên
        let chillerSkillActivated = null;
        let targetSkillActivated = null;
        let chillerElementMatch = false;
        let targetElementMatch = false;
        if (challengerAction === 'tuyệt_kỹ') {
            const mainSkill = chillerSkills.find(s => s.equipped_slot === 1) || chillerSkills[0];
            if (mainSkill && exports.DUEL_SKILL_DEFS[mainSkill.skill_id]) {
                chillerSkillActivated = mainSkill.skill_id;
                chillerElementMatch = exports.DUEL_SKILL_DEFS[mainSkill.skill_id].element === chillerElement;
            }
        }
        else {
            for (const skill of chillerSkills) {
                const def = exports.DUEL_SKILL_DEFS[skill.skill_id];
                if (!def)
                    continue;
                const rate = def.slotRate[Math.min(skill.equipped_slot - 1, 2)] || 0.15;
                const actionBonus = (challengerAction === 'linh_pháp' && def.element === chillerElement) ? 0.15 : 0;
                const levelBonus = (skill.level - 1) * 0.02;
                if (Math.random() < rate + actionBonus + levelBonus) {
                    chillerSkillActivated = skill.skill_id;
                    chillerElementMatch = def.element === chillerElement;
                    break;
                }
            }
        }
        if (targetAction === 'tuyệt_kỹ') {
            const mainSkill = targetSkills.find(s => s.equipped_slot === 1) || targetSkills[0];
            if (mainSkill && exports.DUEL_SKILL_DEFS[mainSkill.skill_id]) {
                targetSkillActivated = mainSkill.skill_id;
                targetElementMatch = exports.DUEL_SKILL_DEFS[mainSkill.skill_id].element === targetElement;
            }
        }
        else {
            for (const skill of targetSkills) {
                const def = exports.DUEL_SKILL_DEFS[skill.skill_id];
                if (!def)
                    continue;
                const rate = def.slotRate[Math.min(skill.equipped_slot - 1, 2)] || 0.15;
                const actionBonus = (targetAction === 'linh_pháp' && def.element === targetElement) ? 0.15 : 0;
                const levelBonus = (skill.level - 1) * 0.02;
                if (Math.random() < rate + actionBonus + levelBonus) {
                    targetSkillActivated = skill.skill_id;
                    targetElementMatch = def.element === targetElement;
                    break;
                }
            }
        }
        // Áp dụng pre-buffs từ skills trước khi tính damage
        // Lôi Phạt Quyết: +50% damage multiplier
        const chillerDmgBuff = chillerSkillActivated === 'skill_lightning' ? 1.5 : 1.0;
        const targetDmgBuff = targetSkillActivated === 'skill_lightning' ? 1.5 : 1.0;
        // Phong Hành Quyết: dodge active
        if (chillerSkillActivated === 'skill_wind' && Math.random() < 0.8) {
            duel.challengerEffects.dodge = true;
        }
        if (targetSkillActivated === 'skill_wind' && Math.random() < 0.8) {
            duel.targetEffects.dodge = true;
        }
        // Thổ Giáp Quyết: shield = 15% max HP
        if (chillerSkillActivated === 'skill_earth') {
            const mult = chillerElementMatch ? 1.5 : 1.0;
            duel.challengerEffects.shield = Math.round(duel.challengerMaxHp * 0.15 * mult);
        }
        if (targetSkillActivated === 'skill_earth') {
            const mult = targetElementMatch ? 1.5 : 1.0;
            duel.targetEffects.shield = Math.round(duel.targetMaxHp * 0.15 * mult);
        }
        // === BURN DOT: Sát thương thiêu đốt từ hiệp trước ===
        let burnNarrative = '';
        if (duel.challengerEffects.burn && duel.challengerEffects.burn.remaining > 0) {
            const burnDmg = duel.challengerEffects.burn.damagePerTurn;
            duel.challengerHp = Math.max(0, duel.challengerHp - burnDmg);
            duel.challengerEffects.burn.remaining--;
            burnNarrative += `\n🔥 <@${duel.challengerId}> chịu **-${burnDmg}** sát thương thiêu đốt từ Liệt Diễm Quyết!`;
            if (duel.challengerEffects.burn.remaining <= 0)
                delete duel.challengerEffects.burn;
        }
        if (duel.targetEffects.burn && duel.targetEffects.burn.remaining > 0) {
            const burnDmg = duel.targetEffects.burn.damagePerTurn;
            duel.targetHp = Math.max(0, duel.targetHp - burnDmg);
            duel.targetEffects.burn.remaining--;
            burnNarrative += `\n🔥 <@${duel.targetId}> chịu **-${burnDmg}** sát thương thiêu đốt từ Liệt Diễm Quyết!`;
            if (duel.targetEffects.burn.remaining <= 0)
                delete duel.targetEffects.burn;
        }
        // Kiểm tra nếu ai đó chết vì burn trước khi ra chiêu
        if (duel.challengerHp <= 0 || duel.targetHp <= 0) {
            return { challengerDmg: 0, targetDmg: 0, challengerHeal: 0, targetHeal: 0, narrative: burnNarrative };
        }
        // === SỬ DỤNG ĐAN DƯỢC / VẬT PHẨM ===
        let itemNarrative = '';
        const applyItem = (userId, usedItemId, isChallenger) => {
            if (!usedItemId)
                return;
            const invItem = InventoryRepository_1.inventoryRepository.get(parseInt(usedItemId, 10));
            if (invItem && invItem.user_id === userId) {
                InventoryRepository_1.inventoryRepository.removeItemById(invItem.id, 1);
                try {
                    // Lấy stats mặc định nếu custom_stats không có
                    const dbItems = require('../database/database').ITEMS || [];
                    const itemDef = dbItems.find((i) => i.id === invItem.item_id);
                    const stats = JSON.parse(invItem.custom_stats || itemDef?.stats || '{}');
                    let heal = 0;
                    if (stats.restore_hp)
                        heal = stats.restore_hp;
                    else if (stats.add_tu_vi)
                        heal = 50; // Tụ khí đan cũng hồi máu nhẹ trong PvP
                    else if (stats.add_stamina)
                        heal = 30;
                    if (heal > 0) {
                        if (isChallenger) {
                            duel.challengerHp = Math.min(duel.challengerMaxHp, duel.challengerHp + heal);
                        }
                        else {
                            duel.targetHp = Math.min(duel.targetMaxHp, duel.targetHp + heal);
                        }
                        itemNarrative += `\n💊 <@${userId}> nuốt **${invItem.name}**, dược lực hóa tán hồi phục **+${heal}** HP!`;
                    }
                }
                catch (e) {
                    console.warn('[MinigameService] Failed to use HP pill in duel:', e);
                }
            }
        };
        applyItem(duel.challengerId, duel.challengerUsedItemId, true);
        duel.challengerUsedItemId = undefined;
        applyItem(duel.targetId, duel.targetUsedItemId, false);
        duel.targetUsedItemId = undefined;
        // === TÍNH SÁT THƯƠNG ===
        // Công thức: base_damage = ATK * RANDOM(0.08~0.15) * system_multiplier * buff
        const randFactor = 0.08 + Math.random() * 0.07;
        // Sát thương người thách gây ra cho người bị thách
        let challengerDmg = 0;
        if (DUEL_DAMAGE_MATRIX[challengerAction][targetAction] > 0) {
            const baseDmg = Math.round(chillerAtk * randFactor);
            let multiplier = DUEL_DAMAGE_MATRIX[challengerAction][targetAction];
            if (duel.challengerBuffed)
                multiplier *= 1.25;
            // Lôi Phạt Quyết: +50% damage
            if (chillerSkillActivated === 'skill_lightning')
                multiplier *= chillerDmgBuff;
            challengerDmg = Math.max(1, Math.round(baseDmg * multiplier));
            // Trừ DEF đối phương
            const defReduction = Math.round(challengerDmg * Math.min(0.4, targetDef / 500));
            challengerDmg = Math.max(1, challengerDmg - defReduction);
        }
        // Sát thương người bị thách gây ra cho người thách
        let targetDmg = 0;
        if (DUEL_DAMAGE_MATRIX[targetAction][challengerAction] > 0) {
            const baseDmg = Math.round(targetAtk * randFactor);
            let multiplier = DUEL_DAMAGE_MATRIX[targetAction][challengerAction];
            if (duel.targetBuffed)
                multiplier *= 1.25;
            if (targetSkillActivated === 'skill_lightning')
                multiplier *= targetDmgBuff;
            targetDmg = Math.max(1, Math.round(baseDmg * multiplier));
            const defReduction = Math.round(targetDmg * Math.min(0.4, chillerDef / 500));
            targetDmg = Math.max(1, targetDmg - defReduction);
        }
        // === HIỆU ỨNG HỒI MÁU ===
        let challengerHeal = 0;
        let targetHeal = 0;
        // Hiệu ứng Phòng Thủ
        if (challengerAction === 'phòng_thủ') {
            challengerHeal = Math.round(duel.challengerMaxHp * 0.06);
        }
        if (targetAction === 'phòng_thủ') {
            targetHeal = Math.round(duel.targetMaxHp * 0.06);
        }
        // Hiệu ứng Tụ Khí
        if (challengerAction === 'tụ_khí') {
            if (targetAction === 'xuất_kiếm') {
                challengerHeal += Math.round(duel.challengerMaxHp * 0.05);
                duel.challengerBuffed = false;
            }
            else {
                challengerHeal += Math.round(duel.challengerMaxHp * 0.2);
                duel.challengerBuffed = true;
            }
        }
        else {
            duel.challengerBuffed = false;
        }
        if (targetAction === 'tụ_khí') {
            if (challengerAction === 'xuất_kiếm') {
                targetHeal += Math.round(duel.targetMaxHp * 0.05);
                duel.targetBuffed = false;
            }
            else {
                targetHeal += Math.round(duel.targetMaxHp * 0.2);
                duel.targetBuffed = true;
            }
        }
        else {
            duel.targetBuffed = false;
        }
        // === KỸ NĂNG MÔN PHÁI: HIỆU ỨNG ===
        let skillNarrative = '';
        // Thủy Linh Quyết 💧: Hồi 12% HP tối đa ngay lập tức
        if (chillerSkillActivated === 'skill_water') {
            const mult = chillerElementMatch ? 1.5 : 1.0;
            const heal = Math.round(duel.challengerMaxHp * 0.12 * mult);
            challengerHeal += heal;
            skillNarrative += `\n💧 **Thủy Linh Quyết** hồi **+${heal}** HP!`;
        }
        if (targetSkillActivated === 'skill_water') {
            const mult = targetElementMatch ? 1.5 : 1.0;
            const heal = Math.round(duel.targetMaxHp * 0.12 * mult);
            targetHeal += heal;
            skillNarrative += `\n💧 **Thủy Linh Quyết** hồi **+${heal}** HP!`;
        }
        // === DODGE: Né tránh (Phong Hành Quyết) ===
        // Target dodge: né đòn từ challenger
        if (duel.targetEffects.dodge && challengerDmg > 0 && Math.random() < 0.8) {
            const dodgeNarrative = `\n🌀 <@${duel.targetId}> **Phong Hành Quyết** hóa thân như gió, né tránh hoàn toàn **-${challengerDmg}** sát thương!`;
            challengerDmg = 0;
            skillNarrative += dodgeNarrative;
        }
        // Challenger dodge: né đòn từ target
        if (duel.challengerEffects.dodge && targetDmg > 0 && Math.random() < 0.8) {
            const dodgeNarrative = `\n🌀 <@${duel.challengerId}> **Phong Hành Quyết** hóa thân như gió, né tránh hoàn toàn **-${targetDmg}** sát thương!`;
            targetDmg = 0;
            skillNarrative += dodgeNarrative;
        }
        // === SHIELD: Giáp hấp thụ (Thổ Giáp Quyết) ===
        if (duel.targetEffects.shield && duel.targetEffects.shield > 0 && challengerDmg > 0) {
            const absorbed = Math.min(duel.targetEffects.shield, challengerDmg);
            challengerDmg -= absorbed;
            duel.targetEffects.shield -= absorbed;
            skillNarrative += `\n🪨 <@${duel.targetId}> **Thổ Giáp Quyết** hấp thụ **-${absorbed}** sát thương!`;
            if (duel.targetEffects.shield <= 0) {
                skillNarrative += ` (Khiên vỡ!)`;
                delete duel.targetEffects.shield;
            }
            else {
                skillNarrative += ` (${duel.targetEffects.shield} còn lại)`;
            }
            if (challengerDmg < 0)
                challengerDmg = 0;
        }
        if (duel.challengerEffects.shield && duel.challengerEffects.shield > 0 && targetDmg > 0) {
            const absorbed = Math.min(duel.challengerEffects.shield, targetDmg);
            targetDmg -= absorbed;
            duel.challengerEffects.shield -= absorbed;
            skillNarrative += `\n🪨 <@${duel.challengerId}> **Thổ Giáp Quyết** hấp thụ **-${absorbed}** sát thương!`;
            if (duel.challengerEffects.shield <= 0) {
                skillNarrative += ` (Khiên vỡ!)`;
                delete duel.challengerEffects.shield;
            }
            else {
                skillNarrative += ` (${duel.challengerEffects.shield} còn lại)`;
            }
            if (targetDmg < 0)
                targetDmg = 0;
        }
        // Hấp Huyết Quyết 🌿: Chuyển hóa 30% sát thương gây ra thành HP
        if (chillerSkillActivated === 'skill_wood' && challengerDmg > 0) {
            const mult = chillerElementMatch ? 1.5 : 1.0;
            const lifesteal = Math.round(challengerDmg * 0.3 * mult);
            challengerHeal += lifesteal;
            skillNarrative += `\n🌿 **Hấp Huyết Quyết** hút máu, hồi **+${lifesteal}** HP!`;
        }
        if (targetSkillActivated === 'skill_wood' && targetDmg > 0) {
            const mult = targetElementMatch ? 1.5 : 1.0;
            const lifesteal = Math.round(targetDmg * 0.3 * mult);
            targetHeal += lifesteal;
            skillNarrative += `\n🌿 **Hấp Huyết Quyết** hút máu, hồi **+${lifesteal}** HP!`;
        }
        // === STUN (Lôi Phạt Quyết): 30% làm choáng đối thủ hiệp sau ===
        if (chillerSkillActivated === 'skill_lightning' && Math.random() < 0.3) {
            duel.targetEffects.stun = true;
            skillNarrative += `\n⚡ **Lôi Phạt Quyết** làm **choáng** đối thủ, giảm 50% sát thương hiệp sau!`;
        }
        if (targetSkillActivated === 'skill_lightning' && Math.random() < 0.3) {
            duel.challengerEffects.stun = true;
            skillNarrative += `\n⚡ **Lôi Phạt Quyết** làm **choáng** đối thủ, giảm 50% sát thương hiệp sau!`;
        }
        // === LIỆT DIỄM QUYẾT 🔥: Gây burn 2 hiệp (dùng sát thương do chủ skill gây ra) ===
        if (chillerSkillActivated === 'skill_fire' && challengerDmg > 0) {
            const mult = chillerElementMatch ? 1.5 : 1.0;
            const burnDmg = Math.round(chillerAtk * 0.12 * mult);
            duel.targetEffects.burn = { remaining: 2, damagePerTurn: burnDmg };
            skillNarrative += `\n🔥 **Liệt Diễm Quyết** thiêu đốt đối thủ, gây **-${burnDmg}** sát thương mỗi hiệp trong 2 hiệp!`;
        }
        if (targetSkillActivated === 'skill_fire' && targetDmg > 0) {
            const mult = targetElementMatch ? 1.5 : 1.0;
            const burnDmg = Math.round(targetAtk * 0.12 * mult);
            duel.challengerEffects.burn = { remaining: 2, damagePerTurn: burnDmg };
            skillNarrative += `\n🔥 **Liệt Diễm Quyết** thiêu đốt đối thủ, gây **-${burnDmg}** sát thương mỗi hiệp trong 2 hiệp!`;
        }
        // === ÁP DỤNG STUN DEBUFF CHO HIỆP NÀY (nếu bị choáng từ hiệp trước) ===
        if (duel.challengerEffects.stun) {
            challengerDmg = Math.max(0, Math.round(challengerDmg * 0.5));
            delete duel.challengerEffects.stun;
            skillNarrative += `\n💫 <@${duel.challengerId}> bị **choáng**, sát thương giảm 50%!`;
        }
        if (duel.targetEffects.stun) {
            targetDmg = Math.max(0, Math.round(targetDmg * 0.5));
            delete duel.targetEffects.stun;
            skillNarrative += `\n💫 <@${duel.targetId}> bị **choáng**, sát thương giảm 50%!`;
        }
        // Linh Pháp: không có buff nhưng có thể kích hoạt hiệu ứng linh căn
        // (hiệu ứng linh căn được xử lý trong phần tường thuật)
        // === SỦNG THÚ CAN THIỆP ===
        let petNarrative = '';
        const chillerPet = database_1.default.prepare('SELECT name, base_atk, base_def, base_hp, rarity FROM pets WHERE user_id = ? AND is_deployed = 1').get(duel.challengerId);
        const targetPet = database_1.default.prepare('SELECT name, base_atk, base_def, base_hp, rarity FROM pets WHERE user_id = ? AND is_deployed = 1').get(duel.targetId);
        const processPet = (pet, isChallenger) => {
            let skillChance = pet.rarity === 'legendary' ? 0.25 : (pet.rarity === 'epic' ? 0.15 : 0);
            if (skillChance > 0 && Math.random() < skillChance) {
                if (pet.rarity === 'legendary') {
                    const bonusDmg = Math.max(1, Math.round(pet.base_atk * 2.0));
                    const heal = Math.round(bonusDmg * 0.5);
                    if (isChallenger) {
                        challengerDmg += bonusDmg;
                        challengerHeal += heal;
                    }
                    else {
                        targetDmg += bonusDmg;
                        targetHeal += heal;
                    }
                    petNarrative += `🌟 **[THỨC TỈNH]** Sủng thú **${pet.name}** [LEGENDARY] thi triển tuyệt kỹ cắn xé, oanh tạc **-${bonusDmg}** sát thương và hồi phục **+${heal}** HP cho chủ nhân!\n`;
                }
                else if (pet.rarity === 'epic') {
                    if (isChallenger) {
                        const blocked = Math.round(targetDmg * 0.8);
                        targetDmg -= blocked;
                        petNarrative += `🌟 **[THỨC TỈNH]** Sủng thú **${pet.name}** [EPIC] thi triển Linh Vực Hộ Thể, cản phá **-${blocked}** sát thương!\n`;
                    }
                    else {
                        const blocked = Math.round(challengerDmg * 0.8);
                        challengerDmg -= blocked;
                        petNarrative += `🌟 **[THỨC TỈNH]** Sủng thú **${pet.name}** [EPIC] thi triển Linh Vực Hộ Thể, cản phá **-${blocked}** sát thương!\n`;
                    }
                }
                return;
            }
            if (Math.random() < 0.35) {
                const petRoll = Math.random();
                if (petRoll < 0.5) {
                    const bonusDmg = Math.max(1, Math.round(pet.base_atk * (0.8 + Math.random() * 0.4)));
                    if (isChallenger) {
                        challengerDmg += bonusDmg;
                    }
                    else {
                        targetDmg += bonusDmg;
                    }
                    petNarrative += `🐾 Sủng thú **${pet.name}** lao vào cắn xé, gây thêm **-${bonusDmg}** sát thương!\n`;
                }
                else if (petRoll < 0.75) {
                    const dmgReduction = Math.max(1, Math.round(pet.base_def * (0.5 + Math.random() * 0.5)));
                    if (isChallenger) {
                        const actual = Math.min(targetDmg, dmgReduction);
                        targetDmg = Math.max(0, targetDmg - actual);
                        if (actual > 0)
                            petNarrative += `🐾 Sủng thú **${pet.name}** đỡ đòn thay chủ, hấp thụ **-${actual}** sát thương!\n`;
                    }
                    else {
                        const actual = Math.min(challengerDmg, dmgReduction);
                        challengerDmg = Math.max(0, challengerDmg - actual);
                        if (actual > 0)
                            petNarrative += `🐾 Sủng thú **${pet.name}** đỡ đòn thay chủ, hấp thụ **-${actual}** sát thương!\n`;
                    }
                }
                else {
                    const healAmount = Math.max(1, Math.round(pet.base_hp * 0.03 * (0.8 + Math.random() * 0.4)));
                    if (isChallenger) {
                        challengerHeal += healAmount;
                    }
                    else {
                        targetHeal += healAmount;
                    }
                    petNarrative += `🐾 Sủng thú **${pet.name}** vận chuyển linh lực chữa trị, hồi **+${healAmount}** HP!\n`;
                }
            }
        };
        if (chillerPet)
            processPet(chillerPet, true);
        if (targetPet)
            processPet(targetPet, false);
        // === ÁP DỤNG SÁT THƯƠNG & HỒI MÁU (Đã bao gồm pet + skills) ===
        duel.targetHp = Math.max(0, Math.min(duel.targetMaxHp, duel.targetHp - challengerDmg + challengerHeal));
        duel.challengerHp = Math.max(0, Math.min(duel.challengerMaxHp, duel.challengerHp - targetDmg + targetHeal));
        // === TẠO TƯỜNG THUẬT ===
        const cMeta = exports.DUEL_ACTION_META[challengerAction];
        const tMeta = exports.DUEL_ACTION_META[targetAction];
        let narrative = `━━━ **HIỆP ${duel.currentRound}/${duel.maxRounds}** ━━━\n`;
        narrative += itemNarrative;
        // Burn DoT narrative đầu hiệp
        if (burnNarrative)
            narrative += burnNarrative + '\n';
        // Tường thuật hành động người thách
        narrative += `**<@${duel.challengerId}>** tung chiêu ${cMeta.emoji} **${cMeta.name}**: `;
        if (challengerAction === 'xuất_kiếm') {
            if (targetAction === 'tụ_khí') {
                narrative += `⚔️ Mũi kiếm xé gió chém thẳng vào lúc địch thủ đang ngưng tụ linh khí, **-${challengerDmg}** sát thương gián đoạn!`;
            }
            else if (targetAction === 'phòng_thủ') {
                narrative += `⚔️ Kiếm thế lao tới nhưng bị lớp hộ giáp chặn đứng, chỉ gây **-${challengerDmg}** sát thương nhẹ!`;
            }
            else {
                narrative += `⚔️ Kiếm quang chớp lóa, gây **-${challengerDmg}** sát thương!`;
            }
        }
        else if (challengerAction === 'linh_pháp') {
            const chiller = UserRepository_1.userRepository.get(duel.challengerId);
            const linhCan = chiller?.linh_can ? JSON.parse(chiller.linh_can) : {};
            const element = Object.keys(linhCan)[0] || 'Vô thuộc';
            const elementBonus = challengerDmg > 0 ? Math.round(challengerDmg * 0.2) : 0;
            challengerDmg += elementBonus;
            if (targetAction === 'phòng_thủ') {
                narrative += `🔮 Linh lực **${element}** bàng bạc phá xuyên lớp phòng ngự, gây **-${challengerDmg}** sát thương xuyên giáp!`;
            }
            else {
                narrative += `🔮 Linh lực **${element}** ngưng tụ thành lôi hỏa, gây **-${challengerDmg}** sát thương!`;
            }
        }
        else if (challengerAction === 'phòng_thủ') {
            narrative += `🛡️ Vận chuyển linh lực hộ thân, hồi phục **+${Math.round(duel.challengerMaxHp * 0.06)}** HP!`;
        }
        else if (challengerAction === 'tụ_khí') {
            if (targetAction === 'xuất_kiếm') {
                narrative += `💫 Cố gắng ngưng tụ linh khí nhưng bị kiếm chiêu bổ tới giữa chừng, chỉ hồi được **+${Math.round(duel.challengerMaxHp * 0.05)}** HP và mất đà!`;
            }
            else {
                narrative += `💫 Ngưng tụ linh khí thiên địa, hồi phục **+${Math.round(duel.challengerMaxHp * 0.2)}** HP và tích lũy chiến ý cho hiệp sau!`;
            }
        }
        else if (challengerAction === 'tuyệt_kỹ') {
            const skillName = chillerSkillActivated ? exports.DUEL_SKILL_DEFS[chillerSkillActivated].name : 'Tuyệt Kỹ';
            narrative += `🔥 Bộc phát bản mệnh linh khí, dốc toàn lực thi triển **${skillName}**, oanh kích **-${challengerDmg}** sát thương!`;
        }
        // Thêm buff indicator nếu có Lôi Phạt
        if (chillerSkillActivated === 'skill_lightning') {
            narrative += ` ⚡ [Lôi Phạt +50%]`;
        }
        narrative += `\n`;
        // Tường thuật hành động người bị thách
        narrative += `**<@${duel.targetId}>** phản công ${tMeta.emoji} **${tMeta.name}**: `;
        if (targetAction === 'xuất_kiếm') {
            if (challengerAction === 'tụ_khí') {
                narrative += `⚔️ Mũi kiếm xé gió chém thẳng vào lúc địch thủ đang ngưng tụ linh khí, **-${targetDmg}** sát thương gián đoạn!`;
            }
            else if (challengerAction === 'phòng_thủ') {
                narrative += `⚔️ Kiếm thế lao tới nhưng bị lớp hộ giáp chặn đứng, chỉ gây **-${targetDmg}** sát thương nhẹ!`;
            }
            else {
                narrative += `⚔️ Kiếm quang chớp lóa, gây **-${targetDmg}** sát thương!`;
            }
        }
        else if (targetAction === 'linh_pháp') {
            const targetUser = UserRepository_1.userRepository.get(duel.targetId);
            const linhCan = targetUser?.linh_can ? JSON.parse(targetUser.linh_can) : {};
            const element = Object.keys(linhCan)[0] || 'Vô thuộc';
            const elementBonus = targetDmg > 0 ? Math.round(targetDmg * 0.2) : 0;
            targetDmg += elementBonus;
            if (challengerAction === 'phòng_thủ') {
                narrative += `🔮 Linh lực **${element}** bàng bạc phá xuyên lớp phòng ngự, gây **-${targetDmg}** sát thương xuyên giáp!`;
            }
            else {
                narrative += `🔮 Linh lực **${element}** ngưng tụ thành lôi hỏa, gây **-${targetDmg}** sát thương!`;
            }
        }
        else if (targetAction === 'phòng_thủ') {
            narrative += `🛡️ Vận chuyển linh lực hộ thân, hồi phục **+${Math.round(duel.targetMaxHp * 0.06)}** HP!`;
        }
        else if (targetAction === 'tụ_khí') {
            if (challengerAction === 'xuất_kiếm') {
                narrative += `💫 Cố gắng ngưng tụ linh khí nhưng bị kiếm chiêu bổ tới giữa chừng, chỉ hồi được **+${Math.round(duel.targetMaxHp * 0.05)}** HP và mất đà!`;
            }
            else {
                narrative += `💫 Ngưng tụ linh khí thiên địa, hồi phục **+${Math.round(duel.targetMaxHp * 0.2)}** HP và tích lũy chiến ý cho hiệp sau!`;
            }
        }
        else if (targetAction === 'tuyệt_kỹ') {
            const skillName = targetSkillActivated ? exports.DUEL_SKILL_DEFS[targetSkillActivated].name : 'Tuyệt Kỹ';
            narrative += `🔥 Bộc phát bản mệnh linh khí, dốc toàn lực thi triển **${skillName}**, oanh kích **-${targetDmg}** sát thương!`;
        }
        if (targetSkillActivated === 'skill_lightning') {
            narrative += ` ⚡ [Lôi Phạt +50%]`;
        }
        narrative += `\n`;
        // Skill narrative
        if (skillNarrative) {
            narrative += `\n${skillNarrative}\n`;
        }
        // Pet narrative
        if (petNarrative) {
            narrative += `\n${petNarrative}`;
        }
        // Hiển thị HP bar với skill effect indicators
        const hpBar = (current, max) => {
            const filled = Math.round((current / max) * 10);
            return '🟥'.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, 10 - filled));
        };
        const statusIcons = (effects) => {
            let icons = '';
            if (effects.burn && effects.burn.remaining > 0)
                icons += ` 🔥[${effects.burn.remaining}]`;
            if (effects.shield && effects.shield > 0)
                icons += ` 🪨[${effects.shield}]`;
            if (effects.dodge)
                icons += ` 🌀`;
            return icons;
        };
        narrative += `\n📊 **Trạng thái hiện tại:**\n`;
        narrative += `<@${duel.challengerId}>: ${hpBar(duel.challengerHp, duel.challengerMaxHp)} **${duel.challengerHp}/${duel.challengerMaxHp}** HP`;
        if (duel.challengerBuffed)
            narrative += ` 💫 [Chiến Ý]`;
        narrative += statusIcons(duel.challengerEffects);
        narrative += `\n`;
        narrative += `<@${duel.targetId}>: ${hpBar(duel.targetHp, duel.targetMaxHp)} **${duel.targetHp}/${duel.targetMaxHp}** HP`;
        if (duel.targetBuffed)
            narrative += ` 💫 [Chiến Ý]`;
        narrative += statusIcons(duel.targetEffects);
        narrative += `\n`;
        return {
            challengerDmg,
            targetDmg,
            challengerHeal,
            targetHeal,
            narrative
        };
    }
    /**
     * Kết thúc quyết đấu và xử lý tiền cược
     */
    finalizeDuel(duel) {
        const challengerHpPercent = duel.challengerHp / duel.challengerMaxHp;
        const targetHpPercent = duel.targetHp / duel.targetMaxHp;
        // Ngưỡng hòa: chênh lệch HP <= 5%
        const isTie = Math.abs(challengerHpPercent - targetHpPercent) <= 0.05;
        if (isTie) {
            duel.status = 'completed';
            this.saveDuelHistory(duel, null, null, true);
            this.reduceDurabilityAfterDuel(duel);
            return {
                success: true,
                message: 'Bất phân thắng bại!',
                duel,
                isTie: true
            };
        }
        const winnerId = challengerHpPercent > targetHpPercent ? duel.challengerId : duel.targetId;
        const loserId = challengerHpPercent > targetHpPercent ? duel.targetId : duel.challengerId;
        const totalPool = duel.wager * 2;
        const tax = Math.ceil(duel.wager * 0.05 * 2);
        const winnings = totalPool - tax;
        try {
            this.executeDuelPaymentTransaction(winnerId, loserId, duel.wager, winnings);
            duel.status = 'completed';
            try {
                const { systemConfigService } = require('./SystemConfigService');
                systemConfigService.writeAuditLog(winnerId, 'duel_win', {
                    duelId: duel.id,
                    opponentId: loserId,
                    wager: duel.wager,
                    winnings,
                    tax,
                    rounds: duel.currentRound,
                    finalHp: duel.challengerHp > duel.targetHp ? duel.challengerHp : duel.targetHp,
                    finalMaxHp: duel.challengerHp > duel.targetHp ? duel.challengerMaxHp : duel.targetMaxHp
                });
                systemConfigService.writeAuditLog(loserId, 'duel_lose', {
                    duelId: duel.id,
                    opponentId: winnerId,
                    wager: duel.wager,
                    rounds: duel.currentRound
                });
            }
            catch (e) {
                // Bỏ qua lỗi log
            }
            this.saveDuelHistory(duel, winnerId, loserId, false, winnings, tax);
            this.reduceDurabilityAfterDuel(duel);
            return {
                success: true,
                message: 'Quyết đấu hoàn thành!',
                duel,
                winnerId,
                loserId,
                isTie: false,
                tax,
                winnings
            };
        }
        catch (err) {
            duel.status = 'expired';
            console.error('[Duel Transaction Error]', err);
            return {
                success: false,
                message: `Lỗi kết chuyển Linh Thạch: ${err.message === 'loser_insufficient_funds' || err.message === 'winner_insufficient_funds' ? 'Một trong hai đạo hữu không đủ linh thạch!' : 'Hệ thống lỗi trích xuất.'}`
            };
        }
    }
    /**
     * Chạy Transaction cập nhật linh thạch an toàn tránh Race condition
     */
    executeDuelPaymentTransaction(winnerId, loserId, wager, winnings) {
        const transaction = database_1.default.transaction((winnerId, loserId, wager, winnings) => {
            const loser = database_1.default.prepare('SELECT coin_ha_pham FROM users WHERE discord_id = ?').get(loserId);
            const winner = database_1.default.prepare('SELECT coin_ha_pham FROM users WHERE discord_id = ?').get(winnerId);
            if (!loser || loser.coin_ha_pham < wager) {
                throw new Error('loser_insufficient_funds');
            }
            if (!winner || winner.coin_ha_pham < wager) {
                throw new Error('winner_insufficient_funds');
            }
            // Khấu trừ bên bại
            database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? WHERE discord_id = ?').run(wager, loserId);
            // Kết chuyển bên thắng (nhận net: +winnings - wager)
            database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + ? WHERE discord_id = ?').run(winnings - wager, winnerId);
        });
        transaction(winnerId, loserId, wager, winnings);
    }
    /**
     * Lưu kết quả quyết đấu vào bảng lịch sử
     */
    saveDuelHistory(duel, winnerId, loserId, isTie, actualWinnings, actualTax) {
        try {
            const now = Math.floor(Date.now() / 1000);
            // Với trận hòa, lưu cả 2 người chơi để tie-count hoạt động
            const finalWinnerId = isTie ? duel.challengerId : (winnerId || '');
            const finalLoserId = isTie ? duel.targetId : (loserId || '');
            const winner = isTie ? UserRepository_1.userRepository.get(duel.challengerId) : (winnerId ? UserRepository_1.userRepository.get(winnerId) : null);
            const loser = isTie ? UserRepository_1.userRepository.get(duel.targetId) : (loserId ? UserRepository_1.userRepository.get(loserId) : null);
            const totalPool = duel.wager * 2;
            const tax = actualTax ?? Math.ceil(duel.wager * 0.05 * 2);
            const winnings = actualWinnings ?? (isTie ? 0 : totalPool - tax);
            database_1.default.prepare(`
        INSERT INTO duel_history (winner_id, loser_id, winner_name, loser_name, wager, tax, winnings, rounds, challenger_hp_left, target_hp_left, is_tie, fought_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(finalWinnerId, finalLoserId, winner?.name || 'Không rõ', loser?.name || 'Không rõ', duel.wager, tax, winnings, duel.currentRound, duel.challengerHp, duel.targetHp, isTie ? 1 : 0, now);
        }
        catch (e) {
            console.error('[saveDuelHistory Error]', e);
        }
    }
    /**
     * Lấy thống kê chi tiết quyết đấu cá nhân
     */
    getDuelStats(userId) {
        // Thống kê tổng hợp
        const stats = database_1.default.prepare(`
      SELECT
        COUNT(*) as total_matches,
        SUM(CASE WHEN is_tie = 0 AND winner_id = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN is_tie = 0 AND loser_id = ? THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN is_tie = 1 THEN 1 ELSE 0 END) as ties,
        COALESCE(SUM(wager), 0) as total_wager,
        COALESCE(SUM(CASE WHEN winner_id = ? THEN winnings ELSE 0 END), 0) as total_winnings,
        COALESCE(SUM(CASE WHEN loser_id = ? THEN wager ELSE 0 END), 0) as total_lost,
        COALESCE(MAX(wager), 0) as biggest_wager,
        COALESCE(MAX(CASE WHEN winner_id = ? THEN winnings ELSE 0 END), 0) as biggest_win,
        COALESCE(ROUND(AVG(rounds)), 0) as avg_rounds,
        MIN(fought_at) as first_match_at,
        MAX(fought_at) as last_match_at
      FROM duel_history
      WHERE winner_id = ? OR loser_id = ?
    `).get(userId, userId, userId, userId, userId, userId, userId);
        const totalMatches = stats.total_matches || 0;
        const wins = stats.wins || 0;
        const losses = stats.losses || 0;
        const ties = stats.ties || 0;
        // Winrate
        const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
        // Chuỗi thắng hiện tại và dài nhất
        let currentWinStreak = 0;
        let longestWinStreak = 0;
        const allMatches = database_1.default.prepare(`
      SELECT winner_id, is_tie, fought_at
      FROM duel_history
      WHERE winner_id = ? OR loser_id = ?
      ORDER BY fought_at DESC
    `).all(userId, userId);
        let tempStreak = 0;
        let foundFirst = false;
        for (const match of allMatches) {
            const isWin = match.winner_id === userId && match.is_tie === 0;
            if (!foundFirst) {
                // Chuỗi hiện tại: đếm từ trận gần nhất trở về trước
                if (isWin) {
                    currentWinStreak++;
                }
                else {
                    foundFirst = true;
                    // Không thắng trận gần nhất -> current streak = 0 (hoặc nếu thắng thì đã đếm ở trên)
                }
            }
            // Chuỗi dài nhất: duyệt từ gần nhất đến xa nhất
            if (isWin) {
                tempStreak++;
                if (tempStreak > longestWinStreak)
                    longestWinStreak = tempStreak;
            }
            else {
                tempStreak = 0;
            }
        }
        // Đối thủ nhiều nhất
        const opponentData = database_1.default.prepare(`
      SELECT
        CASE WHEN winner_id = ? THEN loser_id ELSE winner_id END as opponent_id,
        CASE WHEN winner_id = ? THEN loser_name ELSE winner_name END as opponent_name,
        COUNT(*) as cnt
      FROM duel_history
      WHERE winner_id = ? OR loser_id = ?
      GROUP BY opponent_id
      ORDER BY cnt DESC
      LIMIT 1
    `).get(userId, userId, userId, userId);
        return {
            totalMatches,
            wins,
            losses,
            ties,
            winRate,
            totalWager: stats.total_wager || 0,
            totalWinnings: stats.total_winnings || 0,
            totalLost: stats.total_lost || 0,
            netWinnings: (stats.total_winnings || 0) - (stats.total_lost || 0),
            biggestWager: stats.biggest_wager || 0,
            biggestWin: stats.biggest_win || 0,
            avgRounds: stats.avg_rounds || 0,
            currentWinStreak,
            longestWinStreak,
            mostFrequentOpponent: opponentData && opponentData.opponent_id
                ? { id: opponentData.opponent_id, name: opponentData.opponent_name, count: opponentData.cnt }
                : null,
            firstMatchAt: stats.first_match_at || null,
            lastMatchAt: stats.last_match_at || null
        };
    }
    /**
     * Lấy lịch sử quyết đấu của người chơi
     */
    getDuelHistory(userId, page = 1, pageSize = 5) {
        const countResult = database_1.default.prepare(`
      SELECT COUNT(*) as c FROM duel_history 
      WHERE winner_id = ? OR loser_id = ?
    `).get(userId, userId);
        const totalRecords = countResult.c;
        const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
        const currentPage = Math.min(page, totalPages);
        const offset = (currentPage - 1) * pageSize;
        const records = database_1.default.prepare(`
      SELECT * FROM duel_history
      WHERE winner_id = ? OR loser_id = ?
      ORDER BY fought_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, userId, pageSize, offset);
        return { records, totalRecords, totalPages, currentPage };
    }
    /**
     * Lấy bảng xếp hạng quyết đấu dựa trên số trận thắng và linh thạch ròng kiếm được
     */
    getDuelLeaderboard(limit = 10, currentUserId) {
        // Aggregate wins per user (winner_id)
        const winsRows = database_1.default.prepare(`
      SELECT winner_id, COUNT(*) as wins, COALESCE(SUM(winnings - wager), 0) as net_earned
      FROM duel_history
      WHERE is_tie = 0
      GROUP BY winner_id
    `).all();
        // Aggregate losses per user (loser_id)
        const lossesRows = database_1.default.prepare(`
      SELECT loser_id, COUNT(*) as losses, COALESCE(SUM(wager), 0) as lost_total
      FROM duel_history
      WHERE is_tie = 0
      GROUP BY loser_id
    `).all();
        // Aggregate ties per user (cả winner_id và loser_id - cả 2 đều được tính)
        const tiesRows = database_1.default.prepare(`
      SELECT uid, SUM(cnt) as ties FROM (
        SELECT winner_id as uid, COUNT(*) as cnt FROM duel_history WHERE is_tie = 1 GROUP BY winner_id
        UNION ALL
        SELECT loser_id as uid, COUNT(*) as cnt FROM duel_history WHERE is_tie = 1 GROUP BY loser_id
      ) GROUP BY uid
    `).all();
        // Build a map by userId
        const playerMap = new Map();
        for (const row of winsRows) {
            playerMap.set(row.winner_id, {
                wins: row.wins,
                losses: 0,
                ties: 0,
                netEarned: row.net_earned,
                lostTotal: 0
            });
        }
        for (const row of lossesRows) {
            const existing = playerMap.get(row.loser_id);
            if (existing) {
                existing.losses = row.losses;
                existing.lostTotal = row.lost_total;
            }
            else {
                playerMap.set(row.loser_id, {
                    wins: 0, losses: row.losses, ties: 0,
                    netEarned: 0, lostTotal: row.lost_total
                });
            }
        }
        for (const row of tiesRows) {
            const existing = playerMap.get(row.uid);
            if (existing) {
                existing.ties += row.ties;
            }
            else {
                playerMap.set(row.uid, {
                    wins: 0, losses: 0, ties: row.ties,
                    netEarned: 0, lostTotal: 0
                });
            }
        }
        // Xây dựng danh sách đầy đủ đã sắp xếp, sau đó lấy top entries
        const allSorted = Array.from(playerMap.entries())
            .map(([userId, stats]) => {
            const user = UserRepository_1.userRepository.get(userId);
            const totalMatches = stats.wins + stats.losses + stats.ties;
            return {
                userId,
                name: user?.name || 'Tu sĩ vô danh',
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                totalMatches,
                netWinnings: stats.netEarned - stats.lostTotal,
                winRate: totalMatches > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0
            };
        })
            .sort((a, b) => {
            if (b.wins !== a.wins)
                return b.wins - a.wins;
            if (b.netWinnings !== a.netWinnings)
                return b.netWinnings - a.netWinnings;
            return b.winRate - a.winRate;
        });
        const entries = allSorted.slice(0, limit);
        // Tìm rank của người dùng hiện tại nếu được yêu cầu
        let currentUserRank;
        if (currentUserId) {
            const rankIdx = allSorted.findIndex(e => e.userId === currentUserId);
            if (rankIdx !== -1) {
                currentUserRank = rankIdx + 1;
            }
        }
        return { entries, currentUserRank, totalPlayers: playerMap.size };
    }
    /**
     * Giảm độ bền trang bị của cả 2 người chơi sau khi quyết đấu kết thúc
     */
    reduceDurabilityAfterDuel(duel) {
        try {
            // Mỗi trận quyết đấu giảm 5-10 độ bền cho mỗi trang bị đang đeo
            const reduceAmount = 5 + Math.floor(Math.random() * 6);
            // Giảm độ bền của người thách
            const chillerEquipped = database_1.default.prepare(`
        SELECT id FROM inventories WHERE user_id = ? AND is_equipped = 1
      `).all(duel.challengerId);
            for (const item of chillerEquipped) {
                InventoryRepository_1.inventoryRepository.reduceDurability(item.id, reduceAmount);
            }
            // Giảm độ bền của người bị thách
            const targetEquipped = database_1.default.prepare(`
        SELECT id FROM inventories WHERE user_id = ? AND is_equipped = 1
      `).all(duel.targetId);
            for (const item of targetEquipped) {
                InventoryRepository_1.inventoryRepository.reduceDurability(item.id, reduceAmount);
            }
        }
        catch (e) {
            console.error('[reduceDurabilityAfterDuel Error]', e);
        }
    }
    /**
     * Dọn dẹp bộ nhớ các cuộc quyết đấu đã quá hạn
     */
    cleanExpiredDuels() {
        const now = Math.floor(Date.now() / 1000);
        for (const [id, duel] of this.activeDuels.entries()) {
            if (duel.status === 'pending' && now - duel.createdAt > 60) {
                duel.status = 'expired';
            }
            else if (duel.status === 'accepted' && duel.acceptedAt && now - duel.acceptedAt > 60) {
                duel.status = 'expired';
            }
            // Xóa khỏi Map các trận đấu đã kết thúc / hết hạn / bị từ chối quá 10 phút để tránh rò rỉ bộ nhớ
            if (duel.status !== 'pending' && duel.status !== 'accepted') {
                const finishedTime = duel.acceptedAt || duel.createdAt;
                if (now - finishedTime > 600) {
                    this.activeDuels.delete(id);
                }
            }
        }
    }
    // ========================================================================
    //  HỆ THỐNG MÙA GIẢI & PHẦN THƯỞNG TOP 3 TUẦN
    // ========================================================================
    seasonSchedulerInterval = null;
    lastSeasonCheck = 0;
    /**
     * Khởi động scheduler kiểm tra mùa giải quyết đấu mỗi 60 giây
     */
    startSeasonScheduler() {
        if (this.seasonSchedulerInterval)
            return;
        console.log('[MinigameService] ⏳ Khởi động Scheduler mùa giải quyết đấu...');
        // Kiểm tra ngay khi khởi động
        this.checkSeasonRotation();
        this.seasonSchedulerInterval = setInterval(() => {
            try {
                this.checkSeasonRotation();
            }
            catch (err) {
                console.error('[MinigameService] Lỗi season scheduler:', err);
            }
        }, 60000); // 60s
    }
    /**
     * Kiểm tra và xoay vòng mùa giải
     */
    checkSeasonRotation() {
        const now = Math.floor(Date.now() / 1000);
        // Tránh kiểm tra quá thường xuyên (chỉ kiểm tra mỗi 30 giây)
        if (now - this.lastSeasonCheck < 30)
            return;
        this.lastSeasonCheck = now;
        // Lấy mùa hiện tại đang active
        const activeSeason = database_1.default.prepare("SELECT * FROM duel_weekly_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        if (!activeSeason) {
            // Chưa có mùa nào -> tạo mùa mới
            this.createNewSeason(now);
            return;
        }
        // Nếu mùa hiện tại đã kết thúc (quá week_end)
        if (now >= activeSeason.week_end) {
            // Chốt mùa và trao thưởng nếu chưa trao
            if (!activeSeason.rewards_given) {
                this.finalizeSeason(activeSeason, now);
            }
            // Tạo mùa mới cho tuần tiếp theo
            this.createNewSeason(now);
        }
    }
    /**
     * Tạo mùa giải mới (chạy đầu tuần)
     */
    createNewSeason(now) {
        const { weekStart, weekEnd } = this.getCurrentWeekBounds(now);
        // Đếm số mùa đã có
        const countResult = database_1.default.prepare("SELECT COUNT(*) as c FROM duel_weekly_seasons").get();
        const seasonNumber = countResult.c + 1;
        database_1.default.prepare(`
      INSERT INTO duel_weekly_seasons (season_number, week_start, week_end, status, rewards_given, created_at)
      VALUES (?, ?, ?, 'active', 0, ?)
    `).run(seasonNumber, weekStart, weekEnd, now);
        console.log(`[MinigameService] 🆕 Mùa giải quyết đấu #${seasonNumber} bắt đầu (${new Date(weekStart * 1000).toLocaleDateString('vi-VN')} - ${new Date(weekEnd * 1000).toLocaleDateString('vi-VN')})`);
    }
    /**
     * Kết thúc mùa giải, snapshot top 3 và trao thưởng
     */
    finalizeSeason(season, now) {
        try {
            // Lấy top 3 từ duel_history trong khoảng thời gian của mùa
            const topPlayers = this.getWeeklyTopPlayers(season.week_start, season.week_end, 3);
            if (topPlayers.length === 0) {
                // Không có ai chơi trong tuần, vẫn đánh dấu kết thúc
                database_1.default.prepare(`
          UPDATE duel_weekly_seasons SET status = 'ended', rewards_given = 1 WHERE id = ?
        `).run(season.id);
                return;
            }
            // Tạo transaction để lưu top và trao thưởng
            const finalizeTx = database_1.default.transaction((players) => {
                for (let i = 0; i < players.length; i++) {
                    const player = players[i];
                    const prize = WEEKLY_PRIZES[i];
                    const totalMatches = player.wins + player.losses;
                    const winRate = totalMatches > 0 ? Math.round((player.wins / (player.wins + player.losses)) * 100) : 0;
                    // Lưu vào bảng top rewards
                    database_1.default.prepare(`
            INSERT INTO duel_top_rewards 
              (season_id, rank, user_id, user_name, wins, net_winnings, win_rate,
               reward_coins, reward_tu_vi, reward_ngotinh, reward_items, claimed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).run(season.id, i + 1, player.userId, player.name, player.wins, player.netWinnings, winRate, prize.coins, prize.tuVi, prize.ngotinh, JSON.stringify(prize.items), now);
                    // Trao thưởng trực tiếp
                    const user = UserRepository_1.userRepository.get(player.userId);
                    if (user) {
                        // Linh Thạch
                        UserRepository_1.userRepository.update(player.userId, {
                            coin_ha_pham: user.coin_ha_pham + prize.coins,
                            tu_vi: Math.min(user.tu_vi + prize.tuVi, user.exp_needed),
                            ngotinh: (user.ngotinh || 0) + prize.ngotinh
                        });
                        // Vật phẩm
                        for (const item of prize.items) {
                            InventoryRepository_1.inventoryRepository.addItem(player.userId, item.item_id, item.quantity);
                        }
                        // Ghi audit log
                        const { systemConfigService } = require('./SystemConfigService');
                        systemConfigService.writeAuditLog(player.userId, 'duel_weekly_reward', {
                            season: season.season_number,
                            rank: i + 1,
                            rewards: prize
                        });
                        console.log(`[MinigameService] 🏆 Top ${i + 1} mùa #${season.season_number}: ${player.name} - ` +
                            `+${prize.coins} Linh Thạch, +${prize.tuVi} Tu Vi, +${prize.ngotinh} Ngộ Tính`);
                    }
                }
                // Đánh dấu mùa đã kết thúc
                database_1.default.prepare(`
          UPDATE duel_weekly_seasons SET status = 'ended', rewards_given = 1 WHERE id = ?
        `).run(season.id);
            });
            finalizeTx(topPlayers);
            console.log(`[MinigameService] ✅ Đã trao thưởng mùa giải quyết đấu #${season.season_number} cho ${topPlayers.length} tu sĩ.`);
        }
        catch (e) {
            console.error('[MinigameService] Lỗi finalizeSeason:', e);
        }
    }
    /**
     * Lấy top N người chơi từ duel_history trong khoảng thời gian
     */
    getWeeklyTopPlayers(weekStart, weekEnd, limit) {
        // Thắng
        const winsRows = database_1.default.prepare(`
      SELECT winner_id, COUNT(*) as wins, COALESCE(SUM(winnings - wager), 0) as net_earned
      FROM duel_history
      WHERE is_tie = 0 AND fought_at >= ? AND fought_at < ?
      GROUP BY winner_id
    `).all(weekStart, weekEnd);
        // Thua
        const lossesRows = database_1.default.prepare(`
      SELECT loser_id, COUNT(*) as losses, COALESCE(SUM(wager), 0) as lost_total
      FROM duel_history
      WHERE is_tie = 0 AND fought_at >= ? AND fought_at < ?
      GROUP BY loser_id
    `).all(weekStart, weekEnd);
        // Build map
        const playerMap = new Map();
        for (const row of winsRows) {
            playerMap.set(row.winner_id, {
                wins: row.wins, losses: 0,
                netEarned: row.net_earned, lostTotal: 0
            });
        }
        for (const row of lossesRows) {
            const existing = playerMap.get(row.loser_id);
            if (existing) {
                existing.losses = row.losses;
                existing.lostTotal = row.lost_total;
            }
            else {
                playerMap.set(row.loser_id, {
                    wins: 0, losses: row.losses,
                    netEarned: 0, lostTotal: row.lost_total
                });
            }
        }
        // Sort: theo số trận thắng > linh thạch ròng > winrate (tổng số trận)
        const sorted = Array.from(playerMap.entries())
            .map(([userId, stats]) => {
            const user = UserRepository_1.userRepository.get(userId);
            const totalMatches = stats.wins + stats.losses;
            return {
                userId,
                name: user?.name || 'Tu sĩ vô danh',
                wins: stats.wins,
                losses: stats.losses,
                netWinnings: stats.netEarned - stats.lostTotal,
                totalMatches,
                winRate: totalMatches > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0
            };
        })
            .sort((a, b) => {
            if (b.wins !== a.wins)
                return b.wins - a.wins;
            if (b.netWinnings !== a.netWinnings)
                return b.netWinnings - a.netWinnings;
            return b.winRate - a.winRate;
        });
        return sorted.slice(0, limit);
    }
    /**
     * Lấy thông tin top 3 mùa trước (hoặc gần nhất) để hiển thị
     */
    getLastSeasonTop() {
        // Lấy mùa đã kết thúc gần nhất (hoặc mùa active hiện tại nếu không có mùa kết thúc)
        const lastSeason = database_1.default.prepare(`
      SELECT * FROM duel_weekly_seasons 
      WHERE status = 'ended' AND rewards_given = 1
      ORDER BY week_end DESC LIMIT 1
    `).get();
        if (!lastSeason) {
            return { season: null, top: [] };
        }
        const topRecords = database_1.default.prepare(`
      SELECT * FROM duel_top_rewards
      WHERE season_id = ?
      ORDER BY rank ASC
    `).all(lastSeason.id);
        const top = topRecords.map((r) => ({
            rank: r.rank,
            userId: r.user_id,
            userName: r.user_name,
            wins: r.wins,
            netWinnings: r.net_winnings,
            winRate: r.win_rate,
            rewardCoins: r.reward_coins,
            rewardTuVi: r.reward_tu_vi,
            rewardNgotinh: r.reward_ngotinh,
            rewardItems: JSON.parse(r.reward_items || '[]'),
            claimed: r.claimed === 1
        }));
        return {
            season: { id: lastSeason.id, season_number: lastSeason.season_number, week_start: lastSeason.week_start, week_end: lastSeason.week_end },
            top
        };
    }
    /**
     * Lấy thông tin mùa giải hiện tại
     */
    getCurrentSeason() {
        const currentSeason = database_1.default.prepare("SELECT * FROM duel_weekly_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        if (!currentSeason) {
            return { season: null, hasStarted: false };
        }
        const now = Math.floor(Date.now() / 1000);
        return {
            season: {
                id: currentSeason.id,
                season_number: currentSeason.season_number,
                week_start: currentSeason.week_start,
                week_end: currentSeason.week_end
            },
            hasStarted: now >= currentSeason.week_start
        };
    }
    /**
     * Tính toán thời gian bắt đầu và kết thúc của tuần hiện tại (theo UTC+7, tuần từ T2 00:00)
     */
    getCurrentWeekBounds(now) {
        const vnNow = new Date((now + 7 * 3600) * 1000); // UTC+7
        const dayOfWeek = vnNow.getUTCDay(); // 0=CN, 1=T2, ..., 6=T7
        // Số ngày lùi về thứ 2 đầu tuần
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayStart = new Date(vnNow);
        mondayStart.setUTCDate(vnNow.getUTCDate() - daysSinceMonday);
        mondayStart.setUTCHours(0, 0, 0, 0);
        const nextMonday = new Date(mondayStart);
        nextMonday.setUTCDate(mondayStart.getUTCDate() + 7);
        // Chuyển về Unix timestamp (UTC)
        const weekStart = Math.floor((mondayStart.getTime() - 7 * 3600000) / 1000);
        const weekEnd = Math.floor((nextMonday.getTime() - 7 * 3600000) / 1000);
        return { weekStart, weekEnd };
    }
}
exports.MinigameService = MinigameService;
exports.minigameService = new MinigameService();
