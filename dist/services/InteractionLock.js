"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionLock = void 0;
const gameConstants_1 = require("../config/gameConstants");
class InteractionLock {
    static locks = new Set();
    static lastActionEnds = new Map();
    static lastCleanup = Date.now();
    static acquire(userId) {
        const now = Date.now();
        const lastEnd = this.lastActionEnds.get(userId) || 0;
        if (now - lastEnd < gameConstants_1.GAME_CONSTANTS.INTERACTION_LOCK_MS) {
            return false;
        }
        if (this.locks.has(userId)) {
            return false;
        }
        this.locks.add(userId);
        this.maybeCleanup(now);
        return true;
    }
    static release(userId) {
        this.locks.delete(userId);
        this.lastActionEnds.set(userId, Date.now());
    }
    static isLocked(userId) {
        if (this.locks.has(userId))
            return true;
        const lastEnd = this.lastActionEnds.get(userId) || 0;
        return Date.now() - lastEnd < gameConstants_1.GAME_CONSTANTS.INTERACTION_LOCK_MS;
    }
    static maybeCleanup(now) {
        if (now - this.lastCleanup < gameConstants_1.GAME_CONSTANTS.CLEANUP_INTERVAL_MS)
            return;
        this.lastCleanup = now;
        for (const [userId, ts] of this.lastActionEnds) {
            if (now - ts > gameConstants_1.GAME_CONSTANTS.INTERACTION_LOCK_TTL_MS)
                this.lastActionEnds.delete(userId);
        }
    }
}
exports.InteractionLock = InteractionLock;
