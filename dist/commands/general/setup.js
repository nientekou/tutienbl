"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const database_1 = __importDefault(require("../../database/database"));
const CHANNELS_CONFIG = [
    { key: 'tuluyen_channel_id', name: '📜-tu-luyện', topic: '🧘 Thiền định, đột phá, xem trạng thái: /taonhanvat, /hoso, /ycanh, /luanhoi' },
    { key: 'linhdien_channel_id', name: '🌿-linh-điền', topic: '🌱 Mở đất, trồng trọt, luyện đan, rèn trang bị: /linhdien, /chetao' },
    { key: 'market_channel_id', name: '🏪-chợ-trời', topic: '🏪 Trao đổi, mua bán đạo cụ: /chotroi, /market' },
    { key: 'tongmon_channel_id', name: '🏰-tông-môn', topic: '🏰 Gia nhập tông môn, cống hiến, bảng xếp hạng: /tongmon' },
    { key: 'combat_channel_id', name: '⚡-chiến-đấu', topic: '⚡ Khiêu chiến, tỷ thí, săn yêu thú: /chien-dau, /sanyem' },
    { key: 'bicanh_channel_id', name: '⚔️-bí-cảnh', topic: '⚔️ Khiêu chiến phó bản bí cảnh: /bicanh' },
    { key: 'boss_channel_id', name: '🌋-boss-thế-giới', topic: '🌋 Boss Thế Giới xuất thế định kỳ. Click Tấn Công ngay!' },
    { key: 'event_channel_id', name: '📢-sự-kiện', topic: '📢 Thông báo sự kiện, giải đấu, hoạt động đặc biệt' },
    { key: 'chat_channel_id', name: '💬-đạo-đàn', topic: '💬 Đàm đạo tu tiên, giao lưu đạo hữu' },
    { key: 'guide_channel_id', name: '📚-hướng-dẫn', topic: '📚 Hướng dẫn tân thủ, mẹo tu luyện, câu hỏi thường gặp' },
];
function getExistingConfig(guildId) {
    return database_1.default.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
}
function saveConfig(guildId, categoryId, channelIds) {
    const keys = ['category_id', ...CHANNELS_CONFIG.map(c => c.key)];
    const values = [guildId, categoryId, ...CHANNELS_CONFIG.map(c => channelIds[c.key] || null)];
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
    database_1.default.prepare(`
    INSERT INTO guild_configs (guild_id, ${keys.join(', ')})
    VALUES (?, ${placeholders})
    ON CONFLICT(guild_id) DO UPDATE SET ${updates}
  `).run(...values);
}
class SetupCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('setup')
            .setDescription('Tự động kiến tạo Danh mục & kênh chuyên dụng cho game Tu Tiên')
            .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
            .addSubcommand(sub => sub.setName('create')
            .setDescription('Tạo mới hoặc cập nhật các kênh đạo trường'))
            .addSubcommand(sub => sub.setName('reset')
            .setDescription('Xoá toàn bộ kênh cũ và tạo lại từ đầu'))
            .addSubcommand(sub => sub.setName('info')
            .setDescription('Xem cấu hình kênh hiện tại của máy chủ')));
    }
    async execute(client, interaction) {
        const { guild } = interaction;
        if (!guild) {
            await interaction.reply({ content: '❌ Lệnh này chỉ dùng trong máy chủ Discord.', ephemeral: true });
            return;
        }
        const botMember = await guild.members.fetch(client.user.id);
        if (!botMember.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({
                content: '❌ Ta cần quyền **Quản Lý Kênh** (Manage Channels) để kiến tạo Đạo Trường!',
                ephemeral: true,
            });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'info') {
            await this.showInfo(interaction);
            return;
        }
        if (sub === 'reset') {
            await this.confirmReset(client, interaction);
            return;
        }
        await this.runSetup(client, interaction);
    }
    async showInfo(interaction) {
        const config = getExistingConfig(interaction.guildId);
        if (!config || !config.category_id) {
            await interaction.reply({ content: '⚠️ Máy chủ chưa được thiết lập. Dùng `/setup create` để kiến tạo Đạo Trường.', ephemeral: true });
            return;
        }
        const guild = interaction.guild;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 CẤU HÌNH ĐẠO TRƯỜNG')
            .setColor(0x2ecc71)
            .setDescription(`Danh sách kênh thuộc **${guild.name}**:`)
            .setTimestamp();
        for (const ch of CHANNELS_CONFIG) {
            const id = config[ch.key];
            embed.addFields({
                name: ch.name,
                value: id ? `<#${id}>` : '❌ Chưa tạo',
                inline: true,
            });
        }
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    async confirmReset(client, interaction) {
        const config = getExistingConfig(interaction.guildId);
        if (!config?.category_id) {
            await interaction.reply({ content: '⚠️ Chưa có cấu hình nào để reset. Dùng `/setup create` để tạo mới.', ephemeral: true });
            return;
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('confirm_reset').setLabel('🗑️ Xoá & Tạo Lại').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('cancel_reset').setLabel('❌ Huỷ').setStyle(discord_js_1.ButtonStyle.Secondary));
        await interaction.reply({
            content: '⚠️ **CẢNH BÁO:** Thao tác này sẽ xoá tất cả kênh cũ trong danh mục Đạo Trường và tạo lại từ đầu. Tiếp tục?',
            components: [row],
            ephemeral: true,
        });
        const filter = (i) => i.user.id === interaction.user.id;
        const collected = await interaction.channel.awaitMessageComponent({
            filter,
            componentType: discord_js_1.ComponentType.Button,
            time: 15000,
        }).catch(() => null);
        if (!collected || collected.customId === 'cancel_reset') {
            await interaction.editReply({ content: '✅ Đã huỷ reset.', components: [] });
            return;
        }
        // Delete old channels
        const guild = interaction.guild;
        const category = guild.channels.cache.get(config.category_id);
        const children = guild.channels.cache.filter(c => c.parentId === config.category_id);
        for (const [, ch] of children) {
            if ('delete' in ch)
                await ch.delete().catch(() => { });
        }
        if (category && 'delete' in category)
            await category.delete().catch(() => { });
        await collected.update({ content: '🗑️ Đã xoá kênh cũ. Đang tạo lại...', components: [] });
        await this.runSetup(client, interaction);
    }
    async runSetup(client, interaction) {
        const { guild } = interaction;
        if (!guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            // 1. Tạo category
            let category = guild.channels.cache.find(c => c.name === '🌌 ĐẠO TRƯỜNG TU TIÊN' && c.type === discord_js_1.ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({
                    name: '🌌 ĐẠO TRƯỜNG TU TIÊN',
                    type: discord_js_1.ChannelType.GuildCategory,
                });
            }
            // 2. Tạo các kênh
            const channelIds = {};
            for (const ch of CHANNELS_CONFIG) {
                let channel = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id && c.type === discord_js_1.ChannelType.GuildText);
                if (!channel) {
                    channel = await guild.channels.create({
                        name: ch.name,
                        type: discord_js_1.ChannelType.GuildText,
                        parent: category.id,
                        topic: ch.topic,
                    });
                }
                channelIds[ch.key] = channel.id;
            }
            // 3. Lưu config
            saveConfig(guild.id, category.id, channelIds);
            // 4. Embed kết quả
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🌌 KIẾN TẠO ĐẠO TRƯỜNG THÀNH CÔNG!')
                .setColor(0x2ecc71)
                .setDescription('Hệ thống đã thiết lập **10 phân khu tu luyện** tại tông môn này:')
                .setTimestamp()
                .setFooter({ text: 'Chư vị đạo hữu hãy di chuyển đến kênh tương ứng!' });
            for (const ch of CHANNELS_CONFIG) {
                embed.addFields({ name: ch.name, value: `<#${channelIds[ch.key]}>`, inline: true });
            }
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setLabel('📜 Hướng Dẫn')
                .setStyle(discord_js_1.ButtonStyle.Link)
                .setURL('https://discord.com/channels/@me'), new discord_js_1.ButtonBuilder()
                .setLabel('🎮 Bắt Đầu')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setCustomId('setup_start_game'));
            await interaction.editReply({ embeds: [embed], components: [row] });
            // 5. Gửi welcome vào channel tu luyện
            const welcomeChannel = guild.channels.cache.get(channelIds['tuluyen_channel_id']);
            if (welcomeChannel?.isTextBased()) {
                await welcomeChannel.send({
                    content: `🎉 **Đại Trận Đã Mở!** Chào mừng đạo hữu gia nhập **${guild.name}**! Dùng \`/taonhanvat\` để bước vào con đường nghịch thiên tu hành!`,
                });
            }
        }
        catch (error) {
            console.error('[Setup Error]:', error);
            await interaction.editReply({
                content: '❌ **Lỗi:** Không thể tạo kênh. Hãy kiểm tra bot có đủ quyền `Manage Channels` và thử lại.',
            });
        }
    }
}
exports.default = SetupCommand;
