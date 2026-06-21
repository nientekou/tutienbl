import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { CombatEngine, Combatant } from './CombatEngine';

export interface SectWarSeason {
  id: number;
  season_number: number;
  started_at: number;
  ended_at: number | null;
  status: 'upcoming' | 'active' | 'ended';
}

export interface SectWarBattle {
  id: number;
  season_id: number;
  round_number: number;
  sect_ids: number[];
  scores: Record<number, number>;
  status: 'pending' | 'active' | 'completed';
  winner_sect_id: number | null;
  started_at: number | null;
  ended_at: number | null;
  created_at: number;
}

const MAX_ATTACKS_PER_WEEK = 5;
const MATCH_INTERVAL_DAYS = 7;

export const SECT_MINES = [
  { id: 'mo_nho', name: 'Mỏ Linh Thạch Nhỏ', income: 500, level_req: 1, guard_hp: 5000, guard_atk: 100, guard_def: 50 },
  { id: 'mo_vua', name: 'Mỏ Linh Thạch Vừa', income: 1500, level_req: 3, guard_hp: 20000, guard_atk: 300, guard_def: 150 },
  { id: 'mo_lon', name: 'Mỏ Linh Thạch Lớn', income: 5000, level_req: 5, guard_hp: 100000, guard_atk: 800, guard_def: 400 },
];

export interface SectMineOwnership {
  id: number;
  mine_id: string;
  sect_id: number;
  captured_at: number;
  last_claimed_at: number;
  total_income: number;
}

class SectWarService {
  public getOrCreateSeason(): SectWarSeason {
    let season = db.prepare(
      "SELECT * FROM sect_war_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    ).get() as SectWarSeason | undefined;

    if (!season) {
      const now = Math.floor(Date.now() / 1000);
      const lastSeason = db.prepare(
        "SELECT MAX(season_number) as max_num FROM sect_war_seasons"
      ).get() as { max_num: number | null };
      const nextNum = (lastSeason?.max_num || 0) + 1;

      db.prepare(`
        INSERT INTO sect_war_seasons (season_number, started_at, status)
        VALUES (?, ?, 'active')
      `).run(nextNum, now);

      season = db.prepare(
        "SELECT * FROM sect_war_seasons WHERE season_number = ?"
      ).get(nextNum) as SectWarSeason;
    }

    return season!;
  }

  public getSeasonById(seasonId: number): SectWarSeason | null {
    return db.prepare('SELECT * FROM sect_war_seasons WHERE id = ?').get(seasonId) as SectWarSeason | null;
  }

  public endSeason(seasonId: number): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare("UPDATE sect_war_seasons SET status = 'ended', ended_at = ? WHERE id = ?").run(now, seasonId);
    db.prepare("UPDATE sect_war_battles SET status = 'completed' WHERE season_id = ? AND status = 'active'").run(seasonId);
  }

  public getSectWarScore(sectId: number): { total_damage: number; total_wins: number; total_battles: number } {
    const season = this.getOrCreateSeason();
    const row = db.prepare(`
      SELECT COALESCE(SUM(swps.damage_dealt), 0) as total_damage,
             COALESCE(SUM(swps.wins), 0) as total_wins,
             COALESCE(SUM(swps.battles_fought), 0) as total_battles
      FROM sect_war_participant_scores swps
      WHERE swps.season_id = ? AND swps.sect_id = ?
    `).get(season.id, sectId) as { total_damage: number; total_wins: number; total_battles: number };
    return row;
  }

  public getSectLeaderboard(): Array<{
    sect_id: number;
    sect_name: string;
    level: number;
    total_damage: number;
    total_wins: number;
    total_battles: number;
  }> {
    const season = this.getOrCreateSeason();
    const rows = db.prepare(`
      SELECT swps.sect_id,
             (SELECT name FROM sects WHERE id = swps.sect_id) as sect_name,
             (SELECT level FROM sects WHERE id = swps.sect_id) as level,
             SUM(swps.damage_dealt) as total_damage,
             SUM(swps.wins) as total_wins,
             SUM(swps.battles_fought) as total_battles
      FROM sect_war_participant_scores swps
      WHERE swps.season_id = ?
      GROUP BY swps.sect_id
      ORDER BY total_damage DESC, total_wins DESC
      LIMIT 20
    `).all(season.id) as any[];
    return rows;
  }

