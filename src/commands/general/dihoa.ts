import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { rareFireService } from '../../services/RareFireService';
import { container, header, body, V2_COLORS, V2_FLAG } from '../../utils/v2Components';
import { RARE_FIRES } from '../../config/rareFireConstants';

export default class DiHoaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dihoa')
        .setDescription('Dị Hỏa - Thu thập và cường hóa ngọn lửa hiếm')
        .addSubcommand(sub =>
          sub.setName('danhsach').setDescription('Xem danh sách dị hỏa đã thu thập')
        )
        .addSubcommand(sub =>
          sub.setName('trangbi').setDescription('Trang bị dị hỏa')
        )
        .addSubcommand(sub =>
          sub.setName('nangcap').setDescription('Nâng cấp dị hỏa bằng nguyên liệu')
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
      const fires = rareFireService.getUserFires(userId);
      if (!fires.length) {
        await interaction.editReply({ content: '🔥 Đạo hữu chưa có dị hỏa nào. Hãy chiến đấu boss hoặc dungeon để thu thập!' });
        return;
      }

      let desc = '';
      for (const f of fires) {
        const def = RARE_FIRES.find(r => r.type === f.fire_type);
        const equipped = f.equipped ? ' ⚡' : '';
        desc += `**${f.fire_name}** (T${f.tier})${equipped} — Level ${f.level}\n`;
        desc += `  🔥 Alchemy +${def?.alchemyBonus ?? 0}% | ⚔️ Combat: ${def?.combatPassive ?? 'N/A'}\n\n`;
      }
      const comp = container(V2_COLORS.danger, [header('🔥 Dị Hỏa Của Đạo Hữu'), body(desc)]);
      await interaction.editReply({ components: [comp], flags: V2_FLAG });
    } else if (sub === 'trangbi') {
      const fires = rareFireService.getUserFires(userId);
      if (!fires.length) {
        await interaction.editReply({ content: '🔥 Không có dị hỏa để trang bị.' });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const f of fires.slice(0, 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`rarefire_equip_${f.fire_type}_${userId}`)
            .setLabel(`${f.fire_name} T${f.tier}`)
            .setStyle(f.equipped ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }

      const comp = container(V2_COLORS.danger, [header('🔥 Chọn Dị Hỏa Trang Bị')]);
      await interaction.editReply({ components: [comp, row], flags: V2_FLAG });
    } else if (sub === 'nangcap') {
      const fires = rareFireService.getUserFires(userId);
      const equipped = fires.find(f => f.equipped);
      if (!equipped) {
        await interaction.editReply({ content: '🔥 Hãy trang bị dị hỏa trước khi nâng cấp!' });
        return;
      }

      const result = rareFireService.feed(userId, equipped.fire_type, 'iron', 5);
      if (result.success) {
        await interaction.editReply({ content: `🔥 **${equipped.fire_name}** đã lên **Level ${result.newLevel}**!` });
      } else {
        await interaction.editReply({ content: `🔥 Đã cấp nhật kinh nghiệm cho **${equipped.fire_name}**. Level hiện tại: ${result.newLevel}` });
      }
    }
  }
}
