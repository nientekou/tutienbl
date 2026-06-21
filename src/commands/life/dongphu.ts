import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { caveService } from '../../services/CaveService';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import db from '../../database/database';

export function buildCaveEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor('#e74c3c')
      .setDescription('Nhân vật không tồn tại.');
  }

  const cave = caveService.getCave(userId);
  
  // Tính toán buff tu vi
  let expBuff = 1;
  if (cave.level === 2) expBuff = 2;
  if (cave.level === 3) expBuff = 4;
  if (cave.level === 4) expBuff = 6;
  if (cave.level >= 5) expBuff = 10;

  // Hồi phục Linh Tuyền tối đa hàng ngày để hiển thị thông tin
  let maxSpring = 1;
  if (cave.level === 2) maxSpring = 2;
  else if (cave.level === 3) maxSpring = 2;
  else if (cave.level === 4) maxSpring = 3;
  else if (cave.level >= 5) maxSpring = 3;

  const embed = new EmbedBuilder()
    .setTitle(`🏔️ ĐỘNG PHỦ CÁ NHÂN - ${user.name}`)
    .setDescription(`Đây là không gian thiền định và hấp thụ tinh hoa linh khí của đạo hữu. Nâng cấp động phủ giúp tăng tốc độ hấp thu linh khí và số lần ngâm mình Linh Tuyền.`)
    .setColor('#2ecc71')
    .setTimestamp();

  embed.addFields([
    { name: 'Cấp Động Phủ', value: `Lv.${cave.level}/5`, inline: true },
    { name: 'Hiệu Ứng Tu Luyện', value: `+${expBuff}% Tu Vi khi Thiền Định`, inline: true },
    { name: 'Linh Tuyền Hằng Ngày', value: `💧 **${cave.spring_available}/${maxSpring}** lượt hôm nay`, inline: true }
  ]);

  // Nâng Cấp Yêu Cầu
  const nextLevel = cave.level + 1;
  const cost = caveService.getUpgradeCost(cave.level);
  if (cost) {
    const inv = inventoryRepository.getUserInventory(userId);
    let upgradeReqText = `• Chi phí: **${cost.lt}** Linh Thạch Hạ Phẩm (Đang có: **${user.coin_ha_pham}**)\n`;
    if (cost.reqItems.length > 0) {
      upgradeReqText += `• Nguyên liệu yêu cầu:\n`;
      cost.reqItems.forEach(req => {
        const itemInfo = db.prepare('SELECT name FROM items WHERE id = ?').get(req.id) as { name: string } | undefined;
        const name = itemInfo ? itemInfo.name : req.id;
        const userItem = inv.find(i => i.item_id === req.id && i.is_equipped === 0);
        const userQty = userItem ? userItem.quantity : 0;
        const hasEnough = userQty >= req.quantity;
        upgradeReqText += `  ${hasEnough ? '✅' : '❌'} ${name}: **${userQty}/${req.quantity}**\n`;
      });
    } else {
      upgradeReqText += `• Không yêu cầu nguyên liệu đặc biệt.\n`;
    }
    embed.addFields({ name: `⬆️ Yêu Cầu Nâng Cấp Động Phủ (Lên Cấp ${nextLevel})`, value: upgradeReqText, inline: false });
  } else {
    embed.addFields({ name: `⬆️ Yêu Cầu Nâng Cấp`, value: `🎉 **Động Phủ đã đạt cấp tối đa (Cấp 5)!** Linh khí sung túc, tịnh thất chí cao.`, inline: false });
  }

  return embed;
}

export function buildCaveComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const cave = caveService.getCave(userId);
  const cost = caveService.getUpgradeCost(cave.level);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`dongphuspring_${userId}`)
      .setLabel('🌊 Ngâm Linh Tuyền')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(cave.spring_available <= 0),
    new ButtonBuilder()
      .setCustomId(`dongphuupgrade_${userId}`)
      .setLabel('⬆️ Nâng Cấp')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!cost)
  );

  return [row];
}

export default class DongPhuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dongphu')
        .setDescription('Quản lý Động Phủ Cá Nhân của bạn.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật!', ephemeral: true });
      return;
    }

    const embed = buildCaveEmbed(userId);
    const components = buildCaveComponents(userId);

    await interaction.reply({ embeds: [embed], components });
  }
}
