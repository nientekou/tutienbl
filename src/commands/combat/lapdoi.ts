import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import db from '../../database/database';
import { PartyCombatEngine, PartyMember } from '../../services/PartyCombatEngine';
import { checkPartyElementalCycle } from '../../services/PartyService';
import { inventoryService } from '../../services/InventoryService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { getRealmDetails } from '../../utils/constants';

interface PartyRoom {
  id: string;
  host_id: string;
  host_name: string;
  member_ids: string;
  dungeon_id: string;
  status: string;
  created_at: number;
}

interface PartyMemberInfo {
  discord_id: string;
  name: string;
  level: number;
  class_name: string;
  ready: boolean;
}

// Map lưu trạng thái sẵn sàng trong bộ nhớ
export const readyStates = new Map<string, Set<string>>();

/**
 * Tạo mã phòng ngẫu nhiên
 */
function generateRoomId(): string {
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
export function getPartyRoomEmbed(room: PartyRoom, host: any): EmbedBuilder {
  const members: string[] = JSON.parse(room.member_ids || '[]');
  const readySet = readyStates.get(room.id) || new Set();

  let memberList = '';
  for (const mId of members) {
    const mUser = userRepository.get(mId);
    const memberName = mUser ? mUser.name : 'Không xác định';
    const isReady = readySet.has(mId);
    const level = mUser ? mUser.level : 1;
    const realm = getRealmDetails(level).realmName;
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

  const elementalCycle = checkPartyElementalCycle(members);

  const embed = new EmbedBuilder()
    .setTitle(`🏰 PHÒNG TỔ ĐỘI - BÍ CẢNH HỢP TÁC`)
    .setColor('#9b59b6')
    .setDescription(
      `**Mã phòng:** \`${room.id}\`\n` +
      `**Chủ phòng:** ${host?.name || 'Không xác định'}\n` +
      `**Bản đồ:** ${room.dungeon_id === 'coop_dungeon_2' ? 'Di Tích Viễn Cổ (Khó)' : 'Sơn Cốc Yêu Thú (Thường)'}\n` +
      `**Trạng thái:** ${room.status === 'waiting' ? '🟢 Đang chờ' : room.status === 'ready' ? '✅ Đã sẵn sàng' : '🔴 Đã đóng'}\n\n` +
      `**📋 Thành viên (${members.length}/3):**\n${memberList}\n` +
      `💠 **Đội Hình Phối Hợp:**\n${elementalCycle.text}\n\n` +
      `*Mỗi thành viên cần nhấn **Sẵn sàng** trước khi bắt đầu. Chủ phòng nhấn **Bắt đầu** để vào trận!*`
    )
    .setFooter({ text: 'Phòng tự động giải tán sau 5 phút không hoạt động.' })
    .setTimestamp();

  return embed;
}

/**
 * Lấy Components cho phòng chờ
 */
export function getPartyRoomComponents(room: PartyRoom, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const isHost = room.host_id === userId;
  const members: string[] = JSON.parse(room.member_ids || '[]');
  const readySet = readyStates.get(room.id) || new Set();
  const allReady = members.length >= 2 && members.every(m => readySet.has(m));

  const row1 = new ActionRowBuilder<ButtonBuilder>();
  
  // Nút sẵn sàng
  const isReady = readySet.has(userId);
  row1.addComponents(
    new ButtonBuilder()
      .setCustomId(`lapdoi_ready_${room.id}_${userId}`)
      .setLabel(isReady ? '⏸️ Hủy Sẵn Sàng' : '✅ Sẵn Sàng')
      .setStyle(isReady ? ButtonStyle.Secondary : ButtonStyle.Success)
  );

  // Nút bắt đầu (chủ phòng mới được)
  if (isHost) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`lapdoi_start_${room.id}_${userId}`)
        .setLabel('⚔️ Bắt Đầu')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!allReady)
    );
  }

  // Nút rời phòng
  row1.addComponents(
    new ButtonBuilder()
      .setCustomId(`lapdoi_leave_${room.id}_${userId}`)
      .setLabel('🚪 Rời Phòng')
      .setStyle(ButtonStyle.Secondary)
  );

  // Hàng 2: nút làm mới và đóng
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`lapdoi_refresh_${room.id}_${userId}`)
      .setLabel('🔄 Làm Mới')
      .setStyle(ButtonStyle.Primary)
  );

  if (isHost) {
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`lapdoi_disband_${room.id}_${userId}`)
        .setLabel('💥 Giải Tán Phòng')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return [row1, row2];
}

