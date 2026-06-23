import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { blacksmithService } from '../../services/BlacksmithService';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';

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
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const anyUser = user as any;
    const level = anyUser.forging_level || 1;
    const exp = anyUser.forging_exp || 0;
    const expNeeded = level * 150;
    const expBar = getProgressBar(exp, expNeeded, 10);

    const embed = new EmbedBuilder()
      .setTitle('🛠️ PHÒNG RÈN ĐÚC (LUYỆN KHÍ SƯ)')
      .setColor('#e67e22')
      .setDescription(
        `Đạo hiệu: **${user.name}**\n` +
        `Cảnh Giới Luyện Khí: **Cấp ${level} Luyện Khí Sư**\n` +
        `Tiến Trình EXP: ${expBar} **(${exp}/${expNeeded})**\n\n` +
        `*Sử dụng khoáng thạch và linh thạch để rèn đúc trang bị, đạo bào, vũ khí siêu cấp. Hãy chọn một công thức rèn ở menu bên dưới!*`
      )
      .setThumbnail('https://i.imgur.com/vHqAOYZ.png')
      .setFooter({ text: `Thể lực hiện tại: ${user.stamina}/500 | Linh Thạch: ${user.coin_ha_pham}` });

    const recipes = blacksmithService.getRecipes();
    const inv = inventoryRepository.getUserInventory(userId);

    // Lọc công thức hiển thị được (cấp độ người chơi >= cấp công thức - 20)
    // Để không hiển thị quá nhiều
    const visibleRecipes = recipes.filter(r => user.level >= Math.max(1, r.minLevel - 20)).slice(0, 25);

    if (visibleRecipes.length === 0) {
      embed.addFields({ name: 'Trống', value: 'Chưa có công thức rèn nào phù hợp với cảnh giới của đạo hữu.' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    visibleRecipes.forEach(r => {
      const isLocked = user.level < r.minLevel;
      const title = `${isLocked ? '🔒' : '⚒️'} **${r.name}** ${isLocked ? `(Yêu cầu: Cấp độ ${r.minLevel})` : ''}`;
      
      const ingredientsText = r.ingredients
        .map(ing => {
          const item = db.prepare('SELECT name FROM items WHERE id = ?').get(ing.itemId) as { name: string } | undefined;
          const entry = inv.find(i => i.item_id === ing.itemId && i.is_equipped === 0);
          const count = entry ? entry.quantity : 0;
          const hasEnough = count >= ing.quantity;
          return `${hasEnough ? '✅' : '❌'} ${item ? item.name : ing.itemId}: ${count}/${ing.quantity}`;
        })
        .join('\n');

      const descText = `• Mô tả: *${r.description}*\n` +
                       `• Chi phí: **${r.cost}** Linh Thạch | **15** Thể Lực\n` +
                       `• Nguyên liệu yêu cầu:\n${ingredientsText}`;

      embed.addFields({ name: title, value: descText, inline: false });
    });

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

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
