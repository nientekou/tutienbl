import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export interface NgoTinhBuff {
  id: string;
  name: string;
  cost: number;
  duration: number; // seconds
  effect: string;
  emoji: string;
}

export const NGO_TINH_BUFFS: NgoTinhBuff[] = [
  { id: 'exp_boost', name: 'Tu Vi Quả', cost: 10, duration: 3600, effect: '+30% tu_vi gain', emoji: '🌿' },
  { id: 'luck_boost', name: 'Cơ Duyên', cost: 15, duration: 3600, effect: '+20% breakthrough rate', emoji: '🍀' },
  { id: 'crit_boost', name: 'Sát Tâm', cost: 12, duration: 1800, effect: '+15% crit rate', emoji: '💥' },
  { id: 'drop_boost', name: 'Bảo Vật', cost: 20, duration: 3600, effect: '+50% drop rate', emoji: '💎' },
  { id: 'forge_boost', name: 'Lô Hỏa', cost: 8, duration: 1800, effect: '+10% enhance success', emoji: '🔥' },
];

class NgoTinhService {
  constructor() {
    this.initTable();
  }

  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_buffs (
        user_id TEXT NOT NULL,
        buff_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, buff_id)
      );
    `);
  }

  getAvailableBuffs(): NgoTinhBuff[] {
    return NGO_TINH_BUFFS;
  }

  getActiveBuffs(userId: string): { buffId: string; expiresAt: number; remaining: number }[] {
    const now = Math.floor(Date.now() / 1000);
    const buffs = db.prepare(
      'SELECT buff_id, expires_at FROM user_buffs WHERE user_id = ? AND expires_at > ?'
    ).all(userId, now) as { buff_id: string; expires_at: number }[];

    return buffs.map(b => ({
      buffId: b.buff_id,
      expiresAt: b.expires_at,
      remaining: b.expires_at - now
    }));
  }

  isBuffActive(userId: string, buffId: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const buff = db.prepare(
      'SELECT expires_at FROM user_buffs WHERE user_id = ? AND buff_id = ? AND expires_at > ?'
    ).get(userId, buffId, now) as { expires_at: number } | undefined;
    return !!buff;
  }

  activateBuff(userId: string, buffId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };

    const buff = NGO_TINH_BUFFS.find(b => b.id === buffId);
    if (!buff) return { success: false, message: 'Buff không tồn tại!' };

    if ((user.ngotinh || 0) < buff.cost) {
      return { success: false, message: `Không đủ Ngộ Tính! Cần: ${buff.cost}, Có: ${user.ngotinh || 0}` };
    }

    // Kiểm tra đã active chưa
    if (this.isBuffActive(userId, buffId)) {
      const active = this.getActiveBuffs(userId).find(b => b.buffId === buffId);
      const remainingMin = Math.ceil((active?.remaining || 0) / 60);
      return { success: false, message: `Buff **${buff.name}** vẫn còn hiệu lực (${remainingMin} phút)!` };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + buff.duration;

    db.prepare(`
      INSERT INTO user_buffs (user_id, buff_id, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, buff_id) DO UPDATE SET expires_at = ?
    `).run(userId, buffId, expiresAt, expiresAt);

    userRepository.update(userId, { ngotinh: (user.ngotinh || 0) - buff.cost });

    const durationMin = Math.floor(buff.duration / 60);
    return {
      success: true,
      message: `${buff.emoji} Kích hoạt buff **${buff.name}** thành công! (${buff.effect}, ${durationMin} phút)\n💡 Tiêu hao: **${buff.cost}** Ngộ Tính.`
    };
  }
}

export const ngoTinhService = new NgoTinhService();
