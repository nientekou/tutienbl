# Lộ Trình Phát Triển: Vạn Thế Tu Tiên - Ideas & Cân Bằng Tổng Thể

---

## 🌟 Đại Hệ Thống Mới (Major New Systems)

- [ ] **Cẩm Nang Tiên Lộ (`/camnang`)**
  - [ ] Lệnh toàn thư 3 chương: Phàm Nhân Hướng Đạo, Pháp Bảo Thần Thông, Kiếp Số Nhân Quả.
  - [ ] Tích hợp lore tiên hiệp vào phản hồi `/taonhanvat`, `/hoso`, `/dotpha`.

- [ ] **Hệ Thống Tiêu Thụ Mana / Nội Lực (MP System)**
  - [ ] Thêm cột `mp` và `max_mp` vào bảng `users`. MP hồi theo thời gian (1 MP/30 giây).
  - [ ] Kỹ năng chiến đấu tiêu hao MP thay vì dùng Thể Lực; Thể Lực chỉ dùng cho hành động ngoài chiến đấu.
  - [ ] Bội Phẩm slot mới buff MP tối đa và tốc độ hồi MP.

- [ ] **Hệ Thống Thế Giới Mở - Bản Đồ Bí Ẩn (`/khamphabando`)**
  - [ ] Người chơi thu thập mảnh bản đồ ngẫu nhiên qua `/lamviec` (công việc Phiêu Lưu).
  - [ ] Ghép đủ 5 mảnh → mở khóa địa điểm ẩn chứa kho báu độc nhất (xuất hiện 1 lần).
  - [ ] Địa điểm có thể bị người chơi khác "cướp" nếu phát hiện trong 24h.

- [ ] **Hệ Thống Liên Minh Tông Môn (Guild Alliance)**
  - [ ] 2-3 Tông Môn có thể kết liên minh: chia sẻ Feast buff, phối hợp đánh Boss Server.
  - [ ] Tông Chủ liên minh có thể tuyên chiến với liên minh khác (Guild War tuần 1 lần).
  - [ ] Bảng xếp hạng Tông Môn cộng điểm từ Boss kills, Arena wins, và sản lượng Linh Thạch.

---

## ⚡ Nâng Cấp Hệ Thống Thể Lực (Stamina Overhaul)

- [x] ~~Điều chỉnh Thể Lực tối đa từ 340 lên 500~~ ✅
- [x] ~~Hồi 1 Thể Lực mỗi 60 giây~~ ✅
- [x] ~~Tông Môn Yến Tiệc (`/yentiec`) +100 Thể Lực lúc 12h và 18h~~ ✅

- [ ] **Đan Dược Hồi Thể Lực (Stamina Recovery Pills)**
  - [ ] Công thức luyện Hồi Thể Đan từ nguyên liệu `/haithuoc`: Sơ cấp +50, Trung cấp +100, Cao cấp +200.
  - [ ] Có thể mua Hồi Thể Đan sơ cấp ở shop với giá hợp lý.

- [ ] **Thể Lực Mở Rộng (Stamina Bonus)**
  - [ ] Linh Mạch cấp cao trong Động Phủ cho phép nâng Thể Lực tối đa vượt 500 (lên đến 700).
  - [ ] Danh hiệu đặc biệt "Thể Chất Kim Cương" buff +50 Thể Lực tối đa vĩnh viễn.

---

## ⚔️ Cân Bằng Chiến Đấu (Combat Balance)

- [x] ~~Ngũ Hành Trận Pháp +10% Công/Thủ khi đội tương sinh~~ ✅
- [x] ~~Giới hạn chênh lệch 15 cấp khi quyết đấu~~ ✅
- [x] ~~Hộ Giới Bài (Shield after 5 consecutive losses)~~ ✅
- [x] ~~Season Reset Arena 2 tuần/mùa~~ ✅
- [x] ~~Thánh Địa Cấm Khu (Level 50+ Elite Dungeon, 24h CD)~~ ✅

