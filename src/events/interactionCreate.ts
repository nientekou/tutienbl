import { Event } from '../structures/Event';
import { InteractionLock } from '../services/InteractionLock';
import { systemConfigService } from '../services/SystemConfigService';
import { TuTienClient } from '../client/TuTienClient';
import db from '../database/database';
import { noituService } from '../services/NoituService';
import { Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags, Routes } from 'discord.js';
import { userRepository } from '../database/repositories/UserRepository';
import { cultivationService } from '../services/CultivationService';
import { inventoryService } from '../services/InventoryService';
import { minigameService } from '../services/MinigameService';
import { getHoSoTabEmbed, getHoSoAllComponents, getInventoryEmbed, getInventoryComponents, HoSoTab } from '../commands/general/hoso';
import { formatLinhCan, getRealmDetails } from '../utils/constants';
import { EMBED_COLORS, toV2Payload, toV2Update, toV2TextUpdate, embedToV2, V2_FLAG, safeV2Update, safeV2TextUpdate, textToV2 } from '../utils/uiSystem';
import { tribulationService } from '../services/TribulationService';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { combatService } from '../services/CombatService';
import { getDungeonEmbed, getDungeonComponents } from '../commands/combat/bicanh';
import { buildWorldBossContainer, getBossShopEmbed, getBossShopComponents, handleBossShopPurchase } from '../commands/combat/worldboss';
import { bossSeasonService } from '../services/BossSeasonService';
import { DUNGEONS } from '../config/dungeons';
import { farmingService } from '../services/FarmingService';
import { sectService } from '../services/SectService';
import { craftingService } from '../services/CraftingService';
import { getLinhDienEmbed, getLinhDienComponents } from '../commands/life/linhdien';
import { getSectEmbed, getSectComponents } from '../commands/life/tongmon';
import { getCraftingEmbed, getCraftingComponents } from '../commands/life/chetao';
import { ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getYCanhEmbed, getYCanhComponents } from '../commands/general/ycanh';
import { getLuanHoiEmbed, getLuanHoiComponents } from '../commands/general/luanhoi';
import { explorationService, EXPLORATION_LOCATIONS } from '../services/ExplorationService';
import { dailyQuestService } from '../services/DailyQuestService';
import { questChainService, QUEST_CHAINS } from '../services/QuestChainService';
import { ITEMS, getPhoiWeaponByGrade, getPhoiArmorByGrade } from '../config/itemConstants';
import { communityQuestService } from '../services/CommunityQuestService';
import { getKhamBhaEmbed, getKhamBhaComponents } from '../commands/general/khambha';
import { getNhiemVuEmbed, getNhiemVuComponents, getQuestChainEmbed, getQuestChainComponents } from '../commands/general/nhiemvu';
import { getShopEmbed, getShopComponents, SHOP_ITEMS, checkAndUpdateWeeklyLimit } from '../commands/general/shop';
import { getShopKyNangEmbed, getShopKyNangComponents, SKILL_BOOKS } from '../commands/general/shopkynang';
import { getTowerEmbed, getTowerComponents } from '../commands/general/leothap';
import { getSungThuEmbed, getSungThuComponents } from '../commands/general/sungthu';
import { performWork } from '../commands/general/lamviec';
import { performHunt, getSanYeuThuComponents, getSanYeuThuEmbed } from '../commands/general/sanyeuthu';
import { bossSpawnService } from '../services/BossSpawnService';
import { alchemyService } from '../services/AlchemyService';
import { getPartyRoomEmbed, getPartyRoomComponents, readyStates } from '../commands/combat/lapdoi';
import LuyenDanCommand from '../commands/general/luyendan';
import DungKyNangCommand from '../commands/general/dungkynang';
import { pvpService } from '../services/PvPService';
import { guildWarService } from '../services/GuildWarService';
import { leylineService } from '../services/LeylineService';
import { autoBalanceService } from '../services/AutoBalanceService';
import { mountService } from '../services/MountService';
import { getMountListEmbed, getMountListComponents } from '../commands/general/toaky';
import { getSpiritListEmbed, getSpiritListComponents } from '../commands/general/khilinh';
import { getAchievementCategoryEmbed, getAchievementCategoryComponents } from '../commands/general/thanhtuu';

// Cooldown trong bộ nhớ cho hành động Tu Luyện (Thiền Định)
const practiceCooldowns = new Map<string, number>();

// Bộ nhớ tạm lưu trữ nhật ký chiến đấu của người chơi để xem chi tiết (có TTL 10 phút)
const combatLogsCache = new Map<string, { data: string[]; timestamp: number }>();

// Trạng thái sẵn sàng được import và chia sẻ trực tiếp từ commands/combat/lapdoi

import { CronManager } from '../utils/CronManager';

// Dọn dẹp cache (Garbage collection) mỗi 10 phút để tránh rò rỉ bộ nhớ
CronManager.registerTask('interaction_gc', 600000, () => {
  const now = Date.now();
  for (const [userId, timestamp] of practiceCooldowns.entries()) {
    if (now - timestamp > 60000) practiceCooldowns.delete(userId);
  }
  // Dọn combat log cache hết hạn (TTL 10 phút)
  for (const [userId, entry] of combatLogsCache.entries()) {
    if (now - entry.timestamp > 600000) combatLogsCache.delete(userId);
  }
});

export default class InteractionCreateEvent extends Event<'interactionCreate'> {
  constructor() {
    super('interactionCreate');
  }

