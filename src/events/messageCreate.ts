import { Event } from '../structures/Event';
import { TuTienClient } from '../client/TuTienClient';
import { Message } from 'discord.js';
import { noituService } from '../services/NoituService';
import db from '../database/database';

export default class MessageCreateEvent extends Event<'messageCreate'> {
  constructor() {
    super('messageCreate');
  }

  public async execute(client: TuTienClient, message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.guild) return;

    const config = db.prepare('SELECT noitu_channel_id FROM guild_configs WHERE guild_id = ?')
      .get(message.guild.id) as any;
    if (!config?.noitu_channel_id || message.channel.id !== config.noitu_channel_id) return;

    const gameKey = `${message.guild.id}:${message.channel.id}`;
    const game = noituService.getGame(gameKey);
    if (!game) return;

    const word = message.content.trim();
    if (!word) return;

    const result = await noituService.handleWord(gameKey, message.author.id, message.author.username, word);

    if (result === 'valid') {
      await message.react('✅').catch(() => {});
    } else {
      await message.react('❌').catch(() => {});
      let reason = '';
      if (result === 'wrong_start') reason = `Phải bắt đầu bằng **${game.lastSyllable}**`;
      else if (result === 'already_used') reason = 'Từ đã được dùng';
      else if (result === 'too_short') reason = 'Cần ít nhất 2 âm tiết';
      else if (result === 'wrong_api') reason = 'Từ không có trong từ điển. Dùng `/noitu donggop` để đề xuất thêm từ.';
      else if (result === 'same_user') reason = 'Bạn đã nối rồi, hãy đợi người khác trả lời trước';
      if (reason) {
        const reply = await message.reply({ content: reason }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      }
    }
  }
}
