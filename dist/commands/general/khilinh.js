"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpiritListEmbed = getSpiritListEmbed;
exports.getSpiritListComponents = getSpiritListComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const SpiritWeaponService_1 = require("../../services/SpiritWeaponService");
const database_1 = __importDefault(require("../../database/database"));
const constants_1 = require("../../utils/constants");
const uiSystem_1 = require("../../utils/uiSystem");
const ITEMS_PER_PAGE = 5;
function getSpiritListEmbed(userId, user, spiritWeapons, page) {
    const totalPages = Math.max(Math.ceil(spiritWeapons.length / ITEMS_PER_PAGE), 1);
    const cappedPage = Math.min(Math.max(page, 1), totalPages);
    const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
    const pageItems = spiritWeapons.slice(offset, offset + ITEMS_PER_PAGE);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('⚡ Danh Sách Khí Linh Sở Hữu')
        .setColor(uiSystem_1.EMBED_COLORS.DARK_PURPLE)
        .setDescription(spiritWeapons.length > ITEMS_PER_PAGE ? `*Trang ${cappedPage}/${totalPages} (${spiritWeapons.length} khí linh)*` : null)
        .setTimestamp();
    for (const sw of pageItems) {
        const itemInfo = database_1.default.prepare('SELECT name, rarity FROM items WHERE id = ?').get(sw.item_id);
        const expBar = (0, constants_1.getProgressBar)(sw.exp, sw.level * 50);
        const affinityBar = '❤️'.repeat(Math.min(Math.floor(sw.affinity / 20), 5)) + '🖤'.repeat(Math.max(0, 5 - Math.floor(sw.affinity / 20)));
        embed.addFields({
            name: `🔮 ${sw.spirit_name} (#${sw.id})`,
            value: `• **Pháp Bảo ký chủ:** **${itemInfo?.name || sw.item_id}** [${itemInfo?.rarity.toUpperCase() || 'KHÔNG RÕ'}]\n` +
                `• **Cấp độ:** Cấp **${sw.level}** (EXP: ${expBar} - ${sw.exp}/${sw.level * 50})\n` +
                `• **Thân mật:** ${affinityBar} (${sw.affinity}/100)\n` +
                `• **Kỹ năng:** **${sw.skill_id || 'Chưa thức tỉnh'}**`
        });
    }
    return { embed, totalPages };
}
function getSpiritListComponents(userId, page, totalPages) {
    if (totalPages <= 1)
        return [];
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder().setCustomId(`spiritprev_${page}_${userId}`).setEmoji('◀').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page <= 1), new discord_js_1.ButtonBuilder().setCustomId(`spiritnext_${page}_${userId}`).setEmoji('▶').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page >= totalPages));
    return [row];
}
class KhiLinhCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('khilinh')
            .setDescription('Quản lý Khí Linh (Spirit Weapon).')
            .addSubcommand(sub => sub
            .setName('thuctinh')
            .setDescription('Thức tỉnh khí linh cho pháp bảo (Yêu cầu vũ khí Epic trở lên)')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('ID vật phẩm trong hành trang').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('nuoiduong')
            .setDescription('Cho khí linh ăn trang bị hoặc nguyên liệu tăng EXP')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID khí linh (xem trong /khilinh)').setRequired(true))
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('ID vật phẩm trong hành trang (xem trong /hoso)').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng hiến tế').setRequired(false)))
            .addSubcommand(sub => sub
            .setName('tuongtac')
            .setDescription('Trò chuyện với khí linh để tăng độ thân thiết')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID khí linh (xem trong /khilinh)').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('kynang')
            .setDescription('Xem thông tin và kỹ năng của Khí Linh')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID khí linh (xem trong /khilinh)').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('tienhoa')
            .setDescription('Tiến hóa khí linh đạt cấp 20')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID khí linh (xem trong /khilinh)').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('danhsach')
            .setDescription('Xem danh sách tất cả Khí Linh đang sở hữu')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const subcmd = interaction.options.getSubcommand(true);
        if (subcmd === 'thuctinh') {
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const invItem = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invItem || invItem.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const res = SpiritWeaponService_1.spiritWeaponService.awaken(userId, invItem.id);
            if (!res.success) {
                await interaction.editReply({ content: `❌ ${res.message}` });
                return;
            }
            const spirit = res.spirit;
            const itemInfo = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(spirit.item_id);
            const skill = spirit.skill_id ? SpiritWeaponService_1.spiritWeaponService.getSkill(spirit.skill_id) : null;
            const expBar = (0, constants_1.getProgressBar)(spirit.exp, spirit.level * 50);
            const affinityBar = (0, constants_1.getProgressBar)(spirit.affinity, 100);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✨ THỨC TỈNH KHÍ LINH THÀNH CÔNG!')
                .setColor(uiSystem_1.EMBED_COLORS.DARK_PURPLE)
                .setDescription(`*Từ trong thần phong sắc bén của pháp bảo, một tia linh trí bỗng chốc thức tỉnh...*\n\n` +
                `🔮 **Khí Linh:** **${spirit.spirit_name}** (#${spirit.id})\n` +
                `⚔️ **Ký Chủ Pháp Bảo:** **${itemInfo?.name || spirit.item_id}** [${itemInfo?.rarity.toUpperCase()}]\n` +
                `⚡ **Cấp Độ:** Cấp **${spirit.level}**\n` +
                `   └ Tiến trình EXP: ${expBar} *(${spirit.exp}/${spirit.level * 50} EXP)*\n` +
                `❤️ **Độ Thân Thiết:** ${affinityBar} *(${spirit.affinity}/100)*\n`)
                .addFields({
                name: '🔮 Kỹ Năng Bản Mệnh Ngộ Ra',
                value: skill
                    ? `**${skill.name}**\n└ *${skill.description}*`
                    : '*Chưa ngộ ra kỹ năng nào.*'
            })
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'nuoiduong') {
            const spiritId = interaction.options.getInteger('spirit_id', true);
            const inventoryId = interaction.options.getInteger('inventory_id', true);
            const qty = interaction.options.getInteger('soluong') || 1;
            const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
            if (!spirit) {
                await interaction.editReply({ content: `❌ Không tìm thấy khí linh ID **${spiritId}**!` });
                return;
            }
            const invItem = InventoryRepository_1.inventoryRepository.get(inventoryId);
            if (!invItem || invItem.user_id !== userId) {
                await interaction.editReply({ content: `❌ Không tìm thấy vật phẩm ID **${inventoryId}** trong túi đồ!` });
                return;
            }
            const res = SpiritWeaponService_1.spiritWeaponService.feedSpirit(userId, spirit.id, invItem.id, qty);
            if (!res.success) {
                await interaction.editReply({ content: `❌ ${res.message}` });
                return;
            }
            const expBar = (0, constants_1.getProgressBar)(res.remainingExp || 0, res.expNeeded || 50);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🍽️ NUÔI DƯỠNG KHÍ LINH')
                .setColor(uiSystem_1.EMBED_COLORS.ORANGE)
                .setDescription(`**${res.spiritName}** hấp thụ nguyên liệu **${res.materialName}**, nhận thêm **+${res.expGain}** EXP!\n\n` +
                `⚡ **Cấp Độ:** Cấp **${res.newLevel}** ${res.leveledUp ? ' ⬆️ **[THĂNG CẤP!]**' : ''}\n` +
                `   └ Tiến trình EXP: ${expBar} *(${res.remainingExp}/${res.expNeeded} EXP)*\n`)
                .setTimestamp();
            if (res.newSkillName) {
                embed.addFields({
                    name: '✨ Kỹ Năng Mới Lĩnh Ngộ!',
                    value: `🔮 Khí linh bừng tỉnh thần thông, ngộ được kỹ năng: **${res.newSkillName}**`
                });
            }
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'tuongtac') {
            const spiritId = interaction.options.getInteger('spirit_id', true);
            const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
            if (!spirit) {
                await interaction.editReply({ content: `❌ Không tìm thấy khí linh ID **${spiritId}**!` });
                return;
            }
            const res = SpiritWeaponService_1.spiritWeaponService.interact(userId, spirit.id);
            if (!res.success) {
                await interaction.editReply({ content: `❌ ${res.message}` });
                return;
            }
            const affinityBar = (0, constants_1.getProgressBar)(res.newAffinity || 0, 100);
            const dialogues = [
                `"Đạo hữu, ta cảm nhận được mối liên kết thần thức giữa chúng ta ngày càng bền chặt..."`,
                `"Linh lực của đạo hữu làm ấm áp khí cốt của ta. Cảm ơn đạo hữu!"`,
                `"Mỗi lần trò chuyện cùng ngươi, ta lại nhớ về linh khí hồng hoang thủa xưa..."`,
                `"Chỉ cần đạo hữu cần, ta nguyện làm mũi kiếm đi tiên phong!"`
            ];
            const quote = dialogues[Math.floor(Math.random() * dialogues.length)];
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('💬 TƯƠNG TÁC KHÍ LINH')
                .setColor(uiSystem_1.EMBED_COLORS.ROMANCE)
                .setDescription(`*Đạo hữu mở ra linh thức, ôn nhu đàm đạo cùng khí linh của pháp bảo...*\n\n` +
                `💬 **${res.spiritName}:**\n*${quote}*\n\n` +
                `❤️ **Độ Thân Thiết:** ${affinityBar} *(+${res.affinityGain} | ${res.newAffinity}/100)*`)
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'tienhoa') {
            const spiritId = interaction.options.getInteger('spirit_id', true);
            const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
            if (!spirit) {
                await interaction.editReply({ content: `❌ Không tìm thấy khí linh ID **${spiritId}**!` });
                return;
            }
            const res = SpiritWeaponService_1.spiritWeaponService.evolve(userId, spirit.id);
            if (!res.success) {
                await interaction.editReply({ content: `❌ ${res.message}` });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🐉 KHÍ LINH TIẾN HÓA THÀNH CÔNG!')
                .setColor(uiSystem_1.EMBED_COLORS.MYSTIC)
                .setDescription(`*Thiên địa bỗng hiện ngũ sắc tường vân, linh khí bàng bạc hội tụ giáng xuống pháp bảo...*\n\n` +
                `🔥 Khí linh **${res.oldName}** đã lột xác niết bàn, tiến hóa thăng hoa thành:\n` +
                `✨ 👉 **${res.newName}** 👈 ✨\n\n` +
                `*Phong ấn sức mạnh tối cổ đã được giải trừ, khí lực bừng bừng bộc phát!*`)
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'kynang') {
            const spiritId = interaction.options.getInteger('spirit_id', true);
            const spirit = database_1.default.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId);
            if (!spirit) {
                await interaction.editReply({ content: '❌ Khí linh không tồn tại!' });
                return;
            }
            const itemInfo = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(spirit.item_id);
            const skill = spirit.skill_id ? SpiritWeaponService_1.spiritWeaponService.getSkill(spirit.skill_id) : null;
            const expBar = (0, constants_1.getProgressBar)(spirit.exp, spirit.level * 50);
            const affinityBar = (0, constants_1.getProgressBar)(spirit.affinity, 100);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`✨ Thông Tin Khí Linh: ${spirit.spirit_name} (#${spirit.id})`)
                .setColor(uiSystem_1.EMBED_COLORS.DARK_PURPLE)
                .setDescription(`⚔️ **Pháp Bảo Ký Chủ:** **${itemInfo?.name || spirit.item_id}** [${itemInfo?.rarity.toUpperCase()}]\n\n` +
                `⚡ **Cấp Độ:** Cấp **${spirit.level}**\n` +
                `   └ Tiến trình EXP: ${expBar} *(${spirit.exp}/${spirit.level * 50} EXP)*\n\n` +
                `❤️ **Độ Thân Thiết:** ${affinityBar} *(${spirit.affinity}/100)*\n`)
                .addFields({
                name: '🔮 Kỹ Năng Kế Thừa Bản Mệnh',
                value: skill
                    ? `**${skill.name}**\n└ *${skill.description}*`
                    : '*Khí linh này hiện chưa ngộ ra kỹ năng nào.*'
            }, {
                name: '🍖 Thức Ăn Thức Tỉnh & Nuôi Dưỡng',
                value: '• **Common (Thường):** +10 EXP\n' +
                    '• **Uncommon (Nhã):** +20 EXP\n' +
                    '• **Rare (Tốt):** +35 EXP\n' +
                    '• **Epic (Kỷ Vật):** +60 EXP\n' +
                    '• **Legendary (Truyền Thuyết):** +100 EXP\n' +
                    '*Khí linh có thể nuốt các loại khoáng sản, linh thạch, tinh thạch, linh thảo hoặc trang bị không dùng.*'
            })
                .setTimestamp();
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        else if (subcmd === 'danhsach') {
            const spiritWeapons = SpiritWeaponService_1.spiritWeaponService.getSpiritWeapons(userId);
            if (spiritWeapons.length === 0) {
                await interaction.editReply({
                    content: '🍃 Đạo hữu hiện chưa thức tỉnh Khí Linh nào. Hãy dùng `/khilinh thuctinh [mã_trang_bi]` trên trang bị phẩm chất Epic trở lên!'
                });
                return;
            }
            const { embed, totalPages } = getSpiritListEmbed(userId, user, spiritWeapons, 1);
            const components = getSpiritListComponents(userId, 1, totalPages);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed], components));
        }
    }
}
exports.default = KhiLinhCommand;
