# Tu Tiên RPG 🔮 - Discord Xianxia Bot

Một dự án bot Discord nhập vai chủ đề Tu Tiên (Xianxia/Cultivation) hoàn chỉnh, được phát triển bằng **TypeScript**, **Discord.js v14**, và **SQLite (better-sqlite3)**. Người chơi sẽ bước vào con đường tầm đạo, tu luyện nhàn rỗi, vượt ải bí cảnh, rèn trang bị, lập tông môn, kết duyên đạo lữ và tranh đoạt thần binh.

Đặc biệt, giao diện bot được thiết kế và tối ưu hoàn toàn dựa trên **Discord Components V2** (mới nhất), mang lại trải nghiệm mượt mà, trực quan và hiện đại giống như một ứng dụng Native ngay trên Discord.

---

## 🌌 Các Điểm Nổi Bật (Key Highlights)

*   **Discord Components V2**: Giao diện nâng cấp chuyên sâu sử dụng Containers, Text Displays, Separator lines,... tối ưu hóa hiển thị, tránh giới hạn ký tự cũ và tăng độ tương tác.
*   **Hệ Thống Tu Luyện Nhàn Rỗi (Idle Cultivation)**: Tự động hấp thu linh khí thiên địa theo thời gian thực (ngay cả khi offline).
*   **Ngũ Hành Tương Khắc**: Hệ thống Kim - Mộc - Thủy - Hỏa - Thổ tương tác trực tiếp trong chiến đấu, tăng 25% sát thương và giảm 20% thủ của hệ bị khắc.
*   **Cơ Chế Tránh Race Condition**: Tích hợp `InteractionLock` chặn spam nút bấm và các hành động trùng lặp bảo vệ tính toàn vẹn của cơ sở dữ liệu.
*   **SQLite WAL Mode**: Bật chế độ ghi trước nhật ký (Write-Ahead Logging) giúp tối ưu hóa hiệu năng đọc/ghi đồng thời của bot.

---

## 🛠️ Tính Năng Chính (Core Features)

1.  **Tu Luyện & Đột Phá**
    *   Thiền định thu hoạch tu vi. Đột phá cảnh giới vượt qua Lôi Kiếp.
    *   Tẩy tủy linh căn nâng cao độ thuần khiết ngũ hành.
2.  **Chiến Đấu & Vượt Ải (PvE & PvP)**
    *   **Bí Cảnh (Dungeons)**: Khiêu chiến quái vật cổ xưa thu thập trang bị và nguyên liệu chế tạo.
    *   **Tháp Vô Hạn (Infinity Tower)**: Leo tháp tranh hạng mùa giải với cơ chế rogue-lite chọn thẻ chúc phúc (Buff Draft).
    *   **Đấu Trường (Arena)**: Khiêu chiến PVP thời gian thực tính điểm ELO Phong Thần Bảng.
    *   **World Boss**: Hợp lực cùng toàn bộ tu sĩ trên server tiêu diệt Đại Yêu Thú nhận linh thạch.
3.  **Tiên Nghề (Lifeskills & Abode)**
    *   **Luyện Đan**: Kết hợp linh thảo, điều khiển nhiệt độ lò đan để đúc Thần Đan Thượng Cổ.
    *   **Luyện Khí & Cường Hóa**: Rèn đúc phôi, nâng cấp trang bị lên +15, khảm nạm ngũ hành linh thạch gia tăng thuộc tính.
    *   **Linh Điền**: Khai khẩn đất đai, gieo hạt, tưới nước linh dược và phái sủng thú canh vườn chống trộm.
    *   **Động Phủ**: Nâng cấp linh tuyền, mở rộng linh mạch gia tốc tu luyện nhàn rỗi.
4.  **Hệ Thống Xã Hội & Bang Phái**
    *   **Tông Môn (Sect)**: Thành lập/gia nhập tông môn, cống hiến đổi ngoại trang, thăng cấp kỹ năng tông môn, bang chiến tranh đoạt linh địa và nuôi dưỡng Trấn Tông Thần Thú.
    *   **Đạo Lữ (Partners)**: Kết đôi cầu hôn, nâng cao thân mật và khiêu chiến phó bản song tu đạo lữ.
    *   **Sư Đồ (Mentorship)**: Bái sư hoặc thu nhận đệ tử truyền thừa tu vi, nâng cao ngộ tính.
    *   **Vạn Bảo Lâu (Market)**: Sàn giao dịch đấu giá tự do giữa người chơi với nhau.

---

