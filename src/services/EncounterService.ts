import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { ITEMS } from '../config/itemConstants';

export interface Encounter {
  id: string;
  source: 'lamviec' | 'sanyeuthu';
  title: string;
  description: string;
  choices: EncounterChoice[];
}

export interface EncounterChoice {
  id: string;
  text: string;
  successRate: number;
  successReward: EncounterReward;
  failPenalty: EncounterReward;
}

export interface EncounterReward {
  coins?: number;
  exp?: number;
  hp?: number;
  contribution?: number;
  item_id?: string;
  item_qty?: number;
  ngotinh?: number;
  pet_template_id?: string;
  farming_acceleration?: number;
}

const LAMVIEC_ENCOUNTERS: Encounter[] = [
  {
    id: 'lv_linh_mach',
    source: 'lamviec',
    title: '💎 Phát Hiện Linh Mạch',
    description: 'Trong lúc đào khoáng, đạo hữu phát hiện một tia linh khí kỳ lạ từ lòng đất! Có thể là một linh mạch thượng phẩm!',
    choices: [
      {
        id: 'lv_lm_khai_thac',
        text: '⛏️ Khai thác triệt để',
        successRate: 0.7,
        successReward: { coins: 1500, exp: 100 },
        failPenalty: { coins: -200, hp: -50 },
      },
      {
        id: 'lv_lm_bao_cao',
        text: '📜 Báo cáo về Tông Môn',
        successRate: 0.9,
        successReward: { contribution: 300, coins: 500 },
        failPenalty: { coins: -50 },
      },
    ],
  },
  {
    id: 'lv_sa_bay',
    source: 'lamviec',
    title: '🕳️ Sa Bẫy Yêu Thú',
    description: 'Đạo hữu vô tình giẫm trúng bẫy yêu thú! Một cơn đau nhói từ chân truyền lên!',
    choices: [
      {
        id: 'lv_sb_chiu_tran',
        text: '💪 Chịu đựng vượt qua',
        successRate: 0.6,
        successReward: { coins: 200, exp: 150, hp: -20 },
        failPenalty: { coins: -300, hp: -100 },
      },
      {
        id: 'lv_sb_dung_phu',
        text: '📿 Dùng phù lục thoát thân',
        successRate: 0.85,
        successReward: { hp: -10 },
        failPenalty: { coins: -100, hp: -60 },
      },
    ],
  },
  {
    id: 'lv_bi_kip',
    source: 'lamviec',
    title: '📜 Bí Kíp Cổ Xưa',
    description: 'Khi đang nghỉ ngơi, đạo hữu nhặt được một mảnh da thú cổ khắc đầy chữ viết tượng hình!',
    choices: [
      {
        id: 'lv_bk_hoc',
        text: '🧘 Ngộ đạo từ bí kíp',
        successRate: 0.65,
        successReward: { exp: 350, ngotinh: 5 },
        failPenalty: { hp: -30 },
      },
      {
        id: 'lv_bk_ban',
        text: '💰 Bán cho Vạn Bảo Lâu',
        successRate: 0.95,
        successReward: { coins: 800 },
        failPenalty: { coins: -50 },
      },
    ],
  },
  {
    id: 'lv_tu_si',
    source: 'lamviec',
    title: '🫂 Gặp Tu Sĩ Bị Thương',
    description: 'Một tu sĩ áo rách thân tàn đang nằm bên vệ đường, yếu ớt cầu cứu.',
    choices: [
      {
        id: 'lv_ts_cuu',
        text: '💊 Cứu chữa tận tình',
        successRate: 0.8,
        successReward: { contribution: 150, coins: 300, exp: 50 },
        failPenalty: { coins: -150, hp: -30 },
      },
      {
        id: 'lv_ts_bo',
        text: '🚶 Lờ đi tiếp tục làm việc',
        successRate: 1.0,
        successReward: { coins: 50 },
        failPenalty: { coins: -10 },
      },
    ],
  },
  {
    id: 'lv_linh_thao',
    source: 'lamviec',
    title: '🌿 Linh Thảo Ngàn Năm',
    description: 'Một luồng hương thơm kỳ lạ thoảng qua. Đó là một gốc linh thảo ngàn năm đang ẩn mình trong khe đá!',
    choices: [
      {
        id: 'lv_lt_hai',
        text: '🌱 Nhẹ nhàng hái',
        successRate: 0.75,
        successReward: { coins: 600, exp: 80 },
        failPenalty: { coins: -200, hp: -40 },
      },
      {
        id: 'lv_lt_bao_ve',
        text: '🛡️ Che giấu và bảo vệ',
        successRate: 0.9,
        successReward: { contribution: 200, ngotinh: 3 },
        failPenalty: { hp: -20 },
      },
    ],
  },
  {
    id: 'lv_tran_phap',
    source: 'lamviec',
    title: '🕸️ Trận Pháp Thất Truyền',
    description: 'Đạo hữu đào trúng một mắt xích trận pháp cổ đại, linh khí xung quanh trở nên bạo loạn!',
    choices: [
      {
        id: 'lv_tp_pha',
        text: '💥 Cưỡng ép phá trận',
        successRate: 0.4,
        successReward: { item_id: ITEMS.TANG_BAO_DO, item_qty: 1, ngotinh: 10 },
        failPenalty: { hp: -150, coins: -500 },
      },
      {
        id: 'lv_tp_rut',
        text: '🏃 Rút lui bảo toàn tính mạng',
        successRate: 0.9,
        successReward: { coins: 50 },
        failPenalty: { hp: -30 },
      },
    ],
  },
  {
    id: 'lv_lua_dao',
    source: 'lamviec',
    title: '🎭 Kẻ Lừa Đảo Vạn Bảo Lâu',
    description: 'Một thương nhân thần bí gạ bán cho đạo hữu một vật phẩm được bọc kín với giá rẻ mạt.',
    choices: [
      {
        id: 'lv_ld_mua',
        text: '💰 Liều mình mua thử',
        successRate: 0.5,
        successReward: { item_id: ITEMS.TANG_BAO_DO, item_qty: 1, exp: 200 },
        failPenalty: { coins: -800, hp: -10 },
      },
      {
        id: 'lv_ld_bo',
        text: '✋ Từ chối thẳng thừng',
        successRate: 1.0,
        successReward: { ngotinh: 2 },
        failPenalty: {},
      },
    ],
  },
  {
    id: 'lv_linh_dien_mua',
    source: 'lamviec',
    title: '🌧️ Linh Điền Thụy Vũ',
    description: 'Bầu trời bỗng giáng xuống một trận mưa linh khí thuần khiết lên linh điền của đạo hữu!',
    choices: [
      {
        id: 'lv_ldm_cam_lo',
        text: '🌧️ Khai dẫn cam lộ',
        successRate: 0.7,
        successReward: { farming_acceleration: 7200 },
        failPenalty: { hp: -50 },
      },
      {
        id: 'lv_ldm_bao_dich',
        text: '🧪 Thu thập bảo dịch',
        successRate: 0.9,
        successReward: { item_id: ITEMS.POTION_STAMINA_WEEKLY, item_qty: 1 },
        failPenalty: {},
      },
    ],
  },
];

