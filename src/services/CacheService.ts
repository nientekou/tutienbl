// B-02: Caching Enhancement

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private gcTimer: NodeJS.Timeout;
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };

  constructor(private defaultTtlMs = 30_000) {
    this.gcTimer = setInterval(() => this.gc(), 60_000);
  }

  get<T = any>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) { this.stats.misses++; return null; }
    if (Date.now() > e.expiresAt) { this.store.delete(key); this.stats.evictions++; return null; }
    e.accessCount++;
    e.lastAccessed = Date.now();
    this.stats.hits++;
    return e.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) { this.store.delete(k); this.stats.evictions++; }
    }
  }

  invalidateExact(key: string): void {
    this.store.delete(key);
    this.stats.evictions++;
  }

  // B-02: Cache warming — pre-load frequently accessed data
  warmCache(keys: string[], loader: (key: string) => any, ttlMs?: number): void {
    for (const key of keys) {
      if (!this.get(key)) {
        const data = loader(key);
        if (data) this.set(key, data, ttlMs);
      }
    }
  }

  // B-02: Cache monitoring — get cache stats
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0
    };
  }

  // B-02: Cache size limit
  private maxSize = 10000;

  private gc() {
    const now = Date.now();
    for (const [k, v] of [...this.store.entries()]) {
      if (now > v.expiresAt) { this.store.delete(k); this.stats.evictions++; }
    }
    // B-02: Evict least recently accessed if over limit
    if (this.store.size > this.maxSize) {
      const entries = [...this.store.entries()].sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const toEvict = entries.slice(0, Math.floor(this.maxSize * 0.1)); // Evict 10%
      for (const [k] of toEvict) { this.store.delete(k); this.stats.evictions++; }
    }
  }

  // B-02: Clear all cache
  clearAll(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  }
}

export const cacheService = new CacheService();
