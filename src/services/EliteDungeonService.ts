import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { ITEMS, getLegendaryWeapon } from '../config/itemConstants';
import { CombatEngine, Combatant } from './CombatEngine';
import { dailyQuestService } from './DailyQuestService';

export interface EliteDungeon {
  id: string;
  name: string;
  description: string;
  floors: number;
  min_level: number;
  max_level: number;
  min_party_size: number;
  max_party_size: number;
  cooldown_hours: number;
  rewards_config: string;
}

export interface EliteDungeonRun {
  id: number;
  dungeon_id: string;
  party_id: string;
  host_id: string;
  current_floor: number;
  status: 'active' | 'completed' | 'failed';
  started_at: number;
  completed_at: number | null;
  total_time: number;
}

export interface FloorBoss {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  crit: number;
  speed: number;
  element: string;
  phaseTriggers: Array<{ hpPct: number; mechanic: string }>;
}

const FLOOR_SCALING = { hp: 1.4, atk: 1.3, def: 1.2 };

class EliteDungeonService {
  public getAvailableDungeons(userLevel: number): EliteDungeon[] {
    return db.prepare(
      'SELECT * FROM elite_dungeons WHERE min_level <= ? AND max_level >= ? ORDER BY min_level ASC'
    ).all(userLevel, userLevel) as EliteDungeon[];
  }

  public getDungeon(dungeonId: string): EliteDungeon | null {
    return db.prepare('SELECT * FROM elite_dungeons WHERE id = ?').get(dungeonId) as EliteDungeon | null;
  }

  public getActiveRun(partyId: string): EliteDungeonRun | null {
    return db.prepare(
      "SELECT * FROM elite_dungeon_runs WHERE party_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
    ).get(partyId) as EliteDungeonRun | null;
  }

  public getRunById(runId: number): EliteDungeonRun | null {
    return db.prepare('SELECT * FROM elite_dungeon_runs WHERE id = ?').get(runId) as EliteDungeonRun | null;
  }

  public startRun(hostId: string, dungeonId: string, partyId: string): { success: boolean; message: string; run?: EliteDungeonRun } {
    const dungeon = this.getDungeon(dungeonId);
    if (!dungeon) return { success: false, message: 'Bí cảnh không tồn tại!' };

    const existingRun = this.getActiveRun(partyId);
    if (existingRun) return { success: false, message: 'Party này đang có một run bí cảnh đang hoạt động!' };

    const now = Math.floor(Date.now() / 1000);

    // Kiểm tra cooldown dựa trên các run đã hoàn thành trước đó của hostId
    const lastRun = db.prepare(`
      SELECT completed_at FROM elite_dungeon_runs 
      WHERE host_id = ? AND dungeon_id = ? AND status = 'completed' 
      ORDER BY completed_at DESC LIMIT 1
    `).get(hostId, dungeonId) as { completed_at: number } | undefined;

    if (lastRun && lastRun.completed_at) {
      const elapsedSeconds = now - lastRun.completed_at;
      const cooldownSeconds = dungeon.cooldown_hours * 3600;
      if (elapsedSeconds < cooldownSeconds) {
        const remainingSeconds = cooldownSeconds - elapsedSeconds;
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.ceil((remainingSeconds % 3600) / 60);
        return { 
          success: false, 
          message: `❌ **Bí cảnh đang trong thời gian tĩnh dưỡng:** Đạo hữu cần chờ thêm **${hours} giờ ${minutes} phút** trước khi có thể khiêu chiến lại!` 
        };
      }
    }

    db.prepare(`
      INSERT INTO elite_dungeon_runs (dungeon_id, party_id, host_id, current_floor, status, started_at)
      VALUES (?, ?, ?, 1, 'active', ?)
    `).run(dungeonId, partyId, hostId, now);

    const run = this.getActiveRun(partyId);
    return {
      success: true,
      message: `🏰 Bắt đầu chinh phục **${dungeon.name}**! Tầng 1/${dungeon.floors}.`,
      run: run || undefined,
    };
  }

