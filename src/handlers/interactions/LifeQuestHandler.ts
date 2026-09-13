import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Routes } from 'discord.js';
import { farmingService } from '../../services/FarmingService';
import { craftingService } from '../../services/CraftingService';
import { leylineService } from '../../services/LeylineService';
import { dailyQuestService } from '../../services/DailyQuestService';
import { questChainService } from '../../services/QuestChainService';
import { explorationService } from '../../services/ExplorationService';
import { encounterService } from '../../services/EncounterService';
import { userRepository } from '../../database/repositories/UserRepository';
import { getLinhDienEmbed, getLinhDienComponents } from '../../commands/life/linhdien';
import { getLuyenKhiEmbed, getLuyenKhiComponents } from '../../commands/life/luyenkhi';
import { getCraftingEmbed, getCraftingComponents } from '../../commands/life/chetao';
import { getKhamPhaEmbed, getKhamPhaComponents } from '../../commands/general/khampha';
import { getNhiemVuEmbed, getNhiemVuComponents, getQuestChainEmbed, getQuestChainComponents } from '../../commands/general/nhiemvu';
import { performWork } from '../../commands/general/lamviec';
import { safeV2Update, safeV2TextUpdate, toV2Payload } from '../../utils/uiSystem';
import { EMBED_COLORS } from '../../utils/uiSystem';
import LuyenDanCommand from '../../commands/general/luyendan';
import db from '../../database/database';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { blacksmithService } from '../../services/BlacksmithService';
import { EmbedBuilder as DiscordEmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder } from 'discord.js';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';
import { getProgressBar } from '../../utils/constants';
import { bountyBoardService } from '../../services/BountyBoardService';

