"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readyStates = void 0;
exports.getPartyRoomEmbed = getPartyRoomEmbed;
exports.getPartyRoomComponents = getPartyRoomComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const database_1 = __importDefault(require("../../database/database"));
const PartyService_1 = require("../../services/PartyService");
const constants_1 = require("../../utils/constants");
// Map lưu trạng thái sẵn sàng trong bộ nhớ
exports.readyStates = new Map();
/**
 * Tạo mã phòng ngẫu nhiên
 */
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Lấy Embed hiển thị phòng chờ
 */
function getPartyRoomEmbed(room, host) {
    const members = JSON.parse(room.member_ids || '[]');
    const readySet = exports.readyStates.get(room.id) || new Set();
    let memberList = '';
    for (const mId of members) {
        const mUser = UserRepository_1.userRepository.get(mId);
        const memberName = mUser ? mUser.name : 'Không xác định';
        const isReady = readySet.has(mId);
        const level = mUser ? mUser.level : 1;
        const realm = (0, constants_1.getRealmDetails)(level).realmName;
        const status = isReady ? '✅ Sẵn sàng' : '⏳ Chờ...';
        // Calculate active stats for better detail/clarity
        const stats = mUser ? require('../../services/ActiveStatsService').activeStatsService.calculateActiveStats(mUser) : null;
        const statsText = stats ? ` *(⚔️ Công: ${stats.atk} | 🛡️ Thủ: ${stats.def})*` : '';
        memberList += `• **${memberName}** [${realm}]${statsText} - ${status}\n`;
    }
    // Thêm slot trống
    const slotsLeft = 3 - members.length;
    for (let i = 0; i < slotsLeft; i++) {
        memberList += `• 🟢 *Slot trống*\n`;
    }
    const elementalCycle = (0, PartyService_1.checkPartyElementalCycle)(members);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🏰 PHÒNG TỔ ĐỘI - BÍ CẢNH HỢP TÁC`)
        .setColor('#9b59b6')
        .setDescription(`**Mã phòng:** \`${room.id}\`\n` +
        `**Chủ phòng:** ${host?.name || 'Không xác định'}\n` +
        `**Bản đồ:** ${room.dungeon_id === 'coop_dungeon_2' ? 'Di Tích Viễn Cổ (Khó)' : 'Sơn Cốc Yêu Thú (Thường)'}\n` +
        `**Trạng thái:** ${room.status === 'waiting' ? '🟢 Đang chờ' : room.status === 'ready' ? '✅ Đã sẵn sàng' : '🔴 Đã đóng'}\n\n` +
        `**📋 Thành viên (${members.length}/3):**\n${memberList}\n` +
        `💠 **Đội Hình Phối Hợp:**\n${elementalCycle.text}\n\n` +
        `*Mỗi thành viên cần nhấn **Sẵn sàng** trước khi bắt đầu. Chủ phòng nhấn **Bắt đầu** để vào trận!*`)
        .setFooter({ text: 'Phòng tự động giải tán sau 5 phút không hoạt động.' })
        .setTimestamp();
    return embed;
}
/**
 * Lấy Components cho phòng chờ
 */
