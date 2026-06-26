"use strict";
// C-02: Error Handling Enhancement
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandling = void 0;
class ErrorHandling {
    errorLog = [];
    maxLogSize = 1000;
    /**
     * C-02: Create app error
     */
    createError(code, message, category, details) {
        const error = { code, message, category, details, timestamp: Date.now() };
        this.errorLog.push(error);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize / 2);
        }
        return error;
    }
    /**
     * C-02: Get user-friendly error message
     */
    getUserMessage(error) {
        const categoryMessages = {
            validation: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
            auth: 'Bạn không có quyền thực hiện thao tác này.',
            not_found: 'Không tìm thấy dữ liệu yêu cầu.',
            conflict: 'Dữ liệu bị xung đột. Vui lòng thử lại.',
            server: 'Lỗi hệ thống. Vui lòng thử lại sau.',
            network: 'Lỗi kết nối. Vui lòng kiểm tra mạng.',
        };
        return `${categoryMessages[error.category] || 'Đã xảy ra lỗi.'}\nMã lỗi: ${error.code}`;
    }
    /**
     * C-02: Get error log
     */
    getErrorLog(limit = 20) {
        return this.errorLog.slice(-limit);
    }
    /**
     * C-02: Get error stats
     */
    getErrorStats() {
        const stats = {
            validation: 0, auth: 0, not_found: 0, conflict: 0, server: 0, network: 0
        };
        for (const error of this.errorLog) {
            stats[error.category]++;
        }
        return stats;
    }
    /**
     * C-02: Try-catch wrapper with error handling
     */
    async safeExecute(fn, fallback, errorMsg) {
        try {
            return await fn();
        }
        catch (error) {
            const appError = this.createError('EXECUTION_ERROR', errorMsg || error.message || 'Unknown error', 'server', error);
            console.error('[ErrorHandling]', appError);
            return fallback;
        }
    }
}
exports.errorHandling = new ErrorHandling();
