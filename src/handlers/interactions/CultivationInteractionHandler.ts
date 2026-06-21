import { ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { cultivationService } from '../../services/CultivationService';
import { tribulationService } from '../../services/TribulationService';
import { userRepository } from '../../database/repositories/UserRepository';
import { getLuanHoiEmbed, getLuanHoiComponents } from '../../commands/general/luanhoi';
import { getYCanhEmbed, getYCanhComponents } from '../../commands/general/ycanh';
import { getHoSoTabEmbed, getHoSoAllComponents } from '../../commands/general/hoso';
import { getRealmDetails, formatLinhCan } from '../../utils/constants';
import { dailyQuestService } from '../../services/DailyQuestService';
import { inventoryService } from '../../services/InventoryService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';

// Cần quản lý cooldown chung cho thiền định
export const practiceCooldowns = new Map<string, number>();

// Dọn dẹp bộ nhớ (garbage collection) cho practiceCooldowns mỗi 10 phút
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of practiceCooldowns.entries()) {
    if (now - timestamp > 60000) { // Quá 60 giây thì xóa
      practiceCooldowns.delete(userId);
    }
  }
}, 600000);

export class CultivationInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ) {
    const user = userRepository.get(targetUserId);
    if (!user) {
      await interaction.reply({ content: '❌ Không tìm thấy nhân vật.', ephemeral: true });
      return;
    }

    if (action === 'luanhoiconfirm') {
      const result = cultivationService.reincarnate(targetUserId);
      if (!result.success) {
        await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        return;
      }
      const embed = getLuanHoiEmbed(targetUserId);
      const row = getLuanHoiComponents(targetUserId, false);
      await interaction.update({ embeds: [embed], components: [row] as any[] });
      await interaction.followUp({ content: result.message, ephemeral: false });
      return;
    }

    if (action === 'luanhoicancel') {
      await interaction.update({ content: 'Đạo hữu đã chọn tiếp tục tu hành ở kiếp này.', embeds: [], components: [] });
      return;
    }

    if (action === 'ycanhawaken') {
      const result = cultivationService.awakenYCanh(targetUserId);
      if (!result.success) {
        await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        return;
      }
      const embed = getYCanhEmbed(targetUserId);
      const row = getYCanhComponents(targetUserId);
      await interaction.update({ embeds: [embed], components: [row] as any[] });
      await interaction.followUp({ content: result.message, ephemeral: true });
      return;
    }

    if (action === 'tuluyen') {
      // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
      const result = cultivationService.claimIdleCultivation(targetUserId);
      if (!result || !result.user) {
        await interaction.reply({ content: 'Không tìm thấy nhân vật.', ephemeral: true });
        return;
      }

      const freshUser = result.user;

      if (freshUser.stamina < 1) {
        await interaction.reply({ content: `❌ Đạo hữu đã cạn kiệt Thể Lực! Việc khiên cưỡng vận công sẽ tẩu hỏa nhập ma. Hãy nghỉ ngơi chờ phục hồi.`, ephemeral: true });
        return;
      }

      const now = Date.now();
      const lastPractice = practiceCooldowns.get(targetUserId) || 0;
      if (now - lastPractice < 10000) {
        const remaining = Math.ceil((10000 - (now - lastPractice)) / 1000);
        await interaction.reply({ content: `⏳ Tĩnh tâm nào! Đạo hữu đang hấp thu linh khí quá nhanh, cần đợi **${remaining} giây** để ổn định đan điền!`, ephemeral: true });
        return;
      }
      practiceCooldowns.set(targetUserId, now);

      userRepository.update(targetUserId, { stamina: freshUser.stamina - 1 });
      const practiceRes = cultivationService.practice(targetUserId);

      const updatedEmbed = getHoSoTabEmbed(targetUserId, 'chiso');
      const allComponents = getHoSoAllComponents(targetUserId, 'chiso');

      await interaction.update({ embeds: [updatedEmbed], components: allComponents });
      dailyQuestService.updateProgress(targetUserId, 'daily_tuluyen', 1);

      const msg = practiceRes.success ? practiceRes.message : `🧘 **Thiền Định:** Đạo hữu thiền định tu luyện thành công!`;
      await interaction.followUp({ content: msg, ephemeral: true });
      return;
    }

