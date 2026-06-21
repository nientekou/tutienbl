import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import db from '../../database/database';

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
        await interaction.reply({ content: '❌ Tông Chủ không thể rời Tông Môn! (Tính năng truyền ngôi đang phát triển, tạm thời không thể rời)', ephemeral: true });
        return;
      }

      userRepository.update(userId, { sect_id: null, sect_role: 'member', sect_contribution: 0 });
      await interaction.reply({ content: `👋 Đạo hữu đã rời khỏi Tông Môn, bôn tẩu giang hồ làm một tán tu tự do.` });
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
  }
}
