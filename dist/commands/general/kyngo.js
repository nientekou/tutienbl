"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const KyNgoService_1 = require("../../services/KyNgoService");
const v2Components_1 = require("../../utils/v2Components");
class KyNgoCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('kyngo')
            .setDescription('Kỳ ngộ tu luyện - Random events khi tu luyện')
            .addSubcommand(sub => sub.setName('sukien').setDescription('Xem sự kiện kỳ ngộ đang chờ'))
            .addSubcommand(sub => sub.setName('lichsu').setDescription('Xem lịch sử kỳ ngộ')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'sukien') {
            const events = KyNgoService_1.kyNgoService.getPendingEvents(userId);
            if (!events.length) {
                await interaction.editReply({
                    content: '📭 Không có sự kiện kỳ ngộ nào đang chờ.\n*Hãy tu luyện (`/tuluyen`) để có cơ hội gặp kỳ ngộ!*'
                });
                return;
            }
            for (const evt of events) {
                const data = JSON.parse(evt.event_data);
                const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [(0, v2Components_1.header)(data.title), (0, v2Components_1.body)(data.description)]);
                const row = new discord_js_1.ActionRowBuilder();
                for (const choice of data.choices) {
                    row.addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`kyngo_choose_${evt.id}_${choice.id}_${userId}`)
                        .setLabel(choice.label)
                        .setStyle(choice.riskLevel === 'high' ? discord_js_1.ButtonStyle.Danger : choice.riskLevel === 'medium' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Success));
                }
                await interaction.editReply({ components: [comp, row], flags: v2Components_1.V2_FLAG });
                return;
            }
        }
        else if (sub === 'lichsu') {
            const history = KyNgoService_1.kyNgoService.getEventHistory(userId, 10);
            if (!history.length) {
                await interaction.editReply({ content: '📭 Chưa có lịch sử kỳ ngộ.' });
                return;
            }
            let desc = '';
            for (const h of history) {
                const data = JSON.parse(h.event_data);
                const result = h.result_data ? JSON.parse(h.result_data) : null;
                desc += `**${data.title}** — ${result?.success ? '✅' : '❌'} ${h.selected_choice || 'N/A'}\n`;
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [(0, v2Components_1.header)('📜 Lịch Sử Kỳ Ngộ'), (0, v2Components_1.body)(desc)]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
    }
}
exports.default = KyNgoCommand;
