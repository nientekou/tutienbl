import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryService } from '../../services/InventoryService';
import { CombatEngine } from '../../services/CombatEngine';
import { achievementService } from '../../services/AchievementService';
import { encounterService } from '../../services/EncounterService';
import { leylineService } from '../../services/LeylineService';
import { getProgressBar } from '../../utils/constants';
import db from '../../database/database';
import { PET_SKILLS } from './sungthu';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

interface WildMonster {
  name: string;
  templateId: string;
  hp: number;
  atk: number;
  def: number;
  expReward: number;
  coinRewardMin: number;
  coinRewardMax: number;
  captureRate: number;
  rarity: string;
  petBaseHp: number;
  petBaseAtk: number;
  petBaseDef: number;
}

export interface HuntResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
  encounter?: any;
  combatLog?: string[];
}

/**
 * Thực thi săn yêu thú cho đạo hữu (được dùng từ cả lệnh và button hoso)
 */
export function performHunt(userId: string): HuntResult {
  // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
  const { cultivationService } = require('../../services/CultivationService');
  cultivationService.claimIdleCultivation(userId);

  const user = userRepository.get(userId);
  if (!user) {
    return { success: false, message: '❌ Đạo hữu chưa tạo nhân vật!' };
  }
  let rolledEncounter: any = null;

  // Kiểm tra Thể Lực
  // Mount stamina save bonus
  const activeMount = db.prepare('SELECT stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(userId) as any;
  const mountStaminaSave = activeMount?.stamina_save || 0;
  const staminaCost = Math.max(5, Math.round(15 * (1 - mountStaminaSave)));

  if (user.stamina < staminaCost) {
    return {
      success: false,
      message: `❌ Đạo hữu đã cạn kiệt Thể Lực! (Săn bắn yêu thú cần ít nhất **15** điểm, hiện có **${user.stamina}**). Hãy nghỉ ngơi hoặc dùng đan dược hồi phục!`
    };
  }

  const activeStats = inventoryService.getActiveStats(userId);
  if (!activeStats) {
    return { success: false, message: '❌ Không thể tính toán thuộc tính chiến đấu của đạo hữu.' };
  }

  const petRaw = db.prepare('SELECT name, base_atk, level, skills, mutations FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId) as any;
  let activePet = undefined;
  if (petRaw) {
    let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
    try { mutations = JSON.parse(petRaw.mutations || '{}'); } catch(e){}
    let skills: string[] = [];
    try { skills = JSON.parse(petRaw.skills || '[]'); } catch(e){}
    activePet = { 
      name: petRaw.name, 
      atk: petRaw.base_atk + (mutations.bonus_atk || 0),
      level: petRaw.level,
      skills: skills
    };
  }

  // Chọn ngẫu nhiên quái vật theo cảnh giới người chơi
  let monster: WildMonster;

  const randSpecial = Math.random();
  if (randSpecial < 0.005) { // 0.5% Kỳ Lân Bạch Ngọc
    monster = {
      name: 'Kỳ Lân Bạch Ngọc 🦄',
      templateId: 'pet_qilin',
      hp: 15000, atk: 700, def: 400,
      expReward: 3500, coinRewardMin: 1200, coinRewardMax: 2500,
      captureRate: 0.03, rarity: 'legendary',
      petBaseHp: 3500, petBaseAtk: 250, petBaseDef: 120
    };
  } else if (randSpecial < 0.010) { // 0.5% Côn Bằng Tiên Thú
    monster = {
      name: 'Côn Bằng Tiên Thú 🦅',
      templateId: 'pet_kun_pen',
      hp: 14000, atk: 750, def: 350,
      expReward: 3200, coinRewardMin: 1100, coinRewardMax: 2200,
      captureRate: 0.03, rarity: 'legendary',
      petBaseHp: 3200, petBaseAtk: 280, petBaseDef: 100
    };
  } else if (randSpecial < 0.020) { // 1.0% Thao Thiết
    monster = {
      name: 'Thao Thiết Cổ Thú 🐉',
      templateId: 'pet_taotie',
      hp: 18000, atk: 650, def: 500,
      expReward: 3000, coinRewardMin: 1000, coinRewardMax: 2000,
      captureRate: 0.03, rarity: 'legendary',
      petBaseHp: 4000, petBaseAtk: 220, petBaseDef: 150
    };
  } else if (randSpecial < 0.035) { // 1.5% Hắc Long Tử
    monster = {
      name: 'Hắc Long Tử 🐲',
      templateId: 'pet_black_dragon',
      hp: 8000, atk: 500, def: 250,
      expReward: 2000, coinRewardMin: 600, coinRewardMax: 1200,
      captureRate: 0.06, rarity: 'epic',
      petBaseHp: 2000, petBaseAtk: 160, petBaseDef: 90
    };
  } else if (randSpecial < 0.055) { // 2.0% Phượng Hoàng Lửa
    monster = {
      name: 'Phượng Hoàng Lửa 🦩',
      templateId: 'pet_fire_phoenix',
      hp: 9000, atk: 480, def: 220,
      expReward: 2200, coinRewardMin: 650, coinRewardMax: 1300,
      captureRate: 0.06, rarity: 'epic',
      petBaseHp: 2200, petBaseAtk: 150, petBaseDef: 85
    };
  } else if (randSpecial < 0.085) { // 3.0% Cửu Thiên Huyền Điểu
    monster = {
      name: 'Cửu Thiên Huyền Điểu 🐦',
      templateId: 'pet_sky_bird',
      hp: 2000, atk: 150, def: 80,
      expReward: 500, coinRewardMin: 100, coinRewardMax: 300,
      captureRate: 0.12, rarity: 'rare',
      petBaseHp: 800, petBaseAtk: 60, petBaseDef: 30
    };
  } else if (randSpecial < 0.125) { // 4.0% Thiên Hồ Cửu Vĩ
    monster = {
      name: 'Thiên Hồ Cửu Vĩ 🦊',
      templateId: 'pet_nine_tail',
      hp: 2200, atk: 140, def: 85,
      expReward: 550, coinRewardMin: 110, coinRewardMax: 320,
      captureRate: 0.12, rarity: 'rare',
      petBaseHp: 750, petBaseAtk: 65, petBaseDef: 35
    };
  } else if (randSpecial < 0.130) { // 0.5% Thần Thú Kỳ Lân (cũ)
    monster = {
      name: 'Thần Thú Kỳ Lân 🦄',
      templateId: 'kylan',
      hp: 12000, atk: 600, def: 350,
      expReward: 3000, coinRewardMin: 1000, coinRewardMax: 2000,
      captureRate: 0.03, rarity: 'legendary',
      petBaseHp: 3000, petBaseAtk: 200, petBaseDef: 100
    };
  } else if (randSpecial < 0.140) { // 1.0% Hỏa Phượng Hoàng
    monster = {
      name: 'Hỏa Phượng Hoàng 🦚',
      templateId: 'phuonghoang',
      hp: 10000, atk: 550, def: 300,
      expReward: 2500, coinRewardMin: 800, coinRewardMax: 1500,
      captureRate: 0.04, rarity: 'legendary',
      petBaseHp: 2500, petBaseAtk: 220, petBaseDef: 80
    };
  } else if (randSpecial < 0.155) { // 1.5% Tỳ Hưu Chiêu Tài
    monster = {
      name: 'Tỳ Hưu Chiêu Tài 🦁',
      templateId: 'tyhuu',
      hp: 6000, atk: 400, def: 200,
      expReward: 1500, coinRewardMin: 500, coinRewardMax: 1000,
      captureRate: 0.08, rarity: 'epic',
      petBaseHp: 1500, petBaseAtk: 120, petBaseDef: 60
    };
  } else if (randSpecial < 0.175) { // 2.0% Linh Khuyển Chó Đỏ
    monster = {
      name: 'Linh Khuyển Chó Đỏ 🐕',
      templateId: 'chodo',
      hp: 600, atk: 55, def: 35,
      expReward: 500, coinRewardMin: 100, coinRewardMax: 300,
      captureRate: 0.15, rarity: 'epic',
      petBaseHp: 600, petBaseAtk: 65, petBaseDef: 40
    };
  } else if (user.level <= 38) {
    // Luyện Khí
    const pool: WildMonster[] = [
      { name: 'U Linh Thử 🐭', templateId: 'chuot', hp: 80, atk: 12, def: 5, expReward: 25, coinRewardMin: 10, coinRewardMax: 20, captureRate: 0.30, rarity: 'common', petBaseHp: 60, petBaseAtk: 10, petBaseDef: 5 },
      { name: 'Thiết Nhận Thỏ 🐰', templateId: 'tho', hp: 100, atk: 15, def: 6, expReward: 30, coinRewardMin: 12, coinRewardMax: 22, captureRate: 0.30, rarity: 'common', petBaseHp: 75, petBaseAtk: 12, petBaseDef: 6 },
      { name: 'Tiểu Hoa Miêu 🐱', templateId: 'meo', hp: 120, atk: 18, def: 7, expReward: 35, coinRewardMin: 15, coinRewardMax: 25, captureRate: 0.30, rarity: 'common', petBaseHp: 90, petBaseAtk: 15, petBaseDef: 7 }
    ];
    monster = pool[Math.floor(Math.random() * pool.length)];
  } else if (user.level <= 76) {
    // Trúc Cơ
    const pool: WildMonster[] = [
      { name: 'Tật Phong Lang 🐺', templateId: 'lang', hp: 800, atk: 75, def: 45, expReward: 180, coinRewardMin: 50, coinRewardMax: 100, captureRate: 0.15, rarity: 'rare', petBaseHp: 450, petBaseAtk: 45, petBaseDef: 25 },
      { name: 'Hỏa Nham Trư 🐗', templateId: 'heo', hp: 1000, atk: 85, def: 55, expReward: 210, coinRewardMin: 60, coinRewardMax: 120, captureRate: 0.15, rarity: 'rare', petBaseHp: 550, petBaseAtk: 40, petBaseDef: 35 },
      { name: 'Kim Sí Ưng 🦅', templateId: 'daibang', hp: 1200, atk: 95, def: 65, expReward: 250, coinRewardMin: 70, coinRewardMax: 140, captureRate: 0.15, rarity: 'rare', petBaseHp: 500, petBaseAtk: 50, petBaseDef: 20 }
    ];
    monster = pool[Math.floor(Math.random() * pool.length)];
  } else {
    // Kim Đan
    const pool: WildMonster[] = [
      { name: 'Thanh Minh Hổ 🐯', templateId: 'ho', hp: 4000, atk: 280, def: 180, expReward: 1000, coinRewardMin: 200, coinRewardMax: 400, captureRate: 0.05, rarity: 'legendary', petBaseHp: 2000, petBaseAtk: 150, petBaseDef: 80 },
      { name: 'Xích Diễm Hầu 🐵', templateId: 'khi', hp: 4500, atk: 300, def: 190, expReward: 1200, coinRewardMin: 220, coinRewardMax: 450, captureRate: 0.05, rarity: 'legendary', petBaseHp: 1800, petBaseAtk: 165, petBaseDef: 75 },
      { name: 'Băng Hồn Hồ 🦊', templateId: 'cao', hp: 5000, atk: 320, def: 200, expReward: 1400, coinRewardMin: 250, coinRewardMax: 500, captureRate: 0.05, rarity: 'legendary', petBaseHp: 1500, petBaseAtk: 180, petBaseDef: 70 }
    ];
    monster = pool[Math.floor(Math.random() * pool.length)];
  }

  const playerCombatant = {
    name: user.name,
    hp: activeStats.hp,
    maxHp: activeStats.hp,
    atk: activeStats.atk,
    def: activeStats.def,
    crit: activeStats.crit,
    critRes: activeStats.critRes,
    luck: activeStats.luck,
    linhCan: user.linh_can
  };

  const enemyCombatant = {
    name: monster.name,
    hp: monster.hp,
    maxHp: monster.hp,
    atk: monster.atk,
    def: monster.def,
    crit: 0.05,
    critRes: 0.01,
    luck: 10
  };

  const combatResult = CombatEngine.run(
    playerCombatant,
    enemyCombatant,
    activePet ? { name: activePet.name, atk: activePet.atk, skills: activePet.skills } : null,
    30
  );

  const isWin = combatResult.winner === 'player';
  const embed = new EmbedBuilder().setTimestamp();

  if (isWin) {
    let goldMultiplier = 1.0;
    if (activePet && activePet.skills && activePet.skills.includes('gold_blessing')) {
      goldMultiplier = 1.1; // +10% coins
    }
    const coinEarned = Math.round((Math.floor(Math.random() * (monster.coinRewardMax - monster.coinRewardMin + 1)) + monster.coinRewardMin) * goldMultiplier);
    let sectBonusPercent = 0;
    if (user.sect_id) {
      const sect = db.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id) as any;
      if (sect) {
        try {
          const b = JSON.parse(sect.buildings || '{}');
          if (b.tangkinhcac) sectBonusPercent += b.tangkinhcac * 2; // +2% mỗi cấp
        } catch(e){}
      }
    }
    const sectBonusMultiplier = 1 + (sectBonusPercent / 100);
    const expEarned = Math.round(monster.expReward * sectBonusMultiplier);


    const cappedNewTuVi = Math.min(user.tu_vi + expEarned, user.exp_needed);
    const actualGainedExp = cappedNewTuVi - user.tu_vi;

    let petLevelUpMsg = '';
    
    db.transaction(() => {
      userRepository.update(userId, {
        stamina: user.stamina - staminaCost,
        tu_vi: cappedNewTuVi,
        coin_ha_pham: user.coin_ha_pham + coinEarned
      });

      // Cộng EXP cho sủng vật xuất chiến
      const activePet = db.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(userId) as any;
      if (activePet) {
        const petExpGained = Math.round(expEarned * 0.2); // Sủng thú nhận 20% EXP
        let newPetExp = activePet.exp + petExpGained;
        let newPetLevel = activePet.level;
        let newPetHp = activePet.base_hp;
        let newPetAtk = activePet.base_atk;
        let newPetDef = activePet.base_def;
        let newPetRarity = activePet.rarity;
        let newPetName = activePet.name;
        let newPetSkills = [];
        try { newPetSkills = JSON.parse(activePet.skills || '[]'); } catch (e) {}
        
        let expNeeded = newPetLevel * 100;
        let leveledUp = false;
        
        while (newPetExp >= expNeeded) {
          newPetExp -= expNeeded;
          newPetLevel++;
          newPetHp += 20;
          newPetAtk += 5;
          newPetDef += 3;
          leveledUp = true;
          expNeeded = newPetLevel * 100;

          // Tiến hóa tại cấp 50 (10% lên Epic)
          if (newPetLevel === 50 && newPetRarity === 'rare') {
            if (Math.random() < 0.10) {
              newPetRarity = 'epic';
              newPetName = `Tiên ${newPetName}`;
              newPetHp += 200;
              newPetAtk += 50;
              newPetDef += 30;
              petLevelUpMsg += `\n🌟 **Đột Biến Tiến Hóa:** **${activePet.name}** đã tiến hóa lên phẩm chất **EPIC**! Đổi tên thành **${newPetName}**!`;
            }
          }

          // Mở khóa passive cấp 30
          if (newPetLevel === 30 && newPetSkills.length < 3) {
            const lockedKeys = Object.keys(PET_SKILLS).filter(k => !newPetSkills.includes(k));
            if (lockedKeys.length > 0) {
              const newSkill = lockedKeys[Math.floor(Math.random() * lockedKeys.length)];
              newPetSkills.push(newSkill);
              const skDetails = PET_SKILLS[newSkill];
              petLevelUpMsg += `\n✨ **Thức Tỉnh Passive (Cấp 30):** Khai phá kỹ năng **${skDetails?.name || newSkill}**!`;
            }
          }
        }

        db.prepare(`
          UPDATE pets 
          SET exp = ?, level = ?, base_hp = ?, base_atk = ?, base_def = ?, rarity = ?, name = ?, skills = ?
          WHERE id = ?
        `).run(newPetExp, newPetLevel, newPetHp, newPetAtk, newPetDef, newPetRarity, newPetName, JSON.stringify(newPetSkills), activePet.id);

        if (leveledUp) {
          petLevelUpMsg = `\n\n🐾 **${newPetName}** tăng lên cấp **${newPetLevel}**! (+${petExpGained} EXP)${petLevelUpMsg}`;
        } else {
          petLevelUpMsg = `\n\n🐾 **${newPetName}** nhận **+${petExpGained}** EXP (${newPetExp}/${expNeeded}).`;
        }
      }
    })();

    let isCaptured = false;
    const rollCapture = Math.random();
    if (rollCapture < monster.captureRate) {
      isCaptured = true;
      const gender = Math.random() < 0.5 ? 0 : 1;
      const now = Math.floor(Date.now() / 1000);
      
      let petSkills = '[]';
      if (monster.templateId === 'pet_qilin') petSkills = JSON.stringify(['qilin_heal']);
      else if (monster.templateId === 'pet_kun_pen') petSkills = JSON.stringify(['kunpen_hp']);
      else if (monster.templateId === 'pet_taotie') petSkills = JSON.stringify(['taotie_def']);
      else if (monster.templateId === 'pet_black_dragon') petSkills = JSON.stringify(['dragon_berserk']);
      else if (monster.templateId === 'pet_fire_phoenix') petSkills = JSON.stringify(['phoenix_rebirth']);
      else if (monster.templateId === 'pet_sky_bird') petSkills = JSON.stringify(['sky_agile']);
      else if (monster.templateId === 'pet_nine_tail') petSkills = JSON.stringify(['nine_charm']);
      else if (monster.templateId === 'kylan') petSkills = JSON.stringify(['qilin_fortune']);
      else if (monster.templateId === 'phuonghoang') petSkills = JSON.stringify(['reborn_flame']);
      else if (monster.templateId === 'tyhuu') petSkills = JSON.stringify(['gold_blessing']);

      db.prepare(`
        INSERT INTO pets (user_id, name, template_id, rarity, base_hp, base_atk, base_def, level, exp, is_deployed, gender, created_at, skills)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?)
      `).run(
        userId,
        monster.name.split(' ')[0],
        monster.templateId,
        monster.rarity,
        monster.petBaseHp,
        monster.petBaseAtk,
        monster.petBaseDef,
        gender,
        now,
        petSkills
      );

      // Kiểm tra thành tựu sủng thú sau khi bắt
      checkPetAchievements(userId, monster.rarity);
    }

    const goldBonusText = goldMultiplier > 1.0 ? ` *(Tỳ Hưu Chiêu Tài hộ hộ: +10% Linh Thạch)*` : '';

    let artifactMsg = '';
    const artifactExp = Math.round(expEarned * 0.1);
    const { inventoryService } = require('../../services/InventoryService');
    const artifactRes = inventoryService.addArtifactExp(userId, artifactExp);
    if (artifactRes && artifactRes.message) {
      artifactMsg = `\n\n${artifactRes.message}`;
    }

    embed.setTitle(`🌲 CHIẾN THẮNG DÃ NGOẠI - ĐẢ THẢO TIỂU ĐIỀN`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setDescription(
        `Đạo hữu đã thảo phạt thành công **${monster.name}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
        `🌿 **Tu vi cộng hưởng:** **+${actualGainedExp}** Tu Vi\n` +
        `${getProgressBar(cappedNewTuVi, user.exp_needed, 10)} *(${cappedNewTuVi}/${user.exp_needed})*\n\n` +
        `🟤 **Linh thạch nhặt được:** **+${coinEarned}** Hạ Phẩm Linh Thạch${goldBonusText}\n\n` +
        `⚡ **Thể lực hao tổn:** **-${staminaCost}** Thể Lực *(Còn lại: ${user.stamina - staminaCost}/500)*\n` +
        `${getProgressBar(user.stamina - staminaCost, 500, 10)}` +
        artifactMsg +
        petLevelUpMsg
      );

    if (isCaptured) {
      embed.addFields({
        name: '🎉 CƠ DUYÊN THU PHỤC LINH THÚ 🎉',
        value: `Linh khí hội tụ, yêu thú **${monster.name}** cảm phục trước thần uy của đạo hữu, cam tâm tình nguyện đi theo hộ vệ! Đã lưu sủng vật vào Tàng Thú Các (\`/sungthu danhsach\`).`
      });
    } else {
      embed.setFooter({ text: 'Mách nhỏ: Linh thú sau khi bị đánh bại đã chấn kinh chạy mất dạng.' });
    }

    // Kiểm tra Kỳ Ngộ (10%)
    rolledEncounter = encounterService.rollEncounter('sanyeuthu');
    if (rolledEncounter) {
      embed.addFields({
        name: `🌟 Kỳ Ngộ: ${rolledEncounter.title}`,
        value: `${rolledEncounter.description}\n\n**Lựa chọn:**\n${rolledEncounter.choices.map((c: any, i: number) => `**${i + 1}.** ${c.text} (${Math.round(c.successRate * 100)}% thành công)`).join('\n')}`,
      });
    }

    // Cơ hội bắt Tọa Kỵ (5%)
    if (Math.random() < 0.05) {
      const mountTemplates = [
        { id: 'mount_phong_ma', name: 'Phong Mã', rarity: 'common', speed: 0.02, stamina: 0.01 },
        { id: 'mount_tuyet_ung', name: 'Tuyết Ưng', rarity: 'uncommon', speed: 0.04, stamina: 0.02 },
        { id: 'mount_huyen_vo', name: 'Huyền Vũ', rarity: 'rare', speed: 0.07, stamina: 0.04 },
      ];
      const tmpl = mountTemplates[Math.floor(Math.random() * mountTemplates.length)];
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, created_at)
        VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)
      `).run(userId, tmpl.name, tmpl.id, tmpl.rarity, tmpl.speed, tmpl.stamina, now);
      embed.addFields({
        name: '🐎 CƠ DUYÊN THU PHỤC TỌA KỴ!',
        value: `Đạo hữu đã thu phục được **${tmpl.name}** [${tmpl.rarity.toUpperCase()}]! Dùng \`/toaky danhsach\` để xem chi tiết.`,
      });
    }
  } else {
    db.transaction(() => {
      userRepository.update(userId, { stamina: user.stamina - staminaCost });
    })();

    embed.setTitle(`💀 THẤT BẠI DÃ NGOẠI`)
      .setColor(EMBED_COLORS.ERROR)
      .setDescription(
        `Đạo hữu cự địch bất thành, kiệt sức tháo lui trước sức mạnh hoang dại của **${monster.name}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
        `⚡ **Thể lực hao tổn:** **-${staminaCost}** Thể Lực *(Còn lại: ${user.stamina - staminaCost}/500)*\n` +
        `${getProgressBar(user.stamina - staminaCost, 500, 10)}\n\n` +
        `💡 *Lời khuyên: Tĩnh tọa tu luyện tăng cấp, tẩy tủy linh căn hoặc trang bị giáp mạnh trước khi phục thù.*`
      );
  }

  // Ghi log săn yêu thú và cập nhật thành tựu
  try {
    const nowLog = Math.floor(Date.now() / 1000);
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'hunt', ?, ?)"
    ).run(userId, JSON.stringify({ monsterName: monster.name, win: isWin }), nowLog);

    // Cập nhật tiến trình thành tựu
    const totalHunts = db.prepare(
      "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'hunt'"
    ).get(userId) as { c: number };
    
    achievementService.setProgress(userId, 'cd_12', totalHunts.c);
    achievementService.setProgress(userId, 'cd_13', totalHunts.c);
  } catch (e) {
    console.error('[sanyeuthu achievement error]', e);
  }

  // Thêm năng lượng cho linh mạch Chiến Đấu
  leylineService.addEnergy(userId, 'chiendau', 10);

  return { success: true, message: isWin ? 'Thắng' : 'Thua', embed, encounter: rolledEncounter, combatLog: combatResult.log };
}

/**
 * Kiểm tra và cập nhật thành tựu sủng thú sau khi bắt/lai tạo
 */
export function checkPetAchievements(userId: string, newPetRarity?: string): void {
  const pets = db.prepare('SELECT id, rarity, level FROM pets WHERE user_id = ?').all(userId) as { id: number; rarity: string; level: number }[];
  const totalPets = pets.length;

  // Thành tựu số lượng sủng thú
  achievementService.setProgress(userId, 'st_1', totalPets);
  achievementService.setProgress(userId, 'st_2', totalPets);
  achievementService.setProgress(userId, 'st_3', totalPets);
  achievementService.setProgress(userId, 'st_4', totalPets);

  // Thành tựu phẩm chất sủng thú
  if (newPetRarity) {
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    // Kiểm tra xem user đã từng sở hữu pet ở các phẩm chất tương ứng chưa
    const hasRare = pets.some(p => rarityOrder.indexOf(p.rarity) >= rarityOrder.indexOf('rare'));
    const hasEpic = pets.some(p => rarityOrder.indexOf(p.rarity) >= rarityOrder.indexOf('epic'));
    const hasLegendary = pets.some(p => rarityOrder.indexOf(p.rarity) >= rarityOrder.indexOf('legendary'));

    if (hasRare) achievementService.updateProgress(userId, 'st_5', 1);
    if (hasEpic) achievementService.updateProgress(userId, 'st_6', 1);
    if (hasLegendary) achievementService.updateProgress(userId, 'st_7', 1);
  }

  // Thành tựu cấp độ sủng thú (kiểm tra pet cao nhất)
  const maxPetLevel = Math.max(...pets.map(p => p.level), 0);
  achievementService.setProgress(userId, 'st_11', maxPetLevel);

  // Thành tựu bắt pet hiếm (cd_14)
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const rareOrAbove = pets.filter(p => rarityOrder.indexOf(p.rarity) >= rarityOrder.indexOf('rare')).length;
  achievementService.setProgress(userId, 'cd_14', rareOrAbove);
}

/**
 * Render menu săn yêu thú với 1 nút xác nhận săn + nút quay lại hồ sơ
 */
export function getSanYeuThuComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const user = userRepository.get(userId);
  const stamina = user?.stamina || 0;
  const enoughStamina = stamina >= 15;

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`sanyeuthunaav_go_${userId}`)
        .setLabel('🐺 Xuất Phát Săn Bắn Ngay')
        .setStyle(enoughStamina ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(!enoughStamina)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

/**
 * Render embed menu săn yêu thú (màn hình chờ trước khi săn)
 */
export function getSanYeuThuEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder().setTitle('❌ Lỗi').setColor(EMBED_COLORS.ERROR).setDescription('Không tìm thấy nhân vật.');
  }

  let tier = 'Luyện Khí';
  let rateText = '30% (Thường)';
  let monstersText = 
    `• **U Linh Thử 🐭** (HP: 80 | Công: 12 | Thủ: 5)\n` +
    `• **Thiết Nhận Thỏ 🐰** (HP: 100 | Công: 15 | Thủ: 6)\n` +
    `• **Tiểu Hoa Miêu 🐱** (HP: 120 | Công: 18 | Thủ: 7)`;

  if (user.level > 76) {
    tier = 'Kim Đan';
    rateText = '5% (Truyền Thuyết)';
    monstersText = 
      `• **Thanh Minh Hổ 🐯** (HP: 4000 | Công: 280 | Thủ: 180)\n` +
      `• **Xích Diễm Hầu 🐵** (HP: 4500 | Công: 300 | Thủ: 190)\n` +
      `• **Băng Hồn Hồ 🦊** (HP: 5000 | Công: 320 | Thủ: 200)`;
  } else if (user.level > 38) {
    tier = 'Trúc Cơ';
    rateText = '15% (Hiếm)';
    monstersText = 
      `• **Tật Phong Lang 🐺** (HP: 800 | Công: 75 | Thủ: 45)\n` +
      `• **Hỏa Nham Trư 🐗** (HP: 1000 | Công: 85 | Thủ: 55)\n` +
      `• **Kim Sí Ưng 🦅** (HP: 1200 | Công: 95 | Thủ: 65)`;
  }

  return new EmbedBuilder()
    .setTitle(`🐺 SĂN YÊU THÚ DÃ NGOẠI`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setDescription(
      `Ngoài hoang dã bao la, yêu thú tứ phương hội tụ. Đạo hữu với **${user.stamina}/500** Thể Lực có thể phiêu du đả thảo tiểu điền để tìm cơ duyên.\n` +
      `${getProgressBar(user.stamina, 500, 10)}\n\n` +
      `🏔️ **Cảnh Giới Hiện Tại:** **${tier}** (Cấp ${user.level})\n` +
      `⚡ **Thể Lực Tiêu Hao:** **15** mỗi lần săn\n\n` +
      `🎯 **Linh Thú Xuất Hiện Tại Khu Vực:**\n${monstersText}\n` +
      `✨ **Tỷ lệ thu phục thành công:** **${rateText}**\n\n` +
      `🍀 **Yêu Thú Đặc Biệt (17.5% tổng):**\n` +
      `🟡 **Huyền Thoại:** Kỳ Lân Bạch Ngọc 🦄(0.5%) | Côn Bằng 🦅(0.5%) | Thao Thiết 🐉(1%) | Kỳ Lân 🦄(0.5%) | Phượng Hoàng 🦚(1%)\n` +
      `🟣 **Sử Thi:** Hắc Long Tử 🐲(1.5%) | Phượng Hoàng Lửa 🦩(2%) | Tỳ Hưu 🦁(1.5%) | Linh Khuyển 🐕(2%)\n` +
      `🔵 **Hiếm:** Cửu Thiên Huyền Điểu 🐦(3%) | Thiên Hồ Cửu Vĩ 🦊(4%)\n\n` +
      `*Bấm nút bên dưới để xuất phát săn bắn ngay!*`
    )
    .setFooter({ text: 'Đạo hữu cần ít nhất 15 Thể Lực để thực hiện săn bắt yêu thú.' })
    .setTimestamp();
}

export default class SanYeuThuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sanyeuthu')
        .setDescription('Đi săn thú dữ dã ngoại kiếm tu vi, linh thạch và thu phục linh thú.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const embed = getSanYeuThuEmbed(userId);
    const rows = getSanYeuThuComponents(userId);

    await interaction.editReply(toV2Payload([embed], rows as any[] ));
  }
}
