import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export interface Brotherhood {
  user1_id: string;
  user2_id: string;
  formed_at: number;
}

interface PendingInvite {
  fromUserId: string;
  toUserId: string;
  sentAt: number;
}

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const SHARED_EXP_BONUS = 0.05;
const PARTY_ATK_BONUS = 0.03;

export class BrotherhoodService {
  private brotherhoods = new Map<string, Brotherhood>();
  private pendingInvites = new Map<string, PendingInvite>();

  private getKey(user1: string, user2: string): string {
    return [user1, user2].sort().join(':');
  }

  private loadFromDb(userId: string): Brotherhood | null {
    const row = db.prepare(
      'SELECT user1_id, user2_id, formed_at FROM brotherhoods WHERE user1_id = ? OR user2_id = ?'
    ).get(userId, userId) as { user1_id: string; user2_id: string; formed_at: number } | undefined;

    if (!row) return null;
    const bh: Brotherhood = { user1_id: row.user1_id, user2_id: row.user2_id, formed_at: row.formed_at };
    this.brotherhoods.set(this.getKey(bh.user1_id, bh.user2_id), bh);
    return bh;
  }

  public sendInvite(fromUserId: string, toUserId: string): { success: boolean; message: string } {
    if (fromUserId === toUserId) {
      return { success: false, message: 'Không thể kết nghĩa với chính mình.' };
    }

    const fromUser = userRepository.get(fromUserId);
    const toUser = userRepository.get(toUserId);

    if (!fromUser) return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    if (!toUser) return { success: false, message: 'Người được mời chưa tạo nhân vật!' };

    const existing = this.getBrotherhood(fromUserId);
    if (existing) return { success: false, message: 'Đạo hữu đã có kết nghĩa rồi!' };

    const existingTarget = this.getBrotherhood(toUserId);
    if (existingTarget) return { success: false, message: 'Người này đã có kết nghĩa rồi!' };

    this.pendingInvites.delete(toUserId);
    this.pendingInvites.delete(fromUserId);

    this.pendingInvites.set(toUserId, { fromUserId, toUserId, sentAt: Date.now() });

    return { success: true, message: `🌸 Đã gửi lời kết nghĩa đến **${toUser.name}**! Hãy chờ hồi âm.` };
  }

  public acceptInvite(userId: string): { success: boolean; message: string } {
    const invite = this.pendingInvites.get(userId);
    if (!invite || invite.toUserId !== userId) {
      return { success: false, message: 'Không có lời mời kết nghĩa nào đang chờ!' };
    }

    const fromUser = userRepository.get(invite.fromUserId);
    const toUser = userRepository.get(invite.toUserId);
    if (!fromUser || !toUser) return { success: false, message: 'Nhân vật không tồn tại!' };

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
    const bh: Brotherhood = { user1_id: invite.fromUserId, user2_id: invite.toUserId, formed_at: now };

    db.prepare(
      'INSERT INTO brotherhoods (user1_id, user2_id, formed_at) VALUES (?, ?, ?)'
    ).run(bh.user1_id, bh.user2_id, Math.floor(now / 1000));

    this.brotherhoods.set(key, bh);
    this.pendingInvites.delete(userId);

    return {
      success: true,
      message: `🎉 **KẾT NGHĨA THÀNH CÔNG!** 🎉\n${fromUser.name} và ${toUser.name} đã trở thành huynh đệ!
- Hưởng **${(SHARED_EXP_BONUS * 100).toFixed(0)}%** kinh nghiệm chia sẻ khi đi chung
- Nhận **${(PARTY_ATK_BONUS * 100).toFixed(0)}%** sát thương khi cùng tổ đội`
    };
  }

  public rejectInvite(userId: string): { success: boolean; message: string } {
    const invite = this.pendingInvites.get(userId);
    if (!invite || invite.toUserId !== userId) {
      return { success: false, message: 'Không có lời mời nào để từ chối!' };
    }

    this.pendingInvites.delete(userId);
    return { success: true, message: 'Đã từ chối lời kết nghĩa.' };
  }

  public breakBrotherhood(userId: string): { success: boolean; message: string } {
    const bh = this.getBrotherhood(userId);
    if (!bh) return { success: false, message: 'Đạo hữu chưa có kết nghĩa!' };

    const key = this.getKey(bh.user1_id, bh.user2_id);

    db.prepare(
      'DELETE FROM brotherhoods WHERE user1_id = ? AND user2_id = ?'
    ).run(bh.user1_id, bh.user2_id);

    this.brotherhoods.delete(key);

    return {
      success: true,
      message: '💔 Huynh đệ tình thâm đã đoạn! Bắt đầu hồi chiêu **7 ngày** mới có thể kết nghĩa lại.'
    };
  }

  public getBrotherhood(userId: string): Brotherhood | null {
    for (const bh of this.brotherhoods.values()) {
      if (bh.user1_id === userId || bh.user2_id === userId) return bh;
    }
    return this.loadFromDb(userId);
  }

  public getSharedExpBonus(userId: string): number {
    const bh = this.getBrotherhood(userId);
    return bh ? SHARED_EXP_BONUS : 0;
  }

  public getPartyAtkBonus(userId1: string, userId2: string): number {
    const bh1 = this.getBrotherhood(userId1);
    if (!bh1) return 0;
    if (
      (bh1.user1_id === userId1 && bh1.user2_id === userId2) ||
      (bh1.user2_id === userId1 && bh1.user1_id === userId2)
    ) {
      return PARTY_ATK_BONUS;
    }
    return 0;
  }

  public getPendingInvite(userId: string): { fromUserId: string; toUserId: string } | null {
    const invite = this.pendingInvites.get(userId);
    if (!invite) return null;
    return { fromUserId: invite.fromUserId, toUserId: invite.toUserId };
  }

  public getCooldownRemaining(userId: string): number | null {
    const bh = this.getBrotherhood(userId);
    if (bh) return null;
    const lastBh = db.prepare(
      'SELECT formed_at FROM brotherhoods WHERE user1_id = ? OR user2_id = ? ORDER BY formed_at DESC LIMIT 1'
    ).get(userId, userId) as { formed_at: number } | undefined;

    if (!lastBh) return null;

    const elapsed = Date.now() - lastBh.formed_at * 1000;
    if (elapsed >= COOLDOWN_MS) return null;

    return COOLDOWN_MS - elapsed;
  }
}

export const brotherhoodService = new BrotherhoodService();
