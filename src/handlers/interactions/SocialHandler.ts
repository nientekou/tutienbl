import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Routes, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { sectService } from '../../services/SectService';
import { combatService } from '../../services/CombatService';
import { guildWarService } from '../../services/GuildWarService';
import { mountService } from '../../services/MountService';
import { leylineService } from '../../services/LeylineService';
import { dailyQuestService } from '../../services/DailyQuestService';
import { questChainService } from '../../services/QuestChainService';
import { encounterService } from '../../services/EncounterService';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { getSectEmbed, getSectComponents } from '../../commands/life/tongmon';
import { getYCanhEmbed, getYCanhComponents } from '../../commands/general/ycanh';
import { getLuanHoiEmbed, getLuanHoiComponents } from '../../commands/general/luanhoi';
import { getDungeonEmbed, getDungeonComponents } from '../../commands/combat/bicanh';
import { getSungThuEmbed, getSungThuComponents } from '../../commands/general/sungthu';
import { getSanYeuThuEmbed, getSanYeuThuComponents, performHunt } from '../../commands/general/sanyeuthu';
import { getTowerEmbed, getTowerComponents } from '../../commands/general/leothap';
import { combatLogsCache } from './CombatLogsCache';
import { safeV2Update, safeV2TextUpdate, toV2Payload } from '../../utils/uiSystem';
import { EMBED_COLORS } from '../../utils/uiSystem';
import { DUNGEONS } from '../../config/dungeons';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';
import { autoBalanceService } from '../../services/AutoBalanceService';

export class SocialHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
    action: string,
    parts: string[],
    userId: string
  ): Promise<void> {
    try {
      const targetUserId = userId;

      // --- Nút: MỞ MODAL THÀNH LẬP TÔNG MÔN ---
      if (action === 'sectestablishnav') {
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

        await (interaction as ButtonInteraction).showModal(modal);
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

      // --- Nút: ĐI ĐẾN BÍ CẢNH (từ hồ sơ) ---
      else if (action === 'bicanhnaav') {
        const embed = getDungeonEmbed(targetUserId);
        const row = getDungeonComponents(targetUserId);
        await safeV2Update(interaction, [embed], [row]);
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
        const customId = interaction.customId;
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

        // A2: Query equipped skills for skill selection
        const equippedSkills = db.prepare('SELECT skill_id FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(targetUserId) as any[];
        const selectedSkillIndex = equippedSkills.length > 1 ? 0 : undefined;

        // Thực hiện khiêu chiến bí cảnh thực sự
        const result = combatService.challengeDungeon(targetUserId, dungeonId, difficulty, playerBuff, monsterBuff, selectedSkillIndex);

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
        const { renderCombatLog } = require('../../utils/combatLogUtils');
        await renderCombatLog(interaction, combatLogsCache.get(targetUserId)?.data, 'Chi tiết nhật ký trận đấu');
      }

      // --- Nút: QUAY LẠI BÍ CẢNH ---
      else if (action === 'bicanhback') {
        const embed = getDungeonEmbed(targetUserId);
        const row = getDungeonComponents(targetUserId);
        await safeV2Update(interaction, [embed], [row]);
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

      // --- Nút: CHẤP NHẬN / TỪ CHỐI KẾT HÔN ---
      else if (action === 'marriageaccept' || action === 'marriagerefuse') {
        const proposerId = parts[1];
        const targetId = parts[2];
        
        if (action === 'marriagerefuse') {
          await safeV2TextUpdate(interaction, `💔 Đạo hữu <@${targetId}> đã uyển chuyển từ chối lời cầu hôn của <@${proposerId}>. Duyên phận chưa tới!`);
          return;
        }

        // Chấp nhận
        const { marriageService } = require('../../services/MarriageService');
        const result = marriageService.acceptProposal(proposerId, targetId);

        if (result.success) {
          await safeV2TextUpdate(interaction, result.message);
        } else {
          await safeV2TextUpdate(interaction, `❌ Cầu hôn thất bại: ${result.message}`);
        }
      }

      // --- Nút: GUILD WAR - TẤN CÔNG / LÀM MỚI ---
      else if (action === 'guildwar') {
        const gwAction = parts[1] as 'attack' | 'refresh';
        const warId = parts[2];

        if (gwAction === 'attack') {
          const result = guildWarService.attack(warId, targetUserId);
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

      // --- Nút: TẤN CÔNG TÔNG MÔN CHIẾN (Sect War) ---
      else if (action === 'sectwarattack') {
        const { sectWarService } = require('../../services/SectWarService');
        const battleId = parseInt(parts[1], 10);
        const result = sectWarService.attack(battleId, targetUserId);
        await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
        return;
      }

      // --- Nút: LÀM MỚI TÔNG MÔN CHIẾN ---
      else if (action === 'sectwarrefresh') {
        const { sectWarService } = require('../../services/SectWarService');
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

      // --- Nút: SỬA CHỮA TRANG BỊ (từ /suachua danhsach) ---
      else if (action === 'suachua') {
        const subAction = parts[1]; // 'all'
        
        if (subAction === 'all') {
          const { handleRepairAllButton } = require('../../commands/general/suachua');
          const result = handleRepairAllButton(targetUserId);
          await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
        }
        return;
      }

      // --- Nút: ĐÁNH THỨC LINH KHÍ (Spirit Weapon Interact) ---
      else if (action === 'spiritinteract') {
        const { spiritWeaponService } = require('../../services/SpiritWeaponService');
        const result = spiritWeaponService.interact(targetUserId);
        await interaction.reply({ content: result.message, flags: !result.success ? MessageFlags.Ephemeral : undefined });
        return;
      }

      // --- Nút: ĐI ĐẾN KHÍ LINH (từ hồ sơ) ---
      else if (action === 'spiritnav') {
        const { spiritWeaponService } = require('../../services/SpiritWeaponService');
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

      // --- Select Menu: ANKY_SELECT (ấn ký) ---
      else if (action === 'anky_select' && interaction.isStringSelectMenu()) {
        const inventoryId = parseInt(interaction.values[0], 10);
        const { soulImprintService } = require('../../services/SoulImprintService');
        const result = soulImprintService.imprintItem(targetUserId, inventoryId);
        if (result.success) {
          await safeV2TextUpdate(interaction, `✅ ${result.message}`);
        } else {
          await safeV2TextUpdate(interaction, `❌ ${result.message}`);
        }
      }

      // --- Select Menu: THAM GIA TÔNG MÔN ---
      else if (action === 'sectjoinselect' && interaction.isStringSelectMenu()) {
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

      // --- Select Menu: QUYÊN GÓP TÔNG MÔN ---
      else if (action === 'sectdonateselect' && interaction.isStringSelectMenu()) {
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

      // --- Modal: TẠO TÔNG MÔN ---
      else if (action === 'sectcreate' && interaction.isModalSubmit()) {
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

    } catch (error: any) {
      console.error('[SocialHandler] Lỗi xử lý:', error);
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
