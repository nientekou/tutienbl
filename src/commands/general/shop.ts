import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { formatNumber } from '../../utils/constants';

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  currency?: 'knb' | 'linh_thach';
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'pill_hp_1', name: '💊 Hồi Huyết Đan - Hạ Phẩm', price: 15, desc: 'Hồi phục 50 Sinh Lực trong chiến đấu (immersive).' },
  { id: 'pill_hp_2', name: '💊 Hồi Huyết Đan - Trung Phẩm', price: 50, desc: 'Hồi phục 150 Sinh Lực.' },
  { id: 'pill_tu_vi_low', name: '💊 Sơ Cấp Tụ Khí Đan', price: 50, desc: 'Hóa khí tu vi, tăng trực tiếp **+50** Tu Vi.' },
  { id: 'pill_break_1', name: '💊 Trúc Cơ Đan', price: 300, desc: 'Bổ trợ đột phá cảnh giới từ Luyện Khí sang Trúc Cơ (+20% tỷ lệ).' },
  { id: 'pill_break_minor_1', name: '💊 Tụ Khí Đan', price: 80, desc: 'Hỗ trợ đột phá tầng nhỏ (+15% tỷ lệ).' },
  { id: 'pill_break_minor_2', name: '💊 Bồi Nguyên Đan', price: 150, desc: 'Hỗ trợ đột phá tầng nhỏ (+30% tỷ lệ).' },
  { id: 'pill_break_minor_3', name: '💊 Tạo Hóa Đan', price: 400, desc: 'Hỗ trợ đột phá tầng nhỏ (+50% tỷ lệ).' },
  { id: 'talisman_anti_loi', name: '📜 Tị Lôi Phù', price: 250, desc: 'Chống đỡ một đạo Lôi Kiếp, giảm 80% sát thương.' },
  { id: 'talisman_speed_1', name: '📜 Thần Hành Phù', price: 25, desc: 'Gia tốc linh thực hoặc thám hiểm đi 1 giờ.' },
  { id: 'seed_linh_thao_1', name: '🌾 Hạt Giống Linh Thảo', price: 5, desc: 'Hạt giống trồng linh thảo hạ phẩm.' },
  { id: 'seed_nhan_sam_1', name: '🌾 Hạt Giống Nhân Sâm', price: 15, desc: 'Hạt giống trồng Huyết Nhân Sâm.' },
  { id: 'cauldron_low', name: '🔥 Lò Luyện Đan - Hạ Phẩm', price: 500, desc: 'Lò đất sét nung, tăng 0% tỷ lệ thành công (có 10% tỷ lệ nứt vỡ khi nổ lò).' },
  { id: 'cauldron_mid', name: '🔥 Lò Luyện Đan - Trung Phẩm', price: 2000, desc: 'Lò đồng đen tinh thiết, tăng 10% tỷ lệ thành công.' },
  { id: 'cauldron_high', name: '🔥 Lò Luyện Đan - Thượng Phẩm', price: 10000, desc: 'Cổ đỉnh luyện đan khảm ngọc, tăng 25% tỷ lệ thành công.' },
  { id: 'lucky_chest', name: '🎁 Rương Cơ Duyên Lucky', price: 100, desc: 'Mở ra cơ duyên nhận ngẫu nhiên Phôi vũ khí/giáp từ F tới SSS.' },
  { id: 'chest_1tr5', name: '🎁 Rương Tôn Quý Đại Cát (1.5M)', price: 1500000, desc: 'Rương 1.5 triệu Linh Thạch. Tỷ lệ rơi kỳ trân cực cao, buff tỷ lệ đặc biệt.' },
  { id: 'item_nhan_dinh_hon', name: '💍 Nhẫn Đính Hôn', price: 500000, desc: 'Tín vật thiêng liêng để kết bái Đạo Lữ. Dùng lệnh `/daolu cau-hon`.' },
  { id: 'item_tam_sinh_thach', name: '💖 Tam Sinh Thạch', price: 5000, desc: 'Tín vật cầu hôn đạo lữ.' },
  { id: 'item_tuyet_tinh_nuoc', name: '💔 Tuyệt Tình Nước', price: 2000, desc: 'Cắt đứt duyên phận (mất 20% tu vi).' },
  { id: 'server_raid_chest', name: '🎁 Rương Boss Thế Giới', price: 10, currency: 'knb', desc: 'Rương chứa trang bị và vật phẩm quý hiếm nhận từ Boss thế giới.' },
  { id: 'item_nhan_dinh_hon_knb', name: '💍 Nhẫn Đính Hôn (KNB)', price: 50, currency: 'knb', desc: 'Tín vật đính ước, kết duyên Đạo Lữ (mua bằng KNB).' },
  { id: 'item_bloodline_pill_knb', name: '🩸 Huyết Mạch Chuyển Hóa Đan (KNB)', price: 5, currency: 'knb', desc: 'Đan dược kích hoạt hoặc chuyển hóa Huyết Mạch (mua bằng KNB).' },
  { id: 'potion_stamina_weekly', name: '🧪 Bình Thể Lực (Tuần)', price: 200, desc: 'Dịch thể linh mạch ngưng tụ, hồi phục tức thì +150 điểm Thể Lực. Giới hạn mua 6 bình/tuần.' }
];

