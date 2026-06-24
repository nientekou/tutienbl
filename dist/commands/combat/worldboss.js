"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorldBossContainer = buildWorldBossContainer;
exports.buildBossSpawnContainer = buildBossSpawnContainer;
exports.buildBossDefeatedContainer = buildBossDefeatedContainer;
exports.getBossShopEmbed = getBossShopEmbed;
exports.getBossShopComponents = getBossShopComponents;
exports.handleBossShopPurchase = handleBossShopPurchase;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const CombatService_1 = require("../../services/CombatService");
const BossSeasonService_1 = require("../../services/BossSeasonService");
const InventoryService_1 = require("../../services/InventoryService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const itemConstants_1 = require("../../config/itemConstants");
const database_1 = __importDefault(require("../../database/database"));
const BOSS_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1504101132610572290/1519223318459453470/29ba8699-9a41-4413-a42d-5b851c3d9fb9.png?ex=6a3cc678&is=6a3b74f8&hm=6acd7047bd8395515c0467a22da8dcbd099685ceb4572c06dc7f72ff04f1fc37';
// ─── Boss Skill System ───
function getBossSkillInfo(level) {
    if (level >= 20)
        return { name: 'Thánh Ma Phá Thiên', desc: 'Gây sát thương toàn thể, giảm 90% phòng thủ mục tiêu. Enrage: ATK +30% khi HP < 50%', emoji: '💀' };
    if (level >= 15)
        return { name: 'Ma Hỏa Liêu Nguyên', desc: 'Bốc cháy liên tục 5 hiệp, mỗi hiệp gây sát thương bằng 10% HP tối đa. Phản phệ +50%', emoji: '🔥' };
    if (level >= 10)
        return { name: 'Lôi Đình Vạn Quân', desc: 'Công kích 3 mục tiêu ngẫu nhiên với sát thương 200%. Trọng thương kéo dài', emoji: '⚡' };
    if (level >= 5)
        return { name: 'Huyết Mạch Áp Chế', desc: 'Giảm 80% giáp, sát thương bạo kích tăng 50%. Phản phệ tăng theo cấp', emoji: '🩸' };
    return { name: 'Ma Khí Xâm Thực', desc: 'Xuyên phá 30% phòng thủ, hồi phục 5% HP mỗi hiệp', emoji: '☠️' };
}
function getBossStageName(level) {
    if (level >= 20)
        return 'Thánh Ma';
    if (level >= 15)
        return 'Đại Ma';
    if (level >= 10)
        return 'Ma Vương';
    if (level >= 5)
        return 'Ma Tướng';
    return 'Ma Binh';
}
/**
 * Tạo V2 Container UI cho World Boss — tinh chỉnh theo reference image
 */
function buildWorldBossContainer(userId) {
    const boss = CombatService_1.combatService.getCurrentBoss();
    const user = UserRepository_1.userRepository.get(userId);
    const skill = getBossSkillInfo(boss.level);
    const stageName = getBossStageName(boss.level);
    const hpPercent = boss.maxHp > 0 ? ((boss.hp / boss.maxHp) * 100).toFixed(1) : '0';
    const hpBar = (0, constants_1.getProgressBar)(boss.hp, boss.maxHp, 15);
    const container = new discord_js_1.ContainerBuilder();
    container.setAccentColor(0x8b0000);
    // ── Header ──
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`# 👹 ${boss.name} (Cấp ${boss.level})`));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`*TAN BIẾN ĐI! THẾ GIỚI NÀY RỒI SẼ SỤP ĐỔ!*`));
    // ── HP Section ──
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    if (boss.status === 'active') {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❤️ **SINH MỆNH:** ${hpBar}\n${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`));
        // ── Combat Log ──
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
        const recentAttacks = CombatService_1.combatService.getRecentBossAttacks(5);
        if (recentAttacks.length > 0) {
            const logLines = recentAttacks.map(a => {
                const critTag = a.isCrit ? ' **(Bạo)**' : '';
                return `⚔️ **${a.name}** dùng **${a.skill}** gây **${a.damage.toLocaleString()}** ST${critTag} — HP: ${a.hpPercent}% 💀`;
            }).join('\n');
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`📋 **Nhật ký chiến đấu mới nhất:**\n${logLines}`));
        }
        else {
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`📋 **Nhật ký chiến đấu mới nhất:**\n*Chưa có tấn công nào trong vòng này.*`));
        }
        // ── Stats Row ──
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`⚔️ **Sát Lực:** ${boss.atk.toLocaleString()} │ 🛡️ **Phòng Thủ:** ${boss.def.toLocaleString()} │ 🌀 **Trạng Thái:** Giai đoạn ${stageName}`));
        // ── Player Status ──
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (activeStats) {
            const curHp = user && user.hp != null ? user.hp : activeStats.hp;
            const maxHp = activeStats.hp;
            const playerHpBar = (0, constants_1.getProgressBar)(curHp, maxHp, 10);
            const isInjured = user && user.injury_end_time > Math.floor(Date.now() / 1000);
            const injuryText = isInjured ? ' │ 🚨 **Trọng Thương**' : '';
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`💪 **Sinh Lực Đạo Hữu:** ${playerHpBar} **${curHp.toLocaleString()} / ${maxHp.toLocaleString()}** HP${injuryText}\n⚔️ **ATK:** ${activeStats.atk.toLocaleString()} │ 🎯 **Bạo:** ${(activeStats.crit * 100).toFixed(1)}%`));
        }
        // ── Boss Skill ──
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`${skill.emoji} **Tuyệt Kỹ Giai Đoạn: ${skill.name}**\n*${skill.desc}*`));
        // ── Boss Image ──
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
        try {
            const mg = new discord_js_1.MediaGalleryBuilder();
            mg.addItems([{ media: { url: BOSS_IMAGE_URL } }]);
            container.addMediaGalleryComponents(mg);
        }
        catch (e) { /* skip image if invalid */ }
        // ── Cooldown Info ──
        const now = Math.floor(Date.now() / 1000);
        const contrib = database_1.default.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
            .get(userId);
        let cdSec = 0;
        if (contrib) {
            const elapsed = now - contrib.last_attack_at;
            if (elapsed < 200)
                cdSec = 200 - elapsed;
        }
        const bp = user ? user.boss_points || 0 : 0;
        const season = BossSeasonService_1.bossSeasonService.getCurrentSeason();
        let footerText = `⭐ BP: **${bp}**`;
        if (cdSec > 0)
            footerText += ` │ ⏳ CD: **${cdSec}s**`;
        else
            footerText += ` │ 🟢 Sẵn sàng`;
        if (season)
            footerText += ` │ 🏆 Mùa ${season.season_number} (${season.days_left}d)`;
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(footerText));
    }
    else {
        // Boss defeated
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`💀 **WORLD BOSS ĐÃ BỊ TIÊU DIỆT!**\n\n` +
            `Người ra đòn kết liễu: <@${boss.defeatedBy}>\n` +
            `Thời gian hồi sinh: **${boss.respawnTimeRemaining || 0} giây**\n\n` +
            `*Linh hồn Boss tiếp theo sẽ mạnh hơn vượt trội!*`));
    }
    // ── Buttons ──
    const isBossDead = boss.status === 'defeated';
    const now = Math.floor(Date.now() / 1000);
    const contrib = database_1.default.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
        .get(userId);
    let cdSec = 0;
    if (contrib) {
        const elapsed = now - contrib.last_attack_at;
        if (elapsed < 200)
            cdSec = 200 - elapsed;
    }
    const isCd = cdSec > 0;
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossrefresh_${userId}`)
        .setLabel('🔄 Làm Mới')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossattack_${userId}_free`)
        .setLabel(isCd ? `⚔️ CD (${cdSec}s)` : '⚔️ Tấn Công Boss')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setDisabled(isBossDead || isCd), new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossheal_${userId}`)
        .setLabel('💚 Hồi Máu')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setDisabled(isBossDead), new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbosslb_${userId}`)
        .setLabel('🏆 Xếp Hạng')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossleave_${userId}`)
        .setLabel('🚪 Rời Sảnh')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    return { components: [container, row], flags: uiSystem_1.V2_FLAG };
}
/**
 * Tạo Embed cho Boss Spawn announcement (channel-wide)
 */
