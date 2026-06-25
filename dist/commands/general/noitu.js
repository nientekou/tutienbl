"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const database_1 = __importDefault(require("../../database/database"));
const NoituService_1 = require("../../services/NoituService");
const uiSystem_1 = require("../../utils/uiSystem");
class NoituCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('noitu')
            .setDescription('🎮 Chơi game Nối Từ!')
            .addSubcommand(sub => sub
            .setName('setchannel')
            .setDescription('Đặt kênh chơi Nối Từ (quản lý kênh)')
            .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Kênh text để chơi Nối Từ')
            .setRequired(true)
            .addChannelTypes(discord_js_1.ChannelType.GuildText)))
            .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Bắt đầu ván Nối Từ'))
            .addSubcommand(sub => sub
            .setName('stop')
            .setDescription('Dừng ván Nối Từ'))
            .addSubcommand(sub => sub
            .setName('skip')
            .setDescription('Bỏ phiếu bỏ qua từ hiện tại (cần 3 vote)'))
            .addSubcommand(sub => sub
            .setName('donggop')
            .setDescription('Đề xuất thêm từ mới vào từ điển')
            .addStringOption(opt => opt
            .setName('tu')
            .setDescription('Từ bạn muốn đóng góp (cần ít nhất 2 âm tiết)')
            .setRequired(true))));
    }
    async execute(client, interaction) {
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
            const result = NoituService_1.noituService.suggestWord(clean, interaction.user.id);
            if (result === 'exists') {
                await interaction.editReply(`ℹ️ Từ **${clean}** đã có trong từ điển.`);
            }
            else if (result === 'pending_exists') {
                await interaction.editReply(`⏳ Từ **${clean}** đã được đề xuất trước đó, đang chờ duyệt.`);
            }
            else {
                await interaction.editReply(`✅ Đã ghi nhận đề xuất từ **${clean}**. BQT sẽ xem xét và duyệt sau.`);
            }
            return;
        }
        if (sub === 'setchannel') {
            if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                await interaction.editReply('❌ Cần quyền **Quản lý kênh** để đặt kênh Nối Từ!');
                return;
            }
            const channel = interaction.options.getChannel('channel', true);
            database_1.default.prepare(`
        INSERT INTO guild_configs (guild_id, noitu_channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET noitu_channel_id = excluded.noitu_channel_id
      `).run(interaction.guildId, channel.id);
            await interaction.editReply(`Đã đặt kênh chơi Nối Từ: <#${channel.id}>`);
            return;
        }
        if (sub === 'start') {
            const config = database_1.default.prepare('SELECT noitu_channel_id FROM guild_configs WHERE guild_id = ?').get(interaction.guildId);
            if (!config?.noitu_channel_id) {
                await interaction.editReply('❌ Chưa thiết lập kênh. Dùng `/noitu setchannel` trước!');
                return;
            }
            if (interaction.channelId !== config.noitu_channel_id) {
                await interaction.editReply(`❌ Dùng tại kênh <#${config.noitu_channel_id}>!`);
                return;
            }
            const gameKey = `${interaction.guildId}:${interaction.channelId}`;
            if (NoituService_1.noituService.getGame(gameKey)) {
                await interaction.editReply('❌ Đang có ván Nối Từ!');
                return;
            }
            const game = NoituService_1.noituService.startGame(interaction.guildId, interaction.channelId);
            game.client = client;
            const display = NoituService_1.noituService.buildGameDisplay(game);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([display]));
            return;
        }
        if (sub === 'stop') {
            const gameKey = `${interaction.guildId}:${interaction.channelId}`;
            const game = NoituService_1.noituService.getGame(gameKey);
            if (!game) {
                await interaction.editReply('❌ Không có ván nào!');
                return;
            }
            NoituService_1.noituService.stopGame(gameKey);
            const stopContainer = new discord_js_1.ContainerBuilder()
                .setAccentColor(0xe74c3c)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('# 🛑 Đã Dừng Nối Từ\n' +
                `Tổng từ đã nối: **${game.usedWords.size}**`));
            await interaction.editReply((0, uiSystem_1.toV2Payload)([stopContainer]));
            return;
        }
        if (sub === 'skip') {
            const config = database_1.default.prepare('SELECT noitu_channel_id FROM guild_configs WHERE guild_id = ?').get(interaction.guildId);
            if (!config?.noitu_channel_id) {
                await interaction.editReply('❌ Chưa thiết lập kênh. Dùng `/noitu setchannel` trước!');
                return;
            }
            if (interaction.channelId !== config.noitu_channel_id) {
                await interaction.editReply(`❌ Dùng tại kênh <#${config.noitu_channel_id}>!`);
                return;
            }
            const gameKey = `${interaction.guildId}:${interaction.channelId}`;
            const game = NoituService_1.noituService.getGame(gameKey);
            if (!game) {
                await interaction.editReply('❌ Không có ván Nối Từ nào!');
                return;
            }
            if (game.lastAnswererId === interaction.user.id) {
                await interaction.editReply('❌ Bạn là người trả lời cuối, hãy để người khác bỏ phiếu bỏ qua!');
                return;
            }
            const result = NoituService_1.noituService.startSkipVote(gameKey);
            if (!result) {
                await interaction.editReply('❌ Đã có phiếu bỏ phiếu bỏ qua trước đó!');
                return;
            }
            game.client = client;
            await interaction.editReply((0, uiSystem_1.toV2Payload)([result.display], [result.row]));
            return;
        }
    }
}
exports.default = NoituCommand;
