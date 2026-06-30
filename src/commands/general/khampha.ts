import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { explorationService, EXPLORATION_LOCATIONS } from '../../services/ExplorationService';
import { toV2Payload } from '../../utils/uiSystem';
import { getRealmDetails } from '../../utils/constants';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

/**
 * Tạo V2 Container hiển thị bản đồ dã ngoại
 */
export function getKhamPhaEmbed(userId: string): ContainerBuilder {
  const user = userRepository.get(userId);
  const active = explorationService.getActiveExploration(userId);

  if (active) {
    const now = Math.floor(Date.now() / 1000);
    const loc = EXPLORATION_LOCATIONS[active.location_id];
    const remaining = Math.max(0, active.end_time - now);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const status = active.status === 'event_pending' ? '⚡ Đang chờ xử lý kỳ ngộ!' : `⏳ Còn **${mins}p ${secs}s** nữa trở về`;

    return container(V2_COLORS.dark, [
      header('🗺️ BẢN ĐỒ DÃ NGOẠI - KHÁM PHÁ TIÊN GIỚI', 'Đạo hữu đang trên hành trình thám hiểm hoang dã...'),
      separator(),
      body(
        `📍 **Điểm đến:** ${loc?.emoji || '🗺️'} **${loc?.name || active.location_id}**\n` +
        `${status}\n\n` +
        `*Sử dụng nút ✅ Về Lấy Thưởng khi hành trình hoàn thành.*`
      )
    ]);
  }

  const realmInfo = user ? getRealmDetails(user.level) : null;
  const stamina = user?.stamina || 0;

  const content: any[] = [
    header('🗺️ BẢN ĐỒ DÃ NGOẠI - KHÁM PHÁ TIÊN GIỚI', 'Ngoài cửa tông môn, thiên địa bao la chứa đựng vô số cơ duyên đang chờ đợi đạo hữu khám phá!'),
    separator(),
    body(
      `🧘 **Thể Lực hiện có:** **${stamina}/500**\n` +
      `🏔️ **Cảnh giới:** ${realmInfo?.fullName || 'Không xác định'}\n\n` +
      `*Chọn địa điểm muốn thám hiểm từ các nút bên dưới.*`
    )
  ];

  // Liệt kê các địa điểm
  for (const loc of Object.values(EXPLORATION_LOCATIONS)) {
    const canExplore = (user?.level || 0) >= loc.minLevel && stamina >= loc.staminaCost;
    const lockText = (user?.level || 0) < loc.minLevel
      ? ` 🔒 *(Yêu cầu cảnh giới ${loc.minLevel})*`
      : !canExplore ? ` *(Không đủ thể lực)*` : '';
    const timeText = `${Math.floor(loc.travelTime / 60)} phút`;

    content.push(separator());
    content.push(body(
      `**${loc.emoji} ${loc.name}${lockText}**\n` +
      `${loc.description}\n` +
      `⏳ **${timeText}** │ 🧘 **-${loc.staminaCost}** Thể Lực │ ☠️ Rủi ro: **${Math.round(loc.dangerRate * 100)}%**`
    ));
  }

  content.push(separator());
  content.push(body(`*Mỗi hành trình chỉ có thể thực hiện một địa điểm. Thể Lực hồi phục tự động theo thời gian.*`));

  return container(V2_COLORS.dark, content);
}

/**
 * Tạo các Components nút bấm cho Bản Đồ
 */
export function getKhamPhaComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const user = userRepository.get(userId);
  const active = explorationService.getActiveExploration(userId);
  const stamina = user?.stamina || 0;
  const level = user?.level || 1;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (active) {
    const now = Math.floor(Date.now() / 1000);
    const isReady = now >= active.end_time || active.status === 'event_pending';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`khamphaclaim_${userId}`)
        .setLabel(active.status === 'event_pending' ? '⚡ Xử Lý Kỳ Ngộ' : '✅ Về Lấy Thưởng')
        .setStyle(isReady ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(!isReady),
      new ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(row);
    return rows;
  }

  const locs = Object.values(EXPLORATION_LOCATIONS);
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  locs.forEach((loc, i) => {
    const canExplore = level >= loc.minLevel && stamina >= loc.staminaCost;
    const btn = new ButtonBuilder()
      .setCustomId(`khamphastart_${loc.id}_${userId}`)
      .setLabel(`${loc.emoji} ${loc.name}`)
      .setStyle(canExplore ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canExplore);
    if (i < 3) row1.addComponents(btn);
    else row2.addComponents(btn);
  });

  if (row1.components.length > 0) rows.push(row1);
  if (row2.components.length > 0) rows.push(row2);

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hosoback_${userId}`)
      .setLabel('🔙 Hồ Sơ')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(backRow);

  return rows;
}

export default class KhamPhaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('khampha')
        .setDescription('Khám phá bản đồ dã ngoại, tìm kiếm cơ duyên và kỳ trân dị bảo.')
        .addSubcommand(sub => 
          sub
            .setName('bando')
            .setDescription('Mở bản đồ dã ngoại để thám hiểm.')
        )
        .addSubcommand(sub => 
          sub
            .setName('toado')
            .setDescription('Đào kho báu tại tọa độ chỉ định (Cần Tàng Bảo Đồ).')
            .addIntegerOption(opt => opt.setName('x').setDescription('Tọa độ X').setRequired(true))
            .addIntegerOption(opt => opt.setName('y').setDescription('Tọa độ Y').setRequired(true))
        )
        .addSubcommand(sub => 
          sub
            .setName('tangbaodo')
            .setDescription('Xem danh sách các Tàng Bảo Đồ đang sở hữu.')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Dùng `/taonhanvat` để bắt đầu.'});
      return;
    }

    const subcmd = interaction.options.getSubcommand(false) || 'bando';

    if (subcmd === 'bando') {
      const embed = getKhamPhaEmbed(userId);
      const rows = getKhamPhaComponents(userId);
      await interaction.editReply(toV2Payload([embed], rows));
    } 
    else if (subcmd === 'tangbaodo') {
      const { treasureMapService } = require('../../services/TreasureMapService');
      const maps = treasureMapService.getActiveMaps(userId);
      
      if (maps.length === 0) {
        await interaction.editReply({ content: '📜 Đạo hữu hiện không có Tàng Bảo Đồ nào chưa đào.'});
        return;
      }

      const embed = container(V2_COLORS.gold, [
        header('🗺️ Danh Sách Tàng Bảo Đồ', 'Danh sách các tọa độ kho báu đạo hữu đang nắm giữ:'),
        separator(),
        body(
          maps.map((m: any, i: number) => `**${i+1}.** Tọa độ: **[X: ${m.coord_x}, Y: ${m.coord_y}]** (Độ hiếm: ${m.rarity.toUpperCase()})`).join('\n')
        ),
        separator(),
        body(`*Dùng lệnh /khampha toado [x] [y] để tiến hành đào!*`)
      ]);
      
      await interaction.editReply(toV2Payload([embed]));
    }
    else if (subcmd === 'toado') {
      const x = interaction.options.getInteger('x', true);
      const y = interaction.options.getInteger('y', true);
      
      const { treasureMapService } = require('../../services/TreasureMapService');
      const result = treasureMapService.digTreasure(userId, x, y);
      
      await interaction.editReply({ content: result.message });
    }
  }
}
