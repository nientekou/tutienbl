import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { rareBeastService } from '../../services/RareBeastService';
import { container, header, body, separator, V2_COLORS, V2_FLAG } from '../../utils/v2Components';
import { RARE_BEASTS } from '../../config/rareBeastConstants';

export default class DiThuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dithu')
        .setDescription('Dị Thú - Thu thập và nuôi dưỡng thú hiếm')
        .addSubcommand(sub =>
          sub.setName('danhsach').setDescription('Xem danh sách dị thú')
        )
        .addSubcommand(sub =>
          sub.setName('trangbi').setDescription('Trang bị dị thú')
        )
        .addSubcommand(sub =>
          sub.setName('thongtin').setDescription('Xem chi tiết một dị thú')
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
      const beasts = rareBeastService.getUserBeasts(userId);
      if (!beasts.length) {
        await interaction.editReply({ content: '🐉 Đạo hữu chưa có dị thú nào. Hãy chiến đấu boss hoặc dungeon để thu phục!' });
        return;
      }

      let desc = '';
      for (const b of beasts) {
        const def = RARE_BEASTS.find(r => r.type === b.beast_type);
        const equipped = b.equipped ? ' ⚡' : '';
        desc += `**${b.beast_name}** (${b.rarity})${equipped} — Level ${b.level} | ⭐ ${b.stars || 1}/5\n`;
        desc += `  ATK: ${def?.baseAtk ?? 0} | DEF: ${def?.baseDef ?? 0} | HP: ${def?.baseHp ?? 0}\n`;
        desc += `  Passive: ${def?.passiveDescription ?? 'N/A'}\n\n`;
      }
      const comp = container(V2_COLORS.mystic, [header('🐉 Dị Thú Của Đạo Hữu'), body(desc)]);
      await interaction.editReply({ components: [comp], flags: V2_FLAG });
    } else if (sub === 'trangbi') {
      const beasts = rareBeastService.getUserBeasts(userId);
      if (!beasts.length) {
        await interaction.editReply({ content: '🐉 Không có dị thú để trang bị.' });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const b of beasts.slice(0, 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`rarebeast_equip_${b.beast_type}_${userId}`)
            .setLabel(`${b.beast_name} ⭐${b.stars || 1}`)
            .setStyle(b.equipped ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }

      const comp = container(V2_COLORS.mystic, [header('🐉 Chọn Dị Thú Trang Bị')]);
      await interaction.editReply({ components: [comp, row], flags: V2_FLAG });
    } else if (sub === 'thongtin') {
      const beasts = rareBeastService.getUserBeasts(userId);
      if (!beasts.length) {
        await interaction.editReply({ content: '🐉 Đạo hữu chưa có dị thú.' });
        return;
      }

      const comps: Array<ReturnType<typeof body> | ReturnType<typeof separator>> = [header('🐉 Chi Tiết Dị Thú')];
      for (const b of beasts) {
        const def = RARE_BEASTS.find(r => r.type === b.beast_type);
        const bonuses = rareBeastService.getEquippedBonuses(userId);
        comps.push(separator());
        comps.push(body(`**${b.beast_name}** (${b.rarity}) ${b.equipped ? '⚡' : ''}\nLevel ${b.level} | ⭐ ${b.stars || 1}/5\nATK: ${bonuses.atk} | DEF: ${bonuses.def} | HP: ${bonuses.hp}\nPassive: ${def?.passiveDescription ?? 'N/A'}`));
      }

      const comp = container(V2_COLORS.mystic, comps);
      await interaction.editReply({ components: [comp], flags: V2_FLAG });
    }
  }
}
