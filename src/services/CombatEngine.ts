import { ActiveStats } from './InventoryService';
import { systemConfigService } from './SystemConfigService';
import { bloodlineService } from './BloodlineService';
import { leylineService } from './LeylineService';

export interface SpiritSkillEffect {
  effect_type: 'crit_up' | 'dmg_reduce' | 'hp_regen' | 'atk_up' | 'def_up' | 'dodge_up';
  effect_value: number;
}

export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  crit: number;
  critRes: number;
  luck: number;
  linhCan?: string; // Mảng JSON linh căn (chỉ có ở người chơi)
  speed?: number;
  dodge?: number;
  element?: string; // Hệ của quái vật
  equippedSkills?: { id: string, element: string, level: number, name: string }[]; // Kỹ năng đang mang (người chơi)
  spiritSkill?: SpiritSkillEffect; // Khí linh bonus
  bloodline?: { id: string; name: string; level: number; passives: any; rage_effect: any; rage_cooldown: number; }; // Huyết mạch
  hasOai?: boolean; // Có kích hoạt kỹ năng Oai từ Ấn Ký hay không
  userId?: string; // ID người chơi
  level?: number;  // Cấp độ người chơi
  heartLaws?: { type: string; value: number; lawName: string; element: string; scale: number }[]; // Tâm pháp đang mang
  reflectRate?: number; // Tỷ lệ phản sát thương (ví dụ 0.2 là phản 20%)
  isNineHeavensFloor5?: boolean; // Tầng 5 boss
  isNineHeavensFloor9?: boolean; // Tầng 9 boss
}

export interface PetCombatConfig {
  name: string;
  atk: number;
  skills?: string[];
}

export interface CombatResult {
  winner: 'player' | 'enemy';
  playerEndingHp: number;
  enemyEndingHp: number;
  totalDamageDealt: number;
  rounds: number;
  log: string[];
}

