import { Client, ClientOptions, Collection, GatewayIntentBits } from 'discord.js';
import { Command } from '../structures/Command';
import { CommandHandler } from '../handlers/CommandHandler';
import { EventHandler } from '../handlers/EventHandler';
import path from 'path';

export class TuTienClient extends Client {
  public static instance: TuTienClient;

  // Collection chứa danh sách lệnh Slash Command
  public readonly commands = new Collection<string, Command>();
  
  // Khởi tạo các Handler nạp lệnh và sự kiện
  public readonly commandHandler = new CommandHandler(this);
  public readonly eventHandler = new EventHandler(this);

  constructor(options?: ClientOptions) {
    super(options || {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    TuTienClient.instance = this;
  }


  /**
   * Khởi động bot: Nạp commands, events và đăng nhập
   * @param token Bot token từ Discord Developer Portal
   */
  public async start(token: string): Promise<void> {
    // Đường dẫn tuyệt đối tới các thư mục chứa commands và events
    const eventsPath = path.join(__dirname, '../events');
    const commandsPath = path.join(__dirname, '../commands');

    await this.eventHandler.loadAll(eventsPath);
    await this.commandHandler.loadAll(commandsPath);

    await this.login(token);
  }
}
