"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifeQuestHandler = void 0;
const discord_js_1 = require("discord.js");
const FarmingService_1 = require("../../services/FarmingService");
const CraftingService_1 = require("../../services/CraftingService");
const LeylineService_1 = require("../../services/LeylineService");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const QuestChainService_1 = require("../../services/QuestChainService");
const ExplorationService_1 = require("../../services/ExplorationService");
const EncounterService_1 = require("../../services/EncounterService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const linhdien_1 = require("../../commands/life/linhdien");
const luyenkhi_1 = require("../../commands/life/luyenkhi");
const chetao_1 = require("../../commands/life/chetao");
const khampha_1 = require("../../commands/general/khampha");
const nhiemvu_1 = require("../../commands/general/nhiemvu");
const lamviec_1 = require("../../commands/general/lamviec");
const uiSystem_1 = require("../../utils/uiSystem");
const uiSystem_2 = require("../../utils/uiSystem");
const luyendan_1 = __importDefault(require("../../commands/general/luyendan"));
const database_1 = __importDefault(require("../../database/database"));
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const BlacksmithService_1 = require("../../services/BlacksmithService");
const v2Components_1 = require("../../utils/v2Components");
const constants_1 = require("../../utils/constants");
class LifeQuestHandler {
    static async handle(interaction, action, parts, userId) {
        try {
            const targetUserId = userId;
            if (action === 'linhdienharvest') {
                const plots = FarmingService_1.farmingService.getPlots(targetUserId);
                const harvested = [];
                for (const p of plots) {
                    if (p.status === 'growing' && (p.timeRemaining || 0) <= 0) {
                        const res = FarmingService_1.farmingService.harvestPlot(targetUserId, p.plot_index);
                        if (res.success && res.productName) {
                            harvested.push(res.productName);
                        }
                    }
                }
                if (harvested.length === 0) {
                    await interaction.reply({ content: '❌ Không có linh thực nào chín để thu hoạch!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Nạp năng lượng Linh Mạch Thu Thập (5 năng lượng cho mỗi cây)
                LeylineService_1.leylineService.addEnergy(targetUserId, 'thuthap', harvested.length * 5);
                QuestChainService_1.questChainService.updateProgress(targetUserId, 'collect', harvested.length);
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: `✨ Đạo hữu thu hoạch thành công: ${harvested.map(h => `**${h}**`).join(', ')}!`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: KHAI KHẨN LINH ĐIỀN ---
            else if (action === 'linhdienunlock') {
                const result = FarmingService_1.farmingService.unlockPlot(targetUserId);
                if (!result.success) {
                    await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: LÀM MỚI LINH ĐIỀN ---
            else if (action === 'linhdienrefresh') {
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            }
            // --- Nút: ĐỘNG PHỦ - NGÂM LINH TUYỀN ---
            else if (action === 'dongphuspring') {
                const { caveService } = require('../../services/CaveService');
                const result = caveService.collectSpring(targetUserId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Cập nhật lại embed Động Phủ trực tiếp (in-place)
                const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
                const updatedEmbed = buildCaveEmbed(targetUserId);
                const updatedComponents = buildCaveComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [updatedEmbed], updatedComponents);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: ĐỘNG PHỦ - NÂNG CẤP ---
            else if (action === 'dongphuupgrade') {
                const { caveService } = require('../../services/CaveService');
                const cave = caveService.getCave(targetUserId);
                const cost = caveService.getUpgradeCost(cave.level);
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user)
                    return;
                if (!cost) {
                    await interaction.reply({ content: '❌ Động Phủ của đạo hữu đã đạt cấp tối đa!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (cost.lt > 0 && user.coin_ha_pham < cost.lt) {
                    await interaction.reply({ content: `❌ Cần **${cost.lt}** Linh Thạch để nâng cấp!`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (cost.knb > 0 && user.knb < cost.knb) {
                    await interaction.reply({ content: `❌ Cần **${cost.knb}** KNB để nâng cấp!`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                let missingItems = false;
                let reqText = '';
                for (const req of cost.reqItems) {
                    const item = inv.find((i) => i.item_id === req.id);
                    if (!item || item.quantity < req.quantity) {
                        missingItems = true;
                        const itemInfo = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(req.id);
                        const name = itemInfo ? itemInfo.name : req.id;
                        reqText += `**${name}** (Cần: **${req.quantity}**, hiện có: **${item ? item.quantity : 0}**) `;
                    }
                }
                if (missingItems) {
                    await interaction.reply({ content: `❌ Thiếu nguyên liệu! ${reqText}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Trừ chi phí
                database_1.default.transaction(() => {
                    const updates = {};
                    if (cost.lt > 0)
                        updates.coin_ha_pham = user.coin_ha_pham - cost.lt;
                    if (cost.knb > 0)
                        updates.knb = user.knb - cost.knb;
                    UserRepository_1.userRepository.update(targetUserId, updates);
                    for (const req of cost.reqItems) {
                        const item = inv.find((i) => i.item_id === req.id);
                        if (item.quantity > req.quantity) {
                            database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(req.quantity, item.id);
                        }
                        else {
                            database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
                        }
                    }
                    database_1.default.prepare('UPDATE user_caves SET level = level + 1, spring_available = spring_available + 1 WHERE user_id = ?').run(targetUserId);
                })();
                // Cập nhật lại embed Động Phủ trực tiếp (in-place)
                const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
                const updatedEmbed = buildCaveEmbed(targetUserId);
                const updatedComponents = buildCaveComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [updatedEmbed], updatedComponents);
                await interaction.followUp({ content: `🎉 Chúc mừng! Đạo hữu đã nâng cấp thành công Động Phủ lên **Cấp ${cave.level + 1}**!`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: ĐI ĐẾN ĐỘNG PHỦ (từ hồ sơ) ---
            else if (action === 'dongphunav') {
                const { buildDongPhuEmbed, buildDongPhuComponents } = require('../../commands/life/dongphu');
                const embed = buildDongPhuEmbed(targetUserId);
                const comps = buildDongPhuComponents(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...comps, backRow]);
            }
            // --- Nút: NHẬN THÀNH PHẨM CHẾ TẠO (THU LÒ) ---
            else if (action === 'craftclaim') {
                const result = CraftingService_1.craftingService.claimCraftedItems(targetUserId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Nạp năng lượng Linh Mạch Thu Thập (10 năng lượng cho mỗi lần chế)
                LeylineService_1.leylineService.addEnergy(targetUserId, 'thuthap', 10);
                const embed = (0, chetao_1.getCraftingEmbed)(targetUserId);
                const components = (0, chetao_1.getCraftingComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: LÀM MỚI LÒ CHẾ TẠO ---
            else if (action === 'craftrefresh') {
                const embed = (0, chetao_1.getCraftingEmbed)(targetUserId);
                const components = (0, chetao_1.getCraftingComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            }
            // --- Nút: ĐI ĐẾN LUYỆN ĐAN (từ hồ sơ) ---
            else if (action === 'luyendannav') {
                const cmd = new luyendan_1.default();
                const embed = cmd.getAlchemyEmbed(targetUserId);
                const row = cmd.getAlchemyComponents(targetUserId);
                if (row.length > 0 && row[0].components.length < 5) {
                    row[0].addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`hosoback_${targetUserId}`)
                        .setLabel('🔙 Quay Lại Hồ Sơ')
                        .setStyle(discord_js_1.ButtonStyle.Secondary));
                }
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], row);
            }
            // --- Nút: ĐI ĐẾN LUYỆN KHÍ (từ hồ sơ) ---
            else if (action === 'luyenkhinav') {
                const embed = (0, luyenkhi_1.getLuyenKhiEmbed)(targetUserId);
                if (!embed) {
                    await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const components = (0, luyenkhi_1.getLuyenKhiComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            }
            // --- Nút: ĐI ĐẾN CHẾ TẠO (từ hồ sơ) ---
            else if (action === 'chetaonav') {
                const embed = (0, chetao_1.getCraftingEmbed)(targetUserId);
                const craftComps = (0, chetao_1.getCraftingComponents)(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...craftComps, backRow]);
            }
            // --- Nút: ĐI ĐẾN LÀM VIỆC (từ hồ sơ) ---
            else if (action === 'lamviecnav') {
                const user = UserRepository_1.userRepository.get(targetUserId);
                const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.dark, [
                    (0, v2Components_1.header)('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch', 'Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.'),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)(`⏰ **Hồi chiêu:** 60 giây (mỗi lần làm việc)\n` +
                        `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${user.stamina}/500**)\n└ ${(0, constants_1.getProgressBar)(user.stamina, 500, 8)}`),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)(`*Chọn một công việc bên dưới để bắt đầu lao động ngay!*`)
                ]);
                const workRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_mining_${targetUserId}`)
                    .setLabel('⚒️ Khai Thác')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_gathering_${targetUserId}`)
                    .setLabel('🌿 Hái Lượm')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_patrolling_${targetUserId}`)
                    .setLabel('🛡️ Tuần Tra')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_escort_${targetUserId}`)
                    .setLabel('🚚 Hộ Tiêu')
                    .setStyle(discord_js_1.ButtonStyle.Success));
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [workRow, backRow]);
            }
            // --- Nút: THỰC THI LÀM VIỆC (từ menu Làm Việc trong hồ sơ) ---
            else if (action === 'lamviecwork') {
                // customId: lamviecwork_<jobType>_<userId> => targetUserId nằm ở parts[2]
                const jobType = parts[1];
                const workTargetId = parts[2];
                if (interaction.user.id !== workTargetId) {
                    await interaction.reply({ content: '❌ Đạo hữu không thể lao động thay tu sĩ khác!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const result = (0, lamviec_1.performWork)(workTargetId, jobType);
                if (!result.success) {
                    await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Cập nhật lại menu làm việc với thể lực mới
                const refreshedUser = UserRepository_1.userRepository.get(workTargetId);
                const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.dark, [
                    (0, v2Components_1.header)('⛏️ LÀM VIỆC LINH TÍNH - Kiếm Linh Thạch', 'Đạo hữu lao động cần cù để tích lũy Hạ Phẩm Linh Thạch và cơ duyên vật phẩm.'),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)(`⏰ **Hồi chiêu:** 60 giây (mỗi lần làm việc)\n` +
                        `🧘 **Yêu cầu:** Cần ít nhất **10** Thể Lực (Hiện có: **${refreshedUser.stamina}/500**)\n└ ${(0, constants_1.getProgressBar)(refreshedUser.stamina, 500, 8)}`),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)(`*Chọn một công việc bên dưới để tiếp tục lao động!*`)
                ]);
                const workRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_mining_${workTargetId}`)
                    .setLabel('⚒️ Khai Thác')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_gathering_${workTargetId}`)
                    .setLabel('🌿 Hái Lượm')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_patrolling_${workTargetId}`)
                    .setLabel('🛡️ Tuần Tra')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`lamviecwork_escort_${workTargetId}`)
                    .setLabel('🚚 Hộ Tiêu')
                    .setStyle(discord_js_1.ButtonStyle.Success));
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${workTargetId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                // Cập nhật tiến trình nhiệm vụ hàng ngày khi làm việc
                DailyQuestService_1.dailyQuestService.updateProgress(workTargetId, 'daily_lamviec', 1);
                const resultComponents = [];
                const encounter = result.encounter;
                if (encounter) {
                    const { ActionRowBuilder: LocalActionRow, ButtonBuilder: LocalButton, ButtonStyle: LocalStyle } = require('discord.js');
                    const row = new LocalActionRow();
                    encounter.choices.forEach((c, idx) => {
                        row.addComponents(new LocalButton()
                            .setCustomId(`encounter_${encounter.id}_${idx}_${workTargetId}`)
                            .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
                            .setStyle(LocalStyle.Primary));
                    });
                    resultComponents.push(row);
                }
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [workRow, backRow]);
                await interaction.followUp((0, uiSystem_1.toV2Payload)([result.embed], resultComponents, discord_js_1.MessageFlags.Ephemeral));
            }
            // --- Nút: ĐI ĐẾN NHIỆM VỤ HÀNG NGÀY (từ hồ sơ) ---
            else if (action === 'nhiemvunav') {
                const embed = (0, nhiemvu_1.getNhiemVuEmbed)(targetUserId);
                const rows = (0, nhiemvu_1.getNhiemVuComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
            }
            // --- Nút: NHẬN THƯỞNG NHIỆM VỤ ---
            else if (action === 'nhiemvuclaim') {
                const questId = parts.slice(1, -1).join('_'); // Ghép lại vì quest_id có underscore
                const result = DailyQuestService_1.dailyQuestService.claimQuest(targetUserId, questId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, nhiemvu_1.getNhiemVuEmbed)(targetUserId);
                const rows = (0, nhiemvu_1.getNhiemVuComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: BẮT ĐẦU CHUỖI NHIỆM VỤ ---
            else if (action === 'chainstart') {
                const chainId = parts.slice(1, -1).join('_');
                const result = QuestChainService_1.questChainService.startChain(targetUserId, chainId);
                const embed = (0, nhiemvu_1.getQuestChainEmbed)(targetUserId);
                const rows = (0, nhiemvu_1.getQuestChainComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                if (result.message) {
                    await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
            // --- Nút: NHẬN THƯỞNG BƯỚC CHUỖI NHIỆM VỤ ---
            else if (action === 'chainclaim') {
                const chainId = parts.slice(1, -1).join('_');
                const result = QuestChainService_1.questChainService.claimStepReward(targetUserId);
                const embed = (0, nhiemvu_1.getQuestChainEmbed)(targetUserId);
                const rows = (0, nhiemvu_1.getQuestChainComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: KHÁM PHÁ DÃ NGOẠI (nav) ---
            else if (action === 'khamphanav') {
                const embed = (0, khampha_1.getKhamPhaEmbed)(targetUserId);
                const rows = (0, khampha_1.getKhamPhaComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
            }
            // --- Nút: BẮT ĐẦU THÁM HIỂM (chọn địa điểm) ---
            else if (action === 'khamphastart') {
                const locationId = parts.slice(1, -1).join('_'); // Ghép lại vì loc.id có underscore
                const result = ExplorationService_1.explorationService.startExploration(targetUserId, locationId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, khampha_1.getKhamPhaEmbed)(targetUserId);
                const rows = (0, khampha_1.getKhamPhaComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: VỀ LẤY THƯỞNG THÁM HIỂM ---
            else if (action === 'khamphaclaim') {
                const result = ExplorationService_1.explorationService.claimExploration(targetUserId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (result.hasEvent && result.event) {
                    // Hiển thị kỳ ngộ
                    const event = result.event;
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`✨ KỲ NGỘ: ${event.title}`)
                        .setColor(uiSystem_2.EMBED_COLORS.ERROR)
                        .setDescription(event.description)
                        .setTimestamp();
                    const choiceRow = new discord_js_1.ActionRowBuilder();
                    for (const choice of event.choices) {
                        choiceRow.addComponents(new discord_js_1.ButtonBuilder()
                            .setCustomId(`khamphaevent_${result.explorationId}_${choice.id}_${targetUserId}`)
                            .setLabel(choice.label)
                            .setStyle(discord_js_1.ButtonStyle.Primary));
                    }
                    await (0, uiSystem_1.safeV2Update)(interaction, [embed], [choiceRow]);
                }
                else {
                    // Thu hoạch bình thường
                    DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_khampha', 1);
                    QuestChainService_1.questChainService.updateProgress(targetUserId, 'explore', 1);
                    const embed = (0, khampha_1.getKhamPhaEmbed)(targetUserId);
                    const rows = (0, khampha_1.getKhamPhaComponents)(targetUserId);
                    await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                    await interaction.followUp({ content: result.message });
                }
            }
            // --- Nút: XỬ LÝ LỰA CHỌN KỲ NGỘ THÁM HIỂM ---
            else if (action === 'khamphaevent') {
                const explorationId = parseInt(parts[1], 10);
                const choiceId = parts[2];
                const result = ExplorationService_1.explorationService.resolveEvent(targetUserId, explorationId, choiceId);
                DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_khampha', 1);
                QuestChainService_1.questChainService.updateProgress(targetUserId, 'explore', 1);
                const embed = (0, khampha_1.getKhamPhaEmbed)(targetUserId);
                const rows = (0, khampha_1.getKhamPhaComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                await interaction.followUp({ content: result.message });
            }
            // --- Nút: LỰA CHỌN ENCOUNTER (Kỳ Ngộ Làm Việc / Săn Yêu Thú) ---
            else if (action === 'encounter') {
                const userIdFromParts = parts[parts.length - 1];
                if (interaction.user.id !== userIdFromParts) {
                    await interaction.reply({ content: '❌ Đây không phải kỳ ngộ của đạo hữu!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const choiceIndex = parseInt(parts[parts.length - 2], 10);
                const encounterId = parts.slice(1, parts.length - 2).join('_');
                // Lấy thông tin encounter từ service
                const allEncounters = [
                    ...EncounterService_1.encounterService.getEncounterPool('lamviec'),
                    ...EncounterService_1.encounterService.getEncounterPool('sanyeuthu')
                ];
                const encounter = allEncounters.find((e) => e.id === encounterId);
                if (!encounter) {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, '❌ Kỳ ngộ này không còn tồn tại hoặc bị lỗi.');
                    return;
                }
                const choice = encounter.choices[choiceIndex];
                if (!choice) {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, '❌ Lựa chọn không hợp lệ.');
                    return;
                }
                const result = EncounterService_1.encounterService.resolveEncounter(userIdFromParts, encounterId, choice.id);
                // Tạo một Embed hiển thị kết quả
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(result.success ? '✨ KỲ NGỘ THÀNH CÔNG' : '😅 KỲ NGỘ THẤT BẠI')
                    .setColor(result.success ? '#2ecc71' : uiSystem_2.EMBED_COLORS.ERROR)
                    .setDescription(result.message)
                    .setTimestamp();
                const rewardTexts = [];
                if (result.rewards.coins)
                    rewardTexts.push(`• Linh Thạch: **${result.rewards.coins > 0 ? '+' : ''}${result.rewards.coins}** LT 🟤`);
                if (result.rewards.exp)
                    rewardTexts.push(`• Tu Vi: **+${result.rewards.exp}** 🌿`);
                if (result.rewards.contribution)
                    rewardTexts.push(`• Cống Hiến: **+${result.rewards.contribution}** ⚜️`);
                if (result.rewards.ngotinh)
                    rewardTexts.push(`• Ngộ Tính: **+${result.rewards.ngotinh}** 🧠`);
                if (result.rewards.items)
                    rewardTexts.push(`• Vật Phẩm: Nhận vật phẩm cơ duyên x**${result.rewards.items}** 🎁`);
                if (result.rewards.pet_received)
                    rewardTexts.push(`• Linh Thú: Thu phục thần thú cơ duyên 🦄`);
                if (result.rewards.farming_acceleration)
                    rewardTexts.push(`• Linh Điền: Gia tốc sinh trưởng **+${result.rewards.farming_acceleration} giờ** 🌧️`);
                if (rewardTexts.length > 0) {
                    embed.addFields({ name: '🎁 Biến Động Thuộc Tính', value: rewardTexts.join('\n') });
                }
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${userIdFromParts}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [backRow]);
            }
            // --- Select Menu: GIEO HẠT LINH ĐIỀN ---
            else if (action === 'linhdiengieoselect' && interaction.isStringSelectMenu()) {
                const seedItemId = interaction.values[0];
                const plots = FarmingService_1.farmingService.getPlots(targetUserId);
                const emptyPlot = plots.find(p => p.status === 'empty');
                if (!emptyPlot) {
                    await interaction.reply({ content: '❌ Linh điền không còn ô đất trống để gieo hạt!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const result = FarmingService_1.farmingService.plantSeed(targetUserId, emptyPlot.plot_index, seedItemId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            }
            // --- Select Menu: TĂNG TỐC LINH ĐIỀN ---
            else if (action === 'linhdienspeedupselect' && interaction.isStringSelectMenu()) {
                const plotIndex = parseInt(interaction.values[0], 10);
                const result = FarmingService_1.farmingService.speedupPlot(targetUserId, plotIndex);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Select Menu: CHĂM SÓC LINH ĐIỀN ---
            else if (action === 'linhdiencareselect' && interaction.isStringSelectMenu()) {
                const careValue = interaction.values[0]; // "water_0", "fertilize_0", "catchpests_0"
                const [careType, plotIndexStr] = careValue.split('_');
                const plotIndex = parseInt(plotIndexStr, 10);
                let result;
                if (careType === 'water') {
                    result = FarmingService_1.farmingService.waterPlot(targetUserId, plotIndex);
                }
                else if (careType === 'fertilize') {
                    result = FarmingService_1.farmingService.fertilizePlot(targetUserId, plotIndex);
                }
                else if (careType === 'catchpests') {
                    result = FarmingService_1.farmingService.catchPests(targetUserId, plotIndex);
                }
                else {
                    await interaction.reply({ content: '❌ Thao tác không hợp lệ!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const components = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Select Menu: CHỌN CÔNG THỨC CHẾ TẠO ---
            else if (action === 'craftselect' && interaction.isStringSelectMenu()) {
                const recipeId = interaction.values[0];
                const result = CraftingService_1.craftingService.startCrafting(targetUserId, recipeId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, chetao_1.getCraftingEmbed)(targetUserId);
                const components = (0, chetao_1.getCraftingComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Select Menu: LUYỆN KHÍ CHỌN CÔNG THỨC ---
            else if (action === 'luyenkhiselect' && interaction.isStringSelectMenu()) {
                const recipeId = interaction.values[0];
                const res = BlacksmithService_1.blacksmithService.forgeItem(targetUserId, recipeId);
                await interaction.reply({ content: res.success ? res.message : `❌ ${res.message}` });
                // Cập nhật lại UI Luyện Khí
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (user) {
                    const embed = interaction.message.embeds[0];
                    const newEmbed = discord_js_1.EmbedBuilder.from(embed).setFooter({ text: `Thể lực hiện tại: ${user.stamina}/500 | Linh Thạch: ${user.coin_ha_pham}` });
                    await interaction.client.rest.patch(discord_js_1.Routes.channelMessage(interaction.channelId, interaction.message.id), { body: { components: [require('../../utils/uiSystem').embedToV2(newEmbed)], flags: require('../../utils/uiSystem').V2_FLAG } });
                }
            }
            if (action === 'linhdiennav') {
                const embed = (0, linhdien_1.getLinhDienEmbed)(targetUserId);
                const linhComps = (0, linhdien_1.getLinhDienComponents)(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...linhComps, backRow]);
                return;
            }
            // V15: Bisinghanh enter button
            else if (action === 'bicanhsonghanh_enter') {
                const { secretRealmService } = require('../../services/SecretRealmService');
                const canEnter = secretRealmService.canEnter(targetUserId);
                if (!canEnter.eligible) {
                    await interaction.reply({ content: `❌ ${canEnter.reason}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const config = secretRealmService.getConfig();
                await interaction.reply({ content: `🌀 Đang vào **${config.name}**... Partner cần online để bắt đầu!`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            // V15: Sect Council vote buttons
            else if (action === 'sectcouncil_vote_yes' || action === 'sectcouncil_vote_no') {
                const { sectCouncilService } = require('../../services/SectCouncilService');
                const sectId = parseInt(parts[2]);
                const vote = action === 'sectcouncil_vote_yes' ? 'yes' : 'abstain';
                const result = sectCouncilService.vote(sectId, targetUserId, parts[1] || '', vote);
                await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            // V15: Bounty Board claim
            else if (action === 'bangnghiavu_claim') {
                const { bountyBoardService } = require('../../services/BountyBoardService');
                const result = bountyBoardService.completeToday(targetUserId);
                await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
        }
        catch (error) {
            console.error('[LifeQuestHandler] Lỗi xử lý:', error);
            try {
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                else if (interaction.isRepliable()) {
                    await interaction.followUp({ content: '❌ Có lỗi xảy ra khi xử lý hành động này!', flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
            catch (_) { }
        }
    }
}
exports.LifeQuestHandler = LifeQuestHandler;
