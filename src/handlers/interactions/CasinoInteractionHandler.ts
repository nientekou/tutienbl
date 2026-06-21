import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { casinoCooldowns, MIN_BET } from '../../commands/general/casino';
import { casinoService } from '../../services/CasinoService';
import { userRepository } from '../../database/repositories/UserRepository';

export class CasinoInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ): Promise<void> {
    const now = Date.now();
    const lastActive = casinoCooldowns.get(targetUserId) || 0;
    if (now - lastActive < 8000) {
      const remaining = Math.ceil((8000 - (now - lastActive)) / 1000);
      await interaction.reply({ content: `⏳ Chờ **${remaining}** giây!`, ephemeral: true });
      return;
    }

    const user = userRepository.get(targetUserId);
    if (!user) {
      await interaction.reply({ content: '❌ Chưa tạo nhân vật!', ephemeral: true });
      return;
    }

    // Handle old-style buttons (doden, taixiu, baucua)
    if (action === 'casinoplay' || action === 'casinoopposite') {
      const subcommand = parts[1];
      let bet = parseInt(parts[2], 10);
      let choice = parts[3];

      if (action === 'casinoopposite') {
        if (subcommand === 'doden') {
          choice = choice === 'do' ? 'den' : 'do';
        } else if (subcommand === 'taixiu') {
          choice = choice === 'tai' ? 'xiu' : 'tai';
        }
      }

      await interaction.deferUpdate();
      casinoCooldowns.set(targetUserId, now);

      const { runCasinoGame, getCasinoButtons } = require('../../commands/general/casino-old') || 
        require('../../commands/general/casino');
      const result = await runCasinoGame(targetUserId, subcommand, bet, choice);

      if (!result.success) {
        await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
        return;
      }

      const row = getCasinoButtons(subcommand, bet, choice, targetUserId);
      await interaction.editReply({ embeds: [result.embed!], components: row ? [row] : [] });
      return;
    }

    // Old-style double
    if (action === 'casinodouble') {
      // parts: ['casinodouble', subcommand, choice, bet, userId] or ['casinodouble', 'blackjack', bet, userId]
      // Handle old-style double first
      if (parts.length >= 5 && ['doden', 'taixiu', 'baucua'].includes(parts[1])) {
        const subcommand = parts[1];
        let bet = parseInt(parts[3], 10) * 2;
        const choice = parts[2];

        if (bet > 200000) {
          await interaction.reply({ content: `❌ Vượt quá hạn mức tối đa!`, ephemeral: true });
          return;
        }

        await interaction.deferUpdate();
        casinoCooldowns.set(targetUserId, now);

        const { runCasinoGame, getCasinoButtons } = require('../../commands/general/casino');
        const result = await runCasinoGame(targetUserId, subcommand, bet, choice);

        if (!result.success) {
          await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const row = getCasinoButtons(subcommand, bet, choice, targetUserId);
        await interaction.editReply({ embeds: [result.embed!], components: row ? [row] : [] });
        return;
      }

      // New-style Sic Bo double
      if (parts[1] === 'taixiu') {
        const rawChoice = parts[2];
        const currentBet = parseInt(parts[3], 10);
        const bet = currentBet * 2;
        const maxBet = casinoService.getMaxBetForLevel(user.level);

        if (bet > maxBet) {
          await interaction.reply({ content: `❌ Vượt quá hạn mức **${maxBet.toLocaleString()} LT** theo cảnh giới của đạo hữu!`, ephemeral: true });
          return;
        }

        await interaction.deferUpdate();
        casinoCooldowns.set(targetUserId, now);

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

        const result = casinoService.playSicBo(targetUserId, bet, betType, choice);
        if (!result.success) {
          await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const embed = buildSicBoEmbed(result, user.level);
        const row = buildSicBoButtons(rawChoice, bet, user.level, targetUserId);
        await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
        return;
      }

      // Blackjack double
      if (parts[1] === 'blackjack') {
        const currentBet = parseInt(parts[2], 10);
        const bet = currentBet * 2;
        const maxBet = casinoService.getMaxBetForLevel(user.level);

        if (bet > maxBet) {
          await interaction.reply({ content: `❌ Vượt quá hạn mức **${maxBet.toLocaleString()} LT**!`, ephemeral: true });
          return;
        }

        await interaction.deferUpdate();
        casinoCooldowns.set(targetUserId, now);

        const result = casinoService.playBlackjack(targetUserId, bet);
        if (!result.success) {
          await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const embed = buildBlackjackEmbed(result);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`casinoreplay_blackjack_${bet}_${targetUserId}`)
            .setLabel(`🔄 Chơi Lại (${bet.toLocaleString()} LT)`)
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`casinodouble_blackjack_${bet}_${targetUserId}`)
            .setLabel('✖2 Gấp Đôi')
            .setStyle(ButtonStyle.Success)
            .setDisabled(bet * 2 > maxBet)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }
    }

    // New-style replay
    if (action === 'casinoreplay') {
      const gameType = parts[1]; // 'taixiu' or 'blackjack'

      if (gameType === 'taixiu') {
        const rawChoice = parts[2];
        const bet = parseInt(parts[3], 10);

        await interaction.deferUpdate();
        casinoCooldowns.set(targetUserId, now);

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

        const result = casinoService.playSicBo(targetUserId, bet, betType, choice);
        if (!result.success) {
          await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const embed = buildSicBoEmbed(result, user.level);
        const row = buildSicBoButtons(rawChoice, bet, user.level, targetUserId);
        await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
        return;
      }

      if (gameType === 'blackjack') {
        const bet = parseInt(parts[2], 10);

        await interaction.deferUpdate();
        casinoCooldowns.set(targetUserId, now);

        const result = casinoService.playBlackjack(targetUserId, bet);
        if (!result.success) {
          await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
          return;
        }

        const embed = buildBlackjackEmbed(result);
        const maxBet = casinoService.getMaxBetForLevel(user.level);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`casinoreplay_blackjack_${bet}_${targetUserId}`)
            .setLabel(`🔄 Chơi Lại (${bet.toLocaleString()} LT)`)
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`casinodouble_blackjack_${bet}_${targetUserId}`)
            .setLabel('✖2 Gấp Đôi')
            .setStyle(ButtonStyle.Success)
            .setDisabled(bet * 2 > maxBet)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }
    }

