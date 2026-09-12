import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { eventService, EVENT_TEMPLATES } from '../../services/EventService';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import db from '../../database/database';

export default class SuKienCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sukien')
        .setDescription('Sự kiện định kỳ - Tham gia hoạt động đặc biệt nhận thưởng.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách sự kiện đang và sắp diễn ra.')
        )
        .addSubcommand(sub =>
          sub
            .setName('thamgia')
            .setDescription('Tham gia một sự kiện đang hoạt động.')
            .addStringOption(opt =>
              opt.setName('ma_sukien')
                .setDescription('Mã sự kiện (xem trong /sukien danhsach)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('nhanthuong')
            .setDescription('Nhận thưởng sau khi sự kiện kết thúc.')
            .addStringOption(opt =>
              opt.setName('ma_sukien')
                .setDescription('Mã sự kiện muốn nhận thưởng.')
                .setRequired(true)
            )
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'danhsach') {
      const activeEvents = eventService.getActiveEvents();
      
      // Lấy cả sự kiện upcoming
      const upcomingEvents = db.prepare(
        "SELECT * FROM events WHERE status = 'upcoming' ORDER BY started_at ASC LIMIT 5"
      ).all() as any[];

      // Lấy sự kiện đã kết thúc gần đây
      const endedEvents = db.prepare(
        "SELECT * FROM events WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 5"
      ).all() as any[];

      const embed = new EmbedBuilder()
        .setTitle('<:tcdv:1548374838211649667> THIÊN CƠ DỊ VĂN · THIÊN HẠ DỊ ĐỘNG')
        .setColor(EMBED_COLORS.MYSTIC)
        .setDescription(
          'Thiên địa vận chuyển, phong vân biến đổi. Trong Thương Mang, những cơ duyên và dị tượng vẫn không ngừng xuất hiện, người hữu duyên ắt có ngày gặp được.\n' +
          (eventService.isDoubleExpActive() ? '\n🌊 **LINH TRIỀU DÂNG THẾ** · Thiên địa linh khí đang cuồn cuộn dâng trào, tu hành thuận thế mà đi, tu vi nhận **x2** từ mọi hoạt động!\n' : '')
        )
        .setTimestamp();

      // Sự kiện đang active
      if (activeEvents.length > 0) {
        let activeText = '';
        for (const ev of activeEvents) {
          const info = eventService.getEventInfo(ev);
          const rewards = this.formatRewards(ev.rewards_config);
          activeText += `\n**${this.getEventEmoji(ev.type)} ${ev.name}** [${this.getEventTypeName(ev.type)}]\n`;
          activeText += `${ev.description}\n`;
          activeText += `⏳ ${info.timeLeft} | <:idrole:1547865936848101456> ${info.participantCount} người tham gia\n`;
          activeText += `<:qua4:1547881540372009021> Thưởng: ${rewards}\n`;
          activeText += `🔹 Mã: \`${ev.id}\`\n\n`;
        }
        embed.addFields({ name: '### 🟢 ĐANG DIỄN RA', value: activeText || '*Không có*' });
      } else {
        embed.addFields({ name: '### 🟢 ĐANG DIỄN RA', value: '*Hiện không có sự kiện nào đang diễn ra.*' });
      }

      // Sự kiện sắp diễn ra
      if (upcomingEvents.length > 0) {
        let upcomingText = '';
        for (const ev of upcomingEvents) {
          const diff = ev.started_at - Math.floor(Date.now() / 1000);
          const hours = Math.floor(diff / 3600);
          const mins = Math.floor((diff % 3600) / 60);
          upcomingText += `**${this.getEventEmoji(ev.type)} ${ev.name}** - Bắt đầu sau ${hours}h${mins}m (Mã: \`${ev.id}\`)\n`;
        }
        embed.addFields({ name: '### <:thienthu:1547875509919289465> SẮP DIỄN RA', value: upcomingText });
      }

      // Sự kiện mẫu
      const templateText = EVENT_TEMPLATES.map(t =>
        `${this.getEventEmoji(t.type)} **${t.name}** - ${t.durationHours}h - ${this.getEventTypeName(t.type)}`
      ).join('\n');
      embed.addFields({ name: '### <:tin4:1547875508174327828> LOẠI SỰ KIỆN', value: templateText });

      embed.setFooter({ text: 'Dùng /sukien tham gia để tham gia sự kiện!' });

      await interaction.editReply(toV2Payload([embed]));
    }

    else if (sub === 'thamgia') {
      const eventId = interaction.options.getString('ma_sukien', true);
      const result = eventService.joinEvent(eventId, userId);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      const event = eventService.getEvent(eventId);
      const embed = new EmbedBuilder()
        .setTitle(`<:tcdv:1548374838211649667> THAM GIA SỰ KIỆN: ${event?.name}`)
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(result.message)
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
    }

    else if (sub === 'nhanthuong') {
      const eventId = interaction.options.getString('ma_sukien', true);
      const result = eventService.claimRewards(eventId, userId);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}` });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('<:qua4:1547881540372009021> NHẬN THƯỞNG SỰ KIỆN')
        .setColor(EMBED_COLORS.GOLD)
        .setDescription(result.message)
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
    }
  }

  private getEventEmoji(type: string): string {
    const map: Record<string, string> = {
      'weekly_boss': '<:boss:1548256901429469245>',
      'double_exp': '🌊',
      'seasonal': '<:nhh:1548374840170389626>',
      'mini_game': '<:mng:1548367699141464135>'
    };
    return map[type] || '<:tcdv:1548374838211649667>';
  }

  private getEventTypeName(type: string): string {
    const map: Record<string, string> = {
        'weekly_boss': 'Thiên Ngoại Dị Thú',
        'double_exp': 'Linh Triều Dâng Thế',
        'seasonal': 'Thiên Thời Luân Chuyển',
        'mini_game': 'Thiên Cơ Dị Hí',
        'loot_bonus': 'Thiên Cơ Khai Vận',
        'craft_bonus': 'Lô Hỏa Thông Linh',
        'boss_invasion': 'Hung Thú Phá Giới'
    };
    return map[type] || type;
  }

  private formatRewards(rewardsConfig: string): string {
    try {
      const rewards = JSON.parse(rewardsConfig || '[]');
      return rewards.map((r: any) => {
        if (r.type === 'coin') return `${r.amount} Linh Thạch`;
        if (r.type === 'tuvi') return `${r.amount} Tu Vi`;
        if (r.type === 'ngotinh') return `${r.amount} Ngộ Tính`;
        if (r.type === 'item') return `${r.amount}x ${r.itemId}`;
        return r.type;
      }).join(', ');
    } catch {
      return 'Không xác định';
    }
  }
}
