import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { CombatEngine, Combatant } from './CombatEngine';
import { inventoryService } from './InventoryService';

// B-01: Tournament System

type TournamentType = 'weekly' | 'monthly';

interface Tournament {
  id: number;
  type: TournamentType;
  season_number: number;
  status: 'registration' | 'active' | 'completed';
  start_time: number;
  end_time: number;
  created_at: number;
}

interface TournamentMatch {
  id: number;
  tournament_id: number;
  round: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: 'pending' | 'completed';
  started_at: number | null;
  completed_at: number | null;
}

const WEEKLY_REWARDS = [
  { rank: 1, knb: 200, title: 'Quán Quân Tuần', coins: 10000 },
  { rank: 2, knb: 100, title: 'Á Quân Tuần', coins: 5000 },
  { rank: 3, knb: 50, title: 'Qúi Quân Tuần', coins: 3000 },
];

const MONTHLY_REWARDS = [
  { rank: 1, knb: 500, title: 'Minh Chủ Tháng', coins: 30000 },
  { rank: 2, knb: 250, title: 'Võ Lâm Tháng', coins: 15000 },
  { rank: 3, knb: 125, title: 'Bá Vương Tháng', coins: 8000 },
];

class TournamentService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        season_number INTEGER NOT NULL,
        status TEXT DEFAULT 'registration',
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        registered_at INTEGER NOT NULL,
        current_round INTEGER DEFAULT 0,
        eliminated INTEGER DEFAULT 0,
        UNIQUE(tournament_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tournament_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER NOT NULL,
        round INTEGER NOT NULL,
        player1_id TEXT,
        player2_id TEXT,
        winner_id TEXT,
        status TEXT DEFAULT 'pending',
        started_at INTEGER,
        completed_at INTEGER
      );
    `);
  }

  /**
   * B-01: Get or create current tournament
   */
  getCurrentTournament(type: TournamentType = 'weekly'): Tournament {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);

    let tournament = db.prepare(
      "SELECT * FROM tournaments WHERE type = ? AND status IN ('registration', 'active') ORDER BY id DESC LIMIT 1"
    ).get(type) as Tournament | undefined;

    if (!tournament) {
      // Create new tournament
      const lastSeason = db.prepare("SELECT MAX(season_number) as max FROM tournaments WHERE type = ?").get(type) as { max: number };
      const seasonNum = (lastSeason?.max || 0) + 1;

      const duration = type === 'weekly' ? 7 * 86400 : 30 * 86400;
      const regEnd = now + 2 * 86400; // 2 days registration

      db.prepare(`
        INSERT INTO tournaments (type, season_number, status, start_time, end_time, created_at)
        VALUES (?, ?, 'registration', ?, ?, ?)
      `).run(type, seasonNum, regEnd, regEnd + duration, now);

      tournament = db.prepare("SELECT * FROM tournaments WHERE type = ? ORDER BY id DESC LIMIT 1").get(type) as Tournament;
    }

    return tournament;
  }

  /**
   * B-01: Register for tournament
   */
  register(userId: string, type: TournamentType = 'weekly'): { success: boolean; message: string } {
    this.initTable();
    const tournament = this.getCurrentTournament(type);

    if (tournament.status !== 'registration') {
      return { success: false, message: '❌ Thời gian đăng ký đã kết thúc!' };
    }

    const existing = db.prepare('SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
      .get(tournament.id, userId);
    if (existing) return { success: false, message: '❌ Đã đăng ký rồi!' };

    const maxParticipants = type === 'weekly' ? 16 : 64;
    const count = db.prepare('SELECT COUNT(*) as c FROM tournament_participants WHERE tournament_id = ?')
      .get(tournament.id) as { c: number };

    if (count.c >= maxParticipants) {
      return { success: false, message: `❌ Đã đủ ${maxParticipants} người đăng ký!` };
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO tournament_participants (tournament_id, user_id, registered_at) VALUES (?, ?, ?)')
      .run(tournament.id, userId, now);

    return { success: true, message: `✅ Đăng ký giải đấu **${type}** thành công! (${count.c + 1}/${maxParticipants})` };
  }

  /**
   * B-01: Start tournament (generate bracket)
   */
  startTournament(tournamentId: number): { success: boolean; message: string } {
    this.initTable();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as Tournament;
    if (!tournament || tournament.status !== 'registration') {
      return { success: false, message: '❌ Giải đấu không ở trạng thái đăng ký!' };
    }

    const participants = db.prepare('SELECT user_id FROM tournament_participants WHERE tournament_id = ?')
      .all(tournamentId) as { user_id: string }[];

    if (participants.length < 2) {
      return { success: false, message: '❌ Cần ít nhất 2 người đăng ký!' };
    }

    // Generate bracket (simple elimination)
    const shuffled = participants.sort(() => Math.random() - 0.5);
    const totalRounds = Math.ceil(Math.log2(shuffled.length));

    db.transaction(() => {
      // Create first round matches
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          db.prepare(`
            INSERT INTO tournament_matches (tournament_id, round, player1_id, player2_id, status)
            VALUES (?, 1, ?, ?, 'pending')
          `).run(tournamentId, shuffled[i].user_id, shuffled[i + 1].user_id);
        } else {
          // Bye (no opponent)
          db.prepare(`
            INSERT INTO tournament_matches (tournament_id, round, player1_id, winner_id, status)
            VALUES (?, 1, ?, ?, 'completed')
          `).run(tournamentId, shuffled[i].user_id, shuffled[i].user_id);
        }
      }

      // Update tournament status
      db.prepare("UPDATE tournaments SET status = 'active' WHERE id = ?").run(tournamentId);
    })();

    return { success: true, message: `🏆 Giải đấu bắt đầu! ${participants.length} người tham gia, ${totalRounds} vòng.` };
  }

  /**
   * B-01: Fight in tournament match
   */
  fightMatch(userId: string, matchId: number): { success: boolean; message: string; winner?: string } {
    this.initTable();
    const match = db.prepare('SELECT * FROM tournament_matches WHERE id = ?').get(matchId) as TournamentMatch;
    if (!match || match.status !== 'pending') {
      return { success: false, message: '❌ Trận đấu không tồn tại hoặc đã kết thúc!' };
    }

    if (match.player1_id !== userId && match.player2_id !== userId) {
      return { success: false, message: '❌ Bạn không tham gia trận này!' };
    }

    if (!match.player1_id || !match.player2_id) {
      // Auto-win (bye)
      const winnerId = match.player1_id || match.player2_id;
      db.prepare("UPDATE tournament_matches SET winner_id = ?, status = 'completed', completed_at = ? WHERE id = ?")
        .run(winnerId, Math.floor(Date.now() / 1000), matchId);
      return { success: true, message: '🏆 Đối thủ vắng mặt — Thắng forfeit!', winner: winnerId! };
    }

    // Get combat stats
    const stats1 = inventoryService.getActiveStats(match.player1_id);
    const stats2 = inventoryService.getActiveStats(match.player2_id);
    if (!stats1 || !stats2) return { success: false, message: '❌ Lỗi tính toán chỉ số!' };

    const user1 = userRepository.get(match.player1_id);
    const user2 = userRepository.get(match.player2_id);

    const combatant1: Combatant = {
      name: user1?.name || 'Không rõ', hp: stats1.hp, maxHp: stats1.hp, atk: stats1.atk,
      def: stats1.def, crit: stats1.crit, critRes: stats1.critRes, luck: stats1.luck,
      speed: stats1.speed, dodge: stats1.dodge, linhCan: user1?.linh_can
    };
    const combatant2: Combatant = {
      name: user2?.name || 'Không rõ', hp: stats2.hp, maxHp: stats2.hp, atk: stats2.atk,
      def: stats2.def, crit: stats2.crit, critRes: stats2.critRes, luck: stats2.luck,
      speed: stats2.speed, dodge: stats2.dodge, linhCan: user2?.linh_can
    };

    const result = CombatEngine.run(combatant1, combatant2, null, 20);
    const winnerId = result.winner === 'player' ? match.player1_id : match.player2_id;

    db.prepare("UPDATE tournament_matches SET winner_id = ?, status = 'completed', completed_at = ? WHERE id = ?")
      .run(winnerId, Math.floor(Date.now() / 1000), matchId);

    // Check if tournament is complete
    this.checkTournamentComplete(match.tournament_id);

    return {
      success: true,
      message: `🏆 **${result.winner === 'player' ? user1?.name : user2?.name}** thắng!`,
      winner: winnerId
    };
  }

  /**
   * B-01: Check if tournament is complete and distribute rewards
   */
  private checkTournamentComplete(tournamentId: number): void {
    const pendingMatches = db.prepare(
      "SELECT COUNT(*) as c FROM tournament_matches WHERE tournament_id = ? AND status = 'pending'"
    ).get(tournamentId) as { c: number };

    if (pendingMatches.c === 0) {
      // Tournament complete — find winner
      const finalMatch = db.prepare(
        "SELECT winner_id FROM tournament_matches WHERE tournament_id = ? AND round = (SELECT MAX(round) FROM tournament_matches WHERE tournament_id = ?) AND status = 'completed'"
      ).get(tournamentId, tournamentId) as { winner_id: string } | undefined;

      if (finalMatch?.winner_id) {
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as Tournament;
        const rewards = tournament.type === 'weekly' ? WEEKLY_REWARDS : MONTHLY_REWARDS;

        // Award top 3
        for (let i = 0; i < Math.min(3, rewards.length); i++) {
          const r = rewards[i];
          // Simple: award to top 3 by match wins
          const user = userRepository.get(finalMatch.winner_id);
          if (user) {
            userRepository.update(finalMatch.winner_id, {
              knb: user.knb + r.knb,
              coin_ha_pham: user.coin_ha_pham + r.coins
            });
          }
        }

        db.prepare("UPDATE tournaments SET status = 'completed' WHERE id = ?").run(tournamentId);
      }
    }
  }

  /**
   * B-01: Get tournament info
   */
  getTournamentInfo(type: TournamentType = 'weekly'): {
    tournament: Tournament;
    participants: number;
    maxParticipants: number;
    myMatches: TournamentMatch[];
    allMatches: TournamentMatch[];
  } {
    this.initTable();
    const tournament = this.getCurrentTournament(type);
    const maxParticipants = type === 'weekly' ? 16 : 64;

    const participants = db.prepare('SELECT COUNT(*) as c FROM tournament_participants WHERE tournament_id = ?')
      .get(tournament.id) as { c: number };

    const allMatches = db.prepare('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round ASC, id ASC')
      .all(tournament.id) as TournamentMatch[];

    return {
      tournament,
      participants: participants.c,
      maxParticipants,
      myMatches: [],
      allMatches
    };
  }

  /**
   * B-01: Get leaderboard
   */
  getLeaderboard(type: TournamentType = 'weekly'): { userId: string; name: string; wins: number }[] {
    this.initTable();
    const tournament = this.getCurrentTournament(type);

    const wins = db.prepare(`
      SELECT winner_id, COUNT(*) as wins FROM tournament_matches
      WHERE tournament_id = ? AND status = 'completed' AND winner_id IS NOT NULL
      GROUP BY winner_id ORDER BY wins DESC
    `).all(tournament.id) as { winner_id: string; wins: number }[];

    return wins.map(w => {
      const user = userRepository.get(w.winner_id);
      return { userId: w.winner_id, name: user?.name || 'Không rõ', wins: w.wins };
    });
  }

  // === B-02: Tournament Expansion ===

  /**
   * B-02: Get tournament types
   */
  getTournamentTypes(): { id: string; name: string; description: string; maxPlayers: number; frequency: string }[] {
    return [
      { id: '1v1_weekly', name: '1v1 Tuần', description: 'Giải đấu đơn đấu', maxPlayers: 16, frequency: 'weekly' },
      { id: '3v3_monthly', name: '3v3 Tháng', description: 'Giải đấu đồng đội (3 người)', maxPlayers: 48, frequency: 'monthly' },
      { id: '5v5_monthly', name: '5v5 Tháng', description: 'Giải đấu đồng đội (5 người)', maxPlayers: 80, frequency: 'monthly' },
      { id: 'fire_monthly', name: 'Hỏa Hệ Tháng', description: 'Chỉ hệ Hỏa', maxPlayers: 32, frequency: 'monthly' },
      { id: 'water_monthly', name: 'Thủy Hệ Tháng', description: 'Chỉ hệ Thủy', maxPlayers: 32, frequency: 'monthly' },
      { id: 'low_level_weekly', name: 'Cấp Thấp Tuần', description: 'Chỉ cấp < 100', maxPlayers: 32, frequency: 'weekly' },
    ];
  }

  /**
   * B-02: Get tournament spectating info
   */
  getTournamentSpectating(matchId: string): { viewers: number; recentActions: string[] } {
    const viewers = db.prepare('SELECT COUNT(*) as c FROM arena_spectators WHERE match_id = ?').get(matchId) as { c: number };
    return {
      viewers: viewers.c,
      recentActions: [] // Would track recent actions in real implementation
    };
  }

  /**
   * B-02: Get tournament history
   */
  getTournamentHistory(type: TournamentType = 'weekly', limit: number = 5): { season: number; winner: string; date: string }[] {
    this.initTable();
    return db.prepare(`
      SELECT season_number, status, datetime(start_time, 'unixepoch') as date
      FROM tournaments WHERE type = ? AND status = 'completed'
      ORDER BY season_number DESC LIMIT ?
    `).all(type, limit) as any[];
  }

  /**
   * B-02: Get tournament description
   */
  getTournamentDescription(type: TournamentType = 'weekly'): string {
    const types = this.getTournamentTypes();
    const typeInfo = types.find(t => t.id === `${type}_weekly` || t.id === `${type}_monthly`);

    let msg = `🏆 **${type === 'weekly' ? 'Giải Đấu Tuần' : 'Giải Đấu Tháng'}**\n`;
    msg += `${typeInfo?.description || 'Competitive tournament'}\n`;
    msg += `👥 Max players: **${typeInfo?.maxPlayers || 16}**\n`;
    msg += `📅 Frequency: **${typeInfo?.frequency || type}**\n\n`;

    msg += `**Phần thưởng:**\n`;
    const rewards = type === 'weekly' ? WEEKLY_REWARDS : MONTHLY_REWARDS;
    for (const r of rewards) {
      msg += `• Rank ${r.rank}: ${r.knb} KNB + ${r.coins} LT + "${r.title}"\n`;
    }

    msg += `\n*Dùng \`/giaidau dangky\` để đăng ký*`;
    return msg;
  }
}

export const tournamentService = new TournamentService();
