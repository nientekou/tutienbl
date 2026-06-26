// B-05: CPU Optimization

class CPUOptimizer {
  private memoCache = new Map<string, { data: any; timestamp: number }>();
  private memoTtlMs = 60000; // 1 minute default TTL

  /**
   * B-05: Memoize expensive function calls
   */
  memoize<T>(key: string, fn: () => T, ttlMs?: number): T {
    const cached = this.memoCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < (ttlMs || this.memoTtlMs)) {
      return cached.data as T;
    }

    const result = fn();
    this.memoCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * B-05: Clear memo cache
   */
  clearMemo(): void {
    this.memoCache.clear();
  }

  /**
   * B-05: Lazy evaluation — only compute when needed
   */
  lazy<T>(compute: () => T): { get: () => T; invalidate: () => void } {
    let cached: T | null = null;
    let computed = false;

    return {
      get: () => {
        if (!computed) {
          cached = compute();
          computed = true;
        }
        return cached!;
      },
      invalidate: () => {
        cached = null;
        computed = false;
      }
    };
  }

  /**
   * B-05: Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(fn: T, limitMs: number): T {
    let lastCall = 0;
    return ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= limitMs) {
        lastCall = now;
        return fn(...args);
      }
    }) as T;
  }

  /**
   * B-05: Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(fn: T, delayMs: number): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delayMs);
    }) as T;
  }
}

export const cpuOptimizer = new CPUOptimizer();
