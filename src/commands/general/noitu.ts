import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import db from '../../database/database';
import { noituService } from '../../services/NoituService';

export default class NoituCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('noitu')
        .setDescription('🎮 Chơi game Nối Từ!')
        .addSubcommand(sub =>
          sub
            .setName('setchannel')
            .setDescription('Đặt kênh chơi Nối Từ (quản lý kênh)')
            .addChannelOption(opt =>
              opt
                .setName('channel')
                .setDescription('Kênh text để chơi Nối Từ')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('start')
            .setDescription('Bắt đầu ván Nối Từ')
        )
        .addSubcommand(sub =>
          sub
            .setName('stop')
            .setDescription('Dừng ván Nối Từ')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'setchannel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply('❌ Cần quyền **Quản lý kênh** để đặt kênh Nối Từ!');
        return;
      }

      const channel = interaction.options.getChannel('channel', true);

      db.prepare(`
        INSERT INTO guild_configs (guild_id, noitu_channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET noitu_channel_id = excluded.noitu_channel_id
      `).run(interaction.guildId!, channel.id);

      await interaction.editReply(`Đã đặt kênh chơi Nối Từ: <#${channel.id}>`);
      return;
    }

    if (sub === 'start') {
      const config = db.prepare('SELECT noitu_channel_id FROM guild_configs WHERE guild_id = ?').get(interaction.guildId!) as any;
      if (!config?.noitu_channel_id) {
        await interaction.editReply('❌ Chưa thiết lập kênh. Dùng `/noitu setchannel` trước!');
        return;
      }
      if (interaction.channelId !== config.noitu_channel_id) {
        await interaction.editReply(`❌ Dùng tại kênh <#${config.noitu_channel_id}>!`);
        return;
      }

      const gameKey = `${interaction.guildId}:${interaction.channelId}`;
      if (noituService.getGame(gameKey)) {
        await interaction.editReply('❌ Đang có ván Nối Từ!');
        return;
      }

      const game = noituService.startGame(interaction.guildId!, interaction.channelId);
      game.client = client;

      await interaction.editReply(`Nối từ bắt đầu. Từ hiện tại: **${game.currentWord}**. Viết từ bắt đầu bằng **${game.lastSyllable}** trong 45s.`);
      return;
    }

    if (sub === 'stop') {
      const gameKey = `${interaction.guildId}:${interaction.channelId}`;
      const game = noituService.getGame(gameKey);
      if (!game) {
        await interaction.editReply('❌ Không có ván nào!');
        return;
      }

      noituService.stopGame(gameKey);
      await interaction.editReply(`Đã dừng. Tổng từ: **${game.usedWords.size}**`);
      return;
    }
  }
}