function buildBossSpawnContainer(boss) {
    const hpBar = (0, constants_1.getProgressBar)(boss.hp, boss.max_hp, 15);
    const skill = getBossSkillInfo(boss.level);
    const container = new discord_js_1.ContainerBuilder();
    container.setAccentColor(0xff0000);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`# 🔔 THƯỢNG CỔ MA THẦN XUẤT THẾ!`));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`⚠️ **CẢNH BÁO TAM GIỚI:** **${boss.name}** đang tàn phá thế giới! Mau liên thủ trảm ma vệ đạo!`));
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❤️ **SINH MỆNH:** ${hpBar} **${((boss.hp / boss.max_hp) * 100).toFixed(1)}%**\n${boss.hp.toLocaleString()} / ${boss.max_hp.toLocaleString()}`));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`⚔️ **Công Kích:** ${boss.atk.toLocaleString()} │ 🛡️ **Phòng Thủ:** ${boss.def.toLocaleString()} │ Cấp **${boss.level}**`));
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`${skill.emoji} **${skill.name}** — *${skill.desc}*`));
    try {
        const mg = new discord_js_1.MediaGalleryBuilder();
        mg.addItems([{ media: { url: BOSS_IMAGE_URL } }]);
        container.addMediaGalleryComponents(mg);
    }
    catch (e) { }
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('worldbossattack_global').setLabel('⚔️ Tấn Công Boss').setStyle(discord_js_1.ButtonStyle.Danger));
    return { components: [container, row], flags: uiSystem_1.V2_FLAG };
}
/**
 * Container cho thông báo Boss bị tiêu diệt
 */
function buildBossDefeatedContainer(boss, rewardsLogs) {
    const container = new discord_js_1.ContainerBuilder();
    container.setAccentColor(0xf1c40f);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`# 🏆 BẢNG PHONG THẦN THẢO PHẠT BOSS`));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`👹 **${boss.name}** (Lv.${boss.level}) đã ngã xuống!\nLinh khí tản mát hóa thành tài bảo ban thưởng:`));
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setDivider(true).setSpacing(1));
    const logText = rewardsLogs.length > 0
        ? rewardsLogs.join('\n')
        : '*Không có đệ tử nào tham gia thảo phạt.*';
    // Truncate to 3800 chars max
    const truncated = logText.length > 3800 ? logText.slice(0, 3797) + '...' : logText;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(truncated));
    return { components: [container], flags: uiSystem_1.V2_FLAG };
}
// ─── Boss Shop ───
const BOSS_SHOP_ITEMS = [
    { key: 'chest', itemId: itemConstants_1.ITEMS.LUCKY_CHEST, name: 'Rương Cơ Duyên x1', cost: 100, qty: 1, desc: 'Rương ngẫu nhiên, có cơ hội nhận vật phẩm hiếm' },
    { key: 'raid', itemId: itemConstants_1.ITEMS.SERVER_RAID_CHEST, name: 'Rương Thảo Phạt x1', cost: 300, qty: 1, desc: 'Rương Boss, chứa vật phẩm cấp cao' },
    { key: 'stamina', itemId: itemConstants_1.ITEMS.PILL_ALCHEMY_STAMINA, name: 'Bổ Thiên Đan x5', cost: 500, qty: 5, desc: 'Hồi 20 thể lực/viên' },
    { key: 'coin', itemId: '', name: 'Linh Thạch 10000', cost: 500, qty: 0, desc: 'Quy đổi ra linh thạch' },
    { key: 'shard', itemId: itemConstants_1.ITEMS.TINH_THACH_SHARD, name: 'Mảnh Tinh Thạch x5', cost: 400, qty: 5, desc: 'Nguyên liệu cường hóa' },
];
function getBossShopEmbed(userId, message) {
    const user = UserRepository_1.userRepository.get(userId);
    const bp = user?.boss_points || 0;
    const lines = BOSS_SHOP_ITEMS.map(item => `• **${item.name}** — **${item.cost}** BP\n  ${item.desc}`);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🏪 Boss Point Shop')
        .setColor(uiSystem_1.EMBED_COLORS.GOLD)
        .setDescription(`⭐ **BP hiện có:** **${bp}**\n\n${lines.join('\n\n')}`)
        .setFooter({ text: 'Chọn vật phẩm bên dưới để đổi.' });
    if (message)
        embed.setDescription(`${message}\n\n${embed.data.description}`);
    return embed;
}
function getBossShopComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const bp = user?.boss_points || 0;
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`bossshop_buy_${userId}`)
        .setPlaceholder('Chọn vật phẩm muốn đổi...');
    for (const item of BOSS_SHOP_ITEMS) {
        const canAfford = bp >= item.cost;
        menu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(`${item.name} — ${item.cost} BP`)
            .setDescription(`${canAfford ? '✅ ' : '❌ '}${item.desc}${canAfford ? '' : ' (Không đủ BP)'}`)
            .setValue(item.key));
    }
    return new discord_js_1.ActionRowBuilder().addComponents(menu);
}
function handleBossShopPurchase(userId, itemKey) {
    const item = BOSS_SHOP_ITEMS.find(i => i.key === itemKey);
    if (!item)
        return { success: false, message: 'Vật phẩm không tồn tại.' };
    const user = UserRepository_1.userRepository.get(userId);
    if (!user)
        return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
    const bp = user.boss_points || 0;
    if (bp < item.cost)
        return { success: false, message: `Không đủ BP! Cần **${item.cost}** BP, hiện có **${bp}** BP.` };
    UserRepository_1.userRepository.update(userId, { boss_points: bp - item.cost });
    if (item.key === 'coin') {
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + 10000 });
    }
    else {
        InventoryRepository_1.inventoryRepository.addItem(userId, item.itemId, item.qty);
    }
    return { success: true, message: `✅ Đã đổi **${item.name}** thành công! (-**${item.cost}** BP)` };
}
class WorldBossCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('worldboss')
            .setDescription('Xem trạng thái và khiêu chiến Boss Thế Giới.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
            });
            return;
        }
        const payload = buildWorldBossContainer(userId);
        await interaction.editReply(payload);
    }
}
exports.default = WorldBossCommand;
