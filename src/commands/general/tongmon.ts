import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import db from '../../database/database';
import { sectService } from '../../services/SectService';
import { guildWarService } from '../../services/GuildWarService';

interface SectEntity {
  id: number;
  name: string;
  master_id: string;
  level: number;
  exp: number;
  resources: number;
  description: string;
  buildings: string; // JSON: { "loren": level, "linhdien": level, "tangkinhcac": level }
}

const BUILDINGS_INFO = {
  loren: { name: 'Lò Rèn Bang', desc: 'Tăng 2% tỷ lệ rèn đồ thành công mỗi cấp', cost: 5000 },
  linhdien: { name: 'Linh Điền', desc: 'Tăng 5% sản lượng hái thuốc mỗi cấp', cost: 5000 },
  tangkinhcac: { name: 'Tàng Kinh Các', desc: 'Tăng 2% Tu Vi nhận được từ mọi nguồn mỗi cấp', cost: 10000 }
};

export default class TongMonCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('tongmon')
        .setDescription('Hệ thống Tông Môn (Bang hội)')
        .addSubcommand(sub =>
          sub.setName('taolap').setDescription('Tạo Tông Môn mới (Phí: 50,000 Linh Thạch)')
            .addStringOption(opt => opt.setName('ten').setDescription('Tên Tông Môn').setRequired(true))
            .addStringOption(opt => opt.setName('mota').setDescription('Mô tả ngắn gọn').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('thongtin').setDescription('Xem thông tin Tông Môn hiện tại (hoặc của một Tông Môn khác)')
            .addStringOption(opt => opt.setName('ten').setDescription('Tên Tông Môn (bỏ trống để xem tông môn của mình)'))
        )
        .addSubcommand(sub =>
          sub.setName('gia_nhap').setDescription('Xin gia nhập một Tông Môn')
            .addStringOption(opt => opt.setName('ten').setDescription('Tên Tông Môn cần xin gia nhập').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('roi').setDescription('Rời khỏi Tông Môn hiện tại')
        )
        .addSubcommand(sub =>
          sub.setName('conghien').setDescription('Quyên góp Linh Thạch vào Quỹ Tông Môn để lấy Cống Hiến')
            .addIntegerOption(opt => opt.setName('sotien').setDescription('Số Linh Thạch muốn quyên góp').setRequired(true).setMinValue(100))
        )
        .addSubcommand(sub =>
          sub.setName('xaydung').setDescription('Nâng cấp Lãnh Địa (Chỉ dành cho Tông Chủ)')
            .addStringOption(opt => 
              opt.setName('congtrinh')
                 .setDescription('Công trình muốn nâng cấp')
                 .setRequired(true)
                 .addChoices(
                   { name: 'Lò Rèn Bang', value: 'loren' },
                   { name: 'Linh Điền', value: 'linhdien' },
                   { name: 'Tàng Kinh Các', value: 'tangkinhcac' }
                 )
            )
        )
        .addSubcommand(sub =>
          sub.setName('thongke').setDescription('Thống kê đóng góp và xếp hạng trong Tông Môn')
        )
        .addSubcommandGroup(group =>
          group.setName('tthi').setDescription('Giải đấu nội bộ Tông Môn')
            .addSubcommand(sub =>
              sub.setName('batdau').setDescription('[Tông Chủ] Mở giải đấu nội bộ')
            )
            .addSubcommand(sub =>
              sub.setName('thamgia').setDescription('Đăng ký tham gia giải đấu nội bộ')
            )
            .addSubcommand(sub =>
              sub.setName('ketthuc').setDescription('[Tông Chủ] Kết thúc giải đấu và nhận thưởng')
            )
            .addSubcommand(sub =>
              sub.setName('thongtin').setDescription('Xem thông tin giải đấu nội bộ')
            )
            .addSubcommand(sub =>
              sub.setName('rut').setDescription('Rút khỏi giải đấu nội bộ')
            )
        )
        .addSubcommandGroup(group =>
          group.setName('lienminh').setDescription('Liên minh Tông Môn')
            .addSubcommand(sub =>
              sub.setName('moi').setDescription('Gửi lời mời liên minh đến một Tông Môn')
                .addStringOption(opt => opt.setName('ten').setDescription('Tên Tông Môn muốn kết minh').setRequired(true))
            )
            .addSubcommand(sub =>
              sub.setName('chapnhan').setDescription('Chấp nhận lời mời liên minh')
            )
            .addSubcommand(sub =>
              sub.setName('huy').setDescription('Phá vỡ liên minh hiện tại')
            )
            .addSubcommand(sub =>
              sub.setName('thongtin').setDescription('Xem thông tin liên minh của Tông Môn')
            )
            .addSubcommand(sub =>
              sub.setName('tuyen-chien').setDescription('Tuyên chiến với liên minh khác')
                .addStringOption(opt => opt.setName('ten').setDescription('Tên Tông Môn trong liên minh muốn tấn công').setRequired(true))
            )
            .addSubcommand(sub =>
              sub.setName('phophu').setDescription('[Tông Chủ] Chỉ định Phó Tông Chủ')
                .addUserOption(opt => opt.setName('thanhvien').setDescription('Thành viên muốn chỉ định làm Phó Tông Chủ').setRequired(true))
            )
            .addSubcommand(sub =>
              sub.setName('truyenngoi').setDescription('[Tông Chủ] Truyền ngôi Tông Chủ cho thành viên khác')
                .addUserOption(opt => opt.setName('thanhvien').setDescription('Thành viên muốn truyền ngôi').setRequired(true))
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

    if (sub === 'taolap') {
      const name = interaction.options.getString('ten', true);
      const desc = interaction.options.getString('mota', true);

      if (user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu đã ở trong một Tông Môn, phải rời đi mới được tạo mới!', ephemeral: true });
        return;
      }
      if (user.coin_ha_pham < 50000) {
        await interaction.reply({ content: '❌ Đạo hữu không đủ 50,000 Linh Thạch để lập Tông Môn!', ephemeral: true });
        return;
      }

      const existing = db.prepare('SELECT id FROM sects WHERE name = ?').get(name);
      if (existing) {
        await interaction.reply({ content: '❌ Tên Tông Môn này đã có người đăng ký!', ephemeral: true });
        return;
      }

      db.transaction(() => {
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 50000 });
        const now = Math.floor(Date.now() / 1000);
        const buildings = { loren: 0, linhdien: 0, tangkinhcac: 0 };
        const result = db.prepare('INSERT INTO sects (name, master_id, description, buildings, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(name, userId, desc, JSON.stringify(buildings), now);
        
        userRepository.update(userId, { sect_id: result.lastInsertRowid as number, sect_role: 'master', sect_contribution: 0 });
      })();

      await interaction.reply({ content: `✅ **LẬP TÔNG THÀNH CÔNG!**\nĐạo hữu đã sáng lập **${name}**, trở thành Tông Chủ đời thứ nhất! Phí thủ tục 50,000 LT đã được thanh toán.` });
      return;
    }

    if (sub === 'gia_nhap') {
      const name = interaction.options.getString('ten', true);

      if (user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu đang có Tông Môn, không thể gia nhập nơi khác!', ephemeral: true });
        return;
      }

      const sect = db.prepare('SELECT id FROM sects WHERE name = ?').get(name) as { id: number } | undefined;
      if (!sect) {
        await interaction.reply({ content: '❌ Không tìm thấy Tông Môn này trên giang hồ!', ephemeral: true });
        return;
      }

      // Hiện tại cho gia nhập tự do (không cần duyệt)
      userRepository.update(userId, { sect_id: sect.id, sect_role: 'member', sect_contribution: 0 });
      await interaction.reply({ content: `✅ Đạo hữu đã gia nhập **${name}**! Hãy đóng góp xây dựng Tông Môn nhé.` });
      return;
    }

    if (sub === 'roi') {
      if (!user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu đang là tán tu, có Tông Môn đâu mà rời?', ephemeral: true });
        return;
      }

      if (user.sect_role === 'master') {
        await interaction.reply({ content: '❌ Tông Chủ không thể rời Tông Môn! Hãy dùng `/tongmon truyenngoi` để truyền ngôi trước.', ephemeral: true });
        return;
      }

      userRepository.update(userId, { sect_id: null, sect_role: 'member', sect_contribution: 0 });
      await interaction.reply({ content: `👋 Đạo hữu đã rời khỏi Tông Môn, bôn tẩu giang hồ làm một tán tu tự do.` });
      return;
    }

    if (sub === 'phophu') {
      if (!user.sect_id || user.sect_role !== 'master') {
        await interaction.reply({ content: '❌ Chỉ Tông Chủ mới có thể chỉ định Phó Tông Chủ!', ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('thanhvien', true);
      const result = sectService.assignDeputy(userId, target.id);
      await interaction.reply({ content: result.message, ephemeral: !result.success });
      return;
    }

    if (sub === 'truyenngoi') {
      if (!user.sect_id || user.sect_role !== 'master') {
        await interaction.reply({ content: '❌ Chỉ Tông Chủ mới có thể truyền ngôi!', ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('thanhvien', true);
      const result = sectService.transferLeadership(userId, target.id);
      await interaction.reply({ content: result.message, ephemeral: !result.success });
      return;
    }

    if (sub === 'thongtin') {
      let targetName = interaction.options.getString('ten');
      let sect: SectEntity | undefined;

      if (targetName) {
        sect = db.prepare('SELECT * FROM sects WHERE name = ?').get(targetName) as SectEntity | undefined;
      } else if (user.sect_id) {
        sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as SectEntity | undefined;
      }

      if (!sect) {
        await interaction.reply({ content: '❌ Không tìm thấy thông tin Tông Môn!', ephemeral: true });
        return;
      }

      const master = db.prepare('SELECT name FROM users WHERE discord_id = ?').get(sect.master_id) as { name: string };
      const memberCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE sect_id = ?').get(sect.id) as { c: number };
      
      let buildings = { loren: 0, linhdien: 0, tangkinhcac: 0 };
      try { buildings = JSON.parse(sect.buildings || '{}'); } catch(e){}

      const embed = new EmbedBuilder()
        .setTitle(`🏰 TÔNG MÔN: ${sect.name} (Cấp ${sect.level})`)
        .setColor('#e67e22')
        .setDescription(`📜 **Tôn Chỉ:** *${sect.description}*\n👑 **Tông Chủ:** ${master?.name || 'Vô Danh'}\n👥 **Thành Viên:** ${memberCount.c} người\n💰 **Quỹ Tông Môn:** ${sect.resources} Điểm`)
        .addFields({
          name: '🏗️ Lãnh Địa Tông Môn',
          value: `🔥 **Lò Rèn Bang** (Cấp ${buildings.loren || 0}): *${BUILDINGS_INFO.loren.desc}*\n` +
                 `🌿 **Linh Điền** (Cấp ${buildings.linhdien || 0}): *${BUILDINGS_INFO.linhdien.desc}*\n` +
                 `📚 **Tàng Kinh Các** (Cấp ${buildings.tangkinhcac || 0}): *${BUILDINGS_INFO.tangkinhcac.desc}*`
        });
      
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'conghien') {
      if (!user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu chưa gia nhập Tông Môn!', ephemeral: true });
        return;
      }

      const amount = interaction.options.getInteger('sotien', true);
      if (user.coin_ha_pham < amount) {
        await interaction.reply({ content: '❌ Đạo hữu không có đủ Linh Thạch để quyên góp!', ephemeral: true });
        return;
      }

      // 10 LT = 1 điểm cống hiến & 1 điểm Quỹ Tông Môn
      const points = Math.floor(amount / 10);
      if (points < 1) {
        await interaction.reply({ content: '❌ Số tiền quá ít, quy đổi không được 1 điểm cống hiến (10 LT = 1 điểm)!', ephemeral: true });
        return;
      }

      db.transaction(() => {
        userRepository.update(userId, { 
          coin_ha_pham: user.coin_ha_pham - amount,
          sect_contribution: (user.sect_contribution || 0) + points 
        });
        db.prepare('UPDATE sects SET resources = resources + ? WHERE id = ?').run(points, user.sect_id);
      })();

      await interaction.reply({ content: `💰 Đạo hữu đã quyên góp **${amount} LT** vào quỹ Tông Môn.\nNhận lại **+${points}** Điểm Cống Hiến cá nhân và Quỹ Tông Môn tăng **+${points}** điểm!` });
      return;
    }

    if (sub === 'xaydung') {
      if (!user.sect_id || user.sect_role !== 'master') {
        await interaction.reply({ content: '❌ Chỉ có Tông Chủ mới có quyền xây dựng Lãnh Địa!', ephemeral: true });
        return;
      }

      const building = interaction.options.getString('congtrinh', true) as 'loren' | 'linhdien' | 'tangkinhcac';
      const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as SectEntity;

      let buildings = { loren: 0, linhdien: 0, tangkinhcac: 0 };
      try { buildings = JSON.parse(sect.buildings || '{}'); } catch(e){}

      const bLevel = buildings[building] || 0;
      const info = BUILDINGS_INFO[building];
      const cost = info.cost * (bLevel + 1); // Cấp càng cao càng đắt

      if (sect.resources < cost) {
        await interaction.reply({ content: `❌ Tông môn không đủ Quỹ Điểm để nâng cấp **${info.name}** lên Cấp ${bLevel + 1}!\n*Cần: **${cost}** điểm, Hiện có: **${sect.resources}** điểm.*`, ephemeral: true });
        return;
      }

      buildings[building] = bLevel + 1;

      db.transaction(() => {
        db.prepare('UPDATE sects SET resources = resources - ?, buildings = ? WHERE id = ?')
          .run(cost, JSON.stringify(buildings), sect.id);
      })();

      await interaction.reply({ content: `🏗️ **NÂNG CẤP THÀNH CÔNG!**\nTông Chủ tiêu hao **${cost}** Quỹ Tông Môn để nâng cấp **${info.name}** lên Cấp **${bLevel + 1}**!` });
      return;
    }

    if (sub === 'thongke') {
      if (!user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu chưa gia nhập Tông Môn nào!', ephemeral: true });
        return;
      }

      const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as any;
      if (!sect) {
        await interaction.reply({ content: '❌ Không tìm thấy Tông Môn!', ephemeral: true });
        return;
      }

      // Top 3 EXP contribution
      const topExp = db.prepare(`
        SELECT discord_id, name, level, sect_contribution
        FROM users
        WHERE sect_id = ?
        ORDER BY sect_contribution DESC
        LIMIT 3
      `).all(user.sect_id) as any[];

      // Top 3 Linh Thạch
      const topLT = db.prepare(`
        SELECT discord_id, name, level, coin_ha_pham
        FROM users
        WHERE sect_id = ?
        ORDER BY coin_ha_pham DESC
        LIMIT 3
      `).all(user.sect_id) as any[];

      // Top 3 Boss damage
      const topBoss = db.prepare(`
        SELECT u.discord_id, u.name, u.level, COALESCE(SUM(wb.damage), 0) as total_damage
        FROM users u
        LEFT JOIN world_boss_contributions wb ON u.discord_id = wb.user_id
        WHERE u.sect_id = ?
        GROUP BY u.discord_id
        ORDER BY total_damage DESC
        LIMIT 3
      `).all(user.sect_id) as any[];

      // Bar chart data (top 5 by sect_contribution)
      const barData = db.prepare(`
        SELECT name, sect_contribution
        FROM users
        WHERE sect_id = ?
        ORDER BY sect_contribution DESC
        LIMIT 5
      `).all(user.sect_id) as any[];

      const maxVal = barData.length > 0 ? Math.max(...barData.map(b => b.sect_contribution)) : 1;
      const chartLines = barData.map((b, i) =>
        `#${i + 1} **${b.name}**: ${'█'.repeat(Math.max(1, Math.round((b.sect_contribution / maxVal) * 10)))} (${b.sect_contribution})`
      );

      // Weekly bonus: Sunday 23:00-23:59
      const now = new Date();
      const nowUnix = Math.floor(now.getTime() / 1000);
      const vnTime = new Date(now.getTime() + 7 * 3600000);
      const dayOfWeek = vnTime.getUTCDay();
      const hours = vnTime.getUTCHours();
      const isBonusTime = dayOfWeek === 0 && hours === 23;

      let bonusMsg = '';
      if (isBonusTime) {
        const weekStart = nowUnix - (dayOfWeek * 86400 + hours * 3600 + vnTime.getUTCMinutes() * 60 + vnTime.getUTCSeconds());
        if (!sect.last_weekly_bonus_at || sect.last_weekly_bonus_at < weekStart) {
          const top3 = db.prepare(`
            SELECT discord_id, name, sect_contribution
            FROM users
            WHERE sect_id = ?
            ORDER BY sect_contribution DESC
            LIMIT 3
          `).all(user.sect_id) as any[];

          const rewards = [100, 60, 30];
          db.transaction(() => {
            top3.forEach((m, i) => {
              if (i < 3) {
                userRepository.update(m.discord_id, { sect_contribution: m.sect_contribution + rewards[i] });
              }
            });
            db.prepare('UPDATE sects SET last_weekly_bonus_at = ? WHERE id = ?').run(nowUnix, sect.id);
          })();

          bonusMsg = `🎁 **Thưởng Cuối Tuần Tông Môn Điểm:**\n${top3.map((m, i) => `#${i + 1} **${m.name}**: +${rewards[i]} điểm`).join('\n')}`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 THỐNG KÊ TÔNG MÔN: ${sect.name}`)
        .setColor('#f1c40f')
        .addFields(
          { name: '🥇 Top Đóng Góp EXP', value: topExp.map((m, i) => `#${i + 1} **${m.name}** (Cấp ${m.level}): ${m.sect_contribution} điểm`).join('\n') || '*Chưa có dữ liệu*', inline: true },
          { name: '💎 Top Đóng Góp Linh Thạch', value: topLT.map((m, i) => `#${i + 1} **${m.name}** (Cấp ${m.level}): ${m.coin_ha_pham} LT`).join('\n') || '*Chưa có dữ liệu*', inline: true },
          { name: '🐉 Top Săn Boss', value: topBoss.map((m, i) => `#${i + 1} **${m.name}** (Cấp ${m.level}): ${m.total_damage} dmg`).join('\n') || '*Chưa có dữ liệu*', inline: true },
          { name: '📈 Biểu Đồ Đóng Góp (Top 5)', value: chartLines.join('\n') || '*Chưa có dữ liệu*' }
        )
        .setFooter({ text: '📊 Cập nhật theo thời gian thực' });

      if (bonusMsg) {
        embed.setDescription(bonusMsg);
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    if (group === 'tthi') {
      if (!user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu chưa gia nhập Tông Môn nào!', ephemeral: true });
        return;
      }

      if (sub === 'batdau') {
        if (user.sect_role !== 'master') {
          await interaction.reply({ content: '❌ Chỉ có Tông Chủ mới có quyền mở giải đấu!', ephemeral: true });
          return;
        }
        const result = guildWarService.startTournament(user.sect_id, userId);
        await interaction.reply({ content: result.success ? '✅ ' + result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'thamgia') {
        const userName = user.name;
        const result = guildWarService.joinTournament(user.sect_id, userId, userName);
        await interaction.reply({ content: result.success ? '✅ ' + result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'ketthuc') {
        if (user.sect_role !== 'master') {
          await interaction.reply({ content: '❌ Chỉ có Tông Chủ mới có quyền kết thúc giải đấu!', ephemeral: true });
          return;
        }
        const result = guildWarService.endTournament(user.sect_id, userId);
        await interaction.reply({ content: result.success ? result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'thongtin') {
        const info = guildWarService.getTournamentInfo(user.sect_id);
        if (!info) {
          await interaction.reply({ content: '📭 Tông Môn của đạo hữu hiện không có giải đấu nào.', ephemeral: true });
          return;
        }
        const statusText = info.status === 'open' ? '🟢 Đang mở đăng ký' : info.status === 'fighting' ? '⚔️ Đang diễn ra' : '🏁 Đã kết thúc';
        const embed = new EmbedBuilder()
          .setTitle('🏟️ Giải Đấu Nội Bộ')
          .setColor('#9b59b6')
          .setDescription(`**Trạng thái:** ${statusText}\n**Người tham gia (${info.participants.length}):** ${info.participants.join(', ') || 'Chưa có'}`)
          .setFooter({ text: info.winnerName ? `🏆 Quán quân: ${info.winnerName}` : 'Chưa có quán quân' });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'rut') {
        const result = guildWarService.leaveTournament(user.sect_id, userId);
        await interaction.reply({ content: result.success ? '✅ ' + result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }
    }

    if (group === 'lienminh') {
      if (!user.sect_id) {
        await interaction.reply({ content: '❌ Đạo hữu chưa gia nhập Tông Môn nào!', ephemeral: true });
        return;
      }

      if (sub === 'moi') {
        const targetName = interaction.options.getString('ten', true);
        const targetSect = db.prepare('SELECT id, name FROM sects WHERE name = ?').get(targetName) as { id: number; name: string } | undefined;
        if (!targetSect) {
          await interaction.reply({ content: '❌ Không tìm thấy Tông Môn **' + targetName + '** trên giang hồ!', ephemeral: true });
          return;
        }
        const result = sectService.formAlliance(user.sect_id, targetSect.id, userId);
        await interaction.reply({ content: result.success ? '✅ ' + result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'chapnhan') {
        const result = sectService.acceptAlliance(user.sect_id, userId);
        await interaction.reply({ content: result.success ? '✅ ' + result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'huy') {
        const result = sectService.breakAlliance(user.sect_id, userId);
        await interaction.reply({ content: result.success ? result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }

      if (sub === 'thongtin') {
        const data = sectService.getAlliance(user.sect_id);
        if (!data) {
          await interaction.reply({ content: '❌ Tông Môn của đạo hữu hiện không có liên minh nào!', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🤝 Liên Minh Tông Môn')
          .setColor('#3498db')
          .setDescription(`**${data.partnerSect.name}**`)
          .addFields(
            { name: '👑 Tông Chủ', value: data.partnerSect.master_name, inline: true },
            { name: '📊 Cấp Độ', value: `${data.partnerSect.level}`, inline: true },
            { name: '👥 Thành Viên', value: `${data.partnerSect.member_count}`, inline: true },
            { name: '📅 Kết Minh Từ', value: `<t:${data.alliance.formed_at}:R>` }
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'tuyen-chien') {
        const targetName = interaction.options.getString('ten', true);
        const targetSect = db.prepare('SELECT id, name FROM sects WHERE name = ?').get(targetName) as { id: number; name: string } | undefined;
        if (!targetSect) {
          await interaction.reply({ content: '❌ Không tìm thấy Tông Môn **' + targetName + '** trên giang hồ!', ephemeral: true });
          return;
        }
        const result = sectService.declareWar(userId, user.sect_id, targetSect.id);
        await interaction.reply({ content: result.success ? result.message : '❌ ' + result.message, ephemeral: !result.success });
        return;
      }
    }
  }
}
