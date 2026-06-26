"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHuongDanEmbed = getHuongDanEmbed;
exports.buildHuongDanMenu = buildHuongDanMenu;
exports.handleHuongDanSelect = handleHuongDanSelect;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const uiSystem_1 = require("../../utils/uiSystem");
const GUIDES = {
    batdau: {
        title: '🌱 BẮT ĐẦU TU TIÊN',
        color: '#2ecc71',
        content: [
            '**Chào mừng đạo hữu đến với thế giới tu tiên!**',
            '',
            '🔹 **Bước 1:** Tạo nhân vật với `/taonhanvat`',
            '🔹 **Bước 2:** Xem hồ sơ với `/hoso` để theo dõi chỉ số',
            '🔹 **Bước 3:** Làm việc với `/lamviec` để kiếm Linh Thạch và nguyên liệu',
            '🔹 **Bước 4:** Tu luyện với `/tuluyen` để tăng tu vi',
            '🔹 **Bước 5:** Đột phá cảnh giới khi đủ tu vi!',
            '',
            '💡 **Mẹo:** Cứ đạt đủ EXP là tự động lên cấp! Dùng `/dotpha` để vượt bình cảnh.',
        ].join('\n'),
    },
    lamviec: {
        title: '⛏️ LÀM VIỆC & KIẾM TÀI NGUYÊN',
        color: '#95a5a6',
        content: [
            '**Các công việc hàng ngày:**',
            '',
            '⚒️ **Khai Thác** — Nhận: khoáng thạch, trang bí, LT',
            '🌿 **Hái Lượm** — Nhận: thảo dược, hạt giống, đan dược',
            '🛡️ **Tuần Tra** — Nhận: phù lục, rương báu, KNB',
            '',
            '📌 Mỗi lần làm việc tốn **10 Thể Lực**, hồi phục **5 Thể Lực/phút**.',
            '📌 Hồi chiêu 60 giây giữa các lần làm việc.',
            '📌 15% gặp **Kỳ Ngộ** — sự kiện đặc biệt có thưởng lớn!',
            '📌 Có tọa kỵ sẽ giảm 5-50% cooldown và 3-30% thể lực.',
        ].join('\n'),
    },
    chientran: {
        title: '⚔️ CHIẾN ĐẤU & PVP',
        color: '#e74c3c',
        content: [
            '**Các hoạt động chiến đấu:**',
            '',
            '🐺 **Săn Yêu Thú** (`/sanyeuthu`) — Săn quái kiếm nguyên liệu',
            '  • 10% gặp kỳ ngộ, 5% bắt được tọa kỵ',
            '',
            '🔮 **Bí Cảnh** (`/bicanh`) — Vượt ải chọn đúng-khắc chế',
            '  • 4 độ khó: Dễ → Thường → Khó → Ác Mộng',
            '',
            '🏯 **Trấn Yêu Tháp** (`/leothap`) — 100 tầng thử thách',
            '  • Mỗi 10 tầng có Boss, thưởng lớn',
            '',
            '👹 **World Boss** (`/worldboss`) — Boss toàn server',
            '  • Tấn công mỗi 7 phút, nhận thưởng theo sát thương',
            '',
            '⚔️ **Quyết Đấu** (`/quyetau`) — PvP oẳn tù tì với người chơi',
            '  • Cược Linh Thạch, thắng nhận 95% tiền cược',
        ].join('\n'),
    },
    trangbi: {
        title: '🛡️ TRANG BỊ & CƯỜNG HÓA',
        color: '#8e44ad',
        content: [
            '**Hệ thống trang bị và cường hóa:**',
            '',
            '📦 **Phân Loại Trang Bị:**',
            '  ⚪ Thường → 🟢 Hiếm → 🔵 Trân Quý → 🟣 Sử Thi → 🟡 Huyền Thoại → 🔴 Thần Khí',
            '',
            '⚔️ **Các Slot:** Vũ Khí | Đạo Bào | Nhẫn | Dây Chuyền | Bùa | Pháp Bảo',
            '',
            '🔧 **Tính Năng:**',
            '  • `/trangbi giamdinh` — Giám định phôi thành trang bị (50 LT)',
            '  • `/trangbi phangiai` — Phân giải trang bị lấy Mảnh (fragments)',
            '  • `/trangbi nangsao` — Nâng sao (+20% chỉ số/sao, max 5⭐)',
            '  • `/trangbi ghep` — Ghép Mảnh thành trang bị S/SS/SSS',
            '',
            '⚡ **Khí Linh (Linh Hồn Trang Bị):**',
            '  • Thức tỉnh khí linh cho trang bị phẩm chất Epic trở lên bằng `/khilinh thuctinh [mã_hành_trang]`.',
            '  • Tra cứu mã **ID Khí Linh** bằng lệnh `/khilinh danhsach` hoặc xem ở tab **Linh Thú** trong `/hoso`.',
            '  • Cho ăn: `/khilinh nuoiduong [ID_khí_linh] [mã_hành_trang] [soluong]` để tăng EXP.',
            '  • Trò chuyện: `/khilinh tuongtac [ID_khí_linh]` tăng độ thân mật.',
            '  • Xem thông tin & kỹ năng: `/khilinh kynang [ID_khí_linh]`.',
        ].join('\n'),
    },
    taimat: {
        title: '🪙 KINH TẾ & TÀI NGUYÊN',
        color: '#f1c40f',
        content: [
            '**Đơn vị tiền tệ:**',
            '🟤 Hạ Phẩm Linh Thạch — đơn vị cơ bản',
            '⚪ Trung Phẩm Linh Thạch (1 = 100 Hạ Phẩm)',
            '🟡 Thượng Phẩm Linh Thạch (1 = 10,000 Hạ Phẩm)',
            '💎 Kim Nguyên Bảo — tiền tệ cao cấp (1 = 1,000,000 Hạ Phẩm)',
            '',
            '**Kiếm tiền:**',
            '  • `/lamviec` — Cơ bản, ổn định',
            '  • `/bicanh` — Rủi ro nhưng thưởng lớn',
            '  • `/vanbaolau ban` — Bán vật phẩm cho người chơi khác',
            '  • `/sanyeuthu` — Săn nguyên liệu bán',
            '',
            '🌾 **Linh Điền** (`/linhdien`) — Trồng thảo dược bán / dùng',
            '🛠️ **Chế Tạo** (`/chetao`) — Tự sản xuất trang bị',
        ].join('\n'),
    },
    nangcao: {
        title: '🌟 NÂNG CAO & TÍNH NĂNG ĐẶC BIỆT',
        color: '#e67e22',
        content: [
            '**Tính năng nâng cao cho tu sĩ kỳ cựu:**',
            '',
            '🌌 **Ngộ Ý Cảnh** (`/ycanh`) — Mở khóa cảnh giới ý chí',
            '  • Mỗi ý cảnh tăng chỉ số vĩnh viễn',
            '',
            '🌀 **Luân Hồi** (`/luanhoi`) — Chuyển thế khi đạt đỉnh',
            '  • Reset cấp nhưng giữ chỉ số cốt lõi',
            '',
            '💖 **Kết Hôn** (`/daolu cau-hon`) — Cầu hôn kết đạo lữ, dùng `/daolu song-tu` nhận Tu Vi hàng ngày',
            '  • Tăng hảo cảm nhận buff lên đến +20% HP & Công Kích',
            '',
            '☯️ **Tông Môn** (`/tongmon`) — Gia nhập hoặc sáng lập môn phái',
            '  • Cống hiến, nâng cấp, chiến đấu tông môn',
            '',
            '🗺️ **Khám Phá** (`/khambha`) — Dã ngoại tìm bảo vật',
            '  • Kỳ ngộ, chiến đấu, nhặt đồ hiếm',
            '',
            '🐎 **Tọa Kỵ** (`/toaky`) — Thuần hóa và cưỡi linh thú',
            '🐉 **Linh Thú** (`/sungthu`) — Nuôi dưỡng thú cưng chiến đấu',
            '⚡ **Khí Linh** (`/khilinh`) — Thức tỉnh linh hồn vũ khí',
        ].join('\n'),
    },
    linhcan: {
        title: '☯️ NGŨ HÀNH LINH CĂN & THIÊN PHÚ',
        color: '#8e44ad',
        content: [
            '**Linh Căn quyết định căn cốt, hiệu suất tu luyện và thức tỉnh thiên phú:**',
            '',
            '📊 **Phẩm Cảnh Giới Linh Căn:**',
            '  • 🔴 **Phế Linh Căn**: < 20% (0% kích hoạt kỹ năng trong trận)',
            '  • ⬜ **Phàm Linh Căn**: 20% - 39% (10% kích hoạt)',
            '  • 🟢 **Chân Linh Căn**: 40% - 59% (20% kích hoạt, mở khóa Thiên Phú Bậc 1)',
            '  • 🔵 **Linh Linh Căn**: 60% - 74% (30% kích hoạt)',
            '  • 🟣 **Địa Linh Căn**: 75% - 89% (40% kích hoạt)',
            '  • 🟡 **Thiên Linh Căn**: 90% - 100% (50% kích hoạt, mở khóa Thiên Phú Bậc 2 - Thiên Cấp)',
            '',
            '✨ **Tôi Luyện Linh Căn (`/linhcan toiluyen <nguyen_to>`)**:',
            '  • Tốn **50 Trung Phẩm** (hoặc **5,000 Hạ Phẩm**) Linh Thạch.',
            '  • Tăng **+1%** thuộc tính được chọn và giảm **-1%** thuộc tính lớn nhất còn lại.',
            '  • Khi thuộc tính khác giảm về **0%**, nó biến mất hoàn toàn. Đạo hữu có thể bồi đắp đến **100% Đơn Linh Căn** để nhận **x1.5 Tốc độ tu luyện**!',
            '',
            '🎲 **Tẩy Tủy Linh Căn (`/linhcan taytuy`)**:',
            '  • Tái tạo ngẫu nhiên toàn bộ linh căn (Phí: **100 Hạ Phẩm** Linh Thạch).',
            '',
            '🔥 **Thiên Phú Thiên Cấp (>= 90%):**',
            '  • **🔥 Hỏa**: Gây Hỏa Phế hiệp đầu, giảm 20% giáp kẻ địch, gấp đôi sát thương thiêu đốt.',
            '  • **💧 Thủy**: Phục hồi 20% HP tối đa và giải hoàn toàn trạng thái thiêu đốt Hỏa Phế.',
            '  • **🌿 Mộc**: Hút máu đòn đánh 40% và hồi thêm 5% HP tối đa trực tiếp.',
            '  • **🪨 Thổ**: Khiên Thổ Giáp hấp thụ 25% HP tối đa + tăng 30% Thủ khi khiên tồn tại.',
            '  • **⚡ Lôi**: Tê liệt đối thủ 1 hiệp + nhân 2x sát thương đòn đánh + tăng 20 Tốc Độ từ linh căn.',
            '  • **🌀 Phong**: Chuẩn bị Né Tránh đòn sau + cộng vĩnh viễn +10% tỷ lệ Né suốt trận.',
        ].join('\n'),
    },
    vanhanh: {
        title: '⚙️ LỆNH HỆ THỐNG & MẸO',
        color: '#34495e',
        content: [
            '**Lệnh hệ thống hữu ích:**',
            '',
            '  • `/hoso` — Xem hồ sơ chi tiết',
            '  • `/tuido` — Mở túi đồ quản lý vật phẩm',
            '  • `/nhiemvu` — Nhiệm vụ hàng ngày (4 nhiệm vụ)',
            '  • `/thanhtuu` — Thành tựu và danh hiệu',
            '  • `/bangxephang` — Bảng xếp hạng toàn server',
            '  • `/shop`, `/shopkynang` — Cửa hàng vật phẩm',
            '  • `/vanbaolau` — Sàn giao dịch player-to-player',
            '',
            '💡 **Mẹo hàng ngày:**',
            '  • Làm 4 nhiệm vụ hằng ngày để nhận KNB',
            '  • Luôn để nhân vật tu luyện nhàn rỗi (tự động tích lũy)',
            '  • Tham gia World Boss mỗi 7 phút để kiếm Ngộ Tính',
            '  • Kết bạn / kết hôn để nhận buff tu luyện',
            '  • Gia nhập Tông Môn sớm để nhận hỗ trợ',
        ].join('\n'),
    },
    he_thong: {
        title: '⚙️ HỆ THỐNG',
        color: '#9b59b6',
        content: [
            '⚙️ **Tổng Quan Hệ Thống Game:**',
            '',
            '🧘 **Tu Luyện:** Hệ thống thăng cấp chính',
            '⚔️ **Chiến Đấu:** Tỷ thí PvP và săn quái PvE',
            '⚒️ **Chế Tạo:** Tạo vật phẩm và trang bị',
            '🐉 **Linh Thú:** Thu thập và huấn luyện bạn đồng hành',
            '🔥 **Dị Hỏa:** Hệ thống hỏa lửa hiếm',
            '⚔️ **Khí Linh:** Thức tỉnh linh hồn vũ khí',
            '📜 **Tâm Pháp:** Buff thụ động',
            '🔮 **Số Mệnh:** Hệ thống trang bị số mệnh',
            '🏯 **Trấn Yêu Tháp:** Thử thách roguelike',
            '🌙 **Cảnh Mộng:** Phó bản hàng tuần',
            '☯️ **Tông Môn:** Hệ thống môn phái',
            '💕 **Đạo Lữ:** Hệ thống bạn đời',
            '🧑‍🏫 **Sư Đồ:** Hệ thống dạy dỗ',
        ].join('\n'),
    },
    tips: {
        title: '💡 MẸO CHƠI',
        color: '#f39c12',
        content: [
            '🌟 **Mẹo Thành Công:**',
            '• Đăng nhập mỗi ngày để nhận thưởng chuỗi',
            '• Gia nhập tông môn sớm để nhận thưởng EXP',
            '• Huấn luyện linh thú để tăng chỉ số chiến đấu',
            '• Hoàn thành nhiệm vụ hàng ngày để tiến bộ đều đặn',
            '• Tiết kiệm Linh Thạch cho các nâng cấp quan trọng',
            '',
            '⚔️ **Mẹo Chiến Đấu:**',
            '• Ghép ngũ hành tương khắc để nhận thưởng sát thương',
            '• Sử dụng kỹ năng chiến thuật',
            '• Luôn sửa chữa trang bị',
            '',
            '💰 **Mẹo Kinh Tế:**',
            '• Kiểm tra chợ trước khi chế tạo',
            '• Bán vật phẩm hiếm để kiếm lời',
            '• Mua rẻ, bán đắt',
        ].join('\n'),
    },
};
class HuongDanCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('huongdan')
            .setDescription('Hướng dẫn tu tiên dành cho tân thủ và tu sĩ các cấp.'));
    }
    async execute(client, interaction) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📜 HƯỚNG DẪN TU TIÊN')
            .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
            .setDescription('Chào mừng đạo hữu đến với **Hệ Thống Tu Chân**!\n\n' +
            'Dưới đây là các chủ đề hướng dẫn, hãy chọn từ menu thả xuống để xem chi tiết.\n\n' +
            '🌱 **Bắt Đầu Tu Tiên** — Tạo nhân vật, làm quen giao diện\n' +
            '⛏️ **Làm Việc & Kiếm Tài Nguyên** — Công việc hàng ngày\n' +
            '⚔️ **Chiến Đấu & PvP** — Săn quái, boss, quyết đấu\n' +
            '🛡️ **Trang Bị & Cường Hóa** — Mặc đồ, nâng sao, chế tạo\n' +
            '🪙 **Kinh Tế & Tài Nguyên** — Tiền tệ, giao dịch\n' +
            '🌟 **Nâng Cao & Đặc Biệt** — Ý cảnh, luân hồi, tông môn\n' +
            '☯️ **Ngũ Hành Linh Căn** — Tôi luyện linh căn, thiên phú chiến đấu\n' +
            '⚙️ **Hệ Thống & Mẹo** — Lệnh tiện ích, kinh nghiệm hàng ngày')
            .setFooter({ text: 'Chọn mục từ menu bên dưới để xem hướng dẫn chi tiết.' })
            .setTimestamp();
        const menu = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`huongdan_${interaction.user.id}`)
            .setPlaceholder('📖 Chọn chủ đề hướng dẫn...')
            .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌱 Bắt Đầu Tu Tiên').setValue('batdau').setDescription('Tạo nhân vật, các bước đầu tiên'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⛏️ Làm Việc & Kiếm Tài Nguyên').setValue('lamviec').setDescription('Công việc hàng ngày, thủ thuật'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚔️ Chiến Đấu & PvP').setValue('chientran').setDescription('Săn quái, boss, bí cảnh, quyết đấu'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🛡️ Trang Bị & Cường Hóa').setValue('trangbi').setDescription('Trang bị, nâng sao, chế tạo, khí linh'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🪙 Kinh Tế & Tài Nguyên').setValue('taimat').setDescription('Tiền tệ, giao dịch, linh điền'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌟 Nâng Cao & Đặc Biệt').setValue('nangcao').setDescription('Ý cảnh, luân hồi, tông môn, tọa kỵ'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('☯️ Ngũ Hành Linh Căn').setValue('linhcan').setDescription('Tôi luyện, phân phẩm và thiên phú chiến đấu'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚙️ Hệ Thống & Mẹo').setValue('vanhanh').setDescription('Lệnh tiện ích, mẹo hàng ngày')));
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], [menu]));
    }
}
exports.default = HuongDanCommand;
function getHuongDanEmbed(topic) {
    const guide = GUIDES[topic];
    if (!guide) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('📜 HƯỚNG DẪN TU TIÊN')
            .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
            .setDescription('Chủ đề không tồn tại. Vui lòng chọn từ menu bên dưới.');
    }
    return new discord_js_1.EmbedBuilder()
        .setTitle(guide.title)
        .setColor(guide.color)
        .setDescription(guide.content)
        .setFooter({ text: 'Chọn chủ đề khác từ menu bên dưới.' })
        .setTimestamp();
}
function buildHuongDanMenu(userId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`huongdan_${userId}`)
        .setPlaceholder('📖 Chọn chủ đề hướng dẫn...')
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌱 Bắt Đầu Tu Tiên').setValue('batdau').setDescription('Tạo nhân vật, các bước đầu tiên'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⛏️ Làm Việc & Kiếm Tài Nguyên').setValue('lamviec').setDescription('Công việc hàng ngày, thủ thuật'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚔️ Chiến Đấu & PvP').setValue('chientran').setDescription('Săn quái, boss, bí cảnh, quyết đấu'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🛡️ Trang Bị & Cường Hóa').setValue('trangbi').setDescription('Trang bị, nâng sao, chế tạo, khí linh'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🪙 Kinh Tế & Tài Nguyên').setValue('taimat').setDescription('Tiền tệ, giao dịch, linh điền'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌟 Nâng Cao & Đặc Biệt').setValue('nangcao').setDescription('Ý cảnh, luân hồi, tông môn, tọa kỵ'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('☯️ Ngũ Hành Linh Căn').setValue('linhcan').setDescription('Tôi luyện, phân phẩm và thiên phú chiến đấu'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚙️ Hệ Thống & Mẹo').setValue('vanhanh').setDescription('Lệnh tiện ích, mẹo hàng ngày')));
}
async function handleHuongDanSelect(interaction) {
    const topic = interaction.values[0];
    const embed = getHuongDanEmbed(topic);
    const menu = buildHuongDanMenu(interaction.user.id);
    await interaction.update((0, uiSystem_1.toV2Update)([embed], [menu]));
}
