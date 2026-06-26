"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const SecretRealmService_1 = require("../../services/SecretRealmService");
const uiSystem_1 = require("../../utils/uiSystem");
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
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
            return;
        }
        const canEnter = SecretRealmService_1.secretRealmService.canEnter(userId);
        const config = SecretRealmService_1.secretRealmService.getConfig();
        const entries = SecretRealmService_1.secretRealmService.getEntriesThisWeek(userId);
        let desc = `🌀 **Bí Cảnh Song Hành** — ${config.name}\n`;
        desc += `${config.description}\n\n`;
        desc += `🎫 Lượt: **${entries}/${config.maxEntries}**/tuần\n`;
        desc += `💰 Phí: **${config.entryCost}** Thể Lực\n\n`;
        if (!canEnter.eligible) {
            desc += `❌ ${canEnter.reason}`;
        }
        else {
            desc += `Cần partner online. Thưởng đồng bộ:\n`;
            desc += `• Cùng hệ: +15% sát thương\n`;
            desc += `• Khắc hệ: +25% sát thương\n`;
            desc += `• Đạo lữ: +10% toàn chỉ số\n`;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🌀 Bí Cảnh Song Hành')
            .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
            .setDescription(desc)
            .setTimestamp();
        if (canEnter.eligible) {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`bicanhsonghanh_enter_${userId}`)
                .setLabel('Vào Bí Cảnh')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('🌀'));
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
        else {
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = BiKinhSongHanhCommand;
