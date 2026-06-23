"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileInteractionHandler = void 0;
const discord_js_1 = require("discord.js");
const hoso_1 = require("../../commands/general/hoso");
const LeaderboardService_1 = require("../../services/LeaderboardService");
const uiSystem_1 = require("../../utils/uiSystem");
class ProfileInteractionHandler {
    static async handle(interaction, action, parts, targetUserId) {
        if (action === 'hosotab') {
            const tabName = parts[1];
            const embed = (0, hoso_1.getHoSoTabEmbed)(targetUserId, tabName);
            const components = (0, hoso_1.getHoSoAllComponents)(targetUserId, tabName);
            await interaction.update((0, uiSystem_1.toLegacyUpdate)([embed], components, interaction));
            return;
        }
        // Nút quay lại hồ sơ từ các menu khác (như tẩy tủy, lôi kiếp)
        if (action === 'hosoback') {
            const embed = (0, hoso_1.getHoSoTabEmbed)(targetUserId, 'chiso');
            const components = (0, hoso_1.getHoSoAllComponents)(targetUserId, 'chiso');
            await interaction.update((0, uiSystem_1.toLegacyUpdate)([embed], components, interaction));
            return;
        }
        // Nút chuyển danh mục Bảng Phong Thần
        if (action === 'hosolb') {
            const lbType = parts[1]; // combatPower, realm, wealth, sectContribution
            const embed = getLeaderboardEmbed(targetUserId, lbType);
            const components = (0, hoso_1.getHoSoAllComponents)(targetUserId, 'bangxephang');
            await interaction.update((0, uiSystem_1.toLegacyUpdate)([embed], components, interaction));
            return;
        }
    }
}
exports.ProfileInteractionHandler = ProfileInteractionHandler;
function getLeaderboardEmbed(userId, subType) {
    const LABELS = {
        combatPower: { name: 'Lực Chiến', emoji: '⚔️' },
        realm: { name: 'Cảnh Giới', emoji: '🌀' },
        wealth: { name: 'Tài Sản', emoji: '🪙' },
        sectContribution: { name: 'Cống Hiến Tông Môn', emoji: '🏛️' },
    };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('👑 Bảng Phong Thần')
        .setColor(uiSystem_1.EMBED_COLORS.GOLD)
        .setTimestamp();
    const typeMap = {
        combatPower: (l) => LeaderboardService_1.leaderboardService.getTopCombatPower(l || 15),
        realm: (l) => LeaderboardService_1.leaderboardService.getTopRealm(l || 15),
        wealth: (l) => LeaderboardService_1.leaderboardService.getTopWealth(l || 15),
        sectContribution: (l) => LeaderboardService_1.leaderboardService.getTopSectContribution(l || 15),
    };
    const getData = typeMap[subType];
    if (!getData)
        return embed.setDescription('❌ Danh mục không hợp lệ.');
    const info = LABELS[subType];
    const entries = getData();
    const userRank = LeaderboardService_1.leaderboardService.getUserRank(subType, userId);
    const prefix = ['🥇', '🥈', '🥉'];
    const lines = entries.map((e, i) => {
        const medal = i < 3 ? `${prefix[i]} ` : `#${e.rank}. `;
        const isYou = e.userId === userId ? ' **← Bạn**' : '';
        const extra = e.extra ? ` *(${e.extra})*` : '';
        return `${medal}**${e.name}**${isYou} — **${e.displayValue}**${extra}`;
    });
    embed.setDescription(`**${info.emoji} ${info.name}** *(cập nhật mỗi 5 phút)*\n\n${lines.join('\n')}`);
    if (userRank) {
        embed.setFooter({ text: `📍 Hạng của bạn: #${userRank.rank} / ${userRank.total}` });
    }
    else {
        embed.setFooter({ text: '📍 Đạo hữu chưa có dữ liệu trong bảng xếp hạng này.' });
    }
    return embed;
}
