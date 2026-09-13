import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { toV2Payload } from '../../utils/uiSystem';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { achievementService } from '../../services/AchievementService';
import { encounterService, Encounter } from '../../services/EncounterService';
import { leylineService } from '../../services/LeylineService';
import { bountyBoardService } from '../../services/BountyBoardService';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

// Lưu trữ thời gian chạy lệnh cuối cùng của từng tu sĩ trong bộ nhớ đệm
const workCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60000; // 60 giây

/**
 * Thực thi một phiên lao động (dùng chung cho lệnh /lamviec và nút bấm trong /hoso).
 * Trả về kết quả kèm Embed để hiển thị, hoặc thông báo lỗi nếu thất bại.
 */
export function performWork(
  discordId: string,
  workType: 'mining' | 'gathering' | 'patrolling' | 'adventure' | 'archaeology' | 'escort'
): { success: boolean; message?: string; embed?: ContainerBuilder; encounter?: Encounter | null; accident?: boolean } {
  const user = userRepository.get(discordId);
  if (!user) {
    return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh `/taonhanvat`!' };
  }

  const nowTime = Math.floor(Date.now() / 1000);
  if (user.injury_end_time && user.injury_end_time > nowTime) {
    const remain = user.injury_end_time - nowTime;
    const minutes = Math.ceil(remain / 60);
    return {
      success: false,
      message: `❌ Đạo hữu đang bị **Trọng Thương**! Kinh mạch tổn hại, không thể làm việc. Cần tĩnh dưỡng thêm **${minutes} phút** nữa.`
    };
  }

  const baseStaminaCost = (workType === 'adventure' || workType === 'archaeology' || workType === 'escort') ? 15 : 10;

  // Kiểm tra Thể Lực
  if (user.stamina < baseStaminaCost) {
    return {
      success: false,
      message: `❌ Đạo hữu không đủ Thể Lực cho công việc này! (Yêu cầu ít nhất **${baseStaminaCost}** điểm, hiện có **${user.stamina}**). Hãy nghỉ ngơi chờ Thể Lực tự hồi phục hoặc dùng đan dược!`
    };
  }

  // Kiểm tra Cooldown
  // Kiểm tra mount bonus (giảm cooldown)
  const activeMount = db.prepare('SELECT speed_bonus, stamina_save FROM mounts WHERE user_id = ? AND is_active = 1').get(discordId) as any;
  const mountBonus = activeMount?.speed_bonus || 0;
  const staminaSave = activeMount?.stamina_save || 0;
  const effectiveCooldown = Math.round(COOLDOWN_MS * (1 - mountBonus));

  const now = Date.now();
  const lastWork = workCooldowns.get(discordId) || 0;
  if (now - lastWork < effectiveCooldown) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastWork)) / 1000);
    return {
      success: false,
      message: `⏳ Đạo hữu vừa lao động vất vả, khí huyết chưa phục hồi. Hãy nghỉ ngơi và quay lại sau **${remaining} giây**!`
    };
  }

  // Giới hạn làm việc hàng ngày (chống farm)
  const todayStart = Math.floor(Date.now() / 1000) - 86400;
  const dailyWorkCount = db.prepare(
    "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'work' AND created_at >= ? AND json_extract(details, '$.accident') != 1"
  ).get(discordId, todayStart) as { c: number };
  const DAILY_WORK_LIMIT = 50;
  if (dailyWorkCount.c >= DAILY_WORK_LIMIT) {
    return {
      success: false,
      message: `⚠️ Đạo hữu đã làm việc **${dailyWorkCount.c}/${DAILY_WORK_LIMIT}** lần hôm nay. Hãy quay lại vào ngày mai! (Giới hạn chống farm tiền.)`
    };
  }

  // Ghi nhận mốc thời gian làm việc mới
  workCooldowns.set(discordId, now);

  let earnedCoins = 0;
  let rewardItem: { id: string; name: string } | null = null;
  const rewardItemChance = 0.20; // 20% rơi ra vật phẩm phụ trợ
  let actionDescription = '';

  const accidentRates = {
    mining: 0.05,
    gathering: 0.05,
    patrolling: 0.08,
    adventure: 0.12,
    archaeology: 0.15,
    escort: 0.10
  };

  const isAccident = Math.random() < accidentRates[workType];

  if (isAccident) {
    if (workType === 'mining') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Trong lúc đào khoáng, hầm lò đột ngột sụp đổ! Đạo hữu bị đá đè chấn thương nặng...';
    } else if (workType === 'gathering') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Đạo hữu vô tình chạm phải độc trùng linh dược, độc khí công tâm...';
    } else if (workType === 'patrolling') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Phát hiện bóng đen tà tu đột kích tông môn, đạo hữu cự địch bị trọng thương...';
    } else if (workType === 'adventure') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Ngự kiếm phi hành quá tốc độ bị khí lưu bạo loạn quấn lấy, điên đảo kinh mạch...';
    } else if (workType === 'archaeology') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Kích hoạt nhầm cấm chế cổ mộ viễn cổ, bị tà khí âm phong trùng kích nhục thân...';
    } else if (workType === 'escort') {
      actionDescription = '💥 **Tai Nạn Lao Động:** Đoàn hộ tiêu bị thảo khấu mai phục! Hàng hóa tổn thất nặng nề...';
    }
  } else {
    if (workType === 'mining') {
      earnedCoins = Math.floor(Math.random() * 21) + 10; // 10 -> 30
      actionDescription = 'Đạo hữu vác cuốc sắt vào linh cốc khai sơn phá quặng, đào sâu vách đá hấp thu linh thạch thô...';
      if (Math.random() < rewardItemChance) {
        rewardItem = { id: ITEMS.MATERIAL_IRON_1, name: 'Huyền Thiết Sa' };
      }
    } else if (workType === 'gathering') {
      earnedCoins = Math.floor(Math.random() * 11) + 15; // 15 -> 25
      
      let sectBonusMultiplier = 1.0;
      if (user.sect_id) {
        const sect = db.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id) as any;
        if (sect) {
          try {
            const b = JSON.parse(sect.buildings || '{}');
            if (b.linhdien) sectBonusMultiplier += b.linhdien * 0.05; // +5% mỗi cấp
          } catch(e){}
        }
      }
      earnedCoins = Math.round(earnedCoins * sectBonusMultiplier);

      actionDescription = 'Đạo hữu leo núi lội rừng tìm linh lung thảo, cẩn thận hái lượm linh dược...';
      if (Math.random() < rewardItemChance) {
        rewardItem = { id: ITEMS.SEED_LINH_THAO_1, name: 'Hạt Giống Linh Thảo' };
      }
    } else if (workType === 'patrolling') {
      earnedCoins = 20; // Cố định
      actionDescription = 'Đạo hữu khoác đao tuần hành canh gác nội môn tông thành, bảo đảm yên ổn sơn các...';
      if (Math.random() < 0.10) {
        rewardItem = { id: ITEMS.PILL_TU_VI_LOW, name: 'Sơ Cấp Tụ Khí Đan' };
      }
    } else if (workType === 'adventure') {
      earnedCoins = Math.floor(Math.random() * 21) + 30; // 30 -> 50
      actionDescription = 'Đạo hữu triển khai ngự kiếm phi hành, thám hiểm tiên tích bản đồ hoang dã...';
      if (Math.random() < 0.25) {
        const rand = Math.random();
        if (rand < 0.4) {
          const seeds = [
            { id: ITEMS.SEED_TUYET_LIEN, name: 'Thiên Sơn Tuyết Liên Hạt' },
            { id: ITEMS.SEED_LINGZHI, name: 'Cửu Diệp Linh Chi Hạt' },
            { id: ITEMS.SEED_NGODONG, name: 'Ngô Đồng Quả Hạt' }
          ];
          rewardItem = seeds[Math.floor(Math.random() * seeds.length)];
        } else if (rand < 0.7) {
          rewardItem = { id: ITEMS.LUCKY_CHEST, name: 'Rương May Mắn' };
        } else {
          rewardItem = { id: ITEMS.MAP_FRAGMENT, name: 'Mảnh Bản Đồ' };
        }
      }
    } else if (workType === 'archaeology') {
      earnedCoins = Math.floor(Math.random() * 11) + 30; // 30 -> 40
      actionDescription = 'Đạo hữu cầm la bàn bát quái, cẩn thận khảo cổ di tích hoang tàn cổ xưa...';
      if (Math.random() < 0.20) {
        if (Math.random() < 0.5) {
          rewardItem = { id: ITEMS.MATERIAL_IRON_1, name: 'Huyền Thiết Sa' };
        } else {
          rewardItem = { id: ITEMS.MAT_HUYEN_THIET, name: 'Huyền Thiết' };
        }
      }
    } else if (workType === 'escort') {
      earnedCoins = Math.floor(Math.random() * 41) + 40; // 40 -> 80
      actionDescription = 'Đạo hữu hộ tống thương đội vận chuyển hàng hóa qua vùng sơn tặc nguy hiểm...';
      // 15% bị thảo khấu mai phục cướp mất 20% thu nhập
      if (Math.random() < 0.15) {
        const lostCoins = Math.round(earnedCoins * 0.2);
        earnedCoins -= lostCoins;
        actionDescription += `\n⚠️ **Thảo khấu mai phục:** Bọn cướp đường xuất hiện cướp mất **${lostCoins}** Linh Thạch!`;
      }
      if (Math.random() < rewardItemChance) {
        rewardItem = { id: ITEMS.ITEM_FRAGMENT, name: 'Mảnh Bảo Vật' };
      }
    }

    // Áp dụng bonus Linh Thạch cho Chính Đạo (+5%)
    if (user.alignment === 'orthodox') {
      earnedCoins = Math.round(earnedCoins * 1.05);
    }

    // P7-02: Work Scaling — coins scale with level: base * (1 + level/150)
    earnedCoins = Math.round(earnedCoins * (1 + user.level / 150));
  }

  // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
  const { cultivationService } = require('../../services/CultivationService');
  cultivationService.claimIdleCultivation(discordId);

  const freshUser = userRepository.get(discordId)!;
  const staminaCost = Math.round(baseStaminaCost * (1 - staminaSave));

  if (isAccident) {
    userRepository.update(discordId, {
      stamina: Math.max(0, freshUser.stamina - staminaCost),
      injury_end_time: Math.floor(Date.now() / 1000) + 900 // 15 phút trọng thương
    });
  } else {
    userRepository.update(discordId, {
      coin_ha_pham: freshUser.coin_ha_pham + earnedCoins,
      stamina: Math.max(0, freshUser.stamina - staminaCost)
    });
  }

  if (rewardItem && !isAccident) {
    inventoryRepository.addItem(discordId, rewardItem.id, 1);
  }

  // Ghi log (chỉ ghi log khi làm việc thành công hoặc tai nạn)
  const now2 = Math.floor(Date.now() / 1000);
  db.prepare(
    "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'work', ?, ?)"
  ).run(discordId, JSON.stringify({ type: workType, accident: isAccident, coins: earnedCoins, stamina: staminaCost }), now2);

  if (!isAccident) {
    const totalWork = db.prepare(
      "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'work' AND json_extract(details, '$.accident') IS NOT 1"
    ).get(discordId) as { c: number };
    const newWorkCount = totalWork.c;
    achievementService.setProgress(discordId, 'sh_14', newWorkCount);
    achievementService.setProgress(discordId, 'sh_15', newWorkCount);

    // Thêm năng lượng cho linh mạch Tu Luyện
    leylineService.addEnergy(discordId, 'tuluyen', 10);
  }

  // Xử lý Sư Đồ
  let apprenticeBonusExp = 0;
  let mentorGainedExp = 0;
  let mentorGainedCoins = 0;
  if (!isAccident) {
    const { mentorshipService } = require('../../services/MentorshipService');
    const mentResult = mentorshipService.handleApprenticeWork(discordId, earnedCoins);
    apprenticeBonusExp = mentResult.apprenticeBonusExp;
    mentorGainedExp = mentResult.mentorGainedExp;
    mentorGainedCoins = mentResult.mentorGainedCoins;
  }

  // Bảng Nghĩa Vụ: ghi nhận tiến độ tại nguồn dùng chung cho cả slash command và nút /hoso.
  // Chỉ ghi nhận khi phiên lao động không gặp tai nạn.
  if (!isAccident) {
    try {
      bountyBoardService.updateProgress(discordId, 'work', 1);
      bountyBoardService.updateProgress(discordId, 'activity', 1);

      if (workType === 'mining') {
        bountyBoardService.updateProgress(discordId, 'mine', 1);
      } else if (workType === 'gathering') {
        bountyBoardService.updateProgress(discordId, 'herb', 1);
      } else if (workType === 'patrolling') {
        bountyBoardService.updateProgress(discordId, 'patrol', 1);
      } else if (workType === 'adventure') {
        bountyBoardService.updateProgress(discordId, 'adventure', 1);
      } else if (workType === 'archaeology') {
        bountyBoardService.updateProgress(discordId, 'archaeology', 1);
      } else if (workType === 'escort') {
        bountyBoardService.updateProgress(discordId, 'escort', 1);
      }
    } catch (error) {
      console.warn('[BountyBoard] Không thể cập nhật tiến độ từ /lamviec:', error);
    }
  }

  const updatedUser = userRepository.get(discordId)!;
  const staminaBar = getProgressBar(updatedUser.stamina, 500, 8);

  const content: any[] = [
    header(isAccident ? '💥 Tai Nạn Lao Động' : '⚒️ Kết Quả Lao Động Tu Hành', actionDescription),
    separator(),
    body(isAccident ? '🪙 **Linh Thạch Kiếm Được:** 🟤 **+0** (Lao động thất bại)' : `🪙 **Linh Thạch Kiếm Được:** 🟤 **+${earnedCoins}** Hạ Phẩm Linh Thạch`)
  ];

  if (isAccident) {
    content.push(separator());
    content.push(body('💔 **Trạng Thái Thương Tích:**\n🚨 **Trọng Thương trong 15 phút** (không thể thiền định, làm việc, rèn đúc...)'));
  }

  if (rewardItem && !isAccident) {
    content.push(separator());
    content.push(body(`🎁 **Cơ Duyên Rơi Đồ:** Nhận được **1x ${rewardItem.name}**!`));
  }

  if (apprenticeBonusExp > 0) {
    content.push(separator());
    content.push(body(`👨‍🏫 **Sư Đồ Giáo Hóa:**\n• Nhận **+${apprenticeBonusExp}** Tu Vi (+5% Sư đồ bonus)\n• Sư phụ nhận **+${mentorGainedExp}** Tu Vi & **+${mentorGainedCoins}** Linh Thạch`));
  }

  content.push(separator());
  content.push(body(
    `⚡ **Thể Lực Tiêu Hao:** **-${staminaCost}** Thể Lực (Còn lại: **${updatedUser.stamina}/500**)\n${staminaBar}\n\n` +
    `💼 **Số Dư Hiện Tại:** 🟤 **${updatedUser.coin_ha_pham}** Hạ Phẩm Linh Thạch`
  ));

  let encounter = null;
  if (!isAccident) {
    encounter = encounterService.rollEncounter('lamviec');
    if (encounter) {
      content.push(separator());
      content.push(body(
        `**🌟 Kỳ Ngộ: ${encounter.title}**\n${encounter.description}\n\n` +
        `**Lựa chọn:**\n${encounter.choices.map((c, i) => `**${i + 1}.** ${c.text} (${Math.round(c.successRate * 100)}% thành công)`).join('\n')}`
      ));
    }
  }

  const embed = container(isAccident ? V2_COLORS.danger : V2_COLORS.success, content);

  return { success: true, embed, encounter, accident: isAccident };
}

