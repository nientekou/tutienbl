"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const NewbieProtectionService_1 = require("../../services/NewbieProtectionService");
class SuDoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('sudo')
            .setDescription('Hệ thống Sư Đồ — kết đôi sư phụ-đồ đệ.')
            .addSubcommand(sub => sub.setName('nhan')
            .setDescription('Nhận đồ đệ.')
            .addUserOption(opt => opt.setName('student')
            .setDescription('Người chơi cần bảo hộ')
            .setRequired(true)))
            .addSubcommand(sub => sub.setName('thongtin')
            .setDescription('Xem thông tin sư đồ của bạn.'))
            .addSubcommand(sub => sub.setName('doan')
            .setDescription('Đoạn tuyệt sư đồ (đồ đệ tự hủy).'))
            .addSubcommand(sub => sub.setName('danhsach')
            .setDescription('Xem danh sách đồ đệ của bạn.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'nhan') {
            const target = interaction.options.getUser('student', true);
            const result = NewbieProtectionService_1.newbieProtectionService.registerMentor(target.id, userId);
            await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: !result.success });
        }
        else if (sub === 'thongtin') {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📜 THÔNG TIN SƯ ĐỒ')
                .setColor('#3498db')
                .setTimestamp();
            const protectionDays = NewbieProtectionService_1.newbieProtectionService.getRemainingProtectionDays(userId);
            let statusText = '';
            if (protectionDays > 0) {
                statusText = `🛡️ **Đang bảo hộ** (còn **${protectionDays} ngày**)\n✨ Hưởng **x2 EXP** và **không thể bị tấn công** bởi người chơi khác.`;
            }
            else if (protectionDays === -1) {
                statusText = `🛡️ **Bảo hộ theo cấp** (đến khi đạt level 10)\n✨ Hưởng **x2 EXP**.`;
            }
            else {
                statusText = `⚔️ **Đã hết bảo hộ** — tự do tham gia PvP.`;
            }
            embed.setDescription(statusText);
            const mentorInfo = NewbieProtectionService_1.newbieProtectionService.getMentorInfo(userId);
            if (mentorInfo) {
                const mentor = UserRepository_1.userRepository.get(mentorInfo.mentorId);
                embed.addFields({
                    name: '👨‍🏫 Sư Phụ',
                    value: mentor ? `**${mentor.name}** (Cấp ${mentor.level})` : `<@${mentorInfo.mentorId}>`,
                    inline: true,
                });
            }
            const students = NewbieProtectionService_1.newbieProtectionService.getStudents(userId);
            if (students.length > 0) {
                const studentList = students.map(s => {
                    const u = UserRepository_1.userRepository.get(s.studentId);
                    return `• ${u ? `**${u.name}** (Cấp ${u.level})` : `<@${s.studentId}>`} — <t:${s.startedAt}:R>`;
                }).join('\n');
                embed.addFields({
                    name: `👨‍🎓 Đồ Đệ (${students.length}/3)`,
                    value: studentList,
                });
            }
            await interaction.reply({ embeds: [embed] });
        }
        else if (sub === 'doan') {
            const result = NewbieProtectionService_1.newbieProtectionService.removeMentor(userId);
            await interaction.reply({ content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: !result.success });
        }
        else if (sub === 'danhsach') {
            const students = NewbieProtectionService_1.newbieProtectionService.getStudents(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('👨‍🎓 DANH SÁCH ĐỒ ĐỆ')
                .setColor('#2ecc71')
                .setTimestamp();
            if (students.length === 0) {
                embed.setDescription('*Đạo hữu chưa nhận đồ đệ nào. Dùng `/sudo nhan [user]` để nhận đồ đệ!*');
            }
            else {
                const list = students.map(s => {
                    const u = UserRepository_1.userRepository.get(s.studentId);
                    return `• ${u ? `**${u.name}** (Cấp ${u.level})` : `<@${s.studentId}>`} — Kết duyên: <t:${s.startedAt}:R>`;
                }).join('\n');
                embed.setDescription(list);
            }
            await interaction.reply({ embeds: [embed] });
        }
    }
}
exports.default = SuDoCommand;
