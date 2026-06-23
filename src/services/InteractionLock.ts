import { GAME_CONSTANTS } from '../config/gameConstants';

export class InteractionLock {
  private static locks = new Set<string>();
  private static lastActionEnds = new Map<string, number>();
  private static lastCleanup = Date.now();

  public static acquire(userId: string): boolean {
    const now = Date.now();
    const lastEnd = this.lastActionEnds.get(userId) || 0;
    if (now - lastEnd < GAME_CONSTANTS.INTERACTION_LOCK_MS) {
      return false;
    }
    if (this.locks.has(userId)) {
      return false;
    }
    this.locks.add(userId);
    this.maybeCleanup(now);
    return true;
  }

  public static release(userId: string): void {
    this.locks.delete(userId);
    this.lastActionEnds.set(userId, Date.now());
  }

  public static isLocked(userId: string): boolean {
    if (this.locks.has(userId)) return true;
    const lastEnd = this.lastActionEnds.get(userId) || 0;
    return Date.now() - lastEnd < GAME_CONSTANTS.INTERACTION_LOCK_MS;
  }

  private static maybeCleanup(now: number): void {
    if (now - this.lastCleanup < GAME_CONSTANTS.CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [userId, ts] of this.lastActionEnds) {
      if (now - ts > GAME_CONSTANTS.INTERACTION_LOCK_TTL_MS) this.lastActionEnds.delete(userId);
    }
  }
}
