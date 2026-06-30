import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { achievementService, AchievementWithProgress } from '../../services/AchievementService';
import { getProgressBar } from '../../utils/constants';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

const ITEMS_PER_PAGE = 5;

export function getAchievementCategoryEmbed(userId: string, category: string, page: number): { embed: ContainerBuilder; totalPages: number } {
  const userAchievements = achievementService.getUserAchievements(userId).filter(a => a.category === category);
  const totalPages = Math.max(Math.ceil(userAchievements.length / ITEMS_PER_PAGE), 1);
  const cappedPage = Math.min(Math.max(page, 1), totalPages);
  const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
  const pageItems = userAchievements.slice(offset, offset + ITEMS_PER_PAGE);
  const completedCount = userAchievements.filter(a => a.is_completed).length;
  const catInfo = CATEGORY_LABELS[category];

  const content: any[] = [
    header(`🏆 THÀNH TỰU TU SĨ — ${catInfo?.emoji} ${catInfo?.name}`, `📊 Tiến độ: **${completedCount}/${userAchievements.length}** thành tựu\n*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`)
  ];

  for (const a of pageItems) {
    const status = a.is_completed
      ? '✅ **HOÀN THÀNH**'
      : `📊 ${getProgressBar(a.progress, a.target_value, 8)} (${a.progress}/${a.target_value})`;

    const titleBonus = a.reward_title ? `\n• 🏅 Danh hiệu: **${a.reward_title}**` : '';
    const rewardText: string[] = [];
    if (a.reward_exp > 0) rewardText.push(`+${a.reward_exp} Tu Vi`);
    if (a.reward_coins > 0) rewardText.push(`+${a.reward_coins} LT`);
    const rewardStr = rewardText.length > 0 ? ` │ Thưởng: ${rewardText.join(', ')}` : '';

    content.push(separator());
    content.push(body(
      `${a.icon} **${a.name}**\n` +
      `└ *${a.description}*\n` +
      `└ Trạng thái: ${status}${rewardStr}${titleBonus}`
    ));
  }

  if (userAchievements.length > ITEMS_PER_PAGE) {
    content.push(separator());
    content.push(body(`*Trang ${cappedPage}/${totalPages} (${userAchievements.length} thành tựu)*`));
  }

  const user = userRepository.get(userId);
  content.push(separator());
  content.push(body(`*Danh hiệu hiện tại: **${user?.title || 'Tán Tu'}** • Dùng /thanhtuu danhhieu để thay đổi.*`));

  const embed = container(V2_COLORS.gold, content);

  return { embed, totalPages };
}

export function getAchievementCategoryComponents(userId: string, category: string, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder>[] {
  if (totalPages <= 1) return [];
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId(`achprev_${category.replace(/_/g, '.')}_${page}_${userId}`).setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
      new ButtonBuilder().setCustomId(`achnext_${category.replace(/_/g, '.')}_${page}_${userId}`).setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    );
  return [row];
}

const CATEGORY_LABELS: Record<string, { name: string; emoji: string }> = {
  'tu_luyen': { name: 'Tu Luyện', emoji: '🧘' },
  'chien_dau': { name: 'Chiến Đấu', emoji: '⚔️' },
  'pvp': { name: 'PvP', emoji: '🏆' },
  'sung_thu': { name: 'Sủng Thú', emoji: '🐾' },
  'sinh_hoat': { name: 'Sinh Hoạt', emoji: '🌾' }
};

