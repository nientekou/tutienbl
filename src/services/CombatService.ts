import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { inventoryService } from './InventoryService';
import { eventService } from './EventService';
import { achievementService } from './AchievementService';
import { bloodlineService } from './BloodlineService';
import { leylineService } from './LeylineService';
import { DUNGEONS, DungeonConfig } from '../config/dungeons';
import { CombatEngine, CombatResult } from './CombatEngine';
import { WorldBossEntity } from '../utils/types';

// Biến dùng để gửi log về durability (dùng trong narrative)
const durabilityAlertThreshold = 30;

export interface DungeonChallengeResult {
  success: boolean;
  message: string;
  combatResult?: CombatResult;
  rewards?: {
    exp: number;
    coins: number;
    loots: Array<{ id: string; name: string; quantity: number }>;
  };
  dailyEntriesLeft?: number;
  artifactMessage?: string;
}

export interface BossChallengeResult {
  success: boolean;
  message: string;
  combatResult?: CombatResult;
  damageDealt?: number;
  isDefeated?: boolean;
  cooldownRemaining?: number; // seconds
  rewardsLogs?: string[];
}

export interface BossStatus {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  level: number;
  status: string;
  defeatedBy: string | null;
  respawnTimeRemaining?: number; // seconds
}

export class CombatService {
  /**
   * Lấy thông tin trạng thái World Boss hiện tại, tự động hồi sinh nếu quá CD
   */
  public getCurrentBoss(): BossStatus {
    const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity | undefined;
    if (!boss) throw new Error('World boss not found in database');
    const now = Math.floor(Date.now() / 1000);
    const respawnCooldown = 30; // 30 giây hồi sinh cho Boss kế tiếp

    // Daily reset logic: if the boss's last_spawned_at is from a previous calendar day, reset it to level 1
    const lastSpawnedDate = new Date((boss.last_spawned_at || 0) * 1000).toDateString();
    const todayDate = new Date().toDateString();
    if (lastSpawnedDate !== todayDate) {
      const nextLevel = 1;
      const newMaxHp = 5000;
      const newAtk = 80;
      const newDef = 50;

      db.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);

      // Xóa sạch đóng góp sát thương của Boss cũ
      db.prepare("DELETE FROM world_boss_contributions").run();

      const updatedBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity;
      return {
        name: updatedBoss.name,
        hp: updatedBoss.hp,
        maxHp: updatedBoss.max_hp,
        atk: updatedBoss.atk,
        def: updatedBoss.def,
        level: updatedBoss.level,
        status: updatedBoss.status,
        defeatedBy: null
      };
    }

    if (boss.status === 'defeated') {
      const elapsed = now - (boss.defeated_at || 0);
      if (elapsed >= respawnCooldown) {
        // Hồi sinh boss ở Level tiếp theo
        const nextLevel = boss.level + 1;
        const newMaxHp = Math.round(5000 * Math.pow(1.3, nextLevel - 1));
        const newAtk = Math.round(80 * Math.pow(1.15, nextLevel - 1));
        const newDef = Math.round(50 * Math.pow(1.15, nextLevel - 1));

        db.prepare(`
          UPDATE world_boss
          SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
          WHERE id = 'world_boss_current'
        `).run(newMaxHp, newMaxHp, newAtk, newDef, nextLevel, now);

        // Xóa sạch đóng góp sát thương của Boss cũ
        db.prepare("DELETE FROM world_boss_contributions").run();

        const updatedBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity;
        return {
          name: updatedBoss.name,
          hp: updatedBoss.hp,
          maxHp: updatedBoss.max_hp,
          atk: updatedBoss.atk,
          def: updatedBoss.def,
          level: updatedBoss.level,
          status: updatedBoss.status,
          defeatedBy: null
        };
      } else {
        return {
          name: boss.name,
          hp: 0,
          maxHp: boss.max_hp,
          atk: boss.atk,
          def: boss.def,
          level: boss.level,
          status: 'defeated',
          defeatedBy: boss.defeated_by,
          respawnTimeRemaining: respawnCooldown - elapsed
        };
      }
    }

