import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryService } from '../../services/InventoryService';
import db from '../../database/database';

export const casinoCooldowns = new Map<string, number>();
export const MIN_BET = 50;
export const MAX_BET = 200000;

export async function runCasinoGame(
  userId: string,
  subcommand: string,
  bet: number,
  choice: string
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const user = userRepository.get(userId);
  if (!user) {
    return { success: false, message: 'Đạo hữu chưa tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.' };
  }

  // Validate Bet Limit
  if (bet < MIN_BET || bet > MAX_BET) {
    return {
      success: false,
      message: `Lượng Linh Thạch cược không hợp lệ! Mức cược tối thiểu là **${MIN_BET}** và tối đa là **${MAX_BET.toLocaleString()}** Linh Thạch Hạ Phẩm.`
    };
  }

  // Check balance (retrieve fresh user to avoid cache mismatch)
  if (user.coin_ha_pham < bet) {
    return {
      success: false,
      message: `Số dư của đạo hữu không đủ! (Hiện có: **${user.coin_ha_pham.toLocaleString()}** / Yêu cầu cược: **${bet.toLocaleString()}** LT).`
    };
  }

  // Fetch Luck stat (affects relief/bonus payouts)
  const activeStats = inventoryService.getActiveStats(userId);
  const luck = activeStats ? activeStats.luck : user.base_luck;

  let isWin = false;
  let rewardChange = 0;
  let description = '';
  let title = '';
  let color = '';

  if (subcommand === 'doden') {
    title = '🔴 ĐỎ ĐEN CHIẾN - THỬ THÁCH NHÂN PHẨM ⚫';
    const roll = Math.random() < 0.5 ? 'do' : 'den';
    isWin = choice === roll;

    if (isWin) {
      rewardChange = bet;
      color = '#2ecc71';
      description = `🔮 Đạo hữu **${user.name}** đặt niềm tin vào ${choice === 'do' ? '🔴 Đỏ' : '⚫ Đen'}!\n\n` +
                    `Bát mở ra: ${roll === 'do' ? '🔴 **ĐỎ**' : '⚫ **ĐEN**'}\n` +
                    `🎉 **THẮNG LỢI!** Nhận thêm **+${bet.toLocaleString()}** Linh Thạch Hạ Phẩm.`;
    } else {
      rewardChange = -bet;
      color = '#e74c3c';
      description = `🔮 Đạo hữu **${user.name}** đặt niềm tin vào ${choice === 'do' ? '🔴 Đỏ' : '⚫ Đen'}...\n\n` +
                    `Bát mở ra: ${roll === 'do' ? '🔴 **ĐỎ**' : '⚫ **ĐEN**'}\n` +
                    `💸 **THẤT BẠI!** Mất trắng **-${bet.toLocaleString()}** Linh Thạch Hạ Phẩm.`;
    }
  } else if (subcommand === 'taixiu') {
    title = '🎲 LỘC PHONG ĐÀI - TÀI XỈU 🎲';
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2 + d3;
    const resultType = total >= 11 ? 'tai' : 'xiu';
    isWin = choice === resultType;

    const diceEmoji: Record<number, string> = {
      1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅'
    };
    const diceResultString = `${diceEmoji[d1]} [${d1}]  ${diceEmoji[d2]} [${d2}]  ${diceEmoji[d3]} [${d3}]`;

    if (isWin) {
      rewardChange = Math.floor(bet * 0.95); // 5% house edge
      color = '#2ecc71';
      description = `🔮 Đạo hữu **${user.name}** đặt cược vào ${choice === 'tai' ? '📈 **Tài**' : '📉 **Xỉu**'}!\n\n` +
                    `🎲 Xúc xắc: ${diceResultString}\n` +
                    `➡️ Tổng điểm: **${total}** ➔ **${resultType === 'tai' ? '📈 TÀI' : '📉 XỈU'}**\n\n` +
                    `🎉 **THẮNG LỢI!** Nhận thêm **+${rewardChange.toLocaleString()}** Linh Thạch Hạ Phẩm (đã trừ 5% phí sàn).`;
    } else {
      rewardChange = -bet;
      color = '#e74c3c';
      description = `🔮 Đạo hữu **${user.name}** đặt cược vào ${choice === 'tai' ? '📈 **Tài**' : '📉 **Xỉu**'}...\n\n` +
                    `🎲 Xúc xắc: ${diceResultString}\n` +
                    `➡️ Tổng điểm: **${total}** ➔ **${resultType === 'tai' ? '📈 TÀI' : '📉 XỈU'}**\n\n` +
                    `💸 **THẤT BẠI!** Mất trắng **-${bet.toLocaleString()}** Linh Thạch Hạ Phẩm.`;
    }
  } else if (subcommand === 'baucua') {
    title = '🎃 LÔ NGHỆ ĐÀI - BẦU CUA TÔM CÁ 🦀';
    const keys = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];
    const r1 = keys[Math.floor(Math.random() * keys.length)];
    const r2 = keys[Math.floor(Math.random() * keys.length)];
    const r3 = keys[Math.floor(Math.random() * keys.length)];
    const rolls = [r1, r2, r3];

    const count = rolls.filter(r => r === choice).length;
    isWin = count > 0;

    const baucuaMeta: Record<string, { emoji: string; name: string }> = {
      bau: { emoji: '🎃', name: 'Bầu' },
      cua: { emoji: '🦀', name: 'Cua' },
      tom: { emoji: '🦐', name: 'Tôm' },
      ca: { emoji: '🐟', name: 'Cá' },
      ga: { emoji: '🐔', name: 'Gà' },
      nai: { emoji: '🦌', name: 'Nai' }
    };

    const diceResultString = `${baucuaMeta[r1].emoji} [${baucuaMeta[r1].name}]  ${baucuaMeta[r2].emoji} [${baucuaMeta[r2].name}]  ${baucuaMeta[r3].emoji} [${baucuaMeta[r3].name}]`;

    if (isWin) {
      // 5% house edge on net winnings
      rewardChange = Math.floor(bet * count * 0.95);
      color = '#2ecc71';
      description = `🔮 Đạo hữu **${user.name}** đặt cược vào **${baucuaMeta[choice].emoji} ${baucuaMeta[choice].name}**!\n\n` +
                    `🎲 Bát mở ra: ${diceResultString}\n` +
                    `🎯 Xuất hiện **${count}** lần linh vật đặt cược!\n\n` +
                    `🎉 **THẮNG LỢI!** Nhận thêm **+${rewardChange.toLocaleString()}** Linh Thạch Hạ Phẩm (đã trừ 5% phí sàn).`;
    } else {
      rewardChange = -bet;
      color = '#e74c3c';
      description = `🔮 Đạo hữu **${user.name}** đặt cược vào **${baucuaMeta[choice].emoji} ${baucuaMeta[choice].name}**...\n\n` +
                    `🎲 Bát mở ra: ${diceResultString}\n` +
                    `❌ Không xuất hiện linh vật đã chọn!\n\n` +
                    `💸 **THẤT BẠI!** Mất trắng **-${bet.toLocaleString()}** Linh Thạch Hạ Phẩm.`;
    }
  }

  // Apply Luck stat influence
  let luckText = '';
  if (luck > 10) {
    if (isWin) {
      const bonusRate = Math.min(0.10, (luck - 10) * 0.005); // max 10% bonus payout
      const bonusAmount = Math.floor(rewardChange * bonusRate);
      if (bonusAmount > 0) {
        rewardChange += bonusAmount;
        luckText = `\n\n🔮 **Khí Vận Hanh Thông:** Hào quang May Mắn (**${luck}**) độ trì, đạo hữu nhận thêm thiên đạo chúc phúc **+${bonusAmount.toLocaleString()}** Linh Thạch Hạ Phẩm!`;
      }
    } else {
      const refundRate = Math.min(0.15, (luck - 10) * 0.0075); // max 15% refund
      const refundAmount = Math.floor(bet * refundRate);
      if (refundAmount > 0) {
        rewardChange += refundAmount;
        luckText = `\n\n🔮 **Cơ Duyên Cứu Trợ:** Khí vận hanh thông (May Mắn **${luck}**), thiên đạo bảo hộ giảm thiểu kiếp nạn hoàn trả lại **+${refundAmount.toLocaleString()}** Linh Thạch Hạ Phẩm!`;
      }
    }
  }

  // Update database inside transaction
  db.transaction(() => {
    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + rewardChange });
  })();

  const updatedUser = userRepository.get(userId)!;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color as `#${string}`)
    .setDescription(description + luckText + `\n\n🪙 Số dư hiện tại: **${updatedUser.coin_ha_pham.toLocaleString()}** Linh Thạch Hạ Phẩm.`)
    .setTimestamp()
    .setFooter({ text: 'Vận mệnh xoay vần, được thua do trời.' });

  return { success: true, embed };
}

