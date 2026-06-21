export const REALMS = [
  'Luyện Khí Kỳ',
  'Trúc Cơ Kỳ',
  'Kim Đan Kỳ',
  'Nguyên Anh Kỳ',
  'Hóa Thần Kỳ',
  'Luyện Hư Kỳ',
  'Hợp Thể Kỳ',
  'Đại Thừa Kỳ',
  'Độ Kiếp Kỳ',
  'Đăng Tiên Kỳ'
];

export const ELEMENT_EMOJIS: Record<string, string> = {
  'Lôi': '⚡',
  'Hỏa': '🔥',
  'Phong': '🌀',
  'Thủy': '💧',
  'Mộc': '🌿',
  'Thổ': '🪨'
};

/**
 * Trả về chi tiết cảnh giới dựa theo cấp độ (1 - 380)
 * Mỗi Đại Cảnh Giới có 38 cấp nhỏ (Tầng)
 */
export function getRealmDetails(level: number) {
  const cappedLevel = Math.min(Math.max(level, 1), 380);
  const majorIndex = Math.floor((cappedLevel - 1) / 38);
  const minorLevel = ((cappedLevel - 1) % 38) + 1;
  const realmName = REALMS[Math.min(majorIndex, REALMS.length - 1)];
  
  return {
    realmName,
    minorLevel,
    fullName: `${realmName} - Tầng ${minorLevel}/38`,
    isMaxLevel: cappedLevel >= 380,
    majorIndex
  };
}

/**
 * Tạo thanh tiến trình (Progress Bar) trực quan bằng ký tự văn bản
 */
export function getProgressBar(current: number, max: number, size: number = 10): string {
  const percentage = Math.min(Math.max(max > 0 ? current / max : 0, 0), 1);
  const progress = Math.round(size * percentage);
  const emptyProgress = size - progress;
  
  const progressText = '█'.repeat(progress);
  const emptyProgressText = '░'.repeat(emptyProgress);
  
  return `\`[${progressText}${emptyProgressText}]\` **${Math.round(percentage * 100)}%**`;
}

/**
 * Rút gọn số lớn thành dạng dễ đọc: 1.23M, 500K, 3.5B v.v.
 */
export function formatNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  
  if (abs >= 1_000_000_000) {
    return sign + (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  }
  if (abs >= 1_000_000) {
    return sign + (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  }
  if (abs >= 10_000) {
    return sign + (abs / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  }
  // Dùng dấu phẩy phân cách hàng nghìn cho số từ 1,000 - 9,999
  return sign + abs.toLocaleString('en-US');
}

/**
 * Tạo thanh stat diff có màu để highlight chênh lệch giữa base và active stats
 * Ví dụ: base 100 → active 150 -> trả về "100 → 150 (+50 🟢)"
 */
export function formatStatDiff(base: number, active: number, unit: string = ''): string {
  const diff = active - base;
  if (diff === 0) return `**${formatNumber(base)}${unit}**`;
  
  const arrow = diff > 0 ? '🟢' : '🔴';
  const sign = diff > 0 ? '+' : '';
  return `**${formatNumber(base)}${unit}** → ${formatNumber(active)}${unit} *(${sign}${formatNumber(diff)} ${arrow})*`;
}

/**
 * Định dạng chuỗi JSON Linh Căn thành văn bản hiển thị đẹp mắt kèm emoji
 */
export function formatLinhCan(linhCanJson: string): string {
  try {
    const data: Record<string, number> = JSON.parse(linhCanJson);
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    // Tạo nhãn linh căn theo số lượng hệ
    let label = '';
    let speed = '1.0x';
    const length = sorted.length;
    if (length === 1) { label = '【Đơn Linh Căn】'; speed = '1.5x'; }
    else if (length === 2) { label = '【Song Linh Căn】'; speed = '1.25x'; }
    else if (length === 3) { label = '【Tam Linh Căn】'; speed = '1.1x'; }
    else if (length === 4) { label = '【Tứ Linh Căn】'; speed = '1.0x'; }
    else { label = '【Ngũ Linh Căn】'; speed = '0.9x'; }
    
    const formatted = sorted.map(([element, percentage]) => {
      const emoji = ELEMENT_EMOJIS[element] || '🔮';
      return `${emoji} ${element} (${percentage}%)`;
    }).join(' | ');

    return `${label} ${formatted}\n*(Tốc độ tu luyện: **${speed}**)*`;
  } catch (error) {
    return 'Chưa rõ';
  }
}
