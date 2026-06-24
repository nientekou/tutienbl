import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { kyNgoService } from '../../services/KyNgoService';
import { container, header, body, V2_COLORS, V2_FLAG } from '../../utils/v2Components';

export default class KyNgoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('kyngo')
        .setDescription('Kỳ ngộ tu luyện - Random events khi tu luyện')
        .addSubcommand(sub =>
          sub.setName('sukien').setDescription('Xem sự kiện kỳ ngộ đang chờ')
        )
        .addSubcommand(sub =>
          sub.setName('lichsu').setDescription('Xem lịch sử kỳ ngộ')
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

    if (sub === 'sukien') {
      const events = kyNgoService.getPendingEvents(userId);
      if (!events.length) {
        await interaction.editReply({
          content: '📭 Không có sự kiện kỳ ngộ nào đang chờ.\n*Hãy tu luyện (`/tuluyen`) để có cơ hội gặp kỳ ngộ!*'
        });
        return;
      }

      for (const evt of events) {
        const data = JSON.parse(evt.event_data);
        const comp = container(V2_COLORS.mystic, [header(data.title), body(data.description)]);

        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const choice of data.choices) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`kyngo_choose_${evt.id}_${choice.id}_${userId}`)
              .setLabel(choice.label)
              .setStyle(choice.riskLevel === 'high' ? ButtonStyle.Danger : choice.riskLevel === 'medium' ? ButtonStyle.Primary : ButtonStyle.Success)
          );
        }

        await interaction.editReply({ components: [comp, row], flags: V2_FLAG });
        return;
      }
    } else if (sub === 'lichsu') {
      const history = kyNgoService.getEventHistory(userId, 10);
      if (!history.length) {
        await interaction.editReply({ content: '📭 Chưa có lịch sử kỳ ngộ.' });
        return;
      }

      let desc = '';
      for (const h of history) {
        const data = JSON.parse(h.event_data);
        const result = h.result_data ? JSON.parse(h.result_data) : null;
        desc += `**${data.title}** — ${result?.success ? '✅' : '❌'} ${h.selected_choice || 'N/A'}\n`;
      }
      const comp = container(V2_COLORS.mystic, [header('📜 Lịch Sử Kỳ Ngộ'), body(desc)]);
      await interaction.editReply({ components: [comp], flags: V2_FLAG });
    }
  }
}
