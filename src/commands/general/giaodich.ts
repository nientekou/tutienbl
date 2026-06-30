import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { tradingPostService } from '../../services/TradingPostService';
import { EMBED_COLORS } from '../../utils/uiSystem';
import db from '../../database/database';

export default class GiaoDichCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('giaodich')
        .setDescription('Chợ Đồng Hành — mua bán vật phẩm giữa người chơi.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách vật phẩm đang bán.')
        )
        .addSubcommand(sub =>
          sub
            .setName('ban')
            .setDescription('Bán vật phẩm lên chợ.')
            .addIntegerOption(opt =>
              opt.setName('inventory_id')
                .setDescription('ID vật phẩm trong hành trang')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName('gia')
                .setDescription('Giá bán (LT, tối thiểu 100)')
                .setRequired(true)
                .setMinValue(100)
            )
            .addIntegerOption(opt =>
              opt.setName('soluong')
                .setDescription('Số lượng (mặc định: 1)')
                .setRequired(false)
                .setMinValue(1)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('mua')
            .setDescription('Mua vật phẩm từ chợ.')
            .addIntegerOption(opt =>
              opt.setName('listing_id')
                .setDescription('Mã giao dịch (xem trong danhsach)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('cuatoi')
            .setDescription('Xem các giao dịch của bản thân.')
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
      const description = tradingPostService.getListingDescription();
      const embed = new EmbedBuilder()
        .setTitle('🏪 Chợ Đồng Hành')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(description)
        .setFooter({ text: 'Dùng /giaodich mua listing_id:<mã> để mua' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'ban') {
      const invId = interaction.options.getInteger('inventory_id', true);
      const price = interaction.options.getInteger('gia', true);
      const qty = interaction.options.getInteger('soluong') || 1;

      const inv = inventoryRepository.get(invId);
      if (!inv || inv.user_id !== userId) {
        await interaction.editReply({ content: '❌ Vật phẩm không tồn tại!' });
        return;
      }
      if (inv.is_equipped === 1) {
        await interaction.editReply({ content: '❌ Không thể bán trang bị đang đeo!' });
        return;
      }
      if (inv.quantity < qty) {
        await interaction.editReply({ content: `❌ Chỉ có ${inv.quantity} vật phẩm này!` });
        return;
      }

      const item = db.prepare('SELECT name FROM items WHERE id = ?').get(inv.item_id) as { name: string } | undefined;
      const itemName = item?.name || inv.item_id;

      // Deduct item first
      if (inv.quantity > qty) {
        db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(qty, invId);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(invId);
      }

      const result = tradingPostService.createListing(userId, inv.item_id, itemName, qty, price);
      const embed = new EmbedBuilder()
        .setTitle(result.success ? '✅ Đã Đăng Bán' : '❌ Lỗi')
        .setColor(result.success ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
        .setDescription(result.message);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'mua') {
      const listingId = interaction.options.getInteger('listing_id', true);
      const result = tradingPostService.acceptTrade(userId, listingId);
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Mua Thành Công')
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(result.message);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: result.message });
      }
      return;
    }

    if (sub === 'cuatoi') {
      const now = Math.floor(Date.now() / 1000);
      const myListings = db.prepare(
        'SELECT * FROM trading_posts WHERE seller_id = ? AND expires_at > ? ORDER BY created_at DESC'
      ).all(userId, now) as any[];

      if (myListings.length === 0) {
        await interaction.editReply({ content: '📭 Bạn chưa có giao dịch nào đang bán.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Giao Dịch Của Tôi')
        .setColor(EMBED_COLORS.INFO)
        .setDescription(
          myListings.map((l: any) => {
            const timeLeft = Math.max(0, l.expires_at - now);
            const hours = Math.floor(timeLeft / 3600);
            const status = l.buyer_id ? `✅ Đã bán cho <@${l.buyer_id}>` : `🕐 Còn ${hours}h`;
            return `#${l.id}: **${l.quantity}x ${l.item_name}** — ${l.ask_price} LT (${status})`;
          }).join('\n')
        );
      await interaction.editReply({ embeds: [embed] });
    }
  }
}
