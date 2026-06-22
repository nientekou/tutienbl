"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PET_SKILLS = void 0;
exports.getSungThuEmbed = getSungThuEmbed;
exports.getSungThuComponents = getSungThuComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const AchievementService_1 = require("../../services/AchievementService");
const sanyeuthu_1 = require("./sanyeuthu");
const constants_1 = require("../../utils/constants");
const database_1 = __importDefault(require("../../database/database"));
// Định nghĩa kỹ năng linh thú
exports.PET_SKILLS = {
    crit_bite: { name: 'Cắn Chí Mạng', emoji: '🖥️', description: 'Tăng 3% tỷ lệ bão kích khi trợ chiến.', minLevel: 5 },
    speed_boost: { name: 'Phóng Xuất Bạo Phát', emoji: '⚡', description: 'Tăng 10% tốc độ chủ nhân khi xuất chiến.', minLevel: 8 },
    def_aura: { name: 'Hộ Thể Linh Quang', emoji: '🛡️', description: 'Giảm 5% sát thương nhận vào khi linh thú đang xuất chiến.', minLevel: 10 },
    healing: { name: 'Liều Lực Thánh Thư', emoji: '💦', description: 'Sau mỗi lượt chiến, hồi phục 2% HP tối đa cho chủ nhân.', minLevel: 12 },
    lucky: { name: 'Thiên Xích May Mắn', emoji: '🍀', description: 'Tăng +5 May Mắn khi liên tục được phái cùng đánh boss.', minLevel: 15 },
    gold_blessing: { name: 'Kim Nguyên Hộ Trì', emoji: '💰', description: 'Tăng +10% Linh Thạch nhận được sau mỗi trận đấu dã ngoại.', minLevel: 1 },
    reborn_flame: { name: 'Nirvana Chi Hỏa', emoji: '🔥', description: 'Hồi phục khẩn cấp +25% HP tối đa cho chủ nhân khi lượng HP xuống dưới 20% (mỗi trận 1 lần).', minLevel: 1 },
    qilin_fortune: { name: 'Kỳ Lân Tường Thụy', emoji: '🦄', description: 'Tăng cát tường cát khí: +15 May Mắn và +5% Né Tránh cho chủ nhân khi xuất chiến.', minLevel: 1 },
    qilin_heal: { name: 'Bạch Ngọc Hồi Xuân', emoji: '💚', description: 'Tăng 15% hiệu quả hồi máu cho chủ nhân, tịnh hóa 1 debuff mỗi hiệp.', minLevel: 1 },
    kunpen_hp: { name: 'Côn Bằng Pháp Thân', emoji: '💜', description: 'Buff +20% HP tối đa cho chủ nhân, kèm AoE hút MP kẻ địch mỗi hiệp.', minLevel: 1 },
    taotie_def: { name: 'Thao Thiết Hộ Thể', emoji: '🛡️', description: 'Giảm 10% sát thương nhận vào, phong tỏa Tâm Pháp đối thủ 2 hiệp.', minLevel: 1 },
    dragon_berserk: { name: 'Long Huyết Cuồng Bạo', emoji: '🐉', description: '+20% ATK khi HP chủ nhân dưới 30%, kích hoạt Long Hút hồi phục 5% HP mỗi hiệp.', minLevel: 1 },
    phoenix_rebirth: { name: 'Phượng Hoàng Tái Sinh', emoji: '🔥', description: 'Miễn dịch Ngộ Độc, Tái Sinh 1 lần/trận với 30% HP khi tử vong.', minLevel: 1 },
    sky_agile: { name: 'Cửu Thiên Phong Tốc', emoji: '💨', description: '+8% tốc độ đánh và +8% né tránh cho chủ nhân khi xuất chiến.', minLevel: 1 },
    nine_charm: { name: 'Hồn Mê Chỉ Pháp', emoji: '🌸', description: '+10% né tránh, gây mê 1 hiệp lên kẻ địch khi bị tấn công.', minLevel: 1 },
};
// === Helper functions for button handlers ===
function getSungThuEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const pets = database_1.default.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🐾 LINH THÚ CÁC - ${user?.name || 'Không xác định'}`)
        .setColor('#1abc9c')
        .setDescription('Sủng thú trợ chiến giúp tăng sát thương khi công kích Boss Thế Giới và vượt phó bản Bí Cảnh.\n\n👯‍♂️ **Thiết Lập:** Dùng `/sungthu xuatchien` để phái xuất chiến | `/sungthu thuctinhkynang` để thức tỉnh kỹ năng | `/sungthu laitao` lai tạo dị biến.')
        .setTimestamp();
    if (pets.length === 0) {
        embed.setDescription('*Đạo hữu hiện chưa thu phục được linh thú nào. Hãy sử dụng lệnh `/sanyeuthu` dã ngoại để tìm bắt linh thú!*');
    }
    else {
        for (const pet of pets) {
            const status = pet.is_deployed === 1 ? '⚔️ **[ĐANG XUẤT CHIẾN]**' : '💤 Trong lồng thú';
            const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
            const emoji = rarityEmoji[pet.rarity] || '👾';
            let skillsText = '*Chưa thức tỉnh kỹ năng nào.*';
            try {
                const skills = JSON.parse(pet.skills || '[]');
                if (skills.length > 0) {
                    skillsText = skills.map(s => {
                        const sk = exports.PET_SKILLS[s];
                        return sk ? `${sk.emoji} **${sk.name}**: ${sk.description}` : s;
                    }).join('\n');
                }
            }
            catch { }
            let currentSkills = [];
            try {
                currentSkills = JSON.parse(pet.skills || '[]');
            }
            catch {
                currentSkills = [];
            }
            const allSkillEntries = Object.entries(exports.PET_SKILLS).sort(([, a], [, b]) => a.minLevel - b.minLevel);
            const lockedSkills = allSkillEntries.filter(([id]) => !currentSkills.includes(id));
            let evolutionHint;
            if (lockedSkills.length === 0) {
                evolutionHint = '\n⭐ *Linh thú đã thức tỉnh toàn bộ kỹ năng tiềm năng!*';
            }
            else {
                const nextSkillLevel = lockedSkills[0][1].minLevel;
                const hasAvailable = lockedSkills.some(([, sk]) => pet.level >= sk.minLevel);
                if (hasAvailable) {
                    evolutionHint = `\n💡 *Có thể thức tỉnh kỹ năng mới! Dùng /sungthu thuctinhkynang.*`;
                }
                else {
                    evolutionHint = `\n🔒 *Kỹ năng tiếp theo mở khoá ở cấp ${nextSkillLevel} (Hiện cấp ${pet.level}).*`;
                }
            }
            let mut = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            try {
                if (pet.mutations) {
                    mut = JSON.parse(pet.mutations);
                }
            }
            catch (e) { }
            const starStr = mut.stars > 0 ? ` [${'★'.repeat(mut.stars)}]` : '';
            const displayAtk = pet.base_atk + (mut.bonus_atk || 0);
            const displayDef = pet.base_def + (mut.bonus_def || 0);
            const displayHp = pet.base_hp + (mut.bonus_hp || 0);
            const bonusAtk = mut.bonus_atk > 0 ? ` (+${mut.bonus_atk})` : '';
            const bonusDef = mut.bonus_def > 0 ? ` (+${mut.bonus_def})` : '';
            const bonusHp = mut.bonus_hp > 0 ? ` (+${mut.bonus_hp})` : '';
            const genderText = pet.gender === 0 ? 'Đực ♂️' : 'Cái ♀️';
            const expNeeded = pet.level * 100;
            const expBar = (0, constants_1.getProgressBar)(pet.exp, expNeeded, 10);
            embed.addFields({
                name: `${emoji} ID: \`${pet.id}\` | ${pet.name}${starStr} (Cấp ${pet.level}) [${pet.rarity.toUpperCase()}]`,
                value: [
                    `• Trạng thái: ${status}`,
                    `• Giới tính: **${genderText}**`,
                    `• EXP: ${expBar} (${(0, constants_1.formatNumber)(pet.exp)}/${(0, constants_1.formatNumber)(expNeeded)})`,
                    `• Chỉ số: ⚔️ ATK **${displayAtk}**${bonusAtk} | 🛡️ DEF **${displayDef}**${bonusDef} | ❤️ HP **${displayHp}**${bonusHp}`,
                    `• Kỹ Năng:\n${skillsText}${evolutionHint}`
                ].join('\n')
            });
        }
    }
    return embed;
}
function getSungThuComponents(userId) {
    return [];
}
class SungThuCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('sungthu')
            .setDescription('Quản lý linh thú sủng vật hộ vệ đạo lộ.')
            .addSubcommand(sub => sub
            .setName('danhsach')
            .setDescription('Xem danh sách tất cả linh thú đang nuôi dưỡng.'))
            .addSubcommand(sub => sub
            .setName('xuatchien')
            .setDescription('Phái linh thú ra trận trợ lực chiến đấu.')
            .addIntegerOption(opt => opt
            .setName('pet_id')
            .setDescription('ID của linh thú (xem trong danh sách).')
            .setRequired(true)))
            .addSubcommand(sub => sub
            .setName('thuhoi')
            .setDescription('Thu hồi linh thú đang xuất chiến.'))
            .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('Bán một linh thú đổi lấy Linh Thạch.')
            .addIntegerOption(opt => opt
            .setName('pet_id')
            .setDescription('ID của linh thú cần bán.')
            .setRequired(true)))
            .addSubcommand(sub => sub
            .setName('banall')
            .setDescription('Bán TẤT CẢ linh thú hiện có (Trừ Linh Khuyển Chó Đỏ - chodo).'))
            .addSubcommand(sub => sub
            .setName('thuctinhkynang')
            .setDescription('Thức Tỉnh kỹ năng tiềm năng cho linh thú (Đạt cấp yêu cầu).')
            .addIntegerOption(opt => opt.setName('pet_id').setDescription('ID linh thú cần Thức Tỉnh kỹ năng.').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('laitao')
            .setDescription('Lai tạo 2 linh thú cùng phẩm chất tạo ra dị biến mới (Tiêu hủy cả 2 linh thú cha mẹ).')
            .addIntegerOption(opt => opt.setName('pet1_id').setDescription('ID linh thú đầu tiên (cha).').setRequired(true))
            .addIntegerOption(opt => opt.setName('pet2_id').setDescription('ID linh thú thứ hai (mẹ).').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('thonphe')
            .setDescription('Thôn phệ sủng thú khác để tăng Tinh Túc (Mutations/Stars) cho chủ thú.')
            .addIntegerOption(opt => opt.setName('main_id').setDescription('ID linh thú chính (sẽ mạnh lên).').setRequired(true))
            .addIntegerOption(opt => opt.setName('food_id').setDescription('ID linh thú làm thức ăn (sẽ biến mất).').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('doiten')
            .setDescription('Đổi tên linh thú (Phí 1,000 Linh Thạch).')
            .addIntegerOption(opt => opt.setName('pet_id').setDescription('ID linh thú cần đổi tên.').setRequired(true))
            .addStringOption(opt => opt.setName('name').setDescription('Tên mới cho linh thú (1-30 ký tự).').setRequired(true)))
            .addSubcommand(sub => sub
            .setName('hocky')
            .setDescription('Học kỹ năng mới cho linh thú cấp 70+ (Phí 5,000 Linh Thạch).')
            .addIntegerOption(opt => opt.setName('pet_id').setDescription('ID linh thú cần học kỹ năng.').setRequired(true))));
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
            const embed = getSungThuEmbed(userId);
            const components = getSungThuComponents(userId);
            await interaction.reply({ embeds: [embed], components });
            return;
        }
        if (sub === 'xuatchien') {
            const petId = interaction.options.getInteger('pet_id', true);
            const pet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
            if (!pet) {
                await interaction.reply({ content: '❌ Không tìm thấy sủng thú này trong Linh Thú Các của đạo hữu!', ephemeral: true });
                return;
            }
            database_1.default.transaction(() => {
                // Thu hồi toàn bộ
                database_1.default.prepare('UPDATE pets SET is_deployed = 0 WHERE user_id = ?').run(userId);
                // Xuất chiến pet này
                database_1.default.prepare('UPDATE pets SET is_deployed = 1 WHERE id = ?').run(petId);
            })();
            // Cập nhật tiến trình nhiệm vụ hàng ngày
            DailyQuestService_1.dailyQuestService.updateProgress(userId, 'daily_sungthu', 1);
            // Kiểm tra thành tựu cấp độ sủng thú
            (0, sanyeuthu_1.checkPetAchievements)(userId);
            await interaction.reply({
                content: `⚔️ Đạo hữu phái linh thú **${pet.name}** xuất chiến! Linh thú gầm rú uy chấn tứ phương, chuẩn bị phụ trợ chiến đấu.`
            });
            return;
        }
        if (sub === 'thuhoi') {
            const result = database_1.default.prepare('UPDATE pets SET is_deployed = 0 WHERE user_id = ? AND is_deployed = 1').run(userId);
            if (result.changes > 0) {
                await interaction.reply({ content: '💤 Đã thu hồi toàn bộ linh thú về túi nuôi sủng.' });
            }
            else {
                await interaction.reply({ content: '❌ Hiện tại đạo hữu không phái sủng thú nào chiến đấu.', ephemeral: true });
            }
            return;
        }
        if (sub === 'ban') {
            const petId = interaction.options.getInteger('pet_id', true);
            const pet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
            if (!pet) {
                await interaction.reply({ content: '❌ Linh thú không tồn tại!', ephemeral: true });
                return;
            }
            if (pet.is_deployed === 1) {
                await interaction.reply({ content: '❌ Linh thú đang xuất chiến trợ chiến, hãy thu hồi về lồng thú trước khi đem bán!', ephemeral: true });
                return;
            }
            const gold = this.getPetValue(pet.rarity);
            database_1.default.transaction(() => {
                database_1.default.prepare('DELETE FROM pets WHERE id = ?').run(petId);
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + gold });
            })();
            await interaction.reply({
                content: `💰 Đạo hữu bán sủng thú **${pet.name}** [${pet.rarity.toUpperCase()}] cho phường thị, nhận lại **+${gold}** Hạ Phẩm Linh Thạch.`
            });
            return;
        }
        if (sub === 'banall') {
            const pets = database_1.default.prepare("SELECT * FROM pets WHERE user_id = ? AND template_id != 'chodo' AND is_deployed = 0").all(userId);
            if (pets.length === 0) {
                await interaction.reply({
                    content: '❌ Đạo hữu không có sủng thú rảnh rỗi nào để bán (hoặc các thú cưng hiện tại đang xuất chiến/là Linh Khuyển Chó Đỏ được bảo hộ vĩnh viễn)!',
                    ephemeral: true
                });
                return;
            }
            let totalGold = 0;
            const idsToDelete = [];
            for (const pet of pets) {
                totalGold += this.getPetValue(pet.rarity);
                idsToDelete.push(pet.id);
            }
            database_1.default.transaction(() => {
                for (const id of idsToDelete) {
                    database_1.default.prepare('DELETE FROM pets WHERE id = ?').run(id);
                }
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalGold });
            })();
            await interaction.reply({
                content: `💰 Đạo hữu thanh lý **${pets.length}** linh thú thường, thu hoạch được **+${totalGold}** Linh Thạch! *(Đang linh thú trung thành Chó Đỏ và thú đang lâm trận tự động được lọc giữ lại).*`
            });
            return;
        }
        // --- SUBCOMMAND: THỨC TỈNH KỸ NĂNG ---
        if (sub === 'thuctinhkynang') {
            const petId = interaction.options.getInteger('pet_id', true);
            const pet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
            if (!pet) {
                await interaction.reply({ content: '❌ Linh thú không tồn tại!', ephemeral: true });
                return;
            }
            const currentSkills = JSON.parse(pet.skills || '[]');
            if (currentSkills.length >= 2) {
                await interaction.reply({ content: `❌ **${pet.name}** đã có đủ **2 kỹ năng** rồi, không thể thức tỉnh thêm! Dùng \`/sungthu hocky\` nếu muốn thay đổi kỹ năng.`, ephemeral: true });
                return;
            }
            // Tìm kỹ năng chưa được mở khoá nhưng đủ cấp
            const availableSkill = Object.entries(exports.PET_SKILLS).find(([id, sk]) => {
                return pet.level >= sk.minLevel && !currentSkills.includes(id);
            });
            if (!availableSkill) {
                const nextSkill = Object.entries(exports.PET_SKILLS)
                    .filter(([id]) => !currentSkills.includes(id))
                    .sort(([, a], [, b]) => a.minLevel - b.minLevel)[0];
                const hint = nextSkill
                    ? `\n*Linh thú cần đạt cấp **${nextSkill[1].minLevel}** mới mở khoá kỹ năng tiếp theo: **${nextSkill[1].name}**.*`
                    : '\n*Linh thú đã mở hết toàn bộ kỹ năng tiềm năng!*';
                await interaction.reply({
                    content: `❌ **${pet.name}** chưa đủ cấp để thức tỉnh kỹ năng nào mới (Hiện cấp **${pet.level}**).${hint}`,
                    ephemeral: true
                });
                return;
            }
            const [skillId, skillDef] = availableSkill;
            currentSkills.push(skillId);
            database_1.default.prepare('UPDATE pets SET skills = ? WHERE id = ?').run(JSON.stringify(currentSkills), petId);
            // Kiểm tra thành tựu thức tỉnh kỹ năng (st_10: 5 lần)
            const totalSkillAwakens = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'pet_skill_awaken'").get(userId);
            const now = Math.floor(Date.now() / 1000);
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'pet_skill_awaken', ?, ?)").run(userId, JSON.stringify({ petId, skillId, petName: pet.name }), now);
            AchievementService_1.achievementService.setProgress(userId, 'st_10', totalSkillAwakens.c + 1);
            await interaction.reply({
                content: `✨ **THỨC TỈNH THÀNH CÔNG!**\n\n🐉 Linh thú **${pet.name}** đã đạt đến cấp **${pet.level}**, mở ra kỹ năng tiềm năng!\n\n${skillDef.emoji} **${skillDef.name}** được thức tỉnh!\n*${skillDef.description}*`
            });
            return;
        }
        // --- SUBCOMMAND: LAI TẠO Dị BIẾN ---
        if (sub === 'laitao') {
            const pet1Id = interaction.options.getInteger('pet1_id', true);
            const pet2Id = interaction.options.getInteger('pet2_id', true);
            if (pet1Id === pet2Id) {
                await interaction.reply({ content: '❌ Không thể lai tạo một linh thú với chính nó!', ephemeral: true });
                return;
            }
            const pet1 = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(pet1Id, userId);
            const pet2 = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(pet2Id, userId);
            if (!pet1 || !pet2) {
                await interaction.reply({ content: '❌ Một trong hai linh thú không tồn tại trong sủng thú của đạo hữu!', ephemeral: true });
                return;
            }
            if (pet1.is_deployed === 1 || pet2.is_deployed === 1) {
                await interaction.reply({ content: '❌ Không thể lai tạo linh thú đang xuất chiến! Hãy thu hồi về trước.', ephemeral: true });
                return;
            }
            if (pet1.gender === pet2.gender) {
                await interaction.reply({ content: '❌ Hai linh thú phải khác giới tính (một Đực, một Cái) mới có thể lai tạo!', ephemeral: true });
                return;
            }
            if (user.coin_ha_pham < 100000) {
                await interaction.reply({ content: '❌ Đạo hữu không đủ 100,000 Hạ Phẩm Linh Thạch để tiến hành lai tạo!', ephemeral: true });
                return;
            }
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const r1 = rarityOrder.indexOf(pet1.rarity);
            const r2 = rarityOrder.indexOf(pet2.rarity);
            if (r1 !== r2) {
                await interaction.reply({ content: `❌ Hai linh thú phải cùng phẩm chất (Cấp độ hiện tại: **${pet1.rarity.toUpperCase()}** vs **${pet2.rarity.toUpperCase()}**)!`, ephemeral: true });
                return;
            }
            // Phẩm chất con = phẩm chất cha mẹ + có 15% cơ hội dị biến lên phẩm cao hơn
            const isMutation = Math.random() < 0.15;
            const childRarityIndex = isMutation ? Math.min(r1 + 1, rarityOrder.length - 1) : r1;
            const childRarity = rarityOrder[childRarityIndex];
            // Thuộc tính con = trung bình cha mẹ + bonus 10%
            const childAtk = Math.round((pet1.base_atk + pet2.base_atk) / 2 * 1.10);
            const childDef = Math.round((pet1.base_def + pet2.base_def) / 2 * 1.10);
            const childHp = Math.round((pet1.base_hp + pet2.base_hp) / 2 * 1.10);
            // Kế thừa 1 kỹ năng ngẫu nhiên từ mỗi bên (nếu có)
            const skills1 = JSON.parse(pet1.skills || '[]');
            const skills2 = JSON.parse(pet2.skills || '[]');
            const inheritedSkills = new Set();
            if (skills1.length > 0)
                inheritedSkills.add(skills1[Math.floor(Math.random() * skills1.length)]);
            if (skills2.length > 0)
                inheritedSkills.add(skills2[Math.floor(Math.random() * skills2.length)]);
            const parentTemplate = Math.random() < 0.5 ? pet1.template_id : pet2.template_id;
            const childName = `${pet1.name.split(' ')[0]}${pet2.name.split(' ')[0] || ''} Hậu`;
            const now = Math.floor(Date.now() / 1000);
            const childGender = Math.random() < 0.5 ? 0 : 1;
            const initialMutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            database_1.default.transaction(() => {
                // Trừ tiền
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 100000 });
                // Xóa 2 linh thú cha mẹ
                database_1.default.prepare('DELETE FROM pets WHERE id IN (?, ?)').run(pet1Id, pet2Id);
                // Tạo linh thú con
                database_1.default.prepare(`
          INSERT INTO pets (user_id, name, template_id, rarity, level, exp, base_hp, base_atk, base_def, is_deployed, skills, parent_1, parent_2, gender, mutations, created_at)
          VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).run(userId, childName, parentTemplate, childRarity, childHp, childAtk, childDef, JSON.stringify([...inheritedSkills]), pet1Id, pet2Id, childGender, JSON.stringify(initialMutations), now);
            })();
            // Kiểm tra thành tựu lai tạo
            AchievementService_1.achievementService.updateProgress(userId, 'st_8', 1); // Đã lai tạo 1 lần
            if (isMutation) {
                AchievementService_1.achievementService.updateProgress(userId, 'st_9', 1); // Dị biến thành công
            }
            const mutationText = isMutation
                ? `
🌟 **Dị Biến Xảy Ra!** Phẩm chất vượt trội: **${childRarity.toUpperCase()}** (tăng từ ${pet1.rarity.toUpperCase()})!`
                : '';
            await interaction.reply({
                content: [
                    `🐉 **LAI TẠO THÀNH CÔNG!** (-100,000 LT)`,
                    ``,
                    `♾️ **Cha:** ${pet1.name} [${pet1.rarity.toUpperCase()}] + **Mẹ:** ${pet2.name} [${pet2.rarity.toUpperCase()}]`,
                    ``,
                    `✨ **Linh thú con: ${childName}** [${childRarity.toUpperCase()}] đã ra đời! Giới tính: ${childGender === 0 ? 'Đực ♂️' : 'Cái ♀️'}${mutationText}`,
                    `⚔️ Công **${childAtk}** | 🛡️ Thủ **${childDef}** | ❤️ HP **${childHp}**`,
                    `🌀 **Kỹ năng kế thừa:** ${[...inheritedSkills].map(s => exports.PET_SKILLS[s]?.name || s).join(', ') || '*Không có*'}`,
                    ``,
                    `*Cả hai linh thú cha mẹ đã hợp nhất linh thể vào truyền nhân mới!*`
                ].join('\n')
            });
            return;
        }
        // --- SUBCOMMAND: THÔN PHỆ TĂNG SAO ---
        if (sub === 'thonphe') {
            const mainId = interaction.options.getInteger('main_id', true);
            const foodId = interaction.options.getInteger('food_id', true);
            if (mainId === foodId) {
                await interaction.reply({ content: '❌ Không thể thôn phệ chính mình!', ephemeral: true });
                return;
            }
            const mainPet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(mainId, userId);
            const foodPet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(foodId, userId);
            if (!mainPet || !foodPet) {
                await interaction.reply({ content: '❌ Không tìm thấy sủng thú tương ứng!', ephemeral: true });
                return;
            }
            if (foodPet.is_deployed === 1) {
                await interaction.reply({ content: '❌ Linh thú bị thôn phệ đang xuất chiến, hãy thu hồi về trước.', ephemeral: true });
                return;
            }
            // Update mutations
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            try {
                mutations = JSON.parse(mainPet.mutations || '{"stars":0,"bonus_atk":0,"bonus_def":0,"bonus_hp":0}');
            }
            catch (e) { }
            if (mutations.stars >= 5) {
                await interaction.reply({ content: '❌ Linh thú này đã đạt tối đa Tinh Túc (5 Sao)! Không thể thôn phệ thêm.', ephemeral: true });
                return;
            }
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const rMain = rarityOrder.indexOf(mainPet.rarity);
            const rFood = rarityOrder.indexOf(foodPet.rarity);
            if (rFood < rMain) {
                await interaction.reply({ content: '❌ Thức ăn thôn phệ phải có phẩm chất BẰNG HOẶC CAO HƠN chủ thú!', ephemeral: true });
                return;
            }
            const addedAtk = Math.round(foodPet.base_atk * 0.2);
            const addedDef = Math.round(foodPet.base_def * 0.2);
            const addedHp = Math.round(foodPet.base_hp * 0.2);
            mutations.stars += 1;
            mutations.bonus_atk += addedAtk;
            mutations.bonus_def += addedDef;
            mutations.bonus_hp += addedHp;
            database_1.default.transaction(() => {
                database_1.default.prepare('DELETE FROM pets WHERE id = ?').run(foodId);
                database_1.default.prepare('UPDATE pets SET mutations = ? WHERE id = ?').run(JSON.stringify(mutations), mainId);
            })();
            await interaction.reply({
                content: `🌀 **THÔN PHỆ THÀNH CÔNG!**\n\nLinh thú **${mainPet.name}** đã cắn nuốt **${foodPet.name}** và ngưng tụ thêm 1 Tinh Túc!\n\n⭐ **Cảnh Giới Tinh Túc:** ${mutations.stars} Sao\n⚔️ **Chỉ Số Đột Phá:** +${addedAtk} ATK | +${addedDef} DEF | +${addedHp} HP`
            });
            return;
        }
        // --- SUBCOMMAND: ĐỔI TÊN ---
        if (sub === 'doiten') {
            const petId = interaction.options.getInteger('pet_id', true);
            const newName = interaction.options.getString('name', true).trim();
            if (newName.length < 1 || newName.length > 30) {
                await interaction.reply({ content: '❌ Tên linh thú phải từ 1-30 ký tự!', ephemeral: true });
                return;
            }
            const pet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
            if (!pet) {
                await interaction.reply({ content: '❌ Linh thú không tồn tại!', ephemeral: true });
                return;
            }
            if (user.coin_ha_pham < 1000) {
                await interaction.reply({ content: '❌ Đạo hữu không đủ 1,000 Linh Thạch để đổi tên!', ephemeral: true });
                return;
            }
            const oldName = pet.name;
            database_1.default.transaction(() => {
                database_1.default.prepare('UPDATE pets SET name = ? WHERE id = ?').run(newName, petId);
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 1000 });
            })();
            await interaction.reply({
                content: `✏️ Đạo hữu đã đổi tên linh thú từ **${oldName}** thành **${newName}**! (-1,000 LT)`
            });
            return;
        }
        // --- SUBCOMMAND: HỌC KỸ NĂNG MỚI (Cấp 70+) ---
        if (sub === 'hocky') {
            const petId = interaction.options.getInteger('pet_id', true);
            const pet = database_1.default.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
            if (!pet) {
                await interaction.reply({ content: '❌ Linh thú không tồn tại!', ephemeral: true });
                return;
            }
            if (pet.level < 70) {
                await interaction.reply({ content: `❌ **${pet.name}** chưa đạt cấp 70 để học kỹ năng mới! (Hiện cấp **${pet.level}**)`, ephemeral: true });
                return;
            }
            const currentSkills = JSON.parse(pet.skills || '[]');
            if (currentSkills.length >= 2) {
                await interaction.reply({ content: `❌ **${pet.name}** đã có 2 kỹ năng, không thể học thêm!`, ephemeral: true });
                return;
            }
            if (user.coin_ha_pham < 5000) {
                await interaction.reply({ content: '❌ Đạo hữu không đủ 5,000 Linh Thạch để học kỹ năng!', ephemeral: true });
                return;
            }
            const availableSkills = Object.keys(exports.PET_SKILLS).filter(s => !currentSkills.includes(s));
            if (availableSkills.length === 0) {
                await interaction.reply({ content: '❌ Linh thú đã học hết các kỹ năng hiện có!', ephemeral: true });
                return;
            }
            const randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            const skillDef = exports.PET_SKILLS[randomSkill];
            currentSkills.push(randomSkill);
            database_1.default.transaction(() => {
                database_1.default.prepare('UPDATE pets SET skills = ? WHERE id = ?').run(JSON.stringify(currentSkills), petId);
                UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 5000 });
            })();
            await interaction.reply({
                content: `📚 **HỌC KỸ NĂNG THÀNH CÔNG!** (-5,000 LT)\n\n🐉 Linh thú **${pet.name}** đã lĩnh hội kỹ năng mới!\n\n${skillDef.emoji} **${skillDef.name}**: ${skillDef.description}`
            });
            return;
        }
    }
    getPetValue(rarity) {
        switch (rarity.toLowerCase()) {
            case 'common': return 50;
            case 'uncommon': return 100;
            case 'rare': return 250;
            case 'epic': return 800;
            case 'legendary': return 2500;
            default: return 50;
        }
    }
}
exports.default = SungThuCommand;
