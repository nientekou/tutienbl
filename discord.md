# 📋 Update Notes — Ngày 24/06/2026

## 🔧 Sửa lỗi hệ thống

### Fix lỗi nút bấm / tương tác không hoạt động (nặng)

Một lỗi nền tảng trong discord.js khiến **gần như tất cả các nút bấm và menu thả xuống bị lỗi** ở một mức độ nào đó. Nguyên nhân:discord.js tự động chèn thêm trường `content` hoặc `embeds` vào payload khi gửi yêu cầu — nhưng Discord API lại từ chối khi tin nhắn đang ở chế độ V2 (ComponentsV2).

**Đã fix:** Chuyển toàn bộ hệ thống tương tác sang gọi trực tiếp Discord REST API, bypass hoàn toàn lỗi này. Tổng cộng **~130+ vị trí** trong code đã được cập nhật.

Các tính năng bị ảnh hưởng đã fix:
- **Luyện Đan** — nút chọn công thức, nút chế tác
- **Cường Hóa trang bị** — nút chọn, xác nhận, đóng giao diện
- **Linh Mạch Địa Đồ** — dropdown chọn kênh
- **Lĩnh Ngộ Kỹ Năng** — nút đóng giao diện
- **Bảng Phong Thần** — nút làm mới, dropdown chọn danh mục
- **Quyết Đấu (Tam Hồi Linh Chiến)** — chấp nhận, từ chối, chọn chiêu
- **Hồ Sơ** — tất cả tab (hành trang, sủng thú, tọa kỵ, luyện đan, luyện khí...)
- **Chợ** — mua, bán, tìm kiếm
- **Luyện Khí** — cập nhật thể lực
- **Tôn Môn** — quy đổi, quản lý tông môn
- **Phòng Tổ Đội Bí Cảnh** — tạo, giải tán, tham gia
- **Cầu Hôn / Kỳ Ngộ** — tất cả tương tác

### Fix Lữ Khách Thần Bí không xuất hiện

Lữ khách giờ xuất hiện thường xuyên hơn và đáng tin cậy hơn:
- Tần suất kiểm tra spawn: **60 phút → 30 phút**
- Tỷ lệ spawn cơ bản: **2% → 10%** (mỗi tương tác tăng thêm 2%, trước đây chỉ 1%)
- Bot tự động kiểm tra spawn ngay khi khởi động (không phải đợi 1 tiếng nữa)
- Điểm hoạt động bị giảm ít hơn theo thời gian (giữ được lâu hơn)

**Fix thêm:** Nút mua hàng từ Lữ Khách giờ hoạt động đúng — trước đó tin nhắn kho hàng không cập nhật sau khi mua (lỗi định dạng tin nhắn).

### Fix nút Làm Mới trong /worldboss

Nút "Làm Mới" trong giao diện Boss Thế Giới bị lỗi vì tin nhắn gốc gửi ở định dạng legacy nhưng nút cập nhật gửi ở định dạng V2 — Discord từ chối. **Đã fix** bằng cách đồng nhất định dạng V2 cho cả tin nhắn gốc lẫn cập nhật.

---

## ⚖️ Cân bằng lại phần thưởng Boss Thế Giới

Mục tiêu: **giảm khoảng cách giữa người chơi mạnh và người mới**, giữ cho top vẫn hơn nhưng không "bỏ xa" đến mức không đuổi kịp.

### Thưởng cơ bản tăng

| | Trước | Sau |
|---|---|---|
| Kinh nghiệm cơ bản | 600 × cấp boss | **800 × cấp boss** |
| Linh Thạch cơ bản | 240 × cấp boss | **400 × cấp boss** |

→ **Tất cả người tham gia** đều nhận thưởng cao hơn ~67% so với trước, dù đóng góp ít.

### Bonus theo % đóng góp: Linear → Sqrt

Trước đây: người đóng góp 50% damage nhận đúng 50% bonus pool.
Bây giờ: **√50% ≈ 71%** bonus pool.