export default class LamViecCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('lamviec')
        .setDescription('Lao động tu hành kiếm Hạ Phẩm Linh Thạch và vật phẩm cơ bản.')
        .addStringOption(option =>
          option
            .setName('congviec')
            .setDescription('Lựa chọn công việc tu sĩ')
            .setRequired(true)
            .addChoices(
              { name: '⚒️ Khai Thác Linh Khoáng (Mining) - 10 TL', value: 'mining' },
              { name: '🌿 Hái Lượm Linh Thảo (Gathering) - 10 TL', value: 'gathering' },
              { name: '🛡️ Tuần Tra Tông Môn (Patrolling) - 10 TL', value: 'patrolling' },
              { name: '🧭 Phiêu Lưu Bản Đồ (Adventure) - 15 TL', value: 'adventure' },
              { name: '🏺 Khảo Cổ Cổ Mộ (Archaeology) - 15 TL', value: 'archaeology' },
              { name: '🚚 Hộ Tiêu Thương Đội (Escort) - 15 TL', value: 'escort' }
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const workType = interaction.options.getString('congviec', true) as 'mining' | 'gathering' | 'patrolling' | 'adventure' | 'archaeology' | 'escort';

    try {
      const result = performWork(discordId, workType);
      if (!result.success) {
        await interaction.editReply({ content: result.message!});
        return;
      }

      const components: any[] = [];
      const encounter = result.encounter;
      if (encounter) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        encounter.choices.forEach((c: any, idx: number) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`encounter_${encounter.id}_${idx}_${discordId}`)
              .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
              .setStyle(ButtonStyle.Primary)
          );
        });
        components.push(row);
      }

      await interaction.editReply(toV2Payload([result.embed!], components));
    } catch (error) {
      console.error('Lỗi khi lưu kết quả làm việc:', error);
      await interaction.editReply({
        content: '❌ Đã xảy ra lỗi hệ thống khi lưu kết quả lao động.'
      });
    }
  }
}
