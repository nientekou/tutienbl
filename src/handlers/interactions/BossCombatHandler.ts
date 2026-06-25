import { ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, Routes, EmbedBuilder } from 'discord.js';
import db from '../../database/database';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryService } from '../../services/InventoryService';
import { combatService } from '../../services/CombatService';
import { bossSpawnService } from '../../services/BossSpawnService';
import { bossSeasonService } from '../../services/BossSeasonService';
import { dailyQuestService } from '../../services/DailyQuestService';
import { autoBalanceService } from '../../services/AutoBalanceService';
import { ITEMS } from '../../config/itemConstants';
import { buildWorldBossContainer, getBossShopEmbed, getBossShopComponents, handleBossShopPurchase } from '../../commands/combat/worldboss';
import { EMBED_COLORS, toV2Payload, toV2TextUpdate, safeV2Update, safeV2TextUpdate } from '../../utils/uiSystem';

const combatLogsCache = new Map<string, { data: string[]; timestamp: number }>();

type BossCombatInteraction = ButtonInteraction | StringSelectMenuInteraction;

export async function handleBossCombatAction(interaction: BossCombatInteraction, action: string, parts: string[], userId: string): Promise<void> {
  try {
    const targetUserId = parts[parts.length - 1];
    const user = userRepository.get(targetUserId);

    if (action === 'worldbossattack') {
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

      const now = Math.floor(Date.now() / 1000);

      if (user.injury_end_time && user.injury_end_time > now) {
        const remain = user.injury_end_time - now;
        const minutes = Math.ceil(remain / 60);
        await interaction.reply({ content: `❌ Đạo hữu đang bị **Trọng Thương**! Cần tĩnh dưỡng thêm **${minutes} phút** mới có thể tiếp tục khiêu chiến World Boss.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const contrib = db.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
        .get(interaction.user.id) as { last_attack_at: number } | undefined;

      if (contrib && now - contrib.last_attack_at < 200) {
        const cdSec = 200 - (now - contrib.last_attack_at);
        await interaction.reply({ content: `⏳ Đạo hữu đang kiệt sức. Cần **${cdSec} giây** nữa để hồi phục!`, flags: MessageFlags.Ephemeral });
        return;
      }

      const activeStats = inventoryService.getActiveStats(interaction.user.id);
      if (!activeStats) {
        await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!', flags: MessageFlags.Ephemeral });
        return;
      }

      const pveScale = autoBalanceService.getPvEScaleFactor(interaction.user.id);

      const bossTx = db.transaction(() => {
        const bossRow = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
        if (!bossRow || bossRow.status === 'defeated') return { error: 'defeated' as const };

        const hpPercent = bossRow.max_hp > 0 ? bossRow.hp / bossRow.max_hp : 1;
        const isEnraged = hpPercent < 0.5;
        const enrageMultiplier = isEnraged ? 1.30 : 1.0;

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

      const allContribs = db.prepare("SELECT user_id, damage FROM world_boss_contributions WHERE boss_id = 'world_boss_current' ORDER BY damage DESC")
        .all() as { user_id: string; damage: number }[];
      const currentRank = allContribs.findIndex(c => c.user_id === interaction.user.id) + 1;

      const bossLevel = currentBossData.level || 1;
      const playerCurHp = user.hp ?? activeStats.hp;
      const playerMaxHp = activeStats.hp;
      const hpPercent = playerMaxHp > 0 ? playerCurHp / playerMaxHp : 1;
      const rankReflectMulti = Math.max(0.5, 1.5 - currentRank * 0.1);
      const reflectDmg = Math.round(playerMaxHp * hpPercent * 0.12 * rankReflectMulti);

      const baseInjuryChance = activeStats.hp < (currentBossData.atk * 5) ? 0.30 : 0.12;
      const injuryChance = Math.min(0.60, baseInjuryChance + bossLevel * 0.02);
      const isInjured = Math.random() < injuryChance;
      const injuryDuration = 600;

      const ngoTinhBonus = currentRank <= 3 ? 5 : 3;

      const updatedUser = userRepository.get(interaction.user.id)!;

      const newHp = Math.max(1, (updatedUser.hp || updatedUser.base_hp) - reflectDmg);

      const updates: any = {
        hp: isInjured ? 1 : newHp,
        ngotinh: updatedUser.ngotinh + ngoTinhBonus
      };

      if (isInjured) {
        updates.injury_end_time = now + injuryDuration;
      }

      userRepository.update(interaction.user.id, updates);

      dailyQuestService.updateProgress(interaction.user.id, 'daily_worldboss', 1);

      combatService.recordBossAttack(interaction.user.id, currentBossData.level, totalDmg);
      if (isDefeated) {
        combatService.recordBossKill(interaction.user.id, currentBossData.level);
      }

      const bossHpAfter = Math.max(0, currentBossData.hp - totalDmg);
      combatService.logBossAttack(interaction.user.id, totalDmg, isCrit ? 'Bạo Kích' : 'Công Kích', isCrit, bossHpAfter / (currentBossData.max_hp || 1));

      const currentBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
      await bossSpawnService.updateBossEmbeds(interaction.client as any, currentBoss);

      let rewardsText = '';
      if (isDefeated) {
        try {
          const rewardsLogs = combatService.distributeWorldBossRewards(currentBossData.level, interaction.user.id);
          rewardsText = `\n\n🏆 **BẢNG PHONG THẦN THẢO PHẠT BOSS (LEVEL ${currentBossData.level}):**\n` +
                        (rewardsLogs.length > 0 ? rewardsLogs.join('\n') : '*Không có phần thưởng.*');
          try {
            await bossSpawnService.broadcastBossDefeatedLogs(interaction.client as any, currentBoss, rewardsLogs);
          } catch (broadcastErr) {
            console.error('[WorldBoss] Lỗi broadcast:', broadcastErr);
          }
        } catch (rewardErr) {
          console.error('[WorldBoss] Lỗi phân phát thưởng:', rewardErr);
          rewardsText = `\n\n🏆 **BOSS ĐÃ BỊ TIÊU DIỆT!** (Lỗi hiển thị phần thưởng)`;
        }
      }

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

    if (action === 'worldbosslogs') {
      const { renderCombatLog } = require('../../utils/combatLogUtils');
      await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết trận đấu World Boss');
    }

    if (action === 'worldbossrefresh') {
      const payload = buildWorldBossContainer(targetUserId);
      await interaction.client.rest.post(
        Routes.interactionCallback(interaction.id, interaction.token),
        { body: { type: 7, data: payload } }
      );
      (interaction as any).replied = true;
    }

    if (action === 'worldbossheal') {
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

    if (action === 'wbhealconfirm') {
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

    if (action === 'wbhealcancel') {
      await interaction.update({ content: '❌ Đã hủy hồi máu.', components: [] });
    }

    if (action === 'worldbosslb') {
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

    if (action === 'worldbossleave') {
      try { await interaction.message.delete(); } catch (e) {}
      return;
    }

    if (action === 'bossshop') {
      const embed = getBossShopEmbed(targetUserId);
      const row = getBossShopComponents(targetUserId);
      await safeV2Update(interaction, [embed], [row]);
    }

    if (action === 'bossshop_buy' && interaction.isStringSelectMenu()) {
      const itemKey = interaction.values[0];
      const result = handleBossShopPurchase(targetUserId, itemKey);
      const embed = getBossShopEmbed(targetUserId, result.message);
      const row = getBossShopComponents(targetUserId);
      await safeV2Update(interaction, [embed], [row]);
      // ponytail: ephemeral followUp so the user always sees a popup notification
      await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    if (action === 'sanyeuthulogs') {
      const { renderCombatLog } = require('../../utils/combatLogUtils');
      await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết nhật ký trận săn');
      return;
    }

    if (action === 'worldbossnav') {
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

    if (action === 'joinparty') {
      const partyId = parts.slice(1).join('_');
      const { partyService } = require('../../services/PartyService');

      const party = partyService.getParty(partyId);
      if (!party) {
        await interaction.reply({ content: '❌ Tổ đội không tồn tại hoặc đã bị giải tán!', flags: MessageFlags.Ephemeral });
        return;
      }

      const { COOP_DUNGEONS } = require('../../commands/combat/bicanh');
      const dungeon = COOP_DUNGEONS.find((d: any) => d.id === party.dungeonId);
      if (dungeon) {
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
        const { buildCoopPartyEmbed } = require('../../commands/combat/bicanh');
        const embed = buildCoopPartyEmbed(partyId);
        await safeV2Update(interaction, [embed]);
      } else {
        await safeV2TextUpdate(interaction, '✅ Đã tham gia.');
      }
    }

    if (action === 'leaveparty') {
      const partyId = parts.slice(1).join('_');
      const { partyService } = require('../../services/PartyService');
      const res = partyService.leaveParty(partyId, userId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const party = partyService.getParty(partyId);
      if (!party) {
        await safeV2TextUpdate(interaction, '💥 Đội đã giải tán!');
      } else {
        const { buildCoopPartyEmbed } = require('../../commands/combat/bicanh');
        const embed = buildCoopPartyEmbed(partyId);
        await safeV2Update(interaction, [embed]);
      }
    }

    if (action === 'startparty') {
      const partyId = parts.slice(1).join('_');
      const { partyService } = require('../../services/PartyService');
      const partyObj = partyService.getParty(partyId);
      if (!partyObj) {
        await interaction.reply({ content: '❌ Tổ đội không tồn tại!', flags: MessageFlags.Ephemeral });
        return;
      }

      const { COOP_DUNGEONS } = require('../../commands/combat/bicanh');
      const dungeon = COOP_DUNGEONS.find((d: any) => d.id === partyObj.dungeonId);
      if (!dungeon) {
        await interaction.reply({ content: '❌ Bí cảnh không hợp lệ!', flags: MessageFlags.Ephemeral });
        return;
      }

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
      const { PartyCombatEngine } = require('../../services/PartyCombatEngine');

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
        const partyMembers = [];
        const { inventoryService } = require('../../services/InventoryService');
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
              db.prepare(`UPDATE users SET dungeon_clears = COALESCE(dungeon_clears, 0) + 1 WHERE discord_id = ?`).run(mId);

              rewardsText += `• **${u.name}**: +${rw.exp} Tu Vi, +${rw.coins} Linh Thạch.\n`;

              if (Math.random() < 0.2) {
                db.prepare(`INSERT INTO inventories (user_id, item_id, quantity, is_equipped, created_at) VALUES (?, ?, 1, 0, ?)`).run(mId, ITEMS.MANH_VO_VU_KHI, Math.floor(Date.now()/1000));
                rewardsText += `  🎉 Nhận 1x Mảnh Vỡ Vũ Khí!\n`;
              }
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

    if (action === 'edenter') {
      const { eliteDungeonService } = require('../../services/EliteDungeonService');
      const dungeonKey = parts.slice(1, -1).join('_');
      const result = eliteDungeonService.startRun(userId, dungeonKey, `party_${userId}_${dungeonKey}`);
      await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
      return;
    }

    if (action === 'edattack') {
      const { eliteDungeonService } = require('../../services/EliteDungeonService');
      const runId = parseInt(parts[1], 10);
      const run = eliteDungeonService.getRunById(runId);
      if (!run) {
        await interaction.reply({ content: '❌ Run không tồn tại!', flags: MessageFlags.Ephemeral });
        return;
      }
      const partyMembers: any[] = [{ userId, name: user!.name, atk: 100, def: 50, hp: 1000, maxHp: 1000, crit: 0.1, speed: 100 }];
      const result = eliteDungeonService.processFloorResult(runId, run.dungeon_id, partyMembers);
      await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
      return;
    }

    if (action === 'edretreat') {
      const { eliteDungeonService } = require('../../services/EliteDungeonService');
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

    // --- Lập Đội (Party Room) ---
    if (action === 'lapdoi') {
      const lapdoiAction = parts[1] as 'ready' | 'start' | 'leave' | 'disband' | 'refresh';
      const roomId = parts[2];
      const { readyStates, getPartyRoomEmbed, getPartyRoomComponents } = require('../../commands/combat/lapdoi');
      const { dailyQuestService } = require('../../services/DailyQuestService');

      if (lapdoiAction === 'ready') {
        const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as any;
        if (!room) {
          await interaction.reply({ content: '❌ Phòng không tồn tại hoặc đã đóng!', flags: MessageFlags.Ephemeral });
          return;
        }
        const readySet = readyStates.get(roomId) || new Set();
        if (readySet.has(userId)) readySet.delete(userId);
        else readySet.add(userId);
        readyStates.set(roomId, readySet);
        const host = userRepository.get(room.host_id);
        const embed = getPartyRoomEmbed(room, host);
        const components = getPartyRoomComponents(room, userId);
        await safeV2Update(interaction, [embed], components);
        return;
      }

      if (lapdoiAction === 'start') {
        const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND host_id = ? AND status = 'waiting'").get(roomId, userId) as any;
        if (!room) {
          await interaction.reply({ content: '❌ Chỉ chủ phòng mới có thể bắt đầu!', flags: MessageFlags.Ephemeral });
          return;
        }
        const members: string[] = JSON.parse(room.member_ids || '[]');
        const readySet = readyStates.get(roomId) || new Set();
        if (members.length < 2 || !members.every(m => readySet.has(m))) {
          await interaction.reply({ content: '❌ Chưa đủ thành viên sẵn sàng! (Cần ít nhất 2 người)', flags: MessageFlags.Ephemeral });
          return;
        }
        db.prepare("UPDATE party_rooms SET status = 'fighting' WHERE id = ?").run(roomId);

        const { PartyCombatEngine } = require('../../services/PartyCombatEngine');
        const { activeStatsService } = require('../../services/ActiveStatsService');
        const { getPhoiWeaponByGrade, getPhoiArmorByGrade } = require('../../config/itemConstants');

        const partyMembers = members.map((mId: string) => {
          const u = userRepository.get(mId);
          if (!u) return null;
          const stats = activeStatsService.calculateActiveStats(u);
          const activePet = db.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(u.discord_id) as any;
          return {
            userId: u.discord_id, name: u.name, combatant: stats,
            petAtk: activePet?.stats ? JSON.parse(activePet.stats).atk || 0 : 0,
            petName: activePet?.name || null,
            hp: stats.hp, maxHp: stats.hp, isAlive: true
          };
        }).filter(Boolean) as any[];

        const isHard = room.dungeon_id === 'coop_dungeon_2';
        const bossMultiplier = isHard ? 1.5 : 1.0;
        const avgLevel = members.reduce((acc: number, mId: string) => acc + (userRepository.get(mId)?.level || 1), 0) / members.length;
        const bossConfig = {
          name: isHard ? 'Di Tích Khôi Lỗi (Boss)' : 'Yêu Thú Chúa (Boss)',
          hp: Math.floor(5000 * bossMultiplier * avgLevel * 0.5),
          maxHp: Math.floor(5000 * bossMultiplier * avgLevel * 0.5),
          atk: Math.floor(120 * bossMultiplier * avgLevel * 0.2),
          def: Math.floor(50 * bossMultiplier * avgLevel * 0.2),
          crit: 0.1, critRes: 0.1, speed: 150, dodge: 0.05
        };

        const result = PartyCombatEngine.run(partyMembers, bossConfig);
        const rewardsMap = PartyCombatEngine.distributeRewards(result, Math.floor(avgLevel));

        let rewardsText = '';
        if (result.victory) {
          rewardsText = '\n\n🎁 **PHẦN THƯỞNG CHIẾN THẮNG:**\n';
          for (const [mId, rw] of rewardsMap.entries() as any) {
            const u = userRepository.get(mId);
            if (u) {
              userRepository.update(mId, { tu_vi: u.tu_vi + rw.exp, coin_ha_pham: u.coin_ha_pham + rw.coins });
              rewardsText += `• **${u.name}**: +${rw.exp} Tu Vi, +${rw.coins} Linh Thạch.\n`;
              if (Math.random() < 0.3) {
                const phoiType = Math.random() < 0.5 ? 'weapon' : 'armor';
                const phoiGrade = isHard ? 's' : 'a';
                const phoiItemId = phoiType === 'weapon' ? getPhoiWeaponByGrade(phoiGrade) : getPhoiArmorByGrade(phoiGrade);
                db.prepare(`INSERT INTO inventories (user_id, item_id, quantity, is_equipped, created_at) VALUES (?, ?, 1, 0, ?)`).run(mId, phoiItemId, Math.floor(Date.now() / 1000));
                rewardsText += `  🎉 Nhận 1x Phôi ${phoiType === 'weapon' ? 'Vũ Khí' : 'Đạo Bào'} (${phoiGrade.toUpperCase()})!\n`;
              }
            }
          }
        }

        for (const m of partyMembers) {
          dailyQuestService.updateProgress(m.userId, 'daily_bicanh', 1);
        }
        db.prepare("UPDATE party_rooms SET status = 'closed' WHERE id = ?").run(roomId);

        const embed = new EmbedBuilder()
          .setTitle(`⚔️ BÁO CÁO TỔ ĐỘI: ${room.dungeon_id === 'coop_dungeon_1' ? 'Sơn Cốc Yêu Thú' : 'Di Tích Viễn Cổ'}`)
          .setColor(result.victory ? '#2ecc71' : EMBED_COLORS.ERROR)
          .setDescription(
            `**Kết quả:** ${result.victory ? 'Thắng Lợi 🎉' : 'Đội Hình Diệt Vong 💀'} (Sau ${result.rounds} hiệp)\n` +
            `**Boss:** ${bossConfig.name} (${result.victory ? 0 : result.bossHpRemaining}/${bossConfig.maxHp} HP)\n\n` +
            `**Thống Kê Tổ Đội:**\n` +
            partyMembers.map((m: any) => `• ${m.name}: ${result.damageByPlayer.get(m.userId) || 0} DMG (${m.isAlive ? 'Còn sống' : 'Đã chết'})`).join('\n') +
            (result.victory ? rewardsText : '\n\n💀 *Thất bại nên không nhận được phần thưởng.*')
          ).setTimestamp();

        let logStr = result.log.join('\n');
        if (logStr.length > 3000) logStr = logStr.substring(0, 3000) + '\n... (Rút gọn)';
        const logEmbed = new EmbedBuilder().setTitle('📜 Diễn Biến').setDescription(logStr).setColor(EMBED_COLORS.DARK);
        await safeV2Update(interaction, [embed, logEmbed]);
        return;
      }

      if (lapdoiAction === 'leave') {
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
          db.prepare("UPDATE party_rooms SET member_ids = ? WHERE id = ?").run(JSON.stringify(updatedMembers), roomId);
          const readySet = readyStates.get(roomId);
          if (readySet) readySet.delete(userId);
          const host = userRepository.get(room.host_id);
          const updatedRoom = db.prepare("SELECT * FROM party_rooms WHERE id = ?").get(roomId) as any;
          const embed = getPartyRoomEmbed(updatedRoom, host);
          const components = getPartyRoomComponents(updatedRoom, userId);
          await safeV2Update(interaction, [embed], components);
        }
        return;
      }

      if (lapdoiAction === 'disband') {
        const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND host_id = ?").get(roomId, userId) as any;
        if (!room) {
          await interaction.reply({ content: '❌ Chỉ chủ phòng mới có thể giải tán!', flags: MessageFlags.Ephemeral });
          return;
        }
        db.prepare("UPDATE party_rooms SET status = 'closed' WHERE id = ?").run(roomId);
        readyStates.delete(roomId);
        await safeV2TextUpdate(interaction, '💥 Phòng đã được giải tán!');
        return;
      }

      if (lapdoiAction === 'refresh') {
        const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as any;
        if (!room) {
          await interaction.reply({ content: '❌ Phòng không tồn tại hoặc đã đóng!', flags: MessageFlags.Ephemeral });
          return;
        }
        const host = userRepository.get(room.host_id);
        const embed = getPartyRoomEmbed(room, host);
        const components = getPartyRoomComponents(room, userId);
        await safeV2Update(interaction, [embed], components);
        return;
      }
    }

  } catch (error: any) {
    if (error?.code === 10062 || error?.rawError?.code === 10062 ||
        error?.code === 40060 || error?.rawError?.code === 40060) {
      return;
    }
    console.error('[BossCombat Handler] Lỗi xử lý:', error);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
      }
    } catch (replyError: any) {
      if (replyError?.code !== 10062 && replyError?.rawError?.code !== 10062) {
        console.error('Không thể gửi thông báo lỗi:', replyError);
      }
    }
  }
}
