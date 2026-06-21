"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_NAMES = exports.SHOP_CATEGORIES = exports.SHOP_ITEMS = void 0;
exports.getYearWeekString = getYearWeekString;
exports.getUserWeeklyPurchases = getUserWeeklyPurchases;
exports.checkAndUpdateWeeklyLimit = checkAndUpdateWeeklyLimit;
exports.getCategoryItems = getCategoryItems;
exports.getShopEmbed = getShopEmbed;
exports.getShopComponents = getShopComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const constants_1 = require("../../utils/constants");
const database_1 = __importDefault(require("../../database/database"));
exports.SHOP_ITEMS = [
    // --- Đan Dược - Hồi Phục ---
    { id: 'pill_hp_1', name: '💊 Hồi Huyết Đan - Hạ Phẩm', price: 15, levelReq: 1, desc: '└ Hồi phục 50 Sinh Lực trong chiến đấu.' },
    { id: 'pill_hp_2', name: '💊 Hồi Huyết Đan - Trung Phẩm', price: 50, levelReq: 20, desc: '└ Hồi phục 150 Sinh Lực.' },
    { id: 'pill_stamina_1', name: '💊 Hồi Thể Đan Sơ Cấp', price: 200, levelReq: 10, desc: '└ Khôi phục +50 Thể Lực. Giới hạn 3 viên/ngày.' },
    { id: 'pill_stamina_2', name: '💊 Hồi Thể Đan Trung Cấp', price: 500, levelReq: 30, desc: '└ Khôi phục +100 Thể Lực. Giới hạn 3 viên/ngày.' },
    { id: 'pill_stamina_3', name: '💊 Hồi Thể Đan Cao Cấp', price: 1200, levelReq: 60, desc: '└ Khôi phục +200 Thể Lực. Giới hạn 3 viên/ngày.' },
    { id: 'potion_stamina_weekly', name: '🧪 Bình Thể Lực (Tuần)', price: 200, levelReq: 1, desc: '└ Hồi +150 Thể Lực. Giới hạn 6 bình/tuần.' },
    // --- Đan Dược - Tăng Cấp ---
    { id: 'pill_tu_vi_low', name: '💊 Sơ Cấp Tụ Khí Đan', price: 50, levelReq: 1, desc: '└ Tăng trực tiếp **+50** Tu Vi.' },
    // --- Đan Dược - Đột Phá ---
    { id: 'pill_break_1', name: '💊 Trúc Cơ Đan', price: 300, levelReq: 10, desc: '└ Đột phá Luyện Khí → Trúc Cơ (+20% tỷ lệ).' },
    { id: 'pill_break_minor_1', name: '💊 Tụ Khí Đan', price: 80, levelReq: 1, desc: '└ Đột phá tầng nhỏ (+15% tỷ lệ).' },
    { id: 'pill_break_minor_2', name: '💊 Bồi Nguyên Đan', price: 150, levelReq: 20, desc: '└ Đột phá tầng nhỏ (+30% tỷ lệ).' },
    { id: 'pill_break_minor_3', name: '💊 Tạo Hóa Đan', price: 400, levelReq: 50, desc: '└ Đột phá tầng nhỏ (+50% tỷ lệ).' },
    // --- Bùa Chú ---
    { id: 'talisman_anti_loi', name: '📜 Tị Lôi Phù', price: 250, levelReq: 10, desc: '└ Giảm 80% sát thương Lôi Kiếp.' },
    { id: 'talisman_speed_1', name: '📜 Thần Hành Phù', price: 25, levelReq: 1, desc: '└ Gia tốc linh thực/thám hiểm 1 giờ.' },
    // --- Nguyên Liệu - Hạt Giống ---
    { id: 'seed_linh_thao_1', name: '🌾 Hạt Giống Linh Thảo', price: 5, levelReq: 1, desc: '└ Hạt giống trồng linh thảo hạ phẩm.' },
    { id: 'seed_nhan_sam_1', name: '🌾 Hạt Giống Nhân Sâm', price: 15, levelReq: 5, desc: '└ Hạt giống trồng Huyết Nhân Sâm.' },
    { id: 'seed_tuyet_lien', name: '🌾 Hạt Giống Tuyết Liên', price: 300, levelReq: 20, desc: '└ Hạt giống Thiên Sơn Tuyết Liên.' },
    { id: 'seed_lingzhi', name: '🌾 Hạt Giống Linh Chi', price: 500, levelReq: 30, desc: '└ Hạt giống Cửu Diệp Linh Chi.' },
    { id: 'seed_ngodong', name: '🌾 Hạt Giống Ngô Đồng', price: 800, levelReq: 50, desc: '└ Hạt giống Ngô Đồng Quả.' },
    // --- Nguyên Liệu - Luyện Khí ---
    { id: 'cauldron_low', name: '🔥 Lò Luyện Đan - Hạ Phẩm', price: 500, levelReq: 1, desc: '└ Lò đất sét nung, +0% tỷ lệ (10% nứt).' },
    { id: 'cauldron_mid', name: '🔥 Lò Luyện Đan - Trung Phẩm', price: 2000, levelReq: 20, desc: '└ Lò đồng đen, +10% tỷ lệ thành công.' },
    { id: 'cauldron_high', name: '🔥 Lò Luyện Đan - Thượng Phẩm', price: 10000, levelReq: 50, desc: '└ Cổ đỉnh khảm ngọc, +25% tỷ lệ thành công.' },
    // --- Đặc Biệt - Rương ---
    { id: 'lucky_chest', name: '🎁 Rương Cơ Duyên Lucky', price: 100, levelReq: 1, desc: '└ Mở ra nhận ngẫu nhiên Phôi F → SSS.' },
    { id: 'chest_1tr5', name: '🎁 Rương Tôn Quý Đại Cát (1.5M)', price: 1500000, levelReq: 100, desc: '└ Tỷ lệ kỳ trân cực cao.' },
    { id: 'server_raid_chest', name: '🎁 Rương Boss Thế Giới', price: 10, currency: 'knb', levelReq: 1, desc: '└ Trang bị và vật phẩm quý từ Boss.' },
    // --- Đặc Biệt - Đạo Lữ ---
    { id: 'item_nhan_dinh_hon', name: '💍 Nhẫn Đính Hôn', price: 500000, levelReq: 50, desc: '└ Tín vật kết bái Đạo Lữ.' },
    { id: 'item_tam_sinh_thach', name: '💖 Tam Sinh Thạch', price: 5000, levelReq: 30, desc: '└ Tín vật cầu hôn đạo lữ.' },
    { id: 'item_tuyet_tinh_nuoc', name: '💔 Tuyệt Tình Nước', price: 2000, levelReq: 1, desc: '└ Cắt đứt duyên phận (mất 20% tu vi).' },
    { id: 'item_nhan_dinh_hon_knb', name: '💍 Nhẫn Đính Hôn (KNB)', price: 50, currency: 'knb', levelReq: 50, desc: '└ Kết duyên Đạo Lữ (mua bằng KNB).' },
    // --- Đặc Biệt - Huyết Mạch ---
    { id: 'item_bloodline_pill_knb', name: '🩸 Huyết Mạch Chuyển Hóa Đan (KNB)', price: 5, currency: 'knb', levelReq: 1, desc: '└ Kích hoạt/chuyển hóa Huyết Mạch.' },
];
exports.SHOP_CATEGORIES = [
    {
        id: 'dan', name: 'Đan Dược', emoji: '💊',
        subcategories: [
            { id: 'hoiphuc', name: 'Hồi Phục', items: ['pill_hp_1', 'pill_hp_2', 'pill_stamina_1', 'pill_stamina_2', 'pill_stamina_3', 'potion_stamina_weekly'] },
            { id: 'tangcap', name: 'Tăng Cấp', items: ['pill_tu_vi_low'] },
            { id: 'dotpha', name: 'Đột Phá', items: ['pill_break_1', 'pill_break_minor_1', 'pill_break_minor_2', 'pill_break_minor_3'] },
        ]
    },
    {
        id: 'bua', name: 'Bùa Chú', emoji: '📜',
        subcategories: [
            { id: 'buachu', name: 'Tất Cả', items: ['talisman_anti_loi', 'talisman_speed_1'] },
        ]
    },
    {
        id: 'nguyenlieu', name: 'Nguyên Liệu', emoji: '🌾',
        subcategories: [
            { id: 'hatgiong', name: 'Hạt Giống', items: ['seed_linh_thao_1', 'seed_nhan_sam_1', 'seed_tuyet_lien', 'seed_lingzhi', 'seed_ngodong'] },
            { id: 'luyenkhi', name: 'Luyện Khí', items: ['cauldron_low', 'cauldron_mid', 'cauldron_high'] },
        ]
    },
    {
        id: 'phapbao', name: 'Pháp Bảo', emoji: '🔮',
        subcategories: [
            { id: 'trangbi', name: 'Trang Bị', items: [] },
            { id: 'vongngoc', name: 'Vòng Ngọc', items: [] },
        ]
    },
    {
        id: 'dacbiet', name: 'Đặc Biệt', emoji: '🎁',
        subcategories: [
            { id: 'ruong', name: 'Rương', items: ['lucky_chest', 'chest_1tr5', 'server_raid_chest'] },
            { id: 'daolu', name: 'Đạo Lữ', items: ['item_nhan_dinh_hon', 'item_tam_sinh_thach', 'item_tuyet_tinh_nuoc', 'item_nhan_dinh_hon_knb'] },
            { id: 'huyetmach', name: 'Huyết Mạch', items: ['item_bloodline_pill_knb'] },
        ]
    },
];
function getYearWeekString(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}
function getUserWeeklyPurchases(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user)
        return {};
    try {
        const yCanh = JSON.parse(user.y_canh || '{}');
        const currentWeek = getYearWeekString();
        if (yCanh.weekly_purchases && yCanh.weekly_purchases.week === currentWeek) {
            return yCanh.weekly_purchases.items || {};
        }
    }
    catch (e) {
        //
    }
    return {};
}
function checkAndUpdateWeeklyLimit(userId, itemId, qty, maxLimit = 6) {
    if (itemId !== 'potion_stamina_weekly')
        return;
    const user = UserRepository_1.userRepository.get(userId);
    if (!user)
        throw new Error('Đạo hữu chưa khởi tạo nhân vật!');
    let yCanh = {};
    try {
        yCanh = JSON.parse(user.y_canh || '{}');
    }
    catch (e) {
        yCanh = {};
    }
    const currentWeek = getYearWeekString();
    if (!yCanh.weekly_purchases || yCanh.weekly_purchases.week !== currentWeek) {
        yCanh.weekly_purchases = {
            week: currentWeek,
            items: {}
        };
    }
    const currentCount = yCanh.weekly_purchases.items[itemId] || 0;
    if (currentCount + qty > maxLimit) {
        throw new Error(`Đã vượt quá giới hạn mua tuần này! Bạn đã mua **${currentCount}/${maxLimit}** bình, không thể mua thêm **${qty}** bình.`);
    }
    yCanh.weekly_purchases.items[itemId] = currentCount + qty;
    UserRepository_1.userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });
}
const ITEMS_PER_PAGE = 10;
function getItemLevelReq(item) {
    if (!item.levelReq || item.levelReq <= 1)
        return '';
    return ` (Cấp ${item.levelReq}+)`;
}
/**
 * Xây dựng Embed hiển thị danh sách vật phẩm theo category/subcategory
 */
