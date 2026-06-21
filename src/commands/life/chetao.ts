import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { craftingService, CraftingQueueItem } from '../../services/CraftingService';
import { RECIPES } from '../../config/recipes';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import db from '../../database/database';

/**
 * Tạo Embed hiển thị Lò Chế Tạo
 */
export function getCraftingEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor('#e74c3c')
      .setDescription('Nhân vật không tồn tại.');
  }

  const queue = craftingService.getQueue(userId);
  const inv = inventoryRepository.getUserInventory(userId);

  const embed = new EmbedBuilder()
    .setTitle(`🧪 Lò Luyện Đan & Rèn Khí - ${user.name}`)
    .setDescription('Luyện hóa linh thảo vạn năm, rèn đúc thần sa tinh thiết tạo nên đan dược nghịch thiên và giáp binh tinh lương.')
    .setColor('#e67e22')
    .setTimestamp();

  // 1. Hiển thị danh mục công thức hiện có (chia nhỏ để tránh vượt 1024 ký tự/field)
  const recipeEntries = Object.entries(RECIPES);
  let currentChunk = '';
  let chunkIndex = 0;

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

    const line = `🔹 **${r.name}** ${typeLabel}\n` +
                 `  Cấp ${r.minLevel} | ${r.duration}s | ${r.cost} LThạch\n` +
                 `  • ${ingredientsText}\n\n`;

    // Nếu chunk hiện tại + dòng mới vượt 1000 ký tự -> lưu lại và tạo chunk mới
    if (currentChunk.length + line.length > 1000) {
      const fieldName = chunkIndex === 0 ? '📜 Thư Mục Công Thức (1)' : `📜 Công Thức (tiếp ${chunkIndex + 1})`;
      embed.addFields({ name: fieldName, value: currentChunk || '*Trống.*' });
      currentChunk = '';
      chunkIndex++;
    }
    currentChunk += line;
  }

  // Thêm chunk cuối
  if (currentChunk) {
    const fieldName = chunkIndex === 0 ? '📜 Thư Mục Công Thức' : `📜 Công Thức (tiếp ${chunkIndex + 1})`;
    embed.addFields({ name: fieldName, value: currentChunk });
  }

  if (recipeEntries.length === 0) {
    embed.addFields({ name: '📜 Thư Mục Công Thức', value: '*Chưa có công thức.*' });
  }

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
  embed.addFields({ name: '🔥 Trạng Thái Hỏa Lò', value: queueText });
  
  embed.addFields({ name: '💼 Linh Thạch hiện có', value: `🟤 **${user.coin_ha_pham}** Linh Thạch Hạ Phẩm` });

  return embed;
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
      await interaction.reply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.',
        ephemeral: true
      });
      return;
    }

    const embed = getCraftingEmbed(userId);
    const components = getCraftingComponents(userId);

    await interaction.reply({
      embeds: [embed],
      components: components as any[]
    });
  }
}
