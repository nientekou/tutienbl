import { ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
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
import { ITEMS } from '../../config/itemConstants';
import { EMBED_COLORS, safeV2Update, safeV2TextUpdate } from '../../utils/uiSystem';

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
      await interaction.reply({ content: '❌ Không tìm thấy nhân vật.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'luanhoiconfirm') {
      const result = cultivationService.reincarnate(targetUserId);
      if (!result.success) {
        await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const embed = getLuanHoiEmbed(targetUserId);
      const row = getLuanHoiComponents(targetUserId, false);
      await safeV2Update(interaction, [embed], [row]);
      await interaction.followUp({ content: result.message });
      return;
    }

    if (action === 'luanhoicancel') {
      await safeV2Update(interaction, [new EmbedBuilder().setDescription('Đạo hữu đã chọn tiếp tục tu hành ở kiếp này.')], []);
      return;
    }

    if (action === 'ycanhawaken') {
      const result = cultivationService.awakenYCanh(targetUserId);
      if (!result.success) {
        await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const embed = getYCanhEmbed(targetUserId);
      const row = getYCanhComponents(targetUserId);
      await safeV2Update(interaction, [embed], [row]);
      await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'tuluyen') {
      // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
      const result = cultivationService.claimIdleCultivation(targetUserId);
      if (!result || !result.user) {
        await interaction.reply({ content: 'Không tìm thấy nhân vật.', flags: MessageFlags.Ephemeral });
        return;
      }

      // Nếu Tu Vi đã đầy, thông báo cần đột phá
      if (result.gained === 0 && result.message) {
        await interaction.reply({ content: `🔔 ${result.message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      const freshUser = result.user;

      if (freshUser.stamina < 1) {
        await interaction.reply({ content: `❌ Đạo hữu đã cạn kiệt Thể Lực! Việc khiên cưỡng vận công sẽ tẩu hỏa nhập ma. Hãy nghỉ ngơi chờ phục hồi.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const now = Date.now();
      const lastPractice = practiceCooldowns.get(targetUserId) || 0;
      if (now - lastPractice < 10000) {
        const remaining = Math.ceil((10000 - (now - lastPractice)) / 1000);
        await interaction.reply({ content: `⏳ Tĩnh tâm nào! Đạo hữu đang hấp thu linh khí quá nhanh, cần đợi **${remaining} giây** để ổn định đan điền!`, flags: MessageFlags.Ephemeral });
        return;
      }
      practiceCooldowns.set(targetUserId, now);

      userRepository.update(targetUserId, { stamina: freshUser.stamina - 1 });
      const practiceRes = cultivationService.practice(targetUserId);

      const updatedEmbed = getHoSoTabEmbed(targetUserId, 'chiso');
      const allComponents = getHoSoAllComponents(targetUserId, 'chiso');

      await safeV2Update(interaction, [updatedEmbed], allComponents);
      dailyQuestService.updateProgress(targetUserId, 'daily_tuluyen', 1);

      const msg = practiceRes.success ? practiceRes.message : `🧘 **Thiền Định:** Đạo hữu thiền định tu luyện thành công!`;
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'dotpha') {
      if (parts.length === 2) {
        // Đột phá chính
        if (user.tu_vi < user.exp_needed) {
          await interaction.reply({ content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Cần **${user.tu_vi}/${user.exp_needed}** Tu Vi)`, flags: MessageFlags.Ephemeral });
          return;
        }

        const { minorLevel, fullName, majorIndex } = getRealmDetails(user.level);
        const isMajor = minorLevel === 38;

        if (!isMajor) {
          const result = cultivationService.breakthrough(targetUserId, false);
          const updatedEmbed = getHoSoTabEmbed(targetUserId, 'chiso');
          const btComponents = getHoSoAllComponents(targetUserId, 'chiso');

          await safeV2Update(interaction, [updatedEmbed], btComponents);
          await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        } else {
          const bolts = 3 + majorIndex * 2;
          const damage = Math.round(20 + majorIndex * 15);

          const stats = inventoryService.getActiveStats(targetUserId);
          const inv = inventoryRepository.getUserInventory(targetUserId);
          const getQty = (itemId: string) => inv.find(i => i.item_id === itemId)?.quantity || 0;

          const antiLoiQty = getQty(ITEMS.PILL_ALCHEMY_ANTI_LOI);
          const hp1Qty = getQty(ITEMS.PILL_HP_1);
          const hp2Qty = getQty(ITEMS.PILL_HP_2);
          const tiLoiQty = getQty(ITEMS.TALISMAN_ANTI_LOI);

          const oncomingKiep = tribulationService.getOncomingKiepInfo(targetUserId);
          const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
          const bequanMajorCost = user.level * 1000;

          const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
          const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
          
          const embed = new EmbedBuilder()
            .setTitle(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`)
            .setColor(EMBED_COLORS.ERROR)
            .setDescription(
              `Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân đang kéo tới dồn dập!\n\n` +
              `• Cảnh giới lớn đột phá: **${fullName}**\n` +
              `• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n` +
              `• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp** giáng xuống liên tục.\n` +
              `• Uy lực ước tính: **~${damage}** sát thương thô mỗi đạo sét.\n\n` +
              `❤️ **Trạng thái hiện tại:**\n` +
              `• Sinh Lực tối đa: **${hpText}** HP\n` +
              `• Pháp Lực tối đa: **${mpText}** MP\n\n` +
              `<:tvp1:1547866133242056704> **Vật phẩm hộ thân hiện có trong túi:**\n` +
              `• ${oncomingKiep.pillName} 💊 (khắc chế kiếp, giảm 40%): **${protectPillQty}** viên\n` +
              `• Ngự Lôi Đan 💊 (giảm 30% sát thương): **${antiLoiQty}** viên\n` +
              `• Tị Lôi Phù 📜 (giảm 80% sát thương 1 lượt): **${tiLoiQty}** tấm\n` +
              `• Hồi Huyết Đan trung phẩm ❤️ (hồi 150 HP): **${hp2Qty}** viên\n\n` +
              `<:lt1:1547866122123218945> **Bế Quan Đột Phá:** Hao tổn **${bequanMajorCost}** Linh Thạch Hạ Phẩm để đột phá an toàn 100% (bỏ qua lôi kiếp).\n\n` +
              `⚠️ **Cảnh báo nguy hiểm:** Hãy chắc chắn đạo hữu đang đầy đủ HP/MP. Nếu HP về 0 giữa lôi kiếp, đạo hữu sẽ đột phá thất bại, bị **Trọng Thương (1 giờ)** và tổn thất **-30%** tu vi hiện có!`
            )
            .setFooter({ text: 'Nhấn nút bên dưới để bắt đầu lôi kiếp hoặc chọn Bế Quan!' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`loi_start_${targetUserId}`).setLabel('⚡ Nghênh Tiếp Lôi Kiếp!').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`dotpha_bequan_${targetUserId}`).setLabel(`Bế Quan (${bequanMajorCost} LThạch)`).setStyle(ButtonStyle.Success).setDisabled(user.coin_ha_pham < bequanMajorCost),
            new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại').setStyle(ButtonStyle.Secondary)
          );

          await safeV2Update(interaction, [embed], [row]);
        }
      } else {
        // Đột phá bằng đan dược (trong /dotpha) hoặc đột phá không đan
        const usedPill = parts.slice(1, -1).join('_');

        if (usedPill !== 'bequan') {
          // Trùng kích cảnh giới nhỏ bằng tay -> 20% cơ hội gặp Tâm Ma
          if (Math.random() < 0.20) {
            const level = user.level;
            const cost = level * 50;

            const { majorIndex } = getRealmDetails(level);
            const baseRate = Math.max(90 - majorIndex * 10, 10);
            const luckBonus = user.base_luck * 0.002;
            let pillBonus = 0;
            if (usedPill === ITEMS.PILL_BREAK_MINOR_1) pillBonus = 15;
            else if (usedPill === ITEMS.PILL_BREAK_MINOR_2) pillBonus = 30;
            else if (usedPill === ITEMS.PILL_BREAK_MINOR_3) pillBonus = 50;

            let alignmentRateMod = 0;
            if (user.alignment === 'neutral' || !user.alignment) {
              alignmentRateMod = 5;
            } else if (user.alignment === 'demonic') {
              alignmentRateMod = -5;
            }

            const baseTotalRate = Math.min(baseRate + (luckBonus * 100) + pillBonus + alignmentRateMod, 100);
            const reducedRate = Math.max(0, baseTotalRate - 15);

            const embed = new EmbedBuilder()
              .setTitle('⚠️ TÂM MA QUẤY NHIỄU / TÁN TU QUẤY PHÁ')
              .setColor(EMBED_COLORS.ERROR)
              .setDescription(
                `⚡ **Biến Cố Đột Phá:** Khi đạo hữu chuẩn bị trùng kích bình cảnh, bỗng dưng tâm ma vây kín (hoặc bị một tên tán tu quấy phá)! Đạo tâm lung lay, đan điền chấn động mạnh.\n\n` +
                `<:xich:1547875512234410095> **Ảnh hưởng:** Tỷ lệ đột phá thành công giảm đi **-15%** (Từ **${baseTotalRate.toFixed(1)}%** còn **${reducedRate.toFixed(1)}%**).\n` +
                `💀 **Hậu quả nếu thất bại:** Sẽ rơi vào trạng thái **Tẩu Hỏa Nhập Ma trong 30 phút** (giảm 50% hiệu suất tu vi nhàn rỗi và không thể thiền định chủ động trong thời gian này).\n\n` +
                `Đạo hữu có thể chọn mạo hiểm đột phá, hoặc chi ra **${cost}** Linh Thạch để ổn định tâm thần, khôi phục tỷ lệ thành công ban đầu.`
              )
              .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`dotpharisk_${usedPill}_${targetUserId}`)
                .setLabel('Vẫn Trùng Kích (Mạo hiểm)')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`dotphastabilize_${usedPill}_${targetUserId}`)
                .setLabel(`Ổn Định Tâm Thần (${cost} Linh Thạch)`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.coin_ha_pham < cost),
              new ButtonBuilder()
                .setCustomId(`hosoback_${targetUserId}`)
                .setLabel('Quay Lại')
                .setStyle(ButtonStyle.Secondary)
            );

            await safeV2Update(interaction, [embed], [row]);
            return;
          }
        }
        
        const result = cultivationService.breakthrough(targetUserId, usedPill);
        
        if (!result.success && !result.isMajor && result.message.includes('không có đan dược')) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG' : '💀 ĐỘT PHÁ THẤT BẠI')
          .setColor(result.success ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
          .setDescription(result.message)
          .setTimestamp();

        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [backRow]);
      }
      return;
    }

    if (action === 'loi') {
      const subAction = parts[1];
      const { majorIndex } = getRealmDetails(user.level);

      if (subAction === 'start') {
        const { embed, rows } = tribulationService.start(targetUserId, user.name, majorIndex);
        await safeV2Update(interaction, [embed], rows);
      } else {
        const res = tribulationService.handleAction(targetUserId, subAction as any);
        if (res.finished) {
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
          );
          await safeV2Update(interaction, [res.embed], [backRow]);
        } else {
          await safeV2Update(interaction, [res.embed], res.rows);
        }
      }
      return;
    }

    if (action === 'taytuynav' || action === 'taytuyexecute' || action === 'taytuy') {
      if (action === 'taytuynav') {
        const formattedLinhCan = formatLinhCan(user.linh_can);
        const embed = new EmbedBuilder()
          .setTitle(`🌀 Tẩy Tủy Linh Căn - ${user.name}`)
          .setColor(EMBED_COLORS.INFO)
          .setDescription('Tẩy tủy sẽ thay đổi Linh Căn cốt cách ngẫu nhiên, tác động trực tiếp tới các thuộc tính chiến đấu và hiệu suất tu luyện.')
          .addFields(
            { name: '<:lc01:1547878586000875550> Linh Căn Hiện Tại', value: formattedLinhCan },
            { name: '<:lt1:1547866122123218945> Chi Phí Tẩy Tủy', value: '**100 Hạ Phẩm Linh Thạch**' },
            { name: '<:lt1:1547866122123218945> Số Dư Linh Thạch', value: `**${user.coin_ha_pham}** Hạ Phẩm Linh Thạch` }
          )
          .setFooter({ text: 'Hãy cân nhắc trước khi tiến hành hoán đổi căn cốt!' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`taytuyexecute_${targetUserId}`).setLabel('🌀 Xác Nhận Tẩy Tủy (100 LThạch)').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );

        await safeV2Update(interaction, [embed], [row]);
        return;
      }

      if (user.coin_ha_pham < 100) {
        await interaction.reply({ content: `❌ **Không đủ Linh Thạch!** Tẩy tủy cần 100 Hạ Phẩm Linh Thạch (Đạo hữu hiện có **${user.coin_ha_pham}**).`, flags: MessageFlags.Ephemeral });
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
        base_luck: user.base_luck,
        base_speed: newStats.speed
      });

      const updatedUser = userRepository.get(targetUserId)!;
      const formattedLinhCan = formatLinhCan(newLinhCanJson);

      const embed = new EmbedBuilder()
        .setTitle(`🌀 Tẩy Tủy Thành Công - ${updatedUser.name}`)
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription('Căn cốt linh căn đã thay đổi. Các chỉ số cơ bản của đạo hữu đã được tính toán lại theo cơ duyên mới.')
        .addFields(
          { name: '<:lc01:1547878586000875550> Linh Căn Mới', value: formattedLinhCan },
          { name: '<:lt1:1547866122123218945> Số Dư Linh Thạch', value: `🟤 **${updatedUser.coin_ha_pham}** Hạ Phẩm Linh Thạch` }
        )
        .setTimestamp();

      const btnId = action === 'taytuy' ? `taytuy_${targetUserId}` : `taytuyexecute_${targetUserId}`;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(btnId).setLabel('🌀 Tiếp Tục Tẩy Tủy (100 LThạch)').setStyle(ButtonStyle.Primary),
      );

      if (action === 'taytuyexecute') {
        row.addComponents(new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary));
      }

      await safeV2Update(interaction, [embed], [row]);
      await interaction.followUp({ content: `🌀 **Tẩy Tủy Thành Công!** Linh căn mới của đạo hữu là: ${formattedLinhCan}`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'dotpharisk') {
      const usedPill = parts.slice(1, -1).join('_');
      const result = cultivationService.breakthrough(targetUserId, usedPill, false, true);

      const embed = new EmbedBuilder()
        .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
        .setColor(result.success ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
        .setDescription(result.message)
        .setTimestamp();

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
      );
      await safeV2Update(interaction, [embed], [backRow]);
      return;
    }

    if (action === 'dotphastabilize') {
      const usedPill = parts.slice(1, -1).join('_');
      const cost = user.level * 50;

      if (user.coin_ha_pham < cost) {
        await interaction.reply({ content: `❌ Đạo hữu không đủ Linh Thạch! (Cần ${cost} Hạ Phẩm Linh Thạch).`, flags: MessageFlags.Ephemeral });
        return;
      }

      userRepository.update(targetUserId, { coin_ha_pham: user.coin_ha_pham - cost });
      const result = cultivationService.breakthrough(targetUserId, usedPill, false, false);

      const embed = new EmbedBuilder()
        .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
        .setColor(result.success ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
        .setDescription(`✨ Đạo hữu tiêu hao **${cost}** Linh Thạch ổn định đạo tâm, khôi phục nguyên trạng tỷ lệ đột phá thành công!\n\n` + result.message)
        .setTimestamp();

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
      );
      await safeV2Update(interaction, [embed], [backRow]);
      return;
    }

    if (action === 'select' && parts[1] === 'alignment') {
      const embed = new EmbedBuilder()
        .setTitle('<:idrole:1547865936848101456> LỰA CHỌN ĐẠO THỐNG: CHÍNH ĐẠO vs MA ĐẠO')
        .setColor(EMBED_COLORS.MYSTIC)
        .setDescription(
          `Đạo Hữu đã bước vào Trúc Cơ Kỳ, căn cơ dần vững, tu vi cũng đã có thành tựu.\nTừ đây, tiên lộ sẽ chia thành nhiều nhánh. Đạo Thống mà Đạo Hữu lựa chọn sẽ ảnh hưởng đến chiến đấu, tu luyện và tài phú về sau.\nĐường nào cũng có cái giá của nó.\nĐạo Hữu muốn đi con đường nào?\n\n` +
          `<:chinhdao:1547974602792247446> **CHÍNH ĐẠO (Orthodox):**\n` +
          `• <:idef:1547935867149099083> **Tăng 10% Phòng ngự** cơ bản.\n` +
          `• ⚡ **Giảm 10% sát thương** Lôi Kiếp đại cảnh giới.\n` +
          `• <:lt1:1547866122123218945> **Giảm 10% Linh Thạch** chi phí Bế Quan Đột Phá.\n` +
          `• <:lt1:1547866122123218945> **Tăng 5% Linh Thạch** kiếm được khi làm việc (\`/lamviec\`).\n` +
          `• <:xich:1547875512234410095> *Hình phạt:* Giảm **5%** Công kích (ATK) trong PvP & Quyết Đấu.\n\n` +
          `<:madao:1547974606047158372> **MA ĐẠO (Demonic):**\n` +
          `• <:iiatk:1547935869602631680> **Tăng 10% Công kích** cơ bản & **+5% Chí Mạng (Crit)**.\n` +
          `• 🧘 **Tăng 15% tốc độ tu luyện** (Offline thiền định & Thiền định chủ động).\n` +
          `• 🩸 **Cướp thêm 10% Linh Thạch** của đối thủ khi thắng PvP/Quyết Đấu.\n` +
          `• <:iiatk:1547935869602631680> *Hình phạt:* Tăng **15% sát thương** Lôi Kiếp & giảm **5% tỷ lệ đột phá tự nhiên**.\n\n` +
          `⚠️ **LƯU Ý QUAN TRỌNG:** Một khi đã chọn Đạo Thống, Đạo Hữu chỉ có thể thay đổi/tẩy sạch sau khi **Luân Hồi Trọng Sinh**! Hãy suy nghĩ thật kỹ.`
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmalignment_orthodox_${targetUserId}`)
          .setLabel('⚖️ Nhập Chính Đạo')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`confirmalignment_demonic_${targetUserId}`)
          .setLabel('👿 Nhập Ma Đạo')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`hosoback_${targetUserId}`)
          .setLabel('🔙 Quay Lại')
          .setStyle(ButtonStyle.Secondary)
      );

      await safeV2Update(interaction, [embed], [row]);
      return;
    }

    if (action === 'confirmalignment') {
      const chosen = parts[1]; // 'orthodox' or 'demonic'
      if (user.alignment && user.alignment !== 'neutral') {
        await interaction.reply({ content: '❌ Đạo hữu đã chọn Đạo Thống rồi, không thể chọn lại!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (user.level < 39) {
        await interaction.reply({ content: '❌ Yêu cầu đạt cấp 39 (Trúc Cơ Kỳ) để chọn Đạo Thống!', flags: MessageFlags.Ephemeral });
        return;
      }

      const newStats = cultivationService.calculateStatsForLevel(user.level, user.linh_can, chosen);

      userRepository.update(targetUserId, {
        alignment: chosen,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_speed: newStats.speed,
      });

      const updatedUser = userRepository.get(targetUserId)!;
      const welcomeMsg = chosen === 'orthodox'
        ? `Đạo tâm đã định. Chính khí đã thành.\n\n**“Giữ được bản tâm giữa vạn kiếp, mới xứng gọi là tu đạo.”**\n\nTừ hôm nay, Đạo Hữu nhập Chính Đạo <:chinhdao:1547974602792247446> Phòng ngự cơ bản được gia tăng.`
        : `Huyết mạch đã thức tỉnh. Ma niệm đã sinh.\n\n**“Đạo không hỏi thiện ác. Kẻ mạnh, tự có con đường của kẻ mạnh.”**\n\nTừ hôm nay, Đạo Hữu nhập Ma Đạo <:madao:1547974606047158372> Công kích và chí mạng cơ bản được gia tăng`;

      const embed = new EmbedBuilder()
        .setTitle('<:idrole:1547865936848101456> ĐẠO THỐNG ĐÃ XÁC ĐỊNH')
        .setColor(chosen === 'orthodox' ? EMBED_COLORS.INFO : EMBED_COLORS.ERROR)
        .setDescription(welcomeMsg)
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`hosoback_${targetUserId}`)
          .setLabel('🔙 Trở Lại Hồ Sơ')
          .setStyle(ButtonStyle.Secondary)
      );

      await safeV2Update(interaction, [embed], [row]);
      return;
    }

    // --- Kỳ Ngộ ---
    if (action === 'kyngo') {
      const sub = parts[1]; // 'choose' or 'view'
      const { kyNgoService } = require('../../services/KyNgoService');

      if (sub === 'choose') {
        const eventId = parseInt(parts[2], 10);
        const choiceId = parts[3];
        const user = userRepository.get(targetUserId);
        if (!user) return;

        const result = kyNgoService.resolveChoice(eventId, targetUserId, choiceId, (user as any).luck || 0, (user as any).linh_can || '[]');
        kyNgoService.applyEffects(targetUserId, result.effects);

        const { container, header, body, V2_COLORS } = require('../../utils/v2Components');
        const comp = container(result.success ? V2_COLORS.success : V2_COLORS.danger, [
          header(result.success ? '✅ Kỳ Ngộ Thành Công!' : '❌ Kỳ Ngộ Thất Bại!'),
          body(result.message)
        ]);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [comp], [backRow]);
        return;
      }

      if (sub === 'view') {
        const events = kyNgoService.getPendingEvents(targetUserId);
        if (!events.length) {
          await safeV2TextUpdate(interaction, '📭 Không có kỳ ngộ nào đang chờ.');
          return;
        }
        const { container, header, body, V2_COLORS } = require('../../utils/v2Components');
        let desc = '';
        for (const evt of events) {
          const data = JSON.parse(evt.event_data);
          desc += `**${data.title}**\n${data.description}\n\n`;
        }
        const comp = container(V2_COLORS.mystic, [header('✨ Kỳ Ngộ Đang Chờ'), body(desc)]);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [comp], [backRow]);
        return;
      }
    }
  }
}
