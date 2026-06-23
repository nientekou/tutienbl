import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { coupleRepository } from '../../database/repositories/CoupleRepository';
import { coupleService } from '../../services/CoupleService';
import { getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';

export default class DaoLuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('daolu')
        .setDescription('Hệ thống Đạo Lữ & Song Tu')
        .addSubcommand(sub =>
          sub.setName('thongtin')
            .setDescription('Xem thông tin Đạo Lữ của bạn')
        )
        .addSubcommand(sub =>
          sub.setName('cau-hon')
            .setDescription('Cầu hôn một người chơi khác')
            .addUserOption(opt => opt.setName('nguoi_choi').setDescription('Người bạn muốn cầu hôn').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('song-tu')
            .setDescription('Tiến hành Song Tu cùng Đạo Lữ')
        )
        .addSubcommand(sub =>
          sub.setName('tang-qua')
            .setDescription('Tặng quà để tăng hảo cảm')
            .addIntegerOption(opt => opt.setName('so_luong').setDescription('Số lượng Quà (Tốn Linh Thạch)').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) { await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'}); return; }

    const sub = interaction.options.getSubcommand();

    if (sub === 'thongtin') {
      const couple = coupleRepository.getCoupleByUserId(userId);
      if (!couple) { await interaction.editReply({ content: '💔 Đạo hữu hiện đang độc thân vui tính!'}); return; }

      const partnerId = couple.user1_id === userId ? couple.user2_id : couple.user1_id;
      const partner = userRepository.get(partnerId);

      const intimacyBar = getProgressBar(couple.intimacy, 2000, 10);

      const anniversaryMsg = coupleService.checkAnniversaryOnInfo(couple.id);

      const embed = new EmbedBuilder()
        .setTitle('💞 HỒ SƠ ĐẠO LỮ 💞')
        .setColor('#ff69b4')
        .addFields(
          { name: 'Đạo Lữ', value: `**${user.name}** 💍 **${partner ? partner.name : 'Vô Danh'}**`, inline: false },
          { name: 'Độ Hảo Cảm', value: `💖 **${couple.intimacy}** điểm\n${intimacyBar}\n*(Buff: +${Math.min(20, Math.floor(couple.intimacy / 100))}% Công & Máu)*`, inline: true },
          { name: 'Ngày thành hôn', value: `<t:${couple.marriage_date}:D>`, inline: true }
        )
        .setFooter({ text: 'Dùng /daolu song-tu mỗi ngày để nhận Tu Vi!' });

      if (anniversaryMsg) {
        embed.setDescription(anniversaryMsg);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'cau-hon') {
      const target = interaction.options.getUser('nguoi_choi', true);
      if (target.id === userId) { await interaction.editReply({ content: '❌ Không thể tự cầu hôn chính mình!'}); return; }
      if (target.bot) { await interaction.editReply({ content: '❌ Không thể cầu hôn Bot!'}); return; }

      const targetUser = userRepository.get(target.id);
      if (!targetUser) { await interaction.editReply({ content: '❌ Người này chưa tu tiên!'}); return; }

      const myCouple = coupleRepository.getCoupleByUserId(userId);
      if (myCouple) { await interaction.editReply({ content: '❌ Đạo hữu đã có Đạo Lữ rồi! Cấm ngoại tình!'}); return; }

      const targetCouple = coupleRepository.getCoupleByUserId(target.id);
      if (targetCouple) { await interaction.editReply({ content: '❌ Người ta đã có chủ rồi! Xin tự trọng!'}); return; }

      // Kiểm tra nhẫn đính hôn
      const inv = inventoryRepository.getUserInventory(userId);
      const ring = inv.find(i => i.item_id === ITEMS.ITEM_NHAN_DINH_HON);
      if (!ring || ring.quantity < 1) {
        await interaction.editReply({ content: '❌ Đạo hữu không có **Nhẫn Đính Hôn** (Mua trong Cửa Hàng giá 500,000 LT)!'});
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('accept_marriage').setLabel('Đồng ý').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decline_marriage').setLabel('Từ chối').setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.editReply({
        content: `💍 <@${target.id}>, đạo hữu **${user.name}** muốn kết thành Đạo Lữ cùng Đạo hữu! Đạo hữu có đồng ý không?`,
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== target.id) {
          await i.reply({ content: '❌ Đạo hữu không phải là người được cầu hôn!'});
          return;
        }

        if (i.customId === 'accept_marriage') {
          // Trừ nhẫn
          inventoryRepository.removeItem(userId, ITEMS.ITEM_NHAN_DINH_HON, 1);
          coupleRepository.createCouple(userId, target.id);
          // Đồng bộ sang bảng users
          userRepository.update(userId, { partner_id: target.id, intimacy: 100 });
          userRepository.update(target.id, { partner_id: userId, intimacy: 100 });
          await i.update({ content: `🎉 Chúc mừng **${user.name}** và **${targetUser.name}** đã kết bái thành Đạo Lữ! 💖`, components: [] });
        } else {
          await i.update({ content: `💔 **${targetUser.name}** đã từ chối lời cầu hôn của **${user.name}**.`, components: [] });
        }
      });
      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: `⏳ Quá thời gian, lời cầu hôn đã bị hủy.`, components: [] }).catch(() => {});
        }
      });

    } else if (sub === 'song-tu') {
      const couple = coupleRepository.getCoupleByUserId(userId);
      if (!couple) { await interaction.editReply({ content: '❌ Đạo hữu chưa có Đạo Lữ!'}); return; }
      
      const result = coupleService.dualCultivate(couple.id);
      await interaction.editReply({ content: result.message });
      
    } else if (sub === 'tang-qua') {
      const amount = interaction.options.getInteger('so_luong', true);
      if (amount <= 0) { await interaction.editReply({ content: '❌ Số lượng phải lớn hơn 0!'}); return; }
      
      const couple = coupleRepository.getCoupleByUserId(userId);
      if (!couple) { await interaction.editReply({ content: '❌ Đạo hữu chưa có Đạo Lữ!'}); return; }

      // 1 Quà = 1000 Linh Thạch = 1 Hảo cảm
      const cost = amount * 1000;
      if (user.coin_ha_pham < cost) {
        await interaction.editReply({ content: `❌ Không đủ Linh Thạch! Cần **${cost}** LT để tặng ${amount} món quà.`});
        return;
      }

      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });
      const result = coupleService.giveGift(couple.id, amount);
      await interaction.editReply({ content: result.message });
    }
  }
}
