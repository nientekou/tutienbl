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

export const DESTINIES: Destiny[] = [
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

export const COMBO_BONUSES: ComboBonus[] = [
  { backgroundId: 'tu_chien_gia_toc', element: 'Hỏa', skillName: 'Xích Viêm Kiếm Ý', skillDescription: 'Kiếm thế nhiễm Hỏa, thiêu đốt chân nguyên, gây thêm 10% sát thương hệ Hỏa.', skillEffect: '{"type": "elemental_atk", "element": "fire", "bonus": 0.1}' },
  { backgroundId: 'tu_chien_gia_toc', element: 'Lôi', skillName: 'Kinh Lôi Nhất Trảm', skillDescription: 'Một kiếm dẫn động lôi đình, có 20% khiến mục tiêu choáng 1 hiệp.', skillEffect: '{"type": "stun", "chance": 0.2, "duration": 1}' },
  { backgroundId: 'phan_tran', element: 'Thổ', skillName: 'Hậu Thổ Ngưng Thân', skillDescription: 'Lấy Thổ khí dưỡng thân, thân pháp vững như sơn nhạc, tăng 5% né tránh vĩnh viễn.', skillEffect: '{"type": "stat_buff", "stat": "dodge", "value": 0.05}' },
  { backgroundId: 'phan_tran', element: 'Mộc', skillName: 'Thanh Mộc Sinh Cơ', skillDescription: 'Mộc khí không dứt, sinh cơ tự hồi, mỗi hiệp hồi 2% HP.', skillEffect: '{"type": "regen", "value": 0.02}' },
  { backgroundId: 'ky_ngo_sinh_tu', element: 'Thủy', skillName: 'Linh Tuyền Dưỡng Mạch', skillDescription: 'Dẫn Thủy linh khí dưỡng mạch, mỗi hiệp hồi 5% HP.', skillEffect: '{"type": "regen", "value": 0.05}' },
  { backgroundId: 'ky_ngo_sinh_tu', element: 'Lôi', skillName: 'Thiên Lôi Hộ Mạch', skillDescription: 'Dẫn thiên lôi hộ thể, phản lại 5% sát thương nhận vào.', skillEffect: '{"type": "reflect", "value": 0.05}' },
  { backgroundId: 'de_tu_tan_tu', element: 'Thủy', skillName: 'Linh Đan Tụ Hiệu', skillDescription: 'Tinh thông dược lý, khi dùng đan dược, hiệu quả tăng 15%.', skillEffect: '{"type": "potion_boost", "value": 0.15}' },
  { backgroundId: 'de_tu_tan_tu', element: 'Hỏa', skillName: 'Xích Hỏa Luyện Đan', skillDescription: 'Dùng Hỏa luyện đan, tăng 10% tỷ lệ thành công khi luyện đan.', skillEffect: '{"type": "craft_boost", "skill": "alchemy", "value": 0.1}' },
  { backgroundId: 'ky_ngo_sinh_tu', element: 'Phong', skillName: 'Vô Ảnh Phong Hành', skillDescription: 'Thân theo gió chuyển, tăng 5% tốc độ vĩnh viễn.', skillEffect: '{"type": "stat_buff", "stat": "speed", "value": 0.05}' },
  { backgroundId: 'de_tu_tan_tu', element: 'Phong', skillName: 'Ngự Phong Độn Hành', skillDescription: 'Mượn Phong khí giảm thân lực, khi làm việc tiêu hao ít hơn 10% thể lực.', skillEffect: '{"type": "stamina_save", "value": 0.1}' },
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
    tu_chien_gia_toc: `Giữa khu rừng linh khí dày đặc, ${name} đứng trước cổng sơn môn của gia tộc. Phía sau là những tòa lầu các nguy nga, phía trước là thế giới bao la. Một cánh chim bằng lướt qua bầu trời — điềm báo cho một hành trình không giới hạn.`,
    phan_tran: `Bình minh ló rạng trên ngôi làng nhỏ. ${name} thắt lại bọc hành lý, nhìn lần cuối căn nhà tranh vách đất. Không lưu luyến, chỉ có quyết tâm. Một bước chân — và cả thế giới tu chân mở ra trước mắt.`,
    ky_ngo_sinh_tu: `${name} tỉnh dậy trong một khu rừng xa lạ. Đầu còn ong ong, nhưng trong cơ thể — một sức mạnh mới đang ùa về. Ai đã cứu mình? Và tại sao? Những câu hỏi đó sẽ còn ở lại, nhưng lúc này, hãy bước tiếp.`,
    de_tu_tan_tu: `Cánh cửa lều khép lại sau lưng ${name}. Bên trong, những cuốn sách cũ nằm im — nhưng tri thức thì đã đồng hành cùng ngươi ra ngoài kia. Một cơn gió thổi qua, cuốn theo mấy chiếc lá vàng. Hành trình bắt đầu.`,
  };
  return scenes[backgroundId] || `${name} bước vào thế giới tu chân rộng lớn, nơi vô vàn kỳ ngộ và thử thách đang chờ đón.`;
}

export function getDestinyLine(destinyId: string): string {
  const destiny = DESTINIES.find(d => d.id === destinyId);
  return destiny?.line || 'Số phận nằm trong tay ngươi.';
}

export const HEIRLOOMS = [
  { id: 'manh_ngoc_bich', name: 'Thiên Khuyết Ngọc', icon: '<:tvngoc:1547899787918053376>', description: 'Một mảnh cổ ngọc khuyết mất một phần, tương truyền là chìa khóa mở ra một cánh cửa đã biến mất khỏi Thương Mang Thiên Hạ.', effect: '+1% Luck' },
  { id: 'la_ban_ri_set', name: 'Tinh Hải La Bàn', icon: '<:tvlaban:1547899793131438120>', description: 'Chiếc la bàn cũ kỹ không còn chỉ phương hướng của nhân gian. Mỗi khi tinh tượng đổi dời, kim bàn lại khẽ rung, dường như đang tìm kiếm một nơi chưa từng xuất hiện trên địa đồ.', effect: 'Gợi ý kỳ ngộ ẩn' },
  { id: 'linh_hoa_kho', name: 'Sở Tư Tàn Hoa', icon: '<:tvtanhoa:1547906520921149470>', description: 'Một đóa hoa đã héo từ rất lâu nhưng chưa từng mục nát. Cánh hoa giữ nguyên sắc đỏ như ngày vừa nở, mang theo một đoạn nhân quả chưa được khép lại.', effect: '+1% Drop Rate' },
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
