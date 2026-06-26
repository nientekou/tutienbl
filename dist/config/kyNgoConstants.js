"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KY_NGO_MAX_CHANCE = exports.KY_NGO_LUCK_BONUS = exports.KY_NGO_BASE_CHANCE = exports.KY_NGO_EVENTS = void 0;
exports.KY_NGO_EVENTS = [
    {
        type: 'breakthrough_inspiration',
        title: '💡 Đột Phát Linh Quang',
        description: 'Đang tu luyện, ngươi cảm thấy một tia sáng lóe lên trong tâm trí…',
        choices: [
            {
                id: 'seize', label: '🔵 Chớp lấy cảm ngộ',
                successRate: 0.6,
                successReward: { type: 'breakthrough_rate', value: 25 },
                failurePenalty: { type: 'qi_deviation', value: 10 },
                riskLevel: 'medium'
            },
            {
                id: 'steady', label: '🟢 Tu luyện vững chắc (bình thường)',
                successRate: 0.95,
                successReward: { type: 'cultivation_speed', value: 10, duration: 24 },
                failurePenalty: { type: 'exp', value: -50 },
                riskLevel: 'low'
            }
        ],
        minRealm: 0, weight: 30, cooldownHours: 12
    },
    {
        type: 'wandering_cultivator',
        title: '🧑‍🦳 Lữ Hành Giả Du Già',
        description: 'Một lữ hành già nua xuất hiện, ánh mắt thâm thúy: "Tiểu hữu, ta có một vật trao tặng…"',
        choices: [
            {
                id: 'accept', label: '🔵 Nhận vật phẩm',
                successRate: 0.5,
                successReward: { type: 'exp', value: 500 },
                failurePenalty: { type: 'stat_temp', value: -20 },
                riskLevel: 'medium'
            },
            {
                id: 'decline', label: '⚪ Từ chối lịch sự',
                successRate: 1.0,
                successReward: { type: 'cultivation_speed', value: 5, duration: 12 },
                failurePenalty: { type: 'exp', value: -10 },
                riskLevel: 'low'
            },
            {
                id: 'rob', label: '🔴 Cướp lấy!',
                successRate: 0.15,
                successReward: { type: 'exp', value: 2000 },
                failurePenalty: { type: 'qi_deviation', value: 30 },
                riskLevel: 'high'
            }
        ],
        minRealm: 5, weight: 20, cooldownHours: 24
    },
    {
        type: 'meditation_insight',
        title: '🧘 Minh Tâm Kiến Tính',
        description: 'Trong lúc nhập định, ngươi cảm nhận được một sợi dây liên kết với thiên đạo…',
        choices: [
            {
                id: 'deep', label: '🔵 Nhập định sâu',
                successRate: 0.4,
                successReward: { type: 'tu_vi', value: 200 },
                failurePenalty: { type: 'qi_deviation', value: 15 },
                riskLevel: 'medium'
            },
            {
                id: 'observe', label: '🟢 Quan sát rồi xuất định',
                successRate: 0.9,
                successReward: { type: 'cultivation_speed', value: 15, duration: 6 },
                failurePenalty: { type: 'exp', value: -30 },
                riskLevel: 'low'
            }
        ],
        minRealm: 10, weight: 25, cooldownHours: 8
    },
    {
        type: 'ancient_formation',
        title: '🏛️ Trận Pháp Cổ Đại',
        description: 'Ngươi phát hiện một trận pháp cổ đại ẩn trong hang động…',
        choices: [
            {
                id: 'study', label: '🔵 Nghiên cứu trận pháp',
                successRate: 0.35,
                successReward: { type: 'breakthrough_rate', value: 35 },
                failurePenalty: { type: 'qi_deviation', value: 20 },
                riskLevel: 'medium'
            },
            {
                id: 'absorb', label: '🔴 Hấp thụ linh khí trong trận',
                successRate: 0.25,
                successReward: { type: 'tu_vi', value: 500 },
                failurePenalty: { type: 'qi_deviation', value: 40 },
                riskLevel: 'high'
            },
            {
                id: 'leave', label: '⚪ Rời đi an toàn',
                successRate: 1.0,
                successReward: { type: 'exp', value: 100 },
                failurePenalty: { type: 'exp', value: -10 },
                riskLevel: 'low'
            }
        ],
        minRealm: 15, weight: 15, cooldownHours: 48
    },
    {
        type: 'spirit_spring',
        title: '⛲ Linh Tuyền Ẩn Mật',
        description: 'Một dòng suối trong vắt tỏa ra linh khí đậm đặc xuất hiện trước mắt…',
        choices: [
            {
                id: 'bathe', label: '🔵 Tắm rửa trong linh tuyền',
                successRate: 0.55,
                successReward: { type: 'cultivation_speed', value: 30, duration: 12 },
                failurePenalty: { type: 'qi_deviation', value: 12 },
                riskLevel: 'medium'
            },
            {
                id: 'collect', label: '🟢 Thu thập linh tuyền',
                successRate: 0.8,
                successReward: { type: 'exp', value: 300 },
                failurePenalty: { type: 'exp', value: -20 },
                riskLevel: 'low'
            },
            {
                id: 'divert', label: '🔴 Đổi hướng dòng linh khí',
                successRate: 0.2,
                successReward: { type: 'tu_vi', value: 800 },
                failurePenalty: { type: 'qi_deviation', value: 35 },
                riskLevel: 'high'
            }
        ],
        minRealm: 20, weight: 18, cooldownHours: 36
    },
    {
        type: 'ancient_scroll',
        title: '📜 Tàn Phiên Cổ Thư',
        description: 'Một cuộn thư mục nát nằm dưới tảng đá, ánh sáng mờ ảo tỏa ra…',
        choices: [
            {
                id: 'decipher', label: '🔵 Giải mã cổ thư',
                successRate: 0.3,
                successReward: { type: 'breakthrough_rate', value: 40 },
                failurePenalty: { type: 'qi_deviation', value: 25 },
                riskLevel: 'medium'
            },
            {
                id: 'absorb_gi', label: '🔴 Hấp thụ linh khí cổ thư',
                successRate: 0.2,
                successReward: { type: 'tu_vi', value: 1000 },
                failurePenalty: { type: 'qi_deviation', value: 45 },
                riskLevel: 'high'
            },
            {
                id: 'preserve', label: '⚪ Bảo tồn cổ thư',
                successRate: 0.95,
                successReward: { type: 'exp', value: 150 },
                failurePenalty: { type: 'exp', value: -5 },
                riskLevel: 'low'
            }
        ],
        minRealm: 25, weight: 12, cooldownHours: 72
    },
    {
        type: 'heart_law_meditation',
        title: '🧘 Tâm Pháp Tham Ngộ',
        description: 'Một luồng sáng tâm pháp hiện ra giữa thinh không, cổ động ngươi tham ngộ…',
        choices: [
            {
                id: 'insight', label: '🔵 Tham ngộ sâu',
                successRate: 0.35,
                successReward: { type: 'heart_law_exp', value: 200 },
                failurePenalty: { type: 'qi_deviation', value: 20 },
                riskLevel: 'medium'
            },
            {
                id: 'observe_hl', label: '🟢 Quan sát cẩn thận',
                successRate: 0.85,
                successReward: { type: 'heart_law_exp', value: 80 },
                failurePenalty: { type: 'exp', value: -30 },
                riskLevel: 'low'
            }
        ],
        minRealm: 50, weight: 15, cooldownHours: 36
    },
    {
        type: 'soul_imprint_trial',
        title: '⚡ Thử Thách Ấn Ký',
        description: 'Ấn ký cổ đại trên cơ thể đạo hữu bỗng rung động, thử thách đang đến…',
        choices: [
            {
                id: 'endure', label: '🔵 Chịu đựng thử thách',
                successRate: 0.4,
                successReward: { type: 'tu_vi', value: 1500 },
                failurePenalty: { type: 'qi_deviation', value: 25 },
                riskLevel: 'medium'
            },
            {
                id: 'resist', label: '🔴 Phản kháng quyết liệt',
                successRate: 0.2,
                successReward: { type: 'tu_vi', value: 4000 },
                failurePenalty: { type: 'qi_deviation', value: 40 },
                riskLevel: 'high'
            },
            {
                id: 'harmonize', label: '🟢 Hòa giải ấn ký',
                successRate: 0.9,
                successReward: { type: 'cultivation_speed', value: 25, duration: 24 },
                failurePenalty: { type: 'exp', value: -50 },
                riskLevel: 'low'
            }
        ],
        minRealm: 100, weight: 12, cooldownHours: 48
    },
    {
        type: 'prestige_destiny',
        title: '🌟 Tiên Cơ Prestige',
        description: 'Thiên đạo mở ra một khe hở, cho ngươi thấy cơ hội chuyển kiếp…',
        choices: [
            {
                id: 'grasp', label: '🔵 Chộp lấy cơ hội',
                successRate: 0.3,
                successReward: { type: 'prestige_token', value: 2 },
                failurePenalty: { type: 'qi_deviation', value: 30 },
                riskLevel: 'medium'
            },
            {
                id: 'meditate_p', label: '🟢 Đạo tâm vững vàng',
                successRate: 0.9,
                successReward: { type: 'cultivation_speed', value: 30, duration: 48 },
                failurePenalty: { type: 'exp', value: -100 },
                riskLevel: 'low'
            }
        ],
        minRealm: 200, weight: 10, cooldownHours: 72
    },
    {
        type: 'thien_dao_enlightenment',
        title: '🌌 Thiên Đạo Khai Ngộ',
        description: 'Trời đất rung chuyển, ánh sáng vạn trượng bao phủ thân thể đạo hữu…',
        choices: [
            {
                id: 'merge', label: '🔴 Hợp nhất Thiên Đạo',
                successRate: 0.15,
                successReward: { type: 'tu_vi', value: 8000 },
                failurePenalty: { type: 'qi_deviation', value: 50 },
                riskLevel: 'high'
            },
            {
                id: 'absorb_td', label: '🔵 Hấp thụ từng phần',
                successRate: 0.5,
                successReward: { type: 'tu_vi', value: 3000 },
                failurePenalty: { type: 'qi_deviation', value: 20 },
                riskLevel: 'medium'
            },
            {
                id: 'witness', label: '🟢 Chỉ quan sát',
                successRate: 1.0,
                successReward: { type: 'breakthrough_rate', value: 30 },
                failurePenalty: { type: 'exp', value: -20 },
                riskLevel: 'low'
            }
        ],
        minRealm: 300, weight: 8, cooldownHours: 96
    }
];
exports.KY_NGO_BASE_CHANCE = 0.08;
exports.KY_NGO_LUCK_BONUS = 0.002;
exports.KY_NGO_MAX_CHANCE = 0.25;
