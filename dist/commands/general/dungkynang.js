"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const database_1 = __importDefault(require("../../database/database"));
class DungKyNangCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('dungkynang')
            .setDescription('Sử dụng bí tịch sách kỹ năng để lĩnh ngộ pháp quyết.')
            .addStringOption(opt => opt
            .setName('item_id')
            .setDescription('Mã sách kỹ năng muốn học (ví dụ: book_fire, book_lightning...)')
            .setRequired(false)));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const bookId = interaction.options.getString('item_id');
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
            return;
        }
        if (bookId) {
            const result = DungKyNangCommand.learnSkill(userId, bookId);
            if (!result.success) {
                await interaction.reply({ content: result.message, ephemeral: true });
                return;
            }
            await interaction.reply({ embeds: [result.embed] });
            return;
        }
        // Nếu không truyền bookId, tìm tất cả sách kỹ năng trong túi đồ
        const inventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const books = inventory.filter(i => i.type === 'book' && i.is_equipped === 0);
        if (books.length === 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✨ TÀNG THƯ ĐIỆN — KHAI NGÔ BÍ TỊCH ✨')
                .setColor('#e74c3c')
                .setDescription(`❌ Đạo hữu **${user.name}** không sở hữu bất kỳ bí tịch sách kỹ năng nào trong hành trang có thể bế quan học tập!\n\n` +
                `💡 *Đạo hữu có thể thu thập sách kỹ năng qua các cách sau:*\n` +
                `• Dùng Điểm Cống Hiến để đổi tại **Tiệm Kỹ Năng Tông Môn**.\n` +
                `• Thử vận khí khi **Săn Yêu Thú Dã Ngoại** hoặc khám phá **Rương Cơ Duyên**.\n` +
                `• Mua bán trao đổi với các đạo hữu khác thông qua **Chợ Trời**.`)
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('✨ TÀNG THƯ ĐIỆN — KHAI NGÔ BÍ TỊCH ✨')
            .setColor('#9b59b6')
            .setDescription(`Chào mừng đạo hữu **${user.name}** đã ghé thăm Tàng Thư Điện!\n` +
            `Nơi đây cất giữ các bí pháp thất truyền, hỗ trợ đạo hữu dung hợp nguyên thần với thiên địa đạo pháp.\n\n` +
            `🧘 *Vui lòng chọn bí tịch cổ thư muốn đọc hiểu để lĩnh ngộ chiêu thức:*`)
            .setFooter({ text: 'Mỗi cuốn bí tịch chỉ lĩnh ngộ được 1 lần và sẽ tiêu hao sau khi sử dụng.' })
            .setTimestamp();
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`dungkynang_select_${userId}`)
            .setPlaceholder('Chọn sách kỹ năng muốn học...');
        const skillNames = {
            book_fire: 'Liệt Diễm Quyết 🔥',
            book_water: 'Thủy Linh Quyết 💧',
            book_wood: 'Hấp Huyết Quyết 🌿',
            book_earth: 'Thổ Giáp Quyết 🪨',
            book_lightning: 'Lôi Phạt Quyết ⚡',
            book_wind: 'Phong Hành Quyết 🌀'
        };
        books.forEach(book => {
            const targetSkillName = skillNames[book.item_id] || 'Pháp quyết cổ đại';
            selectMenu.addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(`${book.name} (Số lượng: ${book.quantity})`)
                .setDescription(`Học kỹ năng: ${targetSkillName}`)
                .setValue(book.item_id));
        });
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        const cancelBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`dungkynang_cancel_${userId}`)
            .setLabel('Hủy Bỏ')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const rowButton = new discord_js_1.ActionRowBuilder().addComponents(cancelBtn);
        await interaction.reply({ embeds: [embed], components: [row, rowButton] });
    }
    /**
     * Logic bế quan lĩnh ngộ kỹ năng từ sách
     */
    static learnSkill(userId, bookId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: '❌ Đạo hữu chưa tạo nhân vật!' };
        const inventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const bookItem = inventory.find(i => i.item_id === bookId && i.is_equipped === 0);
        if (!bookItem) {
            return { success: false, message: `❌ Đạo hữu không có sách kỹ năng này trong túi đồ!` };
        }
        if (bookItem.type !== 'book') {
            return { success: false, message: `❌ Vật phẩm này không phải sách kỹ năng, không thể lĩnh ngộ học tập!` };
        }
        // Lấy skill_id từ thông tin stats
        let skillId = '';
        try {
            const stats = JSON.parse(bookItem.base_stats || '{}');
            skillId = stats.skill_id;
        }
        catch (e) { }
        if (!skillId) {
            return { success: false, message: `❌ Bản cổ tịch này rách nát tơi tả, không ghi chép pháp quyết hoàn chỉnh nào!` };
        }
        // Kiểm tra xem đã học chưa
        const learned = database_1.default.prepare('SELECT skill_id FROM user_skills WHERE user_id = ? AND skill_id = ?')
            .get(userId, skillId);
        if (learned) {
            return { success: false, message: `❌ Đạo hữu đã lĩnh ngộ kỹ năng này rồi, không thể học đè!` };
        }
        // Học kỹ năng
        const learnTx = database_1.default.transaction(() => {
            database_1.default.prepare('INSERT INTO user_skills (user_id, skill_id, level, is_equipped, equipped_slot) VALUES (?, ?, 1, 0, 0)')
                .run(userId, skillId);
            InventoryRepository_1.inventoryRepository.removeItem(userId, bookId, 1);
        });
        learnTx();
        const skillNames = {
            skill_fire: 'Liệt Diễm Quyết 🔥',
            skill_water: 'Thủy Linh Quyết 💧',
            skill_wood: 'Hấp Huyết Quyết 🌿',
            skill_earth: 'Thổ Giáp Quyết 🪨',
            skill_lightning: 'Lôi Phạt Quyết ⚡',
            skill_wind: 'Phong Hành Quyết 🌀'
        };
        const skillName = skillNames[skillId] || skillId;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('✨ ĐẠO PHÁP THỨC TỈNH ✨')
            .setColor('#9b59b6')
            .setDescription(`🎉 Chúc mừng đạo hữu **${user.name}** đã bế quan đọc hiểu thành công cuốn **${bookItem.name}**!\n\n` +
            `📖 Đạo hữu lĩnh ngộ được kỹ năng chiến đấu mới: **${skillName}**!\n` +
            `📌 Sử dụng lệnh \`/kynang\` để quản lý và trang bị kỹ năng này vào danh sách chiêu thức chiến đấu.`)
            .setTimestamp();
        return { success: true, message: `Đạo hữu bế quan đọc hiểu thành công cuốn **${bookItem.name}**, lĩnh ngộ được kỹ năng **${skillName}**!`, embed };
    }
}
exports.default = DungKyNangCommand;
