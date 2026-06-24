"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const RareBeastService_1 = require("../../services/RareBeastService");
const v2Components_1 = require("../../utils/v2Components");
const rareBeastConstants_1 = require("../../config/rareBeastConstants");
class DiThuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dithu')
            .setDescription('Dị Thú - Thu thập và nuôi dưỡng thú hiếm')
            .addSubcommand(sub => sub.setName('danhsach').setDescription('Xem danh sách dị thú'))
            .addSubcommand(sub => sub.setName('trangbi').setDescription('Trang bị dị thú'))
            .addSubcommand(sub => sub.setName('thongtin').setDescription('Xem chi tiết một dị thú')));
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
            const beasts = RareBeastService_1.rareBeastService.getUserBeasts(userId);
            if (!beasts.length) {
                await interaction.editReply({ content: '🐉 Đạo hữu chưa có dị thú nào. Hãy chiến đấu boss hoặc dungeon để thu phục!' });
                return;
            }
            let desc = '';
            for (const b of beasts) {
                const def = rareBeastConstants_1.RARE_BEASTS.find(r => r.type === b.beast_type);
                const equipped = b.equipped ? ' ⚡' : '';
                desc += `**${b.beast_name}** (${b.rarity})${equipped} — Level ${b.level} | ⭐ ${b.stars || 1}/5\n`;
                desc += `  ATK: ${def?.baseAtk ?? 0} | DEF: ${def?.baseDef ?? 0} | HP: ${def?.baseHp ?? 0}\n`;
                desc += `  Passive: ${def?.passiveDescription ?? 'N/A'}\n\n`;
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [(0, v2Components_1.header)('🐉 Dị Thú Của Đạo Hữu'), (0, v2Components_1.body)(desc)]);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'trangbi') {
            const beasts = RareBeastService_1.rareBeastService.getUserBeasts(userId);
            if (!beasts.length) {
                await interaction.editReply({ content: '🐉 Không có dị thú để trang bị.' });
                return;
            }
            const row = new discord_js_1.ActionRowBuilder();
            for (const b of beasts.slice(0, 5)) {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`rarebeast_equip_${b.beast_type}_${userId}`)
                    .setLabel(`${b.beast_name} ⭐${b.stars || 1}`)
                    .setStyle(b.equipped ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary));
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, [(0, v2Components_1.header)('🐉 Chọn Dị Thú Trang Bị')]);
            await interaction.editReply({ components: [comp, row], flags: v2Components_1.V2_FLAG });
        }
        else if (sub === 'thongtin') {
            const beasts = RareBeastService_1.rareBeastService.getUserBeasts(userId);
            if (!beasts.length) {
                await interaction.editReply({ content: '🐉 Đạo hữu chưa có dị thú.' });
                return;
            }
            const comps = [(0, v2Components_1.header)('🐉 Chi Tiết Dị Thú')];
            for (const b of beasts) {
                const def = rareBeastConstants_1.RARE_BEASTS.find(r => r.type === b.beast_type);
                const bonuses = RareBeastService_1.rareBeastService.getEquippedBonuses(userId);
                comps.push((0, v2Components_1.separator)());
                comps.push((0, v2Components_1.body)(`**${b.beast_name}** (${b.rarity}) ${b.equipped ? '⚡' : ''}\nLevel ${b.level} | ⭐ ${b.stars || 1}/5\nATK: ${bonuses.atk} | DEF: ${bonuses.def} | HP: ${bonuses.hp}\nPassive: ${def?.passiveDescription ?? 'N/A'}`));
            }
            const comp = (0, v2Components_1.container)(v2Components_1.V2_COLORS.mystic, comps);
            await interaction.editReply({ components: [comp], flags: v2Components_1.V2_FLAG });
        }
    }
}
exports.default = DiThuCommand;
