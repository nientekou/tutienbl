import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryService } from './InventoryService';
import { newbieProtectionService } from './NewbieProtectionService';
import { CombatEngine, Combatant, CombatResult } from './CombatEngine';
import { achievementService } from './AchievementService';
import { autoBalanceService } from './AutoBalanceService';

export interface ArenaProfile {
  user_id: string;
  elo: number;
  wins: number;
  losses: number;
  win_streak: number;
  highest_elo: number;
  last_season_rank: number;
  season_id: string;
}

export class ArenaService {
  private K_FACTOR = 32;

  /**
   * Lấy hồ sơ Arena của user, nếu chưa có thì tạo mới
   */
  public getProfile(userId: string): ArenaProfile {
    let profile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId) as ArenaProfile | undefined;
    if (!profile) {
      db.prepare(`
        INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak, highest_elo, last_season_rank, season_id)
        VALUES (?, 1000, 0, 0, 0, 1000, 0, 'season_1')
      `).run(userId);
      profile = {
        user_id: userId, elo: 1000, wins: 0, losses: 0, win_streak: 0, highest_elo: 1000, last_season_rank: 0, season_id: 'season_1'
      };
    }
    return profile;
  }

  /**
   * Tính toán ELO thay đổi sau trận đấu
   */
  public calculateEloChange(winnerElo: number, loserElo: number): { winnerGain: number, loserDrop: number } {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    // Thắng được 1 điểm thực tế, Thua được 0 điểm thực tế
    const winnerGain = Math.round(this.K_FACTOR * (1 - expectedWinner));
    const loserDrop = Math.round(this.K_FACTOR * (0 - expectedLoser)); // Thường sẽ là số âm

    return {
      winnerGain: Math.max(5, winnerGain), // Cấp điểm tối thiểu
      loserDrop: Math.min(-5, loserDrop)
    };
  }

  /**
   * Lấy đối thủ ngẫu nhiên có ELO tương đương (+- 150), hoặc ngẫu nhiên nếu không tìm thấy
   */
  public isShielded(userId: string): boolean {
    const user = userRepository.get(userId);
    if (!user) return false;
    try {
      const yCanh = JSON.parse(user.y_canh || '{}');
      if (yCanh.shield_until && yCanh.shield_until > Math.floor(Date.now() / 1000)) {
        return true;
      }
    } catch (e) { console.warn('[ArenaService] Failed to parse y_canh for shield check:', e); }
    // Newbie protection: người chơi mới không thể bị tấn công
    if (newbieProtectionService.isProtected(userId)) return true;
    return false;
  }

  private updateLossesAndShield(userId: string, isWin: boolean) {
    const user = userRepository.get(userId);
    if (!user) return;
    try {
      const yCanh = JSON.parse(user.y_canh || '{}');
      if (isWin) {
        yCanh.consecutive_losses = 0;
      } else {
        yCanh.consecutive_losses = (yCanh.consecutive_losses || 0) + 1;
        if (yCanh.consecutive_losses >= 5) {
          yCanh.shield_until = Math.floor(Date.now() / 1000) + 3600; // 1-hour shield
          yCanh.consecutive_losses = 0; // reset
        }
      }
      userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });
    } catch (e) { console.warn('[ArenaService] Failed to update losses/shield in y_canh:', e); }
  }

  /**
   * Lấy đối thủ ngẫu nhiên có ELO tương đương (+- 150), hoặc ngẫu nhiên nếu không tìm thấy, loại bỏ người chơi có Hộ Giới Bài
   */
  public getMatchmaking(userId: string): string | null {
    const profile = this.getProfile(userId);
    const minElo = profile.elo - 150;
    const maxElo = profile.elo + 150;

    const opponents = db.prepare(`
      SELECT user_id FROM arena_profiles 
      WHERE user_id != ? AND elo >= ? AND elo <= ?
      ORDER BY RANDOM() LIMIT 20
    `).all(userId, minElo, maxElo) as { user_id: string }[];

    for (const opp of opponents) {
      if (!this.isShielded(opp.user_id)) {
        return opp.user_id;
      }
    }

    // Nếu không tìm thấy trong khoảng, mở rộng tìm kiếm toàn bộ (trừ bản thân)
    const globalOpponents = db.prepare(`
      SELECT user_id FROM arena_profiles 
      WHERE user_id != ?
      ORDER BY RANDOM() LIMIT 50
    `).all(userId) as { user_id: string }[];

    for (const opp of globalOpponents) {
      if (!this.isShielded(opp.user_id)) {
        return opp.user_id;
      }
    }

    return null;
  }

  /**
   * Bắt đầu trận đấu PvP
   */
  public challenge(challengerId: string, opponentId: string): { success: boolean, message: string, result?: CombatResult, logFile?: string, artifactMessage?: string } {
    const cUser = userRepository.get(challengerId);
    const oUser = userRepository.get(opponentId);

    if (!cUser || !oUser) {
      return { success: false, message: 'Người chơi không hợp lệ!' };
    }

    // Build combatants
    const cStats = inventoryService.getActiveStats(challengerId);
    const oStats = inventoryService.getActiveStats(opponentId);

    if (!cStats || !oStats) {
      return { success: false, message: 'Lỗi tính toán chỉ số.' };
    }

    // Lấy pet của challenger
    let cPetConfig: any = null;
    const cPetRaw = db.prepare('SELECT name, base_atk, mutations, skills FROM pets WHERE user_id = ? AND is_deployed = 1').get(challengerId) as any;
    if (cPetRaw) {
      let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      let skillsArr: string[] = [];
      try { mutations = JSON.parse(cPetRaw.mutations || '{}'); } catch(e) { console.warn('[ArenaService] Failed to parse challenger pet mutations:', e); }
      try { skillsArr = JSON.parse(cPetRaw.skills || '[]'); } catch(e) { console.warn('[ArenaService] Failed to parse challenger pet skills:', e); }
      cPetConfig = { 
        name: cPetRaw.name, 
        atk: cPetRaw.base_atk + (mutations.bonus_atk || 0), 
        skills: skillsArr 
      };
    }

    // Lấy pet của opponent (Auto-battle nên opponent cũng có thể dùng pet)
    let oPetConfig: any = null;
    const oPetRaw = db.prepare('SELECT name, base_atk, mutations, skills FROM pets WHERE user_id = ? AND is_deployed = 1').get(opponentId) as any;
    if (oPetRaw) {
      let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      let skillsArr: string[] = [];
      try { mutations = JSON.parse(oPetRaw.mutations || '{}'); } catch(e) { console.warn('[ArenaService] Failed to parse opponent pet mutations:', e); }
      try { skillsArr = JSON.parse(oPetRaw.skills || '[]'); } catch(e) { console.warn('[ArenaService] Failed to parse opponent pet skills:', e); }
      oPetConfig = { 
        name: oPetRaw.name, 
        atk: oPetRaw.base_atk + (mutations.bonus_atk || 0), 
        skills: skillsArr 
      };
    }

    const { soulImprintService } = require('./SoulImprintService');

    let challengerAtk = cStats.atk;
    if (cUser.alignment === 'orthodox') {
      challengerAtk = Math.round(challengerAtk * 0.95);
    }

    let opponentAtk = oStats.atk;
    if (oUser.alignment === 'orthodox') {
      opponentAtk = Math.round(opponentAtk * 0.95);
    }

    // Auto-balance: debuff top, buff yếu
    const cBalance = autoBalanceService.getPvPMultipliers(challengerId);
    const oBalance = autoBalanceService.getPvPMultipliers(opponentId);

    const challenger: Combatant = {
      name: cUser.name,
      hp: cStats.hp,
      maxHp: cStats.hp,
      atk: Math.round(challengerAtk * cBalance.atkMult),
      def: Math.round(cStats.def * cBalance.defMult),
      crit: cStats.crit,
      critRes: cStats.critRes,
      luck: cStats.luck,
      speed: cStats.speed,
      dodge: cStats.dodge,
      linhCan: cUser.linh_can,
      hasOai: soulImprintService.hasOaiActive(challengerId)
    };

    const opponent: Combatant = {
      name: oUser.name,
      hp: oStats.hp,
      maxHp: oStats.hp,
      atk: Math.round(opponentAtk * oBalance.atkMult),
      def: Math.round(oStats.def * oBalance.defMult),
      crit: oStats.crit,
      critRes: oStats.critRes,
      luck: oStats.luck,
      speed: oStats.speed,
      dodge: oStats.dodge,
      linhCan: oUser.linh_can,
      hasOai: soulImprintService.hasOaiActive(opponentId)
    };

    // Để cho công bằng, hai bên có thể gọi Pet, nhưng CombatEngine.run hiện tại chỉ nhận 1 pet.
    // Mình có thể pass cPetConfig vào, và enemy atk được buff ngầm hoặc bỏ qua pet.
    // Tạm thời truyền pet của Challenger.
    if (oPetConfig) {
      opponent.atk += Math.floor(oPetConfig.atk * 0.5); // Opponent pet damage is added to opponent's basic attack
    }

    const combatResult = CombatEngine.run(challenger, opponent, cPetConfig, 15, false);

    // Cập nhật ELO
    const cProfile = this.getProfile(challengerId);
    const oProfile = this.getProfile(opponentId);

    const isChallengerWin = combatResult.winner === 'player';

    let eloChangeObj;
    if (isChallengerWin) {
      eloChangeObj = this.calculateEloChange(cProfile.elo, oProfile.elo);
      this.updateProfileAfterMatch(challengerId, cProfile, true, eloChangeObj.winnerGain);
      this.updateProfileAfterMatch(opponentId, oProfile, false, eloChangeObj.loserDrop);
      this.updateLossesAndShield(challengerId, true);
      this.updateLossesAndShield(opponentId, false);
    } else {
      eloChangeObj = this.calculateEloChange(oProfile.elo, cProfile.elo);
      this.updateProfileAfterMatch(challengerId, cProfile, false, eloChangeObj.loserDrop);
      this.updateProfileAfterMatch(opponentId, oProfile, true, eloChangeObj.winnerGain);
      this.updateLossesAndShield(challengerId, false);
      this.updateLossesAndShield(opponentId, true);
    }

    const eloChangeForChallenger = isChallengerWin ? eloChangeObj.winnerGain : eloChangeObj.loserDrop;

    // Sync với RankedArenaService để season tracking
    try {
      const { rankedArenaService } = require('./RankedArenaService');
      rankedArenaService.getProfile(challengerId);
      rankedArenaService.getProfile(opponentId);
      if (isChallengerWin) rankedArenaService.recordWin(challengerId, opponentId);
      else rankedArenaService.recordWin(opponentId, challengerId);
    } catch {}

    // Lưu lịch sử
    const nowSec = Math.floor(Date.now() / 1000);
    const winnerId = isChallengerWin ? challengerId : opponentId;
    
    // Rút ngắn combat log nếu quá dài
    const combatLogStr = JSON.stringify(combatResult.log);
    
    db.prepare(`
      INSERT INTO arena_history (challenger_id, opponent_id, winner_id, elo_change, created_at, combat_log)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(challengerId, opponentId, winnerId, Math.abs(eloChangeForChallenger), nowSec, combatLogStr);

    let artifactMessage: string | undefined = undefined;
    if (isChallengerWin) {
      const artifactRes = inventoryService.addArtifactExp(challengerId, 30);
      if (artifactRes && artifactRes.message) {
        artifactMessage = artifactRes.message;
      }
    }

    return {
      success: true,
      message: `Chiến đấu hoàn tất!`,
      result: combatResult,
      artifactMessage
    };
  }

  private updateProfileAfterMatch(userId: string, profile: ArenaProfile, isWin: boolean, eloChange: number) {
    const newElo = Math.max(0, profile.elo + eloChange);
    const wins = profile.wins + (isWin ? 1 : 0);
    const losses = profile.losses + (isWin ? 0 : 1);
    const winStreak = isWin ? profile.win_streak + 1 : 0;
    const highestElo = Math.max(profile.highest_elo, newElo);

    db.prepare(`
      UPDATE arena_profiles 
      SET elo = ?, wins = ?, losses = ?, win_streak = ?, highest_elo = ?
      WHERE user_id = ?
    `).run(newElo, wins, losses, winStreak, highestElo, userId);

    // Thành tựu thắng liên tiếp
    if (isWin && winStreak >= 50) {
      achievementService.setProgress(userId, 'pvp_11', winStreak);
    }
  }

  /**
   * Lấy Top 10 Bảng Xếp Hạng Arena
   */
  public getLeaderboard(limit: number = 10) {
    return db.prepare(`
      SELECT p.*, u.name 
      FROM arena_profiles p
      JOIN users u ON p.user_id = u.discord_id
      ORDER BY p.elo DESC 
      LIMIT ?
    `).all(limit) as any[];
  }

  /**
   * Xử lý kết thúc mùa giải Arena
   */
  public processSeasonEnd(newSeasonId: string): { totalRewarded: number; topPlayers: { userId: string; rank: number; reward: string }[] } {
    // Lấy tất cả user đã tham gia ít nhất 1 trận
    const players = db.prepare(`SELECT * FROM arena_profiles WHERE wins > 0 OR losses > 0 ORDER BY elo DESC`).all() as ArenaProfile[];
    const topPlayers: { userId: string; rank: number; reward: string }[] = [];
    
    db.transaction(() => {
      players.forEach((p, index) => {
        const rank = index + 1;
        // Soft reset ELO: (elo hiện tại + 1000) / 2
        const resetElo = Math.max(1000, Math.floor((p.elo + 1000) / 2));
        
        db.prepare(`
          UPDATE arena_profiles 
          SET elo = ?, wins = 0, losses = 0, win_streak = 0, last_season_rank = ?, season_id = ?,
              consecutive_top1 = CASE WHEN ? = 1 THEN consecutive_top1 + 1 ELSE 0 END
          WHERE user_id = ?
        `).run(resetElo, rank, newSeasonId, rank, p.user_id);

        // Thành tựu top 1 Arena liên tiếp
        if (rank === 1) {
          const profile = db.prepare('SELECT consecutive_top1 FROM arena_profiles WHERE user_id = ?').get(p.user_id) as any;
          if (profile && profile.consecutive_top1 >= 3) {
            achievementService.setProgress(p.user_id, 'pvp_10', profile.consecutive_top1);
          }
        }

        // Trao phần thưởng theo tier
        const user = userRepository.get(p.user_id);
        if (!user) return;

        let rewardLT = 0;
        let rewardKNB = 0;
        let rewardTitle = '';
        let tier = '';

        if (rank === 1) {
          rewardLT = 100000; rewardKNB = 25; rewardTitle = 'Vô Địch Thiên Hạ'; tier = 'Kim';
        } else if (rank <= 3) {
          rewardLT = 60000; rewardKNB = 10; rewardTitle = 'Top 3 Arena'; tier = 'Kim';
        } else if (rank <= 10) {
          rewardLT = 30000; rewardKNB = 5; rewardTitle = 'Kỳ Tài'; tier = 'Bạc';
        } else if (rank <= 50) {
          rewardLT = 10000; rewardKNB = 2; tier = 'Đồng';
        } else if (rank <= 200) {
          rewardLT = 3000; tier = 'Tham Gia';
        }

        if (rewardLT > 0 || rewardKNB > 0) {
          const updates: any = { coin_ha_pham: user.coin_ha_pham + rewardLT };
          if (rewardKNB > 0) updates.knb = user.knb + rewardKNB;
          userRepository.update(p.user_id, updates);
        }

        if (rewardTitle) {
          db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
            .run(p.user_id, rewardTitle, 'arena_season', Math.floor(Date.now() / 1000));
        }

        if (rank <= 10) {
          topPlayers.push({ userId: p.user_id, rank, reward: `${rewardLT} LT, ${rewardKNB} KNB` });
        }
      });
    })();

    return { totalRewarded: players.length, topPlayers };
  }

  /**
   * Khởi động lịch trình tự động reset mùa giải mỗi sáng Thứ 2 (0:00), reset 2 tuần/mùa
   */
  public initScheduler(): void {
    setInterval(() => {
      const now = new Date();
      const vnTime = new Date(now.getTime() + 7 * 3600000);
      // Nếu là Thứ 2 (day === 1) và giờ là 00:00 (hoặc trong khoảng 0-5 phút)
      if (vnTime.getUTCDay() === 1 && vnTime.getUTCHours() === 0 && vnTime.getUTCMinutes() < 60) {
        // Chỉ chạy 1 lần mỗi 2 tuần, kiểm tra cờ (flag) trong database để tránh chạy lặp
        const db = require('../database/database').default;
        const currentSeason = db.prepare("SELECT value FROM system_config WHERE key = 'arena_season_id'").get() as any;
        
        const biWeekNum = Math.ceil(this.getWeekNumber(vnTime) / 2);
        const expectedSeason = `season_${vnTime.getUTCFullYear()}_BiW${biWeekNum}`;
        
        if (!currentSeason || currentSeason.value !== expectedSeason) {
          this.processSeasonEnd(expectedSeason);
          db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('arena_season_id', ?)").run(expectedSeason);
          console.log(`[ArenaService] Đã reset mùa giải sang: ${expectedSeason}`);
        }
      }
    }, 60 * 60 * 1000); // Kiểm tra mỗi giờ
  }

  private getWeekNumber(d: Date): number {
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (utcDate.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
  }
}

export const arenaService = new ArenaService();
