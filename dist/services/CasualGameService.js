"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.casualGameService = void 0;
const UserRepository_1 = require("../database/repositories/UserRepository");
// B-09: Casual Mini-Games (separate from existing MinigameService duel system)
const CARD_SUITS = ['♠️', '♥️', '♦️', '♣️'];
const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const FISH_LIST = [
    { name: 'Cá Chép', emoji: '🐟', rarity: 'common', value: 50, weight: 40 },
    { name: 'Cá Trê', emoji: '🐟', rarity: 'common', value: 80, weight: 30 },
    { name: 'Cá Hồi', emoji: '🐟', rarity: 'uncommon', value: 150, weight: 15 },
    { name: 'Tôm Hùm', emoji: '🦞', rarity: 'uncommon', value: 200, weight: 8 },
    { name: 'Cá Ngừ Vây Xanh', emoji: '🐟', rarity: 'rare', value: 500, weight: 5 },
    { name: 'Cá Ông', emoji: '🐋', rarity: 'rare', value: 800, weight: 1.5 },
    { name: 'Rùa Biển', emoji: '🐢', rarity: 'epic', value: 1500, weight: 0.4 },
    { name: 'Cá Rồng', emoji: '🐉', rarity: 'legendary', value: 5000, weight: 0.1 },
];
class CasualGameService {
    /**
     * B-09: Dice Roll — Bet Linh Thạch, 8+ wins
     */
    rollDice(userId, betAmount) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật!' };
        if (betAmount < 10)
            return { success: false, message: 'Tối thiểu cược **10** Linh Thạch!' };
        if (betAmount > 10000)
            return { success: false, message: 'Tối đa cược **10,000** Linh Thạch!' };
        if (user.coin_ha_pham < betAmount)
            return { success: false, message: `Không đủ Linh Thạch! (Cần ${betAmount}, có ${user.coin_ha_pham})` };
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        const won = total >= 8;
        const payout = won ? betAmount * 2 : 0;
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - betAmount + payout });
        const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const msg = `🎲 **Xúc Xắc**\n${dice[d1 - 1]} ${dice[d2 - 1]} = **${total}**\n` +
            (won ? `🎉 **THẮNG!** +${payout} Linh Thạch` : `💀 **THUA!** -${betAmount} Linh Thạch`);
        return { success: true, message: msg };
    }
    /**
     * B-09: Card Game — High card vs dealer
     */
    playCard(userId, betAmount) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật!' };
        if (betAmount < 10)
            return { success: false, message: 'Tối thiểu cược **10** Linh Thạch!' };
        if (betAmount > 10000)
            return { success: false, message: 'Tối đa cược **10,000** Linh Thạch!' };
        if (user.coin_ha_pham < betAmount)
            return { success: false, message: `Không đủ Linh Thạch!` };
        const pSuit = CARD_SUITS[Math.floor(Math.random() * 4)];
        const pVal = CARD_VALUES[Math.floor(Math.random() * 13)];
        const dSuit = CARD_SUITS[Math.floor(Math.random() * 4)];
        const dVal = CARD_VALUES[Math.floor(Math.random() * 13)];
        const pIdx = CARD_VALUES.indexOf(pVal);
        const dIdx = CARD_VALUES.indexOf(dVal);
        const won = pIdx > dIdx;
        const tie = pIdx === dIdx;
        const payout = won ? Math.round(betAmount * 1.9) : (tie ? betAmount : 0);
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - betAmount + payout });
        const msg = `🃏 **Rút Bài**\n🧑 **Bạn:** ${pSuit} ${pVal}\n🤖 **Dealer:** ${dSuit} ${dVal}\n` +
            (tie ? `🤝 **HÒA!** Nhận lại ${betAmount} LT`
                : won ? `🎉 **THẮNG!** +${payout} Linh Thạch`
                    : `💀 **THUA!** -${betAmount} Linh Thạch`);
        return { success: true, message: msg };
    }
    /**
     * B-09: Fishing — Spend 10 stamina, catch fish
     */
    fish(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Chưa tạo nhân vật!' };
        if (user.stamina < 10)
            return { success: false, message: `Không đủ Thể Lực! (Cần 10, có ${user.stamina})` };
        UserRepository_1.userRepository.update(userId, { stamina: user.stamina - 10 });
        if (Math.random() < 0.10) {
            return { success: true, message: `🎣 **Câu Cá** — Cái gì cũng không câu được... Thử lại lần sau!` };
        }
        const totalWeight = FISH_LIST.reduce((s, f) => s + f.weight, 0);
        let rand = Math.random() * totalWeight;
        let fish = FISH_LIST[0];
        for (const f of FISH_LIST) {
            rand -= f.weight;
            if (rand <= 0) {
                fish = f;
                break;
            }
        }
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + fish.value });
        const rarityEmoji = fish.rarity === 'legendary' ? '🟡' : fish.rarity === 'epic' ? '🟣' : fish.rarity === 'rare' ? '🔵' : '⚪';
        return {
            success: true,
            message: `🎣 **Câu Cá**\n${rarityEmoji} **${fish.name}** ${fish.emoji} (${fish.rarity})\n💰 Bán được **+${fish.value}** Linh Thạch`
        };
    }
}
exports.casualGameService = new CasualGameService();
