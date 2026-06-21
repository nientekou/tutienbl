import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { mentorshipService } from '../../services/MentorshipService';
import db from '../../database/database';

export default class SudoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sudo')
        .setDescription('Hệ thống Sư Đồ - Bái sư học đạo, cống hiến tu vi.')
        .addSubcommand(sub =>
          sub.setName('nhan-detu')
            .setDescription('Gửi lời mời bái sư hoặc thu nhận đệ tử')
            .addUserOption(opt => opt.setName('tu_si').setDescription('Đạo hữu muốn kết mối quan hệ').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('danhsach')
            .setDescription('Xem thông tin Sư Phụ và Đệ Tử của bạn')
        )
        .addSubcommand(sub =>
          sub.setName('tu-bo')
            .setDescription('Hủy bỏ quan hệ sư đồ hiện tại')
            .addUserOption(opt => opt.setName('tu_si').setDescription('Đệ tử muốn trục xuất (chỉ dành cho Sư Phụ)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('huongdan')
            .setDescription('Xem hướng dẫn quy định và lợi ích của Sư Đồ')
        )
        .addSubcommand(sub =>
          sub.setName('truyen-thu')
            .setDescription('Truyền thụ tu vi cho đệ tử (Hao tổn tu vi & 1000 Linh Thạch)')
            .addUserOption(opt => opt.setName('detu').setDescription('Đệ tử muốn truyền thụ').setRequired(true))
            .addIntegerOption(opt => opt.setName('luong').setDescription('Lượng tu vi truyền (100 - 2000 EXP)').setRequired(true).setMinValue(100).setMaxValue(2000))
        )
        .addSubcommand(sub =>
          sub.setName('chi-duong')
            .setDescription('Sư phụ chỉ đường: Tặng bí tịch ngẫu nhiên cho đệ tử (1 lần/ngày)')
            .addUserOption(opt => opt.setName('detu').setDescription('Đệ tử muốn tặng quà').setRequired(true))
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

    // ───────────────── GỬI LỜI MỜI BÁI SƯ / NHẬN ĐỆ TỬ ─────────────────
    if (sub === 'nhan-detu') {
      const targetUser = interaction.options.getUser('tu_si', true);
      if (targetUser.id === userId) {
        await interaction.reply({ content: '❌ Đạo hữu không thể tự bái chính mình làm sư phụ!', ephemeral: true });
        return;
      }
      if (targetUser.bot) {
        await interaction.reply({ content: '❌ Không thể bái Bot làm sư phụ!', ephemeral: true });
        return;
      }

      const targetProfile = userRepository.get(targetUser.id);
      if (!targetProfile) {
        await interaction.reply({ content: '❌ Người này chưa tu tiên!', ephemeral: true });
        return;
      }

      // Xác định ai là mentor, ai là apprentice dựa trên level
      let mentorId = '';
      let apprenticeId = '';

      if (user.level >= 50 && targetProfile.level <= 30) {
        mentorId = userId;
        apprenticeId = targetUser.id;
      } else if (user.level <= 30 && targetProfile.level >= 50) {
        mentorId = targetUser.id;
        apprenticeId = userId;
      } else {
        await interaction.reply({
          content: '❌ Quan hệ sư đồ yêu cầu Sư phụ phải đạt **Cấp 50+** và Đệ tử phải từ **Cấp 1-30**!',
          ephemeral: true
        });
        return;
      }

      const check = mentorshipService.canBecomeMentorAndApprentice(mentorId, apprenticeId);
      if (!check.success) {
        await interaction.reply({ content: `❌ ${check.message}`, ephemeral: true });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('accept_sudo').setLabel('Đồng ý bái sư').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decline_sudo').setLabel('Từ chối').setStyle(ButtonStyle.Danger)
      );

      const inviteType = mentorId === userId ? 'muốn thu nhận bạn làm Đệ tử' : 'muốn bái bạn làm Sư phụ';
      const msg = await interaction.reply({
        content: `👨‍🏫 **Sư Đồ Lệnh:** <@${targetUser.id}>, đạo hữu **${user.name}** ${inviteType}! Bạn có đồng ý kết mối sư đồ này không?`,
        components: [row],
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== targetUser.id) {
          await i.reply({ content: '❌ Bạn không phải là người nhận lời mời!', ephemeral: true });
          return;
        }

        if (i.customId === 'accept_sudo') {
          const res = mentorshipService.createMentorship(mentorId, apprenticeId);
          if (res.success) {
            await i.update({
              content: `🎉 **ĐẠI CÁT ĐẠI LỢI:** Chúc mừng **${user.name}** và **${targetProfile.name}** đã chính thức kết thành Sư Đồ! Thiên đạo chứng giám!`,
              components: []
            });
          } else {
            await i.update({ content: `❌ Có lỗi xảy ra: ${res.message}`, components: [] });
          }
        } else {
          await i.update({ content: `💔 **${targetProfile.name}** đã từ chối lời mời sư đồ của **${user.name}**.`, components: [] });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: `⏳ Quá thời gian phản hồi, lời mời bái sư đã bị hủy.`, components: [] }).catch(() => {});
        }
      });
    }

    // ───────────────── XEM DANH SÁCH SƯ ĐỒ ─────────────────
    else if (sub === 'danhsach') {
      const activeApprentices = mentorshipService.getActiveApprentices(userId);
      const graduatedApprentices = mentorshipService.getGraduatedApprentices(userId);
      const activeAsApprentice = mentorshipService.getActiveMentorshipForApprentice(userId);

      const embed = new EmbedBuilder()
        .setTitle('👨‍🏫 SƯ ĐỒ TIÊN BẢN')
        .setColor('#8e44ad')
        .setTimestamp();

      let isMentor = false;
      let descriptionText = '';

      if (user.level >= 50) {
        isMentor = true;
        const expBonus = mentorshipService.getMentorExpBonusPercent(userId);
        descriptionText = `**Hồ Sơ Sư Phụ:**\n• Cấp EXP Bonus hiện tại: **+${expBonus}%** Tu Vi (Mỗi đệ tử tốt nghiệp +1%, tối đa +5%).\n\n`;

        // Danh sách đệ tử active
        if (activeApprentices.length > 0) {
          let listStr = '';
          activeApprentices.forEach((m, idx) => {
            const apprentice = userRepository.get(m.apprentice_id);
            listStr += `${idx + 1}. **${apprentice ? apprentice.name : 'Vô Danh'}** (<@${m.apprentice_id}>) | Cấp ${apprentice ? apprentice.level : '?'}\n`;
          });
          embed.addFields({ name: '🌱 Đệ Tử Đang Dẫn Dắt (Tối đa 3)', value: listStr });
        } else {
          embed.addFields({ name: '🌱 Đệ Tử Đang Dẫn Dắt (Tối đa 3)', value: '*Đạo hữu hiện chưa thu nhận đệ tử nào.*' });
        }

        // Danh sách đệ tử đã tốt nghiệp
        if (graduatedApprentices.length > 0) {
          let listStr = '';
          graduatedApprentices.forEach((m, idx) => {
            const apprentice = userRepository.get(m.apprentice_id);
            listStr += `• **${apprentice ? apprentice.name : 'Vô Danh'}** (<@${m.apprentice_id}>) | Tốt nghiệp ngày: <t:${m.graduated_at}:d>\n`;
          });
          embed.addFields({ name: '🎓 Đệ Tử Đã Tốt Nghiệp', value: listStr });
        }
      }

      // Nếu là đệ tử đang học đạo
      if (activeAsApprentice) {
        const mentor = userRepository.get(activeAsApprentice.mentor_id);
        embed.addFields({
          name: '👨‍🏫 Sư Phụ Của Bạn',
          value: `**${mentor ? mentor.name : 'Vô Danh'}** (<@${activeAsApprentice.mentor_id}>) | Cảnh Giới: Cấp ${mentor ? mentor.level : '?'}\n*Được tăng +5% EXP bonus khi làm việc dưới sự chỉ giáo.*`
        });
      } else if (!isMentor) {
        descriptionText = '*Đạo hữu hiện độc hành, chưa bái sư cũng như chưa đủ cấp làm sư phụ.*';
      }

      embed.setDescription(descriptionText);
      await interaction.reply({ embeds: [embed] });
    }

    // ───────────────── TỰ BỎ / HỦY QUAN HỆ SƯ ĐỒ ─────────────────
    else if (sub === 'tu-bo') {
      const targetUser = interaction.options.getUser('tu_si');
      const activeAsApprentice = mentorshipService.getActiveMentorshipForApprentice(userId);

      // Nếu người gọi lệnh là đệ tử
      if (activeAsApprentice) {
        const mentorId = activeAsApprentice.mentor_id;
        const mentor = userRepository.get(mentorId);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`break_confirm_apprentice`).setLabel('Xác nhận phản môn').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`break_cancel`).setLabel('Hủy bỏ').setStyle(ButtonStyle.Secondary)
        );

        const msg = await interaction.reply({
          content: `⚠️ **Phản Môn Lệnh:** Đạo hữu có chắc chắn muốn phản môn, hủy bỏ quan hệ sư đồ với Sư phụ **${mentor ? mentor.name : 'Vô Danh'}** không?\n` +
            `*Hình phạt:* Bạn sẽ bị **khấu trừ 10% tu vi hiện tại** nếu sư phụ không offline trên 7 ngày!`,
          components: [row],
          fetchReply: true,
          ephemeral: true
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
        collector.on('collect', async i => {
          if (i.user.id !== userId) return;

          if (i.customId === 'break_confirm_apprentice') {
            const res = mentorshipService.breakMentorship(userId, mentorId);
            await i.update({ content: res.success ? `✅ ${res.message}` : `❌ ${res.message}`, components: [] });
          } else {
            await i.update({ content: '👍 Đạo hữu đã chọn giữ lại ân tình sư đồ.', components: [] });
          }
        });
        return;
      }

      // Nếu người gọi lệnh là sư phụ
      const activeApprentices = mentorshipService.getActiveApprentices(userId);
      if (activeApprentices.length === 0) {
        await interaction.reply({ content: '❌ Đạo hữu hiện không có đệ tử nào đang theo học!', ephemeral: true });
        return;
      }

      let apprenticeId = targetUser?.id;

      if (!apprenticeId) {
        if (activeApprentices.length === 1) {
          apprenticeId = activeApprentices[0].apprentice_id;
        } else {
          await interaction.reply({
            content: '❌ Đạo hữu có nhiều đệ tử, vui lòng cung cấp tham số `tu_si` để chọn đệ tử muốn trục xuất!',
            ephemeral: true
          });
          return;
        }
      }

      const apprentice = userRepository.get(apprenticeId);
      if (!apprentice) {
        await interaction.reply({ content: '❌ Đệ tử không hợp lệ hoặc không có trong hệ thống!', ephemeral: true });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`break_confirm_mentor_${apprenticeId}`).setLabel('Xác nhận trục xuất').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`break_cancel`).setLabel('Hủy bỏ').setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.reply({
        content: `⚠️ **Trục Xuất Môn Đồ:** Đạo hữu có chắc chắn muốn trục xuất đệ tử **${apprentice.name}** ra khỏi môn hạ không?\n` +
          `*Hình phạt:* Bạn sẽ bị **cấm nhận đệ tử mới trong 48 giờ** nếu đệ tử không offline trên 7 ngày!`,
        components: [row],
        fetchReply: true,
        ephemeral: true
      });

      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
      collector.on('collect', async i => {
        if (i.user.id !== userId) return;

        if (i.customId.startsWith('break_confirm_mentor_')) {
          const tId = i.customId.split('_')[3];
          const res = mentorshipService.breakMentorship(userId, tId);
          await i.update({ content: res.success ? `✅ ${res.message}` : `❌ ${res.message}`, components: [] });
        } else {
          await i.update({ content: '👍 Đạo hữu đã thu hồi mệnh lệnh, giữ lại môn đồ.', components: [] });
        }
      });
    }

    // ───────────────── HƯỚNG DẪN ─────────────────
    else if (sub === 'huongdan') {
      const embed = new EmbedBuilder()
        .setTitle('📚 HƯỚNG DẪN HỆ THỐNG SƯ ĐỒ')
        .setColor('#3498db')
        .setDescription(
          'Thiên đạo mở ra cơ duyên truyền thừa Sư Đồ, giúp đỡ các tân thủ trên bước đường tu chân:\n\n' +
          '**1. Điều Kiện Bái Sư & Thu Nhận:**\n' +
          '• Sư phụ phải đạt **Cấp 50 trở lên**.\n' +
          '• Đệ tử phải nằm trong khoảng **Cấp 1 - 30**.\n' +
          '• Sư phụ được nhận tối đa **3 đệ tử** đang học đạo cùng lúc.\n' +
          '• Đệ tử chỉ được bái **1 sư phụ** duy nhất.\n\n' +
          '**2. Lợi Ích Của Mối Quan Hệ:**\n' +
          '• **Đệ tử làm việc:** Đệ tử được nhận **+5% EXP bonus**. Sư phụ nhận **10% EXP** và **5% Linh Thạch** cống hiến.\n' +
          '• **Đệ tử đột phá:** Cả hai nhận **50 Linh Thạch** & **5 Điểm Ngộ Tính**.\n' +
          '• **Mốc phát triển đệ tử:**\n' +
          '  - Đạt cấp 20: Cả hai nhận **1 KNB**, đệ tử nhận **1x Luyện Khí Đan**.\n' +
          '  - Đạt cấp 35: Cả hai nhận **3 KNB**, đệ tử nhận **2x Luyện Khí Đan**.\n' +
          '  - Đạt cấp 50 (Tốt nghiệp): Mentor nhận **10 KNB** & danh hiệu **Cao Nhân** (+1% EXP bonus vĩnh viễn, tối đa +5% khi tốt nghiệp 5 đệ tử). Đệ tử nhận **5 KNB** & danh hiệu **Môn Đồ**.\n\n' +
          '**3. Phá Bỏ Sư Đồ (Phạt Thiên Đạo):**\n' +
          '• **Sư phụ trục xuất đệ tử:** Sư phụ chịu phạt **cấm nhận đệ tử mới trong 48 giờ**.\n' +
          '• **Đệ tử phản môn:** Đệ tử chịu phạt **trừ 10% tu vi hiện tại**.\n' +
          '• *Ngoại lệ:* Nếu đối phương **offline liên tiếp quá 7 ngày**, hủy bỏ quan hệ sẽ **miễn phạt**.'
        )
        .setFooter({ text: 'Dùng lệnh /sudo nhan-detu @nguoi_choi để bái sư/nhận đệ tử.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // ───────────────── TRUYỀN THỤ TU VI ─────────────────
    else if (sub === 'truyen-thu') {
      const targetUser = interaction.options.getUser('detu', true);
      const amount = interaction.options.getInteger('luong', true);

      const res = mentorshipService.transmitCultivation(userId, targetUser.id, amount);
      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
      }
    }

    // ───────────────── CHỈ ĐƯỜNG (MENTOR GIFT) ─────────────────
    else if (sub === 'chi-duong') {
      const targetUser = interaction.options.getUser('detu', true);
      const apprenticeId = targetUser.id;

      // Kiểm tra quan hệ sư đồ
      const activeApp = mentorshipService.getActiveMentorshipForApprentice(apprenticeId);
      if (!activeApp || activeApp.mentor_id !== userId) {
        await interaction.reply({ content: '❌ Đạo hữu không có quan hệ Sư Đồ đang hoạt động với tu sĩ này!', ephemeral: true });
        return;
      }

      // Kiểm tra cooldown 1 ngày trong y_canh của sư phụ
      let yCanh: any = {};
      try { yCanh = JSON.parse(user.y_canh || '{}'); } catch (e) {}
      const today = new Date().toISOString().split('T')[0];
      const cdKey = `chiduong_${apprenticeId}`;
      if (yCanh[cdKey] === today) {
        await interaction.reply({ content: `❌ Đạo hữu đã chỉ đường cho **${targetUser.username}** hôm nay rồi! Quay lại ngày mai nhé.`, ephemeral: true });
        return;
      }

      // Chọn ngẫu nhiên bí tịch / vật phẩm tặng
      const giftPool = [
        { id: 'pill_alchemy_tuvi', name: '**Luyện Khí Đan** (Tu Vi +1000)', qty: 1 },
        { id: 'pill_stamina_1', name: '**Hồi Thể Đan (Sơ Cấp)** (+50 Thể Lực)', qty: 2 },
        { id: 'pill_stamina_2', name: '**Hồi Thể Đan (Trung Cấp)** (+100 Thể Lực)', qty: 1 },
        { id: 'repair_stone_low', name: '**Dưỡng Thạch (Sơ Phẩm)** (Sửa chữa đồ vật)', qty: 2 },
        { id: 'tinh_thach_shard', name: '**Mảnh Tinh Thạch** (Nguyên liệu nâng sao)', qty: 3 },
        { id: 'pill_break_minor_1', name: '**Khai Mạch Đan** (Hỗ trợ đột phá tầng nhỏ)', qty: 1 },
        { id: 'item_fragment', name: '**Mảnh Vỡ Trang Bị** (Rèn ghép phôi)', qty: 5 },
        { id: 'pill_y_canh', name: '**Ý Cảnh Đan** (+30 Ngộ Tính)', qty: 1 },
      ];
      const gift = giftPool[Math.floor(Math.random() * giftPool.length)];

      // Cộng vật phẩm vào túi đệ tử
      const { inventoryRepository } = require('../../database/repositories/InventoryRepository');
      inventoryRepository.addItem(apprenticeId, gift.id, gift.qty);

      // Cập nhật cooldown
      yCanh[cdKey] = today;
      userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });

      const apprentice = userRepository.get(apprenticeId);
      const embed = new EmbedBuilder()
        .setTitle('🌟 SƯ PHỤ CHỈ ĐƯỜNG')
        .setColor('#f39c12')
        .setDescription(
          `**${user.name}** dốc lòng chỉ dạy, truyền thụ bảo vật cho đệ tử **${apprentice?.name || targetUser.username}**!\n\n` +
          `🎁 **Quà Tặng:** ${gift.name} x${gift.qty}\n\n` +
          `*Hoa quả cần gieo ươm từng ngày. Sư phụ mỗi ngày chỉ có thể chỉ đường 1 lần cho 1 đệ tử.*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
}
