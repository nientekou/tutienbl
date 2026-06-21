"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNhiemVuEmbed = getNhiemVuEmbed;
exports.getNhiemVuComponents = getNhiemVuComponents;
exports.getQuestChainEmbed = getQuestChainEmbed;
exports.getQuestChainComponents = getQuestChainComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const QuestChainService_1 = require("../../services/QuestChainService");
const CommunityQuestService_1 = require("../../services/CommunityQuestService");
const constants_1 = require("../../utils/constants");
const CATEGORY_EMOJI = {
    combat: '⚔️',
    life: '🌿',
    social: '☯️',
    special: '⭐'
};
/**
 * Tạo Embed nhiệm vụ hàng ngày
 */
function getNhiemVuEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder().setTitle('❌ Lỗi').setColor('#e74c3c').setDescription('Nhân vật không tồn tại.');
    }
    const quests = DailyQuestService_1.dailyQuestService.getOrAssignQuests(userId);
    const resetSecs = DailyQuestService_1.dailyQuestService.getSecondsToReset();
    const resetHours = Math.floor(resetSecs / 3600);
    const resetMins = Math.floor((resetSecs % 3600) / 60);
    const completedCount = quests.filter(q => q.progress >= q.required).length;
    const claimedCount = quests.filter(q => q.is_claimed === 1).length;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📜 THIÊN CƠ CÁC - NHIỆM VỤ HÀNG NGÀY')
        .setColor('#9b59b6')
        .setDescription(`Tu sĩ tu hành chân chính không chỉ tịnh tọa trong động phủ. Thiên Cơ Các mỗi ngày giao phó 3 nhiệm vụ cho các đạo hữu trong thiên hạ.\n\n` +
        `🎖️ **Đã hoàn thành:** ${completedCount}/3 | ✅ **Đã nhận thưởng:** ${claimedCount}/3\n` +
        `⏰ **Nhiệm vụ reset sau:** ${resetHours}h ${resetMins}p`)
        .setTimestamp();
    for (const quest of quests) {
        const def = quest.definition;
        if (!def)
            continue;
        const isComplete = quest.progress >= quest.required;
        const isClaimed = quest.is_claimed === 1;
        const progressBar = (0, constants_1.getProgressBar)(quest.progress, quest.required);
        const statusText = isClaimed
            ? '✅ **ĐÃ NHẬN THƯỞNG**'
            : isComplete
                ? '🎁 **HOÀN THÀNH - Nhấn Nhận Thưởng!**'
                : `⏳ Tiến trình: ${progressBar} (${quest.progress}/${quest.required})`;
        const rewardText = `🟤 ${def.rewardCoin} Linh Thạch | 🌿 ${def.rewardTuVi} Tu Vi | 🧘 ${def.rewardNgotinh} Ngộ Tính`;
        embed.addFields({
            name: `${def.emoji} ${def.name} ${CATEGORY_EMOJI[def.category] || ''}`,
            value: `${def.description}\n${statusText}\n💰 **Phần thưởng:** ${rewardText}`,
            inline: false
        });
    }
    const communityData = CommunityQuestService_1.communityQuestService.getActiveQuestWithParticipant(userId);
    if (communityData.quest) {
        const q = communityData.quest;
        const progressBar = (0, constants_1.getProgressBar)(q.current_progress, q.total_required);
        embed.addFields({
            name: `🌍 **NHIỆM VỤ CỘNG ĐỒNG: ${q.name}**`,
            value: `📖 ${q.description}\n${progressBar} (${q.current_progress}/${q.total_required})\n👤 **Đóng góp của bạn:** ${communityData.contribution}\n⏳ Còn lại: <t:${q.ends_at}:R>\n💰 Thưởng: 🟤 ${q.reward_coins} Linh Thạch | 🌿 ${q.reward_exp} Tu Vi`,
            inline: false
        });
    }
    embed.setFooter({ text: 'Tiến trình tự động cập nhật khi đạo hữu thực hiện các hoạt động tương ứng.' });
    return embed;
}
/**
 * Tạo Components nhiệm vụ hàng ngày
 */
