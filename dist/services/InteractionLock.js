"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionLock = void 0;
class InteractionLock {
    static locks = new Set();
    static lastActionEnds = new Map();
    /**
     * Cố gắng lấy khóa cho người chơi.
     * Trả về true nếu lấy khóa thành công và ngoài cooldown 1.2 giây, false nếu bị chặn.
     */
    static acquire(userId) {
        const now = Date.now();
        const lastEnd = this.lastActionEnds.get(userId) || 0;
        if (now - lastEnd < 1200) {
            return false; // Spam block
        }
        if (this.locks.has(userId)) {
            return false; // Concurrent execution block
        }
        this.locks.add(userId);
        return true;
    }
    /**
     * Giải phóng khóa cho người chơi và ghi nhận mốc thời gian kết thúc hành động.
     */
    static release(userId) {
        this.locks.delete(userId);
        this.lastActionEnds.set(userId, Date.now());
    }
    /**
     * Kiểm tra người chơi có đang bị khóa hay không.
     */
    static isLocked(userId) {
        if (this.locks.has(userId))
            return true;
        const lastEnd = this.lastActionEnds.get(userId) || 0;
        return Date.now() - lastEnd < 1200;
    }
}
exports.InteractionLock = InteractionLock;
