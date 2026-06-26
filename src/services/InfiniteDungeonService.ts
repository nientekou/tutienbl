import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { CombatEngine, Combatant } from './CombatEngine';
import { inventoryService } from './InventoryService';

// D-02: Infinite Dungeon System

const FLOOR_MODIFIERS = [
  { id: 'no_heal', name: 'Không Hồi Phục', description: 'Không thể hồi HP trong combat', effect: 'no_heal' },
  { id: 'double_damage', name: 'Sát Thương Đôi', description: 'Tất cả sát thương x2', effect: 'double_damage' },
  { id: 'elemental_immunity', name: 'Miễn Nhiễm Hệ', description: 'Kẻ địch miễn nhiễm 1 nguyên tố ngẫu nhiên', effect: 'elemental_immune' },
  { id: 'speed_boost', name: 'Tốc Độ Cao', description: 'Tất cả +50% speed', effect: 'speed_boost' },
  { id: 'glass_cannon', name: 'Súng Thủy Tinh', description: '+100% ATK, -50% HP', effect: 'glass_cannon' },
  { id: 'shield_only', name: 'Chỉ Khiên', description: 'Chỉ nhận sát thương từ shield', effect: 'shield_only' },
  // B3: New modifiers
  { id: 'heal_drain', name: 'Hút Hồi Phục', description: 'Kẻ địch hồi 5% HP mỗi hiệp', effect: 'heal_drain' },
  { id: 'mirror', name: 'Phản Chiếu', description: 'Kẻ địch copy chỉ số cao nhất của đạo hữu', effect: 'mirror' },
  { id: 'volatile', name: 'Bất Ổn', description: '50% chí mạng hoặc 50% miss mỗi hiệp', effect: 'volatile' },
];

const INFINITE_EXCLUSIVE_REWARDS: { floor: number; itemId: string; name: string }[] = [
  { floor: 10, itemId: 'infinite_shard', name: 'Mảnh Vô Hạn' },
  { floor: 25, itemId: 'infinite_shard', name: 'Mảnh Vô Hạn' },
  { floor: 50, itemId: 'infinite_core', name: 'Lõi Vô Hạn' },
  { floor: 100, itemId: 'infinite_core', name: 'Lõi Vô Hạn' },
];

interface InfiniteProgress {
  user_id: string;
  highest_floor: number;
  current_floor: number;
  total_damage: number;
  last_run_at: number;
  recent_modifiers: string; // JSON array of recent modifier IDs
}

interface InfiniteReward {
  floor: number;
  expReward: number;
  coinReward: number;
  specialReward?: string;
}

