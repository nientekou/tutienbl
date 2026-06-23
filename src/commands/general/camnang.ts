import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';

const CAMNANG_DATA: Record<string, { title: string; color: `#${string}`; content: string }> = {
  chuong1: {
    title: '🌱 CHƯƠNG I: PHÀM NHÂN HƯỚNG ĐẠO',
    color: '#2ecc71',
    content: [
      '**Dẫn Nhập:** Bước vào tiên lộ, phàm nhân phải nghịch thiên cải mệnh, rèn luyện thân thể và thần hồn.',
      '',
      '🔹 **1. Linh Căn (Căn Cốt Thần Thông):**',
      '• Linh căn quyết định thiên phú hấp thu linh khí thiên địa. Có các hệ: **Kim, Mộc, Thủy, Hỏa, Thổ, Phong, Lôi**.',
      '• Đạo hữu có thể dùng `/linhcan toiluyen` để bồi đắp linh căn mục tiêu và tinh giản linh căn thừa. Đạt **100% Đơn Linh Căn** sẽ nhận **x1.5 Tốc độ tu luyện**!',
      '• Phẩm cấp Linh Căn càng cao (Thiên Linh Căn ≥ 90%) thì tỷ lệ kích hoạt thiên phú chiến đấu đặc biệt trong trận càng lớn.',
      '',
      '🔹 **2. Huyết Mạch (Truyền Thừa Viễn Cổ):**',
      '• Kích hoạt huyết mạch thượng cổ để sở hữu chỉ số vượt trội vĩnh viễn.',
      '• Huyết mạch có thể đột biến hoặc nâng cấp thông qua các bảo vật hiếm thu thập được khi đi thám hiểm hoặc bí cảnh.',
      '',
      '🔹 **3. Thiền Định (Tu Luyện):**',
      '• Dùng lệnh `/tuluyen` để nhân vật bắt đầu thiền định tĩnh tọa, hấp thu linh khí tích lũy tu vi theo thời gian.',
      '• Tu vi tích lũy đầy sẽ tự động tăng cấp độ nhân vật.'
    ].join('\n'),
  },
  chuong2: {
    title: '🔮 CHƯƠNG II: PHÁP BẢO THẦN THÔNG',
    color: '#8e44ad',
    content: [
      '**Dẫn Nhập:** Ngoại lực cũng là một phần thực lực. Nắm giữ thần binh bảo giáp giúp đạo hữu vượt cấp khiêu chiến.',
      '',
      '🔹 **1. Đúc Rèn & Cường Hóa (`/cuonghoa`):**',
      '• Sử dụng khoáng thạch thu được từ `/daokhoang` để cường hóa trang bị, tăng mạnh chỉ số tấn công và phòng ngự.',
      '• Trang bị có thể được nâng sao (tối đa 5⭐) để nhân hệ số thuộc tính.',
      '',
      '🔹 **2. Khảm Ngọc & Khí Linh (`/khambha` & `/khilinh`):**',
      '• Khảm bảo thạch ngũ hành vào trang bị để cộng thêm thuộc tính bạo kích, chính xác, né tránh.',
      '• Thức tỉnh **Khí Linh** trong trang bị Sử Thi trở lên bằng `/khilinh thuctinh [mã_hành_trang]` để mở khóa linh hồn binh khí.',
      '• Tra cứu mã **ID Khí Linh** bằng lệnh `/khilinh danhsach` hoặc xem ở tab **Linh Thú** trong `/hoso`. Sử dụng ID này để nuôi dưỡng tăng EXP (`/khilinh nuoiduong [ID] [mã_túi]`), tương tác tăng thân mật (`/khilinh tuongtac [ID]`) hoặc đột phá tiến hóa khi đạt cấp 20 (`/khilinh tienhoa [ID]`).',
      '',
      '🔹 **3. Tâm Pháp Tiên Gia (`/tamphap`):**',
      '• Lĩnh ngộ các bí tịch Tâm Pháp để kích hoạt kỹ năng bị động hoặc chủ động mạnh mẽ trong chiến đấu PvP/PvE.'
    ].join('\n'),
  },
  chuong3: {
    title: '⚡ CHƯƠNG III: KIẾP SỐ NHÂN QUẢ',
    color: '#e67e22',
    content: [
      '**Dẫn Nhập:** Tiên lộ xa xôi, kiếp nạn trùng trùng. Vượt qua kiếp số mới chứng đắc đại đạo.',
      '',
      '🔹 **1. Ngũ Hành Thiên Kiếp & Đột Phá (`/dotpha`):**',
      '• Khi tu vi đạt đỉnh cảnh giới lớn, đạo hữu phải ngênh đón Lôi Kiếp để đột phá.',
      '• Thiên Kiếp mang thuộc tính tương khắc với Linh Căn mạnh nhất của đạo hữu. Hãy chuẩn bị pháp bảo hộ thân hoặc đan dược tương sinh để giảm sát thương lôi kiếp.',
      '',
      '🔹 **2. Ý Cảnh & Trấn Yêu Tháp (`/ycanh` & `/leothap`):**',
      '• Vượt Trấn Yêu Tháp để thu thập ý cảnh toái phiến, ngộ đạo Ý Cảnh tăng sát thương nguyên tố vĩnh viễn.',
      '',
      '🔹 **3. Luân Hồi Chuyển Thế (`/luanhoi`):**',
      '• Khi đạt đến đỉnh phong thế giới, đạo hữu có thể chọn Luân Hồi Chuyển Thế. Reset cấp độ về 1 nhưng giữ lại thuộc tính căn cốt vĩnh viễn để kiếp sau càng thêm cường đại.',
      '',
      '🔹 **4. Đạo Lữ Song Tu (`/daolu`):**',
      '• Cùng đạo hữu khác kết duyên Đạo Lữ. Thực hiện song tu mỗi ngày giúp đôi bên cùng tăng tốc đột phá tu vi.'
    ].join('\n'),
  },
};

