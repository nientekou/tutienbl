"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const TreasureVaultService_1 = require("../../services/TreasureVaultService");
const uiSystem_1 = require("../../utils/uiSystem");
class ThienKhoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('thienkho')
            .setDescription('Thiên Kho Bảo Vật — Roguelike challenge, chọn buff mỗi floor')
            .addSubcommand(sub => sub.setName('info').setDescription('Xem thông tin Thiên Kho'))
            .addSubcommand(sub => sub.setName('start').setDescription('Bắt đầu Thiên Kho (100 stamina, 1 lượt/ngày)')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
            return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'info') {
            const desc = TreasureVaultService_1.treasureVaultService.getDescription(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📦 Thiên Kho Bảo Vật')
                .setColor(uiSystem_1.EMBED_COLORS.DUNGEON)
                .setDescription(desc)
                .setTimestamp();
            const canEnter = TreasureVaultService_1.treasureVaultService.canEnter(userId);
            if (canEnter.eligible) {
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`thienkho_start_${userId}`)
                    .setLabel('Vào Thiên Kho')
                    .setStyle(discord_js_1.ButtonStyle.Primary)
                    .setEmoji('📦'));
                await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
            }
            else {
                await interaction.reply((0, uiSystem_1.toV2Payload)([embed]));
            }
            return;
        }
        if (subcommand === 'start') {
            if (user.level < 50) {
                await interaction.reply({ content: '❌ Cần cấp 50+ để vào Thiên Kho.', ephemeral: true });
                return;
            }
            const canEnter = TreasureVaultService_1.treasureVaultService.canEnter(userId);
            if (!canEnter.eligible) {
                await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
                return;
            }
            // Check stamina
            if ((user.stamina || 0) < 100) {
                await interaction.reply({ content: '❌ Cần 100 Thể Lực để vào Thiên Kho.', ephemeral: true });
                return;
            }
            const { floor } = TreasureVaultService_1.treasureVaultService.start(userId);
            const buffs = TreasureVaultService_1.treasureVaultService.getRandomBuffs(3);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📦 Thiên Kho Bảo Vật — Tầng 1')
                .setColor(uiSystem_1.EMBED_COLORS.DUNGEON)
                .setDescription('Chọn 1 trong 3 chỉ số tăng cường để nhận:')
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder();
            for (let i = 0; i < buffs.length; i++) {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`thienkho_buff_${userId}_${buffs[i].id}`)
                    .setLabel(buffs[i].name)
                    .setStyle(discord_js_1.ButtonStyle.Success)
                    .setEmoji(i === 0 ? '🔥' : i === 1 ? '🛡️' : '✨'));
            }
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
    }
}
exports.default = ThienKhoCommand;