const SANYEUTHU_ENCOUNTERS: Encounter[] = [
  {
    id: 'sy_giai_nhan',
    source: 'sanyeuthu',
    title: '🌸 Tuyệt Thế Giai Nhân',
    description: 'Giữa rừng sâu, một bóng hồng tuyệt mỹ đang ngồi bên suối, khẽ ngân nga một khúc nhạc tiên.',
    choices: [
      {
        id: 'sy_gn_ket_giao',
        text: '🤝 Kết giao bằng hữu',
        successRate: 0.7,
        successReward: { ngotinh: 15, exp: 100 },
        failPenalty: { coins: -100, hp: -30 },
      },
      {
        id: 'sy_gn_tang_qua',
        text: '🎁 Tặng quà lưu niệm',
        successRate: 0.85,
        successReward: { ngotinh: 30, exp: 50 },
        failPenalty: { coins: -200 },
      },
    ],
  },
  {
    id: 'sy_cao_nhan',
    source: 'sanyeuthu',
    title: '🧙 Cao Nhân Truyền Công',
    description: 'Một lão già râu tóc bạc phơ xuất hiện từ hư vô, mỉm cười nhìn đạo hữu: "Có duyên! Có duyên!"',
    choices: [
      {
        id: 'sy_cn_nhan',
        text: '🙏 Khiêm tốn thọ giáo',
        successRate: 0.6,
        successReward: { exp: 500, ngotinh: 10 },
        failPenalty: { exp: -50 },
      },
      {
        id: 'sy_cn_kinh_le',
        text: '💎 Kính lễ hậu hĩnh',
        successRate: 0.8,
        successReward: { exp: 800, coins: -300 },
        failPenalty: { coins: -300, exp: -100 },
      },
    ],
  },
  {
    id: 'sy_co_mo',
    source: 'sanyeuthu',
    title: '🪦 Phát Hiện Cổ Mộ',
    description: 'Bụi đất bỗng sụt lở để lộ một cánh cửa đá cổ xưa khắc đầy phù văn thần bí.',
    choices: [
      {
        id: 'sy_cm_kham_pha',
        text: '🔦 Khám phá cổ mộ',
        successRate: 0.5,
        successReward: { coins: 2000, exp: 300, item_id: ITEMS.MATERIAL_TINH_THIET_1, item_qty: 2 },
        failPenalty: { hp: -150, coins: -500 },
      },
      {
        id: 'sy_cm_ve',
        text: '🚶 Trở về an toàn',
        successRate: 1.0,
        successReward: { coins: 100 },
        failPenalty: {},
      },
    ],
  },
  {
    id: 'sy_dan_duoc',
    source: 'sanyeuthu',
    title: '⚗️ Lò Luyện Đan Bỏ Hoang',
    description: 'Một lò luyện đan cổ vẫn còn âm ỉ lửa, bên cạnh là những bình đan dược bụi bám.',
    choices: [
      {
        id: 'sy_dd_lay',
        text: '🧴 Lấy đan dược',
        successRate: 0.7,
        successReward: { coins: 500, exp: 150, item_id: ITEMS.PILL_TU_VI_LOW, item_qty: 3 },
        failPenalty: { hp: -60, coins: -100 },
      },
      {
        id: 'sy_dd_nghien',
        text: '📖 Nghiên cứu phương pháp',
        successRate: 0.65,
        successReward: { exp: 300, ngotinh: 8 },
        failPenalty: { hp: -40 },
      },
    ],
  },
  {
    id: 'sy_dam_lay',
    source: 'sanyeuthu',
    title: '☠️ Đầm Lầy Độc',
    description: 'Đạo hữu bất cẩn bước vào một đầm lầy sương độc bao phủ, phía dưới dường như có vật gì đang phát sáng.',
    choices: [
      {
        id: 'sy_dl_vot',
        text: '🫴 Vớt vật thể phát sáng',
        successRate: 0.45,
        successReward: { item_id: ITEMS.TANG_BAO_DO, item_qty: 1, exp: 500 },
        failPenalty: { hp: -200, coins: -300 },
      },
      {
        id: 'sy_dl_lui',
        text: '🔙 Lập tức lùi lại',
        successRate: 0.95,
        successReward: { ngotinh: 5 },
        failPenalty: { hp: -20 },
      },
    ],
  },
  {
    id: 'sy_than_thu',
    source: 'sanyeuthu',
    title: '🦄 Thần Thú Giáng Lâm',
    description: 'Một luồng thần quang phóng xuống, Thần thú xuất thế trước mắt đạo hữu, uy thế hiển hách!',
    choices: [
      {
        id: 'sy_tt_bai_te',
        text: '🙏 Bái tế cầu phúc',
        successRate: 0.7,
        successReward: { ngotinh: 30, exp: 1500 },
        failPenalty: { hp: -50 },
      },
      {
        id: 'sy_tt_thu_phuc',
        text: '⚔️ Cưỡng ép thu phục',
        successRate: 0.06,
        successReward: { pet_template_id: 'random_mythical' },
        failPenalty: { hp: -150 },
      },
    ],
  },
  {
    id: 'sy_tam_ma_ao_canh',
    source: 'sanyeuthu',
    title: '🧘 Tâm Ma Ảo Cảnh',
    description: 'Bất chợt rơi vào ảo ảnh, nhìn thấy kiếp trước lẫn cõi ma đạo gào thét cắn nuốt đạo tâm!',
    choices: [
      {
        id: 'sy_tm_kien_dinh',
        text: '🧘 Kiên định bản tâm',
        successRate: 0.6,
        successReward: { ngotinh: 35, exp: 1200 },
        failPenalty: { hp: -100, exp: -200 },
      },
      {
        id: 'sy_tm_chem_ma',
        text: '⚔️ Chém đứt tâm ma',
        successRate: 0.45,
        successReward: { exp: 3500, coins: 1000 },
        failPenalty: { hp: -200 },
      },
    ],
  },
];

