import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { cultivationService } from '../../services/CultivationService';
import { formatLinhCan } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

function getElementDetails(element: string, percentage: number): {
  grade: string,
  emoji: string,
  color: string,
  talent1: string,
  talent2: string,
  isT1Unlocked: boolean,
  isT2Unlocked: boolean
} {
  const isLoi = element === 'Lôi';
  const isPhong = element === 'Phong';
  const isHoa = element === 'Hỏa';
  const isThuy = element === 'Thủy';
  const isMoc = element === 'Mộc';
  const isTho = element === 'Thổ';

  let grade = 'Phế Linh Căn 🔴';
  if (percentage >= 90) grade = 'Thiên Linh Căn 🟡 (Heavenly)';
  else if (percentage >= 75) grade = 'Địa Linh Căn 🟣 (Earthly)';
  else if (percentage >= 60) grade = 'Linh Linh Căn 🔵 (Spiritual)';
  else if (percentage >= 40) grade = 'Chân Linh Căn 🟢 (True)';
  else if (percentage >= 20) grade = 'Phàm Linh Căn ⬜ (Mortal)';

  let emoji = '⚪';
  let color = '#7f8c8d';
  if (isHoa) { emoji = '🔥'; color = '#e74c3c'; }
  else if (isThuy) { emoji = '💧'; color = '#3498db'; }
  else if (isMoc) { emoji = '🌿'; color = '#2ecc71'; }
  else if (isTho) { emoji = '🪨'; color = '#d35400'; }
  else if (isLoi) { emoji = '⚡'; color = '#f1c40f'; }
  else if (isPhong) { emoji = '🌀'; color = '#1abc9c'; }

  let talent1 = '';
  let talent2 = '';
  const isT1Unlocked = percentage >= 40;
  const isT2Unlocked = percentage >= 90;

  const checkMark1 = isT1Unlocked ? '✅' : '🔒';
  const checkMark2 = isT2Unlocked ? '✅' : '🔒';

  if (isHoa) {
    talent1 = `${checkMark1} **Hỏa Chân (>=40%)**: Tự động thiêu đốt đối thủ hiệp đầu (Hỏa Phế 2 hiệp, 15% ATK).`;
    talent2 = `${checkMark2} **Hỏa Thiên (>=90%)**: Đòn đánh bỏ qua 20% giáp địch, x2 sát thương thiêu đốt (30% ATK).`;
  } else if (isThuy) {
    talent1 = `${checkMark1} **Thủy Chân (>=40%)**: Trị thương kích hoạt hồi phục 12% HP tối đa.`;
    talent2 = `${checkMark2} **Thủy Thiên (>=90%)**: Phục hồi 20% HP tối đa + giải hoàn toàn hiệu ứng Hỏa Phế (burns).`;
  } else if (isMoc) {
    talent1 = `${checkMark1} **Mộc Chân (>=40%)**: Hấp huyết chuyển hóa 25% sát thương thành HP.`;
    talent2 = `${checkMark2} **Mộc Thiên (>=90%)**: Hút máu tăng lên 40% và hồi thêm 5% HP tối đa trực tiếp.`;
  } else if (isTho) {
    talent1 = `${checkMark1} **Thổ Chân (>=40%)**: Thổ Giáp khiên hấp thụ sát thương bằng 15% HP tối đa.`;
    talent2 = `${checkMark2} **Thổ Thiên (>=90%)**: Thổ Giáp hấp thụ 25% HP tối đa và tăng 30% phòng thủ khi khiên tồn tại.`;
  } else if (isLoi) {
    talent1 = `${checkMark1} **Lôi Chân (>=40%)**: Sấm sét gây Tê Liệt địch 1 hiệp, nhân 1.5x sát thương đòn đánh. +10 Tốc Độ từ Linh Căn Lôi.`;
    talent2 = `${checkMark2} **Lôi Thiên (>=90%)**: Lôi Phạt gây Tê Liệt địch 1 hiệp, nhân 2x sát thương đòn đánh. +20 Tốc Độ từ Linh Căn Lôi.`;
  } else if (isPhong) {
    talent1 = `${checkMark1} **Phong Chân (>=40%)**: Phong Hành Bộ Pháp chuẩn bị né tránh hoàn toàn đòn đánh sau.`;
    talent2 = `${checkMark2} **Phong Thiên (>=90%)**: Né tránh đòn sau + tăng vĩnh viễn 10% tỷ lệ né tránh (dodge) suốt trận.`;
  }

  return { grade, emoji, color, talent1, talent2, isT1Unlocked, isT2Unlocked };
}

