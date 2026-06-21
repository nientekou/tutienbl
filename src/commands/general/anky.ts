import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { soulImprintRepository } from '../../database/repositories/SoulImprintRepository';
import { soulImprintService } from '../../services/SoulImprintService';
import { getProgressBar } from '../../utils/constants';

const GROUP_NAMES: Record<string, string> = {
  'weapon': '⚔️ Bộ Vũ Khí Thượng Cổ',
  'armor': '🛡️ Bộ Pháp Y Vô Thượng',
  'accessory': '📿 Bộ Linh Bản Phụ Kiện',
  'other': '📦 Bộ Khác'
};

const SET_ITEMS: Record<string, { id: string, name: string }[]> = {
  'weapon': [
    { id: 'weapon_sword_c', name: 'Kiếm Sắt (C)' },
    { id: 'weapon_sword_b', name: 'Thanh Phong Kiếm (B)' },
    { id: 'weapon_sword_a', name: 'Thanh Quang Bảo Kiếm (A)' },
    { id: 'weapon_sword_s', name: 'Vô Ảnh Kiếm (S)' },
    { id: 'weapon_sword_ss', name: 'Huyền Thiên Linh Kiếm (SS)' },
    { id: 'weapon_sword_sss', name: 'Thần Ma Trảm Tiên Kiếm (SSS)' }
  ],
  'armor': [
    { id: 'armor_robe_c', name: 'Đạo Bào Thô (C)' },
    { id: 'armor_robe_b', name: 'Tụ Linh Y (B)' },
    { id: 'armor_robe_a', name: 'Huyền Vũ Bào (A)' },
    { id: 'armor_robe_s', name: 'Hỗn Nguyên Đạo Y (S)' },
    { id: 'armor_robe_ss', name: 'Thái Cực Huyền Y (SS)' },
    { id: 'armor_robe_sss', name: 'Cửu Thiên Phượng Vũ Y (SSS)' }
  ],
  'accessory': [
    { id: 'ring_1', name: 'Nhẫn Trữ Vật' },
    { id: 'necklace_1', name: 'Dây Chuyền Linh Lực' },
    { id: 'amulet_1', name: 'Bùa Hộ Mệnh' }
  ]
};