- [ ] **Cân Bằng Cửu Trùng Tháp**
  - [ ] Boss tầng 5 và tầng 9 có cơ chế đặc biệt (bộc phát liên chiêu, hồi máu định kỳ).
  - [ ] Tầng 9 khi phá: nhận danh hiệu **Thiên Trụ** và buff vĩnh viễn đặc biệt.
  - [ ] Cải tiến hiển thị log chiến đấu tháp thành gọn, có highlight bão kích và kỹ năng.

- [ ] **Hệ Thống Liên Server PvP (Cross-Server Arena)**
  - [ ] Mỗi tháng tổ chức 1 giải đấu đặc biệt, top 3 nhận danh hiệu độc quyền.
  - [ ] Tích điểm cúp đấu arena cộng dồn qua các mùa.

- [ ] **Cơ Chế Phản Đòn & Phòng Thủ**
  - [ ] Thêm chỉ số `block_chance` (5-15%): Có xác suất chặn hoàn toàn 1 đòn đánh thường.
  - [ ] Kỹ năng "Thái Ất Hộ Giới" cấp 5+: Khi HP < 20%, tự động kích hoạt 1 lớp khiên.

---

## 🧪 Vật Phẩm & Item Mới

- [ ] **Đan Dược Ngũ Hành Hộ Mệnh**
  - [ ] 5 loại đan: Hỏa Linh Đan, Thủy Nguyên Đan, Mộc Linh Hoàn, Kim Cương Đan, Địa Thổ Đan.
  - [ ] Mỗi loại giảm 20~40% sát thương thiên kiếp tương sinh.

- [ ] **Cải Tiến Hệ Thống Luyện Đan**
  - [ ] Thêm 3 đan mới: **Huyết Nguyên Đan** (+500 HP max vĩnh viễn), **Hư Không Đan** (hồi 50% MP), **Thiên Phong Đan** (+15% tốc độ 30 phút).
  - [ ] **Tẩy Tủy Đan**: Reset ngẫu nhiên lại thuộc tính Linh Căn.
  - [ ] Tích hợp Hỏa Linh Căn vào `AlchemyService.ts`: mỗi điểm Hỏa +0.1% thành công.
  - [ ] Phòng luyện đan cấp Linh Sư: Luyện 2 đan cùng lúc.

- [ ] **Vật Phẩm Đặc Biệt**
  - [ ] **Cơ Duyên Đơn**: +10% Vận May trong 1h để thám hiểm tìm nguyên liệu hiếm.
  - [ ] **Phong Ấn Thư**: Khóa 1 chỉ số cụ thể khi dùng Tẩy Tủy Đan (không bị reset).
  - [ ] **Huyền Thiên Bảo Giám**: Kính hiển thị đầy đủ chỉ số ẩn của trang bị đối thủ trong PvP.

- [ ] **Vật Phẩm Farming Mới (`linhdien`)**
  - [ ] 3 loại hạt giống: **Huyết Hoa Tử**, **Hư Không Thảo**, **Thiên Phong Diệp**.
  - [ ] Cải tiến countdown thu hoạch hiển thị đẹp hơn.

- [ ] **Trang Bị & Pháp Bảo Mới**
  - [ ] Slot **Nhẫn Pháp** (Spiritual Ring): Buff Crit/Crit Res.
  - [ ] Slot **Bội Phẩm** (Pendant): Buff MP và tốc độ hồi nội lực.
  - [ ] 5 pháp bảo huyền thoại từ Thánh Địa Cấm Khu.

---

## 🐾 Sủng Vật & Linh Thú

- [x] ~~Tiến Hóa 10% khi cấp 50~~ ✅
- [x] ~~Kỹ Năng Bị Động mở lúc cấp 30~~ ✅
- [x] ~~Linh thú nhận 20% EXP săn yêu thú~~ ✅

