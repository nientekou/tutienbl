"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LABELS = void 0;
exports.buildLeaderboardEmbed = buildLeaderboardEmbed;
exports.buildLeaderboardComponents = buildLeaderboardComponents;
exports.buildLeaderboardMessage = buildLeaderboardMessage;
exports.buildLeaderboardUpdate = buildLeaderboardUpdate;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const LeaderboardService_1 = require("../../services/LeaderboardService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
exports.LABELS = {
    combatPower: {
        name: 'Lực Chiến',
        emoji: '⚔️',
        color: 0xFF4500, // Orange Red
        description: 'Xếp hạng những tu sĩ có Lực Chiến cao nhất toàn server.'
    },
    realm: {
        name: 'Cảnh Giới',
        emoji: '🌀',
        color: 0x8A2BE2, // Blue Violet
        description: 'Xếp hạng cảnh giới tu vi của các tu sĩ.'
    },
    wealth: {
        name: 'Tài Sản',
        emoji: '🪙',
        color: 0xFFD700, // Gold
        description: 'Xếp hạng tu sĩ giàu có nhất dựa trên tổng Linh Thạch quy đổi.'
    },
    sectContribution: {
        name: 'Cống Hiến Tông Môn',
        emoji: '🏛️',
        color: 0x00CED1, // Dark Turquoise
        description: 'Xếp hạng những đệ tử có đóng góp cống hiến lớn nhất cho Tông Môn.'
    },
    arena: {
        name: 'Đấu Trường PvP',
        emoji: '⚔️',
        color: 0xDC143C, // Crimson
        description: 'Xếp hạng tu sĩ có điểm ELO Đấu Trường cao nhất.'
    },
    alchemy: {
        name: 'Luyện Đan Thuật',
        emoji: '🧪',
        color: 0x2ECC71, // Emerald Green
        description: 'Xếp hạng các Đại Sư Luyện Đan có cấp độ cao nhất.'
    },
    forging: {
        name: 'Luyện Khí Thuật',
        emoji: '⚒️',
        color: 0x3498DB, // Steel Blue
        description: 'Xếp hạng các Thần Binh Đại Sư có cấp độ cao nhất.'
    }
};
function buildLeaderboardEmbed(userId, category, page) {
    const typeMap = {
        combatPower: (l) => LeaderboardService_1.leaderboardService.getTopCombatPower(l || 100),
        realm: (l) => LeaderboardService_1.leaderboardService.getTopRealm(l || 100),
        wealth: (l) => LeaderboardService_1.leaderboardService.getTopWealth(l || 100),
        sectContribution: (l) => LeaderboardService_1.leaderboardService.getTopSectContribution(l || 100),
        arena: (l) => LeaderboardService_1.leaderboardService.getTopArena(l || 100),
        alchemy: (l) => LeaderboardService_1.leaderboardService.getTopAlchemy(l || 100),
        forging: (l) => LeaderboardService_1.leaderboardService.getTopForging(l || 100),
    };
    const getData = typeMap[category];
    const info = exports.LABELS[category];
    if (!getData || !info) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('👑 Bảng Phong Thần', '❌ Danh mục không hợp lệ.')
        ]);
    }
    const entries = getData();
    const userRank = LeaderboardService_1.leaderboardService.getUserRank(category, userId);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageEntries = entries.slice(startIndex, startIndex + pageSize);
    const lines = pageEntries.map((e) => {
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `**#${e.rank}**`;
        const isYou = e.userId === userId ? ' **(Bạn)**' : '';
        const extraLine = e.extra ? `\n└─ *${e.extra}*` : '';
        return `${medal} **${e.name}**${isYou} — **${e.displayValue}**${extraLine}`;
    });
    let footerText = '';
    if (userRank) {
        footerText = `📍 Hạng của bạn: #${userRank.rank} / ${userRank.total} │ Trang ${currentPage}/${totalPages}`;
    }
    else {
        footerText = `📍 Đạo hữu chưa có dữ liệu trong bảng này │ Trang ${currentPage}/${totalPages}`;
    }
    return (0, v2Components_1.container)(info.color, [
        (0, v2Components_1.header)(`👑 Bảng Phong Thần — ${info.name}`, `${info.emoji} ${info.description}\n*(Cập nhật mỗi 5 phút)*`),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(lines.length > 0 ? lines.join('\n\n') : '*Hiện chưa có tu sĩ nào lọt vào bảng xếp hạng này.*'),
        (0, v2Components_1.separator)(),
        (0, v2Components_1.body)(`*${footerText}*`)
    ]);
}
function buildLeaderboardComponents(userId, category, page, totalEntries) {
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    // Row 1: Dropdown chọn danh mục
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`bptselect_${userId}`)
        .setPlaceholder('Chọn danh mục bảng xếp hạng...')
        .addOptions(Object.entries(exports.LABELS).map(([key, info]) => new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel(`${info.emoji} ${info.name}`)
        .setValue(key)
        .setDefault(key === category)));
    const rowDropdown = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
    // Row 2: Nút phân trang
    const btnPrev = new discord_js_1.ButtonBuilder()
        .setCustomId(`bpt_${category}_${currentPage - 1}_${userId}`)
        .setLabel('◀️ Trang trước')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(currentPage === 1);
    const btnRefresh = new discord_js_1.ButtonBuilder()
        .setCustomId(`bpt_${category}_${currentPage}_${userId}`)
        .setLabel('🔄 Làm mới')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const btnNext = new discord_js_1.ButtonBuilder()
        .setCustomId(`bpt_${category}_${currentPage + 1}_${userId}`)
        .setLabel('▶️ Trang sau')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages);
    const rowButtons = new discord_js_1.ActionRowBuilder().addComponents(btnPrev, btnRefresh, btnNext);
    return [rowDropdown, rowButtons];
}
function buildLeaderboardMessage(userId, category, page) {
    const embed = buildLeaderboardEmbed(userId, category, page);
    const typeMap = {
        combatPower: (l) => LeaderboardService_1.leaderboardService.getTopCombatPower(l || 100),
        realm: (l) => LeaderboardService_1.leaderboardService.getTopRealm(l || 100),
        wealth: (l) => LeaderboardService_1.leaderboardService.getTopWealth(l || 100),
        sectContribution: (l) => LeaderboardService_1.leaderboardService.getTopSectContribution(l || 100),
        arena: (l) => LeaderboardService_1.leaderboardService.getTopArena(l || 100),
        alchemy: (l) => LeaderboardService_1.leaderboardService.getTopAlchemy(l || 100),
        forging: (l) => LeaderboardService_1.leaderboardService.getTopForging(l || 100),
    };
    const entries = typeMap[category]?.() || [];
    const components = buildLeaderboardComponents(userId, category, page, entries.length);
    return { embeds: [embed], components };
}
function buildLeaderboardUpdate(userId, category, page) {
    const msg = buildLeaderboardMessage(userId, category, page);
    return (0, uiSystem_1.toV2Update)(msg.embeds, msg.components);
}
class BangPhongThanCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('bangphongthan')
            .setDescription('👑 Bảng xếp hạng — Lực Chiến, Cảnh Giới, Tài Sản, Tông Môn, Đấu Trường, Luyện Đan, Luyện Khí')
            .addStringOption(option => option
            .setName('danhmuc')
            .setDescription('Chọn danh mục xếp hạng')
            .setRequired(false)
            .addChoices({ name: '⚔️ Lực Chiến', value: 'combatPower' }, { name: '🌀 Cảnh Giới', value: 'realm' }, { name: '🪙 Tài Sản', value: 'wealth' }, { name: '🏛️ Cống Hiến Tông Môn', value: 'sectContribution' }, { name: '⚔️ Đấu Trường PvP', value: 'arena' }, { name: '🧪 Luyện Đan Thuật', value: 'alchemy' }, { name: '⚒️ Luyện Khí Thuật', value: 'forging' })));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật! Hãy dùng `/taonhanvat` trước.' });
            return;
        }
        const subType = interaction.options.getString('danhmuc') || 'combatPower';
        const msg = buildLeaderboardMessage(userId, subType, 1);
        await interaction.editReply((0, uiSystem_1.toV2Payload)(msg.embeds, msg.components));
    }
}
exports.default = BangPhongThanCommand;
