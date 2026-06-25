"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Event_1 = require("../structures/Event");
const NoituService_1 = require("../services/NoituService");
const database_1 = __importDefault(require("../database/database"));
class MessageCreateEvent extends Event_1.Event {
    constructor() {
        super('messageCreate');
    }
    async execute(client, message) {
        if (message.author.bot)
            return;
        if (!message.guild)
            return;
        const config = database_1.default.prepare('SELECT noitu_channel_id FROM guild_configs WHERE guild_id = ?')
            .get(message.guild.id);
        if (!config?.noitu_channel_id || message.channel.id !== config.noitu_channel_id)
            return;
        const gameKey = `${message.guild.id}:${message.channel.id}`;
        const game = NoituService_1.noituService.getGame(gameKey);
        if (!game)
            return;
        const word = message.content.trim();
        if (!word)
            return;
        const result = await NoituService_1.noituService.handleWord(gameKey, message.author.id, message.author.username, word);
        if (result.accepted) {
            await message.react('✅').catch(() => { });
        }
        else {
            await message.react('❌').catch(() => { });
            const reason = result.message;
            if (reason) {
                const reply = await message.reply({ content: reason }).catch(() => null);
                if (reply)
                    setTimeout(() => reply.delete().catch(() => { }), 5000);
            }
        }
    }
}
exports.default = MessageCreateEvent;
