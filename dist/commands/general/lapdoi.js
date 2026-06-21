"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const database_1 = __importDefault(require("../../database/database"));
class LapDoiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('lapdoi')
            .setDescription('Hệ thống Bí Cảnh Tổ Đội (Co-op Dungeon).')
            .addSubcommand(sub => sub.setName('tao')
            .setDescription('Tạo phòng chờ tổ đội mới.')
            .addStringOption(opt => opt.setName('dungeon').setDescription('Bí cảnh muốn khiêu chiến').addChoices({ name: 'Sơn Cốc Yêu Thú', value: 'coop_dungeon_1' }, { name: 'Di Tích Viễn Cổ', value: 'coop_dungeon_2' }).setRequired(true)))
            .addSubcommand(sub => sub.setName('thamgia')
            .setDescription('Tham gia vào một phòng tổ đội thông qua ID.')
            .addStringOption(opt => opt.setName('room_id').setDescription('ID của phòng').setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const sub = interaction.options.getSubcommand();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Bạn chưa tạo nhân vật! Dùng `/taonhanvat` trước.', ephemeral: true });
            return;
        }
        if (sub === 'tao') {
            const dungeonId = interaction.options.getString('dungeon', true);
            // Check if user is already in a room
            const existingRoom = database_1.default.prepare("SELECT * FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed'").get(userId, `%"${userId}"%`);
            if (existingRoom) {
                await interaction.reply({ content: '❌ Đạo hữu đang trong một tổ đội khác!', ephemeral: true });
                return;
            }
            const roomId = `room_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const now = Math.floor(Date.now() / 1000);
            database_1.default.prepare(`
        INSERT INTO party_rooms (id, host_id, host_name, member_ids, dungeon_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'waiting', ?)
      `).run(roomId, userId, user.name, JSON.stringify([userId]), dungeonId, now);
            const room = database_1.default.prepare("SELECT * FROM party_rooms WHERE id = ?").get(roomId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🏰 PHÒNG TỔ ĐỘI: ${roomId}`)
                .setColor('#3498db')
                .setDescription(`**Chủ phòng:** ${user.name}\n` +
                `**Bí cảnh:** ${dungeonId === 'coop_dungeon_1' ? 'Sơn Cốc Yêu Thú' : 'Di Tích Viễn Cổ'}\n\n` +
                `**👥 Thành viên (1/3):**\n` +
                `• 👑 **${user.name}** [Cấp ${user.level}]\n\n` +
                `*Người khác có thể dùng lệnh \`/lapdoi thamgia ${roomId}\` để vào phòng.*`)
                .setFooter({ text: 'Chờ đợi các đạo hữu khác tham gia...' })
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_ready_${roomId}`).setLabel('Sẵn Sàng').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_start_${roomId}`).setLabel('Bắt Đầu').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_disband_${roomId}`).setLabel('Giải Tán').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_refresh_${roomId}`).setLabel('Làm Mới').setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.reply({ embeds: [embed], components: [row] });
            return;
        }
        if (sub === 'thamgia') {
            const roomId = interaction.options.getString('room_id', true).toUpperCase();
            const existingRoom = database_1.default.prepare("SELECT * FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed'").get(userId, `%"${userId}"%`);
            if (existingRoom) {
                await interaction.reply({ content: '❌ Đạo hữu đang trong một tổ đội khác!', ephemeral: true });
                return;
            }
            const room = database_1.default.prepare("SELECT * FROM party_rooms WHERE id = ? AND status = 'waiting'").get(roomId);
            if (!room) {
                await interaction.reply({ content: '❌ Phòng không tồn tại, đã bắt đầu hoặc đã đóng.', ephemeral: true });
                return;
            }
            let members = JSON.parse(room.member_ids || '[]');
            if (members.length >= 3) {
                await interaction.reply({ content: '❌ Phòng đã đầy (3/3 người)!', ephemeral: true });
                return;
            }
            members.push(userId);
            database_1.default.prepare("UPDATE party_rooms SET member_ids = ? WHERE id = ?").run(JSON.stringify(members), roomId);
            const hostUser = UserRepository_1.userRepository.get(room.host_id);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🏰 PHÒNG TỔ ĐỘI: ${roomId}`)
                .setColor('#3498db')
                .setDescription(`**Chủ phòng:** ${hostUser?.name || 'Unknown'}\n` +
                `**Bí cảnh:** ${room.dungeon_id === 'coop_dungeon_1' ? 'Sơn Cốc Yêu Thú' : 'Di Tích Viễn Cổ'}\n\n` +
                `**👥 Thành viên (${members.length}/3):**\n` +
                members.map(m => {
                    const mUser = UserRepository_1.userRepository.get(m);
                    const isHost = m === room.host_id;
                    return `• ${isHost ? '👑' : '👤'} **${mUser?.name || 'Unknown'}** [Cấp ${mUser?.level || 1}]`;
                }).join('\n'))
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_ready_${roomId}`).setLabel('Sẵn Sàng').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_leave_${roomId}`).setLabel('Rời Phòng').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`lapdoi_refresh_${roomId}`).setLabel('Làm Mới').setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.reply({ content: `✅ Đã tham gia phòng **${roomId}** thành công!`, embeds: [embed], components: [row] });
            return;
        }
    }
}
exports.default = LapDoiCommand;
