"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuTienClient = void 0;
const discord_js_1 = require("discord.js");
const CommandHandler_1 = require("../handlers/CommandHandler");
const EventHandler_1 = require("../handlers/EventHandler");
const path_1 = __importDefault(require("path"));
class TuTienClient extends discord_js_1.Client {
    static instance;
    // Collection chứa danh sách lệnh Slash Command
    commands = new discord_js_1.Collection();
    // Khởi tạo các Handler nạp lệnh và sự kiện
    commandHandler = new CommandHandler_1.CommandHandler(this);
    eventHandler = new EventHandler_1.EventHandler(this);
    constructor(options) {
        super(options || {
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildVoiceStates
            ]
        });
        TuTienClient.instance = this;
    }
    /**
     * Khởi động bot: Nạp commands, events và đăng nhập
     * @param token Bot token từ Discord Developer Portal
     */
    async start(token) {
        // Đường dẫn tuyệt đối tới các thư mục chứa commands và events
        const eventsPath = path_1.default.join(__dirname, '../events');
        const commandsPath = path_1.default.join(__dirname, '../commands');
        await this.eventHandler.loadAll(eventsPath);
        await this.commandHandler.loadAll(commandsPath);
        await this.login(token);
    }
}
exports.TuTienClient = TuTienClient;