export default class CamNangCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('camnang')
        .setDescription('Cẩm Nang Tiên Lộ — Hướng dẫn và điển tịch toàn thư tu tiên.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📖 CẨM NẠNG TIÊN LỘ')
      .setColor('#3498db')
      .setDescription(
        'Chào mừng đạo hữu đến với **Điển Tịch Cẩm Nang Tiên Lộ**!\n\n' +
        'Hãy chọn một chương thư tịch từ menu bên dưới để tìm hiểu về thế giới tu chân huyền bí:\n\n' +
        '🌱 **Chương I: Phàm Nhân Hướng Đạo** — Linh Căn, Huyết Mạch, Thiền Định\n' +
        '🔮 **Chương II: Pháp Bảo Thần Thông** — Đúc Rèn, Khảm Ngọc, Khí Linh, Tâm Pháp\n' +
        '⚡ **Chương III: Kiếp Số Nhân Quả** — Thiên Kiếp, Ý Cảnh, Luân Hồi, Đạo Lữ'
      )
      .setFooter({ text: 'Hãy lựa chọn điển tịch tương ứng bên dưới.' })
      .setTimestamp();

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`camnang_${interaction.user.id}`)
        .setPlaceholder('📖 Chọn chương điển tịch...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('🌱 Chương I: Phàm Nhân Hướng Đạo').setValue('chuong1').setDescription('Linh Căn, Huyết Mạch, Thiền Định'),
          new StringSelectMenuOptionBuilder().setLabel('🔮 Chương II: Pháp Bảo Thần Thông').setValue('chuong2').setDescription('Đúc Rèn, Khảm Ngọc, Khí Linh, Tâm Pháp'),
          new StringSelectMenuOptionBuilder().setLabel('⚡ Chương III: Kiếp Số Nhân Quả').setValue('chuong3').setDescription('Lôi Kiếp, Ý Cảnh, Luân Hồi, Đạo Lữ'),
        )
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

export function getCamNangEmbed(topic: string): EmbedBuilder {
  const guide = CAMNANG_DATA[topic];
  if (!guide) {
    return new EmbedBuilder()
      .setTitle('📖 CẨM NẠNG TIÊN LỘ')
      .setColor('#3498db')
      .setDescription('Chương thư tịch không tồn tại.');
  }

  return new EmbedBuilder()
    .setTitle(guide.title)
    .setColor(guide.color)
    .setDescription(guide.content)
    .setFooter({ text: 'Chọn chương điển tịch khác bên dưới.' })
    .setTimestamp();
}

export function buildCamNangMenu(userId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`camnang_${userId}`)
      .setPlaceholder('📖 Chọn chương điển tịch...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🌱 Chương I: Phàm Nhân Hướng Đạo').setValue('chuong1').setDescription('Linh Căn, Huyết Mạch, Thiền Định'),
        new StringSelectMenuOptionBuilder().setLabel('🔮 Chương II: Pháp Bảo Thần Thông').setValue('chuong2').setDescription('Đúc Rèn, Khảm Ngọc, Khí Linh, Tâm Pháp'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Chương III: Kiếp Số Nhân Quả').setValue('chuong3').setDescription('Lôi Kiếp, Ý Cảnh, Luân Hồi, Đạo Lữ'),
      )
  );
}

export async function handleCamNangSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const topic = interaction.values[0];
  const embed = getCamNangEmbed(topic);
  const menu = buildCamNangMenu(interaction.user.id);
  await interaction.update({ embeds: [embed], components: [menu] });
}
