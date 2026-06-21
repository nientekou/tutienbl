# Kế Hoạch Triển Khai: Vạn Thế Tu Tiên — Giai Đoạn 2

Giai đoạn 2 tập trung mở rộng chiều sâu gameplay: thêm hệ thống MP/Nội Lực, bản đồ bí ẩn thế giới mở, liên minh tông môn, cơ chế phòng thủ mới, và nâng cao chất lượng thông báo/UI để giữ chân người chơi dài hạn.

---

## Các Hệ Thống Đã Hoàn Thành (Giai Đoạn 1)

> [!NOTE]
> Các mục dưới đây đã được implement đầy đủ và có thể dùng làm tham chiếu:
> - ✅ **Stamina Overhaul**: Tăng cap 500, hồi 1/60s, `/yentiec` Feast +100 Thể Lực
> - ✅ **Arena Season System**: 2 tuần/mùa, Hộ Giới Bài (shield after 5 losses), 15 cấp PvP cap
> - ✅ **Elite Dungeon "Thánh Địa Cấm Khu"**: Level 50+, 24h cooldown, legendary loot
> - ✅ **Pet System**: 20% EXP share, passive skill lv30, 10% epic evolution lv50, lai tạo, thôn phệ
> - ✅ **Ngũ Hành Trận Pháp**: +10% ATK/DEF cho đội có chu trình tương sinh
> - ✅ **Bản Mệnh Pháp Bảo**: Huyết Tế liên kết, EXP từ chiến đấu, hoán đổi bằng Huyết Tế Ma Bảng
> - ✅ **Động Phủ**: Linh Tuyền, Linh Mạch (+LT/giờ), Hộ Pháp Trận
> - ✅ **Couple Milestones**: 100/200/500 ngày → LT + KNB + danh hiệu + Luyện Khí Đan
> - ✅ **`/sudo chi-duong`**: Sư phụ tặng vật phẩm ngẫu nhiên cho đệ tử (1 lần/ngày)
> - ✅ **Danh hiệu "Truyền Thừa Danh Môn"**: Auto-grant khi ≥3 đệ tử tốt nghiệp

---

## Proposed Changes — Giai Đoạn 2

---

### [Component: Hệ Thống MP / Nội Lực]

#### [MODIFY] database.ts + UserRepository.ts
- Thêm cột `mp INTEGER DEFAULT 0` và `max_mp INTEGER DEFAULT 100` vào bảng `users`.
- Hồi MP tự động 1 điểm/30 giây trong hàm `get()` (tương tự stamina).
- Công thức max_mp: `100 + level * 5 + bonus từ Bội Phẩm slot`.

#### [MODIFY] CombatEngine.ts
- Kỹ năng chiến đấu cấp 3+ tiêu hao MP thay vì chỉ có hiệu ứng passive.
- Nếu MP = 0, kỹ năng bị disable trong vòng đó.
- Thêm mechanic "Phá Nguyên Hành" khi cạn MP: chấp nhận mất 10% HP để hồi 30 MP.

#### [NEW] slot "Bội Phẩm" trong InventoryService.ts
- Slot trang bị mới: buff `max_mp`, tốc độ hồi MP, và có thể cộng thêm MP khi đánh trúng.

---

### [Component: Bản Đồ Bí Ẩn & Kho Báu Thế Giới]

#### [NEW] MapFragmentService.ts
- Người chơi nhận `map_fragment` ngẫu nhiên qua `/lamviec` kiểu Phiêu Lưu Bản Đồ.
- Ghép đủ 5 mảnh → tạo ra `TreasureLocation` với tọa độ và thời hạn 24h.
- `TreasureLocation` lưu trong DB; người chơi khác có thể "cướp" bằng cách tấn công vị trí.

#### [NEW] `/khamphabando` command
- Hiển thị bản đồ văn bản ASCII đơn giản hoặc embed với các ô địa điểm.
- Lệnh `khampha-di` để đi đến địa điểm và nhận phần thưởng nếu chưa bị cướp.

---

### [Component: Liên Minh Tông Môn (Guild Alliance)]

#### [MODIFY] SectService.ts
- Thêm bảng `sect_alliances`: `sect_id_1`, `sect_id_2`, `formed_at`, `status`.
- `formAlliance(sectId1, sectId2)`: Tông Chủ gửi lời mời, bên kia chấp thuận.
- `breakAlliance(sectId)`: Hủy liên minh, cooldown 7 ngày trước khi kết liên minh mới.

