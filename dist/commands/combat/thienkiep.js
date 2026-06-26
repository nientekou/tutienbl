"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InfiniteTribulationService_1 = require("../../services/InfiniteTribulationService");
const SkillMasteryService_1 = require("../../services/SkillMasteryService");
const uiSystem_1 = require("../../utils/uiSystem");
class ThienKiepCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('thienkiep')
            .setDescription('Thiên Kiếp Vô Cực — Solo challenge vô hạn với random modifiers')
            .addSubcommand(sub => sub.setName('info').setDescription('Xem thông tin Thiên Kiếp hiện tại'))
            .addSubcommand(sub => sub.setName('start').setDescription('Bắt đầu Thiên Kiếp (tiêu hao 1 lượt)'))
            .addSubcommand(sub => sub.setName('chien-dau').setDescription('Bắt đầu với skill tùy chọn')
            .addIntegerOption(opt => opt.setName('skill').setDescription('Chỉ số skill (0, 1, 2...)').setRequired(false))));
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
            const desc = InfiniteTribulationService_1.infiniteTribulationService.getDescription(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('⚡ Thiên Kiếp Vô Cực')
                .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
                .setDescription(desc)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_start_${userId}`)
                .setLabel('Bắt Đầu Thiên Kiếp')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('⚡'));
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
            return;
        }
        if (subcommand === 'start') {
            const canEnter = InfiniteTribulationService_1.infiniteTribulationService.canEnter(userId);
            if (!canEnter.eligible) {
                await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
                return;
            }
            const prog = InfiniteTribulationService_1.infiniteTribulationService.getProgress(userId);
            const enemy = InfiniteTribulationService_1.infiniteTribulationService.getEnemyForFloor(prog.tier, prog.floor);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚡ Thiên Kiếp — Tier ${prog.tier} / Floor ${prog.floor}`)
                .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
                .setDescription(`**${enemy.modifier.name}**: ${enemy.modifier.description}\n\n` +
                `👹 **Kẻ thù:**\n` +
                `❤️ HP: ${enemy.hp.toLocaleString()}\n` +
                `⚔️ ATK: ${enemy.atk.toLocaleString()}\n` +
                `🛡️ DEF: ${enemy.def.toLocaleString()}\n\n` +
                `🎫 Lượt còn lại: **${prog.attemptsLeft}**/5`)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_fight_${userId}_${prog.tier}_${prog.floor}`)
                .setLabel('Chiến Đấu')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('⚔️'), new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_guard_${userId}_${prog.tier}_${prog.floor}`)
                .setLabel('Phòng Thủ')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('🛡️'), new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_retreat_${userId}`)
                .setLabel('Rút Lui')
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setEmoji('🏃'));
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
        if (subcommand === 'chien-dau') {
            const canEnter = InfiniteTribulationService_1.infiniteTribulationService.canEnter(userId);
            if (!canEnter.eligible) {
                await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
                return;
            }
            const prog = InfiniteTribulationService_1.infiniteTribulationService.getProgress(userId);
            const enemy = InfiniteTribulationService_1.infiniteTribulationService.getEnemyForFloor(prog.tier, prog.floor);
            const skillIndex = interaction.options.getInteger('skill') ?? 0;
            // Build skill selection if player has equipped skills
            let skillText = 'Auto-cycle';
            try {
                const user = UserRepository_1.userRepository.get(userId);
                if (user) {
                    const mastery = SkillMasteryService_1.skillMasteryService.getMastery(userId, 'skill_fire');
                    skillText = `Skill #${skillIndex}`;
                }
            }
            catch { }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚡ Thiên Kiếp — Tier ${prog.tier} / Floor ${prog.floor}`)
                .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
                .setDescription(`**${enemy.modifier.name}**: ${enemy.modifier.description}\n\n` +
                `👹 **Kẻ thù:** HP ${enemy.hp.toLocaleString()} | ATK ${enemy.atk.toLocaleString()} | DEF ${enemy.def.toLocaleString()}\n` +
                `🎯 **Skill:** ${skillText}\n` +
                `🎫 Lượt còn lại: **${prog.attemptsLeft}**/5`)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_fight_${userId}_${prog.tier}_${prog.floor}_${skillIndex}`)
                .setLabel('Chiến Đấu')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('⚔️'), new discord_js_1.ButtonBuilder()
                .setCustomId(`thienkiep_retreat_${userId}`)
                .setLabel('Rút Lui')
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setEmoji('🏃'));
            await interaction.reply((0, uiSystem_1.toV2Payload)([embed], [row]));
        }
    }
}
exports.default = ThienKiepCommand;
