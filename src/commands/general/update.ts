import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';

interface UpdateLog {
  version: string;
  date: string;
  changes: string[];
}

const UPDATE_LOGS: UpdateLog[] = [
  {
    version: 'v1.3.0',
    date: '20/06/2026',
    changes: [
      '☯️ **Đại Trùng Tu Linh Căn (V2)**: Phân chia Linh Căn thành 6 Phẩm Cảnh Giới: Phế (<20%), Phàm (20-39%), Chân (40-59%), Linh (60-74%), Địa (75-89%), Thiên (90-100%). Tăng tỷ lệ kích hoạt kỹ năng lên đến 50%.',
      '🔥 **Giác Tỉnh Thiên Phú Ngũ Hành**: Thức tỉnh các hiệu ứng thiên phú chiến đấu đặc biệt khi đạt cảnh giới Chân Linh Căn (>=40%) và Thiên Linh Căn (>=90%) trong chiến đấu (VD: Hỏa Thiên bỏ qua DEF, Thủy Thiên giải trừ Hỏa Phế, Lôi Thiên x2 sát thương,...)',
      '✨ **Tôi Luyện Linh Căn (`/linhcan toiluyen`)**: Cho phép bồi đắp thuộc tính chỉ định bằng cách chuyển đổi phần trăm (+1% hệ chọn, -1% hệ lớn nhất còn lại). Khi thuộc tính phụ giảm về 0%, nó sẽ bị thanh lọc hoàn toàn để giúp đạo hữu đạt tới Đơn Linh Căn (1.5x Tốc độ tu luyện).',
      '🌀 **Lệnh Mới `/linhcan`**: Khai mở nhóm lệnh `/linhcan kiemtra`, `/linhcan toiluyen` và `/linhcan taytuy` với giao diện hiển thị đồ họa thanh tiến trình đẹp mắt.',
      '🐾 **Cập Nhật Linh Thú Các**: Hiển thị rõ ràng chỉ số sao Tinh Túc (`⭐`) và thuộc tính đột phá tăng thêm từ quá trình Thôn Phệ trong `/sungthu danhsach` và trang cá nhân `/hoso`.'
    ]
  },
  {
    version: 'v1.2.0',
    date: '20/06/2026',
    changes: [
      '🏪 **Cải Tiến Cửa Hàng (`/shop`)**: Phân loại vật phẩm thành các mục rõ ràng (Đan Dược, Bùa Chú, Đỉnh Luyện, Rương Cơ Duyên, Vật Phẩm Kết Duyên, Trân Bảo KNB) tạo sự gọn gàng và đẹp mắt.',
      '🪙 **Hệ Thống Đổi Tiền (`/doitien`)**: Hỗ trợ chuyển đổi qua lại giữa tất cả các loại Linh Thạch (Hạ, Trung, Thượng Phẩm) và Kim Nguyên Bảo (KNB).',
      '⚖️ **Cân Bằng Tiền Tệ Tân Thủ**: Điều chỉnh quà khởi đầu khi tạo nhân vật (`/taonhanvat`) thành `2100 Hạ Phẩm Linh Thạch` và `0 KNB` để ổn định hệ thống kinh tế.',
      '🎰 **Khu Vực Casino (`/casino`)**: Khai mở sới bạc giải trí thử thách vận khí với trò chơi **Đỏ Đen** (🔴/⚫ tỷ lệ 50/50, 1 ăn 1) và **Tài Xỉu** (🎲 lắc 3 xúc xắc, trừ phí sàn 5%) nhận Linh Thạch Hạ Phẩm.',
      '🏆 **Cân Bằng Chỉ Tiêu Danh Hiệu**: Giảm nhẹ yêu cầu của tất cả thành tựu trao tặng danh hiệu (như Thiền Sư, Phó Bản Dũng Sĩ, PvP Chiến Binh, Linh Nông,...) để người chơi dễ tiếp cận hơn.',
      '🐎 **Sửa Lỗi Tọa Kỵ**: Khắc phục lỗi khi sử dụng nút/menu chọn Tọa Kỵ trong trang cá nhân `/hoso`.',
      '🤝 **Sửa Lỗi Tham Gia Bí Cảnh**: Khắc phục lỗi phân quyền khiến đạo hữu khác không thể nhấn nút "Tham Gia" khi chủ phòng tạo tổ đội `/bicanh taolap`.',
      '💊 **Vá Lỗi Lệnh `/dung`**: Khắc phục lỗi `Unknown Interaction` (10062) khi sử dụng đan dược hoặc mở rương với số lượng lớn.'
    ]
  },
  {
    version: 'v1.1.0',
    date: '15/06/2026',
    changes: [
      '🩸 **Giác Tỉnh Huyết Mạch**: Hệ thống Huyết Mạch (Long Huyết, Phượng Hoàng, Côn Luân, Bạch Hổ, Huyền Vũ, Thanh Long) gia tăng sức mạnh vượt trội.',
      '⚡ **Pháp Bảo Khí Linh**: Đánh thức linh tính trang bị phẩm chất Epic trở lên để nhận nội tại chiến đấu mạnh mẽ.',
      '🌾 **Tối Ưu Linh Điền**: Khắc phục lỗi đóng băng thời gian sinh trưởng sau khi gieo trồng linh thảo.'
    ]
  }
];

export default class UpdateCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('update')
        .setDescription('Xem nhật ký cập nhật và các tính năng mới/sửa lỗi của bot.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📢 BẢN TIN CẬP NHẬT - HỆ THỐNG TU TIÊN 📢')
      .setColor('#3498db')
      .setDescription('*Nơi ghi nhận các đại dịch chuyển, thiên cơ thay đổi và các vá lỗi của đại giới.*')
      .setTimestamp()
      .setFooter({ text: 'Dùng /huongdan để xem hướng dẫn tu tiên chi tiết' });

    for (const log of UPDATE_LOGS) {
      embed.addFields({
        name: `✨ Phiên bản ${log.version} (${log.date})`,
        value: log.changes.map(change => `• ${change}`).join('\n')
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
