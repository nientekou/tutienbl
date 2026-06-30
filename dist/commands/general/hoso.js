"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTabNavigationRows = getTabNavigationRows;
exports.getHoSoActionMenus = getHoSoActionMenus;
exports.getHoSoAllComponents = getHoSoAllComponents;
exports.getInventoryEmbed = getInventoryEmbed;
exports.getInventoryComponents = getInventoryComponents;
exports.getHoSoTabEmbed = getHoSoTabEmbed;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const AchievementService_1 = require("../../services/AchievementService");
const InventoryService_1 = require("../../services/InventoryService");
const MountService_1 = require("../../services/MountService");
const SpiritWeaponService_1 = require("../../services/SpiritWeaponService");
const BloodlineService_1 = require("../../services/BloodlineService");
const database_1 = __importDefault(require("../../database/database"));
const TAB_LABELS = {
    chiso: { name: 'Chỉ Số', emoji: '📊' },
    taisan: { name: 'Tài Sản', emoji: '🪙' },
    chientich: { name: 'Chiến Tích', emoji: '🏆' },
    trangbi: { name: 'Trang Bị', emoji: '⚔️' },
    linhthu: { name: 'Linh Thú', emoji: '🐉' },
    somenh: { name: 'Số Mệnh', emoji: '📜' },
    bangxephang: { name: 'Bảng Phong Thần', emoji: '👑' },
    thongke: { name: 'Thống Kê', emoji: '📈' },
};
const SLOT_EMOJI = {
    weapon: '⚔️', armor: '🛡️', ring: '💍', necklace: '📿', amulet: '🔮', mount: '🐎', treasure: '🏺',
};
function getDayGreeting() {
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 3600000);
    const h = vnTime.getUTCHours();
    if (h < 6)
        return '🌙 Khuya rồi mà vẫn tu luyện sao?';
    if (h < 12)
        return '🌅 Sớm mai an lành, chúc đạo hữu tu tiên tấn tới!';
    if (h < 18)
        return '☀️ Trời đẹp, đạo hữu nên đi khám phá dã ngoại!';
    return '🌆 Hoàng hôn buông xuống, linh khí dồi dào, thích hợp thiền định.';
}
const TITLE_BUFFS = {
    'Thiên Trụ': '❤️ HP +5%, ⚔️ ATK +5%, 🛡️ DEF +5%',
    'Thánh Địa Bá Chủ': '⚔️ ATK +5%',
    'Chiến Thần Vô Song': '⚔️ ATK +8%',
    'Truyền Thừa Danh Môn': '🛡️ DEF +5%',
};
function getTitleLine(user) {
    const title = user.title || 'Tán Tu';
    const buff = title !== 'Tán Tu' && TITLE_BUFFS[title] ? ` *(Buff: ${TITLE_BUFFS[title]})*` : '';
    return `🏆 **Danh hiệu:** **${title}**${buff}`;
}
function getChiSoTabEmbed(user, activeStats) {
    const realmInfo = (0, constants_1.getRealmDetails)(user.level);
    const progressBar = (0, constants_1.getProgressBar)(user.tu_vi, user.exp_needed);
    const formattedLinhCan = (0, constants_1.formatLinhCan)(user.linh_can);
    const speed = user.base_speed ?? 100;
    const dodge = user.base_dodge ?? 0.05;
    const baseCp = Math.round(user.base_hp * 0.2 + user.base_mp * 0.1 + user.base_atk * 3 + user.base_def * 5 +
        user.base_crit * 1000 + user.base_crit_res * 1000 + user.base_luck * 10 +
        speed * 10 + dodge * 1000);
    const activeMount = MountService_1.mountService.getActiveMount(user.discord_id);
    const spiritWeapons = SpiritWeaponService_1.spiritWeaponService.getSpiritWeapons(user.discord_id);
    const activePet = database_1.default.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(user.discord_id);
    const userBloodline = BloodlineService_1.bloodlineService.getUserBloodline(user.discord_id);
    const { caveService } = require('../../services/CaveService');
    const cave = caveService.getCave(user.discord_id);
    const springLvl = cave.spring_level || 1;
    const meridianLvl = cave.meridian_level || 0;
    const arrayLvl = cave.array_level || 0;
    let mountLine = '🐎 Tọa kỵ: *Chưa cưỡi*';
    if (activeMount) {
        mountLine = `🐎 Tọa kỵ: **${activeMount.name}** (Tốc +${Math.round(activeMount.speed_bonus * 100)}% • TK +${Math.round(activeMount.stamina_save * 100)}%)`;
    }
    let spiritLine = '⚡ Khí linh: *Chưa thức tỉnh*';
    if (spiritWeapons.length > 0) {
        const sw = spiritWeapons[0];
        spiritLine = `⚡ Khí linh: **${sw.spirit_name}** (Cấp ${sw.level} • Thân thiết ${sw.affinity})`;
    }
    let petLine = '🐾 Sủng thú: *Chưa phái ra trận*';
    if (activePet) {
        const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
        petLine = `🐾 Sủng thú: ${rarityEmoji[activePet.rarity] || '⚪'} **${activePet.name}** (Cấp ${activePet.level})`;
    }
    let bloodlineLine = '🩸 Huyết mạch: *Chưa giác tỉnh*';
    if (userBloodline) {
        bloodlineLine = `🩸 Huyết mạch: **${userBloodline.name}** (Cấp ${userBloodline.level})`;
    }
    const greeting = getDayGreeting();
    const showCp = activeStats ? Math.round(activeStats.hp * 0.2 + activeStats.mp * 0.1 + activeStats.atk * 3 + activeStats.def * 5 +
        activeStats.crit * 1000 + activeStats.critRes * 1000 + activeStats.luck * 10 +
        activeStats.speed * 10 + activeStats.dodge * 1000) : baseCp;
    let alignmentStr = 'Tán Tu ⚪';
    if (user.alignment === 'orthodox')
        alignmentStr = 'Chính Đạo ⚖️';
    else if (user.alignment === 'demonic')
        alignmentStr = 'Ma Đạo 👿';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🔮 HỒ SƠ TU SĨ - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.PRIMARY)
        .setDescription(`*${greeting}*\n\n` +
        `👤 **Đạo hiệu:** **${user.name}**\n` +
        `${getTitleLine(user)}\n` +
        `⚡ **Tiên Lực (Lực Chiến):** 🌌 **${(0, constants_1.formatNumber)(showCp)}**` +
        (user.luan_hoi_count > 0 ? `\n🌀 **Luân Hồi:** **Chuyển Thế Đời thứ ${user.luan_hoi_count}**` : ''))
        .addFields({
        name: '📈 Tiến Trình Tu Vi',
        value: `${progressBar}\n🎯 **EXP:** **${(0, constants_1.formatNumber)(user.tu_vi)}** / **${(0, constants_1.formatNumber)(user.exp_needed)}**`,
        inline: false,
    }, {
        name: '✨ Trạng Thái',
        value: [
            `Cảnh giới: **${realmInfo.fullName}**`,
            `Đạo Thống: **${alignmentStr}**`,
            `Ngộ Tính: **${user.ngotinh}**`,
            `Thể Lực: **${user.stamina}/500**`,
            `May Mắn: **${user.base_luck}**`,
        ].join('\n'),
        inline: true,
    }, {
        name: '☯️ Căn Cơ Linh Căn',
        value: formattedLinhCan,
        inline: true,
    }, ...(activeStats?.elementResonance?.resonance ? [{
            name: `⚡ Cộng Hưởng Linh Căn (${activeStats.elementResonance.element})`,
            value: `📍 **Đã kích hoạt!**\n${activeStats.elementResonance.buffs.map(b => `• ${b}`).join('\n')}`,
            inline: true,
        }] : []), {
        name: '👥 Đồng Hành & Động Phủ',
        value: [
            petLine,
            bloodlineLine,
            mountLine,
            spiritLine,
            `🏰 Động Phủ: **Cấp ${cave.level}** (Linh Tuyền Lvl ${springLvl} | Linh Mạch Lvl ${meridianLvl} | Trận Lvl ${arrayLvl})`
        ].join('\n'),
        inline: false,
    });
    if (user.partner_id) {
        const partner = UserRepository_1.userRepository.get(user.partner_id);
        if (partner) {
            embed.addFields({
                name: '💖 Đạo Lữ',
                value: `**${partner.name}** • Thân mật: **${user.intimacy}** 🌸`,
                inline: false,
            });
        }
    }
    if (activeStats) {
        embed.spliceFields(0, 0, {
            name: '📊 Chỉ Số Chiến Đấu (Cơ Bản → Kèm Đồ)',
            value: [
                `**Sinh Mệnh (HP):** ${(0, constants_1.formatStatDiff)(user.base_hp, activeStats.hp)}`,
                `**Pháp Lực (MP):** ${(0, constants_1.formatStatDiff)(user.base_mp, activeStats.mp)}`,
                `**Tấn Công (ATK):** ${(0, constants_1.formatStatDiff)(user.base_atk, activeStats.atk)}`,
                `**Phòng Ngự (DEF):** ${(0, constants_1.formatStatDiff)(user.base_def, activeStats.def)}`,
                `**Bạo Kích (CRIT):** ${(0, constants_1.formatStatDiff)(Math.round(user.base_crit * 1000) / 10, Math.round(activeStats.crit * 1000) / 10, '%')} | **Kháng Bạo:** ${(0, constants_1.formatStatDiff)(Math.round(user.base_crit_res * 1000) / 10, Math.round(activeStats.critRes * 1000) / 10, '%')}`,
                `**Tốc Độ (SPD):** ${(0, constants_1.formatStatDiff)(user.base_speed ?? 100, activeStats.speed)} | **Né Tránh:** ${(0, constants_1.formatStatDiff)(Math.round((user.base_dodge ?? 0.05) * 1000) / 10, Math.round(activeStats.dodge * 1000) / 10, '%')}`,
                `**May Mắn (LUCK):** ${(0, constants_1.formatStatDiff)(user.base_luck, activeStats.luck)}`,
            ].join('\n'),
            inline: false,
        });
    }
    else {
        embed.spliceFields(0, 0, {
            name: '📊 Chỉ Số Chiến Đấu Cơ Bản',
            value: [
                `**Sinh Mệnh (HP):** **${(0, constants_1.formatNumber)(user.base_hp)}** | **Pháp Lực (MP):** **${(0, constants_1.formatNumber)(user.base_mp)}**`,
                `**Tấn Công (ATK):** **${(0, constants_1.formatNumber)(user.base_atk)}** | **Phòng Ngự (DEF):** **${(0, constants_1.formatNumber)(user.base_def)}**`,
                `**Bạo Kích (CRIT):** **${(user.base_crit * 100).toFixed(1)}%** | **Kháng Bạo:** **${(user.base_crit_res * 100).toFixed(1)}%**`,
                `**Tốc Độ (SPD):** **${speed}** | **Né Tránh:** **${(dodge * 100).toFixed(1)}%**`,
                `**May Mắn (LUCK):** **${user.base_luck}**`,
            ].join('\n'),
            inline: false,
        });
    }
    embed.setFooter({ text: '📖 Xem Cẩm Nang Tiên Lộ với /camnang' });
    return embed;
}
function getTaiSanTabEmbed(user) {
    const inv = InventoryRepository_1.inventoryRepository.getUserInventory(user.discord_id);
    const equippedCount = inv.filter(i => i.is_equipped === 1).length;
    const totalItems = inv.reduce((sum, i) => sum + i.quantity, 0);
    const totalWealth = user.coin_ha_pham +
        user.coin_trung_pham * 100 +
        user.coin_thuong_pham * 10000 +
        user.knb * 10000;
    let sectInfo = '🚫 Chưa gia nhập';
    if (user.sect_id) {
        const sect = database_1.default.prepare('SELECT name, level FROM sects WHERE id = ?').get(user.sect_id);
        if (sect)
            sectInfo = `📜 **${sect.name}** (Cấp ${sect.level}) • Cống hiến: **${(0, constants_1.formatNumber)(user.sect_contribution)}**`;
    }
    const materialCount = inv.filter(i => i.type === 'material').reduce((s, i) => s + i.quantity, 0);
    const pillCount = inv.filter(i => i.type === 'pill').reduce((s, i) => s + i.quantity, 0);
    const equipmentCount = inv.filter(i => i.type === 'equipment').length;
    const chestCount = inv.filter(i => i.type === 'chest').reduce((s, i) => s + i.quantity, 0);
    const mountCount = database_1.default.prepare('SELECT COUNT(*) as c FROM mounts WHERE user_id = ?').get(user.discord_id);
    const spiritCount = database_1.default.prepare('SELECT COUNT(*) as c FROM spirit_weapons WHERE user_id = ?').get(user.discord_id);
    return new discord_js_1.EmbedBuilder()
        .setTitle(`🪙 TÀI SẢN - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.GOLD)
        .setDescription(`*Tổng tài sản quy đổi:* 💰 **${(0, constants_1.formatNumber)(totalWealth)}** Hạ Phẩm Linh Thạch`)
        .addFields({
        name: '🪙 Linh Thạch & KNB',
        value: [
            `🟤 **Hạ Phẩm:** **${(0, constants_1.formatNumber)(user.coin_ha_pham)}** LT`,
            `⚪ **Trung Phẩm:** **${(0, constants_1.formatNumber)(user.coin_trung_pham)}** LT`,
            `🟡 **Thượng Phẩm:** **${(0, constants_1.formatNumber)(user.coin_thuong_pham)}** LT`,
            `💎 **Kim Nguyên Bảo:** **${(0, constants_1.formatNumber)(user.knb)}** KNB`,
        ].join('\n'),
        inline: true,
    }, {
        name: '💼 Hành Trang',
        value: [
            `📦 **Tổng số:** **${(0, constants_1.formatNumber)(totalItems)}** món`,
            `🛡️ **Trang bị mặc:** **${equippedCount}** món`,
            `🌿 **Nguyên liệu:** **${(0, constants_1.formatNumber)(materialCount)}** món`,
            `💊 **Đan dược:** **${(0, constants_1.formatNumber)(pillCount)}** món`,
            `📦 **Rương đạo cụ:** **${(0, constants_1.formatNumber)(chestCount)}** cái`,
        ].join('\n'),
        inline: true,
    }, {
        name: '🐉 Linh Thú & Tọa Kỵ',
        value: [
            `🐎 **Tọa kỵ:** **${mountCount?.c || 0}** con`,
            `⚡ **Khí linh:** **${spiritCount?.c || 0}** pháp bảo`,
        ].join('\n'),
        inline: true,
    }, {
        name: '☯️ Tông Môn',
        value: sectInfo,
        inline: false,
    })
        .setFooter({ text: 'Dùng /tuido để xem chi tiết | /vanbaolau để giao dịch' })
        .setTimestamp();
}
function getChienTichTabEmbed(user) {
    const completedAchievements = AchievementService_1.achievementService.countCompleted(user.discord_id);
    const totalAchievements = AchievementService_1.achievementService.getAllAchievements().length;
    const petData = database_1.default.prepare('SELECT name, level, rarity, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1').get(user.discord_id);
    const petCount = database_1.default.prepare('SELECT COUNT(*) as c FROM pets WHERE user_id = ?').get(user.discord_id);
    const pvpWins = user.pvp_wins || 0;
    const pvpLosses = user.pvp_losses || 0;
    const totalGames = pvpWins + pvpLosses;
    const winRate = totalGames > 0 ? Math.round((pvpWins / totalGames) * 100) : 0;
    let winRateBar = '';
    if (winRate > 0) {
        const filled = Math.round(winRate / 10);
        winRateBar = `\`[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]\` **${winRate}%**`;
    }
    let activePetDesc = '🚫 Chưa có';
    if (petData) {
        const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
        activePetDesc = `${rarityEmoji[petData.rarity] || '⚪'} **${petData.name}** (Cấp ${petData.level}) • Tấn công: **${petData.base_atk}**`;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🏆 CHIẾN TÍCH - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.ERROR)
        .setDescription(`*Hành trình tu đạo của* **${user.name}** *qua những con số*`)
        .addFields({
        name: '⚔️ Chiến Trường PvP',
        value: [
            `🎖️ **Điểm Phong Thần:** **${(0, constants_1.formatNumber)(user.pvp_points)}**`,
            `🔥 **Thắng trận:** **${(0, constants_1.formatNumber)(pvpWins)}** | 💀 **Thất bại:** **${(0, constants_1.formatNumber)(pvpLosses)}**`,
            winRateBar ? `📊 **Tỷ lệ thắng:** ${winRateBar}` : '',
        ].filter(Boolean).join('\n'),
        inline: true,
    }, {
        name: '🏆 Thành Tựu & Danh Hiệu',
        value: [
            `📊 **Tiến độ:** **${completedAchievements}/${totalAchievements}** (${totalAchievements > 0 ? Math.round((completedAchievements / totalAchievements) * 100) : 0}%)`,
            `🎖️ **Danh hiệu đã mở:** **${AchievementService_1.achievementService.getUserTitles(user.discord_id).length}**`,
            `\n*Dùng \`/thanhtuu\` để xem chi tiết*`,
        ].join('\n'),
        inline: true,
    }, {
        name: '🌀 Luân Hồi & Sủng Thú',
        value: [
            `🌀 **Luân hồi:** **${user.luan_hoi_count}** lần`,
            `🐾 **Linh thú sở hữu:** **${petCount?.c || 0}** con`,
            `🐉 **Đang xuất chiến:** ${activePetDesc}`,
            `🔮 **Ngộ Tính tích lũy:** **${(0, constants_1.formatNumber)(user.ngotinh)}** điểm`,
            `🌌 **Ý Cảnh đại đạo:** **${(() => { try {
                const y = JSON.parse(user.y_canh || '{}');
                return Object.keys(y).filter(k => ['KiemY', 'BatDietY', 'HuyenQuyY'].includes(k)).length;
            }
            catch {
                return 0;
            } })()}** loại`,
        ].join('\n'),
        inline: false,
    }, 
    // W9-03: Extended stats
    {
        name: '📊 Thống Kê Mở Rộng',
        value: (() => {
            const stats = [];
            // Tower
            try {
                const tower = database_1.default.prepare('SELECT max_floor FROM roguelike_progress WHERE user_id = ?').get(user.discord_id);
                if (tower)
                    stats.push(`🏯 **Tháp cao nhất:** Tầng **${tower.max_floor}**`);
            }
            catch { }
            // Beast collection
            try {
                const beastCount = database_1.default.prepare('SELECT COUNT(DISTINCT beast_type) as c FROM rare_beasts WHERE user_id = ?').get(user.discord_id);
                if (beastCount)
                    stats.push(`🐉 **Linh thú hiếm:** **${beastCount.c}** loại`);
            }
            catch { }
            // Dream Dust
            stats.push(`✨ **Dust Mộng:** **${(0, constants_1.formatNumber)(user.dream_dust || 0)}**`);
            // Bounty tokens
            stats.push(`🎫 **Phiếu Săn Thưởng:** **${(0, constants_1.formatNumber)(user.bounty_tokens || 0)}**`);
            // Destiny shards
            stats.push(`🔮 **Mảnh Mệnh Cách:** **${(0, constants_1.formatNumber)(user.destiny_shards || 0)}**`);
            // Reincarnation tokens
            stats.push(`🔄 **Phiếu Luân Hồi:** **${(0, constants_1.formatNumber)(user.reincarnation_tokens || 0)}**`);
            return stats.join('\n') || 'Chưa có thống kê';
        })(),
        inline: false,
    })
        .setFooter({ text: 'Tiếp tục tu luyện để mở thêm thành tựu!' })
        .setTimestamp();
    return embed;
}
function getTrangBiTabEmbed(user) {
    const equippedItems = database_1.default.prepare(`
    SELECT i.*, t.name, t.rarity, t.description
    FROM inventories i
    JOIN items t ON i.item_id = t.id
    WHERE i.user_id = ? AND i.is_equipped = 1
  `).all(user.discord_id);
    const slotOrder = ['weapon', 'armor', 'ring', 'necklace', 'amulet', 'mount', 'treasure'];
    const slotNames = {
        weapon: 'Vũ Khí', armor: 'Đạo Bào', ring: 'Nhẫn', necklace: 'Dây Chuyền',
        amulet: 'Bùa Hộ Mệnh', mount: 'Tọa Kỵ', treasure: 'Pháp Bảo',
    };
    const rarityColor = {
        common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '🔴',
    };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`⚔️ TRANG BỊ - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.DARK_PURPLE)
        .setDescription('*Các trang bị đang mặc trên người:*')
        .setTimestamp();
    for (const slot of slotOrder) {
        const item = equippedItems.find((i) => i.equipment_slot === slot);
        if (item) {
            const stats = item.custom_stats ? (() => { try {
                return JSON.parse(item.custom_stats);
            }
            catch {
                return {};
            } })() : {};
            const statParts = [];
            if (stats.atk)
                statParts.push(`Công +${stats.atk}`);
            if (stats.def)
                statParts.push(`Thủ +${stats.def}`);
            if (stats.hp)
                statParts.push(`HP +${stats.hp}`);
            if (stats.mp)
                statParts.push(`MP +${stats.mp}`);
            const starStr = item.stars > 0 ? '⭐'.repeat(item.stars) : '';
            const enhanceStr = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
            embed.addFields({
                name: `${SLOT_EMOJI[slot] || '📦'} ${slotNames[slot] || slot}`,
                value: `\`[Mã: ${item.id}]\` ${rarityColor[item.rarity] || '⚪'} **${item.name}${enhanceStr}** ${starStr}\n*${statParts.join(' | ') || 'Không có chỉ số phụ'}*`,
                inline: true,
            });
        }
        else {
            embed.addFields({
                name: `${SLOT_EMOJI[slot] || '📦'} ${slotNames[slot] || slot}`,
                value: '🍃 *Chưa trang bị*',
                inline: true,
            });
        }
    }
    embed.setFooter({ text: 'Dùng /trangbi để quản lý | /tuido để xem kho đồ' });
    return embed;
}
function getLinhThuTabEmbed(user) {
    const activeMount = MountService_1.mountService.getActiveMount(user.discord_id);
    const allMounts = MountService_1.mountService.getMounts(user.discord_id);
    const spiritWeapons = SpiritWeaponService_1.spiritWeaponService.getSpiritWeapons(user.discord_id);
    const activePet = database_1.default.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(user.discord_id);
    const allPets = database_1.default.prepare('SELECT * FROM pets WHERE user_id = ? ORDER BY level DESC').all(user.discord_id);
    const userBloodline = BloodlineService_1.bloodlineService.getUserBloodline(user.discord_id);
    const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🐉 LINH THÚ & HUYẾT MẠCH - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
        .setDescription('*Các linh thú, tọa kỵ, khí linh và huyết mạch đang đồng hành cùng đạo hữu*')
        .setTimestamp();
    // Active pet
    if (activePet) {
        let mut = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
        try {
            if (activePet.mutations) {
                mut = JSON.parse(activePet.mutations);
            }
        }
        catch (e) { }
        const starStr = mut.stars > 0 ? ` [${'★'.repeat(mut.stars)}]` : '';
        const bonusAtk = mut.bonus_atk > 0 ? ` (+${mut.bonus_atk})` : '';
        const bonusDef = mut.bonus_def > 0 ? ` (+${mut.bonus_def})` : '';
        const bonusHp = mut.bonus_hp > 0 ? ` (+${mut.bonus_hp})` : '';
        embed.addFields({
            name: `🐾 Sủng Thú Đang Xuất Chiến${starStr}`,
            value: [
                `• **Tên thú:** **${activePet.name}** (Cấp ${activePet.level})`,
                `• **Phẩm chất:** ${rarityEmoji[activePet.rarity] || '⚪'} **${activePet.rarity.toUpperCase()}**`,
                `• **Thuộc tính:** ⚔️ Công: **${activePet.base_atk}**${bonusAtk} | 🛡️ Thủ: **${activePet.base_def}**${bonusDef} | ❤️ HP: **${activePet.base_hp}**${bonusHp}`
            ].join('\n'),
            inline: false,
        });
    }
    else {
        embed.addFields({
            name: '🐾 Sủng Thú',
            value: `🚫 *Chưa phái ra trận.*\n*Dùng \`/sanyeuthu\` để săn bắt linh thú! (Trong chuồng: **${allPets.length}** con)*`,
            inline: false,
        });
    }
    // Active mount
    if (activeMount) {
        const bar = '█'.repeat(Math.floor((activeMount.level / 10) * 10)) + '░'.repeat(10 - Math.floor((activeMount.level / 10) * 10));
        embed.addFields({
            name: `🐎 Tọa Kỵ Đang Cưỡi`,
            value: [
                `• **Tên thú:** **${activeMount.name}** [${activeMount.rarity.toUpperCase()}]`,
                `• **Cấp độ:** **${activeMount.level}/10** \`[${bar}]\``,
                `• **Thuộc tính:** 🏇 Tốc chạy: +**${Math.round(activeMount.speed_bonus * 100)}%** | ⚡ Thể lực tiết kiệm: +**${Math.round(activeMount.stamina_save * 100)}%**`
            ].join('\n'),
            inline: false,
        });
    }
    if (allMounts.length > 0 && !activeMount) {
        embed.addFields({
            name: '🐎 Tọa Kỵ',
            value: `*Đang sở hữu **${allMounts.length}** tọa kỵ. Dùng \`/toaky cuoi\` để cưỡi!*`,
            inline: false,
        });
    }
    // Spirit weapons
    if (spiritWeapons.length > 0) {
        for (const sw of spiritWeapons) {
            const affinityBar = '❤️'.repeat(Math.min(Math.floor(sw.affinity / 20), 5)) + '🖤'.repeat(Math.max(0, 5 - Math.floor(sw.affinity / 20)));
            embed.addFields({
                name: `⚡ Khí Linh: ${sw.spirit_name} (ID: ${sw.id})`,
                value: [
                    `• **Đẳng cấp:** Cấp **${sw.level}**`,
                    `• **Độ thân thiết:** ${affinityBar} (${sw.affinity}/100)`,
                    `• **Thần thông kỹ năng:** **${sw.skill_id || 'Chưa thức tỉnh'}**`,
                    `*Dùng \`/khilinh tuongtac\` với ID để tăng hảo cảm.*`
                ].join('\n'),
                inline: false,
            });
        }
    }
    else {
        embed.addFields({
            name: '⚡ Khí Linh',
            value: '🚫 *Chưa thức tỉnh khí linh. Hãy dùng \`/khilinh thuctinh\` trên trang bị Epic+.*',
            inline: false,
        });
    }
    // Huyết mạch
    if (userBloodline) {
        const passives = BloodlineService_1.bloodlineService.getActivePassives(userBloodline);
        const nextLevelExp = userBloodline.level * 200;
        const isMaxLevel = userBloodline.level >= 50;
        let passiveDesc = '';
        if (passives.hp_steal)
            passiveDesc += `• 🩸 Hút máu: +**${(passives.hp_steal * 100).toFixed(0)}%**\n`;
        if (passives.revive_chance)
            passiveDesc += `• 🔥 Tỷ lệ hồi sinh: **${(passives.revive_chance * 100).toFixed(0)}%**\n`;
        if (passives.dmg_reduce)
            passiveDesc += `• 🛡️ Giảm sát thương: **${(passives.dmg_reduce * 100).toFixed(0)}%**\n`;
        if (passives.crit_rate)
            passiveDesc += `• 💥 Tỷ lệ bạo kích: +**${(passives.crit_rate * 100).toFixed(0)}%**\n`;
        if (passives.max_hp)
            passiveDesc += `• ❤️ Tăng HP tối đa: +**${(passives.max_hp * 100).toFixed(0)}%**\n`;
        if (passives.shield_start)
            passiveDesc += `• 🔰 Khiên khởi đầu: **${(passives.shield_start * 100).toFixed(0)}%** HP\n`;
        if (passives.speed)
            passiveDesc += `• ⚡ Tăng tốc độ: +**${(passives.speed * 100).toFixed(0)}%**\n`;
        const progressStr = isMaxLevel ? ' (Tối Đa)' : `\n📈 **Tiến độ EXP:** **${userBloodline.exp}** / **${nextLevelExp}**`;
        embed.addFields({
            name: `🩸 Huyết Mạch Giác Tỉnh: ${userBloodline.name}`,
            value: [
                `• **Cảnh giới huyết mạch:** Cấp **${userBloodline.level}**${progressStr}`,
                `• **Thần thông nội tại:**\n${passiveDesc || '*Chưa kích hoạt*'}`.trim(),
                `• **Huyết Mạch Nộ kỹ:** Tăng sức mạnh x**${userBloodline.rage_effect.multiplier || 2}** trong **${userBloodline.rage_effect.duration || 3}** hiệp đấu.`
            ].join('\n'),
            inline: false
        });
    }
    else {
        embed.addFields({
            name: '🩸 Huyết Mạch',
            value: '🚫 *Chưa giác tỉnh. Đạt Cấp 10 và dùng \`/huyetmach chon\` để giác tỉnh huyết mạch thượng cổ!*',
            inline: false
        });
    }
    embed.setFooter({ text: 'Dùng /toaky, /sanyeuthu, /khilinh, /huyetmach để quản lý' });
    return embed;
}
function getSoMenhTabEmbed(user) {
    const prophecy = user.prophecy || 'Số phận mù mịt, chưa rõ đường đi.';
    let heirloomText = 'Không có vật gia truyền.';
    if (user.heirloom) {
        try {
            const h = JSON.parse(user.heirloom);
            heirloomText = `${h.icon} **${h.name}**\n*${h.description}*\nHiệu ứng: **${h.effect}**`;
        }
        catch (e) {
            heirloomText = user.heirloom;
        }
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`📜 SỐ MỆNH & KỲ DUYÊN - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.DARK)
        .setDescription(`*Định mệnh đã an bài, hay do tự tay ngươi xoay chuyển?*`)
        .addFields({
        name: '🔮 Lá Số Tử Vi',
        value: `*${prophecy}*`,
        inline: false,
    }, {
        name: '🏺 Vật Gia Truyền',
        value: heirloomText,
        inline: false,
    })
        .setFooter({ text: 'Lá số tử vi là cơ duyên trời ban, không thể thay đổi.' })
        .setTimestamp();
    return embed;
}
function getTabNavigationRows(userId, activeTab) {
    const tabs = ['chiso', 'taisan', 'chientich', 'trangbi', 'linhthu', 'somenh', 'bangxephang', 'thongke'];
    const rows = [];
    for (let i = 0; i < tabs.length; i += 4) {
        const rowTabs = tabs.slice(i, i + 4);
        const row = new discord_js_1.ActionRowBuilder().addComponents(...rowTabs.map(tab => {
            const info = TAB_LABELS[tab];
            const isActive = tab === activeTab;
            return new discord_js_1.ButtonBuilder()
                .setCustomId(`hosotab_${tab}_${userId}`)
                .setLabel(`${info.emoji} ${info.name}`)
                .setStyle(isActive ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
                .setDisabled(isActive);
        }));
        rows.push(row);
    }
    return rows;
}
function getHoSoActionMenus(userId) {
    const selectMenu1 = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`hosoaction1_${userId}`)
        .setPlaceholder('⚔️ Tu Luyện, Vượt Ải & Khiêu Chiến')
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🧘 Thiền Định (Tu Luyện)').setValue('tuluyen').setDescription('Hấp thu linh khí thiên địa tu luyện'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚡ Đột Phá Cảnh Giới').setValue('dotpha').setDescription('Bức phá bình cảnh cảnh giới'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌀 Tẩy Tủy Linh Căn').setValue('taytuynav').setDescription('Đổi ngũ hành linh căn (Tốn 100 LT)'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌌 Ngộ Ý Cảnh').setValue('ycanhnaav').setDescription('Lĩnh ngộ đại đạo ý cảnh'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('📜 Nhiệm Vụ Thiên Cơ Các').setValue('nhiemvunav').setDescription('Kiểm tra nhiệm vụ hàng ngày'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🗺️ Khám Phá Địa Đồ').setValue('khambhanav').setDescription('Du ngoạn thám hiểm khắp nơi'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🐺 Săn Bắn Yêu Thú').setValue('sanyeuthunaav').setDescription('Tiêu diệt dã thú nhặt chiến lợi phẩm'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🔮 Khiêu Chiến Bí Cảnh').setValue('bicanhnaav').setDescription('Khiêu chiến phó bản bí cảnh viễn cổ'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🏯 Khiêu Chiến Trấn Yêu Tháp').setValue('leothapnav').setDescription('Leo Tháp Vô Hạn trừ ma'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🛡️ Khiêu Chiến World Boss').setValue('worldbossnav').setDescription('Đại chiến Boss toàn server'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚔️ Quyết Đấu PvP').setValue('quyetau').setDescription('Tỷ thí võ nghệ cướp linh thạch'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚔️ Đấu Trường PvP (Ranked)').setValue('arenanav').setDescription('Khiêu chiến đối thủ ELO nâng cao'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌀 Luân Hồi Trọng Sinh').setValue('luanhoinnav').setDescription('Chuyển thế đầu thai nhận thuộc tính vĩnh viễn'));
    const selectMenu2 = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`hosoaction2_${userId}`)
        .setPlaceholder('💼 Tiên Nghề, Sủng Vật & Giao Dịch')
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('💼 Mở Túi Đồ (Hành Trang)').setValue('tuido').setDescription('Xem và sử dụng vật phẩm'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🐉 Quản Lý Sủng Thú').setValue('sungthunaav').setDescription('Bố trí, huấn luyện linh thú xuất chiến'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🐎 Quản Lý Tọa Kỵ').setValue('toakynav').setDescription('Chăm sóc và nâng cấp thú cưỡi'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚡ Thức Tỉnh Khí Linh').setValue('spiritnav').setDescription('Thức tỉnh linh hồn pháp khí'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🛡️ Quản Lý Trang Bị').setValue('trangbinaav').setDescription('Mặc/Tháo và cường hóa trang bị'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⛏️ Làm Việc Kiếm Liệu').setValue('lamviecnav').setDescription('Chặt củi, đào mỏ tích lũy linh tài'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌿 Luyện Đan Dược').setValue('luyendannav').setDescription('Chế tạo đan dược phụ trợ'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🛠️ Chế Tạo Pháp Khí').setValue('chetaonav').setDescription('Rèn phôi chế tạo trang bị'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('⚒️ Rèn Đúc Luyện Khí').setValue('luyenkhinav').setDescription('Rèn đúc trang bị (Luyện Khí Sư)'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🌾 Chăm Sóc Linh Điền').setValue('linhdiennav').setDescription('Gieo hạt trồng trọt thảo mộc'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🏰 Quản Lý Động Phủ').setValue('dongphunav').setDescription('Quản lý Động Phủ Tiên Gia và Linh Mạch'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('☯️ Trở Về Tông Môn').setValue('tonmonnav').setDescription('Bái sư bách nghệ gia nhập tông môn'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🏪 Ghé Thăm Cửa Hàng').setValue('shopnav').setDescription('Mua sắm dược phẩm và vé khiêu chiến'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('📜 Tiệm Sách Kỹ Năng').setValue('shopkynangnav').setDescription('Mua sách học kỹ năng chiến đấu'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('🏛️ Sàn Giao Dịch Vạn Bảo Lâu').setValue('vanbaolaunav').setDescription('Mua bán tự do với tu sĩ khác'));
    return [
        new discord_js_1.ActionRowBuilder().addComponents(selectMenu1),
        new discord_js_1.ActionRowBuilder().addComponents(selectMenu2),
    ];
}
function getHoSoAllComponents(userId, activeTab = 'chiso') {
    const components = [];
    // Tab Bảng Phong Thần: hiển thị nút chọn danh mục & nút quay lại, ẩn các menu tab và menu hành động
    if (activeTab === 'bangxephang') {
        const lbTypes = [
            { id: 'combatPower', label: 'Lực Chiến', emoji: '⚔️' },
            { id: 'realm', label: 'Cảnh Giới', emoji: '🌀' },
            { id: 'wealth', label: 'Tài Sản', emoji: '🪙' },
            { id: 'sectContribution', label: 'Cống Hiến', emoji: '🏛️' },
        ];
        const row = new discord_js_1.ActionRowBuilder().addComponents(...lbTypes.map(t => new discord_js_1.ButtonBuilder()
            .setCustomId(`hosolb_${t.id}_${userId}`)
            .setLabel(`${t.emoji} ${t.label}`)
            .setStyle(discord_js_1.ButtonStyle.Secondary)), new discord_js_1.ButtonBuilder()
            .setCustomId(`hosoback_${userId}`)
            .setLabel('🔙 Trở Lại Hồ Sơ')
            .setStyle(discord_js_1.ButtonStyle.Primary));
        components.push(row);
    }
    else {
        // Các tab bình thường: hiển thị đầy đủ hàng điều hướng tab và menu hành động
        components.push(...getTabNavigationRows(userId, activeTab), ...getHoSoActionMenus(userId));
    }
    const user = UserRepository_1.userRepository.get(userId);
    if (user && user.level >= 39 && (!user.alignment || user.alignment === 'neutral')) {
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`select_alignment_${userId}`)
            .setLabel('🎭 Chọn Đạo Thống (Chính/Ma)')
            .setStyle(discord_js_1.ButtonStyle.Success));
        components.push(row);
    }
    return components;
}
const cleanedUsers = new Set();
function getInventoryEmbed(userId, page) {
    const ITEMS_PER_PAGE = 5;
    // Tự động xoá vật phẩm bất thường (chỉ chạy 1 lần mỗi session bot)
    if (!cleanedUsers.has(userId)) {
        cleanedUsers.add(userId);
        try {
            InventoryRepository_1.inventoryRepository.cleanupOrphanItems(userId);
        }
        catch (e) {
            console.error('[getInventoryEmbed] Lỗi cleanup orphan:', e);
        }
    }
    let totalItemsCount = 0;
    try {
        totalItemsCount = InventoryRepository_1.inventoryRepository.getUserInventoryCount(userId);
    }
    catch (e) {
        console.error('[getInventoryEmbed] Lỗi đếm inventory:', e);
        totalItemsCount = 0;
    }
    const totalPages = Math.max(Math.ceil(totalItemsCount / ITEMS_PER_PAGE), 1);
    const cappedPage = Math.min(Math.max(page, 1), totalPages);
    const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
    let itemsOnPage = [];
    try {
        itemsOnPage = InventoryRepository_1.inventoryRepository.getUserInventoryPaginated(userId, ITEMS_PER_PAGE, offset);
    }
    catch (e) {
        console.error('[getInventoryEmbed] Lỗi lấy inventory:', e);
        itemsOnPage = [];
    }
    // Filter out items with null name (orphan items that slipped through)
    itemsOnPage = itemsOnPage.filter(item => item && item.item_id);
    let description = `*Hành trang chứa đựng thiên tài địa bảo, trang bị và linh dược mà đạo hữu đã tích lũy trên đường tu tiên.*\n\n`;
    if (totalItemsCount === 0 || itemsOnPage.length === 0) {
        description += `*Hiện tại trống trơn. Hãy chăm chỉ dùng \`/lamviec\` hoặc chinh phục Bí Cảnh để tích lũy!*`;
    }
    else {
        itemsOnPage.forEach((item, index) => {
            const idx = offset + index + 1;
            const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '🔴' };
            const rarityTag = item.rarity ? `${rarityEmoji[item.rarity] || ''}[${item.rarity.toUpperCase()}] ` : '';
            const equippedText = item.is_equipped === 1 ? ` **🔸[ĐANG MẶC]**` : '';
            const starText = item.stars > 0 ? ` ⭐${item.stars}` : '';
            const enhanceText = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
            let itemStats = '';
            if (item.base_stats && item.base_stats !== '{}') {
                try {
                    const stats = JSON.parse(item.base_stats);
                    const bonus = [];
                    if (stats.atk)
                        bonus.push(`Công +${stats.atk}`);
                    if (stats.def)
                        bonus.push(`Thủ +${stats.def}`);
                    if (stats.hp)
                        bonus.push(`HP +${stats.hp}`);
                    if (stats.mp)
                        bonus.push(`MP +${stats.mp}`);
                    if (stats.add_tu_vi)
                        bonus.push(`Tu Vi +${stats.add_tu_vi}`);
                    if (bonus.length > 0)
                        itemStats = ` *(${bonus.join(', ')})*`;
                }
                catch (e) { }
            }
            const itemName = item.name || item.item_id || 'Vật phẩm lạ';
            description += `**${idx}.** ${rarityTag}**${itemName}${enhanceText}** x${item.quantity}${starText}${equippedText}${itemStats}\n*└ Mã: \`${item.id}\`*\n\n`;
        });
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`💼 HÀNH TRANG (Trang ${cappedPage}/${totalPages})`)
        .setColor(uiSystem_1.EMBED_COLORS.GOLD)
        .setDescription(description)
        .setFooter({ text: 'Dùng Mã (ID số) cho tất cả lệnh: /dung, /thanhly, /trade, /cuonghoa, /trangbi, /suachua, /khilinh, /loren, /vanbaolau, /dungkynang' })
        .setTimestamp();
    return { embed, totalPages, itemsOnPage };
}
function getInventoryComponents(userId, page, totalPages, itemsOnPage) {
    const rows = [];
    const buttonRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`invprev_${page - 1}_${userId}`)
        .setLabel('◀ Trang Trước')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setDisabled(page <= 1), new discord_js_1.ButtonBuilder()
        .setCustomId(`invnext_${page + 1}_${userId}`)
        .setLabel('Trang Sau ▶')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setDisabled(page >= totalPages), new discord_js_1.ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Hồ Sơ')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(buttonRow);
    const interactiveItems = itemsOnPage.filter(item => item.usable === 1 || item.equipable === 1);
    if (interactiveItems.length > 0) {
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`invselect_${page}_${userId}`)
            .setPlaceholder('⚡ Nhấp chọn vật phẩm: Sử Dụng / Trang Bị / Tháo');
        let optionCount = 0;
        const seenValues = new Set();
        for (const item of interactiveItems.slice(0, 25)) {
            let actionLabel = '';
            let value = '';
            if (item.is_equipped === 1) {
                actionLabel = `Tháo: ${item.name || 'Vật phẩm'}`;
                value = `unequip_${item.id}`;
            }
            else if (item.equipable === 1) {
                actionLabel = `Mặc: ${item.name || 'Vật phẩm'}`;
                value = `equip_${item.id}`;
            }
            else if (item.usable === 1) {
                actionLabel = `Dùng: ${item.name || 'Vật phẩm'} (SL: ${item.quantity})`;
                value = `use_${item.id}`;
            }
            if (!actionLabel || !value || seenValues.has(value))
                continue;
            seenValues.add(value);
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(actionLabel.substring(0, 100))
                .setDescription((item.description || 'Không có mô tả').substring(0, 100))
                .setValue(value));
            optionCount++;
        }
        if (optionCount > 0) {
            const selectRow = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
            rows.push(selectRow);
        }
    }
    return rows;
}
const CultivationService_1 = require("../../services/CultivationService");
class HoSoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('hoso')
            .setDescription('Xem hồ sơ nhân vật tu hành của đạo hữu.')
            .addUserOption(opt => opt
            .setName('dao_huu')
            .setDescription('Xem hồ sơ của đạo hữu khác (để trống = xem của mình)')
            .setRequired(false)));
    }
    async execute(client, interaction) {
        // Hỗ trợ xem hồ sơ người khác: /hoso @user
        const targetUser = interaction.options.getUser('dao_huu');
        const discordId = targetUser ? targetUser.id : interaction.user.id;
        const isViewingOther = targetUser && targetUser.id !== interaction.user.id;
        // Kiểm tra nhanh xem người chơi có tồn tại không trước khi defer
        const userExists = UserRepository_1.userRepository.get(discordId);
        if (!userExists) {
            const targetName = isViewingOther ? targetUser.displayName : 'Đạo hữu';
            await interaction.editReply({
                content: `❌ ${targetName} chưa khởi tạo nhân vật!`,
            });
            return;
        }
        // Chỉ claim idle cultivation khi xem profile mình
        let idleGained = 0;
        if (!isViewingOther) {
            const idleRes = CultivationService_1.cultivationService.claimIdleCultivation(discordId);
            if (idleRes && idleRes.gained > 0)
                idleGained = idleRes.gained;
        }
        const user = UserRepository_1.userRepository.get(discordId);
        const activeStats = InventoryService_1.inventoryService.getActiveStats(discordId);
        const embed = getChiSoTabEmbed(user || userExists, activeStats);
        if (idleGained > 0) {
            embed.setDescription(`✨ **Thu Hoạch Nhàn Rỗi:** Đạo hữu tự động hấp thu thêm **+${idleGained}** Tu Vi!\n\n` + (embed.data.description || ''));
        }
        if (isViewingOther) {
            embed.setFooter({ text: `Đang xem hồ sơ của ${targetUser.displayName}` });
        }
        const rows = getHoSoAllComponents(discordId, 'chiso');
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], rows));
    }
}
exports.default = HoSoCommand;
function getThongKeTabEmbed(user) {
    const joinDate = new Date((user.created_at || 0) * 1000);
    const now = new Date();
    const daysPlayed = Math.max(1, Math.floor((now.getTime() - joinDate.getTime()) / 86400000));
    let arenaProfile = null;
    try {
        arenaProfile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(user.discord_id);
    }
    catch { }
    const wins = arenaProfile?.wins || 0;
    const losses = arenaProfile?.losses || 0;
    const totalFights = wins + losses;
    const winRate = totalFights > 0 ? Math.round((wins / totalFights) * 100) : 0;
    let companionInfo = 'Chưa có';
    try {
        const comp = database_1.default.prepare('SELECT companion_type, level FROM companion WHERE user_id = ? AND equipped = 1').get(user.discord_id);
        if (comp)
            companionInfo = `${comp.companion_type} (Lv.${comp.level})`;
    }
    catch { }
    let awakenedDest = 0;
    try {
        const row = database_1.default.prepare('SELECT COUNT(*) as c FROM user_destinies WHERE user_id = ? AND awakened = 1').get(user.discord_id);
        awakenedDest = row?.c || 0;
    }
    catch { }
    let bestFloor = 0;
    try {
        const row = database_1.default.prepare('SELECT MAX(floor) as best FROM nine_heavens_progress WHERE user_id = ?').get(user.discord_id);
        bestFloor = row?.best || 0;
    }
    catch { }
    let bestiaryCount = 0;
    try {
        const row = database_1.default.prepare('SELECT COUNT(*) as c FROM bestiary WHERE user_id = ? AND times_defeated > 0').get(user.discord_id);
        bestiaryCount = row?.c || 0;
    }
    catch { }
    let tribBest = 'N/A';
    try {
        const row = database_1.default.prepare('SELECT best_tier, best_floor FROM infinite_tribulation_progress WHERE user_id = ?').get(user.discord_id);
        if (row && row.best_tier > 0)
            tribBest = `Tier ${row.best_tier} / Floor ${row.best_floor}`;
    }
    catch { }
    return new discord_js_1.EmbedBuilder()
        .setTitle(`📈 Thống Kê — ${user.name || user.discord_id}`)
        .setColor(uiSystem_1.EMBED_COLORS.INFO)
        .setDescription(`📅 **Ngày tạo:** <t:${Math.floor(joinDate.getTime() / 1000)}:D> (${daysPlayed} ngày)\n` +
        `⚔️ **Chiến đấu:** ${wins} thắng / ${losses} thua (${winRate}% win rate)\n` +
        `🌀 **Tháp sâu nhất:** ${bestFloor > 0 ? `Tầng ${bestFloor}` : 'Chưa rõ'}\n` +
        `⚡ **Thiên Kiếp:** ${tribBest}\n` +
        `🐉 **Companion:** ${companionInfo}\n` +
        `✨ **Destiny giác tĩnh:** ${awakenedDest}/3\n` +
        `📖 **Bestiary:** ${bestiaryCount} enemy đã hạ\n` +
        `🏆 **Danh hiệu:** ${user.title || 'Tán Tu'}`)
        .setFooter({ text: `Đại cảnh giới: ${(0, constants_1.getRealmDetails)(user.level).realmName}` })
        .setTimestamp();
}
function getHoSoTabEmbed(userId, tab) {
    const user = UserRepository_1.userRepository.get(userId);
    const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
    switch (tab) {
        case 'chiso':
            return getChiSoTabEmbed(user, activeStats);
        case 'taisan':
            return getTaiSanTabEmbed(user);
        case 'chientich':
            return getChienTichTabEmbed(user);
        case 'trangbi':
            return getTrangBiTabEmbed(user);
        case 'linhthu':
            return getLinhThuTabEmbed(user);
        case 'somenh':
            return getSoMenhTabEmbed(user);
        case 'bangxephang': {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('👑 Bảng Phong Thần')
                .setColor(uiSystem_1.EMBED_COLORS.GOLD) // ponytail: gold hex, keep numeric for BXH
                .setDescription('*Chọn một danh mục bên dưới để xem bảng xếp hạng.*\n\nDữ liệu được cập nhật mỗi **5 phút**.\n\n📋 **Các danh mục:**\n⚔️ Lực Chiến\n🌀 Cảnh Giới\n🪙 Tài Sản\n🏛️ Cống Hiến Tông Môn')
                .setFooter({ text: 'Sử dụng các nút bên dưới để chuyển danh mục.' })
                .setTimestamp();
            return embed;
        }
        case 'thongke':
            return getThongKeTabEmbed(user);
    }
}
