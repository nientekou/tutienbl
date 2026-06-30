import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { CombatEngine } from '../../services/CombatEngine';
import { EMBED_COLORS } from '../../utils/uiSystem';

export default class AutoBattleCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('autobattle')
        .setDescription('Cài đặt chế độ tự động chiến đấu.')
        .addSubcommand(sub =>
          sub
            .setName('xem')
            .setDescription('Xem cài đặt auto-battle hiện tại.')
        )
        .addSubcommand(sub =>
          sub
            .setName('guard')
            .setDescription('Bật/tắt tự động phòng thủ khi HP < 30% (mặc định: tắt).')
            .addStringOption(opt =>
              opt.setName('trangthai')
                .setDescription('Bật hoặc tắt')
                .setRequired(true)
                .addChoices(
                  { name: 'Bật', value: 'on' },
                  { name: 'Tắt', value: 'off' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('skill')
            .setDescription('Chọn ưu tiên tự động dùng skill.')
            .addStringOption(opt =>
              opt.setName('uutien')
                .setDescription('Chiến thuật ưu tiên skill')
                .setRequired(true)
                .addChoices(
                  { name: 'Sát thương cao nhất', value: 'highest_damage' },
                  { name: 'Ưu tiên buff', value: 'prefer_buff' },
                  { name: 'Cân bằng', value: 'balanced' }
                )
            )
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

    if (sub === 'xem') {
      const settings = CombatEngine.getAutoBattleSettings(userId);
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Cài Đặt Auto-Battle')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(`Cấu hình chiến đấu tự động cho **${user.name}**`)
        .addFields(
          { name: '🛡️ Tự động guard khi HP < 30%', value: settings.autoGuard ? '✅ Bật' : '❌ Tắt', inline: true },
          { name: '🎯 Ưu tiên skill', value: this.getSkillPriorityName(settings.autoSkillPriority), inline: true }
        )
        .setFooter({ text: 'Dùng /autobattle để thay đổi cài đặt' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'guard') {
      const state = interaction.options.getString('trangthai', true);
      CombatEngine.setAutoBattleSettings(userId, { autoGuard: state === 'on' });
      await interaction.editReply({ content: `🛡️ Đã ${state === 'on' ? 'bật' : 'tắt'} tự động guard khi HP < 30%.` });
      return;
    }

    if (sub === 'skill') {
      const priority = interaction.options.getString('uutien', true);
      CombatEngine.setAutoBattleSettings(userId, { autoSkillPriority: priority });
      await interaction.editReply({ content: `🎯 Đã đặt ưu tiên skill thành **${this.getSkillPriorityName(priority)}**.` });
      return;
    }
  }

  private getSkillPriorityName(value: string): string {
    const map: Record<string, string> = {
      'highest_damage': 'Sát thương cao nhất',
      'prefer_buff': 'Ưu tiên buff',
      'balanced': 'Cân bằng',
    };
    return map[value] || value;
  }
}