export class CombatEngine {
  /**
   * Giả lập trận đấu Turn-based giữa Người chơi và Quái vật/Boss
   */
  public static run(
    player: Combatant,
    enemy: Combatant,
    pet: PetCombatConfig | null = null,
    maxRounds: number = 30,
    isDreamscape: boolean = false,
    isSurvival: boolean = false
  ): CombatResult {
    let playerHp = player.hp;
    let playerMaxHp = player.maxHp;
    let enemyHp = enemy.hp;
    const enemyMaxHp = enemy.maxHp;

    let playerShield = 0;
    let enemyParalyzed = false;
    let playerParalyzed = false;
    let playerDodge = false;

    // Load active Heart Laws
    let playerHeartLaws = player.heartLaws;
    if (!playerHeartLaws && player.userId) {
      try {
        const { heartLawService } = require('./HeartLawService');
        playerHeartLaws = heartLawService.getActivePassives(player.userId);
      } catch (e) {
        playerHeartLaws = [];
      }
    }
    playerHeartLaws = playerHeartLaws || [];

    let enemyHeartLaws = enemy.heartLaws;
    if (!enemyHeartLaws && enemy.userId) {
      try {
        const { heartLawService } = require('./HeartLawService');
        enemyHeartLaws = heartLawService.getActivePassives(enemy.userId);
      } catch (e) {
        enemyHeartLaws = [];
      }
    }
    enemyHeartLaws = enemyHeartLaws || [];

    // DoT Ticks
    let enemyBurnTicks = 0;
    let enemyBurnDamage = 0;
    let playerBurnTicks = 0;
    let playerBurnDamage = 0;

    const log: string[] = [];
    let totalDamageDealt = 0;
    let round = 1;

    let rageActive = false;
    let rageTurnsLeft = 0;
    let playerRevived = false;
    let petRebornTriggered = false;

    // Phân tích Linh Căn của người chơi
    let elements: Record<string, number> = {};
    if (player.linhCan) {
      try {
        elements = JSON.parse(player.linhCan);
      } catch (e) {
        elements = {};
      }
    }

    let strongestElement = 'Vô';
    let maxPct = 0;
    for (const [el, pct] of Object.entries(elements)) {
      if (pct > maxPct) {
        maxPct = pct;
        strongestElement = el;
      }
    }

    let isPlayerCountered = false;
    if (enemy.element && enemy.element !== 'Vô') {
      const ee = enemy.element;
      const pe = strongestElement;
      isPlayerCountered = 
        (ee === 'Kim' && pe === 'Mộc') ||
        (ee === 'Mộc' && pe === 'Thổ') ||
        (ee === 'Thổ' && pe === 'Thủy') ||
        (ee === 'Thủy' && pe === 'Hỏa') ||
        (ee === 'Hỏa' && pe === 'Kim');
    }

    log.push(`⚔️ **Trận chiến bắt đầu!** **${player.name}** (Tốc độ: **${player.speed ?? 100}**, Né tránh: **${((player.dodge ?? 0.05) * 100).toFixed(0)}%**) đối đầu **${enemy.name}** (Tốc độ: **${enemy.speed ?? 100}**, Né tránh: **${((enemy.dodge ?? 0.05) * 100).toFixed(0)}%**).`);
    if (isPlayerCountered) {
      log.push(`⚠️ **[Ngũ Hành Khắc Chế]** Linh căn **${strongestElement}** của đạo hữu bị thuộc tính **${enemy.element}** của đối thủ khắc chế! Nhận thêm **+30% sát thương** và giảm **20% chính xác**!`);
    }
    if (pet) {
      log.push(`🐾 Sủng thú **${pet.name}** xuất chiến hỗ trợ đạo hữu!`);
      
      // Tính toán sủng thú passive buff khởi đầu
      if (pet.skills) {
        if (pet.skills.includes('crit_bite')) {
          player.crit += 0.03;
          log.push(`🐾 **[Sủng Thú - Cắn Chí Mạng]** **${pet.name}** hộ trận, tăng **+3%** tỷ lệ Bạo Kích cho chủ nhân!`);
        }
        if (pet.skills.includes('speed_boost') && player.speed) {
          player.speed = Math.round(player.speed * 1.1);
          log.push(`🐾 **[Sủng Thú - Phóng Xuất Bạo Phát]** **${pet.name}** gia tốc, tăng **+10%** Tốc Độ cho chủ nhân!`);
        }
        if (pet.skills.includes('lucky')) {
          player.luck += 5;
          log.push(`🐾 **[Sủng Thú - Thiên Xích May Mắn]** **${pet.name}** chúc phúc, tăng **+5** May Mắn cho chủ nhân!`);
        }
        if (pet.skills.includes('qilin_fortune')) {
          player.luck += 15;
          player.dodge = (player.dodge ?? 0.05) + 0.05;
          log.push(`🐾 **[Sủng Thú - Kỳ Lân Tường Thụy]** Thần thú Kỳ Lân tụ cát tường, tăng **+15** May Mắn và **+5%** Né Tránh cho chủ nhân!`);
        }
      }
    }

    // Hỏa Chân Linh Căn (>= 40%): Tự động thiêu đốt kẻ địch ở hiệp 1
    // Hỏa Chân Linh Căn (>= 40%): Tự động thiêu đốt kẻ địch ở hiệp 1
    if (elements['Hỏa'] >= 40) {
      enemyBurnTicks = 2;
      const isThien = elements['Hỏa'] >= 90;
      enemyBurnDamage = Math.round(player.atk * (isThien ? 0.30 : 0.15));
      log.push(`🔥 **[Hỏa Chân Linh Căn]** Khởi trận thiêu đốt kinh mạch kẻ địch! Gây Hỏa Phế thiêu đốt **-${enemyBurnDamage}** HP/hiệp.`);
    }

    // Tính toán Khí Linh (Passive Buffs)
    if (player.spiritSkill) {
      const ss = player.spiritSkill;
      if (ss.effect_type === 'atk_up') {
        player.atk = Math.round(player.atk * (1 + ss.effect_value));
        log.push(`🔮 **[Khí Linh]** Khí linh hộ chủ, tăng **+${Math.round(ss.effect_value * 100)}%** Công Kích!`);
      } else if (ss.effect_type === 'crit_up') {
        player.crit += ss.effect_value;
        log.push(`💥 **[Khí Linh]** Khí linh hội tụ, tăng **+${Math.round(ss.effect_value * 100)}%** tỷ lệ Bạo Kích!`);
      } else if (ss.effect_type === 'def_up') {
        player.def = Math.round(player.def * (1 + ss.effect_value));
        log.push(`🪨 **[Khí Linh]** Khí linh hóa thuẫn, tăng **+${Math.round(ss.effect_value * 100)}%** Phòng Thủ!`);
      }
    }

    // Tính toán Huyết Mạch (Passive Stats khởi đầu)
    if (player.bloodline) {
      const p = player.bloodline.passives;
      if (p.max_hp) {
        const bonusHp = Math.round(player.maxHp * p.max_hp);
        playerMaxHp += bonusHp;
        playerHp += bonusHp;
        log.push(`🩸 **[${player.bloodline.name}]** cường hóa nhục thân, tăng **+${bonusHp}** HP tối đa!`);
      }
      if (p.speed) {
        player.speed = (player.speed ?? 100) + Math.round((player.speed ?? 100) * p.speed);
        log.push(`🩸 **[${player.bloodline.name}]** kinh mạch thông suốt, tăng **+${Math.round(p.speed * 100)}%** Tốc độ!`);
      }
      if (p.crit_rate) {
        player.crit += p.crit_rate;
        log.push(`🩸 **[${player.bloodline.name}]** sát khí dâng cao, tăng **+${Math.round(p.crit_rate * 100)}%** tỷ lệ Bạo Kích!`);
      }
      if (p.shield_start) {
        const bShield = Math.round(playerMaxHp * p.shield_start);
        playerShield += bShield;
        log.push(`🩸 **[${player.bloodline.name}]** ngưng tụ huyền giáp, nhận khiên bảo hộ **${bShield}** sát thương!`);
      }
    }

    // Tính toán Tốc Độ cuối cùng (sau Huyết mạch & Khí Linh) và tích hợp Tâm Pháp Thần Hành Quyết (hệ Kim)
    let playerSpeed = player.speed ?? 100;
    const speedHL = playerHeartLaws.find(hl => hl.type === 'speed_boost');
    if (speedHL) {
      const oldSpeed = playerSpeed;
      playerSpeed = Math.round(playerSpeed * (1 + speedHL.value));
      log.push(`⚡ **[Tâm Pháp - ${speedHL.lawName}]** bùng phát tốc độ, tăng **+${Math.round(speedHL.value * 100)}%** Tốc Độ! (${oldSpeed} ➔ ${playerSpeed})`);
    }

    let enemySpeed = enemy.speed ?? 100;
    const enemySpeedHL = enemyHeartLaws.find(hl => hl.type === 'speed_boost');
    if (enemySpeedHL) {
      const oldSpeed = enemySpeed;
      enemySpeed = Math.round(enemySpeed * (1 + enemySpeedHL.value));
      log.push(`⚡ **[Tâm Pháp - ${enemySpeedHL.lawName}]** bùng phát tốc độ, tăng **+${Math.round(enemySpeedHL.value * 100)}%** Tốc Độ! (${oldSpeed} ➔ ${enemySpeed})`);
    }

    while (playerHp > 0 && enemyHp > 0 && round <= maxRounds) {
      log.push(`\n=== ⏳ **Hiệp ${round}** ===`);

      // Hồi phục từ sủng thú (healing skill)
      if (pet && pet.skills && pet.skills.includes('healing') && playerHp > 0 && !isDreamscape) {
        const petHeal = Math.round(playerMaxHp * 0.02);
        playerHp = Math.min(playerMaxHp, playerHp + petHeal);
        log.push(`💚 **[Sủng Thú - Liều Lực Thánh Thư]** **${pet.name}** hồi phục **+${petHeal}** HP cho đạo hữu! (Hiện tại: ${playerHp}/${playerMaxHp})`);
      }

      // Hồi phục từ Trường Sinh Quyết (Heart Law)
      if (playerHp > 0 && !isDreamscape) {
        const playerRegenHL = playerHeartLaws.find(hl => hl.type === 'hp_regen');
        if (playerRegenHL) {
          const regenVal = Math.round(playerMaxHp * playerRegenHL.value);
          playerHp = Math.min(playerMaxHp, playerHp + regenVal);
          log.push(`💚 **[Tâm Pháp - ${playerRegenHL.lawName}]** tuôn trào sinh cơ hồi phục **+${regenVal}** HP! (Hiện tại: ${playerHp}/${playerMaxHp})`);
        }
      }
      if (enemyHp > 0 && !isDreamscape) {
        const enemyRegenHL = enemyHeartLaws.find(hl => hl.type === 'hp_regen');
        if (enemyRegenHL) {
          const regenVal = Math.round(enemyMaxHp * enemyRegenHL.value);
          enemyHp = Math.min(enemyMaxHp, enemyHp + regenVal);
          log.push(`💚 **[Tâm Pháp - ${enemyRegenHL.lawName}]** vận chuyển sinh cơ hồi phục **+${regenVal}** HP! (Hiện tại: ${enemyHp}/${enemyMaxHp})`);
        }
      }

      // Boss Tầng 5: Hồi phục +5% max HP mỗi hiệp
      if (enemyHp > 0 && enemy.isNineHeavensFloor5) {
        const regenVal = Math.round(enemyMaxHp * 0.05);
        enemyHp = Math.min(enemyMaxHp, enemyHp + regenVal);
        log.push(`💚 **[Cơ Chế Boss]** **${enemy.name}** vận chuyển Huyễn Ảnh thần thông hồi phục **+${regenVal}** HP! (Hiện tại: ${enemyHp}/${enemyMaxHp})`);
      }

      // 1. Xử lý sát thương duy trì (DoT)
      if (playerBurnTicks > 0 && playerHp > 0) {
        playerHp -= playerBurnDamage;
        log.push(`🔥 **Hỏa Phế:** Sức nóng thiêu đốt kinh mạch, **${player.name}** chịu **-${playerBurnDamage}** sát thương thiêu đốt! (Còn lại: ${Math.max(0, playerHp)} HP)`);
        playerBurnTicks--;
      }
      if (enemyBurnTicks > 0 && enemyHp > 0) {
        enemyHp -= enemyBurnDamage;
        log.push(`🔥 **Hỏa Phế:** Hỏa diễm cuồn cuộn đốt cháy, **${enemy.name}** chịu **-${enemyBurnDamage}** sát thương thiêu đốt! (Còn lại: ${Math.max(0, enemyHp)} HP)`);
        enemyBurnTicks--;
      }

      if (playerHp <= 0 || enemyHp <= 0) break;

      // Xác định lượt đi theo Tốc độ
      const playerGoesFirst = playerSpeed >= enemySpeed;

      const executePlayerTurn = () => {
        if (playerHp <= 0 || enemyHp <= 0) return;

        if (playerParalyzed) {
          log.push(`⚡ **${player.name}** đang bị tê liệt, run rẩy không thể ra chiêu!`);
          playerParalyzed = false; // Hết tê liệt
          return;
        }

        // --- Kích hoạt "Oai" từ Ấn Ký (5% gây tê liệt) ---
        if (player.hasOai && Math.random() < 0.05) {
          const hasStunImmune = enemyHeartLaws.some(hl => hl.type === 'stun_immune');
          if (hasStunImmune) {
            const immuneLaw = enemyHeartLaws.find(hl => hl.type === 'stun_immune')!;
            log.push(`❄️ **[Tâm Pháp - ${immuneLaw.lawName}]** giữ vững tâm cảnh, giúp **${enemy.name}** miễn dịch trạng thái Tê Liệt từ Oai!`);
          } else {
            enemyParalyzed = true;
            log.push(`💥 **[Ấn Ký - Oai]** Uy áp cực lớn làm **${enemy.name}** bị **tê liệt** ở hiệp kế tiếp!`);
          }
        }

        let playerLifesteal = 0; // % sát thương hút máu
        let isLoiTriggered = false;
        let playerLoiDamageMult = 1.0;

        // Tính toán Khí Linh (Active Skills per round)
        if (player.spiritSkill) {
          const ss = player.spiritSkill;
          if (ss.effect_type === 'hp_regen') {
            if (!isDreamscape) {
              const regenHeal = Math.round(playerMaxHp * ss.effect_value);
              playerHp = Math.min(playerMaxHp, playerHp + regenHeal);
              log.push(`💚 **[Khí Linh]** Sinh Mệnh Chi Nguyên hồi phục **+${regenHeal}** HP! (Hiện tại: ${playerHp}/${playerMaxHp})`);
            }
          } else if (ss.effect_type === 'dodge_up') {
            // Xác suất kích hoạt né tránh từ Khí Linh, effect_value là tỷ lệ %
            if (Math.random() < ss.effect_value) {
              playerDodge = true;
              log.push(`🌀 **[Khí Linh]** Vô Ảnh Bộ kích hoạt, chuẩn bị tuyệt đối né tránh đòn kế tiếp!`);
            }
          }
        }

        // Huyết Mạch (Passive mỗi vòng & Rage)
        let bloodlineMultiplier = 1.0;
        if (player.bloodline) {
          const p = player.bloodline.passives;
          const r = player.bloodline.rage_effect;
          
          if (rageTurnsLeft > 0) {
            rageTurnsLeft--;
            bloodlineMultiplier = r.multiplier || 2;
            log.push(`🔥 **[Huyết Mạch Nộ]** Đang duy trì, hiệu ứng Huyết Mạch x${bloodlineMultiplier}! (Còn ${rageTurnsLeft} hiệp)`);
            if (rageTurnsLeft === 0) rageActive = false;
          } else {
            const nowSec = Math.floor(Date.now() / 1000);
            // Leyline Buff Bloodline (x2 tỷ lệ kích hoạt nộ nếu khớp hệ)
            let baseRageRate = 0.05;
            if (leylineService.isLeylineElementMatch(player.linhCan)) {
              baseRageRate = 0.1;
            }

            if (!rageActive && player.bloodline.rage_cooldown <= nowSec && Math.random() < baseRageRate) {
              rageActive = true;
              rageTurnsLeft = r.duration || 3;
              bloodlineMultiplier = r.multiplier || 2;
              
              // Cập nhật thời gian cooldown của Rage (tạm thời qua reference, thực tế service sẽ lưu DB sau trận)
              player.bloodline.rage_cooldown = nowSec + (r.cooldown * 60) || nowSec + 600;
              
              log.push(`💢 **[HUYẾT MẠCH NỘ]** Sức mạnh **${player.bloodline.name}** bùng nổ! Tăng x${bloodlineMultiplier} hiệu ứng Huyết Mạch trong ${rageTurnsLeft} hiệp!`);
            }
          }

          if (p.hp_steal) {
            playerLifesteal += (p.hp_steal * bloodlineMultiplier);
          }
        }

        // Tính toán kích hoạt Linh Căn Kỹ Năng
        for (const [element, percentage] of Object.entries(elements)) {
          let triggerChance = 0;
          if (percentage >= 90) triggerChance = 0.50;
          else if (percentage >= 75) triggerChance = 0.40;
          else if (percentage >= 60) triggerChance = 0.30;
          else if (percentage >= 40) triggerChance = 0.20;
          else if (percentage >= 20) triggerChance = 0.10;
          else triggerChance = 0.0; // Phế Linh Căn: 0%

          const rolled = Math.random();

          if (rolled < triggerChance) {
            switch (element) {
              case 'Hỏa': {
                const isThien = percentage >= 90;
                const extraDmg = Math.round(player.atk * 0.20);
                enemyHp -= extraDmg;
                totalDamageDealt += extraDmg;
                
                enemyBurnTicks = 2;
                enemyBurnDamage = Math.round(player.atk * (isThien ? 0.30 : 0.15));
                
                const talentLabel = isThien ? '🔥 [Hỏa Thiên Linh Căn]' : '🔥 [Linh Căn Hỏa]';
                log.push(`${talentLabel} kích hoạt *Hỏa Diễm Thuật*: Gây **-${extraDmg}** sát thương trực tiếp và thiêu đốt **-${enemyBurnDamage}** HP/hiệp trong 2 hiệp${isThien ? ' (Nhân đôi thiêu đốt)' : ''}!`);
                break;
              }
              case 'Thủy': {
                if (!isDreamscape) {
                  const isThien = percentage >= 90;
                  const heal = Math.round(playerMaxHp * (isThien ? 0.20 : 0.12));
                  playerHp = Math.min(playerMaxHp, playerHp + heal);
                  
                  let cleanseText = '';
                  if (isThien && playerBurnTicks > 0) {
                    playerBurnTicks = 0;
                    playerBurnDamage = 0;
                    cleanseText = ' và giải trừ trạng thái Hỏa Phế';
                  }
                  
                  const talentLabel = isThien ? '💧 [Thủy Thiên Linh Căn]' : '💧 [Linh Căn Thủy]';
                  log.push(`${talentLabel} kích hoạt *Thủy Linh Thuật*: Dòng nước gột rửa hồi lại **+${heal}** HP${cleanseText}! (Hiện tại: ${playerHp}/${playerMaxHp} HP)`);
                } else {
                  log.push(`💧 [Linh Căn Thủy] kích hoạt *Thủy Linh Thuật* nhưng bị cấm kỵ trong Vọng Tưởng!`);
                }
                break;
              }
              case 'Mộc': {
                const isThien = percentage >= 90;
                playerLifesteal = isThien ? 0.40 : 0.25;
                
                let extraHealText = '';
                if (isThien && !isDreamscape) {
                  const directHeal = Math.round(playerMaxHp * 0.05);
                  playerHp = Math.min(playerMaxHp, playerHp + directHeal);
                  extraHealText = ` và hồi trực tiếp **+${directHeal}** HP`;
                }
                
                const talentLabel = isThien ? '🌿 [Mộc Thiên Linh Căn]' : '🌿 [Linh Căn Mộc]';
                log.push(`${talentLabel} kích hoạt *Hấp Huyết Cổ Pháp*: Đòn đánh hiệp này hút máu **${isThien ? '40%' : '25%'}**${extraHealText}!`);
                break;
              }
              case 'Thổ': {
                const isThien = percentage >= 90;
                const shield = Math.round(playerMaxHp * (isThien ? 0.25 : 0.15));
                playerShield += shield;
                
                const talentLabel = isThien ? '🪨 [Thổ Thiên Linh Căn]' : '🪨 [Linh Căn Thổ]';
                log.push(`${talentLabel} kích hoạt *Thổ Giáp Thuật*: Nhận khiên hấp thụ **+${shield}** sát thương${isThien ? ' và tăng 30% phòng thủ khi khiên tồn tại' : ''}!`);
                break;
              }
              case 'Lôi': {
                const isThien = percentage >= 90;
                isLoiTriggered = true;
                playerLoiDamageMult = isThien ? 2.0 : 1.5;
                
                const hasStunImmune = enemyHeartLaws.some(hl => hl.type === 'stun_immune');
                const talentLabel = isThien ? '⚡ [Lôi Thiên Linh Căn]' : '⚡ [Linh Căn Lôi]';
                if (hasStunImmune) {
                  const immuneLaw = enemyHeartLaws.find(hl => hl.type === 'stun_immune')!;
                  log.push(`${talentLabel} kích hoạt *Lôi Phạt Kinh Thiên* nhưng **${enemy.name}** dùng **[Tâm Pháp - ${immuneLaw.lawName}]** miễn dịch Tê Liệt!`);
                } else {
                  enemyParalyzed = true;
                  log.push(`${talentLabel} kích hoạt *Lôi Phạt Kinh Thiên*: Phóng sét cuồng bạo gây **Tê Liệt** đối thủ hiệp sau${isThien ? ' và nhân 2x sát thương đòn đánh' : ''}!`);
                }
                break;
              }
              case 'Phong': {
                const isThien = percentage >= 90;
                playerDodge = true;
                
                let permDodgeText = '';
                if (isThien) {
                  player.dodge = (player.dodge ?? 0.05) + 0.10;
                  permDodgeText = ' và tăng vĩnh viễn **+10%** tỷ lệ né tránh trận này';
                }
                
                const talentLabel = isThien ? '🌀 [Phong Thiên Linh Căn]' : '🌀 [Linh Căn Phong]';
                log.push(`${talentLabel} kích hoạt *Phong Hành Bộ*: Thân pháp nhẹ như gió chuẩn bị Né Tránh đòn tiếp theo${permDodgeText}!`);
                break;
              }
            }
          }
        }

        // Đòn đánh chính của Người chơi (kiểm tra quái vật né tránh)
        if (enemyHp > 0) {
          const baseDodge = enemy.dodge ?? 0.05;
          const dodgeChance = isPlayerCountered ? baseDodge + 0.20 : baseDodge;
          const isEnemyDodge = Math.random() < dodgeChance;

          if (isEnemyDodge) {
            log.push(`🌀 **${enemy.name}** di chuyển cực nhanh, **Né Tránh** hoàn toàn đòn công kích từ **${player.name}**!`);
          } else {
            // Lấy kỹ năng trang bị theo vòng lặp hiệp
            let activeSkill: { id: string, element: string, level: number, name: string } | null = null;
            if (player.equippedSkills && player.equippedSkills.length > 0) {
              const skillIndex = (round - 1) % player.equippedSkills.length;
              activeSkill = player.equippedSkills[skillIndex];
            }

            // Tỉ lệ bạo kích
            const critRate = Math.max(0.05, player.crit - enemy.critRes) + player.luck * 0.001;
            const isCrit = Math.random() < critRate;

            let enemyDef = enemy.def;
            if ((elements['Hỏa'] ?? 0) >= 90) {
              enemyDef = Math.round(enemyDef * 0.8);
            }
            let baseDamage = Math.max(1, player.atk - enemyDef);
            baseDamage = Math.round(baseDamage * (0.9 + Math.random() * 0.2));

            let elementText = '';
            // Tính toán Ngũ Hành Tương Khắc nếu có kỹ năng và quái có hệ
            if (activeSkill) {
              const skillMult = 1 + (activeSkill.level * 0.1); // Mỗi cấp kỹ năng tăng 10% sát thương
              baseDamage = Math.round(baseDamage * skillMult);
              elementText = ` bằng **${activeSkill.name}**`;

              if (enemy.element) {
                const pe = activeSkill.element;
                const ee = enemy.element;
                let elemMult = 1.0;

                const isAdvantage = 
                  (pe === 'Kim' && ee === 'Mộc') ||
                  (pe === 'Mộc' && ee === 'Thổ') ||
                  (pe === 'Thổ' && ee === 'Thủy') ||
                  (pe === 'Thủy' && ee === 'Hỏa') ||
                  (pe === 'Hỏa' && ee === 'Kim');
                
                const isDisadvantage = 
                  (ee === 'Kim' && pe === 'Mộc') ||
                  (ee === 'Mộc' && pe === 'Thổ') ||
                  (ee === 'Thổ' && pe === 'Thủy') ||
                  (ee === 'Thủy' && pe === 'Hỏa') ||
                  (ee === 'Hỏa' && pe === 'Kim');

                if (isAdvantage) {
                  elemMult = 1.5;
                  elementText += ` 🌟 *(Khắc hệ: +50% Sát thương)*`;
                } else if (isDisadvantage) {
                  elemMult = 0.5;
                  elementText += ` ⚠️ *(Bị khắc: -50% Sát thương)*`;
                }

                baseDamage = Math.round(baseDamage * elemMult);
              }
            }
            if (activeSkill) {
              const vnToEngElement: Record<string, string> = {
                'Kim': 'metal',
                'Mộc': 'wood',
                'Thủy': 'water',
                'Hỏa': 'fire',
                'Thổ': 'earth'
              };
              const engElement = vnToEngElement[activeSkill.element] || '';
              if (engElement) {
                const matchingLaw = playerHeartLaws.find(hl => hl.type === `element_${engElement}_dmg`);
                if (matchingLaw) {
                  baseDamage = Math.round(baseDamage * (1 + matchingLaw.value));
                  elementText += ` 🌟 *(Tâm Pháp [${matchingLaw.lawName}]: +${Math.round(matchingLaw.value * 100)}% Sát thương)*`;
                }
              }
            }

            // Tính toán sát thương vượt cấp từ Phá Cấm Quyết (Tâm Pháp Vô Hệ)
            const suppressionHL = playerHeartLaws.find(hl => hl.type === 'level_suppression_dmg');
            if (suppressionHL && player.level && enemy.level && enemy.level > player.level) {
              baseDamage = Math.round(baseDamage * (1 + suppressionHL.value));
              elementText += ` 🌟 *(Tâm Pháp [${suppressionHL.lawName}]: +${Math.round(suppressionHL.value * 100)}% Sát thương vượt cấp)*`;
            }

            if (isCrit) {
              baseDamage = Math.round(baseDamage * 1.5);
            }
            if (isLoiTriggered) {
              baseDamage = Math.round(baseDamage * playerLoiDamageMult);
            }

            enemyHp -= baseDamage;
            totalDamageDealt += baseDamage;

            let lifestealText = '';
            if (playerLifesteal > 0 && !isDreamscape) {
              const lifestealHp = Math.round(baseDamage * playerLifesteal);
              playerHp = Math.min(playerMaxHp, playerHp + lifestealHp);
              lifestealText = ` và hút lại **+${lifestealHp}** HP 🌿`;
            }

            let reflectText = '';
            if (enemy.reflectRate && enemy.reflectRate > 0 && playerHp > 0) {
              const reflectDmg = Math.round(baseDamage * enemy.reflectRate);
              playerHp = Math.max(0, playerHp - reflectDmg);
              reflectText = ` ⚡ *(Bị phản chấn ngược: -${reflectDmg} HP)*`;
            }

            log.push(`⚔️ **${player.name}** vung đòn công kích${elementText}, gây **-${baseDamage}** sát thương lên **${enemy.name}**${isCrit ? ' (Bạo Kích 💥)' : ''}${lifestealText}! (Còn lại: ${Math.max(0, enemyHp)} HP)${reflectText}`);
          }
        }

        // Sủng thú trợ chiến
        if (pet && enemyHp > 0) {
          let petDmg = Math.max(1, pet.atk);
          petDmg = Math.round(petDmg * (0.9 + Math.random() * 0.2));
          enemyHp -= petDmg;
          totalDamageDealt += petDmg;
          log.push(`🐾 Sủng thú **${pet.name}** cắn xé hỗ trợ, gây thêm **-${petDmg}** sát thương! (Còn lại: ${Math.max(0, enemyHp)} HP)`);
        }
      };

      const executeEnemyTurn = () => {
        if (playerHp <= 0 || enemyHp <= 0) return;

        if (enemyParalyzed) {
          log.push(`⚡ **${enemy.name}** đang bị tê liệt từ Lôi Phạt, run rẩy không thể ra chiêu!`);
          enemyParalyzed = false; // Hết tê liệt
        } else {
          // Kiểm tra né tránh của người chơi
          const isPlayerDodge = playerDodge || (Math.random() < (player.dodge ?? 0.05));
          
          if (isPlayerDodge) {
            log.push(`🌀 **${player.name}** nhẹ nhàng di hình hoán ảnh, **Né Tránh** hoàn toàn đòn đánh từ **${enemy.name}**!`);
            playerDodge = false; // Reset buff Phong bộ pháp
          } else {
            const critRate = Math.max(0.05, enemy.crit - player.critRes);
            const isCrit = Math.random() < critRate;

            let playerDef = player.def;
            if (playerShield > 0 && (elements['Thổ'] ?? 0) >= 90) {
              playerDef = Math.round(playerDef * 1.3);
            }

            // Cơ chế boss Tầng 9: bộc phát liên chiêu nhân đôi ATK mỗi 3 hiệp
            let enemyAtk = enemy.atk;
            if (enemy.isNineHeavensFloor9 && round % 3 === 0) {
              enemyAtk = enemyAtk * 2;
              log.push(`👑 **[Cơ Chế Boss - Cửu Trùng Liên Chiêu]** **${enemy.name}** bộc phát liên chiêu cuồng bạo, tăng gấp đôi Sát Thương đòn đánh!`);
            }

            let monsterDmg = Math.max(1, enemyAtk - playerDef);
            monsterDmg = Math.round(monsterDmg * (0.9 + Math.random() * 0.2));

            if (isPlayerCountered) {
              monsterDmg = Math.round(monsterDmg * 1.3);
            }

            // Tính toán sát thương tăng thêm từ Tâm Pháp hệ của enemy (PvP)
            let enemyElementText = '';
            if (isPlayerCountered) {
              enemyElementText += ` ⚠️ *(Khắc Chế: +30% Sát thương)*`;
            }
            if (enemy.element && enemy.element !== 'Vô') {
              const vnToEngElement: Record<string, string> = {
                'Kim': 'metal',
                'Mộc': 'wood',
                'Thủy': 'water',
                'Hỏa': 'fire',
                'Thổ': 'earth'
              };
              const engElement = vnToEngElement[enemy.element] || '';
              if (engElement) {
                const matchingLaw = enemyHeartLaws.find(hl => hl.type === `element_${engElement}_dmg`);
                if (matchingLaw) {
                  monsterDmg = Math.round(monsterDmg * (1 + matchingLaw.value));
                  enemyElementText += ` 🌟 *(Tâm Pháp [${matchingLaw.lawName}]: +${Math.round(matchingLaw.value * 100)}% Sát thương)*`;
                }
              }
            }

            // Tính toán sát thương vượt cấp từ Phá Cấm Quyết của enemy (PvP)
            const enemySuppressionHL = enemyHeartLaws.find(hl => hl.type === 'level_suppression_dmg');
            if (enemySuppressionHL && enemy.level && player.level && player.level > enemy.level) {
              monsterDmg = Math.round(monsterDmg * (1 + enemySuppressionHL.value));
              enemyElementText += ` 🌟 *(Tâm Pháp [${enemySuppressionHL.lawName}]: +${Math.round(enemySuppressionHL.value * 100)}% Sát thương vượt cấp)*`;
            }

            // Huyết Mạch dmg_reduce
            if (player.bloodline && player.bloodline.passives.dmg_reduce) {
              let mult = 1.0;
              if (rageActive) mult = player.bloodline.rage_effect.multiplier || 2;
              const b_reduce = Math.round(monsterDmg * (player.bloodline.passives.dmg_reduce * mult));
              monsterDmg = Math.max(1, monsterDmg - b_reduce);
              log.push(`🩸 **[${player.bloodline.name}]** cường ngạnh thân thể, giảm **-${b_reduce}** sát thương nhận vào!`);
            }

            // Khí Linh: dmg_reduce
            if (player.spiritSkill) {
              if (player.spiritSkill.effect_type === 'dmg_reduce') {
                const reduced = Math.round(monsterDmg * player.spiritSkill.effect_value);
                monsterDmg = Math.max(1, monsterDmg - reduced);
                log.push(`🛡️ **[Khí Linh]** Huyền Hoàng Chi Lực giảm **-${reduced}** sát thương nhận vào!`);
              }
            }

            // Sủng thú aura giảm sát thương (def_aura)
            if (pet && pet.skills && pet.skills.includes('def_aura')) {
              const petReduce = Math.round(monsterDmg * 0.05);
              monsterDmg = Math.max(1, monsterDmg - petReduce);
              log.push(`🛡️ **[Sủng Thú - Hộ Thể Linh Quang]** **${pet.name}** che chở, giảm **-${petReduce}** sát thương nhận vào!`);
            }

            if (isCrit) {
              monsterDmg = Math.round(monsterDmg * 1.5);
            }

            let reflectDmg = 0;
            if (player.reflectRate && player.reflectRate > 0 && enemyHp > 0) {
              reflectDmg = Math.round(monsterDmg * player.reflectRate);
              enemyHp = Math.max(0, enemyHp - reflectDmg);
            }
            const reflectText = reflectDmg > 0 ? ` ⚡ *(Bị phản chấn ngược: -${reflectDmg} HP)*` : '';

            // Trừ vào khiên trước
            if (playerShield > 0) {
              if (playerShield >= monsterDmg) {
                playerShield -= monsterDmg;
                log.push(`🛡️ **${enemy.name}** đánh trúng, nhưng Khiên Thổ Giáp hấp thụ hoàn toàn **${monsterDmg}** sát thương! (Khiên còn: ${playerShield})${reflectText}`);
              } else {
                const absorbed = playerShield;
                const overflow = monsterDmg - absorbed;
                playerShield = 0;
                playerHp -= overflow;
                log.push(`🛡️ **${enemy.name}** phá vỡ Khiên Thổ Giáp (hấp thụ **${absorbed}**), gây **-${overflow}** sát thương trực tiếp lên **${player.name}**${isCrit ? ' (Bạo Kích 💥)' : ''}${enemyElementText}! (Còn lại: ${Math.max(0, playerHp)} HP)${reflectText}`);
              }
            } else {
              playerHp -= monsterDmg;
              log.push(`💥 **${enemy.name}** tấn công, gây **-${monsterDmg}** sát thương lên **${player.name}**${isCrit ? ' (Bạo Kích 💥)' : ''}${enemyElementText}! (Còn lại: ${Math.max(0, playerHp)} HP)${reflectText}`);
            }
          }
        }
      };

      if (playerGoesFirst) {
        executePlayerTurn();
        executeEnemyTurn();
      } else {
        executeEnemyTurn();
        executePlayerTurn();
      }

      // Hỏa Phượng Hoàng Nirvana Chi Hỏa trị liệu khẩn cấp
      if (pet && pet.skills && pet.skills.includes('reborn_flame') && playerHp < playerMaxHp * 0.20 && !petRebornTriggered && !isDreamscape) {
        playerHp = Math.max(playerHp, 0);
        const petHeal = Math.round(playerMaxHp * 0.25);
        playerHp = Math.min(playerMaxHp, playerHp + petHeal);
        petRebornTriggered = true;
        log.push(`\n🔥 **[Sủng Thú - Nirvana Chi Hỏa]** Hỏa Phượng Hoàng dâng trào linh hỏa trị liệu khẩn cấp, hồi phục **+${petHeal}** HP cho chủ nhân! (Hiện tại: ${playerHp}/${playerMaxHp})`);
      }

      if (playerHp <= 0) {
        // Xử lý Hồi sinh của Phượng Hoàng
        if (player.bloodline && player.bloodline.passives.revive_chance && !playerRevived) {
          let reviveRate = player.bloodline.passives.revive_chance;
          if (rageActive) reviveRate *= (player.bloodline.rage_effect.multiplier || 2);
          if (Math.random() < reviveRate) {
            playerHp = Math.round(playerMaxHp * 0.5);
            log.push(`\n🔥 **[Huyết Mạch Phượng Hoàng] NIẾT BÀN TRÙNG SINH!** Đạo hữu hồi sinh từ cõi chết với ${playerHp} HP!`);
            
            // Cho đánh thêm tối đa 10 hiệp
            maxRounds += 10;
            playerRevived = true;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (enemyHp <= 0) break;

      round++;
    }

    let winner: 'player' | 'enemy' = playerHp > 0 ? 'player' : 'enemy';
    if (isSurvival) {
      if (playerHp > 0) {
        winner = 'player';
        log.push(`\n🏆 **TỬ THỦ THÀNH CÔNG!** Đạo hữu **${player.name}** đã xuất sắc sống sót qua ${maxRounds} hiệp đấu sinh tử trước sự cuồng bạo của **${enemy.name}**!`);
      } else {
        winner = 'enemy';
        log.push(`\n💀 **Tử thủ thất bại!** **${player.name}** đã gục ngã trước khi thời gian thử thách kết thúc.`);
      }
    } else {
      if (winner === 'player' && enemyHp <= 0) {
        log.push(`\n🏆 **Trận chiến kết thúc!** **${player.name}** đã tiêu diệt **${enemy.name}** sau ${Math.min(round, maxRounds)} hiệp.`);
      } else if (winner === 'enemy' && playerHp <= 0) {
        log.push(`\n💀 **Trận chiến kết thúc!** **${player.name}** đã kiệt sức bại vong dưới tay **${enemy.name}**.`);
      } else {
        log.push(`\n⏳ **Trận chiến hòa!** Hai bên bất phân thắng bại sau ${maxRounds} hiệp đấu.`);
      }
    }

    return {
      winner,
      playerEndingHp: Math.max(0, playerHp),
      enemyEndingHp: Math.max(0, enemyHp),
      totalDamageDealt,
      rounds: Math.min(round, maxRounds),
      log
    };
  }
}
