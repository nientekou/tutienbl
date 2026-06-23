import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryService } from './InventoryService';

// ─── Types ───

export interface SicBoResult {
  dice: [number, number, number];
  total: number;
  isTriple: boolean;
  isDouble: boolean;
  tripleValue: number | null;
  doubleValue: number | null;
}

export interface BlackjackHand {
  cards: number[];
  total: number;
  isBust: boolean;
  isBlackjack: boolean;
  display: string;
}

export interface CasinoGameResult {
  success: boolean;
  message?: string;
  gameType: string;
  bet: number;
  payout: number;
  result: string;
  details: string;
  updatedBalance: number;
  jackpotContribution: number;
  jackpotWon: boolean;
  jackpotAmount: number;
}

// ─── Constants ───

const HOUSE_EDGE = 0.05;
const JACKPOT_CONTRIBUTION_RATE = 0.01; // 1% mỗi cược vào jackpot
const JACKPOT_TRIGGER_CHANCE = 0.001; // 0.1% cơ hội trúng jackpot
const CARD_SUITS = ['♠', '♥', '♣', '♦'];
const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_VALUE_MAP: Record<string, number> = {
  A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10,
};

// ─── Helper Functions ───

function getMaxBet(level: number): number {
  if (level >= 300) return 500000;
  if (level >= 200) return 300000;
  if (level >= 100) return 200000;
  if (level >= 50) return 100000;
  if (level >= 20) return 50000;
  return 20000;
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function rollSicBo(): SicBoResult {
  const dice: [number, number, number] = [rollDice(), rollDice(), rollDice()];
  const total = dice[0] + dice[1] + dice[2];
  const sorted = [...dice].sort((a, b) => a - b);
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  const isDouble = !isTriple && (dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]);
  return {
    dice,
    total,
    isTriple,
    isDouble,
    tripleValue: isTriple ? dice[0] : null,
    doubleValue: isDouble ? (dice[0] === dice[1] ? dice[0] : dice[2]) : null,
  };
}

function drawCard(): number {
  const suit = CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)];
  const value = CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)];
  return CARD_VALUE_MAP[value];
}

function formatCard(value: number): string {
  for (const [k, v] of Object.entries(CARD_VALUE_MAP)) {
    if (v === value) return k;
  }
  return String(value);
}

