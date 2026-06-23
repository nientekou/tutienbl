"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOP_DUNGEONS = void 0;
exports.getDungeonEmbed = getDungeonEmbed;
exports.getDungeonComponents = getDungeonComponents;
exports.buildCoopPartyEmbed = buildCoopPartyEmbed;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const PartyService_1 = require("../../services/PartyService");
const dungeons_1 = require("../../config/dungeons");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
exports.COOP_DUNGEONS = [
    {
        id: 'dc_1',
        name: 'Huyết Uyên Cốc',
        description: 'Nơi Huyết Ma Lão Tổ từng bế quan. Âm khí nặng nề, quái vật khát máu.',
        minLevel: 10,
        maxDailyEntries: 3,
        bossName: 'Huyết Ma Phân Thân',
        bossHp: 12500,
        bossAtk: 375,
        bossDef: 188,
        bossCrit: 0.15,
        bossCritRes: 0.05,
        bossSpeed: 120,
        bossDodge: 0.1,
        maxMembers: 4,
    },
    {
        id: 'dc_2',
        name: 'Lôi Âm Tự (Phế Tích)',
        description: 'Ngôi chùa cổ bị sấm sét hủy diệt. Tồn tại Lôi Kiếp Chi Linh cực kỳ nguy hiểm.',
        minLevel: 25,
        maxDailyEntries: 3,
        bossName: 'Lôi Kiếp Chi Linh',
        bossHp: 37500,
        bossAtk: 1000,
        bossDef: 500,
        bossCrit: 0.2,
        bossCritRes: 0.1,
        bossSpeed: 150,
        bossDodge: 0.15,
        maxMembers: 4,
    }
];
/**
 * Tạo Embed hiển thị danh sách các Bí Cảnh
 */
function getDungeonEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor('#e74c3c')
            .setDescription('Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.');
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🔮 Bí Cảnh Phó Bản - Giới Luật Tu Hành')
        .setDescription('Nơi tu sĩ thử thách võ học bản thân, diệt quái thú linh dị đoạt lấy Tu Vi và bảo vật trời đất.')
        .setColor('#9b59b6')
        .setTimestamp();
    // Lấy danh sách CD của người chơi hôm nay
    const cds = database_1.default.prepare('SELECT dungeon_id, daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ?').all(userId);
    const cdMap = new Map();
    const nowDate = new Date().toDateString();
    for (const cd of cds) {
        const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
        if (cdDate === nowDate) {
            cdMap.set(cd.dungeon_id, cd.daily_entries);
        }
    }
    for (const [id, config] of Object.entries(dungeons_1.DUNGEONS)) {
        const entriesToday = cdMap.get(id) || 0;
        const entriesText = `${entriesToday}/${config.maxDailyEntries}`;
        const isLocked = user.level < config.minLevel;
        const statusText = isLocked
            ? `🔒 **Cảnh giới quá thấp** (Yêu cầu Cấp ${config.minLevel})`
            : `🟢 **Có thể khiêu chiến** (${entriesText} lượt đi hôm nay)`;
        const lootsText = config.rewards.loots
            .map(l => {
            const item = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(l.itemId);
            return item ? `• ${item.name} (${Math.round(l.rate * 100)}%)` : '';
        })
            .filter(Boolean)
            .join('\n');
        const realmReq = (0, constants_1.getRealmDetails)(config.minLevel).realmName;
        const elementEmoji = config.monster.element ? (constants_1.ELEMENT_EMOJIS[config.monster.element] || '') : '';
        const elementText = config.monster.element ? `Hệ ${config.monster.element} ${elementEmoji}` : 'Không hệ';
        embed.addFields({
            name: `${config.name} [${realmReq}]`,
            value: `*${config.description}*\n` +
                `👾 **Thủ Vệ:** **${config.monster.name}** (${elementText})\n` +
                `   └ 🩸 Sinh Lực: **${config.monster.hp}** | ⚔️ Tấn Công: **${config.monster.atk}** | 🛡️ Phòng Thủ: **${config.monster.def}**\n` +
                `🎁 **Phần Thưởng:** **+${config.rewards.exp}** Tu Vi | **${config.rewards.coinMin}-${config.rewards.coinMax}** Linh Thạch\n` +
                `✨ **Tỷ lệ rơi bảo vật:**\n${lootsText}\n` +
                `📌 Trạng thái: ${statusText}\n\u200b`
        });
    }
    return embed;
}
/**
 * Tạo các nút khiêu chiến Bí Cảnh tương ứng
 */
