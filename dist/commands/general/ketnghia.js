"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BrotherhoodService_1 = require("../../services/BrotherhoodService");
class KetNghiaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('ketnghia')
            .setDescription('Hệ thống Kết Nghĩa huynh đệ - Đồng tâm hiệp lực!')
            .addSubcommand(sub => sub
            .setName('moi')
            .setDescription('Gửi lời mời kết nghĩa đến một đạo hữu.')
            .addUserOption(opt => opt
            .setName('nguoidung')
            .setDescription('Người chơi muốn kết nghĩa')
            .setRequired(true)))
            .addSubcommand(sub => sub
            .setName('chapnhan')
            .setDescription('Chấp nhận lời mời kết nghĩa.'))
            .addSubcommand(sub => sub
            .setName('tuche')
            .setDescription('Từ chối lời mời kết nghĩa.'))
            .addSubcommand(sub => sub
            .setName('huy')
            .setDescription('Hủy bỏ kết nghĩa hiện tại.'))
            .addSubcommand(sub => sub
            .setName('thongtin')
            .setDescription('Xem thông tin kết nghĩa.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'moi') {
            const targetUser = interaction.options.getUser('nguoidung', true);
            const targetId = targetUser.id;
            const result = BrotherhoodService_1.brotherhoodService.sendInvite(userId, targetId);
            if (result.success) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🌸 Kết Nghĩa - Lời Mời')
                    .setColor(0x9b59b6)
                    .setDescription(`${interaction.user.username} gửi lời kết nghĩa đến **${targetUser.username}**!\n\n${result.message}`)
                    .setFooter({ text: 'Hãy dùng /ketnghia chapnhan để chấp nhận.' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
            return;
        }
        if (sub === 'chapnhan') {
            const invite = BrotherhoodService_1.brotherhoodService.getPendingInvite(userId);
            if (!invite) {
                await interaction.editReply({ content: '❌ Không có lời mời kết nghĩa nào đang chờ!' });
                return;
            }
            const fromUser = await client.users.fetch(invite.fromUserId).catch(() => null);
            const result = BrotherhoodService_1.brotherhoodService.acceptInvite(userId);
            if (result.success) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🎉 Kết Nghĩa Thành Công!')
                    .setColor(0xf1c40f)
                    .setDescription(result.message)
                    .setFooter({ text: 'Huynh đệ đồng tâm, vạn sự hưng long!' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
            return;
        }
        if (sub === 'tuche') {
            const result = BrotherhoodService_1.brotherhoodService.rejectInvite(userId);
            if (result.success) {
                await interaction.editReply({ content: `✅ ${result.message}` });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
            return;
        }
        if (sub === 'huy') {
            const result = BrotherhoodService_1.brotherhoodService.breakBrotherhood(userId);
            if (result.success) {
                await interaction.editReply({ content: result.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
            return;
        }
        if (sub === 'thongtin') {
            const bh = BrotherhoodService_1.brotherhoodService.getBrotherhood(userId);
            if (!bh) {
                await interaction.editReply({ content: '❌ Đạo hữu chưa kết nghĩa với ai!' });
                return;
            }
            const partnerId = bh.user1_id === userId ? bh.user2_id : bh.user1_id;
            const partnerUser = await client.users.fetch(partnerId).catch(() => null);
            const partnerName = partnerUser ? partnerUser.username : 'Không rõ';
            const partner = UserRepository_1.userRepository.get(partnerId);
            const formedAt = new Date(bh.formed_at);
            const daysSince = Math.floor((Date.now() - bh.formed_at) / 86400000);
            const expBonus = BrotherhoodService_1.brotherhoodService.getSharedExpBonus(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤝 Tình Huynh Đệ')
                .setColor(0x9b59b6)
                .setDescription(`**${user.name}** và **${partnerName}** đã kết nghĩa huynh đệ!`)
                .addFields({
                name: 'Đối Tác Kết Nghĩa',
                value: `👤 **${partnerName}**${partner ? ` (Cấp ${partner.level})` : ''}`,
                inline: true
            }, {
                name: 'Ngày Kết Nghĩa',
                value: `<t:${Math.floor(bh.formed_at / 1000)}:R>`,
                inline: true
            }, {
                name: 'Đã Kết Nghĩa',
                value: `📅 ${daysSince} ngày`,
                inline: true
            }, {
                name: 'Hiệu Ứng Đặc Biệt',
                value: `• **Chia Sẻ Kinh Nghiệm:** +${(expBonus * 100).toFixed(0)}% EXP khi đi chung\n• **Tấn Công Tổ Đội:** +3% ATK khi cùng tổ đội`
            })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
    }
}
exports.default = KetNghiaCommand;
