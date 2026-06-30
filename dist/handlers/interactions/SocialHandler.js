"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialHandler = void 0;
const discord_js_1 = require("discord.js");
const SectService_1 = require("../../services/SectService");
const CombatService_1 = require("../../services/CombatService");
const GuildWarService_1 = require("../../services/GuildWarService");
const MountService_1 = require("../../services/MountService");
const LeylineService_1 = require("../../services/LeylineService");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const QuestChainService_1 = require("../../services/QuestChainService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const tongmon_1 = require("../../commands/life/tongmon");
const ycanh_1 = require("../../commands/general/ycanh");
const luanhoi_1 = require("../../commands/general/luanhoi");
const bicanh_1 = require("../../commands/combat/bicanh");
const sungthu_1 = require("../../commands/general/sungthu");
const sanyeuthu_1 = require("../../commands/general/sanyeuthu");
const leothap_1 = require("../../commands/general/leothap");
const toaky_1 = require("../../commands/general/toaky");
const arena_1 = require("../../commands/combat/arena");
const ArenaService_1 = require("../../services/ArenaService");
const v2Components_1 = require("../../utils/v2Components");
const CombatLogsCache_1 = require("./CombatLogsCache");
const uiSystem_1 = require("../../utils/uiSystem");
const uiSystem_2 = require("../../utils/uiSystem");
const dungeons_1 = require("../../config/dungeons");
const database_1 = __importDefault(require("../../database/database"));
class SocialHandler {
    static async handle(interaction, action, parts, userId) {
        try {
            const targetUserId = userId;
            // --- Nút: MỞ MODAL THÀNH LẬP TÔNG MÔN ---
            if (action === 'sectestablishnav') {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`sectcreate_${targetUserId}`)
                    .setTitle('Sáng Lập Tông Môn');
                const nameInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('sect_name')
                    .setLabel('Tên Tông Môn (2-20 ký tự)')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setRequired(true);
                const descInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('sect_desc')
                    .setLabel('Tuyên ngôn / Mô tả Tông Môn')
                    .setStyle(discord_js_1.TextInputStyle.Paragraph)
                    .setRequired(true);
                modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(descInput));
                await interaction.showModal(modal);
            }
            // --- Nút: RỜI / GIẢI TÁN TÔNG MÔN ---
            else if (action === 'sectleave') {
                const result = SectService_1.sectService.leaveSect(targetUserId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: LÀM MỚI TÔNG MÔN ---
            else if (action === 'sectrefresh') {
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            }
            // --- Nút: TÔNG CHỦ NÂNG CẤP KIẾN TRÚC TÔNG MÔN ---
            else if (action === 'sectupgrade') {
                const facility = parts[1];
                const result = SectService_1.sectService.upgradeFacility(targetUserId, facility);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: ĐI ĐẾN BÍ CẢNH (từ hồ sơ) ---
            else if (action === 'bicanhnaav') {
                const embed = (0, bicanh_1.getDungeonEmbed)(targetUserId);
                const row = (0, bicanh_1.getDungeonComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: KHIÊU CHIẾN BÍ CẢNH (Chọn phó bản) ---
            else if (action === 'bicanhselect') {
                const dungeonId = parts.slice(1, -1).join('_'); // Ghép lại vì dungeon_id có underscore
                const dungeon = dungeons_1.DUNGEONS[dungeonId];
                if (!dungeon) {
                    await interaction.reply({ content: '❌ Bí Cảnh này không tồn tại!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Kiểm tra số lượt khiêu chiến hàng ngày
                const now = Math.floor(Date.now() / 1000);
                const cd = database_1.default.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
                    .get(targetUserId, dungeonId);
                let entriesToday = 0;
                if (cd) {
                    const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
                    if (cdDate === new Date().toDateString()) {
                        entriesToday = cd.daily_entries;
                    }
                }
                if (entriesToday >= dungeon.maxDailyEntries) {
                    await interaction.reply({
                        content: `❌ Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)`,
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                // Xác định độ khó ngẫu nhiên
                const difficulties = ['dễ', 'thường', 'khó', 'ác_mộng'];
                const randDiff = Math.random();
                let difficulty = 'thường';
                if (randDiff < 0.20)
                    difficulty = 'dễ';
                else if (randDiff < 0.65)
                    difficulty = 'thường';
                else if (randDiff < 0.90)
                    difficulty = 'khó';
                else
                    difficulty = 'ác_mộng';
                // Chọn ngẫu nhiên thế thủ của quái vật
                const monsterActions = ['shield', 'sword', 'talisman'];
                const monsterAction = monsterActions[Math.floor(Math.random() * monsterActions.length)];
                let hintText = '';
                if (monsterAction === 'shield') {
                    hintText = `🛡️ **Thủ Vệ Động:** Quái vật đang ngưng tụ kim quang bao phủ cơ thể, chuẩn bị đỡ đòn bằng **Hộ Thể** (Shield). Đạo hữu sẽ ra chiêu gì khắc chế?`;
                }
                else if (monsterAction === 'sword') {
                    hintText = `⚔️ **Kiếm Ánh:** Quái vật vung thanh tàn kiếm, thân kiếm run rẩy tạo ra tiếng rít xé gió chuẩn bị phóng ra **Kiếm Pháp** (Sword). Đạo hữu định phản ứng ra sao?`;
                }
                else {
                    hintText = `📜 **Linh Phù:** Quái vật giơ cao một tấm bùa lục cổ xưa đen kịt, linh văn u ám nhảy múa chuẩn bị giáng xuống **Phù Pháp** (Talisman). Đạo hữu định làm gì?`;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`🔮 BÍ CẢNH QUYẾT SÁCH: ${dungeon.name}`)
                    .setColor(uiSystem_2.EMBED_COLORS.ORANGE)
                    .setDescription(`⚔️ **Độ khó ngẫu nhiên:** **${difficulty.toUpperCase()}**\n\n` +
                    `${hintText}\n\n` +
                    `*Khắc chế:* **Tấn Công** khắc Hộ Thể | **Thi Pháp** khắc Kiếm Pháp | **Phòng Thủ** khắc Phù Pháp.\n` +
                    `• Chọn **Đúng**: Nhận buff **+50% Công & Thủ** trong trận đấu.\n` +
                    `• Chọn **Sai**: Quái vật tăng **+100% Công Kích** tàn sát đạo hữu!`)
                    .setFooter({ text: 'Hãy phản xạ nhanh nhạy để đắc thắng!' })
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:atk_${targetUserId}`)
                    .setLabel('⚔️ Tấn Công')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:spell_${targetUserId}`)
                    .setLabel('📜 Thi Pháp')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`bicanhreact_${dungeonId}:${difficulty}:${monsterAction}:def_${targetUserId}`)
                    .setLabel('🛡️ Phòng Thủ')
                    .setStyle(discord_js_1.ButtonStyle.Danger));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: PHẢN ỨNG RA CHIÊU BÍ CẢNH (Thực chiến quyết định) ---
            else if (action === 'bicanhreact') {
                const customId = interaction.customId;
                const firstUnderscoreIdx = customId.indexOf('_');
                const lastUnderscoreIdx = customId.lastIndexOf('_');
                const middle = customId.substring(firstUnderscoreIdx + 1, lastUnderscoreIdx);
                const middleParts = middle.split(':');
                const dungeonId = middleParts[0];
                const difficulty = middleParts[1];
                const monsterAction = middleParts[2];
                const playerChoice = middleParts[3]; // 'atk', 'spell', 'def'
                let correct = false;
                if (playerChoice === 'atk' && monsterAction === 'shield')
                    correct = true;
                else if (playerChoice === 'spell' && monsterAction === 'sword')
                    correct = true;
                else if (playerChoice === 'def' && monsterAction === 'talisman')
                    correct = true;
                const playerBuff = correct;
                const monsterBuff = !correct;
                // A2: Query equipped skills for skill selection
                const equippedSkills = database_1.default.prepare('SELECT skill_id FROM user_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY equipped_slot ASC').all(targetUserId);
                const selectedSkillIndex = equippedSkills.length > 1 ? 0 : undefined;
                // Thực hiện khiêu chiến bí cảnh thực sự
                const result = CombatService_1.combatService.challengeDungeon(targetUserId, dungeonId, difficulty, playerBuff, monsterBuff, selectedSkillIndex);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const combatResult = result.combatResult;
                CombatLogsCache_1.combatLogsCache.set(targetUserId, { data: combatResult.log, timestamp: Date.now() });
                // Nạp năng lượng cho Linh mạch Chiến Đấu
                LeylineService_1.leylineService.addEnergy(targetUserId, 'chiendau', 15);
                const isWin = result.message === 'Chiến Thắng';
                const color = isWin ? '#2ecc71' : uiSystem_2.EMBED_COLORS.ERROR;
                const title = isWin ? '⚔️ VIỄN CỔ CHIẾN THẮNG ⚔️' : '💀 BẠI VONG TRONG BÍ CẢNH 💀';
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(title)
                    .setColor(color)
                    .setTimestamp();
                const dungeon = dungeons_1.DUNGEONS[dungeonId];
                const monsterName = dungeon?.monster.name || 'quái thú';
                let reactionFeedback = '';
                if (correct) {
                    reactionFeedback = `🔮 **Khắc chế thành công!** Đạo hữu đọc hiểu thế công của quái vật, vung chiêu khắc chế hoàn mỹ! Nhận **+50% ATK & DEF** trong trận chiến.`;
                }
                else {
                    const monsterChoiceName = monsterAction === 'shield' ? 'Hộ Thể' : monsterAction === 'sword' ? 'Kiếm Pháp' : 'Phù Pháp';
                    reactionFeedback = `❌ **Phán đoán sai lầm!** Quái vật dùng **${monsterChoiceName}** nhưng đạo hữu phản ứng lỗi, bị quái vật rình rập đột kích nâng **+100% ATK** ăn hành ngập mồm!`;
                }
                if (isWin) {
                    const rewards = result.rewards;
                    const lootsText = rewards.loots.length > 0
                        ? rewards.loots.map(l => `🎁 **${l.name}** x${l.quantity}`).join('\n')
                        : '*Không có vật phẩm nào rơi ra.*';
                    let artifactLine = '';
                    if (result.artifactMessage) {
                        artifactLine = `\n• ${result.artifactMessage}`;
                    }
                    embed.setDescription(`${reactionFeedback}\n\n` +
                        `Đạo hữu đã xuất chiêu tiêu diệt thành công **${monsterName}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
                        `🍀 **Phần Thưởng Nhận Được (Độ khó: ${difficulty.toUpperCase()}):**\n` +
                        `• Tích lũy thêm: **+${rewards.exp}** Tu Vi 🌿\n` +
                        `• Nhặt được: **+${rewards.coins}** Hạ Phẩm Linh Thạch 🟤${artifactLine}\n\n` +
                        `📦 **Chiến Lợi Phẩm:**\n${lootsText}\n\n` +
                        `*Lượt khiêu chiến phó bản này hôm nay còn lại: **${result.dailyEntriesLeft}** lượt.*`);
                }
                else if (result.message === 'Tử Vong') {
                    const expLost = result.rewards?.exp || 0;
                    const coinsLost = result.rewards?.coins || 0;
                    const dropText = result.artifactMessage ? `\n⚠️ **Kiếp Nạn:** ${result.artifactMessage}` : '';
                    embed.setTitle('💀 HỒN PHI PHÁCH TÁN')
                        .setColor(uiSystem_2.EMBED_COLORS.NEUTRAL)
                        .setDescription(`${reactionFeedback}\n\n` +
                        `☠️ Đạo hữu quá yếu ớt, đã bị **${monsterName}** tung chiêu chí mạng đánh **Tử Vong** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
                        `💔 **Tổn Thất Đại Nạn:**\n` +
                        `• Hao hụt Tu Vi: **-${expLost}** XP\n` +
                        `• Thất thoát Linh Thạch: **-${coinsLost}** Hạ Phẩm Linh Thạch\n` +
                        `• Thương tích nặng nề: **-100** Thể Lực\n` +
                        `• Trạng thái: **Trọng Thương trong 45 phút**${dropText}\n\n` +
                        `💡 *Đại nạn không chết ắt có hậu phúc. Hãy tĩnh dưỡng, chế tạo pháp bảo hộ thân trước khi khiêu chiến lại.*`);
                }
                else {
                    embed.setDescription(`${reactionFeedback}\n\n` +
                        `Đạo hữu cự địch thất bại, kiệt lực chiến bại vong dưới tay **${monsterName}** sau **${combatResult.rounds}** hiệp đấu!\n\n` +
                        `💡 *Hãy tĩnh tọa tích lũy thêm tu vi, đột phá cảnh giới lớn hoặc chế trang bị xịn để phục thù.*`);
                }
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`bicanhlogs_${targetUserId}`)
                    .setLabel('📖 Nhật Ký Chiến Đấu')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`bicanhback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Bí Cảnh')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                // Cập nhật tiến trình nhiệm vụ hàng ngày khi hoàn thành bí cảnh
                DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_bicanh', 1);
                QuestChainService_1.questChainService.updateProgress(targetUserId, 'kill', 1);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: XEM NHẬT KÝ CHIẾN ĐẤU BÍ CẢNH ---
            else if (action === 'bicanhlogs') {
                const { renderCombatLog } = require('../../utils/combatLogUtils');
                await renderCombatLog(interaction, CombatLogsCache_1.combatLogsCache.get(targetUserId)?.data, 'Chi tiết nhật ký trận đấu');
            }
            // --- Nút: QUAY LẠI BÍ CẢNH ---
            else if (action === 'bicanhback') {
                const embed = (0, bicanh_1.getDungeonEmbed)(targetUserId);
                const row = (0, bicanh_1.getDungeonComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: ĐI ĐẾN NGỘ Ý CẢNH (từ hồ sơ) ---
            else if (action === 'ycanhnaav') {
                const embed = (0, ycanh_1.getYCanhEmbed)(targetUserId);
                const row = (0, ycanh_1.getYCanhComponents)(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row, backRow]);
            }
            // --- Nút: ĐI ĐẾN LUÂN HỒI (từ hồ sơ) ---
            else if (action === 'luanhoinnav') {
                const embed = (0, luanhoi_1.getLuanHoiEmbed)(targetUserId);
                const row = (0, luanhoi_1.getLuanHoiComponents)(targetUserId, true);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row, backRow]);
            }
            // --- Nút: ĐI ĐẾN SỦNG THÚ (từ hồ sơ) ---
            else if (action === 'sungthunaav') {
                const embed = (0, sungthu_1.getSungThuEmbed)(targetUserId);
                const rows = (0, sungthu_1.getSungThuComponents)(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                const rowsArr = Array.isArray(rows) ? rows : [rows];
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...rowsArr, backRow]);
            }
            // --- Nút: PHÂN TRANG SỦNG THÚ ---
            else if (action === 'sungthu') {
                const page = parseInt(parts[1], 10) || 1;
                const embed = (0, sungthu_1.getSungThuEmbed)(targetUserId, page);
                const rows = (0, sungthu_1.getSungThuComponents)(targetUserId, page);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                const rowsArr = Array.isArray(rows) ? rows : [rows];
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...rowsArr, backRow]);
            }
            // --- Nút: ĐI ĐẾN SĂN YÊU THÚ (từ hồ sơ) ---
            else if (action === 'sanyeuthunaav') {
                // Hai trường hợp:
                //  customId: sanyeuthunaav_<userId>         -> mở menu xác nhận
                //  customId: sanyeuthunaav_go_<userId>     -> chạy săn ngay (giữ cho tương lai)
                const subAction = parts[1];
                if (subAction === 'go') {
                    // Thực thi săn ngay
                    const huntResult = (0, sanyeuthu_1.performHunt)(targetUserId);
                    // Re-render hunt menu
                    const embed = (0, sanyeuthu_1.getSanYeuThuEmbed)(targetUserId);
                    const rows = (0, sanyeuthu_1.getSanYeuThuComponents)(targetUserId);
                    await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                    if (!huntResult.success) {
                        await interaction.followUp({ content: `❌ ${huntResult.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    if (huntResult.combatLog) {
                        CombatLogsCache_1.combatLogsCache.set(targetUserId, { data: huntResult.combatLog, timestamp: Date.now() });
                    }
                    const { ActionRowBuilder: LocalActionRow, ButtonBuilder: LocalButton, ButtonStyle: LocalStyle } = require('discord.js');
                    const huntRows = [];
                    if (huntResult.encounter) {
                        const row = new LocalActionRow();
                        huntResult.encounter.choices.forEach((c, idx) => {
                            row.addComponents(new LocalButton()
                                .setCustomId(`encounter_${huntResult.encounter.id}_${idx}_${targetUserId}`)
                                .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
                                .setStyle(LocalStyle.Primary));
                        });
                        huntRows.push(row);
                    }
                    const logRow = new LocalActionRow();
                    logRow.addComponents(new LocalButton()
                        .setCustomId(`sanyeuthulogs_${targetUserId}`)
                        .setLabel('📖 Nhật Ký Chiến Đấu')
                        .setStyle(LocalStyle.Primary));
                    huntRows.push(logRow);
                    await interaction.followUp((0, uiSystem_1.toV2Payload)([huntResult.embed], huntRows, discord_js_1.MessageFlags.Ephemeral));
                }
                else {
                    // Mở menu săn yêu thú (màn hình xác nhận)
                    const embed = (0, sanyeuthu_1.getSanYeuThuEmbed)(targetUserId);
                    const rows = (0, sanyeuthu_1.getSanYeuThuComponents)(targetUserId);
                    await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                }
            }
            // --- Nút: ĐI ĐẾN TRANG BỊ (từ hồ sơ) ---
            else if (action === 'trangbinaav') {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🛡️ TRANG BỊ ĐIỀN KỸ')
                    .setColor(uiSystem_2.EMBED_COLORS.DARK_PURPLE)
                    .setDescription(`Kho trang bị tu luyện giúp đạo hữu gia tăng chiến lực toàn diện.\n\n` +
                    `🔧 **Các tính năng khả dụng:**\n` +
                    `• 🔍 **Giám Định** — Phôi rèn đúc thành trang bị xịn (phí 50 Linh Thạch)\n` +
                    `• ♻️ **Phân Giải** — Trang bị không dùng thu hồi thành Mảnh Trang Bị\n` +
                    `• ⭐ **Nâng Sao** — Cường hóa trang bị đang mặc (+20% chỉ số/sao, max 5 sao)\n` +
                    `• 🧩 **Ghép Trang Bị** — Ghép Mảnh thành trang bị S/SS/SSS\n\n` +
                    `*Hãy chọn hành động bên dưới để tiếp tục.*`)
                    .setFooter({ text: 'Quản lý qua slash command: /trangbi giamdinh | phangiai | nangsao | ghep' })
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`tuido_${targetUserId}`)
                    .setLabel('💼 Mở Túi Đồ')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: ĐI ĐẾN QUYẾT ĐẤU (từ hồ sơ) ---
            else if (action === 'quyetau') {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⚔️ QUYẾT ĐẤU LINH THẠCH')
                    .setColor(uiSystem_2.EMBED_COLORS.ERROR)
                    .setDescription(`Khiêu chiến người chơi khác quyết đấu kéo búa bao (oẳn tù tì) đặt cược Linh Thạch.\n\n` +
                    `🔮 **Quy luật khắc chế ngũ hành:**\n` +
                    `• ⚔️ **Kiếm Pháp** chém rách 📜 **Phù Pháp**\n` +
                    `• 📜 **Phù Pháp** phong ấn 🛡️ **Hộ Thể**\n` +
                    `• 🛡️ **Hộ Thể** chống đỡ ⚔️ **Kiếm Pháp**\n\n` +
                    `🪙 **Đặt cược:** Hai bên cược **bằng nhau**, người thắng nhận 95% (5% thuế tông môn).\n` +
                    `⏳ **Thời gian ứng chiến:** 60 giây.\n\n` +
                    `*Sử dụng lệnh: \`/quyetau tuser: @ai_đó cuoc: 100\` để gửi thư khiêu chiến.*`)
                    .setFooter({ text: 'Lưu ý: Cả hai bên phải có đủ Linh Thạch đặt cược.' })
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Nút: ĐI ĐẾN LEO THÁP (từ hồ sơ) ---
            else if (action === 'leothapnav') {
                const embed = (0, leothap_1.getTowerEmbed)(targetUserId);
                const rows = (0, leothap_1.getTowerComponents)(targetUserId);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                const rowsArr = Array.isArray(rows) ? rows : [rows];
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...rowsArr, backRow]);
            }
            // --- Nút: CHẤP NHẬN / TỪ CHỐI KẾT HÔN ---
            else if (action === 'marriageaccept' || action === 'marriagerefuse') {
                const proposerId = parts[1];
                const targetId = parts[2];
                if (action === 'marriagerefuse') {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, `💔 Đạo hữu <@${targetId}> đã uyển chuyển từ chối lời cầu hôn của <@${proposerId}>. Duyên phận chưa tới!`);
                    return;
                }
                // Chấp nhận
                const { marriageService } = require('../../services/MarriageService');
                const result = marriageService.acceptProposal(proposerId, targetId);
                if (result.success) {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, result.message);
                }
                else {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, `❌ Cầu hôn thất bại: ${result.message}`);
                }
            }
            // --- Nút: GUILD WAR - TẤN CÔNG / LÀM MỚI ---
            else if (action === 'guildwar') {
                const gwAction = parts[1];
                const warId = parts[2];
                if (gwAction === 'attack') {
                    const result = GuildWarService_1.guildWarService.attack(warId, targetUserId);
                    if (!result.success) {
                        await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    await interaction.reply({ content: result.message });
                }
                else if (gwAction === 'refresh') {
                    const war = GuildWarService_1.guildWarService.getWarDetail(warId);
                    if (!war) {
                        await interaction.reply({ content: '❌ Cuộc chiến không tồn tại!', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const challengerSect = GuildWarService_1.guildWarService.getSectInfo(war.challenger_sect_id);
                    const defenderSect = GuildWarService_1.guildWarService.getSectInfo(war.defender_sect_id);
                    let statusText = '';
                    let color = '#3498db';
                    if (war.status === 'active') {
                        const turnOrder = JSON.parse(war.turn_order || '[]');
                        const currentTurnUserId = turnOrder[war.current_turn_index];
                        const currentUser = currentTurnUserId ? UserRepository_1.userRepository.get(currentTurnUserId) : null;
                        statusText = `⚔️ **ĐANG CHIẾN ĐẤU**\n\n` +
                            `**${challengerSect?.name}**: ${war.challenger_hp}❤️\n` +
                            `**${defenderSect?.name}**: ${war.defender_hp}❤️\n\n` +
                            `Hiệp: **${war.current_round}/${war.max_rounds}**\n` +
                            `Đến lượt: **${currentUser?.name || 'Không xác định'}**`;
                        color = uiSystem_2.EMBED_COLORS.ERROR;
                    }
                    else if (war.status === 'pending') {
                        statusText = `⏳ **Chờ phản hồi từ ${defenderSect?.name}...**`;
                        color = '#f39c12';
                    }
                    else {
                        statusText = `🏆 **Chiến tranh kết thúc!**`;
                        color = '#2ecc71';
                    }
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`⚔️ ${challengerSect?.name} vs ${defenderSect?.name}`)
                        .setColor(color)
                        .setDescription(statusText +
                        `\n\n_Dùng \`/guildwar thongtin\` để xem chi tiết đầy đủ._`)
                        .setTimestamp();
                    await (0, uiSystem_1.safeV2Update)(interaction, [embed], []);
                }
            }
            // --- Nút: TẤN CÔNG TÔNG MÔN CHIẾN (Sect War) ---
            else if (action === 'sectwarattack') {
                const { sectWarService } = require('../../services/SectWarService');
                const battleId = parseInt(parts[1], 10);
                const result = sectWarService.attack(battleId, targetUserId);
                await interaction.reply({ content: result.message, flags: !result.success ? discord_js_1.MessageFlags.Ephemeral : undefined });
                return;
            }
            // --- Nút: LÀM MỚI TÔNG MÔN CHIẾN ---
            else if (action === 'sectwarrefresh') {
                const { sectWarService } = require('../../services/SectWarService');
                const battleId = parseInt(parts[1], 10);
                const battle = sectWarService.getBattleDetails(battleId);
                if (!battle) {
                    await interaction.reply({ content: '❌ Trận chiến không tồn tại!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`⚔️ Tông Môn Chiến #${battle.id}`)
                    .setColor(uiSystem_2.EMBED_COLORS.ERROR)
                    .setDescription(`**Trạng thái:** ${battle.status === 'active' ? 'Đang chiến' : 'Kết thúc'}\n` +
                    `**Vòng:** ${battle.current_round}/${battle.max_rounds}\n` +
                    `**Sect A:** ${battle.sect_a_id} (HP: ${battle.sect_a_hp})\n` +
                    `**Sect B:** ${battle.sect_b_id} (HP: ${battle.sect_b_hp})\n` +
                    `**Sect C:** ${battle.sect_c_id} (HP: ${battle.sect_c_hp})\n\n` +
                    `Dùng \`/combat sectwar tancong\` để tham chiến!`)
                    .setTimestamp();
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], []);
                return;
            }
            // --- Nút: ĐI ĐẾN TỌA KỴ (từ hồ sơ) ---
            else if (action === 'toakynav') {
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user) {
                    await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const mounts = MountService_1.mountService.getMounts(targetUserId);
                const active = MountService_1.mountService.getActiveMount(targetUserId);
                const ropeInv = database_1.default.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(targetUserId, 'thung_bat_thu');
                const ropesCount = ropeInv ? ropeInv.quantity : 0;
                const feedableItems = database_1.default.prepare(`
          SELECT i.id as inv_id, i.item_id, item.name, item.rarity, i.quantity
          FROM inventories i
          JOIN items item ON i.item_id = item.id
          WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
          ORDER BY i.quantity DESC
          LIMIT 5
        `).all(targetUserId);
                const { embed, totalPages } = (0, toaky_1.getMountListEmbed)(user, mounts, active, ropesCount, feedableItems, 1);
                const components = (0, toaky_1.getMountListComponents)(targetUserId, 1, totalPages);
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...components, backRow]);
            }
            // --- Nút: SỬA CHỮA TRANG BỊ (từ /suachua danhsach) ---
            else if (action === 'suachua') {
                const subAction = parts[1]; // 'all'
                if (subAction === 'all') {
                    const { handleRepairAllButton } = require('../../commands/general/suachua');
                    const result = handleRepairAllButton(targetUserId);
                    await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
                }
                return;
            }
            // --- Nút: ĐÁNH THỨC LINH KHÍ (Spirit Weapon Interact) ---
            else if (action === 'spiritinteract') {
                const { spiritWeaponService } = require('../../services/SpiritWeaponService');
                const result = spiritWeaponService.interact(targetUserId);
                await interaction.reply({ content: result.message, flags: !result.success ? discord_js_1.MessageFlags.Ephemeral : undefined });
                return;
            }
            // --- Nút: ĐI ĐẾN KHÍ LINH (từ hồ sơ) ---
            else if (action === 'spiritnav') {
                const { spiritWeaponService } = require('../../services/SpiritWeaponService');
                const weapons = spiritWeaponService.getSpiritWeapons(targetUserId);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⚡ KHÍ LINH - PHÁP BẢO THỨC TỈNH')
                    .setColor(uiSystem_2.EMBED_COLORS.MYSTIC)
                    .setDescription('Trang bị Epic+ có thể thức tỉnh khí linh, cung cấp skill bị động chiến đấu.');
                if (weapons.length > 0) {
                    for (const sw of weapons) {
                        const affinityBar = '❤️'.repeat(Math.min(sw.affinity, 5)) + '🖤'.repeat(Math.max(0, 5 - sw.affinity));
                        embed.addFields({
                            name: `⚡ ${sw.spirit_name} (Cấp ${sw.level})`,
                            value: `📊 Thân thiết: ${affinityBar}\n🔮 Skill: **${sw.skill_id || 'Chưa học'}**\nDùng \`/khilinh tungduong\` để tương tác.`,
                        });
                    }
                }
                else {
                    embed.addFields({ name: '📭 Chưa có', value: 'Chưa thức tỉnh khí linh nào. Dùng `/khilinh thuctinh` trên trang bị Epic+.' });
                }
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`hosoback_${targetUserId}`)
                    .setLabel('🔙 Quay Lại Hồ Sơ')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row]);
            }
            // --- Select Menu: ANKY_SELECT (ấn ký) ---
            else if (action === 'anky_select' && interaction.isStringSelectMenu()) {
                const inventoryId = parseInt(interaction.values[0], 10);
                const { soulImprintService } = require('../../services/SoulImprintService');
                const result = soulImprintService.imprintItem(targetUserId, inventoryId);
                if (result.success) {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, `✅ ${result.message}`);
                }
                else {
                    await (0, uiSystem_1.safeV2TextUpdate)(interaction, `❌ ${result.message}`);
                }
            }
            // --- Select Menu: THAM GIA TÔNG MÔN ---
            else if (action === 'sectjoinselect' && interaction.isStringSelectMenu()) {
                const sectId = parseInt(interaction.values[0], 10);
                const result = SectService_1.sectService.joinSect(targetUserId, sectId);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Select Menu: QUYÊN GÓP TÔNG MÔN ---
            else if (action === 'sectdonateselect' && interaction.isStringSelectMenu()) {
                const amount = parseInt(interaction.values[0], 10);
                const result = SectService_1.sectService.donateToSect(targetUserId, amount);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Cập nhật tiến trình nhiệm vụ hàng ngày khi quyên góp tông môn
                DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_tongmon', 1);
                // Nạp năng lượng Linh Mạch Tông Môn (phụ thuộc vào số tiền donate)
                LeylineService_1.leylineService.addEnergy(targetUserId, 'tongmon', Math.max(10, Math.floor(amount / 5)));
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Modal: TẠO TÔNG MÔN ---
            else if (action === 'sectcreate' && interaction.isModalSubmit()) {
                const name = interaction.fields.getTextInputValue('sect_name');
                const desc = interaction.fields.getTextInputValue('sect_desc');
                const result = SectService_1.sectService.createSect(targetUserId, name, desc);
                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = (0, tongmon_1.getSectEmbed)(targetUserId);
                const components = (0, tongmon_1.getSectComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            // --- Nút: ĐI ĐẾN ĐẤU TRƯỜNG (từ hồ sơ) ---
            else if (action === 'arenanav') {
                const embed = (0, arena_1.getArenaProfileEmbed)(targetUserId);
                if (!embed) {
                    await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const comps = (0, arena_1.getArenaProfileComponents)(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], comps);
            }
            // --- Nút: TÌM ĐỐI THỦ ĐẤU TRƯỜNG ---
            else if (action === 'arena_find') {
                const opponentId = ArenaService_1.arenaService.getMatchmaking(targetUserId);
                if (!opponentId) {
                    await interaction.reply({ content: '❌ Đấu trường hiện tại vắng lặng, không tìm thấy đối thủ nào! Hãy quay lại sau.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const oUser = UserRepository_1.userRepository.get(opponentId);
                if (!oUser) {
                    await interaction.reply({ content: '❌ Đối thủ bỗng nhiên bốc hơi, vui lòng thử lại.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const user = UserRepository_1.userRepository.get(targetUserId);
                const oldChallengerProfile = ArenaService_1.arenaService.getProfile(targetUserId);
                const oldOpponentProfile = ArenaService_1.arenaService.getProfile(opponentId);
                const matchResult = ArenaService_1.arenaService.challenge(targetUserId, opponentId);
                if (!matchResult.success || !matchResult.result) {
                    await interaction.reply({ content: `❌ ${matchResult.message || 'Lỗi khiêu chiến!'}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const newChallengerProfile = ArenaService_1.arenaService.getProfile(targetUserId);
                const eloDiff = newChallengerProfile.elo - oldChallengerProfile.elo;
                const isWin = matchResult.result.winner === 'player';
                const logText = matchResult.result.log.join('\n');
                const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(logText, 'utf-8'), { name: 'combat_log.txt' });
                let resultText = '';
                if (isWin) {
                    resultText = `🎉 **CHIẾN THẮNG!** Đạo hữu đã đánh bại **${oUser.name}**.\n📈 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (+${eloDiff})`;
                    if (matchResult.artifactMessage) {
                        resultText += `\n\n${matchResult.artifactMessage}`;
                    }
                }
                else {
                    resultText = `💀 **THẤT BẠI!** Đạo hữu đã gục ngã trước **${oUser.name}**.\n📉 **ELO:** ${oldChallengerProfile.elo} ➔ **${newChallengerProfile.elo}** (${eloDiff})`;
                }
                const comp = (0, v2Components_1.container)(isWin ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
                    (0, v2Components_1.header)('⚔️ KẾT QUẢ ĐẤU TRƯỜNG'),
                    (0, v2Components_1.body)(`**${user.name}** (ELO: ${oldChallengerProfile.elo}) 🆚 **${oUser.name}** (ELO: ${oldOpponentProfile.elo})\n\n${resultText}`),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)([
                        (0, v2Components_1.statLine)('Trận chiến kéo dài', `${matchResult.result.rounds} hiệp`),
                        (0, v2Components_1.statLine)('Tổng sát thương', `${matchResult.result.totalDamageDealt}`),
                    ].join('\n')),
                    (0, v2Components_1.separator)(),
                    (0, v2Components_1.body)('Chi tiết trận đấu được đính kèm trong file.'),
                ]);
                const nextRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`arena_find_${targetUserId}`).setLabel('⚡ Tìm Tiếp').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`arenanav_${targetUserId}`).setLabel('🔙 Đấu Trường').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Danger));
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ embeds: [comp], components: [nextRow], files: [attachment] });
                }
                else {
                    await interaction.reply({ embeds: [comp], components: [nextRow], files: [attachment] });
                }
            }
            // --- Nút: LỊCH SỬ ĐẤU TRƯỜNG ---
            else if (action === 'arena_history') {
                const history = database_1.default.prepare(`
          SELECT * FROM arena_history 
          WHERE challenger_id = ? OR opponent_id = ?
          ORDER BY created_at DESC 
          LIMIT 5
        `).all(targetUserId, targetUserId);
                if (history.length === 0) {
                    await interaction.reply({ content: '📭 Đạo hữu chưa tham gia trận đấu nào.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                let desc = '';
                for (const h of history) {
                    const isChallenger = h.challenger_id === targetUserId;
                    const isWin = h.winner_id === targetUserId;
                    const opponentId = isChallenger ? h.opponent_id : h.challenger_id;
                    const oUser = UserRepository_1.userRepository.get(opponentId);
                    const oName = oUser ? oUser.name : 'Vô Danh';
                    const resultIcon = isWin ? '✅ Thắng' : '❌ Thua';
                    const eloMod = isWin ? `+${h.elo_change}` : `-${h.elo_change}`;
                    const timeStr = `<t:${h.created_at}:R>`;
                    desc += `**${resultIcon}** vs **${oName}** (${eloMod} ELO) - ${timeStr}\n`;
                }
                const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [
                    (0, v2Components_1.header)('📜 Lịch Sử Đấu Trường (5 Trận Gần Nhất)'),
                    (0, v2Components_1.body)(desc),
                ]);
                const nextRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`arenanav_${targetUserId}`).setLabel('🔙 Đấu Trường').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Danger));
                await (0, uiSystem_1.safeV2Update)(interaction, [comp], [nextRow]);
            }
            // --- Nút: BẢNG XẾP HẠNG ĐẤU TRƯỜNG ---
            else if (action === 'arena_top') {
                const topPlayers = ArenaService_1.arenaService.getLeaderboard(10);
                if (topPlayers.length === 0) {
                    await interaction.reply({ content: '📭 Bảng xếp hạng Đấu Trường hiện tại trống rỗng.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                let description = '';
                topPlayers.forEach((p, index) => {
                    let rankIcon = '🏅';
                    if (index === 0)
                        rankIcon = '🥇';
                    else if (index === 1)
                        rankIcon = '🥈';
                    else if (index === 2)
                        rankIcon = '🥉';
                    description += `**${rankIcon} #${index + 1}** | **${p.name}**\n`;
                    description += `└─ 🏆 ELO: **${p.elo}** | ⚔️ W/L: ${p.wins}/${p.losses} | 🔥 Chuỗi: ${p.win_streak}\n\n`;
                });
                const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, [
                    (0, v2Components_1.header)('🏆 BẢNG XẾP HẠNG ĐẤU TRƯỜNG (TOP 10)'),
                    (0, v2Components_1.body)(description),
                ]);
                const nextRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`arenanav_${targetUserId}`).setLabel('🔙 Đấu Trường').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Danger));
                await (0, uiSystem_1.safeV2Update)(interaction, [comp], [nextRow]);
            }
            // --- Nút: CHỌN THẺ CHÚC PHÚC LEO THÁP (Card Draft) ---
            else if (action === 'leothapcard') {
                // customId: leothapcard_cardId_here_userId → reconstruct cardId from parts[1..end-1]
                const cardId = parts.slice(1, parts.length - 1).join('_');
                const res = (0, leothap_1.selectTowerCard)(targetUserId, cardId);
                if (res.success) {
                    const comps = (0, leothap_1.getTowerComponents)(targetUserId);
                    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                    await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], [...comps, backRow]);
                }
                else {
                    await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], []);
                }
            }
            // --- Nút: TƯƠNG TÁC LEO THÁP (Khiêu Chiến & Khởi Đầu) ---
            else if (action === 'leothap') {
                const subAction = parts[1]; // 'khieuchien' or 'khoidau'
                if (subAction === 'khieuchien') {
                    const res = (0, leothap_1.performTowerChallenge)(targetUserId);
                    const comps = (0, leothap_1.getTowerComponents)(targetUserId);
                    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                    if (res.draftCards && res.draftCards.length > 0) {
                        // BIG UPDATE §1: Show card draft buttons
                        const cardRow = new discord_js_1.ActionRowBuilder();
                        for (const card of res.draftCards) {
                            cardRow.addComponents(new discord_js_1.ButtonBuilder()
                                .setCustomId(`leothapcard_${card.id}_${targetUserId}`)
                                .setLabel(`${card.emoji} ${card.name}`)
                                .setStyle(discord_js_1.ButtonStyle.Primary));
                        }
                        await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], [cardRow]);
                    }
                    else if (res.message && (res.message.includes('Suối Linh') || res.message.includes('Lễ Hộp') || res.message.includes('Tiệm Tỳ Bà') || res.message.includes('Cờ Tỷ Phú'))) {
                        const nextRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`leothapnav_${targetUserId}`).setLabel('➡️ Tiếp Tục Tháp').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                        await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], [nextRow]);
                    }
                    else {
                        await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], [...comps, backRow]);
                    }
                }
                else if (subAction === 'khoidau') {
                    const res = (0, leothap_1.performTowerReset)(targetUserId);
                    const comps = (0, leothap_1.getTowerComponents)(targetUserId);
                    const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
                    await (0, uiSystem_1.safeV2Update)(interaction, [res.embed], [...comps, backRow]);
                }
            }
        }
        catch (error) {
            console.error('[SocialHandler] Lỗi xử lý:', error);
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
exports.SocialHandler = SocialHandler;