    if (action === 'dotpha') {
      if (parts.length === 2) {
        // Đột phá chính
        if (user.tu_vi < user.exp_needed) {
          await interaction.reply({ content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Cần **${user.tu_vi}/${user.exp_needed}** Tu Vi)`, ephemeral: true });
          return;
        }

        const { minorLevel, fullName, majorIndex } = getRealmDetails(user.level);
        const isMajor = minorLevel === 38;

        if (!isMajor) {
          const result = cultivationService.breakthrough(targetUserId, false);
          const updatedEmbed = getHoSoTabEmbed(targetUserId, 'chiso');
          const btComponents = getHoSoAllComponents(targetUserId, 'chiso');

          await interaction.update({ embeds: [updatedEmbed], components: btComponents });
          await interaction.followUp({ content: result.message, ephemeral: true });
        } else {
          const bolts = 3 + majorIndex * 2;
          const damage = Math.round(20 + majorIndex * 15);

          const stats = inventoryService.getActiveStats(targetUserId);
          const inv = inventoryRepository.getUserInventory(targetUserId);
          const getQty = (itemId: string) => inv.find(i => i.item_id === itemId)?.quantity || 0;

          const antiLoiQty = getQty('pill_alchemy_anti_loi');
          const hp1Qty = getQty('pill_hp_1');
          const hp2Qty = getQty('pill_hp_2');
          const tiLoiQty = getQty('talisman_anti_loi');

          const oncomingKiep = tribulationService.getOncomingKiepInfo(targetUserId);
          const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
          const bequanMajorCost = user.level * 1000;

          const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
          const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
          
          const embed = new EmbedBuilder()
            .setTitle(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`)
            .setColor('#e74c3c')
            .setDescription(
              `Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân đang kéo tới dồn dập!\n\n` +
              `• Cảnh giới lớn đột phá: **${fullName}**\n` +
              `• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n` +
              `• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp** giáng xuống liên tục.\n` +
              `• Uy lực ước tính: **~${damage}** sát thương thô mỗi đạo sét.\n\n` +
              `❤️ **Trạng thái hiện tại:**\n` +
              `• Sinh Lực tối đa: **${hpText}** HP\n` +
              `• Pháp Lực tối đa: **${mpText}** MP\n\n` +
              `🎒 **Vật phẩm hộ thân hiện có trong túi:**\n` +
              `• ${oncomingKiep.pillName} 💊 (khắc chế kiếp, giảm 40%): **${protectPillQty}** viên\n` +
              `• Ngự Lôi Đan 💊 (giảm 30% sát thương): **${antiLoiQty}** viên\n` +
              `• Tị Lôi Phù 📜 (giảm 80% sát thương 1 lượt): **${tiLoiQty}** tấm\n` +
              `• Hồi Huyết Đan trung phẩm ❤️ (hồi 150 HP): **${hp2Qty}** viên\n\n` +
              `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanMajorCost}** Linh Thạch Hạ Phẩm để đột phá an toàn 100% (bỏ qua lôi kiếp).\n\n` +
              `⚠️ **Cảnh báo nguy hiểm:** Hãy chắc chắn đạo hữu đang đầy đủ HP/MP. Nếu HP về 0 giữa lôi kiếp, đạo hữu sẽ đột phá thất bại, bị **Trọng Thương (1 giờ)** và tổn thất **-30%** tu vi hiện có!`
            )
            .setFooter({ text: 'Nhấn nút bên dưới để bắt đầu lôi kiếp hoặc chọn Bế Quan!' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`loi_start_${targetUserId}`).setLabel('⚡ Nghênh Tiếp Lôi Kiếp!').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`dotpha_bequan_${targetUserId}`).setLabel(`Bế Quan (${bequanMajorCost} LThạch)`).setStyle(ButtonStyle.Success).setDisabled(user.coin_ha_pham < bequanMajorCost),
            new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại').setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [row] });
        }
      } else {
        // Đột phá bằng đan dược (trong /dotpha)
        const usedPill = parts.slice(1, -1).join('_');
        const result = cultivationService.breakthrough(targetUserId, usedPill);
        
        if (!result.success && !result.isMajor && result.message.includes('không có đan dược')) {
          await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
          .setColor(result.success ? '#2ecc71' : '#e74c3c')
          .setDescription(result.message)
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      }
      return;
    }

    if (action === 'loi') {
      const subAction = parts[1];
      const { majorIndex } = getRealmDetails(user.level);

      if (subAction === 'start') {
        const { embed, rows } = tribulationService.start(targetUserId, user.name, majorIndex);
        await interaction.update({ embeds: [embed], components: rows as any[] });
      } else {
        const res = tribulationService.handleAction(targetUserId, subAction as any);
        if (res.finished) {
          await interaction.update({ embeds: [res.embed], components: [] });
        } else {
          await interaction.update({ embeds: [res.embed], components: res.rows as any[] });
        }
      }
      return;
    }

    if (action === 'taytuynav' || action === 'taytuyexecute' || action === 'taytuy') {
      if (action === 'taytuynav') {
        const formattedLinhCan = formatLinhCan(user.linh_can);
        const embed = new EmbedBuilder()
          .setTitle(`🌀 Tẩy Tủy Linh Căn - ${user.name}`)
          .setColor('#3498db')
          .setDescription('Tẩy tủy sẽ thay đổi Linh Căn cốt cách ngẫu nhiên, tác động trực tiếp tới các thuộc tính chiến đấu và hiệu suất tu luyện.')
          .addFields(
            { name: '🔮 Linh Căn Hiện Tại', value: formattedLinhCan },
            { name: '🪙 Chi Phí Tẩy Tủy', value: '💵 **100 Hạ Phẩm Linh Thạch**' },
            { name: '💼 Số Dư Linh Thạch', value: `🟤 **${user.coin_ha_pham}** Hạ Phẩm Linh Thạch` }
          )
          .setFooter({ text: 'Hãy cân nhắc trước khi tiến hành hoán đổi căn cốt!' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`taytuyexecute_${targetUserId}`).setLabel('🌀 Xác Nhận Tẩy Tủy (100 LThạch)').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
        return;
      }

      if (user.coin_ha_pham < 100) {
        await interaction.reply({ content: `❌ **Không đủ Linh Thạch!** Tẩy tủy cần 100 Hạ Phẩm Linh Thạch (Đạo hữu hiện có **${user.coin_ha_pham}**).`, ephemeral: true });
        return;
      }

      const newLinhCanJson = cultivationService.generateLinhCan();
      const newStats = cultivationService.calculateStatsForLevel(user.level, newLinhCanJson);
      
      userRepository.update(targetUserId, {
        coin_ha_pham: user.coin_ha_pham - 100,
        linh_can: newLinhCanJson,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_luck: user.base_luck
      });

      const updatedUser = userRepository.get(targetUserId)!;
      const formattedLinhCan = formatLinhCan(newLinhCanJson);

      const embed = new EmbedBuilder()
        .setTitle(`🌀 Tẩy Tủy Thành Công - ${updatedUser.name}`)
        .setColor('#2ecc71')
        .setDescription('Căn cốt linh căn đã thay đổi. Các chỉ số cơ bản của đạo hữu đã được tính toán lại theo cơ duyên mới.')
        .addFields(
          { name: '🔮 Linh Căn Mới', value: formattedLinhCan },
          { name: '💼 Số Dư Linh Thạch', value: `🟤 **${updatedUser.coin_ha_pham}** Hạ Phẩm Linh Thạch` }
        )
        .setTimestamp();

      const btnId = action === 'taytuy' ? `taytuy_${targetUserId}` : `taytuyexecute_${targetUserId}`;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(btnId).setLabel('🌀 Tiếp Tục Tẩy Tủy (100 LThạch)').setStyle(ButtonStyle.Primary),
      );

      if (action === 'taytuyexecute') {
        row.addComponents(new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary));
      }

      await interaction.update({ embeds: [embed], components: [row] });
      await interaction.followUp({ content: `🌀 **Tẩy Tủy Thành Công!** Linh căn mới của đạo hữu là: ${formattedLinhCan}`, ephemeral: true });
      return;
    }
  }
}
