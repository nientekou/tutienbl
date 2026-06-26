import db from '../database/database';
import { RARE_BEASTS } from '../config/rareBeastConstants';
import { cacheService } from './CacheService';

class RareBeastService {
  attemptTame(userId: string, beastType: string, luckBonus: number): { success: boolean; beast?: any } {
    const def = RARE_BEASTS.find(b => b.type === beastType);
    if (!def) return { success: false };
    const existing = db.prepare('SELECT id FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType);
    if (existing) return { success: false };
    const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
    if (Math.random() > rate) return { success: false };
    const info = db.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, level, skills)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, beastType, def.name, def.rarity, JSON.stringify([def.passiveSkill]));
    return { success: true, beast: { id: info.lastInsertRowid, ...def } };
  }

  equip(userId: string, beastType: string): boolean {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return false;
    db.prepare('UPDATE rare_beasts SET equipped = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE rare_beasts SET equipped = 1 WHERE id = ?').run(beast.id);
    cacheService.invalidatePrefix(`stats:${userId}`);
    cacheService.invalidatePrefix(`rarebeast:${userId}`);
    return true;
  }

  getEquippedBonuses(userId: string): { atk: number; def: number; hp: number; passive: string; passiveValue: number } {
    const cached = cacheService.get(`rarebeast:${userId}`);
    if (cached) return cached as any;

    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId) as any;
    if (!beast) {
      const empty = { atk: 0, def: 0, hp: 0, passive: '', passiveValue: 0 };
      cacheService.set(`rarebeast:${userId}`, empty, 30_000);
      return empty;
    }

    const def = RARE_BEASTS.find(b => b.type === beast.beast_type)!;
    const starIdx = Math.min((beast.stars || 1) - 1, def.evolveBonus.length - 1);
    const evolveBonus = def.evolveBonus[starIdx] || { atk: 0, def: 0, hp: 0 };
    const levelMult = 1 + (beast.level - 1) * 0.015;

    const result = {
      atk: Math.floor((def.baseAtk + evolveBonus.atk) * levelMult),
      def: Math.floor((def.baseDef + evolveBonus.def) * levelMult),
      hp: Math.floor((def.baseHp + evolveBonus.hp) * levelMult),
      passive: def.passiveSkill,
      // P1-03: Fix passiveValue — scale with stars and level, not array length
      passiveValue: Math.floor((beast.stars || 1) * 2 + (beast.level || 1) * 0.5)
    };

    cacheService.set(`rarebeast:${userId}`, result, 30_000);
    return result;
  }

  evolve(userId: string, beastType: string): { success: boolean; newStars: number; message?: string } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return { success: false, newStars: 0, message: 'Linh thú không tồn tại.' };

    const currentStars = beast.stars || 1;
    const MAX_STARS = 8; // P1-03: Evolution 8 stages (from 5)

    if (currentStars >= MAX_STARS) return { success: false, newStars: currentStars, message: 'Đã đạt giai đoạn tiến hóa tối đa (8).' };

    // P1-03: Evolution gates
    const beastLevel = beast.level || 1;
    if (currentStars >= 3 && beastLevel < 30) {
      return { success: false, newStars: currentStars, message: `Cần Linh Thú đạt cấp 30+ để tiến hóa giai đoạn ${currentStars + 1}.` };
    }
    if (currentStars >= 5 && beastLevel < 60) {
      return { success: false, newStars: currentStars, message: `Cần Linh Thú đạt cấp 60+ để tiến hóa giai đoạn ${currentStars + 1}.` };
    }

    // P1-03: Stage 6+ has 20% failure chance
    if (currentStars >= 5 && Math.random() < 0.20) {
      return { success: false, newStars: currentStars, message: 'Tiến hóa thất bại! Nguyên liệu bị mất.' };
    }

    const newStars = currentStars + 1;
    db.prepare('UPDATE rare_beasts SET stars = ? WHERE id = ?').run(newStars, beast.id);
    cacheService.invalidatePrefix(`rarebeast:${userId}`);
    return { success: true, newStars, message: `Tiến hóa thành công lên giai đoạn ${newStars}!` };
  }

  feedExp(userId: string, beastType: string, exp: number): { levelUp: boolean; newLevel: number } {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
      .get(userId, beastType) as any;
    if (!beast) return { levelUp: false, newLevel: 0 };
    const newExp = (beast.exp || 0) + exp;
    const needed = beast.level * 100;
    if (newExp >= needed) {
      const newLevel = beast.level + 1;
      db.prepare('UPDATE rare_beasts SET level = ?, exp = ? WHERE id = ?')
        .run(newLevel, newExp - needed, beast.id);
      cacheService.invalidatePrefix(`rarebeast:${userId}`);
      return { levelUp: true, newLevel };
    }
    db.prepare('UPDATE rare_beasts SET exp = ? WHERE id = ?').run(newExp, beast.id);
    return { levelUp: false, newLevel: beast.level };
  }

  getUserBeasts(userId: string): any[] {
    return db.prepare('SELECT * FROM rare_beasts WHERE user_id = ?').all(userId);
  }

  // === W9-05: Beast Arena & Training Ground ===

  private arenaInit = false;

  private initArena(): void {
    if (this.arenaInit) return;
    db.exec(`
      CREATE TABLE IF NOT EXISTS beast_arena_seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_number INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS beast_arena_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        season_id INTEGER NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        UNIQUE(user_id, season_id)
      );

      CREATE TABLE IF NOT EXISTS beast_training (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        beast_id INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'training'
      );
    `);
    this.arenaInit = true;
  }

  /**
   * W9-05: Beast Arena — Auto-fight 3 beasts vs opponent
   */
  public arenaFight(userId: string, opponentId: string): { success: boolean; message: string; won?: boolean } {
    this.initArena();

    const myBeasts = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? ORDER BY level DESC LIMIT 3').all(userId) as any[];
    const oppBeasts = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? ORDER BY level DESC LIMIT 3').all(opponentId) as any[];

    if (myBeasts.length === 0) return { success: false, message: '❌ Cần ít nhất 1 linh thú để tham gia Arena!' };
    if (oppBeasts.length === 0) return { success: false, message: '❌ Đối thủ không có linh thú!' };

    // Simple auto-fight: compare total power
    const myPower = myBeasts.reduce((sum, b) => sum + (b.level * 10) + (b.stars || 1) * 50, 0);
    const oppPower = oppBeasts.reduce((sum, b) => sum + (b.level * 10) + (b.stars || 1) * 50, 0);

    // Add some randomness (±20%)
    const myRoll = myPower * (0.8 + Math.random() * 0.4);
    const oppRoll = oppPower * (0.8 + Math.random() * 0.4);

    const won = myRoll > oppRoll;

    // Update scores
    const now = Math.floor(Date.now() / 1000);
    let season = db.prepare("SELECT * FROM beast_arena_seasons WHERE status = 'active' LIMIT 1").get() as any;
    if (!season) {
      const twoWeeks = 14 * 86400;
      db.prepare('INSERT INTO beast_arena_seasons (season_number, start_time, end_time, status) VALUES (1, ?, ?, ?)')
        .run(now, now + twoWeeks, 'active');
      season = db.prepare("SELECT * FROM beast_arena_seasons WHERE status = 'active' LIMIT 1").get();
    }

    if (season) {
      const existing = db.prepare('SELECT * FROM beast_arena_scores WHERE user_id = ? AND season_id = ?')
        .get(userId, season.id) as any;

      if (existing) {
        db.prepare('UPDATE beast_arena_scores SET wins = wins + ?, losses = losses + ?, score = score + ? WHERE user_id = ? AND season_id = ?')
          .run(won ? 1 : 0, won ? 0 : 1, won ? 10 : 2, userId, season.id);
      } else {
        db.prepare('INSERT INTO beast_arena_scores (user_id, season_id, wins, losses, score) VALUES (?, ?, ?, ?, ?)')
          .run(userId, season.id, won ? 1 : 0, won ? 0 : 1, won ? 10 : 2);
      }
    }

    const myNames = myBeasts.map(b => b.beast_name).join(', ');
    const oppNames = oppBeasts.map(b => b.beast_name).join(', ');

    const msg = `⚔️ **Đấu Trường Linh Thú**\n` +
      `🧑 ${myNames} (Power: ${Math.round(myRoll)})\n` +
      `🤖 ${oppNames} (Power: ${Math.round(oppRoll)})\n\n` +
      (won ? `🎉 **THẮNG!** +10 điểm Arena` : `💀 **THUA!** +2 điểm (tham gia)`);

    return { success: true, message: msg, won };
  }

  /**
   * W9-05: Start beast training (offline EXP, 4-8h)
   */
  public startTraining(userId: string, beastId: number): { success: boolean; message: string } {
    this.initArena();

    const beast = db.prepare('SELECT * FROM rare_beasts WHERE id = ? AND user_id = ?').get(beastId, userId) as any;
    if (!beast) return { success: false, message: '❌ Linh thú không tồn tại!' };

    // Check if already training
    const existing = db.prepare("SELECT * FROM beast_training WHERE user_id = ? AND beast_id = ? AND status = 'training'")
      .get(userId, beastId) as any;
    if (existing) return { success: false, message: '❌ Linh thú này đang huấn luyện!' };

    // Check max 3 training at once
    const trainingCount = db.prepare("SELECT COUNT(*) as c FROM beast_training WHERE user_id = ? AND status = 'training'")
      .get(userId) as { c: number };
    if (trainingCount.c >= 3) return { success: false, message: '❌ Đã đủ 3 linh thú huấn luyện! Đợi một trong số chúng hoàn thành.' };

    const now = Math.floor(Date.now() / 1000);
    const duration = (4 + Math.floor(Math.random() * 5)) * 3600; // 4-8 hours

    db.prepare('INSERT INTO beast_training (user_id, beast_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)')
      .run(userId, beastId, now, now + duration, 'training');

    const hours = Math.round(duration / 3600);
    return { success: true, message: `🏋️ **${beast.beast_name}** bắt đầu huấn luyện trong **${hours}h**!` };
  }

  /**
   * W9-05: Claim training rewards
   */
  public claimTraining(userId: string, beastId: number): { success: boolean; message: string } {
    this.initArena();

    const training = db.prepare("SELECT * FROM beast_training WHERE user_id = ? AND beast_id = ? AND status = 'training'")
      .get(userId, beastId) as any;
    if (!training) return { success: false, message: '❌ Không có huấn luyện nào đang diễn ra!' };

    const now = Math.floor(Date.now() / 1000);
    if (now < training.end_time) {
      const remainMin = Math.ceil((training.end_time - now) / 60);
      return { success: false, message: `❌ Còn **${remainMin} phút** nữa huấn luyện hoàn thành!` };
    }

    const beast = db.prepare('SELECT * FROM rare_beasts WHERE id = ?').get(beastId) as any;
    if (!beast) return { success: false, message: '❌ Linh thú không tồn tại!' };

    // Grant EXP
    const expGained = 100 + beast.level * 20;
    const result = this.feedExp(userId, beast.beast_type, expGained);

    db.prepare("UPDATE beast_training SET status = 'completed' WHERE id = ?").run(training.id);

    const msg = `🏋️ **${beast.beast_name}** hoàn thành huấn luyện!\n+${expGained} Tu Vi` +
      (result.levelUp ? `\n🎉 Lên cấp! → Cấp **${result.newLevel}**` : '');

    return { success: true, message: msg };
  }

  /**
   * W9-05: Get arena leaderboard
   */
  public getArenaLeaderboard(limit: number = 10): { userId: string; name: string; wins: number; losses: number; score: number }[] {
    this.initArena();
    const rows = db.prepare(`
      SELECT bas.*, u.name
      FROM beast_arena_scores bas
      JOIN users u ON bas.user_id = u.discord_id
      JOIN beast_arena_seasons s ON bas.season_id = s.id AND s.status = 'active'
      ORDER BY bas.score DESC, bas.wins DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      wins: r.wins,
      losses: r.losses,
      score: r.score
    }));
  }

  /**
   * W9-05: Beast synergy — match element with Linh Can → +10% passive
   */
  public getSynergyBonus(userId: string): number {
    const beast = db.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId) as any;
    if (!beast || !beast.element || beast.element === 'none') return 0;

    const user = db.prepare('SELECT linh_can FROM users WHERE discord_id = ?').get(userId) as any;
    if (!user) return 0;

    try {
      const linhCan = JSON.parse(user.linh_can || '{}');
      const elementMap: Record<string, string> = {
        'kim': 'Kim', 'moc': 'Moc', 'thuy': 'Thuy', 'hoa': 'Hoa', 'tho': 'Tho', 'loi': 'Loi', 'phong': 'Phong'
      };
      const beastElement = elementMap[beast.element] || beast.element;
      if (linhCan[beastElement] && linhCan[beastElement] > 0) {
        return 0.10; // +10% passive effect
      }
    } catch {}
    return 0;
  }

  // === C-03: Beast Collection Deep ===

  /**
   * C-03: Get beast mounts
   */
  getBeastMounts(): { id: string; name: string; description: string; speedBonus: number; requirement: string }[] {
    return [
      { id: 'mount_kim_long', name: 'Tọa Kỵ Kim Long', description: 'Cưỡi Kim Long phi hành', speedBonus: 0.10, requirement: 'Kim Long Cấp 3+' },
      { id: 'mount_bach_ho', name: 'Tọa Kỵ Bạch Hổ', description: 'Cưỡi Bạch Hổ phi hành', speedBonus: 0.15, requirement: 'Bạch Hổ Cấp 4+' },
      { id: 'mount_thien_ma', name: 'Tọa Kỵ Thiên Mã', description: 'Cưỡi Thiên Mã phi hành', speedBonus: 0.20, requirement: 'Thiên Mã Cấp 5+' },
      { id: 'mount_lac_hong', name: 'Tọa Kỵ Lạc Hồng', description: 'Cưỡi Lạc Hồng phi hành', speedBonus: 0.25, requirement: 'Lạc Hồng Cấp 6+' },
    ];
  }

  /**
   * C-03: Get beast descriptions for UI
   */
  getBeastCollectionDescription(userId: string): string {
    const pets = this.getUserBeasts(userId);
    const uniqueTypes = new Set(pets.map((p: any) => p.beast_type));
    const byRarity: Record<string, number> = {};
    let highestLevel = 0;
    let totalStars = 0;

    for (const pet of pets) {
      byRarity[pet.rarity || 'common'] = (byRarity[pet.rarity || 'common'] || 0) + 1;
      highestLevel = Math.max(highestLevel, pet.level || 1);
      totalStars += pet.stars || 1;
    }

    let msg = `🐉 **Bộ Sưu Tập Linh Thú**\n`;
    msg += `📊 Loại: **${uniqueTypes.size}** | Tổng: **${pets.length}**\n`;
    msg += `🏆 Cấp Cao Nhất: **${highestLevel}**\n`;
    msg += `⭐ Tổng Sao: **${totalStars}**\n\n`;

    if (Object.keys(byRarity).length > 0) {
      msg += `**Theo Độ Hiếm:**\n`;
      for (const [rarity, count] of Object.entries(byRarity)) {
        msg += `• ${rarity}: ${count}\n`;
      }
    }

    return msg;
  }
}

export const rareBeastService = new RareBeastService();
