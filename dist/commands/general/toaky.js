"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const MountService_1 = require("../../services/MountService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
class ToaKyCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('toaky')
            .setDescription('Quản lý tọa kỵ - giảm cooldown làm việc và tiết kiệm thể lực')
            .addSubcommand(sub => sub.setName('bat').setDescription('Tìm và bắt tọa kỵ (Tiêu hao Thừng Bắt Thú)'))
            .addSubcommand(sub => sub.setName('danhsach').setDescription('Xem danh sách tọa kỵ'))
            .addSubcommand(sub => sub.setName('cuoi')
            .setDescription('Cưỡi tọa kỵ')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID tọa kỵ').setRequired(true)))
            .addSubcommand(sub => sub.setName('thuhoi').setDescription('Thu hồi tọa kỵ đang cưỡi'))
            .addSubcommand(sub => sub.setName('nuoiduong')
            .setDescription('Nuôi dưỡng/Thuần hóa tọa kỵ bằng nguyên liệu')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID tọa kỵ').setRequired(true))
            .addStringOption(opt => opt.setName('nguyenlieu').setDescription('ID nguyên liệu (ví dụ: material_iron_1)').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng muốn cho ăn').setRequired(false))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'danhsach') {
            const mounts = MountService_1.mountService.getMounts(userId);
            const active = MountService_1.mountService.getActiveMount(userId);
            const ropeInv = database_1.default.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, 'thung_bat_thu');
            const ropesCount = ropeInv ? ropeInv.quantity : 0;
            const feedableItems = database_1.default.prepare(`
        SELECT i.item_id, item.name, item.rarity, i.quantity
        FROM inventories i
        JOIN items item ON i.item_id = item.id
        WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
        ORDER BY i.quantity DESC
        LIMIT 5
      `).all(userId);
            let feedableText = '';
            if (feedableItems.length > 0) {
                const rarityExp = { common: 15, uncommon: 30, rare: 50, epic: 80, legendary: 150 };
                feedableText = feedableItems.map(item => {
                    const exp = rarityExp[item.rarity] || 15;
                    return `• **${item.name}** (\`${item.item_id}\`): còn **x${item.quantity}** (EXP: **+${exp}**)`;
                }).join('\n');
            }
            else {
                feedableText = '• *Không tìm thấy nguyên liệu/đan dược phù hợp trong túi đồ.*';
            }
            if (mounts.length === 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`🐎 TỌA KỴ CÁC - ${user.name}`)
                    .setColor('#e67e22')
                    .setDescription(`🐎 Đạo hữu chưa có tọa kỵ nào! Hãy đi săn yêu thú (\`/sanyeuthu\`) hoặc dùng thừng để bắt.\n\n` +
                    `🎒 Số lượng Thừng Bắt Thú: **${ropesCount}** chiếc`)
                    .addFields({
                    name: '🎯 Cơ Hội Đi Săn Tọa Kỵ',
                    value: `• Dùng lệnh \`/toaky bat\` để đi săn lùng tọa kỵ ngoài hoang dã.\n` +
                        `• Phí tổn: Tiêu hao **1** Thừng Bắt Thú (\`thung_bat_thu\`).\n` +
                        `• **Danh sách tọa kỵ có thể gặp & Tỷ lệ thuần phục:**\n` +
                        `  - **Huyết Hãn Mã** [COMMON] (Gặp: 50% | Bắt: 80%)\n` +
                        `  - **U Minh Lang** [UNCOMMON] (Gặp: 30% | Bắt: 60%)\n` +
                        `  - **Xích Viêm Hổ** [RARE] (Gặp: 15% | Bắt: 40%)\n` +
                        `  - **Giao Long** [EPIC] (Gặp: 4% | Bắt: 20%)\n` +
                        `  - **Hỏa Kỳ Lân** [LEGENDARY] (Gặp: 1% | Bắt: 5%)`
                });
                await interaction.reply({ embeds: [embed] });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🐎 TỌA KỴ CÁC - ${user.name}`)
                .setColor('#e67e22')
                .setDescription(`Đang cưỡi: **${active ? active.name : 'Không có'}**\n` +
                `🎒 Số lượng Thừng Bắt Thú: **${ropesCount}** chiếc`);
            for (const m of mounts) {
                const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
                const activeMark = m.is_active ? ' ✅' : '';
                const tamedMark = m.is_tamed ? '' : ' **[Hoang Dại]**';
                const progress = MountService_1.mountService.calculateExpProgress(m);
                const bar = (0, constants_1.getProgressBar)(progress.current, progress.needed, 10);
                embed.addFields({
                    name: `${rarityEmoji[m.rarity] || '⚪'} ID: ${m.id} | ${m.name} (Cấp ${m.level}) [${m.rarity.toUpperCase()}]${tamedMark}${activeMark}`,
                    value: [
                        m.is_tamed ? `🏇 Tốc độ: **+${Math.round(m.speed_bonus * 100)}%** cooldown làm việc` : '',
                        m.is_tamed ? `⚡ Tiết kiệm: **+${Math.round(m.stamina_save * 100)}%** thể lực` : '',
                        `📊 EXP: ${bar} *(${progress.current}/${progress.needed})*`,
                        (!m.is_tamed) ? `Dùng \`/toaky nuoiduong id:${m.id} nguyenlieu:[Mã Nguyên Liệu]\` để thuần hóa.` : (m.is_active ? '' : `Dùng \`/toaky cuoi id:${m.id}\` để cưỡi.`),
                    ].filter(Boolean).join('\n'),
                });
            }
            embed.addFields({
                name: '🎒 Nguyên Liệu Nuôi Dưỡng Khả Dụng',
                value: feedableText + '\n\n*Mẹo: Dùng `/toaky nuoiduong [ID Tọa Kỵ] [Mã Nguyên Liệu]` để tăng cấp hoặc thuần hóa.*'
            }, {
                name: '🎯 Cơ Hội Đi Săn Tọa Kỵ',
                value: `• Dùng lệnh \`/toaky bat\` để đi săn lùng tọa kỵ ngoài hoang dã.\n` +
                    `• **Danh sách tọa kỵ có thể gặp & Tỷ lệ thuần phục:**\n` +
                    `  - **Huyết Hãn Mã** [COMMON] (Gặp: 50% | Bắt: 80%)\n` +
                    `  - **U Minh Lang** [UNCOMMON] (Gặp: 30% | Bắt: 60%)\n` +
                    `  - **Xích Viêm Hổ** [RARE] (Gặp: 15% | Bắt: 40%)\n` +
                    `  - **Giao Long** [EPIC] (Gặp: 4% | Bắt: 20%)\n` +
                    `  - **Hỏa Kỳ Lân** [LEGENDARY] (Gặp: 1% | Bắt: 5%)`
            });
            await interaction.reply({ embeds: [embed] });
            return;
        }
        if (sub === 'cuoi') {
            const mountId = interaction.options.getInteger('id', true);
            const result = MountService_1.mountService.activateMount(userId, mountId);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (sub === 'thuhoi') {
            const result = MountService_1.mountService.deactivateMount(userId);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (sub === 'nuoiduong') {
            const mountId = interaction.options.getInteger('id', true);
            const material = interaction.options.getString('nguyenlieu', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            const result = MountService_1.mountService.feedMount(userId, mountId, material, qty);
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
        if (sub === 'bat') {
            const result = MountService_1.mountService.captureMount(userId, 'thung_bat_thu');
            await interaction.reply({ content: result.message, ephemeral: !result.success });
            return;
        }
    }
}
exports.default = ToaKyCommand;
