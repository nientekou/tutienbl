"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.explorationService = exports.EXPLORATION_LOCATIONS = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const itemConstants_1 = require("../config/itemConstants");
const LeylineService_1 = require("./LeylineService");
const AchievementService_1 = require("./AchievementService");
// ==================== CẤU HÌNH ĐỊA ĐIỂM ====================
exports.EXPLORATION_LOCATIONS = {
    van_thu_son: {
        id: 'van_thu_son',
        name: 'Vạn Thú Sơn',
        emoji: '🏔️',
        description: 'Rừng núi hoang vu nơi yêu thú tụ cư đông đúc, nguy hiểm nhưng phong phú tài nguyên.',
        travelTime: 2700, // 45 phút, tăng từ 1800
        staminaCost: 20,
        minLevel: 1,
        dangerRate: 0.45, // tăng từ 0.3
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.MATERIAL_LINH_THAO_1, amount: 2, weight: 35 },
            { type: 'item', itemId: itemConstants_1.ITEMS.ITEM_FRAGMENT, amount: 1, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.MAP_FRAGMENT, amount: 1, weight: 10 },
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
        travelTime: 5400, // 90 phút, tăng từ 3600
        staminaCost: 35,
        minLevel: 15,
        dangerRate: 0.55, // tăng từ 0.4
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_C, amount: 1, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_C, amount: 1, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.MATERIAL_NHAN_SAM_1, amount: 1, weight: 25 },
            { type: 'coin', amount: 150, weight: 30 },
            { type: 'ngotinh', amount: 5, weight: 15 },
        ]
    },
    cuc_bac: {
        id: 'cuc_bac',
        name: 'Cực Bắc Băng Nguyên',
        emoji: '❄️',
        description: 'Vùng tuyết lãnh vĩnh cửu phía bắc, nơi ẩn chứa tinh thạch băng cổ và linh dược tuyết sơn hiếm có.',
        travelTime: 8100, // 135 phút, tăng từ 5400
        staminaCost: 50,
        minLevel: 30,
        dangerRate: 0.65, // tăng từ 0.5
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_B, amount: 1, weight: 20 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_B, amount: 1, weight: 20 },
            { type: 'item', itemId: itemConstants_1.ITEMS.ITEM_FRAGMENT, amount: 3, weight: 20 },
            { type: 'coin', amount: 300, weight: 25 },
            { type: 'ngotinh', amount: 10, weight: 15 },
        ]
    },
    huyen_moc_lam: {
        id: 'huyen_moc_lam',
        name: 'Huyền Mộc Nguyên Lâm',
        emoji: '🌲',
        description: 'Rừng cây ngàn năm che phủ, linh khí dày đặc nơi ẩn cư của các ẩn sĩ và linh vật thảo mộc.',
        travelTime: 4050, // 67.5 phút, tăng từ 2700
        staminaCost: 25,
        minLevel: 8,
        dangerRate: 0.35, // tăng từ 0.2
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.MATERIAL_LINH_THAO_1, amount: 3, weight: 35 },
            { type: 'item', itemId: itemConstants_1.ITEMS.MATERIAL_NHAN_SAM_1, amount: 1, weight: 20 },
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
        travelTime: 4500, // 75 phút, tăng từ 3000
        staminaCost: 30,
        minLevel: 20,
        dangerRate: 0.60, // tăng từ 0.45
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.MATERIAL_IRON_1, amount: 5, weight: 30 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_D, amount: 1, weight: 20 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_D, amount: 1, weight: 20 },
            { type: 'coin', amount: 200, weight: 25 },
            { type: 'nothing', weight: 5 },
        ]
    },
    // V12 B-02: High-Level Exploration Locations
    thien_cung: {
        id: 'thien_cung',
        name: 'Thiên Cung Phá Lãng',
        emoji: '🏯',
        description: 'Cung điện trên mây nơi các vị tiên cổ ngự trị, ẩn chứa bảo vật thiên đình nhưng cực kỳ nguy hiểm.',
        travelTime: 10800, // 180 phút
        staminaCost: 60,
        minLevel: 50,
        dangerRate: 0.70,
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_A, amount: 1, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_A, amount: 1, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.TINH_THACH_SHARD, amount: 2, weight: 20 },
            { type: 'coin', amount: 500, weight: 20 },
            { type: 'ngotinh', amount: 15, weight: 15 },
            { type: 'tuvi', amount: 2000, weight: 10 },
            { type: 'nothing', weight: 5 },
        ]
    },
    uu_minh: {
        id: 'uu_minh',
        name: 'U Minh Địa Ngục',
        emoji: '💀',
        description: 'Địa ngục dưới lòng đất nơi âm khí dày đặc, yêu ma ngự trị nhưng ẩn chứa bí mật của người xưa.',
        travelTime: 14400, // 240 phút
        staminaCost: 80,
        minLevel: 80,
        dangerRate: 0.80,
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_S, amount: 1, weight: 10 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_S, amount: 1, weight: 10 },
            { type: 'item', itemId: itemConstants_1.ITEMS.TINH_THACH_SHARD, amount: 3, weight: 20 },
            { type: 'item', itemId: itemConstants_1.ITEMS.INFINITE_SHARD, amount: 1, weight: 10 },
            { type: 'coin', amount: 800, weight: 20 },
            { type: 'ngotinh', amount: 20, weight: 15 },
            { type: 'tuvi', amount: 5000, weight: 10 },
            { type: 'nothing', weight: 5 },
        ]
    },
    vo_cuc: {
        id: 'vo_cuc',
        name: 'Vô Cực Hư Không',
        emoji: '🌌',
        description: 'Khe nứt giữa các chiều không gian, nơi thực tại bị bóp méo — chỉ đạo hữu cực mạnh mới tồn tại được.',
        travelTime: 18000, // 300 phút
        staminaCost: 100,
        minLevel: 120,
        dangerRate: 0.90,
        rewardPool: [
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_SS, amount: 1, weight: 8 },
            { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_ARMOR_SS, amount: 1, weight: 8 },
            { type: 'item', itemId: itemConstants_1.ITEMS.INFINITE_SHARD, amount: 2, weight: 15 },
            { type: 'item', itemId: itemConstants_1.ITEMS.INFINITE_CORE, amount: 1, weight: 5 },
            { type: 'coin', amount: 1200, weight: 20 },
            { type: 'ngotinh', amount: 30, weight: 15 },
            { type: 'tuvi', amount: 10000, weight: 10 },
            { type: 'nothing', weight: 5 },
        ]
    },
};
// ==================== BIẾN CỐ KỲ NGỘ ====================
const EXPLORATION_EVENTS = [
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
                failPenalty: { stamina: 60 }
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
                successReward: { type: 'item', itemId: itemConstants_1.ITEMS.ITEM_FRAGMENT, amount: 2, weight: 100 },
                failPenalty: { stamina: 40, coin: 200 },
                karma: 8
            },
            {
                id: 'loot',
                label: '⚔️ Cướp Chiến Lợi Phẩm',
                successMsg: '✅ Đạo hữu nhanh tay vơ vét được vài vật phẩm của thú trước đó để lại!',
                failMsg: '❌ Mãnh thú tỉnh dậy phản công! Đạo hữu tổn thương nặng.',
                successRate: 0.7,
                successReward: { type: 'coin', amount: 200, weight: 100 },
                failPenalty: { stamina: 80 },
                karma: -5
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
                failPenalty: { stamina: 100 }
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
                failPenalty: { stamina: 120, coin: 400 }
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
                failPenalty: { stamina: 60 }
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
                successReward: { type: 'item', itemId: itemConstants_1.ITEMS.TANG_BAO_DO, amount: 1, weight: 100 },
                failPenalty: { stamina: 100, coin: 400 }
            },
            {
                id: 'bury',
                label: '🪦 Chôn Cất Tử Tế',
                successMsg: '✅ Lòng tốt được đền đáp, từ trong áo người chết rơi ra một cuộn giấy.',
                failMsg: '❌ Vừa chạm vào, tà khí xâm nhập cơ thể!',
                successRate: 0.8,
                successReward: { type: 'item', itemId: itemConstants_1.ITEMS.TANG_BAO_DO, amount: 1, weight: 100 },
                failPenalty: { stamina: 40 }
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
                successReward: { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_B, amount: 1, weight: 100 },
                failPenalty: { stamina: 120, coin: 500 }
            },
            {
                id: 'flee',
                label: '🏃 Bỏ Chạy Trối Chết',
                successMsg: '✅ Chạy thoát thành công, giữ được mạng nhỏ nhưng mất thể lực.',
                failMsg: '❌ Không chạy kịp! Bị dư âm công kích đánh trúng!',
                successRate: 0.8,
                successReward: { type: 'nothing', weight: 100 },
                failPenalty: { stamina: 60, coin: 100 }
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
                successReward: { type: 'item', itemId: itemConstants_1.ITEMS.PHOI_WEAPON_A, amount: 1, weight: 100 },
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
                failPenalty: { stamina: 100, coin: 2000 }
            },
            {
                id: 'pay',
                label: '💸 Giao Nộp (500 Linh Thạch)',
                successMsg: '✅ Phá tài tiêu tai, bọn cướp lấy tiền rồi bỏ đi.',
                failMsg: '❌ Bọn cướp thấy đạo hữu ngoan ngoãn liền đòi thêm, rút cục bị cướp sạch!',
                successRate: 0.9,
                successReward: { type: 'nothing', weight: 100 },
                cost: { coin: 500 },
                failPenalty: { coin: 1000 }
            }
        ]
    }
];
class ExplorationService {
    /**
     * Bắt đầu thám hiểm một địa điểm
     */
    startExploration(userId, locationId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const location = exports.EXPLORATION_LOCATIONS[locationId];
        if (!location)
            return { success: false, message: 'Địa điểm không tồn tại.' };
        if (user.level < location.minLevel) {
            return { success: false, message: `Cảnh giới quá thấp! Cần cảnh giới **${location.minLevel}** để thám hiểm **${location.name}**.` };
        }
        const activeMountForCheck = database_1.default.prepare('SELECT stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(userId);
        const initialStaminaSave = activeMountForCheck?.stamina_save || 0;
        const initialStaminaCost = Math.round(location.staminaCost * (1 - initialStaminaSave));
        if ((user.stamina || 0) < initialStaminaCost) {
            return { success: false, message: `Không đủ Thể Lực! Cần **${initialStaminaCost}** Thể Lực (Hiện có: **${user.stamina || 0}**).` };
        }
        // Kiểm tra xem đang trong chuyến thám hiểm nào chưa
        const active = database_1.default.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'traveling'").get(userId);
        if (active) {
            const remaining = Math.ceil((active.end_time - Date.now() / 1000) / 60);
            const loc = exports.EXPLORATION_LOCATIONS[active.location_id];
            return { success: false, message: `Đạo hữu đang trên đường thám hiểm **${loc?.name || active.location_id}**! Còn **${remaining} phút** nữa mới về.` };
        }
        // Kiểm tra Mount buff
        const activeMount = database_1.default.prepare('SELECT speed_bonus, stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(userId);
        const mountSpeedBonus = activeMount?.speed_bonus || 0;
        const mountStaminaSave = activeMount?.stamina_save || 0;
        const effectiveTravelTime = Math.round(location.travelTime * (1 - mountSpeedBonus));
        const baseStaminaCost = location.staminaCost;
        const staminaCost = Math.round(baseStaminaCost * (1 - mountStaminaSave));
        const now = Math.floor(Date.now() / 1000);
        const endTime = now + effectiveTravelTime;
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(userId, { stamina: (user.stamina || 500) - staminaCost });
            database_1.default.prepare(`
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
    claimExploration(userId) {
        const active = database_1.default.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'traveling'").get(userId);
        if (!active) {
            return { success: false, message: 'Đạo hữu hiện không trong hành trình thám hiểm nào.' };
        }
        const now = Math.floor(Date.now() / 1000);
        if (now < active.end_time) {
            const remaining = Math.ceil((active.end_time - now) / 60);
            return { success: false, message: `Đạo hữu vẫn đang trên đường! Còn **${remaining} phút** nữa mới tới nơi.` };
        }
        const location = exports.EXPLORATION_LOCATIONS[active.location_id];
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Lỗi không tìm thấy user.' };
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
            let chosenType = 'neutral';
            if (randType < goodChance)
                chosenType = 'good';
            else if (randType < goodChance + badChance)
                chosenType = 'bad';
            else
                chosenType = 'neutral';
            const filteredEvents = EXPLORATION_EVENTS.filter(e => e.type === chosenType);
            const pool = filteredEvents.length > 0 ? filteredEvents : EXPLORATION_EVENTS;
            const event = pool[Math.floor(Math.random() * pool.length)];
            // Lưu eventId vào result để resolveEvent có thể tìm thấy
            database_1.default.prepare("UPDATE explorations SET status = 'event_pending', result = ? WHERE id = ?").run(JSON.stringify({ eventId: event.id }), active.id);
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
        database_1.default.prepare("UPDATE explorations SET status = 'completed', result = ? WHERE id = ?").run(rewardText, active.id);
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
    resolveEvent(userId, explorationId, choiceId) {
        const exp = database_1.default.prepare("SELECT * FROM explorations WHERE id = ? AND user_id = ? AND status = 'event_pending'").get(explorationId, userId);
        if (!exp)
            return { success: false, message: 'Không tìm thấy biến cố hoặc đã xử lý.' };
        const location = exports.EXPLORATION_LOCATIONS[exp.location_id];
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        // Tìm event (mã event lưu trong JSON result)
        const result = exp.result ? JSON.parse(exp.result) : null;
        const eventId = result?.eventId;
        const event = EXPLORATION_EVENTS.find(e => e.id === eventId);
        // Nếu không tìm thấy event trong result, tìm ngẫu nhiên (fallback)
        const targetEvent = event || EXPLORATION_EVENTS[0];
        const choice = targetEvent.choices.find(c => c.id === choiceId);
        if (!choice)
            return { success: false, message: 'Lựa chọn không hợp lệ.' };
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
        database_1.default.transaction(() => {
            // Trừ cost nếu có
            if (choice.cost) {
                const updates = {};
                if (choice.cost.coin)
                    updates.coin_ha_pham = user.coin_ha_pham - choice.cost.coin;
                if (choice.cost.stamina)
                    updates.stamina = (user.stamina || 0) - choice.cost.stamina;
                UserRepository_1.userRepository.update(userId, updates);
            }
            // BIG UPDATE §2: Apply karma from exploration choice
            if (choice.karma) {
                const { karmaService } = require('./KarmaService');
                karmaService.addKarma(userId, choice.karma);
            }
            if (isSuccess) {
                rewardText = this.applyReward(userId, user, choice.successReward);
            }
            else {
                // Áp dụng hình phạt thất bại
                const penalty = choice.failPenalty || {};
                const updates = {};
                // Refresh user obj sau khi trừ cost
                const freshUser = UserRepository_1.userRepository.get(userId);
                if (penalty.stamina) {
                    const currentStamina = freshUser.stamina || 0;
                    const nextStamina = Math.max(0, currentStamina - penalty.stamina);
                    updates.stamina = nextStamina;
                    if (nextStamina <= 0 && currentStamina > 0) {
                        // Cạn kiệt thể lực: bị lạc đường, phạt linh thạch và bị chấn thương
                        const nowSec = Math.floor(Date.now() / 1000);
                        updates.coin_ha_pham = Math.max(0, freshUser.coin_ha_pham - 200);
                        updates.injury_end_time = nowSec + 1800; // 30 phút trọng thương
                        rewardText = `\\n⚠️ **CẠN KIỆT THỂ LỰC:** Đạo hữu kiệt sức ngã quỵ giữa hoang dã, mất **200 Linh Thạch** và bị **Trọng Thương trong 30 phút** mới gượng dậy bò về được!`;
                    }
                }
                if (penalty.coin && !updates.coin_ha_pham)
                    updates.coin_ha_pham = Math.max(0, freshUser.coin_ha_pham - penalty.coin);
                if (Object.keys(updates).length > 0)
                    UserRepository_1.userRepository.update(userId, updates);
            }
            // Sau biến cố -> phân phát thưởng địa điểm bình thường luôn
            const locationRewardText = this.distributeReward(userId, exp.location_id);
            const finalResult = JSON.stringify({ eventId: targetEvent.id, choiceId, success: isSuccess, reward: rewardText, locationReward: locationRewardText });
            database_1.default.prepare("UPDATE explorations SET status = 'completed', result = ? WHERE id = ?").run(finalResult, exp.id);
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
    distributeReward(userId, locationId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return '';
        const location = exports.EXPLORATION_LOCATIONS[locationId];
        const reward = this.weightedRandom(location.rewardPool);
        const msg = this.applyReward(userId, user, reward);
        // BIG UPDATE §4: Soul drop from exploration (chance = danger rate × 0.5)
        let soulMsg = '';
        if (Math.random() < (location.dangerRate || 0.45) * 0.5) {
            const soulTiers = [
                { id: 'soul_holy', rate: 0.05, minDanger: 0.80 },
                { id: 'soul_fierce', rate: 0.20, minDanger: 0.60 },
                { id: 'soul_spirit', rate: 0.40, minDanger: 0.40 },
                { id: 'soul_mortal', rate: 1.00, minDanger: 0 },
            ];
            const eligible = soulTiers.filter(s => location.dangerRate >= s.minDanger && Math.random() < s.rate);
            const chosen = eligible.length > 0 ? eligible[0] : soulTiers[soulTiers.length - 1];
            const soulItem = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(chosen.id);
            if (soulItem) {
                InventoryRepository_1.inventoryRepository.addItem(userId, chosen.id, 1);
                soulMsg = `\n💀 Nhặt được **${soulItem.name}**! (Linh hồn vương vấn)`;
            }
        }
        return msg + soulMsg;
    }
    applyReward(userId, user, reward) {
        if (reward.type === 'nothing')
            return '🌫️ *Không có gì đặc biệt.*';
        if (reward.type === 'coin') {
            const luck = user.base_luck || 10;
            let bonusRate = 1 + (luck / 500);
            // Leyline Buff Thu Thập (+25% rate or lượng)
            if (LeylineService_1.leylineService.isBuffActive('thuthap')) {
                bonusRate += 0.25; // Thêm 25% drop amount/rate
            }
            const amount = Math.round((reward.amount || 100) * bonusRate);
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + amount });
            return `🟤 Nhặt được **+${amount}** Hạ Phẩm Linh Thạch`;
        }
        if (reward.type === 'tuvi') {
            const amount = reward.amount || 100;
            UserRepository_1.userRepository.update(userId, { tu_vi: user.tu_vi + amount });
            return `🌿 Cảm nhận linh khí thiên địa, Thu thập **+${amount}** Tu Vi`;
        }
        if (reward.type === 'ngotinh') {
            const amount = reward.amount || 5;
            UserRepository_1.userRepository.update(userId, { ngotinh: (user.ngotinh || 0) + amount });
            return `🧘 Tâm cảnh sáng tỏ, Nhận **+${amount}** Ngộ Tính`;
        }
        if (reward.type === 'item' && reward.itemId) {
            let amount = reward.amount || 1;
            // Leyline Buff Thu Thập: 25% cơ hội rớt gấp đôi (hoặc thu hoạch x2)
            if (LeylineService_1.leylineService.isBuffActive('thuthap') && Math.random() < 0.25) {
                amount *= 2;
            }
            const item = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(reward.itemId);
            if (item) {
                InventoryRepository_1.inventoryRepository.addItem(userId, reward.itemId, amount);
                let message = `🎁 Nhặt được **${item.name}** x${amount}`;
                if (amount > (reward.amount || 1))
                    message += ' *(Linh Mạch Buff x2!)*';
                return message;
            }
        }
        return '🌫️ *Không có gì đặc biệt.*';
    }
    /**
     * Lấy thông tin chuyến thám hiểm hiện tại
     */
    getActiveExploration(userId) {
        return database_1.default.prepare("SELECT * FROM explorations WHERE user_id = ? AND (status = 'traveling' OR status = 'event_pending') ORDER BY id DESC LIMIT 1").get(userId);
    }
    /**
     * Lấy lịch sử thám hiểm gần đây
     */
    getHistory(userId, limit = 5) {
        return database_1.default.prepare("SELECT * FROM explorations WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT ?").all(userId, limit);
    }
    /**
     * Cập nhật tiến trình thành tựu thám hiểm dã ngoại
     */
    updateExplorationAchievements(userId) {
        try {
            const countResult = database_1.default.prepare("SELECT COUNT(*) as c FROM explorations WHERE user_id = ? AND status = 'completed'").get(userId);
            AchievementService_1.achievementService.setProgress(userId, 'cd_10', countResult.c);
            AchievementService_1.achievementService.setProgress(userId, 'cd_11', countResult.c);
        }
        catch (e) {
            console.error('[updateExplorationAchievements Error]', e);
        }
    }
    weightedRandom(items) {
        const total = items.reduce((s, i) => s + i.weight, 0);
        let rand = Math.random() * total;
        for (const item of items) {
            rand -= item.weight;
            if (rand <= 0)
                return item;
        }
        return items[items.length - 1];
    }
    // === A-05: Exploration Depth — Zones, Events, Goals ===
    goalInit = false;
    initGoals() {
        if (this.goalInit)
            return;
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS exploration_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        goal_type TEXT NOT NULL,
        target_value INTEGER NOT NULL,
        current_progress INTEGER DEFAULT 0,
        reward_type TEXT NOT NULL,
        reward_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL
      );
    `);
        this.goalInit = true;
    }
    /**
     * A-05: Get exploration zones (difficulty tiers)
     */
    getExplorationZones() {
        return [
            { zone: 1, name: 'Rừng Sương Mù', minLevel: 1, description: 'Khu rừng đầy sương mù, phù hợp người mới', rewards: 'Nguyên liệu cơ bản, thảo dược' },
            { zone: 2, name: 'Núi Đá Tuyết', minLevel: 30, description: 'Núi tuyết phủ trắng, nguyên liệu quý hiếm', rewards: 'Nguyên liệu uncommon, khoáng thạch' },
            { zone: 3, name: 'Thung Lũng Rồng', minLevel: 60, description: 'Thung lũng nơi rồng cư ngụ', rewards: 'Nguyên liệu rare, trứng rồng' },
            { zone: 4, name: 'Hang Động Sâu', minLevel: 100, description: 'Hang động sâu thẳm đầy bí ẩn', rewards: 'Nguyên liệu epic, kho báu cổ đại' },
            { zone: 5, name: 'Vực Sâu Vô Đáy', minLevel: 200, description: 'Vực sâu nơi thiên địa giao hòa', rewards: 'Nguyên liệu legendary, đá quý' },
        ];
    }
    /**
     * A-05: Create personal exploration goal
     */
    createGoal(userId, goalType, targetValue) {
        this.initGoals();
        const now = Math.floor(Date.now() / 1000);
        const rewards = {
            'explore_10': { type: 'coin', amount: 500 },
            'explore_25': { type: 'coin', amount: 1500 },
            'explore_50': { type: 'item', amount: 5 },
            'event_5': { type: 'exp', amount: 500 },
            'event_10': { type: 'coin', amount: 2000 },
        };
        const reward = rewards[goalType] || { type: 'coin', amount: 100 };
        database_1.default.prepare(`INSERT INTO exploration_goals (user_id, goal_type, target_value, reward_type, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)`)
            .run(userId, goalType, targetValue, reward.type, reward.amount, now);
        return { success: true, message: `🎯 Đã tạo mục tiêu: **${goalType}** (${targetValue} lần)` };
    }
    /**
     * A-05: Check and update exploration goals
     */
    checkGoals(userId) {
        this.initGoals();
        const goals = database_1.default.prepare("SELECT * FROM exploration_goals WHERE user_id = ? AND status = 'active'").all(userId);
        const completed = [];
        for (const goal of goals) {
            const count = database_1.default.prepare("SELECT COUNT(*) as c FROM explorations WHERE user_id = ? AND status = 'completed'").get(userId);
            if (count.c >= goal.target_value) {
                database_1.default.prepare("UPDATE exploration_goals SET status = 'completed', current_progress = ? WHERE id = ?")
                    .run(count.c, goal.id);
                // Award reward
                const user = UserRepository_1.userRepository.get(userId);
                if (user) {
                    if (goal.reward_type === 'coin') {
                        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + goal.reward_amount });
                    }
                    else if (goal.reward_type === 'exp') {
                        UserRepository_1.userRepository.update(userId, { tu_vi: Math.min(user.tu_vi + goal.reward_amount, user.exp_needed) });
                    }
                }
                completed.push({ goalId: goal.id, message: `🎯 Mục tiêu hoàn thành! +${goal.reward_amount} ${goal.reward_type}` });
            }
            else {
                database_1.default.prepare("UPDATE exploration_goals SET current_progress = ? WHERE id = ?")
                    .run(count.c, goal.id);
            }
        }
        return completed;
    }
    /**
     * A-05: Get exploration stats for UI
     */
    getExplorationStats(userId) {
        this.initGoals();
        const total = database_1.default.prepare("SELECT COUNT(*) as c FROM explorations WHERE user_id = ? AND status = 'completed'").get(userId);
        const activeGoals = database_1.default.prepare("SELECT COUNT(*) as c FROM exploration_goals WHERE user_id = ? AND status = 'active'").get(userId);
        const completedGoals = database_1.default.prepare("SELECT COUNT(*) as c FROM exploration_goals WHERE user_id = ? AND status = 'completed'").get(userId);
        return {
            totalExplorations: total.c,
            activeGoals: activeGoals.c,
            completedGoals: completedGoals.c
        };
    }
}
exports.explorationService = new ExplorationService();
