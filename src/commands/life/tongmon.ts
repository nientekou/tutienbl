import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { sectService, SectDetails } from '../../services/SectService';
import { userRepository } from '../../database/repositories/UserRepository';
import { getProgressBar } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

/**
 * Tạo Embed hiển thị thông tin Tông Môn
 */
export function getSectEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription('Đạo hữu chưa khởi tạo nhân vật.');
  }

  // TRƯỜNG HỢP: CHƯA CÓ TÔNG MÔN
  if (!user.sect_id) {
    const embed = new EmbedBuilder()
      .setTitle('☯️ Tiên Giới Tông Môn - Tán Tu Chí Lộ')
      .setDescription(
        `Đạo hữu hiện đang là một **Tán Tu** tự do tự tại, chưa gia nhập môn phái nào.\n\n` +
        `Gia nhập Tông Môn giúp đạo hữu kết giao đồng đạo, cống hiến xây dựng môn phái và tăng cấp uy danh môn hạ!`
      )
      .setColor(EMBED_COLORS.NEUTRAL)
      .setTimestamp();

    const topSects = sectService.getTopSects();
    if (topSects.length > 0) {
      const listText = topSects
        .map((s, i) => `🔹 **${s.name}** (Cấp ${s.level}) — Trưởng môn: *${s.master_name}* (${s.member_count}/${s.member_limit} đệ tử)`)
        .join('\n');
      embed.addFields({ name: '🌟 Các Tông Môn Đang Tuyển Đệ Tử', value: listText });
    } else {
      embed.addFields({ name: '🌟 Các Tông Môn Đang Tuyển Đệ Tử', value: '*Hiện chưa có Tông Môn nào được sáng lập trong server.*' });
    }

    embed.addFields({ name: '🪙 Chi Phí Sáng Lập Môn Phái', value: '💵 **500 Linh Thạch Hạ Phẩm**' });
    return embed;
  }

  // TRƯỜNG HỢP: ĐÃ CÓ TÔNG MÔN
  const sect = sectService.getSectDetails(user.sect_id);
  if (!sect) {
    // Khôi phục an toàn
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription('Không thể truy vấn thông tin Tông Môn.');
  }

  const expBar = getProgressBar(sect.exp, sect.level * 1000, 10);

  const embed = new EmbedBuilder()
    .setTitle(`☯️ Môn Phái: ${sect.name} (Cấp ${sect.level})`)
    .setDescription(`*"${sect.description}"*`)
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      { name: '👤 Tông Chủ', value: sect.master_name, inline: true },
      { name: '👥 Thành Viên', value: `**${sect.member_count}/${sect.member_limit}** đệ tử`, inline: true },
      { name: '🪙 Ngân Khố Môn Phái', value: `**${sect.resources}** Linh Thạch`, inline: true },
      { name: '🏰 Cơ Sở Vật Chất Tông Môn', value: `• **Tụ Linh Trận:** Cấp **${sect.tu_linh_level}/5** (+${sect.tu_linh_level * 5}% EXP Tu Luyện)\n• **Luyện Đan Đường:** Cấp **${sect.dan_duong_level}/5** (+${sect.dan_duong_level * 2}% Tỷ lệ Luyện Đan)` },
      { name: '✨ Tiến Trình Thăng Cấp', value: `${expBar} (${sect.exp}/${sect.level * 1000} XP)` },
      { name: '🏵️ Điểm Cống Hiến Cá Nhân', value: `⭐ **${user.sect_contribution}** điểm cống hiến` }
    )
    .setTimestamp();

  // Hiển thị danh sách thành viên (tối đa 10 người)
  const memberList = sect.members
    .slice(0, 10)
    .map((m, i) => {
      const isMaster = m.discord_id === sect.master_id;
      const role = isMaster ? '👑 [Tông Chủ]' : '🔸 [Đệ Tử]';
      return `${i + 1}. ${role} **${m.name}** (Cấp ${m.level}) — Cống hiến: **${m.sect_contribution}**`;
    })
    .join('\n');

  embed.addFields({ name: '📜 Danh Sách Đệ Tử Tông Môn', value: memberList || '*Không có thành viên.*' });

  return embed;
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
    // 1. Nút sáng lập Tông Môn
    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`sectestablishnav_${userId}`)
        .setLabel('🆕 Sáng Lập Tông Môn (500 LThạch)')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(user.coin_ha_pham < 500)
    );
    rows.push(btnRow);

    // 2. Dropdown xin gia nhập Tông môn
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

    // 1. Dropdown quyên góp Linh Thạch
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

    // 2. Nút nâng cấp công trình (Chỉ dành cho Tông Chủ)
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

    // 3. Nút rời tông môn / Giải tán, Làm mới
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
