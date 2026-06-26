"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEIRLOOMS = exports.COMBO_BONUSES = exports.DESTINIES = exports.BACKGROUNDS = void 0;
exports.getLinhCanFlavorText = getLinhCanFlavorText;
exports.getOpeningScene = getOpeningScene;
exports.getDestinyLine = getDestinyLine;
exports.generateHeirloom = generateHeirloom;
exports.generateProphecy = generateProphecy;
exports.BACKGROUNDS = [
    {
        id: 'tu_chien_gia_toc',
        name: 'Con Nhà Tu Chân',
        emoji: '🏯',
        description: 'Sinh ra trong gia tộc tu chân danh giá. Được truyền thụ căn cơ từ nhỏ.',
        intro: `Từ thuở ấu thơ, ngươi đã quen với mùi đan dược và tiếng kiếm reo trong gia tộc. Cha mẹ là những tu sĩ có danh tiếng, dìu dắt ngươi từng bước trên con đường tu hành. Linh căn trong ngươi được gia tộc bồi dưỡng từ sớm, như một viên ngọc thô được mài giũa.

"Hãy nhớ, con đường tu tiên không chỉ có linh căn. Quan trọng hơn là tâm tính và ý chí." — Lời cha ngươi trước khi bế quan.

Ngươi khoác lên mình thanh bảo kiếm gia truyền, bước ra khỏi lãnh địa gia tộc, đối diện với thế giới tu chân rộng lớn. Một hành trình mới bắt đầu.`,
        bonuses: { hp: 50, atk: 5, lt: 200 },
        startingItem: { id: 'gia_truyen_kiem', name: 'Bảo Kiếm Gia Truyền', description: 'Thanh kiếm đã theo 3 đời gia chủ. Tuy không phải thần khí, nhưng chứa đựng ý chí của tổ tiên.' },
    },
    {
        id: 'phan_tran',
        name: 'Kẻ Phàm Trần',
        emoji: '🌾',
        description: 'Vốn là người thường, nhưng ý chí nghịch thiên cải mệnh.',
        intro: `Ngươi chẳng có gia thế, chẳng có sư môn. Chỉ có một đôi tay chai sần và một trái tim không bao giờ khuất phục.

Ngày còn bé, ngươi nhìn tiên nhân bay qua đỉnh núi, tự hỏi: "Sao họ làm được?" Hôm nay, câu hỏi ấy đã có câu trả lời. Linh căn trong ngươi vừa thức tỉnh — yếu ớt nhưng đầy tiềm năng.

"Mọi tiên nhân đều từng là phàm nhân. Điều khác biệt là dám bước lên con đường này." — Ngươi tự nhủ.

Không có gia tộc chống lưng, không có sư phụ dẫn dắt, ngươi chỉ có chính mình và linh căn vừa chớm nở. Lên đường thôi, tiền đồ do chính tay ngươi tạo lập.`,
        bonuses: { expRate: 10, lt: 500, crit: 2 },
        startingItem: null,
    },
    {
        id: 'ky_ngo_sinh_tu',
        name: 'Kỳ Ngộ Sinh Tử',
        emoji: '⚡',
        description: 'Suýt chết, được tiên nhân cứu và truyền linh căn.',
        intro: `Ngươi nhắm mắt lần cuối, nghĩ rằng mọi chuyện đã kết thúc. Vách núi, cơn lũ, hay con yêu thú — biên niên sử không còn nhớ rõ. Nhưng rồi, một bàn tay ấm áp chạm vào trán ngươi.

"Linh căn của ngươi vừa vụn vỡ, nhưng còn kịp."

Khi tỉnh dậy, ngươi thấy mình nằm trong một động phủ xa lạ. Bên cạnh là mảnh ngọc lấp lánh và một tờ giấy viết vội: "Cứu ngươi vì nhân quả. Đừng tìm ta. Sống tốt."

Ngươi không biết ân nhân là ai, nhưng trong cơ thể, một dòng linh khí mới đang chảy — linh căn thứ hai đã được cấy ghép. Món nợ ân tình này, biết bao giờ trả?`,
        bonuses: { def: 10, lt: 1000 },
        startingItem: { id: 'manh_ngoc_ho_menh', name: 'Mảnh Ngọc Hộ Mệnh', description: 'Khi HP về 0, tự động hồi 50% HP. Hiệu ứng 1 lần.' },
    },
    {
        id: 'de_tu_tan_tu',
        name: 'Đệ Tử Tán Tu',
        emoji: '🍃',
        description: 'Theo một tán tu già học đạo, biết nhiều mẹo vặt trong tu hành.',
        intro: `Sư phụ ngươi là một tán tu kỳ lạ. Ông sống trong túp lều ven rừng, xung quanh là hàng trăm cuốn bí tịch viết tay — cuốn dạy luyện đan, cuốn dạy bắt yêu thú, cuốn dạy cách phân biệt linh thảo.

"Tu tiên không phải là ngồi thiền cả ngày. Tu tiên là sống." — Sư phụ thường nói thế, khi đang lúi húi nấu một nồi thuốc kỳ lạ.

Giờ đây, sư phụ đã rời đi, tiếp tục cuộc hành trình của riêng ông. Ông để lại cho ngươi mấy cuốn bí tịch và câu nói cuối cùng:

"Đi đi. Học từ cuộc đời, không phải từ sách vở."

Ngươi khép cửa lều, bước vào thế giới rộng lớn — với vốn kiến thức tạp nham nhưng quý giá, và một trái tim đầy háo hức.`,
        bonuses: { speed: 5, mp: 30, lt: 300 },
        startingItem: { id: 'sach_khai_kinh', name: 'Sách Khai Kinh', description: 'Dùng 1 lần: nhân đôi EXP nhận được trong 30 phút.' },
    },
];
exports.DESTINIES = [
    {
        id: 'sat_tinh',
        name: 'Sát Tinh',
        emoji: '⚔️',
        description: 'Định mệnh chiến đấu, xông pha.',
        line: '"Trời sinh ta ắt có dụng. Chiến đấu là bản năng, là lẽ sống của ta."',
        bonuses: { atkPercent: 3, crit: 3 },
        penalties: { hpPercent: 5 },
    },
    {
        id: 'phuc_tinh',
        name: 'Phúc Tinh',
        emoji: '🍀',
        description: 'Định mệnh may mắn, cơ duyên.',
        line: '"Nhân quả tự có an bài. Việc của ta là đi đúng đường, phần thưởng sẽ đến."',
        bonuses: { expRate: 5, dropRate: 10 },
        penalties: { defPercent: 3 },
    },
    {
        id: 'tho_tinh',
        name: 'Thọ Tinh',
        emoji: '🐢',
        description: 'Định mệnh trường tồn, kiên nhẫn.',
        line: '"Chậm mà chắc. Trăm năm chẳng dài với kẻ biết chờ đợi."',
        bonuses: { hpPercent: 10, defPercent: 5 },
        penalties: { atkPercent: 3 },
    },
];
exports.COMBO_BONUSES = [
    { backgroundId: 'tu_chien_gia_toc', element: 'Hỏa', skillName: 'Hỏa Diễm Kiếm Pháp', skillDescription: 'Tấn công kèm lửa đốt, gây thêm 10% sát thương hệ Hỏa.', skillEffect: '{"type": "elemental_atk", "element": "fire", "bonus": 0.1}' },
    { backgroundId: 'tu_chien_gia_toc', element: 'Lôi', skillName: 'Lôi Kiếm Chém', skillDescription: 'Chém ra một nhát kiếm mang sấm sét, 20% choáng mục tiêu 1 hiệp.', skillEffect: '{"type": "stun", "chance": 0.2, "duration": 1}' },
    { backgroundId: 'phan_tran', element: 'Thổ', skillName: 'Hậu Tích Bộ Pháp', skillDescription: 'Thân pháp trầm ổn, +5% né tránh vĩnh viễn.', skillEffect: '{"type": "stat_buff", "stat": "dodge", "value": 0.05}' },
    { backgroundId: 'phan_tran', element: 'Mộc', skillName: 'Sinh Mệnh Chi Lực', skillDescription: 'Mỗi hiệp hồi 2% HP.', skillEffect: '{"type": "regen", "value": 0.02}' },
    { backgroundId: 'ky_ngo_sinh_tu', element: 'Thủy', skillName: 'Trị Liệu Chi Thuật', skillDescription: 'Hồi 5% HP mỗi hiệp.', skillEffect: '{"type": "regen", "value": 0.05}' },
    { backgroundId: 'ky_ngo_sinh_tu', element: 'Lôi', skillName: 'Thiên Lôi Hộ Thể', skillDescription: 'Phản 5% sát thương nhận vào.', skillEffect: '{"type": "reflect", "value": 0.05}' },
    { backgroundId: 'de_tu_tan_tu', element: 'Thủy', skillName: 'Đan Dược Tinh Thông', skillDescription: 'Khi dùng đan dược, hiệu quả tăng 15%.', skillEffect: '{"type": "potion_boost", "value": 0.15}' },
    { backgroundId: 'de_tu_tan_tu', element: 'Hỏa', skillName: 'Luyện Đan Thuật Sơ Cấp', skillDescription: 'Tăng 10% tỷ lệ thành công khi luyện đan.', skillEffect: '{"type": "craft_boost", "skill": "alchemy", "value": 0.1}' },
    { backgroundId: 'ky_ngo_sinh_tu', element: 'Phong', skillName: 'Phong Bộ', skillDescription: '+5% speed vĩnh viễn.', skillEffect: '{"type": "stat_buff", "stat": "speed", "value": 0.05}' },
    { backgroundId: 'de_tu_tan_tu', element: 'Phong', skillName: 'Phi Độn Thuật', skillDescription: 'Khi làm việc, tốn ít 10% thể lực.', skillEffect: '{"type": "stamina_save", "value": 0.1}' },
];
function getLinhCanFlavorText(element, percent) {
    const flavors = {
        Hỏa: [
            'Ngọn lửa cuồn cuộn trong đan điền, như muốn thiêu rụi mọi thứ.',
            'Một nguồn nhiệt vô hình chảy trong kinh mạch, nóng rực như dung nham.',
            'Linh khí hệ Hỏa quanh ngươi như vũ điệu của những ngọn lửa bất diệt.',
        ],
        Thủy: [
            'Dòng nước mát lành luân chuyển trong cơ thể, ôn hòa mà thâm trầm.',
            'Linh khí tựa dòng suối chảy nhẹ trong kinh mạch, tĩnh lặng mà sâu xa.',
            'Nước là nguồn sống, và trong ngươi, dòng chảy ấy cuộn trào không ngừng.',
        ],
        Mộc: [
            'Sức sống mãnh liệt như cây cổ thụ vươn mình trong nắng sớm.',
            'Linh khí Mộc trong ngươi mang hơi thở của rừng già, của sự sống sinh sôi.',
            'Từng tế bào như hút nhựa sống từ lòng đất, mạnh mẽ và dẻo dai.',
        ],
        Thổ: [
            'Vững chãi như núi đá, linh khí trầm lắng chảy trong huyết mạch.',
            'Ngươi cảm nhận được lòng đất, sự ổn định và sức mạnh kiên cố.',
            'Thổ khí ôm ấp lấy ngươi như lòng mẹ hiền, che chở và nuôi dưỡng.',
        ],
        Lôi: [
            'Những tia sét xé toạc không gian trong cơ thể, mạnh mẽ và bất kham.',
            'Linh khí Lôi trong ngươi gầm thét — sức mạnh hủy diệt và tái sinh đồng thời.',
            'Sấm sét cuộn trào trong huyết mạch, một nguồn năng lượng hoang dã khó thuần.',
        ],
        Phong: [
            'Tựa cơn gió nhẹ, thanh thoát mà không gì cản nổi.',
            'Linh khí Phong luồn lách qua từng thớ thịt, nhẹ nhàng nhưng sắc bén.',
            'Gió là tự do, và trong ngươi, cơn gió ấy đang chờ được giải phóng.',
        ],
    };
    const options = flavors[element] || ['Linh căn của ngươi chứa một nguồn năng lượng bí ẩn.'];
    return options[Math.floor(Math.random() * options.length)];
}
function getOpeningScene(name, backgroundId) {
    const scenes = {
        tu_chien_gia_toc: `Giữa khu rừng linh khí dày đặc, ${name} đứng trước cổng sơn môn của gia tộc. Phía sau là những tòa lầu các nguy nga, phía trước là thế giới bao la. Một cánh chim bằng lướt qua bầu trời — điềm báo cho một hành trình không giới hạn.`,
        phan_tran: `Bình minh ló rạng trên ngôi làng nhỏ. ${name} thắt lại bọc hành lý, nhìn lần cuối căn nhà tranh vách đất. Không lưu luyến, chỉ có quyết tâm. Một bước chân — và cả thế giới tu chân mở ra trước mắt.`,
        ky_ngo_sinh_tu: `${name} tỉnh dậy trong một khu rừng xa lạ. Đầu còn ong ong, nhưng trong cơ thể — một sức mạnh mới đang ùa về. Ai đã cứu mình? Và tại sao? Những câu hỏi đó sẽ còn ở lại, nhưng lúc này, hãy bước tiếp.`,
        de_tu_tan_tu: `Cánh cửa lều khép lại sau lưng ${name}. Bên trong, những cuốn sách cũ nằm im — nhưng tri thức thì đã đồng hành cùng ngươi ra ngoài kia. Một cơn gió thổi qua, cuốn theo mấy chiếc lá vàng. Hành trình bắt đầu.`,
    };
    return scenes[backgroundId] || `${name} bước vào thế giới tu chân rộng lớn, nơi vô vàn kỳ ngộ và thử thách đang chờ đón.`;
}
function getDestinyLine(destinyId) {
    const destiny = exports.DESTINIES.find(d => d.id === destinyId);
    return destiny?.line || 'Số phận nằm trong tay ngươi.';
}
exports.HEIRLOOMS = [
    { id: 'manh_ngoc_bich', name: 'Mảnh Ngọc Bích Vỡ', icon: '💚', description: 'Mảnh ngọc duy nhất còn sót lại từ gia tộc thần bí. Nghe nói ghép đủ 6 mảnh sẽ mở ra bí mật kinh thiên.', effect: '+1% Luck' },
    { id: 'la_ban_ri_set', name: 'La Bàn Rỉ Sét', icon: '🧭', description: 'Chiếc la bàn cổ, kim luôn chỉ về một hướng. Có thể nó dẫn đến kho báu... hoặc cái bẫy.', effect: 'Gợi ý kỳ ngộ ẩn' },
    { id: 'linh_hoa_kho', name: 'Linh Hoa Khô', icon: '🌸', description: 'Đóa hoa từng nở rực rỡ trong vườn thượng cổ. Dù khô héo, nó vẫn tỏa ra linh khí nhè nhẹ.', effect: '+1% Drop Rate' },
    { id: 'dong_xu_ma_co', name: 'Đồng Xu Ma Cổ', icon: '🪙', description: 'Khắc hình yêu thú cổ đại, tỏa ra hơi thở ma khí nhẹ. Có người muốn mua nó giá cao.', effect: '+1% ATK' },
    { id: 'long_vu_phuong_hoang', name: 'Lông Vũ Phượng Hoàng', icon: '🔥', description: 'Sưởi ấm kỳ lạ, như có ngọn lửa chảy trong từng sợi lông. Tin đồn nó thuộc về Phượng Hoàng cuối cùng.', effect: '+1% Speed' },
    { id: 'vay_rong_den', name: 'Vảy Rồng Đen', icon: '🛡️', description: 'Còn sót lại từ trận chiến giữa Tiên và Ma 3000 năm trước. Mảnh vảy này đã chứng kiến đại chiến.', effect: '+1% DEF' }
];
function generateHeirloom() {
    return exports.HEIRLOOMS[Math.floor(Math.random() * exports.HEIRLOOMS.length)];
}
function generateProphecy(backgroundId, destinyId, element) {
    const bgTemplates = {
        tu_chien_gia_toc: {
            phuc_tinh: "Dòng máu tổ tông / Phượng hoàng tái thế",
            sat_tinh: "Gia tộc suy vong / Nghiệp chướng đeo mang",
            tho_tinh: "Rời xa gia tộc / Ẩn danh giữa đời"
        },
        phan_tran: {
            phuc_tinh: "Tay trắng dựng cơ đồ / Cơ duyên trời ban",
            sat_tinh: "Nợ đời chưa trả / Đường gian nan lắm",
            tho_tinh: "Vô danh tiểu tốt / Lá rụng giữa dòng"
        },
        de_tu_tan_tu: {
            phuc_tinh: "Trời đất bao la / Gặp thời thế tạo",
            sat_tinh: "Sát khí đầy mình / Nghiệp lực quấn thân",
            tho_tinh: "Mây bay gió thổi / Chẳng ai biết tên"
        },
        ky_ngo_sinh_tu: {
            phuc_tinh: "Sư môn vinh hiển / Đệ tử xuất chúng",
            sat_tinh: "Môn quy phá vỡ / Đường về xa xăm",
            tho_tinh: "Núi sâu ai biết / Ẩn tu một mình"
        }
    };
    const elementSuffix = {
        Kim: "Kiếm khí ngút trời",
        Mộc: "Cây xanh tỏa bóng",
        Thủy: "Nước chảy đá mòn",
        Hỏa: "Lửa thiêu rực rỡ",
        Thổ: "Núi cao vững chãi",
        Lôi: "Sấm sét xé trời",
        Phong: "Gió cuộn mây ngàn"
    };
    const pool = [
        "Phải chăng tất cả là định mệnh?", "Có ai ngờ được ngày sau...",
        "Vậy mà ta cứ đi...", "Trời cao biết chẳng?", "Luân hồi có lối...",
        "Vạn sự tùy duyên.", "Bước chân không mỏi.", "Cõi mộng hư vô.",
        "Kiếp này đành vậy.", "Mệnh trời khó cãi.", "Một niệm thành ma, một niệm thành Phật.",
        "Sóng gió chưa yên.", "Mưa rơi nặng hạt.", "Ai hát khúc bi ca?",
        "Người về nơi đâu?", "Chỉ còn tiếng gió.", "Hành trình vô tận.",
        "Chấp niệm buông xuôi.", "Trăng tàn bóng khuyết.", "Một giấc Nam Kha."
    ];
    const line1 = bgTemplates[backgroundId]?.[destinyId] || "Mệnh trời vô định / Hành trình vô tận";
    const line2 = elementSuffix[element] || "Linh khí mờ ảo";
    const line3 = pool[Math.floor(Math.random() * pool.length)];
    return `${line1}\n${line2}\n${line3}`;
}
