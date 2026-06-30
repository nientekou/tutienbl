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
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
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
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi', 'Đạo hữu chưa khởi tạo nhân vật.')
        ]);
    }
    const quests = DailyQuestService_1.dailyQuestService.getOrAssignQuests(userId);
    const resetSecs = DailyQuestService_1.dailyQuestService.getSecondsToReset();
    const resetHours = Math.floor(resetSecs / 3600);
    const resetMins = Math.floor((resetSecs % 3600) / 60);
    const completedCount = quests.filter(q => q.progress >= q.required).length;
    const claimedCount = quests.filter(q => q.is_claimed === 1).length;
    const content = [
        (0, v2Components_1.header)('📜 THIÊN CƠ CÁC — NHIỆM VỤ HÀNG NGÀY', `🎖️ Đã hoàn thành: **${completedCount}/3** │ ✅ Đã nhận thưởng: **${claimedCount}/3**\n⏰ Reset sau: **${resetHours}h ${resetMins}p**`)
    ];
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
                ? '🎁 **HOÀN THÀNH — Nhấp nhận thưởng bên dưới!**'
                : `⏳ Tiến trình: ${progressBar} (${quest.progress}/${quest.required})`;
        const rewardText = `🟤 ${def.rewardCoin} Linh Thạch │ 🌿 ${def.rewardTuVi} Tu Vi │ 🧘 ${def.rewardNgotinh} Ngộ Tính`;
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`🔹 **${def.emoji} ${def.name}** ${CATEGORY_EMOJI[def.category] || ''}\n` +
            `└ *${def.description}*\n` +
            `└ ${statusText}\n` +
            `└ 💰 Phần thưởng: ${rewardText}`));
    }
    const communityData = CommunityQuestService_1.communityQuestService.getActiveQuestWithParticipant(userId);
    if (communityData.quest) {
        const q = communityData.quest;
        const progressBar = (0, constants_1.getProgressBar)(q.current_progress, q.total_required);
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`🌍 **NHIỆM VỤ CỘNG ĐỒNG: ${q.name}**\n` +
            `└ *${q.description}*\n` +
            `└ Tiến trình: ${progressBar} (${q.current_progress}/${q.total_required})\n` +
            `└ Đóng góp của bạn: **${communityData.contribution}**\n` +
            `└ Hạn chót: <t:${q.ends_at}:R>\n` +
            `└ 💰 Phần thưởng: 🟤 ${q.reward_coins} Linh Thạch │ 🌿 ${q.reward_exp} Tu Vi`));
    }
    content.push((0, v2Components_1.separator)());
    content.push((0, v2Components_1.body)(`*Tiến trình tự động cập nhật khi đạo hữu thực hiện các hoạt động tương ứng.*`));
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, content);
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
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('❌ Lỗi', 'Đạo hữu chưa khởi tạo nhân vật.')
        ]);
    }
    const progressData = QuestChainService_1.questChainService.getDetailedProgress(userId);
    const availableChains = QuestChainService_1.questChainService.getAvailableChains(userId);
    if (progressData.length === 0 && availableChains.length === 0) {
        return (0, v2Components_1.container)(v2Components_1.V2_COLORS.warning, [
            (0, v2Components_1.header)('⚔️ NHIỆM VỤ CHUỖI — TU TIÊN LỘ', 'Những thử thách tu tiên trải dài theo từng bước.'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)('🎉 *Đạo hữu đã hoàn thành tất cả chuỗi nhiệm vụ hiện có!*')
        ]);
    }
    const content = [
        (0, v2Components_1.header)('⚔️ NHIỆM VỤ CHUỖI — TU TIÊN LỘ', 'Những thử thách tu tiên trải dài theo từng bước. Hoàn thành tất cả bước trong một chuỗi để nhận phần thưởng cuối cùng!')
    ];
    for (const chain of QuestChainService_1.QUEST_CHAINS) {
        const progress = progressData.find(p => p.chain_id === chain.id);
        const isCompleted = progress?.completed === 1;
        const isStarted = !!progress;
        content.push((0, v2Components_1.separator)());
        if (isCompleted) {
            content.push((0, v2Components_1.body)(`✅ **${chain.name}**\n` +
                `└ *${chain.description}*\n` +
                `└ 🏁 **Đã hoàn thành!**`));
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
        content.push((0, v2Components_1.body)(`${isStarted ? '⏳' : '📋'} **${chain.name}**\n` +
            `└ *${chain.description}*\n` +
            `${stepLines}\n` +
            `└ 🎁 Thưởng cuối: 🟤 ${chain.finalRewardCoins} Linh Thạch │ 🌿 ${chain.finalRewardExp} Tu Vi${chain.finalRewardTitle ? ` │ 🏅 Danh hiệu: ${chain.finalRewardTitle}` : ''}`));
    }
    return (0, v2Components_1.container)(v2Components_1.V2_COLORS.warning, content);
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
            .addSubcommand(sub => sub.setName('hang-ngay')
            .setDescription('Xem nhiệm vụ hàng ngày từ Thiên Cơ Các.'))
            .addSubcommand(sub => sub.setName('chuong-trinh')
            .setDescription('Xem tiến trình nhiệm vụ chuỗi (Quest Chain).')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand === 'chuong-trinh') {
            const embed = getQuestChainEmbed(userId);
            const rows = getQuestChainComponents(userId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], rows));
        }
        else {
            const embed = getNhiemVuEmbed(userId);
            const rows = getNhiemVuComponents(userId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], rows));
        }
    }
}
exports.default = NhiemVuCommand;
