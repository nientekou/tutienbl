"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandler = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class EventHandler {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Quét và đăng ký tất cả các sự kiện của client
     * @param dirPath Đường dẫn tuyệt đối tới thư mục events
     */
    async loadAll(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            console.warn(`[EventHandler] Thư mục ${dirPath} không tồn tại.`);
            return;
        }
        const files = fs_1.default.readdirSync(dirPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        for (const file of files) {
            const filePath = path_1.default.join(dirPath, file);
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const module = require(filePath);
                const EventClass = module.default || Object.values(module)[0];
                if (EventClass && typeof EventClass === 'function') {
                    const event = new EventClass();
                    if (event.once) {
                        this.client.once(event.name, (...args) => event.execute(this.client, ...args));
                    }
                    else {
                        this.client.on(event.name, (...args) => event.execute(this.client, ...args));
                    }
                    console.log(`[EventHandler] Đã nạp sự kiện: ${event.name}`);
                }
                else {
                    console.warn(`[EventHandler] File ${filePath} không export lớp Event hợp lệ.`);
                }
            }
            catch (error) {
                console.error(`[EventHandler] Lỗi khi nạp sự kiện tại ${filePath}:`, error);
            }
        }
    }
}
exports.EventHandler = EventHandler;
