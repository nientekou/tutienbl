"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNavigationAction = handleNavigationAction;
const discord_js_1 = require("discord.js");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const InventoryService_1 = require("../../services/InventoryService");
const MountService_1 = require("../../services/MountService");
const hoso_1 = require("../../commands/general/hoso");
const toaky_1 = require("../../commands/general/toaky");
const khilinh_1 = require("../../commands/general/khilinh");
const thanhtuu_1 = require("../../commands/general/thanhtuu");
const uiSystem_1 = require("../../utils/uiSystem");
const itemConstants_1 = require("../../config/itemConstants");
const constants_1 = require("../../utils/constants");
const database_1 = __importDefault(require("../../database/database"));
async function handleNavigationAction(interaction, action, parts, userId) {
    try {
        const targetUserId = userId;
        if (action === 'hosotab' || action === 'hosolb') {
            const { ProfileInteractionHandler } = require('../interactions/ProfileInteractionHandler');
            await ProfileInteractionHandler.handle(interaction, action, parts, targetUserId);
            return;
        }
        if (action === 'hosoback') {
            const embed = (0, hoso_1.getHoSoTabEmbed)(targetUserId, 'chiso');
            const rows = (0, hoso_1.getHoSoAllComponents)(targetUserId, 'chiso');
            await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
            return;
        }
        if (action === 'tuido') {
            try {
                await interaction.deferUpdate();
                const { embed, totalPages, itemsOnPage } = (0, hoso_1.getInventoryEmbed)(targetUserId, 1);
                const components = (0, hoso_1.getInventoryComponents)(targetUserId, 1, totalPages, itemsOnPage);
                await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            }
            catch (e) {
                console.error('[tuido] Lỗi mở túi đồ:', e?.message || e);
                try {
                    await interaction.editReply({ content: '❌ Lỗi mở túi đồ!' });
                }
                catch (_) { }
            }
            return;
        }
        if (action === 'invprev' || action === 'invnext') {
            const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
            try {
                await interaction.deferUpdate();
                const { embed, totalPages, itemsOnPage } = (0, hoso_1.getInventoryEmbed)(targetUserId, pageNum);
                const components = (0, hoso_1.getInventoryComponents)(targetUserId, pageNum, totalPages, itemsOnPage);
                await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            }
            catch (e) {
                console.error('[invpage] Lỗi phân trang túi đồ:', e?.message || e);
                try {
                    await interaction.editReply({ content: '❌ Lỗi phân trang!' });
                }
                catch (_) { }
            }
            return;
        }
        if (action === 'mountprev' || action === 'mountnext') {
            const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
            try {
                await interaction.deferUpdate();
                const mounts = MountService_1.mountService.getMounts(targetUserId);
                const active = MountService_1.mountService.getActiveMount(targetUserId);
                const ropeInv = database_1.default.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(targetUserId, 'thung_bat_thu');
                const ropesCount = ropeInv ? ropeInv.quantity : 0;
                const feedableItems = database_1.default.prepare(`
          SELECT i.id as inv_id, i.item_id, item.name, item.rarity, i.quantity
          FROM inventories i JOIN items item ON i.item_id = item.id
          WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
          ORDER BY i.quantity DESC LIMIT 5
        `).all(targetUserId);
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user)
                    return;
                const { embed, totalPages } = (0, toaky_1.getMountListEmbed)(user, mounts, active, ropesCount, feedableItems, pageNum);
                const components = (0, toaky_1.getMountListComponents)(targetUserId, pageNum, totalPages);
                await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            }
            catch (e) {
                console.error('[mountpage] Lỗi phân trang tọa kỵ:', e?.message || e);
                try {
                    await interaction.editReply({ content: '❌ Lỗi phân trang tọa kỵ!' });
                }
                catch (_) { }
            }
            return;
        }
        if (action === 'spiritprev' || action === 'spiritnext') {
            const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
            try {
                await interaction.deferUpdate();
                const { spiritWeaponService } = require('../../services/SpiritWeaponService');
                const spiritWeapons = spiritWeaponService.getSpiritWeapons(targetUserId);
                if (spiritWeapons.length === 0)
                    return;
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user)
                    return;
                const { embed, totalPages } = (0, khilinh_1.getSpiritListEmbed)(targetUserId, user, spiritWeapons, pageNum);
                const components = (0, khilinh_1.getSpiritListComponents)(targetUserId, pageNum, totalPages);
                await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            }
            catch (e) {
                console.error('[spiritpage] Lỗi phân trang khí linh:', e?.message || e);
                try {
                    await interaction.editReply({ content: '❌ Lỗi phân trang khí linh!' });
                }
                catch (_) { }
            }
            return;
        }
        if (action === 'achprev' || action === 'achnext') {
            const pageNum = Math.max(1, parseInt(parts[2], 10) || 1);
            try {
                await interaction.deferUpdate();
                const category = parts[1].replace(/\./g, '_');
                const { embed, totalPages } = (0, thanhtuu_1.getAchievementCategoryEmbed)(targetUserId, category, pageNum);
                const components = (0, thanhtuu_1.getAchievementCategoryComponents)(targetUserId, category, pageNum, totalPages);
                await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            }
            catch (e) {
                console.error('[achpage] Lỗi phân trang thành tựu:', e?.message || e);
                try {
                    await interaction.editReply({ content: '❌ Lỗi phân trang thành tựu!' });
                }
                catch (_) { }
            }
            return;
        }
        if (action === 'titleswitch') {
            const { achievementService } = require('../../services/AchievementService');
            const titleName = parts.slice(1).join('_').replace(/_/g, ' ');
            const result = achievementService.setTitle(targetUserId, titleName);
            await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (action === 'ngotinh_activate') {
            const buffId = parts[1];
            const targetUserIdFromParts = parts[2];
            if (interaction.user.id !== targetUserIdFromParts) {
                await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể kích hoạt buff!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const { ngoTinhService } = require('../../services/NgoTinhService');
            const result = ngoTinhService.activateBuff(targetUserIdFromParts, buffId);
            await interaction.reply({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (action === 'ngotinh_reroll_execute') {
            const rerollTargetUserId = parts[1];
            const lockElement = parts[2] === 'none' ? null : parts.slice(2).join('_');
            if (interaction.user.id !== rerollTargetUserId) {
                await interaction.reply({ content: '❌ Chỉ người sở hữu mới có thể reroll!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const user = UserRepository_1.userRepository.get(rerollTargetUserId);
            if (!user) {
                await interaction.reply({ content: '❌ Không tìm thấy nhân vật!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const baseCost = 20;
            const lockCost = lockElement ? 10 : 0;
            const totalCost = baseCost + lockCost;
            const ngotinh = user.ngotinh || 0;
            if (ngotinh < totalCost) {
                await interaction.reply({ content: `❌ Không đủ Ngộ Tính! Cần: ${totalCost}, Có: ${ngotinh}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            const elements = ['Hỏa', 'Thủy', 'Mộc', 'Thổ', 'Lôi', 'Phong'];
            let oldLinhCan = {};
            try {
                oldLinhCan = JSON.parse(user.linh_can || '{}');
            }
            catch { }
            let newLinhCan = {};
            if (lockElement && oldLinhCan[lockElement]) {
                const lockedValue = oldLinhCan[lockElement];
                const remaining = 100 - lockedValue;
                const otherElements = elements.filter(e => e !== lockElement);
                let allocated = 0;
                for (let i = 0; i < otherElements.length - 1; i++) {
                    const maxAlloc = remaining - allocated - (otherElements.length - 1 - i);
                    const val = Math.floor(Math.random() * Math.max(1, maxAlloc + 1));
                    newLinhCan[otherElements[i]] = val;
                    allocated += val;
                }
                newLinhCan[otherElements[otherElements.length - 1]] = remaining - allocated;
                newLinhCan[lockElement] = lockedValue;
            }
            else {
                let allocated = 0;
                for (let i = 0; i < elements.length - 1; i++) {
                    const maxAlloc = 100 - allocated - (elements.length - 1 - i);
                    const val = Math.floor(Math.random() * Math.max(1, maxAlloc + 1));
                    newLinhCan[elements[i]] = val;
                    allocated += val;
                }
                newLinhCan[elements[elements.length - 1]] = 100 - allocated;
            }
            UserRepository_1.userRepository.update(rerollTargetUserId, {
                linh_can: JSON.stringify(newLinhCan),
                ngotinh: ngotinh - totalCost
            });
            const oldFormatted = (0, constants_1.formatLinhCan)(JSON.stringify(oldLinhCan));
            const newFormatted = (0, constants_1.formatLinhCan)(JSON.stringify(newLinhCan));
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('💡 Reroll Linh Căn Thành Công!')
                .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
                .addFields({ name: '🔮 Linh Căn Cũ', value: oldFormatted }, { name: '✨ Linh Căn Mới', value: newFormatted }, { name: '💡 Chi Phí', value: `**${totalCost}** NT` });
            await interaction.reply({ embeds: [embed] });
            return;
        }
        if (action === 'pb') {
            const pbSub = parts[1];
            const pbType = parts[2];
            const { getBanMenhEmbed, getBanMenhComponents } = require('../../commands/general/phapbao');
            if (pbSub === 'bind' && pbType === 'nav') {
                const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                const eligible = inv.filter((i) => i.equipable === 1 && i.is_life_bound !== 1);
                if (eligible.length === 0) {
                    await interaction.reply({
                        content: '❌ Hành trang của đạo hữu không có trang bị/pháp bảo nào phù hợp để liên kết Huyết Tế!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🩸 TIẾN HÀNH HUYẾT TẾ BẢN MỆNH')
                    .setColor(uiSystem_1.EMBED_COLORS.ALERT)
                    .setDescription(`Hãy chọn một trang bị hoặc pháp bảo trong danh sách dưới đây để liên kết Huyết Tế với Nguyên Thần.\n\n` +
                    `⚠️ **Cảnh báo:** Vật phẩm được chọn sẽ trở thành Bản Mệnh, không thể giao dịch hay vứt bỏ!`)
                    .setTimestamp();
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`pb_bind_select_${targetUserId}`)
                    .setPlaceholder('Chọn trang bị để liên kết Huyết Tế');
                eligible.slice(0, 25).forEach((i) => {
                    const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
                    const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
                    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`${i.name}${starStr}${enhStr}`)
                        .setValue(String(i.id))
                        .setDescription(`[ID: ${i.id}] Phẩm chất: ${i.rarity.toUpperCase()}`));
                });
                const row1 = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`pb_banmenh_nav_${targetUserId}`)
                    .setLabel('🔙 Quay Lại')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row1, row2]);
            }
            else if (pbSub === 'bind' && pbType === 'select' && interaction.isStringSelectMenu()) {
                const inventoryId = parseInt(interaction.values[0], 10);
                const res = InventoryService_1.inventoryService.bindLifeArtifact(targetUserId, inventoryId);
                if (!res.success) {
                    await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = getBanMenhEmbed(targetUserId);
                const comps = getBanMenhComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], comps);
                await interaction.followUp({ content: `✅ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else if (pbSub === 'swap' && pbType === 'nav') {
                const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                const scroll = inv.find((i) => i.item_id === itemConstants_1.ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
                if (!scroll) {
                    await interaction.reply({
                        content: '❌ Đạo hữu cần có **Huyết Tế Ma Bảng** trong hành trang để tiến hành hoán đổi Bản Mệnh Pháp Bảo!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                const eligible = inv.filter((i) => i.equipable === 1 && i.is_life_bound !== 1);
                if (eligible.length === 0) {
                    await interaction.reply({
                        content: '❌ Hành trang của đạo hữu không có trang bị/pháp bảo nào khác để hoán đổi!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🔄 HOÁN ĐỔI BẢN MỆNH PHÁP BẢO')
                    .setColor(uiSystem_1.EMBED_COLORS.ORANGE)
                    .setDescription(`Tiêu hao **1x Huyết Tế Ma Bảng** để hoán đổi liên kết nguyên thần sang Pháp Bảo mới.\n` +
                    `Bản Mệnh mới sẽ kế thừa **80% tích lũy EXP** của Pháp Bảo cũ.\n\n` +
                    `*Hãy chọn trang bị mới muốn hoán đổi:*`)
                    .setTimestamp();
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`pb_swap_select_${targetUserId}`)
                    .setPlaceholder('Chọn trang bị mới để hoán đổi');
                eligible.slice(0, 25).forEach((i) => {
                    const starStr = i.stars > 0 ? ` [⭐${i.stars}]` : '';
                    const enhStr = i.enhance_level > 0 ? ` (+${i.enhance_level})` : '';
                    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`${i.name}${starStr}${enhStr}`)
                        .setValue(String(i.id))
                        .setDescription(`[ID: ${i.id}] Phẩm chất: ${i.rarity.toUpperCase()}`));
                });
                const row1 = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`pb_banmenh_nav_${targetUserId}`)
                    .setLabel('🔙 Quay Lại')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], [row1, row2]);
            }
            else if (pbSub === 'swap' && pbType === 'select' && interaction.isStringSelectMenu()) {
                const newInvId = parseInt(interaction.values[0], 10);
                const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                const scroll = inv.find((i) => i.item_id === itemConstants_1.ITEMS.ITEM_LIFE_BIND_SCROLL && i.quantity > 0);
                if (!scroll) {
                    await interaction.reply({
                        content: '❌ Đạo hữu đã đánh mất **Huyết Tế Ma Bảng** nửa chừng, không thể tiến hành hoán đổi!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                const oldBound = inv.find((i) => i.is_life_bound === 1);
                if (!oldBound) {
                    await interaction.reply({ content: '❌ Đạo hữu chưa có Bản Mệnh Pháp Bảo cũ để hoán đổi!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const res = InventoryService_1.inventoryService.swapLifeArtifact(targetUserId, oldBound.id, newInvId);
                if (!res.success) {
                    await interaction.reply({ content: `❌ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                InventoryRepository_1.inventoryRepository.removeItem(targetUserId, itemConstants_1.ITEMS.ITEM_LIFE_BIND_SCROLL, 1);
                const embed = getBanMenhEmbed(targetUserId);
                const comps = getBanMenhComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], comps);
                await interaction.followUp({ content: `✅ ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else if (pbSub === 'banmenh' && pbType === 'nav') {
                const embed = getBanMenhEmbed(targetUserId);
                const comps = getBanMenhComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [embed], comps);
            }
            return;
        }
        if (action === 'invselect' && interaction.isStringSelectMenu()) {
            const selectedValue = interaction.values[0];
            const firstUnderscore = selectedValue.indexOf('_');
            const itemAction = selectedValue.substring(0, firstUnderscore);
            const inventoryId = parseInt(selectedValue.substring(firstUnderscore + 1), 10);
            console.log(`[invselect] action=${itemAction} id=${inventoryId} user=${targetUserId} value=${selectedValue}`);
            if (isNaN(inventoryId)) {
                await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            let resultMessage = '';
            let success = false;
            if (itemAction === 'equip') {
                const res = InventoryService_1.inventoryService.equipItem(targetUserId, inventoryId);
                success = res.success;
                resultMessage = res.message;
            }
            else if (itemAction === 'unequip') {
                const res = InventoryService_1.inventoryService.unequipItem(targetUserId, inventoryId);
                success = res.success;
                resultMessage = res.message;
            }
            else if (itemAction === 'use') {
                const res = InventoryService_1.inventoryService.useItem(targetUserId, inventoryId);
                success = res.success;
                resultMessage = res.message;
            }
            if (!success) {
                console.log(`[invselect] FAIL: ${resultMessage}`);
                await interaction.reply({ content: `❌ ${resultMessage}`, flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            console.log(`[invselect] OK: ${resultMessage}`);
            const pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
            const { embed, totalPages, itemsOnPage } = (0, hoso_1.getInventoryEmbed)(targetUserId, pageNum);
            const components = (0, hoso_1.getInventoryComponents)(targetUserId, pageNum, totalPages, itemsOnPage);
            await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            await interaction.followUp({ content: `💼 ${resultMessage}`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        // --- Tong Mon Nav ---
        if (action === 'tonmonnav') {
            const { getSectEmbed, getSectComponents } = require('../../commands/life/tongmon');
            const embed = getSectEmbed(targetUserId);
            const sectComps = getSectComponents(targetUserId);
            const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`hosoback_${targetUserId}`).setLabel('🔙 Quay Lại Hồ Sơ').setStyle(discord_js_1.ButtonStyle.Secondary));
            await (0, uiSystem_1.safeV2Update)(interaction, [embed], [...sectComps, backRow]);
            return;
        }
        // --- Dong Phu ---
        if (action === 'dongphu') {
            const sub = parts[1];
            const { buildDongPhuEmbed, buildDongPhuComponents } = require('../../commands/life/dongphu');
            const { caveService } = require('../../services/CaveService');
            const { caveEnhancementService } = require('../../services/CaveEnhancementService');
            let result;
            if (sub === 'spring') {
                result = caveService.collectSpring(targetUserId);
            }
            else if (sub === 'harvest') {
                result = caveEnhancementService.claimMeridianResources(targetUserId);
            }
            else if (sub === 'up') {
                const bld = parts[2];
                result = caveEnhancementService.upgradeBuilding(targetUserId, bld);
            }
            else {
                return;
            }
            if (result.success) {
                const updatedEmbed = buildDongPhuEmbed(targetUserId);
                const updatedComponents = buildDongPhuComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [updatedEmbed], updatedComponents);
                await interaction.followUp({ content: result.message, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else {
                await interaction.reply({ content: `❌ ${result.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        // --- Dong Phu Nav ---
        if (action === 'dongphunav') {
            const { buildCaveEmbed, buildCaveComponents } = require('../../commands/life/dongphu');
            const embed = buildCaveEmbed(targetUserId);
            const components = buildCaveComponents(targetUserId);
            await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
            return;
        }
        // --- Bang Phong Than ---
        if (action === 'bpt') {
            const subType = parts[1];
            const page = parseInt(parts[2], 10) || 1;
            const { buildLeaderboardUpdate } = require('../../commands/general/bangphongthan');
            const updateOptions = buildLeaderboardUpdate(targetUserId, subType, page);
            await (0, uiSystem_1.safeV2Update)(interaction, updateOptions.embeds, updateOptions.components);
            return;
        }
        if (action === 'bptselect' && interaction.isStringSelectMenu()) {
            const category = interaction.values[0];
            const bptUserId = parts[1];
            const { buildLeaderboardUpdate } = require('../../commands/general/bangphongthan');
            const updateOptions = buildLeaderboardUpdate(bptUserId, category, 1);
            await (0, uiSystem_1.safeV2Update)(interaction, updateOptions.embeds, updateOptions.components);
            return;
        }
    }
    catch (e) {
        console.error(`[NavigationHandler] Lỗi xử lý action ${action}:`, e);
        try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else if (interaction.isRepliable()) {
                await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (_) { }
    }
}
