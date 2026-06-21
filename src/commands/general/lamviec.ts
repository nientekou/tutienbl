import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { achievementService } from '../../services/AchievementService';
import { encounterService, Encounter } from '../../services/EncounterService';
import { leylineService } from '../../services/LeylineService';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';

// Lưu trữ thời gian chạy lệnh cuối cùng của từng tu sĩ trong bộ nhớ đệm
const workCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60000; // 60 giây

/**
 * Thực thi một phiên lao động (dùng chung cho lệnh /lamviec và nút bấm trong /hoso).
 * Trả về kết quả kèm Embed để hiển thị, hoặc thông báo lỗi nếu thất bại.
 */
export function performWork(
  discordId: string,
  workType: 'mining' | 'gathering' | 'patrolling'
): { success: boolean; message?: string; embed?: EmbedBuilder; encounter?: Encounter | null } {
  const user = userRepository.get(discordId);
  if (!user) {
    return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh `/taonhanvat`!' };
  }

  // Kiểm tra Thể Lực
  if (user.stamina < 10) {
    return {
      success: false,
      message: `❌ Đạo hữu đã cạn kiệt Thể Lực! (Yêu cầu ít nhất **10** điểm, hiện có **${user.stamina}**). Hãy nghỉ ngơi chờ Thể Lực tự hồi phục hoặc dùng đan dược!`
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

  // Ghi nhận mốc thời gian làm việc mới
  workCooldowns.set(discordId, now);

  let earnedCoins = 0;
  let rewardItem: { id: string; name: string } | null = null;
  const rewardItemChance = 0.20; // 20% rơi ra vật phẩm phụ trợ
  let actionDescription = '';

  if (workType === 'mining') {
    earnedCoins = Math.floor(Math.random() * 21) + 10; // 10 -> 30
    actionDescription = 'Đạo hữu vác cuốc sắt vào linh cốc khai sơn phá quặng, đào sâu vách đá hấp thu linh thạch thô...';
    if (Math.random() < rewardItemChance) {
      rewardItem = { id: 'material_iron_1', name: 'Huyền Thiết Sa' };
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
      rewardItem = { id: 'seed_linh_thao_1', name: 'Hạt Giống Linh Thảo' };
    }
  } else if (workType === 'patrolling') {
    earnedCoins = 20; // Cố định
    actionDescription = 'Đạo hữu khoác đao tuần hành canh gác nội môn tông thành, bảo đảm yên ổn sơn các...';
    if (Math.random() < 0.10) {
      rewardItem = { id: 'pill_tu_vi_low', name: 'Sơ Cấp Tụ Khí Đan' };
    }
  }

  // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
  const { cultivationService } = require('../../services/CultivationService');
  cultivationService.claimIdleCultivation(discordId);

  const freshUser = userRepository.get(discordId)!;

  // Tăng tiền và trừ stamina cho user
  const baseStaminaCost = 10;
  const staminaCost = Math.round(baseStaminaCost * (1 - staminaSave));

  userRepository.update(discordId, {
    coin_ha_pham: freshUser.coin_ha_pham + earnedCoins,
    stamina: Math.max(0, freshUser.stamina - staminaCost)
  });

  if (rewardItem) {
    inventoryRepository.addItem(discordId, rewardItem.id, 1);
  }

  // Kiểm tra thành tựu làm việc (đếm từ audit_logs)
  const totalWork = db.prepare(
    "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'work'"
  ).get(discordId) as { c: number };
  const now2 = Math.floor(Date.now() / 1000);
  db.prepare(
    "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'work', ?, ?)"
  ).run(discordId, JSON.stringify({ type: workType }), now2);
  const newWorkCount = totalWork.c + 1;
  achievementService.setProgress(discordId, 'sh_14', newWorkCount);
  achievementService.setProgress(discordId, 'sh_15', newWorkCount);

  // Thêm năng lượng cho linh mạch Tu Luyện
  leylineService.addEnergy(discordId, 'tuluyen', 10);

  // Xử lý Sư Đồ
  const { mentorshipService } = require('../../services/MentorshipService');
  const mentResult = mentorshipService.handleApprenticeWork(discordId, earnedCoins);

  const updatedUser = userRepository.get(discordId)!;

  const staminaBar = getProgressBar(updatedUser.stamina, 500, 8);

  const embed = new EmbedBuilder()
    .setTitle('⚒️ Kết Quả Lao Động Tu Hành')
    .setColor('#27ae60')
    .setDescription(actionDescription)
    .addFields(
      { name: '🪙 Linh Thạch Kiếm Được', value: `🟤 **+${earnedCoins}** Hạ Phẩm Linh Thạch`, inline: true }
    )
    .setTimestamp();

  if (rewardItem) {
    embed.addFields({ name: '🎁 Cơ Duyên Rơi Đồ', value: `Nhận được **1x ${rewardItem.name}**!`, inline: true });
  }

  if (mentResult.apprenticeBonusExp > 0) {
    embed.addFields({
      name: '👨‍🏫 Sư Đồ Giáo Hóa',
      value: `• Nhận **+${mentResult.apprenticeBonusExp}** Tu Vi (+5% Sư đồ bonus)\n• Sư phụ nhận **+${mentResult.mentorGainedExp}** Tu Vi & **+${mentResult.mentorGainedCoins}** Linh Thạch`,
      inline: false
    });
  }

  embed.addFields(
    { name: '⚡ Thể Lực Tiêu Hao', value: `**-${staminaCost}** Thể Lực\n└ Còn lại: **${updatedUser.stamina}/500**\n└ ${staminaBar}`, inline: false },
    { name: '💼 Số Dư Hiện Tại', value: `🟤 **${updatedUser.coin_ha_pham}** Hạ Phẩm Linh Thạch`, inline: false }
  );

  // Kiểm tra Kỳ Ngộ (15%)
  const encounter = encounterService.rollEncounter('lamviec');
  if (encounter) {
    embed.addFields({
      name: `🌟 Kỳ Ngộ: ${encounter.title}`,
      value: `${encounter.description}\n\n**Lựa chọn:**\n${encounter.choices.map((c, i) => `**${i + 1}.** ${c.text} (${Math.round(c.successRate * 100)}% thành công)`).join('\n')}`,
    });
  }

  return { success: true, embed, encounter };
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
              { name: '⚒️ Khai Thác Linh Khoáng (Mining)', value: 'mining' },
              { name: '🌿 Hái Lượm Linh Thảo (Gathering)', value: 'gathering' },
              { name: '🛡️ Tuần Tra Tông Môn (Patrolling)', value: 'patrolling' }
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const workType = interaction.options.getString('congviec', true) as 'mining' | 'gathering' | 'patrolling';

    try {
      const result = performWork(discordId, workType);
      if (!result.success) {
        await interaction.reply({ content: result.message!, ephemeral: true });
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

      await interaction.reply({ embeds: [result.embed!], components });
    } catch (error) {
      console.error('Lỗi khi lưu kết quả làm việc:', error);
      await interaction.reply({
        content: '❌ Đã xảy ra lỗi hệ thống khi lưu kết quả lao động.',
        ephemeral: true
      });
    }
  }
}
