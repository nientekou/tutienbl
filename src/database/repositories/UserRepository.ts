import db from '../database';

export interface UserEntity {
  discord_id: string;
  name: string;
  title: string;
  level: number;
  tu_vi: number;
  exp_needed: number;
  base_hp: number;
  hp: number;
  base_mp: number;
  base_atk: number;
  base_def: number;
  base_crit: number;
  base_crit_res: number;
  base_luck: number;
  base_speed: number;
  base_dodge: number;
  mp: number;
  max_mp: number;
  block_chance: number;
  linh_can: string;
  coin_ha_pham: number;
  coin_trung_pham: number;
  coin_thuong_pham: number;
  knb: number;
  destiny_shards: number;
  dream_dust: number;
  bounty_tokens: number;
  reincarnation_tokens: number;
  dao_tam: string | null;
  boss_points: number;
  sect_id: number | null;
  sect_role: string;
  sect_contribution: number;
  joined_sect_at: number | null;
  pvp_points: number;
  pvp_wins: number;
  pvp_losses: number;
  luan_hoi_count: number;
  y_canh: string;
  ngotinh: number;
  last_quexam_at: number;
  partner_id: string | null;
  intimacy: number;
  last_songtu_at: number;
  stamina: number;
  last_stamina_recover_at: number;
  alchemy_level: number;
  alchemy_exp: number;
  forging_level: number;
  forging_exp: number;
  injury_end_time: number;
  background: string;
  destiny: string;
  starting_skills: string;
  prophecy: string;
  heirloom: string;
  claimed_starting_bonus: number;
  alignment: string;
  qi_deviation_until: number;
  consecutive_fails: number;
  karma: number;
  created_at: number;
  updated_at: number;
}

export class UserRepository {
  private cache = new Map<string, { data: UserEntity, cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 phút cache

  /**
   * Lấy thông tin tu sĩ theo Discord ID
   */
  public get(discordId: string): UserEntity | null {
    const nowMs = Date.now();

    if (this.cache.has(discordId)) {
      const cached = this.cache.get(discordId)!;
      if (nowMs - cached.cachedAt < this.CACHE_TTL_MS) {
        return { ...cached.data };
      } else {
        this.cache.delete(discordId);
      }
    }

    const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
    const user = (stmt.get(discordId) as UserEntity) || null;
    if (!user) return null;

    // Hồi phục Thể Lực theo thời gian
    const now = Math.floor(Date.now() / 1000);
    const lastRecover = user.last_stamina_recover_at || user.created_at;
    if (user.stamina < 500) {
      const elapsed = now - lastRecover;
      if (elapsed >= 60) {
        const recoverAmount = Math.floor(elapsed / 60);
        const newStamina = Math.min(500, user.stamina + recoverAmount);
        const newRecoverAt = lastRecover + recoverAmount * 60;
        db.prepare('UPDATE users SET stamina = ?, last_stamina_recover_at = ?, updated_at = ? WHERE discord_id = ?')
          .run(newStamina, newRecoverAt, now, discordId);
        user.stamina = newStamina;
        user.last_stamina_recover_at = newRecoverAt;
      }
    }

    // Hồi phục HP theo thời gian (1 HP / 10s)
    if (user.hp < user.base_hp) {
      const elapsedHp = now - (user.updated_at || user.created_at);
      if (elapsedHp >= 10) {
        const recoverHp = Math.floor(elapsedHp / 10);
        const newHp = Math.min(user.base_hp, user.hp + recoverHp);
        db.prepare('UPDATE users SET hp = ?, updated_at = ? WHERE discord_id = ?')
          .run(newHp, now, discordId);
        user.hp = newHp;
      }
    }

    // Hồi phục MP theo thời gian
    const lastMpRecover = user.updated_at || user.created_at;
    if (user.mp < user.max_mp) {
      const elapsedMp = now - lastMpRecover;
      if (elapsedMp >= 30) {
        const recoverMp = Math.floor(elapsedMp / 30);
        const newMp = Math.min(user.max_mp, user.mp + recoverMp);
        db.prepare('UPDATE users SET mp = ?, updated_at = ? WHERE discord_id = ?')
          .run(newMp, now, discordId);
        user.mp = newMp;
      }
    }

    this.cache.set(discordId, { data: { ...user }, cachedAt: nowMs });
    return user;
  }

  /**
   * Tạo nhân vật tu sĩ mới
   */
  public create(user: {
    discord_id: string;
    name: string;
    base_hp: number;
    base_mp: number;
    base_atk: number;
    base_def: number;
    base_crit: number;
    base_crit_res: number;
    base_luck: number;
    base_speed?: number;
    base_dodge?: number;
    linh_can: string;
    background?: string;
    destiny?: string;
    starting_skills?: string;
    prophecy?: string;
    heirloom?: string;
    claimed_starting_bonus?: number;
    coin_ha_pham?: number;
    knb?: number;
  }): void {
    const now = Math.floor(Date.now() / 1000);
    const speed = user.base_speed ?? 100;
    const dodge = user.base_dodge ?? 0.05;
    const stmt = db.prepare(`
      INSERT INTO users (
        discord_id, name, title, level, tu_vi, exp_needed,
        base_hp, hp, base_mp, base_atk, base_def, base_crit, base_crit_res, base_luck, base_speed, base_dodge, mp, max_mp,
        linh_can, coin_ha_pham, coin_trung_pham, coin_thuong_pham, knb,
        alchemy_level, alchemy_exp, forging_level, forging_exp,
        partner_id, intimacy, last_songtu_at,
        background, destiny, starting_skills,
        prophecy, heirloom, claimed_starting_bonus,
        created_at, updated_at
      ) VALUES (
        ?, ?, 'Tán Tu', 1, 0, 100,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 100,
        ?, ?, 0, 0, ?,
        1, 0, 1, 0,
        NULL, 0, 0,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);
    
    stmt.run(
      user.discord_id,
      user.name,
      user.base_hp,
      user.base_hp,  // hp = base_hp lúc tạo nhân vật
      user.base_mp,
      user.base_atk,
      user.base_def,
      user.base_crit,
      user.base_crit_res,
      user.base_luck,
      speed,
      dodge,
      user.linh_can,
      user.coin_ha_pham ?? 100,
      user.knb ?? 0,
      user.background ?? '',
      user.destiny ?? '',
      user.starting_skills ?? '[]',
      user.prophecy ?? '',
      user.heirloom ?? '',
      user.claimed_starting_bonus ?? 0,
      now,
      now
    );
  }

  public update(discordId: string, updates: Partial<UserEntity>): void {
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    updates.updated_at = Math.floor(Date.now() / 1000);
    const updatedKeys = Object.keys(updates);

    const setClause = updatedKeys.map(k => `${k} = ?`).join(', ');
    const values = updatedKeys.map(k => (updates as any)[k]);
    values.push(discordId);

    const stmt = db.prepare(`UPDATE users SET ${setClause} WHERE discord_id = ?`);
    stmt.run(...values);
    
    // Invalidate cache
    this.cache.delete(discordId);
  }
  
  /**
   * Xóa user khỏi DB (dùng cho luân hồi hoặc reset)
   */
  public delete(discordId: string): void {
    db.prepare('DELETE FROM users WHERE discord_id = ?').run(discordId);
    this.cache.delete(discordId);
  }
}
export const userRepository = new UserRepository();
