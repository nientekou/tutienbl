import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { tamMaService } from '../../services/TamMaService';
import { inventoryService } from '../../services/InventoryService';
import { container, header, body, separator, V2_COLORS, V2_FLAG } from '../../utils/v2Components';
import { DAO_LEVELS } from '../../config/tamMaConstants';

export default class TamMaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('tammanhodao')
        .setDescription('Tâm ma & Ngộ đạo - Đối diện nội tâm, tu luyện đạo')
        .addSubcommand(sub =>
          sub.setName('trangthai').setDescription('Xem trạng thái tâm ma và ngộ đạo')
        )
        .addSubcommand(sub =>
          sub.setName('lichsuma').setDescription('Xem lịch sử tâm ma')
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

    if (sub === 'trangthai') {
      const activeDemon = tamMaService.getActiveDemon(userId);
      const daoProgress = tamMaService.getDaoProgress(userId);

      const comps: Array<ReturnType<typeof body> | ReturnType<typeof separator>> = [header('👹 Tâm Ma & Ngộ Đạo')];

      if (activeDemon) {
        comps.push(separator());
        comps.push(body(`**⚠️ Tâm Ma Đang Hoạt Động**\n**${activeDemon.demon_name}** (Sức mạnh: ${activeDemon.power})`));
      }

      comps.push(separator());
      if (daoProgress.length > 0) {
        let daoDesc = '**📖 Ngộ Đạo**\n';
        for (const d of daoProgress) {
          const levels = DAO_LEVELS[d.dao_type] || [];
          const nextLevel = levels[d.level] || levels[levels.length - 1];
          daoDesc += `**${d.dao_type}**: Level ${d.level} | ${d.points}/${nextLevel?.pointsNeeded ?? 'MAX'} điểm\n`;
          if (nextLevel && nextLevel.passive !== 'none') {
            daoDesc += `  → Passive: ${nextLevel.passive} (+${nextLevel.value})\n`;
          }
        }
        comps.push(body(daoDesc));
      } else {
        comps.push(body('**📖 Ngộ Đạo**\n*Chưa ngộ được đạo nào. Hãy chiến đấu tâm ma!*'));
      }

      comps.push(separator());
      comps.push(body('**💡 Hướng Dẫn**\nTâm ma xuất hiện ngẫu nhiên khi tu luyện. Chiến thắng tâm ma nhận điểm ngộ đạo.\nLệch tâm càng cao, tâm ma càng hay xuất hiện.'));

      await interaction.editReply({ components: [container(V2_COLORS.danger, comps)], flags: V2_FLAG });
    } else if (sub === 'lichsuma') {
      const history = tamMaService.getDemonHistory(userId, 10);
      if (!history.length) {
        await interaction.editReply({ content: '📭 Chưa có lịch sử tâm ma.' });
        return;
      }

      let desc = '';
      for (const h of history) {
        desc += `**${h.demon_name}** — Sức mạnh: ${h.power} ✅\n`;
      }
      const comp = container(V2_COLORS.danger, [header('📜 Lịch Sử Tâm Ma'), body(desc)]);
      await interaction.editReply({ components: [comp], flags: V2_FLAG });
    }
  }
}
