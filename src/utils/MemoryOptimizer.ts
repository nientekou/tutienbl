// B-03: Memory Optimization

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

class MemoryOptimizer {
  private objectPools = new Map<string, any[]>();
  private maxPoolSize = 100;

  /**
   * B-03: Get current memory usage
   */
  getMemoryUsage(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024)
    };
  }

  /**
   * B-03: Get memory description for UI
   */
  getMemoryDescription(): string {
    const stats = this.getMemoryUsage();
    let msg = `💾 **Memory Usage**\n`;
    msg += `📊 Heap: **${stats.heapUsed}MB** / ${stats.heapTotal}MB\n`;
    msg += `📈 RSS: **${stats.rss}MB**\n`;
    msg += `🔧 External: **${stats.external}MB**\n`;
    return msg;
  }

  /**
   * B-03: Object pooling — reuse objects to reduce GC pressure
   */
  acquireObject<T>(poolName: string): T | null {
    const pool = this.objectPools.get(poolName);
    if (pool && pool.length > 0) {
      return pool.pop() as T;
    }
    return null;
  }

  releaseObject<T>(poolName: string, obj: T): void {
    let pool = this.objectPools.get(poolName);
    if (!pool) {
      pool = [];
      this.objectPools.set(poolName, pool);
    }
    if (pool.length < this.maxPoolSize) {
      pool.push(obj);
    }
  }

  /**
   * B-03: Force garbage collection (if available)
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * B-03: Get object pool stats
   */
  getPoolStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, pool] of this.objectPools) {
      stats[name] = pool.length;
    }
    return stats;
  }
}

export const memoryOptimizer = new MemoryOptimizer();
