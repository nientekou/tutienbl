import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { systemConfigService } from '../../services/SystemConfigService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { userRepository } from '../../database/repositories/UserRepository';
import { cultivationService } from '../../services/CultivationService';
import db from '../../database/database';
import { config } from '../../config';
import { getRealmDetails } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload, safeV2Update } from '../../utils/uiSystem';
import { noituService } from '../../services/NoituService';

/**
 * ID Discord của Bot Owner — người DUY NHẤT được phép dùng lệnh /admin
 * Không phân quyền qua guild admin roles để tránh mất cân bằng game
 */
const BOT_OWNER_ID = '724608013981450351';
export default class AdminCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('admin')
        .setDescription('[Thiên Đạo Chủ] Lệnh quản trị hệ thống — chỉ dành cho Bot Owner.')
        // KHÔNG setDefaultMemberPermissions để tránh guild admin bypass
        .addSubcommand(subcommand =>
          subcommand
            .setName('maintenance')
            .setDescription('[Owner Only] Bật hoặc tắt chế độ bảo trì hệ thống.')
            .addBooleanOption(option =>
              option
                .setName('status')
                .setDescription('True = Bật bảo trì, False = Tắt bảo trì.')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('giveitem')
            .setDescription('[Owner Only] Phát vật phẩm cho tu sĩ.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ nhận vật phẩm.')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('item_id')
                .setDescription('ID của vật phẩm.')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addIntegerOption(option =>
              option
                .setName('quantity')
                .setDescription('Số lượng phát.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('giveknb')
            .setDescription('[Owner Only] Phát KNB cho tu sĩ.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ nhận KNB.')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('Số lượng KNB phát (có thể âm để trừ).')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('givent')
            .setDescription('[Owner Only] Phát Ngộ Tính cho tu sĩ.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ nhận Ngộ Tính.')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('Số lượng Ngộ Tính phát (có thể âm để trừ).')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('setlevel')
            .setDescription('[Owner Only] Đặt cấp độ cho tu sĩ (dùng để thử nghiệm).')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ cần đổi cấp.')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('level')
                .setDescription('Cấp độ thiết lập (1 - 380).')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(380)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('givecoin')
            .setDescription('[Owner Only] Phát Linh Thạch cho tu sĩ.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ nhận Linh Thạch.')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('Số Hạ Phẩm Linh Thạch.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10_000_000)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('spawntraveler')
            .setDescription('[Owner Only] Gọi Lữ Khách Thần Bí xuất hiện tại kênh Event.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('info')
            .setDescription('[Owner Only] Xem thông tin hệ thống và số liệu bot.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('panel')
            .setDescription('[Owner Only] Mở Bảng Điều Khiển Thiên Đạo.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('ban')
            .setDescription('[Owner Only] Phong ấn (ban) tu sĩ khỏi tam giới.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ muốn phong ấn.')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('reason')
                .setDescription('Lý do phong ấn.')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('unban')
            .setDescription('[Owner Only] Giải phong (unban) tu sĩ.')
            .addStringOption(option =>
              option
                .setName('user_id')
                .setDescription('Discord ID của tu sĩ cần giải phong.')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('givestamina')
            .setDescription('[Owner Only] Ban phát/thu hồi thể lực của tu sĩ.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Tu sĩ nhận/trừ thể lực.')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('Số lượng thể lực cần thay đổi (có thể âm để trừ).')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('logs')
            .setDescription('[Owner Only] Truy vấn nhật ký audit hệ thống.')
            .addUserOption(option =>
              option
                .setName('tuser')
                .setDescription('Lọc theo tu sĩ thực hiện hành động.')
                .setRequired(false)
            )
            .addStringOption(option =>
              option
                .setName('action')
                .setDescription('Lọc theo loại hành động.')
                .setRequired(false)
            )
            .addIntegerOption(option =>
              option
                .setName('limit')
                .setDescription('Giới hạn số bản ghi hiển thị (mặc định 10, tối đa 25).')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('broadcast')
            .setDescription('[Owner Only] Truyền âm thông báo đến toàn bộ các máy chủ.')
            .addStringOption(option =>
              option
                .setName('title')
                .setDescription('Tiêu đề của thông báo truyền âm.')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('message')
                .setDescription('Nội dung chi tiết thông báo (hỗ trợ \\n để xuống dòng).')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('color')
                .setDescription('Màu sắc của viền embed (Ví dụ: #ff0000 hoặc #00ff00).')
                .setRequired(false)
            )
            .addStringOption(option =>
              option
                .setName('image')
                .setDescription('URL ảnh đính kèm (nếu có).')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('rollback')
            .setDescription('[Owner Only] Khôi phục cơ sở dữ liệu về thời điểm trước đó.')
            .addIntegerOption(option =>
              option
                .setName('hours')
                .setDescription('Số giờ trước đó.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(72)
            )
            .addIntegerOption(option =>
              option
                .setName('minutes')
                .setDescription('Số phút trước đó.')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(59)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('fixpets')
            .setDescription('[Owner Only] Tự động sửa data linh thú lỗi (xoá skill thừa, thú lỗi).')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('checkorphan')
            .setDescription('[Owner Only] Kiểm tra vật phẩm bất thường (orphan items) trong túi đồ người chơi.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('checkstats')
            .setDescription('[Owner Only] Kiểm tra và hiển thị chỉ số chi tiết của người chơi.')
            .addStringOption(option =>
              option
                .setName('tuser')
                .setDescription('ID người chơi cần kiểm tra.')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('noitu_ds')
            .setDescription('[Owner Only] Danh sách từ đóng góp Nối Từ đang chờ duyệt')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('noitu_duyettatca')
            .setDescription('[Owner Only] Duyệt tất cả từ đóng góp Nối Từ đang chờ')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('noitu_duyet')
            .setDescription('[Owner Only] Duyệt hoặc từ chối từ đóng góp Nối Từ')
            .addIntegerOption(option =>
              option
                .setName('id')
                .setDescription('ID của từ trong danh sách chờ')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('action')
                .setDescription('Duyệt hay từ chối?')
                .setRequired(true)
                .addChoices(
                  { name: '✅ Duyệt', value: 'approve' },
                  { name: '❌ Từ chối', value: 'reject' }
                )
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    // ═══════════════════════════════════════════════════════════
    // BẢO MẬT CỨNG: CHỈ BOT OWNER MỚI ĐƯỢC DÙNG LỆNH NÀY
    // Bất kể có role admin trên guild hay không
    // ═══════════════════════════════════════════════════════════
    if (userId !== BOT_OWNER_ID) {
      await interaction.editReply({
        content: [
          '🔒 **Thiên Cơ Cấm Địa — Nghiêm Cấm Xâm Nhập!**',
          '',
          'Lệnh `/admin` là **Thiên Đạo Lệnh** — thánh chỉ từ Thiên Đạo Chủ.',
          'Dù ngươi có tu vi đỉnh cao, thân phận Quản Lý hay pháp bảo trên tay,',
          '**vĩnh viễn không có quyền can thiệp vào Thiên Cơ!**',
          '',
          '> *Kẻ nào cưỡng cầu Thiên Đạo, ắt chuốc kiếp nạn hồi quy.*',
        ].join('\n')
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    // ─── BẢNG TIN: THÔNG TIN HỆ THỐNG ─────────────────────────
    if (subcommand === 'info') {
      try {
        const totalPlayers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
        const totalSects = (db.prepare('SELECT COUNT(*) as c FROM sects').get() as any)?.c || 0;
        const totalItems = (db.prepare('SELECT COUNT(*) as c FROM inventories').get() as any)?.c || 0;
        const topPlayer = db.prepare('SELECT name, level FROM users ORDER BY level DESC LIMIT 1').get() as { name: string; level: number } | undefined;
        const maintenanceMode = systemConfigService.isMaintenanceMode();
        const guilds = client.guilds.cache.size;
        const uptime = process.uptime();
        const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

        const embed = new EmbedBuilder()
          .setTitle('⚙️ THIÊN ĐẠO HỆ THỐNG — THÔNG TIN VẬN HÀNH')
          .setColor(EMBED_COLORS.MYSTIC)
          .addFields(
            { name: '🤖 Bot', value: `Tag: **${client.user?.tag}**\nUptime: **${uptimeStr}**\nGuilds: **${guilds}**`, inline: true },
            { name: '👥 Tu Sĩ', value: `Tổng: **${totalPlayers}** người\nTông Môn: **${totalSects}**\nVật phẩm: **${totalItems}**`, inline: true },
            { name: '🏆 Cao Thủ Nhất', value: topPlayer ? `**${topPlayer.name}** (Cấp ${topPlayer.level})` : 'Chưa có', inline: true },
            { name: '🛠️ Bảo Trì', value: maintenanceMode ? '🔴 **ĐANG BẢO TRÌ**' : '🟢 **HOẠT ĐỘNG BÌNH THƯỜNG**', inline: true },
            { name: '💾 Memory', value: `Heap: **${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB**`, inline: true },
          )
          .setFooter({ text: `Chỉ dành cho Thiên Đạo Chủ • ID: ${BOT_OWNER_ID}` })
          .setTimestamp();

        await interaction.editReply(toV2Payload([embed]));
      } catch (error) {
        await interaction.editReply({ content: `❌ Lỗi khi lấy thông tin hệ thống: ${error}`});
      }
      return;
    }

    // ─── BẢO TRÌ ───────────────────────────────────────────────
    if (subcommand === 'maintenance') {
      const status = interaction.options.getBoolean('status', true);
      systemConfigService.setMaintenanceMode(status);
      systemConfigService.writeAuditLog(userId, 'admin_maintenance', { status });

      await interaction.editReply({
        content: [
          `🛠️ **Trạng Thái Bảo Trì: ${status ? '🔴 BẬT' : '🟢 TẮT'}**`,
          '',
          status
            ? '⚠️ Hệ thống đã vào chế độ bảo trì. Mọi lệnh của tu sĩ sẽ bị tạm khóa.'
            : '✅ Hệ thống đã hoạt động trở lại. Tu sĩ có thể tiếp tục tu luyện!',
        ].join('\n')
      });
      return;
    }

    // ─── PHÁT VẬT PHẨM ─────────────────────────────────────────
    if (subcommand === 'giveitem') {
      const targetUser = interaction.options.getUser('tuser', true);
      const itemId = interaction.options.getString('item_id', true);
      const quantity = interaction.options.getInteger('quantity', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật trong hệ thống.`
        });
        return;
      }

      const itemCheck = db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string } | undefined;
      if (!itemCheck) {
        await interaction.editReply({
          content: `❌ Vật phẩm ID **\`${itemId}\`** không tồn tại trong Thiên Tài Địa Bảo Lục.`
        });
        return;
      }

      inventoryRepository.addItem(targetUser.id, itemId, quantity);
      systemConfigService.writeAuditLog(userId, 'admin_giveitem', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        itemId,
        itemName: itemCheck.name,
        quantity
      });

      await interaction.editReply({
        content: `🎁 **Ban Thiên Phúc:** Đã phát **${quantity}x ${itemCheck.name}** cho tu sĩ **${targetProfile.name}** (<@${targetUser.id}>)!`
      });
      return;
    }

    // ─── ĐẶT CẤP ĐỘ ────────────────────────────────────────────
    if (subcommand === 'setlevel') {
      const targetUser = interaction.options.getUser('tuser', true);
      const targetLevel = interaction.options.getInteger('level', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật.`
        });
        return;
      }

      const newStats = cultivationService.calculateStatsForLevel(targetLevel, targetProfile.linh_can);
      const nextExpNeeded = cultivationService.calculateNextExp(targetLevel);

      userRepository.update(targetUser.id, {
        level: targetLevel,
        tu_vi: 0,
        exp_needed: nextExpNeeded,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_luck: targetProfile.base_luck,
        base_speed: newStats.speed
      });

      systemConfigService.writeAuditLog(userId, 'admin_setlevel', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        oldLevel: targetProfile.level,
        newLevel: targetLevel
      });

      await interaction.editReply({
        content: `⚡ **Thiên Đạo Can Thiệp:** Tu sĩ **${targetProfile.name}** (<@${targetUser.id}>) đã được nâng lên **Cấp ${targetLevel}**!\n📊 Stats đã được tính toán lại theo cảnh giới mới.`
      });
      return;
    }

    // ─── PHÁT LINH THẠCH ────────────────────────────────────────
    if (subcommand === 'givecoin') {
      const targetUser = interaction.options.getUser('tuser', true);
      const amount = interaction.options.getInteger('amount', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật trong hệ thống.`
        });
        return;
      }

      userRepository.update(targetUser.id, {
        coin_ha_pham: targetProfile.coin_ha_pham + amount
      });

      systemConfigService.writeAuditLog(userId, 'admin_givecoin', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        amount
      });

      await interaction.editReply({
        content: `🪙 **Thiên Phú Linh Khí:** Đã ban **${amount.toLocaleString()} Hạ Phẩm Linh Thạch** cho tu sĩ **${targetProfile.name}** (<@${targetUser.id}>)!\n💰 Số dư mới: **${(targetProfile.coin_ha_pham + amount).toLocaleString()}** LT.`
      });
      return;
    }

    // ─── PHÁT KNB ──────────────────────────────────────────────
    if (subcommand === 'giveknb') {
      const targetUser = interaction.options.getUser('tuser', true);
      const amount = interaction.options.getInteger('amount', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật trong hệ thống.`
        });
        return;
      }

      const currentKnb = targetProfile.knb || 0;
      const newKnb = Math.max(0, currentKnb + amount);

      userRepository.update(targetUser.id, {
        knb: newKnb
      });

      systemConfigService.writeAuditLog(userId, 'admin_giveknb', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        amount
      });

      await interaction.editReply({
        content: `💎 **Thiên Phú Kim Bảo:** Đã điều chỉnh **${amount.toLocaleString()} KNB** cho tu sĩ **${targetProfile.name}** (<@${targetUser.id}>)!\n💰 Số dư mới: **${newKnb.toLocaleString()}** KNB.`
      });
      return;
    }

    // ─── PHÁT NGỘ TÍNH ──────────────────────────────────────────
    if (subcommand === 'givent') {
      const targetUser = interaction.options.getUser('tuser', true);
      const amount = interaction.options.getInteger('amount', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật trong hệ thống.`
        });
        return;
      }

      const currentNT = targetProfile.ngotinh || 0;
      const newNT = Math.max(0, currentNT + amount);

      userRepository.update(targetUser.id, {
        ngotinh: newNT
      });

      systemConfigService.writeAuditLog(userId, 'admin_givent', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        amount
      });

      await interaction.editReply({
        content: `💡 **Ngộ Tính:** Đã điều chỉnh **${amount.toLocaleString()} NT** cho tu sĩ **${targetProfile.name}** (<@${targetUser.id}>)!\n✨ Số dư mới: **${newNT.toLocaleString()}** NT.`
      });
      return;
    }

    // ─── GỌI LỮ KHÁCH THẦN BÍ ──────────────────────────────────
    if (subcommand === 'spawntraveler') {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({ content: 'Lệnh này phải được dùng trong Server.'});
        return;
      }

      const guildConfig = db.prepare('SELECT event_channel_id, tuluyen_channel_id FROM guild_configs WHERE guild_id = ?').get(guildId) as any;
      let targetChannelId = guildConfig?.event_channel_id;

      if (!targetChannelId) {
        targetChannelId = guildConfig?.tuluyen_channel_id || interaction.channelId;
        // Self-heal: Save fallback to DB so automatic events also work!
        if (guildConfig) {
          db.prepare('UPDATE guild_configs SET event_channel_id = ? WHERE guild_id = ?').run(targetChannelId, guildId);
        } else {
          db.prepare('INSERT INTO guild_configs (guild_id, event_channel_id) VALUES (?, ?)').run(guildId, targetChannelId);
        }
      }

      const { travelerService } = require('../../services/TravelerService');
      const success = await travelerService.spawnTraveler(client, targetChannelId);

      if (success) {
        await interaction.editReply({ content: `✅ Đã gọi Lữ Khách Thần Bí xuất hiện tại <#${targetChannelId}>!`});
      } else {
        await interaction.editReply({ content: '❌ Lỗi khi gọi Lữ Khách.'});
      }
      return;
    }

    if (subcommand === 'panel') {
      const embed = await AdminCommand.getPanelEmbed(client);
      const components = AdminCommand.getPanelComponents(userId);
      await interaction.editReply(toV2Payload([embed], components));
      return;
    }

    if (subcommand === 'ban') {
      const targetUser = interaction.options.getUser('tuser', true);
      const reason = interaction.options.getString('reason') || 'Trục xuất khỏi tam giới (Banned by Admin)';

      db.prepare(`
        INSERT INTO banned_users (user_id, reason, banned_by, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = excluded.created_at
      `).run(targetUser.id, reason, userId, Math.floor(Date.now() / 1000));

      systemConfigService.writeAuditLog(userId, 'admin_ban', {
        targetUserId: targetUser.id,
        targetTag: targetUser.tag,
        reason
      });

      await interaction.editReply({
        content: `🔒 **Thiên Đạo Trừng Phạt:** Đã phong ấn linh hồn tu sĩ <@${targetUser.id}> khỏi tam giới!\n📝 **Lý do:** *${reason}*`
      });
      return;
    }

    if (subcommand === 'unban') {
      const targetUserId = interaction.options.getString('user_id', true).trim();

      const exists = db.prepare('SELECT 1 FROM banned_users WHERE user_id = ?').get(targetUserId);
      if (!exists) {
        await interaction.editReply({
          content: `❌ Linh hồn tu sĩ có ID \`${targetUserId}\` không ở trạng thái bị phong ấn.`
        });
        return;
      }

      db.prepare('DELETE FROM banned_users WHERE user_id = ?').run(targetUserId);

      systemConfigService.writeAuditLog(userId, 'admin_unban', {
        targetUserId
      });

      await interaction.editReply({
        content: `🔓 **Thiên Đạo Xá Tội:** Đã hóa giải phong ấn, cho phép tu sĩ có ID \`${targetUserId}\` (<@${targetUserId}>) quay trở lại tu luyện!`
      });
      return;
    }

    if (subcommand === 'givestamina') {
      const targetUser = interaction.options.getUser('tuser', true);
      const amount = interaction.options.getInteger('amount', true);

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.editReply({
          content: `❌ Tu sĩ <@${targetUser.id}> chưa khởi tạo nhân vật trong hệ thống.`
        });
        return;
      }

      const currentStamina = targetProfile.stamina;
      const newStamina = Math.min(500, Math.max(0, currentStamina + amount));

      userRepository.update(targetUser.id, {
        stamina: newStamina
      });

      systemConfigService.writeAuditLog(userId, 'admin_givestamina', {
        targetUserId: targetUser.id,
        targetName: targetProfile.name,
        amount,
        oldStamina: currentStamina,
        newStamina
      });

      await interaction.editReply({
        content: `🔋 **Thiên Phú Linh Thể:** Đã điều chỉnh thể lực cho tu sĩ **${targetProfile.name}** (<@${targetUser.id}>):\n📈 **Thay đổi:** \`${amount >= 0 ? '+' : ''}${amount}\` thể lực.\n⚡ **Thể lực hiện tại:** **${newStamina}/500**`
      });
      return;
    }

    if (subcommand === 'logs') {
      const targetUser = interaction.options.getUser('tuser');
      const filterAction = interaction.options.getString('action');
      const limit = interaction.options.getInteger('limit') || 10;

      let query = 'SELECT * FROM audit_logs';
      const conditions: string[] = [];
      const params: any[] = [];

      if (targetUser) {
        conditions.push('user_id = ?');
        params.push(targetUser.id);
      }
      if (filterAction) {
        conditions.push('action = ?');
        params.push(filterAction);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const logs = db.prepare(query).all(...params) as any[];

      const embed = new EmbedBuilder()
        .setTitle('📜 NHẬT KÝ AUDIT THIÊN ĐẠO')
        .setColor(EMBED_COLORS.ORANGE)
        .setDescription(
          logs.length === 0
            ? 'Không tìm thấy nhật ký audit tương ứng với điều kiện lọc.'
            : logs
                .map(l => {
                  const time = new Date(l.created_at * 1000).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                  });
                  let detailsText = l.details || '';
                  if (detailsText.length > 80) {
                    detailsText = detailsText.substring(0, 77) + '...';
                  }
                  return `[\`${time}\`] **${l.action}** (Bởi: <@${l.user_id}>)\n └ *${detailsText}*`;
                })
                .join('\n')
        )
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (subcommand === 'broadcast') {
      const title = interaction.options.getString('title', true);
      const message = interaction.options.getString('message', true).replace(/\\n/g, '\n');
      const colorInput = interaction.options.getString('color');
      const imageUrl = interaction.options.getString('image');

      const color = (colorInput && /^#[0-9A-F]{6}$/i.test(colorInput)) ? colorInput : '#f1c40f';



      const guilds = db.prepare('SELECT * FROM guild_configs').all() as any[];
      let successCount = 0;
      let failCount = 0;
      const sentChannels = new Set<string>();

      // Gửi tại chỗ dùng panel đầu tiên
      const currentChannelId = interaction.channelId;
      if (currentChannelId && /^\d{17,20}$/.test(currentChannelId)) {
        try {
          const channel = await client.channels.fetch(currentChannelId) as any;
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(message)
              .setColor(color as any)
              .setFooter({ text: '📢 THIÊN ĐẠO TRUYỀN ÂM (Hệ Thống Thông Báo)' })
              .setTimestamp();
            if (imageUrl) embed.setImage(imageUrl);

            await channel.send({ embeds: [embed] });
            successCount++;
            sentChannels.add(currentChannelId);
          }
        } catch (err) {
          console.error(`Broadcast failed for current channel ${currentChannelId}:`, err);
        }
      }

      for (const config of guilds) {
        const channelId = config.chat_channel_id || config.event_channel_id || config.tuluyen_channel_id;
        if (!channelId || sentChannels.has(channelId)) continue;
        if (!/^\d{17,20}$/.test(channelId)) {
          console.warn(`Skipping invalid snowflake channelId: ${channelId}`);
          continue;
        }

        try {
          const channel = await client.channels.fetch(channelId) as any;
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(message)
              .setColor(color as any)
              .setFooter({ text: '📢 THIÊN ĐẠO TRUYỀN ÂM (Hệ Thống Thông Báo)' })
              .setTimestamp();
            if (imageUrl) embed.setImage(imageUrl);

            await channel.send({ embeds: [embed] });
            successCount++;
            sentChannels.add(channelId);
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Broadcast failed for channel ${channelId}:`, err);
          failCount++;
        }
      }

      systemConfigService.writeAuditLog(userId, 'admin_broadcast', {
        title,
        message,
        guildCount: guilds.length,
        successCount,
        failCount
      });

      await interaction.editReply({
        content: `📢 **Thiên Đạo Truyền Âm Hoàn Tất:**\n✅ Gửi thành công: **${successCount}** kênh.\n❌ Thất bại/Bỏ qua: **${failCount}** kênh.`
      });
      return;
    }

    if (subcommand === 'rollback') {
      const hours = interaction.options.getInteger('hours', true);
      const minutes = interaction.options.getInteger('minutes') || 0;
      const targetAgeMinutes = hours * 60 + minutes;

      const { backupService } = require('../../services/BackupService');
      const backups = backupService.listBackups();

      if (backups.length === 0) {
        await interaction.editReply({
          content: '❌ Không tìm thấy bản sao lưu (backup) nào trong hệ thống.'
        });
        return;
      }

      // Tìm bản sao lưu gần nhất với khoảng thời gian mong muốn
      let closestBackup = backups[0];
      let minDiff = Math.abs(closestBackup.ageMinutes - targetAgeMinutes);

      for (const b of backups) {
        const diff = Math.abs(b.ageMinutes - targetAgeMinutes);
        if (diff < minDiff) {
          minDiff = diff;
          closestBackup = b;
        }
      }

      // Xác nhận khôi phục
      const embed = new EmbedBuilder()
        .setTitle('⚠️ THIÊN ĐẠO HỒI QUY — XÁC NHẬN KHÔI PHỤC')
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(
          `Đạo hữu đang yêu cầu khôi phục tam giới về thời điểm **${hours} giờ ${minutes} phút trước**.\n\n` +
          `📂 **Bản sao lưu phù hợp nhất tìm thấy:**\n` +
          `• Tên tệp: \`${closestBackup.filename}\`\n` +
          `• Được tạo cách đây: **${closestBackup.ageMinutes} phút** (${closestBackup.createdAt.toLocaleString('vi-VN')})\n` +
          `• Kích thước: **${(closestBackup.size / 1024 / 1024).toFixed(2)} MB**\n\n` +
          `⚠️ **LƯU Ý QUAN TRỌNG:**\n` +
          `- Tiến trình, giao dịch và dữ liệu phát sinh **sau thời điểm trên** sẽ bị xoá bỏ hoàn toàn.\n` +
          `- Bot sẽ tự động khởi động lại ngay sau khi khôi phục đè tệp cơ sở dữ liệu.\n` +
          `- Vui lòng chỉ thực hiện khi phát hiện lỗi nghiêm trọng.`
        )
        .setFooter({ text: `Yêu cầu bởi Thiên Đạo Chủ • ID: ${userId}` })
        .setTimestamp();

      const confirmButton = new ButtonBuilder()
        .setCustomId(`adminpanel_confirmrestore_${closestBackup.filename}_${userId}`)
        .setLabel('✔️ Xác Nhận Rollback')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`adminuser_back_null_${userId}`)
        .setLabel('❌ Hủy Bỏ')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

      await interaction.editReply(toV2Payload([embed], [row]));
      return;
    }

    if (subcommand === 'fixpets') {


      // Quét linh thú có nhiều hơn 2 skill
      const overSkilledPets = db.prepare(
        "SELECT p.*, u.name as owner_name FROM pets p LEFT JOIN users u ON p.user_id = u.discord_id WHERE json_array_length(p.skills) > 2"
      ).all() as any[];

      // Quét linh thú có data lỗi
      const brokenPets = db.prepare(
        "SELECT p.*, u.name as owner_name FROM pets p LEFT JOIN users u ON p.user_id = u.discord_id WHERE p.name IS NULL OR p.name = '' OR p.rarity NOT IN ('common','uncommon','rare','epic','legendary') OR p.level < 0"
      ).all() as any[];

      // Quét linh thú orphan (user_id không tồn tại)
      const orphanPets = db.prepare(`
        SELECT p.* FROM pets p
        LEFT JOIN users u ON p.user_id = u.discord_id
        WHERE u.discord_id IS NULL
      `).all() as any[];

      const totalAnomalies = overSkilledPets.length + brokenPets.length + orphanPets.length;

      if (totalAnomalies === 0) {
        const embed = new EmbedBuilder()
          .setTitle('✅ FIX PETS — KHÔNG CÓ LỖI')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription('Hệ thống không phát hiện bất thường nào với dữ liệu linh thú.')
          .setTimestamp();
        await interaction.editReply(toV2Payload([embed]));
        return;
      }

      // Chi tiết skill thừa
      let skillDetails = '';
      if (overSkilledPets.length > 0) {
        skillDetails = overSkilledPets.slice(0, 10).map(p => {
          const skills: string[] = JSON.parse(p.skills || '[]');
          return `• **${p.name || '???'}** (ID: ${p.id}) — \`${p.owner_name || p.user_id}\` — **${skills.length} skill**: ${skills.join(', ')}`;
        }).join('\n');
        if (overSkilledPets.length > 10) skillDetails += `\n*... và ${overSkilledPets.length - 10} thú nữa*`;
      }

      // Chi tiết thú lỗi
      let brokenDetails = '';
      if (brokenPets.length > 0) {
        brokenDetails = brokenPets.slice(0, 10).map(p => {
          const issues: string[] = [];
          if (!p.name || p.name === '') issues.push('tên rỗng');
          if (!['common','uncommon','rare','epic','legendary'].includes(p.rarity)) issues.push(`rarity: "${p.rarity}"`);
          if (p.level < 0) issues.push(`level: ${p.level}`);
          return `• **ID: ${p.id}** — \`${p.owner_name || p.user_id}\` — Lỗi: ${issues.join(', ')}`;
        }).join('\n');
        if (brokenPets.length > 10) brokenDetails += `\n*... và ${brokenPets.length - 10} thú nữa*`;
      }

      // Chi tiết orphan
      let orphanDetails = '';
      if (orphanPets.length > 0) {
        orphanDetails = orphanPets.slice(0, 10).map(p => {
          return `• **${p.name || '???'}** (ID: ${p.id}) — owner: \`${p.user_id}\` (không tồn tại)`;
        }).join('\n');
        if (orphanPets.length > 10) orphanDetails += `\n*... và ${orphanPets.length - 10} thú nữa*`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔍 FIX PETS — PHÁT HIỆN ${totalAnomalies} BẤT THƯỜNG`)
        .setColor(EMBED_COLORS.WARNING)
        .setDescription('Đây là kết quả quét tự động. Chọn hành động bên dưới để xử lý.')
        .setTimestamp();

      if (overSkilledPets.length > 0) {
        embed.addFields({
          name: `🛠️ Skill Thừa (>2): ${overSkilledPets.length} thú`,
          value: skillDetails + '\n*→ Hành động: Cắt về 2 skill (giữ 2 cái đầu)*'
        });
      }
      if (brokenPets.length > 0) {
        embed.addFields({
          name: `🗑️ Thú Data Lỗi: ${brokenPets.length} thú`,
          value: brokenDetails + '\n*→ Hành động: Xoá toàn bộ*'
        });
      }
      if (orphanPets.length > 0) {
        embed.addFields({
          name: `👻 Thú Orphan: ${orphanPets.length} thú`,
          value: orphanDetails + '\n*→ Hành động: Xoá toàn bộ*'
        });
      }

      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      if (overSkilledPets.length > 0) {
        const fixSkillsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminfixpets_skill_${userId}`)
            .setLabel(`🛠️ Sửa ${overSkilledPets.length} thú skill thừa`)
            .setStyle(ButtonStyle.Primary),
        );
        components.push(fixSkillsRow);
      }

      if (brokenPets.length > 0 || orphanPets.length > 0) {
        const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminfixpets_delete_${userId}`)
            .setLabel(`🗑️ Xoá ${brokenPets.length + orphanPets.length} thú lỗi/orphan`)
            .setStyle(ButtonStyle.Danger),
        );
        components.push(deleteRow);
      }

      if (components.length > 0) {
        const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminfixpets_cancel_${userId}`)
            .setLabel('❌ Không xử lý')
            .setStyle(ButtonStyle.Secondary),
        );
        components.push(cancelRow);
      }

      await interaction.editReply(toV2Payload([embed], components));
      return;
    }

    // ─── KIỂM TRA VẬT PHẨM BẤT THƯỜNG (ORPHAN ITEMS) ──────────
    if (subcommand === 'checkorphan') {


      // Quét inventory có item_id không tồn tại trong bảng items
      const orphanItems = db.prepare(`
        SELECT i.*, u.name as owner_name, u.level as owner_level
        FROM inventories i
        LEFT JOIN items t ON i.item_id = t.id
        LEFT JOIN users u ON i.user_id = u.discord_id
        WHERE t.id IS NULL
        ORDER BY u.name ASC
      `).all() as any[];

      // Quét inventory có user_id không tồn tại
      const orphanByUser = db.prepare(`
        SELECT i.*, t.name as item_name
        FROM inventories i
        LEFT JOIN users u ON i.user_id = u.discord_id
        LEFT JOIN items t ON i.item_id = t.id
        WHERE u.discord_id IS NULL
      `).all() as any[];

      // Quét inventory có quantity <= 0 hoặc null
      const invalidQty = db.prepare(`
        SELECT i.*, u.name as owner_name, t.name as item_name
        FROM inventories i
        LEFT JOIN users u ON i.user_id = u.discord_id
        LEFT JOIN items t ON i.item_id = t.id
        WHERE i.quantity <= 0 OR i.quantity IS NULL
      `).all() as any[];

      const totalAnomalies = orphanItems.length + orphanByUser.length + invalidQty.length;

      if (totalAnomalies === 0) {
        const embed = new EmbedBuilder()
          .setTitle('✅ CHECK ORPHAN ITEMS — KHÔNG CÓ LỖI')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription('Hệ thống không phát hiện bất thường nào với dữ liệu vật phẩm trong túi đồ.')
          .setTimestamp();
        await interaction.editReply(toV2Payload([embed]));
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔍 CHECK ORPHAN ITEMS — PHÁT HIỆN ${totalAnomalies} BẤT THƯỜNG`)
        .setColor(EMBED_COLORS.WARNING)
        .setDescription('Đây là kết quả quét tự động. Chọn hành động bên dưới để xử lý.')
        .setTimestamp();

      // Chi tiết item không tồn tại trong bảng items
      if (orphanItems.length > 0) {
        const details = orphanItems.slice(0, 15).map(i => {
          return `• **${i.owner_name || '???'}** (Lv.${i.owner_level || '?'}) — item_id: \`${i.item_id}\` — SL: ${i.quantity}`;
        }).join('\n');
        const extra = orphanItems.length > 15 ? `\n*... và ${orphanItems.length - 15} vật phẩm nữa*` : '';
        embed.addFields({
          name: `👻 Item Không Tồn Tại: ${orphanItems.length} chiếc`,
          value: details + extra + '\n*→ Hành động: Xoá toàn bộ*'
        });
      }

      // Chi tiết inventory của user không tồn tại
      if (orphanByUser.length > 0) {
        const details = orphanByUser.slice(0, 15).map(i => {
          return `• user_id: \`${i.user_id}\` — item: **${i.item_name || i.item_id}** — SL: ${i.quantity}`;
        }).join('\n');
        const extra = orphanByUser.length > 15 ? `\n*... và ${orphanByUser.length - 15} vật phẩm nữa*` : '';
        embed.addFields({
          name: `👤 User Không Tồn Tại: ${orphanByUser.length} chiếc`,
          value: details + extra + '\n*→ Hành động: Xoá toàn bộ*'
        });
      }

      // Chi tiết quantity bất thường
      if (invalidQty.length > 0) {
        const details = invalidQty.slice(0, 15).map(i => {
          return `• **${i.owner_name || '???'}** — item: **${i.item_name || i.item_id}** — SL: ${i.quantity}`;
        }).join('\n');
        const extra = invalidQty.length > 15 ? `\n*... và ${invalidQty.length - 15} vật phẩm nữa*` : '';
        embed.addFields({
          name: `⚠️ Quantity Bất Thường: ${invalidQty.length} chiếc`,
          value: details + extra + '\n*→ Hành động: Xoá toàn bộ*'
        });
      }

      // Buttons
      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      if (totalAnomalies > 0) {
        const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`admincheckorphan_delete_${userId}`)
            .setLabel(`🗑️ Xoá ${totalAnomalies} vật phẩm bất thường`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`admincheckorphan_cancel_${userId}`)
            .setLabel('❌ Không xử lý')
            .setStyle(ButtonStyle.Secondary),
        );
        components.push(deleteRow);
      }

      await interaction.editReply(toV2Payload([embed], components));
      return;
    }

    if (subcommand === 'checkstats') {
      const targetId = interaction.options.getString('tuser', true);
      const targetUser = userRepository.get(targetId);

      if (!targetUser) {
        await interaction.editReply({ content: '❌ Không tìm thấy người chơi!' });
        return;
      }

      // Lấy inventory và equipment
      const inventory = inventoryRepository.getUserInventory(targetId);
      const equipped = inventory.filter(i => i.is_equipped === 1);
      const totalItems = inventory.length;
      const totalEquipped = equipped.length;

      // Tính tổng stats từ equipment
      let totalEquipAtk = 0, totalEquipDef = 0, totalEquipHp = 0, totalEquipMp = 0;
      let equipDetails = '';

      for (const item of equipped) {
        const baseBonus = JSON.parse(item.base_stats || '{}');
        const starMult = 1 + (item.stars || 0) * 0.20;
        const enhanceMult = 1 + (item.enhance_level || 0) * 0.10;
        const durability = item.durability ?? 100;
        const durabilityMult = durability > 0 ? 1.0 : 0.5;
        const boundMult = item.is_life_bound === 1 ? 1 + (item.bound_level || 1) * 0.05 : 1.0;

        const atk = Math.round((baseBonus.atk || 0) * starMult * enhanceMult * durabilityMult * boundMult);
        const def = Math.round((baseBonus.def || 0) * starMult * enhanceMult * durabilityMult * boundMult);
        const hp = Math.round((baseBonus.hp || 0) * starMult * enhanceMult * durabilityMult * boundMult);
        const mp = Math.round((baseBonus.mp || 0) * starMult * enhanceMult * durabilityMult * boundMult);

        totalEquipAtk += atk;
        totalEquipDef += def;
        totalEquipHp += hp;
        totalEquipMp += mp;

        const starStr = item.stars > 0 ? ` ⭐${item.stars}` : '';
        const enhanceStr = item.enhance_level > 0 ? ` +${item.enhance_level}` : '';
        const durabilityStr = durability <= 0 ? ' ⚠️HẾT' : '';
        equipDetails += `• **${item.name || item.item_id}**${starStr}${enhanceStr}${durabilityStr}: ATK +${atk} | DEF +${def} | HP +${hp}\n`;
      }

      // Tính total stats hiện tại
      const { inventoryService } = require('../../services/InventoryService');
      const currentStats = inventoryService.getActiveStats(targetId);
      const totalAtk = currentStats ? currentStats.atk : targetUser.base_atk;
      const totalDef = currentStats ? currentStats.def : targetUser.base_def;
      const totalHp = currentStats ? currentStats.hp : targetUser.base_hp;
      const totalMp = currentStats ? currentStats.mp : targetUser.base_mp;

      // Lực chiến ước tính
      const combatPower = currentStats ? Math.round(
        currentStats.hp * 0.2 + currentStats.mp * 0.1 + currentStats.atk * 3 + currentStats.def * 5 +
        currentStats.crit * 1000 + currentStats.critRes * 1000 + currentStats.luck * 10 +
        currentStats.speed * 10 + currentStats.dodge * 1000
      ) : 0;

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Kiểm Tra Chỉ Số: ${targetUser.name}`)
        .setColor(EMBED_COLORS.INFO)
        .setDescription(
          `**👤 Nhân Vật:** ${targetUser.name} (ID: ${targetId})\n` +
          `**📊 Level:** ${targetUser.level} | **Cảnh Giới:** ${getRealmDetails(targetUser.level).realmName}\n\n` +
          `**💪 Chỉ Số Tổng:**\n` +
          `• HP: **${totalHp}** (Base: ${targetUser.base_hp} + Equip: ${totalEquipHp})\n` +
          `• MP: **${totalMp}** (Base: ${targetUser.base_mp} + Equip: ${totalEquipMp})\n` +
          `• ATK: **${totalAtk}** (Base: ${targetUser.base_atk} + Equip: ${totalEquipAtk})\n` +
          `• DEF: **${totalDef}** (Base: ${targetUser.base_def} + Equip: ${totalEquipDef})\n` +
          `• Crit: ${currentStats ? (currentStats.crit * 100).toFixed(1) : 0}% | CritRes: ${currentStats ? (currentStats.critRes * 100).toFixed(1) : 0}%\n` +
          `• Luck: ${currentStats ? currentStats.luck : 0} | Speed: ${currentStats ? currentStats.speed : 0}\n` +
          `• Dodge: ${currentStats ? (currentStats.dodge * 100).toFixed(1) : 0}%\n\n` +
          `**⚔️ Lực Chiến:** ${combatPower.toLocaleString()}\n\n` +
          `**🎒 Trang Bị Đang Đeo (${totalEquipped}/${totalItems}物品):**\n` +
          (equipDetails || '*Không có trang bị*')
        )
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    // ─── NỐI TỪ: DANH SÁCH TỪ CHỜ DUYỆT ────────────────────────
    if (subcommand === 'noitu_ds') {
      const totalWords = noituService.getWordCount();
      const pending = noituService.getPendingSuggestions();
      const pendingCount = pending.length;

      if (pendingCount === 0) {
        await interaction.editReply({
          content: `📖 **Từ điển Nối Từ** hiện có **${totalWords}** từ.\n✅ Không có từ nào đang chờ duyệt.`
        });
        return;
      }

      const lines = pending.slice(0, 20).map(s =>
        `\`#${s.id}\` **${s.word}** — <@${s.suggested_by}> — <t:${s.suggested_at}:R>`
      );
      if (pendingCount > 20) lines.push(`*... và ${pendingCount - 20} từ nữa*`);

      const embed = new EmbedBuilder()
        .setTitle('📝 TỪ ĐÓNG GÓP CHỜ DUYỆT')
        .setColor(EMBED_COLORS.WARNING)
        .setDescription(
          `📖 Từ điển: **${totalWords}** từ\n` +
          `⏳ Chờ duyệt: **${pendingCount}** từ\n\n` +
          lines.join('\n')
        )
        .setFooter({ text: `Dùng /admin noitu_duyet để duyệt hoặc từ chối` })
        .setTimestamp();
      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    // ─── NỐI TỪ: DUYỆT TẤT CẢ ────────────────────────────────
    if (subcommand === 'noitu_duyettatca') {
      const count = noituService.bulkApproveSuggestions(userId);
      if (count === 0) {
        await interaction.editReply({ content: '✅ Không có từ nào đang chờ duyệt.' });
        return;
      }
      await interaction.editReply({ content: `✅ Đã duyệt **${count}** từ. Cảm ơn đạo hữu!` });
      return;
    }

    // ─── NỐI TỪ: DUYỆT / TỪ CHỐI TỪ ───────────────────────────
    if (subcommand === 'noitu_duyet') {
      const id = interaction.options.getInteger('id', true);
      const action = interaction.options.getString('action', true) as 'approve' | 'reject';

      const result = noituService.reviewSuggestion(id, action, userId);

      if (result === 'not_found') {
        await interaction.editReply({ content: `❌ Không tìm thấy từ có ID **#${id}**.` });
        return;
      }
      if (result === 'already_reviewed') {
        await interaction.editReply({ content: `ℹ️ Từ **#${id}** đã được duyệt/từ chối trước đó.` });
        return;
      }

      const label = action === 'approve' ? '✅ Đã duyệt' : '❌ Đã từ chối';
      await interaction.editReply({ content: `${label} từ **#${id}**.` });
      return;
    }
  }

  public static async getPanelEmbed(client: TuTienClient): Promise<EmbedBuilder> {
    const totalPlayers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
    const totalSects = (db.prepare('SELECT COUNT(*) as c FROM sects').get() as any)?.c || 0;
    const totalItems = (db.prepare('SELECT COUNT(*) as c FROM inventories').get() as any)?.c || 0;
    const topPlayer = db.prepare('SELECT name, level FROM users ORDER BY level DESC LIMIT 1').get() as { name: string; level: number } | undefined;
    const maintenanceMode = systemConfigService.isMaintenanceMode();
    const guilds = client.guilds.cache.size;
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    
    // Lấy thông tin World Boss
    const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
    let bossStatus = '⚠️ Chưa xuất thế';
    if (boss) {
      if (boss.status === 'active') {
        bossStatus = `🔴 Đang xuất thế (Cấp ${boss.level} | ${boss.hp}/${boss.max_hp} HP)`;
      } else {
        bossStatus = `💀 Bị tiêu diệt (Cấp ${boss.level})`;
      }
    }

    // Lấy thông tin Double EXP
    const { eventService } = require('../../services/EventService');
    const doubleExpActive = eventService.isDoubleExpActive();

    return new EmbedBuilder()
      .setTitle('⚙️ THIÊN ĐẠO PANEL — TRUNG TÂM QUẢN TRỊ')
      .setColor(EMBED_COLORS.DARK_PURPLE)
      .setDescription(
        `Chào mừng **Thiên Đạo Chủ** trở lại. Bảng điều khiển này cung cấp khả năng can thiệp trực tiếp vào đại trận vận hành tam giới.\n\n` +
        `🤖 **Trạng Thái Bot:**\n` +
        `• Tag: **${client.user?.tag}**\n` +
        `• Uptime: **${uptimeStr}**\n` +
        `• Guilds: **${guilds}** guild(s)\n` +
        `• Bộ nhớ: **${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB**\n\n` +
        `👥 **Số Liệu Tam Giới:**\n` +
        `• Tổng Tu Sĩ: **${totalPlayers}** | Tông Môn: **${totalSects}**\n` +
        `• Tổng Vật Phẩm: **${totalItems}** chiếc\n` +
        `• Chí Tôn: ${topPlayer ? `**${topPlayer.name}** (Cấp ${topPlayer.level})` : 'Chưa có'}\n\n` +
        `🛠️ **Trạng Thái Hệ Thống:**\n` +
        `• Bảo Trì: ${maintenanceMode ? '🔴 **ĐANG BẬT** (Chặn tu sĩ)' : '🟢 **ĐANG TẮT** (Hoạt động bình thường)'}\n` +
        `• Nhân Đôi EXP: ${doubleExpActive ? '🔴 **ĐANG HOẠT ĐỘNG (x2 EXP)**' : '🟢 **ĐANG TẮT**'}\n` +
        `• World Boss: **${bossStatus}**`
      )
      .setFooter({ text: `Quyền hạn cao nhất • ID: ${BOT_OWNER_ID}` })
      .setTimestamp();
  }

  public static getPanelComponents(adminId: string): any[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminpanel_refresh_${adminId}`)
        .setLabel('📊 Làm Mới')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_maintenance_${adminId}`)
        .setLabel('🛠️ Bảo Trì')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_spawntraveler_${adminId}`)
        .setLabel('🦄 Lữ Khách')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminpanel_spawnboss_${adminId}`)
        .setLabel('👹 Gọi Boss')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`adminpanel_killboss_${adminId}`)
        .setLabel('💀 Diệt Boss')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminpanel_searchuser_${adminId}`)
        .setLabel('👤 Tìm Kiếm Tu Sĩ')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_resetweekly_${adminId}`)
        .setLabel('📈 Reset Giới Hạn Tuần')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_doubleexp_${adminId}`)
        .setLabel('⚡ Nhân Đôi EXP')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminpanel_dbcleanup_${adminId}`)
        .setLabel('🧹 Dọn Dẹp DB')
        .setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminpanel_auditlog_${adminId}`)
        .setLabel('📜 Nhật Ký Audit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_broadcast_${adminId}`)
        .setLabel('📢 Phát Thông Báo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminpanel_backupmgr_${adminId}`)
        .setLabel('🗄️ Quản Lý Backup')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`adminpanel_testmax_${adminId}`)
        .setLabel('🧪 Test Max')
        .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
  }

  public static getUserPanelEmbed(targetUserId: string): EmbedBuilder {
    const user = userRepository.get(targetUserId);
    if (!user) {
      return new EmbedBuilder()
        .setTitle('❌ Không tìm thấy tu sĩ')
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(`Không tìm thấy nhân vật của tu sĩ có ID: \`${targetUserId}\`.`);
    }

    const inventoryCount = (db.prepare('SELECT COUNT(*) as c FROM inventories WHERE user_id = ?').get(targetUserId) as any)?.c || 0;
    const deployedPet = db.prepare('SELECT name, level, rarity FROM pets WHERE user_id = ? AND is_deployed = 1').get(targetUserId) as any;
    const petText = deployedPet ? `🐾 **${deployedPet.name}** (Cấp ${deployedPet.level} [${deployedPet.rarity.toUpperCase()}])` : '💤 Không có';

    // Lấy thông tin cấm
    const banInfo = db.prepare('SELECT reason, created_at FROM banned_users WHERE user_id = ?').get(targetUserId) as { reason: string, created_at: number } | undefined;
    const statusText = banInfo 
      ? `🔴 **BỊ PHONG ẤN** (Lý do: *${banInfo.reason}* - ngày ${new Date(banInfo.created_at * 1000).toLocaleString('vi-VN')})` 
      : '🟢 **ĐANG HOẠT ĐỘNG**';

    const now = Math.floor(Date.now() / 1000);
    let injuryText = '🟢 **Khỏe mạnh**';
    if (user.injury_end_time && user.injury_end_time > now) {
      const remain = user.injury_end_time - now;
      const minutes = Math.ceil(remain / 60);
      injuryText = `🔴 **Trọng thương** (Còn ${minutes} phút)`;
    }

    return new EmbedBuilder()
      .setTitle(`👤 HỒ SƠ TU SĨ — ĐẠO HỮU: ${user.name}`)
      .setColor(banInfo ? EMBED_COLORS.ERROR : EMBED_COLORS.INFO)
      .setDescription(
        `Đang xem thông tin quản trị của tu sĩ <@${targetUserId}> (ID: \`${targetUserId}\`):\n\n` +
        `⚠️ **Trạng thái:** ${statusText}\n` +
        `🩹 **Chấn thương:** ${injuryText}\n\n` +
        `🌟 **Thông Tin Cảnh Giới:**\n` +
        `• Cảnh Giới: **${user.title}** (Cấp ${user.level})\n` +
        `• Tu Vi: **${user.tu_vi} / ${user.exp_needed}**\n` +
        `• Thể Lực: **${user.stamina} / 500**\n\n` +
        `💰 **Tài Sản & Rương Đồ:**\n` +
        `• Linh Thạch Hạ Phẩm: **${user.coin_ha_pham.toLocaleString()}** LT\n` +
        `• KNB: **${user.knb.toLocaleString()}** KNB\n` +
        `• Số lượng vật phẩm trong kho: **${inventoryCount}** vật phẩm\n` +
        `• Linh Thú xuất chiến: ${petText}\n\n` +
        `🧬 **Linh Căn:** \`${user.linh_can}\`\n\n` +
        `📊 **Thuộc Tính Cơ Bản (Stats Gốc):**\n` +
        `• HP: **${user.base_hp}** | MP: **${user.base_mp}**\n` +
        `• ATK: **${user.base_atk}** | DEF: **${user.base_def}**\n` +
        `• Bạo Kích: **${(user.base_crit * 100).toFixed(1)}%** | Kháng Bạo: **${(user.base_crit_res * 100).toFixed(1)}%**\n` +
        `• May Mắn: **${user.base_luck}**`
      )
      .setTimestamp();
  }

  public static getUserPanelComponents(targetUserId: string, adminId: string): any[] {
    const isBanned = db.prepare('SELECT 1 FROM banned_users WHERE user_id = ?').get(targetUserId);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminuser_givecoin_${targetUserId}_${adminId}`)
        .setLabel('🪙 Ban Linh Thạch')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminuser_giveknb_${targetUserId}_${adminId}`)
        .setLabel('💎 Ban KNB')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminuser_giveitem_${targetUserId}_${adminId}`)
        .setLabel('🎁 Ban Vật Phẩm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminuser_setlevel_${targetUserId}_${adminId}`)
        .setLabel('⚡ Sửa Cảnh Giới')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminuser_editlinhcan_${targetUserId}_${adminId}`)
        .setLabel('🧬 Sửa Linh Căn')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminuser_stamina_${targetUserId}_${adminId}`)
        .setLabel('🔋 Sửa Thể Lực')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminuser_heal_${targetUserId}_${adminId}`)
        .setLabel('❤️ Trị Thương')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`adminuser_resetweekly_${targetUserId}_${adminId}`)
        .setLabel('🔄 Reset Hạn Tuần')
        .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(isBanned ? `adminuser_unban_${targetUserId}_${adminId}` : `adminuser_ban_${targetUserId}_${adminId}`)
        .setLabel(isBanned ? '🔓 Giải Phong' : '🔒 Phong Ấn')
        .setStyle(isBanned ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`adminuser_back_${targetUserId}_${adminId}`)
        .setLabel('🔙 Quay Lại Panel')
        .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2, row3];
  }

  public static async handleInteraction(
    client: TuTienClient,
    interaction: any,
    action: string,
    parts: string[]
  ): Promise<void> {
    const adminId = interaction.user.id;
    if (adminId !== BOT_OWNER_ID) {
      await interaction.editReply({ content: '❌ Cấm địa Thiên Đạo, đạo hữu không đủ quyền hạn!'});
      return;
    }

    const subAction = parts[1];

    if (action === 'adminpanel') {
      if (subAction === 'refresh') {
        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'maintenance') {
        const currentMode = systemConfigService.isMaintenanceMode();
        const nextMode = !currentMode;
        systemConfigService.setMaintenanceMode(nextMode);
        systemConfigService.writeAuditLog(adminId, 'admin_maintenance', { status: nextMode });

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'spawntraveler') {
        const guildId = interaction.guildId;
        if (!guildId) {
          await interaction.editReply({ content: '❌ Lập đàn gọi lữ khách phải thực hiện trong Server.'});
          return;
        }

        const guildConfig = db.prepare('SELECT event_channel_id, tuluyen_channel_id FROM guild_configs WHERE guild_id = ?').get(guildId) as any;
        let targetChannelId = guildConfig?.event_channel_id;

        if (!targetChannelId) {
          targetChannelId = guildConfig?.tuluyen_channel_id || interaction.channelId;
          // Self-heal: Save fallback to DB so automatic events also work!
          if (guildConfig) {
            db.prepare('UPDATE guild_configs SET event_channel_id = ? WHERE guild_id = ?').run(targetChannelId, guildId);
          } else {
            db.prepare('INSERT INTO guild_configs (guild_id, event_channel_id) VALUES (?, ?)').run(guildId, targetChannelId);
          }
        }

        const { travelerService } = require('../../services/TravelerService');
        const success = await travelerService.spawnTraveler(client, targetChannelId);

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        if (success) {
          await safeV2Update(interaction, [embed], components);
        } else {
          await safeV2Update(interaction, [embed], components);
        }
      }
      
      else if (subAction === 'spawnboss') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_spawnboss`)
          .setTitle('Gọi Boss Thế Giới');

        const lvlInput = new TextInputBuilder()
          .setCustomId('boss_level')
          .setLabel('Cấp độ Boss muốn triệu hồi')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Nhập số nguyên lớn hơn 0 (Ví dụ: 5)')
          .setValue('1')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(lvlInput));
        await interaction.showModal(modal);
      }
      
      else if (subAction === 'killboss') {
        const boss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
        if (!boss || boss.hp <= 0 || boss.status !== 'active') {
          await interaction.editReply({ content: '❌ Hiện không có Boss Thế Giới nào đang hoạt động để tiêu diệt!'});
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        db.prepare("UPDATE world_boss SET hp = 0, status = 'defeated', defeated_at = ?, defeated_by = ? WHERE id = 'world_boss_current'")
          .run(now, adminId);

        // Distribute rewards and announce
        const { combatService } = require('../../services/CombatService');
        const rewardsLogs = combatService.distributeWorldBossRewards(boss.level, adminId);
        
        const { bossSpawnService } = require('../../services/BossSpawnService');
        const currentBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
        await bossSpawnService.updateBossEmbeds(client, currentBoss);
        await bossSpawnService.broadcastBossDefeatedLogs(client, currentBoss, rewardsLogs);

        systemConfigService.writeAuditLog(adminId, 'admin_killboss', { bossLevel: boss.level });

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'searchuser') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_searchuser`)
          .setTitle('Quản Lý Tu Sĩ');

        const uIdInput = new TextInputBuilder()
          .setCustomId('target_user_id')
          .setLabel('Nhập ID Discord của tu sĩ')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: 724608013981450351')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(uIdInput));
        await interaction.showModal(modal);
      }
      
      else if (subAction === 'resetweekly') {
        const users = db.prepare('SELECT discord_id, y_canh FROM users').all() as any[];
        let count = 0;
        db.transaction(() => {
          for (const u of users) {
            try {
              let yCanh = JSON.parse(u.y_canh || '{}');
              if (yCanh.weekly_purchases) {
                delete yCanh.weekly_purchases;
                db.prepare('UPDATE users SET y_canh = ? WHERE discord_id = ?').run(JSON.stringify(yCanh), u.discord_id);
                count++;
              }
            } catch (e) {}
          }
        })();

        systemConfigService.writeAuditLog(adminId, 'admin_resetweekly', { affectedUsers: count });

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'dbcleanup') {
        const { dataCleanupService } = require('../../services/DataCleanupService');
        const stats = dataCleanupService.cleanupOldData();

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        
        let repContent = '❌ Dọn dẹp dữ liệu thất bại hoặc có lỗi xảy ra.';
        if (stats) {
          repContent = `🧹 **Dọn dẹp DB hoàn tất:**\n` +
            `• ${stats.marketHistory} lịch sử giao dịch chợ\n` +
            `• ${stats.duelHistory} lịch sử quyết đấu\n` +
            `• ${stats.marketListings} tin đăng Vạn Bảo Lâu\n` +
            `• ${stats.dungeons} bản ghi cooldown bí cảnh`;
        }

        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'doubleexp') {
        const { eventService } = require('../../services/EventService');
        const nextMode = !eventService.isDoubleExpActive();
        eventService.toggleDoubleExpManual(nextMode);
        systemConfigService.writeAuditLog(adminId, 'admin_doubleexp', { status: nextMode });

        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'auditlog') {
        const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all() as any[];
        const embed = new EmbedBuilder()
.setTitle('📜 NHẬT KÝ AUDIT THIÊN ĐẠO')
        .setColor(EMBED_COLORS.ORANGE)
        .setDescription(
          logs.length === 0
            ? 'Không có lịch sử nhật ký vận hành.'
              : logs.map(l => {
                  const time = new Date(l.created_at * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
                  let detailsText = l.details || '';
                  if (detailsText.length > 80) {
                    detailsText = detailsText.substring(0, 77) + '...';
                  }
                  return `[\`${time}\`] **${l.action}** (Bởi: <@${l.user_id}>) \n └ *${detailsText}*`;
                }).join('\n')
          )
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminuser_back_null_${adminId}`)
            .setLabel('🔙 Quay Lại Panel')
            .setStyle(ButtonStyle.Secondary)
        );
        await safeV2Update(interaction, [embed], [row] );
      }

      else if (subAction === 'broadcast') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_broadcast`)
          .setTitle('Thiên Đạo Truyền Âm');

        const titleInput = new TextInputBuilder()
          .setCustomId('bc_title')
          .setLabel('Tiêu đề thông báo')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: CẬP NHẬT PHIÊN BẢN MỚI')
          .setRequired(true);

        const msgInput = new TextInputBuilder()
          .setCustomId('bc_msg')
          .setLabel('Nội dung truyền âm')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nhập nội dung... (Dùng \\n để xuống dòng)')
          .setRequired(true);

        const colorInput = new TextInputBuilder()
          .setCustomId('bc_color')
          .setLabel('Màu viền (Hex)')
          .setStyle(TextInputStyle.Short)
          .setValue('#f1c40f')
          .setRequired(false);

        const imgInput = new TextInputBuilder()
          .setCustomId('bc_image')
          .setLabel('Link ảnh đính kèm (URL)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(imgInput)
        );
        await interaction.showModal(modal);
      }

      else if (subAction === 'backupmgr') {
        const { backupService } = require('../../services/BackupService');
        const backups = backupService.listBackups();
        const configPath = config.dbPath;
        const fs = require('fs');
        let dbSize = 0;
        try { dbSize = fs.statSync(configPath).size; } catch (e) {}

        const embed = new EmbedBuilder()
          .setTitle('🗄️ QUẢN TRỊ SAO LƯU & PHỤC HỒI HỆ THỐNG')
          .setColor(EMBED_COLORS.ALERT)
          .setDescription(
            `Trung tâm quản lý các bản sao lưu SQLite Database. Đạo hữu có thể khôi phục (rollback) dữ liệu tu sĩ tại đây.\n\n` +
            `📂 **Cơ Sở Dữ Liệu Hiện Tại:**\n` +
            `• Đường dẫn: \`${configPath}\`\n` +
            `• Kích thước: **${(dbSize / 1024 / 1024).toFixed(2)} MB**\n` +
            `• Tổng số bản sao lưu: **${backups.length}** / 48 bản ghi\n\n` +
            `📋 **10 Bản Sao Lưu Gần Nhất:**\n` +
            (backups.length === 0
              ? '*Chưa có bản sao lưu nào được tạo.*'
              : backups.slice(0, 10).map((b: any, i: number) => `${i + 1}. \`${b.filename}\` (${b.ageMinutes} phút trước | ${(b.size / 1024 / 1024).toFixed(2)} MB)`).join('\n'))
          )
          .setFooter({ text: 'Chọn tệp sao lưu bên dưới để khôi phục hoặc tạo sao lưu mới.' })
          .setTimestamp();

        const selectOptions = backups.slice(0, 25).map((b: any) => ({
          label: b.filename.substring(0, 100),
          description: `Cách đây ${b.ageMinutes} phút (${(b.size / 1024 / 1024).toFixed(2)} MB)`,
          value: b.filename
        }));

        const rows = [];
        if (selectOptions.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`adminpanel_restoreselect_${adminId}`)
            .setPlaceholder('Chọn bản sao lưu muốn khôi phục')
            .addOptions(selectOptions);
          rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
        }

        const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminpanel_createbackup_${adminId}`)
            .setLabel('➕ Tạo Sao Lưu Mới')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`adminuser_back_null_${adminId}`)
            .setLabel('🔙 Quay Lại Panel')
            .setStyle(ButtonStyle.Secondary)
        );
        rows.push(buttonsRow);

        await safeV2Update(interaction, [embed], rows );
      }

      else if (subAction === 'createbackup') {
        const { backupService } = require('../../services/BackupService');
        await backupService.createBackup('manual');

        systemConfigService.writeAuditLog(adminId, 'admin_backup_create_manual', {});

        const backups = backupService.listBackups();
        const configPath = config.dbPath;
        const fs = require('fs');
        let dbSize = 0;
        try { dbSize = fs.statSync(configPath).size; } catch (e) {}

        const embed = new EmbedBuilder()
          .setTitle('🗄️ QUẢN TRỊ SAO LƯU & PHỤC HỒI HỆ THỐNG')
          .setColor(EMBED_COLORS.ALERT)
          .setDescription(
            `✅ **Đã tạo sao lưu thủ công thành công!**\n\n` +
            `📂 **Cơ Sở Dữ Liệu Hiện Tại:**\n` +
            `• Đường dẫn: \`${configPath}\`\n` +
            `• Kích thước: **${(dbSize / 1024 / 1024).toFixed(2)} MB**\n` +
            `• Tổng số bản sao lưu: **${backups.length}** / 48 bản ghi\n\n` +
            `📋 **10 Bản Sao Lưu Gần Nhất:**\n` +
            backups.slice(0, 10).map((b: any, i: number) => `${i + 1}. \`${b.filename}\` (${b.ageMinutes} phút trước | ${(b.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')
          )
          .setTimestamp();

        const selectOptions = backups.slice(0, 25).map((b: any) => ({
          label: b.filename.substring(0, 100),
          description: `Cách đây ${b.ageMinutes} phút (${(b.size / 1024 / 1024).toFixed(2)} MB)`,
          value: b.filename
        }));

        const rows = [];
        if (selectOptions.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`adminpanel_restoreselect_${adminId}`)
            .setPlaceholder('Chọn bản sao lưu muốn khôi phục')
            .addOptions(selectOptions);
          rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
        }

        const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`adminpanel_createbackup_${adminId}`)
            .setLabel('➕ Tạo Sao Lưu Mới')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`adminuser_back_null_${adminId}`)
            .setLabel('🔙 Quay Lại Panel')
            .setStyle(ButtonStyle.Secondary)
        );
        rows.push(buttonsRow);

        await safeV2Update(interaction, [embed], rows );
      }

      else if (subAction === 'restoreselect' && interaction.isStringSelectMenu()) {
        const selectedBackup = interaction.values[0];

        const embed = new EmbedBuilder()
          .setTitle('⚠️ THIÊN ĐẠO HỒI QUY — XÁC NHẬN KHÔI PHỤC')
          .setColor(EMBED_COLORS.ERROR)
          .setDescription(
            `Đạo hữu đang yêu cầu khôi phục toàn bộ tam giới về phiên bản sao lưu:\n\n` +
            `📂 **Tên tệp:** \`${selectedBackup}\`\n\n` +
            `⚠️ **LƯU Ý QUAN TRỌNG:**\n` +
            `- Tiến trình, giao dịch và dữ liệu phát sinh **sau thời điểm trên** sẽ bị xoá bỏ hoàn toàn.\n` +
            `- Bot sẽ tự động đóng kết nối cơ sở dữ liệu hiện tại, ghi đè tệp sao lưu và khởi động lại tiến trình ngay lập tức.\n` +
            `- Vui lòng chỉ thực hiện khi phát hiện lỗi nghiêm trọng.`
          )
          .setFooter({ text: 'Cân nhắc kỹ trước khi xác nhận!' })
          .setTimestamp();

        const confirmButton = new ButtonBuilder()
          .setCustomId(`adminpanel_confirmrestore_${selectedBackup}_${adminId}`)
          .setLabel('✔️ Xác Nhận Rollback')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId(`adminpanel_backupmgr_${adminId}`)
          .setLabel('❌ Hủy Bỏ')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

        await safeV2Update(interaction, [embed], [row] );
      }

      else if (subAction === 'confirmrestore') {
        const backupFilename = parts.slice(2, -1).join('_');

        await safeV2Update(interaction, [], []);

        const { backupService } = require('../../services/BackupService');
        await backupService.rollbackToBackup(backupFilename, adminId);
      }

      else if (subAction === 'testmax') {
        // Give admin max everything for testing
        const adminUser = userRepository.get(adminId);
        if (!adminUser) {
          await interaction.editReply({ content: '❌ Admin chưa tạo nhân vật!' });
          return;
        }

        userRepository.update(adminId, {
          level: 380,
          tu_vi: 0,
          exp_needed: 100,
          coin_ha_pham: 999999999,
          coin_trung_pham: 999999,
          coin_thuong_pham: 99999,
          knb: 99999,
          ngotinh: 9999,
          stamina: 99999,
          luan_hoi_count: 5,
          pvp_points: 9999,
          pvp_wins: 999
        });

        // Give max equipment (EX grade +15 5-star)
        const { ITEMS } = require('../../config/itemConstants');
        const maxItems = [
          { id: ITEMS.WEAPON_EX, name: 'EX Weapon' },
          { id: ITEMS.ARMOR_EX, name: 'EX Armor' }
        ];
        for (const item of maxItems) {
          if (item.id) {
            try {
              inventoryRepository.addItem(adminId, item.id, 1);
              const inv = db.prepare("SELECT id FROM inventories WHERE user_id = ? AND item_id = ? ORDER BY id DESC LIMIT 1").get(adminId, item.id) as any;
              if (inv) {
                db.prepare("UPDATE inventories SET enhance_level = 15, stars = 5, durability = 100, max_durability = 100 WHERE id = ?").run(inv.id);
              }
            } catch (e) {
              console.error(`[testmax] Failed to add ${item.name} (${item.id}):`, e);
            }
          }
        }

        // Give common consumables
        const consumables = [
          { id: ITEMS.PILL_HP_2, qty: 999 },
          { id: ITEMS.PILL_STAMINA_3, qty: 999 },
          { id: ITEMS.PILL_BREAK_1, qty: 999 },
          { id: ITEMS.LUCKY_CHEST, qty: 999 },
          { id: ITEMS.SERVER_RAID_CHEST, qty: 999 },
          { id: ITEMS.TINH_THACH_SHARD, qty: 999 }
        ];
        for (const c of consumables) {
          try {
            inventoryRepository.addItem(adminId, c.id, c.qty);
          } catch (e) {
            console.error(`[testmax] Failed to add ${c.id}:`, e);
          }
        }

        systemConfigService.writeAuditLog(adminId, 'admin_testmax', { targetUserId: adminId });

        await interaction.editReply({
          content: `🧪 **Test Max hoàn tất!**\n` +
            `• Level: 380 (Đăng Tiên)\n` +
            `• KNB: 99,999 | LT: 999,999,999\n` +
            `• Ngộ Tính: 9,999\n` +
            `• Equipment: EX +15 5-star\n` +
            `• Luân Hồi: 5 lần\n` +
            `• Tiêu hao: 999x mỗi loại`
        });
        return;
      }
    }
    
    else if (action === 'adminfixpets') {
      if (subAction === 'skill') {
        const overSkilledPets = db.prepare(
          "SELECT * FROM pets WHERE json_array_length(skills) > 2"
        ).all() as any[];

        let fixedCount = 0;
        for (const pet of overSkilledPets) {
          try {
            const skills: string[] = JSON.parse(pet.skills || '[]');
            if (skills.length > 2) {
              db.prepare('UPDATE pets SET skills = ? WHERE id = ?').run(JSON.stringify(skills.slice(0, 2)), pet.id);
              fixedCount++;
            }
          } catch {
            db.prepare("UPDATE pets SET skills = '[]' WHERE id = ?").run(pet.id);
            fixedCount++;
          }
        }

        await safeV2Update(interaction, [], []);
      }

      else if (subAction === 'delete') {
        const brokenPets = db.prepare(
          "SELECT * FROM pets WHERE name IS NULL OR name = '' OR rarity NOT IN ('common','uncommon','rare','epic','legendary') OR level < 0"
        ).all() as any[];

        const orphanPets = db.prepare(`
          SELECT p.id FROM pets p
          LEFT JOIN users u ON p.user_id = u.discord_id
          WHERE u.discord_id IS NULL
        `).all() as any[];

        let deletedCount = 0;
        for (const pet of brokenPets) {
          db.prepare('DELETE FROM pets WHERE id = ?').run(pet.id);
          deletedCount++;
        }
        for (const orphan of orphanPets) {
          db.prepare('DELETE FROM pets WHERE id = ?').run(orphan.id);
          deletedCount++;
        }

        await safeV2Update(interaction, [], []);
      }

      else if (subAction === 'cancel') {
        await safeV2Update(interaction, [], []);
      }
    }

    // ─── XỬ LÝ BUTTON CHECK ORPHAN ITEMS ──────────────────────
    else if (action === 'admincheckorphan') {
      if (subAction === 'delete') {
        // Xoá item không tồn tại trong bảng items
        const orphanItems = db.prepare(`
          SELECT i.id FROM inventories i
          LEFT JOIN items t ON i.item_id = t.id
          WHERE t.id IS NULL
        `).all() as { id: number }[];

        // Xoá inventory của user không tồn tại
        const orphanByUser = db.prepare(`
          SELECT i.id FROM inventories i
          LEFT JOIN users u ON i.user_id = u.discord_id
          WHERE u.discord_id IS NULL
        `).all() as { id: number }[];

        // Xoá quantity bất thường
        const invalidQty = db.prepare(`
          SELECT i.id FROM inventories i
          WHERE i.quantity <= 0 OR i.quantity IS NULL
        `).all() as { id: number }[];

        let deletedCount = 0;
        for (const item of orphanItems) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
          deletedCount++;
        }
        for (const item of orphanByUser) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
          deletedCount++;
        }
        for (const item of invalidQty) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
          deletedCount++;
        }

        systemConfigService.writeAuditLog(adminId, 'admin_checkorphan_delete', {
          orphanItems: orphanItems.length,
          orphanByUser: orphanByUser.length,
          invalidQty: invalidQty.length,
          total: deletedCount
        });

        await safeV2Update(interaction, [], []);
      }

      else if (subAction === 'cancel') {
        await safeV2Update(interaction, [], []);
      }
    }
    
    else if (action === 'adminuser') {
      const targetUserId = parts[2];
      
      if (subAction === 'back') {
        const embed = await AdminCommand.getPanelEmbed(client);
        const components = AdminCommand.getPanelComponents(adminId);
        await safeV2Update(interaction, [embed], components);
      }
      
      else if (subAction === 'givecoin') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_givecoin_${targetUserId}`)
          .setTitle('Ban Phát Linh Thạch');

        const amountInput = new TextInputBuilder()
          .setCustomId('coin_amount')
          .setLabel('Số lượng Linh Thạch (Hạ Phẩm)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: 10000 hoặc -5000 để trừ')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput));
        await interaction.showModal(modal);
      }
      
      else if (subAction === 'giveitem') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_giveitem_${targetUserId}`)
          .setTitle('Ban Phát Vật Phẩm');

        const itemIdInput = new TextInputBuilder()
          .setCustomId('item_id')
          .setLabel('ID vật phẩm')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: pill_tu_vi_low')
          .setRequired(true);

        const qtyInput = new TextInputBuilder()
          .setCustomId('item_qty')
          .setLabel('Số lượng')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Nhập số nguyên dương (Ví dụ: 5)')
          .setValue('1')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(itemIdInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
        );
        await interaction.showModal(modal);
      }
      
      else if (subAction === 'setlevel') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_setlevel_${targetUserId}`)
          .setTitle('Thay Đổi Cảnh Giới');

        const lvlInput = new TextInputBuilder()
          .setCustomId('user_level')
          .setLabel('Cấp độ thiết lập mới (1-380)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Nhập cấp độ từ 1 tới 380')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(lvlInput));
        await interaction.showModal(modal);
      }
      
      else if (subAction === 'editlinhcan') {
        const targetProfile = userRepository.get(targetUserId);
        const currentLinhCan = targetProfile ? targetProfile.linh_can : '{}';

        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_editlinhcan_${targetUserId}`)
          .setTitle('Sửa Đổi Linh Căn');

        const lcInput = new TextInputBuilder()
          .setCustomId('linh_can_json')
          .setLabel('Cấu hình Linh Căn (định dạng JSON)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentLinhCan)
          .setPlaceholder('Ví dụ: {"Kim":20,"Mộc":20,"Thủy":20,"Hỏa":20,"Thổ":20}')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(lcInput));
        await interaction.showModal(modal);
      }

      else if (subAction === 'stamina') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_stamina_${targetUserId}`)
          .setTitle('Sửa Thể Lực Tu Sĩ');

        const amountInput = new TextInputBuilder()
          .setCustomId('stamina_amount')
          .setLabel('Số lượng thể lực')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: 100 hoặc -50 để trừ')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput));
        await interaction.showModal(modal);
      }

      else if (subAction === 'ban') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_ban_${targetUserId}`)
          .setTitle('Phong Ấn Linh Hồn (Ban)');

        const reasonInput = new TextInputBuilder()
          .setCustomId('ban_reason')
          .setLabel('Lý do phong ấn')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nhập lý do phong ấn tu sĩ...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
        await interaction.showModal(modal);
      }

      else if (subAction === 'unban') {
        db.prepare('DELETE FROM banned_users WHERE user_id = ?').run(targetUserId);

        systemConfigService.writeAuditLog(adminId, 'admin_unban_panel', {
          targetUserId
        });

        const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
        const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
        await safeV2Update(interaction, [userEmbed], userComponents);
      }
      
      else if (subAction === 'giveknb') {
        const modal = new ModalBuilder()
          .setCustomId(`adminmodal_${adminId}_giveknb_${targetUserId}`)
          .setTitle('Ban Phát KNB');

        const amountInput = new TextInputBuilder()
          .setCustomId('knb_amount')
          .setLabel('Số lượng KNB')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: 500 hoặc -100 để trừ')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput));
        await interaction.showModal(modal);
      }

      else if (subAction === 'heal') {
        const targetProfile = userRepository.get(targetUserId);
        if (!targetProfile) {
          await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
          return;
        }

        userRepository.update(targetUserId, { injury_end_time: 0 });
        systemConfigService.writeAuditLog(adminId, 'admin_heal_panel', {
          targetUserId,
          targetName: targetProfile.name
        });

        const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
        const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
        await safeV2Update(interaction, [userEmbed], userComponents);
      }

      else if (subAction === 'resetweekly') {
        const targetProfile = userRepository.get(targetUserId);
        if (!targetProfile) {
          await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
          return;
        }

        let resetDone = false;
        try {
          let yCanh = JSON.parse(targetProfile.y_canh || '{}');
          if (yCanh.weekly_purchases) {
            delete yCanh.weekly_purchases;
            db.prepare('UPDATE users SET y_canh = ? WHERE discord_id = ?').run(JSON.stringify(yCanh), targetUserId);
            resetDone = true;
          }
        } catch (e) {
          console.error(e);
        }

        systemConfigService.writeAuditLog(adminId, 'admin_resetweekly_user', {
          targetUserId,
          targetName: targetProfile.name,
          success: resetDone
        });

        const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
        const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
        await safeV2Update(interaction, [userEmbed], userComponents);
      }
    }
  }

  public static async handleModal(
    client: TuTienClient,
    interaction: any,
    parts: string[]
  ): Promise<void> {
    const adminId = interaction.user.id;
    if (adminId !== BOT_OWNER_ID) {
      await interaction.editReply({ content: '❌ Cấm địa Thiên Đạo, đạo hữu không đủ quyền hạn!'});
      return;
    }

    const subAction = parts[2];

    if (subAction === 'spawnboss') {
      const lvlStr = interaction.fields.getTextInputValue('boss_level');
      const level = parseInt(lvlStr, 10);

      if (isNaN(level) || level <= 0) {
        await interaction.editReply({ content: '❌ Cấp độ Boss phải là số nguyên lớn hơn 0!'});
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const newMaxHp = Math.round(5000 * Math.pow(1.3, level - 1));
      const newAtk = Math.round(80 * Math.pow(1.15, level - 1));
      const newDef = Math.round(50 * Math.pow(1.15, level - 1));

      db.prepare(`
        UPDATE world_boss
        SET hp = ?, max_hp = ?, atk = ?, def = ?, level = ?, status = 'active', last_spawned_at = ?, defeated_at = NULL, defeated_by = NULL
        WHERE id = 'world_boss_current'
      `).run(newMaxHp, newMaxHp, newAtk, newDef, level, now);

      db.prepare("DELETE FROM world_boss_contributions").run();

      const updatedBoss = db.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get() as any;
      
      const { BossSpawnService } = require('../../services/BossSpawnService');
      const tempService = new BossSpawnService();
      await tempService.broadcastBossSpawn(client, updatedBoss);

      const panelEmbed = await AdminCommand.getPanelEmbed(client);
      const components = AdminCommand.getPanelComponents(adminId);
      
      await safeV2Update(interaction, [panelEmbed], components);
    }
    
    else if (subAction === 'searchuser') {
      const targetUserId = interaction.fields.getTextInputValue('target_user_id').trim();
      const user = userRepository.get(targetUserId);

      if (!user) {
        await interaction.editReply({ content: `❌ Không tìm thấy tu sĩ có ID \`${targetUserId}\` trong danh sách Tiên Bản.`});
        return;
      }

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
    
    else if (subAction === 'givecoin') {
      const targetUserId = parts[3];
      const amountStr = interaction.fields.getTextInputValue('coin_amount');
      const amount = parseInt(amountStr, 10);

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      if (isNaN(amount)) {
        await interaction.editReply({ content: '❌ Số lượng Linh Thạch không hợp lệ.'});
        return;
      }

      userRepository.update(targetUserId, {
        coin_ha_pham: Math.max(0, targetProfile.coin_ha_pham + amount)
      });

      systemConfigService.writeAuditLog(adminId, 'admin_givecoin_panel', {
        targetUserId,
        targetName: targetProfile.name,
        amount
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
    
    else if (subAction === 'giveknb') {
      const targetUserId = parts[3];
      const amountStr = interaction.fields.getTextInputValue('knb_amount');
      const amount = parseInt(amountStr, 10);

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      if (isNaN(amount)) {
        await interaction.editReply({ content: '❌ Số lượng KNB không hợp lệ.'});
        return;
      }

      userRepository.update(targetUserId, {
        knb: Math.max(0, (targetProfile.knb || 0) + amount)
      });

      systemConfigService.writeAuditLog(adminId, 'admin_giveknb_panel', {
        targetUserId,
        targetName: targetProfile.name,
        amount
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
    
    else if (subAction === 'giveitem') {
      const targetUserId = parts[3];
      const itemId = interaction.fields.getTextInputValue('item_id').trim();
      const qtyStr = interaction.fields.getTextInputValue('item_qty');
      const qty = parseInt(qtyStr, 10);

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      const itemCheck = db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string } | undefined;
      if (!itemCheck) {
        await interaction.editReply({ content: `❌ Vật phẩm ID \`${itemId}\` không tồn tại.`});
        return;
      }

      if (isNaN(qty) || qty <= 0) {
        await interaction.editReply({ content: '❌ Số lượng vật phẩm phải lớn hơn 0.'});
        return;
      }

      inventoryRepository.addItem(targetUserId, itemId, qty);

      systemConfigService.writeAuditLog(adminId, 'admin_giveitem_panel', {
        targetUserId,
        targetName: targetProfile.name,
        itemId,
        itemName: itemCheck.name,
        quantity: qty
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
    
    else if (subAction === 'setlevel') {
      const targetUserId = parts[3];
      const lvlStr = interaction.fields.getTextInputValue('user_level');
      const targetLevel = parseInt(lvlStr, 10);

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > 380) {
        await interaction.editReply({ content: '❌ Cấp độ phải nằm trong khoảng từ 1 tới 380.'});
        return;
      }

      const newStats = cultivationService.calculateStatsForLevel(targetLevel, targetProfile.linh_can);
      const nextExpNeeded = cultivationService.calculateNextExp(targetLevel);

      userRepository.update(targetUserId, {
        level: targetLevel,
        tu_vi: 0,
        exp_needed: nextExpNeeded,
        base_hp: newStats.hp,
        base_mp: newStats.mp,
        base_atk: newStats.atk,
        base_def: newStats.def,
        base_crit: newStats.crit,
        base_crit_res: newStats.critRes,
        base_luck: targetProfile.base_luck,
        base_speed: newStats.speed
      });

      systemConfigService.writeAuditLog(adminId, 'admin_setlevel_panel', {
        targetUserId,
        targetName: targetProfile.name,
        oldLevel: targetProfile.level,
        newLevel: targetLevel
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
    
    else if (subAction === 'editlinhcan') {
      const targetUserId = parts[3];
      const lcJsonStr = interaction.fields.getTextInputValue('linh_can_json');

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      try {
        JSON.parse(lcJsonStr);
      } catch (e) {
        await interaction.editReply({ content: '❌ Chuỗi Linh Căn không hợp lệ (không đúng định dạng JSON).'});
        return;
      }

      userRepository.update(targetUserId, {
        linh_can: lcJsonStr
      });

      systemConfigService.writeAuditLog(adminId, 'admin_editlinhcan_panel', {
        targetUserId,
        targetName: targetProfile.name,
        linhCan: lcJsonStr
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }

    else if (subAction === 'broadcast') {
      const title = interaction.fields.getTextInputValue('bc_title');
      const message = interaction.fields.getTextInputValue('bc_msg').replace(/\\n/g, '\n');
      const colorInput = interaction.fields.getTextInputValue('bc_color');
      const imageUrl = interaction.fields.getTextInputValue('bc_image');

      const color = (colorInput && /^#[0-9A-F]{6}$/i.test(colorInput)) ? colorInput : '#f1c40f';



      const guilds = db.prepare('SELECT * FROM guild_configs').all() as any[];
      let successCount = 0;
      let failCount = 0;
      const sentChannels = new Set<string>();

      // Gửi tại chỗ dùng panel đầu tiên
      const currentChannelId = interaction.channelId;
      if (currentChannelId && /^\d{17,20}$/.test(currentChannelId)) {
        try {
          const channel = await client.channels.fetch(currentChannelId) as any;
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(message)
              .setColor(color as any)
              .setFooter({ text: '📢 THIÊN ĐẠO TRUYỀN ÂM (Hệ Thống Thông Báo)' })
              .setTimestamp();
            if (imageUrl) embed.setImage(imageUrl);

            await channel.send({ embeds: [embed] });
            successCount++;
            sentChannels.add(currentChannelId);
          }
        } catch (err) {
          console.error(`Broadcast failed for current channel ${currentChannelId}:`, err);
        }
      }

      for (const config of guilds) {
        const channelId = config.chat_channel_id || config.event_channel_id || config.tuluyen_channel_id;
        if (!channelId || sentChannels.has(channelId)) continue;
        if (!/^\d{17,20}$/.test(channelId)) {
          console.warn(`Skipping invalid snowflake channelId: ${channelId}`);
          continue;
        }

        try {
          const channel = await client.channels.fetch(channelId) as any;
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(message)
              .setColor(color as any)
              .setFooter({ text: '📢 THIÊN ĐẠO TRUYỀN ÂM (Hệ Thống Thông Báo)' })
              .setTimestamp();
            if (imageUrl) embed.setImage(imageUrl);

            await channel.send({ embeds: [embed] });
            successCount++;
            sentChannels.add(channelId);
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Broadcast failed for channel ${channelId}:`, err);
          failCount++;
        }
      }

      systemConfigService.writeAuditLog(adminId, 'admin_broadcast_panel', {
        title,
        message,
        guildCount: guilds.length,
        successCount,
        failCount
      });

      await interaction.followUp({
        content: `📢 **Thiên Đạo Truyền Âm Hoàn Tất:**\n✅ Gửi thành công: **${successCount}** kênh.\n❌ Thất bại/Bỏ qua: **${failCount}** kênh.`
      });
    }

    else if (subAction === 'stamina') {
      const targetUserId = parts[3];
      const amountStr = interaction.fields.getTextInputValue('stamina_amount');
      const amount = parseInt(amountStr, 10);

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      if (isNaN(amount)) {
        await interaction.editReply({ content: '❌ Lượng thể lực không hợp lệ.'});
        return;
      }

      const currentStamina = targetProfile.stamina;
      const newStamina = Math.min(500, Math.max(0, currentStamina + amount));

      userRepository.update(targetUserId, {
        stamina: newStamina
      });

      systemConfigService.writeAuditLog(adminId, 'admin_stamina_panel', {
        targetUserId,
        targetName: targetProfile.name,
        amount,
        oldStamina: currentStamina,
        newStamina
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }

    else if (subAction === 'ban') {
      const targetUserId = parts[3];
      const reason = interaction.fields.getTextInputValue('ban_reason');

      const targetProfile = userRepository.get(targetUserId);
      if (!targetProfile) {
        await interaction.editReply({ content: '❌ Tu sĩ không tồn tại.'});
        return;
      }

      db.prepare(`
        INSERT INTO banned_users (user_id, reason, banned_by, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = excluded.created_at
      `).run(targetUserId, reason, adminId, Math.floor(Date.now() / 1000));

      systemConfigService.writeAuditLog(adminId, 'admin_ban_panel', {
        targetUserId,
        targetName: targetProfile.name,
        reason
      });

      const userEmbed = AdminCommand.getUserPanelEmbed(targetUserId);
      const userComponents = AdminCommand.getUserPanelComponents(targetUserId, adminId);
      await safeV2Update(interaction, [userEmbed], userComponents);
    }
  }

  public async autocomplete(client: TuTienClient, interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'item_id') {
      const query = focusedOption.value;
      const items = db.prepare('SELECT id, name FROM items WHERE name LIKE ? OR id LIKE ? LIMIT 25')
        .all(`%${query}%`, `%${query}%`) as any[];
      
      await interaction.respond(
        items.map(item => ({
          name: `${item.name} (${item.id})`,
          value: item.id
        }))
      );
    }
  }
}