export const SHOP_CATEGORIES = [
  {
    name: '💊 Đan Dược Tu Luyện',
    items: ['pill_hp_1', 'pill_hp_2', 'pill_tu_vi_low', 'pill_break_1', 'pill_break_minor_1', 'pill_break_minor_2', 'pill_break_minor_3', 'potion_stamina_weekly']
  },
  {
    name: '📜 Bùa Chú & Hạt Giống',
    items: ['talisman_anti_loi', 'talisman_speed_1', 'seed_linh_thao_1', 'seed_nhan_sam_1']
  },
  {
    name: '🔥 Đỉnh Luyện Đan',
    items: ['cauldron_low', 'cauldron_mid', 'cauldron_high']
  },
  {
    name: '🎁 Rương Cơ Duyên',
    items: ['lucky_chest', 'chest_1tr5', 'server_raid_chest']
  },
  {
    name: '💍 Đạo Lữ Kết Duyên',
    items: ['item_nhan_dinh_hon', 'item_tam_sinh_thach', 'item_tuyet_tinh_nuoc', 'item_nhan_dinh_hon_knb']
  },
  {
    name: '💎 Phường Thị Trân Bảo',
    items: ['item_bloodline_pill_knb']
  }
];

import db from '../../database/database';

/**
 * Lấy mã tuần hiện tại dạng YYYY-WXX theo chuẩn ISO.
 */
export function getYearWeekString(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

export function getUserWeeklyPurchases(userId: string): Record<string, number> {
  const user = userRepository.get(userId);
  if (!user) return {};
  try {
    const yCanh = JSON.parse(user.y_canh || '{}');
    const currentWeek = getYearWeekString();
    if (yCanh.weekly_purchases && yCanh.weekly_purchases.week === currentWeek) {
      return yCanh.weekly_purchases.items || {};
    }
  } catch (e) {
    // Ignore JSON errors
  }
  return {};
}

export function checkAndUpdateWeeklyLimit(userId: string, itemId: string, qty: number, maxLimit: number = 6): void {
  if (itemId !== 'potion_stamina_weekly') return;
  const user = userRepository.get(userId);
  if (!user) throw new Error('Đạo hữu chưa khởi tạo nhân vật!');

  let yCanh: any = {};
  try {
    yCanh = JSON.parse(user.y_canh || '{}');
  } catch (e) {
    yCanh = {};
  }

  const currentWeek = getYearWeekString();
  if (!yCanh.weekly_purchases || yCanh.weekly_purchases.week !== currentWeek) {
    yCanh.weekly_purchases = {
      week: currentWeek,
      items: {}
    };
  }

  const currentCount = yCanh.weekly_purchases.items[itemId] || 0;
  if (currentCount + qty > maxLimit) {
    throw new Error(`Đã vượt quá giới hạn mua tuần này! Bạn đã mua **${currentCount}/${maxLimit}** bình, không thể mua thêm **${qty}** bình.`);
  }

  yCanh.weekly_purchases.items[itemId] = currentCount + qty;
  userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });
}

