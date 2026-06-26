import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
        .setDescription('Bảng Nghĩa Vụ — Chọn 3 trong 6 nhiệm vụ hàng ngày')
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const cards = bountyBoardService.getTodayCards(userId, user.level);
    const isCompleted = bountyBoardService.isCompletedToday(userId);
    const streak = bountyBoardService.getStreak(userId);

    const tierEmoji: Record<string, string> = { common: '⚪', elite: '🟢', legendary: '🟡' };

    let desc = `📋 **Bảng Nghĩa Vụ** — Chọn 3 nhiệm vụ\n`;
    desc += `🔥 Streak: ${streak}/5 ngày${streak >= 5 ? ' (Guaranteed Legendary!)' : ''}\n`;
    desc += isCompleted ? `✅ Đã hoàn thành hôm nay` : `⏳ Chưa hoàn thành\n\n`;

    if (!isCompleted) {
      desc += '**Chọn 3 nhiệm vụ:**\n';
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        desc += `${tierEmoji[c.tier]} **${c.name}** — ${c.description}\n`;
        desc += `  📊 ${c.requirement}: 0/${c.target} | 🎁 ${c.rewardExp} EXP, ${c.rewardCoins} LT`;
        if (c.rewardKnb > 0) desc += `, ${c.rewardKnb} KNB`;
        desc += '\n';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Bảng Nghĩa Vụ')
      .setColor(EMBED_COLORS.MYSTIC)
      .setDescription(desc)
      .setTimestamp();

    if (!isCompleted) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bangnghiavu_claim_${userId}`)
          .setLabel('Hoàn Thành Hôm Nay')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
      );
      await interaction.reply(toV2Payload([embed], [row]));
    } else {
      await interaction.reply(toV2Payload([embed]));
    }
  }
}
