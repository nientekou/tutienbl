"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Event_1 = require("../structures/Event");
const InteractionLock_1 = require("../services/InteractionLock");
const SystemConfigService_1 = require("../services/SystemConfigService");
const database_1 = __importDefault(require("../database/database"));
const discord_js_1 = require("discord.js");
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const SectService_1 = require("../services/SectService");
const tongmon_1 = require("../commands/life/tongmon");
const uiSystem_1 = require("../utils/uiSystem");
const shop_1 = require("../commands/general/shop");
const itemConstants_1 = require("../config/itemConstants");
// Cooldown trong bộ nhớ cho hành động Tu Luyện (Thiền Định)
const practiceCooldowns = new Map();
// Bộ nhớ tạm lưu trữ nhật ký chiến đấu của người chơi để xem chi tiết (có TTL 10 phút)
const CombatLogsCache_1 = require("../handlers/interactions/CombatLogsCache");
// Trạng thái sẵn sàng được import và chia sẻ trực tiếp từ commands/combat/lapdoi
const CronManager_1 = require("../utils/CronManager");
const InteractionRegistry_1 = require("../handlers/interactions/InteractionRegistry");
// Side-effect import: registers all action handlers with the registry
require("../handlers/interactions/handlers");
// Dọn dẹp cache (Garbage collection) mỗi 10 phút để tránh rò rỉ bộ nhớ
CronManager_1.CronManager.registerTask('interaction_gc', 600000, () => {
    const now = Date.now();
    for (const [userId, timestamp] of practiceCooldowns.entries()) {
        if (now - timestamp > 60000)
            practiceCooldowns.delete(userId);
    }
    // Dọn combat log cache hết hạn (TTL 10 phút)
    for (const [userId, entry] of CombatLogsCache_1.combatLogsCache.entries()) {
        if (now - entry.timestamp > 600000)
            CombatLogsCache_1.combatLogsCache.delete(userId);
    }
});
class InteractionCreateEvent extends Event_1.Event {
    constructor() {
        super('interactionCreate');
    }
    async execute(client, interaction) {
        // 0. Xử lý Autocomplete trước tiên (không cần lock, không cần check ban/bảo trì/activity)
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(client, interaction);
                }
                catch (err) {
                    console.error(`[Autocomplete Error] Lỗi gợi ý lệnh /${interaction.commandName}:`, err);
                }
            }
            return;
        }
        const userId = interaction.user.id;
        let acquired = false;
        try {
            // Kiểm tra xem người dùng có bị phong ấn (ban) hay không
            const banCheck = database_1.default.prepare('SELECT reason FROM banned_users WHERE user_id = ?').get(userId);
            if (banCheck) {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: `🔒 **Trục Xuất Tam Giới:**\n\nLinh hồn của đạo hữu đã bị Thiên Đạo phong ấn (Ban).\n📝 **Lý do:** *${banCheck.reason || 'Không rõ lý do'}*\n\n*Ngươi không thể can thiệp hay thực hiện bất kỳ hành động nào trong tam giới.*`,
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                }
                return;
            }
            // Cập nhật điểm hoạt động của server (Guild Activity Tracking)
            if (interaction.guildId) {
                const now = Math.floor(Date.now() / 1000);
                try {
                    database_1.default.prepare(`
            INSERT INTO guild_configs (guild_id, interaction_count, last_interaction_at)
            VALUES (?, 1, ?)
            ON CONFLICT(guild_id) DO UPDATE SET interaction_count = interaction_count + 1, last_interaction_at = ?
          `).run(interaction.guildId, now, now);
                }
                catch (err) {
                    console.error('[Activity] Lỗi khi cập nhật điểm hoạt động guild:', err);
                }
            }
            // Các button được quản lý bởi awaitMessageComponent collector (taonhanvat flow, daolu, setup)
            // Phải bỏ qua hoàn toàn ở đây để collector có thể xử lý độc quyền, tránh race condition
            if (interaction.isButton() && (interaction.customId.startsWith('bg_') ||
                interaction.customId.startsWith('dest_') ||
                interaction.customId === 'accept_marriage' ||
                interaction.customId === 'decline_marriage' ||
                interaction.customId === 'confirm_reset' ||
                interaction.customId === 'cancel_reset')) {
                return;
            }
            // Kiểm tra chế độ bảo trì
            const BOT_OWNER_ID = '724608013981450351';
            const isDeveloper = userId === BOT_OWNER_ID ||
                userId === '888888888888888881' ||
                userId === '888888888888888882' ||
                (client.application?.owner?.id === userId) ||
                client.application?.owner?.members?.has(userId);
            const isMaintenance = SystemConfigService_1.systemConfigService.isMaintenanceMode();
            if (isMaintenance && !isDeveloper) {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '⚠️ **Hệ Thống Tu Chân Bảo Trì:** Linh khí thiên địa hỗn loạn, đại trận bảo trì đang được kích hoạt. Đạo hữu vui lòng quay lại sau!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                }
                return;
            }
            // Lấy khóa chống race condition / spam
            // Defer reply ngay lập tức cho slash commands để tránh Unknown interaction (3s timeout)
            if (interaction.isChatInputCommand() && !interaction.deferred && !interaction.replied) {
                try {
                    await interaction.deferReply();
                }
                catch (deferErr) {
                    // ponytail: 40060 = event replayed during WS resume, 10062 = 3s window expired — both are safe to ignore
                    if (deferErr?.code !== 10062 && deferErr?.code !== 40060 && deferErr?.rawError?.code !== 10062 && deferErr?.rawError?.code !== 40060) {
                        console.error('[Defer] Lỗi defer reply:', deferErr);
                    }
                    return;
                }
            }
            if (!InteractionLock_1.InteractionLock.acquire(userId)) {
                if (interaction.isRepliable()) {
                    try {
                        const msg = '❌ **Thao tác quá nhanh:** Hệ thống đang xử lý hành động trước đó của đạo hữu, vui lòng không spam!';
                        if (interaction.deferred) {
                            await interaction.editReply({ content: msg });
                        }
                        else {
                            await interaction.reply({ content: msg, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                    }
                    catch (lockErr) {
                        // Bỏ qua nếu interaction đã được collector xử lý trước (40060) hoặc hết hạn (10062)
                        if (lockErr?.code !== 10062 && lockErr?.code !== 40060 &&
                            lockErr?.rawError?.code !== 10062 && lockErr?.rawError?.code !== 40060) {
                            console.error('[InteractionLock] Lỗi khi reply spam warning:', lockErr);
                        }
                    }
                }
                return;
            }
            acquired = true;
            // Auto-claim daily login reward on first interaction of the day
            try {
                const today = new Date().toLocaleDateString('en-CA');
                const loginRecord = database_1.default.prepare('SELECT last_login_date FROM user_daily_logins WHERE user_id = ?').get(interaction.user.id);
                if (!loginRecord || loginRecord.last_login_date !== today) {
                    const { dailyLoginService } = require('../services/DailyLoginService');
                    const loginResult = dailyLoginService.claimLogin(interaction.user.id);
                    if (loginResult.success && loginResult.message) {
                        setTimeout(() => {
                            interaction.user.send({ content: loginResult.message }).catch(() => { });
                        }, 1000);
                    }
                }
            }
            catch (e) { }
            // 1. Xử lý Slash Command (Chat Input Command)
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`[Interaction] Lệnh /${interaction.commandName} không tìm thấy trong bộ nhớ.`);
                    await interaction.reply({ content: 'Lệnh không tồn tại hoặc đã bị gỡ bỏ.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                try {
                    console.log(`[Command Exec] Người dùng ${interaction.user.tag} (${interaction.user.id}) sử dụng: /${interaction.commandName}`);
                    await command.execute(client, interaction);
                }
                catch (error) {
                    console.error(`[Command Error] Lỗi khi thực thi lệnh /${interaction.commandName}:`, error);
                    const errorMessage = 'Đã xảy ra lỗi khi thực thi lệnh này! Vui lòng thử lại sau.';
                    if (interaction.replied || interaction.deferred) {
                        try {
                            await interaction.editReply({ content: errorMessage });
                        }
                        catch (_) { }
                    }
                    else {
                        try {
                            await interaction.reply({ content: errorMessage, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        catch (_) { }
                    }
                }
                return;
            }
            // 2. Xử lý Nút bấm (Button Interactions) & Menu Chọn (SelectMenu)
            if (interaction.isButton() ||
                (interaction.isStringSelectMenu() && (interaction.customId.startsWith('hosoaction_') ||
                    interaction.customId.startsWith('hosoaction1_') ||
                    interaction.customId.startsWith('hosoaction2_') ||
                    interaction.customId.startsWith('traveler_buy_item_') ||
                    interaction.customId.startsWith('destiny_equip_') ||
                    interaction.customId.startsWith('destiny_unequip_') ||
                    interaction.customId.startsWith('dueluseitem_') ||
                    interaction.customId.startsWith('enhance_select_') ||
                    interaction.customId.startsWith('linhmach_select_') ||
                    interaction.customId.startsWith('anky_select_') ||
                    interaction.customId.startsWith('dungkynang_select_') ||
                    interaction.customId.startsWith('doitienselect_') ||
                    interaction.customId.startsWith('pb_') ||
                    interaction.customId.startsWith('bptselect_') ||
                    interaction.customId.startsWith('adminpanel_') ||
                    interaction.customId.startsWith('adminuser_') ||
                    interaction.customId.startsWith('adminfixpets_') ||
                    interaction.customId.startsWith('alch_select_') ||
                    interaction.customId.startsWith('invselect_') ||
                    interaction.customId.startsWith('select_alignment_') ||
                    interaction.customId.startsWith('shopbuy_') ||
                    interaction.customId.startsWith('bossshop_buy_') ||
                    interaction.customId.startsWith('sknbuy_') ||
                    interaction.customId.startsWith('bicanhselect_') ||
                    interaction.customId.startsWith('craftselect_') ||
                    interaction.customId.startsWith('linhdiengieoselect_') ||
                    interaction.customId.startsWith('linhdienspeedupselect_') ||
                    interaction.customId.startsWith('linhdiencareselect_') ||
                    interaction.customId.startsWith('luyenkhiselect_') ||
                    interaction.customId.startsWith('sectjoinselect_') ||
                    interaction.customId.startsWith('sectdonateselect_') ||
                    interaction.customId.startsWith('pb_bind_select_') ||
                    interaction.customId.startsWith('pb_swap_select_') ||
                    interaction.customId.startsWith('adminpanel_restoreselect_')))) {
                let customId = interaction.customId;
                if (interaction.isStringSelectMenu() && (customId.startsWith('hosoaction_') || customId.startsWith('hosoaction1_') || customId.startsWith('hosoaction2_'))) {
                    customId = `${interaction.values[0]}_${customId.split('_')[1]}`;
                }
                const specialActions = [
                    'traveler_buy_item',
                    'traveler_buy',
                    'traveler_rob',
                    'destiny_equip',
                    'destiny_unequip',
                    'dueluseitem',
                    'duelchoose',
                    'worldbossattack',
                    'bossshop_buy',
                    'enhance_select',
                    'enhance_confirm',
                    'enhance_cancel',
                    'linhmach_select',
                    'linhmach_close',
                    'anky_select',
                    'dungkynang_select',
                    'dungkynang_cancel',
                    'adminpanel',
                    'adminuser',
                    'adminfixpets',
                    'titleswitch',
                    'ngotinh_activate',
                    'ngotinh_reroll_execute'
                ];
                let action = '';
                let parts = [];
                const matchedSpecial = specialActions.find(prefix => customId.startsWith(prefix + '_') || customId === prefix);
                if (matchedSpecial) {
                    action = matchedSpecial;
                    const suffix = customId.substring(matchedSpecial.length + 1);
                    parts = [matchedSpecial, ...suffix.split('_')];
                }
                else {
                    parts = customId.split('_');
                    action = parts[0];
                }
                if (action === 'adminpanel' || action === 'adminuser' || action === 'adminfixpets' || action === 'admincheckorphan') {
                    const AdminCommand = require('../commands/general/admin').default;
                    await AdminCommand.handleInteraction(client, interaction, action, parts);
                    return;
                }
                let targetUserId = '';
                let pageNum = 1;
                // Phân tách tham số nút tùy biến
                // QUY TẮC: userId luôn là PHẦN TỬ CUỐI CÙNG trong parts (trừ các nút public)
                if (action === 'invprev' || action === 'invnext') {
                    pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
                    targetUserId = parts[parts.length - 1];
                }
                else if (action === 'mountprev' || action === 'mountnext' || action === 'spiritprev' || action === 'spiritnext') {
                    pageNum = Math.max(1, parseInt(parts[1], 10) || 1);
                    targetUserId = parts[parts.length - 1];
                }
                else if (action === 'achprev' || action === 'achnext') {
                    pageNum = Math.max(1, parseInt(parts[2], 10) || 1);
                    targetUserId = parts[parts.length - 1];
                }
                else if (action === 'loi') {
                    targetUserId = parts[parts.length - 1];
                }
                else if (action === 'lamviecwork') {
                    // customId: lamviecwork_<jobType>_<userId>
                    targetUserId = parts[parts.length - 1];
                }
                else {
                    targetUserId = parts[parts.length - 1];
                }
                // Nút bấm công khai thế giới hoặc quyết đấu
                const isPublicAction = [
                    'worldbossattack', 'duelaccept', 'duelrefuse', 'duelchoose', 'duellichsu',
                    'trade', 'suachua', 'traveler_buy', 'traveler_buy_item', 'traveler_rob',
                    'joinparty', 'leaveparty', 'startparty', 'edenter', 'edattack', 'edretreat',
                    'noituskip',
                    'bossshop',
                    'bossshop_buy',
                ].includes(action);
                if (isPublicAction) {
                    targetUserId = interaction.user.id;
                }
                // Nút công khai không cần kiểm tra sở hữu, giữ nguyên targetUserId từ customId
                const skipOwnershipCheck = [
                    'worldbossrefresh', 'worldbosslb',
                ].includes(action);
                // Bảo mật: Chỉ cho phép người sở hữu hồ sơ nhấn nút tương tác
                if (!isPublicAction && !skipOwnershipCheck) {
                    const { ValidationUtils } = require('../utils/ValidationUtils');
                    const isOwner = await ValidationUtils.verifyOwnership(interaction, targetUserId);
                    if (!isOwner)
                        return;
                }
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user) {
                    await interaction.reply({
                        content: '❌ Đạo hữu chưa khởi tạo nhân vật hoặc đã bị xóa khỏi thế giới.',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                // --- DISPATCH: InteractionRegistry (handles all registered actions) ---
                const registryHandled = await InteractionRegistry_1.registry.dispatch(interaction, action, parts, targetUserId);
                if (registryHandled)
                    return;
            }
            // 4. Xử lý Modal Submit (Modal Submissions)
            if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                const parts = customId.split('_');
                const action = parts[0];
                const targetUserId = parts[1];
                if (action === 'adminmodal' || action === 'adminuser') {
                    const AdminCommand = require('../commands/general/admin').default;
                    await AdminCommand.handleModal(client, interaction, parts);
                    return;
                }
                // Bảo mật
                if (interaction.user.id !== targetUserId) {
                    await interaction.reply({
                        content: '❌ **Cảnh báo:** Đạo hữu không thể can thiệp vào hành động của tu sĩ khác!',
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    return;
                }
                // --- DISPATCH: SocialHandler (modal) ---
                if (action === 'sectcreate') {
                    const { SocialHandler } = require('../handlers/interactions/SocialHandler');
                    await SocialHandler.handle(interaction, action, parts, targetUserId);
                    return;
                }
                if (action === 'sectcreate') {
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
                else if (action === 'doitienmodal') {
                    const type = parts.slice(2).join('_');
                    const qtyStr = interaction.fields.getTextInputValue('doitien_qty');
                    const qty = parseInt(qtyStr, 10);
                    if (isNaN(qty) || qty <= 0) {
                        await interaction.reply({ content: '❌ Số lượng lần đổi phải là số nguyên lớn hơn 0!', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const DoiTienCommand = require('../commands/general/doitien').default;
                    const { getDoiTienEmbed, getDoiTienComponents } = require('../commands/general/doitien');
                    const res = DoiTienCommand.performConversion(targetUserId, type, qty);
                    if (!res.success) {
                        await interaction.reply({ content: res.message, flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const embed = getDoiTienEmbed(targetUserId);
                    const components = getDoiTienComponents(targetUserId);
                    if (interaction.update) {
                        await (0, uiSystem_1.safeV2Update)(interaction, [embed], components);
                        await interaction.followUp({ content: `✅ Quy đổi thành công! ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                    else {
                        await interaction.reply({ content: `✅ Quy đổi thành công! ${res.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                }
                // --- Modal: MUA NHANH VẬT PHẨM CỬA HÀNG ---
                else if (action === 'shopbuymodal') {
                    const rest = parts.slice(2).join('_');
                    const subParts = rest.split(':');
                    const itemId = subParts[0];
                    const activeCategory = subParts[1];
                    const pageNum = parseInt(subParts[2], 10) || 1;
                    const qtyStr = interaction.fields.getTextInputValue('buy_qty');
                    const qty = parseInt(qtyStr, 10);
                    if (isNaN(qty) || qty <= 0) {
                        await interaction.reply({ content: '❌ Số lượng mua phải là số nguyên lớn hơn 0!', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const item = shop_1.SHOP_ITEMS.find(i => i.id === itemId);
                    if (!item) {
                        await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const totalCost = item.price * qty;
                    if (item.currency === 'knb') {
                        let realItemId = item.id;
                        if (item.id === itemConstants_1.ITEMS.ITEM_NHAN_DINH_HON_KNB)
                            realItemId = itemConstants_1.ITEMS.ITEM_NHAN_DINH_HON;
                        if (item.id === itemConstants_1.ITEMS.ITEM_BLOODLINE_PILL_KNB)
                            realItemId = itemConstants_1.ITEMS.ITEM_BLOODLINE_PILL;
                        const tx = database_1.default.transaction(() => {
                            const buyer = UserRepository_1.userRepository.get(targetUserId);
                            if (!buyer)
                                throw new Error('Đạo hữu chưa khởi tạo nhân vật');
                            if (buyer.knb < totalCost)
                                throw new Error(`Không đủ KNB! (Cần: ${totalCost}, có: ${buyer.knb})`);
                            (0, shop_1.checkAndUpdateWeeklyLimit)(targetUserId, item.id, qty);
                            UserRepository_1.userRepository.update(targetUserId, { knb: buyer.knb - totalCost });
                            InventoryRepository_1.inventoryRepository.addItem(targetUserId, realItemId, qty);
                        });
                        try {
                            tx();
                        }
                        catch (error) {
                            await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                            return;
                        }
                        const embed = (0, shop_1.getShopEmbed)(targetUserId, activeCategory, undefined, pageNum);
                        const shopComps = (0, shop_1.getShopComponents)(targetUserId, activeCategory, undefined, pageNum);
                        const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];
                        if (interaction.update) {
                            await (0, uiSystem_1.safeV2Update)(interaction, [embed], rowsArr);
                            await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        else {
                            await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                    }
                    else {
                        const tx = database_1.default.transaction(() => {
                            const buyer = UserRepository_1.userRepository.get(targetUserId);
                            if (!buyer)
                                throw new Error('Đạo hữu chưa khởi tạo nhân vật');
                            if (buyer.coin_ha_pham < totalCost)
                                throw new Error(`Không đủ Linh Thạch! (Cần: ${totalCost}, có: ${buyer.coin_ha_pham})`);
                            (0, shop_1.checkAndUpdateWeeklyLimit)(targetUserId, item.id, qty);
                            UserRepository_1.userRepository.update(targetUserId, { coin_ha_pham: buyer.coin_ha_pham - totalCost });
                            InventoryRepository_1.inventoryRepository.addItem(targetUserId, item.id, qty);
                        });
                        try {
                            tx();
                        }
                        catch (error) {
                            await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: discord_js_1.MessageFlags.Ephemeral });
                            return;
                        }
                        const embed = (0, shop_1.getShopEmbed)(targetUserId, activeCategory, undefined, pageNum);
                        const shopComps = (0, shop_1.getShopComponents)(targetUserId, activeCategory, undefined, pageNum);
                        const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];
                        if (interaction.update) {
                            await (0, uiSystem_1.safeV2Update)(interaction, [embed], rowsArr);
                            await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        else {
                            await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                    }
                }
                // --- Modal: TÌM KIẾM CỬA HÀNG ---
                else if (action === 'shopsearchmodal') {
                    const searchQuery = interaction.fields.getTextInputValue('search_query');
                    const embed = (0, shop_1.getShopEmbed)(targetUserId, undefined, undefined, 1, searchQuery);
                    const rows = (0, shop_1.getShopComponents)(targetUserId, undefined, undefined, 1, searchQuery);
                    if (interaction.update) {
                        await (0, uiSystem_1.safeV2Update)(interaction, [embed], rows);
                    }
                    else {
                        await interaction.reply((0, uiSystem_1.toV2Payload)([embed], rows));
                    }
                }
                return;
            }
        }
        catch (error) {
            if (error?.code === 10062 || error?.rawError?.code === 10062 ||
                error?.code === 40060 || error?.rawError?.code === 40060) {
                return;
            }
            console.error(`[Interaction Error] ${interaction.user.tag}:`, error);
            try {
                if (interaction.isRepliable()) {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: '❌ Đã xảy ra lỗi!', flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                    else {
                        await interaction.reply({ content: '❌ Đã xảy ra lỗi!', flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                }
            }
            catch (_) { }
        }
        finally {
            if (acquired) {
                InteractionLock_1.InteractionLock.release(userId);
            }
        }
    }
}
exports.default = InteractionCreateEvent;