/**
 * Xây dựng Embed hiển thị cửa hàng phường thị (dùng cho lệnh /shop và nút bấm trong /hoso)
 */
export function getShopEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  const weeklyPurchases = getUserWeeklyPurchases(userId);

  const embed = new EmbedBuilder()
    .setTitle('🏪 CỬA HÀNG PHƯỜNG THỊ PHÂN KHU 🏪')
    .setColor('#e67e22')
    .setDescription('Nơi tu sĩ mua sắm tài nguyên, linh dược, bùa gia tốc phục vụ đạo lộ.\n*Chọn vật phẩm từ Menu thả xuống bên dưới để mua nhanh 1 món.*')
    .setFooter({ text: 'Mẹo: Dùng /shop mua [item_id] [số lượng] để mua số lượng lớn.' })
    .setTimestamp();

  for (const cat of SHOP_CATEGORIES) {
    const catItems = SHOP_ITEMS.filter(item => cat.items.includes(item.id));
    if (catItems.length === 0) continue;

    let valueText = '';
    for (const item of catItems) {
      const currencyText = item.currency === 'knb' ? '💎 KNB' : '🟤 LT';
      let limitText = '';
      if (item.id === 'potion_stamina_weekly') {
        const count = weeklyPurchases[item.id] || 0;
        limitText = ` *(Tuần này đã mua: ${count}/6)*`;
      }
      valueText += `• **${item.name}** (\`${item.id}\`): **${formatNumber(item.price)}** ${currencyText}${limitText}\n  *${item.desc}*\n`;
    }

    embed.addFields({
      name: `✨ ${cat.name} ✨`,
      value: valueText || '*Không có vật phẩm*'
    });
  }

  embed.addFields({
    name: '💼 Tài sản của đạo hữu',
    value: `🟤 **${user ? formatNumber(user.coin_ha_pham) : 0}** Hạ Phẩm Linh Thạch\n💎 **${user ? formatNumber(user.knb) : 0}** KNB.`
  });

  return embed;
}

/**
 * Xây dựng Components (Select Menu mua nhanh) cho cửa hàng
 */
export function getShopComponents(userId: string): any[] {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`shopbuy_0_${userId}`)
    .setPlaceholder('🛒 Chọn vật phẩm để mua nhanh (1 món)...');

  // Cho phép mua nhanh các vật phẩm giá trị dưới 1M linh thạch hoặc vật phẩm KNB
  const buyableItems = SHOP_ITEMS.filter(i => i.currency === 'knb' || i.price <= 1000000).slice(0, 25);
  const weeklyPurchases = getUserWeeklyPurchases(userId);

  for (const item of buyableItems) {
    const currencyText = item.currency === 'knb' ? 'KNB' : 'LT';
    let label = `${item.name.replace(/[^\p{L}\p{N} \-]/gu, '').trim().substring(0, 80) || item.id} (${item.price} ${currencyText})`;
    if (item.id === 'potion_stamina_weekly') {
      const count = weeklyPurchases[item.id] || 0;
      label = `${item.name.replace(/[^\p{L}\p{N} \-]/gu, '').trim().substring(0, 50) || item.id} (${count}/6) (${item.price} ${currencyText})`;
    }
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(label.substring(0, 100))
        .setDescription(item.desc.substring(0, 100))
        .setValue(item.id)
    );
  }

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];
}