→ Người mạnh vẫn nhận nhiều hơn, nhưng người ít damage cũng nhận được phần thưởng đáng kể thay vì gần như không có gì.

### KNB (Kim Ngọc Bạc) — giảm mạnh

| Hạng | Trước | Sau |
|---|---|---|
| Top 1 | 2–7 KNB (đảm bảo) | **1–3 KNB** (đảm bảo) |
| Top 2 | 1–4 KNB (đảm bảo) | **1–2 KNB** (đảm bảo) |
| Top 3 | 1–3 KNB (đảm bảo) | **50% nhận 1 KNB** |
| Top 4–5 | 50% nhận 1 KNB | **30% nhận 1 KNB** |
| Trảm Sát (Last Hit) | 1–3 KNB (đảm bảo) | **50% nhận 1 KNB** |

→ Tổng KNB phân phối giảm khoảng **60%**. KNB giờ chủ yếu đến từ các nguồn khác (nhiệm vụ, sự kiện, chợ) thay vì chỉ Boss.

### Vật phẩm top — bớt "Trúc Cơ Đan"

| Hạng | Trước | Sau |
|---|---|---|
| Top 1 | Rương Boss + Rương Cơ Duyên + **Trúc Cơ Đan** | Rương Boss + Rương Cơ Duyên |
| Top 2 | Rương Cơ Duyên + **Trúc Cơ Đan** | Rương Cơ Duyên |
| Top 3 | Rương Cơ Duyên + **Trúc Cơ Đan** | Rương Cơ Duyên |

→ Trúc Cơ Đan giờ chỉ drops từ các nguồn khác (Bí Cảnh, Lữ Khách...), không còn là "đặc quyền" của top Boss.

---

## 📊 Tổng kết thay đổi

- **~130+ vị trí code** được cập nhật để fix lỗi V2
- **Lữ Khách**: spawn thường xuyên hơn, mua hàng hoạt động đúng
- **Boss Thế Giới**: nút làm mới hoạt động, phần thưởng cân bằng hơn
- **Không có thay đổi** về cơ chế gameplay, NPC, quest, hay tính năng mới nào khác

---

## ⚔️ Redesign Hệ Thống Boss Thế Giới

Thiết kế lại toàn diện theo nguyên tắc: **tất cả người tham gia đều có lợi, người mới có thể bắt kịp, người mạnh không áp đảo**.

### 1. Boss Point (BP) — Đơn vị tiền tệ mới

Mỗi người tham gia Boss đều nhận **Boss Point (BP)** — thay thế KNB làm phần thưởng chính từ Boss.

**Nguồn nhận BP:**

| Nguồn | BP nhận được |
|---|---|
| Tham gia (ai cũng nhận) | **5 BP** |
| Mốc 1% damage | **+5 BP** |
| Mốc 3% damage | **+10 BP** |
| Mốc 5% damage | **+15 BP** |
| Mốc 10% damage | **+25 BP** |
| Mốc 15% damage | **+35 BP** |
| Mốc 20% damage | **+50 BP** |
| Top 1 | **+30 BP** |
| Top 2-3 | **+20 BP** |
| Top 4-5 | **+15 BP** |
| Top 6-10 | **+10 BP** |
| Top 11+ | **+5 BP** |
| Last Hit | **+20 BP** |
| Lucky Reward | **+10 BP** (50% chance) |

→ **Một người chơi mới chỉ cần tham gia và gây 3% damage đã nhận 20 BP/vòng.** Không cần top 1-3.

**Dùng BP đổi:** Rương Boss, Vé Bí Cảnh, Nguyên liệu hiếm, Danh hiệu, Vật phẩm trang trí (sắp ra mắt shop BP).

### 2. Soft Cap Damage Contribution

Sau ngưỡng 10% damage, hiệu quả phần thưởng giảm dần:

| % Damage | Hiệu quả |
|---|---|
| 0–10% | **100%** |
| 10–20% | **70%** |
| 20–30% | **50%** |
| 30%+ | **25%** |

→ **Ngăn một người chiếm 50-70% total damage và lấy gần như toàn bộ phần thưởng.** Người gây 30% damage thực sự chỉ nhận ~37% bonus thay vì 30%.