#### [NEW] `/tongmon lienminh` command
- Subcommand: `moilienminh`, `chapnhan`, `huy`, `danhsach`.
- Liên minh chia sẻ Feast buff và cộng điểm xếp hạng Tông Môn server.

#### [NEW] Guild War System
- Tông Chủ tuyên chiến → mở cửa sổ PvP 2h: thành viên 2 tông đấu nhau, không mất điểm Arena.
- Tông thắng nhận Tông Môn Điểm x2 trong 3 ngày.

---

### [Component: Cơ Chế Phòng Thủ Mới]

#### [MODIFY] CombatEngine.ts
- Thêm chỉ số `block_chance` (float 0-0.15): cơ hội chặn hoàn toàn 1 đòn thường.
- Trang bị Khiên/Giáp Trọng có thể cộng `block_chance`.
- Kỹ năng "Thái Ất Hộ Giới" cấp 5+: khi HP < 20%, tự kích hoạt 1 lớp khiên hấp thụ 30% max HP.

#### [MODIFY] InventoryService.ts (getActiveStats)
- Tích hợp `block_chance` từ trang bị vào `ActiveStats`.
- Cache `ActiveStats` trong 30 giây để tránh tính lại nhiều lần/request (dùng Map với timestamp).

---

### [Component: Hệ Thống Kết Nghĩa (Brotherhood)]

#### [NEW] BrotherhoodService.ts
- Bảng `brotherhoods`: `user1_id`, `user2_id`, `formed_at`.
- Lệnh `/ketnghia @user`: gửi lời mời, bên kia xác nhận.
- Khi kết nghĩa: chia sẻ 5% EXP nhận được (stacks với Sư Đồ nhưng giới hạn tổng ≤ 30%).
- Khi cùng party đánh Boss: +3% ATK.

---

### [Component: Notification System]

#### [NEW] NotificationService.ts
- Hệ thống DM tự động khi:
  - Linh Điền (linhdien) chín đến 100%.
  - Linh Mạch Động Phủ đầy 24h.
  - Arena Season kết thúc (kết quả + thưởng).
  - Đệ tử đạt mốc cấp 25/40/50.
  - Đạo Lữ đến gần mốc kỷ niệm (99 ngày → thông báo trước).
- Người chơi opt-in/out qua `/setting thongbao [on|off]`.

---

### [Component: Cải Tiến Tông Môn Dashboard]

#### [NEW] `/tongmon thongke` command
- Hiển thị embed thống kê tuần: Top 3 thành viên đóng góp EXP/LT/Boss kills.
- Biểu đồ văn bản đơn giản (bar chart ASCII) cho top 5 thành viên.
- Top 3 nhận bonus Tông Môn Điểm vào cuối tuần.

---

### [Component: Cải Tiến Làm Việc & Thám Hiểm]

#### [MODIFY] WorkService.ts / lamviec command
- Thêm công việc **Phiêu Lưu Bản Đồ**: tiêu 20 Thể Lực, cơ hội nhận `map_fragment`.
- Thêm công việc **Hộ Tiêu**: tiêu 15 Thể Lực, phần thưởng LT cao nhưng có 10% bị NPC cướp mất 20% thu nhập.
- Thêm công việc **Khảo Cổ**: tiêu 25 Thể Lực, ra nguyên liệu hiếm không thể mua ở shop.

#### [MODIFY] `/khampha` command
- Gặp NPC bí ẩn: mini-dialog chọn lựa, quyết định loại phần thưởng.
- Tìm tàn tích: mini puzzle đơn giản, giải đúng nhận loot đặc biệt.

---

## Verification Plan

### Automated Tests
- Test `BrotherhoodService`: chia EXP 5%, không vượt 30% tổng cộng với Sư Đồ.
- Test `MapFragmentService`: ghép 5 mảnh → tạo location, hết 24h → tự hết hạn.
- Test `block_chance` trong `CombatEngine`: xác suất chặn đòn trong dải [0, block_chance].
- Test `NotificationService`: đúng trigger điều kiện, không gửi spam DM.

### Manual Verification
- Chạy `npm run build` không lỗi.
- Test thực tế `/lamviec` với công việc mới, kiểm tra Thể Lực tiêu hao đúng.
- Kiểm tra MP hồi tự động sau 30 giây trong gameplay thực tế.
