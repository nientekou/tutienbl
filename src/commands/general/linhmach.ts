import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { leylineService, LeylineType } from '../../services/LeylineService';
import { getProgressBar } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

const LEYLINE_NAMES: Record<LeylineType, string> = {
  'tuluyen': 'Tu Luyện (Mộc)',
  'chiendau': 'Chiến Đấu (Hỏa)',
  'thuthap': 'Thu Thập (Thủy)',
  'kinhte': 'Kinh Tế (Kim)',
  'tongmon': 'Tông Môn (Thổ)'
};

const LEYLINE_EFFECTS: Record<LeylineType, string> = {
  'tuluyen': '+20% EXP khi Tu Luyện/Làm Việc',
  'chiendau': '+10% ATK khi Săn Yêu/Bí Cảnh/PvP',
  'thuthap': '+25% Tỷ lệ rơi vật phẩm khi Khám Phá/Linh Điền',
  'kinhte': '-10% Phí giao dịch Chợ Trời',
  'tongmon': '+15% Cống hiến Tông Môn'
};

function formatDuration(remainSec: number): string {
  if (remainSec <= 0) return 'Hết hạn';
  const hours = Math.floor(remainSec / 3600);
  const minutes = Math.floor((remainSec % 3600) / 60);
  if (hours > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  return `${minutes} phút`;
}

export function buildLeylineEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('🌟 LINH MẠCH ĐỊA ĐỒ')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription('Chưa khởi tạo nhân vật.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const userLeyline = leylineService.getUserLeyline(userId);
  const leylines = leylineService.getAllLeylines();

  const desc = `*Linh mạch đại lục là nguồn sinh khí nuôi dưỡng tu sĩ. Mọi hành động của các tu sĩ trên server sẽ tích tụ linh khí vào các linh mạch tương ứng. Khi đầy, linh mạch sẽ bùng nổ buff toàn server trong 2 giờ.*\n\n` +
    `🧘 **Trạng thái Dẫn dòng:** ${userLeyline.channeling_target ? `Đang tập trung dẫn dòng vào **${LEYLINE_NAMES[userLeyline.channeling_target as LeylineType]}**` : '`Chưa dẫn dòng`'}\n` +
    `⏳ **Hồi thuật dẫn dòng:** ${userLeyline.channeling_cooldown > nowSec ? `\`${formatDuration(userLeyline.channeling_cooldown - nowSec)}\`` : '`Sẵn sàng` (Hồi chiêu 6 giờ sau khi đổi)'}\n` +
    `*(Dẫn dòng giúp tăng +50% linh khí đóng góp cho linh mạch đó, nhưng sẽ không tích tụ vào các mạch khác)*\n`;

  const embed = new EmbedBuilder()
    .setTitle(`🌟 LINH MẠCH ĐỊA ĐỒ - THẾ GIỚI TU CHÂN`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setDescription(desc)
    .setTimestamp();

  leylines.forEach(l => {
    const id = l.id as LeylineType;
    const isBuffActive = l.buff_active_until > nowSec;
    const name = LEYLINE_NAMES[id] || id;
    const effect = LEYLINE_EFFECTS[id] || '';
    const isUserChanneling = userLeyline.channeling_target === id;

    let statusText = '';
    if (isBuffActive) {
      statusText = `🟢 **ĐANG PHÁT HUY** (Còn: \`${formatDuration(l.buff_active_until - nowSec)}\`)`;
    } else {
      statusText = `🔴 Chưa kích hoạt | Năng lượng: \`${l.current_energy}/${l.max_energy}\`\n${getProgressBar(l.current_energy, l.max_energy)}`;
    }

    const titleLine = `${isUserChanneling ? '⚡ ' : ''}${name} - *${effect}*`;
    embed.addFields({
      name: titleLine,
      value: `${statusText}${isUserChanneling ? ' \n*(Đạo hữu đang dẫn dòng tại đây)*' : ''}`,
      inline: false
    });
  });

  return embed;
}

export function buildLeylineComponents(userId: string): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const userLeyline = leylineService.getUserLeyline(userId);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`linhmach_select_${userId}`)
    .setPlaceholder('🧘 Chọn linh mạch để dẫn dòng...');

  (Object.keys(LEYLINE_NAMES) as LeylineType[]).forEach(id => {
    const isCurrent = userLeyline.channeling_target === id;
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(LEYLINE_NAMES[id])
        .setDescription(LEYLINE_EFFECTS[id].substring(0, 100))
        .setValue(id)
        .setDefault(isCurrent)
    );
  });

  // Thêm tùy chọn hủy dẫn dòng
  selectMenu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel('Hủy dẫn dòng')
      .setDescription('Ngừng dẫn dòng linh lực vào bất kỳ linh mạch nào')
      .setValue('cancel')
      .setDefault(userLeyline.channeling_target === null)
  );

  const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const closeButton = new ButtonBuilder()
    .setCustomId(`linhmach_close_${userId}`)
    .setLabel('Đóng')
    .setStyle(ButtonStyle.Danger);

  const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

  return [rowSelect, rowButton];
}

export default class LinhmachCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('linhmach')
        .setDescription('Xem trạng thái linh mạch địa đồ server và thiết lập thuật dẫn dòng linh khí.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const user = userRepository.get(discordId);

    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!'
      });
      return;
    }

    const embed = buildLeylineEmbed(discordId);
    const components = buildLeylineComponents(discordId);

    await interaction.editReply(toV2Payload([embed], components));
  }
}
