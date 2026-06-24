import { ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { EMBED_COLORS, toV2Payload, safeV2Update, safeV2TextUpdate } from '../../utils/uiSystem';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';

type EqInteraction = ButtonInteraction | StringSelectMenuInteraction;

export async function handleEquipmentAction(
  interaction: EqInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    const targetUserId = userId;

    if (action === 'enhance_select' && interaction.isStringSelectMenu()) {
      const inventoryId = parseInt(interaction.values[0], 10);
      const CuongHuaCommand = require('../../commands/general/cuonghoa').default;
      const preview = CuongHuaCommand.buildEnhancePreview(targetUserId, inventoryId);
      await safeV2Update(interaction, [preview.embed], preview.rows);
      return;
    }

    if (action === 'enhance_confirm') {
      const inventoryId = parseInt(parts[1], 10);
      const { enhanceService } = require('../../services/EnhanceService');
      const result = enhanceService.enhanceItem(targetUserId, inventoryId);
      const CuongHuaCommand = require('../../commands/general/cuonghoa').default;
      const preview = CuongHuaCommand.buildEnhancePreview(targetUserId, inventoryId, result);
      await safeV2Update(interaction, [preview.embed], preview.rows);
      return;
    }

    if (action === 'enhance_cancel') {
      await safeV2TextUpdate(interaction, '📴 Đã đóng giao diện cường hóa trang bị.');
      return;
    }

    if (action === 'linhmach_select' && interaction.isStringSelectMenu()) {
      const selected = interaction.values[0];
      const target = selected === 'cancel' ? null : selected;
      const { leylineService } = require('../../services/LeylineService');
      const result = leylineService.setChanneling(targetUserId, target);
      const { buildLeylineEmbed, buildLeylineComponents } = require('../../commands/general/linhmach');
      const updatedEmbed = buildLeylineEmbed(targetUserId);
      const updatedComponents = buildLeylineComponents(targetUserId);
      await safeV2Update(interaction, [updatedEmbed], updatedComponents);
      return;
    }

    if (action === 'linhmach_close') {
      await safeV2TextUpdate(interaction, '📴 Đã đóng điều khiển linh mạch.');
      return;
    }

    if (action === 'dungkynang_select' && interaction.isStringSelectMenu()) {
      const { skillAssignmentService } = require('../../services/SkillAssignmentService');
      const selectedSkillId = interaction.values[0];
      const result = skillAssignmentService.assignSkill(targetUserId, selectedSkillId);
      const user = userRepository.get(targetUserId);
      if (!user) return;
      const DungKyNangCommand = require('../../commands/general/dungkynang').default;
      const embed = DungKyNangCommand.buildSkillEmbed(targetUserId, user);
      const comps = DungKyNangCommand.buildSkillComponents(targetUserId, user);
      await safeV2Update(interaction, [embed], comps);
      return;
    }

    if (action === 'dungkynang_cancel') {
      await safeV2TextUpdate(interaction, '📴 Đã đóng kỹ năng trang bị.');
      return;
    }

    if (action === 'destiny_equip' || action === 'destiny_unequip') {
      if (!interaction.isStringSelectMenu()) return;
      const { destinyRepository } = require('../../database/repositories/DestinyRepository');
      if (action === 'destiny_equip') {
        const destinyId = parseInt(interaction.values[0], 10);
        const result = destinyRepository.equipDestiny(targetUserId, destinyId);
        if (result.success) {
          await interaction.reply({ content: `✅ ${result.message}`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
        }
      } else {
        const slotToUnequip = parseInt(interaction.values[0], 10);
        if (!isNaN(slotToUnequip)) {
          destinyRepository.unequipSlot(targetUserId, slotToUnequip);
          await interaction.reply({ content: `✅ Đã tháo Mệnh Cách ở khe cắm [${slotToUnequip}]!`, flags: MessageFlags.Ephemeral });
        }
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

    if (action === 'pb') {
      const pbSub = parts[1];
      const pbType = parts[2];
      const { getBanMenhEmbed, getBanMenhComponents } = require('../../commands/general/phapbao');

      if (pbSub === 'bind' && pbType === 'nav') {
        const inv = inventoryRepository.getUserInventory(targetUserId);
        const eligible = inv.filter((i: any) => i.equipable === 1 && i.is_life_bound !== 1);
        if (eligible.length === 0) {
          await interaction.reply({ content: '❌ Không có trang bị phù hợp để liên kết Huyết Tế!', flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🩸 TIẾN HÀNH HUYẾT TẾ BẢN MỆNH')
          .setColor(EMBED_COLORS.ALERT)
          .setDescription('Hãy chọn một trang bị để liên kết Huyết Tế với Nguyên Thần.\n\n⚠️ Vật phẩm sẽ trở thành Bản Mệnh, không thể giao dịch!')
          .setTimestamp();
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`pb_bind_select_${targetUserId}`)
          .setPlaceholder('Chọn trang bị để liên kết Huyết Tế');
        eligible.slice(0, 25).forEach((i: any) => {
          const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
          const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
          selectMenu.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(`${i.name}${starStr}${enhStr}`)
            .setValue(String(i.id))
            .setDescription(`Phẩm chất: ${i.rarity.toUpperCase()}`)
          );
        });
        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`pb_banmenh_nav_${targetUserId}`).setLabel('🔙 Quay Lại').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [row1, row2]);
        return;
      }

      if (pbSub === 'bind' && pbType === 'select' && interaction.isStringSelectMenu()) {
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
        return;
      }

      if (pbSub === 'swap' && pbType === 'nav') {
        const inv = inventoryRepository.getUserInventory(targetUserId);
        const scroll = inv.find((i: any) => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
        if (!scroll) {
          await interaction.reply({ content: '❌ Cần **Huyết Tế Ma Bảng** để hoán đổi!', flags: MessageFlags.Ephemeral });
          return;
        }
        const eligible = inv.filter((i: any) => i.equipable === 1 && i.is_life_bound !== 1);
        if (eligible.length === 0) {
          await interaction.reply({ content: '❌ Không có trang bị nào để hoán đổi!', flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🔄 HOÁN ĐỔI BẢN MỆNH PHÁP BẢO')
          .setColor(EMBED_COLORS.ORANGE)
          .setDescription('Tiêu hao **1x Huyết Tế Ma Bảng** để hoán đổi liên kết nguyên thần.\nBản Mệnh mới kế thừa **80% EXP** của Pháp Bảo cũ.')
          .setTimestamp();
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`pb_swap_select_${targetUserId}`)
          .setPlaceholder('Chọn trang bị mới để hoán đổi');
        eligible.slice(0, 25).forEach((i: any) => {
          const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
          const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
          selectMenu.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(`${i.name}${starStr}${enhStr}`)
            .setValue(String(i.id))
            .setDescription(`Phẩm chất: ${i.rarity.toUpperCase()}`)
          );
        });
        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`pb_banmenh_nav_${targetUserId}`).setLabel('🔙 Quay Lại').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [row1, row2]);
        return;
      }

      if (pbSub === 'swap' && pbType === 'select' && interaction.isStringSelectMenu()) {
        const newInvId = parseInt(interaction.values[0], 10);
        const inv = inventoryRepository.getUserInventory(targetUserId);
        const scroll = inv.find((i: any) => i.item_id === ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
        if (!scroll) {
          await interaction.reply({ content: '❌ Mất **Huyết Tế Ma Bảng**!', flags: MessageFlags.Ephemeral });
          return;
        }
        const oldBound = inv.find((i: any) => i.is_life_bound === 1);
        if (!oldBound) {
          await interaction.reply({ content: '❌ Không có Bản Mệnh cũ!', flags: MessageFlags.Ephemeral });
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
        return;
      }

      if (pbSub === 'banmenh' && pbType === 'nav') {
        const embed = getBanMenhEmbed(targetUserId);
        const comps = getBanMenhComponents(targetUserId);
        await safeV2Update(interaction, [embed], comps);
        return;
      }
    }
  } catch (error) {
    console.error(`[EquipmentInteractionHandler] Lỗi xử lý action ${action}:`, error);
  }
}
