"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CultivationInteractionHandler = exports.practiceCooldowns = void 0;
const discord_js_1 = require("discord.js");
const CultivationService_1 = require("../../services/CultivationService");
const TribulationService_1 = require("../../services/TribulationService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const luanhoi_1 = require("../../commands/general/luanhoi");
const ycanh_1 = require("../../commands/general/ycanh");
const hoso_1 = require("../../commands/general/hoso");
const constants_1 = require("../../utils/constants");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const InventoryService_1 = require("../../services/InventoryService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
// Cần quản lý cooldown chung cho thiền định
exports.practiceCooldowns = new Map();
// Dọn dẹp bộ nhớ (garbage collection) cho practiceCooldowns mỗi 10 phút
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of exports.practiceCooldowns.entries()) {
        if (now - timestamp > 60000) { // Quá 60 giây thì xóa
            exports.practiceCooldowns.delete(userId);
        }
    }
}, 600000);
class CultivationInteractionHandler {
    static async handle(interaction, action, parts, targetUserId) {
        const user = UserRepository_1.userRepository.get(targetUserId);
        if (!user) {
            await interaction.reply({ content: '❌ Không tìm thấy nhân vật.', ephemeral: true });
            return;
        }
        if (action === 'luanhoiconfirm') {
            const result = CultivationService_1.cultivationService.reincarnate(targetUserId);
            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
                return;
            }
            const embed = (0, luanhoi_1.getLuanHoiEmbed)(targetUserId);
            const row = (0, luanhoi_1.getLuanHoiComponents)(targetUserId, false);
            await interaction.update({ embeds: [embed], components: [row] });
            await interaction.followUp({ content: result.message, ephemeral: false });
            return;
        }
        if (action === 'luanhoicancel') {
            await interaction.update({ content: 'Đạo hữu đã chọn tiếp tục tu hành ở kiếp này.', embeds: [], components: [] });
            return;
        }
        if (action === 'ycanhawaken') {
            const result = CultivationService_1.cultivationService.awakenYCanh(targetUserId);
            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
                return;
            }
            const embed = (0, ycanh_1.getYCanhEmbed)(targetUserId);
            const row = (0, ycanh_1.getYCanhComponents)(targetUserId);
            await interaction.update({ embeds: [embed], components: [row] });
            await interaction.followUp({ content: result.message, ephemeral: true });
            return;
        }
        if (action === 'tuluyen') {
            // Nhận Tu Vi offline trước để tránh bị reset mất khi thực hiện các update khác
            const result = CultivationService_1.cultivationService.claimIdleCultivation(targetUserId);
            if (!result || !result.user) {
                await interaction.reply({ content: 'Không tìm thấy nhân vật.', ephemeral: true });
                return;
            }
            const freshUser = result.user;
            if (freshUser.stamina < 1) {
                await interaction.reply({ content: `❌ Đạo hữu đã cạn kiệt Thể Lực! Việc khiên cưỡng vận công sẽ tẩu hỏa nhập ma. Hãy nghỉ ngơi chờ phục hồi.`, ephemeral: true });
                return;
            }
            const now = Date.now();
            const lastPractice = exports.practiceCooldowns.get(targetUserId) || 0;
            if (now - lastPractice < 10000) {
                const remaining = Math.ceil((10000 - (now - lastPractice)) / 1000);
                await interaction.reply({ content: `⏳ Tĩnh tâm nào! Đạo hữu đang hấp thu linh khí quá nhanh, cần đợi **${remaining} giây** để ổn định đan điền!`, ephemeral: true });
                return;
            }
            exports.practiceCooldowns.set(targetUserId, now);
            UserRepository_1.userRepository.update(targetUserId, { stamina: freshUser.stamina - 1 });
            const practiceRes = CultivationService_1.cultivationService.practice(targetUserId);
            const updatedEmbed = (0, hoso_1.getHoSoTabEmbed)(targetUserId, 'chiso');
            const allComponents = (0, hoso_1.getHoSoAllComponents)(targetUserId, 'chiso');
            await interaction.update({ embeds: [updatedEmbed], components: allComponents });
            DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_tuluyen', 1);
            const msg = practiceRes.success ? practiceRes.message : `🧘 **Thiền Định:** Đạo hữu thiền định tu luyện thành công!`;
            await interaction.followUp({ content: msg, ephemeral: true });
            return;
        }
        if (action === 'dotpha') {
            if (parts.length === 2) {
                // Đột phá chính
                if (user.tu_vi < user.exp_needed) {
                    await interaction.reply({ content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Cần **${user.tu_vi}/${user.exp_needed}** Tu Vi)`, ephemeral: true });
                    return;
                }
                const { minorLevel, fullName, majorIndex } = (0, constants_1.getRealmDetails)(user.level);
                const isMajor = minorLevel === 38;
                if (!isMajor) {
                    const result = CultivationService_1.cultivationService.breakthrough(targetUserId, false);
                    const updatedEmbed = (0, hoso_1.getHoSoTabEmbed)(targetUserId, 'chiso');
                    const btComponents = (0, hoso_1.getHoSoAllComponents)(targetUserId, 'chiso');
                    await interaction.update({ embeds: [updatedEmbed], components: btComponents });
                    await interaction.followUp({ content: result.message, ephemeral: true });
                }
                else {
                    const bolts = 3 + majorIndex * 2;
                    const damage = Math.round(20 + majorIndex * 15);
                    const stats = InventoryService_1.inventoryService.getActiveStats(targetUserId);
                    const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                    const getQty = (itemId) => inv.find(i => i.item_id === itemId)?.quantity || 0;
                    const antiLoiQty = getQty('pill_alchemy_anti_loi');
                    const hp1Qty = getQty('pill_hp_1');
                    const hp2Qty = getQty('pill_hp_2');
                    const tiLoiQty = getQty('talisman_anti_loi');
                    const oncomingKiep = TribulationService_1.tribulationService.getOncomingKiepInfo(targetUserId);
                    const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
                    const bequanMajorCost = user.level * 1000;
                    const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
                    const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`)
                        .setColor('#e74c3c')
                        .setDescription(`Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân đang kéo tới dồn dập!\n\n` +
                        `• Cảnh giới lớn đột phá: **${fullName}**\n` +
                        `• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n` +
                        `• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp** giáng xuống liên tục.\n` +
                        `• Uy lực ước tính: **~${damage}** sát thương thô mỗi đạo sét.\n\n` +
                        `❤️ **Trạng thái hiện tại:**\n` +
                        `• Sinh Lực tối đa: **${hpText}** HP\n` +
                        `• Pháp Lực tối đa: **${mpText}** MP\n\n` +
                        `🎒 **Vật phẩm hộ thân hiện có trong túi:**\n` +
                        `• ${oncomingKiep.pillName} 💊 (khắc chế kiếp, giảm 40%): **${protectPillQty}** viên\n` +
                        `• Ngự Lôi Đan 💊 (giảm 30% sát thương): **${antiLoiQty}** viên\n` +
                        `• Tị Lôi Phù 📜 (giảm 80% sát thương 1 lượt): **${tiLoiQty}** tấm\n` +
                        `• Hồi Huyết Đan trung phẩm ❤️ (hồi 150 HP): **${hp2Qty}** viên\n\n` +
                        `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanMajorCost}** Linh Thạch Hạ Phẩm để đột phá an toàn 100% (bỏ qua lôi kiếp).\n\n` +
                        `⚠️ **Cảnh báo nguy hiểm:** Hãy chắc chắn đạo hữu đang đầy đủ HP/MP. Nếu HP về 0 giữa lôi kiếp, đạo hữu sẽ đột phá thất bại, bị **Trọng Thương (1 giờ)** và tổn thất **-30%** tu vi hiện có!`)
                        .setFooter({ text: 'Nhấn nút bên dưới để bắt đầu lôi kiếp hoặc chọn Bế Quan!' })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`loi_start_${targetUserId}`).setLabel('⚡ Nghênh Tiếp Lôi Kiếp!').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`dotpha_bequan_${targetUserId}`).setLabel(`Bế Quan (${bequanMajorCost} LThạch)`).setStyle(discord_js_1.ButtonStyle.Success).setDisabled(user.coin_ha_pham < bequanMajorCost), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại').setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.update({ embeds: [embed], components: [row] });
                }
            }
            else {
                // Đột phá bằng đan dược (trong /dotpha) hoặc đột phá không đan
                const usedPill = parts.slice(1, -1).join('_');
                if (usedPill !== 'bequan') {
                    // Trùng kích cảnh giới nhỏ bằng tay -> 20% cơ hội gặp Tâm Ma
                    if (Math.random() < 0.20) {
                        const level = user.level;
                        const cost = level * 50;
                        const { majorIndex } = (0, constants_1.getRealmDetails)(level);
                        const baseRate = Math.max(90 - majorIndex * 10, 10);
                        const luckBonus = user.base_luck * 0.002;
                        let pillBonus = 0;
                        if (usedPill === 'pill_break_minor_1')
                            pillBonus = 15;
                        else if (usedPill === 'pill_break_minor_2')
                            pillBonus = 30;
                        else if (usedPill === 'pill_break_minor_3')
                            pillBonus = 50;
                        let alignmentRateMod = 0;
                        if (user.alignment === 'neutral' || !user.alignment) {
                            alignmentRateMod = 5;
                        }
                        else if (user.alignment === 'demonic') {
                            alignmentRateMod = -5;
                        }
                        const baseTotalRate = Math.min(baseRate + (luckBonus * 100) + pillBonus + alignmentRateMod, 100);
                        const reducedRate = Math.max(0, baseTotalRate - 15);
                        const embed = new discord_js_1.EmbedBuilder()
                            .setTitle('⚠️ TÂM MA QUẤY NHIỄU / TÁN TU QUẤY PHÁ ⚠️')
                            .setColor('#e74c3c')
                            .setDescription(`⚡ **Biến Cố Đột Phá:** Khi đạo hữu chuẩn bị trùng kích bình cảnh, bỗng dưng tâm ma vây kín (hoặc bị một tên tán tu quấy phá)! Đạo tâm lung lay, đan điền chấn động mạnh.\n\n` +
                            `📉 **Ảnh hưởng:** Tỷ lệ đột phá thành công giảm đi **-15%** (Từ **${baseTotalRate.toFixed(1)}%** còn **${reducedRate.toFixed(1)}%**).\n` +
                            `💀 **Hậu quả nếu thất bại:** Sẽ rơi vào trạng thái **Tẩu Hỏa Nhập Ma trong 30 phút** (giảm 50% hiệu suất tu vi nhàn rỗi và không thể thiền định chủ động trong thời gian này).\n\n` +
                            `Đạo hữu có thể chọn mạo hiểm đột phá, hoặc chi ra **${cost}** Linh Thạch để ổn định tâm thần, khôi phục tỷ lệ thành công ban đầu.`)
                            .setTimestamp();
                        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                            .setCustomId(`dotpharisk_${usedPill}_${targetUserId}`)
                            .setLabel('Vẫn Trùng Kích (Mạo hiểm)')
                            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                            .setCustomId(`dotphastabilize_${usedPill}_${targetUserId}`)
                            .setLabel(`Ổn Định Tâm Thần (${cost} Linh Thạch)`)
                            .setStyle(discord_js_1.ButtonStyle.Success)
                            .setDisabled(user.coin_ha_pham < cost), new discord_js_1.ButtonBuilder()
                            .setCustomId(`hosoback_${targetUserId}`)
                            .setLabel('Quay Lại')
                            .setStyle(discord_js_1.ButtonStyle.Secondary));
                        await interaction.update({ embeds: [embed], components: [row] });
                        return;
                    }
                }
                const result = CultivationService_1.cultivationService.breakthrough(targetUserId, usedPill);
                if (!result.success && !result.isMajor && result.message.includes('không có đan dược')) {
                    await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
                    .setColor(result.success ? '#2ecc71' : '#e74c3c')
                    .setDescription(result.message)
                    .setTimestamp();
                await interaction.update({ embeds: [embed], components: [] });
            }
            return;
        }
        if (action === 'loi') {
            const subAction = parts[1];
            const { majorIndex } = (0, constants_1.getRealmDetails)(user.level);
            if (subAction === 'start') {
                const { embed, rows } = TribulationService_1.tribulationService.start(targetUserId, user.name, majorIndex);
                await interaction.update({ embeds: [embed], components: rows });
            }
            else {
                const res = TribulationService_1.tribulationService.handleAction(targetUserId, subAction);
                if (res.finished) {
                    await interaction.update({ embeds: [res.embed], components: [] });
                }
                else {
                    await interaction.update({ embeds: [res.embed], components: res.rows });
                }
            }
            return;
        }
        if (action === 'taytuynav' || action === 'taytuyexecute' || action === 'taytuy') {
            if (action === 'taytuynav') {
                const formattedLinhCan = (0, constants_1.formatLinhCan)(user.linh_can);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`🌀 Tẩy Tủy Linh Căn - ${user.name}`)
                    .setColor('#3498db')
                    .setDescription('Tẩy tủy sẽ thay đổi Linh Căn cốt cách ngẫu nhiên, tác động trực tiếp tới các thuộc tính chiến đấu và hiệu suất tu luyện.')
                    .addFields({ name: '🔮 Linh Căn Hiện Tại', value: formattedLinhCan }, { name: '🪙 Chi Phí Tẩy Tủy', value: '💵 **100 Hạ Phẩm Linh Thạch**' }, { name: '💼 Số Dư Linh Thạch', value: `🟤 **${user.coin_ha_pham}** Hạ Phẩm Linh Thạch` })
                    .setFooter({ text: 'Hãy cân nhắc trước khi tiến hành hoán đổi căn cốt!' })
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`taytuyexecute_${targetUserId}`).setLabel('🌀 Xác Nhận Tẩy Tủy (100 LThạch)').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                await interaction.update({ embeds: [embed], components: [row] });
                return;
            }
            if (user.coin_ha_pham < 100) {
                await interaction.reply({ content: `❌ **Không đủ Linh Thạch!** Tẩy tủy cần 100 Hạ Phẩm Linh Thạch (Đạo hữu hiện có **${user.coin_ha_pham}**).`, ephemeral: true });
                return;
            }
            const newLinhCanJson = CultivationService_1.cultivationService.generateLinhCan();
            const newStats = CultivationService_1.cultivationService.calculateStatsForLevel(user.level, newLinhCanJson);
            UserRepository_1.userRepository.update(targetUserId, {
                coin_ha_pham: user.coin_ha_pham - 100,
                linh_can: newLinhCanJson,
                base_hp: newStats.hp,
                base_mp: newStats.mp,
                base_atk: newStats.atk,
                base_def: newStats.def,
                base_crit: newStats.crit,
                base_crit_res: newStats.critRes,
                base_luck: user.base_luck
            });
            const updatedUser = UserRepository_1.userRepository.get(targetUserId);
            const formattedLinhCan = (0, constants_1.formatLinhCan)(newLinhCanJson);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🌀 Tẩy Tủy Thành Công - ${updatedUser.name}`)
                .setColor('#2ecc71')
                .setDescription('Căn cốt linh căn đã thay đổi. Các chỉ số cơ bản của đạo hữu đã được tính toán lại theo cơ duyên mới.')
                .addFields({ name: '🔮 Linh Căn Mới', value: formattedLinhCan }, { name: '💼 Số Dư Linh Thạch', value: `🟤 **${updatedUser.coin_ha_pham}** Hạ Phẩm Linh Thạch` })
                .setTimestamp();
            const btnId = action === 'taytuy' ? `taytuy_${targetUserId}` : `taytuyexecute_${targetUserId}`;
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(btnId).setLabel('🌀 Tiếp Tục Tẩy Tủy (100 LThạch)').setStyle(discord_js_1.ButtonStyle.Primary));
            if (action === 'taytuyexecute') {
                row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
            }
            await interaction.update({ embeds: [embed], components: [row] });
            await interaction.followUp({ content: `🌀 **Tẩy Tủy Thành Công!** Linh căn mới của đạo hữu là: ${formattedLinhCan}`, ephemeral: true });
            return;
        }
        if (action === 'dotpharisk') {
            const usedPill = parts.slice(1, -1).join('_');
            const result = CultivationService_1.cultivationService.breakthrough(targetUserId, usedPill, false, true);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
                .setColor(result.success ? '#2ecc71' : '#e74c3c')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
            return;
        }
        if (action === 'dotphastabilize') {
            const usedPill = parts.slice(1, -1).join('_');
            const cost = user.level * 50;
            if (user.coin_ha_pham < cost) {
                await interaction.reply({ content: `❌ Đạo hữu không đủ Linh Thạch! (Cần ${cost} Hạ Phẩm Linh Thạch).`, ephemeral: true });
                return;
            }
            UserRepository_1.userRepository.update(targetUserId, { coin_ha_pham: user.coin_ha_pham - cost });
            const result = CultivationService_1.cultivationService.breakthrough(targetUserId, usedPill, false, false);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(result.success ? '⚡ ĐỘT PHÁ THÀNH CÔNG ⚡' : '💀 ĐỘT PHÁ THẤT BẠI 💀')
                .setColor(result.success ? '#2ecc71' : '#e74c3c')
                .setDescription(`✨ Đạo hữu tiêu hao **${cost}** Linh Thạch ổn định đạo tâm, khôi phục nguyên trạng tỷ lệ đột phá thành công!\n\n` + result.message)
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
            return;
        }
        if (action === 'select' && parts[1] === 'alignment') {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🎭 LỰA CHỌN ĐẠO THỐNG: CHÍNH ĐẠO vs MA ĐẠO 🎭')
                .setColor('#9b59b6')
                .setDescription(`Đạo hữu tu hành tới Trúc Cơ Kỳ, tu vi đã có thành tựu, có thể lựa chọn Đạo thống tương lai của mình. Con đường này sẽ ảnh hưởng tới thuộc tính chiến đấu, tu luyện, và tài phú của đạo hữu!\n\n` +
                `⚖️ **CHÍNH ĐẠO (Orthodox):**\n` +
                `• 🛡️ **Tăng 10% Phòng ngự** cơ bản.\n` +
                `• ⚡ **Giảm 10% sát thương** Lôi Kiếp đại cảnh giới.\n` +
                `• 💎 **Giảm 10% Linh Thạch** chi phí Bế Quan Đột Phá.\n` +
                `• 🪙 **Tăng 5% Linh Thạch** kiếm được khi làm việc (\`/lamviec\`).\n` +
                `• 📉 *Hình phạt:* Giảm **5%** Công kích (ATK) trong PvP & Quyết Đấu.\n\n` +
                `👿 **MA ĐẠO (Demonic):**\n` +
                `• ⚔️ **Tăng 10% Công kích** cơ bản & **+5% Chí Mạng (Crit)**.\n` +
                `• 🧘 **Tăng 15% tốc độ tu luyện** (Offline thiền định & Thiền định chủ động).\n` +
                `• 🩸 **Cướp thêm 10% Linh Thạch** của đối thủ khi thắng PvP/Quyết Đấu.\n` +
                `• 📉 *Hình phạt:* Tăng **15% sát thương** Lôi Kiếp & giảm **5% tỷ lệ đột phá tự nhiên**.\n\n` +
                `⚠️ **LƯU Ý QUAN TRỌNG:** Một khi đã chọn Đạo Thống, đạo hữu chỉ có thể thay đổi/tẩy sạch sau khi **Luân Hồi Trọng Sinh**! Hãy suy nghĩ thật kỹ.`)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`confirmalignment_orthodox_${targetUserId}`)
                .setLabel('⚖️ Nhập Chính Đạo')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(`confirmalignment_demonic_${targetUserId}`)
                .setLabel('👿 Nhập Ma Đạo')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`hosoback_${targetUserId}`)
                .setLabel('🔙 Quay Lại')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.update({ embeds: [embed], components: [row] });
            return;
        }
        if (action === 'confirmalignment') {
            const chosen = parts[1]; // 'orthodox' or 'demonic'
            if (user.alignment && user.alignment !== 'neutral') {
                await interaction.reply({ content: '❌ Đạo hữu đã chọn Đạo Thống rồi, không thể chọn lại!', ephemeral: true });
                return;
            }
            if (user.level < 39) {
                await interaction.reply({ content: '❌ Yêu cầu đạt cấp 39 (Trúc Cơ Kỳ) để chọn Đạo Thống!', ephemeral: true });
                return;
            }
            const newStats = CultivationService_1.cultivationService.calculateStatsForLevel(user.level, user.linh_can, chosen);
            UserRepository_1.userRepository.update(targetUserId, {
                alignment: chosen,
                base_hp: newStats.hp,
                base_mp: newStats.mp,
                base_atk: newStats.atk,
                base_def: newStats.def,
                base_crit: newStats.crit,
                base_crit_res: newStats.critRes,
            });
            const updatedUser = UserRepository_1.userRepository.get(targetUserId);
            const welcomeMsg = chosen === 'orthodox'
                ? `✨ Đạo tâm kiên định, tà ma thối lui! Chúc mừng đạo hữu **${updatedUser.name}** đã chính thức nhập **Chính Đạo ⚖️**! Chỉ số phòng ngự cơ bản được gia tăng.`
                : `😈 Huyết mạch thức tỉnh, ngạo thị quần hùng! Chúc mừng đạo hữu **${updatedUser.name}** đã chính thức nhập **Ma Đạo 👿**! Chỉ số công kích và chí mạng được gia tăng.`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🎭 ĐẠO THỐNG ĐÃ XÁC ĐỊNH 🎭')
                .setColor(chosen === 'orthodox' ? '#3498db' : '#e74c3c')
                .setDescription(welcomeMsg)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`hosoback_${targetUserId}`)
                .setLabel('🔙 Trở Lại Hồ Sơ')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.update({ embeds: [embed], components: [row] });
            return;
        }
    }
}
exports.CultivationInteractionHandler = CultivationInteractionHandler;