- [ ] **Sủng Vật Huyền Thoại Mới**
  - [ ] **Kỳ Lân Bạch Ngọc**: Buff +15% hồi máu, kỹ năng Tịnh Hóa (xóa 1 debuff).
  - [ ] **Côn Bằng Tiên Thú**: Buff +20% HP tối đa, gây AoE và hút MP đối thủ.
  - [ ] **Thao Thiết**: +10% giảm sát thương nhận vào, phong tỏa Tâm Pháp đối phương 2 hiệp.
  - [ ] **Hắc Long Tử** (Sử Thi): +20% Công Kích khi HP < 30%, kỹ năng Long Hút.
  - [ ] **Phượng Hoàng Lửa** (Sử Thi): Miễn dịch Ngộ Độc, Tái Sinh 1 lần/trận.
  - [ ] **Cửu Thiên Huyền Điểu** (Hiếm): +8% tốc độ đánh và né tránh.
  - [ ] **Thiên Hồ Cửu Vĩ** (Hiếm): +10% né tránh, gây mê 1 hiệp.

- [ ] **Hệ Thống Sủng Vật Cải Tiến**
  - [ ] UI `/sungthu` hiển thị thanh EXP tiến độ cấp, combat stats và kỹ năng đẹp hơn.
  - [ ] Sủng vật level 70+ có thể học thêm kỹ năng thứ 2 qua `/sungthu hocky`.
  - [ ] Cho phép đổi tên sủng vật với chi phí Linh Thạch nhỏ.

---

## 💕 Hệ Thống Đạo Lữ & Xã Hội

- [x] ~~Kỷ niệm 100/200/500 ngày Đạo Lữ: thưởng LT + KNB + danh hiệu~~ ✅
- [x] ~~`/sudo chi-duong`: Sư phụ tặng vật phẩm ngẫu nhiên cho đệ tử (1 lần/ngày)~~ ✅
- [x] ~~Danh hiệu "Truyền Thừa Danh Môn" khi đào tạo ≥3 đệ tử tốt nghiệp~~ ✅

