import { ChatInputCommandInteraction, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { CombatEngine } from '../../services/CombatEngine';
import { dailyQuestService } from '../../services/DailyQuestService';
import { getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

interface RoguelikeProgress {
  user_id: string;
  current_floor: number;
  max_floor: number;
  hp_percent: number;
  mp_percent: number;
  buffs: string;
  lives: number;
  last_reset_at: number;
}

interface TowerBuff {
  id: string;
  name: string;
  emoji: string;
  description: string;
  stat: 'atk' | 'def' | 'hp' | 'crit' | 'speed';
  value: number;
}

const TOWER_BUFFS: TowerBuff[] = [
  { id: 'tower_atk_15', name: 'Linh Kiếm Phù', emoji: '⚔️', description: '+15% ATK', stat: 'atk', value: 1.15 },
  { id: 'tower_def_15', name: 'Thổ Giáp Phù', emoji: '🛡️', description: '+15% DEF', stat: 'def', value: 1.15 },
  { id: 'tower_hp_20', name: 'Sinh Mệnh Phù', emoji: '❤️', description: '+20% HP', stat: 'hp', value: 1.20 },
  { id: 'tower_crit_5', name: 'Bạo Lực Phù', emoji: '🔥', description: '+5% Crit', stat: 'crit', value: 0.05 },
  { id: 'tower_speed_10', name: 'Thần Hành Phù', emoji: '💨', description: '+10% Speed', stat: 'speed', value: 1.10 },
  { id: 'tower_atk_25', name: 'Hỏa Linh Phù', emoji: '🔥', description: '+25% ATK', stat: 'atk', value: 1.25 },
  { id: 'tower_def_25', name: 'Kim Cương Phù', emoji: '💎', description: '+25% DEF', stat: 'def', value: 1.25 },
];

// BIG UPDATE §1: Thẻ Chúc Phúc — card draft after each floor
export interface TowerCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  atk?: number;
  def?: number;
  hp?: number;
  crit?: number;
  speed?: number;
  tags?: string[];
}

const CARD_POOL: TowerCard[] = [
  { id: 'card_fire_arrow',  name: 'Hỏa Tiễn',       emoji: '🏹', description: 'Đòn lửa gây thêm 15% sát thương thiêu đốt', atk: 1.10, tags: ['burn_dmg_up'] },
  { id: 'card_guardian',    name: 'Hộ Thể',          emoji: '🛡️', description: 'HP +30%', hp: 1.30 },
  { id: 'card_rebellious',  name: 'Nghịch Thiên',    emoji: '⚡', description: 'ATK +45%, HP -20%', atk: 1.45, hp: 0.80 },
  { id: 'card_berserker',   name: 'Cuồng Chiến',     emoji: '💢', description: 'ATK +25%', atk: 1.25 },
  { id: 'card_fortress',    name: 'Phòng Ngự',       emoji: '🏰', description: 'DEF +40%', def: 1.40 },
  { id: 'card_echo',        name: 'Dư Âm',            emoji: '🔊', description: 'Bạo kích +15%', crit: 0.15 },
  { id: 'card_vampire',     name: 'Hút Máu',          emoji: '🧛', description: 'Hút máu +10% (hồi 10% sát thương gây ra)', tags: ['lifesteal'] },
  { id: 'card_gambler',     name: 'Con Bạc',          emoji: '🎲', description: 'ATK +30%, DEF -15%', atk: 1.30, def: 0.85 },
  { id: 'card_immortal',    name: 'Bất Tử',           emoji: '♾️', description: 'HP +50%, ATK -20%', hp: 1.50, atk: 0.80 },
  { id: 'card_phoenix',     name: 'Phượng Hoàng',     emoji: '🦅', description: 'ATK +20%, DEF +20%', atk: 1.20, def: 1.20 },
  { id: 'card_shadow',      name: 'Hư Ảnh',           emoji: '👻', description: 'Tốc độ +25%, Né +10%', speed: 1.25, tags: ['dodge_up'] },
  { id: 'card_crystal',     name: 'Kết Tinh',         emoji: '💎', description: 'DEF +30%, Bạo kích +5%', def: 1.30, crit: 0.05 },
  { id: 'card_rage',        name: 'Phẫn Nộ',          emoji: '🔥', description: 'ATK +20%', atk: 1.20 },
  { id: 'card_tactician',   name: 'Mưu Lược',         emoji: '🧠', description: 'DEF +25%', def: 1.25 },
  { id: 'card_sanctuary',   name: 'Thánh Địa',        emoji: '🌿', description: 'HP +20%', hp: 1.20 },
];

type FloorEventType = 'shop' | 'elite' | 'chest' | 'demon' | 'spring' | 'gamble';

export interface TowerResult {
  success: boolean;
  message: string;
  embed: ContainerBuilder;
  draftCards?: TowerCard[];
}

/**
 * Tạo V2 Container hiển thị trạng thái leo tháp
 */
export function getTowerEmbed(userId: string): ContainerBuilder {
  const user = userRepository.get(userId);
  const progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;

  const floor = progress ? progress.current_floor : 1;
  const maxFloor = progress ? progress.max_floor : 1;
  const lives = progress ? progress.lives : 3;
  const hpPercent = progress ? progress.hp_percent : 1.0;

  const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1));
  const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1));
  const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1));

  const livesText = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  const hpBar = getProgressBar(Math.round(hpPercent * 100), 100, 10);

  let buffText = '';
  try {
    const buffIds: string[] = JSON.parse(progress?.buffs || '[]');
    const buffs = buffIds.map(id => TOWER_BUFFS.find(b => b.id === id)).filter(Boolean) as TowerBuff[];
    if (buffs.length > 0) {
      buffText = `\n🔮 **Buffs đang kích hoạt:** ${buffs.map(b => `${b.emoji} ${b.description}`).join(' | ')}`;
    }
  } catch(e) {}

  const isBossFloor = floor % 10 === 0;
  const isEventFloor = floor % 5 === 0 && !isBossFloor;
  const floorType = isBossFloor ? ' 👑 BOSS' : (isEventFloor ? ' ❓ Sự kiện' : '');

  const content: any[] = [
    header(`🏰 THÁP VÔ HẠN ROGUELIKE - ${user?.name || 'Không xác định'}`, 'Nơi tu sĩ leo tháp cọ xát võ học bản thân. Càng lên cao, yêu tinh thần thú càng bá đạo.'),
    separator(),
    body(
      `🏆 **Tầng Cao Nhất Đạt Được:** Tầng **${maxFloor}**\n` +
      `⚡ **Tầng Hiện Tại:** Tầng **${floor}**${floorType}\n` +
      `❤️ **Sinh Mạng Còn Lại:** ${livesText} **(${lives}/3)**\n` +
      `🩸 **Trạng Thái Sinh Lực:**\n${hpBar} **(${Math.round(hpPercent * 100)}%)**${buffText}`
    ),
    separator(),
    body(
      `👻 **Thông tin quái vật tầng ${floor}:**\n` +
      `• Sinh Lực: **${monsterHp}** HP │ Tấn Công: **${monsterAtk}** ATK │ Phòng Thủ: **${monsterDef}** DEF`
    ),
    separator(),
    body(`*Gợi ý: Tiêu hao 20 Thể Lực mỗi lần khiêu chiến hoặc reset.*`)
  ];

  return container(V2_COLORS.bloodline, content);
}

