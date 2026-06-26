"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const RareFireService_1 = require("../../services/RareFireService");
const v2Components_1 = require("../../utils/v2Components");
const rareFireConstants_1 = require("../../config/rareFireConstants");
class DiHoaCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dihoa')
            .setDescription('Dị Hỏa - Thu thập và cường hóa ngọn lửa hiếm')
            .addSubcommand(sub => sub.setName('danhsach').setDescription('Xem danh sách dị hỏa đã thu thập'))
            .addSubcommand(sub => sub.setName('trangbi').setDescription('Trang bị dị hỏa'))
            .addSubcommand(sub => sub.setName('nangcap').setDescription('Nâng cấp dị hỏa bằng nguyên liệu')));
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
            const fires = RareFireService_1.rareFireService.getUserFires(userId);
            if (!fires.length) {
                await interaction.editReply({ content: '🔥 Đạo hữu chưa có dị hỏa nào. Hãy chiến đấu boss hoặc dungeon để thu thập!' });
                return;
            }
            let desc = '';
            for (const f of fires) {
                const def = rareFireConstants_1.RARE_FIRES.find(r => r.type === f.fire_type);
                const equipped = f.equipped ? ' ⚡' : '';
                desc += `**${f.fire_name}** (T${f.tier})${equipped} — Level ${f.level}\n`;
                desc += `  🔥 Alchemy +${def?.alchemyBonus ?? 0}% | ⚔️ Combat: ${def?.combatPassive ?? 'N/A'}\n\n`;
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [(0, v2Components_1.header)('🔥 Dị Hỏa Của Đạo Hữu'), (0, v2Components_1.body)(desc)]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'trangbi') {
            const fires = RareFireService_1.rareFireService.getUserFires(userId);
            if (!fires.length) {
                await interaction.editReply({ content: '🔥 Không có dị hỏa để trang bị.' });
                return;
            }
            const row = new discord_js_1.ActionRowBuilder();
            for (const f of fires.slice(0, 5)) {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`rarefire_equip_${f.fire_type}_${userId}`)
                    .setLabel(`${f.fire_name} T${f.tier}`)
                    .setStyle(f.equipped ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary));
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.danger, [(0, v2Components_1.header)('🔥 Chọn Dị Hỏa Trang Bị')]);
            await interaction.editReply({ components: [comp, row], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'nangcap') {
            const fires = RareFireService_1.rareFireService.getUserFires(userId);
            const equipped = fires.find(f => f.equipped);
            if (!equipped) {
                await interaction.editReply({ content: '🔥 Hãy trang bị dị hỏa trước khi nâng cấp!' });
                return;
            }
            const result = RareFireService_1.rareFireService.feed(userId, equipped.fire_type, 'iron', 5);
            if (result.success) {
                await interaction.editReply({ content: `🔥 **${equipped.fire_name}** đã lên **Level ${result.newLevel}**!` });
            }
            else {
                await interaction.editReply({ content: `🔥 Đã cập nhật kinh nghiệm cho **${equipped.fire_name}**. Level hiện tại: ${result.newLevel}` });
            }
        }
    }
}
exports.default = DiHoaCommand;
