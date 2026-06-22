import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { equipmentService } from '../../services/EquipmentService';

export default class TrangBiCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('trangbi')
        .setDescription('Quản lý trang bị: Giám định, Phân giải, Nâng sao, Ghép.')
        .addSubcommand(sub =>
          sub
            .setName('giamdinh')
            .setDescription('Giám định phôi rèn đúc thành trang bị thực tế (phí 50 Linh thạch).')
            .addStringOption(opt =>
              opt
                .setName('item_id')
                .setDescription('Mã vật phẩm cần giám định (xem trong /tuido).')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt
                .setName('soluong')
                .setDescription('Số lượng phôi muốn giám định.')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('giamdinhhangloat')
            .setDescription('Giám định toàn bộ phôi trong hành trang (phí 50 Linh thạch/phôi).')
        )
        .addSubcommand(sub =>
          sub
            .setName('phangiai')
            .setDescription('Phân giải trang bị không dùng để lấy Mảnh Trang Bị.')
            .addStringOption(opt =>
              opt
                .setName('item_id')
                .setDescription('Mã vật phẩm cần phân giải.')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt
                .setName('soluong')
                .setDescription('Số lượng trang bị muốn phân giải (mặc định là 1).')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('nangsao')
            .setDescription('Sử dụng Mảnh Trang Bị để nâng cấp sao cho trang bị (+20% chỉ số mỗi sao, max 5 sao).')
            .addStringOption(opt =>
              opt
                .setName('item_id')
                .setDescription('Mã vật phẩm muốn nâng sao.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('ghep')
            .setDescription('Ghép Mảnh Trang Bị thành trang bị thần phẩm phẩm chất S/SS/SSS.')
            .addStringOption(opt =>
              opt
                .setName('rarity')
                .setDescription('Phẩm chất muốn ghép (S - 100 mảnh, SS - 300 mảnh, SSS - 1000 mảnh).')
                .setRequired(true)
                .addChoices(
                  { name: 'Phẩm S (100 Mảnh)', value: 'S' },
                  { name: 'Phẩm SS (300 Mảnh)', value: 'SS' },
                  { name: 'Phẩm SSS (1000 Mảnh)', value: 'SSS' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('phangiaihangloat')
            .setDescription('Phân giải hàng loạt trang bị chưa đeo và không bản mệnh theo phẩm chất chỉ định trở xuống.')
            .addStringOption(opt =>
              opt
                .setName('rarity')
                .setDescription('Phẩm chất cao nhất muốn phân giải (ví dụ: rare).')
                .setRequired(true)
                .addChoices(
                  { name: 'Common (Phẩm Thường)', value: 'common' },
                  { name: 'Uncommon (Phẩm Nhã)', value: 'uncommon' },
                  { name: 'Rare (Phẩm Tốt)', value: 'rare' },
                  { name: 'Epic (Phẩm Kỷ Vật)', value: 'epic' },
                  { name: 'Legendary (Phẩm Truyền Thuyết)', value: 'legendary' }
                )
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

    if (sub === 'giamdinh') {
      const itemId = interaction.options.getString('item_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;
      const invItem = inventoryRepository.getByUserIdAndItemId(userId, itemId);
      if (!invItem) {
        await interaction.reply({ content: `❌ Không tìm thấy vật phẩm \`${itemId}\` trong túi đồ!`, ephemeral: true });
        return;
      }
      const res = equipmentService.appraisePhoi(userId, invItem.id, qty);
      
      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'giamdinhhangloat') {
      const res = equipmentService.appraisePhoiBulk(userId);

      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'phangiai') {
      const itemId = interaction.options.getString('item_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;
      const invItem = inventoryRepository.getByUserIdAndItemId(userId, itemId);
      if (!invItem) {
        await interaction.reply({ content: `❌ Không tìm thấy vật phẩm \`${itemId}\` trong túi đồ!`, ephemeral: true });
        return;
      }
      const res = equipmentService.salvageEquipment(userId, invItem.id, qty);

      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'nangsao') {
      const itemId = interaction.options.getString('item_id', true);
      const invItem = inventoryRepository.getByUserIdAndItemId(userId, itemId);
      if (!invItem) {
        await interaction.reply({ content: `❌ Không tìm thấy vật phẩm \`${itemId}\` trong túi đồ!`, ephemeral: true });
        return;
      }
      const res = equipmentService.upgradeStars(userId, invItem.id);

      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'ghep') {
      const rarity = interaction.options.getString('rarity', true) as 'S' | 'SS' | 'SSS';
      const res = equipmentService.craftEquipment(userId, rarity);

      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'phangiaihangloat') {
      const rarity = interaction.options.getString('rarity', true);
      const res = equipmentService.salvageEquipmentBulk(userId, rarity);

      if (res.success) {
        await interaction.reply({ content: res.message });
      } else {
        await interaction.reply({ content: `❌ Thất bại: ${res.message}`, ephemeral: true });
      }
      return;
    }
  }
}
