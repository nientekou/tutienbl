import { ButtonInteraction } from 'discord.js';
import { runCasinoGame, getCasinoButtons, casinoCooldowns, MAX_BET } from '../../commands/general/casino';

export class CasinoInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ): Promise<void> {
    // parts: [action, subcommand, betStr, choice, targetUserId]
    const subcommand = parts[1];
    let bet = parseInt(parts[2], 10);
    let choice = parts[3];

    // Check Cooldown (8 seconds)
    const COOLDOWN_MS = 8000;
    const now = Date.now();
    const lastActive = casinoCooldowns.get(targetUserId) || 0;
    if (now - lastActive < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastActive)) / 1000);
      await interaction.reply({
        content: `⏳ Đạo hữu đang bị tâm ma hối thúc! Hãy bình tĩnh dưỡng thần, quay lại sau **${remainingSec}** giây.`,
        ephemeral: true
      });
      return;
    }

    if (action === 'casinodouble') {
      bet = bet * 2;
      if (bet > MAX_BET) {
        await interaction.reply({
          content: `❌ Mức cược nhân đôi (**${bet.toLocaleString()}** LT) vượt quá giới hạn tối đa (**${MAX_BET.toLocaleString()}** LT)!`,
          ephemeral: true
        });
        return;
      }
    } else if (action === 'casinoopposite') {
      if (subcommand === 'doden') {
        choice = choice === 'do' ? 'den' : 'do';
      } else if (subcommand === 'taixiu') {
        choice = choice === 'tai' ? 'xiu' : 'tai';
      }
    }

    await interaction.deferUpdate();
    casinoCooldowns.set(targetUserId, now);

    const result = await runCasinoGame(targetUserId, subcommand, bet, choice);

    if (!result.success) {
      await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
      return;
    }

    const row = getCasinoButtons(subcommand, bet, choice, targetUserId);
    await interaction.editReply({ embeds: [result.embed!], components: row ? [row] : [] });
  }
}
