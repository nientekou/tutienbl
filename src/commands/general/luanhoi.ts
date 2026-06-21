import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';

export function getLuanHoiEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('🌌 LUÂN HỒI CHUYỂN THẾ')
      .setColor('#d35400')
      .setDescription('Chưa khởi tạo nhân vật.');
  }

  const currentLuanHoi = user.luan_hoi_count || 0;

  const desc = `🌌 **CƠ DUYÊN NGHỊCH THIÊN CHUYỂN THẾ LUÂN HỒI**\n\n` +
    `*Khi tu sĩ đạt tới Đăng Tiên Kỳ - Tầng 38 (Cấp 380), cơ thể đã tiệm cận thiên địa quy luật, có thể lựa chọn tự bạo tu vi kiếp này để bước qua Lục Đạo Luân Hồi, bắt đầu chuyển thế trùng sinh.*\n\n` +
    `⚡ **Điều Kiện Luân Hồi:** Đạt Cấp **380** (Hiện tại: Cấp **${user.level}**)\n\n` +
    `🎁 **Đặc Quyền Vĩnh Viễn Sau Khi Luân Hồi:**\n` +
    `- 🧘 Tốc độ tu luyện nhàn rỗi tăng vĩnh viễn: **+25%** (Hiện tại: +${currentLuanHoi * 25}%)\n` +
    `- 📜 Nhận Đạo Hiệu đặc biệt: **Luân Hồi Chi Chủ - Đời ${currentLuanHoi + 1}**\n` +
    `- 🪙 Giữ nguyên toàn bộ Linh Thạch Hạ/Trung/Thượng Phẩm, Kim Nguyên Bảo.\n` +
    `- 💼 Giữ nguyên toàn bộ Túi Đồ (Trang bị, nguyên liệu, đan dược).\n` +
    `- ☯️ Tẩy tủy nhận một Linh Căn mới ngẫu nhiên.\n\n` +
    `⚠️ **Lưu Ý:** Tu vi và Cảnh giới sẽ được reset về **Luyện Khí Kỳ - Tầng 1 (Cấp 1)**. Đạo hữu có muốn nghịch thiên cải mệnh, đi vào Luân Hồi?`;

  const isEligible = user.level >= 380;

  return new EmbedBuilder()
    .setTitle(`🌌 LUÂN HỒI CHUYỂN THẾ - ${user.name}`)
    .setColor(isEligible ? '#9b59b6' : '#95a5a6')
    .setDescription(desc)
    .setFooter({ text: isEligible ? 'Nhấn nút phía dưới để xác nhận đi vào Luân Hồi đại trận!' : 'Hãy tiếp tục tu luyện đạt Đăng Tiên Kỳ Đại Viên Mãn!' })
    .setTimestamp();
}

export function getLuanHoiComponents(userId: string, isEligible: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`luanhoiconfirm_${userId}`)
      .setLabel('🌌 Đi Vào Luân Hồi')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isEligible),
    new ButtonBuilder()
      .setCustomId(`luanhoicancel_${userId}`)
      .setLabel('❌ Hủy Bỏ')
      .setStyle(ButtonStyle.Secondary)
  );
}

export default class LuanHoiCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('luanhoi')
        .setDescription('Tiến hành Luân Hồi Chuyển Thế khi đạt cảnh giới tối cao (Cấp 380).')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const user = userRepository.get(discordId);

    if (!user) {
      await interaction.reply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!',
        ephemeral: true
      });
      return;
    }

    const embed = getLuanHoiEmbed(discordId);
    const row = getLuanHoiComponents(discordId, user.level >= 380);

    await interaction.reply({ embeds: [embed], components: [row] });
  }
}
