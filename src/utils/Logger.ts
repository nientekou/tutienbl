// C-06: Logging Enhancement

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  timestamp: number;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogSize = 10000;
  private minLevel: LogLevel = 'info';

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  /**
   * C-06: Log message
   */
  log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (this.levelPriority[level] < this.levelPriority[this.minLevel]) return;

    const entry: LogEntry = { level, message, context, data, timestamp: Date.now() };
    this.logs.push(entry);

    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize / 2);
    }

    // Console output
    const prefix = `[${level.toUpperCase()}]${context ? ` [${context}]` : ''}`;
    switch (level) {
      case 'debug': console.debug(prefix, message); break;
      case 'info': console.info(prefix, message); break;
      case 'warn': console.warn(prefix, message); break;
      case 'error': console.error(prefix, message, data); break;
    }
  }

  debug(message: string, context?: string): void { this.log('debug', message, context); }
  info(message: string, context?: string): void { this.log('info', message, context); }
  warn(message: string, context?: string): void { this.log('warn', message, context); }
  error(message: string, context?: string, data?: any): void { this.log('error', message, context, data); }

  /**
   * C-06: Get logs
   */
  getLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    let filtered = this.logs;
    if (level) filtered = filtered.filter(l => l.level === level);
    return filtered.slice(-limit);
  }

  /**
   * C-06: Get log stats
   */
  getLogStats(): Record<LogLevel, number> {
    const stats: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const log of this.logs) {
      stats[log.level]++;
    }
    return stats;
  }

  /**
   * C-06: Set min level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * C-06: Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
