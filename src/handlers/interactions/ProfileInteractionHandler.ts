import { ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { getHoSoTabEmbed, getHoSoAllComponents, HoSoTab } from '../../commands/general/hoso';
import { leaderboardService } from '../../services/LeaderboardService';
import { EMBED_COLORS, safeV2Update, safeV2TextUpdate } from '../../utils/uiSystem';

export class ProfileInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ) {
    if (action === 'hosotab') {
      const tabName = parts[1] as HoSoTab;
      const embed = getHoSoTabEmbed(targetUserId, tabName);
      const components = getHoSoAllComponents(targetUserId, tabName);
      await safeV2Update(interaction, [embed], components);
      return;
    }
    
    // Nút quay lại hồ sơ từ các menu khác (như tẩy tủy, lôi kiếp)
    if (action === 'hosoback') {
      const embed = getHoSoTabEmbed(targetUserId, 'chiso');
      const components = getHoSoAllComponents(targetUserId, 'chiso');
      await safeV2Update(interaction, [embed], components);
      return;
    }

    // Nút chuyển danh mục Bảng Phong Thần
    if (action === 'hosolb') {
      const lbType = parts[1]; // combatPower, realm, wealth, sectContribution
      const embed = getLeaderboardEmbed(targetUserId, lbType);
      const components = getHoSoAllComponents(targetUserId, 'bangxephang');
      await safeV2Update(interaction, [embed], components);
      return;
    }
  }
}

function getLeaderboardEmbed(userId: string, subType: string): EmbedBuilder {
  const LABELS: Record<string, { name: string; emoji: string }> = {
    combatPower: { name: 'Lực Chiến', emoji: '⚔️' },
    realm: { name: 'Cảnh Giới', emoji: '🌀' },
    wealth: { name: 'Tài Sản', emoji: '🪙' },
    sectContribution: { name: 'Cống Hiến Tông Môn', emoji: '🏛️' },
  };

  const embed = new EmbedBuilder()
    .setTitle('👑 Bảng Phong Thần')
    .setColor(EMBED_COLORS.GOLD)
    .setTimestamp();

  const typeMap: Record<string, (limit?: number) => any[]> = {
    combatPower: (l) => leaderboardService.getTopCombatPower(l || 15),
    realm: (l) => leaderboardService.getTopRealm(l || 15),
    wealth: (l) => leaderboardService.getTopWealth(l || 15),
    sectContribution: (l) => leaderboardService.getTopSectContribution(l || 15),
  };

  const getData = typeMap[subType];
  if (!getData) return embed.setDescription('❌ Danh mục không hợp lệ.');

  const info = LABELS[subType];
  const entries = getData();
  const userRank = leaderboardService.getUserRank(subType as any, userId);

  const prefix = ['🥇', '🥈', '🥉'];
  const lines = entries.map((e, i) => {
    const medal = i < 3 ? `${prefix[i]} ` : `#${e.rank}. `;
    const isYou = e.userId === userId ? ' **← Bạn**' : '';
    const extra = e.extra ? ` *(${e.extra})*` : '';
    return `${medal}**${e.name}**${isYou} — **${e.displayValue}**${extra}`;
  });

  embed.setDescription(`**${info.emoji} ${info.name}** *(cập nhật mỗi 5 phút)*\n\n${lines.join('\n')}`);

  if (userRank) {
    embed.setFooter({ text: `📍 Hạng của bạn: #${userRank.rank} / ${userRank.total}` });
  } else {
    embed.setFooter({ text: '📍 Đạo hữu chưa có dữ liệu trong bảng xếp hạng này.' });
  }

  return embed;
}