export function buildImprintListEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId)!;
  const imprints = soulImprintRepository.getUserImprints(userId);
  const totalStats = soulImprintService.getImprintStats(userId);
  const setBonuses = soulImprintService.getSetBonuses(userId);

  const statsLines: string[] = [];
  if (totalStats.hp) statsLines.push(`• Sinh lực: **+${totalStats.hp}**`);
  if (totalStats.mp) statsLines.push(`• Pháp lực: **+${totalStats.mp}**`);
  if (totalStats.atk) statsLines.push(`• Công kích: **+${totalStats.atk}**`);
  if (totalStats.def) statsLines.push(`• Phòng ngự: **+${totalStats.def}**`);
  if (totalStats.crit) statsLines.push(`• Bạo kích: **+${(totalStats.crit * 100).toFixed(1)}%**`);
  if (totalStats.speed) statsLines.push(`• Tốc độ: **+${totalStats.speed}**`);
  if (totalStats.luck) statsLines.push(`• May mắn: **+${totalStats.luck}**`);

  const setBonusLines: string[] = [];
  if (setBonuses.atk) setBonusLines.push(`• Công kích từ Bộ: **+${setBonuses.atk}**`);
  if (setBonuses.crit) setBonusLines.push(`• Bạo kích từ Bộ: **+${(setBonuses.crit * 100).toFixed(1)}%**`);
  if (setBonuses.hasOai) setBonusLines.push(`• Kỹ năng Bộ: **Oai** (5% làm Tê Liệt đối thủ khi đánh)`);

  const listText = imprints.map((imp, idx) => {
    const statsObj = JSON.parse(imp.imprint_stats);
    const statsStr = Object.entries(statsObj).map(([k, v]) => {
      if (k === 'crit') return `+${((v as number) * 100).toFixed(0)}% Bạo`;
      return `+${v} ${k.toUpperCase()}`;
    }).join(', ');
    const boundText = imp.is_bound === 1 ? '🔒 Liên kết' : '🔓 Có thể giao dịch';
    return `**${idx + 1}. [${imp.item_rarity.toUpperCase()}] ${imp.item_name}** (ID: \`${imp.id}\`)\n  └ *Chỉ số:* ${statsStr}\n  └ *Phân nhóm:* ${GROUP_NAMES[imp.set_group] || imp.set_group} | *Trạng thái:* ${boundText}`;
  }).join('\n\n');

  const bar = getProgressBar(imprints.length, 50, 10);

  const embed = new EmbedBuilder()
    .setTitle(`🌟 ĐỀN THỜ ẤN KÝ LINH HỒN - ${user.name}`)
    .setColor('#9b59b6')
    .setDescription(
      `*Nơi lưu giữ linh hồn của các thần binh bảo giáp đã bị tiêu hủy. Chỉ số của Ấn Ký được cộng dồn vĩnh viễn vào thuộc tính nhân vật, bất kể có trang bị hay không.*\n\n` +
      `📊 **Ấn Ký Hiện Tại:** ${bar} **(${imprints.length}/50)**\n`
    )
    .addFields(
      {
        name: '📈 Tổng Chỉ Số Ấn Ký Tích Lũy',
        value: statsLines.length > 0 ? statsLines.join('\n') : '`Chưa có chỉ số tích lũy`',
        inline: true
      },
      {
        name: '✨ Hiệu Ứng Kích Hoạt Bộ',
        value: setBonusLines.length > 0 ? setBonusLines.join('\n') : '`Chưa kích hoạt hiệu ứng bộ (Yêu cầu >= 3 món unique cùng bộ)`',
        inline: true
      },
      {
        name: '📜 Danh Sách Ấn Ký Linh Hồn',
        value: listText ? (listText.length > 1024 ? listText.substring(0, 1021) + '...' : listText) : '`Chưa có thần khí nào được ấn ký vĩnh viễn.`',
        inline: false
      }
    )
    .setTimestamp();

  return embed;
}

