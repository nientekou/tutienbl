"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("../../structures/Command");
const discord_js_1 = require("discord.js");
const DestinyRepository_1 = require("../../database/repositories/DestinyRepository");
const DestinyService_1 = require("../../services/DestinyService");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const constants_1 = require("../../utils/constants");
const destinies_1 = require("../../config/destinies");
class MenhCachCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('menhcach')
            .setDescription('Hệ thống Mệnh Cách - Bốc Quẻ và Trang Bị Bảng Ngọc')
            .addSubcommand(sub => sub.setName('boi-que')
            .setDescription('Bốc quẻ tìm kiếm Mệnh Cách mới (Tiêu tốn Linh Thạch)'))
            .addSubcommand(sub => sub.setName('tu-do')
            .setDescription('Xem túi Mệnh Cách và các khe cắm hiện tại')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Bạn chưa khởi tạo nhân vật. Vui lòng dùng `/taonhanvat`!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'boi-que') {
            const result = DestinyService_1.destinyService.rollGacha(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔮 BÓC QUẺ MỆNH CÁCH')
                .setColor(result.success ? '#9b59b6' : '#e74c3c')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
        else if (sub === 'tu-do') {
            const realmDetails = (0, constants_1.getRealmDetails)(user.level);
            const maxSlots = DestinyService_1.destinyService.getMaxSlotsByRealm(realmDetails.fullName);
            const destinies = DestinyRepository_1.destinyRepository.getUserDestinies(userId);
            const equipped = destinies.filter(d => d.is_equipped === 1);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`☯️ BẢNG MỆNH CÁCH - ${user.name}`)
                .setColor('#2ecc71')
                .setDescription(`Số khe cắm Mệnh Cách tối đa: **${equipped.length}/${maxSlots}** (Tăng theo Cảnh Giới)`)
                .setTimestamp();
            if (maxSlots === 0) {
                embed.addFields({ name: 'Chưa Đủ Cảnh Giới', value: 'Đạo hữu cần đạt tối thiểu Trúc Cơ Kỳ để mở Bảng Mệnh Cách.' });
            }
            else {
                let equippedDesc = '';
                for (let i = 1; i <= maxSlots; i++) {
                    const slotItem = equipped.find(d => d.slot === i);
                    if (slotItem) {
                        const config = destinies_1.DESTINY_TYPES[slotItem.destiny_id];
                        const currentBuff = config.baseValue + (slotItem.level - 1) * config.scalePerLevel;
                        const expNeeded = (0, destinies_1.getDestinyExpNeeded)(slotItem.level, slotItem.rarity);
                        equippedDesc += `**Khe [${i}]**: ${config.icon} **${config.name}** [${slotItem.rarity.toUpperCase()}] - Cấp ${slotItem.level}\n└ Tác dụng: +**${Math.round(currentBuff * 100)}%** ${config.name.split(' ')[0]}\n└ EXP: ${slotItem.exp}/${expNeeded}\n\n`;
                    }
                    else {
                        equippedDesc += `**Khe [${i}]**: 🔲 Trống\n\n`;
                    }
                }
                embed.addFields({ name: '🌟 Đang Trang Bị', value: equippedDesc || 'Trống' });
            }
            embed.setFooter({ text: 'Để trang bị hoặc nâng cấp Mệnh Cách, hãy chọn từ Menu bên dưới.' });
            // Build components
            const components = [];
            const unequipped = destinies.filter(d => d.is_equipped === 0);
            if (maxSlots > 0 && unequipped.length > 0) {
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`destiny_equip_${userId}`)
                    .setPlaceholder('Chọn Mệnh Cách để trang bị...');
                unequipped.slice(0, 25).forEach(d => {
                    const config = destinies_1.DESTINY_TYPES[d.destiny_id];
                    selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`${config.name} (Cấp ${d.level}) - ${d.rarity}`)
                        .setDescription(`Tác dụng: ${config.description}`)
                        .setValue(`equip_${d.id}`));
                });
                components.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
            }
            if (equipped.length > 0) {
                const unequipMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`destiny_unequip_${userId}`)
                    .setPlaceholder('Tháo Mệnh Cách hiện tại...');
                equipped.forEach(d => {
                    const config = destinies_1.DESTINY_TYPES[d.destiny_id];
                    unequipMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                        .setLabel(`Khe [${d.slot}]: ${config.name}`)
                        .setValue(`unequip_${d.slot}`));
                });
                components.push(new discord_js_1.ActionRowBuilder().addComponents(unequipMenu));
            }
            await interaction.reply({ embeds: [embed], components });
        }
    }
}
exports.default = MenhCachCommand;
