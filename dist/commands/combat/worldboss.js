"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorldBossEmbed = getWorldBossEmbed;
exports.getWorldBossComponents = getWorldBossComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const CombatService_1 = require("../../services/CombatService");
const BossSeasonService_1 = require("../../services/BossSeasonService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const database_1 = __importDefault(require("../../database/database"));
/**
 * Tạo Embed hiển thị thông tin World Boss hiện tại
 */
function getWorldBossEmbed(userId) {
    const boss = CombatService_1.combatService.getCurrentBoss();
    const user = UserRepository_1.userRepository.get(userId);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`👹 World Boss: ${boss.name} (Cấp ${boss.level})`)
        .setColor(boss.status === 'active' ? uiSystem_1.EMBED_COLORS.ERROR : uiSystem_1.EMBED_COLORS.NEUTRAL)
        .setTimestamp();
    if (boss.status === 'active') {
        const hpBar = (0, constants_1.getProgressBar)(boss.hp, boss.maxHp, 15);
        embed.setDescription(`Thiên địa linh khí chấn động, yêu ma viễn cổ phá phong ấn bước ra tàn phá chúng sinh! Chư vị đạo hữu hãy đồng lòng trảm ma cứu thế!\n\n` +
            `❤️ **Sinh Lực Boss:** ${hpBar} (${boss.hp}/${boss.maxHp})\n` +
            `⚔️ **Công Kích:** ${boss.atk} | 🛡️ **Phòng Thủ:** ${boss.def}\n\n` +
            `*Tham gia đánh Boss nhận Tu Vi, Linh Thạch, Boss Point (BP) và có cơ hội nhận Rương hiếm!*`);
    }
    else {
        embed.setDescription(`💀 **World Boss đã bị tiêu diệt!**\n\n` +
            `• Người ra đón kết liễu: <@${boss.defeatedBy}>\n` +
            `• Thời gian hồi sinh boss tiếp theo: **${boss.respawnTimeRemaining || 0} giây**.\n\n` +
            `*Linh hồn Boss tiếp theo sẽ ngưng tụ ở Cấp Độ cao hơn và mạnh hơn vượt trội!*`);
    }
    // BXH season
    const season = BossSeasonService_1.bossSeasonService.getCurrentSeason();
    if (season) {
        embed.addFields({
            name: `🏆 Mùa ${season.season_number} — Còn ${season.days_left} ngày`,
            value: `Đã tiêu diệt **${season.total_kills}** boss${season.top_player ? `\nTop sát thương: <@${season.top_player}> (${season.top_damage} dmg)` : ''}`
        });
    }
    // Boss Points của người chơi
    if (user) {
        const bp = user.boss_points || 0;
        embed.addFields({
            name: '⭐ Boss Point (BP)',
            value: `Đạo hữu hiện có: **${bp}** BP — Dùng đổi Rương Boss, Vé Bí Cảnh, Nguyên liệu hiếm tại shop!`
        });
    }
    // Lấy danh sách Top cống hiến sát thương
    const contribs = CombatService_1.combatService.getBossContributions();
    if (contribs.length > 0) {
        const leaderboardText = contribs
            .map((c, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
            return `${medal} **Hạng ${i + 1}**: ${c.name} — **${c.damage}** sát thương (${c.attacks} lần)`;
        })
            .join('\n');
        embed.addFields({ name: '📊 BXH Sát Thương Vòng Này', value: leaderboardText });
    }
    else {
        embed.addFields({ name: '📊 BXH Sát Thương Vòng Này', value: '*Chưa có tu sĩ nào gây sát thương lên boss.*' });
    }
    // Mốc đóng góp (hiển thị cho người chơi)
    if (user && boss.status === 'active') {
        embed.addFields({
            name: '🎯 Mốc Thưởng',
            value: `Tham gia → **5 BP** | 1% dmg → **+5 BP** | 3% → **+10 BP** | 5% → **+15 BP** | 10% → **+25 BP** | 15% → **+35 BP** | 20% → **+50 BP**`
        });
    }
    // Trạng thái cooldown của người chơi
    if (user && boss.status === 'active') {
        const now = Math.floor(Date.now() / 1000);
        const contrib = database_1.default.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
            .get(userId);
        let cdSec = 0;
        if (contrib) {
            const elapsed = now - contrib.last_attack_at;
            if (elapsed < 200) {
                cdSec = 200 - elapsed;
            }
        }
        if (cdSec > 0) {
            embed.addFields({
                name: '⏳ Trạng Thái Trấn Nạp Linh Khí',
                value: `Đạo hữu đang kiệt sức điều khí. Cần **${cdSec} giây** để hồi phục.`
            });
        }
        else {
            embed.addFields({
                name: '⏳ Trạng Thái',
                value: `🟢 **Sẵn sàng xuất chiêu!**`
            });
        }
    }
    return embed;
}
/**
 * Tạo các nút hành động cho World Boss
 */
function getWorldBossComponents(userId) {
    const boss = CombatService_1.combatService.getCurrentBoss();
    const row = new discord_js_1.ActionRowBuilder();
    const isBossDead = boss.status === 'defeated';
    const now = Math.floor(Date.now() / 1000);
    const contrib = database_1.default.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
        .get(userId);
    let cdSec = 0;
    if (contrib) {
        const elapsed = now - contrib.last_attack_at;
        if (elapsed < 200) {
            cdSec = 200 - elapsed;
        }
    }
    const isCd = cdSec > 0;
    // Nút Tấn công Miễn phí
    row.addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossattack_${userId}_free`)
        .setLabel(isCd ? `⚔️ CD Tấn Công (${cdSec}s)` : '⚔️ Khiêu Chiến Boss')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setDisabled(isBossDead || isCd), 
    // Nút Làm mới / Refresh
    new discord_js_1.ButtonBuilder()
        .setCustomId(`worldbossrefresh_${userId}`)
        .setLabel('🔄 Làm Mới')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    return row;
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
        const embed = getWorldBossEmbed(userId);
        const row = getWorldBossComponents(userId);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], [row]));
    }
}
exports.default = WorldBossCommand;
