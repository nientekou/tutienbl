import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export function getYCanhEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('🔮 CẢNH GIỚI Ý CẢNH')
      .setColor(EMBED_COLORS.REINCARNATION)
      .setDescription('Chưa khởi tạo nhân vật.');
  }

  let yCanhMap: Record<string, number> = {};
  try {
    yCanhMap = JSON.parse(user.y_canh || '{}');
  } catch (e) {
    yCanhMap = {};
  }

  const kiemY = yCanhMap.KiemY || 0;
  const batDietY = yCanhMap.BatDietY || 0;
  const huyenQuyY = yCanhMap.HuyenQuyY || 0;

  const desc = `*Ý Cảnh là sự lĩnh ngộ tối cao về võ học và thiên địa quy luật. Thức tỉnh Ý Cảnh giúp tu sĩ gia tăng phần trăm chỉ số sức mạnh vĩnh viễn.*\n\n` +
    `🧘 **Ngộ Tính Hiện Có:** \`${user.ngotinh}\` Điểm\n` +
    `🪙 **Linh Thạch Hạ Phẩm:** \`${user.coin_ha_pham}\` viên\n\n` +
    `*Yêu cầu Ngộ Ý Cảnh:* Tiêu hao **5** Ngộ Tính (ưu tiên) hoặc **500** Linh Thạch Hạ Phẩm.\n` +
    `*(Ngộ tính nhận được khi Thiền Định hoặc chinh phục Bí Cảnh/World Boss)*\n`;

  return new EmbedBuilder()
    .setTitle(`🔮 THÁP Ý CẢNH & ĐẠO QUẢ - ${user.name}`)
    .setColor(EMBED_COLORS.MYSTIC)
    .setDescription(desc)
    .addFields(
      {
        name: `⚔️ Kiếm Ý (Cấp ${kiemY}/10)`,
        value: kiemY > 0 ? `Buff **+${kiemY * 3}%** base Công Kích.` : '`Chưa thức tỉnh` *(+3% Công Kích mỗi cấp)*',
        inline: false
      },
      {
        name: `🩸 Bất Diệt Ý (Cấp ${batDietY}/10)`,
        value: batDietY > 0 ? `Buff **+${batDietY * 3}%** base Sinh Lực.` : '`Chưa thức tỉnh` *(+3% Sinh Lực mỗi cấp)*',
        inline: false
      },
      {
        name: `🛡️ Huyền Quy Ý (Cấp ${huyenQuyY}/10)`,
        value: huyenQuyY > 0 ? `Buff **+${huyenQuyY * 3}%** base Phòng Thủ.` : '`Chưa thức tỉnh` *(+3% Phòng Thủ mỗi cấp)*',
        inline: false
      }
    )
    .setFooter({ text: 'Ý Cảnh đạt cấp tối đa 10 sẽ được hoàn trả tài nguyên khi quay trúng.' })
    .setTimestamp();
}

export function getYCanhComponents(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ycanhawaken_${userId}`)
      .setLabel('🧘 Ngộ Ý Cảnh')
      .setStyle(ButtonStyle.Primary)
  );
}

export default class YCanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('ycanh')
        .setDescription('Xem và thức tỉnh/nâng cấp Ý Cảnh (intent) của đạo hữu.')
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

    const embed = getYCanhEmbed(discordId);
    const row = getYCanhComponents(discordId);

    await interaction.editReply(toV2Payload([embed], [row] ));
  }
}
