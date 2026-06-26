"use strict";
// B-03: Memory Optimization
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryOptimizer = void 0;
class MemoryOptimizer {
    objectPools = new Map();
    maxPoolSize = 100;
    /**
     * B-03: Get current memory usage
     */
    getMemoryUsage() {
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
    getMemoryDescription() {
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
    acquireObject(poolName) {
        const pool = this.objectPools.get(poolName);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return null;
    }
    releaseObject(poolName, obj) {
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
    forceGC() {
        if (global.gc) {
            global.gc();
        }
    }
    /**
     * B-03: Get object pool stats
     */
    getPoolStats() {
        const stats = {};
        for (const [name, pool] of this.objectPools) {
            stats[name] = pool.length;
        }
        return stats;
    }
}
exports.memoryOptimizer = new MemoryOptimizer();
