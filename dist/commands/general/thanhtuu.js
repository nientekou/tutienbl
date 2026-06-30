"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAchievementCategoryEmbed = getAchievementCategoryEmbed;
exports.getAchievementCategoryComponents = getAchievementCategoryComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const AchievementService_1 = require("../../services/AchievementService");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
const ITEMS_PER_PAGE = 5;
function getAchievementCategoryEmbed(userId, category, page) {
    const userAchievements = AchievementService_1.achievementService.getUserAchievements(userId).filter(a => a.category === category);
    const totalPages = Math.max(Math.ceil(userAchievements.length / ITEMS_PER_PAGE), 1);
    const cappedPage = Math.min(Math.max(page, 1), totalPages);
    const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
    const pageItems = userAchievements.slice(offset, offset + ITEMS_PER_PAGE);
    const completedCount = userAchievements.filter(a => a.is_completed).length;
    const catInfo = CATEGORY_LABELS[category];
    const content = [
        (0, v2Components_1.header)(`🏆 THÀNH TỰU TU SĨ — ${catInfo?.emoji} ${catInfo?.name}`, `📊 Tiến độ: **${completedCount}/${userAchievements.length}** thành tựu\n*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`)
    ];
    for (const a of pageItems) {
        const status = a.is_completed
            ? '✅ **HOÀN THÀNH**'
            : `📊 ${(0, constants_1.getProgressBar)(a.progress, a.target_value, 8)} (${a.progress}/${a.target_value})`;
        const titleBonus = a.reward_title ? `\n• 🏅 Danh hiệu: **${a.reward_title}**` : '';
        const rewardText = [];
        if (a.reward_exp > 0)
            rewardText.push(`+${a.reward_exp} Tu Vi`);
        if (a.reward_coins > 0)
            rewardText.push(`+${a.reward_coins} LT`);
        const rewardStr = rewardText.length > 0 ? ` │ Thưởng: ${rewardText.join(', ')}` : '';
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`${a.icon} **${a.name}**\n` +
            `└ *${a.description}*\n` +
            `└ Trạng thái: ${status}${rewardStr}${titleBonus}`));
    }
    if (userAchievements.length > ITEMS_PER_PAGE) {
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`*Trang ${cappedPage}/${totalPages} (${userAchievements.length} thành tựu)*`));
    }
    const user = UserRepository_1.userRepository.get(userId);
    content.push((0, v2Components_1.separator)());
    content.push((0, v2Components_1.body)(`*Danh hiệu hiện tại: **${user?.title || 'Tán Tu'}** • Dùng /thanhtuu danhhieu để thay đổi.*`));
    const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
    return { embed, totalPages };
}
function getAchievementCategoryComponents(userId, category, page, totalPages) {
    if (totalPages <= 1)
        return [];
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder().setCustomId(`achprev_${category.replace(/_/g, '.')}_${page}_${userId}`).setEmoji('◀').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page <= 1), new discord_js_1.ButtonBuilder().setCustomId(`achnext_${category.replace(/_/g, '.')}_${page}_${userId}`).setEmoji('▶').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page >= totalPages));
    return [row];
}
const CATEGORY_LABELS = {
    'tu_luyen': { name: 'Tu Luyện', emoji: '🧘' },
    'chien_dau': { name: 'Chiến Đấu', emoji: '⚔️' },
    'pvp': { name: 'PvP', emoji: '🏆' },
    'sung_thu': { name: 'Sủng Thú', emoji: '🐾' },
    'sinh_hoat': { name: 'Sinh Hoạt', emoji: '🌾' }
};
class ThanhTuuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('thanhtuu')
            .setDescription('Hệ thống thành tựu - Theo dõi và nhận thưởng thành tựu.')
            .addSubcommand(sub => sub.setName('xem')
            .setDescription('Xem danh sách thành tựu theo danh mục.')
            .addStringOption(opt => opt.setName('danh_muc').setDescription('Danh mục thành tựu').setRequired(false)
            .addChoices({ name: '🧘 Tu Luyện', value: 'tu_luyen' }, { name: '⚔️ Chiến Đấu', value: 'chien_dau' }, { name: '🏆 PvP', value: 'pvp' }, { name: '🐾 Sủng Thú', value: 'sung_thu' }, { name: '🌾 Sinh Hoạt', value: 'sinh_hoat' })))
            .addSubcommand(sub => sub.setName('danhsach')
            .setDescription('Xem tổng quan tất cả thành tựu đã đạt được.'))
            .addSubcommand(sub => sub.setName('danhhieu')
            .setDescription('Xem danh sách danh hiệu đã mở khóa.'))
            .addSubcommand(sub => sub.setName('fix')
            .setDescription('Kiểm tra và fix thành tựu bị kẹt (đủ điều kiện nhưng chưa hoàn thành).')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        AchievementService_1.achievementService.recalculateYCanhAchievement(userId);
        if (sub === 'xem') {
            await this.handleXem(interaction, userId);
        }
        else if (sub === 'danhsach') {
            await this.handleDanhSach(interaction, userId);
        }
        else if (sub === 'danhhieu') {
            await this.handleDanhHieu(interaction, userId);
        }
        else if (sub === 'fix') {
            await this.handleFix(interaction, userId);
        }
    }
    async handleXem(interaction, userId) {
        const category = interaction.options.getString('danh_muc') || undefined;
        let userAchievements;
        if (category) {
            userAchievements = AchievementService_1.achievementService.getUserAchievements(userId).filter(a => a.category === category);
        }
        else {
            userAchievements = AchievementService_1.achievementService.getUserAchievements(userId);
        }
        const totalAchievements = userAchievements.length;
        const completedCount = userAchievements.filter(a => a.is_completed).length;
        if (category) {
            const { embed: categoryEmbed, totalPages } = getAchievementCategoryEmbed(userId, category, 1);
            const components = getAchievementCategoryComponents(userId, category, 1, totalPages);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([categoryEmbed], components));
            return;
        }
        const content = [
            (0, v2Components_1.header)('🏆 THÀNH TỰU TU SĨ', `📊 Tiến độ tổng: **${completedCount}/${totalAchievements}** thành tựu\n*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`)
        ];
        const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'];
        for (const cat of categories) {
            const catAchievements = userAchievements.filter(a => a.category === cat);
            const catCompleted = catAchievements.filter(a => a.is_completed).length;
            if (catAchievements.length > 0) {
                const catInfo = CATEGORY_LABELS[cat];
                content.push((0, v2Components_1.separator)());
                content.push((0, v2Components_1.body)(`${catInfo.emoji} **${catInfo.name}** (${catCompleted}/${catAchievements.length})\n${this.buildCategoryProgress(catAchievements)}`));
            }
        }
        const user = UserRepository_1.userRepository.get(userId);
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`*Danh hiệu hiện tại: **${user?.title || 'Tán Tu'}** • Dùng /thanhtuu danhhieu để thay đổi.*`));
        const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
    async handleDanhSach(interaction, userId) {
        const achievements = AchievementService_1.achievementService.getUserAchievements(userId);
        const completed = achievements.filter(a => a.is_completed);
        const total = achievements.length;
        const content = [
            (0, v2Components_1.header)('🏆 TỔNG QUAN THÀNH TỰU', `**${interaction.user.username}** — Tu sĩ đạo hiệu: **${UserRepository_1.userRepository.get(userId)?.name || '?'}**\n📊 Tiến độ tổng: **${completed.length}/${total}** (${Math.round((completed.length / total) * 100)}%)`)
        ];
        const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'];
        let statsText = '';
        for (const cat of categories) {
            const catAchievements = achievements.filter(a => a.category === cat);
            const catCompleted = catAchievements.filter(a => a.is_completed).length;
            const catInfo = CATEGORY_LABELS[cat];
            statsText += `${catInfo.emoji} **${catInfo.name}**: ${catCompleted}/${catAchievements.length}\n`;
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`📈 **Thống kê phân loại:**\n${statsText}`));
        const recentCompleted = completed
            .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
            .slice(0, 5);
        if (recentCompleted.length > 0) {
            let recentText = '';
            for (const rc of recentCompleted) {
                const date = rc.completed_at ? new Date(rc.completed_at * 1000).toLocaleDateString('vi-VN') : '?';
                recentText += `${rc.icon} **${rc.name}** — *${date}*\n`;
            }
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`🆕 **Thành tựu đạt được gần đây:**\n${recentText}`));
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`*Mẹo: Dùng /thanhtuu xem để xem chi tiết từng danh mục.*`));
        const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
    async handleDanhHieu(interaction, userId) {
        const user = UserRepository_1.userRepository.get(userId);
        const titles = AchievementService_1.achievementService.getUserTitles(userId);
        const allAchievements = AchievementService_1.achievementService.getUserAchievements(userId);
        const lockedTitles = allAchievements
            .filter(a => !a.is_completed && a.reward_title)
            .map(a => a.reward_title);
        const content = [
            (0, v2Components_1.header)(`🏅 DANH HIỆU TU SĨ — ${user.name}`, `**Danh hiệu đang sử dụng:** **${user.title || 'Tán Tu'}**\n📚 Đã mở khóa: **${titles.length}** danh hiệu`)
        ];
        content.push((0, v2Components_1.separator)());
        if (titles.length > 0) {
            let unlockedText = '';
            for (const t of titles) {
                const date = new Date(t.unlocked_at * 1000).toLocaleDateString('vi-VN');
                const isActive = t.title === user.title ? ' ⭐ **(ĐANG DÙNG)**' : '';
                unlockedText += `• **${t.title}**${isActive} (${date})\n`;
            }
            content.push((0, v2Components_1.body)(`✅ **Đã mở khóa:**\n${unlockedText}`));
        }
        else {
            content.push((0, v2Components_1.body)('✅ **Đã mở khóa:**\n*Chưa có danh hiệu nào. Hoàn thành thành tựu để nhận danh hiệu!*'));
        }
        if (lockedTitles.length > 0) {
            let lockedText = '';
            for (const lt of lockedTitles.slice(0, 8)) {
                lockedText += `• 🔒 **${lt}**\n`;
            }
            if (lockedTitles.length > 8) {
                lockedText += `*...và ${lockedTitles.length - 8} danh hiệu khác*`;
            }
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`🔒 **Chưa mở khóa:**\n${lockedText}`));
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`*Nhấn nút bên dưới để chuyển đổi sử dụng danh hiệu.*`));
        const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
        const components = [];
        if (titles.length > 0) {
            const rows = [];
            let currentRow = new discord_js_1.ActionRowBuilder();
            for (let i = 0; i < Math.min(titles.length, 25); i++) {
                const t = titles[i];
                const isActive = t.title === user.title;
                const btn = new discord_js_1.ButtonBuilder()
                    .setCustomId(`titleswitch_${t.title.replace(/\s/g, '_')}`)
                    .setLabel(isActive ? `⭐ ${t.title}` : t.title)
                    .setStyle(isActive ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary);
                currentRow.addComponents(btn);
                if (currentRow.components.length === 5) {
                    rows.push(currentRow);
                    currentRow = new discord_js_1.ActionRowBuilder();
                }
            }
            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }
            components.push(...rows);
        }
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
    }
    async handleFix(interaction, userId) {
        const fixed = AchievementService_1.achievementService.fixStuckAchievements(userId);
        if (fixed.length === 0) {
            await interaction.editReply({ content: '✅ Không có thành tựu nào bị kẹt. Tất cả thành tựu đều đã được cập nhật đúng!' });
            return;
        }
        let msg = `🔧 **ĐÃ FIX ${fixed.length} THÀNH TỰU:**\n\n`;
        for (const a of fixed) {
            const rewardDetails = [];
            if (a.reward_exp > 0)
                rewardDetails.push(`+${a.reward_exp} Tu Vi`);
            if (a.reward_coins > 0)
                rewardDetails.push(`+${a.reward_coins} LT`);
            if (a.reward_title)
                rewardDetails.push(`Danh hiệu: ${a.reward_title}`);
            msg += `${a.icon} **${a.name}** — ${rewardDetails.length > 0 ? rewardDetails.join(', ') : 'Đã hoàn thành'}\n`;
        }
        await interaction.editReply({ content: msg });
    }
    buildCategoryProgress(achievements) {
        const completed = achievements.filter(a => a.is_completed).length;
        const total = achievements.length;
        const barSize = 12;
        const filled = Math.round((completed / total) * barSize);
        const bar = '█'.repeat(filled) + '░'.repeat(barSize - filled);
        return `\`[${bar}]\` ${completed}/${total}`;
    }
}
exports.default = ThanhTuuCommand;
