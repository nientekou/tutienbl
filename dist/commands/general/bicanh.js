"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUNGEONS = void 0;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const PartyService_1 = require("../../services/PartyService");
const database_1 = __importDefault(require("../../database/database"));
exports.DUNGEONS = [
    {
        id: 'dc_1',
        name: 'Huyết Uyên Cốc',
        description: 'Nơi Huyết Ma Lão Tổ từng bế quan. Âm khí nặng nề, quái vật khát máu.',
        minLevel: 10,
        bossName: 'Huyết Ma Phân Thân',
        bossHp: 10000,
        bossAtk: 300,
        bossDef: 150,
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
        bossName: 'Lôi Kiếp Chi Linh',
        bossHp: 30000,
        bossAtk: 800,
        bossDef: 400,
        bossCrit: 0.2,
        bossCritRes: 0.1,
        bossSpeed: 150,
        bossDodge: 0.15,
        maxMembers: 4,
    }
];
class BiCanhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('bicanh')
            .setDescription('Hệ thống Bí Cảnh - Co-op Dungeon.')
            .addSubcommand(sub => sub
            .setName('taolap')
            .setDescription('Tạo tổ đội khiêu chiến Bí Cảnh')
            .addStringOption(opt => opt.setName('dungeon')
            .setDescription('Chọn bí cảnh')
            .setRequired(true)
            .addChoices({ name: 'Huyết Uyên Cốc (Cảnh giới 10+)', value: 'dc_1' }, { name: 'Lôi Âm Tự (Cảnh giới 25+)', value: 'dc_2' })))
            .addSubcommand(sub => sub
            .setName('bangxephang')
            .setDescription('Bảng xếp hạng cống hiến bí cảnh')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const subcmd = interaction.options.getSubcommand(true);
        if (subcmd === 'taolap') {
            const dungeonId = interaction.options.getString('dungeon', true);
            const dungeon = exports.DUNGEONS.find(d => d.id === dungeonId);
            if (!dungeon)
                return;
            if (user.level < dungeon.minLevel) {
                await interaction.reply({ content: `❌ Cảnh giới của đạo hữu chưa đủ để vào **${dungeon.name}**! (Yêu cầu cấp ${dungeon.minLevel})`, ephemeral: true });
                return;
            }
            // Tạo party
            const party = PartyService_1.partyService.createParty(userId, dungeonId, dungeon.maxMembers);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⛩️ TỔ ĐỘI BÍ CẢNH: ${dungeon.name}`)
                .setColor('#e74c3c')
                .setDescription(`${dungeon.description}\n\n**Chủ phòng:** <@${userId}>\n**Số lượng:** 1/${dungeon.maxMembers}\n\n*Đạo hữu khác hãy nhấn nút "Tham gia" để cùng kề vai sát cánh! Chủ phòng nhấn "Bắt đầu" khi đã sẵn sàng.*`);
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`joinparty_${party.id}`).setLabel('🤝 Tham Gia').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`startparty_${party.id}`).setLabel('⚔️ Bắt Đầu').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`leaveparty_${party.id}`).setLabel('🚪 Rời Khỏi/Hủy').setStyle(discord_js_1.ButtonStyle.Danger));
            await interaction.reply({ embeds: [embed], components: [row] });
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
                await interaction.reply({ content: '📭 Hiện chưa có cường giả nào vượt qua được Bí Cảnh.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🏆 BẢNG XẾP HẠNG BÍ CẢNH 🏆')
                .setColor('#f1c40f')
                .setDescription('Danh sách các đại năng đã chinh phục nhiều Bí Cảnh nhất:\n\n' +
                topPlayers.map((p, i) => `**#${i + 1}** ${p.name} (Cấp ${p.level}) - ⚔️ **${p.dungeon_clears}** lần phá đảo`).join('\n'))
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
    }
}
exports.default = BiCanhCommand;
