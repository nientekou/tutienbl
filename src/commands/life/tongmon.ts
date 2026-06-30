import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { sectService } from '../../services/SectService';
import { userRepository } from '../../database/repositories/UserRepository';
import { getProgressBar } from '../../utils/constants';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

/**
 * Tạo Embed hiển thị thông tin Tông Môn
 */
export function getSectEmbed(userId: string): ContainerBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return container(V2_COLORS.danger, [
      header('❌ Lỗi', 'Đạo hữu chưa khởi tạo nhân vật.')
    ]);
  }

  // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
  if (!user.sect_id) {
    const content: any[] = [
      header('☯️ Tiên Giới Tông Môn — Tán Tu Chí Lộ', 'Đạo hữu hiện đang là một Tán Tu tự do tự tại, chưa gia nhập môn phái nào.\n\nGia nhập Tông Môn giúp đạo hữu kết giao đồng đạo, cống hiến xây dựng môn phái và tăng cấp uy danh môn hạ!')
    ];

    const topSects = sectService.getTopSects();
    content.push(separator());
    if (topSects.length > 0) {
      const listText = topSects
        .map((s, i) => `🔹 **${s.name}** (Cấp ${s.level}) — Trưởng môn: *${s.master_name}* (${s.member_count}/${s.member_limit} đệ tử)`)
        .join('\n');
      content.push(body(`🌟 **Các Tông Môn Đang Tuyển Đệ Tử:**\n${listText}`));
    } else {
      content.push(body('🌟 **Các Tông Môn Đang Tuyển Đệ Tử:**\n*Hiện chưa có Tông Môn nào được sáng lập trong server.*'));
    }

    content.push(separator());
    content.push(body('🪙 **Chi Phí Sáng Lập Môn Phái:**\n💵 **500 Linh Thạch Hạ Phẩm**'));

    return container(V2_COLORS.dark, content);
  }

  // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
  const sect = sectService.getSectDetails(user.sect_id);
  if (!sect) {
    return container(V2_COLORS.danger, [
      header('❌ Lỗi', 'Không thể truy vấn thông tin Tông Môn.')
    ]);
  }

  const expBar = getProgressBar(sect.exp, sect.level * 1000, 10);

  const memberList = sect.members
    .slice(0, 10)
    .map((m, i) => {
      const isMaster = m.discord_id === sect.master_id;
      const role = isMaster ? '👑 [Tông Chủ]' : '🔸 [Đệ Tử]';
      return `${i + 1}. ${role} **${m.name}** (Cấp ${m.level}) — Cống hiến: **${m.sect_contribution}**`;
    })
    .join('\n');

  return container(V2_COLORS.primary, [
    header(`☯️ Môn Phái: ${sect.name} (Cấp ${sect.level})`, `*"${sect.description}"*`),
    separator(),
    body(
      `👤 **Tông Chủ:** ${sect.master_name}\n` +
      `👥 **Thành Viên:** **${sect.member_count}/${sect.member_limit}** đệ tử\n` +
      `🪙 **Ngân Khố Môn Phái:** **${sect.resources}** Linh Thạch\n` +
      `🏵️ **Cơ Duyên Bản Thân:** ⭐ **${user.sect_contribution}** cống hiến`
    ),
    separator(),
    body(
      `🏰 **Cơ Sở Vật Chất Tông Môn:**\n` +
      `• **Tụ Linh Trận:** Cấp **${sect.tu_linh_level}/5** (+${sect.tu_linh_level * 5}% EXP Tu Luyện)\n` +
      `• **Luyện Đan Đường:** Cấp **${sect.dan_duong_level}/5** (+${sect.dan_duong_level * 2}% Tỷ lệ Luyện Đan)`
    ),
    separator(),
    body(`✨ **Tiến Trình Thăng Cấp:**\n${expBar} (${sect.exp}/${sect.level * 1000} XP)`),
    separator(),
    body(`📜 **Danh Sách Đệ Tử Tông Môn:**\n${memberList || '*Không có thành viên.*'}`)
  ]);
}

/**
 * Tạo các Component tương tác cho Tông Môn
 */
export function getSectComponents(userId: string): any[] {
  const user = userRepository.get(userId);
  const rows: any[] = [];

  if (!user) return rows;

  // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
  if (!user.sect_id) {
    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`sectestablishnav_${userId}`)
        .setLabel('🆕 Sáng Lập Tông Môn (500 LThạch)')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(user.coin_ha_pham < 500)
    );
    rows.push(btnRow);

    const sects = sectService.getTopSects();
    if (sects.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`sectjoinselect_${userId}`)
        .setPlaceholder('☯️ Chọn Tông Môn muốn gia nhập...');

      sects.forEach(s => {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(s.name)
            .setDescription(`Cấp ${s.level} | Đệ tử: ${s.member_count}/${s.member_limit} | Trưởng môn: ${s.master_name}`)
            .setValue(s.id.toString())
        );
      });
      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }
  } 
  // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
  else {
    const sect = sectService.getSectDetails(user.sect_id);
    const isMaster = sect ? sect.master_id === userId : false;

    const donateSelect = new StringSelectMenuBuilder()
      .setCustomId(`sectdonateselect_${userId}`)
      .setPlaceholder('🪙 Cống hiến Linh Thạch vào Ngân khố...');

    donateSelect.addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Quyên góp 50 Linh Thạch').setValue('50'),
      new StringSelectMenuOptionBuilder().setLabel('Quyên góp 200 Linh Thạch').setValue('200'),
      new StringSelectMenuOptionBuilder().setLabel('Quyên góp 500 Linh Thạch').setValue('500')
    );

    if (user.coin_ha_pham < 50) {
      donateSelect.setDisabled(true).setPlaceholder('🪙 Không đủ Linh Thạch để cống hiến (Tối thiểu 50)');
    }
    rows.push(new ActionRowBuilder().addComponents(donateSelect));

    if (isMaster && sect) {
      const upgradeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`sectupgrade_tuling_${userId}`)
          .setLabel('🏗️ Nâng Tụ Linh Trận')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(sect.tu_linh_level >= 5),
        new ButtonBuilder()
          .setCustomId(`sectupgrade_danduong_${userId}`)
          .setLabel('🏗️ Nâng Luyện Đan Đường')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(sect.dan_duong_level >= 5)
      );
      rows.push(upgradeRow);
    }

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`sectleave_${userId}`)
        .setLabel(isMaster ? '💥 Giải Tán Tông Môn' : '🔙 Rời Tông Môn')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`sectrefresh_${userId}`)
        .setLabel('🔄 Làm Mới')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(btnRow);
  }

  return rows;
}

export default class TongMonCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('tongmon')
        .setDescription('Quản lý hoặc gia nhập Tông Môn Bang Hội.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
      });
      return;
    }

    const embed = getSectEmbed(userId);
    const components = getSectComponents(userId);

    await interaction.editReply(toV2Payload([embed], components as any[]));
  }
}
