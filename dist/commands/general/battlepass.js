"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const BattlePassService_1 = require("../../services/BattlePassService");
const v2Components_1 = require("../../utils/v2Components");
const battlePassConstants_1 = require("../../config/battlePassConstants");
class BattlePassCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('battlepass')
            .setDescription('Battle Pass - Nhận phần thưởng theo tier')
            .addSubcommand(sub => sub.setName('trangthai').setDescription('Xem trạng thái Battle Pass'))
            .addSubcommand(sub => sub.setName('phanthuong').setDescription('Xem và nhận phần thưởng'))
            .addSubcommand(sub => sub.setName('bangxephang').setDescription('Bảng xếp hạng Battle Pass')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'trangthai') {
            const profile = BattlePassService_1.battlePassService.getOrCreateProfile(userId);
            const progress = Math.round((profile.exp / 100) * 100);
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [
                (0, v2Components_1.header)('🏆 Battle Pass'),
                (0, v2Components_1.body)(`**Season ${BattlePassService_1.battlePassService.getCurrentSeason()}**\n\nTier: **${profile.tier}/${battlePassConstants_1.BP_MAX_TIER}**\nEXP: ${profile.exp}/100\nTrang bị Premium: ${profile.premium_purchased ? '✅' : '❌'}`)
            ]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'phanthuong') {
            const profile = BattlePassService_1.battlePassService.getOrCreateProfile(userId);
            const claimed = JSON.parse(profile.claimed_rewards || '[]');
            let desc = '';
            const row = new discord_js_1.ActionRowBuilder();
            let buttonCount = 0;
            for (const reward of battlePassConstants_1.BP_REWARDS) {
                const canClaim = profile.tier >= reward.tier && !claimed.includes(reward.tier);
                const isClaimed = claimed.includes(reward.tier);
                desc += `**Tier ${reward.tier}**: ${isClaimed ? '✅' : canClaim ? '🎁' : '🔒'}\n`;
                if (canClaim && buttonCount < 5) {
                    row.addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`bp_claim_${reward.tier}_${userId}`)
                        .setLabel(`T${reward.tier}`)
                        .setStyle(discord_js_1.ButtonStyle.Success));
                    buttonCount++;
                }
            }
            const comps = [(0, v2Components_1.header)('🎁 Phần Thưởng Battle Pass'), (0, v2Components_1.body)(desc)];
            const components = buttonCount > 0 ? [(0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, comps), row] : [(0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, comps)];
            await interaction.editReply({ components, flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'bangxephang') {
            const lb = BattlePassService_1.battlePassService.getLeaderboard(10);
            let desc;
            if (lb.length === 0) {
                desc = 'Chưa có dữ liệu.';
            }
            else {
                desc = '';
                lb.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    desc += `${medal} **${p.ten_nhan_vat}** — Tier ${p.tier}\n`;
                });
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [(0, v2Components_1.header)('🏆 BXH Battle Pass'), (0, v2Components_1.body)(desc)]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
    }
}
exports.default = BattlePassCommand;
