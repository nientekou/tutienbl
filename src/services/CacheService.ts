interface CacheEntry<T> { data: T; expiresAt: number; }

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private gcTimer: NodeJS.Timeout;

  constructor(private defaultTtlMs = 30_000) {
    this.gcTimer = setInterval(() => this.gc(), 60_000);
  }

  get<T = any>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  invalidatePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  invalidateExact(key: string): void { this.store.delete(key); }

  private gc() {
    const now = Date.now();
    for (const [k, v] of [...this.store.entries()]) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }
}

export const cacheService = new CacheService();
