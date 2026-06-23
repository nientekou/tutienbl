import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { getShopEmbed, getShopComponents } from './shop';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import { ITEMS } from '../../config/itemConstants';


export const SKILL_BOOKS = [
  { id: ITEMS.BOOK_FIRE, name: '🔥 Bí Tịch: Liệt Diễm Quyết', price: 500, element: 'Hỏa', desc: 'Sách hỏa hệ linh lực, dùng học Liệt Diễm Quyết. Sát thương cực mạnh thiêu đốt đối thủ.' },
  { id: ITEMS.BOOK_WATER, name: '💧 Bí Tịch: Thủy Linh Quyết', price: 500, element: 'Thủy', desc: 'Sách thủy hệ linh lực, dùng học Thủy Linh Quyết. Tấn công hồi phục sinh lực bản thân.' },
  { id: ITEMS.BOOK_WOOD, name: '🌿 Bí Tịch: Hấp Huyết Quyết', price: 500, element: 'Mộc', desc: 'Sách mộc hệ linh lực, dùng học Hấp Huyết Quyết. Tấn công hút sinh khí địch nhân.' },
  { id: ITEMS.BOOK_EARTH, name: '🪨 Bí Tịch: Thổ Giáp Quyết', price: 500, element: 'Thổ', desc: 'Sách thổ hệ linh lực, dùng học Thổ Giáp Quyết. Tạo hộ盾 giáp hấp thụ sát thương.' },
  { id: ITEMS.BOOK_WIND, name: '🌀 Bí Tịch: Phong Hành Quyết', price: 500, element: 'Phong', desc: 'Sách phong hệ linh lực, dùng học Phong Hành Quyết. Gia tăng tốc độ né tránh cực đỉnh.' },
  { id: ITEMS.BOOK_LIGHTNING, name: '⚡ Bí Tịch: Lôi Phạt Quyết', price: 1000, element: 'Lôi', desc: 'Sách lôi phạt viễn cổ, dùng học Lôi Phạt Quyết. Tê liệt mục tiêu trong combat.' }
];

/**
 * Xây dựng Embed cửa hàng bí tịch kỹ năng (dùng cho lệnh và nút bấm trong /hoso)
 */
export function getShopKyNangEmbed(userId: string): EmbedBuilder {
  return getShopEmbed(userId, 'congphap');
}

export function getShopKyNangComponents(userId: string): any[] {
  return getShopComponents(userId, 'congphap');
}

export default class ShopKyNangCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('shopkynang')
        .setDescription('Cửa hàng bí tịch thần thông kình thiên.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách các loại bí tịch bày bán.')
        )
        .addSubcommand(sub =>
          sub
            .setName('mua')
            .setDescription('Mua bí tịch kỹ năng tu chân.')
            .addStringOption(opt =>
              opt
                .setName('book_id')
                .setDescription('Mã sách kỹ năng cần mua.')
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
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'danhsach') {
      const embed = new EmbedBuilder()
        .setTitle('🏪 VẠN PHÁP SƠN TRANG - THỦ THƯ TIÊN CÁC')
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription('Nơi tu sĩ mua các bản sao cuốn sách cổ ghi chép pháp tắc nguyên thủy để thức tỉnh kỹ năng chiến đấu.')
        .setFooter({ text: 'Dùng /shopkynang mua [book_id] [số lượng] để thỉnh sách.' })
        .setTimestamp();

      for (const book of SKILL_BOOKS) {
        embed.addFields({
          name: `${book.name} (\`${book.id}\`)`,
          value: `• Hệ linh căn: **${book.element}**\n• Giá: **${book.price}** Linh Thạch\n• Hiệu ứng: *${book.desc}*`
        });
      }

      embed.addFields({
        name: '💼 Hành trang linh thạch',
        value: `🟤 **${user.coin_ha_pham}** Hạ Phẩm Linh Thạch.`
      });

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (sub === 'mua') {
      const bookId = interaction.options.getString('book_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;

      if (qty <= 0) {
        await interaction.editReply({ content: '❌ Số lượng thỉnh sách phải lớn hơn 0!'});
        return;
      }

      const book = SKILL_BOOKS.find(b => b.id === bookId);
      if (!book) {
        await interaction.editReply({ content: '❌ Bí tịch này không tồn tại trong Tàng Kinh Các!'});
        return;
      }

      const totalCost = book.price * qty;

      if (user.coin_ha_pham < totalCost) {
        await interaction.editReply({
          content: `❌ Đạo hữu không đủ Linh Thạch! (Chi phí: **${totalCost}** Linh Thạch, đạo hữu có: **${user.coin_ha_pham}**).`
        });
        return;
      }

      // Trừ linh thạch và thêm vào tủ sách trong một transaction để đảm bảo an toàn
      const tx = require('../../database/database').default.transaction(() => {
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - totalCost });
        inventoryRepository.addItem(userId, book.id, qty);
      });
      tx();

      const updatedUser = userRepository.get(userId)!;

      const embed = new EmbedBuilder()
        .setTitle('📚 THỈNH SÁCH THÀNH CÔNG')
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(`Đạo hữu đã đút túi **${qty}x ${book.name}**! Hãy dùng \`/dungkynang item_id: ${book.id}\` để đọc hiểu và lĩnh ngộ pháp tắc.`)
        .addFields(
          { name: '🪙 Chi phí', value: `**-${totalCost}** Linh Thạch`, inline: true },
          { name: '💼 Số dư hiện tại', value: `**${updatedUser.coin_ha_pham}** Linh Thạch`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
