import db from '../database/database';

interface PowerStats {
  median: number;
  p5: number;   // top 5% threshold
  p10: number;  // top 10% threshold
  p30: number;  // bottom 30% threshold
  p10_bottom: number; // bottom 10% threshold
  totalPlayers: number;
  lastUpdated: number;
}

class AutoBalanceService {
  private cachedStats: PowerStats | null = null;
  private readonly CACHE_TTL = 600; // 10 phút

  private calculateStats(): PowerStats {
    const now = Math.floor(Date.now() / 1000);

    // Tính combat power cho tất cả users
    const users = db.prepare(`
      SELECT discord_id, level, base_hp, base_mp, base_atk, base_def, base_crit, base_crit_res, base_luck, base_speed, base_dodge
      FROM users WHERE level > 0
    `).all() as any[];

    if (users.length === 0) {
      return { median: 1000, p5: 1000, p10: 1000, p30: 1000, p10_bottom: 1000, totalPlayers: 0, lastUpdated: now };
    }

    // Tính combat power cho mỗi user (simplified formula)
    const powers = users.map(u => {
      return Math.round(
        (u.base_hp || 100) * 0.2 +
        (u.base_mp || 50) * 0.1 +
        (u.base_atk || 15) * 3 +
        (u.base_def || 10) * 5 +
        (u.base_crit || 0.05) * 1000 +
        (u.base_crit_res || 0) * 1000 +
        (u.base_luck || 10) * 10 +
        (u.base_speed || 100) * 10 +
        (u.base_dodge || 0.05) * 1000
      );
    }).sort((a, b) => a - b);

    const total = powers.length;
    const percentile = (p: number) => powers[Math.min(Math.floor(total * p), total - 1)];

    this.cachedStats = {
      median: percentile(0.5),
      p5: percentile(0.95),     // top 5% = 95th percentile
      p10: percentile(0.90),    // top 10% = 90th percentile
      p30: percentile(0.30),    // bottom 30%
      p10_bottom: percentile(0.10), // bottom 10%
      totalPlayers: total,
      lastUpdated: now
    };

    return this.cachedStats;
  }

  private getStats(): PowerStats {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedStats && (now - this.cachedStats.lastUpdated) < this.CACHE_TTL) {
      return this.cachedStats;
    }
    return this.calculateStats();
  }

  /**
   * Lấy hệ số cân bằng cho PvP (debuff top, buff yếu)
   */
  getPvPMultipliers(userId: string): { atkMult: number; defMult: number } {
    const stats = this.getStats();
    if (stats.totalPlayers < 5) return { atkMult: 1.0, defMult: 1.0 };

    const user = db.prepare('SELECT base_atk, base_def, base_hp, base_mp, base_crit, base_crit_res, base_luck, base_speed, base_dodge FROM users WHERE discord_id = ?').get(userId) as any;
    if (!user) return { atkMult: 1.0, defMult: 1.0 };

    const userPower = Math.round(
      (user.base_hp || 100) * 0.2 + (user.base_mp || 50) * 0.1 +
      (user.base_atk || 15) * 3 + (user.base_def || 10) * 5 +
      (user.base_crit || 0.05) * 1000 + (user.base_crit_res || 0) * 1000 +
      (user.base_luck || 10) * 10 + (user.base_speed || 100) * 10 +
      (user.base_dodge || 0.05) * 1000
    );

    // Top 5%: -10% ATK
    if (userPower >= stats.p5) return { atkMult: 0.90, defMult: 1.0 };
    // Top 10%: -5% ATK
    if (userPower >= stats.p10) return { atkMult: 0.95, defMult: 1.0 };
    // Bottom 10%: +20% ATK, +10% DEF
    if (userPower <= stats.p10_bottom) return { atkMult: 1.20, defMult: 1.10 };
    // Bottom 30%: +10% ATK, +5% DEF
    if (userPower <= stats.p30) return { atkMult: 1.10, defMult: 1.05 };
    // Middle: no change
    return { atkMult: 1.0, defMult: 1.0 };
  }

  /**
   * Lấy hệ số scale cho PvE (boss difficulty adjusts based on player power)
   */
  getPvEScaleFactor(userId: string): number {
    const stats = this.getStats();
    if (stats.totalPlayers < 5 || stats.median === 0) return 1.0;

    const user = db.prepare('SELECT base_atk, base_def, base_hp, base_mp, base_crit, base_crit_res, base_luck, base_speed, base_dodge FROM users WHERE discord_id = ?').get(userId) as any;
    if (!user) return 1.0;

    const userPower = Math.round(
      (user.base_hp || 100) * 0.2 + (user.base_mp || 50) * 0.1 +
      (user.base_atk || 15) * 3 + (user.base_def || 10) * 5 +
      (user.base_crit || 0.05) * 1000 + (user.base_crit_res || 0) * 1000 +
      (user.base_luck || 10) * 10 + (user.base_speed || 100) * 10 +
      (user.base_dodge || 0.05) * 1000
    );

    // ponytail: mở rộng middle range (trước chỉ 4 threshold)
    const ratio = userPower / stats.median;
    if (ratio > 3.0) return 1.30;
    if (ratio > 2.0) return 1.15;
    if (ratio > 1.5) return 1.10;
    if (ratio > 1.2) return 1.05;
    if (ratio < 0.5) return 0.70;
    if (ratio < 0.65) return 0.80;
    if (ratio < 0.8) return 0.85;
    return 1.0;
  }

  /**
   * Lấy thông tin debug về auto-balance
   */
  getDebugInfo(userId: string): string {
    const stats = this.getStats();
    const pvp = this.getPvPMultipliers(userId);
    const pve = this.getPvEScaleFactor(userId);

    return `📊 **Auto-Balance Debug**\n` +
      `Players: ${stats.totalPlayers}\n` +
      `Median Power: ${stats.median}\n` +
      `PvP: ATK x${pvp.atkMult}, DEF x${pvp.defMult}\n` +
      `PvE Scale: x${pve}`;
  }
}

export const autoBalanceService = new AutoBalanceService();
