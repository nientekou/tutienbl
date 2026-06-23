import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { caveService } from '../../services/CaveService';
import { caveEnhancementService } from '../../services/CaveEnhancementService';
import { getProgressBar } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

const CAVE_RANKS = [
  'Bình Thường',
  'Phàm Nhân Động Phủ',
  'Linh Địa Động Phủ',
  'Tiên Gia Động Phủ',
  'Động Thiên Phúc Địa',
  'Vạn Thế Tiên Cung'
];

export function buildDongPhuEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId)!;
  const cave = caveService.getCave(userId) as any;

  const springLvl = cave.spring_level || 1;
  const meridianLvl = cave.meridian_level || 0;
  const arrayLvl = cave.array_level || 0;

  const pending = caveEnhancementService.getPendingMeridianResources(userId);
  const nextSpringCost = caveEnhancementService.getUpgradeCost('spring', springLvl);
  const nextMeridianCost = caveEnhancementService.getUpgradeCost('meridian', meridianLvl);
  const nextArrayCost = caveEnhancementService.getUpgradeCost('array', arrayLvl);

  const rankName = CAVE_RANKS[Math.min(cave.level, CAVE_RANKS.length - 1)];

  const embed = new EmbedBuilder()
    .setTitle(`🏰 ĐỘNG PHỦ TIÊN GIA - ${user.name}`)
    .setColor(EMBED_COLORS.CAVE)
    .setDescription(
      `*Nơi tụ hội linh khí thiên địa, bồi đắp căn cơ và khai thác tiên thạch tự nhiên của tu sĩ.*\n\n` +
      `🏛️ **Phẩm cấp Động Phủ:** **Cấp ${cave.level} — ${rankName}**\n` +
      `🟤 **Linh Thạch hiện có:** **${user.coin_ha_pham.toLocaleString()}** LT\n`
    )
    .addFields(
      {
        name: `🌊 Linh Tuyền (Cấp ${springLvl}/10)`,
        value: `• Hiệu quả: **+${(springLvl * 2)}%** EXP Tu Luyện Nhàn Rỗi.\n` +
               `• Lượt tắm hôm nay: **${cave.spring_available}** lượt.\n` +
               (springLvl < 10 ? `• Nâng cấp: **${nextSpringCost.lt.toLocaleString()}** LT + **${nextSpringCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
      },
      {
        name: `⚡ Linh Mạch (Cấp ${meridianLvl}/10)`,
        value: `• Hiệu quả: Tự sinh **+${(meridianLvl * 50)}** Linh Thạch / giờ.\n` +
               `• Tích lũy hiện tại: **${pending.amount.toLocaleString()}** Linh Thạch (Tích lũy ${pending.hours} giờ).\n` +
               (meridianLvl < 10 ? `• Nâng cấp: **${nextMeridianCost.lt.toLocaleString()}** LT + **${nextMeridianCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
      },
      {
        name: `🛡️ Hộ Pháp Trận (Cấp ${arrayLvl}/10)`,
        value: `• Hiệu quả: Giảm **-${(arrayLvl * 5)}%** sát thương Thiên Kiếp khi đột phá.\n` +
               (arrayLvl < 10 ? `• Nâng cấp: **${nextArrayCost.lt.toLocaleString()}** LT + **${nextArrayCost.shards}** Mảnh Tinh Thạch.` : '`Đã đạt cấp tối đa`'),
        inline: false
      }
    )
    .setFooter({ text: 'Dùng các nút tương tác bên dưới để quản lý Động Phủ.' })
    .setTimestamp();

  return embed;
}

export function buildDongPhuComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const cave = caveService.getCave(userId) as any;

  const springLvl = cave.spring_level || 1;
  const meridianLvl = cave.meridian_level || 0;
  const arrayLvl = cave.array_level || 0;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`dongphu_spring_${userId}`)
      .setLabel('🌊 Tắm Linh Tuyền')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(cave.spring_available <= 0),
    new ButtonBuilder()
      .setCustomId(`dongphu_harvest_${userId}`)
      .setLabel('🪙 Thu Hoạch Linh Mạch')
      .setStyle(ButtonStyle.Success)
      .setDisabled(meridianLvl <= 0)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`dongphu_up_spring_${userId}`)
      .setLabel('🔼 Nâng Linh Tuyền')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(springLvl >= 10),
    new ButtonBuilder()
      .setCustomId(`dongphu_up_meridian_${userId}`)
      .setLabel('🔼 Nâng Linh Mạch')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(meridianLvl >= 10),
    new ButtonBuilder()
      .setCustomId(`dongphu_up_array_${userId}`)
      .setLabel('🔼 Nâng Hộ Pháp Trận')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(arrayLvl >= 10)
  );

  return [row1, row2];
}

export default class DongPhuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dongphu')
        .setDescription('Quản lý Động Phủ Tiên Gia, khai thác tài nguyên và ngâm Linh Tuyền.')
        .addSubcommand(sub =>
          sub.setName('trangthai')
            .setDescription('Xem trạng thái, bố cục và cấp độ các công trình trong Động Phủ.')
        )
        .addSubcommand(sub =>
          sub.setName('thuhoach')
            .setDescription('Thu hoạch Linh Thạch ngưng tụ từ Linh Mạch.')
        )
        .addSubcommand(sub =>
          sub.setName('nangcap')
            .setDescription('Thăng cấp công trình trong Động Phủ.')
            .addStringOption(opt =>
              opt.setName('congtrinh')
                .setDescription('Chọn công trình muốn thăng cấp.')
                .setRequired(true)
                .addChoices(
                  { name: '🌊 Linh Tuyền', value: 'spring' },
                  { name: '⚡ Linh Mạch', value: 'meridian' },
                  { name: '🛡️ Hộ Pháp Trận', value: 'array' }
                )
            )
        )
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

    const sub = interaction.options.getSubcommand();

    if (sub === 'trangthai') {
      const embed = buildDongPhuEmbed(discordId);
      const components = buildDongPhuComponents(discordId);
      await interaction.editReply(toV2Payload([embed], components));
    }

    else if (sub === 'thuhoach') {
      const result = caveEnhancementService.claimMeridianResources(discordId);
      if (result.success) {
        await interaction.editReply({ content: result.message });
      } else {
        await interaction.editReply({ content: `❌ ${result.message}` });
      }
    }

    else if (sub === 'nangcap') {
      const building = interaction.options.getString('congtrinh', true) as 'spring' | 'meridian' | 'array';
      const result = caveEnhancementService.upgradeBuilding(discordId, building);
      if (result.success) {
        await interaction.editReply({ content: result.message });
      } else {
        await interaction.editReply({ content: `❌ ${result.message}` });
      }
    }
  }
}
