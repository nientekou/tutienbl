"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const MinigameService_1 = require("../../services/MinigameService");
class QuyetAuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('quyetau')
            .setDescription('Khiêu chiến người chơi khác quyết đấu kéo búa bao (oẳn tù tì) đặt cược Linh Thạch.')
            .addUserOption(option => option
            .setName('tuser')
            .setDescription('Tu sĩ đạo hữu muốn khiêu chiến.')
            .setRequired(true))
            .addIntegerOption(option => option
            .setName('cuoc')
            .setDescription('Số lượng Hạ Phẩm Linh Thạch muốn đặt cược.')
            .setRequired(true)));
    }
    async execute(client, interaction) {
        const targetUser = interaction.options.getUser('tuser', true);
        const wager = interaction.options.getInteger('cuoc', true);
        const challengerId = interaction.user.id;
        const result = MinigameService_1.minigameService.createChallenge(challengerId, targetUser.id, wager);
        if (!result.success || !result.duel) {
            await interaction.reply({
                content: `❌ **Khiêu chiến thất bại:** ${result.message}`,
                ephemeral: true
            });
            return;
        }
        const duel = result.duel;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('⚔️ THƯ KHIÊU CHIẾN QUYẾT ĐẤU LINH THẠCH ⚔️')
            .setColor('#e74c3c')
            .setDescription(`Đạo hữu <@${challengerId}> gửi thư khiêu chiến quyết đấu đấu pháp kéo búa bao đến <@${targetUser.id}>!\n\n` +
            `🪙 **Linh Thạch Đặt Cược:** **${wager}** Hạ Phẩm Linh Thạch 🟤 từ mỗi bên.\n` +
            `⚖️ **Thuế Khấu Trừ:** **5%** phí giao dịch (thu thuế tông môn từ người thắng).\n\n` +
            `🔮 **Quy luật khắc chế ngũ hành:**\n` +
            `• ⚔️ **Kiếm Pháp** chém rách 📜 **Phù Pháp**\n` +
            `• 📜 **Phù Pháp** phong ấn 🛡️ **Hộ Thể**\n` +
            `• 🛡️ **Hộ Thể** chống đỡ ⚔️ **Kiếm Pháp**\n\n` +
            `⏳ **Thời gian ứng chiến:** **60 giây** để chấp nhận khiêu chiến.`)
            .setFooter({ text: 'Hãy cân nhắc thực lực và túi tiền trước khi ứng chiến!' })
            .setTimestamp();
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`duelaccept_${duel.id}`)
            .setLabel('⚔️ Chấp Nhận Ứng Chiến')
            .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
            .setCustomId(`duelrefuse_${duel.id}`)
            .setLabel('❌ Khước Từ Khiêu Chiến')
            .setStyle(discord_js_1.ButtonStyle.Danger));
        await interaction.reply({
            content: `<@${targetUser.id}>, đạo hữu nhận được một lời khiêu chiến quyết đấu!`,
            embeds: [embed],
            components: [row]
        });
    }
}
exports.default = QuyetAuCommand;
