import { ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { mountService } from '../../services/MountService';
import { getHoSoTabEmbed, getHoSoAllComponents, getInventoryEmbed, getInventoryComponents } from '../../commands/general/hoso';
import { getMountListEmbed, getMountListComponents } from '../../commands/general/toaky';
import { getSpiritListEmbed, getSpiritListComponents } from '../../commands/general/khilinh';
import { getAchievementCategoryEmbed, getAchievementCategoryComponents } from '../../commands/general/thanhtuu';
import { toV2Payload, toV2Update, toV2TextUpdate, safeV2Update, safeV2TextUpdate, EMBED_COLORS, textToV2 } from '../../utils/uiSystem';
import { ITEMS } from '../../config/itemConstants';
import { formatLinhCan } from '../../utils/constants';
import db from '../../database/database';

export async function handleNavigationAction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    const targetUserId = userId;

    if (action === 'hosotab' || action === 'hosolb') {
      const { ProfileInteractionHandler } = require('../interactions/ProfileInteractionHandler');
      await ProfileInteractionHandler.handle(interaction as any, action, parts, targetUserId);
      return;
    }

    if (action === 'hosoback') {
      const embed = getHoSoTabEmbed(targetUserId, 'chiso');
      const rows = getHoSoAllComponents(targetUserId, 'chiso');
      await safeV2Update(interaction, [embed], rows);
      return;
    }

    if (action === 'tuido') {
      try {
        await interaction.deferUpdate();
        const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, 1);
        const components = getInventoryComponents(targetUserId, 1, totalPages, itemsOnPage);
        await interaction.editReply(toV2Payload([embed], components));
      } catch (e: any) {
        console.error('[tuido] Lỗi mở túi đồ:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Lỗi mở túi đồ!' }); } catch (_) {}
      }
      return;
    }

    if (action === 'invprev' || action === 'invnext') {
      const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
      try {
        await interaction.deferUpdate();
        const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, pageNum);
        const components = getInventoryComponents(targetUserId, pageNum, totalPages, itemsOnPage);
        await interaction.editReply(toV2Payload([embed], components));
      } catch (e: any) {
        console.error('[invpage] Lỗi phân trang túi đồ:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Lỗi phân trang!' }); } catch (_) {}
      }
      return;
    }

    if (action === 'mountprev' || action === 'mountnext') {
      const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
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
        try { await interaction.editReply({ content: '❌ Lỗi phân trang tọa kỵ!' }); } catch (_) {}
      }
      return;
    }

    if (action === 'spiritprev' || action === 'spiritnext') {
      const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
      try {
        await interaction.deferUpdate();
        const { spiritWeaponService } = require('../../services/SpiritWeaponService');
        const spiritWeapons = spiritWeaponService.getSpiritWeapons(targetUserId);
        if (spiritWeapons.length === 0) return;
        const user = userRepository.get(targetUserId);
        if (!user) return;
        const { embed, totalPages } = getSpiritListEmbed(targetUserId, user, spiritWeapons, pageNum);
        const components = getSpiritListComponents(targetUserId, pageNum, totalPages);
        await interaction.editReply(toV2Payload([embed], components));
      } catch (e: any) {
        console.error('[spiritpage] Lỗi phân trang khí linh:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Lỗi phân trang khí linh!' }); } catch (_) {}
      }
      return;
    }

    if (action === 'achprev' || action === 'achnext') {
      const pageNum = Math.max(1, parseInt(parts[2], 10) || 1);
      try {
        await interaction.deferUpdate();
        const category = parts[1].replace(/\./g, '_');
        const { embed, totalPages } = getAchievementCategoryEmbed(targetUserId, category, pageNum);
        const components = getAchievementCategoryComponents(targetUserId, category, pageNum, totalPages);
        await interaction.editReply(toV2Payload([embed], components));
      } catch (e: any) {
        console.error('[achpage] Lỗi phân trang thành tựu:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Lỗi phân trang thành tựu!' }); } catch (_) {}
      }
      return;
    }

    if (action === 'titleswitch') {
      const { achievementService } = require('../../services/AchievementService');
      const titleName = parts.slice(1).join('_').replace(/_/g, ' ');
      const result = achievementService.setTitle(targetUserId, titleName);
      await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'ngotinh_activate') {
      const buffId = parts[1];
      const targetUserIdFromParts = parts[2];
      if (interaction.user.id !== targetUserIdFromParts) {
        await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể kích hoạt buff!', flags: MessageFlags.Ephemeral });
        return;
      }
      const { ngoTinhService } = require('../../services/NgoTinhService');
      const result = ngoTinhService.activateBuff(targetUserIdFromParts, buffId);
      await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'ngotinh_reroll_execute') {
      const rerollTargetUserId = parts[1];
      const lockElement = parts[2] === 'none' ? null : parts.slice(2).join('_');
      if (interaction.user.id !== rerollTargetUserId) {
        await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể reroll!', flags: MessageFlags.Ephemeral });
        return;
      }

      const user = userRepository.get(rerollTargetUserId);
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

      const elements = ['Hỏa', 'Thủy', 'Mộc', 'Thổ', 'Lôi', 'Phong'];
      let oldLinhCan: Record<string, number> = {};
      try { oldLinhCan = JSON.parse(user.linh_can || '{}'); } catch {}

      let newLinhCan: Record<string, number> = {};
      if (lockElement && oldLinhCan[lockElement]) {
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
        let allocated = 0;
        for (let i = 0; i < elements.length - 1; i++) {
          const maxAlloc = 100 - allocated - (elements.length - 1 - i);
          const val = Math.floor(Math.random() * Math.max(1, maxAlloc + 1));
          newLinhCan[elements[i]] = val;
          allocated += val;
        }
        newLinhCan[elements[elements.length - 1]] = 100 - allocated;
      }

      userRepository.update(rerollTargetUserId, {
        linh_can: JSON.stringify(newLinhCan),
        ngotinh: ngotinh - totalCost
      });

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

    if (action === 'pb') {
      const pbSub = parts[1];
      const pbType = parts[2];

      const { getBanMenhEmbed, getBanMenhComponents } = require('../../commands/general/phapbao');

      if (pbSub === 'bind' && pbType === 'nav') {
        const inv = inventoryRepository.getUserInventory(targetUserId);
        const eligible = inv.filter((i: any) => i.equipable === 1 && i.is_life_bound !== 1);

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

        eligible.slice(0, 25).forEach((i: any) => {
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

      else if (pbSub === 'swap' && pbType === 'nav') {
        const inv = inventoryRepository.getUserInventory(targetUserId);
        const scroll = inv.find((i: any) => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
        if (!scroll) {
          await interaction.reply({
            content: '❌ Đạo hữu cần có **Huyết Tế Ma Bảng** trong hành trang để tiến hành hoán đổi Bản Mệnh Pháp Bảo!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const eligible = inv.filter((i: any) => i.equipable === 1 && i.is_life_bound !== 1);

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

        eligible.slice(0, 25).forEach((i: any) => {
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

      else if (pbSub === 'swap' && pbType === 'select' && interaction.isStringSelectMenu()) {
        const newInvId = parseInt(interaction.values[0], 10);

        const inv = inventoryRepository.getUserInventory(targetUserId);
        const scroll = inv.find((i: any) => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
        if (!scroll) {
          await interaction.reply({
            content: '❌ Đạo hữu đã đánh mất **Huyết Tế Ma Bảng** nửa chừng, không thể tiến hành hoán đổi!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const oldBound = inv.find((i: any) => i.is_life_bound === 1);
        if (!oldBound) {
          await interaction.reply({ content: '❌ Đạo hữu chưa có Bản Mệnh Pháp Bảo cũ để hoán đổi!', flags: MessageFlags.Ephemeral });
          return;
        }

        const res = inventoryService.swapLifeArtifact(targetUserId, oldBound.id, newInvId);

        if (!res.success) {
          await interaction.reply({ content: `❌ ${res.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        inventoryRepository.removeItem(targetUserId, ITEMS.ITEM_LIFE_BIND_SCROLL, 1);

        const embed = getBanMenhEmbed(targetUserId);
        const comps = getBanMenhComponents(targetUserId);
        await safeV2Update(interaction, [embed], comps);
        await interaction.followUp({ content: `✅ ${res.message}`, flags: MessageFlags.Ephemeral });
      }

      else if (pbSub === 'banmenh' && pbType === 'nav') {
        const embed = getBanMenhEmbed(targetUserId);
        const comps = getBanMenhComponents(targetUserId);
        await safeV2Update(interaction, [embed], comps);
      }
      return;
    }

    if (action === 'invselect' && interaction.isStringSelectMenu()) {
      const selectedValue = interaction.values[0];
      const firstUnderscore = selectedValue.indexOf('_');
      const itemAction = selectedValue.substring(0, firstUnderscore);
      const inventoryId = parseInt(selectedValue.substring(firstUnderscore + 1), 10);
      console.log(`[invselect] action=${itemAction} id=${inventoryId} user=${targetUserId} value=${selectedValue}`);

      if (isNaN(inventoryId)) {
        await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
        return;
      }

      let resultMessage = '';
      let success = false;

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
        console.log(`[invselect] FAIL: ${resultMessage}`);
        await interaction.reply({ content: `❌ ${resultMessage}`, flags: MessageFlags.Ephemeral });
        return;
      }

      console.log(`[invselect] OK: ${resultMessage}`);
      const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
      const { embed, totalPages, itemsOnPage } = getInventoryEmbed(targetUserId, pageNum);
      const components = getInventoryComponents(targetUserId, pageNum, totalPages, itemsOnPage);

      await safeV2Update(interaction, [embed], components);
      await interaction.followUp({ content: `💼 ${resultMessage}`, flags: MessageFlags.Ephemeral });
      return;
    }

    // --- Tong Mon Nav ---
    if (action === 'tonmonnav') {
      const { getSectEmbed, getSectComponents } = require('../../commands/life/tongmon');
      const embed = getSectEmbed(targetUserId);
      const sectComps = getSectComponents(targetUserId);
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
      );
      await safeV2Update(interaction, [embed], [...sectComps, backRow]);
      return;
    }

    // --- Dong Phu ---
    if (action === 'dongphu') {
      const sub = parts[1];
      const { buildDongPhuEmbed, buildDongPhuComponents } = require('../../commands/life/dongphu');
      const { caveService } = require('../../services/CaveService');
      const { caveEnhancementService } = require('../../services/CaveEnhancementService');

      let result: { success: boolean; message: string };
      if (sub === 'spring') {
        result = caveService.collectSpring(targetUserId);
      } else if (sub === 'harvest') {
        result = caveEnhancementService.claimMeridianResources(targetUserId);
      } else if (sub === 'up') {
        const bld = parts[2];
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

    // --- Dong Phu Nav ---
    if (action === 'dongphunav') {
      const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
      const embed = buildCaveEmbed(targetUserId);
      const components = buildCaveComponents(targetUserId);
      await safeV2Update(interaction, [embed], components);
      return;
    }

    // --- Bang Phong Than ---
    if (action === 'bpt') {
      const subType = parts[1];
      const page = parseInt(parts[2], 10) || 1;
      const { buildLeaderboardUpdate } = require('../../commands/general/bangphongthan');
      const updateOptions = buildLeaderboardUpdate(targetUserId, subType, page);
      await safeV2Update(interaction, updateOptions.embeds, updateOptions.components);
      return;
    }

    if (action === 'bptselect' && interaction.isStringSelectMenu()) {
      const category = interaction.values[0];
      const bptUserId = parts[1];
      const { buildLeaderboardUpdate } = require('../../commands/general/bangphongthan');
      const updateOptions = buildLeaderboardUpdate(bptUserId, category, 1);
      await safeV2Update(interaction, updateOptions.embeds, updateOptions.components);
      return;
    }

  } catch (e) {
    console.error(`[NavigationHandler] Lỗi xử lý action ${action}:`, e);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable()) {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
}