- [ ] **Thông Báo Server Tự Động**
  - [ ] Broadcast khi 2 đạo hữu kết hôn (#thông-báo kênh chung).
  - [ ] Broadcast khi cặp đôi đạt mốc 100/200/500 ngày.
  - [ ] Broadcast khi đệ tử tốt nghiệp Sư Đồ.

- [ ] **Cơ Chế Phục Thù Sư Môn (Sect Revenge)**
  - [ ] Khi 1 thành viên Tông Môn bị đánh bại trong PvP, các thành viên cùng Tông Môn nhận thông báo và có thể thách đấu kẻ thù trong 24h mà không tốn Thể Lực.

- [ ] **Hệ Thống Kết Nghĩa (Brotherhood)**
  - [ ] 2 tu sĩ kết nghĩa anh em: chia sẻ 5% EXP nhận được (không trùng với Sư Đồ).
  - [ ] Kết nghĩa tổ đội cùng nhau sẽ được buff thêm +3% Công Kích.

- [ ] **Hệ Thống Tỉ Thí Nội Bộ Tông Môn**
  - [ ] Tông Chủ có thể mở lệnh tỉ thí nội bộ: thành viên đấu nhau, không mất điểm Arena, thắng nhận thêm Tông Môn Điểm.

---

## 🏆 Thành Tựu & Danh Hiệu Mới

- [ ] **Thêm 20+ Thành Tựu Mới**
  - [ ] *Linh Đan Sư*: Luyện đan thành công 100 lần.
  - [ ] *Chiến Thần Vô Song*: Thắng 50 trận PvP liên tiếp.
  - [ ] *Kẻ Săn Thú*: Bắt thành công 20 sủng vật hiếm trở lên.
  - [ ] *Thương Gia Vạn Kim*: Bán hàng trên Vạn Bảo Lâu tổng cộng 1,000,000 Linh Thạch.
  - [ ] *Tiên Canh Nông*: Thu hoạch thảo dược 50 lần.
  - [ ] *Thiên Mệnh Chi Tử*: Sở hữu Huyết Mạch huyền thoại.
  - [ ] *Bá Chủ Vạn Thế*: Giữ vị trí #1 Arena trong 3 mùa liên tiếp.
  - [ ] *Trưởng Lão Minh Triết*: Đào tạo thành công 5+ đệ tử tốt nghiệp.

- [ ] **Danh Hiệu Có Buff Chỉ Số**
  - [ ] Hệ thống danh hiệu cộng stats khi trang bị (*Thánh Địa Bá Chủ* +5% ATK, *Truyền Thừa Danh Môn* +5% DEF).
  - [ ] UI lựa chọn và trang bị danh hiệu trong `/hoso`.

---

## 📊 Cân Bằng & Chất Lượng (Balance & QoL)

- [ ] **Cân Bằng Kinh Tế**
  - [ ] Điều chỉnh giá bán tối thiểu Vạn Bảo Lâu theo cảnh giới người bán.
  - [ ] Phí giao dịch 2% trên chợ để kiểm soát lạm phát Linh Thạch.
  - [ ] Giới hạn số lượng item có thể bán/ngày trên chợ (chống spam).

- [ ] **Cân Bằng Tu Luyện**
  - [ ] **Hệ số giảm EXP** khi lên cao cấp (cấp 100+ nhận ít EXP hơn từ nguồn thấp cấp).
  - [ ] Thiền định > 6h giảm hiệu suất xuống 50% để tránh AFK farm.
  - [ ] **Bế Quan Đột Phá**: Dùng tài nguyên để đảm bảo đột phá thành công 100%.

- [ ] **Cải Tiến Làm Việc (`/lamviec`)**
  - [ ] 3 loại công việc mới: *Khảo Cổ* (nguyên liệu hiếm), *Phiêu Lưu Bản Đồ* (mảnh bản đồ kho báu), *Hộ Tiêu* (Linh Thạch nhiều nhưng rủi ro bị cướp).
  - [ ] Kết quả bị ảnh hưởng bởi chỉ số Vận May.

- [ ] **Cải Tiến Thám Hiểm (`/khampha`)**
  - [ ] Sự kiện ngẫu nhiên: Gặp NPC bí ẩn, tàn tích cổ đại, kích hoạt hồn ma huyết mạch.
  - [ ] UI thanh tiến trình và hình ảnh địa điểm.

- [ ] **Cải Tiến Nhiệm Vụ (`/nhiemvu`)**
  - [ ] **Nhiệm Vụ Chuỗi** (Quest Chain): Hoàn thành A mở B, kết thúc chuỗi nhận thưởng lớn.
  - [ ] **Nhiệm Vụ Cộng Đồng**: Cả server cùng tiêu diệt X quái, thưởng chia đều.

- [ ] **Hệ Thống Notificaton Thông Minh**
  - [ ] DM người chơi khi: Linh Điền chín, Linh Mạch đầy 24h, Arena Season kết thúc, Đệ tử đến mốc cấp quan trọng.
  - [ ] Cài đặt opt-in/opt-out thông báo qua `/setting thongbao`.

- [ ] **Dashboard Tông Môn**
  - [ ] Lệnh `/tongmon thongke` hiển thị biểu đồ đóng góp thành viên (EXP tích lũy, Linh Thạch, Boss kills).
  - [ ] Top 3 thành viên đóng góp nhiều nhất mỗi tuần nhận bonus.

---

## 🔧 Kỹ Thuật & Kiểm Thử

- [ ] Bổ sung kịch bản kiểm thử cho từng tính năng mới trong `tests/run_tests.ts`.
- [ ] Chạy `npm run build` thành công không lỗi.
- [ ] Migrate `CoupleService.ts` để check anniversary milestone cũng khi `/daolu thongtin` được gọi (không chỉ khi song tu).
- [ ] Refactor `getActiveStats` để cache kết quả trong 30 giây tránh tính lại nhiều lần/request.