    return {
      name: boss.name,
      hp: boss.hp,
      maxHp: boss.max_hp,
      atk: boss.atk,
      def: boss.def,
      level: boss.level,
      status: boss.status,
      defeatedBy: null
    };
  }

  /**
   * Thực hiện khiêu chiến phó bản Bí Cảnh
   */
  public challengeDungeon(
    userId: string, 
    dungeonId: string, 
    difficulty: string = 'thường', 
    playerBuffApplied: boolean = false, 
    monsterBuffApplied: boolean = false
  ): DungeonChallengeResult {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat`.' };
    }

    const dungeon = DUNGEONS[dungeonId];
    if (!dungeon) {
      return { success: false, message: 'Bí Cảnh này không tồn tại trong truyền thuyết!' };
    }

    if (user.level < dungeon.minLevel) {
      return { 
        success: false, 
        message: `Tu vi của đạo hữu quá thấp để tiến vào đây! Cần đạt **cấp ${dungeon.minLevel}** (hoặc cảnh giới tương đương).` 
      };
    }

    // Kiểm tra số lượt khiêu chiến hàng ngày
    const now = Math.floor(Date.now() / 1000);
    const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
      .get(userId, dungeonId) as { daily_entries: number; last_entry_at: number } | undefined;

    let entriesToday = 0;
    if (cd) {
      const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
      const nowDate = new Date().toDateString();
      if (cdDate === nowDate) {
        entriesToday = cd.daily_entries;
      }
    }

    if (entriesToday >= dungeon.maxDailyEntries) {
      return { 
        success: false, 
        message: `Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)` 
      };
    }

    // Lấy chỉ số chiến đấu thực tế
    const activeStats = inventoryService.getActiveStats(userId);
    if (!activeStats) {
      return { success: false, message: 'Không thể tính toán thuộc tính chiến đấu của đạo hữu.' };
    }

    // Hệ số độ khó
    let diffMultHp = 1.0;
    let diffMultAtk = 1.0;
    let diffMultDef = 1.0;
    let diffRewardMult = 1.0;

    switch (difficulty) {
      case 'dễ':
        diffMultHp = 0.8;
        diffMultAtk = 0.8;
        diffMultDef = 0.8;
        diffRewardMult = 0.8;
        break;
      case 'khó':
        diffMultHp = 1.4;
        diffMultAtk = 1.3;
        diffMultDef = 1.3;
        diffRewardMult = 1.5;
        break;
      case 'ác_mộng':
        diffMultHp = 2.0;
        diffMultAtk = 1.8;
        diffMultDef = 1.8;
        diffRewardMult = 2.5;
        break;
      case 'thường':
      default:
        diffMultHp = 1.0;
        diffMultAtk = 1.0;
        diffMultDef = 1.0;
        diffRewardMult = 1.0;
        break;
    }

    // Chỉ số quái vật cơ bản sau nhân hệ số độ khó
    let monsterHp = Math.round(dungeon.monster.hp * diffMultHp);
    let monsterAtk = Math.round(dungeon.monster.atk * diffMultAtk);
    let monsterDef = Math.round(dungeon.monster.def * diffMultDef);

    // Áp dụng bùa chú quyết sách lựa chọn khắc chế
    let playerAtk = activeStats.atk;
    
    // Leyline Buff Chiến Đấu (+10% ATK)
    if (leylineService.isBuffActive('chiendau')) {
      playerAtk = Math.round(playerAtk * 1.1);
    }
    
    let playerDef = activeStats.def;
    if (playerBuffApplied) {
      // +50% ATK & DEF
      playerAtk = Math.round(playerAtk * 1.5);
      playerDef = Math.round(playerDef * 1.5);
    }
    if (monsterBuffApplied) {
      // Quái vật nhận +100% ATK
      monsterAtk = Math.round(monsterAtk * 2.0);
    }

    // Lấy sủng thú xuất chiến
    const petRaw = db.prepare('SELECT name, base_atk, mutations FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId) as any;
    let pet = undefined;
    if (petRaw) {
      let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      try { mutations = JSON.parse(petRaw.mutations || '{}'); } catch(e){}
      pet = { name: petRaw.name, base_atk: petRaw.base_atk + (mutations.bonus_atk || 0) };
    }

    // Lấy các kỹ năng đang trang bị
    const equippedSkillsQuery = db.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId) as { skill_id: string, level: number }[];
    const equippedSkills = equippedSkillsQuery.map(s => {
      const { SKILL_DETAILS } = require('../commands/general/kynang');
      const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
      return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
    });

    const bdl1 = bloodlineService.getUserBloodline(userId);
    const { soulImprintService } = require('./SoulImprintService');
    const playerCombatant = {
      name: user.name,
      hp: activeStats.hp,
      maxHp: activeStats.hp,
      atk: playerAtk,
      def: playerDef,
      crit: activeStats.crit,
      critRes: activeStats.critRes,
      luck: activeStats.luck,
      speed: activeStats.speed ?? 100,
      dodge: activeStats.dodge ?? 0.05,
      linhCan: user.linh_can,
      equippedSkills: equippedSkills,
      bloodline: bdl1 ? { id: bdl1.bloodline_id, name: bdl1.name, level: bdl1.level, passives: bdl1.passives, rage_effect: bdl1.rage_effect, rage_cooldown: bdl1.rage_cooldown || 0 } : undefined,
      hasOai: soulImprintService.hasOaiActive(userId),
      userId: userId,
      level: user.level
    };

    // Tăng tốc độ né tránh quái vật theo bậc dungeon
    let monsterSpeed = 90;
    let monsterDodge = 0.05;
    if (dungeonId.includes('truc_co')) {
      monsterSpeed = 115;
      monsterDodge = 0.08;
    } else if (dungeonId.includes('kim_dan')) {
      monsterSpeed = 140;
      monsterDodge = 0.12;
    }

    // Nhân thêm nhẹ theo độ khó
    if (difficulty === 'khó') monsterSpeed = Math.round(monsterSpeed * 1.15);
    else if (difficulty === 'ác_mộng') monsterSpeed = Math.round(monsterSpeed * 1.3);

    const enemyCombatant = {
      name: `${dungeon.monster.name} [${difficulty.toUpperCase()}]`,
      hp: monsterHp,
      maxHp: monsterHp,
      atk: monsterAtk,
      def: monsterDef,
      crit: dungeon.monster.crit,
      critRes: dungeon.monster.critRes,
      speed: monsterSpeed,
      dodge: monsterDodge,
      luck: 10,
      element: dungeon.monster.element || 'Vô',
      level: dungeon.minLevel
    };

    // Chạy trận đấu
    const combatResult = CombatEngine.run(
      playerCombatant,
      enemyCombatant,
      pet ? { name: pet.name, atk: pet.base_atk } : null,
      30
    );

    // Cập nhật cooldown Rage nếu có
    if (playerCombatant.bloodline && playerCombatant.bloodline.rage_cooldown > 0) {
      bloodlineService.updateRageCooldown(userId, playerCombatant.bloodline.rage_cooldown);
    }

    // Cập nhật lượt đi trong ngày
    const newEntries = entriesToday + 1;
    db.prepare(`
      INSERT INTO dungeon_cooldowns (user_id, dungeon_id, daily_entries, last_entry_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, dungeon_id) DO UPDATE SET daily_entries = excluded.daily_entries, last_entry_at = excluded.last_entry_at
    `).run(userId, dungeonId, newEntries, now);

    const dailyEntriesLeft = dungeon.maxDailyEntries - newEntries;

    // Kiểm tra thành tựu bí cảnh (đếm từ audit_logs)
    const totalDungeonAttempts = db.prepare(
      "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'dungeon_run'"
    ).get(userId) as { c: number };
    const newAttempts = totalDungeonAttempts.c + 1;
    achievementService.setProgress(userId, 'cd_1', newAttempts);
    achievementService.setProgress(userId, 'cd_2', newAttempts);
    achievementService.setProgress(userId, 'cd_3', newAttempts);
    if (difficulty === 'ác_mộng' && combatResult.winner === 'player') {
      const totalNM = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'dungeon_nightmare'"
      ).get(userId) as { c: number };
      achievementService.setProgress(userId, 'cd_4', totalNM.c + 1);
    }

    // Ghi log dungeon
    const now2 = Math.floor(Date.now() / 1000);
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'dungeon_run', ?, ?)"
    ).run(userId, JSON.stringify({ dungeonId, difficulty, win: combatResult.winner === 'player' }), now2);
    if (difficulty === 'ác_mộng') {
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'dungeon_nightmare', ?, ?)"
      ).run(userId, JSON.stringify({ dungeonId, win: combatResult.winner === 'player' }), now2);
    }

    // Xử lý phần thưởng nếu chiến thắng
    if (combatResult.winner === 'player') {
      const baseCoin = Math.floor(Math.random() * (dungeon.rewards.coinMax - dungeon.rewards.coinMin + 1)) + dungeon.rewards.coinMin;
      const coinReward = Math.round(baseCoin * diffRewardMult);
      let expReward = Math.round(dungeon.rewards.exp * diffRewardMult);
      
      // Double EXP Weekend: x2 Tu Vi từ bí cảnh
      const isDoubleExp = eventService.isDoubleExpActive();
      if (isDoubleExp) expReward = Math.round(expReward * 2);

      // Giới hạn tu vi không vượt mức đột phá
      const cappedNewTuVi = Math.min(user.tu_vi + expReward, user.exp_needed);
      const actualGainedExp = cappedNewTuVi - user.tu_vi;

      // Cộng tiền và tu vi
      userRepository.update(userId, {
        tu_vi: cappedNewTuVi,
        coin_ha_pham: user.coin_ha_pham + coinReward
      });

      // Tăng kinh nghiệm huyết mạch
      if (actualGainedExp > 0) {
        bloodlineService.addExp(userId, Math.floor(actualGainedExp * 0.05));
      }

      // Phân tách phần thêm item hàng loạt
      const loots: Array<{ id: string; name: string; quantity: number }> = [];
      const itemsToAdd: Array<{ userId: string; itemId: string; quantity: number; customStats?: string | null }> = [];
      
      for (const loot of dungeon.rewards.loots) {
        // Tăng nhẹ tỷ lệ rơi đồ theo độ khó khó/ác mộng
        let activeRate = loot.rate;
        if (difficulty === 'khó') activeRate *= 1.25;
        if (difficulty === 'ác_mộng') activeRate *= 1.5;

        if (Math.random() < activeRate) {
          const item = db.prepare('SELECT name FROM items WHERE id = ?').get(loot.itemId) as { name: string } | undefined;
          if (item) {
            let customStats: string | null = null;
            
            // Trang bị ngẫu nhiên phẩm chất 20%
            if (loot.itemId.startsWith('weapon_') || loot.itemId.startsWith('armor_') || loot.itemId.startsWith('robe_')) {
              if (Math.random() < 0.20) {
                const bonusAtk = Math.floor(Math.random() * 8) + 2;
                const bonusHp = Math.floor(Math.random() * 30) + 10;
                customStats = JSON.stringify({ atk: bonusAtk, hp: bonusHp });
              }
            }

            itemsToAdd.push({ userId, itemId: loot.itemId, quantity: loot.quantity, customStats });
            loots.push({
              id: loot.itemId,
              name: item.name + (customStats ? ' (Tinh Luyện ✦)' : ''),
              quantity: loot.quantity
            });
          }
        }
      }

      // Phần thưởng đặc hữu của độ khó Ác Mộng (Nightmare): 15% cơ hội rơi Phôi Vũ Khí / Đạo Bào SSS cực quý
      if (difficulty === 'ác_mộng' && Math.random() < 0.15) {
        const isWeapon = Math.random() < 0.5;
        const targetPhoiId = isWeapon ? 'phoi_weapon_sss' : 'phoi_armor_sss';
        const itemDetails = db.prepare('SELECT name FROM items WHERE id = ?').get(targetPhoiId) as { name: string } | undefined;
        if (itemDetails) {
          itemsToAdd.push({ userId, itemId: targetPhoiId, quantity: 1 });
          loots.push({
            id: targetPhoiId,
            name: `🔥 ${itemDetails.name}`,
            quantity: 1
          });
        }
      }

      if (itemsToAdd.length > 0) {
        inventoryRepository.addMultipleItems(itemsToAdd);
      }

      // Giảm độ bền trang bị sau chiến đấu
      const affected = this.reduceDurabilityAfterCombat(userId, combatResult.rounds);

      // Cộng EXP cho Bản Mệnh Pháp Bảo
      let artifactMessage: string | undefined = undefined;
      const artifactExp = Math.round(expReward * 0.1);
      const artifactRes = inventoryService.addArtifactExp(userId, artifactExp);
      if (artifactRes && artifactRes.message) {
        artifactMessage = artifactRes.message;
      }

      return {
        success: true,
        message: 'Chiến Thắng' + (affected.length > 0 ? ` (${affected.join(', ')})` : ''),
        combatResult,
        rewards: {
          exp: actualGainedExp,
          coins: coinReward,
          loots
        },
        dailyEntriesLeft,
        artifactMessage
      };
    }

    // Thua cuộc - cũng giảm độ bền nhưng nhẹ hơn
    this.reduceDurabilityAfterCombat(userId, Math.max(1, Math.round(combatResult.rounds * 0.5)));
    return {
      success: true,
      message: 'Bại Trận',
      combatResult,
      dailyEntriesLeft
    };
  }

  /**
   * Thực hiện khiêu chiến World Boss
   */
  public challengeWorldBoss(userId: string, clearCooldownWithCoin: boolean = false): BossChallengeResult {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat`.' };
    }

    // Lấy thông tin boss và kiểm tra trạng thái hồi sinh
    this.getCurrentBoss(); // Trigger tự động hồi sinh nếu đủ thời gian
    const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as WorldBossEntity;
    
    if (boss.status === 'defeated') {
      const respawnTime = 30 - (Math.floor(Date.now() / 1000) - (boss.defeated_at || 0));
      return {
        success: false,
        message: `World Boss đã bị tiêu diệt! Đang ngưng tụ nguyên hồn, vui lòng đợi **${Math.max(0, respawnTime)} giây** để hồi sinh.`
      };
    }

    // Kiểm tra cooldown cá nhân (10 phút = 600 giây)
    const now = Math.floor(Date.now() / 1000);
    const contrib = db.prepare("SELECT last_attack_at, attacks FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
      .get(userId) as { last_attack_at: number; attacks: number } | undefined;

    let isCooldown = false;
    let cdSec = 0;

    if (contrib) {
      const elapsed = now - contrib.last_attack_at;
      if (elapsed < 600) {
        isCooldown = true;
        cdSec = 600 - elapsed;
      }
    }

    if (isCooldown) {
      const attackCount = contrib ? contrib.attacks : 0;
      const clearCost = 100 * Math.pow(2, attackCount);

      if (clearCooldownWithCoin) {
        if (user.coin_ha_pham < clearCost) {
          return { success: false, message: `Đạo hữu không đủ linh thạch để xóa thời gian chờ khiêu chiến! (Cần ${clearCost} Linh thạch, hiện có: ${user.coin_ha_pham})` };
        }
        // Trừ linh thạch
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - clearCost });
      } else {
        return {
          success: false,
          message: `Kinh mạch đạo hữu chưa hồi phục hoàn toàn! Vui lòng đợi **${cdSec} giây** hoặc dùng **${clearCost} Linh thạch** để tẩy CD khiêu chiến.`,
          cooldownRemaining: cdSec
        };
      }
    }

    // Lấy chỉ số của người chơi
    const activeStats = inventoryService.getActiveStats(userId);
    if (!activeStats) {
      return { success: false, message: 'Lỗi tính toán chỉ số nhân vật.' };
    }

    // Lấy sủng thú trợ chiến
    const petRaw = db.prepare('SELECT name, base_atk, mutations FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId) as any;
    let pet = undefined;
    if (petRaw) {
      let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      try { mutations = JSON.parse(petRaw.mutations || '{}'); } catch(e){}
      pet = { name: petRaw.name, base_atk: petRaw.base_atk + (mutations.bonus_atk || 0) };
    }

    // Lấy các kỹ năng đang trang bị
    const equippedSkillsQuery = db.prepare('SELECT skill_id, level FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(userId) as { skill_id: string, level: number }[];
    const equippedSkills = equippedSkillsQuery.map(s => {
      const { SKILL_DETAILS } = require('../commands/general/kynang');
      const detail = SKILL_DETAILS && SKILL_DETAILS[s.skill_id] ? SKILL_DETAILS[s.skill_id] : { name: s.skill_id, element: 'Vô' };
      return { id: s.skill_id, level: s.level, element: detail.element, name: detail.name };
    });

    const bdl2 = bloodlineService.getUserBloodline(userId);
    
    // Leyline Buff Chiến Đấu (+10% ATK)
    let playerAtk = activeStats.atk;
    if (leylineService.isBuffActive('chiendau')) {
      playerAtk = Math.round(playerAtk * 1.1);
    }
    
    const { soulImprintService } = require('./SoulImprintService');
    const playerCombatant = {
      name: user.name,
      hp: activeStats.hp,
      maxHp: activeStats.hp,
      atk: playerAtk,
      def: activeStats.def,
      crit: activeStats.crit,
      critRes: activeStats.critRes,
      luck: activeStats.luck,
      speed: activeStats.speed ?? 100,
      dodge: activeStats.dodge ?? 0.05,
      linhCan: user.linh_can,
      equippedSkills: equippedSkills,
      bloodline: bdl2 ? { id: bdl2.bloodline_id, name: bdl2.name, level: bdl2.level, passives: bdl2.passives, rage_effect: bdl2.rage_effect, rage_cooldown: bdl2.rage_cooldown || 0 } : undefined,
      hasOai: soulImprintService.hasOaiActive(userId),
      userId: userId,
      level: user.level
    };

    const enemyCombatant = {
      name: boss.name,
      hp: boss.hp,
      maxHp: boss.max_hp,
      atk: boss.atk,
      def: boss.def,
      crit: boss.crit,
      critRes: boss.critRes,
      luck: 20,
      element: 'Hỏa', // Mặc định Boss thế giới hệ Hỏa
      level: boss.level
    };

    // Khiêu chiến tối đa 15 hiệp với World Boss để giới hạn sát thương mỗi lượt
    const combatResult = CombatEngine.run(
      playerCombatant,
      enemyCombatant,
      pet ? { name: pet.name, atk: pet.base_atk } : null,
      15
    );

    // Cập nhật cooldown Rage nếu có
    if (playerCombatant.bloodline && playerCombatant.bloodline.rage_cooldown > 0) {
      bloodlineService.updateRageCooldown(userId, playerCombatant.bloodline.rage_cooldown);
    }

    const damageDealt = combatResult.totalDamageDealt;
    const newBossHp = Math.max(0, boss.hp - damageDealt);
    const isDefeated = newBossHp <= 0;

    // Cập nhật HP của World Boss
    if (isDefeated) {
      db.prepare("UPDATE world_boss SET hp = 0, status = 'defeated', defeated_at = ?, defeated_by = ? WHERE id = 'world_boss_current'")
        .run(now, userId);
    } else {
      db.prepare("UPDATE world_boss SET hp = ? WHERE id = 'world_boss_current'").run(newBossHp);
    }

    // Cập nhật đóng góp sát thương của người chơi
    const playerContrib = db.prepare("SELECT damage, attacks FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
      .get(userId) as { damage: number; attacks: number } | undefined;

    if (playerContrib) {
      db.prepare(`
        UPDATE world_boss_contributions
        SET damage = damage + ?, attacks = attacks + 1, last_attack_at = ?
        WHERE user_id = ? AND boss_id = 'world_boss_current'
      `).run(damageDealt, now, userId);
    } else {
      db.prepare(`
        INSERT INTO world_boss_contributions (user_id, boss_id, damage, attacks, last_attack_at)
        VALUES (?, 'world_boss_current', ?, 1, ?)
      `).run(userId, damageDealt, now);
    }

    let rewardsLogs: string[] = [];

    // Nếu tiêu diệt thành công World Boss -> Phát thưởng
    if (isDefeated) {
      rewardsLogs = this.distributeWorldBossRewards(boss.level, userId);
    }

    // Cập nhật tiến trình sự kiện weekly_boss_rush
    const activeEvents = eventService.getActiveEvents();
    const weeklyBossEvent = activeEvents.find(e => e.type === 'weekly_boss');
    if (weeklyBossEvent) {
      eventService.updateProgress(weeklyBossEvent.id, userId, damageDealt);
    }

    // Kiểm tra thành tựu world boss
    this.recordBossAttack(userId, boss.level, damageDealt);
    if (isDefeated) {
      this.recordBossKill(userId, boss.level);
    }

    return {
      success: true,
      message: isDefeated ? 'Boss Bị Tiêu Diệt!' : 'Khiêu Chiến Thành Công',
      combatResult,
      damageDealt,
      isDefeated,
      rewardsLogs
    };
  }

  /**
   * Ghi nhận lượt tấn công World Boss và cập nhật tiến trình thành tựu
   */
  public recordBossAttack(userId: string, bossLevel: number, damageDealt: number): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'boss_attack', ?, ?)"
      ).run(userId, JSON.stringify({ bossLevel, damageDealt }), now);

      const totalBossAttacks = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'boss_attack'"
      ).get(userId) as { c: number };

      achievementService.setProgress(userId, 'cd_5', totalBossAttacks.c);
      achievementService.setProgress(userId, 'cd_6', totalBossAttacks.c);
      achievementService.setProgress(userId, 'cd_7', totalBossAttacks.c);
    } catch (e) {
      console.error('[recordBossAttack Error]', e);
    }
  }

  /**
   * Ghi nhận lượt tiêu diệt World Boss và cập nhật tiến trình thành tựu
   */
  public recordBossKill(userId: string, bossLevel: number): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'boss_kill', ?, ?)"
      ).run(userId, JSON.stringify({ bossLevel }), now);

      const totalKills = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'boss_kill'"
      ).get(userId) as { c: number };

      achievementService.setProgress(userId, 'cd_8', totalKills.c);
      achievementService.setProgress(userId, 'cd_9', totalKills.c);
    } catch (e) {
      console.error('[recordBossKill Error]', e);
    }
  }

  /**
   * Phát thưởng World Boss cho tất cả người tham gia
   */
  public distributeWorldBossRewards(bossLevel: number, finalBlowerId: string): string[] {
    const participants = db.prepare(`
      SELECT user_id, damage 
      FROM world_boss_contributions 
      ORDER BY damage DESC
    `).all() as { user_id: string; damage: number }[];

    const rewardsLogs: string[] = [];
    const itemsToAdd: Array<{ userId: string; itemId: string; quantity: number }> = [];

    const rewardLevelFactor = Math.min(bossLevel, 20);

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const pUser = userRepository.get(p.user_id);
      if (!pUser) continue;

      let gainedExp = 150 * rewardLevelFactor;
      let gainedCoins = 50 * rewardLevelFactor;
      let gainedKnb = 0;
      const itemsGained: string[] = [];

      // Phân chia theo hạng đóng góp
      if (i === 0) { // Top 1
        gainedExp += 1000 * rewardLevelFactor;
        gainedCoins += 500 * rewardLevelFactor;
        gainedKnb = Math.min(5 + Math.floor(rewardLevelFactor / 2), 15);

        itemsToAdd.push({ userId: p.user_id, itemId: 'server_raid_chest', quantity: 1 });
        itemsToAdd.push({ userId: p.user_id, itemId: 'lucky_chest', quantity: 1 });
        itemsToAdd.push({ userId: p.user_id, itemId: 'pill_break_1', quantity: 2 });
        itemsGained.push('1x Rương Boss Thế Giới', '1x Rương Cơ Duyên', '2x Trúc Cơ Đan');
      } else if (i === 1) { // Top 2
        gainedExp += 500 * rewardLevelFactor;
        gainedCoins += 250 * rewardLevelFactor;
        gainedKnb = Math.min(3 + Math.floor(rewardLevelFactor / 4), 8);

        itemsToAdd.push({ userId: p.user_id, itemId: 'lucky_chest', quantity: 1 });
        itemsToAdd.push({ userId: p.user_id, itemId: 'pill_break_1', quantity: 1 });
        itemsGained.push('1x Rương Cơ Duyên', '1x Trúc Cơ Đan');
      } else if (i === 2) { // Top 3
        gainedExp += 250 * rewardLevelFactor;
        gainedCoins += 100 * rewardLevelFactor;
        gainedKnb = Math.min(1 + Math.floor(rewardLevelFactor / 6), 4);

        itemsToAdd.push({ userId: p.user_id, itemId: 'lucky_chest', quantity: 1 });
        itemsToAdd.push({ userId: p.user_id, itemId: 'pill_break_1', quantity: 1 });
        itemsGained.push('1x Rương Cơ Duyên', '1x Trúc Cơ Đan');
      } else {
        // Hạng khác: 20% cơ hội nhận Rương Cơ Duyên
        if (Math.random() < 0.2) {
          itemsToAdd.push({ userId: p.user_id, itemId: 'lucky_chest', quantity: 1 });
          itemsGained.push('1x Rương Cơ Duyên');
        }
      }

      // Thưởng kết liễu (Last Hit)
      if (p.user_id === finalBlowerId) {
        gainedCoins += 200 * rewardLevelFactor;
        const lastHitKnb = Math.min(2 + Math.floor(rewardLevelFactor / 4), 6);
        gainedKnb += lastHitKnb;
        itemsToAdd.push({ userId: p.user_id, itemId: 'server_raid_chest', quantity: 1 });
        itemsToAdd.push({ userId: p.user_id, itemId: 'pill_break_1', quantity: 1 });
        itemsGained.push('1x Rương Boss Thế Giới (Trảm Sát ⚡)', '1x Trúc Cơ Đan');
      }

      // Cập nhật tu vi, coin và KNB
      const cappedTuVi = Math.min(pUser.tu_vi + gainedExp, pUser.exp_needed);
      userRepository.update(p.user_id, {
        tu_vi: cappedTuVi,
        coin_ha_pham: pUser.coin_ha_pham + gainedCoins,
        knb: pUser.knb + gainedKnb
      });

      const actualGainedExp = cappedTuVi - pUser.tu_vi;
      if (actualGainedExp > 0) {
        bloodlineService.addExp(p.user_id, Math.floor(actualGainedExp * 0.05));
      }

      const itemsText = itemsGained.length > 0 ? ` + 🎁 [${itemsGained.join(', ')}]` : '';
      const knbText = gainedKnb > 0 ? `, +**${gainedKnb}** KNB` : '';
      rewardsLogs.push(
        `🏅 **Hạng ${i + 1}**: **${pUser.name}** (gây ${p.damage} dmg) nhận: +**${gainedExp}** Tu Vi, +**${gainedCoins}** Linh Thạch${knbText}${itemsText}`
      );
    }

    if (itemsToAdd.length > 0) {
      inventoryRepository.addMultipleItems(itemsToAdd);
    }

    return rewardsLogs;
  }

  /**
   * Giảm độ bền trang bị của người chơi sau khi chiến đấu
   * @param userId ID người chơi
   * @param combatRounds Số hiệp đã đánh
   * @param durabilityCostPerRound Lượng độ bền mất mỗi hiệp
   * @returns Danh sách tên trang bị bị giảm độ bền
   */
  public reduceDurabilityAfterCombat(userId: string, combatRounds: number, durabilityCostPerRound: number = 3): string[] {
    const affectedItems: string[] = [];
    try {
      const equipped = db.prepare(`
        SELECT i.id, i.item_id, i.durability, t.name
        FROM inventories i
        JOIN items t ON i.item_id = t.id
        WHERE i.user_id = ? AND i.is_equipped = 1
      `).all(userId) as Array<{ id: number; item_id: string; durability: number; name: string }>;

      if (equipped.length === 0) return [];

      const reduceAmount = Math.min(20, Math.max(1, combatRounds * durabilityCostPerRound));

      for (const item of equipped) {
        if (item.durability <= 0) continue; // Đã hỏng rồi
        inventoryRepository.reduceDurability(item.id, reduceAmount);
        const newDurability = Math.max(0, item.durability - reduceAmount);
        if (newDurability <= 0) {
          affectedItems.push(`💔 **${item.name}** (hỏng)`);
        } else if (newDurability <= durabilityAlertThreshold) {
          affectedItems.push(`⚠️ **${item.name}** (còn ${newDurability}/100)`);
        }
      }

      return affectedItems;
    } catch (e) {
      console.error('[reduceDurabilityAfterCombat Error]', e);
      return [];
    }
  }

  /**
   * Lấy danh sách bảng xếp hạng đóng góp World Boss hiện tại
   */
  public getBossContributions(): Array<{ name: string; damage: number; attacks: number }> {
    const list = db.prepare(`
      SELECT c.user_id, c.damage, c.attacks, u.name
      FROM world_boss_contributions c
      JOIN users u ON c.user_id = u.discord_id
      ORDER BY c.damage DESC
      LIMIT 10
    `).all() as any[];

    return list.map(item => ({
      name: item.name,
      damage: item.damage,
      attacks: item.attacks
    }));
  }
}

export const combatService = new CombatService();
