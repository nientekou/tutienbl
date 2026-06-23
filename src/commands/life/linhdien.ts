import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { farmingService, FarmingPlot } from '../../services/FarmingService';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';
import { EMBED_COLORS } from '../../utils/uiSystem';

/**
 * Tạo Embed hiển thị trạng thái Linh Điền
 */
export function getLinhDienEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription('Đạo hữu chưa khởi tạo nhân vật.');
  }

  const plots = farmingService.getPlots(userId);
  const unlockedCount = plots.length;
  const costList = [100, 250, 500, 1000, 2000];

  const embed = new EmbedBuilder()
    .setTitle(`🌱 Linh Điền Trồng Trọt - ${user.name}`)
    .setDescription('Đại Đạo Vô Biên, trồng trọt thu hoạch thảo dược rèn đan luyện linh khí.')
    .setColor(EMBED_COLORS.SUCCESS)
    .setTimestamp();

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  for (let i = 0; i < 6; i++) {
    if (i < unlockedCount) {
      const p = plots[i];
      let name = `🌱 Ô Đất Số ${i + 1}`;
      let value = '';
      if (p.status === 'empty') {
        name = `🟫 Ô Đất Số ${i + 1} (Trống)`;
        value = `*Đất trống trải*`;
      } else {
        const remaining = p.timeRemaining || 0;
        let detailsText = `💧 Ẩm: **${p.moisture}/5** | 🪱 Dinh dưỡng: **${p.nutrition}/6** | 🐛 Sâu: **${p.pests === 0 ? 'Không' : 'Có ⚠️'}**`;
        
        let speedText = '⚡ Tốc độ: 100%';
        if (p.pests > 0 || p.moisture < 3 || p.nutrition < 3) {
          speedText = '🐢 Tốc độ: 50% (Kém)';
        } else if (p.moisture >= 4 && p.nutrition >= 4 && p.pests === 0) {
          speedText = '🚀 Tốc độ: 150% (Hoàn hảo)';
        }

        if (remaining <= 0) {
          name = `✨ Ô Đất Số ${i + 1} (${p.seedName})`;
          value = `**Đã chín - Có thể thu hoạch!**\n└ ${detailsText}\n└ ${speedText}`;
        } else {
          // Lấy stats của hạt giống để lấy tổng thời gian tăng trưởng gốc
          let totalGrowthTime = 300;
          if (p.seed_item_id) {
            const item = db.prepare('SELECT stats FROM items WHERE id = ?').get(p.seed_item_id) as { stats: string } | undefined;
            if (item) {
              try {
                const stats = JSON.parse(item.stats || '{}');
                if (stats.growth_time) totalGrowthTime = stats.growth_time;
              } catch (e) {}
            }
          }

          const percent = Math.max(0, Math.min(1, (totalGrowthTime - remaining) / totalGrowthTime));
          const growthBar = getProgressBar(Math.round(percent * 100), 100, 10);
          
          const min = Math.floor(remaining / 60);
          const sec = remaining % 60;
          name = `🌱 Ô Đất Số ${i + 1} (${p.seedName})`;
          value = `${growthBar} (Còn \`${min}m ${sec}s\`)\n└ ${detailsText}\n└ ${speedText}`;
        }
      }
      fields.push({ name, value, inline: true });
    } else {
      const cost = costList[i - 1];
      fields.push({
        name: `🔒 Ô Đất Số ${i + 1}`,
        value: `*Chưa khai khẩn*\n└ Phí mở: **${cost}** Linh Thạch`,
        inline: true
      });
    }
  }

  embed.addFields(
    ...fields,
    { name: '💼 Tài sản', value: `🟤 **${user.coin_ha_pham}** Linh Thạch Hạ Phẩm`, inline: false }
  );

  return embed;
}

/**
 * Tạo các Component tương tác cho Linh Điền
 */