export default class ShopCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Cửa hàng phường thị Tu Chân.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách các vật phẩm bày bán.')
        )
        .addSubcommand(sub =>
          sub
            .setName('mua')
            .setDescription('Mua vật phẩm từ phường thị.')
            .addStringOption(opt =>
              opt
                .setName('item_id')
                .setDescription('Mã vật phẩm cần mua.')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt
                .setName('soluong')
                .setDescription('Số lượng cần mua (mặc định 1).')
                .setRequired(false)
            )
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

    if (sub === 'danhsach') {
      const embed = getShopEmbed(userId);
      const components = getShopComponents(userId);

      await interaction.reply({ embeds: [embed], components });
      return;
    }

    if (sub === 'mua') {
      const itemId = interaction.options.getString('item_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;

      if (qty <= 0) {
        await interaction.reply({ content: '❌ Số lượng mua phải lớn hơn 0!', ephemeral: true });
        return;
      }

      const item = SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) {
        await interaction.reply({ content: '❌ Vật phẩm ID này không được bán tại cửa hàng!', ephemeral: true });
        return;
      }

      const totalCost = item.price * qty;

      if (item.currency === 'knb') {
        if (user.knb < totalCost) {
          await interaction.reply({
            content: `❌ Đạo hữu không đủ KNB! (Tổng chi phí: **${totalCost}** KNB, hiện có: **${user.knb}** KNB).`,
            ephemeral: true
          });
          return;
        }

        let realItemId = item.id;
        if (item.id === 'item_nhan_dinh_hon_knb') realItemId = 'item_nhan_dinh_hon';
        if (item.id === 'item_bloodline_pill_knb') realItemId = 'item_bloodline_pill';

        const tx = db.transaction(() => {
          checkAndUpdateWeeklyLimit(userId, item.id, qty);
          userRepository.update(userId, { knb: user.knb - totalCost });
          inventoryRepository.addItem(userId, realItemId, qty);
        });

        try {
          tx();
        } catch (error: any) {
          await interaction.reply({ content: `❌ Mua hàng thất bại: ${error.message}`, ephemeral: true });
          return;
        }

        const updatedUser = userRepository.get(userId)!;

        const embed = new EmbedBuilder()
          .setTitle('🛒 MUA HÀNG THÀNH CÔNG 🛒')
          .setColor('#2ecc71')
          .setDescription(`Đạo hữu mua thành công **${qty}x ${item.name}**!`)
          .addFields(
            { name: '💎 Chi phí', value: `**-${totalCost}** KNB`, inline: true },
            { name: '💼 Số dư hiện tại', value: `**${formatNumber(updatedUser.knb)}** KNB`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        if (user.coin_ha_pham < totalCost) {
          await interaction.reply({
            content: `❌ Đạo hữu không đủ Linh Thạch! (Tổng chi phí: **${totalCost}** Linh Thạch, hiện có: **${user.coin_ha_pham}**).`,
            ephemeral: true
          });
          return;
        }

        const tx = db.transaction(() => {
          checkAndUpdateWeeklyLimit(userId, item.id, qty);
          userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - totalCost });
          inventoryRepository.addItem(userId, item.id, qty);
        });

        try {
          tx();
        } catch (error: any) {
          await interaction.reply({ content: `❌ Mua hàng thất bại: ${error.message}`, ephemeral: true });
          return;
        }

        const updatedUser = userRepository.get(userId)!;

        const embed = new EmbedBuilder()
          .setTitle('🛒 MUA HÀNG THÀNH CÔNG 🛒')
          .setColor('#2ecc71')
          .setDescription(`Đạo hữu mua thành công **${qty}x ${item.name}**!`)
          .addFields(
            { name: '🪙 Chi phí', value: `**-${totalCost}** Linh Thạch Hạ Phẩm`, inline: true },
            { name: '💼 Số dư hiện tại', value: `**${formatNumber(updatedUser.coin_ha_pham)}** Linh Thạch`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    }
  }
}
