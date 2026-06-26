"use strict";
// B-02: Caching Enhancement
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
class CacheService {
    defaultTtlMs;
    store = new Map();
    gcTimer;
    stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
    constructor(defaultTtlMs = 30_000) {
        this.defaultTtlMs = defaultTtlMs;
        this.gcTimer = setInterval(() => this.gc(), 60_000);
    }
    get(key) {
        const e = this.store.get(key);
        if (!e) {
            this.stats.misses++;
            return null;
        }
        if (Date.now() > e.expiresAt) {
            this.store.delete(key);
            this.stats.evictions++;
            return null;
        }
        e.accessCount++;
        e.lastAccessed = Date.now();
        this.stats.hits++;
        return e.data;
    }
    set(key, data, ttlMs) {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
            accessCount: 0,
            lastAccessed: Date.now()
        });
    }
    invalidatePrefix(prefix) {
        for (const k of [...this.store.keys()]) {
            if (k.startsWith(prefix)) {
                this.store.delete(k);
                this.stats.evictions++;
            }
        }
    }
    invalidateExact(key) {
        this.store.delete(key);
        this.stats.evictions++;
    }
    // B-02: Cache warming — pre-load frequently accessed data
    warmCache(keys, loader, ttlMs) {
        for (const key of keys) {
            if (!this.get(key)) {
                const data = loader(key);
                if (data)
                    this.set(key, data, ttlMs);
            }
        }
    }
    // B-02: Cache monitoring — get cache stats
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.store.size,
            hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0
        };
    }
    // B-02: Cache size limit
    maxSize = 10000;
    gc() {
        const now = Date.now();
        for (const [k, v] of [...this.store.entries()]) {
            if (now > v.expiresAt) {
                this.store.delete(k);
                this.stats.evictions++;
            }
        }
        // B-02: Evict least recently accessed if over limit
        if (this.store.size > this.maxSize) {
            const entries = [...this.store.entries()].sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            const toEvict = entries.slice(0, Math.floor(this.maxSize * 0.1)); // Evict 10%
            for (const [k] of toEvict) {
                this.store.delete(k);
                this.stats.evictions++;
            }
        }
    }
    // B-02: Clear all cache
    clearAll() {
        this.store.clear();
        this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