function getDungeonComponents(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const row = new discord_js_1.ActionRowBuilder();
    for (const [id, config] of Object.entries(dungeons_1.DUNGEONS)) {
        const isLocked = user ? user.level < config.minLevel : true;
        let btnStyle = discord_js_1.ButtonStyle.Success;
        if (id.includes('truc_co'))
            btnStyle = discord_js_1.ButtonStyle.Primary;
        if (id.includes('kim_dan'))
            btnStyle = discord_js_1.ButtonStyle.Danger;
        // Lấy số lượt hôm nay
        const cd = database_1.default.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
            .get(userId, id);
        let entriesToday = 0;
        if (cd) {
            const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
            if (cdDate === new Date().toDateString()) {
                entriesToday = cd.daily_entries;
            }
        }
        const isOutOfEntries = entriesToday >= config.maxDailyEntries;
        row.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`bicanhselect_${id}_${userId}`)
            .setLabel(`Khiêu Chiến ${config.name.split(' (')[0]}`)
            .setStyle(btnStyle)
            .setDisabled(isLocked || isOutOfEntries));
    }
    return row;
}
/**
 * Tạo Embed hiển thị thông tin phòng chờ tổ đội bí cảnh
 */
function buildCoopPartyEmbed(partyId) {
    const { partyService } = require('../../services/PartyService');
    const party = partyService.getParty(partyId);
    if (!party) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor('#e74c3c')
            .setDescription('Tổ đội này không tồn tại hoặc đã bị giải tán.');
    }
    const dungeon = exports.COOP_DUNGEONS.find(d => d.id === party.dungeonId);
    if (!dungeon) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setColor('#e74c3c')
            .setDescription('Bí cảnh không hợp lệ.');
    }
    const realmReq = (0, constants_1.getRealmDetails)(dungeon.minLevel).realmName;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`⛩️ PHÒNG CHỜ BÍ CẢNH: ${dungeon.name}`)
        .setColor('#e74c3c')
        .setDescription(`*${dungeon.description}*\n\n` +
        `⚠️ **Cảnh giới tối thiểu:** **${realmReq}** (Cấp ${dungeon.minLevel})\n` +
        `👾 **Thủ Vệ Vương Giả:** **${dungeon.bossName}**\n` +
        `   └ 🩸 Sinh Lực: **${dungeon.bossHp}** | ⚔️ Công: **${dungeon.bossAtk}** | 🛡️ Thủ: **${dungeon.bossDef}**\n` +
        `   └ ⚡ Tốc Độ: **${dungeon.bossSpeed}** | 🎯 Bạo Kích: **${Math.round(dungeon.bossCrit * 100)}%** | 🌀 Thân Pháp: **${Math.round(dungeon.bossDodge * 100)}%**\n\n` +
        `👥 **Thành Viên Đội Ngũ (${party.members.length}/${party.maxMembers}):**`)
        .setTimestamp();
    const membersLines = party.members.map((mId, index) => {
        const u = UserRepository_1.userRepository.get(mId);
        if (!u)
            return `${index + 1}. 👤 <@${mId}> (Không rõ tu sĩ)`;
        const realm = (0, constants_1.getRealmDetails)(u.level);
        const prefix = mId === party.hostId ? '👑' : '👤';
        return `${index + 1}. ${prefix} <@${mId}> - **${u.name}**\n   └ Cảnh giới: *${realm.fullName}* | ⚔️ ATK: **${u.base_atk}** | ❤️ HP: **${u.base_hp}**`;
    });
    embed.setDescription(embed.data.description + '\n' + membersLines.join('\n') + `\n\n*Đạo hữu khác hãy nhấn nút "Tham gia" để kề vai sát cánh! Chủ phòng nhấn "Bắt đầu" khi đội ngũ đã tề tựu đông đủ.*`);
    return embed;
}
class BiCanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('bicanh')
            .setDescription('Hệ thống Bí Cảnh - Phó Bản.')
            .addSubcommand(sub => sub
            .setName('solo')
            .setDescription('Mở giao diện khiêu chiến Bí Cảnh đơn nhân (Solo Dungeon).'))
            .addSubcommand(sub => sub
            .setName('taolap')
            .setDescription('Tạo tổ đội khiêu chiến Bí Cảnh đa nhân (Co-op Dungeon).')
            .addStringOption(opt => opt.setName('dungeon')
            .setDescription('Chọn bí cảnh co-op')
            .setRequired(true)
            .addChoices({ name: 'Huyết Uyên Cốc (Cảnh giới 10+)', value: 'dc_1' }, { name: 'Lôi Âm Tự (Cảnh giới 25+)', value: 'dc_2' })))
            .addSubcommand(sub => sub
            .setName('bangxephang')
            .setDescription('Bảng xếp hạng cống hiến bí cảnh co-op')));
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
        const subcmd = interaction.options.getSubcommand(true);
        if (subcmd === 'solo') {
            const embed = getDungeonEmbed(userId);
            const row = getDungeonComponents(userId);
            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });
        }
        else if (subcmd === 'taolap') {
            const dungeonId = interaction.options.getString('dungeon', true);
            const dungeon = exports.COOP_DUNGEONS.find(d => d.id === dungeonId);
            if (!dungeon)
                return;
            if (user.level < dungeon.minLevel) {
                await interaction.editReply({
                    content: `❌ Cảnh giới của đạo hữu chưa đủ để vào **${dungeon.name}**! (Yêu cầu cấp ${dungeon.minLevel})`
                });
                return;
            }
            // Kiểm tra giới hạn lượt đi hàng ngày cho Co-op Dungeon
            const cd = database_1.default.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
                .get(userId, dungeonId);
            let entriesToday = 0;
            if (cd) {
                const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
                if (cdDate === new Date().toDateString()) {
                    entriesToday = cd.daily_entries;
                }
            }
            if (entriesToday >= dungeon.maxDailyEntries) {
                await interaction.editReply({
                    content: `❌ Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)`
                });
                return;
            }
            // Tạo party
            const party = PartyService_1.partyService.createParty(userId, dungeonId, dungeon.maxMembers);
            const embed = buildCoopPartyEmbed(party.id);
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`joinparty_${party.id}`).setLabel('🤝 Tham Gia').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`startparty_${party.id}`).setLabel('⚔️ Bắt Đầu').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`leaveparty_${party.id}`).setLabel('🚪 Rời Khỏi/Hủy').setStyle(discord_js_1.ButtonStyle.Danger));
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
        else if (subcmd === 'bangxephang') {
            const topPlayers = database_1.default.prepare(`
        SELECT name, dungeon_clears, level 
        FROM users 
        WHERE dungeon_clears > 0 
        ORDER BY dungeon_clears DESC, tu_vi DESC 
        LIMIT 10
      `).all();
            if (topPlayers.length === 0) {
                await interaction.editReply({ content: '📭 Hiện chưa có cường giả nào vượt qua được Bí Cảnh.' });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🏆 BẢNG XẾP HẠNG BÍ CẢNH 🏆')
                .setColor('#f1c40f')
                .setDescription('Danh sách các đại năng đã chinh phục nhiều Bí Cảnh nhất:\n\n' +
                topPlayers.map((p, i) => `**#${i + 1}** ${p.name} (Cấp ${p.level}) - ⚔️ **${p.dungeon_clears}** lần phá đảo`).join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
}
exports.default = BiCanhCommand;
