"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTowerEmbed = getTowerEmbed;
exports.getTowerComponents = getTowerComponents;
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const InventoryService_1 = require("../../services/InventoryService");
const CombatEngine_1 = require("../../services/CombatEngine");
const DailyQuestService_1 = require("../../services/DailyQuestService");
const constants_1 = require("../../utils/constants");
const itemConstants_1 = require("../../config/itemConstants");
const database_1 = __importDefault(require("../../database/database"));
const uiSystem_1 = require("../../utils/uiSystem");
const TOWER_BUFFS = [
    { id: 'tower_atk_15', name: 'Linh Kiếm Phù', emoji: '⚔️', description: '+15% ATK', stat: 'atk', value: 1.15 },
    { id: 'tower_def_15', name: 'Thổ Giáp Phù', emoji: '🛡️', description: '+15% DEF', stat: 'def', value: 1.15 },
    { id: 'tower_hp_20', name: 'Sinh Mệnh Phù', emoji: '❤️', description: '+20% HP', stat: 'hp', value: 1.20 },
    { id: 'tower_crit_5', name: 'Bạo Lực Phù', emoji: '🔥', description: '+5% Crit', stat: 'crit', value: 0.05 },
    { id: 'tower_speed_10', name: 'Thần Hành Phù', emoji: '💨', description: '+10% Speed', stat: 'speed', value: 1.10 },
    { id: 'tower_atk_25', name: 'Hỏa Linh Phù', emoji: '🔥', description: '+25% ATK', stat: 'atk', value: 1.25 },
    { id: 'tower_def_25', name: 'Kim Cương Phù', emoji: '💎', description: '+25% DEF', stat: 'def', value: 1.25 },
];
// === Helper functions for button handlers ===
function getTowerEmbed(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    const progress = database_1.default.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId);
    const floor = progress ? progress.current_floor : 1;
    const maxFloor = progress ? progress.max_floor : 1;
    const lives = progress ? progress.lives : 3;
    const hpPercent = progress ? progress.hp_percent : 1.0;
    // Tính chỉ số quái vật ở tầng hiện tại
    const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1));
    const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1));
    const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1));
    const livesText = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
    const hpBar = (0, constants_1.getProgressBar)(Math.round(hpPercent * 100), 100, 10);
    // P1-01: Parse and display active buffs
    let buffText = '';
    try {
        const buffIds = JSON.parse(progress?.buffs || '[]');
        const buffs = buffIds.map(id => TOWER_BUFFS.find(b => b.id === id)).filter(Boolean);
        if (buffs.length > 0) {
            buffText = `\n🔮 **Buffs đang active:** ${buffs.map(b => `${b.emoji} ${b.description}`).join(' | ')}`;
        }
    }
    catch (e) { }
    // P1-01: Floor type indicator
    const isBossFloor = floor % 10 === 0;
    const isEventFloor = floor % 5 === 0 && !isBossFloor;
    const floorType = isBossFloor ? ' 👑 BOSS' : (isEventFloor ? ' ❓ Sự kiện' : '');
    return new discord_js_1.EmbedBuilder()
        .setTitle(`🏰 THÁP VÔ HẠN ROGUELIKE - ${user?.name || 'Không xác định'}`)
        .setColor(uiSystem_1.EMBED_COLORS.ERROR)
        .setDescription(`Nơi tu sĩ leo tháp cọ xát võ học bản thân. Càng lên cao, yêu tinh thần thú càng bá đạo.\n\n` +
        `🏆 **Tầng Cao Nhất Đạt Được:** Tầng **${maxFloor}**\n` +
        `⚡ **Tầng Hiện Tại:** Tầng **${floor}**${floorType}\n` +
        `❤️ **Sinh Mạng Còn Lại:** ${livesText} **(${lives}/3)**\n` +
        `🩸 **Trạng Thái Sinh Lực:**\n${hpBar} **(${Math.round(hpPercent * 100)}%)**${buffText}\n\n` +
        `👻 **Thông tin quái vật tầng ${floor}:**\n` +
        `• Sinh Lực: **${monsterHp}** HP\n` +
        `• Tấn Công: **${monsterAtk}** ATK\n` +
        `• Phòng Thủ: **${monsterDef}** DEF\n\n` +
        `*Gợi ý: Dùng \`/leothap khieu-chien\` để leo tầng tiếp theo (Tốn 20 Thể Lực), hoặc \`/leothap khoi-dau\` để reset bắt đầu lại từ đầu.*`)
        .setTimestamp();
}
function getTowerComponents(userId) {
    return [];
}
class LeoThapCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('leothap')
            .setDescription('Khiêu chiến Tháp Vô Hạn (Roguelike) kiểm thử thực lực tu sĩ.')
            .addSubcommand(sub => sub
            .setName('trangthai')
            .setDescription('Xem trạng thái leo tháp và tầng cao nhất đã đạt.'))
            .addSubcommand(sub => sub
            .setName('khieu-chien')
            .setDescription('Tiến vào khiêu chiến tầng tiếp theo (Tiêu hao 20 Thể Lực).'))
            .addSubcommand(sub => sub
            .setName('khoi-dau')
            .setDescription('Reset quá trình về Tầng 1 với 3 mạng mới (Tiêu hao 20 Thể Lực).')));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
            return;
        }
        const sub = interaction.options.getSubcommand();
        // Lấy progress hiện tại
        let progress = database_1.default.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId);
        if (sub === 'trangthai') {
            const embed = getTowerEmbed(userId);
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
            return;
        }
        // Các hành động chiến đấu/reset tiêu tốn 20 Stamina
        if (user.stamina < 20) {
            await interaction.editReply({
                content: `❌ Đạo hữu không đủ Thể Lực! (Cần ít nhất **20** điểm, hiện có **${user.stamina}**). Hãy nghỉ ngơi tĩnh dưỡng.`
            });
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        if (sub === 'khoi-dau') {
            database_1.default.transaction(() => {
                // Reset progress
                database_1.default.prepare(`
          INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
          VALUES (?, 1, ?, 1.0, 1.0, '[]', 3, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            current_floor = 1,
            hp_percent = 1.0,
            mp_percent = 1.0,
            buffs = '[]',
            lives = 3,
            last_reset_at = excluded.last_reset_at
        `).run(userId, progress ? progress.max_floor : 1, now);
                // Trừ thể lực
                UserRepository_1.userRepository.update(userId, { stamina: user.stamina - 20 });
            })();
            await interaction.editReply({
                content: `🔄 Đạo hữu đã tốn **20 Thể Lực** để thiết lập lại trận địa Tháp Vô Hạn! Đạo hữu đang ở **Tầng 1** với đầy đủ **3 sinh mạng**. Sử dụng \`/leothap khieu-chien\` để xung trận!`
            });
            return;
        }
        if (sub === 'khieu-chien') {
            if (!progress) {
                // Tạo mới run nếu chưa có
                database_1.default.prepare(`
          INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
          VALUES (?, 1, 1, 1.0, 1.0, '[]', 3, ?)
        `).run(userId, now);
                progress = database_1.default.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId);
            }
            if (progress.lives <= 0) {
                await interaction.editReply({
                    content: '❌ Đạo hữu đã cạn kiệt sinh mạng trong run tháp này! Vui lòng dùng lệnh \`/leothap khoi-dau\` để reset bắt đầu đợt leo tháp mới.'
                });
                return;
            }
            // Lấy chỉ số chiến đấu thực tế
            const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
            if (!activeStats) {
                await interaction.editReply({ content: '❌ Lỗi hệ thống: Không thể tính toán thuộc tính chiến đấu.' });
                return;
            }
            // Tính toán HP dựa trên lượng HP mang theo từ tầng trước
            const startHp = Math.max(1, Math.round(activeStats.hp * progress.hp_percent));
            // Lấy sủng thú trợ chiến
            const activePet = database_1.default.prepare('SELECT name, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1')
                .get(userId);
            // P1-01: Parse active buffs from JSON
            let activeBuffs = [];
            try {
                const buffIds = JSON.parse(progress.buffs || '[]');
                activeBuffs = buffIds.map(id => TOWER_BUFFS.find(b => b.id === id)).filter(Boolean);
                if (activeBuffs.length > 3)
                    activeBuffs = activeBuffs.slice(0, 3);
            }
            catch (e) { }
            // P1-01: Apply buff bonuses to player stats
            let buffAtkMult = 1.0, buffDefMult = 1.0, buffHpMult = 1.0, buffCritBonus = 0, buffSpeedMult = 1.0;
            for (const buff of activeBuffs) {
                switch (buff.stat) {
                    case 'atk':
                        buffAtkMult *= buff.value;
                        break;
                    case 'def':
                        buffDefMult *= buff.value;
                        break;
                    case 'hp':
                        buffHpMult *= buff.value;
                        break;
                    case 'crit':
                        buffCritBonus += buff.value;
                        break;
                    case 'speed':
                        buffSpeedMult *= buff.value;
                        break;
                }
            }
            // P1-01: Floor Event — every 5 floors (skip combat for non-combat events)
            const floor = progress.current_floor;
            if (floor > 1 && floor % 5 === 0 && floor % 10 !== 0) {
                const eventTypes = ['shop', 'elite', 'chest', 'demon', 'spring', 'gamble'];
                const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
                let eventMsg = '';
                let skipCombat = false;
                switch (eventType) {
                    case 'spring': {
                        database_1.default.prepare('UPDATE roguelike_progress SET hp_percent = 1.0 WHERE user_id = ?').run(userId);
                        eventMsg = `🌿 **Suối Linh** — Đạo hữu tìm thấy suối linh thiêng, hồi phục **100% HP**!`;
                        skipCombat = true;
                        break;
                    }
                    case 'chest': {
                        const availableBuffs = TOWER_BUFFS.filter(b => !activeBuffs.find(ab => ab.id === b.id));
                        if (availableBuffs.length > 0 && activeBuffs.length < 3) {
                            const newBuff = availableBuffs[Math.floor(Math.random() * availableBuffs.length)];
                            activeBuffs.push(newBuff);
                            const buffIds = activeBuffs.map(b => b.id);
                            database_1.default.prepare('UPDATE roguelike_progress SET buffs = ? WHERE user_id = ?').run(JSON.stringify(buffIds), userId);
                            eventMsg = `🎁 **Lễ Hộp** — Nhận **${newBuff.emoji} ${newBuff.name}** (${newBuff.description})!`;
                        }
                        else {
                            const coinBonus = 50 * floor;
                            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + coinBonus });
                            eventMsg = `🎁 **Lễ Hộp** — Hết chỗ buff, nhận **${coinBonus}** Linh Thạch.`;
                        }
                        skipCombat = true;
                        break;
                    }
                    case 'shop': {
                        if (activeBuffs.length < 3) {
                            const freeBuff = TOWER_BUFFS[Math.floor(Math.random() * TOWER_BUFFS.length)];
                            activeBuffs.push(freeBuff);
                            const buffIds = activeBuffs.map(b => b.id);
                            database_1.default.prepare('UPDATE roguelike_progress SET buffs = ? WHERE user_id = ?').run(JSON.stringify(buffIds), userId);
                            eventMsg = `🏪 **Tiệm Tỳ Bà** — Nhận **${freeBuff.emoji} ${freeBuff.name}** (${freeBuff.description})!`;
                        }
                        else {
                            eventMsg = `🏪 **Tiệm Tỳ Bà** — Hết chỗ trống.`;
                        }
                        skipCombat = true;
                        break;
                    }
                    case 'gamble': {
                        const betAmount = Math.min(200 * floor, user.coin_ha_pham);
                        if (betAmount <= 0) {
                            eventMsg = `🎲 **Cờ Tỷ Phú** — Không đủ Linh Thạch.`;
                        }
                        else if (Math.random() < 0.5) {
                            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + betAmount });
                            eventMsg = `🎲 **Cờ Tỷ Phú** — Thắng lớn! +**${betAmount}** Linh Thạch!`;
                        }
                        else {
                            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - betAmount });
                            eventMsg = `🎲 **Cờ Tỷ Phú** — Thua! Mất **${betAmount}** Linh Thạch!`;
                        }
                        skipCombat = true;
                        break;
                    }
                    case 'elite': {
                        eventMsg = `⚔️ **Thử Thách Bí Ẩn** — Oan Linh Elite! Phần thưởng x3!`;
                        break;
                    }
                    case 'demon': {
                        eventMsg = `💀 **Nội Ma** — Ma nội tâm! Thua = mất 1 mạng!`;
                        break;
                    }
                }
                if (skipCombat) {
                    await interaction.editReply({ content: eventMsg });
                    return;
                }
                // For elite/demon, continue to combat with event message prepended
            }
            // Quái vật tầng hiện tại (tăng tiến cấp số nhân sức mạnh)
            const isBossFloor = floor % 10 === 0;
            const isEliteEvent = (floor % 5 === 0 && !isBossFloor);
            const monsterScale = isBossFloor ? 3.0 : (isEliteEvent ? 1.5 : 1.0);
            const rewardScale = isBossFloor ? 3.0 : (isEliteEvent ? 3.0 : 1.0);
            const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1) * monsterScale);
            const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1) * monsterScale);
            const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1) * monsterScale);
            const playerCombatant = {
                name: user.name,
                hp: startHp,
                maxHp: Math.round(activeStats.hp * buffHpMult),
                atk: Math.round(activeStats.atk * buffAtkMult),
                def: Math.round(activeStats.def * buffDefMult),
                crit: activeStats.crit + buffCritBonus,
                critRes: activeStats.critRes,
                luck: activeStats.luck,
                linhCan: user.linh_can
            };
            const enemyName = isBossFloor
                ? `Oán Linh Tháp Chủ - Tầng ${floor} 👑`
                : `Oán Linh Tháp Chủ - Tầng ${floor} 👻`;
            const enemyCombatant = {
                name: enemyName,
                hp: monsterHp,
                maxHp: monsterHp,
                atk: monsterAtk,
                def: monsterDef,
                crit: 0.05 + floor * 0.002,
                critRes: 0.01 + floor * 0.001,
                luck: 10
            };
            // Chạy combat
            const combatResult = CombatEngine_1.CombatEngine.run(playerCombatant, enemyCombatant, activePet ? { name: activePet.name, atk: activePet.base_atk } : null, 30);
            const isWin = combatResult.winner === 'player';
            const embed = new discord_js_1.EmbedBuilder().setTimestamp();
            if (isWin) {
                // Tỷ lệ sinh lực còn lại sau trận đấu
                const endingHpPercent = Math.min(1.0, combatResult.playerEndingHp / activeStats.hp);
                let sectBonusMultiplier = 1.0;
                if (user.sect_id) {
                    const sect = database_1.default.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id);
                    if (sect) {
                        try {
                            const b = JSON.parse(sect.buildings || '{}');
                            if (b.tangkinhcac)
                                sectBonusMultiplier += b.tangkinhcac * 0.02; // +2% mỗi cấp
                        }
                        catch (e) { }
                    }
                }
                // P1-01: Apply reward multiplier for boss/elite floors
                const expGained = Math.round(50 * floor * sectBonusMultiplier * rewardScale);
                const coinGained = Math.round(10 * floor * rewardScale);
                const cappedNewTuVi = Math.min(user.tu_vi + expGained, user.exp_needed);
                const actualGainedExp = cappedNewTuVi - user.tu_vi;
                const newMaxFloor = Math.max(progress.max_floor, floor);
                database_1.default.transaction(() => {
                    // Trực tiếp cập nhật progress tháp tiến lên tầng sau
                    database_1.default.prepare(`
            UPDATE roguelike_progress
            SET current_floor = current_floor + 1,
                max_floor = ?,
                hp_percent = ?
            WHERE user_id = ?
          `).run(newMaxFloor, endingHpPercent, userId);
                    // Trừ stamina và phát thưởng
                    UserRepository_1.userRepository.update(userId, {
                        stamina: user.stamina - 20,
                        tu_vi: cappedNewTuVi,
                        coin_ha_pham: user.coin_ha_pham + coinGained
                    });
                    // Cơ hội 20% rơi mảnh trang bị
                    if (Math.random() < 0.20) {
                        InventoryRepository_1.inventoryRepository.addItem(userId, itemConstants_1.ITEMS.ITEM_FRAGMENT, 1);
                    }
                })();
                // Cập nhật tiến trình nhiệm vụ hàng ngày
                DailyQuestService_1.dailyQuestService.updateProgress(userId, 'daily_leothap', 1);
                // P2-06: Tower Season — update seasonal score
                try {
                    const activeSeason = database_1.default.prepare("SELECT id FROM tower_seasons WHERE status = 'active' AND end_time > ?").get(now);
                    if (activeSeason) {
                        const existingScore = database_1.default.prepare('SELECT * FROM tower_season_scores WHERE user_id = ? AND season_id = ?').get(userId, activeSeason.id);
                        if (existingScore) {
                            const newBestFloor = Math.max(existingScore.best_floor, floor + 1);
                            database_1.default.prepare('UPDATE tower_season_scores SET best_floor = ?, total_floors_cleared = total_floors_cleared + 1 WHERE user_id = ? AND season_id = ?')
                                .run(newBestFloor, userId, activeSeason.id);
                        }
                        else {
                            database_1.default.prepare('INSERT INTO tower_season_scores (user_id, season_id, best_floor, total_floors_cleared) VALUES (?, ?, ?, 1)')
                                .run(userId, activeSeason.id, floor + 1);
                        }
                    }
                }
                catch (e) {
                    console.warn('[LeoThap] Failed to update season score:', e);
                }
                let artifactMsg = '';
                const artifactExp = Math.round(expGained * 0.1);
                const artifactRes = InventoryService_1.inventoryService.addArtifactExp(userId, artifactExp);
                if (artifactRes && artifactRes.message) {
                    artifactMsg = `\n• ${artifactRes.message}`;
                }
                embed.setTitle(`🏆 CHIẾN THẮNG TẦNG ${floor}`)
                    .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
                    .setDescription(`Đạo hữu đã đả bại thành công **${enemyCombatant.name}**!\n\n` +
                    `📊 **Thông số sau hiệp đấu:**\n` +
                    `• Sinh lực mang đi tiếp: **${Math.round(endingHpPercent * 100)}%** HP ❤️\n` +
                    `• Tu vi nhận thức: **+${actualGainedExp}** Tu Vi 🌿\n` +
                    `• Linh thạch nhặt được: **+${coinGained}** Linh Thạch 🟤\n` +
                    `• Thể lực hao tổn: **-20** Thể Lực ⚡ (Còn lại: **${user.stamina - 20}/500**)${artifactMsg}\n\n` +
                    `👉 Đạo hữu đã sẵn sàng bước tiếp lên **Tầng ${floor + 1}**!`);
            }
            else {
                // Thất bại trong tháp -> Hao tổn 1 mạng
                const newLives = progress.lives - 1;
                const finalHpPercent = newLives > 0 ? 1.0 : 0.0; // Hồi sinh lại 100% nếu còn mạng
                database_1.default.transaction(() => {
                    database_1.default.prepare(`
            UPDATE roguelike_progress
            SET lives = ?,
                hp_percent = ?
            WHERE user_id = ?
          `).run(newLives, finalHpPercent, userId);
                    UserRepository_1.userRepository.update(userId, { stamina: user.stamina - 20 });
                })();
                embed.setTitle(`💀 THẤT BẠI TẦNG ${floor}`)
                    .setColor(uiSystem_1.EMBED_COLORS.ERROR);
                if (newLives > 0) {
                    embed.setDescription(`Đạo hữu tử trận tại tầng **${floor}**!\n\n` +
                        `• Sát thương oán khí bạo liệt, đạo hữu hao tổn **-1 sinh mạng** (Còn lại **${newLives}/3** mạng).\n` +
                        `• Trừ **-20 Thể Lực** ⚡ (Còn lại: **${user.stamina - 20}/500**).\n\n` +
                        `✨ *Linh thể tự động được tháp quy tắc tái tạo đầy 100% HP. Đạo hữu có thể khiêu chiến lại tầng này!*`);
                }
                else {
                    embed.setDescription(`Đạo hữu đã cạn kiệt sinh mạng tại tầng **${floor}**!\n\n` +
                        `• Trừ **-20 Thể Lực** ⚡.\n` +
                        `💀 *Đạo hữu bị đẩy văng ra khỏi chân tháp. Hãy dùng lệnh \`/leothap khoi-dau\` để thiết lập run mới từ Tầng 1.*`);
                }
            }
            await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
        }
    }
}
exports.default = LeoThapCommand;
