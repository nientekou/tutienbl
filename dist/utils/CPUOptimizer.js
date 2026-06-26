"use strict";
// B-05: CPU Optimization
Object.defineProperty(exports, "__esModule", { value: true });
exports.cpuOptimizer = void 0;
class CPUOptimizer {
    memoCache = new Map();
    memoTtlMs = 60000; // 1 minute default TTL
    /**
     * B-05: Memoize expensive function calls
     */
    memoize(key, fn, ttlMs) {
        const cached = this.memoCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < (ttlMs || this.memoTtlMs)) {
            return cached.data;
        }
        const result = fn();
        this.memoCache.set(key, { data: result, timestamp: Date.now() });
        return result;
    }
    /**
     * B-05: Clear memo cache
     */
    clearMemo() {
        this.memoCache.clear();
    }
    /**
     * B-05: Lazy evaluation — only compute when needed
     */
    lazy(compute) {
        let cached = null;
        let computed = false;
        return {
            get: () => {
                if (!computed) {
                    cached = compute();
                    computed = true;
                }
                return cached;
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
    throttle(fn, limitMs) {
        let lastCall = 0;
        return ((...args) => {
            const now = Date.now();
            if (now - lastCall >= limitMs) {
                lastCall = now;
                return fn(...args);
            }
        });
    }
    /**
     * B-05: Debounce function calls
     */
    debounce(fn, delayMs) {
        let timeoutId;
        return ((...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delayMs);
        });
    }
}
exports.cpuOptimizer = new CPUOptimizer();