    await interaction.reply({ content: '❌ Hành động không hợp lệ!', ephemeral: true });
  }
}

function buildSicBoEmbed(result: any, level: number): EmbedBuilder {
  const maxBet = casinoService.getMaxBetForLevel(level);
  const stats = casinoService.getStats(result._userId || '');

  return new EmbedBuilder()
    .setTitle('🎲 Xí Ngầu (Sic Bo)')
    .setColor(result.payout > result.bet ? 0x2ecc71 : 0xe74c3c)
    .setDescription(result.details)
    .addFields(
      { name: '💰 Cược', value: `${result.bet.toLocaleString()} LT`, inline: true },
      { name: result.payout > result.bet ? '🎉 Nhận' : '💸 Mất', value: result.payout > result.bet ? `+${result.payout.toLocaleString()} LT` : `-${result.bet.toLocaleString()} LT`, inline: true },
      { name: '🪙 Số dư', value: `${result.updatedBalance.toLocaleString()} LT`, inline: true },
      { name: '🎰 Jackpot', value: `${casinoService.getJackpot().toLocaleString()} LT`, inline: true },
      { name: '📊 Hạn mức', value: `Tối đa: ${maxBet.toLocaleString()} LT`, inline: true },
      { name: '🏆 Tỉ lệ thắng', value: `${stats.win_rate}`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: '1% mỗi cược vào Jackpot • 5% phí sàn' });
}

function buildSicBoButtons(rawChoice: string, bet: number, level: number, userId: string): ActionRowBuilder<ButtonBuilder> | null {
  const maxBet = casinoService.getMaxBetForLevel(level);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`casinoreplay_taixiu_${rawChoice}_${bet}_${userId}`)
      .setLabel(`🔄 Chơi Lại (${bet.toLocaleString()} LT)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`casinodouble_taixiu_${rawChoice}_${bet}_${userId}`)
      .setLabel('✖2 Gấp Đôi')
      .setStyle(ButtonStyle.Success)
      .setDisabled(bet * 2 > maxBet)
  );
  return row;
}

function buildBlackjackEmbed(result: any): EmbedBuilder {
  return new EmbedBuilder()
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
}