export class LifeQuestHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    action: string,
    parts: string[],
    userId: string
  ): Promise<void> {
    try {
      const targetUserId = userId;

      // ============================================================
      // V17: BẢNG NGHĨA VỤ — helper cộng tiến độ an toàn
      // ============================================================
      const addBountyProgress = (requirement: string, amount = 1): void => {
        try {
          bountyBoardService.updateProgress(targetUserId, requirement, amount);
        } catch (error) {
          // Không để lỗi Bảng Nghĩa Vụ làm hỏng hành động chính của người chơi.
          console.warn('[BountyBoard] Không thể cập nhật tiến độ:', requirement, error);
        }
      };

      const tryAutoCompleteBounty = async (): Promise<void> => {
        try {
          if (!bountyBoardService.isCompletedToday(targetUserId) && bountyBoardService.canCompleteToday(targetUserId)) {
            const bountyResult = bountyBoardService.completeToday(targetUserId);
            if (bountyResult?.success && bountyResult?.message) {
              await interaction.followUp({
                content: `📜 **Bảng Nghĩa Vụ đã viên mãn.**\n${bountyResult.message}`,
                flags: MessageFlags.Ephemeral
              });
            }
          }
        } catch (error) {
          console.warn('[BountyBoard] Không thể tự kết toán nghĩa vụ:', error);
        }
      };

      if (action === 'linhdienharvest') {
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
        addBountyProgress('herb', harvested.length);
        addBountyProgress('harvest', harvested.length);
        addBountyProgress('activity', 1);

        const embed = getLinhDienEmbed(targetUserId);
        const components = getLinhDienComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: `✨ Đạo hữu thu hoạch thành công: ${harvested.map(h => `**${h}**`).join(', ')}!`, flags: MessageFlags.Ephemeral });
        await tryAutoCompleteBounty();
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
        const { caveService } = require('../../services/CaveService');
        const result = caveService.collectSpring(targetUserId);
        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        // Cập nhật lại embed Động Phủ trực tiếp (in-place)
        const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
        const updatedEmbed = buildCaveEmbed(targetUserId);
        const updatedComponents = buildCaveComponents(targetUserId);

        await safeV2Update(interaction, [updatedEmbed], updatedComponents);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      // --- Nút: ĐỘNG PHỦ - NÂNG CẤP ---
      else if (action === 'dongphuupgrade') {
        const { caveService } = require('../../services/CaveService');
        const cave = caveService.getCave(targetUserId);
        const cost = caveService.getUpgradeCost(cave.level);
        
        const user = userRepository.get(targetUserId);
        if (!user) return;

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
            const item = inv.find((i: any) => i.item_id === req.id)!;
            if (item.quantity > req.quantity) {
              db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(req.quantity, item.id);
            } else {
              db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
            }
          }
          db.prepare('UPDATE user_caves SET level = level + 1, spring_available = spring_available + 1 WHERE user_id = ?').run(targetUserId);
        })();

        // Cập nhật lại embed Động Phủ trực tiếp (in-place)
        const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
        const updatedEmbed = buildCaveEmbed(targetUserId);
        const updatedComponents = buildCaveComponents(targetUserId);

        await safeV2Update(interaction, [updatedEmbed], updatedComponents);
        await interaction.followUp({ content: `🎉 Chúc mừng! Đạo hữu đã nâng cấp thành công Động Phủ lên **Cấp ${cave.level + 1}**!`, flags: MessageFlags.Ephemeral });
      }

      // --- Nút: ĐI ĐẾN ĐỘNG PHỦ (từ hồ sơ) ---
      else if (action === 'dongphunav') {
        const { buildDongPhuEmbed, buildDongPhuComponents } = require('../../commands/life/dongphu');
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

      // --- Nút: NHẬN THÀNH PHẨM CHẾ TẠO (THU LÒ) ---
      else if (action === 'craftclaim') {
        const result = craftingService.claimCraftedItems(targetUserId);
        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        // Nạp năng lượng Linh Mạch Thu Thập (10 năng lượng cho mỗi lần chế)
        leylineService.addEnergy(targetUserId, 'thuthap', 10);
        addBountyProgress('craft', 1);
        addBountyProgress('activity', 1);

        const embed = getCraftingEmbed(targetUserId);
        const components = getCraftingComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
        await tryAutoCompleteBounty();
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

      // --- Nút: ĐI ĐẾN LUYỆN KHÍ (từ hồ sơ) ---
      else if (action === 'luyenkhinav') {
        const embed = getLuyenKhiEmbed(targetUserId);
        if (!embed) {
          await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', flags: MessageFlags.Ephemeral });
          return;
        }
        const components = getLuyenKhiComponents(targetUserId);
        await safeV2Update(interaction, [embed], components);
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

      // --- Nút: ĐI ĐẾN LÀM VIỆC (từ hồ sơ) ---
      else if (action === 'lamviecnav') {
        const user = userRepository.get(targetUserId)!;
        const embed = container(V2_COLORS.dark, [
          header('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch', 'Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.'),
          separator(),
          body(
            `⏰ **Hồi chiêu:** 60 giây (mỗi lần làm việc)\n` +
            `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${user.stamina}/500**)\n└ ${getProgressBar(user.stamina, 500, 8)}`
          ),
          separator(),
          body(`*Chọn một công việc bên dưới để bắt đầu lao động ngay!*`)
        ]);

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
        const embed = container(V2_COLORS.dark, [
          header('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch', 'Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.'),
          separator(),
          body(
            `⏰ **Hồi chiêu:** 60 giây (mỗi lần làm việc)\n` +
            `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${refreshedUser.stamina}/500**)\n└ ${getProgressBar(refreshedUser.stamina, 500, 8)}`
          ),
          separator(),
          body(`*Chọn một công việc bên dưới để tiếp tục lao động!*`)
        ]);

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

        // V17: Bảng Nghĩa Vụ — chỉ cộng khi công việc đã thực sự thành công
        addBountyProgress('work', 1);
        addBountyProgress('activity', 1);
        if (jobType === 'mining') addBountyProgress('mine', 1);
        if (jobType === 'gathering') addBountyProgress('herb', 1);
        if (jobType === 'patrolling') addBountyProgress('patrol', 1);
        if (jobType === 'escort') addBountyProgress('escort', 1);

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
        await tryAutoCompleteBounty();
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

      // --- Nút: KHÁM PHÁ DÃ NGOẠI (nav) ---
      else if (action === 'khamphanav') {
        const embed = getKhamPhaEmbed(targetUserId);
        const rows = getKhamPhaComponents(targetUserId);
        await safeV2Update(interaction, [embed], rows);
      }

      // --- Nút: BẮT ĐẦU THÁM HIỂM (chọn địa điểm) ---
      else if (action === 'khamphastart') {
        const locationId = parts.slice(1, -1).join('_'); // Ghép lại vì loc.id có underscore
        const result = explorationService.startExploration(targetUserId, locationId);

        if (!result.success) {
          await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getKhamPhaEmbed(targetUserId);
        const rows = getKhamPhaComponents(targetUserId);
        await safeV2Update(interaction, [embed], rows);
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      }

      // --- Nút: VỀ LẤY THƯỞNG THÁM HIỂM ---
      else if (action === 'khamphaclaim') {
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
                .setCustomId(`khamphaevent_${result.explorationId}_${choice.id}_${targetUserId}`)
                .setLabel(choice.label)
                .setStyle(ButtonStyle.Primary)
            );
          }
          await safeV2Update(interaction, [embed], [choiceRow]);
        } else {
          // Thu hoạch bình thường
          dailyQuestService.updateProgress(targetUserId, 'daily_khampha', 1);
          questChainService.updateProgress(targetUserId, 'explore', 1);
          addBountyProgress('explore', 1);
          addBountyProgress('activity', 1);
          const embed = getKhamPhaEmbed(targetUserId);
          const rows = getKhamPhaComponents(targetUserId);
          await safeV2Update(interaction, [embed], rows);
          await interaction.followUp({ content: result.message });
          await tryAutoCompleteBounty();
        }
      }

      // --- Nút: XỬ LÝ LỰA CHỌN KỲ NGỘ THÁM HIỂM ---
      else if (action === 'khamphaevent') {
        const explorationId = parseInt(parts[1], 10);
        const choiceId = parts[2];

        const result = explorationService.resolveEvent(targetUserId, explorationId, choiceId);
        dailyQuestService.updateProgress(targetUserId, 'daily_khampha', 1);
        questChainService.updateProgress(targetUserId, 'explore', 1);
        addBountyProgress('explore', 1);
        addBountyProgress('activity', 1);

        const embed = getKhamPhaEmbed(targetUserId);
        const rows = getKhamPhaComponents(targetUserId);
        await safeV2Update(interaction, [embed], rows);
        await interaction.followUp({ content: result.message });
        await tryAutoCompleteBounty();
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

        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hosoback_${userIdFromParts}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [backRow]);
      }

      // --- Select Menu: GIEO HẠT LINH ĐIỀN ---
      else if (action === 'linhdiengieoselect' && interaction.isStringSelectMenu()) {
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

      // --- Select Menu: TĂNG TỐC LINH ĐIỀN ---
      else if (action === 'linhdienspeedupselect' && interaction.isStringSelectMenu()) {
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

      // --- Select Menu: CHĂM SÓC LINH ĐIỀN ---
      else if (action === 'linhdiencareselect' && interaction.isStringSelectMenu()) {
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

      // --- Select Menu: CHỌN CÔNG THỨC CHẾ TẠO ---
      else if (action === 'craftselect' && interaction.isStringSelectMenu()) {
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

      // --- Select Menu: LUYỆN KHÍ CHỌN CÔNG THỨC ---
      else if (action === 'luyenkhiselect' && interaction.isStringSelectMenu()) {
        const recipeId = interaction.values[0];
        
        const res = blacksmithService.forgeItem(targetUserId, recipeId);

        if (res.success) {
          addBountyProgress('craft', 1);
          addBountyProgress('forge', 1);
          addBountyProgress('activity', 1);
        }
        
        await interaction.reply({ content: res.success ? res.message : `❌ ${res.message}` });

        // Cập nhật lại UI Luyện Khí
        const user = userRepository.get(targetUserId);
        if (user) {
          const embed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(embed).setFooter({ text: `Thể lực hiện tại: ${user.stamina}/500 | Linh Thạch: ${user.coin_ha_pham}` });
          await interaction.client.rest.patch(Routes.channelMessage(interaction.channelId, interaction.message.id), { body: { components: [require('../../utils/uiSystem').embedToV2(newEmbed)], flags: require('../../utils/uiSystem').V2_FLAG } });
        }

        if (res.success) await tryAutoCompleteBounty();
      }

      if (action === 'linhdiennav') {
        const embed = getLinhDienEmbed(targetUserId);
        const linhComps = getLinhDienComponents(targetUserId);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [...linhComps, backRow]);
        return;
      }

      // V15: Bisinghanh enter button
      else if (action === 'bicanhsonghanh_enter') {
        const { secretRealmService } = require('../../services/SecretRealmService');
        const canEnter = secretRealmService.canEnter(targetUserId);
        if (!canEnter.eligible) {
          await interaction.reply({ content: `❌ ${canEnter.reason}`, flags: MessageFlags.Ephemeral });
          return;
        }
        const config = secretRealmService.getConfig();
        await interaction.reply({ content: `🌀 Đang vào **${config.name}**... Partner cần online để bắt đầu!`, flags: MessageFlags.Ephemeral });
        return;
      }

      // V15: Sect Council vote buttons
      else if (action === 'sectcouncil_vote_yes' || action === 'sectcouncil_vote_no') {
        const { sectCouncilService } = require('../../services/SectCouncilService');
        const sectId = parseInt(parts[2]);
        const vote = action === 'sectcouncil_vote_yes' ? 'yes' : 'abstain';
        const result = sectCouncilService.vote(sectId, targetUserId, parts[1] || '', vote);
        await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
        return;
      }

      // ============================================================
      // V17: BẢNG NGHĨA VỤ — chọn từng nghĩa vụ bằng button
      // customId: bangpick_<questId>_<userId>
      // ============================================================
      else if (action === 'bangpick' && interaction.isButton()) {
        if (interaction.user.id !== targetUserId) {
          await interaction.reply({
            content: '❌ Đây không phải Bảng Nghĩa Vụ của đạo hữu.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const questId = parts.slice(1, -1).join('_');
        if (!questId) {
          await interaction.reply({
            content: '❌ Không xác định được nghĩa vụ đã chọn.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const result = bountyBoardService.toggleBountySelection(targetUserId, questId);
        await interaction.reply({
          content: result.message + (result.locked ? '\nDùng `/bangnghiavu` để xem tiến độ ba nghĩa vụ đã nhận.' : '\nBấm tiếp các nghĩa vụ còn lại cho tới khi đủ 3.'),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // V17: BẢNG NGHĨA VỤ — nhận/kết toán thủ công
      // customId: bangclaim_<userId>
      else if (action === 'bangclaim' && interaction.isButton()) {
        if (interaction.user.id !== targetUserId) {
          await interaction.reply({
            content: '❌ Đây không phải Bảng Nghĩa Vụ của đạo hữu.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const selected = bountyBoardService.getSelectedBounties(targetUserId);
        if (selected.length !== 3) {
          await interaction.reply({
            content: '📜 Đạo hữu vẫn chưa tiếp nhận đủ **3 nghĩa vụ** hôm nay.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (!bountyBoardService.canCompleteToday(targetUserId)) {
          await interaction.reply({
            content: '⏳ Ba đạo nghĩa vụ vẫn chưa hoàn thành. Hãy tiếp tục hành sự rồi quay lại.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const result = bountyBoardService.completeToday(targetUserId);
        await interaction.reply({
          content: result.message,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

    } catch (error: any) {
      console.error('[LifeQuestHandler] Lỗi xử lý:', error);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
        } else if (interaction.isRepliable()) {
          await interaction.followUp({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: MessageFlags.Ephemeral });
        }
      } catch (_) {}
    }
  }
}
