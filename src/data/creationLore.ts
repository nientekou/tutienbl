export interface Background {
  id: string;
  name: string;
  emoji: string;
  description: string;
  intro: string; // story paragraph when chosen
  bonuses: Partial<{
    hp: number;
    atk: number;
    def: number;
    mp: number;
    crit: number;
    expRate: number; // %
    dropRate: number;
    speed: number; // work speed %
    lt: number; // starting LT
    knb: number;
  }>;
  startingItem: { id: string; name: string; description: string } | null;
}

export interface Destiny {
  id: string;
  name: string;
  emoji: string;
  description: string;
  line: string; // story flavor line
  bonuses: Partial<{
    atkPercent: number;
    defPercent: number;
    hpPercent: number;
    crit: number;
    expRate: number;
    dropRate: number;
  }>;
  penalties: Partial<{
    atkPercent: number;
    defPercent: number;
    hpPercent: number;
    crit: number;
  }>;
}

export interface ComboBonus {
  backgroundId: string;
  element: string; // linh can element
  skillName: string;
  skillDescription: string;
  skillEffect: string; // JSON effect
}

export const BACKGROUNDS: Background[] = [
  {
    id: 'tu_chien_gia_toc',
    name: 'Con Nhà Tu Chân',
    emoji: '🏯',
    description: 'Sinh ra nơi tiên gia vọng tộc, căn cơ đã được nuôi dưỡng từ thuở lọt lòng.',
    intro: `Ngươi lớn lên giữa tiếng chuông sơn môn và mùi hương đan dược. Trong tiên phủ, kiếm quyết được học trước cả cách cầm bút, linh khí đã thấm vào từng hơi thở từ thuở còn thơ.
    Trước ngày rời gia môn, phụ thân chỉ nói một câu:
    "Kẻ mang họ tộc chỉ là xuất thân. Kẻ giữ được đạo tâm mới có thể một bước đăng đồ."
    Mang theo thanh kiếm gia truyền, ngươi bước khỏi tiên phủ. Thiên địa mênh mang phía trước, từ hôm nay đều phải tự mình đi qua.`,
    bonuses: { hp: 50, atk: 5, lt: 200 },
    startingItem: { id: 'gia_truyen_kiem', name: 'Bảo Kiếm Gia Truyền', description: 'Thanh kiếm đã theo 3 đời gia chủ. Tuy không phải thần khí, nhưng chứa đựng ý chí của tổ tiên.' },
  },
  {
    id: 'phan_tran',
    name: 'Kẻ Phàm Trần',
    emoji: '🌾',
    description: 'Không tiên duyên, không chỗ dựa. Chỉ có một lòng nghịch mệnh.',
    intro: `Ngươi sinh ra giữa khói bếp và ruộng đồng, cả đời chưa từng chạm đến linh khí.
            Cho đến một ngày, bầu trời xuất hiện linh quang, kinh mạch trong ngươi bừng tỉnh.
            Người đời gọi đó là cơ duyên.
            Ngươi gọi đó là lần đầu tiên số mệnh chịu mở mắt nhìn mình.
            Không có sư môn, không có gia tộc. Chỉ có một con đường kéo dài đến tận cuối chân trời.`,
    bonuses: { expRate: 10, lt: 500, crit: 2 },
    startingItem: null,
  },
  {
    id: 'ky_ngo_sinh_tu',
    name: 'Kỳ Ngộ Sinh Tử',
    emoji: '⚡',
    description: 'Một lần chết hụt, đổi lấy một đoạn nhân quả không thuộc về mình.',
    intro: `Giữa ranh giới sinh tử, có người đã cứu ngươi.
            Khi tỉnh dậy, động phủ chỉ còn một mảnh ngọc và một dòng chữ đã phai:
            "Cứu ngươi vì nhân quả."
            Linh căn tưởng đã tan vỡ lại được nối liền bằng một nguồn linh lực xa lạ.
            Từ ngày ấy, trong người ngươi luôn tồn tại một khí tức không thuộc về chính mình.,
    bonuses: { def: 10, lt: 1000 },
    startingItem: { id: 'manh_ngoc_ho_menh', name: 'Mảnh Ngọc Hộ Mệnh', description: 'Khi HP về 0, tự động hồi 50% HP. Hiệu ứng 1 lần.' },
  },
  {
    id: 'de_tu_tan_tu',
    name: 'Đệ Tử Tán Tu',
    emoji: '🍃',
    description: 'Theo một tán tu học đạo, lấy thiên địa làm sư, lấy nhân gian làm sách.',
    intro: `Sư phụ chẳng có tông môn, cũng chẳng có danh hiệu.
            Ông dạy ngươi nhận biết linh thảo trong khe núi, nhìn thiên tượng đoán linh triều, luyện một nồi đan còn quan trọng hơn thuộc một cuốn kiếm phổ.
            Ngày ông rời đi, chỉ để lại một túi càn khôn cũ cùng một câu nói:
            "Đừng học cách thành tiên. Học cách sống giữa thiên địa."
            Thế là ngươi lên đường.`,
    bonuses: { speed: 5, mp: 30, lt: 300 },
    startingItem: { id: 'sach_khai_kinh', name: 'Sách Khai Kinh', description: 'Dùng 1 lần: nhân đôi EXP nhận được trong 30 phút.' },
  },
];

export const DESTINIES: Destiny[] = [
  {
    id: 'sat_tinh',
    name: 'Sát Tinh',
    emoji: '⚔️',
    description: 'Mệnh cách chủ sát, lấy chiến dưỡng đạo',
    line: '"Một thân kiếm ý, lấy sát phạt mở một con đường tiến bước."',
    bonuses: { atkPercent: 3, crit: 3 },
    penalties: { hpPercent: 5 },
  },
  {
    id: 'phuc_tinh',
    name: 'Phúc Tinh',
    emoji: '🍀',
    description: 'Mệnh cách tụ phúc, cơ duyên thường tự tìm đến.',
    line: '"Thiên địa có nhân quả, phúc duyên chỉ đến với người biết chờ."',
    bonuses: { expRate: 5, dropRate: 10 },
    penalties: { defPercent: 3 },
  },
  {
    id: 'tho_tinh',
    name: 'Thọ Tinh',
    emoji: '🐢',
    description: 'Mệnh cách trường sinh, lấy thời gian thắng thiên địa.',
    line: '"Ngàn năm cũng chỉ là một lần hít thở với kẻ giữ được đạo tâm."',
    bonuses: { hpPercent: 10, defPercent: 5 },
    penalties: { atkPercent: 3 },
  },
];

export const COMBO_BONUSES: ComboBonus[] = [
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

export function getLinhCanFlavorText(element: string, percent: number): string {
  const flavors: Record<string, string[]> = {
    Hỏa: [
      'Hỏa linh trong đan điền bừng cháy như một vầng dương chưa mọc.',
      'Kinh mạch nóng rực, linh khí hệ Hỏa tựa dung nham chảy qua huyết mạch.',
      'Một tia hỏa ý vừa thức tỉnh, dường như chỉ chờ ngày thiêu rụi cửu tiêu.',
    ],
    Thủy: [
      'Linh khí chảy như thủy triều, tĩnh lặng nhưng sâu không thấy đáy.',
      'Trong cơ thể vang lên tiếng nước nhỏ giọt từ vực sâu xa xăm.',
      'Thủy linh ôn hòa bao phủ kinh mạch, tựa biển lớn nuôi dưỡng vạn vật.',
    ],
    Mộc: [
      'Một sợi mộc ý bén rễ trong đan điền, tựa mầm non xuyên qua đá cứng.',
      'Linh khí Mộc lan dọc kinh mạch, mang theo hơi thở của cổ lâm ngàn năm.',
      'Trong huyết mạch phảng phất mùi cỏ cây sau cơn mưa, sinh cơ lặng lẽ nảy nở.',
    ],
    Thổ: [
      'Thổ linh trầm xuống đan điền như một ngọn núi cắm rễ giữa thiên địa.',
      'Linh khí Thổ dày nặng mà ôn hòa, từng tấc kinh mạch đều trở nên vững chãi.',
      'Ngươi cảm nhận được nhịp thở của đại địa, tựa khoáng mạch ngủ yên dưới Hoang Sơn.',
    ],
    Lôi: [
      'Một tiếng lôi minh vang lên trong đan điền.',
      'Lôi ý chưa thành hình nhưng đã khiến linh khí quanh người rung chuyển.',
      'Từng tia điện tím lướt qua kinh mạch, như thiên kiếp còn sót lại.',
    ],
    Phong: [
      'Phong linh vô hình, nhưng từng hơi thở đều trở nên nhẹ hơn.',
      'Gió luồn qua kinh mạch, mang theo cảm giác tự do khó nắm bắt.',
      'Linh khí hệ Phong tựa mây trôi, không hình không tướng.',
    ],
  };
  const options = flavors[element] || ['Linh căn của ngươi chứa một nguồn năng lượng bí ẩn.'];
  return options[Math.floor(Math.random() * options.length)];
}

export function getOpeningScene(name: string, backgroundId: string): string {
  const scenes: Record<string, string> = {
    tu_chien_gia_toc: `Chuông sơn môn ngân vang ba hồi.
                      ${name} cúi người trước tổ đường, nhận lấy kiếm gia truyền rồi bước xuống từng bậc đá.
                      Mây mù tan dần, Thương Mang Thiên Hạ hiện ra dưới chân núi.`,
    phan_tran: `Bình minh phủ lên dãy Thương Mang.
                ${name} ngoái nhìn căn nhà tranh lần cuối. Phía trước là thiên hạ rộng lớn, nơi tiên môn dựng giữa mây trời, nơi yêu thú ẩn trong hoang vực, nơi cơ duyên và sát kiếp cùng tồn tại.
                Một bước chân rời khỏi quê cũ.
                Từ hôm nay, thiên địa chính là đường đi của ngươi.`,
    ky_ngo_sinh_tu: `${name} mở mắt giữa một khu rừng chưa từng đặt chân tới.
                    Sương phủ kín cành lá, trong không khí còn vương một mùi máu rất nhạt. Ký ức trước đó chỉ còn lại một khoảng trống.
                    Trong đan điền, một luồng linh lực xa lạ đang lặng lẽ lưu chuyển, như vốn đã thuộc về ngươi từ rất lâu.
                    Ai đã cứu ngươi?
                    Không có câu trả lời.
                    Chỉ có con đường phía trước vẫn kéo dài giữa Thương Mang...`,
    de_tu_tan_tu: `Cánh cửa căn lều khép lại sau lưng ${name}.
                  Trên chiếc bàn gỗ cũ chỉ còn vài cuốn đạo kinh đã sờn mép, một chiếc túi càn khôn cũ và bếp lửa vừa tắt.
                  Sư phụ chưa từng nói khi nào sẽ trở về.
                  Gió lướt qua rừng trúc, mang theo tiếng lá xào xạc.
                  Từ hôm nay, thiên địa là sư, sơn hải là đường.`,
  };
  return scenes[backgroundId] || `${name} bước vào Thương Mang Thiên Hạ, nơi sơn hải vô tận, nhân quả đan xen, cơ duyên và sát kiếp cùng tồn tại dưới một bầu trời.`;
}

export function getDestinyLine(destinyId: string): string {
  const destiny = DESTINIES.find(d => d.id === destinyId);
  return destiny?.line || 'Số phận nằm trong tay ngươi.';
}

export const HEIRLOOMS = [
  { id: 'manh_ngoc_bich', name: 'Thiên Khuyết Ngọc', icon: '<:tvngoc:1547899787918053376>', description: 'Một mảnh cổ ngọc khuyết mất nửa bên, tương truyền là chìa khóa mở ra một cánh cửa đã biến mất khỏi Thương Mang Thiên Hạ.', effect: '+1% Luck' },
  { id: 'la_ban_ri_set', name: 'Tinh Hải La Bàn', icon: '<:tvlaban:1547899793131438120>', description: 'Chiếc la bàn cũ kỹ không còn chỉ phương hướng của nhân gian. Mỗi khi tinh tượng đổi dời, kim bàn lại khẽ rung, dường như đang tìm kiếm một nơi chưa từng xuất hiện trên địa đồ.', effect: 'Gợi ý kỳ ngộ ẩn' },
  { id: 'linh_hoa_kho', name: 'Sở Tư Tàn Hoa', icon: '<:tvtanhoa:1547899795295707156>', description: 'Một đóa hoa đã héo từ rất lâu nhưng chưa từng mục nát. Cánh hoa giữ nguyên sắc đỏ như ngày vừa nở, mang theo một đoạn nhân quả chưa được khép lại.', effect: '+1% Drop Rate' },
  { id: 'dong_xu_ma_co', name: 'Cổ Ma Tiền', icon: '<:tvtien:1547899790774247465>', description: 'Đồng tiền cổ đúc từ thứ kim loại không ai nhận ra. Một mặt khắc tiên văn, một mặt khắc ma văn; lưu truyền rằng chỉ khi nhân quả giao nhau, nó mới hiện giá trị thật.', effect: '+1% ATK' },
  { id: 'long_vu_phuong_hoang', name: 'Phượng Linh Vũ', icon: '<:tvphuong:1547900684106735636>', description: 'Chiếc linh vũ rơi từ một con thiên phượng giữa biển mây. Dẫu trải qua ngàn năm, đầu lông vẫn lưu chuyển ánh hỏa quang nhàn nhạt.', effect: '+1% Speed' },
  { id: 'vay_rong_den', name: 'Nghịch Lân Cổ Long', icon: '<:tvlong:1547899782641483786>', description: 'Chiếc vảy mọc ngược nơi cổ chân long. Long có nghịch lân, chạm vào tất nổi long uy. Trong vảy vẫn còn lưu lại một tia long tức chưa từng tiêu tán.', effect: '+1% DEF' }
];

export function generateHeirloom() {
  return HEIRLOOMS[Math.floor(Math.random() * HEIRLOOMS.length)];
}

export function generateProphecy(backgroundId: string, destinyId: string, element: string): string {
  const bgTemplates: Record<string, Record<string, string>> = {
    tu_chien_gia_toc: {
      phuc_tinh: "Tiên phủ còn hưng, một mạch truyền ba đời",
      sat_tinh: "Kiếm chỉ huyết thân, gia môn gặp kiếp.",
      tho_tinh: "Rời tiên phủ, giữ một đời vô danh."
    },
    phan_tran: {
      phuc_tinh: "Cỏ dại cũng có ngày hóa linh mộc.",
      sat_tinh: "Một thân phàm cốt, dám nghịch thiên mệnh.",
      tho_tinh: "Đại đạo vô danh, người đời chẳng nhớ."
    },
    de_tu_tan_tu: {
      phuc_tinh: "Trời đất rộng dài, gặp thời ắt dựng nghiệp.",
      sat_tinh: "Sát khí nhập mệnh, một đời khó tránh phong ba.",
      tho_tinh: "Mây bay bốn hướng, chẳng ai biết người về đâu."
    },
    ky_ngo_sinh_tu: {
      phuc_tinh: "Sư môn còn thịnh, hậu bối ắt có người thành danh.",
      sat_tinh: "Môn quy một bước phá, đường về vạn dặm xa.",
      tho_tinh: "Núi sâu chẳng hỏi thế sự, một đời giữ mình tu hành."
    }
  };

  const elementSuffix: Record<string, string> = {
    Kim: "Bách luyện thành cương, một kiếm phá vạn pháp.",
    Mộc: "Một hạt sinh căn, ngày sau ắt thành đại mộc.",
    Thủy: "Nước theo thế mà chảy, người theo đạo mà hành.",
    Hỏa: "Một đốm linh hỏa, cũng đủ thiêu tận cửu thiên.",
    Thổ: "Đất dày mới tải được vạn vật, đường xa mới biết được căn cơ.",
    Lôi: "Thiên lôi giáng thế, kẻ mang mệnh ấy chẳng phải phàm nhân.",
    Phong: "Gió đến chẳng báo trước, người này một đời khó chịu trói buộc."
  };

  const pool = [
    "Thiên mệnh đã định, lòng người chưa chắc.",
    "Đường dài vạn dặm, một bước cũng phải tự mình đi.",
    "Trời cao chẳng nói, nhân quả tự tìm về.",
    "Một đời tu đạo, được mất vốn chẳng do người.",
    "Vạn sự tùy duyên, nhưng duyên đến cũng phải tự mình nắm lấy.",
    "Mệnh có thể định, số lại do người.",
    "Một niệm thành ma, một niệm thành Phật.",
    "Đại đạo vô tận, người đời hữu hạn.",
    "Có duyên ngàn dặm cũng gặp, vô duyên đối diện chẳng thành.",
    "Nhân quả chưa đến, chẳng có nghĩa là chưa từng gieo.",
    "Một bước nhập đạo, vạn kiếp chẳng quay đầu.",
    "Kiếp này đã đến, ắt có con đường phải đi.",
    "Thiên địa rộng lớn, kẻ vô danh cũng có ngày lưu danh.",
    "Phong vân chưa động, chẳng biết ai là long.",
    "Long đong một kiếp, cũng cầu được một lần thuận mệnh.",
    "Chấp niệm chưa tan, con đường phía trước chưa tận.",
    "Duyên đến thì tụ, duyên tận thì tan.",
    "Người có thể đổi, mệnh cũng chưa chắc bất biến.",
    "Một đời cầu đạo, cuối cùng cầu lại chính mình.",
    "Đường tu vốn độc hành, tri kỷ khó cầu.",
    "Núi cao còn có núi cao hơn, đại đạo chẳng có tận cùng.",
    "Thế gian vạn tượng, chẳng gì thoát khỏi nhân quả.",
    "Có những chuyện, đến khi ngoảnh lại đã thành tiền duyên.",
    "Một giấc Nam Kha, tỉnh mộng mới hay một đời đã qua.",
    "Thiên đạo vô tình, nhân gian hữu tình.",
    "Được mất trong tay, họa phúc bởi lòng.",
    "Sóng gió chưa yên, người mang mệnh lớn khó sống một đời bình lặng.",
    "Nếu đã bước lên con đường này, hà tất hỏi ngày về.",
    "Chẳng cầu trường sinh bất tử, chỉ cầu một đời không thẹn với lòng.",
    "Mệnh trời khó cãi, nhưng người tu đạo nào chịu cúi đầu."
  ];

  const line1 = bgTemplates[backgroundId]?.[destinyId] || "Mệnh trời vô định / Hành trình vô tận";
  const line2 = elementSuffix[element] || "Linh khí mờ ảo";
  const line3 = pool[Math.floor(Math.random() * pool.length)];

  return `${line1}\n${line2}\n${line3}`;
}