exports.CATEGORY_NAMES = {
    dan: 'Linh Đan',
    nguyenlieu: 'Linh Vật',
    doitien: 'Đổi Tiền',
    congphap: 'Công Pháp',
    bua: 'Bí Ấn',
    dacbiet: 'Cực Phẩm'
};
const CATEGORY_EMOJIS = {
    dan: '🧪',
    nguyenlieu: '📦',
    bua: '📜',
    dacbiet: '🎁',
    congphap: '📚'
};
function getCategoryItems(categoryId) {
    if (categoryId === 'dan') {
        return exports.SHOP_ITEMS.filter(i => ['pill_hp_1', 'pill_hp_2', 'pill_stamina_1', 'pill_stamina_2', 'pill_stamina_3', 'potion_stamina_weekly', 'pill_tu_vi_low', 'pill_break_1', 'pill_break_minor_1', 'pill_break_minor_2', 'pill_break_minor_3'].includes(i.id));
    }
    if (categoryId === 'nguyenlieu') {
        return exports.SHOP_ITEMS.filter(i => ['seed_linh_thao_1', 'seed_nhan_sam_1', 'seed_tuyet_lien', 'seed_lingzhi', 'seed_ngodong', 'cauldron_low', 'cauldron_mid', 'cauldron_high'].includes(i.id));
    }
    if (categoryId === 'bua') {
        return exports.SHOP_ITEMS.filter(i => ['talisman_anti_loi', 'talisman_speed_1'].includes(i.id));
    }
    if (categoryId === 'dacbiet') {
        return exports.SHOP_ITEMS.filter(i => ['lucky_chest', 'chest_1tr5', 'server_raid_chest', 'item_nhan_dinh_hon', 'item_tam_sinh_thach', 'item_tuyet_tinh_nuoc', 'item_nhan_dinh_hon_knb', 'item_bloodline_pill_knb'].includes(i.id));
    }
    return [];
}
/**
 * Xây dựng Embed hiển thị danh sách vật phẩm theo category/subcategory
 */
