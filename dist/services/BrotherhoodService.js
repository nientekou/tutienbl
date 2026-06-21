"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brotherhoodService = exports.BrotherhoodService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const SHARED_EXP_BONUS = 0.05;
const PARTY_ATK_BONUS = 0.03;
class BrotherhoodService {
    brotherhoods = new Map();
    pendingInvites = new Map();
    getKey(user1, user2) {
        return [user1, user2].sort().join(':');
    }
    loadFromDb(userId) {
        const row = database_1.default.prepare('SELECT user1_id, user2_id, formed_at FROM brotherhoods WHERE user1_id = ? OR user2_id = ?').get(userId, userId);
        if (!row)
            return null;
        const bh = { user1_id: row.user1_id, user2_id: row.user2_id, formed_at: row.formed_at };
        this.brotherhoods.set(this.getKey(bh.user1_id, bh.user2_id), bh);
        return bh;
    }
    sendInvite(fromUserId, toUserId) {
        if (fromUserId === toUserId) {
            return { success: false, message: 'Không thể kết nghĩa với chính mình.' };
        }
        const fromUser = UserRepository_1.userRepository.get(fromUserId);
        const toUser = UserRepository_1.userRepository.get(toUserId);
        if (!fromUser)
            return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
        if (!toUser)
            return { success: false, message: 'Người được mời chưa tạo nhân vật!' };
        const existing = this.getBrotherhood(fromUserId);
        if (existing)
            return { success: false, message: 'Đạo hữu đã có kết nghĩa rồi!' };
        const existingTarget = this.getBrotherhood(toUserId);
        if (existingTarget)
            return { success: false, message: 'Người này đã có kết nghĩa rồi!' };
        this.pendingInvites.delete(toUserId);
        this.pendingInvites.delete(fromUserId);
        this.pendingInvites.set(toUserId, { fromUserId, toUserId, sentAt: Date.now() });
        return { success: true, message: `🌸 Đã gửi lời kết nghĩa đến **${toUser.name}**! Hãy chờ hồi âm.` };
    }
    acceptInvite(userId) {
        const invite = this.pendingInvites.get(userId);
        if (!invite || invite.toUserId !== userId) {
            return { success: false, message: 'Không có lời mời kết nghĩa nào đang chờ!' };
        }
        const fromUser = UserRepository_1.userRepository.get(invite.fromUserId);
        const toUser = UserRepository_1.userRepository.get(invite.toUserId);
        if (!fromUser || !toUser)
            return { success: false, message: 'Nhân vật không tồn tại!' };
        const existing1 = this.getBrotherhood(invite.fromUserId);
        if (existing1) {
            this.pendingInvites.delete(userId);
            return { success: false, message: 'Người mời đã có kết nghĩa khác rồi!' };
        }
        const existing2 = this.getBrotherhood(invite.toUserId);
        if (existing2) {
            this.pendingInvites.delete(userId);
            return { success: false, message: 'Đạo hữu đã có kết nghĩa rồi!' };
        }
        const now = Date.now();
        const key = this.getKey(invite.fromUserId, invite.toUserId);
        const bh = { user1_id: invite.fromUserId, user2_id: invite.toUserId, formed_at: now };
        database_1.default.prepare('INSERT INTO brotherhoods (user1_id, user2_id, formed_at) VALUES (?, ?, ?)').run(bh.user1_id, bh.user2_id, Math.floor(now / 1000));
        this.brotherhoods.set(key, bh);
        this.pendingInvites.delete(userId);
        return {
            success: true,
            message: `🎉 **KẾT NGHĨA THÀNH CÔNG!** 🎉\n${fromUser.name} và ${toUser.name} đã trở thành huynh đệ!
- Hưởng **${(SHARED_EXP_BONUS * 100).toFixed(0)}%** kinh nghiệm chia sẻ khi đi chung
- Nhận **${(PARTY_ATK_BONUS * 100).toFixed(0)}%** sát thương khi cùng tổ đội`
        };
    }
    rejectInvite(userId) {
        const invite = this.pendingInvites.get(userId);
        if (!invite || invite.toUserId !== userId) {
            return { success: false, message: 'Không có lời mời nào để từ chối!' };
        }
        this.pendingInvites.delete(userId);
        return { success: true, message: 'Đã từ chối lời kết nghĩa.' };
    }
    breakBrotherhood(userId) {
        const bh = this.getBrotherhood(userId);
        if (!bh)
            return { success: false, message: 'Đạo hữu chưa có kết nghĩa!' };
        const key = this.getKey(bh.user1_id, bh.user2_id);
        database_1.default.prepare('DELETE FROM brotherhoods WHERE user1_id = ? AND user2_id = ?').run(bh.user1_id, bh.user2_id);
        this.brotherhoods.delete(key);
        return {
            success: true,
            message: '💔 Huynh đệ tình thâm đã đoạn! Bắt đầu hồi chiêu **7 ngày** mới có thể kết nghĩa lại.'
        };
    }
    getBrotherhood(userId) {
        for (const bh of this.brotherhoods.values()) {
            if (bh.user1_id === userId || bh.user2_id === userId)
                return bh;
        }
        return this.loadFromDb(userId);
    }
    getSharedExpBonus(userId) {
        const bh = this.getBrotherhood(userId);
        return bh ? SHARED_EXP_BONUS : 0;
    }
    getPartyAtkBonus(userId1, userId2) {
        const bh1 = this.getBrotherhood(userId1);
        if (!bh1)
            return 0;
        if ((bh1.user1_id === userId1 && bh1.user2_id === userId2) ||
            (bh1.user2_id === userId1 && bh1.user1_id === userId2)) {
            return PARTY_ATK_BONUS;
        }
        return 0;
    }
    getPendingInvite(userId) {
        const invite = this.pendingInvites.get(userId);
        if (!invite)
            return null;
        return { fromUserId: invite.fromUserId, toUserId: invite.toUserId };
    }
    getCooldownRemaining(userId) {
        const bh = this.getBrotherhood(userId);
        if (bh)
            return null;
        const lastBh = database_1.default.prepare('SELECT formed_at FROM brotherhoods WHERE user1_id = ? OR user2_id = ? ORDER BY formed_at DESC LIMIT 1').get(userId, userId);
        if (!lastBh)
            return null;
        const elapsed = Date.now() - lastBh.formed_at * 1000;
        if (elapsed >= COOLDOWN_MS)
            return null;
        return COOLDOWN_MS - elapsed;
    }
}
exports.BrotherhoodService = BrotherhoodService;
exports.brotherhoodService = new BrotherhoodService();
