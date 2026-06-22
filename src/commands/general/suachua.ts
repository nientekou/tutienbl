import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository, InventoryItem } from '../../database/repositories/InventoryRepository';
import db from '../../database/database';

export default class SuaChuaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('suachua')
        .setDescription('Sửa chữa pháp bảo: khôi phục độ bền trang bị bằng Linh Thạch hoặc Đá Dưỡng.')
        .addSubcommand(sub =>
          sub
            .setName('trangbi')
            .setDescription('Sửa chữa một trang bị cụ thể bằng Linh Thạch.')
             .addStringOption(opt =>
              opt
                .setName('item_id')
                .setDescription('Mã vật phẩm cần sửa (xem trong /tuido).')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('tatca')
            .setDescription('Sửa chữa tất cả trang bị đang đeo (tốn Linh Thạch theo độ bền mất).')
        )
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách trang bị đang đeo và tình trạng độ bền.')
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
    const inventory = inventoryRepository.getUserInventory(userId);
    const equippedItems = inventory.filter(i => i.is_equipped === 1);

    if (sub === 'danhsach') {
      await this.showEquipmentList(interaction, userId, equippedItems);
      return;
    }

    if (sub === 'trangbi') {
      const itemId = interaction.options.getString('item_id', true);
      const item = inventory.find(i => i.item_id === itemId);
      if (!item) {
        await interaction.reply({ content: `❌ Không tìm thấy vật phẩm \`${itemId}\` trong túi đồ!`, ephemeral: true });
        return;
      }

      const result = this.repairSingleItem(userId, item, inventory);
      await interaction.reply({ content: result.message, ephemeral: !result.success });
      return;
    }

    if (sub === 'tatca') {
      const result = this.repairAllEquipped(userId, equippedItems);
      await interaction.reply({ content: result.message, ephemeral: !result.success });
      return;
    }
  }

  /**
   * Hiển thị danh sách trang bị đang đeo và độ bền
   */
  private async showEquipmentList(
    interaction: ChatInputCommandInteraction,
    userId: string,
    equippedItems: InventoryItem[]
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ DANH SÁCH TRANG BỊ - ĐỘ BỀN 🛡️')
      .setColor('#3498db')
      .setDescription('Kiểm tra tình trạng pháp bảo của đạo hữu. Trang bị hết độ bền chỉ còn **50%** chỉ số!')
      .setFooter({ text: 'Dùng /suachua trangbi item_id: <mã> hoặc /suachua tatca để sửa chữa.' })
      .setTimestamp();

    if (equippedItems.length === 0) {
      embed.addFields({ name: '📭 Trống', value: 'Đạo hữu chưa trang bị bất kỳ pháp bảo nào!' });
    } else {
      for (const item of equippedItems) {
        const slot = (item.equipment_slot || 'unknown').toUpperCase();
        const durabilityBar = this.getDurabilityBar(item.durability, item.max_durability);
        const statusText = item.durability <= 0
          ? '💔 **HỎNG** - Chỉ còn 50% chỉ số!'
          : item.durability <= 30
            ? '⚠️ Sắp hỏng - Nên sửa sớm!'
            : '✅ Tốt';

        const enhanceText = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
        embed.addFields({
          name: `**[${slot}]** ${item.name}${enhanceText}${item.stars > 0 ? ` ⭐${item.stars}` : ''}`,
          value: `Mã: \`#${item.id}\` | Độ bền: ${durabilityBar} **${item.durability}/${item.max_durability}** | ${statusText}`,
          inline: false
        });
      }
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`suachua_all_${userId}`)
        .setLabel('🛠️ Sửa Tất Cả')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(equippedItems.length === 0),
      new ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  /**
   * Sửa chữa một trang bị cụ thể
   */
  private repairSingleItem(
    userId: string,
    item: InventoryItem,
    inventory: InventoryItem[]
  ): { success: boolean; message: string } {
    const durabilityLost = item.max_durability - item.durability;
    if (durabilityLost <= 0) {
      return { success: false, message: `✅ **${item.name}** vẫn còn nguyên vẹn, không cần sửa chữa!` };
    }

    // Kiểm tra có đá dưỡng trong túi không
    const repairStones = inventory.filter(i =>
      i.item_id === 'repair_stone_low' ||
      i.item_id === 'repair_stone_mid' ||
      i.item_id === 'repair_stone_high'
    );

    if (repairStones.length > 0) {
      // Ưu tiên dùng đá dưỡng phẩm cao nhất
      const stonePriority = ['repair_stone_high', 'repair_stone_mid', 'repair_stone_low'];
      let usedStone: InventoryItem | null = null;
      for (const stoneId of stonePriority) {
        const found = repairStones.find(s => s.item_id === stoneId);
        if (found) {
          usedStone = found;
          break;
        }
      }

      if (usedStone) {
        const stats = JSON.parse(usedStone.base_stats || '{}');
        const repairAmount = stats.repair_amount || 30;

        const newDurability = Math.min(item.max_durability, item.durability + (repairAmount >= 999 ? item.max_durability : repairAmount));

        const repairTx = db.transaction(() => {
          inventoryRepository.removeItemById(usedStone!.id, 1);
          inventoryRepository.updateDurability(item.id, newDurability);
        });
        repairTx();

        const restored = newDurability - item.durability;
        return {
          success: true,
          message: `🛠️ **Sửa chữa thành công!** Dùng **${usedStone.name}** để tu bổ **${item.name}**, khôi phục **+${restored}** độ bền! (Hiện tại: **${newDurability}/${item.max_durability}**)`
        };
      }
    }

    // Không có đá dưỡng → dùng Linh Thạch
    const costPerPoint = 3; // 3 Linh Thạch cho 1 điểm độ bền
    const totalCost = durabilityLost * costPerPoint;

    const user = userRepository.get(userId);
    if (!user || user.coin_ha_pham < totalCost) {
      return {
        success: false,
        message: `❌ Không đủ Linh Thạch để sửa **${item.name}**! Cần **${totalCost}** Linh Thạch (${durabilityLost} điểm × ${costPerPoint} LThạch/điểm), hiện có **${user?.coin_ha_pham || 0}**. Hoặc đạo hữu có thể dùng **Pháp Bảo Dưỡng Thạch** (mua tại /shop).`
      };
    }

    const repairTx = db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user!.coin_ha_pham - totalCost });
      inventoryRepository.repairItem(item.id);
    });
    repairTx();

    return {
      success: true,
      message: `🛠️ **Sửa chữa thành công!** Đạo hữu tiêu tốn **${totalCost}** Linh Thạch để tu bổ **${item.name}** về trạng thái hoàn hảo! 🎉 (**${item.max_durability}/${item.max_durability}**)`
    };
  }

  /**
   * Sửa chữa tất cả trang bị đang đeo (public để tái sử dụng)
   */
  public repairAllEquipped(
    userId: string,
    equippedItems: InventoryItem[]
  ): { success: boolean; message: string } {
    return repairAllEquipped(userId, equippedItems); // Delegate to standalone
  }

  /**
   * Tạo thanh độ bền trực quan
   */
  private getDurabilityBar(current: number, max: number): string {
    const filled = Math.round((current / max) * 10);
    const empty = 10 - filled;
    const filledChar = current <= 0 ? '🟥' : current <= 30 ? '🟨' : '🟩';
    return filledChar.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, empty));
  }
}

