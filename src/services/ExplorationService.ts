import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { leylineService } from './LeylineService';
import { achievementService } from './AchievementService';

/**
 * Định nghĩa địa điểm thám hiểm
 */
export interface ExplorationLocation {
  id: string;
  name: string;
  emoji: string;
  description: string;
  travelTime: number;    // Thời gian đi đường (giây)
  staminaCost: number;   // Stamina tiêu hao
  minLevel: number;      // Cảnh giới tối thiểu
  rewardPool: ExplorationReward[];
  dangerRate: number;    // Tỷ lệ gặp biến cố nguy hiểm (0-1)
}

export interface ExplorationReward {
  type: 'coin' | 'item' | 'tuvi' | 'ngotinh' | 'nothing';
  itemId?: string;
  amount?: number;
  weight: number; // Trọng số xác suất
}

export interface ExplorationEvent {
  id: string;
  title: string;
  description: string;
  type: 'good' | 'bad' | 'neutral';
  choices: EventChoice[];
}

export interface EventChoice {
  id: string;
  label: string;
  successMsg: string;
  failMsg: string;
  successRate: number; // 0.0 - 1.0, có thể vượt qua 1.0 (nhưng Math.random() chỉ tới 1)
  successReward: ExplorationReward;
  failPenalty?: { stamina?: number; coin?: number };
  cost?: { coin?: number; stamina?: number };
}

// ==================== CẤU HÌNH ĐỊA ĐIỂM ====================
export const EXPLORATION_LOCATIONS: Record<string, ExplorationLocation> = {
  van_thu_son: {
    id: 'van_thu_son',
    name: 'Vạn Thú Sơn',
    emoji: '🏔️',
    description: 'Rừng núi hoang vu nơi yêu thú tụ cư đông đúc, nguy hiểm nhưng phong phú tài nguyên.',
    travelTime: 1800,  // 30 phút
    staminaCost: 20,
    minLevel: 1,
    dangerRate: 0.3,
    rewardPool: [
      { type: 'item', itemId: 'material_linh_thao_1', amount: 2, weight: 40 },
      { type: 'item', itemId: 'item_fragment', amount: 1, weight: 20 },
      { type: 'coin', amount: 50, weight: 25 },
      { type: 'tuvi', amount: 200, weight: 10 },
      { type: 'nothing', weight: 5 },
    ]
  },
  dong_hai: {
    id: 'dong_hai',
    name: 'Đông Hải Long Cung',
    emoji: '🌊',
    description: 'Đại dương bí ẩn nơi thủy tộc ngự trị, chứa đựng vô số trân châu dị bảo và phôi trang bị.',
    travelTime: 3600,  // 60 phút
    staminaCost: 35,
    minLevel: 15,
    dangerRate: 0.4,
    rewardPool: [
      { type: 'item', itemId: 'phoi_weapon_c', amount: 1, weight: 15 },
      { type: 'item', itemId: 'phoi_armor_c', amount: 1, weight: 15 },
      { type: 'item', itemId: 'material_nhan_sam_1', amount: 1, weight: 25 },
      { type: 'coin', amount: 150, weight: 30 },
      { type: 'ngotinh', amount: 5, weight: 15 },
    ]
  },
  cuc_bac: {
    id: 'cuc_bac',
    name: 'Cực Bắc Băng Nguyên',
    emoji: '❄️',
    description: 'Vùng tuyết lãnh vĩnh cửu phía bắc, nơi ẩn chứa tinh thạch băng cổ và linh dược tuyết sơn hiếm có.',
    travelTime: 5400,  // 90 phút
    staminaCost: 50,
    minLevel: 30,
    dangerRate: 0.5,
    rewardPool: [
      { type: 'item', itemId: 'phoi_weapon_b', amount: 1, weight: 20 },
      { type: 'item', itemId: 'phoi_armor_b', amount: 1, weight: 20 },
      { type: 'item', itemId: 'item_fragment', amount: 3, weight: 20 },
      { type: 'coin', amount: 300, weight: 25 },
      { type: 'ngotinh', amount: 10, weight: 15 },
    ]
  },
  huyen_moc_lam: {
    id: 'huyen_moc_lam',
    name: 'Huyền Mộc Nguyên Lâm',
    emoji: '🌲',
    description: 'Rừng cây ngàn năm che phủ, linh khí dày đặc nơi ẩn cư của các ẩn sĩ và linh vật thảo mộc.',
    travelTime: 2700,  // 45 phút
    staminaCost: 25,
    minLevel: 8,
    dangerRate: 0.2,
    rewardPool: [
      { type: 'item', itemId: 'material_linh_thao_1', amount: 3, weight: 35 },
      { type: 'item', itemId: 'material_nhan_sam_1', amount: 1, weight: 20 },
      { type: 'tuvi', amount: 500, weight: 20 },
      { type: 'coin', amount: 80, weight: 20 },
      { type: 'ngotinh', amount: 3, weight: 5 },
    ]
  },
  tan_thach_mac: {
    id: 'tan_thach_mac',
    name: 'Tẫn Thạch Linh Mạch',
    emoji: '⛏️',
    description: 'Mỏ linh thạch cổ đại phong phú khoáng sản linh thiên đặc biệt, rủi ro sập hầm cao.',
    travelTime: 3000,  // 50 phút
    staminaCost: 30,
    minLevel: 20,
    dangerRate: 0.45,
    rewardPool: [
      { type: 'item', itemId: 'material_iron_1', amount: 5, weight: 30 },
      { type: 'item', itemId: 'phoi_weapon_d', amount: 1, weight: 20 },
      { type: 'item', itemId: 'phoi_armor_d', amount: 1, weight: 20 },
      { type: 'coin', amount: 200, weight: 25 },
      { type: 'nothing', weight: 5 },
    ]
  }
};

