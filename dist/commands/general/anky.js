"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildImprintListEmbed = buildImprintListEmbed;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const SoulImprintRepository_1 = require("../../database/repositories/SoulImprintRepository");
const SoulImprintService_1 = require("../../services/SoulImprintService");
const constants_1 = require("../../utils/constants");
const itemConstants_1 = require("../../config/itemConstants");
const uiSystem_1 = require("../../utils/uiSystem");
const GROUP_NAMES = {
    'weapon': '⚔️ Bộ Vũ Khí Thượng Cổ',
    'armor': '🛡️ Bộ Pháp Y Vô Thượng',
    'accessory': '📿 Bộ Linh Bản Phụ Kiện',
    'other': '📦 Bộ Khác'
};
const SET_ITEMS = {
    'weapon': [
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_C, name: 'Kiếm Sắt (C)' },
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_B, name: 'Thanh Phong Kiếm (B)' },
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_A, name: 'Thanh Quang Bảo Kiếm (A)' },
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_S, name: 'Vô Ảnh Kiếm (S)' },
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_SS, name: 'Huyền Thiên Linh Kiếm (SS)' },
        { id: itemConstants_1.ITEMS.WEAPON_SWORD_SSS, name: 'Thần Ma Trảm Tiên Kiếm (SSS)' }
    ],
    'armor': [
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_C, name: 'Đạo Bào Thô (C)' },
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_B, name: 'Tụ Linh Y (B)' },
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_A, name: 'Huyền Vũ Bào (A)' },
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_S, name: 'Hỗn Nguyên Đạo Y (S)' },
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_SS, name: 'Thái Cực Huyền Y (SS)' },
        { id: itemConstants_1.ITEMS.ARMOR_ROBE_SSS, name: 'Cửu Thiên Phượng Vũ Y (SSS)' }
    ],
    'accessory': [
        { id: itemConstants_1.ITEMS.RING_1, name: 'Nhẫn Trữ Vật' },
        { id: itemConstants_1.ITEMS.NECKLACE_1, name: 'Dây Chuyền Linh Lực' },
        { id: itemConstants_1.ITEMS.AMULET_1, name: 'Bùa Hộ Mệnh' }
    ]
};
function buildImprintListEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const imprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(userId);
    const totalStats = SoulImprintService_1.soulImprintService.getImprintStats(userId);
    const setBonuses = SoulImprintService_1.soulImprintService.getSetBonuses(userId);
    const statsLines = [];
    if (totalStats.hp)
        statsLines.push(`• Sinh lực: **+${totalStats.hp}**`);
    if (totalStats.mp)
        statsLines.push(`• Pháp lực: **+${totalStats.mp}**`);
    if (totalStats.atk)
        statsLines.push(`• Công kích: **+${totalStats.atk}**`);
    if (totalStats.def)
        statsLines.push(`• Phòng ngự: **+${totalStats.def}**`);
    if (totalStats.crit)
        statsLines.push(`• Bạo kích: **+${(totalStats.crit * 100).toFixed(1)}%**`);
    if (totalStats.speed)
        statsLines.push(`• Tốc độ: **+${totalStats.speed}**`);
    if (totalStats.luck)
        statsLines.push(`• May mắn: **+${totalStats.luck}**`);
    const setBonusLines = [];
    if (setBonuses.atk)
        setBonusLines.push(`• Công kích từ Bộ: **+${setBonuses.atk}**`);
    if (setBonuses.crit)
        setBonusLines.push(`• Bạo kích từ Bộ: **+${(setBonuses.crit * 100).toFixed(1)}%**`);
    if (setBonuses.hasOai)
        setBonusLines.push(`• Kỹ năng Bộ: **Oai** (5% làm Tê Liệt đối thủ khi đánh)`);
    const listText = imprints.map((imp, idx) => {
        const statsObj = JSON.parse(imp.imprint_stats);
        const statsStr = Object.entries(statsObj).map(([k, v]) => {
            if (k === 'crit')
                return `+${(v * 100).toFixed(0)}% Bạo`;
            return `+${v} ${k.toUpperCase()}`;
        }).join(', ');
        const boundText = imp.is_bound === 1 ? '🔒 Liên kết' : '🔓 Có thể giao dịch';
        return `**${idx + 1}. [${imp.item_rarity.toUpperCase()}] ${imp.item_name}** (ID: \`${imp.id}\`)\n  └ *Chỉ số:* ${statsStr}\n  └ *Phân nhóm:* ${GROUP_NAMES[imp.set_group] || imp.set_group} | *Trạng thái:* ${boundText}`;
    }).join('\n\n');
    const bar = (0, constants_1.getProgressBar)(imprints.length, 50, 10);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🌟 ĐỀN THỜ ẤN KÝ LINH HỒN - ${user.name}`)
        .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
        .setDescription(`*Nơi lưu giữ linh hồn của các thần binh bảo giáp đã bị tiêu hủy. Chỉ số của Ấn Ký được cộng dồn vĩnh viễn vào thuộc tính nhân vật, bất kể có trang bị hay không.*\n\n` +
        `📊 **Ấn Ký Hiện Tại:** ${bar} **(${imprints.length}/50)**\n`)
        .addFields({
        name: '📈 Tổng Chỉ Số Ấn Ký Tích Lũy',
        value: statsLines.length > 0 ? statsLines.join('\n') : '`Chưa có chỉ số tích lũy`',
        inline: true
    }, {
        name: '✨ Hiệu Ứng Kích Hoạt Bộ',
        value: setBonusLines.length > 0 ? setBonusLines.join('\n') : '`Chưa kích hoạt hiệu ứng bộ (Yêu cầu >= 3 món unique cùng bộ)`',
        inline: true
    }, {
        name: '📜 Danh Sách Ấn Ký Linh Hồn',
        value: listText ? (listText.length > 1024 ? listText.substring(0, 1021) + '...' : listText) : '`Chưa có thần khí nào được ấn ký vĩnh viễn.`',
        inline: false
    })
        .setTimestamp();
    return embed;
}
class AnkyCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('anky')
            .setDescription('Quản lý, đúc luyện và giao dịch Ấn Ký Linh Hồn.')
            .addSubcommand(sub => sub.setName('danhsach')
            .setDescription('Xem toàn bộ Ấn Ký Linh Hồn và thuộc tính vĩnh viễn đạo hữu tích lũy.'))
            .addSubcommand(sub => sub.setName('anky')
            .setDescription('Tiêu hủy trang bị 5 Sao để đúc thành Ấn Ký Linh Hồn.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID trang bị trong túi đồ (Không bắt buộc)').setRequired(false)))
            .addSubcommand(sub => sub.setName('bo-suu-tap')
            .setDescription('Xem tiến độ thu thập các bộ sưu tập Ấn Ký.'))
            .addSubcommand(sub => sub.setName('trade')
            .setDescription('Tặng (giao dịch) một Ấn Ký chưa khóa cho đạo hữu khác (chỉ 1 lần duy nhất).')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID Ấn Ký muốn tặng').setRequired(true))
            .addUserOption(opt => opt.setName('user').setDescription('Đạo hữu nhận Ấn Ký').setRequired(true))));
    }
    async execute(client, interaction) {
        const discordId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(discordId);
        if (!user) {
            await interaction.editReply({
                content: '❌ Đạo hữu chưa khởi tạo nhân vật. Hãy sử dụng lệnh \`/taonhanvat\` để bắt đầu!'
            });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'danhsach') {
            const embed = buildImprintListEmbed(discordId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (sub === 'anky') {
            const targetId = interaction.options.getInteger('id');
            if (targetId) {
                // Thực hiện ấn ký trực tiếp
                const result = SoulImprintService_1.soulImprintService.imprintItem(discordId, targetId);
                if (result.success) {
                    await interaction.editReply({ content: result.message });
                }
                else {
                    await interaction.editReply({ content: `❌ ${result.message}` });
                }
            }
            else {
                // Hiển thị danh sách các món đủ điều kiện để chọn qua dropdown
                const userInventory = InventoryRepository_1.inventoryRepository.getUserInventory(discordId);
                const candidates = userInventory.filter(item => item.equipable === 1 && item.is_equipped === 0 && item.stars === 5);
                if (candidates.length === 0) {
                    await interaction.editReply({
                        content: '❌ Đạo hữu không có trang bị nào đạt **5 Sao** (và chưa trang bị) trong túi đồ để tiến hành Ấn Ký Linh Hồn!'
                    });
                    return;
                }
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`anky_select_${discordId}`)
                    .setPlaceholder('🔮 Chọn trang bị 5 Sao để tiến hành Ấn Ký...');
                candidates.forEach(c => {
                    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`${c.name} (+${c.enhance_level})`)
                        .setDescription(`Rarity: ${c.rarity.toUpperCase()} | ID: #${c.id}`)
                        .setValue(c.id.toString()));
                });
                const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({ components: [(0, uiSystem_1.textToV2)('🧘 **Đúc Luyện Ấn Ký Linh Hồn**\n*Hãy chọn một trang bị 5 Sao bên dưới để tiêu hủy và lưu giữ chỉ số vĩnh viễn (Chi phí: 5,000 LT + 10 Mảnh Trang Bị):*'), row], flags: discord_js_1.MessageFlags.IsComponentsV2 });
            }
        }
        else if (sub === 'bo-suu-tap') {
            const userImprints = SoulImprintRepository_1.soulImprintRepository.getUserImprints(discordId);
            const collectedIds = new Set(userImprints.map(i => i.item_id));
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`📖 SỔ TAY THU THẬP ẤN KÝ - ${user.name}`)
                .setColor(uiSystem_1.EMBED_COLORS.ORANGE)
                .setDescription('*Thu thập đủ các loại trang bị trong từng bộ sưu tập Ấn Ký để nhận thuộc tính ẩn cực mạnh vĩnh viễn.*')
                .setTimestamp();
            Object.entries(SET_ITEMS).forEach(([groupKey, items]) => {
                const groupName = GROUP_NAMES[groupKey] || groupKey;
                let count = 0;
                const itemLines = items.map(it => {
                    const isCollected = collectedIds.has(it.id);
                    if (isCollected)
                        count++;
                    return `${isCollected ? '🟢' : '❌'} ${it.name}`;
                });
                const bar = (0, constants_1.getProgressBar)(count, items.length, 6);
                embed.addFields({
                    name: `${groupName} (${count}/${items.length})`,
                    value: `${bar}\n${itemLines.join('\n')}`,
                    inline: true
                });
            });
            const setBonuses = SoulImprintService_1.soulImprintService.getSetBonuses(discordId);
            const activeBonuses = [];
            if (setBonuses.atk)
                activeBonuses.push(`• Công kích: **+${setBonuses.atk}**`);
            if (setBonuses.crit)
                activeBonuses.push(`• Bạo kích: **+${(setBonuses.crit * 100).toFixed(1)}%**`);
            if (setBonuses.hasOai)
                activeBonuses.push(`• Kỹ năng: **Oai** (5% Tê Liệt đối thủ)`);
            embed.addFields({
                name: '✨ Thuộc Tính Kích Hoạt Bộ Hiện Tại',
                value: activeBonuses.length > 0 ? activeBonuses.join('\n') : '`Chưa kích hoạt hiệu ứng bộ nào.`',
                inline: false
            });
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (sub === 'trade') {
            const imprintId = interaction.options.getInteger('id', true);
            const targetUser = interaction.options.getUser('user', true);
            const targetUserId = targetUser.id;
            if (targetUserId === discordId) {
                await interaction.editReply({ content: '❌ Đạo hữu không thể tự giao dịch Ấn Ký với bản thân!' });
                return;
            }
            const result = SoulImprintService_1.soulImprintService.tradeImprint(discordId, targetUserId, imprintId);
            if (result.success) {
                await interaction.editReply({ content: result.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }
    }
}
exports.default = AnkyCommand;
