import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { cultivationService, CultivationService } from '../../services/CultivationService';
import { tribulationService } from '../../services/TribulationService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { getRealmDetails, getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';

export default class DotPhaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dotpha')
        .setDescription('Đột phá cảnh giới tu vi khi tích lũy đầy linh khí.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }

    if (user.tu_vi < user.exp_needed) {
      await interaction.editReply({
        content: `❌ Tu vi chưa đủ tích lũy để đột phá! (Đang có: **${user.tu_vi}/${user.exp_needed}** Tu Vi). Đạo hữu hãy thiền định hoặc đi bí cảnh dã ngoại để kiếm thêm tu vi.`
      });
      return;
    }

    const { minorLevel, majorIndex, fullName } = getRealmDetails(user.level);
    const isMajor = minorLevel === 38;

    if (!isMajor) {
      // Đột phá cấp cảnh giới nhỏ -> Hiện bảng xác nhận và tuỳ chọn đan dược
      const totalRate = CultivationService.getBreakthroughRate(majorIndex, user.base_luck);

      const inv = inventoryRepository.getUserInventory(userId);
      const getQty = (itemId: string) => inv.find(i => i.item_id === itemId)?.quantity || 0;
      const q1 = getQty(ITEMS.PILL_BREAK_MINOR_1);
      const q2 = getQty(ITEMS.PILL_BREAK_MINOR_2);
      const q3 = getQty(ITEMS.PILL_BREAK_MINOR_3);
      const bequanCost = user.level * 200;

      const embed = new EmbedBuilder()
        .setTitle(`🌟 Chuẩn Bị Đột Phá: ${fullName}`)
        .setColor('#f1c40f')
        .setDescription(
          `Đạo hữu đã tích đủ linh khí, có thể thử nghiệm trùng kích bình cảnh để lên **Tầng ${minorLevel + 1}**.\n\n` +
          `🌿 **Tu Vi hiện có:** **${user.tu_vi}/${user.exp_needed}**\n` +
          `${getProgressBar(user.tu_vi, user.exp_needed, 10)}\n\n` +
          `📈 **Tỷ lệ đột phá thành công:** **${totalRate.toFixed(1)}%**\n` +
          `${getProgressBar(totalRate, 100, 10)}\n\n` +
          `⚠️ **Rủi ro:** Nếu đột phá thất bại sẽ tổn hao **15% Tu Vi** hiện tại.\n\n` +
          `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanCost}** Linh Thạch Hạ Phẩm để đảm bảo đột phá 100% thành công.\n\n` +
          `Đạo hữu muốn dùng đan dược hay Bế Quan Đột Phá?`
        )
        .setFooter({ text: 'Nhấn nút bên dưới để tiến hành đột phá' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`dotpha_none_${userId}`)
          .setLabel('Không dùng đan')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`dotpha_pill_break_minor_1_${userId}`)
          .setLabel(`Tụ Khí (+15%) [x${q1}]`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(q1 <= 0),
        new ButtonBuilder()
          .setCustomId(`dotpha_pill_break_minor_2_${userId}`)
          .setLabel(`Bồi Nguyên (+30%) [x${q2}]`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(q2 <= 0),
        new ButtonBuilder()
          .setCustomId(`dotpha_pill_break_minor_3_${userId}`)
          .setLabel(`Tạo Hóa (+50%) [x${q3}]`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(q3 <= 0),
        new ButtonBuilder()
          .setCustomId(`dotpha_bequan_${userId}`)
          .setLabel(`Bế Quan (${bequanCost} LThạch)`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(user.coin_ha_pham < bequanCost)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      // Đột phá cảnh giới lớn -> Nghênh tiếp Lôi Kiếp
      const bolts = 3 + majorIndex * 2;
      const damage = Math.round(20 + majorIndex * 15);

      const stats = inventoryService.getActiveStats(userId);
      const inv = inventoryRepository.getUserInventory(userId);
      const getQty = (itemId: string) => inv.find(i => i.item_id === itemId)?.quantity || 0;

      const antiLoiQty = getQty(ITEMS.PILL_ALCHEMY_ANTI_LOI);
      const hp1Qty = getQty(ITEMS.PILL_HP_1);
      const hp2Qty = getQty(ITEMS.PILL_HP_2);
      const tiLoiQty = getQty(ITEMS.TALISMAN_ANTI_LOI);

      const oncomingKiep = tribulationService.getOncomingKiepInfo(userId);
      const protectPillQty = oncomingKiep.pillId ? getQty(oncomingKiep.pillId) : 0;
      const bequanMajorCost = user.level * 1000;

      const hpText = stats ? `${stats.hp}/${stats.hp}` : `${user.base_hp}/${user.base_hp}`;
      const mpText = stats ? `${stats.mp}/${stats.mp}` : `${user.base_mp}/${user.base_mp}`;
      
      const embed = new EmbedBuilder()
        .setTitle(`⚡ Cảnh Báo Thiên Kiếp: ${user.name}`)
        .setColor('#e74c3c')
        .setDescription(
          `Đạo hữu đã chạm tới **Cực Hạn Đại Viên Mãn** cảnh giới hiện tại. Thiên địa dị biến, lôi vân đang kéo tới dồn dập!\n\n` +
          `• Cảnh giới lớn đột phá: **${fullName}**\n` +
          `• Thiên kiếp sắp tới: **${oncomingKiep.name}**\n` +
          `• Quy mô lôi kiếp: **${bolts} Đạo Lôi Kiếp** giáng xuống liên tục.\n` +
          `• Uy lực ước tính: **~${damage}** sát thương thô mỗi đạo sét.\n\n` +
          `❤️ **Trạng thái hiện tại:**\n` +
          `• Sinh Lực tối đa: **${hpText}** HP\n` +
          `• Pháp Lực tối đa: **${mpText}** MP\n\n` +
          `🎒 **Vật phẩm hộ thân hiện có trong túi:**\n` +
          `• ${oncomingKiep.pillName} 💊 (khắc chế kiếp, giảm 40%): **${protectPillQty}** viên\n` +
          `• Ngự Lôi Đan 💊 (giảm 30% sát thương): **${antiLoiQty}** viên\n` +
          `• Tị Lôi Phù 📜 (giảm 80% sát thương 1 lượt): **${tiLoiQty}** tấm\n` +
          `• Hồi Huyết Đan trung phẩm ❤️ (hồi 150 HP): **${hp2Qty}** viên\n\n` +
          `💎 **Bế Quan Đột Phá:** Hao tổn **${bequanMajorCost}** Linh Thạch Hạ Phẩm để đột phá an toàn 100% (bỏ qua lôi kiếp).\n\n` +
          `⚠️ **Cảnh báo nguy hiểm:** Hãy chắc chắn đạo hữu đang đầy đủ HP/MP. Nếu HP về 0 giữa lôi kiếp, đạo hữu sẽ đột phá thất bại, bị **Trọng Thương (1 giờ)** và tổn thất **-30%** tu vi hiện có!`
        )
        .setFooter({ text: '📖 Xem thêm về Kiếp Số tại /camnang chuong3' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`loi_start_${userId}`)
          .setLabel('⚡ Nghênh Tiếp Lôi Kiếp!')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`dotpha_bequan_${userId}`)
          .setLabel(`Bế Quan (${bequanMajorCost} LThạch)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(user.coin_ha_pham < bequanMajorCost)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  }
}