// ==================== BIẾN CỐ KỲ NGỘ ====================
const EXPLORATION_EVENTS: ExplorationEvent[] = [
  {
    id: 'ancient_stele',
    title: '🪨 Cổ Bia Thiên Địa',
    description: 'Đạo hữu phát hiện một cổ bia khắc đầy hoa văn bí ẩn. Nghiên cứu sâu có thể ngộ ra mật pháp, nhưng cũng có thể kích hoạt trận pháp bẫy!',
    type: 'neutral',
    choices: [
      {
        id: 'study',
        label: '📖 Nghiên Cứu Cổ Bia',
        successMsg: '✅ Đạo hữu ngộ được mật pháp ẩn chứa, tâm cảnh thăng hoa!',
        failMsg: '❌ Trận pháp bùng nổ! Đạo hữu bị chấn thương mất Stamina.',
        successRate: 0.6,
        successReward: { type: 'ngotinh', amount: 15, weight: 100 },
        failPenalty: { stamina: 30 }
      },
      {
        id: 'skip',
        label: '🚶 Bỏ Qua',
        successMsg: '✅ Đạo hữu thận trọng bỏ qua, tránh được hiểm họa.',
        failMsg: '',
        successRate: 1.0,
        successReward: { type: 'nothing', weight: 100 }
      }
    ]
  },
  {
    id: 'injured_beast',
    title: '🐾 Mãnh Thú Bị Thương',
    description: 'Một linh thú cường đại đang bị thương, gầm gừ hung dữ. Có thể thử thuần phục hoặc cướp đoạt chiến lợi phẩm từ xác yêu thú trước đó.',
    type: 'neutral',
    choices: [
      {
        id: 'tame',
        label: '❤️ Cứu Thương Thuần Phục',
        successMsg: '✅ Linh thú cảm kích! Tặng cho đạo hữu một ân sủng kỳ trân!',
        failMsg: '❌ Linh thú phẫn nộ! Bị cắn xé mất Stamina và Linh Thạch.',
        successRate: 0.45,
        successReward: { type: 'item', itemId: 'item_fragment', amount: 2, weight: 100 },
        failPenalty: { stamina: 20, coin: 100 }
      },
      {
        id: 'loot',
        label: '⚔️ Cướp Chiến Lợi Phẩm',
        successMsg: '✅ Đạo hữu nhanh tay vơ vét được vài vật phẩm của thú trước đó để lại!',
        failMsg: '❌ Mãnh thú tỉnh dậy phản công! Đạo hữu tổn thương nặng.',
        successRate: 0.7,
        successReward: { type: 'coin', amount: 200, weight: 100 },
        failPenalty: { stamina: 40 }
      }
    ]
  },
  {
    id: 'mysterious_cultivator',
    title: '🧙 Kỳ Ngộ Dị Nhân',
    description: 'Một lão nhân tu hành cổ quái mái tóc bạc phơ ngồi tĩnh tọa bên đường. Ánh mắt thâm sâu như biển, không rõ là thiện hay ác.',
    type: 'good',
    choices: [
      {
        id: 'greet',
        label: '🙏 Vái Lạy Kính Chào',
        successMsg: '✅ Lão nhân truyền thụ một chiêu tâm pháp, ngộ tính thăng hoa vượt bậc!',
        failMsg: '❌ Lão nhân phẫn nộ vì bị quấy phá, trực tiếp chưởng đẩy đi!',
        successRate: 0.55,
        successReward: { type: 'ngotinh', amount: 25, weight: 100 },
        failPenalty: { stamina: 50 }
      },
      {
        id: 'observe',
        label: '🔍 Bí Mật Quan Sát',
        successMsg: '✅ Quan sát được lão nhân luyện công, học lỏm được một chút tinh yếu!',
        failMsg: '❌ Bị lão nhân phát hiện, không nhận được gì.',
        successRate: 0.8,
        successReward: { type: 'ngotinh', amount: 8, weight: 100 }
      }
    ]
  },
  {
    id: 'treasure_cave',
    title: '💎 Đổng Thiên Bí Khố',
    description: 'Một hang động bí ẩn ẩn sau thác nước! Bên trong có thể chứa kỳ trân dị bảo, cũng có thể là bẫy trận pháp cổ đại!',
    type: 'good',
    choices: [
      {
        id: 'enter',
        label: '🔦 Mạo Hiểm Tiến Vào',
        successMsg: '✅ Trong hang chứa đầy kỳ trân! Đạo hữu bội thu tài nguyên!',
        failMsg: '❌ Trận pháp bùng nổ, đạo hữu tổn hao nghiêm trọng!',
        successRate: 0.5,
        successReward: { type: 'coin', amount: 500, weight: 100 },
        failPenalty: { stamina: 60, coin: 200 }
      },
      {
        id: 'mark',
        label: '📍 Đánh Dấu Để Sau',
        successMsg: '✅ Thận trọng là thượng sách. Đạo hữu không được gì nhưng cũng không mất gì.',
        failMsg: '',
        successRate: 1.0,
        successReward: { type: 'nothing', weight: 100 }
      }
    ]
  },
  {
    id: 'spirit_spring',
    title: '💧 Linh Tuyền Thiên Giáng',
    description: 'Một dòng suối linh khí trong vắt từ tảng đá thiên nhiên chảy ra. Nước suối tỏa sáng nhẹ nhàng, linh khí dày đặc - uống vào có thể cải tạo cơ thể!',
    type: 'good',
    choices: [
      {
        id: 'drink',
        label: '🥤 Uống Linh Tuyền',
        successMsg: '✅ Linh khí thẩm thấu toàn thân, Tu Vi tăng vọt và tinh thần sảng khoái!',
        failMsg: '❌ Linh tuyền đã bị ô nhiễm bởi ma khí! Bị trúng độc mất Stamina.',
        successRate: 0.75,
        successReward: { type: 'tuvi', amount: 800, weight: 100 },
        failPenalty: { stamina: 30 }
      },
      {
        id: 'collect',
        label: '🫙 Thu Thập Mang Về',
        successMsg: '✅ Đạo hữu thu thập được một bình linh tuyền quý giá!',
        failMsg: '',
        successRate: 1.0,
        successReward: { type: 'coin', amount: 150, weight: 100 }
      }
    ]
  },
  {
    id: 'mysterious_skeleton',
    title: '💀 Bộ Hài Cốt Vô Danh',
    description: 'Một bộ hài cốt khô héo tựa lưng vào vách đá. Trên tay hắn dường như đang ôm khư khư một cuộn giấy cũ kỹ.',
    type: 'bad',
    choices: [
      {
        id: 'take',
        label: '🗺️ Giật Cuộn Giấy',
        successMsg: '✅ Cuộn giấy chính là Tàng Bảo Đồ chỉ dẫn đến kho báu!',
        failMsg: '❌ Xung quanh hài cốt có trận pháp bảo vệ! Đạo hữu bị thương nặng.',
        successRate: 0.5,
        successReward: { type: 'item', itemId: 'tang_bao_do', amount: 1, weight: 100 },
        failPenalty: { stamina: 50, coin: 200 }
      },
      {
        id: 'bury',
        label: '🪦 Chôn Cất Tử Tế',
        successMsg: '✅ Lòng tốt được đền đáp, từ trong áo người chết rơi ra một cuộn giấy.',
        failMsg: '❌ Vừa chạm vào, tà khí xâm nhập cơ thể!',
        successRate: 0.8,
        successReward: { type: 'item', itemId: 'tang_bao_do', amount: 1, weight: 100 },
        failPenalty: { stamina: 20 }
      }
    ]
  },
  {
    id: 'ancient_boss',
    title: '👹 Tàn Hồn Viễn Cổ',
    description: 'Không gian vặn vẹo, một tàn hồn của hung thú viễn cổ thoát khốn! Dù chỉ là tàn hồn nhưng uy áp vẫn vô cùng cường đại!',
    type: 'bad',
    choices: [
      {
        id: 'fight',
        label: '⚔️ Rút Kiếm Nghênh Chiến',
        successMsg: '✅ Trải qua một phen khổ chiến, đạo hữu đã đánh tan tàn hồn và thu được chí bảo viễn cổ!',
        failMsg: '❌ Tàn hồn quá mạnh! Đạo hữu bị đánh trọng thương, phải bỏ chạy trối chết.',
        successRate: 0.35,
        successReward: { type: 'item', itemId: 'phoi_weapon_b', amount: 1, weight: 100 },
        failPenalty: { stamina: 80, coin: 300 }
      },
      {
        id: 'flee',
        label: '🏃 Bỏ Chạy Trối Chết',
        successMsg: '✅ Chạy thoát thành công, giữ được mạng nhỏ nhưng mất thể lực.',
        failMsg: '❌ Không chạy kịp! Bị dư âm công kích đánh trúng!',
        successRate: 0.8,
        successReward: { type: 'nothing', weight: 100 },
        failPenalty: { stamina: 30, coin: 50 }
      }
    ]
  },
  {
    id: 'wandering_merchant',
    title: '🎒 Thương Nhân Thần Bí',
    description: 'Một kẻ kỳ dị vác chiếc túi lớn lang thang trong rừng. Hắn cười hề hề và mở túi ra: "Bảo bối viễn cổ đây, giá chỉ 1000 Linh thạch! Mua không?"',
    type: 'good',
    choices: [
      {
        id: 'buy',
        label: '💰 Mua (1000 Linh Thạch)',
        successMsg: '✅ Đạo hữu mở ra thấy một Pháp Bảo uy lực! Quả là món hời!',
        failMsg: '❌ Đạo hữu bị lừa! Trong hộp chỉ là đá cuội...',
        successRate: 0.6,
        successReward: { type: 'item', itemId: 'phoi_weapon_a', amount: 1, weight: 100 },
        cost: { coin: 1000 }
      },
      {
        id: 'ignore',
        label: '🙅 Từ Chối',
        successMsg: '✅ Không tin lời gian thương, đạo hữu bước đi vững vàng.',
        failMsg: '',
        successRate: 1.0,
        successReward: { type: 'nothing', weight: 100 }
      }
    ]
  },
  {
    id: 'bandits',
    title: '🥷 Hắc Đạo Phục Kích',
    description: 'Một toán tu ma giả bịt mặt lao ra chặn đường: "Giao nạp Linh Thạch ra, nếu không đừng trách đao kiếm vô tình!"',
    type: 'bad',
    choices: [
      {
        id: 'fight',
        label: '⚔️ Chống Trả',
        successMsg: '✅ Bọn cướp tồi tàn bị đạo hữu đánh tơi bời! Lột sạch tài sản của chúng!',
        failMsg: '❌ Bọn cướp đông và mạnh hơn dự kiến! Đạo hữu bị đánh cướp trắng trợn.',
        successRate: 0.5,
        successReward: { type: 'coin', amount: 800, weight: 100 },
        failPenalty: { stamina: 50, coin: 1000 }
      },
      {
        id: 'pay',
        label: '💸 Giao Nộp (500 Linh Thạch)',
        successMsg: '✅ Phá tài tiêu tai, bọn cướp lấy tiền rồi bỏ đi.',
        failMsg: '❌ Bọn cướp thấy đạo hữu ngoan ngoãn liền đòi thêm, rút cục bị cướp sạch!',
        successRate: 0.9,
        successReward: { type: 'nothing', weight: 100 },
        cost: { coin: 500 },
        failPenalty: { coin: 500 }
      }
    ]
  }
];

