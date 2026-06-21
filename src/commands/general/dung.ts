import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import db from '../../database/database';

export default class DungCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('dung')
        .setDescription('Sử dụng đan dược, rương báu, hoặc phù lục từ túi đồ.')
        .addStringOption(opt =>
          opt
            .setName('item_id')
            .setDescription('Mã vật phẩm cần sử dụng (ví dụ: pill_hp_1, lucky_chest,...)')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('soluong')
            .setDescription('Số lượng muốn sử dụng (mặc định 1).')
            .setRequired(false)
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString('item_id', true);
    const qty = interaction.options.getInteger('soluong') || 1;

    if (qty <= 0) {
      await interaction.reply({ content: '❌ Số lượng sử dụng phải lớn hơn 0!', ephemeral: true });
      return;
    }

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
      return;
    }

    // Lấy danh sách item trong túi đồ
    const inventory = inventoryRepository.getUserInventory(userId);
    const userItem = inventory.find(i => i.item_id === itemId && i.is_equipped === 0);

    if (!userItem || userItem.quantity < qty) {
      await interaction.reply({
        content: `❌ Đạo hữu không đủ vật phẩm này trong túi đồ! (Hiện có: **${userItem ? userItem.quantity : 0}**).`,
        ephemeral: true
      });
      return;
    }

    // Xử lý nếu là Sách kỹ năng -> Chuyển qua học kỹ năng
    if (userItem.type === 'book') {
      await interaction.reply({
        content: `💡 Để học kỹ năng từ sách cổ này, đạo hữu hãy sử dụng lệnh \`/dungkynang item_id: ${itemId}\`!`,
        ephemeral: true
      });
      return;
    }

    // Defer reply for potentially heavy database updates or item loops
    await interaction.deferReply();

    // Xử lý mở rương
    if (userItem.type === 'chest') {
      const openResult = this.openChests(interaction.user.username, itemId, qty);
      
      const openTx = db.transaction(() => {
        // Trừ rương
        inventoryRepository.removeItem(userId, itemId, qty);
        // Thêm các phần thưởng
        for (const reward of openResult.rewards) {
          inventoryRepository.addItem(userId, reward.itemId, reward.quantity, reward.customStats);
        }
      });
      openTx();

      const embed = new EmbedBuilder()
        .setTitle('🎁 KẾT QUẢ MỞ RƯƠNG BÁO 🎁')
        .setColor('#f1c40f')
        .setDescription(`Đạo hữu đã khui thành công **${qty}x ${userItem.name}**! Phương trời chuyển sắc, linh khí lan tỏa...`)
        .addFields({
          name: '✨ Các vật phẩm nhận được:',
          value: openResult.description
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Xử lý sử dụng đan dược hồi thể lực (Ví dụ đan dược mới hồi stamina nếu có, hoặc đan dược bình thường)
    if (itemId === 'pill_stamina_1') { // ví dụ nếu có đan dược thể lực
      const restoreAmount = 50 * qty;
      const newStamina = Math.min(500, user.stamina + restoreAmount);
      
      db.transaction(() => {
        userRepository.update(userId, { stamina: newStamina });
        inventoryRepository.removeItem(userId, itemId, qty);
      })();

      await interaction.editReply({
        content: `💊 Sử dụng **${qty}x** đan dược thể lực, hồi phục **+${restoreAmount}** Thể Lực! (Hiện tại: **${newStamina}/500**).`
      });
      return;
    }

    // Sử dụng bình thường thông qua InventoryService (lặp qty lần)
    let successCount = 0;
    let lastMessage = '';

    for (let i = 0; i < qty; i++) {
      // Refresh inventory item state
      const currentInv = inventoryRepository.getUserInventory(userId);
      const activeItem = currentInv.find(item => item.item_id === itemId && item.is_equipped === 0);
      if (!activeItem || activeItem.quantity <= 0) break;

      const res = inventoryService.useItem(userId, activeItem.id);
      if (res.success) {
        successCount++;
        lastMessage = res.message;
      } else {
        lastMessage = res.message;
        break;
      }
    }

    if (successCount > 0) {
      await interaction.editReply({
        content: `✅ Đạo hữu sử dụng thành công **${successCount}/${qty}x** **${userItem.name}**.\n*Chi tiết:* ${lastMessage}`
      });
    } else {
      await interaction.editReply({
        content: `❌ Không thể sử dụng vật phẩm! Chi tiết: ${lastMessage}`
      });
    }
  }

  /**
   * Tính toán mở rương
   */
  private openChests(username: string, chestId: string, qty: number): { rewards: Array<{ itemId: string; quantity: number; customStats: string | null }>; description: string } {
    const rewards: Array<{ itemId: string; quantity: number; customStats: string | null }> = [];
    const summaryMap = new Map<string, { name: string; qty: number }>();

    const addReward = (itemId: string, name: string, quantity: number = 1, customStats: string | null = null) => {
      rewards.push({ itemId, quantity, customStats });
      const key = itemId + (customStats ? '_custom' : '');
      const existing = summaryMap.get(key);
      if (existing) {
        existing.qty += quantity;
      } else {
        summaryMap.set(key, { name: name + (customStats ? ' (Chỉ Số Đặc Biệt ✦)' : ''), qty: quantity });
      }
    };

    for (let i = 0; i < qty; i++) {
      if (chestId === 'lucky_chest') {
        // Mở ra phôi từ F tới SSS
        const rand = Math.random() * 100;
        let grade = 'f';
        if (rand < 40.0) grade = 'f';
        else if (rand < 65.0) grade = 'd';
        else if (rand < 80.0) grade = 'c';
        else if (rand < 90.0) grade = 'b';
        else if (rand < 96.0) grade = 'a';
        else if (rand < 99.0) grade = 's';
        else if (rand < 99.8) grade = 'ss';
        else grade = 'sss';

        const isWeapon = Math.random() < 0.5;
        const phoiId = isWeapon ? `phoi_weapon_${grade}` : `phoi_armor_${grade}`;
        
        // Lấy tên phôi
        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(phoiId) as { name: string } | undefined;
        const phoiName = staticItem ? staticItem.name : `Phôi phẩm ${grade.toUpperCase()}`;
        addReward(phoiId, phoiName, 1);
      } 
      
      else if (chestId === 'chest_1tr5') {
        // Rương 1.5M tôn quý (Sát tỷ lệ: SSS: 10%, SS: 20%, S: 35%, A: 35%, loại bỏ hoàn toàn phẩm B)
        const sssRate = 0.10;
        const ssRate = 0.20;
        const sRate = 0.35;

        const rand = Math.random();
        let grade = 'a';

        if (rand < sssRate) {
          grade = 'sss';
        } else if (rand < sssRate + ssRate) {
          grade = 'ss';
        } else if (rand < sssRate + ssRate + sRate) {
          grade = 's';
        } else {
          grade = 'a';
        }

        const isWeapon = Math.random() < 0.5;
        const phoiId = isWeapon ? `phoi_weapon_${grade}` : `phoi_armor_${grade}`;

        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(phoiId) as { name: string } | undefined;
        const phoiName = staticItem ? staticItem.name : `Phôi phẩm ${grade.toUpperCase()}`;
        addReward(phoiId, phoiName, 1);
      } 
      
      else if (chestId === 'server_raid_chest') {
        // Rương Boss Thế Giới: Cơ hội ra trang bị trực tiếp EX
        const rand = Math.random();
        let grade = 's';
        if (rand < 0.03) {
          grade = 'ex';
        } else if (rand < 0.15) {
          grade = 'sss';
        } else if (rand < 0.50) {
          grade = 'ss';
        } else {
          grade = 's';
        }

        const isWeapon = Math.random() < 0.5;
        const targetItemId = isWeapon ? `weapon_sword_${grade}` : `armor_robe_${grade}`;

        const staticItem = db.prepare('SELECT name FROM items WHERE id = ?').get(targetItemId) as { name: string } | undefined;
        const itemName = staticItem ? staticItem.name : `Trang bị phẩm ${grade.toUpperCase()}`;

        // Rương này mở thẳng ra trang bị thức tỉnh chỉ số phụ ngẫu nhiên luôn
        const customStats = this.generateCustomStatsForChest(grade);
        addReward(targetItemId, itemName, 1, customStats ? JSON.stringify(customStats) : null);
      }
      
      else {
        // Rương rác / mặc định rơi huyền thiết sa
        addReward('material_iron_1', 'Huyền Thiết Sa', 1);
      }
    }

    const logs: string[] = [];
    for (const [_, info] of summaryMap.entries()) {
      logs.push(`• **${info.name}** x${info.qty}`);
    }

    const description = logs.join('\n');

    return { rewards, description };
  }

  private generateCustomStatsForChest(grade: string): any {
    const stats: any = {};
    const lowerGrade = grade.toLowerCase();
    if (lowerGrade === 'f' || lowerGrade === 'd') return null;

    const rollStat = (type: string, min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const types = ['atk', 'def', 'hp', 'crit', 'luck'];
    let lines = 1;
    if (lowerGrade === 'c' || lowerGrade === 'b') lines = 1;
    else if (lowerGrade === 'a' || lowerGrade === 's') lines = 2;
    else if (lowerGrade === 'ss' || lowerGrade === 'sss') lines = 3;
    else if (lowerGrade === 'ex') lines = 4;

    const chosenTypes = new Set<string>();
    while (chosenTypes.size < lines) {
      chosenTypes.add(types[Math.floor(Math.random() * types.length)]);
    }

    for (const statType of chosenTypes) {
      if (statType === 'atk') {
        if (lowerGrade === 'c') stats.atk = rollStat('atk', 2, 6);
        else if (lowerGrade === 'b') stats.atk = rollStat('atk', 5, 15);
        else if (lowerGrade === 'a') stats.atk = rollStat('atk', 10, 30);
        else if (lowerGrade === 's') stats.atk = rollStat('atk', 20, 50);
        else if (lowerGrade === 'ss') stats.atk = rollStat('atk', 40, 100);
        else if (lowerGrade === 'sss') stats.atk = rollStat('atk', 80, 200);
        else if (lowerGrade === 'ex') stats.atk = rollStat('atk', 150, 400);
      } else if (statType === 'def') {
        if (lowerGrade === 'c') stats.def = rollStat('def', 1, 4);
        else if (lowerGrade === 'b') stats.def = rollStat('def', 3, 10);
        else if (lowerGrade === 'a') stats.def = rollStat('def', 6, 20);
        else if (lowerGrade === 's') stats.def = rollStat('def', 12, 35);
        else if (lowerGrade === 'ss') stats.def = rollStat('def', 25, 70);
        else if (lowerGrade === 'sss') stats.def = rollStat('def', 50, 150);
        else if (lowerGrade === 'ex') stats.def = rollStat('def', 100, 300);
      } else if (statType === 'hp') {
        if (lowerGrade === 'c') stats.hp = rollStat('hp', 10, 30);
        else if (lowerGrade === 'b') stats.hp = rollStat('hp', 25, 80);
        else if (lowerGrade === 'a') stats.hp = rollStat('hp', 60, 200);
        else if (lowerGrade === 's') stats.hp = rollStat('hp', 120, 400);
        else if (lowerGrade === 'ss') stats.hp = rollStat('hp', 250, 800);
        else if (lowerGrade === 'sss') stats.hp = rollStat('hp', 500, 1500);
        else if (lowerGrade === 'ex') stats.hp = rollStat('hp', 1000, 3000);
      } else if (statType === 'crit') {
        let critVal = 0.01;
        if (lowerGrade === 'a') critVal = 0.01 + Math.random() * 0.02;
        else if (lowerGrade === 's') critVal = 0.02 + Math.random() * 0.03;
        else if (lowerGrade === 'ss') critVal = 0.03 + Math.random() * 0.05;
        else if (lowerGrade === 'sss') critVal = 0.05 + Math.random() * 0.07;
        else if (lowerGrade === 'ex') critVal = 0.08 + Math.random() * 0.12;
        stats.crit = parseFloat(critVal.toFixed(3));
      } else if (statType === 'luck') {
        if (lowerGrade === 's') stats.luck = rollStat('luck', 1, 3);
        else if (lowerGrade === 'ss') stats.luck = rollStat('luck', 2, 6);
        else if (lowerGrade === 'sss') stats.luck = rollStat('luck', 5, 15);
        else if (lowerGrade === 'ex') stats.luck = rollStat('luck', 10, 30);
      }
    }

    return stats;
  }
}
