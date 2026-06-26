import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { infiniteTribulationService } from '../../services/InfiniteTribulationService';
import { skillMasteryService } from '../../services/SkillMasteryService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class ThienKiepCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('thienkiep')
        .setDescription('Thiên Kiếp Vô Cực — Solo challenge vô hạn với random modifiers')
        .addSubcommand(sub =>
          sub.setName('info').setDescription('Xem thông tin Thiên Kiếp hiện tại')
        )
        .addSubcommand(sub =>
          sub.setName('start').setDescription('Bắt đầu Thiên Kiếp (tiêu hao 1 lượt)')
        )
        .addSubcommand(sub =>
          sub.setName('chien-dau').setDescription('Bắt đầu với skill tùy chọn')
            .addIntegerOption(opt => opt.setName('skill').setDescription('Chỉ số skill (0, 1, 2...)').setRequired(false))
        )
    );
  }

  async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const desc = infiniteTribulationService.getDescription(userId);
      const embed = new EmbedBuilder()
        .setTitle('⚡ Thiên Kiếp Vô Cực')
        .setColor(EMBED_COLORS.MYSTIC)
        .setDescription(desc)
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`thienkiep_start_${userId}`)
          .setLabel('Bắt Đầu Thiên Kiếp')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚡'),
      );

      await interaction.reply(toV2Payload([embed], [row]));
      return;
    }

    if (subcommand === 'start') {
      const canEnter = infiniteTribulationService.canEnter(userId);
      if (!canEnter.eligible) {
        await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
        return;
      }

      const prog = infiniteTribulationService.getProgress(userId);
      const enemy = infiniteTribulationService.getEnemyForFloor(prog.tier, prog.floor);

      const embed = new EmbedBuilder()
        .setTitle(`⚡ Thiên Kiếp — Tier ${prog.tier} / Floor ${prog.floor}`)
        .setColor(EMBED_COLORS.MYSTIC)
        .setDescription(
          `**${enemy.modifier.name}**: ${enemy.modifier.description}\n\n` +
          `👹 **Kẻ thù:**\n` +
          `❤️ HP: ${enemy.hp.toLocaleString()}\n` +
          `⚔️ ATK: ${enemy.atk.toLocaleString()}\n` +
          `🛡️ DEF: ${enemy.def.toLocaleString()}\n\n` +
          `🎫 Lượt còn lại: **${prog.attemptsLeft}**/5`
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`thienkiep_fight_${userId}_${prog.tier}_${prog.floor}`)
          .setLabel('Chiến Đấu')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId(`thienkiep_guard_${userId}_${prog.tier}_${prog.floor}`)
          .setLabel('Phòng Thủ')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️'),
        new ButtonBuilder()
          .setCustomId(`thienkiep_retreat_${userId}`)
          .setLabel('Rút Lui')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏃'),
      );

      await interaction.reply(toV2Payload([embed], [row]));
    }

    if (subcommand === 'chien-dau') {
      const canEnter = infiniteTribulationService.canEnter(userId);
      if (!canEnter.eligible) {
        await interaction.reply({ content: `❌ ${canEnter.reason}`, ephemeral: true });
        return;
      }

      const prog = infiniteTribulationService.getProgress(userId);
      const enemy = infiniteTribulationService.getEnemyForFloor(prog.tier, prog.floor);
      const skillIndex = interaction.options.getInteger('skill') ?? 0;

      // Build skill selection if player has equipped skills
      let skillText = 'Auto-cycle';
      try {
        const user = userRepository.get(userId);
        if (user) {
          const mastery = skillMasteryService.getMastery(userId, 'skill_fire');
          skillText = `Skill #${skillIndex}`;
        }
      } catch {}

      const embed = new EmbedBuilder()
        .setTitle(`⚡ Thiên Kiếp — Tier ${prog.tier} / Floor ${prog.floor}`)
        .setColor(EMBED_COLORS.MYSTIC)
        .setDescription(
          `**${enemy.modifier.name}**: ${enemy.modifier.description}\n\n` +
          `👹 **Kẻ thù:** HP ${enemy.hp.toLocaleString()} | ATK ${enemy.atk.toLocaleString()} | DEF ${enemy.def.toLocaleString()}\n` +
          `🎯 **Skill:** ${skillText}\n` +
          `🎫 Lượt còn lại: **${prog.attemptsLeft}**/5`
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`thienkiep_fight_${userId}_${prog.tier}_${prog.floor}_${skillIndex}`)
          .setLabel('Chiến Đấu')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId(`thienkiep_retreat_${userId}`)
          .setLabel('Rút Lui')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏃'),
      );

      await interaction.reply(toV2Payload([embed], [row]));
    }
  }
}