/**
 * Tạo các nút điều hướng cho Tháp Vô Hạn
 */
export function getTowerComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;
  const lives = progress ? progress.lives : 3;
  const hasLives = lives > 0;

  const btnChallenge = new ButtonBuilder()
    .setCustomId(`leothap_khieuchien_${userId}`)
    .setLabel('⚔️ Khiêu Chiến')
    .setStyle(hasLives ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(!hasLives);

  const btnReset = new ButtonBuilder()
    .setCustomId(`leothap_khoidau_${userId}`)
    .setLabel('🔄 Khởi Đầu Lại')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnChallenge, btnReset);

  return [row];
}

/**
 * Thực thi Reset tầng leo tháp
 */
export function performTowerReset(userId: string): TowerResult {
  const user = userRepository.get(userId);
  if (!user) {
    return {
      success: false,
      message: '❌ Đạo hữu chưa tạo nhân vật!',
      embed: container(V2_COLORS.danger, [header('❌ Lỗi'), body('Không tìm thấy nhân vật.')])
    };
  }

  if (user.stamina < 20) {
    return {
      success: false,
      message: `❌ Đạo hữu không đủ Thể Lực! (Cần ít nhất **20** điểm, hiện có **${user.stamina}**).`,
      embed: getTowerEmbed(userId)
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
      VALUES (?, 1, ?, 1.0, 1.0, '[]', 3, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        current_floor = 1,
        hp_percent = 1.0,
        mp_percent = 1.0,
        buffs = '[]',
        lives = 3,
        last_reset_at = excluded.last_reset_at
    `).run(userId, progress ? progress.max_floor : 1, now);

    userRepository.update(userId, { stamina: user.stamina - 20 });
  })();

  return {
    success: true,
    message: `🔄 Đạo hữu đã tiêu hao **20 Thể Lực** thiết lập lại Tháp Vô Hạn về Tầng 1!`,
    embed: getTowerEmbed(userId)
  };
}

/**
 * Thực thi Khiêu chiến tầng tiếp theo
 */
export function performTowerChallenge(userId: string): TowerResult {
  const user = userRepository.get(userId);
  if (!user) {
    return {
      success: false,
      message: '❌ Đạo hữu chưa tạo nhân vật!',
      embed: container(V2_COLORS.danger, [header('❌ Lỗi'), body('Không tìm thấy nhân vật.')])
    };
  }

  if (user.stamina < 20) {
    return {
      success: false,
      message: `❌ Đạo hữu không đủ Thể Lực! (Cần ít nhất **20** điểm, hiện có **${user.stamina}**).`,
      embed: getTowerEmbed(userId)
    };
  }

  let progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;
  const now = Math.floor(Date.now() / 1000);

  if (!progress) {
    db.prepare(`
      INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
      VALUES (?, 1, 1, 1.0, 1.0, '[]', 3, ?)
    `).run(userId, now);
    progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress;
  }

  if (progress.lives <= 0) {
    return {
      success: false,
      message: '❌ Đạo hữu đã cạn kiệt sinh mạng! Vui lòng chọn Khởi Đầu Lại.',
      embed: getTowerEmbed(userId)
    };
  }

  const activeStats = inventoryService.getActiveStats(userId);
  if (!activeStats) {
    return {
      success: false,
      message: '❌ Lỗi hệ thống: Không thể tính toán thuộc tính chiến đấu.',
      embed: getTowerEmbed(userId)
    };
  }

  const startHp = Math.max(1, Math.round(activeStats.hp * progress.hp_percent));
  const activePet = db.prepare('SELECT name, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1')
    .get(userId) as { name: string; base_atk: number } | undefined;

  let activeBuffs: TowerBuff[] = [];
  let activeCards: TowerCard[] = [];
  try {
    const buffIds: string[] = JSON.parse(progress.buffs || '[]');
    activeBuffs = buffIds.map(id => TOWER_BUFFS.find(b => b.id === id)).filter(Boolean) as TowerBuff[];
    if (activeBuffs.length > 3) activeBuffs = activeBuffs.slice(0, 3);
    activeCards = buffIds.map(id => CARD_POOL.find(c => c.id === id)).filter(Boolean) as TowerCard[];
  } catch(e) {}

  let buffAtkMult = 1.0, buffDefMult = 1.0, buffHpMult = 1.0, buffCritBonus = 0, buffSpeedMult = 1.0;
  for (const buff of activeBuffs) {
    switch (buff.stat) {
      case 'atk': buffAtkMult *= buff.value; break;
      case 'def': buffDefMult *= buff.value; break;
      case 'hp': buffHpMult *= buff.value; break;
      case 'crit': buffCritBonus += buff.value; break;
      case 'speed': buffSpeedMult *= buff.value; break;
    }
  }
  // BIG UPDATE §1: Apply card draft stat modifications
  for (const card of activeCards) {
    if (card.atk) buffAtkMult *= card.atk;
    if (card.def) buffDefMult *= card.def;
    if (card.hp) buffHpMult *= card.hp;
    if (card.crit) buffCritBonus += card.crit;
    if (card.speed) buffSpeedMult *= card.speed;
  }

  const floor = progress.current_floor;

  // Floor Event Check (mỗi 5 tầng trừ tầng Boss chia hết cho 10)
  if (floor > 1 && floor % 5 === 0 && floor % 10 !== 0) {
    const eventTypes: FloorEventType[] = ['shop', 'elite', 'chest', 'demon', 'spring', 'gamble'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    let eventMsg = '';
    let skipCombat = false;

    switch (eventType) {
      case 'spring': {
        db.prepare('UPDATE roguelike_progress SET hp_percent = 1.0 WHERE user_id = ?').run(userId);
        eventMsg = `🌿 **Suối Linh** — Đạo hữu tìm thấy suối linh thiêng, hồi phục **100% HP**!`;
        skipCombat = true;
        break;
      }
      case 'chest': {
        const availableBuffs = TOWER_BUFFS.filter(b => !activeBuffs.find(ab => ab.id === b.id));
        if (availableBuffs.length > 0 && activeBuffs.length < 3) {
          const newBuff = availableBuffs[Math.floor(Math.random() * availableBuffs.length)];
          activeBuffs.push(newBuff);
          const buffIds = activeBuffs.map(b => b.id);
          db.prepare('UPDATE roguelike_progress SET buffs = ? WHERE user_id = ?').run(JSON.stringify(buffIds), userId);
          eventMsg = `🎁 **Lễ Hộp** — Nhận **${newBuff.emoji} ${newBuff.name}** (${newBuff.description})!`;
        } else {
          const coinBonus = 50 * floor;
          userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + coinBonus });
          eventMsg = `🎁 **Lễ Hộp** — Nhận **${coinBonus}** Linh Thạch.`;
        }
        skipCombat = true;
        break;
      }
      case 'shop': {
        if (activeBuffs.length < 3) {
          const freeBuff = TOWER_BUFFS[Math.floor(Math.random() * TOWER_BUFFS.length)];
          activeBuffs.push(freeBuff);
          const buffIds = activeBuffs.map(b => b.id);
          db.prepare('UPDATE roguelike_progress SET buffs = ? WHERE user_id = ?').run(JSON.stringify(buffIds), userId);
          eventMsg = `🏪 **Tiệm Tỳ Bà** — Nhận **${freeBuff.emoji} ${freeBuff.name}** (${freeBuff.description})!`;
        } else {
          eventMsg = `🏪 **Tiệm Tỳ Bà** — Đầy chỗ chứa Buff.`;
        }
        skipCombat = true;
        break;
      }
      case 'gamble': {
        const betAmount = Math.min(200 * floor, user.coin_ha_pham);
        if (betAmount <= 0) {
          eventMsg = `🎲 **Cờ Tỷ Phú** — Không đủ Linh Thạch để cược.`;
        } else if (Math.random() < 0.5) {
          userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + betAmount });
          eventMsg = `🎲 **Cờ Tỷ Phú** — Thắng lớn! +**${betAmount}** Linh Thạch!`;
        } else {
          userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - betAmount });
          eventMsg = `🎲 **Cờ Tỷ Phú** — Thua cược! Hao hụt **-${betAmount}** Linh Thạch!`;
        }
        skipCombat = true;
        break;
      }
      case 'elite': {
        eventMsg = `⚔️ **Thử Thách Bí Ẩn** — Đụng độ Oan Linh Elite! Phần thưởng x3!`;
        break;
      }
      case 'demon': {
        eventMsg = `💀 **Nội Ma** — Tâm Ma quấy quắt tâm trí!`;
        break;
      }
    }

    if (skipCombat) {
      db.transaction(() => {
        userRepository.update(userId, { stamina: user.stamina - 20 });
        db.prepare('UPDATE roguelike_progress SET current_floor = current_floor + 1 WHERE user_id = ?').run(userId);
      })();

      return {
        success: true,
        message: eventMsg,
        embed: container(V2_COLORS.info, [
          header('❓ SỰ KIỆN PHÒNG THÁP'),
          body(eventMsg)
        ])
      };
    }
  }

  const isBossFloor = floor % 10 === 0;
  const isEliteEvent = (floor % 5 === 0 && !isBossFloor);
  const monsterScale = isBossFloor ? 3.0 : (isEliteEvent ? 1.5 : 1.0);
  const rewardScale = isBossFloor ? 3.0 : (isEliteEvent ? 3.0 : 1.0);
  const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1) * monsterScale);
  const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1) * monsterScale);
  const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1) * monsterScale);

  // BIG UPDATE §1: Weekly theme element rotation (based on UTC week number)
  const WEEKLY_ELEMENTS = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ', 'Lôi', 'Phong'];
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const themeElement = WEEKLY_ELEMENTS[weekNumber % WEEKLY_ELEMENTS.length];

  // BIG UPDATE §1: Floor 50+ environment effect
  // ponytail: only one environment type implemented; expand to 5+ for full feature
  const environmentLabel = floor >= 50 ? '🌑 **Môi Trường: Hút Linh** — Mất 3% HP mỗi hiệp' : '';

  // BIG UPDATE §1: Card tag effects on combatant
  const cardLifesteal = activeCards.some(c => c.tags?.includes('lifesteal')) ? 0.10 : 0;
  const cardDodgeBonus = activeCards.some(c => c.tags?.includes('dodge_up')) ? 0.10 : 0;
  // ponytail: burn_dmg_up tag not wired into combat engine yet

  const playerCombatant = {
    name: user.name,
    hp: startHp,
    maxHp: Math.round(activeStats.hp * buffHpMult),
    atk: Math.round(activeStats.atk * buffAtkMult),
    def: Math.round(activeStats.def * buffDefMult),
    crit: activeStats.crit + buffCritBonus,
    critRes: activeStats.critRes,
    luck: activeStats.luck,
    linhCan: user.linh_can,
    dodge: (activeStats as any).dodge ?? 0.05 + cardDodgeBonus,
    cardLifesteal: cardLifesteal || undefined,
  };

  const enemyName = isBossFloor
    ? `Oán Linh Tháp Chủ - Tầng ${floor} 👑`
    : `Oán Linh Tháp Chủ - Tầng ${floor} 👻`;

  const enemyCombatant = {
    name: enemyName,
    hp: monsterHp,
    maxHp: monsterHp,
    atk: monsterAtk,
    def: monsterDef,
    crit: 0.05 + floor * 0.002,
    critRes: 0.01 + floor * 0.001,
    luck: 10,
    element: themeElement, // BIG UPDATE §1: Weekly theme element
    environmentDrain: floor >= 50 ? 0.03 : undefined, // ponytail: only one environment type for now
  };

  const combatResult = CombatEngine.run(
    playerCombatant,
    enemyCombatant,
    activePet ? { name: activePet.name, atk: activePet.base_atk } : null,
    30
  );

  const isWin = combatResult.winner === 'player';
  let desc = '';
  let accentColor: number = V2_COLORS.success;

  if (isWin) {
    const endingHpPercent = Math.min(1.0, combatResult.playerEndingHp / activeStats.hp);

    let sectBonusMultiplier = 1.0;
    if (user.sect_id) {
      const sect = db.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id) as any;
      if (sect) {
        try {
          const b = JSON.parse(sect.buildings || '{}');
          if (b.tangkinhcac) sectBonusMultiplier += b.tangkinhcac * 0.02;
        } catch(e){}
      }
    }
    const expGained = Math.round(50 * floor * sectBonusMultiplier * rewardScale);
    const coinGained = Math.round(10 * floor * rewardScale);

    const cappedNewTuVi = Math.min(user.tu_vi + expGained, user.exp_needed);
    const actualGainedExp = cappedNewTuVi - user.tu_vi;
    const newMaxFloor = Math.max(progress.max_floor, floor);

    db.transaction(() => {
      db.prepare(`
        UPDATE roguelike_progress
        SET current_floor = current_floor + 1,
            max_floor = ?,
            hp_percent = ?
        WHERE user_id = ?
      `).run(newMaxFloor, endingHpPercent, userId);

      userRepository.update(userId, {
        stamina: user.stamina - 20,
        tu_vi: cappedNewTuVi,
        coin_ha_pham: user.coin_ha_pham + coinGained
      });

      if (Math.random() < 0.20) {
        inventoryRepository.addItem(userId, ITEMS.ITEM_FRAGMENT, 1);
      }
    })();

    dailyQuestService.updateProgress(userId, 'daily_leothap', 1);

    try {
      const activeSeason = db.prepare("SELECT id FROM tower_seasons WHERE status = 'active' AND end_time > ?").get(now) as { id: number } | undefined;
      if (activeSeason) {
        const existingScore = db.prepare('SELECT * FROM tower_season_scores WHERE user_id = ? AND season_id = ?').get(userId, activeSeason.id) as any;
        if (existingScore) {
          const newBestFloor = Math.max(existingScore.best_floor, floor + 1);
          db.prepare('UPDATE tower_season_scores SET best_floor = ?, total_floors_cleared = total_floors_cleared + 1 WHERE user_id = ? AND season_id = ?')
            .run(newBestFloor, userId, activeSeason.id);
        } else {
          db.prepare('INSERT INTO tower_season_scores (user_id, season_id, best_floor, total_floors_cleared) VALUES (?, ?, ?, 1)')
            .run(userId, activeSeason.id, floor + 1);
        }
      }
    } catch(e) {}

    let artifactMsg = '';
    const artifactExp = Math.round(expGained * 0.1);
    const artifactRes = inventoryService.addArtifactExp(userId, artifactExp);
    if (artifactRes && artifactRes.message) {
      artifactMsg = `\n• ${artifactRes.message}`;
    }

    desc = `Đạo hữu đã đả bại thành công **${enemyCombatant.name}**!\n\n` +
           `📊 **Thông số sau hiệp đấu:**\n` +
           `• Sinh lực mang đi tiếp: **${Math.round(endingHpPercent * 100)}%** HP ❤️\n` +
           `• Tu vi nhận thức: **+${actualGainedExp}** Tu Vi 🌿\n` +
           `• Linh thạch nhặt được: **+${coinGained}** Linh Thạch 🟤\n` +
           `• Thể lực hao tổn: **-20** Thể Lực ⚡ (Còn lại: **${user.stamina - 20}/500**)${artifactMsg}\n\n` +
           `👉 Đạo hữu đã sẵn sàng bước tiếp lên **Tầng ${floor + 1}**!`;
  } else {
    accentColor = V2_COLORS.danger;
    const newLives = progress.lives - 1;
    const finalHpPercent = newLives > 0 ? 1.0 : 0.0;

    db.transaction(() => {
      db.prepare(`
        UPDATE roguelike_progress
        SET lives = ?,
            hp_percent = ?
        WHERE user_id = ?
      `).run(newLives, finalHpPercent, userId);

      userRepository.update(userId, { stamina: user.stamina - 20 });
    })();

    if (newLives > 0) {
      desc = `Đạo hữu tử trận tại tầng **${floor}**!\n\n` +
             `• Sát thương oán khí bạo liệt, đạo hữu hao tổn **-1 sinh mạng** (Còn lại **${newLives}/3** mạng).\n` +
             `• Trừ **-20 Thể Lực** ⚡ (Còn lại: **${user.stamina - 20}/500**).\n\n` +
             `✨ *Linh thể tự động được tái tạo đầy 100% HP. Đạo hữu có thể khiêu chiến lại tầng này!*`;
    } else {
      desc = `Đạo hữu đã cạn kiệt sinh mạng tại tầng **${floor}**!\n\n` +
             `• Trừ **-20 Thể Lực** ⚡.\n` +
             `💀 *Đạo hữu bị đẩy văng ra khỏi chân tháp. Hãy thiết lập run mới từ Tầng 1.*`;
    }
  }

  // BIG UPDATE §1: Generate card draft options on win
  let draftCards: TowerCard[] | undefined;
  if (isWin) {
    const existingCardIds: string[] = [];
    try { existingCardIds.push(...(JSON.parse(progress.buffs || '[]') as string[]).filter(id => CARD_POOL.some(c => c.id === id))); } catch {}
    const available = CARD_POOL.filter(c => !existingCardIds.includes(c.id));
    if (available.length > 0 && existingCardIds.length < 7) {
      const pool = [...available].sort(() => Math.random() - 0.5);
      const pick: TowerCard[] = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        pick.push(pool[i]);
      }
      draftCards = pick;
      desc += `\n\n🎴 **Chọn 1 Thẻ Chúc Phúc** bên dưới để tăng cường sức mạnh!`;
    }
  }

  return {
    success: isWin,
    message: isWin ? 'Thắng' : 'Thua',
    embed: container(accentColor, [
      header(isWin ? `🏆 CHIẾN THẮNG TẦNG ${floor}` : `💀 THẤT BẠI TẦNG ${floor}`),
      body(desc)
    ]),
    draftCards
  };
}

/**
 * BIG UPDATE §1: Apply a selected card to tower progress
 */
export function selectTowerCard(userId: string, cardId: string): TowerResult {
  const progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;
  if (!progress) {
    return { success: false, message: 'Không có dữ liệu tháp!', embed: container(V2_COLORS.danger, [header('❌ Lỗi'), body('Chưa có dữ liệu leo tháp.')]) };
  }
  const card = CARD_POOL.find(c => c.id === cardId);
  if (!card) {
    return { success: false, message: 'Thẻ không hợp lệ!', embed: container(V2_COLORS.danger, [header('❌ Lỗi'), body('Không tìm thấy thẻ chúc phúc.')]) };
  }
  const buffs: string[] = JSON.parse(progress.buffs || '[]');
  if (buffs.includes(cardId)) {
    return { success: false, message: 'Đã có thẻ này!', embed: container(V2_COLORS.danger, [header('❌ Lỗi'), body('Đạo hữu đã có thẻ chúc phúc này rồi.')]) };
  }
  buffs.push(cardId);
  db.prepare('UPDATE roguelike_progress SET buffs = ? WHERE user_id = ?').run(JSON.stringify(buffs), userId);
  return {
    success: true,
    message: `Đã chọn thẻ ${card.emoji} ${card.name}`,
    embed: container(V2_COLORS.success, [
      header(`🎴 NHẬN THẺ CHÚC PHÚC`),
      body(`Đạo hữu đã nhận được thẻ **${card.emoji} ${card.name}**: ${card.description}\n\n👉 Hãy tiếp tục chinh phục Tháp Vô Tận!`)
    ])
  };
}

export default class LeoThapCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('leothap')
        .setDescription('Khiêu chiến Tháp Vô Hạn (Roguelike) kiểm thử thực lực tu sĩ.')
        .addSubcommand(sub =>
          sub
            .setName('trangthai')
            .setDescription('Xem trạng thái leo tháp và tầng cao nhất đã đạt.')
        )
        .addSubcommand(sub =>
          sub
            .setName('khieu-chien')
            .setDescription('Tiến vào khiêu chiến tầng tiếp theo (Tiêu hao 20 Thể Lực).')
        )
        .addSubcommand(sub =>
          sub
            .setName('khoi-dau')
            .setDescription('Reset quá trình về Tầng 1 với 3 mạng mới (Tiêu hao 20 Thể Lực).')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'trangthai') {
      const embed = getTowerEmbed(userId);
      const comps = getTowerComponents(userId);
      await interaction.editReply(toV2Payload([embed], comps));
      return;
    }

    if (sub === 'khoi-dau') {
      const res = performTowerReset(userId);
      const comps = getTowerComponents(userId);
      await interaction.editReply(toV2Payload([res.embed], comps));
      return;
    }

    if (sub === 'khieu-chien') {
      const res = performTowerChallenge(userId);
      const comps = getTowerComponents(userId);
      await interaction.editReply(toV2Payload([res.embed], comps));
    }
  }
}
