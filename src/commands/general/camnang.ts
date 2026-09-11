import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { EMBED_COLORS, toV2Payload, toV2Update } from '../../utils/uiSystem';

const CAMNANG_DATA: Record<string, { title: string; color: `#${string}`; content: string }> = {
  chuong1: {
    title: '<:tvngoc:1547899787918053376> CHƯƠNG I: PHÀM NHÂN HƯỚNG ĐẠO',
    color: '#2ecc71',
    content: [
      '**Dẫn Nhập:** Phàm nhân nhập tiên lộ, trước tu căn cốt, sau dưỡng thần hồn. Muốn nghịch thiên cải mệnh, trước hết phải tự rèn chính mình.',
   '',
      '🔹 **1. Linh Căn — Căn Cơ Nhập Đạo:**',
      '• Linh Căn quyết định khả năng cảm ứng và hấp thu linh khí thiên địa. Hiện có bảy hệ: **Kim, Mộc, Thủy, Hỏa, Thổ, Phong, Lôi**.',
      '• Dùng `/linhcan toiluyen` để bồi dưỡng Linh Căn, đồng thời tinh luyện những thuộc tính dư thừa. Khi đạt **100% Đơn Linh Căn**, nhận **x1.5 Tốc độ Tu Luyện**.',
      '• Linh Căn càng thuần, phẩm cấp càng cao. Khi một hệ đạt **90% trở lên**, sẽ bước vào hàng **Thiên Linh Căn**, gia tăng tỷ lệ kích hoạt thiên phú đặc biệt trong chiến đấu.',
      '',
      '🔹 **2. Huyết Mạch — Cổ Tộc Truyền Thừa:**',
      '• Huyết Mạch ẩn chứa lực lượng truyền thừa từ thời viễn cổ, một khi thức tỉnh có thể gia tăng căn cơ và thuộc tính vĩnh viễn.',
      '• Huyết Mạch có thể phát sinh biến dị hoặc tiếp tục thức tỉnh thông qua các kỳ vật thu được trong hành trình thám hiểm và bí cảnh.',
      '',
      '🔹 **3. Tĩnh Tọa — Tích Lũy Tu Vi:**',
      '• Dùng `/tuluyen` để nhập định, tĩnh tâm dẫn khí, từng bước hấp thu linh khí và tích lũy Tu Vi.',
      '• Khi Tu Vi viên mãn, cảnh giới tự động tăng tiến.'
    ].join('\n'),
  },
  chuong2: {
    title: '<:ipk:1547865972415791215> CHƯƠNG II: PHÁP BẢO THẦN THÔNG',
    color: '#8e44ad',
    content: [
      '**Dẫn Nhập:** Tu hành trọng căn cơ, nhưng ngoại vật cũng có thể trợ đạo. Một kiện thần binh trong tay, đủ khiến kẻ yếu vượt cảnh mà chiến.',
      '',
      '🔹 **1. Luyện Khí & Cường Hóa (`/cuonghoa`):**',
      '• Dùng khoáng thạch thu được từ `/daokhoang` để luyện chế và cường hóa trang bị, gia tăng các thuộc tính chiến đấu.',
      '• Trang bị có thể **Tăng Sao**, tối đa **5⭐**, mỗi lần thăng tinh đều gia tăng hệ số thuộc tính.',
      '',
      '🔹 **2. Khảm Ngọc & Khí Linh (`/khampha` & `/khilinh`):**',
      '• Khảm bảo ngọc Ngũ Hành vào trang bị để gia tăng các thuộc tính như **Bạo Kích, Chính Xác, Né Tránh**.',
      '• Trang bị từ **Sử Thi** trở lên có thể thức tỉnh **Khí Linh** bằng `/khilinh thuctinh [mã_hành_trang]`, mở ra linh tính ẩn trong thần binh.',
      '• Dùng `/khilinh danhsach` để tra cứu **ID Khí Linh**, hoặc xem tại tab **Linh Thú** trong `/hoso`.',
      '• Có thể dùng ID để nuôi dưỡng Khí Linh bằng `/khilinh nuoiduong [ID] [mã_túi]`, tương tác tăng thân mật bằng `/khilinh tuongtac [ID]`, hoặc tiến hành **Tiến Hóa** khi đạt cấp 20 bằng `/khilinh tienhoa [ID]`.',
      '',
      '🔹 **3. Tâm Pháp — Tu Đạo Luyện Tâm (`/tamphap`):**',
      '• Lĩnh ngộ các thiên Tâm Pháp để khai mở thần thông bị động hoặc chủ động, trợ lực trong chiến đấu **PvP/PvE**.'
    ].join('\n'),
  },
  chuong3: {
    title: '<:idrole:1547865936848101456> CHƯƠNG III: KIẾP SỐ NHÂN QUẢ',
    color: '#e67e22',
    content: [
      '**Dẫn Nhập:** Tiên lộ vốn chẳng bằng phẳng. Mỗi lần phá cảnh đều là một lần nghênh kiếp. Vượt được thiên kiếp, mới có tư cách bước tiếp trên đại đạo.',
        '',
        '🔹 **1. Ngũ Hành Thiên Kiếp & Đột Phá (`/dotpha`):**',
        '• Khi Tu Vi đạt cực hạn của đại cảnh giới, đạo hữu phải nghênh đón **Thiên Kiếp** để phá cảnh.',
        '• Thiên Kiếp sẽ mang thuộc tính tương khắc với **Linh Căn mạnh nhất** của đạo hữu. Hãy chuẩn bị pháp bảo hộ thân hoặc đan dược tương sinh để giảm bớt kiếp lực.',
        '',
        '🔹 **2. Ý Cảnh & Trấn Yêu Tháp (`/ycanh` & `/leothap`):**',
        '• Vượt qua Trấn Yêu Tháp để thu thập **Ý Cảnh Toái Phiến**.',
        '• Dung hội Ý Cảnh, ngộ ra đạo vận thuộc tính, từ đó gia tăng sát thương nguyên tố vĩnh viễn.',
        '',
        '🔹 **3. Luân Hồi Chuyển Thế (`/luanhoi`):**',
        '• Khi đã đứng trên đỉnh phong của một kiếp, đạo hữu có thể lựa chọn **Luân Hồi Chuyển Thế**.',
        '• Luân Hồi sẽ đưa cảnh giới trở về cấp 1, nhưng những căn cốt đã tôi luyện vẫn được lưu giữ, để kiếp sau tiếp tục bước xa hơn trên con đường tu hành.',
        '',
        '🔹 **4. Đạo Lữ Đồng Hành (`/daolu`):**',
        '• Cùng một đạo hữu kết thành **Đạo Lữ**, đồng hành trên tiên lộ.',
        '• Mỗi ngày cùng nhau song tu, đôi bên đều có thể nhận thêm tốc độ tích lũy Tu Vi và hỗ trợ nhau trên con đường phá cảnh.'
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
      .setColor(EMBED_COLORS.INFO)
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

    await interaction.editReply(toV2Payload([embed], [row] ));
  }
}

export function getCamNangEmbed(topic: string): EmbedBuilder {
  const guide = CAMNANG_DATA[topic];
  if (!guide) {
    return new EmbedBuilder()
      .setTitle('📖 CẨM NẠNG TIÊN LỘ')
      .setColor(EMBED_COLORS.INFO)
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
  await interaction.update(toV2Update([embed], [menu]));
}
