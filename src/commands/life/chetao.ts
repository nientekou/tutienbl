import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { craftingService, CraftingQueueItem } from '../../services/CraftingService';
import { RECIPES } from '../../config/recipes';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

/**
 * Tạo V2 Container hiển thị Lò Chế Tạo
 */
export function getCraftingEmbed(userId: string): ContainerBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return container(V2_COLORS.danger, [
      header('❌ Lỗi'),
      body('Đạo hữu chưa khởi tạo nhân vật.')
    ]);
  }

  const queue = craftingService.getQueue(userId);
  const inv = inventoryRepository.getUserInventory(userId);

  const content: any[] = [
    header(`🧪 Lò Luyện Đan & Rèn Khí - ${user.name}`, 'Luyện hóa linh thảo vạn năm, rèn đúc thần sa tinh thiết tạo nên đan dược nghịch thiên.'),
    separator()
  ];

  // 1. Hiển thị danh mục công thức hiện có
  const recipeEntries = Object.entries(RECIPES);
  let recipesText = '';

  for (const [id, r] of recipeEntries) {
    const typeLabel = r.type === 'alchemy' ? '🔮 [Luyện Đan]' : '⚒️ [Rèn Khí]';

    const ingredientsText = r.ingredients
      .map(ing => {
        const item = db.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId) as any;
        const entry = inv.find(i => i.item_id === ing.itemId);
        const count = entry ? entry.quantity : 0;
        return `${item ? item.name : ing.itemId} (x${ing.quantity}, có x${count})`;
      })
      .join('\n• ');

    recipesText += `🔹 **${r.name}** ${typeLabel}\n` +
                 `  Cấp ${r.minLevel} │ ${r.duration}s │ ${r.cost} LThạch\n` +
                 `  • ${ingredientsText}\n\n`;
  }

  content.push(body(`**📜 Thư Mục Công Thức**\n${recipesText || '*Chưa có công thức.*'}`));
  content.push(separator());

  // 2. Hiển thị hàng chờ luyện lò hiện tại
  let queueText = '';
  if (queue.length > 0) {
    queue.forEach((item, index) => {
      if (item.status === 'completed') {
        queueText += `${index + 1}. ✨ **${item.recipeName}** (Hoàn thành - Chờ thu lò!)\n`;
      } else {
        const min = Math.floor(item.timeRemaining / 60);
        const sec = item.timeRemaining % 60;
        queueText += `${index + 1}. 🧪 **${item.recipeName}** (Đang nấu... \`${min}m ${sec}s\` còn lại)\n`;
      }
    });
  } else {
    queueText = '*Lò luyện hiện tại nguội lạnh, không hoạt động.*';
  }
  content.push(body(`**🔥 Trạng Thái Hỏa Lò**\n${queueText}`));
  content.push(separator());
  
  content.push(body(`💼 Linh Thạch hiện có: 🟤 **${user.coin_ha_pham.toLocaleString()}** Linh Thạch Hạ Phẩm`));

  return container(V2_COLORS.primary, content);
}

/**
 * Tạo các Component lò chế tạo
 */
export function getCraftingComponents(userId: string): any[] {
  const user = userRepository.get(userId);
  const queue = craftingService.getQueue(userId);
  const rows: any[] = [];

  if (!user) return rows;

  // 1. Dropdown chọn công thức để bắt đầu luyện chế
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`craftselect_${userId}`)
    .setPlaceholder('🧪 Chọn công thức để khởi hỏa luyện chế...');

  for (const [id, r] of Object.entries(RECIPES)) {
    const isLocked = user.level < r.minLevel;
    const typeLabel = r.type === 'alchemy' ? 'Luyện Đan' : 'Rèn Khí';
    const label = isLocked ? `[🔒 Khóa] ${r.name} (${typeLabel})` : `${r.name} (${typeLabel})`;
    
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setDescription(`Phí: ${r.cost} LThạch | Yêu cầu cấp ${r.minLevel}`)
        .setValue(r.id)
    );
  }
  rows.push(new ActionRowBuilder().addComponents(selectMenu));

  // 2. Nút Thu lò và nút Làm mới
  const hasCompleted = queue.some(item => item.status === 'completed');

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`craftclaim_${userId}`)
      .setLabel('✨ Thu Hoạch Thành Phẩm (Thu Lò)')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasCompleted),

    new ButtonBuilder()
      .setCustomId(`craftrefresh_${userId}`)
      .setLabel('🔄 Làm Mới Lò')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`hosoback_${userId}`)
      .setLabel('🔙 Quay Lại Hồ Sơ')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(btnRow);

  return rows;
}

export default class CheTaoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('chetao')
        .setDescription('Mở Lò Luyện Đan và Rèn Khí để chế tạo vật phẩm.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
      });
      return;
    }

    const embed = getCraftingEmbed(userId);
    const components = getCraftingComponents(userId);

    await interaction.editReply(toV2Payload([embed], components as any[]));
  }
}
