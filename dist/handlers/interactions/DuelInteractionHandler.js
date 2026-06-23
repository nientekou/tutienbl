"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuelInteractionHandler = void 0;
const discord_js_1 = require("discord.js");
const MinigameService_1 = require("../../services/MinigameService");
const PvPService_1 = require("../../services/PvPService");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const QuestChainService_1 = require("../../services/QuestChainService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const itemConstants_1 = require("../../config/itemConstants");
const uiSystem_1 = require("../../utils/uiSystem");
class DuelInteractionHandler {
    static async handle(interaction, action, parts) {
        if (action === 'duelaccept') {
            const duelId = parts[1];
            const res = MinigameService_1.minigameService.acceptChallenge(duelId, interaction.user.id);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const duel = res.duel;
            const hpBar = (current, max) => {
                const filled = Math.round((current / max) * 10);
                return '🟩'.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, 10 - filled));
            };
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('⚔️ TAM HỒI LINH CHIẾN — ĐÃ KHAI TRẬN')
                .setColor(uiSystem_1.EMBED_COLORS.INFO)
                .setDescription(`Đạo hữu <@${duel.targetId}> đã chấp nhận lời khiêu chiến **Tam Hồi Linh Chiến** của <@${duel.challengerId}>!\n\n` +
                `🪙 **Hũ Cược:** **${duel.wager * 2}** Hạ Phẩm Linh Thạch (mỗi bên cược **${duel.wager}**).\n` +
                `🌀 **Hiệp ${duel.currentRound}/${duel.maxRounds}** — Hãy chọn chiêu thức!\n\n` +
                `📊 **Linh Lực Khởi Đầu:**\n` +
                `<@${duel.challengerId}>: ${hpBar(duel.challengerHp, duel.challengerMaxHp)} **${duel.challengerHp}/${duel.challengerMaxHp}** HP\n` +
                `<@${duel.targetId}>: ${hpBar(duel.targetHp, duel.targetMaxHp)} **${duel.targetHp}/${duel.targetMaxHp}** HP\n\n` +
                `⚔️ **Chọn chiêu thức hiệp này:**\n` +
                `${'─'.repeat(25)}\n` +
                `⚔️ **Xuất Kiếm** — Tấn công mãnh liệt\n` +
                `🛡️ **Phòng Thủ** — Giảm sát thương, hồi HP\n` +
                `🔮 **Linh Pháp** — Công kích ngũ hành (dựa Linh Căn)\n` +
                `💫 **Tụ Khí** — Hồi HP, tích Chiến Ý (+25% dmg)\n` +
                `🔥 **Tuyệt Kỹ** — Bộc phát 100% kỹ năng môn phái\n` +
                `💊 **Vật Phẩm** — Dùng đan dược, bùa chú\n`)
                .setFooter({ text: 'Cả hai đều chọn xong sẽ tự động phân giải chiêu thức!' })
                .setTimestamp();
            const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_xuất_kiếm`).setLabel('⚔️ Xuất Kiếm').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_phòng_thủ`).setLabel('🛡️ Phòng Thủ').setStyle(discord_js_1.ButtonStyle.Primary));
            const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_linh_pháp`).setLabel('🔮 Linh Pháp').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tụ_khí`).setLabel('💫 Tụ Khí').setStyle(discord_js_1.ButtonStyle.Secondary));
            const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tuyệt_kỹ`).setLabel('🔥 Tuyệt Kỹ').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_dùng_vật_phẩm`).setLabel('💊 Dùng Vật Phẩm').setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
            return;
        }
        if (action === 'duelrefuse') {
            const duelId = parts[1];
            const res = MinigameService_1.minigameService.refuseChallenge(duelId, interaction.user.id);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('❌ QUYẾT ĐẤU BỊ KHƯỚC TỪ')
                .setColor(uiSystem_1.EMBED_COLORS.NEUTRAL)
                .setDescription(`Đạo hữu <@${interaction.user.id}> đã khước từ lời khiêu chiến quyết đấu của <@${res.duel.challengerId}>.`)
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
            return;
        }
        if (action === 'duelchoose' || action === 'dueluseitem') {
            const duelId = parts[1];
            let choiceRaw = '';
            if (action === 'dueluseitem' && interaction.isStringSelectMenu()) {
                const itemId = interaction.values[0];
                choiceRaw = `dùng_vật_phẩm_${itemId}`;
            }
            else {
                choiceRaw = parts.slice(2).join('_');
            }
            const actionMeta = {
                xuất_kiếm: { emoji: '⚔️', name: 'Xuất Kiếm' },
                phòng_thủ: { emoji: '🛡️', name: 'Phòng Thủ' },
                linh_pháp: { emoji: '🔮', name: 'Linh Pháp' },
                tụ_khí: { emoji: '💫', name: 'Tụ Khí' },
                tuyệt_kỹ: { emoji: '🔥', name: 'Tuyệt Kỹ' },
                dùng_vật_phẩm: { emoji: '💊', name: 'Vật Phẩm' }
            };
            if (choiceRaw === 'dùng_vật_phẩm') {
                const invItems = InventoryRepository_1.inventoryRepository.getUserInventory(interaction.user.id);
                const combatPills = invItems.filter(i => i.type === 'pill' &&
                    [itemConstants_1.ITEMS.PILL_HP_1, itemConstants_1.ITEMS.PILL_HP_2, itemConstants_1.ITEMS.PILL_TU_VI_LOW].includes(i.item_id));
                if (combatPills.length === 0) {
                    await interaction.reply({ content: '❌ Đạo hữu không có Đan Dược nào có thể dùng trong chiến đấu! (Cần Hồi Huyết Đan hoặc Tụ Khí Đan)', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`dueluseitem_${duelId}`)
                    .setPlaceholder('Chọn một đan dược để sử dụng...');
                for (const pill of combatPills) {
                    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`${pill.name} (SL: ${pill.quantity})`)
                        .setDescription(pill.description ? pill.description.substring(0, 50) : 'Không có mô tả')
                        .setValue(pill.id.toString()));
                }
                const rowSelect = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                await interaction.reply({
                    content: '💊 **Chọn Đan Dược để sử dụng trong hiệp này:**\n*(Sử dụng đan dược sẽ tiêu hao 1 lượt ra chiêu của đạo hữu)*',
                    components: [rowSelect],
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
                return;
            }
            const hpBar = (current, max) => {
                const filled = Math.round((current / max) * 10);
                return '🟩'.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, 10 - filled));
            };
            const res = MinigameService_1.minigameService.chooseMove(duelId, interaction.user.id, choiceRaw);
            if (!res.success) {
                await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const duel = res.duel;
            if (duel.status === 'completed') {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⚔️ TAM HỒI LINH CHIẾN — KẾT THÚC')
                    .setTimestamp();
                const logsText = duel.roundLogs.slice(-3).join('\n\n');
                if (res.isTie) {
                    embed.setColor(uiSystem_1.EMBED_COLORS.GOLD)
                        .setDescription(`🔥 **BẤT PHÂN THẮNG BẠI!** Sau ${duel.currentRound} hiệp đấu kịch liệt, cả hai đều kiệt sức không phân cao thấp!\n\n` +
                        `${logsText}\n\n` +
                        `💰 Lời khiêu chiến bị hủy bỏ, Linh Thạch đặt cược hoàn trả nguyên vẹn cho hai bên!`);
                }
                else {
                    const winnerId = res.winnerId;
                    const loserId = res.loserId;
                    const pvpResult = PvPService_1.pvpService.recordMatch(winnerId, loserId);
                    DailyQuestService_1.dailyQuestService.updateProgress(winnerId, 'daily_pvp', 1);
                    QuestChainService_1.questChainService.updateProgress(winnerId, 'pvp_win', 1);
                    let stolenText = '';
                    if (pvpResult.coinsStolen > 0) {
                        stolenText = `\n🩸 **Cướp Đoạt:** <@${winnerId}> đã cướp thêm được **${pvpResult.coinsStolen}** Hạ Phẩm Linh Thạch từ túi đồ của kẻ bại trận!`;
                    }
                    embed.setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
                        .setDescription(`🏆 **CHIẾN THẮNG VINH QUANG!** Sau ${duel.currentRound} hiệp đọ sức, kẻ mạnh đã được phân định!\n\n` +
                        `${logsText}\n\n` +
                        `━━━ **KẾT QUẢ CHUNG CUỘC** ━━━\n` +
                        `<@${duel.challengerId}>: ${hpBar(duel.challengerHp, duel.challengerMaxHp)} **${duel.challengerHp}/${duel.challengerMaxHp}**\n` +
                        `<@${duel.targetId}>: ${hpBar(duel.targetHp, duel.targetMaxHp)} **${duel.targetHp}/${duel.targetMaxHp}**\n\n` +
                        `🌟 **Chiến Thắng:** <@${winnerId}> \n` +
                        `💰 <@${winnerId}> nhận **+${res.winnings}** Hạ Phẩm Linh Thạch (đã trừ thuế).\n` +
                        `💸 <@${loserId}> mất **-${duel.wager}** Hạ Phẩm Linh Thạch.` +
                        stolenText + `\n\n📈 PvP: <@${winnerId}> (+${pvpResult.pvpGain}) | <@${loserId}> (${pvpResult.pvpLoss})`);
                }
                if (interaction.isButton() && !interaction.replied) {
                    await interaction.update({ embeds: [embed], components: [] });
                }
                else {
                    await interaction.followUp((0, uiSystem_1.toV2Payload)([embed], []));
                }
                return;
            }
            if (duel.roundStatus === 'round_complete' && duel.currentRound <= duel.maxRounds) {
                const prevRound = duel.currentRound - 1;
                const lastLog = duel.roundLogs[duel.roundLogs.length - 1] || '';
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`⚔️ TAM HỒI LINH CHIẾN — HIỆP ${duel.currentRound}/${duel.maxRounds}`)
                    .setColor(uiSystem_1.EMBED_COLORS.INFO)
                    .setDescription(`${lastLog}\n\n` +
                    `━━━ **HIỆP ${duel.currentRound} — CHỌN CHIÊU THỨC** ━━━\n` +
                    `⚔️ **Xuất Kiếm** — Mạnh vs 💫 Tụ Khí, Yếu vs 🛡️ Phòng Thủ\n` +
                    `🛡️ **Phòng Thủ** — Giảm 60% dmg nhận, hồi 6% HP\n` +
                    `🔮 **Linh Pháp** — Công kích Linh Căn, phá giáp 🛡️\n` +
                    `💫 **Tụ Khí** — Hồi 20% HP, tích Chiến Ý cho hiệp sau\n` +
                    `🔥 **Tuyệt Kỹ** — Bộc phát 100% kỹ năng bản mệnh\n` +
                    `💊 **Vật Phẩm** — Dùng đan/phù\n`)
                    .setFooter({ text: 'Cả hai chọn xong sẽ tự động phân giải!' })
                    .setTimestamp();
                const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_xuất_kiếm`).setLabel('⚔️ Xuất Kiếm').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_phòng_thủ`).setLabel('🛡️ Phòng Thủ').setStyle(discord_js_1.ButtonStyle.Primary));
                const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_linh_pháp`).setLabel('🔮 Linh Pháp').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tụ_khí`).setLabel('💫 Tụ Khí').setStyle(discord_js_1.ButtonStyle.Secondary));
                const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tuyệt_kỹ`).setLabel('🔥 Tuyệt Kỹ').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_dùng_vật_phẩm`).setLabel('💊 Dùng Vật Phẩm').setStyle(discord_js_1.ButtonStyle.Secondary));
                if (interaction.isButton() && !interaction.replied) {
                    await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
                }
                else {
                    await interaction.client.rest.patch(discord_js_1.Routes.channelMessage(interaction.channelId, interaction.message.id), { body: { components: [(0, uiSystem_1.embedToV2)(embed), row1, row2, row3], flags: uiSystem_1.V2_FLAG } });
                }
                let choiceName = actionMeta[choiceRaw]?.name || 'Vật Phẩm';
                await interaction.followUp({ content: `✅ Đạo hữu ra chiêu thành công! Đạo hữu chọn **${choiceName}** cho hiệp ${prevRound}. Hãy chọn chiêu hiệp ${duel.currentRound}!`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            if (duel.roundStatus === 'waiting') {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`⚔️ TAM HỒI LINH CHIẾN — HIỆP ${duel.currentRound}/${duel.maxRounds}`)
                    .setColor(uiSystem_1.EMBED_COLORS.INFO)
                    .setDescription(`🪙 **Hũ Cược:** **${duel.wager * 2}** Hạ Phẩm Linh Thạch\n\n` +
                    `📊 **Trạng thái hiện tại:**\n` +
                    `<@${duel.challengerId}>: ${hpBar(duel.challengerHp, duel.challengerMaxHp)} **${duel.challengerHp}/${duel.challengerMaxHp}**\n` +
                    `<@${duel.targetId}>: ${hpBar(duel.targetHp, duel.targetMaxHp)} **${duel.targetHp}/${duel.targetMaxHp}**\n\n` +
                    `⏳ Đang chờ đối thủ ra chiêu...\n\n` +
                    `*Đạo hữu đã chọn chiêu thức — hãy kiên nhẫn chờ đối thủ!*`)
                    .setFooter({ text: 'Cả hai chọn xong sẽ tự động phân giải!' })
                    .setTimestamp();
                const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_xuất_kiếm`).setLabel('⚔️ Xuất Kiếm').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_phòng_thủ`).setLabel('🛡️ Phòng Thủ').setStyle(discord_js_1.ButtonStyle.Primary));
                const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_linh_pháp`).setLabel('🔮 Linh Pháp').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tụ_khí`).setLabel('💫 Tụ Khí').setStyle(discord_js_1.ButtonStyle.Secondary));
                const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_tuyệt_kỹ`).setLabel('🔥 Tuyệt Kỹ').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`duelchoose_${duel.id}_dùng_vật_phẩm`).setLabel('💊 Dùng Vật Phẩm').setStyle(discord_js_1.ButtonStyle.Secondary));
                if (interaction.isButton() && !interaction.replied) {
                    await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
                }
                else {
                    await interaction.client.rest.patch(discord_js_1.Routes.channelMessage(interaction.channelId, interaction.message.id), { body: { components: [(0, uiSystem_1.embedToV2)(embed), row1, row2, row3], flags: uiSystem_1.V2_FLAG } });
                }
                await interaction.followUp({ content: `✅ Đạo hữu ra chiêu thành công! Hãy chờ đối thủ!`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({ content: '⚠️ Trạng thái quyết đấu không xác định.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (action === 'duellichsu') {
            const targetId = parts[1];
            const targetPage = parseInt(parts[2], 10) || 1;
            const history = MinigameService_1.minigameService.getDuelHistory(targetId, targetPage);
            if (history.records.length === 0) {
                await interaction.update({ embeds: [new discord_js_1.EmbedBuilder().setDescription('📜 **Không còn dữ liệu lịch sử nào.**')], components: [] });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📜 LỊCH SỬ QUYẾT ĐẤU - TAM HỒI LINH CHIẾN')
                .setColor(uiSystem_1.EMBED_COLORS.WARNING)
                .setFooter({ text: `Trang ${history.currentPage}/${history.totalPages} • Tổng số: ${history.totalRecords} trận` })
                .setTimestamp();
            for (const record of history.records) {
                const isWinner = record.winner_id === targetId;
                const isTie = record.is_tie === 1;
                const date = new Date(record.fought_at * 1000);
                const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                let resultEmoji;
                let resultText;
                if (isTie) {
                    resultEmoji = '🤝';
                    resultText = `**Hòa** với **${record.loser_name}**`;
                }
                else if (isWinner) {
                    const netWinnings = (record.winnings || 0) - record.wager;
                    resultEmoji = '🏆';
                    resultText = `**Thắng** ${record.loser_name} ${netWinnings >= 0 ? `(+${netWinnings})` : ''}`;
                }
                else {
                    resultEmoji = '💀';
                    resultText = `**Thua** ${record.winner_name} (-${record.wager} LThạch)`;
                }
                embed.addFields({
                    name: `${resultEmoji} ${resultText}`,
                    value: `🔄 **${record.rounds}** hiệp | 🪙 Cược **${record.wager}** Linh Thạch | 🕐 ${dateStr}`
                });
            }
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`duellichsu_${targetId}_${history.currentPage - 1}`).setLabel('◀ Trang Trước').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(history.currentPage <= 1), new discord_js_1.ButtonBuilder().setCustomId(`duellichsu_${targetId}_${history.currentPage + 1}`).setLabel('Trang Sau ▶').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(history.currentPage >= history.totalPages));
            await interaction.update({ embeds: [embed], components: [row] });
            return;
        }
    }
}
exports.DuelInteractionHandler = DuelInteractionHandler;
