import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { minigameService } from '../../services/MinigameService';
import { userRepository } from '../../database/repositories/UserRepository';
import db from '../../database/database';

export default class QuyetAuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('quyetau')
        .setDescription('⚔️ Đấu pháp Tam Hồi Linh Chiến - Quyết đấu 3 hiệp dùng chỉ số thực tế tu sĩ!')
        .addUserOption(option =>
          option
            .setName('tuser')
            .setDescription('Tu sĩ đạo hữu muốn khiêu chiến.')
        )
        .addIntegerOption(option =>
          option
            .setName('cuoc')
            .setDescription('Số lượng Hạ Phẩm Linh Thạch muốn đặt cược.')
        )
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Hành động khác: lichsu/xephang')
            .addChoices(
              { name: '📜 Lịch Sử Quyết Đấu', value: 'lichsu' },
              { name: '🏆 Bảng Xếp Hạng Quyết Đấu', value: 'bangxephang' },
              { name: '🎁 Top Thưởng Hàng Tuần', value: 'topthuong' },
              { name: '📊 Thống Kê Cá Nhân', value: 'thongke' }
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const challengerId = interaction.user.id;
    const action = interaction.options.getString('action');

    // === XỬ LÝ: XEM LỊCH SỬ QUYẾT ĐẤU ===
    if (action === 'lichsu') {
      const userId = interaction.options.getUser('tuser')?.id || challengerId;
      const user = userRepository.get(userId);
      if (!user) {
        await interaction.editReply({
          content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.'
        });
        return;
      }

      const history = minigameService.getDuelHistory(userId, 1);

      if (history.records.length === 0) {
        await interaction.editReply({
          content: `📜 **${userId === challengerId ? 'Đạo hữu' : `<@${userId}>`}** chưa có trận quyết đấu nào! Hãy dùng \`/quyetau\` để khiêu chiến một tu sĩ khác.`,
        });
        return;
      }

      const embed = this.buildDuelHistoryEmbed(history.records, userId, history.currentPage, history.totalPages, history.totalRecords);
      const row = this.buildDuelHistoryPagination(userId, history.currentPage, history.totalPages);

      await interaction.editReply({
        embeds: [embed],
        components: row ? [row] : []
      });
      return;
    }

    // === XỬ LÝ: XEM BẢNG XẾP HẠNG QUYẾT ĐẤU ===
    if (action === 'bangxephang') {
      const leaderboard = minigameService.getDuelLeaderboard(10, challengerId);

      if (leaderboard.entries.length === 0) {
        await interaction.editReply({
          content: '📊 **Chưa có dữ liệu bảng xếp hạng!** Hãy dùng `/quyetau` để bắt đầu quyết đấu và tranh hạng.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG QUYẾT ĐẤU - TAM HỒI LINH CHIẾN')
        .setColor('#f1c40f')
        .setDescription(
          '📊 **Xếp hạng tu sĩ theo chiến tích quyết đấu**\n' +
          'Xếp hạng dựa trên: **Số trận thắng** > **Linh Thạch ròng kiếm được** > **Tỉ lệ thắng**\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        )
        .setFooter({ text: 'Dùng /quyetau action: lichsu để xem lịch sử chi tiết' })
        .setTimestamp();

      const medals = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < leaderboard.entries.length; i++) {
        const entry = leaderboard.entries[i];
        const rank = i + 1;
        const medal = rank <= 3 ? medals[rank - 1] : `${rank}.`;
        const isCurrentUser = entry.userId === challengerId;

        let winRateColor = '';
        if (entry.winRate >= 70) winRateColor = '🟢';
        else if (entry.winRate >= 40) winRateColor = '🟡';
        else winRateColor = '🔴';

        const netStr = entry.netWinnings >= 0 ? `+${entry.netWinnings}` : `${entry.netWinnings}`;

        embed.addFields({
          name: `${isCurrentUser ? '⭐ ' : ''}${medal} **${entry.name}**`,
          value:
            `🏆 **${entry.wins}** thắng | 💀 **${entry.losses}** thua | 🤝 **${entry.ties}** hòa\n` +
            `📈 Winrate: **${entry.winRate}%** ${winRateColor} | 🪙 **${netStr}** Linh Thạch\n` +
            `⚔️ Tổng: **${entry.totalMatches}** trận`
        });
      }

      if (leaderboard.currentUserRank && leaderboard.currentUserRank > leaderboard.entries.length) {
        embed.addFields({
          name: '⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯',
          value: `Đạo hữu đang đứng hạng **#${leaderboard.currentUserRank}** trên tổng số **${leaderboard.totalPlayers}** tu sĩ tham gia quyết đấu.`
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // === XỬ LÝ: XEM THỐNG KÊ CÁ NHÂN ===
    if (action === 'thongke') {
      const targetUser = interaction.options.getUser('tuser');
      const userId = targetUser?.id || challengerId;
      const user = userRepository.get(userId);

      if (!user) {
        await interaction.editReply({
          content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.'
        });
        return;
      }

      const stats = minigameService.getDuelStats(userId);

      if (stats.totalMatches === 0) {
        await interaction.editReply({
          content: `📊 **${userId === challengerId ? 'Đạo hữu' : user.name}** chưa có trận quyết đấu nào để thống kê! Hãy dùng \`/quyetau\` để bắt đầu.`,
        });
        return;
      }

      const isSelf = userId === challengerId;
      const titleName = isSelf ? user.name : `${user.name} (của <@${userId}>)`;

      // Winrate bar
      const winRateEmoji = stats.winRate >= 70 ? '🟢' : stats.winRate >= 40 ? '🟡' : '🔴';

      // Streak indicators — xác định kết quả trận gần nhất
      const lastMatch = db.prepare(
        'SELECT is_tie, winner_id FROM duel_history WHERE winner_id = ? OR loser_id = ? ORDER BY fought_at DESC LIMIT 1'
      ).get(userId, userId) as { is_tie: number; winner_id: string } | undefined;

      let streakText = '';
      if (stats.currentWinStreak > 0) {
        streakText = `\n🔥 **Đang thắng ${stats.currentWinStreak} trận liên tiếp!**`;
      } else if (lastMatch && lastMatch.is_tie === 1) {
        streakText = stats.longestWinStreak > 0
          ? `\n🤝 Trận gần nhất hòa (Kỷ lục thắng: ${stats.longestWinStreak} trận)`
          : '';
      } else if (stats.longestWinStreak > 0) {
        streakText = `\n💀 Trận gần nhất thua (Kỷ lục: ${stats.longestWinStreak} trận)`;
      }

      const netStr = stats.netWinnings >= 0 ? `+${stats.netWinnings}` : `${stats.netWinnings}`;

      // Format dates
      const formatDate = (ts: number | null) => {
        if (!ts) return 'Chưa có';
        return new Date(ts * 1000).toLocaleDateString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      };

      const embed = new EmbedBuilder()
        .setTitle(`📊 THỐNG KÊ QUYẾT ĐẤU — ${titleName}`)
        .setColor('#3498db')
        .setDescription(
          `📈 **${stats.totalMatches}** trận • ${winRateEmoji} Winrate **${stats.winRate}%**${streakText}`
        )
        .addFields(
          {
            name: '⚔️ KẾT QUẢ',
            value:
              `🏆 **${stats.wins}** Thắng` +
              ` | 💀 **${stats.losses}** Thua` +
              ` | 🤝 **${stats.ties}** Hòa`
          },
          {
            name: '🪙 TÀI CHÍNH',
            value:
              `💰 **${netStr}** Linh Thạch ròng\n` +
              `📥 Thu: **+${stats.totalWinnings}** | 📤 Chi: **-${stats.totalLost}**\n` +
              `🏅 Thắng lớn nhất: **+${stats.biggestWin}** | 📊 Cược lớn nhất: **${stats.biggestWager}**`
          },
          {
            name: '📈 CHUỖI & CHI TIẾT',
            value:
              `🔥 Chuỗi thắng dài nhất: **${stats.longestWinStreak}** trận\n` +
              `🎯 Winrate: **${stats.winRate}%** (${stats.wins}W/${stats.losses}L)\n` +
              `🔄 Trung bình: **${stats.avgRounds}** hiệp/trận`
          },
          {
            name: '👤 ĐỐI THỦ',
            value: stats.mostFrequentOpponent
              ? `⚔️ **${stats.mostFrequentOpponent.name}** — **${stats.mostFrequentOpponent.count}** trận`
              : 'Chưa có đối thủ nào'
          }
        )
        .setFooter({
          text: `Trận đầu: ${formatDate(stats.firstMatchAt)} • Gần đây: ${formatDate(stats.lastMatchAt)}`
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // === XỬ LÝ: XEM TOP THƯỞNG HÀNG TUẦN ===
    if (action === 'topthuong') {
      const lastSeason = minigameService.getLastSeasonTop();
      const currentSeason = minigameService.getCurrentSeason();

      const embed = new EmbedBuilder()
        .setTitle('🎁 PHẦN THƯỞNG TOP 3 QUYẾT ĐẤU HÀNG TUẦN')
        .setColor('#9b59b6')
        .setTimestamp();

      if (currentSeason.season) {
        const weekStartDate = new Date(currentSeason.season.week_start * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const weekEndDate = new Date(currentSeason.season.week_end * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        embed.setDescription(
          `📅 **Mùa giải hiện tại:** #${currentSeason.season.season_number}\n` +
          `🗓️ **Tuần ${weekStartDate} → ${weekEndDate}**\n` +
          `⏳ **Top 3 cuối tuần sẽ nhận thưởng!**\n\n` +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        );
      }

      if (lastSeason.season && lastSeason.top.length > 0) {
        const weekStartDate = new Date(lastSeason.season.week_start * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const weekEndDate = new Date(lastSeason.season.week_end * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        embed.addFields({ name: '📜 KỲ TRƯỚC', value: `Mùa #${lastSeason.season.season_number} (${weekStartDate} - ${weekEndDate})` });

        const medals = ['🥇', '🥈', '🥉'];

        for (const entry of lastSeason.top) {
          const medal = medals[entry.rank - 1] || `#${entry.rank}`;
          const isCurrentUser = entry.userId === challengerId;

          // Chi tiết phần thưởng
          let rewardDetails = `🪙 **+${entry.rewardCoins}** Linh Thạch | 🌿 **+${entry.rewardTuVi}** Tu Vi | 💡 **+${entry.rewardNgotinh}** Ngộ Tính`;
          if (entry.rewardItems.length > 0) {
            const itemNames = entry.rewardItems.map((item: any) => {
              const itemRow = db.prepare('SELECT name FROM items WHERE id = ?').get(item.item_id) as { name: string } | undefined;
              return `${item.quantity}x ${itemRow?.name || item.item_id}`;
            }).join(', ');
            rewardDetails += `\n📦 **Vật phẩm:** ${itemNames}`;
          }

          embed.addFields({
            name: `${isCurrentUser ? '⭐ ' : ''}${medal} **${entry.userName}**`,
            value:
              `🏆 **${entry.wins}** thắng | 💰 **${entry.netWinnings >= 0 ? '+' : ''}${entry.netWinnings}** Linh Thạch ròng\n` +
              `📈 Winrate: **${entry.winRate}%**\n` +
              `🎁 **Phần thưởng đã trao:**\n${rewardDetails}`
          });
        }

        embed.setFooter({ text: 'Phần thưởng được tự động trao vào đầu tuần mới (Thứ 2 00:00 UTC+7)' });
      } else {
        embed.setDescription(
          '📊 **Chưa có kỳ trao thưởng nào!**\n\n' +
          'Hãy tham gia quyết đấu bằng lệnh `/quyetau` để tranh top 3 hàng tuần!\n\n' +
          '🏆 **Phần thưởng top 3:**\n' +
          '🥇 **Hạng 1:** 5,000 Linh Thạch + 2,000 Tu Vi + 10 Ngộ Tính + 3x Pháp Bảo Dưỡng Thạch\n' +
          '🥈 **Hạng 2:** 3,000 Linh Thạch + 1,000 Tu Vi + 5 Ngộ Tính + 2x Pháp Bảo Dưỡng Thạch\n' +
          '🥉 **Hạng 3:** 1,000 Linh Thạch + 500 Tu Vi + 3 Ngộ Tính + 1x Pháp Bảo Dưỡng Thạch\n\n' +
          '📅 **Xếp hạng reset vào thứ 2 hàng tuần (00:00 UTC+7)**\n' +
          '📊 Dùng `/quyetau action: bangxephang` để xem bảng xếp hạng hiện tại!'
        )
        .setFooter({ text: 'Tham gia quyết đấu để leo top nhận thưởng!' });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // === XỬ LÝ: TẠO LỜI KHIÊU CHIẾN ===
    const targetUser = interaction.options.getUser('tuser');
    const wager = interaction.options.getInteger('cuoc');

    if (!targetUser || wager === null) {
      await interaction.editReply({
        content: '❌ Vui lòng chỉ định **đối thủ** (@tuser) và **số Linh Thạch cược** (cuoc) để khiêu chiến!\nHoặc dùng `/quyetau action: lichsu` để xem lịch sử.'
      });
      return;
    }

    const challenger = userRepository.get(challengerId);
    const target = userRepository.get(targetUser.id);
    
    if (!challenger) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.'
      });
      return;
    }
    
    if (!target) {
      await interaction.editReply({
        content: '❌ Đối thủ chưa khởi tạo nhân vật tu tiên!'
      });
      return;
    }

    const levelDiff = Math.abs(challenger.level - target.level);
    if (levelDiff > 15) {
      await interaction.editReply({
        content: `❌ **Không thể khiêu chiến:** Chênh lệch cấp độ quá lớn (**${levelDiff}** cấp). Giới hạn tối đa là **15** cấp (Đạo hữu cấp **${challenger.level}**, đối thủ cấp **${target.level}**).`
      });
      return;
    }

    const result = minigameService.createChallenge(challengerId, targetUser.id, wager);

    if (!result.success || !result.duel) {
      await interaction.editReply({
        content: `❌ **Khiêu chiến thất bại:** ${result.message}`
      });
      return;
    }

    const duel = result.duel;

    const embed = new EmbedBuilder()
      .setTitle('⚔️ THƯ KHIÊU CHIẾN — TAM HỒI LINH CHIẾN ⚔️')
      .setColor('#e74c3c')
      .setDescription(
        `Đạo hữu <@${challengerId}> gửi thư khiêu chiến **Tam Hồi Linh Chiến** đến <@${targetUser.id}>!\n\n` +
        `🪙 **Linh Thạch Đặt Cược:** **${wager}** Hạ Phẩm Linh Thạch 🟤 từ mỗi bên.\n` +
        `⚖️ **Thuế Khấu Trừ:** **5%** phí giao dịch (thu thuế tông môn từ người thắng).\n\n` +
        `🌀 **THỂ LỆ TAM HỒI LINH CHIẾN:**\n` +
        `Quyết đấu diễn ra trong **3 hiệp**, mỗi hiệp chọn **1 trong 4 chiêu thức**:\n\n` +
        `⚔️ **Xuất Kiếm** — Tấn công thuần túy. Mạnh vs 💫 Tụ Khí (+50%). Yếu vs 🛡️ Phòng Thủ (-60%).\n` +
        `🛡️ **Phòng Thủ** — Giảm 60% sát thương nhận, hồi 6% HP. Chặn đứng đòn Xuất Kiếm.\n` +
        `🔮 **Linh Pháp** — Công kích dẫn Linh Căn, phá giáp 🛡️ Phòng Thủ. Sát thương theo thực lực.\n` +
        `💫 **Tụ Khí** — Hồi 20% HP và tích **Chiến Ý** (+25% dmg hiệp sau). Rủi ro nếu bị ⚔️ Xuất Kiếm!\n\n` +
        `📊 Sát thương dựa trên **ATK/DEF thực tế** và **Linh Căn** của mỗi tu sĩ.\n` +
        `Sau 3 hiệp, ai còn nhiều HP % hơn sẽ chiến thắng!\n\n` +
        `⏳ **Thời gian ứng chiến:** **60 giây** để chấp nhận khiêu chiến.`
      )
      .setFooter({ text: 'Hãy cân nhắc thực lực và túi tiền trước khi ứng chiến!' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`duelaccept_${duel.id}`)
        .setLabel('⚔️ Chấp Nhận Ứng Chiến')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`duelrefuse_${duel.id}`)
        .setLabel('❌ Khước Từ Khiêu Chiến')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      content: `<@${targetUser.id}>, đạo hữu nhận được một lời khiêu chiến **Tam Hồi Linh Chiến**!`,
      embeds: [embed],
      components: [row]
    });
  }

  /**
   * Xây dựng embed hiển thị lịch sử quyết đấu
   */
  private buildDuelHistoryEmbed(records: any[], userId: string, page: number, totalPages: number, totalRecords: number): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📜 LỊCH SỬ QUYẾT ĐẤU - TAM HỒI LINH CHIẾN')
      .setColor('#f39c12')
      .setFooter({ text: `Trang ${page}/${totalPages} • Tổng số: ${totalRecords} trận` })
      .setTimestamp();

    for (const record of records) {
      const isWinner = record.winner_id === userId;
      const isTie = record.is_tie === 1;
      
      const date = new Date(record.fought_at * 1000);
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

      let resultEmoji: string;
      let resultText: string;

      if (isTie) {
        resultEmoji = '🤝';
        resultText = `**Hòa** với **${record.winner_name}**`;
      } else if (isWinner) {
        resultEmoji = '🏆';
        resultText = `**Thắng** ${record.loser_name} (+${record.winnings - record.wager} Linh Thạch)`;
      } else {
        resultEmoji = '💀';
        resultText = `**Thua** ${record.winner_name} (-${record.wager} Linh Thạch)`;
      }

      // Tạo HP bar thu nhỏ
      const hpBar = (current: number, max: number) => {
        if (max <= 0) return '?';
        const filled = Math.round((current / max) * 10);
        return '🟩'.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, 10 - filled));
      };

      const hpInfo = isTie
        ? `${hpBar(record.challenger_hp_left, 2000)} - ${hpBar(record.target_hp_left, 2000)}`
        : isWinner
          ? `💚 ${record.challenger_hp_left > record.target_hp_left ? record.challenger_hp_left : record.target_hp_left} HP còn lại`
          : `💔 ${record.challenger_hp_left < record.target_hp_left ? record.challenger_hp_left : record.target_hp_left} HP còn lại`;

      embed.addFields({
        name: `${resultEmoji} ${resultText}`,
        value: `🔄 **${record.rounds}** hiệp | 🪙 Cược **${record.wager}** Linh Thạch | 🕐 ${dateStr}`
      });
    }

    return embed;
  }

  /**
   * Xây dựng nút phân trang lịch sử
   */
  private buildDuelHistoryPagination(userId: string, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> | null {
    if (totalPages <= 1) return null;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`duellichsu_${userId}_${page - 1}`)
        .setLabel('◀ Trang Trước')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`duellichsu_${userId}_${page + 1}`)
        .setLabel('Trang Sau ▶')
        .setStyle(ButtonStyle.Primary)
    );

    return row;
  }
}

