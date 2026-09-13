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
import { bountyBoardService, type BountyTier } from '../../services/BountyBoardService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

const TIER_INFO: Record<BountyTier, { emoji: string; name: string }> = {
  common: { emoji: '⚪', name: 'Phàm' },
  elite: { emoji: '🟢', name: 'Linh' },
  rare: { emoji: '🔵', name: 'Huyền' },
  epic: { emoji: '🟣', name: 'Địa' },
  legendary: { emoji: '🟡', name: 'Thiên' }
};

function progressBar(current: number, total: number): string {
  const length = 10;
  if (total <= 0) return '░'.repeat(length);
  const ratio = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export default class BangNghiaVuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('bangnghiavu')
        .setDescription('Xem Bảng Nghĩa Vụ hôm nay tại Trấn Hải Các')
    );
  }

  async execute(
    client: TuTienClient,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
      return;
    }

    const cards = bountyBoardService.getTodayCards(userId, user.level);
    const selected = bountyBoardService.getSelectedBounties(userId);
    const progress = bountyBoardService.getProgress(userId);
    const streak = bountyBoardService.getStreak(userId);
    const completedToday = bountyBoardService.isCompletedToday(userId);

    let desc =
      '> *Trấn Hải Các mỗi ngày ban bố sáu đạo nghĩa vụ. Đạo hữu chỉ được tiếp nhận ba đạo; khi đã chọn đủ ba, lựa chọn trong ngày sẽ được khóa.*\n\n';

    desc += `🔥 **Liên Tục Tu Hành:** **${streak}/5 ngày**`;
    if (streak >= 5) desc += ' · 🌌 **Thiên Cơ đã ứng.**';
    desc += '\n';

    if (completedToday) {
      desc += '✅ **Nghĩa vụ hôm nay đã viên mãn.**\n\n';
    } else if (selected.length === 3) {
      desc += '📜 **Đã tiếp nhận đủ 3/3 nghĩa vụ.**\n\n';
    } else {
      desc += `⏳ **Đã chọn ${selected.length}/3 nghĩa vụ.** Bấm các nút bên dưới để chọn hoặc bỏ chọn.\n\n`;
    }

    desc += '## 📜 Sáu Đạo Nghĩa Vụ Hôm Nay\n';

    for (const quest of cards) {
      const tier = TIER_INFO[quest.tier];
      const current = Math.min(progress[quest.id] ?? 0, quest.target);
      const chosen = selected.includes(quest.id);
      const finished = chosen && current >= quest.target;

      desc += `### ${tier.emoji} [${tier.name}] ${quest.name}\n`;
      desc += `> ${quest.description}\n`;
      desc += `> ${progressBar(current, quest.target)} **${current}/${quest.target}**`;

      if (finished) desc += ' · ✅ Hoàn thành';
      else if (chosen) desc += ' · 📌 Đã tiếp nhận';

      desc += '\n';
      desc += `> **Thưởng:** ${quest.rewardExp} Tu Vi <:iexp:1547935874077954078> · ${quest.rewardCoins} LT <:lt1:1547866122123218945>`;
      if (quest.rewardKnb > 0) {
        desc += ` · ${quest.rewardKnb} CPLT <:lt2:1547866118817845309>`;
      }
      desc += '\n\n';
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.MYSTIC)
      .setTitle('📜 Trấn Hải Các · Bảng Nghĩa Vụ')
      .setDescription(desc)
      .setFooter({
        text: completedToday
          ? 'Công thưởng hôm nay đã được kết toán.'
          : selected.length === 3
            ? 'Tiến độ sẽ tự ghi nhận trong lúc hành sự.'
            : 'Chọn đủ ba nghĩa vụ để bắt đầu ghi nhận tiến độ.'
      })
      .setTimestamp();

    if (completedToday) {
      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Dùng button thay cho String Select Menu để tương thích với router hiện tại:
    // action của customId luôn là phần đầu trước dấu "_".
    if (selected.length < 3) {
      for (let i = 0; i < cards.length; i += 3) {
        const row = new ActionRowBuilder<ButtonBuilder>();

        for (const quest of cards.slice(i, i + 3)) {
          const tier = TIER_INFO[quest.tier];
          const chosen = selected.includes(quest.id);

          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`bangpick_${quest.id}_${userId}`)
              .setLabel(`${tier.name} · ${quest.name}`.slice(0, 80))
              .setEmoji(tier.emoji)
              .setStyle(chosen ? ButtonStyle.Success : ButtonStyle.Secondary)
          );
        }

        rows.push(row);
      }
    } else if (bountyBoardService.canCompleteToday(userId)) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`bangclaim_${userId}`)
            .setLabel('Lĩnh Công Thưởng')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
        )
      );
    }

    await interaction.editReply(rows.length > 0 ? toV2Payload([embed], rows) : toV2Payload([embed]));
  }
}