class InfiniteDungeonService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS infinite_dungeon_progress (
        user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        highest_floor INTEGER DEFAULT 0,
        current_floor INTEGER DEFAULT 1,
        total_damage INTEGER DEFAULT 0,
        last_run_at INTEGER DEFAULT 0,
        recent_modifiers TEXT DEFAULT '[]'
      );
    `);
    // B3: Add column if missing
    try {
      db.exec(`ALTER TABLE infinite_dungeon_progress ADD COLUMN recent_modifiers TEXT DEFAULT '[]'`);
    } catch (_) { /* column exists */ }
  }

  /**
   * D-02: Get or create infinite dungeon progress (with weekly reset)
   */
  getProgress(userId: string): InfiniteProgress {
    this.initTable();
    let row = db.prepare('SELECT * FROM infinite_dungeon_progress WHERE user_id = ?').get(userId) as InfiniteProgress | undefined;

    if (!row) {
      db.prepare('INSERT INTO infinite_dungeon_progress (user_id, highest_floor, current_floor, recent_modifiers) VALUES (?, 0, 1, ?)')
        .run(userId, '[]');
      row = db.prepare('SELECT * FROM infinite_dungeon_progress WHERE user_id = ?').get(userId) as InfiniteProgress;
    }
    if (!row.recent_modifiers) row.recent_modifiers = '[]';

    // C4: Weekly reset — check if last_run_at is from a previous week
    const currentWeekStart = this.getStartOfWeek();
    if (row.last_run_at < currentWeekStart && row.highest_floor > 0) {
      // Save previous week data for leaderboard, then reset
      db.prepare(`
        UPDATE infinite_dungeon_progress
        SET current_floor = 1, last_run_at = ?, recent_modifiers = '[]'
        WHERE user_id = ?
      `).run(Math.floor(Date.now() / 1000), userId);
      row.current_floor = 1;
    }

    return row!;
  }

  private getStartOfWeek(): number {
    const now = new Date();
    const day = now.getDay() || 7;
    if (day !== 1) now.setHours(-24 * (day - 1));
    now.setHours(0, 0, 0, 0);
    return Math.floor(now.getTime() / 1000);
  }

  /**
   * D-02: Get floor modifier (B3: randomized with buffer)
   */
  getFloorModifier(floor: number, recentModifiers: string[] = []): typeof FLOOR_MODIFIERS[0] | null {
    if (floor % 5 !== 0 || floor < 5) return null;

    // B3: Random pick, avoiding last 2 modifiers
    const available = FLOOR_MODIFIERS.filter(m => !recentModifiers.includes(m.id));
    const pool = available.length > 0 ? available : FLOOR_MODIFIERS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * D-02: Get enemy stats for a floor
   */
  getEnemyStats(floor: number): { hp: number; atk: number; def: number; name: string } {
    const baseHp = 500;
    const baseAtk = 50;
    const baseDef = 25;

    const scale = Math.pow(1.15, floor - 1); // 1.15x per floor

    return {
      hp: Math.round(baseHp * scale),
      atk: Math.round(baseAtk * scale),
      def: Math.round(baseDef * scale),
      name: `Infinite Guardian - Floor ${floor}`
    };
  }

  /**
   * D-02: Challenge a floor
   */
  challengeFloor(userId: string): { success: boolean; message: string; floor?: number; won?: boolean; rewards?: InfiniteReward } {
    this.initTable();
    const progress = this.getProgress(userId);
    const floor = progress.current_floor;

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: '❌ Chưa tạo nhân vật!' };

    // B3: Level gate
    if (user.level < 50) {
      return { success: false, message: '❌ Cần đạt level 50 để vào Infinite Dungeon!' };
    }

    // Get player stats
    const playerStats = inventoryService.getActiveStats(userId);
    if (!playerStats) return { success: false, message: '❌ Lỗi tính toán chỉ số!' };

    // Get enemy
    const enemy = this.getEnemyStats(floor);
    const recentMods: string[] = JSON.parse(progress.recent_modifiers || '[]');
    const modifier = this.getFloorModifier(floor, recentMods);

    // Apply modifier effects
    let playerAtk = playerStats.atk;
    let playerHp = playerStats.hp;
    let enemyAtk = enemy.atk;
    let enemyDef = enemy.def;

    if (modifier) {
      if (modifier.effect === 'double_damage') {
        playerAtk *= 2;
        enemyAtk *= 2;
      } else if (modifier.effect === 'glass_cannon') {
        playerAtk *= 2;
        playerHp = Math.round(playerHp * 0.5);
      } else if (modifier.effect === 'mirror') {
        // B3: Enemy copies player's highest stat
        const maxStat = Math.max(playerStats.atk, playerStats.def, playerStats.hp * 0.1);
        enemyAtk = Math.round(maxStat);
        enemyDef = Math.round(maxStat * 0.5);
      } else if (modifier.effect === 'heal_drain') {
        // B3: Enemy heals 5% per round — represented as higher HP
        enemy.hp = Math.round(enemy.hp * 1.3);
      }
      // speed_boost and volatile are handled in CombatEngine via effects
    }

    const playerCombatant: Combatant = {
      name: user.name, hp: playerHp, maxHp: playerStats.hp, atk: playerAtk,
      def: playerStats.def, crit: playerStats.crit, critRes: playerStats.critRes,
      luck: playerStats.luck, speed: playerStats.speed, dodge: playerStats.dodge,
      linhCan: user.linh_can
    };

    const enemyCombatant: Combatant = {
      name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemyAtk,
      def: enemyDef, crit: 0.05, critRes: 0.02, luck: 10
    };

    const result = CombatEngine.run(playerCombatant, enemyCombatant, null, 20);
    const won = result.winner === 'player';

    // Calculate rewards
    let rewards: InfiniteReward | undefined;
    if (won) {
      const expReward = 200 + floor * 50;
      const coinReward = 100 + floor * 20;

      // B3: Check for exclusive rewards at milestone floors
      const exclusiveReward = INFINITE_EXCLUSIVE_REWARDS.find(r => r.floor === floor);
      const specialReward = exclusiveReward ? exclusiveReward.name : (floor % 10 === 0 ? 'Tinh Thach Shard' : undefined);

      rewards = { floor, expReward, coinReward, specialReward };

      // Update progress + track recent modifiers
      const newHighest = Math.max(progress.highest_floor, floor);
      const newRecentMods = modifier ? [...recentMods.slice(-1), modifier.id] : recentMods;

      db.prepare(`
        UPDATE infinite_dungeon_progress
        SET highest_floor = ?, current_floor = ?, total_damage = total_damage + ?, last_run_at = ?, recent_modifiers = ?
        WHERE user_id = ?
      `).run(newHighest, floor + 1, result.totalDamageDealt, Math.floor(Date.now() / 1000), JSON.stringify(newRecentMods), userId);

      // Grant rewards
      userRepository.update(userId, {
        coin_ha_pham: user.coin_ha_pham + coinReward,
        tu_vi: Math.min(user.tu_vi + expReward, user.exp_needed)
      });

      if (exclusiveReward) {
        db.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, ?, 0)')
          .run(userId, exclusiveReward.itemId, 1);
      } else if (floor % 10 === 0) {
        db.prepare('INSERT INTO inventories (user_id, item_id, quantity, is_equipped) VALUES (?, ?, ?, 0)')
          .run(userId, 'tinh_thach_shard', 1);
      }
    } else {
      // B3: Checkpoint — reset to last multiple-of-10 instead of floor 1
      const checkpoint = Math.max(1, Math.floor(floor / 10) * 10);
      db.prepare('UPDATE infinite_dungeon_progress SET current_floor = ?, last_run_at = ? WHERE user_id = ?')
        .run(checkpoint, Math.floor(Date.now() / 1000), userId);
    }

    const modText = modifier ? `\n⚙️ **Modifier:** ${modifier.name} — ${modifier.description}` : '';

    return {
      success: true,
      message: `${won ? '🎉' : '💀'} **Infinite Dungeon Floor ${floor}** ${won ? 'THẮNG!' : 'THUA!'}${modText}`,
      floor,
      won,
      rewards
    };
  }

  /**
   * D-02: Get infinite dungeon description
   */
  getDescription(userId: string): string {
    const progress = this.getProgress(userId);

    let msg = `♾️ **Infinite Dungeon**\n`;
    msg += `🏆 Tầng cao nhất: **${progress.highest_floor}**\n`;
    msg += `📍 Tầng hiện tại: **${progress.current_floor}**\n`;
    msg += `💥 Tổng sát thương: **${progress.total_damage.toLocaleString()}**\n\n`;

    const modifier = this.getFloorModifier(progress.current_floor);
    if (modifier) {
      msg += `⚙️ **Biến Thể Tầng:** ${modifier.name}\n`;
      msg += `${modifier.description}\n\n`;
    }

    msg += `📊 **Chỉ Số Địch (Tầng ${progress.current_floor}):**\n`;
    const enemy = this.getEnemyStats(progress.current_floor);
    msg += `❤️ HP: **${enemy.hp.toLocaleString()}** | ⚔️ ATK: **${enemy.atk}** | 🛡️ DEF: **${enemy.def}**\n`;

    return msg;
  }

  /**
   * D-02: Get leaderboard
   */
  getLeaderboard(limit: number = 10): { userId: string; name: string; highestFloor: number; totalDamage: number }[] {
    this.initTable();
    const rows = db.prepare(`
      SELECT idp.*, u.name FROM infinite_dungeon_progress idp
      JOIN users u ON idp.user_id = u.discord_id
      ORDER BY idp.highest_floor DESC, idp.total_damage DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      highestFloor: r.highest_floor,
      totalDamage: r.total_damage
    }));
  }
}

export const infiniteDungeonService = new InfiniteDungeonService();
