import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { minigameService } from '../../services/MinigameService';
import { getProgressBar } from '../../utils/constants';

export default class QueXamCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('quexam')
        .setDescription('Chiêm bốc xin thẻ xăm mỗi ngày để xem vận khí cát hung và nhận Linh Thạch.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const result = minigameService.drawFortuneStick(userId);

    if (!result.success) {
      if (result.cooldownRemaining !== undefined) {
        const hours = Math.floor(result.cooldownRemaining / 3600);
        const minutes = Math.floor((result.cooldownRemaining % 3600) / 60);
        const seconds = result.cooldownRemaining % 60;
        
        let timeStr = '';
        if (hours > 0) timeStr += `${hours} giờ `;
        if (minutes > 0) timeStr += `${minutes} phút `;
        timeStr += `${seconds} giây`;

        await interaction.editReply({
          content: `⏳ **Thiên cơ bất khả lộ:** Đạo hữu hôm nay đã rút quẻ rồi. Hãy đợi **${timeStr}** để tinh tú dịch chuyển, quẻ xăm tiếp theo mới linh ứng!`
        });
      } else {
        await interaction.editReply({
          content: `❌ ${result.message}`
        });
      }
      return;
    }

    let color = '#95a5a6'; // Bình thường
    let outcomeText = '';
    let luckScore = 50;

    switch (result.outcome) {
      case 'daicat':
        color = '#e74c3c';
        luckScore = 100;
        outcomeText = '🔴 **Đại Cát (Đỉnh phong vận mệnh)**';
        break;
      case 'trungcat':
        color = '#f1c40f';
        luckScore = 80;
        outcomeText = '🟡 **Trung Cát (Linh khí vây quanh)**';
        break;
      case 'tieucat':
        color = '#2ecc71';
        luckScore = 65;
        outcomeText = '🟢 **Tiểu Cát (Cơ duyên chớm nở)**';
        break;
      case 'binhthuong':
        color = '#95a5a6';
        luckScore = 50;
        outcomeText = '⚪ **Bình Thường (Tĩnh tâm dưỡng tính)**';
        break;
      case 'hung':
        color = '#34495e';
        luckScore = 30;
        outcomeText = '⚫ **Hung (Mây đen u ám)**';
        break;
      case 'daihung':
        color = '#111111';
        luckScore = 10;
        outcomeText = '💀 **Đại Hung (Kiếp nạn giáng thế)**';
        break;
    }

    const fortuneBar = getProgressBar(luckScore, 100, 10);
    const userLuckBar = getProgressBar(result.userLuck!, 30, 10);

    const embed = new EmbedBuilder()
      .setTitle(`🔮 ĐẠO PHÁP CHIÊM BỐC - QUẺ XĂM HÀNG NGÀY 🔮`)
      .setColor(color as any)
      .setDescription(
        `☯️ **Vận Số Hôm Nay:**\n## **${result.title}**\n` +
        `${fortuneBar} *(Chỉ số cát khí: **${luckScore}/100**)*\n\n` +
        `📖 *${result.message}*`
      )
      .addFields(
        {
          name: '💰 Biến Động Linh Thạch',
          value: result.coinDiff! >= 0 
            ? `➕ **+${result.coinDiff}** Hạ Phẩm Linh Thạch 🟤`
            : `➖ **${result.coinDiff}** Hạ Phẩm Linh Thạch 🟤`,
          inline: true
        },
        {
          name: '🍀 Biến Động May Mắn',
          value: result.luckDiff! >= 0
            ? `➕ **+${result.luckDiff}** Điểm May Mắn`
            : `➖ **${result.luckDiff}** Điểm May Mắn`,
          inline: true
        },
        {
          name: '📊 Chỉ Số Bản Thân',
          value: 
            `• Vận Khí cát hung: ${outcomeText}\n` +
            `• Điểm May Mắn: ${userLuckBar} **(${result.userLuck}/30)** 🍀\n` +
            `• Lượng Linh Thạch hiện tại: **${result.userCoins}** Linh Thạch 🟤`,
          inline: false
        }
      )
      .setFooter({ text: 'Mỗi ngày đạo hữu chỉ được rút xăm một lần duy nhất!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
