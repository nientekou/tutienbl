"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const TamMaService_1 = require("../../services/TamMaService");
const v2Components_1 = require("../../utils/v2Components");
const tamMaConstants_1 = require("../../config/tamMaConstants");
class TamMaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('tammanhodao')
            .setDescription('Tâm ma & Ngộ đạo - Đối diện nội tâm, tu luyện đạo')
            .addSubcommand(sub => sub.setName('trangthai').setDescription('Xem trạng thái tâm ma và ngộ đạo'))
            .addSubcommand(sub => sub.setName('lichsuma').setDescription('Xem lịch sử tâm ma')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'trangthai') {
            const activeDemon = TamMaService_1.tamMaService.getActiveDemon(userId);
            const daoProgress = TamMaService_1.tamMaService.getDaoProgress(userId);
            const comps = [(0, v2Components_1.header)('👹 Tâm Ma & Ngộ Đạo')];
            if (activeDemon) {
                comps.push((0, v2Components_1.separator)());
                comps.push((0, v2Components_1.body)(`**⚠️ Tâm Ma Đang Hoạt Động**\n**${activeDemon.demon_name}** (Sức mạnh: ${activeDemon.power})`));
            }
            comps.push((0, v2Components_1.separator)());
            if (daoProgress.length > 0) {
                let daoDesc = '**📖 Ngộ Đạo**\n';
                for (const d of daoProgress) {
                    const levels = tamMaConstants_1.DAO_LEVELS[d.dao_type] || [];
                    const nextLevel = levels[d.level] || levels[levels.length - 1];
                    daoDesc += `**${d.dao_type}**: Level ${d.level} | ${d.points}/${nextLevel?.pointsNeeded ?? 'MAX'} điểm\n`;
                    if (nextLevel && nextLevel.passive !== 'none') {
                        daoDesc += `  → Passive: ${nextLevel.passive} (+${nextLevel.value})\n`;
                    }
                }
                comps.push((0, v2Components_1.body)(daoDesc));
            }
            else {
                comps.push((0, v2Components_1.body)('**📖 Ngộ Đạo**\n*Chưa ngộ được đạo nào. Hãy chiến đấu tâm ma!*'));
            }
            comps.push((0, v2Components_1.separator)());
            comps.push((0, v2Components_1.body)('**💡 Hướng Dẫn**\nTâm ma xuất hiện ngẫu nhiên khi tu luyện. Chiến thắng tâm ma nhận điểm ngộ đạo.\nLệch tâm càng cao, tâm ma càng hay xuất hiện.'));
            await interaction.editReply({ components: [(0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, comps)], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'lichsuma') {
            const history = TamMaService_1.tamMaService.getDemonHistory(userId, 10);
            if (!history.length) {
                await interaction.editReply({ content: '📭 Chưa có lịch sử tâm ma.' });
                return;
            }
            let desc = '';
            for (const h of history) {
                desc += `**${h.demon_name}** — Sức mạnh: ${h.power} ✅\n`;
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [(0, v2Components_1.header)('📜 Lịch Sử Tâm Ma'), (0, v2Components_1.body)(desc)]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
    }
}
exports.default = TamMaCommand;