export default class ThanhTuuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('thanhtuu')
        .setDescription('Hệ thống thành tựu - Theo dõi và nhận thưởng thành tựu.')
        .addSubcommand(sub =>
          sub.setName('xem')
            .setDescription('Xem danh sách thành tựu theo danh mục.')
            .addStringOption(opt => opt.setName('danh_muc').setDescription('Danh mục thành tựu').setRequired(false)
              .addChoices(
                { name: '🧘 Tu Luyện', value: 'tu_luyen' },
                { name: '⚔️ Chiến Đấu', value: 'chien_dau' },
                { name: '🏆 PvP', value: 'pvp' },
                { name: '🐾 Sủng Thú', value: 'sung_thu' },
                { name: '🌾 Sinh Hoạt', value: 'sinh_hoat' }
              ))
        )
        .addSubcommand(sub =>
          sub.setName('danhsach')
            .setDescription('Xem tổng quan tất cả thành tựu đã đạt được.')
        )
        .addSubcommand(sub =>
          sub.setName('danhhieu')
            .setDescription('Xem danh sách danh hiệu đã mở khóa.')
        )
        .addSubcommand(sub =>
          sub.setName('fix')
            .setDescription('Kiểm tra và fix thành tựu bị kẹt (đủ điều kiện nhưng chưa hoàn thành).')
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

    achievementService.recalculateYCanhAchievement(userId);

    if (sub === 'xem') {
      await this.handleXem(interaction, userId);
    } else if (sub === 'danhsach') {
      await this.handleDanhSach(interaction, userId);
    } else if (sub === 'danhhieu') {
      await this.handleDanhHieu(interaction, userId);
    } else if (sub === 'fix') {
      await this.handleFix(interaction, userId);
    }
  }

  private async handleXem(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const category = interaction.options.getString('danh_muc') || undefined;

    let userAchievements: AchievementWithProgress[];
    if (category) {
      userAchievements = achievementService.getUserAchievements(userId).filter(a => a.category === category);
    } else {
      userAchievements = achievementService.getUserAchievements(userId);
    }

    const totalAchievements = userAchievements.length;
    const completedCount = userAchievements.filter(a => a.is_completed).length;

    if (category) {
      const { embed: categoryEmbed, totalPages } = getAchievementCategoryEmbed(userId, category, 1);
      const components = getAchievementCategoryComponents(userId, category, 1, totalPages);
      await interaction.editReply(toV2Payload([categoryEmbed], components));
      return;
    }

    const content: any[] = [
      header('🏆 THÀNH TỰU TU SĨ', `📊 Tiến độ tổng: **${completedCount}/${totalAchievements}** thành tựu\n*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`)
    ];

    const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'] as const;
    for (const cat of categories) {
      const catAchievements = userAchievements.filter(a => a.category === cat);
      const catCompleted = catAchievements.filter(a => a.is_completed).length;
      if (catAchievements.length > 0) {
        const catInfo = CATEGORY_LABELS[cat];
        content.push(separator());
        content.push(body(`${catInfo.emoji} **${catInfo.name}** (${catCompleted}/${catAchievements.length})\n${this.buildCategoryProgress(catAchievements)}`));
      }
    }

    const user = userRepository.get(userId);
    content.push(separator());
    content.push(body(`*Danh hiệu hiện tại: **${user?.title || 'Tán Tu'}** • Dùng /thanhtuu danhhieu để thay đổi.*`));

    const embed = container(V2_COLORS.gold, content);

    await interaction.editReply(toV2Payload([embed]));
  }

  private async handleDanhSach(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const achievements = achievementService.getUserAchievements(userId);
    const completed = achievements.filter(a => a.is_completed);
    const total = achievements.length;

    const content: any[] = [
      header('🏆 TỔNG QUAN THÀNH TỰU', `**${interaction.user.username}** — Tu sĩ đạo hiệu: **${userRepository.get(userId)?.name || '?'}**\n📊 Tiến độ tổng: **${completed.length}/${total}** (${Math.round((completed.length / total) * 100)}%)`)
    ];

    const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'] as const;
    let statsText = '';
    for (const cat of categories) {
      const catAchievements = achievements.filter(a => a.category === cat);
      const catCompleted = catAchievements.filter(a => a.is_completed).length;
      const catInfo = CATEGORY_LABELS[cat];
      statsText += `${catInfo.emoji} **${catInfo.name}**: ${catCompleted}/${catAchievements.length}\n`;
    }
    content.push(separator());
    content.push(body(`📈 **Thống kê phân loại:**\n${statsText}`));

    const recentCompleted = completed
      .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
      .slice(0, 5);

    if (recentCompleted.length > 0) {
      let recentText = '';
      for (const rc of recentCompleted) {
        const date = rc.completed_at ? new Date(rc.completed_at * 1000).toLocaleDateString('vi-VN') : '?';
        recentText += `${rc.icon} **${rc.name}** — *${date}*\n`;
      }
      content.push(separator());
      content.push(body(`🆕 **Thành tựu đạt được gần đây:**\n${recentText}`));
    }

    content.push(separator());
    content.push(body(`*Mẹo: Dùng /thanhtuu xem để xem chi tiết từng danh mục.*`));

    const embed = container(V2_COLORS.gold, content);

    await interaction.editReply(toV2Payload([embed]));
  }

  private async handleDanhHieu(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const user = userRepository.get(userId)!;
    const titles = achievementService.getUserTitles(userId);
    const allAchievements = achievementService.getUserAchievements(userId);
    const lockedTitles = allAchievements
      .filter(a => !a.is_completed && a.reward_title)
      .map(a => a.reward_title as string);

    const content: any[] = [
      header(`🏅 DANH HIỆU TU SĨ — ${user.name}`, `**Danh hiệu đang sử dụng:** **${user.title || 'Tán Tu'}**\n📚 Đã mở khóa: **${titles.length}** danh hiệu`)
    ];

    content.push(separator());
    if (titles.length > 0) {
      let unlockedText = '';
      for (const t of titles) {
        const date = new Date(t.unlocked_at * 1000).toLocaleDateString('vi-VN');
        const isActive = t.title === user.title ? ' ⭐ **(ĐANG DÙNG)**' : '';
        unlockedText += `• **${t.title}**${isActive} (${date})\n`;
      }
      content.push(body(`✅ **Đã mở khóa:**\n${unlockedText}`));
    } else {
      content.push(body('✅ **Đã mở khóa:**\n*Chưa có danh hiệu nào. Hoàn thành thành tựu để nhận danh hiệu!*'));
    }

    if (lockedTitles.length > 0) {
      let lockedText = '';
      for (const lt of lockedTitles.slice(0, 8)) {
        lockedText += `• 🔒 **${lt}**\n`;
      }
      if (lockedTitles.length > 8) {
        lockedText += `*...và ${lockedTitles.length - 8} danh hiệu khác*`;
      }
      content.push(separator());
      content.push(body(`🔒 **Chưa mở khóa:**\n${lockedText}`));
    }

    content.push(separator());
    content.push(body(`*Nhấn nút bên dưới để chuyển đổi sử dụng danh hiệu.*`));

    const embed = container(V2_COLORS.gold, content);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (titles.length > 0) {
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      for (let i = 0; i < Math.min(titles.length, 25); i++) {
        const t = titles[i];
        const isActive = t.title === user.title;
        const btn = new ButtonBuilder()
          .setCustomId(`titleswitch_${t.title.replace(/\s/g, '_')}`)
          .setLabel(isActive ? `⭐ ${t.title}` : t.title)
          .setStyle(isActive ? ButtonStyle.Success : ButtonStyle.Secondary);
        
        currentRow.addComponents(btn);
        
        if (currentRow.components.length === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
      }
      
      if (currentRow.components.length > 0) {
        rows.push(currentRow);
      }
      
      components.push(...rows);
    }

    await interaction.editReply(toV2Payload([embed], components));
  }

  private async handleFix(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const fixed = achievementService.fixStuckAchievements(userId);

    if (fixed.length === 0) {
      await interaction.editReply({ content: '✅ Không có thành tựu nào bị kẹt. Tất cả thành tựu đều đã được cập nhật đúng!' });
      return;
    }

    let msg = `🔧 **ĐÃ FIX ${fixed.length} THÀNH TỰU:**\n\n`;
    for (const a of fixed) {
      const rewardDetails: string[] = [];
      if (a.reward_exp > 0) rewardDetails.push(`+${a.reward_exp} Tu Vi`);
      if (a.reward_coins > 0) rewardDetails.push(`+${a.reward_coins} LT`);
      if (a.reward_title) rewardDetails.push(`Danh hiệu: ${a.reward_title}`);
      msg += `${a.icon} **${a.name}** — ${rewardDetails.length > 0 ? rewardDetails.join(', ') : 'Đã hoàn thành'}\n`;
    }

    await interaction.editReply({ content: msg });
  }

  private buildCategoryProgress(achievements: AchievementWithProgress[]): string {
    const completed = achievements.filter(a => a.is_completed).length;
    const total = achievements.length;
    const barSize = 12;
    const filled = Math.round((completed / total) * barSize);
    const bar = '█'.repeat(filled) + '░'.repeat(barSize - filled);
    return `\`[${bar}]\` ${completed}/${total}`;
  }
}
