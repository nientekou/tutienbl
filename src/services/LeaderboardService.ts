import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryService } from './InventoryService';
import { getRealmDetails } from '../utils/constants';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  value: number;
  displayValue: string;
  extra?: string;
}

interface LeaderboardCache {
  combatPower: { data: LeaderboardEntry[]; cachedAt: number };
  realm: { data: LeaderboardEntry[]; cachedAt: number };
  wealth: { data: LeaderboardEntry[]; cachedAt: number };
  sectContribution: { data: LeaderboardEntry[]; cachedAt: number };
  arena: { data: LeaderboardEntry[]; cachedAt: number };
  alchemy: { data: LeaderboardEntry[]; cachedAt: number };
  forging: { data: LeaderboardEntry[]; cachedAt: number };
}

const CACHE_TTL = 5 * 60 * 1000; // 5 phút
const HIDDEN_USER_IDS = new Set(['724608013981450351']); // Admin - ẩn khỏi bảng xếp hạng

class LeaderboardService {
  private cache: LeaderboardCache = {
    combatPower: { data: [], cachedAt: 0 },
    realm: { data: [], cachedAt: 0 },
    wealth: { data: [], cachedAt: 0 },
    sectContribution: { data: [], cachedAt: 0 },
    arena: { data: [], cachedAt: 0 },
    alchemy: { data: [], cachedAt: 0 },
    forging: { data: [], cachedAt: 0 },
  };

  private isCacheValid(type: keyof LeaderboardCache): boolean {
    return Date.now() - this.cache[type].cachedAt < CACHE_TTL;
  }

  private getRealmName(level: number): string {
    if (level >= 380) return 'Đại La Kim Tiên';
    if (level >= 350) return 'Kim Tiên';
    if (level >= 300) return 'Chân Tiên';
    if (level >= 250) return 'Địa Tiên';
    if (level >= 200) return 'Nguyên Anh';
    if (level >= 160) return 'Kết Đan';
    if (level >= 120) return 'Trúc Cơ';
    if (level >= 80) return 'Luyện Khí';
    if (level >= 40) return 'Phàm Nhân';
    return 'Sơ Nhập';
  }