interface ExplorationRow {
  id: number;
  user_id: string;
  location_id: string;
  start_time: number;
  end_time: number;
  stamina_cost: number;
  status: string;
  result: string | null;
}

class ExplorationService {
  /**
   * Bắt đầu thám hiểm một địa điểm
   */
  startExploration(userId: string, locationId: string): { success: boolean; message: string; endTime?: number } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };

    const location = EXPLORATION_LOCATIONS[locationId];
    if (!location) return { success: false, message: 'Địa điểm không tồn tại.' };

    if (user.level < location.minLevel) {
      return { success: false, message: `Cảnh giới quá thấp! Cần cảnh giới **${location.minLevel}** để thám hiểm **${location.name}**.` };
    }

    const activeMountForCheck = db.prepare('SELECT stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(userId) as any;
    const initialStaminaSave = activeMountForCheck?.stamina_save || 0;
    const initialStaminaCost = Math.round(location.staminaCost * (1 - initialStaminaSave));

    if ((user.stamina || 0) < initialStaminaCost) {
      return { success: false, message: `Không đủ Thể Lực! Cần **${initialStaminaCost}** Thể Lực (Hiện có: **${user.stamina || 0}**).` };
    }

    // Kiểm tra xem đang trong chuyến thám hiểm nào chưa
    const active = db.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'traveling'").get(userId) as ExplorationRow | undefined;
    if (active) {
      const remaining = Math.ceil((active.end_time - Date.now() / 1000) / 60);
      const loc = EXPLORATION_LOCATIONS[active.location_id];
      return { success: false, message: `Đạo hữu đang trên đường thám hiểm **${loc?.name || active.location_id}**! Còn **${remaining} phút** nữa mới về.` };
    }

    // Kiểm tra Mount buff
    const activeMount = db.prepare('SELECT speed_bonus, stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(userId) as any;
    const mountSpeedBonus = activeMount?.speed_bonus || 0;
    const mountStaminaSave = activeMount?.stamina_save || 0;

    const effectiveTravelTime = Math.round(location.travelTime * (1 - mountSpeedBonus));
    const baseStaminaCost = location.staminaCost;
    const staminaCost = Math.round(baseStaminaCost * (1 - mountStaminaSave));

    const now = Math.floor(Date.now() / 1000);
    const endTime = now + effectiveTravelTime;

    db.transaction(() => {
      userRepository.update(userId, { stamina: (user.stamina || 500) - staminaCost });
      db.prepare(`
        INSERT INTO explorations (user_id, location_id, start_time, end_time, stamina_cost, status)
        VALUES (?, ?, ?, ?, ?, 'traveling')
      `).run(userId, locationId, now, endTime, staminaCost);
    })();

    const minutes = Math.floor(effectiveTravelTime / 60);
    return {
      success: true,
      message: `🗺️ Đạo hữu lên đường thám hiểm **${location.emoji} ${location.name}**!\n\n⏳ Thời gian đi đường: **${minutes} phút**\n🧘 Tiêu hao: **${staminaCost}** Thể Lực\n\n*Sử dụng lại lệnh sau ${minutes} phút để thu hoạch kết quả!*`,
      endTime
    };
  }

  /**
   * Thu hoạch kết quả thám hiểm (và có thể gặp biến cố kỳ ngộ)
   */
  claimExploration(userId: string): {
    success: boolean;
    message: string;
    hasEvent?: boolean;
    event?: ExplorationEvent;
    explorationId?: number;
    rewardText?: string;
  } {
    const active = db.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'traveling'").get(userId) as ExplorationRow | undefined;
    if (!active) {
      return { success: false, message: 'Đạo hữu hiện không trong hành trình thám hiểm nào.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < active.end_time) {
      const remaining = Math.ceil((active.end_time - now) / 60);
      return { success: false, message: `Đạo hữu vẫn đang trên đường! Còn **${remaining} phút** nữa mới tới nơi.` };
    }

    const location = EXPLORATION_LOCATIONS[active.location_id];
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Lỗi không tìm thấy user.' };

    const luck = user.base_luck || 10;
    // Tỷ lệ may mắn ảnh hưởng (luck / 200) -> +x% danger rate but better events?
    // Ở đây, nếu may mắn cao, giảm tỷ lệ gặp bad events.
    const modifiedDangerRate = Math.min(0.9, Math.max(0.1, location.dangerRate - (luck * 0.001)));

    // Kiểm tra có gặp kỳ ngộ không
    if (Math.random() < modifiedDangerRate) {
      // Phân bổ event dựa trên luck: Luck cao -> tỷ lệ good cao hơn
      let eventPool = EXPLORATION_EVENTS;
      const randType = Math.random();
      
      // Luck 100 -> +10% good, -10% bad
      const goodChance = 0.3 + (luck * 0.002);
      const badChance = 0.4 - (luck * 0.002);

      let chosenType: 'good' | 'bad' | 'neutral' = 'neutral';
      if (randType < goodChance) chosenType = 'good';
      else if (randType < goodChance + badChance) chosenType = 'bad';
      else chosenType = 'neutral';

      const filteredEvents = EXPLORATION_EVENTS.filter(e => e.type === chosenType);
      const pool = filteredEvents.length > 0 ? filteredEvents : EXPLORATION_EVENTS;
      const event = pool[Math.floor(Math.random() * pool.length)];

      // Lưu eventId vào result để resolveEvent có thể tìm thấy
      db.prepare("UPDATE explorations SET status = 'event_pending', result = ? WHERE id = ?").run(JSON.stringify({ eventId: event.id }), active.id);
      return {
        success: true,
        hasEvent: true,
        event,
        explorationId: active.id,
        message: `🎲 Kỳ ngộ xuất hiện tại **${location.emoji} ${location.name}**!`
      };
    }

    // Không có kỳ ngộ -> phát thưởng ngay
    const rewardText = this.distributeReward(userId, active.location_id);
    db.prepare("UPDATE explorations SET status = 'completed', result = ? WHERE id = ?").run(rewardText, active.id);

    this.updateExplorationAchievements(userId);

    return {
      success: true,
      hasEvent: false,
      rewardText,
      message: `✅ Đạo hữu trở về từ **${location.emoji} ${location.name}**!\n\n${rewardText}`
    };
  }

  /**
   * Xử lý lựa chọn biến cố kỳ ngộ
   */
  resolveEvent(userId: string, explorationId: number, choiceId: string): { success: boolean; message: string } {
    const exp = db.prepare("SELECT * FROM explorations WHERE id = ? AND user_id = ? AND status = 'event_pending'").get(explorationId, userId) as ExplorationRow | undefined;
    if (!exp) return { success: false, message: 'Không tìm thấy biến cố hoặc đã xử lý.' };

    const location = EXPLORATION_LOCATIONS[exp.location_id];
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };

    // Tìm event (mã event lưu trong JSON result)
    const result = exp.result ? JSON.parse(exp.result) : null;
    const eventId = result?.eventId;
    const event = EXPLORATION_EVENTS.find(e => e.id === eventId);
    
    // Nếu không tìm thấy event trong result, tìm ngẫu nhiên (fallback)
    const targetEvent = event || EXPLORATION_EVENTS[0];
    const choice = targetEvent.choices.find(c => c.id === choiceId);
    if (!choice) return { success: false, message: 'Lựa chọn không hợp lệ.' };

    if (choice.cost) {
      if (choice.cost.coin && user.coin_ha_pham < choice.cost.coin) {
        return { success: false, message: `Không đủ tài nguyên! Cần **${choice.cost.coin}** Linh Thạch để chọn.` };
      }
      if (choice.cost.stamina && (user.stamina || 0) < choice.cost.stamina) {
        return { success: false, message: `Không đủ Thể Lực! Cần **${choice.cost.stamina}** Thể Lực để chọn.` };
      }
    }

    // Tính toán success rate có bonus may mắn
    const luckBonus = (user.base_luck || 10) * 0.001; // Luck 100 -> +10%
    const finalSuccessRate = choice.successRate + luckBonus;
    const isSuccess = Math.random() < finalSuccessRate;
    let rewardText = '';

    db.transaction(() => {
      // Trừ cost nếu có
      if (choice.cost) {
        const updates: any = {};
        if (choice.cost.coin) updates.coin_ha_pham = user.coin_ha_pham - choice.cost.coin;
        if (choice.cost.stamina) updates.stamina = (user.stamina || 0) - choice.cost.stamina;
        userRepository.update(userId, updates);
      }

      if (isSuccess) {
        rewardText = this.applyReward(userId, user, choice.successReward);
      } else {
        // Áp dụng hình phạt thất bại
        const penalty = choice.failPenalty || {};
        const updates: any = {};
        
        // Refresh user obj sau khi trừ cost
        const freshUser = userRepository.get(userId)!;
        if (penalty.stamina) updates.stamina = Math.max(0, (freshUser.stamina || 0) - penalty.stamina);
        if (penalty.coin) updates.coin_ha_pham = Math.max(0, freshUser.coin_ha_pham - penalty.coin);
        if (Object.keys(updates).length > 0) userRepository.update(userId, updates);
        rewardText = '';
      }
      // Sau biến cố -> phân phát thưởng địa điểm bình thường luôn
      const locationRewardText = this.distributeReward(userId, exp.location_id);
      const finalResult = JSON.stringify({ eventId: targetEvent.id, choiceId, success: isSuccess, reward: rewardText, locationReward: locationRewardText });
      db.prepare("UPDATE explorations SET status = 'completed', result = ? WHERE id = ?").run(finalResult, exp.id);
      rewardText = locationRewardText;
    })();

    this.updateExplorationAchievements(userId);

    const msg = isSuccess ? choice.successMsg : choice.failMsg;
    const locationRewardLine = rewardText ? `\n\n📦 **Chiến Lợi Phẩm Địa Điểm:**\n${rewardText}` : '';
    return {
      success: true,
      message: `${msg}${locationRewardLine}`
    };
  }

  /**
   * Phân phát phần thưởng địa điểm ngẫu nhiên
   */
  private distributeReward(userId: string, locationId: string): string {
    const user = userRepository.get(userId);
    if (!user) return '';

    const location = EXPLORATION_LOCATIONS[locationId];
    const reward = this.weightedRandom(location.rewardPool);

    return this.applyReward(userId, user, reward);
  }

  private applyReward(userId: string, user: any, reward: ExplorationReward): string {
    if (reward.type === 'nothing') return '🌫️ *Không có gì đặc biệt.*';

    if (reward.type === 'coin') {
      const luck = user.base_luck || 10;
      let bonusRate = 1 + (luck / 500);
      
      // Leyline Buff Thu Thập (+25% rate or lượng)
      if (leylineService.isBuffActive('thuthap')) {
        bonusRate += 0.25; // Thêm 25% drop amount/rate
      }
      
      const amount = Math.round((reward.amount || 100) * bonusRate);
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + amount });
      return `🟤 Nhặt được **+${amount}** Hạ Phẩm Linh Thạch`;
    }

    if (reward.type === 'tuvi') {
      const amount = reward.amount || 100;
      userRepository.update(userId, { tu_vi: user.tu_vi + amount });
      return `🌿 Cảm nhận linh khí thiên địa, Thu thập **+${amount}** Tu Vi`;
    }

    if (reward.type === 'ngotinh') {
      const amount = reward.amount || 5;
      userRepository.update(userId, { ngotinh: (user.ngotinh || 0) + amount });
      return `🧘 Tâm cảnh sáng tỏ, Nhận **+${amount}** Ngộ Tính`;
    }

    if (reward.type === 'item' && reward.itemId) {
      let amount = reward.amount || 1;
      
      // Leyline Buff Thu Thập: 25% cơ hội rớt gấp đôi (hoặc thu hoạch x2)
      if (leylineService.isBuffActive('thuthap') && Math.random() < 0.25) {
        amount *= 2;
      }
      
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(reward.itemId) as any;
      if (item) {
        inventoryRepository.addItem(userId, reward.itemId, amount);
        let message = `🎁 Nhặt được **${item.name}** x${amount}`;
        if (amount > (reward.amount || 1)) message += ' *(Linh Mạch Buff x2!)*';
        return message;
      }
    }

    return '🌫️ *Không có gì đặc biệt.*';
  }

  /**
   * Lấy thông tin chuyến thám hiểm hiện tại
   */
  getActiveExploration(userId: string): ExplorationRow | null {
    return db.prepare("SELECT * FROM explorations WHERE user_id = ? AND (status = 'traveling' OR status = 'event_pending') ORDER BY id DESC LIMIT 1").get(userId) as ExplorationRow | null;
  }

  /**
   * Lấy lịch sử thám hiểm gần đây
   */
  getHistory(userId: string, limit: number = 5): ExplorationRow[] {
    return db.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT ?").all(userId, limit) as ExplorationRow[];
  }

  /**
   * Cập nhật tiến trình thành tựu thám hiểm dã ngoại
   */
  private updateExplorationAchievements(userId: string): void {
    try {
      const countResult = db.prepare(
        "SELECT COUNT(*) as c FROM explorations WHERE user_id = ? AND status = 'completed'"
      ).get(userId) as { c: number };

      achievementService.setProgress(userId, 'cd_10', countResult.c);
      achievementService.setProgress(userId, 'cd_11', countResult.c);
    } catch (e) {
      console.error('[updateExplorationAchievements Error]', e);
    }
  }

  private weightedRandom<T extends { weight: number }>(items: T[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let rand = Math.random() * total;
    for (const item of items) {
      rand -= item.weight;
      if (rand <= 0) return item;
    }
    return items[items.length - 1];
  }
}

export const explorationService = new ExplorationService();