export default class LapDoiCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('lapdoi')
        .setDescription('Tạo hoặc tham gia phòng tổ đội Bí Cảnh (tối đa 3 người).')
        .addSubcommand(sub =>
          sub
            .setName('tao')
            .setDescription('Tạo phòng chờ tổ đội mới.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thamgia')
            .setDescription('Tham gia phòng tổ đội bằng mã phòng.')
            .addStringOption(opt =>
              opt.setName('ma_phong')
                .setDescription('Mã phòng 6 ký tự (VD: ABC123)')
                .setRequired(true)
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'tao') {
      // Kiểm tra đã có phòng chưa
      const existingRoom = db.prepare(
        "SELECT * FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed'"
      ).get(userId, `%"${userId}"%`) as PartyRoom | undefined;

      if (existingRoom) {
        await interaction.reply({
          content: `❌ Đạo hữu đã ở trong phòng **${existingRoom.id}**! Hãy rời phòng trước khi tạo mới.`,
          ephemeral: true
        });
        return;
      }

      const roomId = generateRoomId();
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO party_rooms (id, host_id, host_name, member_ids, dungeon_id, status, created_at)
        VALUES (?, ?, ?, ?, 'coop_dungeon_1', 'waiting', ?)
      `).run(roomId, userId, user.name, JSON.stringify([userId]), now);

      readyStates.set(roomId, new Set([userId]));

      const room = db.prepare("SELECT * FROM party_rooms WHERE id = ?").get(roomId) as PartyRoom;
      const embed = getPartyRoomEmbed(room, user);
      const components = getPartyRoomComponents(room, userId);

      await interaction.reply({
        content: `🎉 **Phòng tổ đội đã được tạo!** Mời bạn bè dùng \`/lapdoi thamgia ma_phong: ${roomId}\` để vào phòng!`,
        embeds: [embed],
        components,
        ephemeral: false
      });
    }

    else if (sub === 'thamgia') {
      const roomId = interaction.options.getString('ma_phong', true).toUpperCase();
      const room = db.prepare("SELECT * FROM party_rooms WHERE id = ? AND status != 'closed'").get(roomId) as PartyRoom | undefined;

      if (!room) {
        await interaction.reply({
          content: '❌ Mã phòng không hợp lệ hoặc phòng đã đóng!',
          ephemeral: true
        });
        return;
      }

      const members: string[] = JSON.parse(room.member_ids || '[]');

      if (members.length >= 3) {
        await interaction.reply({
          content: '❌ Phòng đã đầy! (Tối đa 3 người)',
          ephemeral: true
        });
        return;
      }

      if (members.includes(userId)) {
        await interaction.reply({
          content: '❌ Đạo hữu đã ở trong phòng này rồi!',
          ephemeral: true
        });
        return;
      }

      // Kiểm tra người dùng có đang ở phòng khác không
      const inOtherRoom = db.prepare(
        "SELECT id FROM party_rooms WHERE (host_id = ? OR member_ids LIKE ?) AND status != 'closed' AND id != ?"
      ).get(userId, `%"${userId}"%`, roomId);

      if (inOtherRoom) {
        await interaction.reply({
          content: '❌ Đạo hữu đang ở trong một phòng khác! Hãy rời phòng đó trước.',
          ephemeral: true
        });
        return;
      }

      members.push(userId);
      db.prepare("UPDATE party_rooms SET member_ids = ? WHERE id = ?")
        .run(JSON.stringify(members), roomId);

      const host = userRepository.get(room.host_id);
      const embed = getPartyRoomEmbed(room, host);
      const components = getPartyRoomComponents(room, userId);

      await interaction.reply({
        content: `✅ **${user.name}** đã tham gia phòng **${roomId}**!`,
        embeds: [embed],
        components,
        ephemeral: false
      });
    }
  }
}
