// A-02: Crafting Mini-Game

interface CraftingGameResult {
  quality: 'perfect' | 'good' | 'normal' | 'fail';
  bonusMultiplier: number;
  message: string;
}

class CraftingMiniGameService {
  /**
   * A-02: Timing game — click at right time for better quality
   */
  playTimingGame(userId: string): CraftingGameResult {
    // Simulate timing: random position 0-100, sweet spot 40-60
    const position = Math.random() * 100;
    let quality: 'perfect' | 'good' | 'normal' | 'fail';
    let bonusMultiplier: number;

    if (position >= 45 && position <= 55) {
      quality = 'perfect';
      bonusMultiplier = 2.0;
    } else if (position >= 35 && position <= 65) {
      quality = 'good';
      bonusMultiplier = 1.5;
    } else if (position >= 20 && position <= 80) {
      quality = 'normal';
      bonusMultiplier = 1.0;
    } else {
      quality = 'fail';
      bonusMultiplier = 0.5;
    }

    const messages: Record<string, string> = {
      perfect: 'Perfect! Maximum quality!',
      good: 'Good timing! Better quality.',
      normal: 'Normal quality.',
      fail: 'Poor timing! Lower quality.'
    };

    return { quality, bonusMultiplier, message: messages[quality] };
  }

  /**
   * A-02: Pattern game — repeat patterns to unlock recipes
   */
  playPatternGame(userId: string, pattern: number[]): { success: boolean; score: number; message: string } {
    // Simulate pattern matching
    const playerPattern = pattern.map(() => Math.floor(Math.random() * 4));
    const matches = pattern.filter((v, i) => v === playerPattern[i]).length;
    const score = Math.round((matches / pattern.length) * 100);

    const success = score >= 70;

    return {
      success,
      score,
      message: success ? `Pattern matched! Score: ${score}/100` : `Pattern failed. Score: ${score}/100`
    };
  }

  /**
   * A-02: Get crafting game description
   */
  getCraftingGameDescription(): string {
    let msg = `⚒️ **Crafting Mini-Game**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎯 **Timing Game:** Click đúng timing để craft tốt hơn\n`;
    msg += `   Perfect: x2.0 | Good: x1.5 | Normal: x1.0 | Fail: x0.5\n\n`;
    msg += `🧩 **Pattern Game:** Repeat patterns để unlock recipes\n`;
    msg += `   Score 70+ để unlock\n`;
    msg += `\n*Dùng \`/chetao\` để chơi*`;
    return msg;
  }
}

export const craftingMiniGameService = new CraftingMiniGameService();
