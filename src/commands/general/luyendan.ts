import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { alchemyService, ALCHEMY_RECIPES } from '../../services/AlchemyService';
import { getProgressBar } from '../../utils/constants';
import db from '../../database/database';
import { ITEMS } from '../../config/itemConstants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import { container, header, body, separator, V2_COLORS } from '../../utils/v2Components';

export default class LuyenDanCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('luyendan')
        .setDescription('Mở phòng Luyện Đan, nấu chế linh đan dược liệu tiên gia.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const embed = this.getAlchemyEmbed(userId);
    const rows = this.getAlchemyComponents(userId);

    await interaction.editReply(toV2Payload([embed], rows ));
  }

  /**
   * Tạo V2 Container hiển thị giao diện Luyện Đan
   */
  public getAlchemyEmbed(userId: string): ContainerBuilder {
    const user = userRepository.get(userId)!;
    const alchemyLevel = user.alchemy_level || 1;
    const alchemyExp = user.alchemy_exp || 0;
    const expNeeded = alchemyLevel * 100;
    const expBar = getProgressBar(alchemyExp, expNeeded, 10);

    // Lấy chế tác quantity
    let yCanh: any = {};
    try {
      yCanh = JSON.parse(user.y_canh || '{}');
    } catch (e) {
      yCanh = {};
    }
    const craftQty = yCanh.active_craft_quantity || 1;

    // Tìm lò luyện tốt nhất trong hành trang
    const inv = inventoryRepository.getUserInventory(userId);
    const cauldrons = inv.filter(i => i.type === 'cauldron');
    
    let bestCauldronText = 'Không có lò (dùng tay không, +0% tỷ lệ)';
    let bestCauldron: any = null;

    if (cauldrons.length > 0) {
      // Ưu tiên: cauldron_high > cauldron_mid > cauldron_low
      const order = [ITEMS.CAULDRON_HIGH, ITEMS.CAULDRON_MID, ITEMS.CAULDRON_LOW];
      for (const cid of order) {
        bestCauldron = cauldrons.find(i => i.item_id === cid);
        if (bestCauldron) break;
      }
    }

    let successBonus = 0.0;
    if (bestCauldron) {
      try {
        const stats = JSON.parse(bestCauldron.base_stats || bestCauldron.stats || '{}');
        successBonus = stats.success_rate_bonus || 0.0;
        bestCauldronText = `🔥 **${bestCauldron.name}** (+${successBonus * 100}% tỷ lệ thành công)`;
      } catch (e) {
        bestCauldronText = `🔥 **${bestCauldron.name}**`;
      }
    }

    // Tông Môn Đan Đường cộng thêm tỷ lệ thành công
    let sectBonus = 0.0;
    if (user.sect_id) {
      try {
        const sect = db.prepare('SELECT dan_duong_level FROM sects WHERE id = ?').get(user.sect_id) as { dan_duong_level: number } | undefined;
        if (sect && sect.dan_duong_level) {
          sectBonus = sect.dan_duong_level * 0.02; // +2% mỗi cấp
        }
      } catch (e) {}
    }

    // Cộng hưởng Hỏa Linh Căn
    let hoaLinhCan = 0;
    try {
      const lc = JSON.parse(user.linh_can || '{}');
      hoaLinhCan = lc['Hỏa'] || 0;
    } catch (e) {}
    const hoaBonus = hoaLinhCan * 0.001;

    const content: any[] = [
      header(`🌿 LINH DƯỢC LUYỆN ĐAN PHÒNG - ${user.name}`, 'Đạo hữu đang ngự tại phòng luyện chế linh đan tiên gia.'),
      separator(),
      body(
        `🏆 **Cấp Luyện Đan Sư:** Cấp **${alchemyLevel}**\n` +
        `${expBar} *(EXP: **${alchemyExp}/${expNeeded}**)*\n\n` +
        `🔋 **Thể Lực Hiện Tại:** **${user.stamina}/500**\n` +
        `⚙️ **Lò Luyện Sử Dụng:** ${bestCauldronText}\n` +
        `⚡ **Chế Tác Hiện Tại:** **x${craftQty} mẻ** ${craftQty === 2 ? '(Linh Sư / Lò Thượng Phẩm)' : ''}\n\n` +
        `*Chú ý: Hệ thống tự động chọn Lò luyện đan tốt nhất trong hành trang để tối ưu tỷ lệ thành công.*`
      ),
      separator()
    ];

    // Liệt kê các công thức
    for (const recipe of ALCHEMY_RECIPES) {
      const matText = recipe.requiredMaterials.map(m => {
        const itemInfo = inventoryRepository.getUserInventory(userId).find(i => i.item_id === m.itemId);
        const nameMap: Record<string, string> = {
          [ITEMS.MATERIAL_LINH_THAO_1]: 'Linh Thảo Hạ Phẩm',
          [ITEMS.MATERIAL_NHAN_SAM_1]: 'Huyết Nhân Sâm',
          [ITEMS.MATERIAL_IRON_1]: 'Huyền Thiết Sa',
          [ITEMS.ITEM_FRAGMENT]: 'Mảnh Trang Bị',
          [ITEMS.MATERIAL_BLOOD_FLOWER]: 'Huyết Hoa',
          [ITEMS.MATERIAL_VOID_HERB]: 'Hư Không Thảo',
          [ITEMS.MATERIAL_WIND_LEAF]: 'Thiên Phong Diệp'
        };
        const name = nameMap[m.itemId] || m.itemId;
        
        const reqQty = m.quantity * craftQty;
        const hasEnoughMat = itemInfo && itemInfo.quantity >= reqQty;
        const statusEmoji = hasEnoughMat ? '✅' : '❌';

        return `${statusEmoji} ${name}: **${itemInfo ? itemInfo.quantity : 0}/${reqQty}**`;
      }).join('\n');

      const isLocked = alchemyLevel < recipe.requiredAlchemyLevel;
      
      let rateText = '';
      if (isLocked) {
        rateText = '🔒 *Chưa đủ cấp luyện chế*';
      } else {
        const levelDiff = Math.max(0, alchemyLevel - recipe.requiredAlchemyLevel);
        const levelBonus = levelDiff * 0.02;
        const finalSuccessRate = Math.min(0.95, recipe.baseSuccessRate + successBonus + levelBonus + sectBonus + hoaBonus);
        
        const rateBar = getProgressBar(Math.round(finalSuccessRate * 100), 100, 10);

        let costCoinText = `${recipe.costCoin}`;
        let staminaCostText = `${recipe.staminaCost}`;
        if (craftQty === 2) {
          costCoinText = `${recipe.costCoin * 2} *(x2)*`;
          staminaCostText = `${recipe.staminaCost * 2} *(x2)*`;
        }

        rateText = `⚡ Tỷ lệ thành công: **${Math.round(finalSuccessRate * 100)}%**\n${rateBar}\n` +
                   `└ Gốc: ${recipe.baseSuccessRate * 100}% │ Lò: +${successBonus * 100}% │ Cấp: +${Math.round(levelBonus * 100)}% │ Hỏa: +${(hoaBonus * 100).toFixed(1)}%\n` +
                   `🔋 Tiêu hao: **${staminaCostText}** Thể lực │ 🪙 Phí: **${costCoinText}** Linh thạch`;
      }

      content.push(body(`**🔮 Công Thức: ${recipe.name} (Yêu cầu cấp: ${recipe.requiredAlchemyLevel})**\n${matText}\n${rateText}`));
      content.push(separator());
    }

    if (content.length > 0) {
      content.pop(); // Xóa separator cuối cùng
    }

    return container(V2_COLORS.success, content);
  }

  /**
   * Tạo Action Row nút bấm luyện đan
   */
  public getAlchemyComponents(userId: string): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
    const user = userRepository.get(userId)!;
    const alchemyLevel = user.alchemy_level || 1;

    let yCanh: any = {};
    try {
      yCanh = JSON.parse(user.y_canh || '{}');
    } catch (e) {
      yCanh = {};
    }
    const craftQty = yCanh.active_craft_quantity || 1;

    const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

    // Row 1: Toggle Quantity button & Back button
    const rowQty = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`alch_toggleqty_${userId}`)
        .setLabel(`Chế tác: x${craftQty} mẻ ${craftQty === 2 ? '🔥' : '⏳'}`)
        .setStyle(craftQty === 2 ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Quay Lại Hồ Sơ')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(rowQty);

    // Row 2: Recipe select menu
    const recipeSelect = new StringSelectMenuBuilder()
      .setCustomId(`alch_select_${userId}`)
      .setPlaceholder('📜 Chọn công thức luyện đan...');

    for (const recipe of ALCHEMY_RECIPES) {
      const isLocked = alchemyLevel < recipe.requiredAlchemyLevel;
      recipeSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Nấu ${recipe.name}${isLocked ? ' 🔒' : ''}`)
          .setDescription(`Level yêu cầu: ${recipe.requiredAlchemyLevel}`)
          .setValue(recipe.id)
      );
    }

    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(recipeSelect));

    return rows;
  }
}
