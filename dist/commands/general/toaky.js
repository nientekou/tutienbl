"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMountListEmbed = getMountListEmbed;
exports.getMountListComponents = getMountListComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const MountService_1 = require("../../services/MountService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
const ITEMS_PER_PAGE = 5;
function getMountListEmbed(user, mounts, active, ropesCount, feedableItems, page) {
    const totalPages = Math.max(Math.ceil(mounts.length / ITEMS_PER_PAGE), 1);
    const cappedPage = Math.min(Math.max(page, 1), totalPages);
    const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
    const pageMounts = mounts.slice(offset, offset + ITEMS_PER_PAGE);
    const content = [
        (0, v2Components_1.header)(`🐎 TỌA KỴ CÁC - ${user.name}`, `Đang cưỡi: **${active ? active.name : 'Không có'}**\n🎒 Số lượng Thừng Bắt Thú: **${ropesCount}** chiếc`)
    ];
    if (mounts.length === 0) {
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`🐎 Đạo hữu chưa sở hữu tọa kỵ nào! Hãy đi săn yêu thú (\`/sanyeuthu\`) hoặc dùng thừng để bắt.\n\n` +
            `🎯 **Cơ Hội Đi Săn Tọa Kỵ:**\n` +
            `• Dùng lệnh \`/toaky bat\` để đi săn lùng tọa kỵ ngoài hoang dã.\n` +
            `• Phí tổn: Tiêu hao **1** Thừng Bắt Thú (\`thung_bat_thu\`).\n` +
            `• **Danh sách tọa kỵ có thể gặp & Tỷ lệ thuần phục:**\n` +
            `  - **Huyết Hãn Mã** [COMMON] (Gặp: 50% │ Bắt: 80%)\n` +
            `  - **U Minh Lang** [UNCOMMON] (Gặp: 30% │ Bắt: 60%)\n` +
            `  - **Xích Viêm Hổ** [RARE] (Gặp: 15% │ Bắt: 40%)\n` +
            `  - **Giao Long** [EPIC] (Gặp: 4% │ Bắt: 20%)\n` +
            `  - **Hỏa Kỳ Lân** [LEGENDARY] (Gặp: 1% │ Bắt: 5%)`));
    }
    else {
        for (const m of pageMounts) {
            const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
            const activeMark = m.is_active ? ' ✅' : '';
            const tamedMark = m.is_tamed ? '' : ' **[Hoang Dại]**';
            const progress = MountService_1.mountService.calculateExpProgress(m);
            const bar = (0, constants_1.getProgressBar)(progress.current, progress.needed, 10);
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`${rarityEmoji[m.rarity] || '⚪'} **${m.name}** (ID: \`${m.id}\`, Cấp ${m.level}) [${m.rarity.toUpperCase()}]${tamedMark}${activeMark}\n` +
                [
                    m.is_tamed ? `├ Tốc độ: **+${Math.round(m.speed_bonus * 100)}%** cooldown làm việc` : '',
                    m.is_tamed ? `├ Tiết kiệm: **+${Math.round(m.stamina_save * 100)}%** thể lực` : '',
                    `├ EXP: ${bar} *(${progress.current}/${progress.needed})*`,
                    (!m.is_tamed) ? `└ Dùng \`/toaky nuoiduong mount_id:${m.id} nguyenlieu:[Mã Nguyên Liệu]\` để thuần hóa.` : (m.is_active ? '' : `└ Dùng \`/toaky cuoi mount_id:${m.id}\` để cưỡi.`),
                ].filter(Boolean).join('\n')));
        }
        let feedableText = '';
        if (feedableItems.length > 0) {
            const rarityExp = { common: 15, uncommon: 30, rare: 50, epic: 80, legendary: 150 };
            feedableText = feedableItems.map((item) => {
                const exp = rarityExp[item.rarity] || 15;
                return `• **${item.name}** (\`${item.inv_id}\`): còn **x${item.quantity}** (EXP: **+${exp}**)`;
            }).join('\n');
        }
        else {
            feedableText = '• *Không tìm thấy nguyên liệu/đan dược phù hợp trong túi đồ.*';
        }
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`🎒 **Nguyên Liệu Nuôi Dưỡng Khả Dụng:**\n${feedableText}\n\n*Mẹo: Dùng \`/toaky nuoiduong [ID Tọa Kỵ] [Mã Nguyên Liệu]\` để nuôi dưỡng.*`));
        content.push((0, v2Components_1.separator)());
        content.push((0, v2Components_1.body)(`🎯 **Cơ Hội Đi Săn Tọa Kỵ:**\n` +
            `• Dùng lệnh \`/toaky bat\` để đi săn lùng tọa kỵ ngoài hoang dã.\n` +
            `• **Danh sách tọa kỵ có thể gặp & Tỷ lệ thuần phục:**\n` +
            `  - **Huyết Hãn Mã** [COMMON] (Gặp: 50% │ Bắt: 80%)\n` +
            `  - **U Minh Lang** [UNCOMMON] (Gặp: 30% │ Bắt: 60%)\n` +
            `  - **Xích Viêm Hổ** [RARE] (Gặp: 15% │ Bắt: 40%)\n` +
            `  - **Giao Long** [EPIC] (Gặp: 4% │ Bắt: 20%)\n` +
            `  - **Hỏa Kỳ Lân** [LEGENDARY] (Gặp: 1% │ Bắt: 5%)`));
        if (mounts.length > ITEMS_PER_PAGE) {
            content.push((0, v2Components_1.separator)());
            content.push((0, v2Components_1.body)(`*Trang ${cappedPage}/${totalPages} (${mounts.length} tọa kỵ)*`));
        }
    }
    const embed = (0, v2Components_1.container)(v2Components_1.V2_COLORS.gold, content);
    return { embed, totalPages };
}
function getMountListComponents(userId, page, totalPages) {
    if (totalPages <= 1)
        return [];
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder().setCustomId(`mountprev_${page}_${userId}`).setEmoji('◀').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page <= 1), new discord_js_1.ButtonBuilder().setCustomId(`mountnext_${page}_${userId}`).setEmoji('▶').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page >= totalPages));
    return [row];
}
class ToaKyCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('toaky')
            .setDescription('Quản lý tọa kỵ - giảm cooldown làm việc và tiết kiệm thể lực')
            .addSubcommand(sub => sub.setName('bat').setDescription('Tìm và bắt tọa kỵ (Tiêu hao Thừng Bắt Thú)'))
            .addSubcommand(sub => sub.setName('danhsach').setDescription('Xem danh sách tọa kỵ'))
            .addSubcommand(sub => sub.setName('cuoi')
            .setDescription('Cưỡi tọa kỵ')
            .addIntegerOption(opt => opt.setName('mount_id').setDescription('ID vật cưỡi (xem trong /toaky)').setRequired(true)))
            .addSubcommand(sub => sub.setName('thuhoi').setDescription('Thu hồi tọa kỵ đang cưỡi'))
            .addSubcommand(sub => sub.setName('nuoiduong')
            .setDescription('Nuôi dưỡng/Thuần hóa tọa kỵ bằng nguyên liệu')
            .addIntegerOption(opt => opt.setName('mount_id').setDescription('ID vật cưỡi (xem trong /toaky)').setRequired(true))
            .addStringOption(opt => opt.setName('nguyenlieu').setDescription('Nguyên liệu (gõ tên để gợi ý)').setAutocomplete(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng muốn cho ăn').setRequired(false))));
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
            const mounts = MountService_1.mountService.getMounts(userId);
            const active = MountService_1.mountService.getActiveMount(userId);
            const ropeInv = database_1.default.prepare('SELECT quantity FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, 'thung_bat_thu');
            const ropesCount = ropeInv ? ropeInv.quantity : 0;
            const feedableItems = database_1.default.prepare(`
        SELECT i.id as inv_id, i.item_id, item.name, item.rarity, i.quantity
        FROM inventories i
        JOIN items item ON i.item_id = item.id
        WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
        ORDER BY i.quantity DESC
        LIMIT 5
      `).all(userId);
            const { embed, totalPages } = getMountListEmbed(user, mounts, active, ropesCount, feedableItems, 1);
            const components = getMountListComponents(userId, 1, totalPages);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
            return;
        }
        if (sub === 'cuoi') {
            const mountId = interaction.options.getInteger('mount_id', true);
            const result = MountService_1.mountService.activateMount(userId, mountId);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (sub === 'thuhoi') {
            const result = MountService_1.mountService.deactivateMount(userId);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (sub === 'nuoiduong') {
            const mountId = interaction.options.getInteger('mount_id', true);
            const material = interaction.options.getString('nguyenlieu');
            if (!material) {
                await interaction.editReply({ content: '❌ Vui lòng chọn nguyên liệu muốn cho tọa kỵ ăn!' });
                return;
            }
            const qty = interaction.options.getInteger('soluong') || 1;
            const result = MountService_1.mountService.feedMount(userId, mountId, material, qty);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (sub === 'bat') {
            const result = MountService_1.mountService.captureMount(userId, 'thung_bat_thu');
            await interaction.editReply({ content: result.message });
            return;
        }
    }
    async autocomplete(client, interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'nguyenlieu') {
            const userId = interaction.user.id;
            const query = focusedOption.value;
            const items = database_1.default.prepare(`
        SELECT i.id as inv_id, i.item_id, item.name, item.rarity, i.quantity
        FROM inventories i
        JOIN items item ON i.item_id = item.id
        WHERE i.user_id = ? AND (item.type = 'material' OR item.type = 'pill')
        AND (item.name LIKE ? OR i.item_id LIKE ?)
        ORDER BY i.quantity DESC
        LIMIT 25
      `).all(userId, `%${query}%`, `%${query}%`);
            await interaction.respond(items.map(item => ({
                name: `${item.name} [${item.rarity}] (x${item.quantity}) - ID: ${item.inv_id}`,
                value: item.item_id
            })));
        }
    }
}
exports.default = ToaKyCommand;