  public getBossConfig(dungeonId: string, floor: number): FloorBoss | null {
    const dungeon = this.getDungeon(dungeonId);
    if (!dungeon) return null;

    const floorMult = Math.pow(FLOOR_SCALING.hp, floor - 1);
    const atkMult = Math.pow(FLOOR_SCALING.atk, floor - 1);
    const defMult = Math.pow(FLOOR_SCALING.def, floor - 1);

    const bossNames = [
      'Thạch Cơ Thủ Vệ', 'Ma Hóa Linh Thú', 'Hắc Ám Kỵ Sĩ',
      'Cổ Độc Yêu Tăng', 'Thượng Cổ Ma Long'
    ];

    const base = 50 + dungeon.min_level * 2;
    return {
      name: `${bossNames[(floor - 1) % bossNames.length]} (Tầng ${floor})`,
      hp: Math.round(500 * floorMult * (1 + dungeon.min_level * 0.1)),
      maxHp: Math.round(500 * floorMult * (1 + dungeon.min_level * 0.1)),
      atk: Math.round((base + floor * 20) * atkMult),
      def: Math.round((20 + floor * 8) * defMult),
      crit: 0.08 + floor * 0.02,
      speed: 80 + floor * 5,
      element: ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'][(floor - 1) % 5],
      phaseTriggers: [
        { hpPct: 0.7, mechanic: 'shield' },
        { hpPct: 0.3, mechanic: 'enrage' },
      ],
    };
  }