## 🚀 Hướng Dẫn Cài Đặt (Installation & Setup)

### Yêu Cầu Hệ Thống (Prerequisites)
*   **Node.js**: Phiên bản `^20.19` hoặc `>=22.12` (Vitest yêu cầu để tránh lỗi native bindings).
*   **npm** hoặc **yarn**.
*   Một **Discord Bot Token** và **Client ID** (tạo tại [Discord Developer Portal](https://discord.com/developers/applications)).

### 1. Tải Mã Nguồn
```bash
git clone https://github.com/yourusername/tutienbl.git
cd tutienbl
```

### 2. Cài Đặt Thư Viện
```bash
npm install
```

### 3. Cấu Hình Môi Trường
Tạo một file `.env` ở thư mục gốc của dự án và điền thông tin sau:
```env
DISCORD_TOKEN=token_bot_discord_cua_ban
CLIENT_ID=id_bot_client_cua_ban
DATABASE_PATH=data/tutien.db
```

### 4. Đăng Ký Lệnh Slash Command
Đăng ký các lệnh slash command (/) của bot lên Discord API toàn cầu:
```bash
npx ts-node src/deploy.ts
```
*(Lưu ý: Bot cũng sẽ tự động deploy lại lệnh trên sự kiện `ready` của bot khi phát hiện thay đổi).*

### 5. Biên Dịch & Khởi Chạy
**Chạy môi trường phát triển (Hot reload / ts-node):**
```bash
npm run dev
```

**Biên dịch sang Javascript và chạy production:**
```bash
npm run build
npm run start
```

---

## 🎮 Hướng Dẫn Các Lệnh Chính (Command Directory)

Dưới đây là các lệnh Slash Command `/` người chơi có thể sử dụng:

| Lệnh | Mô tả |
| :--- | :--- |
| `/hoso` | Xem hồ sơ tu sĩ, lực chiến, tiên lực, đạo thống và cảnh giới |
| `/trangbi` | Mặc/Tháo và quản lý trang bị hộ thân, pháp bảo |
| `/lamviec` | Làm việc (đào khoáng, hái thuốc, chặt củi) tích lũy linh tài |
| `/linhdien` | Quản lý ruộng dược, gieo hạt giống, chăm sóc và thu hoạch linh dược |
| `/dongphu` | Quản lý Động Phủ tiên gia, thăng cấp linh mạch và sủng thú canh giữ |
| `/tongmon` | Bái sư gia nhập Tông Môn, cống hiến linh thạch, học kỹ năng bang |
| `/leothap` | Leo Trấn Yêu Tháp vô hạn vượt ải kiếm linh thạch, ngọc và danh hiệu |
| `/nhiemvu` | Quản lý nhiệm vụ hằng ngày, nhiệm vụ tuần và chuỗi nhiệm vụ chính tuyến |
| `/shop` | Mua sắm dược phẩm hồi phục, rương đạo cụ và linh thảo hạt giống |
| `/kynang` / `/tamphap` | Quản lý võ học kỹ năng chủ động, tâm pháp bị động và ý cảnh đại đạo |
| `/linhcan` | Xem thông tin căn cơ linh căn ngũ hành, đột phá linh căn |
| `/arena` | Gia nhập đấu trường khiêu chiến xếp hạng ELO toàn server |
| `/bicanh` | Chinh phạt các phó bản cổ đại nguy hiểm kiếm trang bị phẩm cao |
| `/worldboss` | Tham gia lập tổ đội diệt Boss Thế Giới nhận tài nguyên cực phẩm |
| `/chetao` | Chế tác chế tạo phôi trang bị vũ khí, đạo bào |
| `/luyendan` | Dung hợp dược liệu luyện đan dược tăng mạnh chỉ số |
| `/trade` | Giao dịch trao đổi tài sản trực tiếp an toàn giữa 2 tu sĩ |
| `/vanbaolau` | Ghé thăm chợ tự do Vạn Bảo Lâu mua bán vật phẩm tự chọn |
| `/daolu` | Cầu hôn đạo lữ hoặc vào phó bản đạo lữ tích lũy thân mật |
| `/sudo` | Quản lý hệ thống sư đồ nhận đệ tử bái sư phụ nhận Ngộ Tính |

---

## 🏷️ Từ Khóa (Keywords)
`discord-bot` `rpg-bot` `xianxia` `cultivation` `tu-tien` `typescript` `discord-js` `sqlite` `idle-game` `gaming-bot` `vietnamese-bot` `better-sqlite3` `discord-components-v2`
