"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BountyBoardService_1 = require("../../services/BountyBoardService");
const uiSystem_1 = require("../../utils/uiSystem");
class BangNghiaVuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('bangnghiavu')
            .setDescription('Bảng Nghĩa Vụ — Chọn 3 trong 6 nhiệm vụ hàng ngày'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
            return;
        }
        const cards = BountyBoardService_1.bountyBoardService.getTodayCards(userId, user.level);
        const isCompleted = BountyBoardService_1.bountyBoardService.isCompletedToday(userId);
        const streak = BountyBoardService_1.bountyBoardService.getStreak(userId);
        const tierEmoji = { common: '⚪', elite: '🟢', legendary: '🟡' };
        let desc = `📋 **Bảng Nghĩa Vụ** — Chọn 3 nhiệm vụ\n`;
        desc += `🔥 Streak: ${streak}/5 ngày${streak >= 5 ? ' (Guaranteed Legendary!)' : ''}\n`;
        desc += isCompleted ? `✅ Đã hoàn thành hôm nay` : `⏳ Chưa hoàn thành\n\n`;
        if (!isCompleted) {
            desc += '**Chọn 3 nhiệm vụ:**\n';
            for (let i = 0; i < cards.length; i++) {
                const c = cards[i];
                desc += `${tierEmoji[c.tier]} **${c.name}** — ${c.description}\n`;
                desc += `  📊 ${c.requirement}: 0/${c.target} | 🎁 ${c.rewardExp} EXP, ${c.rewardCoins} LT`;
                if (c.rewardKnb > 0)
                    desc += `, ${c.rewardKnb} KNB`;
                desc += '\n';
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 Bảng Nghĩa Vụ')
            .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
            .setDescription(desc)
            .setTimestamp();
        if (!isCompleted) {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`bangnghiavu_claim_${userId}`)
                .setLabel('Hoàn Thành Hôm Nay')
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setEmoji('✅'));
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
        else {
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = BangNghiaVuCommand;
