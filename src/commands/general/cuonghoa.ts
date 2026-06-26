import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { enhanceService } from '../../services/EnhanceService';
import { ITEMS } from '../../config/itemConstants';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';
import { safeV2EditReply } from '../../utils/uiSystem';

export default class CuongHoaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('cuonghoa')
        .setDescription('Cường hóa trang bị để gia tăng thuộc tính cơ bản (+1 đến +15).')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Vui lòng dùng `/taonhanvat`!'});
      return;
    }

    const inventory = inventoryRepository.getUserInventory(userId);
    const equipableItems = inventory.filter(i => i.equipable === 1 && i.type === 'equipment');

    if (equipableItems.length === 0) {
      await interaction.editReply({ 
        content: '❌ Đạo hữu không sở hữu trang bị nào trong hành trang có thể cường hóa!' 
      });
      return;
    }

    const comp = container(V2_COLORS.mystic, [
      header('✨ THẦN THIẾT CỰC DIÊN — ĐẠI TRẬN CƯỜNG HÓA'),
      separator(),
      body(
        `Chào mừng đạo hữu **${user.name}** đến với Đại Trận Cường Hóa!\n\n` +
        `🧘 **Quy tắc cường hóa:**\n` +
        `• **+1 đến +5**: Tỷ lệ thành công **100%**.\n` +
        `• **+6 đến +10**: Tỷ lệ thành công **50%**, thất bại không rớt cấp.\n` +
        `• **+11 đến +15**: Tỷ lệ thành công **25%**, thất bại **BỊ RỚT 1 CẤP**.\n\n` +
        `*Vui lòng chọn trang bị muốn cường hóa từ danh sách bên dưới:*\n\n` +
        `_Tiêu tốn Mảnh Tinh Thạch & Hạ Phẩm Linh Thạch._`
      )
    ]);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`enhance_select_${userId}`)
      .setPlaceholder('Chọn trang bị để cường hóa...');

    // Lấy tối đa 25 trang bị để tránh giới hạn Option của Discord Select Menu
    equipableItems.slice(0, 25).forEach(item => {
      const isEquippedText = item.is_equipped === 1 ? ' [Đang mặc]' : '';
      const enhanceText = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
      const starText = item.stars > 0 ? ` ⭐${item.stars}` : '';
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${item.name}${enhanceText}${starText}${isEquippedText}`)
          .setDescription(`Cấp: ${item.enhance_level || 0} | ID: ${item.id}`)
          .setValue(item.id.toString())
      );
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await safeV2EditReply(interaction, [comp], [row]);
  }

  /**
   * Tạo giao diện xem trước thông tin cường hóa của trang bị cụ thể
   */
  public static buildEnhancePreview(
    userId: string,
    inventoryId: number,
    lastResult?: { success: boolean; message: string }
  ): { embed: ContainerBuilder; rows: ActionRowBuilder<any>[] } {
    const user = userRepository.get(userId)!;
    const item = inventoryRepository.get(inventoryId)!;
    const currentLevel = item.enhance_level || 0;

    // Tìm Mảnh Tinh Thạch trong hành trang
    const userInventory = inventoryRepository.getUserInventory(userId);
    const shardItem = userInventory.find(i => i.item_id === ITEMS.TINH_THACH_SHARD);
    const shardQty = shardItem ? shardItem.quantity : 0;

    let resultHeader = '';
    if (lastResult) {
      const bannerEmoji = lastResult.success ? '🟢' : '🔴';
      const cleanMessage = lastResult.message.replace(/\\n/g, '\n');
      resultHeader = `${bannerEmoji} **KẾT QUẢ CƯỜNG HÓA VỪA QUA:**\n${cleanMessage}\n\n`;
    }

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`enhance_cancel_${userId}`)
        .setLabel('🔙 Quay Lại')
        .setStyle(ButtonStyle.Secondary)
    );

    if (currentLevel >= 15) {
      const comp = container(V2_COLORS.danger, [
        header(`✨ CƯỜNG HÓA TRANG BỊ: ${item.name} (+15)`),
        separator(),
        body(
          resultHeader +
          `🎉 Trang bị này đã đạt cấp cường hóa tối đa **+15**! Đại trận đã viên mãn, không thể gia trì thêm.`
        )
      ]);
      return { embed: comp, rows: [backRow] };
    }

    const cfg = enhanceService.getEnhanceConfig(currentLevel)!;
    const nextLevel = currentLevel + 1;
    const successRatePct = Math.round(cfg.successRate * 100);

    const baseStats = JSON.parse(item.base_stats || '{}');
    const statUpdates: string[] = [];
    const statsToPrint = ['hp', 'mp', 'atk', 'def', 'speed', 'crit', 'dodge', 'luck'];
    const starMult = 1 + (item.stars || 0) * 0.20;

    for (const stat of statsToPrint) {
      if (baseStats[stat]) {
        const curVal = Math.round(baseStats[stat] * starMult * (1 + currentLevel * 0.1));
        const nextVal = Math.round(baseStats[stat] * starMult * (1 + nextLevel * 0.1));
        let statName = stat.toUpperCase();
        if (stat === 'hp') statName = 'Máu (HP)';
        if (stat === 'mp') statName = 'Chân Khí (MP)';
        if (stat === 'atk') statName = 'Công Kích (ATK)';
        if (stat === 'def') statName = 'Phòng Thủ (DEF)';
        if (stat === 'speed') statName = 'Thân Pháp (SPEED)';
        if (stat === 'crit') statName = 'Bạo Kích (CRIT)';
        if (stat === 'dodge') statName = 'Né Tránh (DODGE)';
        if (stat === 'luck') statName = 'May Mắn (LUCK)';
        statUpdates.push(`• **${statName}**: ${curVal} ➔ **${nextVal}** *(+10% chỉ số gốc)*`);
      }
    }

    const hasShard = shardQty >= cfg.costShards;
    const hasCoin = user.coin_ha_pham >= cfg.costLinhThach;
    const accentColor = lastResult ? (lastResult.success ? V2_COLORS.success : V2_COLORS.danger) : (cfg.dropOnFail ? V2_COLORS.danger : V2_COLORS.info);

    const comp = container(accentColor, [
      header(`✨ ĐĂNG LÂM ĐẠI TRẬN: +${currentLevel} ➔ +${nextLevel}`),
      separator(),
      body(
        resultHeader +
        `Trang bị: **${item.name}**\n` +
        `Cấp độ hiện tại: **+${currentLevel}**\n` +
        `Cấp độ tiếp theo: **+${nextLevel}**\n\n` +
        `📊 **Thuộc Tính Thay Đổi:**\n${statUpdates.join('\n') || '• Không có thuộc tính cơ bản.'}\n\n` +
        `━━━ **ĐIỀU KIỆN CƯỜNG HÓA** ━━━\n` +
        `• Tỷ lệ thành công: **${successRatePct}%**\n` +
        `• Hao tốn Linh Thạch: ${hasCoin ? '✅' : '❌'} **${cfg.costLinhThach}** LT (Hiện có: ${user.coin_ha_pham} LT)\n` +
        `• Hao tốn Tinh Thạch: ${hasShard ? '✅' : '❌'} **${cfg.costShards}** Mảnh (Hiện có: ${shardQty} Mảnh)\n\n` +
        `⚠️ **Rủi ro thất bại:** ${cfg.dropOnFail ? '🚨 **BỊ RỚT 1 CẤP (Về +10)**' : '🛡️ **Giữ nguyên cấp độ**'}\n\n` +
        `_Nhấn nút Cường Hóa phía dưới để tiến hành gia trì._`
      )
    ]);

    const btnConfirm = new ButtonBuilder()
      .setCustomId(`enhance_confirm_${inventoryId}_${userId}`)
      .setLabel('✨ Cường Hóa')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasShard || !hasCoin);

    const btnCancel = new ButtonBuilder()
      .setCustomId(`enhance_cancel_${userId}`)
      .setLabel('❌ Hủy Bỏ')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnConfirm, btnCancel);
    return { embed: comp, rows: [row] };
  }
}
