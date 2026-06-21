import { describe, it, expect } from 'vitest';
import { CombatEngine, Combatant } from '../src/services/CombatEngine';

describe('CombatEngine', () => {
  it('should run a basic combat and return a winner', () => {
    const player: Combatant = {
      name: 'Player 1',
      hp: 100,
      maxHp: 100,
      atk: 20,
      def: 5,
      crit: 0.1,
      critRes: 0,
      luck: 10,
      speed: 100,
      dodge: 0.05,
      linhCan: '{}'
    };

    const target: Combatant = {
      name: 'Enemy 1',
      hp: 50,
      maxHp: 50,
      atk: 10,
      def: 2,
      crit: 0,
      critRes: 0,
      luck: 5,
      speed: 90,
      dodge: 0,
      linhCan: '{}'
    };

    const result = CombatEngine.run(player, target, null, 10);
    
    expect(result).toBeDefined();
    expect(result.winner).toBeDefined();
    expect(result.log).toBeInstanceOf(Array);
    expect(result.log.length).toBeGreaterThan(0);
    
    // Player has much higher stats, so Player 1 should likely win
    // However, it's a random outcome. We can just verify the combat ends.
    expect(result.winner === 'player' || result.winner === 'enemy').toBe(true);
  });
});
