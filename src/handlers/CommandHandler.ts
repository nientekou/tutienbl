import { TuTienClient } from '../client/TuTienClient';
import { Command } from '../structures/Command';
import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

export class CommandHandler {
  constructor(private readonly client: TuTienClient) {}

  private isWatching = false;
  private watchTimeout: NodeJS.Timeout | null = null;

  /**
   * Quét và nạp tất cả các file Command trong thư mục được chỉ định
   * @param dirPath Đường dẫn tuyệt đối tới thư mục commands
   */
  public async loadAll(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[CommandHandler] Thư mục ${dirPath} không tồn tại.`);
      return;
    }

    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Nạp từ danh mục con (ví dụ: commands/general/hoso.ts)
        const files = fs.readdirSync(itemPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        for (const file of files) {
          await this.loadCommand(path.join(itemPath, file), item);
        }
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
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
  private startWatch(dirPath: string): void {
    this.isWatching = true;
    console.log(`[CommandHandler] 👁️  Bắt đầu giám sát thay đổi thư mục commands để Hot Reload...`);

    fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (!filename.endsWith('.ts') && !filename.endsWith('.js')) return;

      // Debounce tránh chạy nạp liên tục khi đang lưu file
      if (this.watchTimeout) clearTimeout(this.watchTimeout);
      this.watchTimeout = setTimeout(async () => {
        console.log(`\n[CommandHandler] 🔄 Phát hiện thay đổi tại: ${filename}. Đang Hot Reload...`);
        
        try {
          // Xóa cache require của tất cả các file trong src (bao gồm commands, database, services...)
          const srcPath = path.resolve(dirPath, '../');
          this.clearCache(srcPath);

          // Clear collection cũ và nạp lại toàn bộ
          this.client.commands.clear();
          await this.loadAll(dirPath);

          // Tự động deploy lại lệnh lên Discord API
          await this.deploy();
          console.log('[CommandHandler] 🔄 Hot Reload & Deploy Slash Commands thành công!');
        } catch (error) {
          console.error('[CommandHandler] ❌ Lỗi Hot Reload thất bại:', error);
        }
      }, 1000);
    });
  }

  /**
   * Xóa bộ nhớ đệm (Require cache) đệ quy của các file trong thư mục commands
   */
  private clearCache(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        this.clearCache(itemPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
        try {
          const resolvedPath = require.resolve(itemPath);
          delete require.cache[resolvedPath];
        } catch (e) {
          // Bỏ qua nếu chưa từng được nạp
        }
      }
    }
  }

  /**
   * Nạp chi tiết một tệp Command
   */
  private async loadCommand(filePath: string, category: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require(filePath);
      const CommandClass = module.default || Object.values(module)[0];

      if (CommandClass && typeof CommandClass === 'function') {
        const command = new (CommandClass as any)();
        this.client.commands.set(command.data.name, command);
        console.log(`[CommandHandler] Đã nạp lệnh: /${command.data.name} (Phân loại: ${category})`);
      } else {
        console.warn(`[CommandHandler] File ${filePath} không export một lớp hợp lệ.`);
      }
    } catch (error) {
      console.error(`[CommandHandler] Lỗi khi nạp lệnh từ ${filePath}:`, error);
    }
  }

  /**
   * Đăng ký Slash Command lên Discord API (Global)
   */
  public async deploy(): Promise<void> {
    const token = this.client.token;
    const clientId = this.client.user?.id;

    if (!token || !clientId) {
      console.warn('[CommandHandler] Token bot hoặc Client ID bị thiếu. Không thể deploy command.');
      return;
    }

    const commandData = this.client.commands.map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log(`[CommandHandler] Đang cập nhật ${commandData.length} lệnh slash (/) lên Discord API...`);
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandData }
      );
      console.log('[CommandHandler] Đăng ký thành công tất cả lệnh slash command.');
    } catch (error) {
      console.error('[CommandHandler] Lỗi khi đăng ký slash commands với Discord:', error);
    }
  }
}

