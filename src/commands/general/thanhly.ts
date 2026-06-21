import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { systemConfigService } from '../../services/SystemConfigService';
import db from '../../database/database';
import { formatNumber } from '../../utils/constants';

// Ánh xạ item_id → giá mua lại từ người chơi (50% giá gốc)
const NPC_BUYBACK_PRICES: Record<string, { price: number; currency?: 'knb' }> = {
  // Đan dược cơ bản
  'pill_hp_1': { price: 7 },
  'pill_hp_2': { price: 25 },
  'pill_tu_vi_low': { price: 25 },
  'pill_break_1': { price: 150 },
  'pill_break_minor_1': { price: 40 },
  'pill_break_minor_2': { price: 75 },
  'pill_break_minor_3': { price: 200 },
  'pill_stamina_1': { price: 100 },
  'pill_stamina_2': { price: 250 },
  'pill_stamina_3': { price: 600 },

  // Bùa chú
  'talisman_anti_loi': { price: 125 },
  'talisman_speed_1': { price: 12 },

  // Hạt giống
  'seed_linh_thao_1': { price: 2 },
  'seed_nhan_sam_1': { price: 7 },
  'seed_tuyet_lien': { price: 150 },
  'seed_lingzhi': { price: 250 },
  'seed_ngodong': { price: 400 },

  // Luyện khí
  'cauldron_low': { price: 250 },
  'cauldron_mid': { price: 1000 },
  'cauldron_high': { price: 5000 },

  // Rương
  'lucky_chest': { price: 50 },
  'server_raid_chest': { price: 5, currency: 'knb' },

  // Đạo lữ
  'item_tam_sinh_thach': { price: 2500 },
  'item_tuyet_tinh_nuoc': { price: 1000 },

  // Nguyên liệu
  'material_iron_1': { price: 5 },
  'mat_huyen_thiet': { price: 15 },
  'item_fragment': { price: 100 },
};

export default class ThanhLyCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('thanhly')
        .setDescription('Thanh lý vật phẩm cho NPC để lấy Linh Thạch (50% giá gốc).')
        .addSubcommand(sub =>
          sub
            .setName('item')
            .setDescription('Bán một vật phẩm từ hành trang.')
            .addIntegerOption(opt =>
              opt.setName('inventory_id')
                .setDescription('Mã hành trang của vật phẩm (xem trong /tuido)')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName('soluong')
                .setDescription('Số lượng (mặc định 1)')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách vật phẩm NPC thu mua và giá.')
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
      await this.handleDanhSach(interaction);
      return;
    }

    if (sub === 'item') {
      const invId = interaction.options.getInteger('inventory_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;

      if (qty <= 0) {
        await interaction.reply({ content: '❌ Số lượng không hợp lệ!', ephemeral: true });
        return;
      }

      const inv = inventoryRepository.get(invId);
      if (!inv || inv.user_id !== userId) {
        await interaction.reply({ content: '❌ Vật phẩm không tồn tại trong hành trang của bạn!', ephemeral: true });
        return;
      }
      if (inv.is_equipped === 1) {
        await interaction.reply({ content: '❌ Vật phẩm đang trang bị không thể bán!', ephemeral: true });
        return;
      }
      if (inv.quantity < qty) {
        await interaction.reply({ content: `❌ Bạn chỉ có **${inv.quantity}** vật phẩm này trong hành trang!`, ephemeral: true });
        return;
      }

      const priceConfig = NPC_BUYBACK_PRICES[inv.item_id];
      if (!priceConfig) {
        await interaction.reply({ content: '❌ NPC không thu mua vật phẩm này!', ephemeral: true });
        return;
      }

      const totalPrice = priceConfig.price * qty;
      const now = Math.floor(Date.now() / 1000);

      db.transaction(() => {
        // Trừ vật phẩm
        inv.quantity -= qty;
        if (inv.quantity <= 0) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(invId);
        } else {
          db.prepare('UPDATE inventories SET quantity = ? WHERE id = ?').run(inv.quantity, invId);
        }

        // Cộng tiền
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalPrice });

        // Ghi audit log
        systemConfigService.writeAuditLog(userId, 'sell_to_npc', {
          itemId: inv.item_id,
          quantity: qty,
          price: totalPrice,
          inventoryId: invId,
        });
      })();

      const itemName = db.prepare('SELECT name FROM items WHERE id = ?').get(inv.item_id) as { name: string } | undefined;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🛒 BÁN CHO NPC THÀNH CÔNG')
            .setColor('#2ecc71')
            .setDescription(`Đã bán **${qty}x ${itemName?.name || inv.item_id}** cho NPC Thương Nhân.`)
            .addFields(
              { name: '💰 Thu được', value: `**+${formatNumber(totalPrice)}** Hạ Phẩm Linh Thạch`, inline: true },
              { name: '💼 Số dư mới', value: `**${formatNumber(user.coin_ha_pham + totalPrice)}** Linh Thạch`, inline: true }
            )
            .setTimestamp()
        ]
      });
    }
  }

  private async handleDanhSach(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📋 NPC THU MUA VẬT PHẨM')
      .setColor('#e67e22')
      .setDescription('Bán vật phẩm cho NPC Thương Nhân để nhận **50%** giá gốc.')
      .setTimestamp();

    const categorized: Record<string, { id: string; name: string; price: number }[]> = {};

    for (const [itemId, config] of Object.entries(NPC_BUYBACK_PRICES)) {
      const item = db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string } | undefined;
      if (!item) continue;

      let cat = 'Khác';
      if (itemId.startsWith('pill_') || itemId.startsWith('potion_')) cat = '💊 Đan Dược';
      else if (itemId.startsWith('talisman_')) cat = '📜 Bùa Chú';
      else if (itemId.startsWith('seed_')) cat = '🌾 Hạt Giống';
      else if (itemId.startsWith('cauldron_')) cat = '🔥 Luyện Khí';
      else if (itemId.startsWith('lucky_') || itemId.startsWith('chest_') || itemId.startsWith('server_')) cat = '🎁 Rương';
      else if (itemId.startsWith('item_')) cat = '💍 Vật Phẩm Đặc Biệt';
      else if (itemId.startsWith('material_') || itemId.startsWith('mat_')) cat = '⛏️ Nguyên Liệu';

      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push({ id: itemId, name: item.name, price: config.price });
    }

    for (const [cat, items] of Object.entries(categorized)) {
      const value = items.map(i => `• **${i.name}** (\`${i.id}\`) → **${formatNumber(i.price)}** LT`).join('\n');
      embed.addFields({ name: cat, value, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