export default class LinhCanCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('linhcan')
        .setDescription('Hệ thống Linh Căn - Tôi luyện bồi đắp thuộc tính và giác tỉnh thiên phú')
        .addSubcommand(sub =>
          sub
            .setName('kiemtra')
            .setDescription('Kiểm tra độ tinh thuần, phẩm chất và thiên phú linh căn của bạn')
        )
        .addSubcommand(sub =>
          sub
            .setName('toiluyen')
            .setDescription('Tôi luyện Linh Căn (Tiêu hao 50 Trung Phẩm Linh Thạch / 5000 Hạ Phẩm)')
            .addStringOption(opt =>
              opt
                .setName('nguyen_to')
                .setDescription('Chọn hệ linh căn muốn tôi luyện')
                .setRequired(true)
                .addChoices(
                  { name: '🔥 Hỏa', value: 'Hỏa' },
                  { name: '💧 Thủy', value: 'Thủy' },
                  { name: '🌿 Mộc', value: 'Mộc' },
                  { name: '🪨 Thổ', value: 'Thổ' },
                  { name: '⚡ Lôi', value: 'Lôi' },
                  { name: '🌀 Phong', value: 'Phong' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('taytuy')
            .setDescription('Tẩy Tủy Linh Căn - Reroll ngẫu nhiên (Tiêu hao 100 Hạ Phẩm Linh Thạch)')
        )
        .addSubcommand(sub =>
          sub
            .setName('ngotinh_reroll')
            .setDescription('Reroll Linh Căn bằng Ngộ Tính (20 NT, giữ nguyên 1 hệ nếu muốn)')
            .addStringOption(opt =>
              opt
                .setName('lock_element')
                .setDescription('Hệ muốn giữ nguyên (tốn thêm 10 NT)')
                .setRequired(false)
                .addChoices(
                  { name: '🔥 Hỏa', value: 'Hỏa' },
                  { name: '💧 Thủy', value: 'Thủy' },
                  { name: '🌿 Mộc', value: 'Mộc' },
                  { name: '🪨 Thổ', value: 'Thổ' },
                  { name: '⚡ Lôi', value: 'Lôi' },
                  { name: '🌀 Phong', value: 'Phong' }
                )
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const user = userRepository.get(discordId);

    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh `/taonhanvat` để bắt đầu!'
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'kiemtra') {
      const linhCan: Record<string, number> = JSON.parse(user.linh_can || '{}');
      const formattedLinhCan = formatLinhCan(user.linh_can);
      const speedMult = cultivationService.getCultivationSpeedMultiplier(user.linh_can);

      const embed = new EmbedBuilder()
        .setTitle(`☯️ LINH CĂN PHẢN CHIẾU - ${user.name}`)
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription('*Linh Căn phản ánh tư chất thiên địa, quyết định tốc độ hấp thu linh khí và thức tỉnh thiên phú.*')
        .addFields(
          { name: '<:inv:1547865980854599693> Đạo Hữu', value: user.name, inline: true },
          { name: '<:lc1:1547866362511368212> Cảnh Giới', value: user.title, inline: true },
          { name: '🚀 Tốc Độ Tu Luyện', value: `⚡ **${speedMult}x** tốc độ hấp thu linh khí cơ sở`, inline: true }
        )
        .setTimestamp();

      const elementsList = Object.entries(linhCan).sort((a, b) => b[1] - a[1]);
      for (const [element, percentage] of elementsList) {
        const details = getElementDetails(element, percentage);
        const filled = Math.round(percentage / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        embed.addFields({
          name: `${details.emoji} **Linh Căn ${element}**: **${percentage}%** [${details.grade}]`,
          value: [
            `\`[${bar}]\``,
            details.talent1,
            details.talent2
          ].join('\n'),
          inline: false
        });
      }

      // Thêm thông tin hướng dẫn
      embed.addFields({
        name: '<:sotay:1547883761776197632> Chỉ Dẫn Tu Hành',
        value: 
          `• **Tẩy Tủy (` + '`/linhcan taytuy`' + `)**: Reroll ngẫu nhiên toàn bộ hệ linh căn (Phí: 100 Hạ Phẩm LT).\n` +
          `• **Tôi Luyện (` + '`/linhcan toiluyen`' + `)**: Tăng **+1%** hệ được chọn và giảm **-1%** hệ lớn nhất còn lại (Phí: 50 Trung Phẩm LT).\n` +
          `• Khi một hệ giảm xuống **0%**, nó sẽ bị thanh lọc biến mất hoàn toàn. Đạo hữu có thể dùng cơ chế này để tôi luyện thành **Đơn Linh Căn** mong muốn!`
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`taytuyexecute_${discordId}`)
          .setLabel('🌀 Tẩy Tủy Linh Căn (Phí: 100 Hạ Phẩm)')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`hosoback_${discordId}`)
          .setLabel('🔙 Quay Lại Hồ Sơ')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply(toV2Payload([embed], [row] ));
      return;
    }

    if (subcommand === 'toiluyen') {
      const targetElement = interaction.options.getString('nguyen_to', true);
      const result = cultivationService.temperLinhCan(discordId, targetElement);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}`});
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('<:lc1:1547866362511368212> TÔI LUYỆN LINH CĂN THÀNH CÔNG')
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(result.message)
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (subcommand === 'taytuy') {
      // Hiển thị giao diện xác nhận tẩy tủy
      const formattedLinhCan = formatLinhCan(user.linh_can);
      const embed = new EmbedBuilder()
        .setTitle(`🌀 Tẩy Tủy Linh Căn - ${user.name}`)
        .setColor(EMBED_COLORS.INFO)
        .setDescription('Tẩy tủy sẽ tái tạo ngẫu nhiên Linh Căn cốt cách, tác động trực tiếp tới các thuộc tính chiến đấu và hiệu suất tu luyện.')
        .addFields(
          { name: '<:lc01:1547878586000875550> Linh Căn Hiện Tại', value: formattedLinhCan },
          { name: '<:lt1:1547866122123218945> Chi Phí Tẩy Tủy', value: '**100 Hạ Phẩm Linh Thạch**' },
          { name: '<:lt1:1547866122123218945> Số Dư Linh Thạch', value: `**${user.coin_ha_pham}** Hạ Phẩm Linh Thạch` }
        )
        .setFooter({ text: 'Hãy cân nhắc kỹ trước khi quyết định thay đổi!' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`taytuyexecute_${discordId}`)
          .setLabel('🌀 Xác Nhận Tẩy Tủy (100 LThạch)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`hosoback_${discordId}`)
          .setLabel('🔙 Quay Lại Hồ Sơ')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply(toV2Payload([embed], [row] ));
      return;
    }

    if (subcommand === 'ngotinh_reroll') {
      const lockElement = interaction.options.getString('lock_element');
      const baseCost = 20;
      const lockCost = lockElement ? 10 : 0;
      const totalCost = baseCost + lockCost;
      const ngotinh = user.ngotinh || 0;

      if (ngotinh < totalCost) {
        await interaction.editReply({ content: `❌ Không đủ Ngộ Tính! Cần: **${totalCost}** NT, Có: **${ngotinh}** NT.` });
        return;
      }

      const formattedLinhCan = formatLinhCan(user.linh_can);
      const embed = new EmbedBuilder()
        .setTitle(`💡 Reroll Linh Căn bằng Ngộ Tính - ${user.name}`)
        .setColor(EMBED_COLORS.INFO)
        .setDescription('Sử dụng Ngộ Tính để tái tạo Linh Căn, giữ nguyên 1 hệ nếu muốn.')
        .addFields(
          { name: '<:lc01:1547878586000875550> Linh Căn Hiện Tại', value: formattedLinhCan },
          { name: '💡 Chi Phí', value: `**${totalCost}** NT${lockElement ? ` (bao gồm +10 NT giữ hệ ${lockElement})` : ''}` },
          { name: '<:lc1:1547866362511368212> Ngộ Tính Hiện Tại', value: `💡 **${ngotinh}** NT` }
        )
        .setFooter({ text: 'Linh Căn mới sẽ được tạo ngẫu nhiên!' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ngotinh_reroll_execute_${discordId}_${lockElement || 'none'}`)
          .setLabel(`💡 Xác Nhận Reroll (${totalCost} NT)`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`hosoback_${discordId}`)
          .setLabel('🔙 Quay Lại')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply(toV2Payload([embed], [row]));
      return;
    }
  }
}
