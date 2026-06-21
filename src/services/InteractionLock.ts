export class InteractionLock {
  private static locks = new Set<string>();
  private static lastActionEnds = new Map<string, number>();

  /**
   * Cố gắng lấy khóa cho người chơi.
   * Trả về true nếu lấy khóa thành công và ngoài cooldown 1.2 giây, false nếu bị chặn.
   */
  public static acquire(userId: string): boolean {
    const now = Date.now();
    const lastEnd = this.lastActionEnds.get(userId) || 0;
    if (now - lastEnd < 1200) {
      return false; // Spam block
    }
    if (this.locks.has(userId)) {
      return false; // Concurrent execution block
    }
    this.locks.add(userId);
    return true;
  }

  /**
   * Giải phóng khóa cho người chơi và ghi nhận mốc thời gian kết thúc hành động.
   */
  public static release(userId: string): void {
    this.locks.delete(userId);
    this.lastActionEnds.set(userId, Date.now());
  }

  /**
   * Kiểm tra người chơi có đang bị khóa hay không.
   */
  public static isLocked(userId: string): boolean {
    if (this.locks.has(userId)) return true;
    const lastEnd = this.lastActionEnds.get(userId) || 0;
    return Date.now() - lastEnd < 1200;
  }
}