  /** Top Lực Chiến */
  getTopCombatPower(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('combatPower')) {
      return this.cache.combatPower.data.slice(0, limit);
    }
    const users = db.prepare(
      "SELECT discord_id, name, level, base_hp, base_mp, base_atk, base_def, base_crit, base_crit_res, base_luck, base_speed, base_dodge FROM users WHERE level > 0 ORDER BY level DESC LIMIT 100"
    ).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => {
        const stats = inventoryService.getActiveStats(u.discord_id);
      const cp = stats ? Math.round(
        stats.hp * 0.2 + stats.mp * 0.1 + stats.atk * 3 + stats.def * 5 +
        stats.crit * 1000 + stats.critRes * 1000 + stats.luck * 10 +
        stats.speed * 10 + stats.dodge * 1000
      ) : Math.round(
        u.base_hp * 0.2 + u.base_mp * 0.1 + u.base_atk * 3 + u.base_def * 5 +
        u.base_crit * 1000 + u.base_crit_res * 1000 + u.base_luck * 10 +
        u.base_speed * 10 + u.base_dodge * 1000
      );
      return {
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: cp,
        displayValue: cp.toLocaleString(),
        extra: this.getRealmName(u.level),
      };
    });

    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => e.rank = i + 1);

    this.cache.combatPower = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Cảnh Giới */
  getTopRealm(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('realm')) {
      return this.cache.realm.data.slice(0, limit);
    }
    const users = db.prepare(
      "SELECT discord_id, name, level FROM users WHERE level > 0 ORDER BY level DESC, tu_vi DESC LIMIT 100"
    ).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => ({
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: u.level,
      displayValue: `Cấp ${u.level}`,
      extra: this.getRealmName(u.level),
    }));

    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.realm = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Tài Sản (Linh Thạch quy đổi) */
  getTopWealth(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('wealth')) {
      return this.cache.wealth.data.slice(0, limit);
    }
    const users = db.prepare(
      "SELECT discord_id, name, coin_ha_pham, coin_trung_pham, coin_thuong_pham FROM users WHERE coin_ha_pham > 0 ORDER BY coin_ha_pham DESC LIMIT 100"
    ).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => {
        const total = u.coin_ha_pham + (u.coin_trung_pham || 0) * 100 + (u.coin_thuong_pham || 0) * 10000;
      return {
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: total,
        displayValue: total.toLocaleString() + ' LT',
        extra: `Hạ: ${(u.coin_ha_pham || 0).toLocaleString()} | Trung: ${(u.coin_trung_pham || 0)} | Thượng: ${(u.coin_thuong_pham || 0)}`,
      };
    });

    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.wealth = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Cống Hiến Tông Môn */
  getTopSectContribution(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('sectContribution')) {
      return this.cache.sectContribution.data.slice(0, limit);
    }
    const users = db.prepare(`
      SELECT u.discord_id, u.name, u.sect_contribution, s.name as sect_name
      FROM users u
      LEFT JOIN sects s ON u.sect_id = s.id
      WHERE u.sect_contribution > 0
      ORDER BY u.sect_contribution DESC
      LIMIT 100
    `).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => ({
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: u.sect_contribution || 0,
      displayValue: `${(u.sect_contribution || 0).toLocaleString()} điểm`,
      extra: u.sect_name ? `Tông Môn: ${u.sect_name}` : 'Tán Tu',
    }));

    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.sectContribution = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Đấu Trường (ELO) */
  getTopArena(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('arena')) {
      return this.cache.arena.data.slice(0, limit);
    }
    const users = db.prepare(`
      SELECT ap.user_id as discord_id, u.name, ap.elo, ap.wins, ap.losses, u.level
      FROM arena_profiles ap
      JOIN users u ON ap.user_id = u.discord_id
      WHERE ap.elo > 0
      ORDER BY ap.elo DESC, ap.wins DESC
      LIMIT 100
    `).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => ({
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: u.elo,
      displayValue: `${u.elo.toLocaleString()} Điểm`,
      extra: `Cảnh Giới: ${getRealmDetails(u.level).realmName} | Thắng: ${u.wins} / Thua: ${u.losses}`,
    }));

    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.arena = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Luyện Đan */
  getTopAlchemy(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('alchemy')) {
      return this.cache.alchemy.data.slice(0, limit);
    }
    const users = db.prepare(`
      SELECT discord_id, name, alchemy_level, alchemy_exp
      FROM users
      WHERE alchemy_level > 0
      ORDER BY alchemy_level DESC, alchemy_exp DESC
      LIMIT 100
    `).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => ({
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: u.alchemy_level * 1000000 + u.alchemy_exp,
      displayValue: `Cấp ${u.alchemy_level}`,
      extra: `Kinh Nghiệm: ${u.alchemy_exp.toLocaleString()}`,
    }));

    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.alchemy = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Top Luyện Khí */
  getTopForging(limit: number = 20): LeaderboardEntry[] {
    if (this.isCacheValid('forging')) {
      return this.cache.forging.data.slice(0, limit);
    }
    const users = db.prepare(`
      SELECT discord_id, name, forging_level, forging_exp
      FROM users
      WHERE forging_level > 0
      ORDER BY forging_level DESC, forging_exp DESC
      LIMIT 100
    `).all() as any[];

    const entries: LeaderboardEntry[] = users
      .filter(u => !HIDDEN_USER_IDS.has(u.discord_id))
      .map(u => ({
        rank: 0,
        userId: u.discord_id,
        name: u.name,
        value: u.forging_level * 1000000 + u.forging_exp,
      displayValue: `Cấp ${u.forging_level}`,
      extra: `Kinh Nghiệm: ${u.forging_exp.toLocaleString()}`,
    }));

    entries.forEach((e, i) => e.rank = i + 1);
    this.cache.forging = { data: entries, cachedAt: Date.now() };
    return entries.slice(0, limit);
  }

  /** Tìm rank của user trong bảng xếp hạng */
  getUserRank(type: 'combatPower' | 'realm' | 'wealth' | 'sectContribution' | 'arena' | 'alchemy' | 'forging', userId: string): { rank: number; total: number } | null {
    const methodMap: Record<string, () => LeaderboardEntry[]> = {
      combatPower: () => this.getTopCombatPower(100),
      realm: () => this.getTopRealm(100),
      wealth: () => this.getTopWealth(100),
      sectContribution: () => this.getTopSectContribution(100),
      arena: () => this.getTopArena(100),
      alchemy: () => this.getTopAlchemy(100),
      forging: () => this.getTopForging(100),
    };
    const data = methodMap[type]?.();
    if (!data) return null;
    const userEntry = data.find(e => e.userId === userId);
    if (!userEntry) return null;
    return { rank: userEntry.rank, total: data.length };
  }

  /** Force clear all caches */
  public clearCache(): void {
    for (const key of Object.keys(this.cache)) {
      (this.cache as any)[key] = { data: [], cachedAt: 0 };
    }
  }

  /** Force refresh cache */
  refreshCache(): void {
    this.cache.combatPower.cachedAt = 0;
    this.cache.realm.cachedAt = 0;
    this.cache.wealth.cachedAt = 0;
    this.cache.sectContribution.cachedAt = 0;
    this.cache.arena.cachedAt = 0;
    this.cache.alchemy.cachedAt = 0;
    this.cache.forging.cachedAt = 0;
  }
}

export const leaderboardService = new LeaderboardService();
