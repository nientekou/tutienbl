import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { arenaService } from '../../services/ArenaService';
import { userRepository } from '../../database/repositories/UserRepository';
import db from '../../database/database';

export default class ArenaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('arena')
        .setDescription('Tham gia Đấu Trường (Arena) PvP')
        .addSubcommand(subcommand =>
          subcommand
            .setName('profile')
            .setDescription('Xem hồ sơ Đấu Trường của bản thân hoặc người khác')
            .addUserOption(option =>
              option.setName('target').setDescription('Người chơi muốn xem').setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('find')
            .setDescription('Tìm và khiêu chiến đối thủ có ELO tương đương')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('top')
            .setDescription('Xem Bảng Xếp Hạng Đấu Trường')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('history')
            .setDescription('Xem lịch sử các trận đấu gần đây')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật, vui lòng dùng lệnh `/taonhanvat`.'});
      return;
    }

    if (subcommand === 'profile') {
      const targetUser = interaction.options.getUser('target') || interaction.user;
      const targetId = targetUser.id;
      const targetProfile = userRepository.get(targetId);

      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Người chơi này chưa tạo nhân vật.'});
        return;
      }

      const profile = arenaService.getProfile(targetId);
      const totalMatches = profile.wins + profile.losses;
      const winRate = totalMatches > 0 ? ((profile.wins / totalMatches) * 100).toFixed(1) : '0.0';

      let shieldText = '';
      if (arenaService.isShielded(targetId)) {
        try {
          const yCanh = JSON.parse(targetProfile.y_canh || '{}');
          if (yCanh.shield_until) {
            const diff = yCanh.shield_until - Math.floor(Date.now() / 1000);
            if (diff > 0) {
              const minutes = Math.ceil(diff / 60);
              shieldText = `🛡️ **Hộ Giới Bài:** Đang kích hoạt (Còn **${minutes}** phút bảo hộ)`;
            }
          }
        } catch (e) {}
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Hồ Sơ Đấu Trường: ${targetProfile.name}`)
        .setDescription(shieldText || null)
        .setColor('#FFA500')
        .addFields(
          { name: '🏆 Điểm ELO', value: `**${profile.elo}**`, inline: true },
          { name: '🔥 Chuỗi Thắng', value: `${profile.win_streak}`, inline: true },
          { name: '📈 ELO Kỷ Lục', value: `${profile.highest_elo}`, inline: true },
          { name: '⚔️ Trận Đấu', value: `Thắng: ${profile.wins} | Thua: ${profile.losses}`, inline: true },
          { name: '📊 Tỉ Lệ Thắng', value: `${winRate}%`, inline: true },
          { name: '🏅 Xếp Hạng Mùa Trước', value: profile.last_season_rank > 0 ? `#${profile.last_season_rank}` : 'Chưa xếp hạng', inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `Mùa Giải: ${profile.season_id}` });

      await interaction.editReply({ embeds: [embed] });
    }
    
    else if (subcommand === 'find') {
      const opponentId = arenaService.getMatchmaking(userId);
      if (!opponentId) {
        await interaction.editReply('❌ Đấu trường hiện tại vắng lặng, không tìm thấy đối thủ nào! Hãy quay lại sau.');
        return;
      }

      const oUser = userRepository.get(opponentId);
      if (!oUser) {
        await interaction.editReply('❌ Đối thủ bỗng nhiên bốc hơi, vui lòng thử lại.');
        return;
      }

      // Check current ELO
      const oldChallengerProfile = arenaService.getProfile(userId);
      const oldOpponentProfile = arenaService.getProfile(opponentId);

      // Fight
      const matchResult = arenaService.challenge(userId, opponentId);
      
      if (!matchResult.success || !matchResult.result) {
        await interaction.editReply(matchResult.message);
        return;
      }

      // Fetch new profile to get elo diff
      const newChallengerProfile = arenaService.getProfile(userId);
      const eloDiff = newChallengerProfile.elo - oldChallengerProfile.elo;
      const isWin = matchResult.result.winner === 'player';

      // Log file
      const logText = matchResult.result.log.join('\n');
      const attachment = new AttachmentBuilder(Buffer.from(logText, 'utf-8'), { name: 'combat_log.txt' });

      let resultText = '';
      if (isWin) {
        resultText = `🎉 **CHIẾN THẮNG!** Đạo hữu đã đánh bại **${oUser.name}**.\n📈 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (+${eloDiff})`;
        if (matchResult.artifactMessage) {
          resultText += `\n\n${matchResult.artifactMessage}`;
        }
      } else {
        resultText = `💀 **THẤT BẠI!** Đạo hữu đã gục ngã trước **${oUser.name}**.\n📉 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (${eloDiff})`;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚔️ KẾT QUẢ ĐẤU TRƯỜNG')
        .setDescription(`**${user.name}** (ELO: ${oldChallengerProfile.elo}) 🆚 **${oUser.name}** (ELO: ${oldOpponentProfile.elo})\n\n${resultText}`)
        .setColor(isWin ? '#00FF00' : '#FF0000')
        .addFields(
          { name: 'Trận chiến kéo dài', value: `${matchResult.result.rounds} hiệp`, inline: true },
          { name: 'Tổng sát thương', value: `${matchResult.result.totalDamageDealt}`, inline: true }
        )
        .setFooter({ text: 'Chi tiết trận đấu được đính kèm trong file.' });

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
    
    else if (subcommand === 'top') {
      const topPlayers = arenaService.getLeaderboard(10);

      if (topPlayers.length === 0) {
        await interaction.editReply({ content: '📭 Bảng xếp hạng Đấu Trường hiện tại trống rỗng.'});
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG ĐẤU TRƯỜNG (TOP 10)')
        .setColor('#FFD700');

      let description = '';
      topPlayers.forEach((p, index) => {
        let rankIcon = '🏅';
        if (index === 0) rankIcon = '🥇';
        else if (index === 1) rankIcon = '🥈';
        else if (index === 2) rankIcon = '🥉';

        description += `**${rankIcon} #${index + 1}** | **${p.name}**\n`;
        description += `└─ 🏆 ELO: **${p.elo}** | ⚔️ W/L: ${p.wins}/${p.losses} | 🔥 Chuỗi: ${p.win_streak}\n\n`;
      });

      embed.setDescription(description);
      await interaction.editReply({ embeds: [embed] });
    }
    
    else if (subcommand === 'history') {
      const history = db.prepare(`
        SELECT * FROM arena_history 
        WHERE challenger_id = ? OR opponent_id = ?
        ORDER BY created_at DESC 
        LIMIT 5
      `).all(userId, userId) as any[];

      if (history.length === 0) {
        await interaction.editReply({ content: '📭 Đạo hữu chưa tham gia trận đấu nào.'});
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Lịch Sử Đấu Trường (5 Trận Gần Nhất)')
        .setColor('#8B4513');

      let desc = '';
      for (const h of history) {
        const isChallenger = h.challenger_id === userId;
        const isWin = h.winner_id === userId;
        const opponentId = isChallenger ? h.opponent_id : h.challenger_id;
        const oUser = userRepository.get(opponentId);
        const oName = oUser ? oUser.name : 'Vô Danh';
        
        const resultIcon = isWin ? '✅ Thắng' : '❌ Thua';
        const eloMod = isWin ? `+${h.elo_change}` : `-${h.elo_change}`;
        const timeStr = `<t:${h.created_at}:R>`;

        desc += `**${resultIcon}** vs **${oName}** (${eloMod} ELO) - ${timeStr}\n`;
      }

      embed.setDescription(desc);
      await interaction.editReply({ embeds: [embed] });
    }
  }
}