function getPartyRoomComponents(room, userId) {
    const isHost = room.host_id === userId;
    const members = JSON.parse(room.member_ids || '[]');
    const readySet = exports.readyStates.get(room.id) || new Set();
    const allReady = members.length >= 2 && members.every(m => readySet.has(m));
    const row1 = new discord_js_1.ActionRowBuilder();
    // Nút sẵn sàng
    const isReady = readySet.has(userId);
    row1.addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lapdoi_ready_${room.id}_${userId}`)
        .setLabel(isReady ? '⏸️ Hủy Sẵn Sàng' : '✅ Sẵn Sàng')
        .setStyle(isReady ? discord_js_1.ButtonStyle.Secondary : discord_js_1.ButtonStyle.Success));
    // Nút bắt đầu (chủ phòng mới được)
    if (isHost) {
        row1.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`lapdoi_start_${room.id}_${userId}`)
            .setLabel('⚔️ Bắt Đầu')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setDisabled(!allReady));
    }
    // Nút rời phòng
    row1.addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lapdoi_leave_${room.id}_${userId}`)
        .setLabel('🚪 Rời Phòng')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    // Hàng 2: nút làm mới và đóng
    const row2 = new discord_js_1.ActionRowBuilder();
    row2.addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lapdoi_refresh_${room.id}_${userId}`)
        .setLabel('🔄 Làm Mới')
        .setStyle(discord_js_1.ButtonStyle.Primary));
    if (isHost) {
        row2.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`lapdoi_disband_${room.id}_${userId}`)
            .setLabel('💥 Giải Tán Phòng')
            .setStyle(discord_js_1.ButtonStyle.Danger));
    }
    return [row1, row2];
}
class LapDoiCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('lapdoi')
            .setDescription('Tạo hoặc tham gia phòng tổ đội Bí Cảnh (tối đa 3 người).')
            .addSubcommand(sub => sub
            .setName('tao')
            .setDescription('Tạo phòng chờ tổ đội mới.'))
            .addSubcommand(sub => sub
            .setName('thamgia')
            .setDescription('Tham gia phòng tổ đội bằng mã phòng.')
            .addStringOption(opt => opt.setName('ma_phong')
            .setDescription('Mã phòng 6 ký tự (VD: ABC123)')
            .setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'tao') {
            // Kiểm tra đã có phòng chưa
            const existingRoom = database_1.default.prepare("SELECT * FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed'").get(userId, `%"${userId}"%`);
            if (existingRoom) {
                await interaction.editReply({
                    content: `❌ Đạo hữu đã ở trong phòng **${existingRoom.id}**! Hãy rời phòng trước khi tạo mới.`
                });
                return;
            }
            const roomId = generateRoomId();
            const now = Math.floor(Date.now() / 1000);
            database_1.default.prepare(`
        INSERT INTO party_rooms (id, host_id, host_name, member_ids, dungeon_id, status, created_at)
        VALUES (?, ?, ?, ?, 'coop_dungeon_1', 'waiting', ?)
      `).run(roomId, userId, user.name, JSON.stringify([userId]), now);
            exports.readyStates.set(roomId, new Set([userId]));
            const room = database_1.default.prepare("SELECT * FROM party_rooms WHERE id = ?").get(roomId);
            const embed = getPartyRoomEmbed(room, user);
            const components = getPartyRoomComponents(room, userId);
            await interaction.editReply({
                content: `🎉 **Phòng tổ đội đã được tạo!** Mời bạn bè dùng \`/lapdoi thamgia ma_phong: ${roomId}\` để vào phòng!`,
                embeds: [embed],
                components
            });
        }
        else if (sub === 'thamgia') {
            const roomId = interaction.options.getString('ma_phong', true).toUpperCase();
            const room = database_1.default.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId);
            if (!room) {
                await interaction.editReply({
                    content: '❌ Mã phòng không hợp lệ hoặc phòng đã đóng!'
                });
                return;
            }
            const members = JSON.parse(room.member_ids || '[]');
            if (members.length >= 3) {
                await interaction.editReply({
                    content: '❌ Phòng đã đầy! (Tối đa 3 người)'
                });
                return;
            }
            if (members.includes(userId)) {
                await interaction.editReply({
                    content: '❌ Đạo hữu đã ở trong phòng này rồi!'
                });
                return;
            }
            // Kiểm tra người dùng có đang ở phòng khác không
            const inOtherRoom = database_1.default.prepare("SELECT id FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed' AND id != ?").get(userId, `%"${userId}"%`, roomId);
            if (inOtherRoom) {
                await interaction.editReply({
                    content: '❌ Đạo hữu đang ở trong một phòng khác! Hãy rời phòng đó trước.'
                });
                return;
            }
            members.push(userId);
            database_1.default.prepare("UPDATE party_rooms SET member_ids = ? WHERE id = ?")
                .run(JSON.stringify(members), roomId);
            const host = UserRepository_1.userRepository.get(room.host_id);
            const embed = getPartyRoomEmbed(room, host);
            const components = getPartyRoomComponents(room, userId);
            await interaction.editReply({
                content: `✅ **${user.name}** đã tham gia phòng **${roomId}**!`,
                embeds: [embed],
                components
            });
        }
    }
}
exports.default = LapDoiCommand;
