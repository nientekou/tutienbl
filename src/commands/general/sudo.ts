import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { newbieProtectionService, MentorInfo } from '../../services/NewbieProtectionService';
import { formatNumber } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class SuDoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sudo')
        .setDescription('Hệ thống Sư Đồ — kết đôi sư phụ-đồ đệ.')
        .addSubcommand(sub =>
          sub.setName('nhan')
            .setDescription('Nhận đồ đệ.')
            .addUserOption(opt =>
              opt.setName('student')
                .setDescription('Người chơi cần bảo hộ')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('thongtin')
            .setDescription('Xem thông tin sư đồ của bạn.')
        )
        .addSubcommand(sub =>
          sub.setName('doan')
            .setDescription('Đoạn tuyệt sư đồ (đồ đệ tự hủy).')
        )
        .addSubcommand(sub =>
          sub.setName('danhsach')
            .setDescription('Xem danh sách đồ đệ của bạn.')
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

    if (sub === 'nhan') {
      const target = interaction.options.getUser('student', true);
      const result = newbieProtectionService.registerMentor(target.id, userId);
      await interaction.editReply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}` });
    } else if (sub === 'thongtin') {
      const embed = new EmbedBuilder()
        .setTitle('📜 THÔNG TIN SƯ ĐỒ')
        .setColor(EMBED_COLORS.INFO)
        .setTimestamp();

      const protectionDays = newbieProtectionService.getRemainingProtectionDays(userId);
      let statusText = '';
      if (protectionDays > 0) {
        statusText = `🛡️ **Đang bảo hộ** (còn **${protectionDays} ngày**)\n✨ Hưởng **x2 EXP** và **không thể bị tấn công** bởi người chơi khác.`;
      } else if (protectionDays === -1) {
        statusText = `🛡️ **Bảo hộ theo cấp** (đến khi đạt level 10)\n✨ Hưởng **x2 EXP**.`;
      } else {
        statusText = `⚔️ **Đã hết bảo hộ** — tự do tham gia PvP.`;
      }

      embed.setDescription(statusText);

      const mentorInfo = newbieProtectionService.getMentorInfo(userId);
      if (mentorInfo) {
        const mentor = userRepository.get(mentorInfo.mentorId);
        embed.addFields({
          name: '👨‍🏫 Sư Phụ',
          value: mentor ? `**${mentor.name}** (Cấp ${mentor.level})` : `<@${mentorInfo.mentorId}>`,
          inline: true,
        });
      }

      const students = newbieProtectionService.getStudents(userId);
      if (students.length > 0) {
        const studentList = students.map(s => {
          const u = userRepository.get(s.studentId);
          return `• ${u ? `**${u.name}** (Cấp ${u.level})` : `<@${s.studentId}>`} — <t:${s.startedAt}:R>`;
        }).join('\n');
        embed.addFields({
          name: `👨‍🎓 Đồ Đệ (${students.length}/3)`,
          value: studentList,
        });
      }

      await interaction.editReply(toV2Payload([embed]));
    } else if (sub === 'doan') {
      const result = newbieProtectionService.removeMentor(userId);
      await interaction.editReply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}` });
    } else if (sub === 'danhsach') {
      const students = newbieProtectionService.getStudents(userId);

      const embed = new EmbedBuilder()
        .setTitle('👨‍🎓 DANH SÁCH ĐỒ ĐỆ')
        .setColor(EMBED_COLORS.SUCCESS)
        .setTimestamp();

      if (students.length === 0) {
        embed.setDescription('*Đạo hữu chưa nhận đồ đệ nào. Dùng `/sudo nhan [user]` để nhận đồ đệ!*');
      } else {
        const list = students.map(s => {
          const u = userRepository.get(s.studentId);
          return `• ${u ? `**${u.name}** (Cấp ${u.level})` : `<@${s.studentId}>`} — Kết duyên: <t:${s.startedAt}:R>`;
        }).join('\n');
        embed.setDescription(list);
      }

      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