function getShopEmbed(userId, primaryId, subId, page = 1, searchQuery) {
    const user = UserRepository_1.userRepository.get(userId);
    const weeklyPurchases = getUserWeeklyPurchases(userId);
    const name = user ? user.name : 'Đạo hữu';
    const coin = user ? (0, constants_1.formatNumber)(user.coin_ha_pham) : 0;
    const knb = user ? (0, constants_1.formatNumber)(user.knb) : 0;
    let title = '🏪 Cửa Hàng';
    let description = `Chào mừng đạo hữu **${name}**!\n`;
    description += `Linh thạch: **${coin}** 🟤\n`;
    description += `Cực phẩm linh thạch: **${knb}** 💎\n\n`;
    const activeCategory = primaryId || 'dan';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#e67e22')
        .setTimestamp();
    if (searchQuery) {
        title = '🔍 KẾT QUẢ TÌM KIẾM';
        const itemsToShow = exports.SHOP_ITEMS.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.id.toLowerCase().includes(searchQuery.toLowerCase()));
        let listText = `Tìm kiếm: **"${searchQuery}"** — ${itemsToShow.length} kết quả\n\n`;
        if (itemsToShow.length === 0) {
            listText += `❌ Không tìm thấy vật phẩm nào với từ khóa **"${searchQuery}"**`;
        }
        else {
            for (const item of itemsToShow) {
                const currencyIcon = item.currency === 'knb' ? '💎' : '🟤';
                let limitText = '';
                if (item.id === 'potion_stamina_weekly') {
                    const count = weeklyPurchases[item.id] || 0;
                    limitText = ` *(Đã mua: ${count}/6)*`;
                }
                const cleanItemName = item.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim();
                listText += ` **${cleanItemName}** – **${(0, constants_1.formatNumber)(item.price)}** ${currencyIcon}${limitText}\n  *${item.desc}*\n\n`;
            }
        }
        description += listText;
        embed.setDescription(description);
    }
    else if (activeCategory === 'doitien') {
        title = '🏪 Cửa Hàng ➡️ Đổi Tiền';
        let listText = `📊 **Tỷ giá quy đổi linh thạch Phường Thị:**\n`;
        listText += `• 🟤 Hạ Phẩm ➡️ ⚪ Trung Phẩm: **100:1**\n`;
        listText += `• ⚪ Trung Phẩm ➡️ 🟤 Hạ Phẩm: **1:100**\n`;
        listText += `• ⚪ Trung Phẩm ➡️ 🟡 Thượng Phẩm: **100:1**\n`;
        listText += `• 🟡 Thượng Phẩm ➡️ ⚪ Trung Phẩm: **1:100**\n`;
        listText += `• 🟤 Hạ Phẩm ➡️ 🟡 Thượng Phẩm: **10.000:1**\n`;
        listText += `• 🟡 Thượng Phẩm ➡️ 🟤 Hạ Phẩm: **1:10.000**\n`;
        listText += `• 💎 KNB ➡️ 🟡 Thượng Phẩm: **1:5**\n`;
        listText += `• 🟡 Thượng Phẩm ➡️ 💎 KNB: **5:1**\n`;
        listText += `• 💎 KNB ➡️ 🟤 Hạ Phẩm: **1:50.000**\n`;
        listText += `• 🟤 Hạ Phẩm ➡️ 💎 KNB: **50.000:1**\n\n`;
        listText += `Danh mục: **Đổi Tiền** • Trang 1/1`;
        description += listText;
        embed.setDescription(description);
    }
    else if (activeCategory === 'congphap') {
        title = '🏪 Cửa Hàng ➡️ Công Pháp';
        const { SKILL_BOOKS } = require('./shopkynang');
        const totalPages = Math.max(1, Math.ceil(SKILL_BOOKS.length / ITEMS_PER_PAGE));
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = SKILL_BOOKS.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        let listText = '';
        for (const book of pageItems) {
            const cleanBookName = book.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim();
            listText += ` **${cleanBookName}** – **${(0, constants_1.formatNumber)(book.price)}** 🟤\n  *Hệ: ${book.element} | ${book.desc}*\n\n`;
        }
        listText += `Danh mục: **Công Pháp** • Trang ${currentPage}/${totalPages}`;
        description += listText;
        embed.setDescription(description);
    }
    else {
        // dan, nguyenlieu, bua, dacbiet
        const items = getCategoryItems(activeCategory);
        const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        title = `🏪 Cửa Hàng ➡️ ${exports.CATEGORY_NAMES[activeCategory] || 'Đồ Vật'}`;
        let listText = '';
        const emoji = CATEGORY_EMOJIS[activeCategory] || '🧪';
        for (const item of pageItems) {
            const currencyIcon = item.currency === 'knb' ? '💎' : '🟤';
            let limitText = '';
            if (item.id === 'potion_stamina_weekly') {
                const count = weeklyPurchases[item.id] || 0;
                limitText = ` *(Đã mua: ${count}/6)*`;
            }
            const cleanItemName = item.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim();
            listText += ` **${cleanItemName}** – **${(0, constants_1.formatNumber)(item.price)}** ${currencyIcon}${limitText}\n  ${item.desc}\n\n`;
        }
        listText += `Danh mục: **${exports.CATEGORY_NAMES[activeCategory]}** • Trang ${currentPage}/${totalPages}`;
        description += listText;
        embed.setDescription(description);
    }
    embed.setTitle(title);
    return embed;
}
/**
 * Xây dựng Components (buttons) cho cửa hàng
 */
