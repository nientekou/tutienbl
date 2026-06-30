import { userRepository } from '../database/repositories/UserRepository';
import db from '../database/database';

export type KarmaLevel = 'good' | 'neutral' | 'evil';

const KARMA_THRESHOLD_GOOD = 50;
const KARMA_THRESHOLD_EVIL = -50;

class KarmaService {
  getKarma(userId: string): number {
    const user = userRepository.get(userId);
    return user?.karma ?? 0;
  }

  getKarmaLevel(userId: string): KarmaLevel {
    const karma = this.getKarma(userId);
    if (karma >= KARMA_THRESHOLD_GOOD) return 'good';
    if (karma <= KARMA_THRESHOLD_EVIL) return 'evil';
    return 'neutral';
  }

  addKarma(userId: string, amount: number): number {
    const user = userRepository.get(userId);
    if (!user) return 0;
    const newKarma = Math.max(-100, Math.min(100, user.karma + amount));
    userRepository.update(userId, { karma: newKarma });
    return newKarma;
  }

  /** Thiện: -10% shop price */
  getShopDiscount(userId: string): number {
    return this.getKarmaLevel(userId) === 'good' ? 0.10 : 0;
  }

  /** Thiện: +5% breakthrough rate */
  getBreakthroughBonus(userId: string): number {
    return this.getKarmaLevel(userId) === 'good' ? 0.05 : 0;
  }

  /** Thiện: -15% tribulation (lightning) damage */
  getTribulationReduction(userId: string): number {
    return this.getKarmaLevel(userId) === 'good' ? 0.15 : 0;
  }

  /** Ác: +15% crit damage in combat */
  getCritBonus(userId: string): number {
    return this.getKarmaLevel(userId) === 'evil' ? 0.15 : 0;
  }

  /** Ác: enhance/craft success rate bonus */
  getCraftBonus(userId: string): number {
    return this.getKarmaLevel(userId) === 'evil' ? 0.05 : 0;
  }

  /** Check if user can join a sect (orthodox sects reject evil) */
  canJoinSect(userId: string, sectId: number): { allowed: boolean; reason?: string } {
    const level = this.getKarmaLevel(userId);
    if (level === 'evil') {
      const sect = db.prepare('SELECT id, name FROM sects WHERE id = ?').get(sectId) as any;
      if (sect) {
        return { allowed: false, reason: `Tông môn ${sect.name} từ chối kẻ ác duyên! Hãy tìm Ma Tông.` };
      }
    }
    return { allowed: true };
  }

  /** Daily Thiên Phạt check for evil alignment (10% chance per command use) */
  rollThienPhat(userId: string): { punished: boolean; message?: string } {
    if (this.getKarmaLevel(userId) !== 'evil') return { punished: false };
    if (Math.random() < 0.10) {
      const user = userRepository.get(userId);
      if (!user) return { punished: false };
      const staminaLoss = Math.min(user.stamina, Math.floor(Math.random() * 15) + 5);
      userRepository.update(userId, { stamina: user.stamina - staminaLoss });
      return { punished: true, message: `⚡ **[Thiên Phạt]** Trời giáng sét đánh! Đạo hữu mất **${staminaLoss}** Thể Lực vì nghiệp chướng!` };
    }
    return { punished: false };
  }
}

export const karmaService = new KarmaService();