class EncounterService {
  public getEncounterPool(source: 'lamviec' | 'sanyeuthu'): Encounter[] {
    return source === 'lamviec' ? LAMVIEC_ENCOUNTERS : SANYEUTHU_ENCOUNTERS;
  }

  public rollEncounter(source: 'lamviec' | 'sanyeuthu'): Encounter | null {
    const chance = source === 'lamviec' ? 0.15 : 0.10;
    if (Math.random() > chance) return null;

    const pool = this.getEncounterPool(source);
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  public resolveEncounter(userId: string, encounterId: string, choiceId: string): {
    success: boolean;
    message: string;
    rewards: Record<string, number>;
  } {
    const { cultivationService } = require('./CultivationService');
    cultivationService.claimIdleCultivation(userId);

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại.', rewards: {} };

    // Tìm encounter và choice
    const allEncounters = [...LAMVIEC_ENCOUNTERS, ...SANYEUTHU_ENCOUNTERS];
    const encounter = allEncounters.find(e => e.id === encounterId);
    if (!encounter) return { success: false, message: 'Sự kiện không tồn tại.', rewards: {} };

    const choice = encounter.choices.find(c => c.id === choiceId);
    if (!choice) return { success: false, message: 'Lựa chọn không hợp lệ.', rewards: {} };

    const isSuccess = Math.random() < choice.successRate;
    const reward = isSuccess ? choice.successReward : choice.failPenalty;
    const rewards: Record<string, number> = {};

    // Lưu vào DB
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO user_encounters (user_id, encounter_id, source, choice_made, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, encounterId, encounter.source, choiceId, isSuccess ? 'success' : 'fail', now);

    // Áp dụng reward
    const updates: Record<string, number> = {};
    if (reward.coins && reward.coins !== 0) {
      updates.coin_ha_pham = (user.coin_ha_pham || 0) + reward.coins;
      rewards.coins = reward.coins;
    }
    if (reward.exp && reward.exp !== 0) {
      const cappedExp = Math.max(0, Math.min((user.tu_vi || 0) + reward.exp, user.exp_needed || 999999));
      updates.tu_vi = cappedExp;
      rewards.exp = reward.exp;
    }
    if (reward.contribution && reward.contribution !== 0 && user.sect_id) {
      updates.sect_contribution = (user.sect_contribution || 0) + reward.contribution;
      rewards.contribution = reward.contribution;
      db.prepare('UPDATE sects SET resources = resources + ? WHERE id = ?').run(
        Math.floor(reward.contribution / 2), user.sect_id
      );
    }
    if (reward.ngotinh && reward.ngotinh !== 0) {
      updates.ngotinh = (user.ngotinh || 0) + reward.ngotinh;
      rewards.ngotinh = reward.ngotinh;
    }
    if (reward.item_id && reward.item_qty) {
      inventoryRepository.addItem(userId, reward.item_id, reward.item_qty);
      rewards.items = reward.item_qty;
    }

    let customMsg = '';

    if (reward.pet_template_id) {
      if (reward.pet_template_id === 'random_mythical') {
        const mythicalPool = [
          {
            templateId: 'pet_qilin',
            name: 'Kỳ Lân Bạch Ngọc 🦄',
            rarity: 'legendary',
            petBaseHp: 3500, petBaseAtk: 250, petBaseDef: 120,
            skills: ['qilin_heal']
          },
          {
            templateId: 'pet_kun_pen',
            name: 'Côn Bằng 🦅',
            rarity: 'legendary',
            petBaseHp: 3200, petBaseAtk: 280, petBaseDef: 100,
            skills: ['kunpen_hp']
          },
          {
            templateId: 'pet_taotie',
            name: 'Thao Thiết 🐉',
            rarity: 'legendary',
            petBaseHp: 4000, petBaseAtk: 220, petBaseDef: 150,
            skills: ['taotie_def']
          },
          {
            templateId: 'pet_black_dragon',
            name: 'Hắc Long Tử 🐲',
            rarity: 'epic',
            petBaseHp: 2000, petBaseAtk: 160, petBaseDef: 90,
            skills: ['dragon_berserk']
          },
          {
            templateId: 'pet_fire_phoenix',
            name: 'Phượng Hoàng Lửa 🦩',
            rarity: 'epic',
            petBaseHp: 2200, petBaseAtk: 150, petBaseDef: 85,
            skills: ['phoenix_rebirth']
          },
          {
            templateId: 'pet_sky_bird',
            name: 'Cửu Thiên Huyền Điểu 🐦',
            rarity: 'rare',
            petBaseHp: 800, petBaseAtk: 60, petBaseDef: 30,
            skills: ['sky_agile']
          },
          {
            templateId: 'pet_nine_tail',
            name: 'Thiên Hồ Cửu Vĩ 🦊',
            rarity: 'rare',
            petBaseHp: 750, petBaseAtk: 65, petBaseDef: 35,
            skills: ['nine_charm']
          },
          {
            templateId: 'kylan',
            name: 'Kỳ Lân 🦄',
            rarity: 'legendary',
            petBaseHp: 3000, petBaseAtk: 200, petBaseDef: 100,
            skills: ['qilin_fortune']
          },
          {
            templateId: 'phuonghoang',
            name: 'Hỏa Phượng 🦚',
            rarity: 'legendary',
            petBaseHp: 2500, petBaseAtk: 220, petBaseDef: 80,
            skills: ['reborn_flame']
          },
          {
            templateId: 'tyhuu',
            name: 'Tỳ Hưu 🦁',
            rarity: 'epic',
            petBaseHp: 1500, petBaseAtk: 120, petBaseDef: 60,
            skills: ['gold_blessing']
          }
        ];
        const selected = mythicalPool[Math.floor(Math.random() * mythicalPool.length)];
        const gender = Math.random() < 0.5 ? 0 : 1;
        const nowTime = Math.floor(Date.now() / 1000);
        db.prepare(`
          INSERT INTO pets (user_id, name, template_id, rarity, base_hp, base_atk, base_def, level, exp, is_deployed, gender, created_at, skills)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?)
        `).run(
          userId,
          selected.name.split(' ')[0],
          selected.templateId,
          selected.rarity,
          selected.petBaseHp,
          selected.petBaseAtk,
          selected.petBaseDef,
          gender,
          nowTime,
          JSON.stringify(selected.skills)
        );

        try {
          const { checkPetAchievements } = require('../commands/general/sanyeuthu');
          checkPetAchievements(userId, selected.rarity);
        } catch (e) {
          console.error('[encounter pet achievement error]', e);
        }

        customMsg = `✨ **Kỳ Ngộ**: Thần Thú Giáng Lâm - Thành công!\n\n🎉 Linh khí hội tụ cuồn cuộn, thần uy ngợp trời! Đạo hữu đã cưỡng ép thu phục thành công **${selected.name}** [${selected.rarity.toUpperCase()}]! Thần thú đã được đưa về Tàng Thú Các (\`/sungthu danhsach\`).`;
        rewards.pet_received = 1;
      }
    }

    if (reward.farming_acceleration) {
      try {
        const { farmingService } = require('./FarmingService');
        farmingService.getPlots(userId); // Updates progress to current 'now'
        
        db.prepare(`
          UPDATE farming_plots
          SET growth_time = CASE WHEN growth_time - ? < 0 THEN 0 ELSE growth_time - ? END
          WHERE user_id = ? AND status = 'growing'
        `).run(reward.farming_acceleration, reward.farming_acceleration, userId);
        
        rewards.farming_acceleration = reward.farming_acceleration / 3600; // Store hours accelerated
      } catch (e) {
        console.error('[encounter farming acceleration error]', e);
      }
    }

    if (Object.keys(updates).length > 0) {
      userRepository.update(userId, updates as any);
    }

    // Xây dựng thông điệp tùy chỉnh dựa trên ID sự kiện và kết quả
    if (!customMsg) {
      if (isSuccess) {
        if (encounterId === 'sy_than_thu') {
          if (choiceId === 'sy_tt_bai_te') {
            customMsg = `✨ **Kỳ Ngộ**: Thần Thú Giáng Lâm - Thành công!\n\n🙏 Đạo hữu bái tế cầu phúc thành kính, được Thần Thú ban ân trạch: Ngộ tính tăng tiến, tu vi tiến triển!`;
          }
        } else if (encounterId === 'lv_linh_dien_mua') {
          if (choiceId === 'lv_ldm_cam_lo') {
            customMsg = `✨ **Kỳ Ngộ**: Linh Điền Thụy Vũ - Thành công!\n\n🌧️ Cam lộ giáng thế linh điền, linh khí tưới đẫm, gia tốc sinh trưởng cho toàn bộ Linh thực đang gieo trồng thêm **2 giờ**!`;
          } else if (choiceId === 'lv_ldm_bao_dich') {
            customMsg = `✨ **Kỳ Ngộ**: Linh Điền Thụy Vũ - Thành công!\n\n🧪 Thu thập linh dịch thuần khiết đóng chai thành công, đạo hữu nhận được 1x **Bình Thể Lực (Tuần)**!`;
          }
        } else if (encounterId === 'sy_tam_ma_ao_canh') {
          if (choiceId === 'sy_tm_kien_dinh') {
            customMsg = `✨ **Kỳ Ngộ**: Tâm Ma Ảo Cảnh - Thành công!\n\n🧘 Bản tâm kiên định như bàn thạch, ảo cảnh tự động tiêu tan, đạo cốt tinh tiến vượt bậc!`;
          } else if (choiceId === 'sy_tm_chem_ma') {
            customMsg = `✨ **Kỳ Ngộ**: Tâm Ma Ảo Cảnh - Thành công!\n\n⚔️ Vung kiếm chém đứt tâm ma trói buộc, phá cảnh nhi xuất, thần thức rộng mở nhận lượng lớn Tu vi cùng Linh thạch!`;
          }
        }
      } else {
        if (encounterId === 'sy_than_thu') {
          if (choiceId === 'sy_tt_bai_te') {
            customMsg = `😅 **Kỳ Ngộ**: Thần Thú Giáng Lâm - Thất bại...\n\nThần thú ghét bỏ sự yếu đuối, đẩy lùi đạo hữu làm tiêu hao linh lực (**-50 HP**).`;
          } else if (choiceId === 'sy_tt_thu_phuc') {
            customMsg = `😅 **Kỳ Ngộ**: Thần Thú Giáng Lâm - Thất bại...\n\nMuốn cưỡng ép thu phục nhưng bất thành! Bị linh lực cuồng bạo của Thần Thú phản phệ cực mạnh, thương tổn nặng nề (**-150 HP**).`;
          }
        } else if (encounterId === 'lv_linh_dien_mua') {
          if (choiceId === 'lv_ldm_cam_lo') {
            customMsg = `😅 **Kỳ Ngộ**: Linh Điền Thụy Vũ - Thất bại...\n\nLũ lụt dâng cao gây ngập úng linh điền, đạo hữu tốn hao linh lực để chống đỡ giông bão (**-50 HP**).`;
          } else if (choiceId === 'lv_ldm_bao_dich') {
            customMsg = `😅 **Kỳ Ngộ**: Linh Điền Thụy Vũ - Thất bại...\n\nHụt tay làm đổ bình bảo dịch quý giá, không thu hoạch được gì ngoài sự tiếc nuối.`;
          }
        } else if (encounterId === 'sy_tam_ma_ao_canh') {
          if (choiceId === 'sy_tm_kien_dinh') {
            customMsg = `😅 **Kỳ Ngộ**: Tâm Ma Ảo Cảnh - Thất bại...\n\nTâm thần bất định rơi vào ác mộng, bị ảo cảnh cắn phệ trầm trọng (**-100 HP**, **-200 Tu Vi**).`;
          } else if (choiceId === 'sy_tm_chem_ma') {
            customMsg = `😅 **Kỳ Ngộ**: Tâm Ma Ảo Cảnh - Thất bại...\n\nTâm ma biến hóa quá mạnh mẽ thành thực thể trọng thương đạo hữu (**-200 HP**).`;
          }
        }
      }
    }

    if (!customMsg) {
      customMsg = isSuccess
        ? `✨ **Kỳ Ngộ**: ${encounter.title} - Thành công!`
        : `😅 **Kỳ Ngộ**: ${encounter.title} - Thất bại...`;
    }

    return {
      success: isSuccess,
      message: customMsg,
      rewards,
    };
  }
}

export const encounterService = new EncounterService();
