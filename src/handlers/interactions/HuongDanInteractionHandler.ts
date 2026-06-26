import { Interaction } from 'discord.js';
import { getHuongDanEmbed } from '../../commands/general/huongdan';
import { toV2Payload } from '../../utils/uiSystem';

export async function handleHuongDanAction(interaction: Interaction, action: string, parts: string[], userId: string): Promise<void> {
  if (!interaction.isStringSelectMenu()) return;

  const topic = interaction.values[0];
  const embed = getHuongDanEmbed(topic);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(toV2Payload([embed]));
  } else {
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
}
