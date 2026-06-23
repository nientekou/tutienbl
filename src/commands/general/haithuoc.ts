import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { performWork } from './lamviec';

export default class HaiThuocCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('haithuoc')
        .setDescription('Hái thuốc (Dược Sư) thu thập linh thảo (Tốn 10 Thể Lực)')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const result = performWork(interaction.user.id, 'gathering');

    if (!result.success) {
      await interaction.editReply({ content: result.message });
      return;
    }

    const components: any[] = [];
    const encounter = result.encounter;
    if (encounter) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      encounter.choices.forEach((c: any, idx: number) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`encounter_${encounter.id}_${idx}_${interaction.user.id}`)
            .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
            .setStyle(ButtonStyle.Primary)
        );
      });
      components.push(row);
    }

    if (result.embed) {
      await interaction.editReply({ embeds: [result.embed], components });
    } else {
      await interaction.editReply({ content: result.message, components });
    }
  }
}