function getNhiemVuComponents(userId) {
    const quests = DailyQuestService_1.dailyQuestService.getOrAssignQuests(userId);
    const rows = [];
    const claimRow = new discord_js_1.ActionRowBuilder();
    let hasClaimable = false;
    for (const quest of quests) {
        const def = quest.definition;
        if (!def)
            continue;
        const isComplete = quest.progress >= quest.required;
        const isClaimed = quest.is_claimed === 1;
        if (!isClaimed) {
            claimRow.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`nhiemvuclaim_${quest.quest_id}_${userId}`)
                .setLabel(`${def.emoji} Nhận: ${def.name.substring(0, 20)}`)
                .setStyle(isComplete ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
                .setDisabled(!isComplete));
            hasClaimable = true;
        }
    }
    if (hasClaimable)
        rows.push(claimRow);
    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(backRow);
    return rows;
}
function getQuestChainEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder().setTitle('❌ Lỗi').setColor('#e74c3c').setDescription('Nhân vật không tồn tại.');
    }
    const progressData = QuestChainService_1.questChainService.getDetailedProgress(userId);
    const availableChains = QuestChainService_1.questChainService.getAvailableChains(userId);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('⚔️ NHIỆM VỤ CHUỖI - TU TIÊN LỘ')
        .setColor('#f39c12')
        .setDescription('Những thử thách tu tiên trải dài theo từng bước. Hoàn thành tất cả bước trong một chuỗi để nhận phần thưởng cuối cùng!')
        .setTimestamp();
    if (progressData.length === 0 && availableChains.length === 0) {
        embed.setDescription('🎉 Bạn đã hoàn thành tất cả chuỗi nhiệm vụ hiện có!');
        return embed;
    }
    for (const chain of QuestChainService_1.QUEST_CHAINS) {
        const progress = progressData.find(p => p.chain_id === chain.id);
        const isCompleted = progress?.completed === 1;
        const isStarted = !!progress;
        if (isCompleted) {
            embed.addFields({
                name: `✅ ${chain.name}`,
                value: `📖 ${chain.description}\n🏁 **Đã hoàn thành!**`,
                inline: false
            });
            continue;
        }
        const stepIndex = progress?.step_index ?? 0;
        const currentStep = chain.steps[stepIndex];
        let stepLines = chain.steps.map((step, i) => {
            if (i < stepIndex)
                return `   ✅ **${step.name}** - Đã hoàn thành`;
            if (i === stepIndex) {
                if (!isStarted)
                    return `   ⏳ **${step.name}** - ${step.description}`;
                const stepProgress = progress ? progress.progress : 0;
                const bar = (0, constants_1.getProgressBar)(stepProgress, step.objectiveTarget);
                return `   ▶️ **${step.name}** - ${bar} (${stepProgress}/${step.objectiveTarget})`;
            }
            return `   🔒 **${step.name}** - ${step.description}`;
        }).join('\n');
        embed.addFields({
            name: `${isStarted ? '⏳' : '📋'} ${chain.name}`,
            value: `📖 ${chain.description}\n${stepLines}\n🎁 Thưởng cuối: 🟤 ${chain.finalRewardCoins} Linh Thạch | 🌿 ${chain.finalRewardExp} Tu Vi${chain.finalRewardTitle ? ` | 🏅 Danh hiệu: ${chain.finalRewardTitle}` : ''}`,
            inline: false
        });
    }
    return embed;
}
function getQuestChainComponents(userId) {
    const progressData = QuestChainService_1.questChainService.getDetailedProgress(userId);
    const rows = [];
    const activeProgress = progressData.find(p => p.completed === 0);
    if (activeProgress) {
        const chain = QuestChainService_1.QUEST_CHAINS.find(c => c.id === activeProgress.chain_id);
        if (chain) {
            const step = chain.steps[activeProgress.step_index];
            if (step && activeProgress.progress >= step.objectiveTarget) {
                const claimRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`chainclaim_${activeProgress.chain_id}_${userId}`)
                    .setLabel(`🎁 Nhận Thưởng: ${step.name}`)
                    .setStyle(discord_js_1.ButtonStyle.Success));
                rows.push(claimRow);
            }
        }
    }
    for (const chain of QuestChainService_1.QUEST_CHAINS) {
        const prog = progressData.find(p => p.chain_id === chain.id);
        if (!prog || prog.completed) {
            if (!prog) {
                const startRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`chainstart_${chain.id}_${userId}`)
                    .setLabel(`▶️ Bắt đầu: ${chain.name}`)
                    .setStyle(discord_js_1.ButtonStyle.Primary));
                rows.push(startRow);
            }
        }
    }
    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(backRow);
    return rows;
}
class NhiemVuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('nhiemvu')
            .setDescription('Xem nhiệm vụ, nhiệm vụ chuỗi và nhiệm vụ cộng đồng.')
            .addSubcommand(sub => sub.setName('hàng-ngày')
            .setDescription('Xem nhiệm vụ hàng ngày từ Thiên Cơ Các.'))
            .addSubcommand(sub => sub.setName('chuong-trinh')
            .setDescription('Xem tiến trình nhiệm vụ chuỗi (Quest Chain).')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand === 'chuong-trinh') {
            const embed = getQuestChainEmbed(userId);
            const rows = getQuestChainComponents(userId);
            await interaction.reply({ embeds: [embed], components: rows });
        }
        else {
            const embed = getNhiemVuEmbed(userId);
            const rows = getNhiemVuComponents(userId);
            await interaction.reply({ embeds: [embed], components: rows });
        }
    }
}
exports.default = NhiemVuCommand;
