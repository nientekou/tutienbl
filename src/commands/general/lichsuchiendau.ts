import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { combatReplayService } from '../../services/CombatReplayService';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class LichSuChienDauCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('lichsuchiendau')
        .setDescription('Xem lịch sử chiến đấu và phân tích.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem 20 trận gần nhất.')
        )
        .addSubcommand(sub =>
          sub
            .setName('chitiet')
            .setDescription('Xem chi tiết và phân tích một trận.')
            .addIntegerOption(opt =>
              opt.setName('id')
                .setDescription('Mã trận đấu (xem trong danh sách)')
                .setRequired(true)
            )
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

    if (sub === 'danhsach') {
      const replays = combatReplayService.getRecentReplays(userId);
      if (replays.length === 0) {
        await interaction.editReply({ content: '📭 Chưa có trận đấu nào được ghi lại.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Lịch Sử Chiến Đấu')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(
          replays.map((r, i) =>
            `**#${r.id}** — ${r.enemyName || 'Không rõ'} (${new Date(r.createdAt * 1000).toLocaleString('vi-VN')})`
          ).join('\n')
        )
        .setFooter({ text: 'Dùng /lichsuchiendau chitiet id:<mã> để xem phân tích' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'chitiet') {
      const replayId = interaction.options.getInteger('id', true);
      const result = combatReplayService.getReplay(userId, replayId);
      if (!result) {
        await interaction.editReply({ content: '❌ Không tìm thấy trận đấu này.' });
        return;
      }

      const analysis = combatReplayService.analyze(result);
      const description = combatReplayService.getReplayDescription(analysis);

      const embed = new EmbedBuilder()
        .setTitle('📊 Phân Tích Chiến Đấu')
        .setColor(analysis.efficiencyRating === 'S' || analysis.efficiencyRating === 'A'
            ? EMBED_COLORS.SUCCESS
            : analysis.efficiencyRating === 'B'
              ? EMBED_COLORS.ORANGE
              : EMBED_COLORS.ERROR)
        .setDescription(description);
      await interaction.editReply({ embeds: [embed] });
    }
  }
}
