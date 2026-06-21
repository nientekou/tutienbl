# Walkthrough V7.6 - Sư Đồ Truyền Thừa, Tâm Pháp Thần Thông & Cửu Trùng Tháp

Bản cập nhật lớn này nâng cấp toàn diện thế giới tu tiên với ba đại hệ thống mới, cùng nâng cấp hệ thống quản trị Thiên Đạo cực kỳ mạnh mẽ.

---

## 👨‍🏫 Hệ Thống Sư Đồ (Mentorship System)
Cho phép các bậc tiền bối dìu dắt tân thủ trên con đường tu tiên.
- **Điều kiện:** Sư phụ Cấp >= 50, Đệ tử Cấp 1-30. Tối đa 3 đệ tử đang học đạo cùng lúc.
- **Quyền lợi đệ tử:** Tăng **+5% EXP** khi làm việc.
- **Quyền lợi sư phụ:** Nhận **10% EXP** và **5% Linh Thạch** cống hiến từ công việc của đệ tử.
- **Mốc phần thưởng:** Khi đệ tử đạt mốc Cấp 20, Cấp 35 và Tốt nghiệp (Cấp 50).
  - Cả hai nhận Linh Thạch, KNB và đệ tử nhận Đan dược tu vi.
  - Tốt nghiệp trao tặng danh hiệu vĩnh viễn **Cao Nhân** cho Sư phụ và **Môn Đồ** cho Đệ tử.
- **Truyền Thụ Tu Vi (`/sudo truyen-thu`):** Sư phụ có thể tiêu hao tu vi bản thân và 1,000 Linh Thạch để truyền thụ từ 100 đến 2000 EXP/hiệp cho đệ tử (giới hạn tối đa 2000 EXP/tuần).

---

## 📜 Hệ Thống Tâm Pháp (Heart Law System)
Trang bị bí tịch tâm pháp để kích hoạt các thần thông thụ động (passive skills).
- **Trang bị:** Tối đa 3 cuốn Tâm Pháp cùng lúc.
- **Lĩnh ngộ & Nâng cấp:** Ghép 5 mảnh bí tịch để lĩnh ngộ. Tiêu hao mảnh ghép, Linh thạch và Ngộ tính để nâng cấp tâm pháp (tối đa Cấp 10).
- **Cộng hưởng Huyết Mạch:** Tăng **x1.5 hiệu quả** nếu hệ của Tâm Pháp trùng với hệ của Huyết Mạch (ví dụ: Hỏa Linh Quyết + Phượng Hoàng Huyết Mạch). Khác hệ sẽ bị giảm 20% hiệu quả.
- **Các hiệu ứng đã tích hợp vào Combat Engine:**
  - *Hỏa Linh Quyết (Hệ Hỏa)*: Tăng sát thương hệ Hỏa.
  - *Băng Tâm Quyết (Hệ Thủy)*: Miễn dịch trạng thái Tê Liệt (Stun).
  - *Trường Sinh Quyết (Hệ Mộc)*: Hồi phục sinh mệnh mỗi hiệp đấu.
  - *Thần Hành Quyết (Hệ Kim)*: Tăng tốc độ đánh.
  - *Phá Cấm Quyết (Vô Hệ)*: Tăng sát thương lên đối thủ có cấp độ cao hơn bản thân.

---

## 🏰 Thử Thách Cửu Trùng Tháp (Nine Heavens Tower)
Leo 9 tầng tháp thần bí với các quy tắc chiến đấu biến hóa:
- **Luật Tầng Tháp Đặc Biệt:**
  - *Tầng 2 (Cấm Trang Bị)*: Đấu naked mode, chỉ sử dụng chỉ số gốc và ý cảnh.
  - *Tầng 5 (Phản Thương)*: Quái vật có nội tại phản sát thương.
  - *Tầng 8 (Sinh Tồn)*: Người chơi phải tử thủ sống sót qua 10 hiệp đấu trước sức mạnh cuồng bạo của quái vật.
- **Vượt tầng:** Vượt tháp thành công nhận buff chỉ số thuộc tính vĩnh viễn cộng trực tiếp vào nhân vật.
- **Giới hạn:** Tối đa 3 lượt khiếu chiến miễn phí mỗi tuần.

---

## ⚙️ Thiên Đạo Admin Panel (Bảng Điều Khiển Quản Trị)
Trung tâm quản trị toàn diện dành cho Thiên Đạo Chủ (Bot Owner):
- **Giao diện nút bấm trực quan:** Gọi nhanh qua `/admin panel`.
- **Chức năng hệ thống:**
  - Bật/Tắt chế độ bảo trì đại trận.
  - Gọi Lữ Khách Thần Bí hoặc World Boss.
  - **Nhân Đôi EXP (Double EXP):** Kích hoạt sự kiện toàn server ngay trên panel.
  - Reset giới hạn tuần của người chơi và dọn dẹp log DB.
- **Chức năng Quản lý Tu sĩ:**
  - Tra cứu hồ sơ tu sĩ chi tiết.
  - Phát vật phẩm, Linh thạch.
  - Thiết lập cấp độ trực tiếp hoặc điều chỉnh Linh Căn.

---

## 🧪 Xác Minh & Kiểm Thử
- **Automated Tests:** Kịch bản kiểm thử tự động toàn bộ tính năng mới (Mentorship, Heart Law, Nine Heavens, Admin Panel, Double EXP và Cultivation Transmission) đã được tích hợp thành công vào [tests/run_tests.ts](file:///c:/Users/mcdro\Documents\GitHub\tutienbl/tests/run_tests.ts).
- **Kết quả:** Kiểm thử tự động chạy thành công 100% (`All tests passed successfully! 🎉`).
- **Compiler:** Quá trình build dự án qua `npm run build` hoàn toàn không có lỗi biên dịch.