/**
 * Hàm xử lý sửa chữa tất cả trang bị đang đeo (standalone, dùng trong cả command và button)
 */
export function repairAllEquipped(
  userId: string,
  equippedItems: InventoryItem[]
): { success: boolean; message: string } {
  const needRepair = equippedItems.filter(i => i.durability < i.max_durability);
  if (needRepair.length === 0) {
    return { success: false, message: '✅ Tất cả trang bị của đạo hữu đều còn nguyên vẹn, không cần sửa chữa!' };
  }

  const costPerPoint = 3;
  let totalCost = 0;
  for (const item of needRepair) {
    totalCost += (item.max_durability - item.durability) * costPerPoint;
  }

  const user = userRepository.get(userId);
  if (!user || user.coin_ha_pham < totalCost) {
    return {
      success: false,
      message: `❌ Không đủ Linh Thạch để sửa tất cả! Cần **${totalCost}** Linh Thạch, hiện có **${user?.coin_ha_pham || 0}**.`
    };
  }

  const repairTx = db.transaction(() => {
    userRepository.update(userId, { coin_ha_pham: user!.coin_ha_pham - totalCost });
    for (const item of needRepair) {
      inventoryRepository.repairItem(item.id);
    }
  });
  repairTx();

  const repairedNames = needRepair.map(i => `**${i.name}**`).join(', ');
  return {
    success: true,
    message: `🛠️ **Sửa chữa toàn bộ thành công!** Đạo hữu tiêu tốn **${totalCost}** Linh Thạch để tu bổ: ${repairedNames}. Tất cả đã về trạng thái hoàn hảo! 🎉`
  };
}

/**
 * Hàm xử lý sửa chữa từ nút bấm (dùng trong interactionCreate.ts)
 */
export function handleRepairAllButton(userId: string): { success: boolean; message: string } {
  const inventory = inventoryRepository.getUserInventory(userId);
  const equippedItems = inventory.filter(i => i.is_equipped === 1);
  return repairAllEquipped(userId, equippedItems);
}
