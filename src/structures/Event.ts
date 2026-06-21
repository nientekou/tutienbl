import { ClientEvents } from 'discord.js';
import { TuTienClient } from '../client/TuTienClient';

export abstract class Event<Key extends keyof ClientEvents = keyof ClientEvents> {
  constructor(
    public readonly name: Key,
    public readonly once: boolean = false
  ) {}

  /**
   * Phương thức thực thi khi sự kiện được kích hoạt
   * @param client Client bot Tu Tiên
   * @param args Các tham số được trả về từ Event của Discord.js tương ứng
   */
  public abstract execute(client: TuTienClient, ...args: ClientEvents[Key]): Promise<unknown> | unknown;
}
