"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const AlchemyService_1 = require("../../services/AlchemyService");
const constants_1 = require("../../utils/constants");
const database_1 = __importDefault(require("../../database/database"));
class LuyenDanCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('luyendan')
            .setDescription('Mở phòng Luyện Đan, nấu chế linh đan dược liệu tiên gia.'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        const embed = this.getAlchemyEmbed(userId);
        const rows = this.getAlchemyComponents(userId);
        await interaction.reply({ embeds: [embed], components: rows });
    }
    /**
     * Tạo Embed giao diện Luyện Đan
     */
    getAlchemyEmbed(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        const alchemyLevel = user.alchemy_level || 1;
        const alchemyExp = user.alchemy_exp || 0;
        const expNeeded = alchemyLevel * 100;
        const expBar = (0, constants_1.getProgressBar)(alchemyExp, expNeeded, 10);
        // Lấy chế tác quantity
        let yCanh = {};
        try {
            yCanh = JSON.parse(user.y_canh || '{}');
        }
        catch (e) {
            yCanh = {};
        }
        const craftQty = yCanh.active_craft_quantity || 1;
        // Tìm lò luyện tốt nhất trong hành trang
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const cauldrons = inv.filter(i => i.type === 'cauldron');
        let bestCauldronText = 'Không có lò (dùng tay không, +0% tỷ lệ)';
        let bestCauldron = null;
        if (cauldrons.length > 0) {
            // Ưu tiên: cauldron_high > cauldron_mid > cauldron_low
            const order = ['cauldron_high', 'cauldron_mid', 'cauldron_low'];
            for (const cid of order) {
                bestCauldron = cauldrons.find(i => i.item_id === cid);
                if (bestCauldron)
                    break;
            }
        }
        let successBonus = 0.0;
        if (bestCauldron) {
            try {
                const stats = JSON.parse(bestCauldron.base_stats || bestCauldron.stats || '{}');
                successBonus = stats.success_rate_bonus || 0.0;
                bestCauldronText = `🔥 **${bestCauldron.name}** (+${successBonus * 100}% tỷ lệ thành công)`;
            }
            catch (e) {
                bestCauldronText = `🔥 **${bestCauldron.name}**`;
            }
        }
        // Tông Môn Đan Đường cộng thêm tỷ lệ thành công
        let sectBonus = 0.0;
        if (user.sect_id) {
            try {
                const sect = database_1.default.prepare('SELECT dan_duong_level FROM sects WHERE id = ?').get(user.sect_id);
                if (sect && sect.dan_duong_level) {
                    sectBonus = sect.dan_duong_level * 0.02; // +2% mỗi cấp
                }
            }
            catch (e) { }
        }
        // Cộng hưởng Hỏa Linh Căn
        let hoaLinhCan = 0;
        try {
            const lc = JSON.parse(user.linh_can || '{}');
            hoaLinhCan = lc['Hỏa'] || 0;
        }
        catch (e) { }
        const hoaBonus = hoaLinhCan * 0.001;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🌿 LINH DƯỢC LUYỆN ĐAN PHÒNG 🌿')
            .setColor('#2ecc71')
            .setDescription(`Đạo hữu đang ngự tại phòng luyện chế linh đan.\n` +
            `🏆 **Cấp Luyện Đan Sư:** Cấp **${alchemyLevel}**\n` +
            `${expBar} *(EXP: **${alchemyExp}/${expNeeded}**)*\n\n` +
            `🔋 **Thể Lực Hiện Tại:** **${user.stamina}/500** Stamina\n` +
            `⚙️ **Lò Luyện Sử Dụng:** ${bestCauldronText}\n` +
            `⚡ **Chế Tác Hiện Tại:** **x${craftQty} mẻ** ${craftQty === 2 ? '(Linh Sư / Lò Thượng Phẩm)' : ''}\n\n` +
            `*Chú ý: Hệ thống tự động chọn Lò luyện đan tốt nhất trong hành trang của đạo hữu để tối ưu tỷ lệ luyện thành.*\n` +
            `💡 *Mẹo: Đạo hữu có thể mua Lò Luyện Đan tốt hơn tại Phường Thị (\`/shop danhsach\`) hoặc đổi Chế tác x2.*`)
            .setTimestamp();
        // Liệt kê các công thức
        for (const recipe of AlchemyService_1.ALCHEMY_RECIPES) {
            const matText = recipe.requiredMaterials.map(m => {
                const itemInfo = InventoryRepository_1.inventoryRepository.getUserInventory(userId).find(i => i.item_id === m.itemId);
                const nameMap = {
                    'material_linh_thao_1': 'Linh Thảo Hạ Phẩm',
                    'material_nhan_sam_1': 'Huyết Nhân Sâm',
                    'material_iron_1': 'Huyền Thiết Sa',
                    'item_fragment': 'Mảnh Trang Bị',
                    'material_blood_flower': 'Huyết Hoa',
                    'material_void_herb': 'Hư Không Thảo',
                    'material_wind_leaf': 'Thiên Phong Diệp'
                };
                const name = nameMap[m.itemId] || m.itemId;
                const reqQty = m.quantity * craftQty;
                const hasEnoughMat = itemInfo && itemInfo.quantity >= reqQty;
                const statusEmoji = hasEnoughMat ? '✅' : '❌';
                return `${statusEmoji} ${name}: **${itemInfo ? itemInfo.quantity : 0}/${reqQty}**`;
            }).join('\n');
            const isLocked = alchemyLevel < recipe.requiredAlchemyLevel;
            let rateText = '';
            if (isLocked) {
                rateText = '🔒 *Chưa đủ cấp luyện chế*';
            }
            else {
                const levelDiff = Math.max(0, alchemyLevel - recipe.requiredAlchemyLevel);
                const levelBonus = levelDiff * 0.02;
                const finalSuccessRate = Math.min(0.95, recipe.baseSuccessRate + successBonus + levelBonus + sectBonus + hoaBonus);
                const rateBar = (0, constants_1.getProgressBar)(Math.round(finalSuccessRate * 100), 100, 10);
                let costCoinText = `${recipe.costCoin}`;
                let staminaCostText = `${recipe.staminaCost}`;
                if (craftQty === 2) {
                    costCoinText = `${recipe.costCoin * 2} *(x2)*`;
                    staminaCostText = `${recipe.staminaCost * 2} *(x2)*`;
                }
                rateText = `⚡ Tỷ lệ thành công thực tế: **${Math.round(finalSuccessRate * 100)}%**\n${rateBar}\n` +
                    `*(Gốc: ${recipe.baseSuccessRate * 100}% | Lò: +${successBonus * 100}% | Cấp: +${Math.round(levelBonus * 100)}% | Tông Môn: +${Math.round(sectBonus * 100)}% | Hỏa Căn: +${(hoaBonus * 100).toFixed(1)}%)*\n` +
                    `🔋 Tiêu hao: **${staminaCostText}** Thể lực | 🪙 Phí: **${costCoinText}** Linh thạch`;
            }
            embed.addFields({
                name: `🔮 Công Thức: ${recipe.name} (Yêu cầu cấp: ${recipe.requiredAlchemyLevel})`,
                value: `${matText}\n${rateText}`,
                inline: false
            });
        }
        return embed;
    }
    /**
     * Tạo Action Row nút bấm luyện đan
     */
    getAlchemyComponents(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        const alchemyLevel = user.alchemy_level || 1;
        let yCanh = {};
        try {
            yCanh = JSON.parse(user.y_canh || '{}');
        }
        catch (e) {
            yCanh = {};
        }
        const craftQty = yCanh.active_craft_quantity || 1;
        const rows = [];
        // Row 1: Toggle Quantity button
        const rowQty = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`alch_toggleqty_${userId}`)
            .setLabel(`Chế tác: x${craftQty} mẻ ${craftQty === 2 ? '🔥' : '⏳'}`)
            .setStyle(craftQty === 2 ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Primary));
        rows.push(rowQty);
        // Row 2 and 3: Recipe buttons (5 buttons per row max)
        let currentRow = new discord_js_1.ActionRowBuilder();
        let btnCount = 0;
        for (const recipe of AlchemyService_1.ALCHEMY_RECIPES) {
            if (btnCount > 0 && btnCount % 5 === 0) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
            }
            const isLocked = alchemyLevel < recipe.requiredAlchemyLevel;
            currentRow.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`alch_craft_${recipe.id}_${userId}`)
                .setLabel(`Nấu ${recipe.name}`)
                .setStyle(isLocked ? discord_js_1.ButtonStyle.Secondary : discord_js_1.ButtonStyle.Success)
                .setDisabled(isLocked));
            btnCount++;
        }
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }
        return rows;
    }
}
exports.default = LuyenDanCommand;
