import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { systemConfigService } from '../../services/SystemConfigService';
import db from '../../database/database';
import { formatNumber } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';

// Ánh xạ item_id → giá mua lại từ người chơi (50% giá gốc)
const NPC_BUYBACK_PRICES: Record<string, { price: number; currency?: 'knb' }> = {
  // Đan dược cơ bản
  [ITEMS.PILL_HP_1]: { price: 7 },
  [ITEMS.PILL_HP_2]: { price: 25 },
  [ITEMS.PILL_TU_VI_LOW]: { price: 25 },
  [ITEMS.PILL_BREAK_1]: { price: 150 },
  [ITEMS.PILL_BREAK_MINOR_1]: { price: 40 },
  [ITEMS.PILL_BREAK_MINOR_2]: { price: 75 },
  [ITEMS.PILL_BREAK_MINOR_3]: { price: 200 },
  [ITEMS.PILL_STAMINA_1]: { price: 100 },
  [ITEMS.PILL_STAMINA_2]: { price: 250 },
  [ITEMS.PILL_STAMINA_3]: { price: 600 },

  // Bùa chú
  [ITEMS.TALISMAN_ANTI_LOI]: { price: 125 },
  [ITEMS.TALISMAN_SPEED_1]: { price: 12 },

  // Hạt giống
  [ITEMS.SEED_LINH_THAO_1]: { price: 2 },
  [ITEMS.SEED_NHAN_SAM_1]: { price: 7 },
  [ITEMS.SEED_TUYET_LIEN]: { price: 150 },
  [ITEMS.SEED_LINGZHI]: { price: 250 },
  [ITEMS.SEED_NGODONG]: { price: 400 },

  // Luyện khí
  [ITEMS.CAULDRON_LOW]: { price: 250 },
  [ITEMS.CAULDRON_MID]: { price: 1000 },
  [ITEMS.CAULDRON_HIGH]: { price: 5000 },

  // Rương
  [ITEMS.LUCKY_CHEST]: { price: 50 },
  [ITEMS.SERVER_RAID_CHEST]: { price: 5, currency: 'knb' },

  // Đạo lữ
  [ITEMS.ITEM_TAM_SINH_THACH]: { price: 2500 },
  [ITEMS.ITEM_TUYET_TINH_NUOC]: { price: 1000 },

  // Nguyên liệu
  [ITEMS.MATERIAL_IRON_1]: { price: 5 },
  [ITEMS.MAT_HUYEN_THIET]: { price: 15 },
  [ITEMS.ITEM_FRAGMENT]: { price: 100 },
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
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
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
        await interaction.editReply({ content: '❌ Số lượng không hợp lệ!' });
        return;
      }

      const inv = inventoryRepository.get(invId);
      if (!inv) {
        await interaction.editReply({ content: '❌ Vật phẩm không tồn tại trong hành trang của bạn!' });
        return;
      }
      if (inv.is_equipped === 1) {
        await interaction.editReply({ content: '❌ Vật phẩm đang trang bị không thể bán!' });
        return;
      }
      if (inv.quantity < qty) {
        await interaction.editReply({ content: `❌ Đạo hữu chỉ có **${inv.quantity}** vật phẩm này trong hành trang!` });
        return;
      }

      const priceConfig = NPC_BUYBACK_PRICES[inv.item_id];
      if (!priceConfig) {
        await interaction.editReply({ content: '❌ NPC không thu mua vật phẩm này!' });
        return;
      }

      const totalPrice = priceConfig.price * qty;
      const now = Math.floor(Date.now() / 1000);

      db.transaction(() => {
        // Trừ vật phẩm
        inv.quantity -= qty;
        if (inv.quantity <= 0) {
          db.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
        } else {
          db.prepare('UPDATE inventories SET quantity = ? WHERE id = ?').run(inv.quantity, inv.id);
        }

        // Cộng tiền
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalPrice });

        // Ghi audit log
        systemConfigService.writeAuditLog(userId, 'sell_to_npc', {
          itemId: inv.item_id,
          quantity: qty,
          price: totalPrice,
          inventoryId: inv.id,
        });
      })();

      const itemName = db.prepare('SELECT name FROM items WHERE id = ?').get(inv.item_id) as { name: string } | undefined;

      await interaction.editReply({
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

    await interaction.editReply({ embeds: [embed] });
  }
}