function calculateHandTotal(cards: number[]): number {
  let total = cards.reduce((s, c) => s + c, 0);
  let aces = cards.filter(c => c === 11).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function getHandDisplay(cards: number[]): string {
  return cards.map(c => formatCard(c)).join(' ');
}

// ─── Sic Bo Bet Types ───

type SicBoBet = 
  | { type: 'tai_xiu'; choice: 'tai' | 'xiu' }
  | { type: 'exact_total'; total: number }
  | { type: 'single_double'; value: number }
  | { type: 'single_triple'; value: number }
  | { type: 'any_triple' }
  | { type: 'odd_even'; choice: 'odd' | 'even' };

const SICBO_PAYOUTS: Record<string, number> = {
  tai_xiu: 1.95,
  exact_total_4: 60, exact_total_5: 30, exact_total_6: 17,
  exact_total_7: 12, exact_total_8: 8, exact_total_9: 6,
  exact_total_10: 6, exact_total_11: 6, exact_total_12: 6,
  exact_total_13: 8, exact_total_14: 12, exact_total_15: 17,
  exact_total_16: 30, exact_total_17: 60,
  single_double: 10,
  single_triple: 180,
  any_triple: 30,
  odd_even: 1.95,
};

function resolveSicBoBet(bet: SicBoBet, result: SicBoResult): { win: boolean; multiplier: number } {
  switch (bet.type) {
    case 'tai_xiu':
      return {
        win: (bet.choice === 'tai' && result.total >= 11) || (bet.choice === 'xiu' && result.total <= 10),
        multiplier: result.isTriple ? 0 : SICBO_PAYOUTS.tai_xiu, // Triple loses for tai/xiu
      };
    case 'exact_total': {
      const payoutKey = `exact_total_${bet.total}` as keyof typeof SICBO_PAYOUTS;
      return {
        win: result.total === bet.total,
        multiplier: SICBO_PAYOUTS[payoutKey] || 0,
      };
    }
    case 'single_double':
      return {
        win: result.isDouble && result.doubleValue === bet.value,
        multiplier: SICBO_PAYOUTS.single_double,
      };
    case 'single_triple':
      return {
        win: result.isTriple && result.tripleValue === bet.value,
        multiplier: SICBO_PAYOUTS.single_triple,
      };
    case 'any_triple':
      return { win: result.isTriple, multiplier: SICBO_PAYOUTS.any_triple };
    case 'odd_even':
      return {
        win: (bet.choice === 'odd' && result.total % 2 === 1) || (bet.choice === 'even' && result.total % 2 === 0),
        multiplier: result.isTriple ? 0 : SICBO_PAYOUTS.odd_even,
      };
  }
}

// ─── Blackjack ───

interface BlackjackResult {
  playerHand: BlackjackHand;
  dealerHand: BlackjackHand;
  winner: 'player' | 'dealer' | 'push';
  payoutMultiplier: number;
}

function playBlackjack(): BlackjackResult {
  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];

  // Dealer draws to 16, stands on 17
  while (calculateHandTotal(dealerCards) < 17) {
    dealerCards.push(drawCard());
  }

  const playerTotal = calculateHandTotal(playerCards);
  const dealerTotal = calculateHandTotal(dealerCards);

  const playerBust = playerTotal > 21;
  const dealerBust = dealerTotal > 21;
  const playerBJ = playerCards.length === 2 && playerTotal === 21;
  const dealerBJ = dealerCards.length === 2 && dealerTotal === 21;

  let winner: 'player' | 'dealer' | 'push';
  let payoutMultiplier: number;

  if (playerBJ && dealerBJ) {
    winner = 'push';
    payoutMultiplier = 1;
  } else if (playerBJ) {
    winner = 'player';
    payoutMultiplier = 2.5; // Blackjack pays 3:2
  } else if (dealerBJ) {
    winner = 'dealer';
    payoutMultiplier = 0;
  } else if (playerBust) {
    winner = 'dealer';
    payoutMultiplier = 0;
  } else if (dealerBust) {
    winner = 'player';
    payoutMultiplier = 2;
  } else if (playerTotal > dealerTotal) {
    winner = 'player';
    payoutMultiplier = 2;
  } else if (dealerTotal > playerTotal) {
    winner = 'dealer';
    payoutMultiplier = 0;
  } else {
    winner = 'push';
    payoutMultiplier = 1;
  }

  function formatHand(cards: number[]): BlackjackHand {
    const total = calculateHandTotal(cards);
    return {
      cards,
      total,
      isBust: total > 21,
      isBlackjack: cards.length === 2 && total === 21,
      display: cards.map(c => {
        for (const [k, v] of Object.entries(CARD_VALUE_MAP)) {
          if (v === c) return k;
        }
        return String(c);
      }).join(' '),
    };
  }

  return {
    playerHand: formatHand(playerCards),
    dealerHand: formatHand(dealerCards),
    winner,
    payoutMultiplier,
  };
}

// ─── Main Service ───

export class CasinoService {
  private updateStats(userId: string, gameType: string, bet: number, payout: number, win: boolean): void {
    const existing = db.prepare('SELECT * FROM casino_stats WHERE user_id = ?').get(userId) as any;
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      db.prepare(`
        UPDATE casino_stats SET
          total_bets = total_bets + 1,
          total_wins = total_wins + ?,
          total_losses = total_losses + ?,
          total_bet_amount = total_bet_amount + ?,
          total_payout = total_payout + ?,
          biggest_win = MAX(biggest_win, ?),
          last_played_at = ?
        WHERE user_id = ?
      `).run(win ? 1 : 0, win ? 0 : 1, bet, payout, payout, now, userId);
    } else {
      db.prepare(`
        INSERT INTO casino_stats (user_id, total_bets, total_wins, total_losses, total_bet_amount, total_payout, biggest_win, last_played_at)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?)
      `).run(userId, win ? 1 : 0, win ? 0 : 1, bet, payout, payout, now);
    }

