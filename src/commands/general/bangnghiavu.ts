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
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
      return;
    }

    const cards = bountyBoardService.getTodayCards(userId, user.level);
    const isCompleted = bountyBoardService.isCompletedToday(userId);
    const streak = bountyBoardService.getStreak(userId);

    const tierEmoji: Record<string, string> = { common: '⚪', elite: '🟢', legendary: '🟡' };

    let desc = `<:thienthu:1547875509919289465> **Bảng Nghĩa Vụ** — Chọn 3 nhiệm vụ\n`;
    desc += `🔥 Liên Tục Tu Hành: ${streak}/5 ngày${streak >= 5 ? ' (Thiên Cơ tất ứng, tất đắc Thiên Phẩm!)' : ''}\n`;
    desc += isCompleted ? `✅ Đã hoàn thành hôm nay` : `⏳ Chưa hoàn thành\n\n`;

    if (!isCompleted) {
      desc += '**Chọn 3 nhiệm vụ:**\n';
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        desc += `${tierEmoji[c.tier]} **${c.name}** — ${c.description}\n`;
        desc += `  <:tin4:1547875508174327828> ${c.requirement}: 0/${c.target} | <:qua4:1547881540372009021> ${c.rewardExp} <:iexp:1547935874077954078>, ${c.rewardCoins} LT <:lt1:1547866122123218945>`;
        if (c.rewardKnb > 0) desc += `, ${c.rewardKnb} CPLT <:lt2:1547866118817845309>`;
        desc += '\n';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('<:thienthu:1547875509919289465> Bảng Nghĩa Vụ')
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
      await interaction.editReply(toV2Payload([embed], [row]));
    } else {
      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
