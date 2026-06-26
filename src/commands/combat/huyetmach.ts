import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { bloodlineService } from '../../services/BloodlineService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class HuyetMachCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('huyetmach')
        .setDescription('Quản lý Huyết Mạch Giác Tỉnh của bản thân (cần cấp 10).')
        .addSubcommand(sub => 
          sub.setName('thongtin').setDescription('Xem thông tin Huyết Mạch của bản thân.')
        )
        .addSubcommand(sub => 
          sub.setName('danhsach').setDescription('Xem danh sách tất cả Huyết Mạch Thượng Cổ.')
        )
        .addSubcommand(sub => 
          sub.setName('chon').setDescription('Giác tỉnh một Huyết Mạch (Cần Cấp 10 và 500 Linh thạch).')
          .addStringOption(opt => opt.setName('id').setDescription('ID của Huyết Mạch (dùng /huyetmach danhsach để xem)').setRequired(true))
        )
        .addSubcommand(sub => 
          sub.setName('chuyenhoa').setDescription('Đổi sang Huyết Mạch khác (Cần 1 Huyết Mạch Chuyển Hóa Đan).')
          .addStringOption(opt => opt.setName('id').setDescription('ID của Huyết Mạch mới').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'thongtin') {
      const ub = bloodlineService.getUserBloodline(userId);
      if (!ub) {
        await interaction.editReply({ content: '❌ Đạo hữu chưa giác tỉnh Huyết Mạch! Dùng lệnh `/huyetmach chon <tên>` để giác tỉnh (cần Cấp 10 và 500 Linh Thạch). Xem danh sách bằng `/huyetmach danhsach`.' });
        return;
      }

      const passives = bloodlineService.getActivePassives(ub);
      const nextLevelExp = ub.level * 200;
      const isMaxLevel = ub.level >= 50;

      let passiveDesc = '';
      if (passives.hp_steal) passiveDesc += `🩸 Hút máu: +${(passives.hp_steal * 100).toFixed(0)}%\n`;
      if (passives.revive_chance) passiveDesc += `🔥 Tỷ lệ hồi sinh: ${(passives.revive_chance * 100).toFixed(0)}%\n`;
      if (passives.dmg_reduce) passiveDesc += `🛡️ Giảm sát thương: ${(passives.dmg_reduce * 100).toFixed(0)}%\n`;
      if (passives.crit_rate) passiveDesc += `💥 Bạo kích: +${(passives.crit_rate * 100).toFixed(0)}%\n`;
      if (passives.max_hp) passiveDesc += `❤️ HP tối đa: +${(passives.max_hp * 100).toFixed(0)}%\n`;
      if (passives.shield_start) passiveDesc += `🔰 Nhận khiên lúc bắt đầu: ${(passives.shield_start * 100).toFixed(0)}% HP\n`;
      if (passives.speed) passiveDesc += `⚡ Tốc độ: +${(passives.speed * 100).toFixed(0)}%\n`;

      const embed = new EmbedBuilder()
        .setTitle(`🩸 Huyết Mạch: ${ub.name}`)
        .setDescription(`**Cấp độ:** ${ub.level}${isMaxLevel ? ' (MAX)' : `\n**EXP:** ${ub.exp}/${nextLevelExp}`}\n\n*${ub.description}*`)
        .setColor(EMBED_COLORS.ERROR)
        .addFields([
          { name: '🌟 Nội Tại Kích Hoạt', value: passiveDesc || 'Chưa có', inline: false },
          { name: '💢 Hiệu Ứng Nộ (Rage)', value: `Tăng sức mạnh x${ub.rage_effect.multiplier || 2} trong ${ub.rage_effect.duration || 3} hiệp (Hồi chiêu: ${ub.rage_effect.cooldown || 10} phút).`, inline: false },
          { name: '⚠️ Điểm Yếu', value: `*Sẽ bị ảnh hưởng bởi điểm yếu của ${ub.name} trong thực chiến.*`, inline: false }
        ]);

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (subCommand === 'danhsach') {
      const bloodlines = bloodlineService.getAllBloodlines();
      const desc = bloodlines.map(b => `**${b.name}** (ID: \`${b.id}\`): ${b.description}`).join('\n\n');
      
      const embed = new EmbedBuilder()
        .setTitle('📜 Danh Sách Huyết Mạch Thượng Cổ')
        .setDescription(desc + '\n\n💡 *Dùng `/huyetmach chon <id>` để giác tỉnh (Phí 500 Linh thạch, cần Cấp 10).*')
        .setColor(EMBED_COLORS.ERROR);

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (subCommand === 'chon') {
      const bloodlineId = interaction.options.getString('id');
      if (!bloodlineId) return;
      const result = bloodlineService.chooseBloodline(userId, bloodlineId);
      await interaction.editReply({ content: result.message });
      return;
    }

    if (subCommand === 'chuyenhoa') {
      const newBloodlineId = interaction.options.getString('id');
      if (!newBloodlineId) return;
      const result = bloodlineService.changeBloodline(userId, newBloodlineId);
      await interaction.editReply({ content: result.message });
      return;
    }
  }
}