### 3. Phân thưởng theo √(Sqrt Scaling)

**Công thức:** `Reward = Base × (0.5 + 0.5 × √Contribution)`

| % Damage贡献 | Trước (Linear) | Sau (Sqrt) |
|---|---|---|
| 1% | 1% | **15%** |
| 5% | 5% | **34%** |
| 10% | 10% | **47%** |
| 25% | 25% | **75%** |
| 50% | 50% | **85%** |

→ **Người mới gây 5% damage nhận được 34% bonus thay vì 5%** — phần thưởng công bằng hơn gấp nhiều lần.

### 4. Catch-up Mechanic

Người chơi có sức mạnh **dưới mức trung bình server** nhận thêm:

- **+20% EXP Boss**
- **+20% Linh Thạch Boss**  
- **+20% Boss Point**

→ Giúp người mới "bắt kịp" nhanh hơn mà không cần cạnh tranh top.

### 5. Lucky Reward — Cơ hội cho mọi người

**Mỗi người tham gia đều có vé quay thưởng**, tỷ lệ phụ thuộc vào % đóng góp:

| % Damage | Tỷ lệ nhận Lucky |
|---|---|
| < 1% | 15% |
| 1% – 5% | 25% |
| 5%+ | 40% |

Phần thưởng Lucky ngẫu nhiên:
- 5% → **1x Rương Boss Thế Giới** (giống top 1!)
- 20% → **1x Rương Cơ Duyên**
- 75% → **+10 Boss Point**

→ **Người mới cũng có cơ hội nhận Rương Boss** dù chỉ gây ít damage.

### 6. KNB — Giảm gần như hoàn toàn

| Hạng | Trước | Sau |
|---|---|---|
| Top 1 | 2-7 KNB | **1 KNB** |
| Top 2 | 1-4 KNB | **1 KNB** |
| Top 3 | 1-3 KNB | **1 KNB** |
| Top 4+ | 0-1 KNB | **0 KNB** |
| Last Hit | 1-3 KNB | **0 KNB** |

→ **KNB từ Boss giảm ~90%.** KNB giờ chủ yếu đến từ nhiệm vụ, sự kiện, chợ — không còn là "nguồn KNB chính" từ Boss.

### 7. Mùa Giải Boss (Season)

- Mỗi **30 ngày** tự động reset season mới
- BXH season theo tổng damage tích lũy
- Top season nhận thưởng lớn cuối mùa (sắp ra mắt)
- **Người mới vẫn có cơ hội cạnh tranh** vì mỗi season bắt đầu từ 0

Hiển thị trong giao diện `/worldboss`: season hiện tại, số ngày còn lại, tổng boss đã tiêu diệt.

### 8. Giảm phụ thuộc xếp hạng

**Trước:** Top 1 nhận gấp 3-5x người chơi trung bình.
**Sau:** Top 1 chỉ nhận **1.5-2x** người chơi trung bình.

Phần thưởng giờ tập trung vào:
1. **Tham gia** (ai cũng nhận) — chiếm ~40% tổng
2. **Mốc đóng贡献** (đạt % damage) — chiếm ~30% tổng
3. **Hạng** (top 1-10) — chiếm ~20% tổng
4. **Lucky + Last Hit** — chiếm ~10% tổng

### 9. Tổng kết so sánh

| Chỉ số | Trước | Sau |
|---|---|---|
| Base EXP | 800 × factor | **500 × factor + sqrt bonus** |
| Base Coins | 400 × factor | **250 × factor + sqrt bonus** |
| KNB Top 1 | 2-7 | **1** |
| KNB tổng phân phối | ~15-20/boss | **3/boss** |
| Top 1 / Trung bình | ~3-5x | **~1.5-2x** |
| BP mới | — | **5-100+ BP/người/vòng** |
| Lucky chance mới | — | **15-40%** |
| Catch-up buff | — | **+20% cho người yếu** |
| Season reset | — | **Mỗi 30 ngày** |
