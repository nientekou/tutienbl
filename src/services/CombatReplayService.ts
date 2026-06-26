// V13 D-03: Chiến Lược Phân Tích (Combat Replay & Analysis)
import db from '../database/database';
import { CombatResult } from './CombatEngine';

interface RoundAnalysis {
  round: number;
  playerDamageDealt: number;
  playerDamageTaken: number;
  skillsUsed: string[];
  critCount: number;
  dodgeCount: number;
  blockCount: number;
}

interface CombatAnalysis {
  totalDamageDealt: number;
  totalDamageTaken: number;
  avgDamagePerRound: number;
  critRate: number;
  dodgeCount: number;
  blockCount: number;
  efficiencyRating: 'S' | 'A' | 'B' | 'C' | 'D';
  tips: string[];
  roundBreakdown: RoundAnalysis[];
}

class CombatReplayService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS combat_replays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        enemy_name TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
    `);
  }

  public storeReplay(userId: string, result: CombatResult, enemyName: string): number {
    this.initTable();
    const info = db.prepare(
      'INSERT INTO combat_replays (user_id, result_json, enemy_name) VALUES (?, ?, ?)'
    ).run(userId, JSON.stringify(result), enemyName);
    // V16 E-02: Keep last 20 only
    db.prepare(`
      DELETE FROM combat_replays WHERE user_id = ? AND id NOT IN (
        SELECT id FROM combat_replays WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      )
    `).run(userId, userId);
    return info.lastInsertRowid as number;
  }

  public analyze(result: CombatResult): CombatAnalysis {
    const log = result.log;
    const tips: string[] = [];
    let critCount = 0;
    let dodgeCount = 0;
    let blockCount = 0;
    let playerDamageTaken = 0;
    const roundBreakdown: RoundAnalysis[] = [];

    // Parse log for per-round data
    const roundSections = log.join('\n').split(/=== ⏳ \*\*Hiệp (\d+)\*\* ===/);
    for (let i = 1; i < roundSections.length; i += 2) {
      const roundNum = parseInt(roundSections[i]);
      const section = roundSections[i + 1] || '';
      const playerDmg = (section.match(/gây \*\*(\d+)\*\* sát thương/g) || [])
        .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
      const enemyDmg = (section.match(/nhận \*\*(\d+)\*\* sát thương/g) || [])
        .reduce((sum, m) => sum + parseInt(m.match(/\d+/)?.[0] || '0'), 0);
      const crits = (section.match(/Bạo Kích|crit/gi) || []).length;
      const dodges = (section.match(/né tránh| dodge/gi) || []).length;
      const blocks = (section.match(/Chặn| block/gi) || []).length;

      critCount += crits;
      dodgeCount += dodges;
      blockCount += blocks;
      playerDamageTaken += enemyDmg;

      roundBreakdown.push({
        round: roundNum,
        playerDamageDealt: playerDmg,
        playerDamageTaken: enemyDmg,
        skillsUsed: [],
        critCount: crits,
        dodgeCount: dodges,
        blockCount: blocks,
      });
    }

    // Calculate efficiency
    const totalRounds = result.rounds || 1;
    const avgDmgPerRound = Math.round(result.totalDamageDealt / totalRounds);
    const critRate = result.totalDamageDealt > 0 ? critCount / totalRounds : 0;

    let rating: CombatAnalysis['efficiencyRating'] = 'C';
    if (result.winner === 'player') {
      if (totalRounds <= 5) rating = 'S';
      else if (totalRounds <= 10) rating = 'A';
      else if (totalRounds <= 20) rating = 'B';
      else rating = 'C';
    } else {
      rating = 'D';
    }

    // Generate tips
    if (critRate < 0.1) tips.push('Tỷ lệ chí mạng thấp — thử equip trang bị +crit hoặc dùng tâm pháp crit.');
    if (playerDamageTaken > result.totalDamageDealt * 0.5) tips.push('Nhận quá nhiều sát thương — thử dùng guard hoặc build DEF hơn.');
    if (dodgeCount === 0 && blockCount === 0) tips.push('Không né/block lần nào — equip vật phẩm +dodge hoặc dùng skill né.');
    if (totalRounds > 25) tips.push('Trận kéo dài quá — cần burst damage hơn, thử dùng elemental combo.');
    if (result.winner === 'enemy') tips.push('Thua trận — thử đổi element克制 enemy, hoặc提升 level/trang bị.');
    if (tips.length === 0) tips.push('Trận chiến tốt! Tiếp tục maintain phong độ.');

    return {
      totalDamageDealt: result.totalDamageDealt,
      totalDamageTaken: playerDamageTaken,
      avgDamagePerRound: avgDmgPerRound,
      critRate: Math.round(critRate * 100),
      dodgeCount,
      blockCount,
      efficiencyRating: rating,
      tips,
      roundBreakdown,
    };
  }

  public getReplayDescription(analysis: CombatAnalysis): string {
    let msg = `📊 **Phân Tích Chiến Đấu** — Rating: **${analysis.efficiencyRating}**\n`;
    msg += `⚔️ Damage gây: **${analysis.totalDamageDealt.toLocaleString()}** | Damage nhận: **${analysis.totalDamageTaken.toLocaleString()}**\n`;
    msg += `📈 TB Damage/hit: **${analysis.avgDamagePerRound.toLocaleString()}**\n`;
    msg += `💥 Chí mạng: **${analysis.critRate}%** | Né: **${analysis.dodgeCount}** | Chặn: **${analysis.blockCount}**\n`;

    if (analysis.tips.length > 0) {
      msg += `\n**Gợi Ý:**\n`;
      for (const tip of analysis.tips) {
        msg += `• ${tip}\n`;
      }
    }

    return msg;
  }

  public getRecentReplays(userId: string): { id: number; enemyName: string; createdAt: number }[] {
    this.initTable();
    return db.prepare(
      'SELECT id, enemy_name as enemyName, created_at as createdAt FROM combat_replays WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(userId) as { id: number; enemyName: string; createdAt: number }[];
  }

  public getReplay(userId: string, replayId: number): CombatResult | null {
    this.initTable();
    const row = db.prepare(
      'SELECT result_json FROM combat_replays WHERE user_id = ? AND id = ?'
    ).get(userId, replayId) as { result_json: string } | undefined;
    return row ? JSON.parse(row.result_json) : null;
  }
}

export const combatReplayService = new CombatReplayService();
