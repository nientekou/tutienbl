"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const EventService_1 = require("../../services/EventService");
const database_1 = __importDefault(require("../../database/database"));
class SuKienCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('sukien')
            .setDescription('Sự kiện định kỳ - Tham gia hoạt động đặc biệt nhận thưởng.')
            .addSubcommand(sub => sub
            .setName('danhsach')
            .setDescription('Xem danh sách sự kiện đang và sắp diễn ra.'))
            .addSubcommand(sub => sub
            .setName('thamgia')
            .setDescription('Tham gia một sự kiện đang hoạt động.')
            .addStringOption(opt => opt.setName('ma_sukien')
            .setDescription('Mã sự kiện (xem trong /sukien danhsach)')
            .setRequired(true)))
            .addSubcommand(sub => sub
            .setName('nhanthuong')
            .setDescription('Nhận thưởng sau khi sự kiện kết thúc.')
            .addStringOption(opt => opt.setName('ma_sukien')
            .setDescription('Mã sự kiện muốn nhận thưởng.')
            .setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'danhsach') {
            const activeEvents = EventService_1.eventService.getActiveEvents();
            // Lấy cả sự kiện upcoming
            const upcomingEvents = database_1.default.prepare("SELECT * FROM events WHERE status = 'upcoming' ORDER BY started_at ASC LIMIT 5").all();
            // Lấy sự kiện đã kết thúc gần đây
            const endedEvents = database_1.default.prepare("SELECT * FROM events WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 5").all();
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🎪 SỰ KIỆN ĐỊNH KỲ - THIÊN ĐỊA ĐẠI HỘI')
                .setColor('#9b59b6')
                .setDescription('Các sự kiện đặc biệt diễn ra định kỳ trên toàn server. Tham gia để nhận phần thưởng giá trị!\n' +
                (EventService_1.eventService.isDoubleExpActive() ? '\n⚠️ **DOUBLE EXP WEEKEND ĐANG HOẠT ĐỘNG!** x2 Tu Vi từ mọi hoạt động!\n' : ''))
                .setTimestamp();
            // Sự kiện đang active
            if (activeEvents.length > 0) {
                let activeText = '';
                for (const ev of activeEvents) {
                    const info = EventService_1.eventService.getEventInfo(ev);
                    const rewards = this.formatRewards(ev.rewards_config);
                    activeText += `**${this.getEventEmoji(ev.type)} ${ev.name}** [${this.getEventTypeName(ev.type)}]\n`;
                    activeText += `${ev.description}\n`;
                    activeText += `⏳ ${info.timeLeft} | 👥 ${info.participantCount} người tham gia\n`;
                    activeText += `📦 Thưởng: ${rewards}\n`;
                    activeText += `🔹 Mã: \`${ev.id}\`\n\n`;
                }
                embed.addFields({ name: '🟢 ĐANG DIỄN RA', value: activeText || '*Không có*' });
            }
            else {
                embed.addFields({ name: '🟢 ĐANG DIỄN RA', value: '*Hiện không có sự kiện nào đang diễn ra.*' });
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
                embed.addFields({ name: '📅 SẮP DIỄN RA', value: upcomingText });
            }
            // Sự kiện mẫu
            const templateText = EventService_1.EVENT_TEMPLATES.map(t => `${this.getEventEmoji(t.type)} **${t.name}** - ${t.durationHours}h - ${this.getEventTypeName(t.type)}`).join('\n');
            embed.addFields({ name: '📋 LOẠI SỰ KIỆN', value: templateText });
            embed.setFooter({ text: 'Dùng /sukien tham gia để tham gia sự kiện!' });
            await interaction.editReply({ embeds: [embed] });
        }
        else if (sub === 'thamgia') {
            const eventId = interaction.options.getString('ma_sukien', true);
            const result = EventService_1.eventService.joinEvent(eventId, userId);
            if (!result.success) {
                await interaction.editReply({ content: `❌ ${result.message}` });
                return;
            }
            const event = EventService_1.eventService.getEvent(eventId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🎪 THAM GIA SỰ KIỆN: ${event?.name}`)
                .setColor('#2ecc71')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (sub === 'nhanthuong') {
            const eventId = interaction.options.getString('ma_sukien', true);
            const result = EventService_1.eventService.claimRewards(eventId, userId);
            if (!result.success) {
                await interaction.editReply({ content: `❌ ${result.message}` });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🎁 NHẬN THƯỞNG SỰ KIỆN')
                .setColor('#f1c40f')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
    getEventEmoji(type) {
        const map = {
            'weekly_boss': '👹',
            'double_exp': '⚡',
            'seasonal': '🎊',
            'mini_game': '🎮'
        };
        return map[type] || '🎪';
    }
    getEventTypeName(type) {
        const map = {
            'weekly_boss': 'Boss Tuần',
            'double_exp': 'X2 Tu Vi',
            'seasonal': 'Sự Kiện Mùa',
            'mini_game': 'Mini Game'
        };
        return map[type] || type;
    }
    formatRewards(rewardsConfig) {
        try {
            const rewards = JSON.parse(rewardsConfig || '[]');
            return rewards.map((r) => {
                if (r.type === 'coin')
                    return `${r.amount} Linh Thạch`;
                if (r.type === 'tuvi')
                    return `${r.amount} Tu Vi`;
                if (r.type === 'ngotinh')
                    return `${r.amount} Ngộ Tính`;
                if (r.type === 'item')
                    return `${r.amount}x ${r.itemId}`;
                return r.type;
            }).join(', ');
        }
        catch {
            return 'Không xác định';
        }
    }
}
exports.default = SuKienCommand;
