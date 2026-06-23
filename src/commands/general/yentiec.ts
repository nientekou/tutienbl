import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import { TuTienClient } from '../../client/TuTienClient';
import { feastService } from '../../services/FeastService';

export default class YenTiecCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('yentiec')
        .setDescription('Tham gia Tông Môn Yến Tiệc hằng ngày để hồi phục +100 Thể Lực')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const result = feastService.joinFeast(userId);

    const embed = new EmbedBuilder()
      .setTitle('🍲 TÔNG MÔN YẾN TIỆC')
      .setColor(result.success ? '#2ecc71' : '#e74c3c')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply(toV2Payload([embed]));
  }
}