export function getCasinoButtons(
  subcommand: string,
  bet: number,
  choice: string,
  userId: string
): ActionRowBuilder<ButtonBuilder> | null {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`casinoplay_${subcommand}_${bet}_${choice}_${userId}`)
      .setLabel('🔄 Chơi Lại')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`casinodouble_${subcommand}_${bet}_${choice}_${userId}`)
      .setLabel('✖2 Gấp Đôi')
      .setStyle(ButtonStyle.Success)
  );

  // opposite choice is only applicable for doden and taixiu
  if (subcommand === 'doden' || subcommand === 'taixiu') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`casinoopposite_${subcommand}_${bet}_${choice}_${userId}`)
        .setLabel('🔄 Đổi Bên')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return row;
}

export default class CasinoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Hệ thống Đỏ Đen & Tài Xỉu & Bầu Cua thử thách vận khí nhận Linh Thạch.')
        .addSubcommand(sub =>
          sub
            .setName('doden')
            .setDescription('🔴 Đỏ Đen - Tỷ lệ 1 ăn 1 (50/50)')
            .addIntegerOption(opt =>
              opt
                .setName('cuoc')
                .setDescription(`Số Linh Thạch Hạ Phẩm muốn cược (${MIN_BET} - ${MAX_BET.toLocaleString()})`)
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt
                .setName('lua_chon')
                .setDescription('Chọn Đỏ hoặc Đen')
                .setRequired(true)
                .addChoices(
                  { name: '🔴 Đỏ', value: 'do' },
                  { name: '⚫ Đen', value: 'den' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('taixiu')
            .setDescription('🎲 Tài Xỉu - Tỷ lệ 1 ăn 0.95 (Trừ phí sàn 5%)')
            .addIntegerOption(opt =>
              opt
                .setName('cuoc')
                .setDescription(`Số Linh Thạch Hạ Phẩm muốn cược (${MIN_BET} - ${MAX_BET.toLocaleString()})`)
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt
                .setName('lua_chon')
                .setDescription('Chọn Tài (11-18) hoặc Xỉu (3-10)')
                .setRequired(true)
                .addChoices(
                  { name: '📈 Tài (11 - 18)', value: 'tai' },
                  { name: '📉 Xỉu (3 - 10)', value: 'xiu' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('baucua')
            .setDescription('🎃 Bầu Cua Tôm Cá - Tỷ lệ thắng dựa trên số xúc xắc trùng khớp')
            .addIntegerOption(opt =>
              opt
                .setName('cuoc')
                .setDescription(`Số Linh Thạch Hạ Phẩm muốn cược (${MIN_BET} - ${MAX_BET.toLocaleString()})`)
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt
                .setName('lua_chon')
                .setDescription('Chọn linh vật muốn cược')
                .setRequired(true)
                .addChoices(
                  { name: '🎃 Bầu', value: 'bau' },
                  { name: '🦀 Cua', value: 'cua' },
                  { name: '🦐 Tôm', value: 'tom' },
                  { name: '🐟 Cá', value: 'ca' },
                  { name: '🐔 Gà', value: 'ga' },
                  { name: '🦌 Nai', value: 'nai' }
                )
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.', ephemeral: true });
      return;
    }

    // Check Cooldown
    const COOLDOWN_MS = 8000; // 8s cooldown
    const now = Date.now();
    const lastActive = casinoCooldowns.get(userId) || 0;
    if (now - lastActive < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastActive)) / 1000);
      await interaction.reply({
        content: `⏳ Đạo hữu đang bị tâm ma hối thúc! Hãy bình tĩnh dưỡng thần, quay lại sau **${remainingSec}** giây.`,
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand(true);
    const bet = interaction.options.getInteger('cuoc', true);
    const choice = interaction.options.getString('lua_chon', true);

    await interaction.deferReply();
    casinoCooldowns.set(userId, now);

    const result = await runCasinoGame(userId, subcommand, bet, choice);

    if (!result.success) {
      await interaction.editReply({ content: `❌ ${result.message}` });
      return;
    }

    const row = getCasinoButtons(subcommand, bet, choice, userId);
    await interaction.editReply({ embeds: [result.embed!], components: row ? [row] : [] });
  }
}
