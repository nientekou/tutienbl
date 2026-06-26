"use strict";
// C-06: Logging Enhancement
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    logs = [];
    maxLogSize = 10000;
    minLevel = 'info';
    levelPriority = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };
    /**
     * C-06: Log message
     */
    log(level, message, context, data) {
        if (this.levelPriority[level] < this.levelPriority[this.minLevel])
            return;
        const entry = { level, message, context, data, timestamp: Date.now() };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(-this.maxLogSize / 2);
        }
        // Console output
        const prefix = `[${level.toUpperCase()}]${context ? ` [${context}]` : ''}`;
        switch (level) {
            case 'debug':
                console.debug(prefix, message);
                break;
            case 'info':
                console.info(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'error':
                console.error(prefix, message, data);
                break;
        }
    }
    debug(message, context) { this.log('debug', message, context); }
    info(message, context) { this.log('info', message, context); }
    warn(message, context) { this.log('warn', message, context); }
    error(message, context, data) { this.log('error', message, context, data); }
    /**
     * C-06: Get logs
     */
    getLogs(limit = 100, level) {
        let filtered = this.logs;
        if (level)
            filtered = filtered.filter(l => l.level === level);
        return filtered.slice(-limit);
    }
    /**
     * C-06: Get log stats
     */
    getLogStats() {
        const stats = { debug: 0, info: 0, warn: 0, error: 0 };
        for (const log of this.logs) {
            stats[log.level]++;
        }
        return stats;
    }
    /**
     * C-06: Set min level
     */
    setMinLevel(level) {
        this.minLevel = level;
    }
    /**
     * C-06: Clear logs
     */
    clearLogs() {
        this.logs = [];
    }
}
exports.logger = new Logger();