  public async execute(client: TuTienClient, interaction: Interaction): Promise<void> {

    // 0. Xử lý Autocomplete trước tiên (không cần lock, không cần check ban/bảo trì/activity)
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && (command as any).autocomplete) {
        try {
          await (command as any).autocomplete(client, interaction);
        } catch (err) {
          console.error(`[Autocomplete Error] Lỗi gợi ý lệnh /${interaction.commandName}:`, err);
        }
      }
      return;
    }

    const userId = interaction.user.id;

    let acquired = false;
    try {
      // Kiểm tra xem người dùng có bị phong ấn (ban) hay không
      const banCheck = db.prepare('SELECT reason FROM banned_users WHERE user_id = ?').get(userId) as { reason: string } | undefined;
      if (banCheck) {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: `🔒 **Trục Xuất Tam Giới:**\n\nLinh hồn của đạo hữu đã bị Thiên Đạo phong ấn (Ban).\n📝 **Lý do:** *${banCheck.reason || 'Không rõ lý do'}*\n\n*Ngươi không thể can thiệp hay thực hiện bất kỳ hành động nào trong tam giới.*`,
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Cập nhật điểm hoạt động của server (Guild Activity Tracking)
      if (interaction.guildId) {
        const now = Math.floor(Date.now() / 1000);
        try {
          db.prepare(`
            INSERT INTO guild_configs (guild_id, interaction_count, last_interaction_at)
            VALUES (?, 1, ?)
            ON CONFLICT(guild_id) DO UPDATE SET interaction_count = interaction_count + 1, last_interaction_at = ?
          `).run(interaction.guildId, now, now);
        } catch (err) {
          console.error('[Activity] Lỗi khi cập nhật điểm hoạt động guild:', err);
        }
      }

      // Các button được quản lý bởi awaitMessageComponent collector (taonhanvat flow, daolu, setup)
      // Phải bỏ qua hoàn toàn ở đây để collector có thể xử lý độc quyền, tránh race condition
      if (interaction.isButton() && (
        interaction.customId.startsWith('bg_') ||
        interaction.customId.startsWith('dest_') ||
        interaction.customId === 'accept_marriage' ||
        interaction.customId === 'decline_marriage' ||
        interaction.customId === 'confirm_reset' ||
        interaction.customId === 'cancel_reset'
      )) {
        return;
      }
      
      // Kiểm tra chế độ bảo trì
      const BOT_OWNER_ID = '724608013981450351';
      const isDeveloper = userId === BOT_OWNER_ID ||
        userId === '888888888888888881' || 
        userId === '888888888888888882' ||
        (client.application?.owner?.id === userId) ||
        (client.application?.owner as any)?.members?.has(userId);

      const isMaintenance = systemConfigService.isMaintenanceMode();
      if (isMaintenance && !isDeveloper) {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: '⚠️ **Hệ Thống Tu Chân Bảo Trì:** Linh khí thiên địa hỗn loạn, đại trận bảo trì đang được kích hoạt. Đạo hữu vui lòng quay lại sau!',
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Lấy khóa chống race condition / spam
      // Defer reply ngay lập tức cho slash commands để tránh Unknown interaction (3s timeout)
      if (interaction.isChatInputCommand() && !interaction.deferred && !interaction.replied) {
        try {
          await interaction.deferReply();
        } catch (deferErr: any) {
          if (deferErr?.code !== 10062 && deferErr?.rawError?.code !== 10062) {
            console.error('[Defer] Lỗi defer reply:', deferErr);
          }
          return;
        }
      }

      if (!InteractionLock.acquire(userId)) {
        if (interaction.isRepliable()) {
          try {
            const msg = '❌ **Thao tác quá nhanh:** Hệ thống đang xử lý hành động trước đó của đạo hữu, vui lòng không spam!';
            if (interaction.deferred) {
              await interaction.editReply({ content: msg });
            } else {
              await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
            }
          } catch (lockErr: any) {
            // Bỏ qua nếu interaction đã được collector xử lý trước (40060) hoặc hết hạn (10062)
            if (lockErr?.code !== 10062 && lockErr?.code !== 40060 &&
                lockErr?.rawError?.code !== 10062 && lockErr?.rawError?.code !== 40060) {
              console.error('[InteractionLock] Lỗi khi reply spam warning:', lockErr);
            }
          }
        }
        return;
      }

      acquired = true;

      // Auto-claim daily login reward on first interaction of the day
      try {
        const today = new Date().toLocaleDateString('en-CA');
        const loginRecord = db.prepare('SELECT last_login_date FROM user_daily_logins WHERE user_id = ?').get(interaction.user.id) as any;
        if (!loginRecord || loginRecord.last_login_date !== today) {
          const { dailyLoginService } = require('../services/DailyLoginService');
          const loginResult = dailyLoginService.claimLogin(interaction.user.id);
          if (loginResult.success && loginResult.message) {
            setTimeout(() => {
              interaction.user.send({ content: loginResult.message }).catch(() => {});
            }, 1000);
          }
        }
      } catch (e) {}

      // 1. Xử lý Slash Command (Chat Input Command)
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`[Interaction] Lệnh /${interaction.commandName} không tìm thấy trong bộ nhớ.`);
          await interaction.reply({ content: 'Lệnh không tồn tại hoặc đã bị gỡ bỏ.', flags: MessageFlags.Ephemeral });
          return;
        }

        try {
          console.log(`[Command Exec] Người dùng ${interaction.user.tag} (${interaction.user.id}) sử dụng: /${interaction.commandName}`);
          await command.execute(client, interaction);
        } catch (error) {
          console.error(`[Command Error] Lỗi khi thực thi lệnh /${interaction.commandName}:`, error);
          const errorMessage = 'Đã xảy ra lỗi khi thực thi lệnh này! Vui lòng thử lại sau.';
          if (interaction.replied || interaction.deferred) {
            try { await interaction.editReply({ content: errorMessage }); } catch (_) {}
          } else {
            try { await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }); } catch (_) {}
          }
        }
        return;
      }

      // 2. Xử lý Nút bấm (Button Interactions) & Menu Chọn (SelectMenu)
      if (
        interaction.isButton() || 
        (interaction.isStringSelectMenu() && (
          interaction.customId.startsWith('hosoaction_') ||
          interaction.customId.startsWith('hosoaction1_') ||
          interaction.customId.startsWith('hosoaction2_') ||
          interaction.customId.startsWith('traveler_buy_item_') ||
          interaction.customId.startsWith('destiny_equip_') ||
          interaction.customId.startsWith('destiny_unequip_') ||
          interaction.customId.startsWith('dueluseitem_') ||
          interaction.customId.startsWith('enhance_select_') ||
          interaction.customId.startsWith('linhmach_select_') ||
          interaction.customId.startsWith('anky_select_') ||
          interaction.customId.startsWith('dungkynang_select_') ||
          interaction.customId.startsWith('doitienselect_') ||
          interaction.customId.startsWith('pb_') ||
          interaction.customId.startsWith('bptselect_') ||
          interaction.customId.startsWith('adminpanel_') ||
          interaction.customId.startsWith('adminuser_') ||
          interaction.customId.startsWith('adminfixpets_') ||
          interaction.customId.startsWith('alch_select_')
        ))
      ) {
        let customId = interaction.customId;
        if (interaction.isStringSelectMenu() && (customId.startsWith('hosoaction_') || customId.startsWith('hosoaction1_') || customId.startsWith('hosoaction2_'))) {
          customId = `${interaction.values[0]}_${customId.split('_')[1]}`;
        }

        const specialActions = [
          'traveler_buy_item',
          'traveler_buy',
          'traveler_rob',
          'destiny_equip',
          'destiny_unequip',
          'dueluseitem',
          'duelchoose',
          'worldbossattack',
          'bossshop_buy',
          'enhance_select',
          'enhance_confirm',
          'enhance_cancel',
          'linhmach_select',
          'linhmach_close',
          'anky_select',
          'dungkynang_select',
          'dungkynang_cancel',
          'adminpanel',
          'adminuser',
          'adminfixpets',
          'titleswitch',
          'ngotinh_activate',
          'ngotinh_reroll_execute'
        ];

        let action = '';
        let parts: string[] = [];

        const matchedSpecial = specialActions.find(prefix => customId.startsWith(prefix + '_') || customId === prefix);
        if (matchedSpecial) {
          action = matchedSpecial;
          const suffix = customId.substring(matchedSpecial.length + 1);
          parts = [matchedSpecial, ...suffix.split('_')];
        } else {
          parts = customId.split('_');
          action = parts[0];
        }

        if (action === 'adminpanel' || action === 'adminuser' || action === 'adminfixpets' || action === 'admincheckorphan') {
          const AdminCommand = require('../commands/general/admin').default;
          await AdminCommand.handleInteraction(client, interaction, action, parts);
          return;
        }

      let targetUserId = '';
      let pageNum = 1;

      // Phân tách tham số nút tùy biến
      // QUY TẮC: userId luôn là PHẦN TỬ CUỐI CÙNG trong parts (trừ các nút public)
      if (action === 'invprev' || action === 'invnext') {
        pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
        targetUserId = parts[parts.length - 1];
      } else if (action === 'mountprev' || action === 'mountnext' || action === 'spiritprev' || action === 'spiritnext') {
        pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
        targetUserId = parts[parts.length - 1];
      } else if (action === 'achprev' || action === 'achnext') {
        pageNum = Math.max(1, parseInt(parts[2], 10) || 1);
        targetUserId = parts[parts.length - 1];
      } else if (action === 'loi') {
        targetUserId = parts[parts.length - 1];
      } else if (action === 'lamviecwork') {
        // customId: lamviecwork_<jobType>_<userId>
        targetUserId = parts[parts.length - 1];
      } else {
        targetUserId = parts[parts.length - 1];
      }

      // Nút bấm công khai thế giới hoặc quyết đấu
      const isPublicAction = [
        'worldbossattack', 'duelaccept', 'duelrefuse', 'duelchoose', 'duellichsu',
        'trade', 'suachua', 'traveler_buy', 'traveler_buy_item', 'traveler_rob',
        'joinparty', 'leaveparty', 'startparty', 'edenter', 'edattack', 'edretreat',
        'noituskip',
        'bossshop',
        'bossshop_buy',
      ].includes(action);

      if (isPublicAction) {
        targetUserId = interaction.user.id;
      }

      // Nút công khai không cần kiểm tra sở hữu, giữ nguyên targetUserId từ customId
      const skipOwnershipCheck = [
        'worldbossrefresh', 'worldbosslb',
      ].includes(action);

      // Bảo mật: Chỉ cho phép người sở hữu hồ sơ nhấn nút tương tác
      if (!isPublicAction && !skipOwnershipCheck) {
        const { ValidationUtils } = require('../utils/ValidationUtils');
        const isOwner = await ValidationUtils.verifyOwnership(interaction as any, targetUserId);
        if (!isOwner) return;
      }

      const user = userRepository.get(targetUserId);
      if (!user) {
        await interaction.reply({
          content: '❌ Đạo hữu chưa khởi tạo nhân vật hoặc đã bị xóa khỏi thế giới.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      try {
        // --- Nút: TẤN CÔNG BOSS THẾ GIỚI (cả Global và Command) ---
        if (action === 'worldbossattack') {
          // Phân biệt: worldbossattack_global (nút global từ BossSpawnService) vs worldbossattack_userId_free/pay (từ /worldboss)
          const isGlobal = parts[1] === 'global';
          const isFree = parts[2] === 'free';
          const isPay = parts[2] === 'pay';
          
          const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
          if (!boss || boss.status === 'defeated') {
            await interaction.reply({ content: '❌ World Boss đã bị tiêu diệt hoặc chưa xuất thế!', flags: MessageFlags.Ephemeral });
            return;
          }

          const user = userRepository.get(interaction.user.id);
          if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!', flags: MessageFlags.Ephemeral });
            return;
          }

          // Kiểm tra Cooldown cho đòn đánh (áp dụng cho cả Global button)
          const now = Math.floor(Date.now() / 1000);

          if (user.injury_end_time && user.injury_end_time > now) {
            const remain = user.injury_end_time - now;
            const minutes = Math.ceil(remain / 60);
            await interaction.reply({ content: `❌ Đạo hữu đang bị **Trọng Thương**! Cần tĩnh dưỡng thêm **${minutes} phút** mới có thể tiếp tục khiêu chiến World Boss.`, flags: MessageFlags.Ephemeral });
            return;
          }

          const contrib = db.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
            .get(interaction.user.id) as { last_attack_at: number } | undefined;
            
          // Cooldown 200s
          if (contrib && now - contrib.last_attack_at < 200) {
            const cdSec = 200 - (now - contrib.last_attack_at);
            await interaction.reply({ content: `⏳ Đạo hữu đang kiệt sức. Cần **${cdSec} giây** nữa để hồi phục!`, flags: MessageFlags.Ephemeral });
            return;
          }

          // Lấy chỉ số chiến đấu thực tế của người chơi
          const activeStats = inventoryService.getActiveStats(interaction.user.id);
          if (!activeStats) {
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!', flags: MessageFlags.Ephemeral });
            return;
          }

          // Auto-balance PvE: scale boss stats theo player power (tương tự full combat path)
          const pveScale = autoBalanceService.getPvEScaleFactor(interaction.user.id);

          // Chạy lượt đánh nhanh (Live Raid Hit) — wrapped in transaction to prevent race condition
          const bossTx = db.transaction(() => {
            const bossRow = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
            if (!bossRow || bossRow.status === 'defeated') return { error: 'defeated' as const };

            // ── Boss Enrage: HP < 50% → ATK tăng 30% ──
            const hpPercent = bossRow.max_hp > 0 ? bossRow.hp / bossRow.max_hp : 1;
            const isEnraged = hpPercent < 0.5;
            const enrageMultiplier = isEnraged ? 1.30 : 1.0;

            // ── Level-scaled DEF multiplier: boss càng cao cấp, DEF càng cứng ──
            const levelDefBonus = 1 + (bossRow.level - 1) * 0.03;

            const isCrit = Math.random() < (activeStats.crit + activeStats.luck * 0.001);
            const effectiveDef = Math.round(bossRow.def * pveScale * levelDefBonus);
            const defRatio = effectiveDef / (activeStats.atk + effectiveDef);
            const reduction = Math.min(0.85, defRatio);
            let rawDmg = Math.max(1, Math.round(activeStats.atk * (1 - reduction)));
            rawDmg = Math.round(rawDmg * (0.85 + Math.random() * 0.3));
            if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

            const pet = db.prepare('SELECT name, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1')
              .get(interaction.user.id) as { name: string; base_atk: number } | undefined;
            const petDmg = pet ? Math.round(pet.base_atk * (0.9 + Math.random() * 0.2)) : 0;

            const totalDmg = rawDmg + petDmg;
            const newHp = Math.max(0, bossRow.hp - totalDmg);
            const isDefeated = newHp <= 0;

            if (isDefeated) {
              db.prepare("UPDATE world_boss SET hp = 0, status = 'defeated', defeated_at = ?, defeated_by = ? WHERE id = 'world_boss_current'")
                .run(now, interaction.user.id);
            } else {
              db.prepare("UPDATE world_boss SET hp = ? WHERE id = 'world_boss_current'").run(newHp);
            }

            const playerContrib = db.prepare("SELECT damage, attacks FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
              .get(interaction.user.id) as { damage: number; attacks: number } | undefined;

            if (playerContrib) {
              db.prepare(`
                UPDATE world_boss_contributions
                SET damage = damage + ?, attacks = attacks + 1, last_attack_at = ?
                WHERE user_id = ? AND boss_id = 'world_boss_current'
              `).run(totalDmg, now, interaction.user.id);
            } else {
              db.prepare(`
                INSERT INTO world_boss_contributions (user_id, boss_id, damage, attacks, last_attack_at)
                VALUES (?, 'world_boss_current', ?, 1, ?)
              `).run(interaction.user.id, totalDmg, now);
            }

            return { boss: bossRow, isCrit, totalDmg, isDefeated, pet, petDmg, isEnraged };
          });

          const txResult = bossTx();
          if ('error' in txResult) {
            await interaction.reply({ content: '❌ World Boss đã bị tiêu diệt hoặc chưa xuất thế!', flags: MessageFlags.Ephemeral });
            return;
          }

          const { boss: currentBossData, isCrit, totalDmg, isDefeated, pet, petDmg, isEnraged } = txResult;

          // Tính rank dựa trên tổng damage thực tế từ DB (đã bao gồm đòn hiện tại sau transaction)
          const allContribs = db.prepare("SELECT user_id, damage FROM world_boss_contributions WHERE boss_id = 'world_boss_current' ORDER BY damage DESC")
            .all() as { user_id: string; damage: number }[];
          const currentRank = allContribs.findIndex(c => c.user_id === interaction.user.id) + 1;

          // ── Phản phệ: % máu hiện tại * rank ──
          const bossLevel = currentBossData.level || 1;
          const playerCurHp = user.hp ?? activeStats.hp;
          const playerMaxHp = activeStats.hp;
          const hpPercent = playerMaxHp > 0 ? playerCurHp / playerMaxHp : 1;
          const rankReflectMulti = Math.max(0.5, 1.5 - currentRank * 0.1); // rank 1: 1.4, rank 5: 1.0, rank 10: 0.5
          const reflectDmg = Math.round(playerMaxHp * hpPercent * 0.12 * rankReflectMulti);

          // ── Trọng thương scale theo cấp boss ──
          const baseInjuryChance = activeStats.hp < (currentBossData.atk * 5) ? 0.30 : 0.12;
          const injuryChance = Math.min(0.60, baseInjuryChance + bossLevel * 0.02);
          const isInjured = Math.random() < injuryChance;
          const injuryDuration = 600; // 10 phút cố định

          // Thưởng Ngộ Tính theo hạng: top 3 nhận nhiều hơn vì chịu phản phệ lớn hơn
          const ngoTinhBonus = currentRank <= 3 ? 5 : 3;

          const updatedUser = userRepository.get(interaction.user.id)!;
          
          // Áp dụng sát thương phản phệ lên HP người chơi
          const newHp = Math.max(1, (updatedUser.hp || updatedUser.base_hp) - reflectDmg);
          
          const updates: any = {
            hp: isInjured ? 1 : newHp,
            ngotinh: updatedUser.ngotinh + ngoTinhBonus
          };

          if (isInjured) {
            updates.injury_end_time = now + injuryDuration;
          }

          userRepository.update(interaction.user.id, updates);

          // Cập nhật tiến trình nhiệm vụ hàng ngày
          dailyQuestService.updateProgress(interaction.user.id, 'daily_worldboss', 1);

          // Ghi nhận đòn đánh Boss và cập nhật thành tựu tương ứng
          combatService.recordBossAttack(interaction.user.id, currentBossData.level, totalDmg);
          if (isDefeated) {
            combatService.recordBossKill(interaction.user.id, currentBossData.level);
          }

          // Ghi log tấn công cho nhật ký chiến đấu UI
          const bossHpAfter = Math.max(0, currentBossData.hp - totalDmg);
          combatService.logBossAttack(interaction.user.id, totalDmg, isCrit ? 'Bạo Kích' : 'Công Kích', isCrit, bossHpAfter / (currentBossData.max_hp || 1));

          // Cập nhật lại Boss embeds ở tất cả các Guild
          const currentBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
          await bossSpawnService.updateBossEmbeds(client, currentBoss);

          // Nếu boss bị tiêu diệt -> phân phát phần thưởng và thông báo phong thần
          let rewardsText = '';
          if (isDefeated) {
            try {
              const rewardsLogs = combatService.distributeWorldBossRewards(currentBossData.level, interaction.user.id);
              rewardsText = `\n\n🏆 **BẢNG PHONG THẦN THẢO PHẠT BOSS (LEVEL ${currentBossData.level}):**\n` + 
                            (rewardsLogs.length > 0 ? rewardsLogs.join('\n') : '*Không có phần thưởng.*');
              try {
                await bossSpawnService.broadcastBossDefeatedLogs(client, currentBoss, rewardsLogs);
              } catch (broadcastErr) {
                console.error('[WorldBoss] Lỗi broadcast:', broadcastErr);
              }
            } catch (rewardErr) {
              console.error('[WorldBoss] Lỗi phân phát thưởng:', rewardErr);
              rewardsText = `\n\n🏆 **BOSS ĐÃ BỊ TIÊU DIỆT!** (Lỗi hiển thị phần thưởng)`;
            }
          }

          // Trả lời đòn đánh thành công
          const petText = pet ? ` (Sủng thú **${pet.name}** phụ trợ +${petDmg})` : '';
          const critText = isCrit ? ' **[BẠO KÍCH]** 💥' : '';
          const rankText = ` 🏆 **(Hạng #${currentRank})**`;
          const enrageText = isEnraged ? '\n🔴 **MA KHÍ BỪNG SỨC!** Boss đã Enrage — ATK tăng 30%!' : '';
          const reflectText = `\n⚡ **Phản Phệ:** Đạo hữu chịu **-${reflectDmg}** sát thương phản chấn từ Boss (Lv.${bossLevel})!`;
          const injuryMin = Math.floor(injuryDuration / 60);
          const injuryText = isInjured ? `\n🚨 **Chấn Thương:** Phản phệ chấn động kinh mạch, bị **Trọng Thương trong ${injuryMin} phút**!` : '';
          
          await interaction.reply({
            content: `💥 Đạo hữu **${updatedUser.name}** vung đòn tấn công Boss thế giới, gây **-${totalDmg}** sát thương lên Boss${critText}${rankText}!${petText}${enrageText}${reflectText}${injuryText}\n🧘 Nhận được **+${ngoTinhBonus}** Điểm Ngộ Tính!${rewardsText}`
          });
          return;
        }

        // --- LỮ KHÁCH THẦN BÍ ---
        else if (action === 'traveler_buy') {
          const eventId = parseInt(parts[1], 10);
          const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
          if (!event || event.status !== 'active') {
            await interaction.reply({ content: '❌ Lữ Khách đã không còn ở đây nữa!', flags: MessageFlags.Ephemeral });
            return;
          }

          let inventory: Record<string, any> = {};
          try { inventory = JSON.parse(event.inventory || '{}'); } catch (e) {}

          const options = [];
          for (const [id, item] of Object.entries(inventory)) {
            if (item.quantity > 0) {
              options.push({
                label: `${item.name} (${item.price} LT)`,
                description: `Còn lại: ${item.quantity}`,
                value: item.id
              });
            }
          }

          if (options.length === 0) {
            await interaction.reply({ content: '❌ Lữ Khách đã hết sạch hàng!', flags: MessageFlags.Ephemeral });
            return;
          }

          const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`traveler_buy_item_${eventId}`)
            .setPlaceholder('Chọn vật phẩm muốn mua')
            .addOptions(options);

          const row = new ActionRowBuilder().addComponents(selectMenu);
          await interaction.reply({ components: [textToV2('Đạo hữu muốn mua gì?'), row], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
        else if (action === 'traveler_buy_item' && interaction.isStringSelectMenu()) {
          const eventId = parseInt(parts[1], 10);
          const itemId = interaction.values[0];
          const { travelerService } = require('../services/TravelerService');
          
          try {
            const result = travelerService.buyItem(interaction.user.id, eventId, itemId, 1);
            if (result.success) {
              await safeV2TextUpdate(interaction, result.message);
            
            // Nếu mua thành công, thử update message gốc
            try {
              const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
              if (event && event.message_id && event.channel_id && /^\d{17,20}$/.test(event.channel_id)) {
                const channel = await interaction.client.channels.fetch(event.channel_id) as any;
                if (channel) {
                  const msg = await channel.messages.fetch(event.message_id).catch(() => null);
                  if (msg) {
                    let inv: Record<string, any> = {};
                    try { inv = JSON.parse(event.inventory || '{}'); } catch (e) {}
                    
                    const { EmbedBuilder } = require('discord.js');
                    const embed = EmbedBuilder.from(msg.embeds[0]);
                    
                    if (event.status === 'sold_out') {
                      embed.setTitle('👺 Lữ Khách Thần Bí (Đã Rời Đi)');
                      embed.setDescription('Lữ Khách đã bán hết sạch hàng và rời đi.');
                      embed.setFields([]);
                      await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [] } });
                    } else {
                      const newFields = { name: '💰 Hàng Hoá', value: Object.values(inv).map((i: any) => `- **${i.name}** (Còn: ${i.quantity}) - Giá: ${i.price} LT`).join('\n') };
                      embed.setFields([newFields]);
                      // Giữ lại nút mua/cướp cho người khác
                      const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
                      const buyBtn = new ButtonBuilder()
                        .setCustomId(`traveler_buy_${eventId}`)
                        .setLabel('💰 Giao Dịch')
                        .setStyle(ButtonStyle.Success);
                      const robBtn = new ButtonBuilder()
                        .setCustomId(`traveler_rob_${eventId}`)
                        .setLabel('⚔️ Cướp Đoạt')
                        .setStyle(ButtonStyle.Danger);
                      const row = new ActionRowBuilder().addComponents(buyBtn, robBtn);
                      await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [row.toJSON()] } });
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Update traveler message failed', e);
            }
          } else {
            await safeV2TextUpdate(interaction, `❌ ${result.message}`);
          }
          } catch (buyErr: any) {
            console.error('[TravelerBuy] Lỗi mua hàng:', buyErr);
            try {
              if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Có lỗi xảy ra khi mua hàng từ Lữ Khách!', flags: MessageFlags.Ephemeral });
              } else {
                await interaction.reply({ content: '❌ Có lỗi xảy ra khi mua hàng từ Lữ Khách!', flags: MessageFlags.Ephemeral });
              }
            } catch (_) {}
          }
        }
        else if (action === 'traveler_rob') {
          const eventId = parseInt(parts[1], 10);
          const { travelerService } = require('../services/TravelerService');
          const result = travelerService.challengeTraveler(interaction.user.id, eventId);

          if (result.success) {
            await interaction.reply({ content: result.message });
            // Cập nhật tin nhắn gốc thành bị đánh bại
            try {
              const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
              if (event && event.message_id && event.channel_id && /^\d{17,20}$/.test(event.channel_id)) {
                const channel = await interaction.client.channels.fetch(event.channel_id) as any;
                if (channel) {
                  const msg = await channel.messages.fetch(event.message_id).catch(() => null);
                  if (msg) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = EmbedBuilder.from(msg.embeds[0]);
                    embed.setTitle('👺 Lữ Khách Thần Bí (Đã Bỏ Chạy)');
                    embed.setDescription(`Lữ Khách đã bị **${interaction.user.username}** đánh bại và cướp sạch hàng hoá!`);
                    embed.setFields([]);
                    await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [] } });
                  }
                }
              }
            } catch (e) {}
          } else {
            await interaction.reply({ content: result.message });
          }
        }

        // --- CƯỜNG HÓA TRANG BỊ ---
        else if (action === 'enhance_select' && interaction.isStringSelectMenu()) {
          const inventoryId = parseInt(interaction.values[0], 10);
          const CuongHuaCommand = require('../commands/general/cuonghoa').default;
          const preview = CuongHuaCommand.buildEnhancePreview(targetUserId, inventoryId);
          await safeV2Update(interaction, [preview.embed], preview.rows);
        }
        else if (action === 'enhance_confirm') {
          const inventoryId = parseInt(parts[1], 10);
          const { enhanceService } = require('../services/EnhanceService');
          const result = enhanceService.enhanceItem(targetUserId, inventoryId);
          
          const CuongHuaCommand = require('../commands/general/cuonghoa').default;
          const preview = CuongHuaCommand.buildEnhancePreview(targetUserId, inventoryId, result);
          
          await safeV2Update(interaction, [preview.embed], preview.rows);
        }
        else if (action === 'enhance_cancel') {
          await safeV2TextUpdate(interaction, '📴 Đã đóng giao diện cường hóa trang bị.');
        }
        else if (action === 'linhmach_select' && interaction.isStringSelectMenu()) {
          const selected = interaction.values[0];
          const target = selected === 'cancel' ? null : selected;
          const { leylineService } = require('../services/LeylineService');
          const result = leylineService.setChanneling(targetUserId, target);

          const { buildLeylineEmbed, buildLeylineComponents } = require('../commands/general/linhmach');
          const updatedEmbed = buildLeylineEmbed(targetUserId);
          const updatedComponents = buildLeylineComponents(targetUserId);

          await safeV2Update(interaction, [updatedEmbed], updatedComponents);
          if (result.success) {
            await interaction.followUp({ content: `✅ ${result.message}`, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.followUp({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          }
        }
        else if (action === 'linhmach_close') {
          await safeV2TextUpdate(interaction, '📴 Đã đóng giao diện Linh Mạch Địa Đồ.');
        }
        else if (action === 'anky_select' && interaction.isStringSelectMenu()) {
          const inventoryId = parseInt(interaction.values[0], 10);
          const { soulImprintService } = require('../services/SoulImprintService');
          const result = soulImprintService.imprintItem(targetUserId, inventoryId);
          if (result.success) {
            await safeV2TextUpdate(interaction, `✅ ${result.message}`);
          } else {
            await safeV2TextUpdate(interaction, `❌ ${result.message}`);
          }
        }
        else if (action === 'dungkynang_select' && interaction.isStringSelectMenu()) {
          const bookId = interaction.values[0];
          const result = DungKyNangCommand.learnSkill(targetUserId, bookId);

          if (!result.success) {
            await safeV2TextUpdate(interaction, result.message);
          } else {
            await safeV2Update(interaction, [result.embed!]);
          }
        }
        else if (action === 'dungkynang_cancel') {
          await safeV2TextUpdate(interaction, '📴 Đã đóng giao diện Lĩnh Ngộ Kỹ Năng.');
        }
        else if (action === 'doitienselect' && interaction.isStringSelectMenu()) {
          const selectedValue = interaction.values[0];
          
          const modal = new ModalBuilder()
            .setCustomId(`doitienmodal_${targetUserId}_${selectedValue}`)
            .setTitle('Phường Thị Đổi Tiền');

          const qtyInput = new TextInputBuilder()
            .setCustomId('doitien_qty')
            .setLabel('Số lượng lần muốn đổi')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nhập số lượng lớn hơn 0 (ví dụ: 1)')
            .setValue('1')
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
          );

          await interaction.showModal(modal);
        }

        // --- MỆNH CÁCH (DESTINY) ---
        else if (action === 'destiny_equip' || action === 'destiny_unequip') {
          const { destinyRepository } = require('../database/repositories/DestinyRepository');
          const { destinyService } = require('../services/DestinyService');
          
          if (interaction.isStringSelectMenu()) {
            const value = interaction.values[0];
            
            if (action === 'destiny_equip') {
              const destinyIdToEquip = parseInt(value.replace('equip_', ''));
              const realmDetails = getRealmDetails(user.level);
              const maxSlots = destinyService.getMaxSlotsByRealm(realmDetails.realmName);
              
              const equipped = destinyRepository.getUserDestinies(targetUserId).filter((d: any) => d.is_equipped === 1);
              
              if (equipped.length >= maxSlots) {
                await interaction.reply({ content: `❌ Đạo hữu chỉ có tối đa ${maxSlots} khe cắm Mệnh Cách ở cảnh giới hiện tại.`, flags: MessageFlags.Ephemeral });
                return;
              }
              
              // Tìm slot trống đầu tiên
              let emptySlot = 1;
              for (let i = 1; i <= maxSlots; i++) {
                if (!equipped.find((d: any) => d.slot === i)) {
                  emptySlot = i;
                  break;
                }
              }
              
              destinyRepository.update(destinyIdToEquip, { is_equipped: 1, slot: emptySlot });
              await interaction.reply({ content: `✅ Đã trang bị Mệnh Cách vào khe cắm [${emptySlot}]!`, flags: MessageFlags.Ephemeral });
              
            } else if (action === 'destiny_unequip') {
              const slotToUnequip = parseInt(value.replace('unequip_', ''));
              destinyRepository.unequipSlot(targetUserId, slotToUnequip);
              await interaction.reply({ content: `✅ Đã tháo Mệnh Cách ở khe cắm [${slotToUnequip}]!`, flags: MessageFlags.Ephemeral });
            }
          }
          return;
        }

        // --- ĐỔI DANH HIỆU (TITLE SWITCH) ---
        else if (action === 'titleswitch') {
          const { achievementService } = require('../services/AchievementService');
          const titleName = parts.slice(1).join('_').replace(/_/g, ' ');
          
          const result = achievementService.setTitle(targetUserId, titleName);
          if (result.success) {
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          }
          return;
        }

        // --- NGỘ TÍNH BUFF ACTIVATE ---
        else if (action === 'ngotinh_activate') {
          const buffId = parts[1];
          const targetUserId = parts[2];
          if (interaction.user.id !== targetUserId) {
            await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể kích hoạt buff!', flags: MessageFlags.Ephemeral });
            return;
          }
          const { ngoTinhService } = require('../services/NgoTinhService');
          const result = ngoTinhService.activateBuff(targetUserId, buffId);
          if (result.success) {
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          }
          return;
        }

        // --- NGỘ TÍNH REROLL LINH CĂN ---
        else if (action === 'ngotinh_reroll_execute') {
          const targetUserId = parts[1];
          const lockElement = parts[2] === 'none' ? null : parts.slice(2).join('_');
          if (interaction.user.id !== targetUserId) {
            await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể reroll!', flags: MessageFlags.Ephemeral });
            return;
          }

          const user = userRepository.get(targetUserId);
          if (!user) {
            await interaction.reply({ content: '❌ Không tìm thấy nhân vật!', flags: MessageFlags.Ephemeral });
            return;
          }

          const baseCost = 20;
          const lockCost = lockElement ? 10 : 0;
          const totalCost = baseCost + lockCost;
          const ngotinh = user.ngotinh || 0;

          if (ngotinh < totalCost) {
            await interaction.reply({ content: `❌ Không đủ Ngộ Tính! Cần: ${totalCost}, Có: ${ngotinh}`, flags: MessageFlags.Ephemeral });
            return;
          }

          // Tạo linh căn mới
          const elements = ['Hỏa', 'Thủy', 'Mộc', 'Thổ', 'Lôi', 'Phong'];
          let oldLinhCan: Record<string, number> = {};
          try { oldLinhCan = JSON.parse(user.linh_can || '{}'); } catch {}

          let newLinhCan: Record<string, number> = {};
          if (lockElement && oldLinhCan[lockElement]) {
            // Giữ nguyên element được lock, reroll phần còn lại
            const lockedValue = oldLinhCan[lockElement];
            const remaining = 100 - lockedValue;
            const otherElements = elements.filter(e => e !== lockElement);
            let allocated = 0;
            for (let i = 0; i < otherElements.length - 1; i++) {
              const maxAlloc = remaining - allocated - (otherElements.length - 1 - i);
              const val = Math.floor(Math.random() * Math.max(1, maxAlloc + 1));
              newLinhCan[otherElements[i]] = val;
              allocated += val;
            }
            newLinhCan[otherElements[otherElements.length - 1]] = remaining - allocated;
            newLinhCan[lockElement] = lockedValue;
          } else {
            // Reroll toàn bộ
            let allocated = 0;
            for (let i = 0; i < elements.length - 1; i++) {
              const maxAlloc = 100 - allocated - (elements.length - 1 - i);
              const val = Math.floor(Math.random() * Math.max(1, maxAlloc + 1));
              newLinhCan[elements[i]] = val;
              allocated += val;
            }
            newLinhCan[elements[elements.length - 1]] = 100 - allocated;
          }

          userRepository.update(targetUserId, {
            linh_can: JSON.stringify(newLinhCan),
            ngotinh: ngotinh - totalCost
          });

          const { formatLinhCan } = require('../utils/constants');
          const oldFormatted = formatLinhCan(JSON.stringify(oldLinhCan));
          const newFormatted = formatLinhCan(JSON.stringify(newLinhCan));

          const embed = new EmbedBuilder()
            .setTitle('💡 Reroll Linh Căn Thành Công!')
            .setColor(EMBED_COLORS.SUCCESS)
            .addFields(
              { name: '🔮 Linh Căn Cũ', value: oldFormatted },
              { name: '✨ Linh Căn Mới', value: newFormatted },
              { name: '💡 Chi Phí', value: `**${totalCost}** NT` }
            );

          await interaction.reply({ embeds: [embed] });
          return;
        }

        // --- Nút: QUYẾT ĐẤU (TAM HỒI LINH CHIẾN) ---
        else if (['duelaccept', 'duelrefuse', 'duelchoose', 'dueluseitem', 'duellichsu'].includes(action)) {
          const { DuelInteractionHandler } = require('../handlers/interactions/DuelInteractionHandler');
          await DuelInteractionHandler.handle(interaction, action, parts);
          return;
        }

        // --- GỌI CÁC HANDLERS DỰA VÀO ACTION ---
        const cultivationActions = ['luanhoiconfirm', 'luanhoicancel', 'ycanhawaken', 'tuluyen', 'dotpha', 'loi', 'taytuynav', 'taytuyexecute', 'taytuy', 'select', 'confirmalignment', 'dotpharisk', 'dotphastabilize'];
        const profileActions = ['hosotab', 'hosoback', 'hosolb'];
        const lifeActions = ['alch'];
        const casinoActions = ['casinoplay', 'casinodouble', 'casinoopposite', 'casinoreplay'];
        const tradeActions = ['trade'];

        if (cultivationActions.includes(action)) {
          const { CultivationInteractionHandler } = require('../handlers/interactions/CultivationInteractionHandler');
          await CultivationInteractionHandler.handle(interaction, action, parts, targetUserId);
          return;
        }

        if (profileActions.includes(action)) {
          const { ProfileInteractionHandler } = require('../handlers/interactions/ProfileInteractionHandler');
          await ProfileInteractionHandler.handle(interaction, action, parts, targetUserId);
          return;
        }

        if (lifeActions.includes(action)) {
          const { LifeInteractionHandler } = require('../handlers/interactions/LifeInteractionHandler');
          await LifeInteractionHandler.handle(interaction, action, parts, targetUserId);
          return;
        }

        if (casinoActions.includes(action)) {
          const { CasinoInteractionHandler } = require('../handlers/interactions/CasinoInteractionHandler');
          await CasinoInteractionHandler.handle(interaction as any, action, parts, targetUserId);
          return;
        }

        if (tradeActions.includes(action)) {
          const { TradeInteractionHandler } = require('../handlers/interactions/TradeInteractionHandler');
          await TradeInteractionHandler.handle(interaction as any, action, parts, targetUserId);
          return;
        }

        // --- Nút Bỏ phiếu Bỏ qua Nối Từ ---
        if (action === 'noituskip') {
          const gameKey = parts.slice(1).join('_');
          if (!gameKey) {
            await interaction.reply({ content: '❌ Lỗi thiếu thông tin game.', flags: 64 });
            return;
          }

          // Save winner info before executeSkip clears it
          const gameBefore = noituService.getGame(gameKey);
          const winnerName = gameBefore?.lastAnswererName || '';

          const result = noituService.handleSkipVote(gameKey, interaction.user.id);
          const game = noituService.getGame(gameKey);

          if (result === 'no_game') {
            await interaction.reply({ content: '❌ Không có ván Nối Từ nào!', flags: 64 });
            return;
          }

          if (result === 'already_voted') {
            await interaction.reply({ content: 'Bạn đã bỏ phiếu bỏ qua từ này rồi!', flags: 64 });
            return;
          }

          if (result === 'voted' && game) {
            const updatedEmbed = noituService.buildSkipVoteEmbed(game);
            const updatedRow = noituService.buildSkipVoteRow(gameKey);
            await safeV2Update(interaction, [updatedEmbed], [updatedRow]);
            return;
          }

          if (result === 'skip_passed') {
            if (game) {
              const passedEmbed = noituService.buildSkipPassedEmbed(winnerName, game);
              await safeV2Update(interaction, [passedEmbed], []);
            }
            return;
          }
          return;
        }

        // --- Nút Bảng Phong Thần ---
        else if (action === 'bpt') {
          const subType = parts[1];
          const page = parseInt(parts[2], 10) || 1;
          const targetUserId = parts[parts.length - 1];

          const { buildLeaderboardUpdate } = require('../commands/general/bangphongthan');
          const updateOptions = buildLeaderboardUpdate(targetUserId, subType, page);

          await safeV2Update(interaction, updateOptions.embeds, updateOptions.components);
          return;
        }

        // --- Dropdown Bảng Phong Thần ---
        else if (action === 'bptselect' && interaction.isStringSelectMenu()) {
          const category = interaction.values[0];
          const targetUserId = parts[1];

          const { buildLeaderboardUpdate } = require('../commands/general/bangphongthan');
          const updateOptions = buildLeaderboardUpdate(targetUserId, category, 1);

          await safeV2Update(interaction, updateOptions.embeds, updateOptions.components);
          return;
        }

        // --- Nút Động Phủ ---
        else if (action === 'dongphu') {
          const sub = parts[1]; // 'spring', 'harvest', 'up'
          const { buildDongPhuEmbed, buildDongPhuComponents } = require('../commands/general/dongphu');
          const { caveService } = require('../services/CaveService');
          const { caveEnhancementService } = require('../services/CaveEnhancementService');

          let result: { success: boolean; message: string };

          if (sub === 'spring') {
            result = caveService.collectSpring(targetUserId);
          } else if (sub === 'harvest') {
            result = caveEnhancementService.claimMeridianResources(targetUserId);
          } else if (sub === 'up') {
            const bld = parts[2]; // 'spring', 'meridian', 'array'
            result = caveEnhancementService.upgradeBuilding(targetUserId, bld as any);
          } else {
            return;
          }

          if (result.success) {
            const updatedEmbed = buildDongPhuEmbed(targetUserId);
            const updatedComponents = buildDongPhuComponents(targetUserId);
            await safeV2Update(interaction, [updatedEmbed], updatedComponents);
            await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          }
          return;
        }

        // --- Nút: MỞ TÚI ĐỒ ---
        else if (action === 'tuido') {
          try {
            await interaction.deferUpdate();
            const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, 1);
            const components = getInventoryComponents(targetUserId, 1, totalPages, itemsOnPage);
            await interaction.editReply(toV2Payload([embed], components));
          } catch (e: any) {
            console.error('[tuido] Lỗi mở túi đồ:', e?.message || e);
          }
        }

        // --- Nút: PHÂN TRANG TÚI ĐỒ (Lùi / Tiến) ---
        else if (action === 'invprev' || action === 'invnext') {
          try {
            await interaction.deferUpdate();
            const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, pageNum);
            const components = getInventoryComponents(targetUserId, pageNum, totalPages, itemsOnPage);
            await interaction.editReply(toV2Payload([embed], components));
          } catch (e: any) {
            console.error('[invpage] Lỗi phân trang túi đồ:', e?.message || e);
          }
        }

        // --- Nút: PHÂN TRANG TỌA KỴ ---
        else if (action === 'mountprev' || action === 'mountnext') {
          try {
            await interaction.deferUpdate();
            const mounts = mountService.getMounts(targetUserId);
            const active = mountService.getActiveMount(targetUserId);
            const ropeInv = db.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(targetUserId, 'thung_bat_thu') as { quantity: number } | undefined;
            const ropesCount = ropeInv ? ropeInv.quantity : 0;
            const feedableItems = db.prepare(`
              SELECT i.id as inv_id, i.item_id, item.name, item.rarity, i.quantity
              FROM inventories i JOIN items item ON i.item_id = item.id
              WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
              ORDER BY i.quantity DESC LIMIT 5
            `).all(targetUserId) as any[];
            const user = userRepository.get(targetUserId);
            if (!user) return;
            const { embed, totalPages } = getMountListEmbed(user, mounts, active, ropesCount, feedableItems, pageNum);
            const components = getMountListComponents(targetUserId, pageNum, totalPages);
            await interaction.editReply(toV2Payload([embed], components));
          } catch (e: any) {
            console.error('[mountpage] Lỗi phân trang tọa kỵ:', e?.message || e);
          }
        }

        // --- Nút: PHÂN TRANG KHÍ LINH ---
        else if (action === 'spiritprev' || action === 'spiritnext') {
          try {
            await interaction.deferUpdate();
            const { spiritWeaponService } = require('../services/SpiritWeaponService');
            const spiritWeapons = spiritWeaponService.getSpiritWeapons(targetUserId);
            if (spiritWeapons.length === 0) return;
            const user = userRepository.get(targetUserId);
            if (!user) return;
            const { embed, totalPages } = getSpiritListEmbed(targetUserId, user, spiritWeapons, pageNum);
            const components = getSpiritListComponents(targetUserId, pageNum, totalPages);
            await interaction.editReply(toV2Payload([embed], components));
          } catch (e: any) {
            console.error('[spiritpage] Lỗi phân trang khí linh:', e?.message || e);
          }
        }

        // --- Nút: PHÂN TRANG THÀNH TỰU ---
        else if (action === 'achprev' || action === 'achnext') {
          try {
            await interaction.deferUpdate();
            const category = parts[1].replace(/\./g, '_');
            const { embed, totalPages } = getAchievementCategoryEmbed(targetUserId, category, pageNum);
            const components = getAchievementCategoryComponents(targetUserId, category, pageNum, totalPages);
            await interaction.editReply(toV2Payload([embed], components));
          } catch (e: any) {
            console.error('[achpage] Lỗi phân trang thành tựu:', e?.message || e);
          }
        }

        // --- Nút: QUAY LẠI HỒ SƠ ---
        else if (action === 'hosoback') {
          // Tính toán lại chỉ số active khi quay lại để cập nhật thay đổi trang bị
          const embed = getHoSoTabEmbed(targetUserId, 'chiso');
          const rows = getHoSoAllComponents(targetUserId, 'chiso');
          await safeV2Update(interaction, [embed], rows);
        }
        
        // --- Nút: KHIÊU CHIẾN BÍ CẢNH (Chọn phó bản) ---
        else if (action === 'bicanhselect') {
          const dungeonId = parts.slice(1, -1).join('_'); // Ghép lại vì dungeon_id có underscore
          
          const dungeon = DUNGEONS[dungeonId];
          if (!dungeon) {
            await interaction.reply({ content: '❌ Bí Cảnh này không tồn tại!', flags: MessageFlags.Ephemeral });
            return;
          }

          // Kiểm tra số lượt khiêu chiến hàng ngày
          const now = Math.floor(Date.now() / 1000);
          const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
            .get(targetUserId, dungeonId) as { daily_entries: number; last_entry_at: number } | undefined;

          let entriesToday = 0;
          if (cd) {
            const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
            if (cdDate === new Date().toDateString()) {
              entriesToday = cd.daily_entries;
            }
          }

          if (entriesToday >= dungeon.maxDailyEntries) {
            await interaction.reply({ 
              content: `❌ Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)`, 
              flags: MessageFlags.Ephemeral 
            });
            return;
          }

          // Xác định độ khó ngẫu nhiên
          const difficulties = ['dễ', 'thường', 'khó', 'ác_mộng'];
          const randDiff = Math.random();
          let difficulty = 'thường';
          if (randDiff < 0.20) difficulty = 'dễ';
          else if (randDiff < 0.65) difficulty = 'thường';
          else if (randDiff < 0.90) difficulty = 'khó';
          else difficulty = 'ác_mộng';

          // Chọn ngẫu nhiên thế thủ của quái vật
          const monsterActions = ['shield', 'sword', 'talisman'];
          const monsterAction = monsterActions[Math.floor(Math.random() * monsterActions.length)];

          let hintText = '';
          if (monsterAction === 'shield') {
            hintText = `🛡️ **Thủ Vệ Động:** Quái vật đang ngưng tụ kim quang bao phủ cơ thể, chuẩn bị đỡ đòn bằng **Hộ Thể** (Shield). Đạo hữu sẽ ra chiêu gì khắc chế?`;
          } else if (monsterAction === 'sword') {
            hintText = `⚔️ **Kiếm Ánh:** Quái vật vung thanh tàn kiếm, thân kiếm run rẩy tạo ra tiếng rít xé gió chuẩn bị phóng ra **Kiếm Pháp** (Sword). Đạo hữu định phản ứng ra sao?`;
          } else {
            hintText = `📜 **Linh Phù:** Quái vật giơ cao một tấm bùa lục cổ xưa đen kịt, linh văn u ám nhảy múa chuẩn bị giáng xuống **Phù Pháp** (Talisman). Đạo hữu định làm gì?`;
          }

          const embed = new EmbedBuilder()
            .setTitle(`🔮 BÍ CẢNH QUYẾT SÁCH: ${dungeon.name}`)
            .setColor(EMBED_COLORS.ORANGE)
            .setDescription(
              `⚔️ **Độ khó ngẫu nhiên:** **${difficulty.toUpperCase()}**\n\n` +
              `${hintText}\n\n` +
              `*Khắc chế:* **Tấn Công** khắc Hộ Thể | **Thi Pháp** khắc Kiếm Pháp | **Phòng Thủ** khắc Phù Pháp.\n` +
              `• Chọn **Đúng**: Nhận buff **+50% Công & Thủ** trong trận đấu.\n` +
              `• Chọn **Sai**: Quái vật tăng **+100% Công Kích** tàn sát đạo hữu!`
            )
            .setFooter({ text: 'Hãy phản xạ nhanh nhạy để đắc thắng!' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:atk_${targetUserId}`)
              .setLabel('⚔️ Tấn Công')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:spell_${targetUserId}`)
              .setLabel('📜 Thi Pháp')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:def_${targetUserId}`)
              .setLabel('🛡️ Phòng Thủ')
              .setStyle(ButtonStyle.Danger)
          );

          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: PHẢN ỨNG RA CHIÊU BÍ CẢNH (Thực chiến quyết định) ---
        else if (action === 'bicanhreact') {
          const firstUnderscoreIdx = customId.indexOf('_');
          const lastUnderscoreIdx = customId.lastIndexOf('_');
          const middle = customId.substring(firstUnderscoreIdx + 1, lastUnderscoreIdx);
          const middleParts = middle.split(':');

          const dungeonId = middleParts[0];
          const difficulty = middleParts[1];
          const monsterAction = middleParts[2];
          const playerChoice = middleParts[3]; // 'atk', 'spell', 'def'

          let correct = false;
          if (playerChoice === 'atk' && monsterAction === 'shield') correct = true;
          else if (playerChoice === 'spell' && monsterAction === 'sword') correct = true;
          else if (playerChoice === 'def' && monsterAction === 'talisman') correct = true;

          const playerBuff = correct;
          const monsterBuff = !correct;

          // Thực hiện khiêu chiến bí cảnh thực sự
          const result = combatService.challengeDungeon(targetUserId, dungeonId, difficulty, playerBuff, monsterBuff);

          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const combatResult = result.combatResult!;
          combatLogsCache.set(targetUserId, { data: combatResult.log, timestamp: Date.now() });

          // Nạp năng lượng cho Linh mạch Chiến Đấu
          leylineService.addEnergy(targetUserId, 'chiendau', 15);

          const isWin = result.message === 'Chiến Thắng';
          const color = isWin ? '#2ecc71' : EMBED_COLORS.ERROR;
          const title = isWin ? '⚔️ VIỄN CỔ CHIẾN THẮNG ⚔️' : '💀 BẠI VONG TRONG BÍ CẢNH 💀';

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp();

          const dungeon = DUNGEONS[dungeonId];
          const monsterName = dungeon?.monster.name || 'quái thú';

          let reactionFeedback = '';
          if (correct) {
            reactionFeedback = `🔮 **Khắc chế thành công!** Đạo hữu đọc hiểu thế công của quái vật, vung chiêu khắc chế hoàn mỹ! Nhận **+50% ATK & DEF** trong trận chiến.`;
          } else {
            const monsterChoiceName = monsterAction === 'shield' ? 'Hộ Thể' : monsterAction === 'sword' ? 'Kiếm Pháp' : 'Phù Pháp';
            reactionFeedback = `❌ **Phán đoán sai lầm!** Quái vật dùng **${monsterChoiceName}** nhưng đạo hữu phản ứng lỗi, bị quái vật rình rập đột kích nâng **+100% ATK** ăn hành ngập mồm!`;
          }

          if (isWin) {
            const rewards = result.rewards!;
            const lootsText = rewards.loots.length > 0
              ? rewards.loots.map(l => `🎁 **${l.name}** x${l.quantity}`).join('\n')
              : '*Không có vật phẩm nào rơi ra.*';

            let artifactLine = '';
            if ((result as any).artifactMessage) {
              artifactLine = `\n• ${(result as any).artifactMessage}`;
            }

            embed.setDescription(
              `${reactionFeedback}\n\n` +
              `Đạo hữu đã xuất chiêu tiêu diệt thành công **${monsterName}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
              `🍀 **Phần Thưởng Nhận Được (Độ khó: ${difficulty.toUpperCase()}):**\n` +
              `• Tích lũy thêm: **+${rewards.exp}** Tu Vi 🌿\n` +
              `• Nhặt được: **+${rewards.coins}** Hạ Phẩm Linh Thạch 🟤${artifactLine}\n\n` +
              `📦 **Chiến Lợi Phẩm:**\n${lootsText}\n\n` +
              `*Lượt khiêu chiến phó bản này hôm nay còn lại: **${result.dailyEntriesLeft}** lượt.*`
            );
          } else if (result.message === 'Tử Vong') {
            const expLost = result.rewards?.exp || 0;
            const coinsLost = result.rewards?.coins || 0;
            const dropText = result.artifactMessage ? `\n⚠️ **Kiếp Nạn:** ${result.artifactMessage}` : '';

            embed.setTitle('💀 HỒN PHI PHÁCH TÁN')
              .setColor(EMBED_COLORS.NEUTRAL)
              .setDescription(
                `${reactionFeedback}\n\n` +
                `☠️ Đạo hữu quá yếu ớt, đã bị **${monsterName}** tung chiêu chí mạng đánh **Tử Vong** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
                `💔 **Tổn Thất Đại Nạn:**\n` +
                `• Hao hụt Tu Vi: **-${expLost}** XP\n` +
                `• Thất thoát Linh Thạch: **-${coinsLost}** Hạ Phẩm Linh Thạch\n` +
                `• Thương tích nặng nề: **-100** Thể Lực\n` +
                `• Trạng thái: **Trọng Thương trong 45 phút**${dropText}\n\n` +
                `💡 *Đại nạn không chết ắt có hậu phúc. Hãy tĩnh dưỡng, chế tạo pháp bảo hộ thân trước khi khiêu chiến lại.*`
              );
          } else {
            embed.setDescription(
              `${reactionFeedback}\n\n` +
              `Đạo hữu cự địch thất bại, kiệt lực chiến bại vong dưới tay **${monsterName}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
              `💡 *Hãy tĩnh tọa tích lũy thêm tu vi, đột phá cảnh giới lớn hoặc chế trang bị xịn để phục thù.*`
            );
          }

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bicanhlogs_${targetUserId}`)
              .setLabel('📖 Nhật Ký Chiến Đấu')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`bicanhback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Bí Cảnh')
              .setStyle(ButtonStyle.Secondary)
          );

          // Cập nhật tiến trình nhiệm vụ hàng ngày khi hoàn thành bí cảnh
          dailyQuestService.updateProgress(targetUserId, 'daily_bicanh', 1);
          questChainService.updateProgress(targetUserId, 'kill', 1);

          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: XEM NHẬT KÝ CHIẾN ĐẤU BÍ CẢNH ---
        else if (action === 'bicanhlogs') {
          const { renderCombatLog } = require('../utils/combatLogUtils');
          await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết nhật ký trận đấu');
        }

        // --- Nút: QUAY LẠI BÍ CẢNH ---
        else if (action === 'bicanhback') {
          const embed = getDungeonEmbed(targetUserId);
          const row = getDungeonComponents(targetUserId);
          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: TẤN CÔNG WORLD BOSS (đã hợp nhất vào handler phía trên) ---
        // (Đã được xử lý ở handler worldbossattack phía trên, không cần duplicate)

        // --- Nút: XEM NHẬT KÝ CHIẾN ĐẤU WORLD BOSS ---
        else if (action === 'worldbosslogs') {
          const { renderCombatLog } = require('../utils/combatLogUtils');
          await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết trận đấu World Boss');
        }

        // --- Nút: XEM NHẬT KÝ CHIẾN ĐẤU SĂN YÊU THÚ ---
        else if (action === 'sanyeuthulogs') {
          const { renderCombatLog } = require('../utils/combatLogUtils');
          await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết nhật ký trận săn');
        }

        // --- Nút: LÀM MỚI WORLD BOSS ---
        else if (action === 'worldbossrefresh') {
          const payload = buildWorldBossContainer(targetUserId);
          await interaction.client.rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            { body: { type: 7, data: payload } }
          );
          (interaction as any).replied = true;
        }

        // --- Nút: HỒI MÁU (World Boss) — Hiển thị confirm ---
        else if (action === 'worldbossheal') {
          const user = userRepository.get(targetUserId);
          if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa có nhân vật!', flags: MessageFlags.Ephemeral });
            return;
          }
          const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`wbhealconfirm_${targetUserId}`).setLabel('✅ Xác Nhận (500,000 LT)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`wbhealcancel_${targetUserId}`).setLabel('❌ Hủy').setStyle(ButtonStyle.Secondary)
          );
          await interaction.reply({
            content: `💚 **Xác nhận Hồi Máu:**\nĐạo hữu muốn xóa trạng thái trọng thương và hồi phục HP?\n\n💰 **Chi phí:** **500,000** Linh Thạch\n🩹 **Hiệu quả:** Xóa trọng thương + Hồi 30% HP tối đa`,
            components: [confirmRow],
            flags: MessageFlags.Ephemeral
          });
        }

        // --- Nút: XÁC NHẬN HỒI MÁU ---
        else if (action === 'wbhealconfirm') {
          const user = userRepository.get(targetUserId);
          if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa có nhân vật!', flags: MessageFlags.Ephemeral });
            return;
          }
          const HEAL_COST = 500000;
          if (user.coin_ha_pham < HEAL_COST) {
            await interaction.reply({ content: `❌ Đạo hữu không đủ Linh Thạch! Cần **${HEAL_COST.toLocaleString()}** LT, hiện có **${user.coin_ha_pham.toLocaleString()}** LT.`, flags: MessageFlags.Ephemeral });
            return;
          }
          const activeStats = inventoryService.getActiveStats(targetUserId);
          const maxHp = activeStats ? activeStats.hp : user.base_hp;
          const healAmount = Math.round(maxHp * 0.3);
          const newHp = Math.min(maxHp, (user.hp || user.base_hp) + healAmount);
          userRepository.update(targetUserId, {
            coin_ha_pham: user.coin_ha_pham - HEAL_COST,
            injury_end_time: 0,
            hp: newHp
          });
          await interaction.update({ content: `💚 Đạo hữu đã tĩnh dưỡng thành công! Mất **${HEAL_COST.toLocaleString()}** Linh Thạch.\n🩹 Đã xóa trạng thái trọng thương + Hồi **${healAmount.toLocaleString()}** HP (${newHp.toLocaleString()}/${maxHp.toLocaleString()})!`, components: [] });
        }

        // --- Nút: HỦY HỒI MÁU ---
        else if (action === 'wbhealcancel') {
          await interaction.update({ content: '❌ Đã hủy hồi máu.', components: [] });
        }

        // --- Nút: XẾP HẠNG WORLD BOSS ---
        else if (action === 'worldbosslb') {
          const contribs = combatService.getBossContributions();
          const season = bossSeasonService.getCurrentSeason();
          let lbText = '';
          if (contribs.length > 0) {
            lbText = contribs.map((c, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
              return `${medal} **#${i + 1}** ${c.name} — **${c.damage.toLocaleString()}** sát thương (${c.attacks} lần)`;
            }).join('\n');
          } else {
            lbText = '*Chưa có ai gây sát thương.*';
          }
          const seasonText = season ? `🏆 Mùa ${season.season_number} — Còn ${season.days_left} ngày` : 'Không có season';
          await interaction.reply({ content: `**BXH Sát Thương Boss**\n${seasonText}\n\n${lbText}`, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: RỜI SẢNH (World Boss) ---
        else if (action === 'worldbossleave') {
          try { await interaction.message.delete(); } catch (e) {}
          return;
        }

        // --- Boss Shop ---
        else if (action === 'bossshop') {
          const embed = getBossShopEmbed(targetUserId);
          const row = getBossShopComponents(targetUserId);
          await safeV2Update(interaction, [embed], [row]);
        }
        else if (action === 'bossshop_buy' && interaction.isStringSelectMenu()) {
          const itemKey = interaction.values[0];
          const result = handleBossShopPurchase(targetUserId, itemKey);
          const embed = getBossShopEmbed(targetUserId, result.message);
          const row = getBossShopComponents(targetUserId);
          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: THU HOẠCH LINH ĐIỀN ---
        else if (action === 'linhdienharvest') {
          const plots = farmingService.getPlots(targetUserId);
          const harvested: string[] = [];
          for (const p of plots) {
            if (p.status === 'growing' && (p.timeRemaining || 0) <= 0) {
              const res = farmingService.harvestPlot(targetUserId, p.plot_index);
              if (res.success && res.productName) {
                harvested.push(res.productName);
              }
            }
          }
          if (harvested.length === 0) {
            await interaction.reply({ content: '❌ Không có linh thực nào chín để thu hoạch!', flags: MessageFlags.Ephemeral });
            return;
          }

          // Nạp năng lượng Linh Mạch Thu Thập (5 năng lượng cho mỗi cây)
          leylineService.addEnergy(targetUserId, 'thuthap', harvested.length * 5);
          questChainService.updateProgress(targetUserId, 'collect', harvested.length);

          const embed = getLinhDienEmbed(targetUserId);
          const components = getLinhDienComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: `✨ Đạo hữu thu hoạch thành công: ${harvested.map(h => `**${h}**`).join(', ')}!`, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: KHAI KHẨN LINH ĐIỀN ---
        else if (action === 'linhdienunlock') {
          const result = farmingService.unlockPlot(targetUserId);
          if (!result.success) {
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getLinhDienEmbed(targetUserId);
          const components = getLinhDienComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: LÀM MỚI LINH ĐIỀN ---
        else if (action === 'linhdienrefresh') {
          const embed = getLinhDienEmbed(targetUserId);
          const components = getLinhDienComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
        }

        // --- Nút: ĐỘNG PHỦ - NGÂM LINH TUYỀN ---
        else if (action === 'dongphuspring') {
          const { caveService } = require('../services/CaveService');
          const result = caveService.collectSpring(targetUserId);
          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          // Cập nhật lại embed Động Phủ trực tiếp (in-place)
          const { buildCaveEmbed, buildCaveComponents } = require('../commands/life/dongphu');
          const updatedEmbed = buildCaveEmbed(targetUserId);
          const updatedComponents = buildCaveComponents(targetUserId);

          await safeV2Update(interaction, [updatedEmbed], updatedComponents);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: ĐỘNG PHỦ - NÂNG CẤP ---
        else if (action === 'dongphuupgrade') {
          const { caveService } = require('../services/CaveService');
          const cave = caveService.getCave(targetUserId);
          const cost = caveService.getUpgradeCost(cave.level);
          
          if (!cost) {
            await interaction.reply({ content: '❌ Động Phủ của đạo hữu đã đạt cấp tối đa!', flags: MessageFlags.Ephemeral });
            return;
          }

          if (cost.lt > 0 && user.coin_ha_pham < cost.lt) {
            await interaction.reply({ content: `❌ Cần **${cost.lt}** Linh Thạch để nâng cấp!`, flags: MessageFlags.Ephemeral });
            return;
          }
          if (cost.knb > 0 && user.knb < cost.knb) {
            await interaction.reply({ content: `❌ Cần **${cost.knb}** KNB để nâng cấp!`, flags: MessageFlags.Ephemeral });
            return;
          }

          const { inventoryRepository } = require('../database/repositories/InventoryRepository');
          const inv = inventoryRepository.getUserInventory(targetUserId);
          let missingItems = false;
          let reqText = '';

          for (const req of cost.reqItems) {
            const item = inv.find((i: any) => i.item_id === req.id);
            if (!item || item.quantity < req.quantity) {
              missingItems = true;
              const itemInfo = db.prepare('SELECT name FROM items WHERE id = ?').get(req.id) as { name: string } | undefined;
              const name = itemInfo ? itemInfo.name : req.id;
              reqText += `**${name}** (Cần: **${req.quantity}**, hiện có: **${item ? item.quantity : 0}**) `;
            }
          }

          if (missingItems) {
            await interaction.reply({ content: `❌ Thiếu nguyên liệu! ${reqText}`, flags: MessageFlags.Ephemeral });
            return;
          }

          // Trừ chi phí
          db.transaction(() => {
            const updates: any = {};
            if (cost.lt > 0) updates.coin_ha_pham = user.coin_ha_pham - cost.lt;
            if (cost.knb > 0) updates.knb = user.knb - cost.knb;
            userRepository.update(targetUserId, updates);
            for (const req of cost.reqItems) {
              const item = inv.find((i: any) => i.item_id === req.id);
              if (item.quantity > req.quantity) {
                db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(req.quantity, item.id);
              } else {
                db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
              }
            }
            db.prepare('UPDATE user_caves SET level = level + 1, spring_available = spring_available + 1 WHERE user_id = ?').run(targetUserId);
          })();

          // Cập nhật lại embed Động Phủ trực tiếp (in-place)
          const { buildCaveEmbed, buildCaveComponents } = require('../commands/life/dongphu');
          const updatedEmbed = buildCaveEmbed(targetUserId);
          const updatedComponents = buildCaveComponents(targetUserId);

          await safeV2Update(interaction, [updatedEmbed], updatedComponents);
          await interaction.followUp({ content: `🎉 Chúc mừng! Đạo hữu đã nâng cấp thành công Động Phủ lên **Cấp ${cave.level + 1}**!`, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: MỞ MODAL THÀNH LẬP TÔNG MÔN ---
        else if (action === 'sectestablishnav') {
          const modal = new ModalBuilder()
            .setCustomId(`sectcreate_${targetUserId}`)
            .setTitle('Sáng Lập Tông Môn');

          const nameInput = new TextInputBuilder()
            .setCustomId('sect_name')
            .setLabel('Tên Tông Môn (2-20 ký tự)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const descInput = new TextInputBuilder()
            .setCustomId('sect_desc')
            .setLabel('Tuyên ngôn / Mô tả Tông Môn')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
          );

          await interaction.showModal(modal);
        }

        // --- Nút: RỜI / GIẢI TÁN TÔNG MÔN ---
        else if (action === 'sectleave') {
          const result = sectService.leaveSect(targetUserId);
          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getSectEmbed(targetUserId);
          const components = getSectComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: LÀM MỚI TÔNG MÔN ---
        else if (action === 'sectrefresh') {
          const embed = getSectEmbed(targetUserId);
          const components = getSectComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
        }

        // --- Nút: TÔNG CHỦ NÂNG CẤP KIẾN TRÚC TÔNG MÔN ---
        else if (action === 'sectupgrade') {
          const facility = parts[1] as 'tuling' | 'danduong';
          const result = sectService.upgradeFacility(targetUserId, facility);
          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getSectEmbed(targetUserId);
          const components = getSectComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: NHẬN THÀNH PHẨM CHẾ TẠO (THU LÒ) ---
        else if (action === 'craftclaim') {
          const result = craftingService.claimCraftedItems(targetUserId);
          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          // Nạp năng lượng Linh Mạch Thu Thập (10 năng lượng cho mỗi lần chế)
          leylineService.addEnergy(targetUserId, 'thuthap', 10);

          const embed = getCraftingEmbed(targetUserId);
          const components = getCraftingComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: LÀM MỚI LÒ CHẾ TẠO ---
        else if (action === 'craftrefresh') {
          const embed = getCraftingEmbed(targetUserId);
          const components = getCraftingComponents(targetUserId);
          await safeV2Update(interaction, [embed], components);
        }

        // --- Nút: ĐI ĐẾN LUYỆN ĐAN (từ hồ sơ) ---
        else if (action === 'luyendannav') {
          const cmd = new LuyenDanCommand();
          const embed = cmd.getAlchemyEmbed(targetUserId);
          const row = cmd.getAlchemyComponents(targetUserId);
          if (row.length > 0 && row[0].components.length < 5) {
            row[0].addComponents(
              new ButtonBuilder()
                .setCustomId(`hosoback_${targetUserId}`)
                .setLabel('🔙 Quay Lại Hồ Sơ')
                .setStyle(ButtonStyle.Secondary)
            );
          }
          await safeV2Update(interaction, [embed], row);
        }

        // --- Nút: ĐI ĐẾN TÔNG MÔN (từ hồ sơ) ---
        else if (action === 'tonmonnav') {
          const embed = getSectEmbed(targetUserId);
          const sectComps = getSectComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [...sectComps, backRow]);
        }

        // --- Nút: ĐI ĐẾN BÍ CẢNH (từ hồ sơ) ---
        else if (action === 'bicanhnaav') {
          const embed = getDungeonEmbed(targetUserId);
          const row = getDungeonComponents(targetUserId);
          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: ĐI ĐẾN LEO THÁP (từ hồ sơ) ---
        else if (action === 'leothapnav') {
          const embed = getTowerEmbed(targetUserId);
          const rows = getTowerComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          const rowsArr = Array.isArray(rows) ? rows : [rows];
          await safeV2Update(interaction, [embed], [...rowsArr, backRow]);
        }

        // --- Nút: ĐI ĐẾN LÀM VIỆC (từ hồ sơ) ---
        else if (action === 'lamviecnav') {
          const embed = new EmbedBuilder()
            .setTitle('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch')
            .setColor(EMBED_COLORS.NEUTRAL)
            .setDescription(
              `Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.\n\n` +
              `⏰ **Cooldown:** 60 giây (mỗi lần làm việc)\n` +
              `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${user.stamina}/500**)\n\n` +
              `*Chọn một công việc bên dưới để bắt đầu lao động ngay!*`
            )
            .setTimestamp();

          const workRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`lamviecwork_mining_${targetUserId}`)
              .setLabel('⚒️ Khai Thác')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_gathering_${targetUserId}`)
              .setLabel('🌿 Hái Lượm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_patrolling_${targetUserId}`)
              .setLabel('🛡️ Tuần Tra')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_escort_${targetUserId}`)
              .setLabel('🚚 Hộ Tiêu')
              .setStyle(ButtonStyle.Success)
          );
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [workRow, backRow]);
        }

        // --- Nút: THỰC THI LÀM VIỆC (từ menu Làm Việc trong hồ sơ) ---
        else if (action === 'lamviecwork') {
          // customId: lamviecwork_<jobType>_<userId> => targetUserId nằm ở parts[2]
          const jobType = parts[1] as 'mining' | 'gathering' | 'patrolling' | 'escort';
          const workTargetId = parts[2];

          if (interaction.user.id !== workTargetId) {
            await interaction.reply({ content: '❌ Đạo hữu không thể lao động thay tu sĩ khác!', flags: MessageFlags.Ephemeral });
            return;
          }

          const result = performWork(workTargetId, jobType);
          if (!result.success) {
            await interaction.reply({ content: result.message!, flags: MessageFlags.Ephemeral });
            return;
          }

          // Cập nhật lại menu làm việc với thể lực mới
          const refreshedUser = userRepository.get(workTargetId)!;
          const embed = new EmbedBuilder()
            .setTitle('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch')
            .setColor(EMBED_COLORS.NEUTRAL)
            .setDescription(
              `Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.\n\n` +
              `⏰ **Cooldown:** 60 giây (mỗi lần làm việc)\n` +
              `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${refreshedUser.stamina}/500**)\n\n` +
              `*Chọn một công việc bên dưới để tiếp tục lao động!*`
            )
            .setTimestamp();

          const workRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`lamviecwork_mining_${workTargetId}`)
              .setLabel('⚒️ Khai Thác')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_gathering_${workTargetId}`)
              .setLabel('🌿 Hái Lượm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_patrolling_${workTargetId}`)
              .setLabel('🛡️ Tuần Tra')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lamviecwork_escort_${workTargetId}`)
              .setLabel('🚚 Hộ Tiêu')
              .setStyle(ButtonStyle.Success)
          );
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${workTargetId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          // Cập nhật tiến trình nhiệm vụ hàng ngày khi làm việc
          dailyQuestService.updateProgress(workTargetId, 'daily_lamviec', 1);

          const resultComponents: any[] = [];
          const encounter = result.encounter;
          if (encounter) {
            const { ActionRowBuilder: LocalActionRow, ButtonBuilder: LocalButton, ButtonStyle: LocalStyle } = require('discord.js');
            const row = new LocalActionRow();
            encounter.choices.forEach((c: any, idx: number) => {
              row.addComponents(
                new LocalButton()
                  .setCustomId(`encounter_${encounter.id}_${idx}_${workTargetId}`)
                  .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
                  .setStyle(LocalStyle.Primary)
              );
            });
            resultComponents.push(row);
          }

          await safeV2Update(interaction, [embed], [workRow, backRow]);
          await interaction.followUp(toV2Payload([result.embed!], resultComponents, MessageFlags.Ephemeral));
        }

        // --- Nút: ĐI ĐẾN ĐỘNG PHỦ (từ hồ sơ) ---
        else if (action === 'dongphunav') {
          const { buildDongPhuEmbed, buildDongPhuComponents } = require('../commands/general/dongphu');
          const embed = buildDongPhuEmbed(targetUserId);
          const comps = buildDongPhuComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [...comps, backRow]);
        }

        // --- Đại Hệ Thống: BẢN MỆNH PHÁP BẢO ---
        else if (action === 'pb') {
          const pbSub = parts[1]; // 'bind' or 'swap' or 'banmenh'
          const pbType = parts[2]; // 'nav' or 'select'

          const { getBanMenhEmbed, getBanMenhComponents } = require('../commands/general/phapbao');

          // --- 1. pb_bind_nav_<userId>: Hiển thị danh sách vật phẩm có thể liên kết Huyết Tế ---
          if (pbSub === 'bind' && pbType === 'nav') {
            const inv = inventoryRepository.getUserInventory(targetUserId);
            const eligible = inv.filter(i => i.equipable === 1 && i.is_life_bound !== 1);

            if (eligible.length === 0) {
              await interaction.reply({
                content: '❌ Hành trang của đạo hữu không có trang bị/pháp bảo nào phù hợp để liên kết Huyết Tế!',
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const embed = new EmbedBuilder()
              .setTitle('🩸 TIẾN HÀNH HUYẾT TẾ BẢN MỆNH')
              .setColor(EMBED_COLORS.ALERT)
              .setDescription(
                `Hãy chọn một trang bị hoặc pháp bảo trong danh sách dưới đây để liên kết Huyết Tế với Nguyên Thần.\n\n` +
                `⚠️ **Cảnh báo:** Vật phẩm được chọn sẽ trở thành Bản Mệnh, không thể giao dịch hay vứt bỏ!`
              )
              .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`pb_bind_select_${targetUserId}`)
              .setPlaceholder('Chọn trang bị để liên kết Huyết Tế');

            eligible.slice(0, 25).forEach(i => {
              const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
              const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
              selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${i.name}${starStr}${enhStr}`)
                  .setValue(String(i.id))
                  .setDescription(`[ID: ${i.id}] Phẩm chất: ${i.rarity.toUpperCase()}`)
              );
            });

            const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`pb_banmenh_nav_${targetUserId}`)
                .setLabel('🔙 Quay Lại')
                .setStyle(ButtonStyle.Secondary)
            );

            await safeV2Update(interaction, [embed], [row1, row2]);
          }

          // --- 2. pb_bind_select_<userId>: Thực thi liên kết Huyết Tế ---
          else if (pbSub === 'bind' && pbType === 'select' && interaction.isStringSelectMenu()) {
            const inventoryId = parseInt(interaction.values[0], 10);
            const res = inventoryService.bindLifeArtifact(targetUserId, inventoryId);

            if (!res.success) {
              await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
              return;
            }

            const embed = getBanMenhEmbed(targetUserId);
            const comps = getBanMenhComponents(targetUserId);
            await safeV2Update(interaction, [embed], comps);
            await interaction.followUp({ content: `✅ ${res.message}`, flags: MessageFlags.Ephemeral });
          }

          // --- 3. pb_swap_nav_<userId>: Hiển thị danh sách vật phẩm hoán đổi Bản Mệnh (Yêu cầu Huyết Tế Ma Bảng) ---
          else if (pbSub === 'swap' && pbType === 'nav') {
            const inv = inventoryRepository.getUserInventory(targetUserId);
            const scroll = inv.find(i => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
            if (!scroll) {
              await interaction.reply({
                content: '❌ Đạo hữu cần có **Huyết Tế Ma Bảng** trong hành trang để tiến hành hoán đổi Bản Mệnh Pháp Bảo!',
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const eligible = inv.filter(i => i.equipable === 1 && i.is_life_bound !== 1);

            if (eligible.length === 0) {
              await interaction.reply({
                content: '❌ Hành trang của đạo hữu không có trang bị/pháp bảo nào khác để hoán đổi!',
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const embed = new EmbedBuilder()
              .setTitle('🔄 HOÁN ĐỔI BẢN MỆNH PHÁP BẢO')
              .setColor(EMBED_COLORS.ORANGE)
              .setDescription(
                `Tiêu hao **1x Huyết Tế Ma Bảng** để hoán đổi liên kết nguyên thần sang Pháp Bảo mới.\n` +
                `Bản Mệnh mới sẽ kế thừa **80% tích lũy EXP** của Pháp Bảo cũ.\n\n` +
                `*Hãy chọn trang bị mới muốn hoán đổi:*`
              )
              .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`pb_swap_select_${targetUserId}`)
              .setPlaceholder('Chọn trang bị mới để hoán đổi');

            eligible.slice(0, 25).forEach(i => {
              const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
              const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
              selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${i.name}${starStr}${enhStr}`)
                  .setValue(String(i.id))
                  .setDescription(`[ID: ${i.id}] Phẩm chất: ${i.rarity.toUpperCase()}`)
              );
            });

            const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`pb_banmenh_nav_${targetUserId}`)
                .setLabel('🔙 Quay Lại')
                .setStyle(ButtonStyle.Secondary)
            );

            await safeV2Update(interaction, [embed], [row1, row2]);
          }

          // --- 4. pb_swap_select_<userId>: Thực thi hoán đổi Bản Mệnh ---
          else if (pbSub === 'swap' && pbType === 'select' && interaction.isStringSelectMenu()) {
            const newInvId = parseInt(interaction.values[0], 10);

            const inv = inventoryRepository.getUserInventory(targetUserId);
            const scroll = inv.find(i => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
            if (!scroll) {
              await interaction.reply({
                content: '❌ Đạo hữu đã đánh mất **Huyết Tế Ma Bảng** nửa chừng, không thể tiến hành hoán đổi!',
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const oldBound = inv.find(i => i.is_life_bound === 1);
            if (!oldBound) {
              await interaction.reply({ content: '❌ Đạo hữu chưa có Bản Mệnh Pháp Bảo cũ để hoán đổi!', flags: MessageFlags.Ephemeral });
              return;
            }

            // Thực thi hoán đổi
            const res = inventoryService.swapLifeArtifact(targetUserId, oldBound.id, newInvId);

            if (!res.success) {
              await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
              return;
            }

            // Khấu trừ Huyết Tế Ma Bảng
            inventoryRepository.removeItem(targetUserId, ITEMS.ITEM_LIFE_BIND_SCROLL, 1);

            const embed = getBanMenhEmbed(targetUserId);
            const comps = getBanMenhComponents(targetUserId);
            await safeV2Update(interaction, [embed], comps);
            await interaction.followUp({ content: `✅ ${res.message}`, flags: MessageFlags.Ephemeral });
          }

          // --- 5. pb_banmenh_nav_<userId>: Quay lại màn hình Bản Mệnh chính ---
          else if (pbSub === 'banmenh' && pbType === 'nav') {
            const embed = getBanMenhEmbed(targetUserId);
            const comps = getBanMenhComponents(targetUserId);
            await safeV2Update(interaction, [embed], comps);
          }
        }

        // --- Nút: ĐI ĐẾN LINH ĐIỀN (từ hồ sơ) ---
        else if (action === 'linhdiennav') {
          const embed = getLinhDienEmbed(targetUserId);
          const linhComps = getLinhDienComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [...linhComps, backRow]);
        }

        // --- Nút: ĐI ĐẾN CHẾ TẠO (từ hồ sơ) ---
        else if (action === 'chetaonav') {
          const embed = getCraftingEmbed(targetUserId);
          const craftComps = getCraftingComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [...craftComps, backRow]);
        }

        // --- Nút: ĐI ĐẾN SHOP KỸ NĂNG (từ hồ sơ) ---
        else if (action === 'shopkynangnav') {
          const embed = getShopKyNangEmbed(targetUserId);
          const sknComps = getShopKyNangComponents(targetUserId);
          const rowsArr = Array.isArray(sknComps) ? sknComps : [sknComps];
          await safeV2Update(interaction, [embed], rowsArr);
        }

        // --- Nút: ĐI ĐẾN WORLD BOSS (từ hồ sơ) ---
        else if (action === 'worldbossnav') {
          const payload = buildWorldBossContainer(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          payload.components.push(backRow);
          await interaction.client.rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            { body: { type: 7, data: payload } }
          );
          (interaction as any).replied = true;
        }

        // --- Nút: ĐI ĐẾN VẠN BẢO LÂU (từ hồ sơ) ---
        else if (action === 'vanbaolaunav') {
          const activeListings = db.prepare(`
            SELECT m.*, u.name as seller_name, t.name as item_name, t.rarity as item_rarity
            FROM market_listings m
            JOIN users u ON m.seller_id = u.discord_id
            JOIN items t ON m.item_id = t.id
            WHERE m.status = 'active'
            ORDER BY m.listed_at DESC
            LIMIT 10
          `).all() as any[];

          const embed = new EmbedBuilder()
            .setTitle('🏛️ VẠN BẢO LÂU - SÀN GIAO DỊCH PHƯỜNG THỊ')
            .setColor(EMBED_COLORS.ORANGE)
            .setDescription('Nơi giao lưu vật phẩm tự do giữa các tu sĩ. Mọi giao dịch chịu 5% thuế bảo hộ tông môn.')
            .setFooter({ text: 'Dùng /vanbaolau ban | mua | huy để giao dịch chi tiết.' })
            .setTimestamp();

          if (activeListings.length === 0) {
            embed.addFields({ name: '📜 Tin Đăng Bán', value: '*Hiện chưa có tu sĩ nào treo bán linh vật. Hãy là người đầu tiên!*' });
          } else {
            for (const listing of activeListings) {
              embed.addFields({
                name: `ID Tin: \`#${listing.id}\` - ${listing.item_name} x${listing.quantity} [${(listing.item_rarity || '').toUpperCase()}]`,
                value: `• Người bán: **${listing.seller_name}**\n• Giá: **${listing.price}** Hạ Phẩm Linh Thạch\n• Mua: \`/vanbaolau mua listing_id: ${listing.id}\``
              });
            }
          }

          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [backRow]);
        }

        // --- Nút: ĐI ĐẾN NGỘ Ý CẢNH (từ hồ sơ) ---
        else if (action === 'ycanhnaav') {
          const embed = getYCanhEmbed(targetUserId);
          const row = getYCanhComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row, backRow] as any[]);
        }

        // --- Nút: ĐI ĐẾN LUÂN HỒI (từ hồ sơ) ---
        else if (action === 'luanhoinnav') {
          const embed = getLuanHoiEmbed(targetUserId);
          const row = getLuanHoiComponents(targetUserId, true);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row, backRow] as any[]);
        }

        // --- Nút: ĐI ĐẾN SỦNG THÚ (từ hồ sơ) ---
        else if (action === 'sungthunaav') {
          const embed = getSungThuEmbed(targetUserId);
          const rows = getSungThuComponents(targetUserId);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          const rowsArr = Array.isArray(rows) ? rows : [rows];
          await safeV2Update(interaction, [embed], [...rowsArr, backRow]);
        }

        // --- Nút: PHÂN TRANG SỦNG THÚ ---
        else if (action === 'sungthu') {
          const page = parseInt(parts[1], 10) || 1;
          const embed = getSungThuEmbed(targetUserId, page);
          const rows = getSungThuComponents(targetUserId, page);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          const rowsArr = Array.isArray(rows) ? rows : [rows];
          await safeV2Update(interaction, [embed], [...rowsArr, backRow]);
        }

        // --- Nút: ĐI ĐẾN CỬA HÀNG (từ hồ sơ) ---
        else if (action === 'shopnav') {
          const embed = getShopEmbed(targetUserId);
          const rows = getShopComponents(targetUserId);
          const rowsArr = Array.isArray(rows) ? rows : [rows];
          await safeV2Update(interaction, [embed], rowsArr);
        }
        // --- Nút: CỬA HÀNG PHÂN KHU (Shop Revamp) ---
        else if (action === 'shop') {
          let primaryId: string | undefined;
          let subId: string | undefined;
          let page = 1;

          if (parts.length >= 5) {
            // Items page: shop_{primaryId}_{subId}_{page}_{userId}
            primaryId = parts[1];
            subId = parts[2];
            page = parseInt(parts[3]) || 1;
          } else if (parts.length === 3) {
            // Category page: shop_{primaryId}_{userId}
            primaryId = parts[1];
          }
          // parts.length === 2 → main page, no params

          const embed = getShopEmbed(targetUserId, primaryId, subId, page);
          const rows = getShopComponents(targetUserId, primaryId, subId, page);
          const rowsArr = Array.isArray(rows) ? rows : [rows];
          await safeV2Update(interaction, [embed], rowsArr);
        }
        // --- Nút: TÌM KIẾM CỬA HÀNG ---
        else if (action === 'shopsearch') {
          const modal = new ModalBuilder()
            .setCustomId(`shopsearchmodal_${targetUserId}`)
            .setTitle('🔍 Tìm Kiếm Vật Phẩm');

          const searchInput = new TextInputBuilder()
            .setCustomId('search_query')
            .setLabel('Nhập tên hoặc mã vật phẩm')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100);

          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(searchInput));
          await interaction.showModal(modal);
          return;
        }
        // --- Nút: ĐI ĐẾN SĂN YÊU THÚ (từ hồ sơ) ---
        else if (action === 'sanyeuthunaav') {
          // Hai trường hợp:
          //  customId: sanyeuthunaav_<userId>         -> mở menu xác nhận
          //  customId: sanyeuthunaav_go_<userId>     -> chạy săn ngay (giữ cho tương lai)
          const subAction = parts[1];

          if (subAction === 'go') {
            // Thực thi săn ngay
            const huntResult = performHunt(targetUserId);
            
            // Re-render hunt menu
            const embed = getSanYeuThuEmbed(targetUserId);
            const rows = getSanYeuThuComponents(targetUserId);
            await safeV2Update(interaction, [embed], rows as any[]);

            if (!huntResult.success) {
              await interaction.followUp({ content: `❌ ${huntResult.message}`, flags: MessageFlags.Ephemeral });
              return;
            }

            if (huntResult.combatLog) {
              combatLogsCache.set(targetUserId, { data: huntResult.combatLog, timestamp: Date.now() });
            }

            const { ActionRowBuilder: LocalActionRow, ButtonBuilder: LocalButton, ButtonStyle: LocalStyle } = require('discord.js');
            const huntRows: any[] = [];
            if (huntResult.encounter) {
              const row = new LocalActionRow();
              huntResult.encounter.choices.forEach((c: any, idx: number) => {
                row.addComponents(
                  new LocalButton()
                    .setCustomId(`encounter_${huntResult.encounter.id}_${idx}_${targetUserId}`)
                    .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
                    .setStyle(LocalStyle.Primary)
                );
              });
              huntRows.push(row);
            }
            
            const logRow = new LocalActionRow();
            logRow.addComponents(
              new LocalButton()
                .setCustomId(`sanyeuthulogs_${targetUserId}`)
                .setLabel('📖 Nhật Ký Chiến Đấu')
                .setStyle(LocalStyle.Primary)
            );
            huntRows.push(logRow);

            await interaction.followUp(toV2Payload([huntResult.embed!], huntRows as any[], MessageFlags.Ephemeral));
          } else {
            // Mở menu săn yêu thú (màn hình xác nhận)
            const embed = getSanYeuThuEmbed(targetUserId);
            const rows = getSanYeuThuComponents(targetUserId);
            await safeV2Update(interaction, [embed], rows as any[]);
          }
        }

        // --- Nút: ĐI ĐẾN TRANG BỊ (từ hồ sơ) ---
        else if (action === 'trangbinaav') {
          const embed = new EmbedBuilder()
            .setTitle('🛡️ TRANG BỊ ĐIỀN KỸ')
            .setColor(EMBED_COLORS.DARK_PURPLE)
            .setDescription(
              `Kho trang bị tu luyện giúp đạo hữu gia tăng chiến lực toàn diện.\n\n` +
              `🔧 **Các tính năng khả dụng:**\n` +
              `• 🔍 **Giám Định** — Phôi rèn đúc thành trang bị xịn (phí 50 Linh Thạch)\n` +
              `• ♻️ **Phân Giải** — Trang bị không dùng thu hồi thành Mảnh Trang Bị\n` +
              `• ⭐ **Nâng Sao** — Cường hóa trang bị đang mặc (+20% chỉ số/sao, max 5 sao)\n` +
              `• 🧩 **Ghép Trang Bị** — Ghép Mảnh thành trang bị S/SS/SSS\n\n` +
              `*Hãy chọn hành động bên dưới để tiếp tục.*`
            )
            .setFooter({ text: 'Quản lý qua slash command: /trangbi giamdinh | phangiai | nangsao | ghep' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`tuido_${targetUserId}`)
              .setLabel('💼 Mở Túi Đồ')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: ĐI ĐẾN QUYẾT ĐẤU (từ hồ sơ) ---
        else if (action === 'quyetau') {
          const embed = new EmbedBuilder()
            .setTitle('⚔️ QUYẾT ĐẤU LINH THẠCH')
            .setColor(EMBED_COLORS.ERROR)
            .setDescription(
              `Khiêu chiến người chơi khác quyết đấu kéo búa bao (oẳn tù tì) đặt cược Linh Thạch.\n\n` +
              `🔮 **Quy luật khắc chế ngũ hành:**\n` +
              `• ⚔️ **Kiếm Pháp** chém rách 📜 **Phù Pháp**\n` +
              `• 📜 **Phù Pháp** phong ấn 🛡️ **Hộ Thể**\n` +
              `• 🛡️ **Hộ Thể** chống đỡ ⚔️ **Kiếm Pháp**\n\n` +
              `🪙 **Đặt cược:** Hai bên cược **bằng nhau**, người thắng nhận 95% (5% thuế tông môn).\n` +
              `⏳ **Thời gian ứng chiến:** 60 giây.\n\n` +
              `*Sử dụng lệnh: \`/quyetau tuser: @ai_đó cuoc: 100\` để gửi thư khiêu chiến.*`
            )
            .setFooter({ text: 'Lưu ý: Cả hai bên phải có đủ Linh Thạch đặt cược.' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row]);
        }
        // --- Nút: ĐI ĐẾN KHÁM PHÁ DÃ NGOẠI (từ hồ sơ) ---
        else if (action === 'khambhanav') {
          const embed = getKhamBhaEmbed(targetUserId);
          const rows = getKhamBhaComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
        }

        // --- Nút: BẮT ĐẦU THÁM HIỂM (chọn địa điểm) ---
        else if (action === 'khambhastart') {
          const locationId = parts.slice(1, -1).join('_'); // Ghép lại vì loc.id có underscore
          const result = explorationService.startExploration(targetUserId, locationId);

          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getKhamBhaEmbed(targetUserId);
          const rows = getKhamBhaComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: VỀ LẤY THƯỞNG THÁM HIỂM ---
        else if (action === 'khambhaclaim') {
          const result = explorationService.claimExploration(targetUserId);

          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          if (result.hasEvent && result.event) {
            // Hiển thị kỳ ngộ
            const event = result.event;
            const embed = new EmbedBuilder()
              .setTitle(`✨ KỲ NGỘ: ${event.title}`)
              .setColor(EMBED_COLORS.ERROR)
              .setDescription(event.description)
              .setTimestamp();

            const choiceRow = new ActionRowBuilder<ButtonBuilder>();
            for (const choice of event.choices) {
              choiceRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(`khambhaevent_${result.explorationId}_${choice.id}_${targetUserId}`)
                  .setLabel(choice.label)
                  .setStyle(ButtonStyle.Primary)
              );
            }
            await safeV2Update(interaction, [embed], [choiceRow]);
          } else {
            // Thu hoạch bình thường
            dailyQuestService.updateProgress(targetUserId, 'daily_khambha', 1);
            questChainService.updateProgress(targetUserId, 'explore', 1);
            const embed = getKhamBhaEmbed(targetUserId);
            const rows = getKhamBhaComponents(targetUserId);
            await safeV2Update(interaction, [embed], rows);
            await interaction.followUp({ content: result.message });
          }
        }

        // --- Nút: XỬ LÝ LỰA CHỌN KỲ NGỘ THÁM HIỂM ---
        else if (action === 'khambhaevent') {
          const explorationId = parseInt(parts[1], 10);
          const choiceId = parts[2];

          const result = explorationService.resolveEvent(targetUserId, explorationId, choiceId);
          dailyQuestService.updateProgress(targetUserId, 'daily_khambha', 1);
          questChainService.updateProgress(targetUserId, 'explore', 1);

          const embed = getKhamBhaEmbed(targetUserId);
          const rows = getKhamBhaComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          await interaction.followUp({ content: result.message });
        }

        // --- Nút: ĐI ĐẾN NHIỆM VỤ HÀNG NGÀY (từ hồ sơ) ---
        else if (action === 'nhiemvunav') {
          const embed = getNhiemVuEmbed(targetUserId);
          const rows = getNhiemVuComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
        }

        // --- Nút: NHẬN THƯỞNG NHIỆM VỤ ---
        else if (action === 'nhiemvuclaim') {
          const questId = parts.slice(1, -1).join('_'); // Ghép lại vì quest_id có underscore
          const result = dailyQuestService.claimQuest(targetUserId, questId);

          if (!result.success) {
            await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getNhiemVuEmbed(targetUserId);
          const rows = getNhiemVuComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: BẮT ĐẦU CHUỖI NHIỆM VỤ ---
        else if (action === 'chainstart') {
          const chainId = parts.slice(1, -1).join('_');
          const result = questChainService.startChain(targetUserId, chainId);

          const embed = getQuestChainEmbed(targetUserId);
          const rows = getQuestChainComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          if (result.message) {
            await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
          }
        }

        // --- Nút: NHẬN THƯỞNG BƯỚC CHUỖI NHIỆM VỤ ---
        else if (action === 'chainclaim') {
          const chainId = parts.slice(1, -1).join('_');
          const result = questChainService.claimStepReward(targetUserId);

          const embed = getQuestChainEmbed(targetUserId);
          const rows = getQuestChainComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        }

        // --- Nút: LAPDOI - TẤT CẢ HÀNH ĐỘNG (ready/start/leave/disband/refresh) ---
        else if (action === 'lapdoi') {
          const lapdoiAction = parts[1] as 'ready' | 'start' | 'leave' | 'disband' | 'refresh';
          const roomId = parts[2];

          if (lapdoiAction === 'ready') {
            const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as any;
            if (!room) {
              await interaction.reply({ content: '❌ Phòng không tồn tại hoặc đã đóng!', flags: MessageFlags.Ephemeral });
              return;
            }

            const readySet = readyStates.get(roomId) || new Set();
            if (readySet.has(userId)) {
              readySet.delete(userId);
            } else {
              readySet.add(userId);
            }
            readyStates.set(roomId, readySet);

            const host = userRepository.get(room.host_id);
            const embed = getPartyRoomEmbed(room, host);
            const components = getPartyRoomComponents(room, userId);

            await safeV2Update(interaction, [embed], components);
          }

          else if (lapdoiAction === 'start') {
            const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND host_id = ? AND status = 'waiting'").get(roomId, userId) as any;
            if (!room) {
              await interaction.reply({ content: '❌ Chỉ chủ phòng mới có thể bắt đầu!', flags: MessageFlags.Ephemeral });
              return;
            }

            const members: string[] = JSON.parse(room.member_ids || '[]');
            const readySet = readyStates.get(roomId) || new Set();
            const allReady = members.length >= 2 && members.every(m => readySet.has(m));

            if (!allReady) {
              await interaction.reply({ content: '❌ Chưa đủ thành viên sẵn sàng! (Cần ít nhất 2 người)', flags: MessageFlags.Ephemeral });
              return;
            }

            db.prepare("UPDATE party_rooms SET status = 'fighting' WHERE id = ?").run(roomId);

            const host = userRepository.get(room.host_id);
            
            // Lấy thông tin thành viên và xây dựng party
            const { PartyCombatEngine } = require('../services/PartyCombatEngine');
            const { activeStatsService } = require('../services/ActiveStatsService');
            
            const partyMembers = members.map(mId => {
              const u = userRepository.get(mId);
              if (!u) return null;
              const stats = activeStatsService.calculateActiveStats(u);
              
              // Lấy pet active
              const activePet = db.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(u.discord_id) as any;
              let petAtk = 0;
              let petName = null;
              if (activePet) {
                 petAtk = activePet.stats ? JSON.parse(activePet.stats).atk || 0 : 0;
                 petName = activePet.name;
              }

              return {
                userId: u.discord_id,
                name: u.name,
                combatant: stats,
                petAtk,
                petName,
                hp: stats.hp,
                maxHp: stats.hp,
                isAlive: true
              };
            }).filter(Boolean) as any[];

            // Khởi tạo Boss
            const isHard = room.dungeon_id === 'coop_dungeon_2';
            const bossMultiplier = isHard ? 1.5 : 1.0;
            const avgLevel = members.reduce((acc, mId) => acc + (userRepository.get(mId)?.level || 1), 0) / members.length;
            
            const bossConfig = {
              name: isHard ? 'Di Tích Khôi Lỗi (Boss)' : 'Yêu Thú Chúa (Boss)',
              hp: Math.floor(5000 * bossMultiplier * avgLevel * 0.5),
              maxHp: Math.floor(5000 * bossMultiplier * avgLevel * 0.5),
              atk: Math.floor(120 * bossMultiplier * avgLevel * 0.2),
              def: Math.floor(50 * bossMultiplier * avgLevel * 0.2),
              crit: 0.1,
              critRes: 0.1,
              speed: 150,
              dodge: 0.05
            };

            const result = PartyCombatEngine.run(partyMembers, bossConfig);
            const rewardsMap = PartyCombatEngine.distributeRewards(result, Math.floor(avgLevel));

            // Trả thưởng
            let rewardsText = '';
            if (result.victory) {
              rewardsText = '\n\n🎁 **PHẦN THƯỞNG CHIẾN THẮNG:**\n';
              for (const [mId, rw] of rewardsMap.entries() as any) {
                const u = userRepository.get(mId);
                if (u) {
                  userRepository.update(mId, {
                    tu_vi: u.tu_vi + rw.exp,
                    coin_ha_pham: u.coin_ha_pham + rw.coins
                  });
                  rewardsText += `• **${u.name}**: +${rw.exp} Tu Vi, +${rw.coins} Linh Thạch.\n`;

                  // Rớt phôi
                  if (Math.random() < 0.3) {
                    const phoiType = Math.random() < 0.5 ? 'weapon' : 'armor';
                    const phoiGrade = isHard ? 's' : 'a';
                    const phoiItemId = phoiType === 'weapon' ? getPhoiWeaponByGrade(phoiGrade) : getPhoiArmorByGrade(phoiGrade);
                    db.prepare(`INSERT INTO inventories (user_id, item_id, quantity, is_equipped, created_at) VALUES (?, ?, 1, 0, ?)`).run(mId, phoiItemId, Math.floor(Date.now()/1000));
                    rewardsText += `  🎉 Nhận 1x Phôi ${phoiType==='weapon'?'Vũ Khí':'Đạo Bào'} (${phoiGrade.toUpperCase()})!\n`;
                  }
                }
              }
            }

            // Cập nhật tiến trình nhiệm vụ hàng ngày cho tất cả thành viên tổ đội
            for (const m of partyMembers) {
              dailyQuestService.updateProgress(m.userId, 'daily_bicanh', 1);
            }

            // Dọn dẹp phòng
            db.prepare("UPDATE party_rooms SET status = 'closed' WHERE id = ?").run(roomId);

            const embed = new EmbedBuilder()
              .setTitle(`⚔️ BÁO CÁO TỔ ĐỘI: ${room.dungeon_id === 'coop_dungeon_1' ? 'Sơn Cốc Yêu Thú' : 'Di Tích Viễn Cổ'}`)
              .setColor(result.victory ? '#2ecc71' : EMBED_COLORS.ERROR)
              .setDescription(
                `**Kết quả:** ${result.victory ? 'Thắng Lợi 🎉' : 'Đội Hình Diệt Vong 💀'} (Sau ${result.rounds} hiệp)\n` +
                `**Boss:** ${bossConfig.name} (${result.victory ? 0 : result.bossHpRemaining}/${bossConfig.maxHp} HP)\n\n` +
                `**Thống Kê Tổ Đội:**\n` +
                partyMembers.map(m => `• ${m.name}: ${result.damageByPlayer.get(m.userId) || 0} DMG (${m.isAlive ? 'Còn sống' : 'Đã chết'})`).join('\n') +
                (result.victory ? rewardsText : '\n\n💀 *Thất bại nên không nhận được phần thưởng.*')
              )
              .setTimestamp();

            let logStr = result.log.join('\n');
            if (logStr.length > 3000) logStr = logStr.substring(0, 3000) + '\n... (Rút gọn)';
            const logEmbed = new EmbedBuilder().setTitle('📜 Diễn Biến').setDescription(logStr).setColor(EMBED_COLORS.DARK);

            await safeV2Update(interaction, [embed, logEmbed]);
          }

          else if (lapdoiAction === 'leave') {
            const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as any;
            if (!room) {
              await interaction.reply({ content: '❌ Phòng không tồn tại!', flags: MessageFlags.Ephemeral });
              return;
            }

            const members: string[] = JSON.parse(room.member_ids || '[]');
            const updatedMembers = members.filter(m => m !== userId);

            if (room.host_id === userId || updatedMembers.length === 0) {
              db.prepare("UPDATE party_rooms SET status = 'closed' WHERE id = ?").run(roomId);
              readyStates.delete(roomId);
              await safeV2TextUpdate(interaction, '💥 Phòng đã được giải tán!');
            } else {
              db.prepare("UPDATE party_rooms SET member_ids = ? WHERE id = ?")
                .run(JSON.stringify(updatedMembers), roomId);

              const readySet = readyStates.get(roomId);
              if (readySet) readySet.delete(userId);

              const host = userRepository.get(room.host_id);
              const updatedRoom = db.prepare("SELECT * FROM party_rooms WHERE id = ?").get(roomId) as any;
              const embed = getPartyRoomEmbed(updatedRoom, host);
              const components = getPartyRoomComponents(updatedRoom, userId);

              await safeV2Update(interaction, [embed], components);
            }
          }

          else if (lapdoiAction === 'disband') {
            const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND host_id = ?").get(roomId, userId) as any;
            if (!room) {
              await interaction.reply({ content: '❌ Chỉ chủ phòng mới có thể giải tán!', flags: MessageFlags.Ephemeral });
              return;
            }

            db.prepare("UPDATE party_rooms SET status = 'closed' WHERE id = ?").run(roomId);
            readyStates.delete(roomId);
            await safeV2TextUpdate(interaction, '💥 Phòng đã được giải tán!');
          }

          else if (lapdoiAction === 'refresh') {
            const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as any;
            if (!room) {
              await interaction.reply({ content: '❌ Phòng không tồn tại hoặc đã đóng!', flags: MessageFlags.Ephemeral });
              return;
            }

            const host = userRepository.get(room.host_id);
            const embed = getPartyRoomEmbed(room, host);
            const { getPartyRoomComponents } = require('./interactionCreate'); // Re-import or use local function if available
            // Let's just require the components function directly since it's exported in interactionCreate.ts
            const components = module.exports.getPartyRoomComponents ? module.exports.getPartyRoomComponents(room, userId) : getPartyRoomComponents(room, userId);
            await safeV2Update(interaction, [embed], components);
          }
        }

        // --- Nút: BÍ CẢNH (Co-op Dungeon) ---
        else if (action === 'joinparty') {
          const partyId = parts.slice(1).join('_');
          const { partyService } = require('../services/PartyService');
          
          const party = partyService.getParty(partyId);
          if (!party) {
            await interaction.reply({ content: '❌ Tổ đội không tồn tại hoặc đã bị giải tán!', flags: MessageFlags.Ephemeral });
            return;
          }

          const { COOP_DUNGEONS } = require('../commands/combat/bicanh');
          const dungeon = COOP_DUNGEONS.find((d: any) => d.id === party.dungeonId);
          if (dungeon) {
            // Kiểm tra giới hạn lượt đi hàng ngày
            const maxCoopEntries = dungeon.maxDailyEntries || 3;
            const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
              .get(userId, dungeon.id) as { daily_entries: number; last_entry_at: number } | undefined;
            
            let entriesToday = 0;
            if (cd) {
              const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
              if (cdDate === new Date().toDateString()) {
                entriesToday = cd.daily_entries;
              }
            }

            if (entriesToday >= maxCoopEntries) {
              await interaction.reply({
                content: `❌ Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${maxCoopEntries}/${maxCoopEntries}** lượt/ngày)`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }
          }

          const res = partyService.joinParty(partyId, userId);
          if (!res.success) {
            await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
            return;
          }
          
          const updatedParty = partyService.getParty(partyId);
          if (updatedParty) {
            const { buildCoopPartyEmbed } = require('../commands/combat/bicanh');
            const embed = buildCoopPartyEmbed(partyId);
            await safeV2Update(interaction, [embed]);
          } else {
            await safeV2TextUpdate(interaction, '✅ Đã tham gia.');
          }
        }

        else if (action === 'leaveparty') {
          const partyId = parts.slice(1).join('_');
          const { partyService } = require('../services/PartyService');
          const res = partyService.leaveParty(partyId, userId);
          if (!res.success) {
            await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
            return;
          }
          const party = partyService.getParty(partyId);
          if (!party) {
            await safeV2TextUpdate(interaction, '💥 Đội đã giải tán!');
          } else {
            const { buildCoopPartyEmbed } = require('../commands/combat/bicanh');
            const embed = buildCoopPartyEmbed(partyId);
            await safeV2Update(interaction, [embed]);
          }
        }

        else if (action === 'startparty') {
          const partyId = parts.slice(1).join('_');
          const { partyService } = require('../services/PartyService');
          const partyObj = partyService.getParty(partyId);
          if (!partyObj) {
            await interaction.reply({ content: '❌ Tổ đội không tồn tại!', flags: MessageFlags.Ephemeral });
            return;
          }

          const { COOP_DUNGEONS } = require('../commands/combat/bicanh');
          const dungeon = COOP_DUNGEONS.find((d: any) => d.id === partyObj.dungeonId);
          if (!dungeon) {
            await interaction.reply({ content: '❌ Bí cảnh không hợp lệ!', flags: MessageFlags.Ephemeral });
            return;
          }

          // Kiểm tra giới hạn lượt đi hàng ngày của TẤT CẢ thành viên trước khi bắt đầu
          const maxCoopEntries = dungeon.maxDailyEntries || 3;
          for (const mId of partyObj.members) {
            const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
              .get(mId, dungeon.id) as { daily_entries: number; last_entry_at: number } | undefined;
            
            let entriesToday = 0;
            if (cd) {
              const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
              if (cdDate === new Date().toDateString()) {
                entriesToday = cd.daily_entries;
              }
            }

            if (entriesToday >= maxCoopEntries) {
              const u = userRepository.get(mId);
              await interaction.reply({
                content: `❌ Không thể xuất phát! Tu sĩ **${u ? u.name : mId}** (<@${mId}>) đã hết lượt khiêu chiến Bí Cảnh này hôm nay! (Tối đa: ${maxCoopEntries} lượt/ngày).`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }
          }

          const res = partyService.startParty(partyId, userId);
          if (!res.success) {
            await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const party = res.party!;
          const { PartyCombatEngine } = require('../services/PartyCombatEngine');

          // Ghi nhận lượt đi hàng ngày cho tất cả thành viên trong tổ đội
          const now = Math.floor(Date.now() / 1000);
          for (const mId of party.members) {
            const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
              .get(mId, dungeon.id) as { daily_entries: number; last_entry_at: number } | undefined;
            
            let entriesToday = 0;
            if (cd) {
              const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
              if (cdDate === new Date().toDateString()) {
                entriesToday = cd.daily_entries;
              }
            }

            db.prepare(`
              INSERT INTO dungeon_cooldowns (user_id, dungeon_id, daily_entries, last_entry_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id, dungeon_id) DO UPDATE SET daily_entries = excluded.daily_entries, last_entry_at = excluded.last_entry_at
            `).run(mId, dungeon.id, entriesToday + 1, now);
          }

          await safeV2TextUpdate(interaction, '⚔️ **ĐANG CHUẨN BỊ TRẬN CHIẾN...**');

          try {
          // Chuẩn bị team
          const partyMembers = [];
          const { inventoryService } = require('../services/InventoryService');
          for (const mId of party.members) {
            const u = userRepository.get(mId);
            if (!u) continue;
            
            const stats = inventoryService.getActiveStats(mId);
            if (!stats) continue;

            partyMembers.push({
              userId: mId,
              name: u.name,
              combatant: {
                name: u.name,
                hp: stats.hp,
                maxHp: stats.hp,
                atk: stats.atk,
                def: stats.def,
                crit: stats.crit || 0.1,
                critRes: stats.critRes || 0.05,
                speed: stats.speed || 100
              },
              petAtk: 0,
              petName: null,
              hp: stats.hp,
              maxHp: stats.hp,
              isAlive: true
            });
          }

          if (partyMembers.length === 0) {
            await interaction.editReply({ content: null, ...toV2TextUpdate('❌ Không thể chuẩn bị đội hình! Không có thành viên hợp lệ.') });
            partyService.endParty(partyId);
            return;
          }

          // Scale HP theo số lượng người
          const bossHp = Math.floor(dungeon.bossHp * (1 + (party.members.length - 1) * 0.5));

          const bossConfig = {
            name: dungeon.bossName,
            hp: bossHp,
            maxHp: bossHp,
            atk: dungeon.bossAtk,
            def: dungeon.bossDef,
            crit: dungeon.bossCrit,
            critRes: dungeon.bossCritRes,
            speed: dungeon.bossSpeed,
            dodge: dungeon.bossDodge
          };

          const result = PartyCombatEngine.run(partyMembers, bossConfig);
          const rewardsMap = PartyCombatEngine.distributeRewards(result, Math.floor(dungeon.minLevel));

          // Trả thưởng / Phạt
          let rewardsText = '';
          if (result.victory) {
            rewardsText = '\n\n🎁 **PHẦN THƯỞNG CHIẾN THẮNG:**\n';
            for (const [mId, rw] of rewardsMap.entries() as any) {
              const u = userRepository.get(mId);
              if (u) {
                userRepository.update(mId, {
                  tu_vi: u.tu_vi + rw.exp,
                  coin_ha_pham: u.coin_ha_pham + rw.coins
                });
                // Tăng số lần phá đảo bí cảnh
                db.prepare(`UPDATE users SET dungeon_clears = COALESCE(dungeon_clears, 0) + 1 WHERE discord_id = ?`).run(mId);
                
                rewardsText += `• **${u.name}**: +${rw.exp} Tu Vi, +${rw.coins} Linh Thạch.\n`;

                // Đặc quyền Boss Drop
                if (Math.random() < 0.2) {
                  db.prepare(`INSERT INTO inventories (user_id, item_id, quantity, is_equipped, created_at) VALUES (?, ?, 1, 0, ?)`).run(mId, ITEMS.MANH_VO_VU_KHI, Math.floor(Date.now()/1000));
                  rewardsText += `  🎉 Nhận 1x Mảnh Vỡ Vũ Khí!\n`;
                }
                // ponytail: thêm drop hạt wind_leaf cho co-op boss
                if (Math.random() < 0.25) {
                  db.prepare(`INSERT INTO inventories (user_id, item_id, quantity, is_equipped, created_at) VALUES (?, ?, 1, 0, ?)`).run(mId, ITEMS.SEED_WIND_LEAF, Math.floor(Date.now()/1000));
                  rewardsText += `  🍃 Nhận 1x Hạt Thiên Phong Diệp!\n`;
                }
              }
            }
          } else {
            rewardsText = '\n\n💀 **HÌNH PHẠT THẤT BẠI (Đồng loạt giảm 8% Tu Vi, 5% Linh Thạch, 5% Linh Thạch Thượng Phẩm, 50 Thể Lực, 45 phút Trọng Thương):**\n';
            const nowSec = Math.floor(Date.now() / 1000);
            for (const mId of party.members) {
              const u = userRepository.get(mId);
              if (u) {
                const expLoss = Math.min(u.tu_vi, Math.round(u.exp_needed * 0.08));
                const coinLoss = Math.min(u.coin_ha_pham, Math.round(u.coin_ha_pham * 0.05));
                const thuongPhamLoss = Math.ceil((u.coin_thuong_pham || 0) * 0.05);
                const newStamina = Math.max(0, u.stamina - 50);

                userRepository.update(mId, {
                  tu_vi: Math.max(0, u.tu_vi - expLoss),
                  coin_ha_pham: Math.max(0, u.coin_ha_pham - coinLoss),
                  coin_thuong_pham: Math.max(0, (u.coin_thuong_pham || 0) - thuongPhamLoss),
                  stamina: newStamina,
                  injury_end_time: nowSec + 2700
                });
                rewardsText += `• **${u.name}**: -${expLoss} Tu Vi, -${coinLoss} Linh Thạch, -${thuongPhamLoss} LT Thượng Phẩm, -50 Thể Lực, 45p Trọng Thương.\n`;
              }
            }
          }

          // Cập nhật tiến trình nhiệm vụ hàng ngày cho tất cả thành viên tổ đội
          for (const mId of party.members) {
            dailyQuestService.updateProgress(mId, 'daily_bicanh', 1);
          }

          partyService.endParty(partyId);

          const embed = new EmbedBuilder()
            .setTitle(`⚔️ BÁO CÁO BÍ CẢNH: ${dungeon.name}`)
            .setColor(result.victory ? '#2ecc71' : EMBED_COLORS.ERROR)
            .setDescription(
              `**Kết quả:** ${result.victory ? 'Thắng Lợi 🎉' : 'Đội Hình Diệt Vong 💀'} (Sau ${result.rounds} hiệp)\n` +
              `**Boss:** ${bossConfig.name} (${result.victory ? 0 : result.bossHpRemaining}/${bossConfig.maxHp} HP)\n\n` +
              `**Thống Kê Tổ Đội:**\n` +
              partyMembers.map((m: any) => `• ${m.name}: ${result.damageByPlayer.get(m.userId) || 0} DMG (${m.isAlive ? 'Còn sống' : 'Đã chết'})`).join('\n') +
              rewardsText
            )
            .setTimestamp();

          let logStr = result.log.join('\n');
          if (logStr.length > 3000) logStr = logStr.substring(logStr.length - 3000) + '\n... (Rút gọn)';
          const logEmbed = new EmbedBuilder().setTitle('📜 Diễn Biến').setDescription(logStr).setColor(EMBED_COLORS.DARK);

          await interaction.editReply({ content: null, ...toV2Payload([embed, logEmbed]) });
          } catch (combatErr: any) {
            console.error('[BiCanh CoOp] Lỗi chiến đấu tổ đội:', combatErr);
            partyService.endParty(partyId);
            await interaction.editReply({ content: null, ...toV2TextUpdate(`❌ Đã xảy ra lỗi trong trận chiến: ${combatErr?.message || 'Lỗi không xác định'}. Tổ đội đã giải tán.`) });
          }
          return;
        }

        // --- Nút: GUILD WAR - TẤN CÔNG / LÀM MỚI ---
        else if (action === 'guildwar') {
          const gwAction = parts[1] as 'attack' | 'refresh';
          const warId = parts[2];

          if (gwAction === 'attack') {
            const result = guildWarService.attack(warId, userId);
            if (!result.success) {
              await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
              return;
            }
            await interaction.reply({ content: result.message });
          } else if (gwAction === 'refresh') {
            const war = guildWarService.getWarDetail(warId);
            if (!war) {
              await interaction.reply({ content: '❌ Cuộc chiến không tồn tại!', flags: MessageFlags.Ephemeral });
              return;
            }

            const challengerSect = guildWarService.getSectInfo(war.challenger_sect_id);
            const defenderSect = guildWarService.getSectInfo(war.defender_sect_id);

            let statusText = '';
            let color: any = '#3498db';

            if (war.status === 'active') {
              const turnOrder: string[] = JSON.parse(war.turn_order || '[]');
              const currentTurnUserId = turnOrder[war.current_turn_index];
              const currentUser = currentTurnUserId ? userRepository.get(currentTurnUserId) : null;

              statusText = `⚔️ **ĐANG CHIẾN ĐẤU**\n\n` +
                `**${challengerSect?.name}**: ${war.challenger_hp}❤️\n` +
                `**${defenderSect?.name}**: ${war.defender_hp}❤️\n\n` +
                `Hiệp: **${war.current_round}/${war.max_rounds}**\n` +
                `Đến lượt: **${currentUser?.name || 'Không xác định'}**`;
              color = EMBED_COLORS.ERROR;
            } else if (war.status === 'pending') {
              statusText = `⏳ **Chờ phản hồi từ ${defenderSect?.name}...**`;
              color = '#f39c12';
            } else {
              statusText = `🏆 **Chiến tranh kết thúc!**`;
              color = '#2ecc71';
            }

            const embed = new EmbedBuilder()
              .setTitle(`⚔️ ${challengerSect?.name} vs ${defenderSect?.name}`)
              .setColor(color)
              .setDescription(statusText +
                `\n\n_Dùng \`/guildwar thongtin\` để xem chi tiết đầy đủ._`)
              .setTimestamp();

            await safeV2Update(interaction, [embed], []);
          }
        }

        // --- Nút: CHẤP NHẬN / TỪ CHỐI KẾT HÔN ---
        else if (action === 'marriageaccept' || action === 'marriagerefuse') {
          const proposerId = parts[1];
          const targetId = parts[2];
          
          if (action === 'marriagerefuse') {
            await safeV2TextUpdate(interaction, `💔 Đạo hữu <@${targetId}> đã uyển chuyển từ chối lời cầu hôn của <@${proposerId}>. Duyên phận chưa tới!`);
            return;
          }

          // Chấp nhận
          const { marriageService } = require('../services/MarriageService');
          const result = marriageService.acceptProposal(proposerId, targetId);

          if (result.success) {
            await safeV2TextUpdate(interaction, result.message);
          } else {
            await safeV2TextUpdate(interaction, `❌ Cầu hôn thất bại: ${result.message}`);
          }
        }

        // --- Nút: SỬA CHỮA TRANG BỊ (từ /suachua danhsach) ---
        else if (action === 'suachua') {
          const subAction = parts[1]; // 'all'
          
          if (subAction === 'all') {
            const { handleRepairAllButton } = require('../commands/general/suachua');
            const result = handleRepairAllButton(userId);
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
          }
          return;
        }

        // --- Nút: TẤN CÔNG TÔNG MÔN CHIẾN (Sect War) ---
        else if (action === 'sectwarattack') {
          const { sectWarService } = require('../services/SectWarService');
          const battleId = parseInt(parts[1], 10);
          const result = sectWarService.attack(battleId, userId);
          await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
          return;
        }

        // --- Nút: LÀM MỚI TÔNG MÔN CHIẾN ---
        else if (action === 'sectwarrefresh') {
          const { sectWarService } = require('../services/SectWarService');
          const battleId = parseInt(parts[1], 10);
          const battle = sectWarService.getBattleDetails(battleId);
          if (!battle) {
            await interaction.reply({ content: '❌ Trận chiến không tồn tại!', flags: MessageFlags.Ephemeral });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle(`⚔️ Tông Môn Chiến #${battle.id}`)
            .setColor(EMBED_COLORS.ERROR)
            .setDescription(
              `**Trạng thái:** ${battle.status === 'active' ? 'Đang chiến' : 'Kết thúc'}\n` +
              `**Vòng:** ${battle.current_round}/${battle.max_rounds}\n` +
              `**Sect A:** ${battle.sect_a_id} (HP: ${battle.sect_a_hp})\n` +
              `**Sect B:** ${battle.sect_b_id} (HP: ${battle.sect_b_hp})\n` +
              `**Sect C:** ${battle.sect_c_id} (HP: ${battle.sect_c_hp})\n\n` +
              `Dùng \`/combat sectwar tancong\` để tham chiến!`
            )
            .setTimestamp();
          await safeV2Update(interaction, [embed], []);
          return;
        }

        // --- Nút: LỰA CHỌN ENCOUNTER (Kỳ Ngộ Làm Việc / Săn Yêu Thú) ---
        else if (action === 'encounter') {
          const userIdFromParts = parts[parts.length - 1];
          if (interaction.user.id !== userIdFromParts) {
            await interaction.reply({ content: '❌ Đây không phải kỳ ngộ của đạo hữu!', flags: MessageFlags.Ephemeral });
            return;
          }

          const choiceIndex = parseInt(parts[parts.length - 2], 10);
          const encounterId = parts.slice(1, parts.length - 2).join('_');

          const { encounterService } = require('../services/EncounterService');
          
          // Lấy thông tin encounter từ service
          const allEncounters = [
            ...encounterService.getEncounterPool('lamviec'),
            ...encounterService.getEncounterPool('sanyeuthu')
          ];
          const encounter = allEncounters.find((e: any) => e.id === encounterId);
          
          if (!encounter) {
            await safeV2TextUpdate(interaction, '❌ Kỳ ngộ này không còn tồn tại hoặc bị lỗi.');
            return;
          }

          const choice = encounter.choices[choiceIndex];
          if (!choice) {
            await safeV2TextUpdate(interaction, '❌ Lựa chọn không hợp lệ.');
            return;
          }

          const result = encounterService.resolveEncounter(userIdFromParts, encounterId, choice.id);
          
          // Tạo một Embed hiển thị kết quả
          const embed = new EmbedBuilder()
            .setTitle(result.success ? '✨ KỲ NGỘ THÀNH CÔNG' : '😅 KỲ NGỘ THẤT BẠI')
            .setColor(result.success ? '#2ecc71' : EMBED_COLORS.ERROR)
            .setDescription(result.message)
            .setTimestamp();

          const rewardTexts: string[] = [];
          if (result.rewards.coins) rewardTexts.push(`• Linh Thạch: **${result.rewards.coins > 0 ? '+' : ''}${result.rewards.coins}** LT 🟤`);
          if (result.rewards.exp) rewardTexts.push(`• Tu Vi: **+${result.rewards.exp}** 🌿`);
          if (result.rewards.contribution) rewardTexts.push(`• Cống Hiến: **+${result.rewards.contribution}** ⚜️`);
          if (result.rewards.ngotinh) rewardTexts.push(`• Ngộ Tính: **+${result.rewards.ngotinh}** 🧠`);
          if (result.rewards.items) rewardTexts.push(`• Vật Phẩm: Nhận vật phẩm cơ duyên x**${result.rewards.items}** 🎁`);
          if (result.rewards.pet_received) rewardTexts.push(`• Linh Thú: Thu phục thần thú cơ duyên 🦄`);
          if (result.rewards.farming_acceleration) rewardTexts.push(`• Linh Điền: Gia tốc sinh trưởng **+${result.rewards.farming_acceleration} giờ** 🌧️`);
          
          if (rewardTexts.length > 0) {
            embed.addFields({ name: '🎁 Biến Động Thuộc Tính', value: rewardTexts.join('\n') });
          }

          await safeV2Update(interaction, [embed], []);
          return;
        }

        // --- Nút: ĐÁNH THỨC LINH KHÍ (Spirit Weapon Interact) ---
        else if (action === 'spiritinteract') {
          const { spiritWeaponService } = require('../services/SpiritWeaponService');
          const result = spiritWeaponService.interact(userId);
          await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
          return;
        }

        // --- Nút: PHÓ BẢN TINH ANH (Elite Dungeon) ---
        else if (action === 'edenter') {
          const { eliteDungeonService } = require('../services/EliteDungeonService');
          const dungeonKey = parts.slice(1, -1).join('_');
          const result = eliteDungeonService.startRun(userId, dungeonKey, `party_${userId}_${dungeonKey}`);
          await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
          return;
        }

        else if (action === 'edattack') {
          const { eliteDungeonService } = require('../services/EliteDungeonService');
          const runId = parseInt(parts[1], 10);
          const run = eliteDungeonService.getRunById(runId);
          if (!run) {
            await interaction.reply({ content: '❌ Run không tồn tại!', flags: MessageFlags.Ephemeral });
            return;
          }
          const partyMembers: any[] = [{ userId, name: user.name, atk: 100, def: 50, hp: 1000, maxHp: 1000, crit: 0.1, speed: 100 }];
          const result = eliteDungeonService.processFloorResult(runId, run.dungeon_id, partyMembers);
          await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
          return;
        }

        else if (action === 'edretreat') {
          const { eliteDungeonService } = require('../services/EliteDungeonService');
          const runId = parseInt(parts[1], 10);
          const run = eliteDungeonService.getRunById(runId);
          if (!run) {
            await interaction.reply({ content: '❌ Run không tồn tại!', flags: MessageFlags.Ephemeral });
            return;
          }
          db.prepare("UPDATE elite_dungeon_runs SET status = 'failed' WHERE id = ?").run(runId);
          await interaction.reply({ content: `🏳️ Đã rút lui khỏi bí cảnh tinh anh.`, flags: MessageFlags.Ephemeral });
          return;
        }

        // --- Nút: ĐI ĐẾN KHÍ LINH (từ hồ sơ) ---
        else if (action === 'spiritnav') {
          const { spiritWeaponService } = require('../services/SpiritWeaponService');
          const weapons = spiritWeaponService.getSpiritWeapons(targetUserId);
          const embed = new EmbedBuilder()
            .setTitle('⚡ KHÍ LINH - PHÁP BẢO THỨC TỈNH')
            .setColor(EMBED_COLORS.MYSTIC)
            .setDescription('Trang bị Epic+ có thể thức tỉnh khí linh, cung cấp skill bị động chiến đấu.');

          if (weapons.length > 0) {
            for (const sw of weapons) {
              const affinityBar = '❤️'.repeat(Math.min(sw.affinity, 5)) + '🖤'.repeat(Math.max(0, 5 - sw.affinity));
              embed.addFields({
                name: `⚡ ${sw.spirit_name} (Cấp ${sw.level})`,
                value: `📊 Thân thiết: ${affinityBar}\n🔮 Skill: **${sw.skill_id || 'Chưa học'}**\nDùng \`/khilinh tungduong\` để tương tác.`,
              });
            }
          } else {
            embed.addFields({ name: '📭 Chưa có', value: 'Chưa thức tỉnh khí linh nào. Dùng `/khilinh thuctinh` trên trang bị Epic+.' });
          }

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row]);
        }

        // --- Nút: ĐI ĐẾN TỌA KỴ (từ hồ sơ) ---
        else if (action === 'toakynav') {
          const mounts = mountService.getMounts(targetUserId);
          const active = mountService.getActiveMount(targetUserId);

          let desc = 'Quản lý tọa kỵ - giảm cooldown làm việc và tiết kiệm thể lực.';
          if (active) {
            desc = `🐎 Đang cưỡi: **${active.name}** (Tốc độ +${Math.round(active.speed_bonus * 100)}% / Tiết kiệm +${Math.round(active.stamina_save * 100)}%)`;
          }

          const embed = new EmbedBuilder()
            .setTitle('🐎 TỌA KỴ')
            .setColor(EMBED_COLORS.ORANGE)
            .setDescription(desc);

          if (mounts.length > 0) {
            for (const m of mounts.slice(0, 5)) {
              embed.addFields({
                name: `#${m.id} ${m.name} (Cấp ${m.level}) [${m.rarity}]${m.is_active ? ' ✅' : ''}`,
                value: `Tốc độ: +${Math.round(m.speed_bonus * 100)}% | Tiết kiệm: +${Math.round(m.stamina_save * 100)}%`,
              });
            }
          } else {
            embed.addFields({ name: '📭 Danh sách trống', value: 'Chưa có tọa kỵ nào.' });
          }

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`hosoback_${targetUserId}`)
              .setLabel('🔙 Quay Lại Hồ Sơ')
              .setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [embed], [row]);
        }

      } catch (error: any) {
        if (error?.code === 10062 || error?.rawError?.code === 10062 ||
            error?.code === 40060 || error?.rawError?.code === 40060) {
          return;
        }
        console.error('[Button Error] Lỗi xử lý nút bấm:', error);
        try {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
          } else {
            await interaction.followUp({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
          }
        } catch (replyError: any) {
          if (replyError?.code !== 10062 && replyError?.rawError?.code !== 10062) {
            console.error('Không thể gửi thông báo lỗi button:', replyError);
          }
        }
      }

      return;
    }

    // 3. Xử lý Dropdown Menu (String Select Menu Interactions)
    if (interaction.isStringSelectMenu() && !interaction.customId.startsWith('hosoaction_') && !interaction.customId.startsWith('hosoaction1_') && !interaction.customId.startsWith('hosoaction2_')) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const actionType = parts[0];
      const targetUserId = parts[parts.length - 1];
      const page = parseInt(parts[1], 10) || 1;
      
      // Bảo mật: Chỉ cho phép người sở hữu tương tác
      if (interaction.user.id !== targetUserId) {
        console.log(`[DEBUG] Block 3 Error: user.id='${interaction.user.id}', targetUserId='${targetUserId}', customId='${customId}'`);
        const actionLabel = actionType === 'bptselect' ? 'bảng xếp hạng' : 'túi đồ';
        await interaction.reply({
          content: `❌ **Cảnh báo:** Đạo hữu không thể tương tác với ${actionLabel} của tu sĩ khác!`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // --- Menu: BẢNG PHONG THẦN CATEGORY SELECT ---
      if (actionType === 'bptselect') {
        const selectedCategory = interaction.values[0];
        const { buildLeaderboardMessage } = require('../commands/general/bangphongthan');
        const messageOptions = buildLeaderboardMessage(targetUserId, selectedCategory, 1);
        await safeV2Update(interaction, messageOptions.embeds, messageOptions.components);
        return;
      }

      // --- Menu: HƯỚNG DẪN ---
      if (actionType === 'huongdan') {
        const { handleHuongDanSelect } = require('../commands/general/huongdan');
        await handleHuongDanSelect(interaction);
        return;
      }

      // --- Menu: CẨM NANG ---
      if (actionType === 'camnang') {
        const { handleCamNangSelect } = require('../commands/general/camnang');
        await handleCamNangSelect(interaction);
        return;
      }

      if (actionType === 'invselect') {
        const selectedValue = interaction.values[0]; // Cú pháp: "action_inventoryId" (vd: "equip_123")
        const firstUnderscore = selectedValue.indexOf('_');
        const itemAction = selectedValue.substring(0, firstUnderscore);
        const inventoryId = parseInt(selectedValue.substring(firstUnderscore + 1), 10);

        if (isNaN(inventoryId)) {
          await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
          return;
        }

        let resultMessage = '';
        let success = false;

        // Thực thi các hành động sử dụng / trang bị
        if (itemAction === 'equip') {
          const res = inventoryService.equipItem(targetUserId, inventoryId);
          success = res.success;
          resultMessage = res.message;
        } else if (itemAction === 'unequip') {
          const res = inventoryService.unequipItem(targetUserId, inventoryId);
          success = res.success;
          resultMessage = res.message;
        } else if (itemAction === 'use') {
          const res = inventoryService.useItem(targetUserId, inventoryId);
          success = res.success;
          resultMessage = res.message;
        }

        if (!success) {
          await interaction.reply({ content: `❌ ${resultMessage}`, flags: MessageFlags.Ephemeral });
          return;
        }

        // Cập nhật lại giao diện túi đồ tại trang hiện tại
        const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, page);
        const components = getInventoryComponents(targetUserId, page, totalPages, itemsOnPage);

        await safeV2Update(interaction, [embed], components);

        // Gửi thông báo nổi xác thực hành động thành công
        await interaction.followUp({ content: `💼 ${resultMessage}`, flags: MessageFlags.Ephemeral });
      }
      
      else if (actionType === 'linhdiengieoselect') {
        const seedItemId = interaction.values[0];
        const plots = farmingService.getPlots(targetUserId);
        const emptyPlot = plots.find(p => p.status === 'empty');

        if (!emptyPlot) {
          await interaction.reply({ content: '❌ Linh điền không còn ô đất trống để gieo hạt!', flags: MessageFlags.Ephemeral });
          return;
        }

        const result = farmingService.plantSeed(targetUserId, emptyPlot.plot_index, seedItemId);
        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getLinhDienEmbed(targetUserId);
        const components = getLinhDienComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
      }

      else if (actionType === 'linhdienspeedupselect') {
        const plotIndex = parseInt(interaction.values[0], 10);
        const result = farmingService.speedupPlot(targetUserId, plotIndex);

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getLinhDienEmbed(targetUserId);
        const components = getLinhDienComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      else if (actionType === 'linhdiencareselect') {
        const careValue = interaction.values[0]; // "water_0", "fertilize_0", "catchpests_0"
        const [careType, plotIndexStr] = careValue.split('_');
        const plotIndex = parseInt(plotIndexStr, 10);

        let result: { success: boolean; message: string };
        if (careType === 'water') {
          result = farmingService.waterPlot(targetUserId, plotIndex);
        } else if (careType === 'fertilize') {
          result = farmingService.fertilizePlot(targetUserId, plotIndex);
        } else if (careType === 'catchpests') {
          result = farmingService.catchPests(targetUserId, plotIndex);
        } else {
          await interaction.reply({ content: '❌ Thao tác không hợp lệ!', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getLinhDienEmbed(targetUserId);
        const components = getLinhDienComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      else if (actionType === 'sectjoinselect') {
        const sectId = parseInt(interaction.values[0], 10);
        const result = sectService.joinSect(targetUserId, sectId);

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getSectEmbed(targetUserId);
        const components = getSectComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      else if (actionType === 'sectdonateselect') {
        const amount = parseInt(interaction.values[0], 10);
        const result = sectService.donateToSect(targetUserId, amount);

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        // Cập nhật tiến trình nhiệm vụ hàng ngày khi quyên góp tông môn
        dailyQuestService.updateProgress(targetUserId, 'daily_tongmon', 1);
        
        // Nạp năng lượng Linh Mạch Tông Môn (phụ thuộc vào số tiền donate)
        leylineService.addEnergy(targetUserId, 'tongmon', Math.max(10, Math.floor(amount / 5)));

        const embed = getSectEmbed(targetUserId);
        const components = getSectComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      else if (actionType === 'luyenkhiselect') {
        const recipeId = interaction.values[0];
        
        const { blacksmithService } = require('../services/BlacksmithService');
        const res = blacksmithService.forgeItem(targetUserId, recipeId);
        
        await interaction.reply({ content: res.success ? res.message : `❌ ${res.message}` });

        // Cập nhật lại UI Luyện Khí
        const user = userRepository.get(targetUserId);
        if (user) {
          const embed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(embed).setFooter({ text: `Thể lực hiện tại: ${user.stamina}/500 | Linh Thạch: ${user.coin_ha_pham}` });
          await interaction.client.rest.patch(Routes.channelMessage(interaction.channelId, interaction.message.id), { body: { components: [embedToV2(newEmbed)], flags: V2_FLAG } });
        }
      }

      else if (actionType === 'craftselect') {
        const recipeId = interaction.values[0];
        const result = craftingService.startCrafting(targetUserId, recipeId);

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getCraftingEmbed(targetUserId);
        const components = getCraftingComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }



      // --- Menu: MUA NHANH VẬT PHẨM CỬA HÀNG (từ /hoso) ---
      else if (actionType === 'shopbuy') {
        const itemId = interaction.values[0];
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        const buyer = userRepository.get(targetUserId);

        if (!item || !buyer) {
          await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
          return;
        }

        const activeCategory = parts[1];
        const pageNum = parts[2];
        const cleanName = item.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim().substring(0, 30);

        const modal = new ModalBuilder()
          .setCustomId(`shopbuymodal_${targetUserId}_${itemId}:${activeCategory}:${pageNum}`)
          .setTitle(`Mua ${cleanName}`);

        const qtyInput = new TextInputBuilder()
          .setCustomId('buy_qty')
          .setLabel('Số lượng muốn mua')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Nhập số lượng lớn hơn 0 (ví dụ: 1)')
          .setValue('1')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
        );

        await interaction.showModal(modal);
      }

      // --- Menu: THỈNH NHANH BÍ TỌH KỸ NĂNG (từ /hoso) ---
      else if (actionType === 'sknbuy') {
        const bookId = interaction.values[0];
        const book = SKILL_BOOKS.find(b => b.id === bookId);
        const buyer = userRepository.get(targetUserId);

        if (!book || !buyer) {
          await interaction.reply({ content: '❌ Bí tịch không hợp lệ!', flags: MessageFlags.Ephemeral });
          return;
        }

        if (buyer.coin_ha_pham < book.price) {
          await interaction.reply({
            content: `❌ Đạo hữu không đủ Linh Thạch! (Giá: **${book.price}**, hiện có: **${buyer.coin_ha_pham}**).`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        userRepository.update(targetUserId, { coin_ha_pham: buyer.coin_ha_pham - book.price });
        inventoryRepository.addItem(targetUserId, book.id, 1);

        const primaryId = parts[1];
        const pageNum = parseInt(parts[2], 10) || 1;
        const embed = getShopEmbed(targetUserId, primaryId, undefined, pageNum);
        const sknComps = getShopComponents(targetUserId, primaryId, undefined, pageNum);
        const rowsArr = Array.isArray(sknComps) ? sknComps : [sknComps];
        await safeV2Update(interaction, [embed], rowsArr);
        await interaction.followUp({ content: `📚 Thỉnh thành công **1x ${book.name}** (−${book.price} Linh Thạch)! Dùng \`/dungkynang item_id: ${book.id}\` để lĩnh ngộ.`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // 4. Xử lý Modal Submit (Modal Submissions)
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const action = parts[0];
      const targetUserId = parts[1];

      if (action === 'adminmodal' || action === 'adminuser') {
        const AdminCommand = require('../commands/general/admin').default;
        await AdminCommand.handleModal(client, interaction, parts);
        return;
      }

      // Bảo mật
      if (interaction.user.id !== targetUserId) {
        await interaction.reply({
          content: '❌ **Cảnh báo:** Đạo hữu không thể can thiệp vào hành động của tu sĩ khác!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (action === 'sectcreate') {
        const name = interaction.fields.getTextInputValue('sect_name');
        const desc = interaction.fields.getTextInputValue('sect_desc');

        const result = sectService.createSect(targetUserId, name, desc);
        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getSectEmbed(targetUserId);
        const components = getSectComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }
      
      else if (action === 'doitienmodal') {
        const type = parts.slice(2).join('_');
        const qtyStr = interaction.fields.getTextInputValue('doitien_qty');
        const qty = parseInt(qtyStr, 10);

        if (isNaN(qty) || qty <= 0) {
          await interaction.reply({ content: '❌ Số lượng lần đổi phải là số nguyên lớn hơn 0!', flags: MessageFlags.Ephemeral });
          return;
        }

        const DoiTienCommand = require('../commands/general/doitien').default;
        const { getDoiTienEmbed, getDoiTienComponents } = require('../commands/general/doitien');

        const res = DoiTienCommand.performConversion(targetUserId, type, qty);
        if (!res.success) {
          await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getDoiTienEmbed(targetUserId);
        const components = getDoiTienComponents(targetUserId);

        if ((interaction as any).update) {
          await safeV2Update(interaction, [embed], components);
          await interaction.followUp({ content: `✅ Quy đổi thành công! ${res.message}`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `✅ Quy đổi thành công! ${res.message}`, flags: MessageFlags.Ephemeral });
        }
      }

      // --- Modal: MUA NHANH VẬT PHẨM CỬA HÀNG ---
      else if (action === 'shopbuymodal') {
        const rest = parts.slice(2).join('_');
        const subParts = rest.split(':');
        const itemId = subParts[0];
        const activeCategory = subParts[1];
        const pageNum = parseInt(subParts[2], 10) || 1;
        const qtyStr = interaction.fields.getTextInputValue('buy_qty');
        const qty = parseInt(qtyStr, 10);

        if (isNaN(qty) || qty <= 0) {
          await interaction.reply({ content: '❌ Số lượng mua phải là số nguyên lớn hơn 0!', flags: MessageFlags.Ephemeral });
          return;
        }

        const item = SHOP_ITEMS.find(i => i.id === itemId);

        if (!item) {
          await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
          return;
        }

        const totalCost = item.price * qty;

        if (item.currency === 'knb') {
          let realItemId = item.id;
          if (item.id === ITEMS.ITEM_NHAN_DINH_HON_KNB) realItemId = ITEMS.ITEM_NHAN_DINH_HON;
          if (item.id === ITEMS.ITEM_BLOODLINE_PILL_KNB) realItemId = ITEMS.ITEM_BLOODLINE_PILL;

          const tx = db.transaction(() => {
            const buyer = userRepository.get(targetUserId);
            if (!buyer) throw new Error('Đạo hữu chưa khởi tạo nhân vật');
            if (buyer.knb < totalCost) throw new Error(`Không đủ KNB! (Cần: ${totalCost}, có: ${buyer.knb})`);
            checkAndUpdateWeeklyLimit(targetUserId, item.id, qty);
            userRepository.update(targetUserId, { knb: buyer.knb - totalCost });
            inventoryRepository.addItem(targetUserId, realItemId, qty);
          });

          try {
            tx();
          } catch (error: any) {
            await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getShopEmbed(targetUserId, activeCategory, undefined, pageNum);
          const shopComps = getShopComponents(targetUserId, activeCategory, undefined, pageNum);
          const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];

          if ((interaction as any).update) {
            await safeV2Update(interaction, [embed], rowsArr);
            await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: MessageFlags.Ephemeral });
          }
        } else {
          const tx = db.transaction(() => {
            const buyer = userRepository.get(targetUserId);
            if (!buyer) throw new Error('Đạo hữu chưa khởi tạo nhân vật');
            if (buyer.coin_ha_pham < totalCost) throw new Error(`Không đủ Linh Thạch! (Cần: ${totalCost}, có: ${buyer.coin_ha_pham})`);
            checkAndUpdateWeeklyLimit(targetUserId, item.id, qty);
            userRepository.update(targetUserId, { coin_ha_pham: buyer.coin_ha_pham - totalCost });
            inventoryRepository.addItem(targetUserId, item.id, qty);
          });

          try {
            tx();
          } catch (error: any) {
            await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: MessageFlags.Ephemeral });
            return;
          }

          const embed = getShopEmbed(targetUserId, activeCategory, undefined, pageNum);
          const shopComps = getShopComponents(targetUserId, activeCategory, undefined, pageNum);
          const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];

          if ((interaction as any).update) {
            await safeV2Update(interaction, [embed], rowsArr);
            await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: MessageFlags.Ephemeral });
          }
        }
      }

      // --- Modal: TÌM KIẾM CỬA HÀNG ---
      else if (action === 'shopsearchmodal') {
        const searchQuery = interaction.fields.getTextInputValue('search_query');
        const embed = getShopEmbed(targetUserId, undefined, undefined, 1, searchQuery);
        const rows = getShopComponents(targetUserId, undefined, undefined, 1, searchQuery);
        if ((interaction as any).update) {
          await safeV2Update(interaction, [embed], rows);
        } else {
          await interaction.reply(toV2Payload([embed], rows));
        }
      }
      return;
    }
    } catch (error: any) {
      // Lỗi 10062: Interaction đã hết hạn (>3 giây) - bỏ qua, không crash bot
      // Lỗi 40060: Interaction đã được acknowledged - bỏ qua
      if (error?.code === 10062 || error?.rawError?.code === 10062 ||
          error?.code === 40060 || error?.rawError?.code === 40060) {
        console.warn(`[Interaction Skipped] code=${error?.code ?? error?.rawError?.code}, user=${interaction.user.tag}`);
        return;
      }
      console.error(`[Interaction Error] Lỗi nghiêm trọng khi xử lý tương tác của ${interaction.user.tag}:`, error);
      const errorMsg = '❌ Đã xảy ra lỗi hệ thống khi xử lý yêu cầu của đạo hữu. Vui lòng thử lại sau.';
      try {
        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
          }
        }
      } catch (replyError: any) {
        // Bỏ qua nếu interaction đã hết hạn khi cố gửi thông báo lỗi
        if (replyError?.code !== 10062 && replyError?.rawError?.code !== 10062) {
          console.error('Không thể gửi tin nhắn lỗi cho người dùng:', replyError);
        }
      }
    } finally {
      if (acquired) {
        InteractionLock.release(userId);
      }
    }
  }
}