export default class AnkyCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('anky')
        .setDescription('Quản lý, đúc luyện và giao dịch Ấn Ký Linh Hồn.')
        .addSubcommand(sub =>
          sub.setName('danhsach')
            .setDescription('Xem toàn bộ Ấn Ký Linh Hồn và thuộc tính vĩnh viễn đạo hữu tích lũy.')
        )
        .addSubcommand(sub =>
          sub.setName('anky')
            .setDescription('Tiêu hủy trang bị 5 Sao để đúc thành Ấn Ký Linh Hồn.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID trang bị trong túi đồ (Không bắt buộc)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('bo-suu-tap')
            .setDescription('Xem tiến độ thu thập các bộ sưu tập Ấn Ký.')
        )
        .addSubcommand(sub =>
          sub.setName('trade')
            .setDescription('Tặng (giao dịch) một Ấn Ký chưa khóa cho đạo hữu khác (chỉ 1 lần duy nhất).')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID Ấn Ký muốn tặng').setRequired(true))
            .addUserOption(opt => opt.setName('user').setDescription('Đạo hữu nhận Ấn Ký').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const user = userRepository.get(discordId);

    if (!user) {
      await interaction.reply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!',
        ephemeral: true
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'danhsach') {
      const embed = buildImprintListEmbed(discordId);
      await interaction.reply({ embeds: [embed] });
    }
    
    else if (sub === 'anky') {
      const targetId = interaction.options.getInteger('id');

      if (targetId) {
        // Thực hiện ấn ký trực tiếp
        const result = soulImprintService.imprintItem(discordId, targetId);
        if (result.success) {
          await interaction.reply({ content: result.message });
        } else {
          await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        }
      } else {
        // Hiển thị danh sách các món đủ điều kiện để chọn qua dropdown
        const userInventory = inventoryRepository.getUserInventory(discordId);
        const candidates = userInventory.filter(item => item.equipable === 1 && item.is_equipped === 0 && item.stars === 5);

        if (candidates.length === 0) {
          await interaction.reply({
            content: '❌ Đạo hữu không có trang bị nào đạt **5 Sao** (và chưa trang bị) trong túi đồ để tiến hành Ấn Ký Linh Hồn!',
            ephemeral: true
          });
          return;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`anky_select_${discordId}`)
          .setPlaceholder('🔮 Chọn trang bị 5 Sao để tiến hành Ấn Ký...');

        candidates.forEach(c => {
          selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${c.name} (+${c.enhance_level})`)
              .setDescription(`Rarity: ${c.rarity.toUpperCase()} | ID: #${c.id}`)
              .setValue(c.id.toString())
          );
        });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        await interaction.reply({
          content: '🧘 **Đúc Luyện Ấn Ký Linh Hồn**\n*Hãy chọn một trang bị 5 Sao bên dưới để tiêu hủy và lưu giữ chỉ số vĩnh viễn (Chi phí: 5,000 LT + 10 Mảnh Trang Bị):*',
          components: [row],
          ephemeral: true
        });
      }
    }

    else if (sub === 'bo-suu-tap') {
      const userImprints = soulImprintRepository.getUserImprints(discordId);
      const collectedIds = new Set(userImprints.map(i => i.item_id));

      const embed = new EmbedBuilder()
        .setTitle(`📖 SỔ TAY THU THẬP ẤN KÝ - ${user.name}`)
        .setColor('#e67e22')
        .setDescription('*Thu thập đủ các loại trang bị trong từng bộ sưu tập Ấn Ký để nhận thuộc tính ẩn cực mạnh vĩnh viễn.*')
        .setTimestamp();

      Object.entries(SET_ITEMS).forEach(([groupKey, items]) => {
        const groupName = GROUP_NAMES[groupKey] || groupKey;
        let count = 0;
        const itemLines = items.map(it => {
          const isCollected = collectedIds.has(it.id);
          if (isCollected) count++;
          return `${isCollected ? '🟢' : '❌'} ${it.name}`;
        });

        const bar = getProgressBar(count, items.length, 6);

        embed.addFields({
          name: `${groupName} (${count}/${items.length})`,
          value: `${bar}\n${itemLines.join('\n')}`,
          inline: true
        });
      });

      const setBonuses = soulImprintService.getSetBonuses(discordId);
      const activeBonuses: string[] = [];
      if (setBonuses.atk) activeBonuses.push(`• Công kích: **+${setBonuses.atk}**`);
      if (setBonuses.crit) activeBonuses.push(`• Bạo kích: **+${(setBonuses.crit * 100).toFixed(1)}%**`);
      if (setBonuses.hasOai) activeBonuses.push(`• Kỹ năng: **Oai** (5% Tê Liệt đối thủ)`);

      embed.addFields({
        name: '✨ Thuộc Tính Kích Hoạt Bộ Hiện Tại',
        value: activeBonuses.length > 0 ? activeBonuses.join('\n') : '`Chưa kích hoạt hiệu ứng bộ nào.`',
        inline: false
      });

      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'trade') {
      const imprintId = interaction.options.getInteger('id', true);
      const targetUser = interaction.options.getUser('user', true);
      const targetUserId = targetUser.id;

      if (targetUserId === discordId) {
        await interaction.reply({ content: '❌ Đạo hữu không thể tự giao dịch Ấn Ký với bản thân!', ephemeral: true });
        return;
      }

      const result = soulImprintService.tradeImprint(discordId, targetUserId, imprintId);
      if (result.success) {
        await interaction.reply({ content: result.message });
      } else {
        await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
      }
    }
  }
}
