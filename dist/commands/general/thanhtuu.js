"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const AchievementService_1 = require("../../services/AchievementService");
const constants_1 = require("../../utils/constants");
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
            .setDescription('Xem danh sách danh hiệu đã mở khóa.')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'xem') {
            await this.handleXem(interaction, userId);
        }
        else if (sub === 'danhsach') {
            await this.handleDanhSach(interaction, userId);
        }
        else if (sub === 'danhhieu') {
            await this.handleDanhHieu(interaction, userId);
        }
    }
    /**
     * Xem thành tựu theo danh mục (hoặc tất cả)
     */
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
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏆 THÀNH TỰU TU SĨ' + (category ? ` - ${CATEGORY_LABELS[category]?.emoji} ${CATEGORY_LABELS[category]?.name}` : ''))
            .setColor('#f1c40f')
            .setDescription([
            `📊 **Tiến độ:** ${completedCount}/${totalAchievements} thành tựu`,
            `*Hoàn thành thành tựu để nhận danh hiệu đặc biệt, EXP và Linh Thạch!*`,
        ].join('\n'))
            .setTimestamp();
        // Nhóm theo category nếu xem tất cả
        if (!category) {
            const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'];
            for (const cat of categories) {
                const catAchievements = userAchievements.filter(a => a.category === cat);
                const catCompleted = catAchievements.filter(a => a.is_completed).length;
                if (catAchievements.length > 0) {
                    const catInfo = CATEGORY_LABELS[cat];
                    embed.addFields({
                        name: `${catInfo.emoji} ${catInfo.name} (${catCompleted}/${catAchievements.length})`,
                        value: this.buildCategoryProgress(catAchievements),
                        inline: false
                    });
                }
            }
        }
        else {
            // Hiển thị chi tiết từng thành tựu trong danh mục
            for (const a of userAchievements) {
                const status = a.is_completed
                    ? '✅ **HOÀN THÀNH**'
                    : `📊 ${(0, constants_1.getProgressBar)(a.progress, a.target_value, 8)} (${a.progress}/${a.target_value})`;
                const titleBonus = a.reward_title ? `\n🏅 Danh hiệu: **${a.reward_title}**` : '';
                const rewardText = [];
                if (a.reward_exp > 0)
                    rewardText.push(`+${a.reward_exp} Tu Vi`);
                if (a.reward_coins > 0)
                    rewardText.push(`+${a.reward_coins} LT`);
                const rewardStr = rewardText.length > 0 ? ` • *Thưởng: ${rewardText.join(', ')}*` : '';
                embed.addFields({
                    name: `${a.icon} **${a.name}** — ${status}`,
                    value: `📖 ${a.description}${titleBonus}${rewardStr}`,
                    inline: false
                });
            }
            // Nếu danh mục có nhiều thành tựu, thêm dòng thông báo
            if (userAchievements.length > 12) {
                embed.setDescription(embed.data.description + `\n\n*Hiển thị toàn bộ ${userAchievements.length} thành tựu trong danh mục.*`);
            }
        }
        embed.setFooter({ text: `Danh hiệu hiện tại: ${UserRepository_1.userRepository.get(userId)?.title || 'Tán Tu'} | Dùng /thanhtuu danhhieu để xem tất cả danh hiệu.` });
        await interaction.reply({ embeds: [embed] });
    }
    /**
     * Xem tổng quan tất cả thành tựu
     */
    async handleDanhSach(interaction, userId) {
        const achievements = AchievementService_1.achievementService.getUserAchievements(userId);
        const completed = achievements.filter(a => a.is_completed);
        const total = achievements.length;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏆 TỔNG QUAN THÀNH TỰU')
            .setColor('#f1c40f')
            .setDescription([
            `**${interaction.user.username}** — Tu sĩ đạo hiệu: **${UserRepository_1.userRepository.get(userId)?.name || '?'}**`,
            ``,
            `📊 **Tiến độ**: ${completed.length}/${total} (${Math.round((completed.length / total) * 100)}%)`,
            ``,
        ].join('\n'))
            .setTimestamp();
        // Thống kê theo danh mục
        const categories = ['tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat'];
        let statsText = '';
        for (const cat of categories) {
            const catAchievements = achievements.filter(a => a.category === cat);
            const catCompleted = catAchievements.filter(a => a.is_completed).length;
            const catInfo = CATEGORY_LABELS[cat];
            statsText += `${catInfo.emoji} **${catInfo.name}**: ${catCompleted}/${catAchievements.length}\n`;
        }
        embed.addFields({ name: '📈 Thống kê', value: statsText, inline: false });
        // Thành tựu gần đây
        const recentCompleted = completed
            .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
            .slice(0, 5);
        if (recentCompleted.length > 0) {
            let recentText = '';
            for (const rc of recentCompleted) {
                const date = rc.completed_at ? new Date(rc.completed_at * 1000).toLocaleDateString('vi-VN') : '?';
                recentText += `${rc.icon} **${rc.name}** — ${date}\n`;
            }
            embed.addFields({ name: '🆕 Gần đây nhất', value: recentText, inline: false });
        }
        embed.setFooter({ text: 'Dùng /thanhtuu xem để xem chi tiết từng danh mục.' });
        await interaction.reply({ embeds: [embed] });
    }
    /**
     * Xem danh hiệu đã mở khóa
     */
    async handleDanhHieu(interaction, userId) {
        const user = UserRepository_1.userRepository.get(userId);
        const titles = AchievementService_1.achievementService.getUserTitles(userId);
        const allAchievements = AchievementService_1.achievementService.getUserAchievements(userId);
        const lockedTitles = allAchievements
            .filter(a => !a.is_completed && a.reward_title)
            .map(a => a.reward_title);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🏅 DANH HIỆU - ${user.name}`)
            .setColor('#e67e22')
            .setDescription([
            `**Danh hiệu đang sử dụng:** **${user.title}**`,
            ``,
            `📚 Đã mở khóa: **${titles.length}** danh hiệu`,
        ].join('\n'))
            .setTimestamp();
        if (titles.length > 0) {
            let unlockedText = '';
            for (const t of titles) {
                const date = new Date(t.unlocked_at * 1000).toLocaleDateString('vi-VN');
                const isActive = t.title === user.title ? ' ⭐ **(ĐANG DÙNG)**' : '';
                unlockedText += `• **${t.title}**${isActive} (${date})\n`;
            }
            embed.addFields({ name: '✅ Đã mở khóa', value: unlockedText, inline: false });
        }
        else {
            embed.addFields({ name: '✅ Đã mở khóa', value: '*Chưa có danh hiệu nào. Hoàn thành thành tựu để nhận danh hiệu!*' });
        }
        if (lockedTitles.length > 0) {
            let lockedText = '';
            for (const lt of lockedTitles.slice(0, 8)) {
                lockedText += `• 🔒 **${lt}**\n`;
            }
            if (lockedTitles.length > 8) {
                lockedText += `*...và ${lockedTitles.length - 8} danh hiệu khác*`;
            }
            embed.addFields({ name: '🔒 Chưa mở khóa', value: lockedText, inline: false });
        }
        embed.setFooter({ text: 'Hoàn thành thêm thành tựu để mở khóa danh hiệu mới!' });
        await interaction.reply({ embeds: [embed] });
    }
    /**
     * Xây dựng thanh tiến trình cho danh mục
     */
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
