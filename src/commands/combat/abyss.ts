import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { abyssDungeonService } from '../../services/AbyssDungeonService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class AbyssCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('abyss')
        .setDescription('Häng Void — Tháp Vô Tận.')
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin và tiến độ Abyss.')
        )
        .addSubcommand(sub =>
          sub
            .setName('tiennhap')
            .setDescription('Tiến vào Häng Void (level 80+, 5 lượt/ngày).')
        )
        .addSubcommand(sub =>
          sub
            .setName('bangxep')
            .setDescription('Xem bảng xếp hạng Abyss tháng này.')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'thongtin') {
      const description = abyssDungeonService.getDescription(userId);
      const embed = new EmbedBuilder()
        .setTitle('🕳️ Häng Void')
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription(description)
        .setFooter({ text: 'Dùng /abyss tiennhap để chiến đấu' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'tiennhap') {
      const eligibility = abyssDungeonService.canEnter(userId, user.level);
      if (!eligibility.eligible) {
        await interaction.editReply({ content: `❌ ${eligibility.reason}` });
        return;
      }

      const prog = abyssDungeonService.getProgress(userId);
      const currentFloor = Math.max(1, prog.currentFloor || 1);
      const enemy = abyssDungeonService.getEnemyForFloor(currentFloor);
      const isBoss = currentFloor % 10 === 0;

      const embed = new EmbedBuilder()
        .setTitle(isBoss ? `👑 Abyss Boss — Floor ${currentFloor}` : `👹 Abyss — Floor ${currentFloor}`)
        .setColor(isBoss ? EMBED_COLORS.GOLD : EMBED_COLORS.DUNGEON)
        .setDescription(
          `**${enemy.name}**\n` +
          `HP: **${enemy.hp.toLocaleString()}**\n` +
          `ATK: **${enemy.atk.toLocaleString()}**\n` +
          `DEF: **${enemy.def.toLocaleString()}**\n` +
          `Element: **${enemy.element}**\n\n` +
          `Lượt còn lại: **${prog.attemptsLeft}**/5`
        );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'bangxep') {
      const leaderboard = abyssDungeonService.getLeaderboard(10);
      if (leaderboard.length === 0) {
        await interaction.editReply({ content: '📭 Chưa có ai lên bảng xếp hạng tháng này.' });
        return;
      }

      const medalEmojis = ['🥇', '🥈', '🥉'];
      const embed = new EmbedBuilder()
        .setTitle('🏆 Abyss Leaderboard')
        .setColor(EMBED_COLORS.GOLD)
        .setDescription(
          leaderboard.map((entry, i) => {
            const medal = medalEmojis[i] || `#${i + 1}`;
            return `${medal} <@${entry.userId}> — Floor **${entry.bestFloor}**`;
          }).join('\n')
        )
        .setFooter({ text: 'Bảng xếp hạng tháng này' });
      await interaction.editReply({ embeds: [embed] });
    }
  }
}
