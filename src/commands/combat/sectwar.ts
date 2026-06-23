import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { sectWarService } from '../../services/SectWarService';
import db from '../../database/database';

export default class SectWarCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sectwar')
        .setDescription('Bang hội chiến - thi đấu Tông Môn định kỳ')
        .addSubcommand(sub =>
          sub.setName('thongtin').setDescription('Xem thông tin mùa giải hiện tại')
        )
        .addSubcommand(sub =>
          sub.setName('thamgia').setDescription('Tham gia trận đấu Bang hội chiến')
        )
        .addSubcommand(sub =>
          sub.setName('tancong')
            .setDescription('Tấn công đối thủ trong trận đấu')
            .addStringOption(opt =>
              opt.setName('player_id').setDescription('ID Discord của người chơi mục tiêu').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('bangxephang').setDescription('Bảng xếp hạng Tông Môn trong mùa giải')
        )
        .addSubcommand(sub =>
          sub.setName('lichsu').setDescription('Xem lịch sử các trận Bang hội chiến gần đây')
        )
        .addSubcommandGroup(group =>
          group.setName('mo')
            .setDescription('Quản lý và chiếm đoạt Mỏ Linh Thạch')
            .addSubcommand(sub => sub.setName('xem').setDescription('Xem danh sách Mỏ Linh Thạch'))
            .addSubcommand(sub => sub.setName('chiem')
              .setDescription('Tấn công chiếm Mỏ Linh Thạch')
              .addStringOption(opt =>
                opt.setName('mine_id').setDescription('ID của Mỏ (vd: mo_nho, mo_vua, mo_lon)').setRequired(true)
              )
            )
            .addSubcommand(sub => sub.setName('thuhoach')
              .setDescription('Thu hoạch linh thạch từ mỏ đang chiếm giữ')
              .addStringOption(opt =>
                opt.setName('mine_id').setDescription('ID của Mỏ').setRequired(true)
              )
            )
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

    const subGroup = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (subGroup === 'mo') {
      if (sub === 'xem') {
        const minesState = sectWarService.getMinesState();
        const embed = new EmbedBuilder()
          .setTitle('🏔️ BẢN ĐỒ MỎ LINH THẠCH')
          .setColor('#3498db')
          .setDescription('Các Tông Môn có thể chiếm mỏ để nhận Linh Thạch mỗi 4 giờ.');

        const { SECT_MINES } = require('../../services/SectWarService');
        for (const mineDef of SECT_MINES) {
          const owner = minesState.find(m => m.mine_id === mineDef.id);
          let statusStr = '⚪ **Chưa có người chiếm giữ**';
          if (owner) {
            statusStr = `🔴 **Sở hữu:** ${owner.sect_name}\n⏳ **Thu hoạch lần cuối:** <t:${owner.last_claimed_at}:R>\n💰 **Đã sinh ra:** ${owner.total_income} LT`;
          }
          embed.addFields({
            name: `🔹 ${mineDef.name} (ID: \`${mineDef.id}\`)`,
            value: `Yêu cầu Tông Môn cấp: **${mineDef.level_req}**\nSản lượng: **${mineDef.income} LT/4h**\n${statusStr}`
          });
        }
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'chiem') {
        const mineId = interaction.options.getString('mine_id', true);
        const result = sectWarService.captureMine(userId, mineId);
        if (result.success && result.log) {
          const logText = result.log.slice(0, 5).join('\n') + (result.log.length > 5 ? '\n... (trận đấu diễn ra ác liệt)' : '');
          await interaction.editReply({ content: `${result.message}\n\n**Chiến báo:**\n${logText}` });
        } else {
          await interaction.editReply({ content: result.message });
        }
        return;
      }

      if (sub === 'thuhoach') {
        const mineId = interaction.options.getString('mine_id', true);
        const result = sectWarService.claimMineIncome(userId, mineId);
        await interaction.editReply({ content: result.message });
        return;
      }
    }

    if (sub === 'thongtin') {
      const season = sectWarService.getOrCreateSeason();
      const leaderboard = sectWarService.getSectLeaderboard();

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ BANG HỘI CHIẾN - Mùa #${season.season_number}`)
        .setColor('#e74c3c')
        .setDescription(`Trạng thái: **${season.status === 'active' ? '🟢 Đang diễn ra' : '🔴 Đã kết thúc'}**`)
        .addFields(
          { name: '📅 Bắt đầu', value: `<t:${season.started_at}:R>`, inline: true },
          { name: '🏆 Top 5 Tông Môn', value: leaderboard.slice(0, 5).map((e, i) =>
            `${i + 1}. **${e.sect_name}** (Cấp ${e.level}) - ${e.total_damage} dmg | ${e.total_wins} thắng`
          ).join('\n') || '*Chưa có dữ liệu*' },
        );

      if (user.sect_id) {
        const myScore = sectWarService.getSectWarScore(user.sect_id);
        const myAttacks = sectWarService.getUserWeeklyAttacks(userId, season.id);
        
        let battleInfo = 'Không có trận đấu nào đang diễn ra.';
        const activeBattles = sectWarService.getActiveBattlesForSect(user.sect_id);
        if (activeBattles.length > 0) {
          const b = activeBattles[0];
          // Lấy thông tin các sect trong battle
          const sectNames = b.sect_ids.map((id: number) => {
             const s = db.prepare('SELECT name FROM sects WHERE id = ?').get(id) as any;
             return s ? s.name : 'Unknown';
          });
          
          const scoresList = b.sect_ids.map((id: number, idx: number) => {
            return `**${sectNames[idx]}**: ${b.scores[id] || 0} điểm`;
          });

          // Thanh đóng góp UI (giả lập thanh progress)
          const totalPoints = Object.values(b.scores).reduce((a: any, b: any) => a + b, 0) as number;
          let progressBar = '';
          if (totalPoints > 0) {
             const myPoints = b.scores[user.sect_id] || 0;
             const myPercent = Math.round((myPoints / totalPoints) * 10);
             progressBar = '\nThế trận: [' + '🟩'.repeat(myPercent) + '⬛'.repeat(10 - myPercent) + `] ${Math.round((myPoints / totalPoints) * 100)}%`;
          }

          battleInfo = `🔥 **Đang chiến đấu!**\nTrận: ${sectNames.join(' vs ')}\nĐiểm số: ${scoresList.join(' | ')}${progressBar}`;
        }

        embed.addFields({
          name: '📊 Tông Môn Của Bạn',
          value: [
            `🏛️ **${(db.prepare('SELECT name FROM sects WHERE id = ?').get(user.sect_id) as any)?.name || 'Không rõ'}**`,
            `⚔️ Sát thương: **${myScore.total_damage}** | Thắng: **${myScore.total_wins}** | Trận: **${myScore.total_battles}**`,
            `🎯 Lượt tấn công còn lại: **${5 - myAttacks}/5** trong tuần`,
            ``,
            battleInfo
          ].join('\n'),
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'thamgia') {
      const result = sectWarService.joinBattle(userId);
      await interaction.editReply({ content: result.message });
      return;
    }

    if (sub === 'tancong') {
      const targetId = interaction.options.getString('player_id', true);

      if (targetId === userId) {
        await interaction.editReply({ content: '❌ Không thể tự tấn công bản thân!' });
        return;
      }

      const result = sectWarService.attack(userId, targetId);
      await interaction.editReply({ content: result.message });
      return;
    }

    if (sub === 'bangxephang') {
      const season = sectWarService.getOrCreateSeason();
      const leaderboard = sectWarService.getSectLeaderboard();

      if (leaderboard.length === 0) {
        await interaction.editReply({ content: '📊 Chưa có dữ liệu bảng xếp hạng cho mùa này.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏆 BẢNG XẾP HẠNG TÔNG MÔN - Mùa #${season.season_number}`)
        .setColor('#f1c40f')
        .setDescription(leaderboard.map((e, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **${e.sect_name}** (Cấp ${e.level})\n   ⚔️ ${e.total_damage} dmg | 🏆 ${e.total_wins} thắng | 📊 ${e.total_battles} trận`;
        }).join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'lichsu') {
      const history = sectWarService.getFinishedBattlesHistory();
      if (history.length === 0) {
        await interaction.editReply({ content: '📜 Chưa có dữ liệu lịch sử chiến trận nào.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📜 LỊCH SỬ BANG HỘI CHIẾN`)
        .setColor('#95a5a6');

      for (const b of history) {
        const sectNames = b.sect_ids.map((id: number) => {
          const s = db.prepare('SELECT name FROM sects WHERE id = ?').get(id) as any;
          return s ? s.name : 'Unknown';
        });

        const scoresStr = b.sect_ids.map((id: number, idx: number) => {
          return `${sectNames[idx]}: ${b.scores[id] || 0}`;
        }).join(' | ');

        embed.addFields({
          name: `Trận đấu ngày <t:${b.created_at}:d>`,
          value: `Các bên: **${sectNames.join(' vs ')}**\nĐiểm số: ${scoresStr}\nTrạng thái: Đã kết thúc <t:${b.ended_at}:R>`
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }
}


