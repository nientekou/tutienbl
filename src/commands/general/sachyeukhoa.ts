import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { bestiaryService } from '../../services/BestiaryService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

class SachYeuKhoaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sachyeukhoa')
        .setDescription('Sách Yêu Khoa — Nhật ký quái vật đã gặp')
        .addStringOption(opt =>
          opt.setName('zone')
            .setDescription('Lọc theo khu vực')
            .setRequired(false)
        )
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const zone = interaction.options.getString('zone') || undefined;
    const entries = bestiaryService.getEntries(userId, zone);

    if (entries.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📖 Sách Yêu Khoa')
        .setColor(EMBED_COLORS.INFO)
        .setDescription('Chưa ghi nhận enemy nào. Hãy đi chiến đấu để thu thập thông tin!')
        .setTimestamp();
      await interaction.reply(toV2Payload([embed]));
      return;
    }

    // Group by zone
    const byZone: Record<string, typeof entries> = {};
    for (const e of entries) {
      const z = e.zone || 'Khác';
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(e);
    }

    let desc = `📖 **Sách Yêu Khoa** — ${entries.length} enemy đã gặp\n\n`;

    for (const [zoneName, zoneEntries] of Object.entries(byZone)) {
      const defeated = zoneEntries.filter(e => e.times_defeated > 0).length;
      const progress = defeated === zoneEntries.length ? '✅' : `${defeated}/${zoneEntries.length}`;

      desc += `**${zoneName}** (${progress})\n`;
      for (const e of zoneEntries) {
        const status = e.times_defeated > 0 ? '✅' : '❓';
        const kills = e.times_defeated > 0 ? ` (x${e.times_defeated})` : '';
        desc += `  ${status} **${e.enemy_name}** [${e.element}]${kills}\n`;
      }
      desc += '\n';
    }

    const embed = new EmbedBuilder()
      .setTitle('📖 Sách Yêu Khoa')
      .setColor(EMBED_COLORS.INFO)
      .setDescription(desc.slice(0, 4000))
      .setTimestamp();

    await interaction.reply(toV2Payload([embed]));
  }
}

export default new SachYeuKhoaCommand();