  public processFloorResult(runId: number, dungeonId: string, partyMembers: Combatant[]): {
    success: boolean;
    message: string;
    bossKilled?: boolean;
    newFloor?: number;
    completed?: boolean;
  } {
    const run = this.getRunById(runId);
    const dungeon = this.getDungeon(dungeonId);
    if (!run || !dungeon) return { success: false, message: 'Run hoặc dungeon không tồn tại.' };

    const boss = this.getBossConfig(dungeonId, run.current_floor);
    if (!boss) return { success: false, message: 'Không tìm thấy boss.' };

    // Simulate party combat
    const log: string[] = [];
    let bossHp = boss.hp;
    let allDead = false;

    for (let round = 1; round <= 15; round++) {
      if (allDead || bossHp <= 0) break;

      for (const member of partyMembers) {
        if (bossHp <= 0) break;
        if (member.hp <= 0) continue;

        // Player attack
        let dmg = Math.max(1, member.atk - boss.def);
        dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));

        // Phase mechanics
        const hpPct = bossHp / boss.maxHp;
        if (hpPct <= 0.7 && hpPct > 0.3) {
          dmg = Math.round(dmg * 0.5); // Shield: 50% damage reduction
        }
        if (hpPct <= 0.3) {
          dmg = Math.round(dmg * 0.7); // Enrage: boss tougher
        }

        bossHp -= dmg;
        if (bossHp <= 0) {
          bossHp = 0;
          break;
        }

        // Boss attack back
        let bossDmg = Math.max(1, boss.atk - member.def);
        bossDmg = Math.round(bossDmg * (0.9 + Math.random() * 0.2));
        if (hpPct <= 0.3) {
          bossDmg = Math.round(bossDmg * 1.5); // Enrage: +50% damage
        }
        member.hp -= bossDmg;
        if (member.hp <= 0) {
          allDead = partyMembers.every(m => m.hp <= 0);
        }
      }
    }

    const bossKilled = bossHp <= 0;

    if (bossKilled) {
      const isLastFloor = run.current_floor >= dungeon.floors;
      if (isLastFloor) {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - run.started_at;
        
        let dropMessage = '';

        db.transaction(() => {
          db.prepare(`
            UPDATE elite_dungeon_runs SET status = 'completed', completed_at = ?, total_time = ?, current_floor = ?
            WHERE id = ?
          `).run(now, elapsed, run.current_floor, runId);

          // Distribute rewards to party members
          const rewards = this.generateFloorRewards(dungeon, run.current_floor);
          
          let bossDropRate: { epic?: number; legendary?: number } = {};
          try {
            const config = JSON.parse(dungeon.rewards_config || '{}');
            bossDropRate = config.boss_drop_rate || {};
          } catch (e) { console.warn('[EliteDungeonService] Failed to parse dungeon rewards_config:', e); }

          const party = db.prepare('SELECT member_ids FROM party_rooms WHERE id = ?').get(run.party_id) as any;
          if (party) {
            const members: string[] = JSON.parse(party.member_ids || '[]');
            const { inventoryRepository: invRepo } = require('../database/repositories/InventoryRepository');
            for (const uid of members) {
              const u = userRepository.get(uid);
              if (u) {
                userRepository.update(uid, {
                  tu_vi: (u.tu_vi || 0) + rewards.exp,
                  coin_ha_pham: (u.coin_ha_pham || 0) + rewards.coins,
                });

                // Nếu là Thánh Địa Cấm Khu, rơi legendary weapon theo tỷ lệ
                if (dungeon.id === 'ed_cam_khu' && bossDropRate.legendary && Math.random() < bossDropRate.legendary) {
                  const itemId = getLegendaryWeapon(Math.floor(Math.random() * 5) + 1);
                  invRepo.addItem(uid, itemId, 1);
                  
                  // Lấy tên vật phẩm huyền thoại
                  const itemRow = db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string } | undefined;
                  const name = itemRow?.name || itemId;
                  dropMessage += `\n• <@${uid}> nhận được **${name}** 👑`;
                }

                // Cập nhật tiến trình nhiệm vụ hàng ngày
                dailyQuestService.updateProgress(uid, 'daily_bicanh', 1);
              }
            }
          }
        })();

        return { success: true, message: `🎉 Hoàn thành **${dungeon.name}**!${dropMessage}`, bossKilled: true, completed: true };
      } else {
        const nextFloor = run.current_floor + 1;
        db.prepare('UPDATE elite_dungeon_runs SET current_floor = ? WHERE id = ?').run(nextFloor, runId);
        return { success: true, message: `✅ Vượt qua tầng ${run.current_floor}! Tiến vào tầng ${nextFloor}.`, bossKilled: true, newFloor: nextFloor };
      }
    } else {
      db.prepare("UPDATE elite_dungeon_runs SET status = 'failed' WHERE id = ?").run(runId);
      return { success: true, message: `💀 Thất bại ở tầng ${run.current_floor} của **${dungeon.name}**.`, bossKilled: false };
    }
  }

  public generateFloorRewards(dungeon: EliteDungeon, floor: number): { exp: number; coins: number } {
    const config = JSON.parse(dungeon.rewards_config || '{}');
    const floorRewards = config.floor_rewards;
    if (!floorRewards || !floorRewards[floor - 1]) {
      return { exp: 100 * floor, coins: 100 * floor };
    }
    const reward = floorRewards[floor - 1];
    return {
      exp: Math.floor(Math.random() * (reward.max.exp - reward.min.exp + 1)) + reward.min.exp,
      coins: Math.floor(Math.random() * (reward.max.coins - reward.min.coins + 1)) + reward.min.coins,
    };
  }

  public getLeaderboard(dungeonId: string): Array<{
    party_id: string;
    party_members: string[];
    floors_cleared: number;
    total_time: number;
  }> {
    return db.prepare(`
      SELECT * FROM elite_dungeon_leaderboard
      WHERE dungeon_id = ?
      ORDER BY floors_cleared DESC, total_time ASC
      LIMIT 10
    `).all(dungeonId) as any[];
  }

  public recordLeaderboard(dungeonId: string, partyId: string, partyMembers: string[], floorsCleared: number, totalTime: number): void {
    db.prepare(`
      INSERT INTO elite_dungeon_leaderboard (dungeon_id, party_id, party_members, floors_cleared, total_time, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(dungeon_id, party_id) DO UPDATE SET
        floors_cleared = excluded.floors_cleared,
        total_time = excluded.total_time,
        completed_at = excluded.completed_at
    `).run(dungeonId, partyId, JSON.stringify(partyMembers), floorsCleared, totalTime, Math.floor(Date.now() / 1000));
  }
}

export const eliteDungeonService = new EliteDungeonService();
