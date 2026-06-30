import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import db from '../../database/database';
import { ITEMS } from '../../config/itemConstants';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';

const DAO_FRUITS = [
  { id: ITEMS.FRUIT_DAO_MANH, name: 'Đạo Quả Sức Mạnh', effect: '+25 ATK', weight: 1 },
  { id: ITEMS.FRUIT_DAO_TRUONG, name: 'Đạo Quả Trường Sinh', effect: '+250 HP', weight: 1 },
  { id: ITEMS.FRUIT_DAO_KIEN, name: 'Đạo Quả Kiên Cố', effect: '+25 DEF', weight: 1 },
];

const SOUL_TYPES = [
  { id: ITEMS.SOUL_MORTAL, name: 'Phàm Hồn', value: 1 },
  { id: ITEMS.SOUL_SPIRIT, name: 'Linh Hồn', value: 3 },
  { id: ITEMS.SOUL_FIERCE, name: 'Cương Hồn', value: 8 },
  { id: ITEMS.SOUL_HOLY, name: 'Thánh Hồn', value: 20 },
];

export default class DaoQuaCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('daoqua')
        .setDescription('Điều chế Đạo Quả từ linh hồn hoặc xem kho linh hồn.')
        .addSubcommand(sub =>
          sub.setName('dieuche').setDescription('Điều chế Đạo Quả từ linh hồn (cần tối thiểu 20 giá trị linh hồn).')
        )
        .addSubcommand(sub =>
          sub.setName('kho').setDescription('Xem kho linh hồn hiện có.')
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

    if (sub === 'kho') {
      const inv = inventoryRepository.getUserInventory(userId);
      const soulItems = inv.filter(i => SOUL_TYPES.some(s => s.id === i.item_id));
      if (soulItems.length === 0) {
        await interaction.editReply({ content: '💀 Đạo hữu chưa có linh hồn nào! Hãy đi chiến đấu hoặc thám hiểm để thu thập.' });
        return;
      }
      const lines = soulItems.map(i => {
        const def = SOUL_TYPES.find(s => s.id === i.item_id);
        return `• **${i.name}**: ${i.quantity} cái (${def ? def.value : 0} giá trị/cái)`;
      });
      const totalValue = soulItems.reduce((sum, i) => {
        const def = SOUL_TYPES.find(s => s.id === i.item_id);
        return sum + (def ? def.value * i.quantity : 0);
      }, 0);
      await interaction.editReply({
        content: `💀 **KHO LINH HỒN**\n\n${lines.join('\n')}\n\n**Tổng giá trị**: ${totalValue}`,
      });
      return;
    }

    // sub === 'dieuche'
    const inv = inventoryRepository.getUserInventory(userId);
    const soulItems = inv.filter(i => SOUL_TYPES.some(s => s.id === i.item_id));
    const totalValue = soulItems.reduce((sum, i) => {
      const def = SOUL_TYPES.find(s => s.id === i.item_id);
      return sum + (def ? def.value * i.quantity : 0);
    }, 0);

    if (totalValue < 20) {
      await interaction.editReply({ content: `❌ Cần tối thiểu **20** giá trị linh hồn để điều chế Đạo Quả (Hiện có: **${totalValue}**).\n💀 Các loại linh hồn: Phàm Hồn=1, Linh Hồn=3, Cương Hồn=8, Thánh Hồn=20.` });
      return;
    }

    if (user.coin_ha_pham < 5000) {
      await interaction.editReply({ content: `❌ Cần **5,000** Hạ Phẩm Linh Thạch để kích hoạt lò luyện hồn!` });
      return;
    }

    // Consume souls proportionally (from lowest to highest value)
    let remaining = 20;
    const toRemove: { id: string; qty: number }[] = [];
    for (const soul of SOUL_TYPES) {
      const owned = soulItems.find(i => i.item_id === soul.id);
      const qty = owned ? owned.quantity : 0;
      const needed = Math.ceil(remaining / soul.value);
      const take = Math.min(needed, qty);
      if (take > 0) {
        toRemove.push({ id: soul.id, qty: take });
        remaining -= take * soul.value;
        if (remaining <= 0) break;
      }
    }

    if (remaining > 0) {
      await interaction.editReply({ content: '❌ Không đủ linh hồn để điều chế! Điều này không nên xảy ra.' });
      return;
    }

    // Pick random Dao Fruit
    const totalWeight = DAO_FRUITS.reduce((s, f) => s + f.weight, 0);
    let roll = Math.random() * totalWeight;
    const chosen = DAO_FRUITS.find(f => { roll -= f.weight; return roll <= 0; }) || DAO_FRUITS[0];

    db.transaction(() => {
      for (const r of toRemove) {
        inventoryRepository.removeItem(userId, r.id, r.qty);
      }
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 5000 });
      inventoryRepository.addItem(userId, chosen.id, 1);
    })();

    const consumedDesc = toRemove.map(r => {
      const def = SOUL_TYPES.find(s => s.id === r.id);
      return `${r.qty}x ${def ? def.name : r.id}`;
    }).join(', ');

    await interaction.editReply({
      content: `🌿 **ĐIỀU CHẾ ĐẠO QUẢ THÀNH CÔNG!**\n\n` +
        `Tiêu hao: **${consumedDesc}** + **5,000 LT**\n` +
        `Nhận được: **${chosen.name}** (${chosen.effect})\n\n` +
        `*Dùng \`/dung <inventory_id>\` để sử dụng Đạo Quả.*`,
    });
  }
}
