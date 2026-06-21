export class CronManager {
  private static tasks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Đăng ký và chạy một tiến trình nền với cơ chế an toàn
   * @param id Tên định danh của tiến trình (ví dụ: 'world_boss_spawner')
   * @param intervalMs Chu kỳ chạy tính bằng milliseconds
   * @param taskCallback Hàm callback sẽ chạy định kỳ
   */
  public static registerTask(id: string, intervalMs: number, taskCallback: () => Promise<void> | void): void {
    if (this.tasks.has(id)) {
      console.warn(`[CronManager] Tiến trình '${id}' đã tồn tại. Đang ghi đè...`);
      this.stopTask(id);
    }

    console.log(`[CronManager] 🟢 Khởi động tiến trình '${id}' (Mỗi ${intervalMs / 1000}s)`);
    const interval = setInterval(async () => {
      try {
        await taskCallback();
      } catch (error) {
        console.error(`[CronManager] ❌ Lỗi nghiêm trọng trong tiến trình '${id}':`, error);
        // Ngăn chặn sập toàn bộ bot khi một tiến trình con bị lỗi
      }
    }, intervalMs);

    this.tasks.set(id, interval);
  }

  /**
   * Dừng một tiến trình nền
   * @param id Tên định danh tiến trình
   */
  public static stopTask(id: string): void {
    const interval = this.tasks.get(id);
    if (interval) {
      clearInterval(interval);
      this.tasks.delete(id);
      console.log(`[CronManager] 🔴 Đã dừng tiến trình '${id}'.`);
    }
  }

  /**
   * Dừng toàn bộ tiến trình nền (Dùng khi Graceful Shutdown)
   */
  public static stopAll(): void {
    for (const [id, interval] of this.tasks.entries()) {
      clearInterval(interval);
      console.log(`[CronManager] 🔴 Đã dừng tiến trình '${id}'.`);
    }
    this.tasks.clear();
  }
}
