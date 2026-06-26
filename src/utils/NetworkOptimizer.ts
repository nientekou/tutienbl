// B-04: Network Optimization

interface RequestDedup {
  key: string;
  promise: Promise<any>;
  timestamp: number;
}

class NetworkOptimizer {
  private pendingRequests = new Map<string, RequestDedup>();
  private dedupWindowMs = 1000; // 1 second dedup window

  /**
   * B-04: Deduplicate identical requests
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing && (Date.now() - existing.timestamp) < this.dedupWindowMs) {
      return existing.promise as Promise<T>;
    }

    const promise = fn();
    this.pendingRequests.set(key, { key, promise, timestamp: Date.now() });

    // Clean up after completion
    promise.finally(() => {
      setTimeout(() => this.pendingRequests.delete(key), this.dedupWindowMs);
    });

    return promise;
  }

  /**
   * B-04: Batch multiple operations
   */
  async batch<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    return Promise.all(operations.map(op => op()));
  }

  /**
   * B-04: Get network stats
   */
  getStats(): { pendingRequests: number; dedupWindow: number } {
    return {
      pendingRequests: this.pendingRequests.size,
      dedupWindow: this.dedupWindowMs
    };
  }
}

export const networkOptimizer = new NetworkOptimizer();
