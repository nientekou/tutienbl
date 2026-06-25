import { Event } from '../structures/Event';
import { TuTienClient } from '../client/TuTienClient';
import { Message, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
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

    if (result.accepted) {
      await message.react('✅').catch(() => {});
      try {
        const display = noituService.buildGameDisplay(game, `✅ **${message.author.username}** đã nối: **${game.currentWord}**`);
        if ((message.channel as any).send) {
          await (message.channel as any).send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        }
      } catch (_) {}
    } else {
      await message.react('❌').catch(() => {});
      const reason = result.message;
      if (reason) {
        const reply = await message.reply({ content: reason }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      }
    }
  }
}
