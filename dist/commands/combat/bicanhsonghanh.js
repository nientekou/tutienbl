"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const SecretRealmService_1 = require("../../services/SecretRealmService");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
class BiKinhSongHanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('bicanhsonghanh')
            .setDescription('Bí Cảnh Song Hành — Phó bản hợp tác 2 người'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.' });
            return;
        }
        const canEnter = SecretRealmService_1.secretRealmService.canEnter(userId);
        const config = SecretRealmService_1.secretRealmService.getConfig();
        const entries = SecretRealmService_1.secretRealmService.getEntriesThisWeek(userId);
        const descContent = [
            `🎫 Lượt tuần này: **${entries}/${config.maxEntries}**`,
            `💰 Phí tổn: **${config.entryCost}** Thể Lực`
        ];
        if (!canEnter.eligible) {
            descContent.push(`\n❌ **Điều kiện chưa đạt:** ${canEnter.reason}`);
        }
        else {
            descContent.push(`\n👥 **Thưởng Đồng Bộ Hợp Tác:**\n` +
                `• 🔥 Cùng hệ: **+15%** sát thương\n` +
                `• ⚡ Khắc hệ: **+25%** sát thương\n` +
                `• 💖 Đạo lữ: **+10%** toàn bộ chỉ số`);
        }
        const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
            (0, v2Components_1.header)(`🌀 Bí Cảnh Song Hành — ${config.name}`, config.description),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(descContent.join('\n'))
        ]);
        if (canEnter.eligible) {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`bicanhsonghanh_enter_${userId}`)
                .setLabel('Vào Bí Cảnh')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('🌀'));
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
        else {
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = BiKinhSongHanhCommand;
