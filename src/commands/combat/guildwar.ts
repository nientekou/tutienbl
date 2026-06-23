import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { guildWarService } from '../../services/GuildWarService';
import { getRealmDetails, getProgressBar } from '../../utils/constants';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class GuildWarCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('guildwar')
        .setDescription('Chiến Tranh Tông Môn - Đối kháng giữa các môn phái.')
        .addSubcommand(sub =>
          sub
            .setName('taophong')
            .setDescription('[Tông Chủ] Tạo phòng chiến, tuyên chiến với Tông Môn khác.')
            .addIntegerOption(opt =>
              opt.setName('id_tongmon_dich')
                .setDescription('ID của Tông Môn đối thủ (xem trong /tongmon danhsach)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('thamgia')
            .setDescription('Tham gia chiến tranh Tông Môn bằng mã chiến.')
            .addStringOption(opt =>
              opt.setName('ma_chien')
                .setDescription('Mã chiến 8 ký tự (VD: ABC12345)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('chapnhan')
            .setDescription('[Tông Chủ phòng thủ] Chấp nhận khiêu chiến.')
            .addStringOption(opt =>
              opt.setName('ma_chien')
                .setDescription('Mã chiến cần chấp nhận.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('tuchoi')
            .setDescription('[Tông Chủ phòng thủ] Từ chối khiêu chiến (bồi thường 1000 Linh Thạch).')
            .addStringOption(opt =>
              opt.setName('ma_chien')
                .setDescription('Mã chiến cần từ chối.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('tancong')
            .setDescription('Tấn công trong chiến tranh Tông Môn (khi đến lượt).')
            .addStringOption(opt =>
              opt.setName('ma_chien')
                .setDescription('Mã chiến hiện tại.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('bangxephang')
            .setDescription('Xem bảng xếp hạng chiến tích Tông Môn.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thongtin')
            .setDescription('Xem thông tin chiến tranh hiện tại của Tông Môn.')
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

    if (sub === 'taophong') {
      const targetSectId = interaction.options.getInteger('id_tongmon_dich', true);

      const result = guildWarService.createWar(userId, targetSectId);
      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      const warDetail = guildWarService.getWarDetail(result.warId!);
      const challengerSect = guildWarService.getSectInfo(warDetail?.challenger_sect_id!);
      const defenderSect = guildWarService.getSectInfo(targetSectId);

      const embed = new EmbedBuilder()
        .setTitle('⚔️ TUYÊN CHIẾN TÔNG MÔN!')
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(
          `**${challengerSect?.name}** ⚔️ **${defenderSect?.name}**\n\n` +
          `Mã chiến: \`${result.warId}\`\n` +
          `Số hiệp tối đa: **${warDetail?.max_rounds || 5}**\n` +
          `Phí phát động: -2000 Linh Thạch\n\n` +
          `_Đang chờ Tông Chủ **${defenderSect?.name}** hồi đáp..._\n` +
          `Đệ tử **${defenderSect?.name}** hãy dùng \`/guildwar thamgia ma_chien: ${result.warId}\` để tham gia!`
        )
        .setFooter({ text: 'Thư chiến sẽ tự động hết hạn sau 24 giờ.' })
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
    }

    else if (sub === 'thamgia') {
      const warId = interaction.options.getString('ma_chien', true).toUpperCase();
      const result = guildWarService.joinWar(warId, userId);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      await interaction.editReply({ content: `✅ ${result.message}` });
    }

    else if (sub === 'chapnhan') {
      const warId = interaction.options.getString('ma_chien', true).toUpperCase();
      const result = guildWarService.respondToWar(warId, userId, true);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      // Hiển thị thông tin chiến tranh
      const war = guildWarService.getWarDetail(warId);
      const embed = this.getWarStatusEmbed(war!);
      await interaction.editReply(embed ? toV2Payload([embed]) : { content: '✅ ' + result.message });
    }

    else if (sub === 'tuchoi') {
      const warId = interaction.options.getString('ma_chien', true).toUpperCase();
      const result = guildWarService.respondToWar(warId, userId, false);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      await interaction.editReply({ content: result.message });
    }

    else if (sub === 'tancong') {
      const warId = interaction.options.getString('ma_chien', true).toUpperCase();
      const result = guildWarService.attack(warId, userId);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      // Hiển thị kết quả
      const war = guildWarService.getWarDetail(warId);
      const embed = this.getWarStatusEmbed(war!);

      await interaction.editReply({
        content: result.message,
        embeds: embed ? [embed] : []
      });
    }

    else if (sub === 'bangxephang') {
      const leaderboard = guildWarService.getLeaderboard();

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG CHIẾN TRANH TÔNG MÔN')
        .setColor(EMBED_COLORS.GOLD)
        .setDescription(
          'Bảng xếp hạng các Tông Môn có thành tích chiến tranh xuất sắc nhất.\n' +
          '_Xếp hạng dựa trên số trận thắng và tổng sát thương._\n'
        )
        .setTimestamp();

      if (leaderboard.length === 0) {
        embed.addFields({
          name: '📊 Bảng Xếp Hạng',
          value: '*Chưa có cuộc chiến tranh Tông Môn nào diễn ra! Hãy dùng `/guildwar taophong` để bắt đầu.*'
        });
      } else {
        let rankingText = '';
        for (let i = 0; i < leaderboard.length; i++) {
          const entry = leaderboard[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

          rankingText += `${medal} **${entry.sectName}**\n`;
          rankingText += `　　• 🏅 **${entry.wins}** Thắng / **${entry.losses}** Bại\n`;
          rankingText += `　　• 💥 Tổng sát thương: **${entry.totalDamage.toLocaleString('vi-VN')}**\n`;
        }
        embed.addFields({ name: '📊 Bảng Xếp Hạng', value: rankingText });
      }

      await interaction.editReply(toV2Payload([embed]));
    }

    else if (sub === 'thongtin') {
      const war = guildWarService.getUserActiveWar(userId);

      if (!war) {
        // Hiển thị thông tin Tông Môn và lịch sử
        if (user.sect_id) {
          const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as any;
          if (sect) {
            const leaderboard = guildWarService.getLeaderboard();
            const sectEntry = leaderboard.find(e => e.sectId === user.sect_id);

            const embed = new EmbedBuilder()
              .setTitle(`🏛️ THÔNG TIN CHIẾN TRANH - ${sect.name}`)
              .setColor(EMBED_COLORS.INFO)
              .setDescription(
                `Tông Môn của đạo hữu hiện không tham gia cuộc chiến nào.\n\n` +
                `**Chiến tích:**\n` +
                `• Thắng: **${sectEntry?.wins || 0}** trận\n` +
                `• Bại: **${sectEntry?.losses || 0}** trận\n` +
                `• Tổng sát thương: **${(sectEntry?.totalDamage || 0).toLocaleString('vi-VN')}**\n\n` +
                `_Tông Chủ có thể dùng \`/guildwar taophong\` để khiêu chiến Tông Môn khác._`
              )
              .setTimestamp();
            await interaction.editReply(toV2Payload([embed]));
            return;
          }
        }
        await interaction.editReply({ content: '❌ Đạo hữu chưa gia nhập Tông Môn nào!' });
        return;
      }

      const embed = this.getWarStatusEmbed(war);
      if (!embed) {
        await interaction.editReply({ content: '❌ Không thể tải thông tin chiến tranh.' });
        return;
      }

      // Lấy lịch sử tấn công gần đây
      const logs = guildWarService.getAttackLogs(war.id, 10);
      let logText = '';
      if (logs.length > 0) {
        logText = logs.slice(0, 5).map(l =>
          `• Hiệp ${l.round}: **${l.attackerName}** → **${l.targetName}**: **-${l.damage}**`
        ).join('\n');
        embed.addFields({ name: '📜 Nhật Ký Chiến Trường', value: logText || '*Chưa có đòn tấn công nào.*' });
      }

      const participantRows = new ActionRowBuilder<ButtonBuilder>();
      if (war.status === 'active') {
        participantRows.addComponents(
          new ButtonBuilder()
            .setCustomId(`guildwar_attack_${war.id}_${userId}`)
            .setLabel('⚔️ Tấn Công'!)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`guildwar_refresh_${war.id}_${userId}`)
            .setLabel('🔄 Làm Mới')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      await interaction.editReply({
        embeds: [embed],
        components: participantRows.components.length > 0 ? [participantRows] : []
      });
    }
  }

  /**
   * Tạo Embed trạng thái chiến tranh
   */
  private getWarStatusEmbed(war: any): EmbedBuilder | null {
    if (!war) return null;

    const challengerSect = guildWarService.getSectInfo(war.challenger_sect_id);
    const defenderSect = guildWarService.getSectInfo(war.defender_sect_id);

    const challengerHpBar = getProgressBar(war.challenger_hp, Math.max(war.challenger_hp, war.defender_hp, 100), 12);
    const defenderHpBar = getProgressBar(war.defender_hp, Math.max(war.challenger_hp, war.defender_hp, 100), 12);

    const participants = guildWarService.getParticipants(war.id);
    const challengerParticipants = participants.filter(p => p.side === 'challenger');
    const defenderParticipants = participants.filter(p => p.side === 'defender');

    let statusText = '';
    let color: any = '#3498db';

    if (war.status === 'pending') {
      statusText = `⏳ **Chờ phản hồi từ ${defenderSect?.name}...**\n\nTông Chủ phe phòng thủ hãy dùng:\n\`/guildwar chapnhan\` hoặc \`/guildwar tuchoi\``;
      color = '#f39c12';
    } else if (war.status === 'active') {
      const turnOrder: string[] = JSON.parse(war.turn_order || '[]');
      const currentTurnUserId = turnOrder[war.current_turn_index];
      const currentUser = currentTurnUserId ? userRepository.get(currentTurnUserId) : null;

      statusText = `⚔️ **ĐANG CHIẾN ĐẤU**\n\n` +
        `**${challengerSect?.name}**\n${challengerHpBar} (${war.challenger_hp}❤️)\n` +
        `**${defenderSect?.name}**\n${defenderHpBar} (${war.defender_hp}❤️)\n\n` +
        `Hiệp: **${war.current_round}/${war.max_rounds}**\n` +
        `Đến lượt: **${currentUser?.name || 'Không xác định'}**\n` +
        `_Dùng \`/guildwar tancong\` để tấn công!_\n` +
        `_Dùng \`/guildwar thamgia\` để gia nhập chiến trường!_`;
      color = '#e74c3c';
    } else if (war.status === 'completed') {
      const winnerSect = guildWarService.getSectInfo(war.winner_sect_id);
      const loserName = war.winner_sect_id === war.challenger_sect_id ? defenderSect?.name : challengerSect?.name;
      statusText = `🏆 **CHIẾN TRANH KẾT THÚC!**\n\n` +
        `**${winnerSect?.name}** đã chiến thắng trước **${loserName}**!\n` +
        `Tỷ số: **${challengerSect?.name}** ${war.challenger_hp}❤️ - **${defenderSect?.name}** ${war.defender_hp}❤️`;
      color = '#2ecc71';
    } else {
      statusText = '❌ **Chiến tranh đã bị hủy bỏ hoặc kết thúc.**';
      color = '#7f8c8d';
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ CHIẾN TRANH TÔNG MÔN: ${challengerSect?.name} vs ${defenderSect?.name}`)
      .setColor(color)
      .setDescription(statusText)
      .addFields(
        {
          name: '👥 Phe Tấn Công',
          value: challengerParticipants.length > 0
            ? challengerParticipants.map(p => {
                const u = userRepository.get(p.user_id);
                return `• **${u?.name || 'Không xác định'}** - ST: ${p.damage_dealt}`;
              }).join('\n')
            : '*Chưa có thành viên*',
          inline: true
        },
        {
          name: '👥 Phe Phòng Thủ',
          value: defenderParticipants.length > 0
            ? defenderParticipants.map(p => {
                const u = userRepository.get(p.user_id);
                return `• **${u?.name || 'Không xác định'}** - ST: ${p.damage_dealt}`;
              }).join('\n')
            : '*Chưa có thành viên*',
          inline: true
        }
      )
      .setFooter({ text: war.status === 'active' ? `Mã chiến: ${war.id}` : 'Chiến tranh đã kết thúc' })
      .setTimestamp();

    return embed;
  }
}
