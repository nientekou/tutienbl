import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { casinoService } from '../../services/CasinoService';

export const casinoCooldowns = new Map<string, number>();
export const MIN_BET = 50;

export default class CasinoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('casino')
        .setDescription('🎰 Sòng bài tu tiên — Thử vận may, trúng Jackpot!')
        .addSubcommand(sub =>
          sub
            .setName('taixiu')
            .setDescription('🎲 Tài Xỉu (Sic Bo) — Tài/Xỉu, Lẻ/Chẵn, Bộ Ba')
            .addIntegerOption(opt =>
              opt.setName('cuoc').setDescription('Số Linh Thạch muốn cược').setRequired(true).setMinValue(50)
            )
            .addStringOption(opt =>
              opt.setName('loai').setDescription('Loại cược').setRequired(true)
                .addChoices(
                  { name: '📈 Tài (11-18)', value: 'tai' },
                  { name: '📉 Xỉu (3-10)', value: 'xiu' },
                  { name: '🔢 Lẻ', value: 'odd' },
                  { name: '🔢 Chẵn', value: 'even' },
                  { name: '🎯 Bộ Ba Bất Kỳ', value: 'any_triple' },
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('blackjack')
            .setDescription('🃏 Blackjack — Đấu với nhà cái, rút bài 21 điểm')
            .addIntegerOption(opt =>
              opt.setName('cuoc').setDescription('Số Linh Thạch muốn cược').setRequired(true).setMinValue(50)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('lichsu')
            .setDescription('📜 Lịch sử cược — 10 ván gần nhất')
        )
        .addSubcommand(sub =>
          sub
            .setName('thongke')
            .setDescription('📊 Thống kê cá cược của bạn')
        )
        .addSubcommand(sub =>
          sub
            .setName('jackpot')
            .setDescription('🎰 Xem quỹ Jackpot hiện tại')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({ content: '❌ Chưa tạo nhân vật! Dùng `/taonhanvat` trước.'});
      return;
    }

    const subcommand = interaction.options.getSubcommand(true);
    const now = Date.now();

    // Check cooldown for games (not for lichsu/thongke/jackpot)
    if (['taixiu', 'blackjack'].includes(subcommand)) {
      const lastActive = casinoCooldowns.get(userId) || 0;
      if (now - lastActive < 8000) {
        const remaining = Math.ceil((8000 - (now - lastActive)) / 1000);
        await interaction.editReply({ content: `⏳ Chờ **${remaining}** giây giữa các ván!`});
        return;
      }
    }

    if (subcommand === 'taixiu') {
      const bet = interaction.options.getInteger('cuoc', true);
      const rawChoice = interaction.options.getString('loai', true);

      // Map choices to bet types
      let betType: string;
      let choice: string | undefined;
      if (rawChoice === 'any_triple') {
        betType = 'any_triple';
      } else if (['tai', 'xiu'].includes(rawChoice)) {
        betType = 'tai_xiu';
        choice = rawChoice;
      } else {
        betType = 'odd_even';
        choice = rawChoice;
      }

      casinoCooldowns.set(userId, now);
      const result = casinoService.playSicBo(userId, bet, betType, choice);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      const maxBet = casinoService.getMaxBetForLevel(user.level);
      const embed = new EmbedBuilder()
        .setTitle('🎲 Xí Ngầu (Sic Bo)')
        .setColor(result.payout > result.bet ? 0x2ecc71 : 0xe74c3c)
        .setDescription(result.details)
        .addFields(
          { name: '💰 Cược', value: `${result.bet.toLocaleString()} LT`, inline: true },
          { name: result.payout > result.bet ? '🎉 Nhận' : '💸 Mất', value: result.payout > result.bet ? `+${result.payout.toLocaleString()} LT` : `-${result.bet.toLocaleString()} LT`, inline: true },
          { name: '🪙 Số dư', value: `${result.updatedBalance.toLocaleString()} LT`, inline: true },
          { name: '🎰 Jackpot', value: `${casinoService.getJackpot().toLocaleString()} LT`, inline: true },
          { name: '📊 Hạn mức', value: `Tối đa: ${maxBet.toLocaleString()} LT`, inline: true },
          { name: '🏆 Tỉ lệ thắng', value: `${casinoService.getStats(userId).win_rate}`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: '1% mỗi cược vào Jackpot • 5% phí sàn' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`casinoreplay_taixiu_${rawChoice}_${userId}`)
          .setLabel(`🔄 Chơi Lại (${bet.toLocaleString()} LT)`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`casinodouble_taixiu_${rawChoice}_${bet}_${userId}`)
          .setLabel('✖2 Gấp Đôi')
          .setStyle(ButtonStyle.Success)
          .setDisabled(bet * 2 > maxBet)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    if (subcommand === 'blackjack') {
      const bet = interaction.options.getInteger('cuoc', true);
      casinoCooldowns.set(userId, now);
      const result = casinoService.playBlackjack(userId, bet);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack')
        .setColor(result.payout > result.bet ? 0x2ecc71 : result.payout === result.bet ? 0xf1c40f : 0xe74c3c)
        .setDescription(result.details)
        .addFields(
          { name: '💰 Cược', value: `${result.bet.toLocaleString()} LT`, inline: true },
          { name: result.payout >= result.bet ? '🎉 Nhận' : '💸 Mất', value: result.payout >= result.bet ? `+${(result.payout - result.bet).toLocaleString()} LT` : `-${result.bet.toLocaleString()} LT`, inline: true },
          { name: '🪙 Số dư', value: `${result.updatedBalance.toLocaleString()} LT`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Blackjack (3:2) • Thường (1:1) • Hòa hoàn tiền' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`casinoreplay_blackjack_${bet}_${userId}`)
          .setLabel(`🔄 Chơi Lại (${bet.toLocaleString()} LT)`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`casinodouble_blackjack_${bet}_${userId}`)
          .setLabel('✖2 Gấp Đôi')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    if (subcommand === 'lichsu') {
      const history = casinoService.getHistory(userId, 10);
      const stats = casinoService.getStats(userId);
      const embed = new EmbedBuilder()
        .setTitle('📜 Lịch Sử Cá Cược — 10 Ván Gần Nhất')
        .setColor(0x9b59b6)
        .setTimestamp();

      if (history.length === 0) {
        embed.setDescription('🚫 Đạo hữu chưa có lịch sử cá cược nào!');
      } else {
        const lines = history.map((h: any, i: number) => {
          const icon = h.result === 'win' ? '✅' : h.result === 'push' ? '🔄' : '❌';
          const time = new Date(h.created_at * 1000).toLocaleString('vi-VN');
          return `${icon} **${h.game_type}** — Cược ${h.bet.toLocaleString()} LT → Nhận ${h.payout.toLocaleString()} LT *(${time})*`;
        });
        embed.setDescription(lines.join('\n'));
      }

      embed.addFields(
        { name: '📊 Tổng cược', value: stats.total_bets.toString(), inline: true },
        { name: '✅ Thắng', value: stats.total_wins.toString(), inline: true },
        { name: '❌ Thua', value: stats.total_losses.toString(), inline: true },
        { name: '🎯 Tỉ lệ thắng', value: stats.win_rate, inline: true },
        { name: '💰 Tổng cược', value: stats.total_bet_amount.toLocaleString() + ' LT', inline: true },
        { name: '🏆 Lãi/Lỗ', value: `${stats.net >= 0 ? '+' : ''}${stats.net.toLocaleString()} LT`, inline: true },
      );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'thongke') {
      const stats = casinoService.getStats(userId);
      const embed = new EmbedBuilder()
        .setTitle('📊 Thống Kê Cá Cược')
        .setColor(0x3498db)
        .addFields(
          { name: '🎰 Tổng số ván', value: stats.total_bets.toLocaleString(), inline: true },
          { name: '✅ Thắng', value: stats.total_wins.toLocaleString(), inline: true },
          { name: '❌ Thua', value: stats.total_losses.toLocaleString(), inline: true },
          { name: '🎯 Tỉ lệ thắng', value: stats.win_rate, inline: true },
          { name: '💰 Tổng tiền cược', value: stats.total_bet_amount.toLocaleString() + ' LT', inline: true },
          { name: '🏆 Tổng tiền nhận', value: stats.total_payout.toLocaleString() + ' LT', inline: true },
          { name: '📈 Lãi/Lỗ ròng', value: `${stats.net >= 0 ? '+' : ''}${stats.net.toLocaleString()} LT`, inline: true },
          { name: '💎 Thắng lớn nhất', value: stats.biggest_win.toLocaleString() + ' LT', inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'jackpot') {
      const jackpot = casinoService.getJackpot();
      const embed = new EmbedBuilder()
        .setTitle('🎰 Quỹ Jackpot')
        .setColor(0xffd700)
        .setDescription([
          `💰 **Quỹ hiện tại:** ${jackpot.toLocaleString()} Linh Thạch`,
          ``,
          `📌 **Thể lệ:**`,
          `• **1%** mỗi lần cược được nạp vào quỹ Jackpot`,
          `• **0.1%** cơ hội trúng Jackpot mỗi ván`,
          `• Khi trúng, nhận **80%** quỹ Jackpot`,
          `• Quỹ tối đa: 5,000,000 LT`,
          ``,
          `🎲 Hãy thử vận may với \`/casino taixiu\` hoặc \`/casino blackjack\`!`,
        ].join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }
}
