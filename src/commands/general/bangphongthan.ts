import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { leaderboardService } from '../../services/LeaderboardService';
import { userRepository } from '../../database/repositories/UserRepository';
import { toV2Update, toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

export const LABELS: Record<string, { name: string; emoji: string; color: number; description: string }> = {
  combatPower: {
    name: 'Lực Chiến',
    emoji: '<:iatk:1547865969488306258>',
    color: 0xFF4500, // Orange Red
    description: 'Xếp hạng những tu sĩ có Lực Chiến cao nhất toàn server.'
  },
  realm: {
    name: 'Cảnh Giới',
    emoji: '<:lc1:1547866362511368212>',
    color: 0x8A2BE2, // Blue Violet
    description: 'Xếp hạng cảnh giới tu vi của các tu sĩ.'
  },
  wealth: {
    name: 'Tài Sản',
    emoji: '<:lt1:1547866122123218945>',
    color: 0xFFD700, // Gold
    description: 'Xếp hạng tu sĩ giàu có nhất dựa trên tổng Linh Thạch quy đổi.'
  },
  sectContribution: {
    name: 'Cống Hiến Tông Môn',
    emoji: '<:tientrang:1547866014857826354>',
    color: 0x00CED1, // Dark Turquoise
    description: 'Xếp hạng những đệ tử có đóng góp cống hiến lớn nhất cho Tông Môn.'
  },
  arena: {
    name: 'Đấu Trường PvP',
    emoji: '<:iauto:1547887626655240222>',
    color: 0xDC143C, // Crimson
    description: 'Xếp hạng tu sĩ có điểm ELO Đấu Trường cao nhất.'
  },
  alchemy: {
    name: 'Luyện Đan Thuật',
    emoji: '<:luyendan:1547866018037243954>',
    color: 0x2ECC71, // Emerald Green
    description: 'Xếp hạng các Đại Sư Luyện Đan có cấp độ cao nhất.'
  },
  forging: {
    name: 'Luyện Khí Thuật',
    emoji: '<:tmh:1547866418207399986>',
    color: 0x3498DB, // Steel Blue
    description: 'Xếp hạng các Thần Binh Đại Sư có cấp độ cao nhất.'
  }
};

export function buildLeaderboardEmbed(userId: string, category: string, page: number): ContainerBuilder {
  const typeMap: Record<string, (limit?: number) => any[]> = {
    combatPower: (l) => leaderboardService.getTopCombatPower(l || 100),
    realm: (l) => leaderboardService.getTopRealm(l || 100),
    wealth: (l) => leaderboardService.getTopWealth(l || 100),
    sectContribution: (l) => leaderboardService.getTopSectContribution(l || 100),
    arena: (l) => leaderboardService.getTopArena(l || 100),
    alchemy: (l) => leaderboardService.getTopAlchemy(l || 100),
    forging: (l) => leaderboardService.getTopForging(l || 100),
  };

  const getData = typeMap[category];
  const info = LABELS[category];
  if (!getData || !info) {
    return container(V2_COLORS.danger, [
      header('<:thienthu:1547875509919289465> Bảng Phong Thần', '❌ Danh mục không hợp lệ.')
    ]);
  }

  const entries = getData();
  const userRank = leaderboardService.getUserRank(category as any, userId);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageEntries = entries.slice(startIndex, startIndex + pageSize);

  const lines = pageEntries.map((e) => {
    const medal = e.rank === 1 ? '<:taiphu1:1547865883391696937>' : e.rank === 2 ? '<:taiphu2:1547865878190755840>' : e.rank === 3 ? '<:taiphu3:1547865874751430686>' : `**#${e.rank}**`;
    const isYou = e.userId === userId ? ' **(Bạn)**' : '';
    const extraLine = e.extra ? `\n└─ *${e.extra}*` : '';
    return `${medal} **${e.name}**${isYou} — **${e.displayValue}**${extraLine}`;
  });

  let footerText = '';
  if (userRank) {
    footerText = `<:inv:1547865980854599693> Hạng của bạn: #${userRank.rank} / ${userRank.total} │ Trang ${currentPage}/${totalPages}`;
  } else {
    footerText = `<:inv:1547865980854599693> Đạo hữu chưa có dữ liệu trong bảng này │ Trang ${currentPage}/${totalPages}`;
  }

  return container(info.color, [
    header(`<:thienthu:1547875509919289465> Bảng Phong Thần — ${info.name}`, `${info.emoji} ${info.description}\n*(Cập nhật mỗi 5 phút)*`),
    separator(),
    body(lines.length > 0 ? lines.join('\n\n') : '*Hiện chưa có tu sĩ nào lọt vào bảng xếp hạng này.*'),
    separator(),
    body(`*${footerText}*`)
  ]);
}

export function buildLeaderboardComponents(userId: string, category: string, page: number, totalEntries: number) {
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  // Row 1: Dropdown chọn danh mục
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`bptselect_${userId}`)
    .setPlaceholder('Chọn danh mục bảng xếp hạng...')
    .addOptions(
      Object.entries(LABELS).map(([key, info]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${info.emoji} ${info.name}`)
          .setValue(key)
          .setDefault(key === category)
      )
    );

  const rowDropdown = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Row 2: Nút phân trang
  const btnPrev = new ButtonBuilder()
    .setCustomId(`bpt_${category}_${currentPage - 1}_${userId}`)
    .setLabel('◀️ Trang trước')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 1);

  const btnRefresh = new ButtonBuilder()
    .setCustomId(`bpt_${category}_${currentPage}_${userId}`)
    .setLabel('🔄 Làm mới')
    .setStyle(ButtonStyle.Primary);

  const btnNext = new ButtonBuilder()
    .setCustomId(`bpt_${category}_${currentPage + 1}_${userId}`)
    .setLabel('▶️ Trang sau')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === totalPages);

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(btnPrev, btnRefresh, btnNext);

  return [rowDropdown, rowButtons];
}

export function buildLeaderboardMessage(userId: string, category: string, page: number) {
  const embed = buildLeaderboardEmbed(userId, category, page);

  const typeMap: Record<string, (limit?: number) => any[]> = {
    combatPower: (l) => leaderboardService.getTopCombatPower(l || 100),
    realm: (l) => leaderboardService.getTopRealm(l || 100),
    wealth: (l) => leaderboardService.getTopWealth(l || 100),
    sectContribution: (l) => leaderboardService.getTopSectContribution(l || 100),
    arena: (l) => leaderboardService.getTopArena(l || 100),
    alchemy: (l) => leaderboardService.getTopAlchemy(l || 100),
    forging: (l) => leaderboardService.getTopForging(l || 100),
  };
  const entries = typeMap[category]?.() || [];
  const components = buildLeaderboardComponents(userId, category, page, entries.length);

  return { embeds: [embed], components };
}

export function buildLeaderboardUpdate(userId: string, category: string, page: number) {
  const msg = buildLeaderboardMessage(userId, category, page);
  return toV2Update(msg.embeds, msg.components);
}

export default class BangPhongThanCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('bangphongthan')
        .setDescription('<:thienthu:1547875509919289465> Bảng xếp hạng — Lực Chiến, Cảnh Giới, Tài Sản, Tông Môn, Đấu Trường, Luyện Đan, Luyện Khí')
        .addStringOption(option =>
          option
            .setName('danhmuc')
            .setDescription('Chọn danh mục xếp hạng')
            .setRequired(false)
            .addChoices(
              { name: '<:iatk:1547865969488306258> Lực Chiến', value: 'combatPower' },
              { name: '<:lc1:1547866362511368212> Cảnh Giới', value: 'realm' },
              { name: '<:lt1:1547866122123218945> Tài Sản', value: 'wealth' },
              { name: '<:tientrang:1547866014857826354> Cống Hiến Tông Môn', value: 'sectContribution' },
              { name: '<:iauto:1547887626655240222> Đấu Trường PvP', value: 'arena' },
              { name: '<:luyendan:1547866018037243954> Luyện Đan Thuật', value: 'alchemy' },
              { name: '<:tmh:1547866418207399986> Luyện Khí Thuật', value: 'forging' }
            )
        )
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Hãy dùng `/taonhanvat` trước.'});
      return;
    }

    const subType = interaction.options.getString('danhmuc') || 'combatPower';
    const msg = buildLeaderboardMessage(userId, subType, 1);

    await interaction.editReply(toV2Payload(msg.embeds, msg.components));
  }
}
