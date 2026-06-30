import { ChatInputCommandInteraction, SlashCommandBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { feastService } from '../../services/FeastService';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

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

    const embed = container(result.success ? V2_COLORS.success : V2_COLORS.danger, [
      header('🍲 TÔNG MÔN YẾN TIỆC'),
      separator(),
      body(result.message)
    ]);

    await interaction.editReply(toV2Payload([embed]));
  }
}
