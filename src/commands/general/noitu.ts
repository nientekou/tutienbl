import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import db from '../../database/database';
import { noituService } from '../../services/NoituService';
import { toV2Payload } from '../../utils/uiSystem';

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
        .addSubcommand(sub =>
          sub
            .setName('skip')
            .setDescription('Bỏ phiếu bỏ qua từ hiện tại (cần 3 vote)')
        )
        .addSubcommand(sub =>
          sub
            .setName('donggop')
            .setDescription('Đề xuất thêm từ mới vào từ điển')
            .addStringOption(opt =>
              opt
                .setName('tu')
                .setDescription('Từ bạn muốn đóng góp (cần ít nhất 2 âm tiết)')
                .setRequired(true)
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'donggop') {
      const word = interaction.options.getString('tu', true);
      const clean = word.trim().toLowerCase();
      const syls = clean.split(/\s+/);

      if (syls.length < 2) {
        await interaction.editReply('❌ Từ phải có ít nhất **2 âm tiết** (ví dụ: "mặt trời").');
        return;
      }
      if (!/^[a-zàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ\s]+$/.test(clean)) {
        await interaction.editReply('❌ Từ chỉ được chứa chữ cái tiếng Việt và khoảng trắng.');
        return;
      }

      const result = noituService.suggestWord(clean, interaction.user.id);
      if (result === 'exists') {
        await interaction.editReply(`ℹ️ Từ **${clean}** đã có trong từ điển.`);
      } else if (result === 'pending_exists') {
        await interaction.editReply(`⏳ Từ **${clean}** đã được đề xuất trước đó, đang chờ duyệt.`);
      } else {
        await interaction.editReply(`✅ Đã ghi nhận đề xuất từ **${clean}**. BQT sẽ xem xét và duyệt sau.`);
      }
      return;
    }

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

      await interaction.editReply(`Nối từ bắt đầu. Từ hiện tại: **${game.currentWord}**. Viết từ bắt đầu bằng **${game.lastSyllable}** (thời gian: 1 tiếng).`);
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

    if (sub === 'skip') {
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
      const game = noituService.getGame(gameKey);
      if (!game) {
        await interaction.editReply('❌ Không có ván Nối Từ nào!');
        return;
      }

      if (game.lastAnswererId === interaction.user.id) {
        await interaction.editReply('❌ Bạn là người trả lời cuối, hãy để người khác bỏ phiếu bỏ qua!');
        return;
      }

      const result = noituService.startSkipVote(gameKey);
      if (!result) {
        await interaction.editReply('❌ Đã có phiếu bỏ phiếu bỏ qua trước đó!');
        return;
      }

      game.client = client;
      await interaction.editReply(toV2Payload([result.embed], [result.row]));
      return;
    }
  }
}
