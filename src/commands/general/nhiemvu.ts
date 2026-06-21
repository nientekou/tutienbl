import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { dailyQuestService } from '../../services/DailyQuestService';
import { getProgressBar } from '../../utils/constants';

const CATEGORY_EMOJI: Record<string, string> = {
  combat: '⚔️',
  life: '🌿',
  social: '☯️',
  special: '⭐'
};

/**
 * Tạo Embed nhiệm vụ hàng ngày
 */
export function getNhiemVuEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder().setTitle('❌ Lỗi').setColor('#e74c3c').setDescription('Nhân vật không tồn tại.');
  }

  const quests = dailyQuestService.getOrAssignQuests(userId);
  const resetSecs = dailyQuestService.getSecondsToReset();
  const resetHours = Math.floor(resetSecs / 3600);
  const resetMins = Math.floor((resetSecs % 3600) / 60);

  const completedCount = quests.filter(q => q.progress >= q.required).length;
  const claimedCount = quests.filter(q => q.is_claimed === 1).length;

  const embed = new EmbedBuilder()
    .setTitle('📜 THIÊN CƠ CÁC - NHIỆM VỤ HÀNG NGÀY')
    .setColor('#9b59b6')
    .setDescription(
      `Tu sĩ tu hành chân chính không chỉ tịnh tọa trong động phủ. Thiên Cơ Các mỗi ngày giao phó 3 nhiệm vụ cho các đạo hữu trong thiên hạ.\n\n` +
      `🎖️ **Đã hoàn thành:** ${completedCount}/3 | ✅ **Đã nhận thưởng:** ${claimedCount}/3\n` +
      `⏰ **Nhiệm vụ reset sau:** ${resetHours}h ${resetMins}p`
    )
    .setTimestamp();

  for (const quest of quests) {
    const def = quest.definition;
    if (!def) continue;

    const isComplete = quest.progress >= quest.required;
    const isClaimed = quest.is_claimed === 1;
    const progressBar = getProgressBar(quest.progress, quest.required);

    const statusText = isClaimed
      ? '✅ **ĐÃ NHẬN THƯỞNG**'
      : isComplete
        ? '🎁 **HOÀN THÀNH - Nhấn Nhận Thưởng!**'
        : `⏳ Tiến trình: ${progressBar} (${quest.progress}/${quest.required})`;

    const rewardText = `🟤 ${def.rewardCoin} Linh Thạch | 🌿 ${def.rewardTuVi} Tu Vi | 🧘 ${def.rewardNgotinh} Ngộ Tính`;

    embed.addFields({
      name: `${def.emoji} ${def.name} ${CATEGORY_EMOJI[def.category] || ''}`,
      value: `${def.description}\n${statusText}\n💰 **Phần thưởng:** ${rewardText}`,
      inline: false
    });
  }

  embed.setFooter({ text: 'Tiến trình tự động cập nhật khi đạo hữu thực hiện các hoạt động tương ứng.' });
  return embed;
}


/**
 * Tạo Components nhiệm vụ hàng ngày
 */
export function getNhiemVuComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const quests = dailyQuestService.getOrAssignQuests(userId);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const claimRow = new ActionRowBuilder<ButtonBuilder>();
  let hasClaimable = false;

  for (const quest of quests) {
    const def = quest.definition;
    if (!def) continue;
    const isComplete = quest.progress >= quest.required;
    const isClaimed = quest.is_claimed === 1;

    if (!isClaimed) {
      claimRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`nhiemvuclaim_${quest.quest_id}_${userId}`)
          .setLabel(`${def.emoji} Nhận: ${def.name.substring(0, 20)}`)
          .setStyle(isComplete ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(!isComplete)
      );
      hasClaimable = true;
    }
  }

  if (hasClaimable) rows.push(claimRow);

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hosoback_${userId}`)
      .setLabel('🔙 Quay Lại Hồ Sơ')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(backRow);
  return rows;
}

export default class NhiemVuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('nhiemvu')
        .setDescription('Xem và nhận thưởng nhiệm vụ hàng ngày từ Thiên Cơ Các.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
      return;
    }

    const embed = getNhiemVuEmbed(userId);
    const rows = getNhiemVuComponents(userId);
    await interaction.reply({ embeds: [embed], components: rows });
  }
}