function getShopComponents(userId, primaryId, subId, page = 1, searchQuery) {
    const rows = [];
    const activeCategory = primaryId || 'dan';
    if (searchQuery) {
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`shop_dan_${userId}`)
            .setLabel('🏪 Cửa Hàng')
            .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId(`shopsearch_${userId}`)
            .setLabel('🔍 Tìm Kiếm')
            .setStyle(discord_js_1.ButtonStyle.Primary));
        rows.push(row);
        return rows;
    }
    // Row 1 Buttons
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('Quay lại')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_dan_${userId}`)
        .setLabel('Linh Đan')
        .setStyle(activeCategory === 'dan' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_nguyenlieu_${userId}`)
        .setLabel('Linh Vật')
        .setStyle(activeCategory === 'nguyenlieu' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_doitien_${userId}`)
        .setLabel('Đổi Tiền')
        .setStyle(activeCategory === 'doitien' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary));
    // Row 2 Buttons
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_congphap_${userId}`)
        .setLabel('Công Pháp')
        .setStyle(activeCategory === 'congphap' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_bua_${userId}`)
        .setLabel('Bí Ấn')
        .setStyle(activeCategory === 'bua' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`shop_dacbiet_${userId}`)
        .setLabel('Cực Phẩm')
        .setStyle(activeCategory === 'dacbiet' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary));
    rows.push(row1, row2);
    // Row 3: Dropdown selection based on category
    if (activeCategory === 'doitien') {
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`doitienselect_${userId}`)
            .setPlaceholder('Chọn loại quy đổi tiền tệ...')
            .addOptions({ label: '🟤 Hạ Phẩm ➡️ ⚪ Trung Phẩm (100:1)', value: 'ha_sang_trung' }, { label: '⚪ Trung Phẩm ➡️ 🟤 Hạ Phẩm (1:100)', value: 'trung_sang_ha' }, { label: '⚪ Trung Phẩm ➡️ 🟡 Thượng Phẩm (100:1)', value: 'trung_sang_thuong' }, { label: '🟡 Thượng Phẩm ➡️ ⚪ Trung Phẩm (1:100)', value: 'thuong_sang_trung' }, { label: '🟤 Hạ Phẩm ➡️ 🟡 Thượng Phẩm (10k:1)', value: 'ha_sang_thuong' }, { label: '🟡 Thượng Phẩm ➡️ 🟤 Hạ Phẩm (1:10k)', value: 'thuong_sang_ha' }, { label: '💎 KNB ➡️ 🟡 Thượng Phẩm (1:5)', value: 'knb_sang_thuong' }, { label: '🟡 Thượng Phẩm ➡️ 💎 KNB (5:1)', value: 'thuong_sang_knb' }, { label: '💎 KNB ➡️ 🟤 Hạ Phẩm (1:50k)', value: 'knb_sang_ha' }, { label: '🟤 Hạ Phẩm ➡️ 💎 KNB (50k:1)', value: 'ha_sang_knb' });
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
    }
    else if (activeCategory === 'congphap') {
        const { SKILL_BOOKS } = require('./shopkynang');
        const totalPages = Math.max(1, Math.ceil(SKILL_BOOKS.length / ITEMS_PER_PAGE));
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = SKILL_BOOKS.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`sknbuy_${activeCategory}_${currentPage}_${userId}`)
            .setPlaceholder('Chọn bí tịch muốn mua...');
        for (const book of pageItems) {
            const cleanBookName = book.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim();
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(`${cleanBookName} (${book.price} LT)`.substring(0, 100))
                .setDescription(book.desc.substring(0, 100))
                .setValue(book.id));
        }
        if (pageItems.length > 0) {
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
        }
        // Pagination row (if any)
        if (totalPages > 1) {
            const navRow = new discord_js_1.ActionRowBuilder();
            if (currentPage > 1) {
                navRow.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`shop_${activeCategory}_all_${currentPage - 1}_${userId}`)
                    .setLabel('⬅ Trang Trước')
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            }
            if (currentPage < totalPages) {
                navRow.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`shop_${activeCategory}_all_${currentPage + 1}_${userId}`)
                    .setLabel('Trang Sau ➡')
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            }
            rows.push(navRow);
        }
    }
    else if (activeCategory) {
        // dan, nguyenlieu, bua, dacbiet
        const items = getCategoryItems(activeCategory);
        const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`shopbuy_${activeCategory}_${currentPage}_${userId}`)
            .setPlaceholder('Chọn vật phẩm muốn mua...');
        for (const item of pageItems) {
            const cleanItemName = item.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim();
            const currencyText = item.currency === 'knb' ? 'KNB' : 'LT';
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(`${cleanItemName} (${item.price} ${currencyText})`.substring(0, 100))
                .setDescription(item.desc.substring(0, 100))
                .setValue(item.id));
        }
        if (pageItems.length > 0) {
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
        }
        // Pagination row (if any)
        if (totalPages > 1) {
            const navRow = new discord_js_1.ActionRowBuilder();
            if (currentPage > 1) {
                navRow.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`shop_${activeCategory}_all_${currentPage - 1}_${userId}`)
                    .setLabel('⬅ Trang Trước')
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            }
            if (currentPage < totalPages) {
                navRow.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`shop_${activeCategory}_all_${currentPage + 1}_${userId}`)
                    .setLabel('Trang Sau ➡')
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            }
            rows.push(navRow);
        }
    }
    return rows;
}
class ShopCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('shop')
            .setDescription('Cửa hàng phường thị Tu Chân.')
            .addSubcommand(sub => sub
            .setName('danhsach')
            .setDescription('Xem danh sách các vật phẩm bày bán.'))
            .addSubcommand(sub => sub
            .setName('mua')
            .setDescription('Mua vật phẩm từ phường thị.')
            .addStringOption(opt => opt
            .setName('item_id')
            .setDescription('Mã vật phẩm cần mua.')
            .setRequired(true))
            .addIntegerOption(opt => opt
            .setName('soluong')
            .setDescription('Số lượng cần mua (mặc định 1).')
            .setRequired(false))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'danhsach') {
            const embed = getShopEmbed(userId);
            const components = getShopComponents(userId);
            await interaction.reply({ embeds: [embed], components });
            return;
        }
        if (sub === 'mua') {
            const itemId = interaction.options.getString('item_id', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            if (qty <= 0) {
                await interaction.reply({ content: '❌ Số lượng mua phải lớn hơn 0!', ephemeral: true });
                return;
            }
            const item = exports.SHOP_ITEMS.find(i => i.id === itemId);
            if (!item) {
                await interaction.reply({ content: '❌ Vật phẩm ID này không được bán tại cửa hàng!', ephemeral: true });
                return;
            }
            const totalCost = item.price * qty;
            if (item.currency === 'knb') {
                if (user.knb < totalCost) {
                    await interaction.reply({
                        content: `❌ Đạo hữu không đủ KNB! (Tổng chi phí: **${totalCost}** KNB, hiện có: **${user.knb}** KNB).`,
                        ephemeral: true
                    });
                    return;
                }
                let realItemId = item.id;
                if (item.id === 'item_nhan_dinh_hon_knb')
                    realItemId = 'item_nhan_dinh_hon';
                if (item.id === 'item_bloodline_pill_knb')
                    realItemId = 'item_bloodline_pill';
                const tx = database_1.default.transaction(() => {
                    checkAndUpdateWeeklyLimit(userId, item.id, qty);
                    UserRepository_1.userRepository.update(userId, { knb: user.knb - totalCost });
                    InventoryRepository_1.inventoryRepository.addItem(userId, realItemId, qty);
                });
                try {
                    tx();
                }
                catch (error) {
                    await interaction.reply({ content: `❌ Mua hàng thất bại: ${error.message}`, ephemeral: true });
                    return;
                }
                const updatedUser = UserRepository_1.userRepository.get(userId);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🛒 MUA HÀNG THÀNH CÔNG 🛒')
                    .setColor('#2ecc71')
                    .setDescription(`Đạo hữu mua thành công **${qty}x ${item.name}**!`)
                    .addFields({ name: '💎 Chi phí', value: `**-${totalCost}** KNB`, inline: true }, { name: '💼 Số dư hiện tại', value: `**${(0, constants_1.formatNumber)(updatedUser.knb)}** KNB`, inline: true })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }
            else {
                if (user.coin_ha_pham < totalCost) {
                    await interaction.reply({
                        content: `❌ Đạo hữu không đủ Linh Thạch! (Tổng chi phí: **${totalCost}** Linh Thạch, hiện có: **${user.coin_ha_pham}**).`,
                        ephemeral: true
                    });
                    return;
                }
                const tx = database_1.default.transaction(() => {
                    checkAndUpdateWeeklyLimit(userId, item.id, qty);
                    UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - totalCost });
                    InventoryRepository_1.inventoryRepository.addItem(userId, item.id, qty);
                });
                try {
                    tx();
                }
                catch (error) {
                    await interaction.reply({ content: `❌ Mua hàng thất bại: ${error.message}`, ephemeral: true });
                    return;
                }
                const updatedUser = UserRepository_1.userRepository.get(userId);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🛒 MUA HÀNG THÀNH CÔNG 🛒')
                    .setColor('#2ecc71')
                    .setDescription(`Đạo hữu mua thành công **${qty}x ${item.name}**!`)
                    .addFields({ name: '🪙 Chi phí', value: `**-${totalCost}** Linh Thạch Hạ Phẩm`, inline: true }, { name: '💼 Số dư hiện tại', value: `**${(0, constants_1.formatNumber)(updatedUser.coin_ha_pham)}** Linh Thạch`, inline: true })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }
        }
    }
}
exports.default = ShopCommand;
