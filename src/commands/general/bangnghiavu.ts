import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { bountyBoardService } from '../../services/BountyBoardService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class BangNghiaVuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('bangnghiavu')
        .setDescription('Xem Bảng Nghĩa Vụ hôm nay tại Trấn Hải Các')
    );
  }

  // =========================
  // Thanh tiến độ
  // =========================

  private progressBar(current: number, total: number): string {
    const length = 10;
    const filled = Math.round((current / total) * length);

    return (
      '█'.repeat(Math.min(filled, length)) +
      '░'.repeat(Math.max(length - filled, 0))
    );
  }

  async execute(
    client: TuTienClient,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {

    const userId = interaction.user.id;

    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật.'
      });
      return;
    }

    const cards = bountyBoardService.getTodayCards(userId, user.level);

    const streak = bountyBoardService.getStreak(userId);

    const completedToday = bountyBoardService.isCompletedToday(userId);

    const selected = bountyBoardService.getSelectedBounties(userId);

    const progress = bountyBoardService.getProgress(userId);

    const tierInfo = {
      common: { emoji: '⚪', name: 'Phàm' },
      elite: { emoji: '🟢', name: 'Linh' },
      rare: { emoji: '🔵', name: 'Huyền' },
      epic: { emoji: '🟣', name: 'Địa' },
      legendary: { emoji: '🟡', name: 'Thiên' }
    };

    // =========================
    // Description
    // =========================

    let desc = '';

    desc += `> *Trấn Hải Các mỗi ngày ban bố sáu đạo nghĩa vụ. Đạo hữu chỉ có thể tiếp nhận ba đạo, hoàn thành để lĩnh cơ duyên và công thưởng.*\n\n`;

    desc += `🔥 **Liên Tục Tu Hành:** **${streak}/5 ngày**`;

    if (streak >= 5) {
      desc += ` · 🌌 **Thiên Cơ đã động.**`;
    }

    desc += '\n';

    desc += completedToday
      ? `✅ **Hôm nay đã hoàn thành toàn bộ nghĩa vụ.**\n\n`
      : `⏳ **Hôm nay chưa hoàn thành nghĩa vụ.**\n\n`;

    // =========================
    // Danh sách nghĩa vụ
    // =========================

    desc += `## 📜 Sáu Đạo Nghĩa Vụ Hôm Nay\n`;

    cards.forEach((quest, index) => {

      const tier =
        tierInfo[
          (quest.tier as keyof typeof tierInfo) || 'common'
        ];

      const current = progress[quest.id] ?? 0;

      const chosen = selected.includes(quest.id);

      desc += `### ${tier.emoji} [${tier.name}] ${quest.name}\n`;

      desc += `> ${quest.description}\n`;

      desc += `> ${this.progressBar(current, quest.target)} **${current}/${quest.target}**`;

      if (chosen) {
        desc += ` · ✅ Đã tiếp nhận`;
      }

      desc += '\n';

      desc += `> **Thưởng:** ${quest.rewardExp} Tu Vi <:iexp:1547935874077954078> · ${quest.rewardCoins} Linh Thạch <:lt1:1547866122123218945>`;

      if (quest.rewardKnb > 0) {
        desc += ` · ${quest.rewardKnb} Cống Phẩm Linh Thạch <:lt2:1547866118817845309>`;
      }

      desc += '\n\n';
    });

    // =========================
    // Embed
    // =========================

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.MYSTIC)
      .setTitle('📜 Trấn Hải Các · Bảng Nghĩa Vụ')
      .setDescription(desc)
      .setFooter({
        text: completedToday
          ? 'Nghĩa vụ hôm nay đã hoàn thành.'
          : selected.length === 3
            ? 'Hoàn thành cả ba nghĩa vụ đã tiếp nhận để lĩnh thưởng.'
            : 'Chọn ba nghĩa vụ để bắt đầu hôm nay.'
      })
      .setTimestamp();

    // =========================
    // Nếu chưa chọn nghĩa vụ
    // =========================

    if (!completedToday && selected.length === 0) {

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`bangnghiavu_select_${userId}`)
        .setPlaceholder('Tiếp nhận 3 nghĩa vụ hôm nay')
        .setMinValues(3)
        .setMaxValues(3);

      cards.forEach((quest) => {

        const tier =
          tierInfo[
            (quest.tier as keyof typeof tierInfo) || 'common'
          ];

        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${tier.name} • ${quest.name}`)
            .setDescription(quest.description.slice(0, 90))
            .setValue(quest.id)
            .setEmoji(tier.emoji)
        );

      });

      const row =
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(selectMenu);

      await interaction.editReply(
        toV2Payload([embed], [row])
      );

      return;
    }

    // =========================
    // Đã chọn nghĩa vụ hoặc đã hoàn thành
    // =========================

    await interaction.editReply(
      toV2Payload([embed])
    );
  }
}
