"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const discord_js_1 = require("discord.js");
class CommandHandler {
    client;
    constructor(client) {
        this.client = client;
    }
    isWatching = false;
    watchTimeout = null;
    /**
     * Quét và nạp tất cả các file Command trong thư mục được chỉ định
     * @param dirPath Đường dẫn tuyệt đối tới thư mục commands
     */
    async loadAll(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            console.warn(`[CommandHandler] Thư mục ${dirPath} không tồn tại.`);
            return;
        }
        const items = fs_1.default.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path_1.default.join(dirPath, item);
            const stat = fs_1.default.statSync(itemPath);
            if (stat.isDirectory()) {
                // Nạp từ danh mục con (ví dụ: commands/general/hoso.ts)
                const files = fs_1.default.readdirSync(itemPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
                for (const file of files) {
                    await this.loadCommand(path_1.default.join(itemPath, file), item);
                }
            }
            else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
                // Nạp từ file trực tiếp trong thư mục commands
                await this.loadCommand(itemPath, 'chung');
            }
        }
        // Khởi động giám sát file nếu chưa bật
        if (!this.isWatching) {
            this.startWatch(dirPath);
        }
    }
    /**
     * Khởi động giám sát thư mục commands để tự động nạp lại khi có cập nhật
     */
    startWatch(dirPath) {
        this.isWatching = true;
        console.log(`[CommandHandler] 👁️  Bắt đầu giám sát thay đổi thư mục commands để Hot Reload...`);
        fs_1.default.watch(dirPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            if (!filename.endsWith('.ts') && !filename.endsWith('.js'))
                return;
            // Debounce tránh chạy nạp liên tục khi đang lưu file
            if (this.watchTimeout)
                clearTimeout(this.watchTimeout);
            this.watchTimeout = setTimeout(async () => {
                console.log(`\n[CommandHandler] 🔄 Phát hiện thay đổi tại: ${filename}. Đang Hot Reload...`);
                try {
                    // Xóa cache require của tất cả các file trong src (bao gồm commands, database, services...)
                    const srcPath = path_1.default.resolve(dirPath, '../');
                    this.clearCache(srcPath);
                    // Clear collection cũ và nạp lại toàn bộ
                    this.client.commands.clear();
                    await this.loadAll(dirPath);
                    // Tự động deploy lại lệnh lên Discord API
                    await this.deploy();
                    console.log('[CommandHandler] 🔄 Hot Reload & Deploy Slash Commands thành công!');
                }
                catch (error) {
                    console.error('[CommandHandler] ❌ Lỗi Hot Reload thất bại:', error);
                }
            }, 1000);
        });
    }
    /**
     * Xóa bộ nhớ đệm (Require cache) đệ quy của các file trong thư mục commands
     */
    clearCache(dirPath) {
        if (!fs_1.default.existsSync(dirPath))
            return;
        const items = fs_1.default.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path_1.default.join(dirPath, item);
            const stat = fs_1.default.statSync(itemPath);
            if (stat.isDirectory()) {
                this.clearCache(itemPath);
            }
            else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
                try {
                    const resolvedPath = require.resolve(itemPath);
                    delete require.cache[resolvedPath];
                }
                catch (e) {
                    // Bỏ qua nếu chưa từng được nạp
                }
            }
        }
    }
    /**
     * Nạp chi tiết một tệp Command
     */
    async loadCommand(filePath, category) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const module = require(filePath);
            const CommandClass = module.default || Object.values(module)[0];
            if (CommandClass && typeof CommandClass === 'function') {
                const command = new CommandClass();
                this.client.commands.set(command.data.name, command);
                console.log(`[CommandHandler] Đã nạp lệnh: /${command.data.name} (Phân loại: ${category})`);
            }
            else {
                console.warn(`[CommandHandler] File ${filePath} không export một lớp hợp lệ.`);
            }
        }
        catch (error) {
            console.error(`[CommandHandler] Lỗi khi nạp lệnh từ ${filePath}:`, error);
        }
    }
    /**
     * Đăng ký Slash Command lên Discord API (Global)
     */
    async deploy() {
        const token = this.client.token;
        const clientId = this.client.user?.id;
        if (!token || !clientId) {
            console.warn('[CommandHandler] Token bot hoặc Client ID bị thiếu. Không thể deploy command.');
            return;
        }
        const commandData = this.client.commands.map(cmd => cmd.data.toJSON());
        const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
        try {
            console.log(`[CommandHandler] Đang cập nhật ${commandData.length} lệnh slash (/) lên Discord API...`);
            await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commandData });
            console.log('[CommandHandler] Đăng ký thành công tất cả lệnh slash command.');
        }
        catch (error) {
            console.error('[CommandHandler] Lỗi khi đăng ký slash commands với Discord:', error);
        }
    }
}
exports.CommandHandler = CommandHandler;
