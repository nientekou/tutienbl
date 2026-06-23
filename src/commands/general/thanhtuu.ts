import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { achievementService, AchievementWithProgress } from '../../services/AchievementService';
import { getProgressBar } from '../../utils/constants';

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

    // Tính lại thành tựu Ý Cảnh khi xem (fix progress không update)
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

  /**
   * Xem thành tựu theo danh mục (hoặc tất cả)
   */
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

    const embed = new EmbedBuilder()
      .setTitle('🏆 THÀNH TỰU TU SĨ' + (category ? ` - ${CATEGORY_LABELS[category]?.emoji} ${CATEGORY_LABELS[category]?.name}` : ''))
      .setColor('#f1c40f')
      .setDescription([
        `📊 **Tiến độ:** ${completedCount}/${totalAchievements} thành tựu`,
        `*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`,
      ].join('\n'))
      .setTimestamp();

    // Nhóm theo category nếu xem tất cả
    if (!category) {
      const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'] as const;
      for (const cat of categories) {
        const catAchievements = userAchievements.filter(a => a.category === cat);
        const catCompleted = catAchievements.filter(a => a.is_completed).length;
        if (catAchievements.length > 0) {
          const catInfo = CATEGORY_LABELS[cat];
          embed.addFields({
            name: `${catInfo.emoji} ${catInfo.name} (${catCompleted}/${catAchievements.length})`,
            value: this.buildCategoryProgress(catAchievements),
            inline: false
          });
        }
      }
    } else {
      // Hiển thị chi tiết từng thành tựu trong danh mục
      for (const a of userAchievements) {
        const status = a.is_completed
          ? '✅ **HOÀN THÀNH**'
          : `📊 ${getProgressBar(a.progress, a.target_value, 8)} (${a.progress}/${a.target_value})`;
        
        const titleBonus = a.reward_title ? `\n🏅 Danh hiệu: **${a.reward_title}**` : '';
        const rewardText = [];
        if (a.reward_exp > 0) rewardText.push(`+${a.reward_exp} Tu Vi`);
        if (a.reward_coins > 0) rewardText.push(`+${a.reward_coins} LT`);
        const rewardStr = rewardText.length > 0 ? ` • *Thưởng: ${rewardText.join(', ')}*` : '';

        embed.addFields({
          name: `${a.icon} **${a.name}** — ${status}`,
          value: `📖 ${a.description}${titleBonus}${rewardStr}`,
          inline: false
        });
      }

      // Nếu danh mục có nhiều thành tựu, thêm dòng thông báo
      if (userAchievements.length > 12) {
        embed.setDescription(embed.data.description + `\n\n*Hiển thị toàn bộ ${userAchievements.length} thành tựu trong danh mục.*`);
      }
    }

    embed.setFooter({ text: `Danh hiệu hiện tại: ${userRepository.get(userId)?.title || 'Tán Tu'} | Dùng /thanhtuu danhhieu để xem tất cả danh hiệu.` });

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Xem tổng quan tất cả thành tựu
   */
  private async handleDanhSach(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const achievements = achievementService.getUserAchievements(userId);
    const completed = achievements.filter(a => a.is_completed);
    const total = achievements.length;

    const embed = new EmbedBuilder()
      .setTitle('🏆 TỔNG QUAN THÀNH TỰU')
      .setColor('#f1c40f')
      .setDescription([
        `**${interaction.user.username}** — Tu sĩ đạo hiệu: **${userRepository.get(userId)?.name || '?'}**`,
        ``,
        `📊 **Tiến độ**: ${completed.length}/${total} (${Math.round((completed.length / total) * 100)}%)`,
        ``,
      ].join('\n'))
      .setTimestamp();

    // Thống kê theo danh mục
    const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'] as const;
    let statsText = '';
    for (const cat of categories) {
      const catAchievements = achievements.filter(a => a.category === cat);
      const catCompleted = catAchievements.filter(a => a.is_completed).length;
      const catInfo = CATEGORY_LABELS[cat];
      statsText += `${catInfo.emoji} **${catInfo.name}**: ${catCompleted}/${catAchievements.length}\n`;
    }
    embed.addFields({ name: '📈 Thống kê', value: statsText, inline: false });

    // Thành tựu gần đây
    const recentCompleted = completed
      .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
      .slice(0, 5);

    if (recentCompleted.length > 0) {
      let recentText = '';
      for (const rc of recentCompleted) {
        const date = rc.completed_at ? new Date(rc.completed_at * 1000).toLocaleDateString('vi-VN') : '?';
        recentText += `${rc.icon} **${rc.name}** — ${date}\n`;
      }
      embed.addFields({ name: '🆕 Gần đây nhất', value: recentText, inline: false });
    }

    embed.setFooter({ text: 'Dùng /thanhtuu xem để xem chi tiết từng danh mục.' });

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Xem danh hiệu đã mở khóa
   */
  private async handleDanhHieu(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    const user = userRepository.get(userId)!;
    const titles = achievementService.getUserTitles(userId);
    const allAchievements = achievementService.getUserAchievements(userId);
    const lockedTitles = allAchievements
      .filter(a => !a.is_completed && a.reward_title)
      .map(a => a.reward_title as string);

    const embed = new EmbedBuilder()
      .setTitle(`🏅 DANH HIỆU - ${user.name}`)
      .setColor('#e67e22')
      .setDescription([
        `**Danh hiệu đang sử dụng:** **${user.title}**`,
        ``,
        `📚 Đã mở khóa: **${titles.length}** danh hiệu`,
      ].join('\n'))
      .setTimestamp();

    if (titles.length > 0) {
      let unlockedText = '';
      for (const t of titles) {
        const date = new Date(t.unlocked_at * 1000).toLocaleDateString('vi-VN');
        const isActive = t.title === user.title ? ' ⭐ **(ĐANG DÙNG)**' : '';
        unlockedText += `• **${t.title}**${isActive} (${date})\n`;
      }
      embed.addFields({ name: '✅ Đã mở khóa', value: unlockedText, inline: false });
    } else {
      embed.addFields({ name: '✅ Đã mở khóa', value: '*Chưa có danh hiệu nào. Hoàn thành thành tựu để nhận danh hiệu!*' });
    }

    if (lockedTitles.length > 0) {
      let lockedText = '';
      for (const lt of lockedTitles.slice(0, 8)) {
        lockedText += `• 🔒 **${lt}**\n`;
      }
      if (lockedTitles.length > 8) {
        lockedText += `*...và ${lockedTitles.length - 8} danh hiệu khác*`;
      }
      embed.addFields({ name: '🔒 Chưa mở khóa', value: lockedText, inline: false });
    }

    embed.setFooter({ text: 'Nhấn nút bên dưới để đổi danh hiệu!' });

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

    await interaction.editReply({ embeds: [embed], components });
  }

  /**
   * Fix thành tựu bị kẹt
   */
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

  /**
   * Xây dựng thanh tiến trình cho danh mục
   */
  private buildCategoryProgress(achievements: AchievementWithProgress[]): string {
    const completed = achievements.filter(a => a.is_completed).length;
    const total = achievements.length;
    const barSize = 12;
    const filled = Math.round((completed / total) * barSize);
    const bar = '█'.repeat(filled) + '░'.repeat(barSize - filled);
    return `\`[${bar}]\` ${completed}/${total}`;
  }
}
