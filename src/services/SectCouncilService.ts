// V13 C-01: Hội Đồng Tông Môn (Sect Council)
import db from '../database/database';

interface SectPolicy {
  id: string;
  name: string;
  description: string;
  effect_type: string;
  effect_value: number;
}

const POLICY_POOL: SectPolicy[] = [
  { id: 'song_tu', name: 'Song Tu Pháp Trận', description: '+20% cultivation EXP cho cả tông môn', effect_type: 'cultivation_exp', effect_value: 0.20 },
  { id: 'linh_thu', name: 'Linh Thú Bảo Hộ', description: '+15% drop rate từ beast', effect_type: 'beast_drop', effect_value: 0.15 },
  { id: 'chien_tien', name: 'Chiến Tiền Chuẩn Bị', description: '+10% combat stats cho sect war', effect_type: 'combat_stats', effect_value: 0.10 },
  { id: 'thuong_mai', name: 'Thương Mại Thuận Lợi', description: '-30% market tax cho members', effect_type: 'market_tax', effect_value: -0.30 },
  { id: 'san_lung', name: 'Săn Lùng Bảo Vật', description: '+25% exploration rewards', effect_type: 'exploration_rewards', effect_value: 0.25 },
];

class SectCouncilService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sect_policies (
        sect_id INTEGER NOT NULL,
        policy_id TEXT NOT NULL,
        proposed_by TEXT NOT NULL,
        votes_yes INTEGER DEFAULT 0,
        votes_no INTEGER DEFAULT 0,
        status TEXT DEFAULT 'voting',
        start_time INTEGER,
        end_time INTEGER,
        PRIMARY KEY (sect_id, policy_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sect_policy_votes (
        user_id TEXT NOT NULL,
        sect_id INTEGER NOT NULL,
        policy_id TEXT NOT NULL,
        vote TEXT NOT NULL,
        PRIMARY KEY (user_id, sect_id, policy_id)
      );
    `);
  }

  public getActivePolicy(sectId: number): SectPolicy | null {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare(
      "SELECT policy_id FROM sect_policies WHERE sect_id = ? AND status = 'active' AND end_time > ?"
    ).get(sectId, now) as { policy_id: string } | undefined;
    if (!row) return null;
    return POLICY_POOL.find(p => p.id === row.policy_id) || null;
  }

  public getVotingPolicy(sectId: number): { policy: SectPolicy; votesYes: number; votesNo: number; endTime: number } | null {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare(
      "SELECT * FROM sect_policies WHERE sect_id = ? AND status = 'voting' AND end_time > ?"
    ).get(sectId, now) as any;
    if (!row) return null;
    const policy = POLICY_POOL.find(p => p.id === row.policy_id);
    if (!policy) return null;
    return { policy, votesYes: row.votes_yes, votesNo: row.votes_no, endTime: row.end_time };
  }

  public proposePolicy(sectId: number, proposedBy: string): { success: boolean; policy?: SectPolicy; message: string } {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    // Check no active voting
    const existing = db.prepare(
      "SELECT 1 FROM sect_policies WHERE sect_id = ? AND status IN ('voting', 'active') AND end_time > ?"
    ).get(sectId, now);
    if (existing) return { success: false, message: 'Đang có chính sách đang vote hoặc active.' };

    // Random policy
    const policy = POLICY_POOL[Math.floor(Math.random() * POLICY_POOL.length)];
    const endTime = now + 24 * 60 * 60; // 24h voting

    db.prepare(
      'INSERT INTO sect_policies (sect_id, policy_id, proposed_by, votes_yes, votes_no, status, start_time, end_time) VALUES (?, ?, ?, 0, 0, ?, ?, ?)'
    ).run(sectId, policy.id, proposedBy, 'voting', now, endTime);

    return { success: true, policy, message: `Đã đề xuất: **${policy.name}** — ${policy.description}` };
  }

  public vote(sectId: number, userId: string, policyId: string, vote: 'yes' | 'abstain'): { success: boolean; message: string } {
    this.initTable();
    // Check already voted
    const existing = db.prepare(
      'SELECT vote FROM sect_policy_votes WHERE user_id = ? AND sect_id = ? AND policy_id = ?'
    ).get(userId, sectId, policyId);
    if (existing) return { success: false, message: 'Đã vote rồi.' };

    db.prepare('INSERT INTO sect_policy_votes (user_id, sect_id, policy_id, vote) VALUES (?, ?, ?, ?)')
      .run(userId, sectId, policyId, vote);

    if (vote === 'yes') {
      db.prepare('UPDATE sect_policies SET votes_yes = votes_yes + 1 WHERE sect_id = ? AND policy_id = ?')
        .run(sectId, policyId);
    } else {
      db.prepare('UPDATE sect_policies SET votes_no = votes_no + 1 WHERE sect_id = ? AND policy_id = ?')
        .run(sectId, policyId);
    }

    return { success: true, message: 'Đã ghi nhận phiếu bầu.' };
  }

  public resolveVoting(sectId: number): void {
    this.initTable();
    const now = Math.floor(Date.now() / 1000);
    const voting = db.prepare(
      "SELECT * FROM sect_policies WHERE sect_id = ? AND status = 'voting' AND end_time <= ?"
    ).get(sectId, now) as any;
    if (!voting) return;

    if (voting.votes_yes > voting.votes_no) {
      // Activate: 7 days
      db.prepare("UPDATE sect_policies SET status = 'active', start_time = ?, end_time = ? WHERE sect_id = ? AND policy_id = ? AND status = 'voting'")
        .run(now, now + 7 * 24 * 60 * 60, sectId, voting.policy_id);
    } else {
      // Reject
      db.prepare("UPDATE sect_policies SET status = 'rejected' WHERE sect_id = ? AND policy_id = ? AND status = 'voting'")
        .run(sectId, voting.policy_id);
    }
  }

  public getSectBuff(sectId: number): { type: string; value: number } | null {
    const policy = this.getActivePolicy(sectId);
    if (!policy) return null;
    return { type: policy.effect_type, value: policy.effect_value };
  }
}

export const sectCouncilService = new SectCouncilService();
