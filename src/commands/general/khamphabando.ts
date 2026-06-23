import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { mapFragmentService } from '../../services/MapFragmentService';

const RARITY_EMOJI: Record<string, string> = {
  common: '🟤',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
};

export default class KhamPhaBanDoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('khamphabando')
        .setDescription('Hệ thống Mảnh Bản Đồ - Thu thập 5 mảnh để ghép thành kho báu.')
        .addSubcommand(sub =>
          sub
            .setName('ghep')
            .setDescription('Ghép 5 Mảnh Bản Đồ để tạo ra một vị trí kho báu.')
        )
        .addSubcommand(sub =>
          sub
            .setName('den')
            .setDescription('Đến vị trí kho báu để khai thác.')
            .addIntegerOption(opt =>
              opt.setName('id').setDescription('ID của kho báu').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('cuop')
            .setDescription('Cướp kho báu của người chơi khác.')
            .addIntegerOption(opt =>
              opt.setName('id').setDescription('ID của kho báu').setRequired(true)
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Dùng `/taonhanvat` để bắt đầu.' });
      return;
    }

    const subcmd = interaction.options.getSubcommand(false);

    if (!subcmd) {
      await this.showStatus(interaction, userId);
      return;
    }

    if (subcmd === 'ghep') {
      await this.handleCombine(interaction, userId);
    } else if (subcmd === 'den') {
      await this.handleClaim(interaction, userId);
    } else if (subcmd === 'cuop') {
      await this.handleSteal(interaction, userId);
    }
  }

  private async showStatus(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const fragmentCount = mapFragmentService.getFragmentCount(userId);
    const activeLocations = mapFragmentService.getActiveLocations(userId);

    const embed = new EmbedBuilder()
      .setTitle('🗺️ MẢNH BẢN ĐỒ')
      .setColor('#e67e22')
      .setDescription(
        `**Mảnh Bản Đồ hiện có:** **${fragmentCount}/5**\n` +
        `*Thu thập Mảnh Bản Đồ qua công việc **Phiêu Lưu (/lamviec adventure)** và ghép chúng để tìm kho báu!*\n\n` +
        `**Hướng dẫn:**\n` +
        `\`/khamphabando ghep\` - Ghép 5 mảnh thành kho báu\n` +
        `\`/khamphabando den [id]\` - Đến khai thác kho báu\n` +
        `\`/khamphabando cuop [id]\` - Cướp kho báu người khác`
      )
      .setTimestamp();

    if (fragmentCount > 0) {
      const barLength = 10;
      const filled = Math.round((fragmentCount / 5) * barLength);
      const bar = '■'.repeat(filled) + '□'.repeat(Math.max(0, barLength - filled));
      embed.addFields({
        name: '📊 Tiến Trình',
        value: `\`${bar}\` **${fragmentCount}/5**`,
        inline: false,
      });
    }

    if (activeLocations.length > 0) {
      const locationList = activeLocations.map(loc => {
        const remaining = Math.max(0, loc.expires_at - Math.floor(Date.now() / 1000));
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const emoji = RARITY_EMOJI[loc.rarity] || '📦';
        return `**#${loc.id}** ${emoji} **${loc.location_name}** [${loc.coord_x}, ${loc.coord_y}]\n└ ⏳ Còn **${hours}g ${mins}p** | ${loc.rarity.toUpperCase()}`;
      }).join('\n');

      embed.addFields({
        name: `📍 Kho Báu Của Đạo Hữu (${activeLocations.length})`,
        value: locationList,
        inline: false,
      });
    }

    const allLocations = mapFragmentService.getAllActiveLocations().filter(l => l.owner_id !== userId);
    if (allLocations.length > 0) {
      const stealTargets = allLocations.slice(0, 5).map(loc => {
        const emoji = RARITY_EMOJI[loc.rarity] || '📦';
        return `**#${loc.id}** ${emoji} **${loc.location_name}** - Chủ: <@${loc.owner_id}>`;
      }).join('\n');

      embed.addFields({
        name: `👀 Kho Báu Có Thể Cướp (${allLocations.length})`,
        value: stealTargets + '\n*Dùng `/khamphabando cuop [id]` để cướp!*',
        inline: false,
      });
    }

    embed.setFooter({ text: 'Mảnh Bản Đồ có thể nhận được khi làm công việc Phiêu Lưu.' });
    await interaction.editReply({ embeds: [embed] });
  }

  private async handleCombine(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const result = mapFragmentService.combineFragments(userId);
    await interaction.editReply({ content: result.message });
  }

  private async handleClaim(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const locationId = interaction.options.getInteger('id', true);
    const result = mapFragmentService.claimLocation(userId, locationId);

    const embed = new EmbedBuilder()
      .setTitle(result.success ? '🎉 Khai Thác Kho Báu' : '❌ Thất Bại')
      .setColor(result.success ? '#f1c40f' : '#e74c3c')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleSteal(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const locationId = interaction.options.getInteger('id', true);
    const result = mapFragmentService.stealLocation(userId, locationId);

    const embed = new EmbedBuilder()
      .setTitle(result.success ? '⚔️ Cướp Thành Công' : '💢 Cướp Thất Bại')
      .setColor(result.success ? '#e74c3c' : '#95a5a6')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