export function getLinhDienComponents(userId: string): any[] {
  const plots = farmingService.getPlots(userId);
  const inv = inventoryRepository.getUserInventory(userId);
  const rows: any[] = [];

  // 1. Dropdown gieo hạt giống (Chỉ hiển thị hạt giống có sẵn)
  const seeds = inv.filter(i => i.item_id.startsWith('seed_') && i.quantity > 0);
  const seedSelect = new StringSelectMenuBuilder()
    .setCustomId(`linhdiengieoselect_${userId}`)
    .setPlaceholder('🌱 Chọn hạt giống trong túi để gieo trồng...');

  if (seeds.length > 0) {
    seeds.forEach(s => {
      seedSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${s.name} (Có x${s.quantity})`)
          .setDescription(s.description || '')
          .setValue(s.item_id)
      );
    });
  } else {
    seedSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Hành trang không có hạt giống')
        .setValue('no_seed')
    ).setDisabled(true);
  }
  rows.push(new ActionRowBuilder().addComponents(seedSelect));

  // 2. Dropdown gia tốc bằng Thần Hành Phù (chỉ hiển thị nếu có ô đang mọc)
  const growingPlots = plots.filter(p => p.status === 'growing' && (p.timeRemaining || 0) > 0);
  const hasTalisman = inv.some(i => i.item_id === ITEMS.TALISMAN_SPEED_1 && i.quantity > 0);
  const talismanCount = inv.find(i => i.item_id === ITEMS.TALISMAN_SPEED_1)?.quantity || 0;

  const speedSelect = new StringSelectMenuBuilder()
    .setCustomId(`linhdienspeedupselect_${userId}`)
    .setPlaceholder(`⚡ Gia tốc bằng Thần Hành Phù (Có x${talismanCount})...`);

  if (growingPlots.length > 0) {
    growingPlots.forEach(p => {
      speedSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Gia tốc Ô số ${p.plot_index + 1} (${p.seedName})`)
          .setValue(p.plot_index.toString())
      );
    });
    if (!hasTalisman) {
      speedSelect.setDisabled(true).setPlaceholder('⚡ Không có Thần Hành Phù trong túi');
    }
  } else {
    speedSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Không có linh thực đang sinh trưởng')
        .setValue('no_growing')
    ).setDisabled(true);
  }
  rows.push(new ActionRowBuilder().addComponents(speedSelect));

  // 3. Dropdown chăm sóc Linh Điền (Tưới nước, Bón phân, Diệt sâu)
  const careSelect = new StringSelectMenuBuilder()
    .setCustomId(`linhdiencareselect_${userId}`)
    .setPlaceholder('💧 Chăm sóc Linh Điền (Tưới nước, Bón phân, Bắt sâu)...');

  const careOptions: StringSelectMenuOptionBuilder[] = [];

  plots.forEach(p => {
    if (p.status === 'growing') {
      if (p.moisture < 5) {
        careOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`💧 Tưới Nước - Ô ${p.plot_index + 1} (${p.seedName})`)
            .setDescription(`Độ ẩm: ${p.moisture}/5. Tăng độ ẩm linh thổ.`)
            .setValue(`water_${p.plot_index}`)
        );
      }
      if (p.nutrition < 6) {
        careOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`🪱 Bón Phân - Ô ${p.plot_index + 1} (${p.seedName})`)
            .setDescription(`Dinh dưỡng: ${p.nutrition}/6. Tăng dinh dưỡng linh thổ.`)
            .setValue(`fertilize_${p.plot_index}`)
        );
      }
      if (p.pests > 0) {
        careOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`🐛 Diệt Sâu - Ô ${p.plot_index + 1} (${p.seedName})`)
            .setDescription(`Bắt sâu bệnh cắn phá linh thực.`)
            .setValue(`catchpests_${p.plot_index}`)
        );
      }
    }
  });

  if (careOptions.length > 0) {
    careSelect.addOptions(careOptions);
  } else {
    careSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Linh điền hiện không có ô đất cần chăm bón')
        .setValue('no_care')
    ).setDisabled(true);
  }
  rows.push(new ActionRowBuilder().addComponents(careSelect));

  // 3. Hàng nút bấm chức năng (Thu hoạch, Mở rộng, Làm mới)
  const hasReadyToHarvest = plots.some(p => p.status === 'growing' && (p.timeRemaining || 0) <= 0);
  const isMaxedPlots = plots.length >= 6;

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`linhdienharvest_${userId}`)
      .setLabel('✨ Thu Hoạch Tất Cả Chín')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasReadyToHarvest),

    new ButtonBuilder()
      .setCustomId(`linhdienunlock_${userId}`)
      .setLabel('🔒 Khai Khẩn Ô Đất Mới')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isMaxedPlots),

    new ButtonBuilder()
      .setCustomId(`linhdienrefresh_${userId}`)
      .setLabel('🔄 Làm Mới')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(btnRow);

  return rows;
}

export default class LinhDienCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('linhdien')
        .setDescription('Mở giao diện Linh Điền để trồng trọt linh thảo.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
      });
      return;
    }

    const embed = getLinhDienEmbed(userId);
    const components = getLinhDienComponents(userId);

    await interaction.editReply({
      embeds: [embed],
      components: components as any[]
    });
  }
}