  public getUserWeeklyAttacks(userId: string, seasonId: number): number {
    const row = db.prepare(`
      SELECT COALESCE(SUM(swps.battles_fought), 0) as fought
      FROM sect_war_participant_scores swps
      JOIN sect_war_battles swb ON swps.battle_id = swb.id
      WHERE swps.user_id = ? AND swps.season_id = ?
    `).get(userId, seasonId) as { fought: number };
    return row.fought;
  }

  public getActiveBattlesForSect(sectId: number): SectWarBattle[] {
    const season = this.getOrCreateSeason();
    const rows = db.prepare(`
      SELECT * FROM sect_war_battles
      WHERE season_id = ? AND status = 'active'
        AND instr(sect_ids, ?) > 0
      ORDER BY created_at DESC
    `).all(season.id, sectId.toString()) as any[];
    return rows.map((r: any) => ({
      ...r,
      sect_ids: JSON.parse(r.sect_ids || '[]'),
      scores: JSON.parse(r.scores || '{}'),
    }));
  }

  public joinBattle(userId: string): { success: boolean; message: string; battleId?: number } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };
    if (!user.sect_id) return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };

    const season = this.getOrCreateSeason();
    const weekAttacks = this.getUserWeeklyAttacks(userId, season.id);
    if (weekAttacks >= MAX_ATTACKS_PER_WEEK) {
      return { success: false, message: `Đạo hữu đã dùng hết **${MAX_ATTACKS_PER_WEEK}** lượt trong tuần này! Tuần sau quay lại.` };
    }

    // Tìm battle đang active cho sect này, nếu không có thì tạo mới
    const activeBattles = this.getActiveBattlesForSect(user.sect_id);
    let battle = activeBattles.length > 0 ? activeBattles[0] : null;

    if (!battle) {
      // Tạo battle mới: match với 2 sect khác có level gần nhất
      const now = Math.floor(Date.now() / 1000);
      const sectLevel = db.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id) as { level: number } | undefined;
      if (!sectLevel) return { success: false, message: 'Lỗi truy vấn Tông Môn.' };

      const candidates = db.prepare(`
        SELECT id FROM sects
        WHERE id != ? AND id IN (SELECT DISTINCT sect_id FROM users WHERE sect_id IS NOT NULL)
        ORDER BY ABS(level - ?) ASC
        LIMIT 2
      `).all(user.sect_id, sectLevel.level) as { id: number }[];

      if (candidates.length < 2) {
        return { success: false, message: 'Không đủ Tông Môn khác để ghép trận! (Cần ít nhất 3 Tông Môn hoạt động).' };
      }

      const sectIds = [user.sect_id, candidates[0].id, candidates[1].id];
      db.prepare(`
        INSERT INTO sect_war_battles (season_id, round_number, sect_ids, scores, status, created_at)
        VALUES (?, 1, ?, '{}', 'active', ?)
      `).run(season.id, JSON.stringify(sectIds), now);

      const rawBattle: any = db.prepare('SELECT * FROM sect_war_battles WHERE created_at = ? AND season_id = ?').get(now, season.id);
      if (!rawBattle) return { success: false, message: 'Lỗi tạo trận đấu.' };
      (rawBattle as any).sect_ids = JSON.parse(rawBattle.sect_ids || '[]');
      (rawBattle as any).scores = JSON.parse(rawBattle.scores || '{}');
      battle = rawBattle;
    }

    if (!battle) return { success: false, message: 'Không thể tạo trận đấu.' };

    // Thêm người chơi vào participant_scores
    const existing = db.prepare(
      'SELECT id FROM sect_war_participant_scores WHERE battle_id = ? AND user_id = ?'
    ).get(battle.id, userId);
    if (!existing) {
      db.prepare(`
        INSERT INTO sect_war_participant_scores (battle_id, season_id, user_id, sect_id)
        VALUES (?, ?, ?, ?)
      `).run(battle.id, season.id, userId, user.sect_id);
    }

    return { success: true, message: `✅ Tham gia trận đấu thành công!`, battleId: battle.id };
  }

  public attack(userId: string, targetUserId: string): { success: boolean; message: string; damage?: number } {
    const user = userRepository.get(userId);
    const target = userRepository.get(targetUserId);
    if (!user || !target) return { success: false, message: 'Nhân vật không tồn tại.' };
    if (!user.sect_id) return { success: false, message: 'Bạn chưa gia nhập Tông Môn!' };

    const season = this.getOrCreateSeason();
    const weekAttacks = this.getUserWeeklyAttacks(userId, season.id);
    if (weekAttacks >= MAX_ATTACKS_PER_WEEK) {
      return { success: false, message: 'Hết lượt tấn công trong tuần!' };
    }

    // Kiểm tra cùng battle
    const battles = this.getActiveBattlesForSect(user.sect_id);
    if (battles.length === 0) return { success: false, message: 'Không có trận đấu nào đang diễn ra! Hãy dùng `/sectwar thamgia` trước.' };

    const battle = battles[0];
    const targetSectId = target.sect_id;
    if (!targetSectId || !battle.sect_ids.includes(targetSectId)) {
      return { success: false, message: 'Mục tiêu không nằm trong trận đấu của bạn!' };
    }
    if (targetSectId === user.sect_id) {
      return { success: false, message: 'Không thể tấn công đồng môn!' };
    }

    // Combat via CombatEngine
    const { inventoryService } = require('./InventoryService');
    const playerStats = inventoryService.getActiveStats(userId);
    const targetStats = inventoryService.getActiveStats(targetUserId);

    if (!playerStats || !targetStats) {
      return { success: false, message: 'Lỗi tính toán chỉ số chiến đấu!' };
    }

    const { soulImprintService } = require('./SoulImprintService');

    const playerCombatant: Combatant = {
      name: user.name,
      hp: playerStats.hp,
      maxHp: playerStats.hp,
      atk: playerStats.atk,
      def: playerStats.def,
      crit: playerStats.crit,
      critRes: playerStats.critRes,
      luck: playerStats.luck,
      speed: playerStats.speed,
      dodge: playerStats.dodge,
      linhCan: user.linh_can || '{}',
      hasOai: soulImprintService.hasOaiActive(userId)
    };

    const targetCombatant: Combatant = {
      name: target.name,
      hp: targetStats.hp,
      maxHp: targetStats.hp,
      atk: targetStats.atk,
      def: targetStats.def,
      crit: targetStats.crit,
      critRes: targetStats.critRes,
      luck: targetStats.luck,
      speed: targetStats.speed,
      dodge: targetStats.dodge,
      linhCan: target.linh_can || '{}',
      hasOai: soulImprintService.hasOaiActive(targetUserId)
    };

    const result = CombatEngine.run(playerCombatant, targetCombatant, null, 10);
    const isWin = result.winner === 'player';
    const damage = result.totalDamageDealt;

    // Cập nhật điểm số
    const scores = { ...battle.scores };
    scores[user.sect_id] = (scores[user.sect_id] || 0) + damage;

    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      db.prepare('UPDATE sect_war_battles SET scores = ? WHERE id = ?').run(JSON.stringify(scores), battle.id);

      const existing = db.prepare(
        'SELECT id FROM sect_war_participant_scores WHERE battle_id = ? AND user_id = ?'
      ).get(battle.id, userId) as any;

      if (existing) {
        db.prepare(`
          UPDATE sect_war_participant_scores
          SET damage_dealt = damage_dealt + ?,
              wins = wins + ?,
              losses = losses + ?,
              battles_fought = battles_fought + 1
          WHERE id = ?
        `).run(damage, isWin ? 1 : 0, isWin ? 0 : 1, existing.id);
      } else {
        db.prepare(`
          INSERT INTO sect_war_participant_scores (battle_id, season_id, user_id, sect_id, damage_dealt, wins, losses, battles_fought)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(battle.id, season.id, userId, user.sect_id, damage, isWin ? 1 : 0, isWin ? 0 : 1);
      }
    })();

    return {
      success: true,
      message: `⚔️ **${user.name}** tấn công **${target.name}**!\n${result.log.slice(0, 3).join('\n')}\n💥 Sát thương gây ra: **${damage}** | Kết quả: **${isWin ? 'THẮNG 🏆' : 'BẠI 💀'}**`,
      damage,
    };
  }

  public getBattleDetails(battleId: number): SectWarBattle | null {
    const row = db.prepare('SELECT * FROM sect_war_battles WHERE id = ?').get(battleId) as any;
    if (!row) return null;
    return {
      ...row,
      sect_ids: JSON.parse(row.sect_ids || '[]'),
      scores: JSON.parse(row.scores || '{}'),
    };
  }

  public getParticipantStats(battleId: number): Array<{
    user_id: string;
    user_name: string;
    sect_id: number;
    damage_dealt: number;
    wins: number;
    losses: number;
    battles_fought: number;
  }> {
    const rows = db.prepare(`
      SELECT swps.*, (SELECT name FROM users WHERE discord_id = swps.user_id) as user_name
      FROM sect_war_participant_scores swps
      WHERE swps.battle_id = ?
      ORDER BY swps.damage_dealt DESC
    `).all(battleId) as any[];
    return rows;
  }

  public distributeSeasonRewards(): void {
    const season = this.getOrCreateSeason();
    if (season.status !== 'active') return;

    const leaderboard = this.getSectLeaderboard();
    const now = Math.floor(Date.now() / 1000);
    const rewardPool = [50000, 30000, 15000, 8000, 5000, 3000, 2000, 1000, 500, 300];

    for (let i = 0; i < Math.min(leaderboard.length, rewardPool.length); i++) {
      const entry = leaderboard[i];
      const reward = rewardPool[i];

      const members = db.prepare(
        'SELECT discord_id FROM users WHERE sect_id = ?'
      ).all(entry.sect_id) as { discord_id: string }[];

      if (members.length === 0) continue;

      const sharePerMember = Math.floor(reward / members.length);
      for (const m of members) {
        userRepository.update(m.discord_id, { coin_trung_pham: (db.prepare(
          'SELECT coin_trung_pham FROM users WHERE discord_id = ?'
        ).get(m.discord_id) as any)?.coin_trung_pham + sharePerMember || sharePerMember });
      }
    }

    this.endSeason(season.id);
    console.log(`✅ Đã kết thúc mùa giải #${season.season_number} và phát thưởng.`);
  }

  // === MỎ LINH THẠCH (TERRITORY CONTROL) ===

  public getMinesState(): Array<SectMineOwnership & { sect_name?: string }> {
    const rows = db.prepare('SELECT * FROM mine_ownership').all() as SectMineOwnership[];
    return rows.map(r => {
      const sect = db.prepare('SELECT name FROM sects WHERE id = ?').get(r.sect_id) as any;
      return { ...r, sect_name: sect ? sect.name : 'Vô Danh' };
    });
  }

  public captureMine(userId: string, mineId: string): { success: boolean; message: string; log?: string[] } {
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) return { success: false, message: 'Bạn chưa gia nhập Tông Môn!' };

    const mineDef = SECT_MINES.find(m => m.id === mineId);
    if (!mineDef) return { success: false, message: 'Mỏ linh thạch không tồn tại.' };

    const sect = db.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id) as any;
    if (!sect || sect.level < mineDef.level_req) {
      return { success: false, message: `Tông Môn của bạn chưa đạt Cấp ${mineDef.level_req} để chiếm mỏ này.` };
    }

    const currentOwnership = db.prepare('SELECT * FROM mine_ownership WHERE mine_id = ?').get(mineId) as SectMineOwnership;
    if (currentOwnership && currentOwnership.sect_id === user.sect_id) {
      return { success: false, message: 'Tông Môn của bạn đã sở hữu mỏ này rồi!' };
    }

    // Combat với Hộ Vệ Mỏ (hoặc Tông Môn đang giữ)
    const { inventoryService } = require('./InventoryService');
    const playerStats = inventoryService.getActiveStats(userId);
    if (!playerStats) {
      return { success: false, message: 'Lỗi tính toán chỉ số chiến đấu!' };
    }
    const { soulImprintService } = require('./SoulImprintService');
    const playerCombatant: Combatant = {
      name: user.name,
      hp: playerStats.hp,
      maxHp: playerStats.hp,
      atk: playerStats.atk,
      def: playerStats.def,
      crit: playerStats.crit,
      critRes: playerStats.critRes,
      luck: playerStats.luck,
      speed: playerStats.speed,
      dodge: playerStats.dodge,
      linhCan: user.linh_can || '{}',
      hasOai: soulImprintService.hasOaiActive(userId)
    };

    const guardCombatant: Combatant = {
      name: `Hộ Vệ ${mineDef.name}`,
      hp: mineDef.guard_hp,
      maxHp: mineDef.guard_hp,
      atk: mineDef.guard_atk,
      def: mineDef.guard_def,
      crit: 0.1,
      critRes: 0.1,
      luck: 10,
      speed: 120,
      dodge: 0.1,
      linhCan: '{}',
    };

    // Đánh Boss/Guard
    const result = CombatEngine.run(playerCombatant, guardCombatant, null, 15);
    const isWin = result.winner === 'player';

    if (!isWin) {
      return { success: false, message: `💀 Thất bại! Bạn không đánh bại được Hộ Vệ Mỏ.\nSát thương gây ra: **${result.totalDamageDealt}**`, log: result.log };
    }

    // Chiếm thành công
    const now = Math.floor(Date.now() / 1000);
    if (currentOwnership) {
      db.prepare(`
        UPDATE mine_ownership 
        SET sect_id = ?, captured_at = ?, last_claimed_at = ?, total_income = 0
        WHERE mine_id = ?
      `).run(user.sect_id, now, now, mineId);
    } else {
      db.prepare(`
        INSERT INTO mine_ownership (mine_id, sect_id, captured_at, last_claimed_at, total_income)
        VALUES (?, ?, ?, ?, 0)
      `).run(mineId, user.sect_id, now, now);
    }

    return { success: true, message: `🏆 Chúc mừng! Tông Môn của bạn đã chiếm lĩnh **${mineDef.name}** thành công!`, log: result.log };
  }

  public claimMineIncome(userId: string, mineId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) return { success: false, message: 'Bạn chưa gia nhập Tông Môn!' };

    const ownership = db.prepare('SELECT * FROM mine_ownership WHERE mine_id = ?').get(mineId) as SectMineOwnership;
    if (!ownership) return { success: false, message: 'Mỏ này chưa có ai chiếm giữ.' };
    if (ownership.sect_id !== user.sect_id) return { success: false, message: 'Tông Môn của bạn không sở hữu mỏ này!' };

    const mineDef = SECT_MINES.find(m => m.id === mineId);
    if (!mineDef) return { success: false, message: 'Mỏ không hợp lệ.' };

    const now = Math.floor(Date.now() / 1000);
    const hoursElapsed = (now - ownership.last_claimed_at) / 3600;
    
    // Yêu cầu ít nhất 4h
    if (hoursElapsed < 4) {
      const remaining = Math.ceil(4 - hoursElapsed);
      return { success: false, message: `⏳ Mỏ chưa đủ linh thạch. Hãy quay lại sau **${remaining} giờ** nữa.` };
    }

    // Tính income
    const periods = Math.floor(hoursElapsed / 4); // Mỗi 4h nhận 1 lần
    const income = periods * mineDef.income;

    db.transaction(() => {
      // Thêm vào quỹ Tông Môn
      db.prepare('UPDATE sects SET resources = resources + ? WHERE id = ?').run(income, user.sect_id);
      // Cập nhật mine
      const newClaimTime = ownership.last_claimed_at + (periods * 4 * 3600);
      db.prepare('UPDATE mine_ownership SET last_claimed_at = ?, total_income = total_income + ? WHERE id = ?')
        .run(newClaimTime, income, ownership.id);
    })();

    return { success: true, message: `💰 Đã thu hoạch **${income} Linh Thạch** từ **${mineDef.name}** vào quỹ Tông Môn!` };
  }

  // === LỊCH SỬ CHIẾN TRẬN (HISTORY) ===
  public getFinishedBattlesHistory(): any[] {
    return db.prepare(`
      SELECT * FROM sect_war_battles 
      WHERE status = 'completed' 
      ORDER BY ended_at DESC 
      LIMIT 10
    `).all().map((r: any) => ({
      ...r,
      sect_ids: JSON.parse(r.sect_ids || '[]'),
      scores: JSON.parse(r.scores || '{}')
    }));
  }
}

export const sectWarService = new SectWarService();
