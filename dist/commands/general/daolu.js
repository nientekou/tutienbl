"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const CoupleRepository_1 = require("../../database/repositories/CoupleRepository");
const CoupleService_1 = require("../../services/CoupleService");
const constants_1 = require("../../utils/constants");
class DaoLuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('daolu')
            .setDescription('Hệ thống Đạo Lữ & Song Tu')
            .addSubcommand(sub => sub.setName('thongtin')
            .setDescription('Xem thông tin Đạo Lữ của bạn'))
            .addSubcommand(sub => sub.setName('cau-hon')
            .setDescription('Cầu hôn một người chơi khác')
            .addUserOption(opt => opt.setName('nguoi_choi').setDescription('Người bạn muốn cầu hôn').setRequired(true)))
            .addSubcommand(sub => sub.setName('song-tu')
            .setDescription('Tiến hành Song Tu cùng Đạo Lữ'))
            .addSubcommand(sub => sub.setName('tang-qua')
            .setDescription('Tặng quà để tăng hảo cảm')
            .addIntegerOption(opt => opt.setName('so_luong').setDescription('Số lượng Quà (Tốn Linh Thạch)').setRequired(true))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'thongtin') {
            const couple = CoupleRepository_1.coupleRepository.getCoupleByUserId(userId);
            if (!couple) {
                await interaction.reply({ content: '💔 Đạo hữu hiện đang độc thân vui tính!', ephemeral: true });
                return;
            }
            const partnerId = couple.user1_id === userId ? couple.user2_id : couple.user1_id;
            const partner = UserRepository_1.userRepository.get(partnerId);
            const intimacyBar = (0, constants_1.getProgressBar)(couple.intimacy, 2000, 10);
            const anniversaryMsg = CoupleService_1.coupleService.checkAnniversaryOnInfo(couple.id);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('💞 HỒ SƠ ĐẠO LỮ 💞')
                .setColor('#ff69b4')
                .addFields({ name: 'Đạo Lữ', value: `**${user.name}** 💍 **${partner ? partner.name : 'Vô Danh'}**`, inline: false }, { name: 'Độ Hảo Cảm', value: `💖 **${couple.intimacy}** điểm\n${intimacyBar}\n*(Buff: +${Math.min(20, Math.floor(couple.intimacy / 100))}% Công & Máu)*`, inline: true }, { name: 'Ngày thành hôn', value: `<t:${couple.marriage_date}:D>`, inline: true })
                .setFooter({ text: 'Dùng /daolu song-tu mỗi ngày để nhận Tu Vi!' });
            if (anniversaryMsg) {
                embed.setDescription(anniversaryMsg);
            }
            await interaction.reply({ embeds: [embed] });
        }
        else if (sub === 'cau-hon') {
            const target = interaction.options.getUser('nguoi_choi', true);
            if (target.id === userId) {
                await interaction.reply({ content: '❌ Không thể tự cầu hôn chính mình!', ephemeral: true });
                return;
            }
            if (target.bot) {
                await interaction.reply({ content: '❌ Không thể cầu hôn Bot!', ephemeral: true });
                return;
            }
            const targetUser = UserRepository_1.userRepository.get(target.id);
            if (!targetUser) {
                await interaction.reply({ content: '❌ Người này chưa tu tiên!', ephemeral: true });
                return;
            }
            const myCouple = CoupleRepository_1.coupleRepository.getCoupleByUserId(userId);
            if (myCouple) {
                await interaction.reply({ content: '❌ Đạo hữu đã có Đạo Lữ rồi! Cấm ngoại tình!', ephemeral: true });
                return;
            }
            const targetCouple = CoupleRepository_1.coupleRepository.getCoupleByUserId(target.id);
            if (targetCouple) {
                await interaction.reply({ content: '❌ Người ta đã có chủ rồi! Xin tự trọng!', ephemeral: true });
                return;
            }
            // Kiểm tra nhẫn đính hôn
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
            const ring = inv.find(i => i.item_id === 'item_nhan_dinh_hon');
            if (!ring || ring.quantity < 1) {
                await interaction.reply({ content: '❌ Đạo hữu không có **Nhẫn Đính Hôn** (Mua trong Cửa Hàng giá 500,000 LT)!', ephemeral: true });
                return;
            }
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('accept_marriage').setLabel('Đồng ý').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('decline_marriage').setLabel('Từ chối').setStyle(discord_js_1.ButtonStyle.Danger));
            const msg = await interaction.reply({
                content: `💍 <@${target.id}>, đạo hữu **${user.name}** muốn kết thành Đạo Lữ cùng bạn! Bạn có đồng ý không?`,
                components: [row],
                fetchReply: true
            });
            const collector = msg.createMessageComponentCollector({ componentType: discord_js_1.ComponentType.Button, time: 60000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== target.id) {
                    await i.reply({ content: '❌ Bạn không phải là người được cầu hôn!', ephemeral: true });
                    return;
                }
                if (i.customId === 'accept_marriage') {
                    // Trừ nhẫn
                    InventoryRepository_1.inventoryRepository.removeItem(userId, 'item_nhan_dinh_hon', 1);
                    CoupleRepository_1.coupleRepository.createCouple(userId, target.id);
                    // Đồng bộ sang bảng users
                    UserRepository_1.userRepository.update(userId, { partner_id: target.id, intimacy: 100 });
                    UserRepository_1.userRepository.update(target.id, { partner_id: userId, intimacy: 100 });
                    await i.update({ content: `🎉 Chúc mừng **${user.name}** và **${targetUser.name}** đã kết bái thành Đạo Lữ! 💖`, components: [] });
                }
                else {
                    await i.update({ content: `💔 **${targetUser.name}** đã từ chối lời cầu hôn của **${user.name}**.`, components: [] });
                }
            });
            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: `⏳ Quá thời gian, lời cầu hôn đã bị hủy.`, components: [] }).catch(() => { });
                }
            });
        }
        else if (sub === 'song-tu') {
            const couple = CoupleRepository_1.coupleRepository.getCoupleByUserId(userId);
            if (!couple) {
                await interaction.reply({ content: '❌ Đạo hữu chưa có Đạo Lữ!', ephemeral: true });
                return;
            }
            const result = CoupleService_1.coupleService.dualCultivate(couple.id);
            await interaction.reply({ content: result.message });
        }
        else if (sub === 'tang-qua') {
            const amount = interaction.options.getInteger('so_luong', true);
            if (amount <= 0) {
                await interaction.reply({ content: '❌ Số lượng phải lớn hơn 0!', ephemeral: true });
                return;
            }
            const couple = CoupleRepository_1.coupleRepository.getCoupleByUserId(userId);
            if (!couple) {
                await interaction.reply({ content: '❌ Đạo hữu chưa có Đạo Lữ!', ephemeral: true });
                return;
            }
            // 1 Quà = 1000 Linh Thạch = 1 Hảo cảm
            const cost = amount * 1000;
            if (user.coin_ha_pham < cost) {
                await interaction.reply({ content: `❌ Không đủ Linh Thạch! Cần **${cost}** LT để tặng ${amount} món quà.`, ephemeral: true });
                return;
            }
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });
            const result = CoupleService_1.coupleService.giveGift(couple.id, amount);
            await interaction.reply({ content: result.message });
        }
    }
}
exports.default = DaoLuCommand;