    db.prepare(`
      INSERT INTO casino_history (user_id, game_type, bet, result, payout, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, gameType, bet, win ? 'win' : 'loss', payout, `${gameType} | Đặt ${bet} | Nhận ${payout}`, now);
  }

  private getJackpotInternal(): number {
    const row = db.prepare("SELECT value FROM system_config WHERE key = 'casino_jackpot'").get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  }

  private getJackpotCapInternal(): number {
    const row = db.prepare("SELECT value FROM system_config WHERE key = 'jackpot_cap'").get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 5000000;
  }

  private addToJackpot(amount: number): void {
    const current = this.getJackpotInternal();
    const cap = this.getJackpotCapInternal();
    const newTotal = Math.min(current + amount, cap);
    db.prepare("UPDATE system_config SET value = ? WHERE key = 'casino_jackpot'").run(String(newTotal));
  }

  private resetJackpot(): void {
    db.prepare("UPDATE system_config SET value = '0' WHERE key = 'casino_jackpot'").run();
  }

  private tryJackpot(userId: string, bet: number): { won: boolean; amount: number } {
    const jackpot = this.getJackpotInternal();
    if (jackpot <= 0) return { won: false, amount: 0 };
    if (Math.random() < JACKPOT_TRIGGER_CHANCE) {
      const winAmount = Math.floor(jackpot * 0.8); // 80% of jackpot
      this.resetJackpot();
      return { won: true, amount: winAmount };
    }
    return { won: false, amount: 0 };
  }

  playSicBo(userId: string, betAmount: number, betType: string, choice?: string): CasinoGameResult {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Chưa tạo nhân vật!' } as any;
    if (user.coin_ha_pham < betAmount) return { success: false, message: `Không đủ Linh Thạch! (Có: ${user.coin_ha_pham})` } as any;

    const maxBet = getMaxBet(user.level);
    if (betAmount < 50 || betAmount > maxBet) return { success: false, message: `Mức cược từ 50 đến ${maxBet.toLocaleString()} LT!` } as any;

    let sicboBet: SicBoBet;
    switch (betType) {
      case 'tai_xiu':
        if (!choice || !['tai', 'xiu'].includes(choice)) return { success: false, message: 'Chọn Tài hoặc Xỉu!' } as any;
        sicboBet = { type: 'tai_xiu', choice: choice as 'tai' | 'xiu' };
        break;
      case 'odd_even':
        if (!choice || !['odd', 'even'].includes(choice)) return { success: false, message: 'Chọn Lẻ hoặc Chẵn!' } as any;
        sicboBet = { type: 'odd_even', choice: choice as 'odd' | 'even' };
        break;
      case 'any_triple':
        sicboBet = { type: 'any_triple' };
        break;
      default:
        return { success: false, message: 'Loại cược không hợp lệ!' } as any;
    }

    const result = rollSicBo();
    const { win, multiplier } = resolveSicBoBet(sicboBet, result);

    let payout = 0;
    if (win) {
      payout = Math.floor(betAmount * multiplier);
    }

    const jackpotContrib = Math.floor(betAmount * JACKPOT_CONTRIBUTION_RATE);
    this.addToJackpot(jackpotContrib);

    const jackpotResult = this.tryJackpot(userId, betAmount);
    const totalPayout = payout + (jackpotResult.won ? jackpotResult.amount : 0);
    const netChange = totalPayout - betAmount;

    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + netChange });
    })();

    this.updateStats(userId, `sicbo_${betType}`, betAmount, totalPayout, win || jackpotResult.won);

    const diceEmoji: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
    const diceStr = result.dice.map(d => `${diceEmoji[d]}[${d}]`).join(' ');

    const jackpotText = jackpotResult.won ? `\n\n🎰 **JACKPOT!** Đạo hữu trúng **${jackpotResult.amount.toLocaleString()}** Linh Thạch từ quỹ tích lũy!` : '';

    return {
      success: true,
      gameType: 'Sic Bo',
      bet: betAmount,
      payout: totalPayout,
      result: win ? 'win' : 'loss',
      details: `🎲 Xúc xắc: ${diceStr}\nTổng: **${result.total}**${result.isTriple ? ' 🎯 **Bộ Ba!**' : result.isDouble ? ' ✌️ **Bộ Đôi!**' : ''}${jackpotText}`,
      updatedBalance: user.coin_ha_pham + netChange,
      jackpotContribution: jackpotContrib,
      jackpotWon: jackpotResult.won,
      jackpotAmount: jackpotResult.amount,
    };
  }

  playBlackjack(userId: string, betAmount: number): CasinoGameResult {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Chưa tạo nhân vật!' } as any;
    if (user.coin_ha_pham < betAmount) return { success: false, message: `Không đủ Linh Thạch! (Có: ${user.coin_ha_pham})` } as any;

    const maxBet = getMaxBet(user.level);
    if (betAmount < 50 || betAmount > maxBet) return { success: false, message: `Mức cược từ 50 đến ${maxBet.toLocaleString()} LT!` } as any;

    const game = playBlackjack();
    const win = game.winner === 'player';
    const push = game.winner === 'push';

    let payout = 0;
    if (push) {
      payout = betAmount;
    } else if (win) {
      payout = Math.floor(betAmount * game.payoutMultiplier);
    }

    const jackpotContrib = Math.floor(betAmount * JACKPOT_CONTRIBUTION_RATE);
    this.addToJackpot(jackpotContrib);

    const jackpotResult = this.tryJackpot(userId, betAmount);
    const totalPayout = payout + (jackpotResult.won ? jackpotResult.amount : 0);
    const netChange = totalPayout - betAmount;

    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + netChange });
    })();

    this.updateStats(userId, 'blackjack', betAmount, totalPayout, win || push || jackpotResult.won);

    const resultText = push ? '**HÒA!**' : win ? '**THẮNG!**' : '**THUA!**';
    const payoutText = push ? 'Hoàn tiền' : win ? `+${payout.toLocaleString()} LT` : `Mất ${betAmount.toLocaleString()} LT`;

    const jackpotText = jackpotResult.won ? `\n\n🎰 **JACKPOT!** +${jackpotResult.amount.toLocaleString()} LT!` : '';
    const bjText = game.playerHand.isBlackjack ? ' 🃏 **BLACKJACK!**' : '';

    const details = [
      `🃏 **Người chơi:** ${game.playerHand.display} = **${game.playerHand.total}**${bjText}`,
      `🏠 **Nhà cái:** ${game.dealerHand.display} = **${game.dealerHand.total}**`,
      ``,
      `📊 Kết quả: ${resultText} — ${payoutText}${jackpotText}`,
    ].join('\n');

    return {
      success: true,
      gameType: 'Blackjack',
      bet: betAmount,
      payout: totalPayout,
      result: push ? 'push' : win ? 'win' : 'loss',
      details,
      updatedBalance: user.coin_ha_pham + netChange,
      jackpotContribution: jackpotContrib,
      jackpotWon: jackpotResult.won,
      jackpotAmount: jackpotResult.amount,
    };
  }

  getStats(userId: string): any {
    const stats = db.prepare('SELECT * FROM casino_stats WHERE user_id = ?').get(userId) as any;
    if (!stats) {
      return {
        total_bets: 0, total_wins: 0, total_losses: 0,
        total_bet_amount: 0, total_payout: 0, biggest_win: 0,
        win_rate: '0%', net: 0,
      };
    }
    return {
      ...stats,
      win_rate: stats.total_bets > 0 ? (stats.total_wins / stats.total_bets * 100).toFixed(1) + '%' : '0%',
      net: stats.total_payout - stats.total_bet_amount,
    };
  }

  getHistory(userId: string, limit: number = 10): any[] {
    return db.prepare(`
      SELECT * FROM casino_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit) as any[];
  }

  getJackpot(): number {
    return this.getJackpotInternal();
  }

  getMaxBetForLevel(level: number): number {
    return getMaxBet(level);
  }
}

export const casinoService = new CasinoService();
