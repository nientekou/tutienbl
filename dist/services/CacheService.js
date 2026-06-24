"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
class CacheService {
    defaultTtlMs;
    store = new Map();
    gcTimer;
    constructor(defaultTtlMs = 30_000) {
        this.defaultTtlMs = defaultTtlMs;
        this.gcTimer = setInterval(() => this.gc(), 60_000);
    }
    get(key) {
        const e = this.store.get(key);
        if (!e)
            return null;
        if (Date.now() > e.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return e.data;
    }
    set(key, data, ttlMs) {
        this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
    }
    invalidatePrefix(prefix) {
        for (const k of [...this.store.keys()]) {
            if (k.startsWith(prefix))
                this.store.delete(k);
        }
    }
    invalidateExact(key) { this.store.delete(key); }
    gc() {
        const now = Date.now();
        for (const [k, v] of [...this.store.entries()]) {
            if (now > v.expiresAt)
                this.store.delete(k);
        }
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
