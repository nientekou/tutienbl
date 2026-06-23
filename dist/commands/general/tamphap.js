"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const HeartLawService_1 = require("../../services/HeartLawService");
const uiSystem_1 = require("../../utils/uiSystem");
class TamPhapCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('tamphap')
            .setDescription('Hệ thống Tâm Pháp - Lĩnh ngộ võ học, gia tăng chiến lực.')
            .addSubcommand(sub => sub.setName('danhsach')
            .setDescription('Xem danh sách Tâm Pháp, tiến độ mảnh ghép và cấp độ'))
            .addSubcommand(sub => sub.setName('trangbi')
            .setDescription('Xem các Tâm Pháp đang mang và thuộc tính kích hoạt'))
            .addSubcommand(sub => sub.setName('mang')
            .setDescription('Trang bị Tâm Pháp vào ô chỉ định')
            .addStringOption(opt => opt.setName('tam_phap')
            .setDescription('Tâm Pháp muốn trang bị')
            .setRequired(true)
            .addChoices({ name: '🔥 Hỏa Linh Quyết (Hỏa)', value: 'hl_hoa' }, { name: '❄️ Băng Tâm Quyết (Thủy)', value: 'hl_thuy' }, { name: '🌿 Tụ Linh Quyết (Mộc)', value: 'hl_moc' }, { name: '🪨 Trường Sinh Quyết (Thổ)', value: 'hl_tho' }, { name: '⚡ Thần Hành Quyết (Kim)', value: 'hl_kim' }, { name: '🌀 Phá Cấm Quyết (Vô)', value: 'hl_vo' }))
            .addIntegerOption(opt => opt.setName('o_trang_bi')
            .setDescription('Ô trang bị (1, 2, 3)')
            .setRequired(true)
            .addChoices({ name: 'Ô số 1', value: 1 }, { name: 'Ô số 2', value: 2 }, { name: 'Ô số 3', value: 3 })))
            .addSubcommand(sub => sub.setName('thao')
            .setDescription('Tháo trang bị Tâm Pháp khỏi ô chỉ định')
            .addIntegerOption(opt => opt.setName('o_trang_bi')
            .setDescription('Ô muốn tháo (1, 2, 3)')
            .setRequired(true)
            .addChoices({ name: 'Ô số 1', value: 1 }, { name: 'Ô số 2', value: 2 }, { name: 'Ô số 3', value: 3 })))
            .addSubcommand(sub => sub.setName('linhngo')
            .setDescription('Lĩnh ngộ Tâm Pháp mới từ 5 mảnh ghép')
            .addStringOption(opt => opt.setName('tam_phap')
            .setDescription('Tâm Pháp muốn lĩnh ngộ')
            .setRequired(true)
            .addChoices({ name: '🔥 Hỏa Linh Quyết', value: 'hl_hoa' }, { name: '❄️ Băng Tâm Quyết', value: 'hl_thuy' }, { name: '🌿 Tụ Linh Quyết', value: 'hl_moc' }, { name: '🪨 Trường Sinh Quyết', value: 'hl_tho' }, { name: '⚡ Thần Hành Quyết', value: 'hl_kim' }, { name: '🌀 Phá Cấm Quyết', value: 'hl_vo' })))
            .addSubcommand(sub => sub.setName('nangcap')
            .setDescription('Nâng cấp Tâm Pháp đang sở hữu')
            .addStringOption(opt => opt.setName('tam_phap')
            .setDescription('Tâm Pháp muốn nâng cấp')
            .setRequired(true)
            .addChoices({ name: '🔥 Hỏa Linh Quyết', value: 'hl_hoa' }, { name: '❄️ Băng Tâm Quyết', value: 'hl_thuy' }, { name: '🌿 Tụ Linh Quyết', value: 'hl_moc' }, { name: '🪨 Trường Sinh Quyết', value: 'hl_tho' }, { name: '⚡ Thần Hành Quyết', value: 'hl_kim' }, { name: '🌀 Phá Cấm Quyết', value: 'hl_vo' }))));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        // ───────────────── DANH SÁCH TÂM PHÁP ─────────────────
        if (sub === 'danhsach') {
            const laws = HeartLawService_1.heartLawService.getUserHeartLaws(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📚 TÂM PHÁP TIÊN THƯ')
                .setColor(uiSystem_1.EMBED_COLORS.DUNGEON)
                .setTimestamp()
                .setFooter({ text: 'Dùng /tamphap linhngo hoặc /tamphap nangcap để đột phá võ học.' });
            let listStr = '';
            for (const law of laws) {
                const statusEmoji = law.level > 0 ? '🟢' : '🔴';
                const levelText = law.level > 0 ? `Cấp **${law.level}/10**` : '*Chưa lĩnh ngộ*';
                const equippedText = law.is_equipped > 0 ? ` 🛡️ **[Ô ${law.is_equipped}]**` : '';
                let fragGoal = 5;
                if (law.level > 0)
                    fragGoal = law.level * 5; // Chi phí nâng cấp tiếp theo
                const fragText = `🧩 Mảnh: **${law.fragments}/${fragGoal}**`;
                listStr += `${statusEmoji} **${law.name}** (${law.element} Hệ) ${equippedText}\n` +
                    `  ├─ *Trạng thái:* ${levelText} | ${fragText}\n` +
                    `  └─ *Hiệu quả:* ${law.description}\n\n`;
            }
            embed.setDescription(listStr || '*Hiện tại hệ thống chưa có tâm pháp nào.*');
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        // ───────────────── TRANG BỊ TÂM PHÁP ĐANG MANG ─────────────────
        else if (sub === 'trangbi') {
            const equipped = HeartLawService_1.heartLawService.getEquippedHeartLaws(userId);
            const activePassives = HeartLawService_1.heartLawService.getActivePassives(userId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🛡️ TÂM PHÁP TRANG BỊ')
                .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
                .setTimestamp()
                .setFooter({ text: 'Dùng /tamphap mang hoặc /tamphap thao để cấu hình.' });
            let slotsStr = '';
            for (let i = 1; i <= 3; i++) {
                const law = equipped.find(e => e.is_equipped === i);
                if (law) {
                    slotsStr += `**Ô số ${i}:** **${law.name}** (Cấp ${law.level})\n`;
                }
                else {
                    slotsStr += `**Ô số ${i}:** *Trống*\n`;
                }
            }
            embed.addFields({ name: '⚙️ Trạng Thái Cấu Hình', value: slotsStr });
            let passivesStr = '';
            if (activePassives.length > 0) {
                activePassives.forEach(ap => {
                    let desc = '';
                    const percentVal = Math.round(ap.value * 100);
                    switch (ap.type) {
                        case 'element_fire_dmg':
                            desc = `Tăng sát thương hệ Hỏa thêm **+${percentVal}%**`;
                            break;
                        case 'stun_immune':
                            desc = `Miễn nhiễm hoàn toàn trạng thái Choáng (Stun/Tê liệt)`;
                            break;
                        case 'exp_boost':
                            desc = `Tăng thêm **+${percentVal}%** Tu Vi (EXP) nhận được`;
                            break;
                        case 'hp_regen':
                            desc = `Hồi phục **+${percentVal}%** HP tối đa mỗi hiệp chiến đấu`;
                            break;
                        case 'speed_boost':
                            desc = `Tăng **+${percentVal}%** Tốc Độ trong trận chiến`;
                            break;
                        case 'level_suppression_dmg':
                            desc = `Tăng **+${percentVal}%** sát thương khi đấu với kẻ địch cấp cao hơn`;
                            break;
                        default:
                            desc = `Hiệu ứng đặc biệt: **+${percentVal}%**`;
                    }
                    const scaleText = ap.scale === 1.5 ? ' 🔥 *(Cộng hưởng Huyết Mạch x1.5)*' : ap.scale === 0.8 ? ' ⚠️ *(Khác hệ Huyết Mạch: Hiệu quả -20%)*' : '';
                    passivesStr += `• **${ap.lawName}**: ${desc}${scaleText}\n`;
                });
            }
            else {
                passivesStr = '*Chưa kích hoạt hiệu ứng nào. Hãy trang bị Tâm Pháp.*';
            }
            embed.addFields({ name: '⚡ Hiệu Ứng Đang Hoạt Động', value: passivesStr });
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
        // ───────────────── TRANG BỊ VÀO Ô ─────────────────
        else if (sub === 'mang') {
            const lawId = interaction.options.getString('tam_phap', true);
            const slot = interaction.options.getInteger('o_trang_bi', true);
            const res = HeartLawService_1.heartLawService.equipHeartLaw(userId, lawId, slot);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${res.message}` });
            }
        }
        // ───────────────── THÁO TRANG BỊ ─────────────────
        else if (sub === 'thao') {
            const slot = interaction.options.getInteger('o_trang_bi', true);
            const res = HeartLawService_1.heartLawService.unequipHeartLaw(userId, slot);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${res.message}` });
            }
        }
        // ───────────────── LĨNH NGỘ ─────────────────
        else if (sub === 'linhngo') {
            const lawId = interaction.options.getString('tam_phap', true);
            const res = HeartLawService_1.heartLawService.learnHeartLaw(userId, lawId);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${res.message}` });
            }
        }
        // ───────────────── NÂNG CẤP ─────────────────
        else if (sub === 'nangcap') {
            const lawId = interaction.options.getString('tam_phap', true);
            const res = HeartLawService_1.heartLawService.levelUpHeartLaw(userId, lawId);
            if (res.success) {
                await interaction.editReply({ content: res.message });
            }
            else {
                await interaction.editReply({ content: `❌ ${res.message}` });
            }
        }
    }
}
exports.default = TamPhapCommand;
