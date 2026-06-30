import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { blacksmithService } from '../../services/BlacksmithService';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';
import { toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

export default class LuyenKhiCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('luyenkhi')
        .setDescription('Mở phòng rèn đúc trang bị (Blacksmithing)')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const embed = getLuyenKhiEmbed(userId);
    if (!embed) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }
    const components = getLuyenKhiComponents(userId);
    await interaction.editReply(toV2Payload([embed], components));
  }
}

export function getLuyenKhiEmbed(userId: string): ContainerBuilder | null {
  const user = userRepository.get(userId);
  if (!user) return null;

  const anyUser = user as any;
  const level = anyUser.forging_level || 1;
  const exp = anyUser.forging_exp || 0;
  const expNeeded = level * 150;
  const expBar = getProgressBar(exp, expNeeded, 10);

  const content: any[] = [
    header('🛠️ PHÒNG RÈN ĐÚC (LUYỆN KHÍ SƯ)', `Đạo hiệu: **${user.name}**\nCảnh Giới Luyện Khí: **Cấp ${level} Luyện Khí Sư**\nTiến Độ EXP: ${expBar} **(${exp}/${expNeeded})**\n\n*Sử dụng khoáng thạch và linh thạch để rèn đúc trang bị, đạo bào, vũ khí siêu cấp. Hãy chọn một công thức rèn ở menu bên dưới!*`)
  ];

  const recipes = blacksmithService.getRecipes();
  const inv = inventoryRepository.getUserInventory(userId);

  const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);

  if (visibleRecipes.length === 0) {
    content.push(separator());
    content.push(body('Chưa có công thức rèn nào phù hợp với cảnh giới của đạo hữu.'));
  } else {
    visibleRecipes.forEach(r => {
      const isLocked = user.level < r.minLevel;
      const title = `${isLocked ? '🔒' : '⚒️'} **${r.name}** ${isLocked ? `(Yêu cầu: Cấp độ ${r.minLevel})` : ''}`;
      
      const ingredientsText = r.ingredients
        .map(ing => {
          const item = db.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId) as { name: string } | undefined;
          const entry = inv.find(i => i.item_id === ing.itemId && i.is_equipped === 0);
          const count = entry ? entry.quantity : 0;
          const hasEnough = count >= ing.quantity;
          return `  ${hasEnough ? '✅' : '❌'} ${item ? item.name : ing.itemId}: **${count}/${ing.quantity}**`;
        })
        .join('\n');

      const descText = `• Mô tả: *${r.description}*\n` +
                       `• Chi phí: **${r.cost}** Linh Thạch │ **15** Thể Lực\n` +
                       `• Nguyên liệu yêu cầu:\n${ingredientsText}`;

      content.push(separator());
      content.push(body(`${title}\n${descText}`));
    });
  }

  content.push(separator());
  content.push(body(`*Thể lực hiện tại: **${user.stamina}/500** │ Linh Thạch: **${user.coin_ha_pham}***`));

  return container(V2_COLORS.gold, content);
}

export function getLuyenKhiComponents(userId: string): ActionRowBuilder<any>[] {
  const user = userRepository.get(userId);
  const rows: ActionRowBuilder<any>[] = [];
  if (!user) return rows;

  const recipes = blacksmithService.getRecipes();
  const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);

  if (visibleRecipes.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`luyenkhiselect_1_${userId}`)
      .setPlaceholder('🛠️ Chọn công thức rèn trang bị');

    for (const r of visibleRecipes) {
      const isLocked = user.level < r.minLevel;
      const labelStr = isLocked ? `[KHÓA] ${r.name}` : `[Cấp ${r.minLevel}] ${r.name}`;
      
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(labelStr)
          .setValue(r.id)
          .setDescription(`Tốn ${r.cost} LT & 15 Thể Lực.`)
      );
    }
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hosoback_${userId}`)
      .setLabel('🔙 Quay Lại Hồ Sơ')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(backRow);

  return rows;
}
