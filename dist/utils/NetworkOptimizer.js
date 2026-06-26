"use strict";
// B-04: Network Optimization
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkOptimizer = void 0;
class NetworkOptimizer {
    pendingRequests = new Map();
    dedupWindowMs = 1000; // 1 second dedup window
    /**
     * B-04: Deduplicate identical requests
     */
    async deduplicate(key, fn) {
        const existing = this.pendingRequests.get(key);
        if (existing && (Date.now() - existing.timestamp) < this.dedupWindowMs) {
            return existing.promise;
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
    async batch(operations) {
        return Promise.all(operations.map(op => op()));
    }
    /**
     * B-04: Get network stats
     */
    getStats() {
        return {
            pendingRequests: this.pendingRequests.size,
            dedupWindow: this.dedupWindowMs
        };
    }
}
exports.networkOptimizer = new NetworkOptimizer();
