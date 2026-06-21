import { TuTienClient } from '../client/TuTienClient';
import { Event } from '../structures/Event';
import fs from 'fs';
import path from 'path';

export class EventHandler {
  constructor(private readonly client: TuTienClient) {}

  /**
   * Quét và đăng ký tất cả các sự kiện của client
   * @param dirPath Đường dẫn tuyệt đối tới thư mục events
   */
  public async loadAll(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[EventHandler] Thư mục ${dirPath} không tồn tại.`);
      return;
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require(filePath);
        const EventClass = module.default || Object.values(module)[0];

        if (EventClass && typeof EventClass === 'function') {
          const event: Event = new EventClass();
          if (event.once) {
            this.client.once(event.name, (...args) => event.execute(this.client, ...args));
          } else {
            this.client.on(event.name, (...args) => event.execute(this.client, ...args));
          }
          console.log(`[EventHandler] Đã nạp sự kiện: ${event.name}`);
        } else {
          console.warn(`[EventHandler] File ${filePath} không export lớp Event hợp lệ.`);
        }
      } catch (error) {
        console.error(`[EventHandler] Lỗi khi nạp sự kiện tại ${filePath}:`, error);
      }
    }
  }
}
