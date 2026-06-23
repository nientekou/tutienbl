"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guildWarService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const InventoryService_1 = require("./InventoryService");
const constants_1 = require("../utils/constants");
const itemConstants_1 = require("../config/itemConstants");
class GuildWarService {
    /** Tạo mã chiến ngẫu nhiên */
    generateWarId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    /** Lấy thông tin tông môn */
    getSectInfo(sectId) {
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId);
        if (!sect)
            return null;
        const master = UserRepository_1.userRepository.get(sect.master_id);
        const memberCount = database_1.default.prepare('SELECT COUNT(*) as count FROM users WHERE sect_id = ?').get(sectId);
        return {
            id: sect.id,
            name: sect.name,
            master_name: master?.name || 'Vô danh',
            level: sect.level,
            member_count: memberCount.count
        };
    }
    /**
     * Tạo chiến tranh tông môn (Tông chủ khiêu chiến)
     */
    createWar(challengerUserId, defenderSectId) {
        const challenger = UserRepository_1.userRepository.get(challengerUserId);
        if (!challenger)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        if (!challenger.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn nào!' };
        const challengerSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(challenger.sect_id);
        if (!challengerSect)
            return { success: false, message: 'Tông Môn của đạo hữu không tồn tại!' };
        if (challengerSect.master_id !== challengerUserId)
            return { success: false, message: 'Chỉ có Tông Chủ mới có thể phát động chiến tranh!' };
        if (challengerSect.id === defenderSectId)
            return { success: false, message: 'Không thể khiêu chiến với chính Tông Môn của mình!' };
        const defenderSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(defenderSectId);
        if (!defenderSect)
            return { success: false, message: 'Tông Môn đối thủ không tồn tại!' };
        // Kiểm tra Tông Môn đang có chiến tranh
        const activeWar = database_1.default.prepare("SELECT id FROM guild_wars WHERE (challenger_sect_id = ? OR defender_sect_id = ?) AND status IN ('pending', 'active')").get(challengerSect.id, challengerSect.id);
        if (activeWar)
            return { success: false, message: 'Tông Môn của đạo hữu đang trong một cuộc chiến khác!' };
        const activeWarDefender = database_1.default.prepare("SELECT id FROM guild_wars WHERE (challenger_sect_id = ? OR defender_sect_id = ?) AND status IN ('pending', 'active')").get(defenderSectId, defenderSectId);
        if (activeWarDefender)
            return { success: false, message: 'Tông Môn đối thủ đang trong một cuộc chiến khác!' };
        // Phí phát động: 2000 Linh Thạch
        if (challenger.coin_ha_pham < 2000) {
            return { success: false, message: `Không đủ Linh Thạch để phát động chiến tranh! Cần 2000 Linh Thạch (Hiện có: ${challenger.coin_ha_pham})` };
        }
        const warId = this.generateWarId();
        const now = Math.floor(Date.now() / 1000);
        const defenderMembers = database_1.default.prepare("SELECT discord_id FROM users WHERE sect_id = ?").all(defenderSectId);
        // Xác định số hiệp tối đa (dựa trên cấp Tông Môn thấp hơn)
        const maxRounds = Math.min(challengerSect.level, defenderSect.level) + 3;
        database_1.default.transaction(() => {
            // Trừ phí
            UserRepository_1.userRepository.update(challengerUserId, { coin_ha_pham: challenger.coin_ha_pham - 2000 });
            // Tạo chiến tranh
            database_1.default.prepare(`
        INSERT INTO guild_wars (id, challenger_sect_id, defender_sect_id, status, max_rounds, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `).run(warId, challengerSect.id, defenderSectId, maxRounds, now);
            // Thêm người khiêu chiến vào tham chiến
            database_1.default.prepare(`
        INSERT INTO guild_war_participants (war_id, user_id, sect_id, side)
        VALUES (?, ?, ?, 'challenger')
      `).run(warId, challengerUserId, challengerSect.id);
            // Ghi audit log
            const { systemConfigService } = require('./SystemConfigService');
            systemConfigService.writeAuditLog(challengerUserId, 'guild_war_create', {
                warId,
                challengerSect: challengerSect.name,
                defenderSect: defenderSect.name,
                cost: 2000
            });
        })();
        return {
            success: true,
            message: `⚔️ **Tuyên Chiến!** Tông Môn **${challengerSect.name}** chính thức tuyên chiến với **${defenderSect.name}**!\n\nMã chiến: \`${warId}\`\nPhí phát động: -2000 Linh Thạch\nSố hiệp tối đa: **${maxRounds}**\n\nĐệ tử **${defenderSect.name}** hãy dùng \`/guildwar thamgia ma_chiến: ${warId}\` để tham gia bảo vệ Tông Môn!`,
            warId
        };
    }
    /**
     * Tông chủ phòng thủ chấp nhận hoặc từ chối chiến tranh
     */
    respondToWar(warId, userId, accept) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const war = database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ? AND status = 'pending'").get(warId);
        if (!war)
            return { success: false, message: 'Không tìm thấy thư chiến hoặc đã được xử lý!' };
        const defenderSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(war.defender_sect_id);
        if (!defenderSect || defenderSect.master_id !== userId)
            return { success: false, message: 'Chỉ có Tông Chủ phe phòng thủ mới có quyền trả lời!' };
        const now = Math.floor(Date.now() / 1000);
        if (!accept) {
            // Từ chối - bồi thường 1000 Linh Thạch
            if (user.coin_ha_pham < 1000) {
                database_1.default.prepare("UPDATE guild_wars SET status = 'cancelled', ended_at = ? WHERE id = ?").run(now, warId);
                return { success: true, message: 'Tông Chủ đã từ chối chiến tranh, nhưng không đủ Linh Thạch bồi thường! Tông Môn mất uy tín!' };
            }
            UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 1000 });
            database_1.default.prepare("UPDATE guild_wars SET status = 'cancelled', ended_at = ? WHERE id = ?").run(now, warId);
            return { success: true, message: `☮️ **Hòa Hoãn!** Tông Chủ **${defenderSect.name}** đã từ chối chiến tranh và bồi thường 1000 Linh Thạch!` };
        }
        // Chấp nhận - bắt đầu chiến
        const challengerSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(war.challenger_sect_id);
        if (!challengerSect)
            return { success: false, message: 'Tông Môn khiêu chiến đã bị giải tán!' };
        // Thêm tông chủ phòng thủ vào tham chiến
        database_1.default.prepare(`
      INSERT OR IGNORE INTO guild_war_participants (war_id, user_id, sect_id, side)
      VALUES (?, ?, ?, 'defender')
    `).run(warId, userId, war.defender_sect_id);
        // Tính HP ban đầu: mỗi thành viên đóng góp HP
        const challengerCount = database_1.default.prepare("SELECT COUNT(*) as c FROM guild_war_participants WHERE war_id = ? AND side = 'challenger'").get(warId);
        const defenderCount = database_1.default.prepare("SELECT COUNT(*) as c FROM guild_war_participants WHERE war_id = ? AND side = 'defender'").get(warId);
        const baseHp = 100;
        const challengerHp = baseHp + Math.max(0, challengerCount.c - 1) * 20;
        const defenderHp = baseHp + Math.max(0, defenderCount.c - 1) * 20;
        // Tạo turn order ngẫu nhiên
        const allParticipants = database_1.default.prepare("SELECT user_id FROM guild_war_participants WHERE war_id = ? AND is_alive = 1").all(warId);
        const turnOrder = allParticipants.sort(() => Math.random() - 0.5).map(p => p.user_id);
        database_1.default.prepare(`
      UPDATE guild_wars 
      SET status = 'active', challenger_hp = ?, defender_hp = ?, turn_order = ?, current_turn_index = 0, started_at = ?
      WHERE id = ?
    `).run(challengerHp, defenderHp, JSON.stringify(turnOrder), now, warId);
        return {
            success: true,
            message: `⚔️ **CHIẾN TRANH BẮT ĐẦU!**\n\n**${challengerSect.name}** (HP: ${challengerHp}) ⚔️ **${defenderSect.name}** (HP: ${defenderHp})\n\nTối đa **${war.max_rounds}** hiệp. Các đệ tử hãy dùng \`/guildwar tancong ma_chiến: ${warId}\` để tấn công!`
        };
    }
    /**
     * Tham gia chiến tranh với tư cách thành viên
     */
    joinWar(warId, userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const war = database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ? AND status IN ('pending', 'active')").get(warId);
        if (!war)
            return { success: false, message: 'Cuộc chiến không tồn tại hoặc đã kết thúc!' };
        // Kiểm tra membership
        const isChallenger = user.sect_id === war.challenger_sect_id;
        const isDefender = user.sect_id === war.defender_sect_id;
        if (!isChallenger && !isDefender)
            return { success: false, message: 'Tông Môn của đạo hữu không tham gia cuộc chiến này!' };
        const side = isChallenger ? 'challenger' : 'defender';
        // Đã tham gia chưa
        const existing = database_1.default.prepare("SELECT id FROM guild_war_participants WHERE war_id = ? AND user_id = ?").get(warId, userId);
        if (existing)
            return { success: false, message: 'Đạo hữu đã tham gia cuộc chiến này rồi!' };
        // Yêu cầu tối thiểu cấp 10
        if (user.level < 10) {
            return { success: false, message: 'Cảnh giới quá thấp! Cần ít nhất cấp 10 để tham gia chiến tranh!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            database_1.default.prepare(`
        INSERT INTO guild_war_participants (war_id, user_id, sect_id, side)
        VALUES (?, ?, ?, ?)
      `).run(warId, userId, user.sect_id, side);
            // Nếu war đang active, cập nhật HP
            if (war.status === 'active') {
                const col = side === 'challenger' ? 'challenger_hp' : 'defender_hp';
                database_1.default.prepare(`UPDATE guild_wars SET ${col} = ${col} + 20 WHERE id = ?`).run(warId);
            }
            // Audit log
            const { systemConfigService } = require('./SystemConfigService');
            systemConfigService.writeAuditLog(userId, 'guild_war_join', { warId, side, name: user.name });
        })();
        return { success: true, message: `✅ **${user.name}** đã gia nhập chiến trường! Phe ${side === 'challenger' ? 'tấn công' : 'phòng thủ'}!` };
    }
    /**
     * Thực hiện tấn công trong chiến tranh (mỗi lượt 1 người)
     */
    attack(warId, userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật!' };
        const war = database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ? AND status = 'active'").get(warId);
        if (!war)
            return { success: false, message: 'Cuộc chiến không tồn tại hoặc không ở trạng thái chiến đấu!' };
        const participant = database_1.default.prepare("SELECT * FROM guild_war_participants WHERE war_id = ? AND user_id = ? AND is_alive = 1").get(warId, userId);
        if (!participant)
            return { success: false, message: 'Đạo hữu chưa tham gia hoặc đã tử trận!' };
        // Kiểm tra đến lượt
        const turnOrder = JSON.parse(war.turn_order || '[]');
        const currentTurnUserId = turnOrder[war.current_turn_index];
        if (currentTurnUserId !== userId) {
            const currentUser = UserRepository_1.userRepository.get(currentTurnUserId);
            return { success: false, message: `Chưa đến lượt của đạo hữu! Đến lượt của **${currentUser?.name || 'người khác'}**.` };
        }
        // Kiểm tra cooldown (30 giây giữa các lượt)
        const now = Math.floor(Date.now() / 1000);
        const lastLog = database_1.default.prepare("SELECT created_at FROM guild_war_attack_logs WHERE war_id = ? ORDER BY id DESC LIMIT 1").get(warId);
        if (lastLog && now - lastLog.created_at < 10) {
            const remaining = 10 - (now - lastLog.created_at);
            return { success: false, message: `Vui lòng đợi **${remaining} giây** giữa các đòn tấn công!` };
        }
        // Tính sát thương dựa trên chỉ số thực tế
        const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
        if (!activeStats)
            return { success: false, message: 'Không thể tính chỉ số chiến đấu!' };
        const realmInfo = (0, constants_1.getRealmDetails)(user.level);
        const levelBonus = 1 + (user.level - 1) * 0.02; // +2% mỗi cấp
        const luckBonus = 1 + (user.base_luck || 10) * 0.01; // +1% mỗi điểm may mắn
        // Xác định phe địch
        const isChallenger = participant.side === 'challenger';
        const targetHpCol = isChallenger ? 'defender_hp' : 'challenger_hp';
        const targetSectId = isChallenger ? war.defender_sect_id : war.challenger_sect_id;
        // Cân Bằng Phe Phái: Underdog Attack Buff + Zerg Damage Reduction
        const mySectId = user.sect_id;
        const { sectService } = require('./SectService');
        const underdogAtkMult = sectService.getUnderdogAttackMultiplier(mySectId, targetSectId);
        const zergDmgReduction = sectService.getZergDamageReduction(targetSectId, mySectId);
        const factionBalanceMult = underdogAtkMult * zergDmgReduction;
        // Random damage
        const baseDamage = Math.round((activeStats.atk * 0.5 + activeStats.hp * 0.1) * levelBonus * luckBonus * factionBalanceMult);
        const variance = Math.round(baseDamage * (0.7 + Math.random() * 0.6));
        const isCrit = Math.random() < activeStats.crit;
        const finalDamage = isCrit ? Math.round(variance * 1.5) : Math.max(1, variance);
        const targetSect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(targetSectId);
        // Áp dụng sát thương
        const currentTargetHp = isChallenger ? war.defender_hp : war.challenger_hp;
        const newTargetHp = Math.max(0, currentTargetHp - finalDamage);
        // Tìm target ngẫu nhiên trong phe địch
        const enemyParticipants = database_1.default.prepare("SELECT user_id FROM guild_war_participants WHERE war_id = ? AND side = ? AND is_alive = 1 AND user_id != ?").all(warId, isChallenger ? 'defender' : 'challenger', userId);
        let targetName = targetSect?.name || 'Tông Môn địch';
        let targetUserId = null;
        if (enemyParticipants.length > 0) {
            const randomEnemy = enemyParticipants[Math.floor(Math.random() * enemyParticipants.length)];
            targetUserId = randomEnemy.user_id;
            const enemyUser = UserRepository_1.userRepository.get(targetUserId);
            if (enemyUser)
                targetName = enemyUser.name;
        }
        // Cập nhật
        const nextTurnIndex = (war.current_turn_index + 1) % turnOrder.length;
        const isWarOver = newTargetHp <= 0 || war.current_round >= war.max_rounds;
        database_1.default.transaction(() => {
            // Nếu war kết thúc, không tăng current_round nữa để hiển thị đúng
            const newRound = isWarOver ? war.current_round : war.current_round + 1;
            // Cập nhật HP phe địch
            if (isChallenger) {
                database_1.default.prepare("UPDATE guild_wars SET defender_hp = ?, current_round = ?, current_turn_index = ? WHERE id = ?")
                    .run(newTargetHp, newRound, nextTurnIndex, warId);
            }
            else {
                database_1.default.prepare("UPDATE guild_wars SET challenger_hp = ?, current_round = ?, current_turn_index = ? WHERE id = ?")
                    .run(newTargetHp, newRound, nextTurnIndex, warId);
            }
            // Ghi log tấn công
            database_1.default.prepare(`
        INSERT INTO guild_war_attack_logs (war_id, round_number, attacker_id, target_id, damage, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(warId, war.current_round, userId, targetUserId, finalDamage, `${isCrit ? 'BẠO KÍCH! ' : ''}${user.name} tấn công ${targetName}, gây ${finalDamage} sát thương`, now);
            // Cập nhật chỉ số người tấn công
            database_1.default.prepare(`
        UPDATE guild_war_participants SET damage_dealt = damage_dealt + ?, attacks_count = attacks_count + 1 WHERE id = ?
      `).run(finalDamage, participant.id);
            // Nếu chiến tranh kết thúc
            if (isWarOver) {
                let winnerSectId = null;
                if (newTargetHp <= 0) {
                    winnerSectId = isChallenger ? war.challenger_sect_id : war.defender_sect_id;
                }
                else if (war.current_round >= war.max_rounds) {
                    // Hết hiệp: phe nào nhiều HP hơn thắng
                    const finalChallengerHp = isChallenger ? database_1.default.prepare("SELECT challenger_hp FROM guild_wars WHERE id = ?").get(warId).challenger_hp : war.challenger_hp;
                    const finalDefenderHp = !isChallenger ? database_1.default.prepare("SELECT defender_hp FROM guild_wars WHERE id = ?").get(warId).defender_hp : newTargetHp;
                    if (finalChallengerHp > finalDefenderHp)
                        winnerSectId = war.challenger_sect_id;
                    else if (finalDefenderHp > finalChallengerHp)
                        winnerSectId = war.defender_sect_id;
                }
                database_1.default.prepare("UPDATE guild_wars SET status = 'completed', ended_at = ?, winner_sect_id = ? WHERE id = ?")
                    .run(now, winnerSectId, warId);
                // Phát thưởng nếu có người thắng
                if (winnerSectId) {
                    this.distributeRewards(warId, winnerSectId);
                }
            }
        })();
        // Xây dựng kết quả
        const critText = isCrit ? '💥 **BẠO KÍCH!**' : '';
        const hpAfter = isChallenger ? newTargetHp : database_1.default.prepare("SELECT defender_hp FROM guild_wars WHERE id = ?").get(warId)?.defender_hp;
        const hpChallenger = isChallenger ? database_1.default.prepare("SELECT challenger_hp FROM guild_wars WHERE id = ?").get(warId)?.challenger_hp : war.challenger_hp;
        const hpDefender = !isChallenger ? newTargetHp : database_1.default.prepare("SELECT defender_hp FROM guild_wars WHERE id = ?").get(warId)?.defender_hp;
        // Xác định người tiếp theo
        const newWar = database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ?").get(warId);
        const nextTurnUserId = newWar.status === 'active' ? turnOrder[newWar.current_turn_index] : null;
        const nextUser = nextTurnUserId ? UserRepository_1.userRepository.get(nextTurnUserId) : null;
        let warEndMessage = '';
        if (newWar.status === 'completed') {
            const winnerSect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(newWar.winner_sect_id);
            warEndMessage = `\n\n🏆 **CHIẾN TRANH KẾT THÚC!** **${winnerSect?.name || 'Không xác định'}** chiến thắng!`;
        }
        // Hiển thị cân bằng phe phái
        let factionText = '';
        if (underdogAtkMult > 1.0) {
            factionText = `\n🐉 **Hào Khí Nghịch Thiên!** Phe yếu tấn công +${Math.round((underdogAtkMult - 1) * 100)}%`;
        }
        if (zergDmgReduction < 1.0) {
            factionText += `\n🛡️ **Hỗn Loạn Hàng Ngũ!** Phe đông giảm -${Math.round((1 - zergDmgReduction) * 100)}% sát thương`;
        }
        return {
            success: true,
            message: `⚔️ **${user.name}** tung chiêu! ${critText}\nGây **${finalDamage}** sát thương lên **${targetName}**!${factionText}\n\n` +
                `HP **${this.getSectInfo(war.challenger_sect_id)?.name}**: ${hpChallenger}❤️\n` +
                `HP **${this.getSectInfo(war.defender_sect_id)?.name}**: ${hpDefender}❤️\n` +
                `Hiệp: **${newWar.current_round}/${war.max_rounds}**${warEndMessage}\n` +
                (nextUser ? `\n⏳ Đến lượt: **${nextUser.name}**` : '')
        };
    }
    /**
     * Phát thưởng cho phe thắng
     */
    distributeRewards(warId, winnerSectId) {
        const winnerParticipants = database_1.default.prepare("SELECT * FROM guild_war_participants WHERE war_id = ? AND sect_id = ?").all(warId, winnerSectId);
        const war = database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ?").get(warId);
        // Cân Bằng Phe Phái: xác định loser để tính underdog reward
        const loserSectId = war.challenger_sect_id === winnerSectId ? war.defender_sect_id : war.challenger_sect_id;
        const { sectService } = require('./SectService');
        const underdogMult = sectService.getUnderdogRewardMultiplier(winnerSectId, loserSectId);
        for (const p of winnerParticipants) {
            const member = UserRepository_1.userRepository.get(p.user_id);
            if (!member)
                continue;
            // Phần thưởng dựa trên đóng góp
            const totalDamage = winnerParticipants.reduce((s, p2) => s + p2.damage_dealt, 0) || 1;
            const share = p.damage_dealt / totalDamage;
            const baseCoin = 500;
            const baseExp = 1000;
            const baseContribution = 300;
            const rewardCoin = Math.round(baseCoin * share * underdogMult);
            const rewardExp = Math.round(baseExp * share * underdogMult);
            const contrReward = Math.round(baseContribution * share * underdogMult);
            database_1.default.transaction(() => {
                UserRepository_1.userRepository.update(p.user_id, {
                    coin_ha_pham: member.coin_ha_pham + rewardCoin,
                    tu_vi: Math.min(member.tu_vi + rewardExp, member.exp_needed),
                    sect_contribution: (member.sect_contribution || 0) + contrReward
                });
                // Thưởng rương cho MVP (dễ lấy hơn nếu underdog)
                const mvpThreshold = underdogMult > 1.0 ? 0.25 : 0.4;
                if (share >= mvpThreshold) {
                    const bonusChests = underdogMult > 1.0 ? Math.floor(underdogMult) : 1;
                    InventoryRepository_1.inventoryRepository.addItem(p.user_id, itemConstants_1.ITEMS.LUCKY_CHEST, bonusChests);
                }
            })();
            // Audit log
            const { systemConfigService } = require('./SystemConfigService');
            systemConfigService.writeAuditLog(p.user_id, 'guild_war_reward', {
                warId,
                rewardCoin,
                rewardExp,
                contrReward,
                underdogMult
            });
        }
        // Tặng tài nguyên cho Tông Môn thắng
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(winnerSectId);
        if (sect) {
            const baseResources = 2000 + war.current_round * 500;
            const rewardResources = Math.round(baseResources * underdogMult);
            database_1.default.prepare('UPDATE sects SET resources = resources + ?, exp = exp + ? WHERE id = ?')
                .run(rewardResources, rewardResources, winnerSectId);
        }
    }
    /**
     * Lấy bảng xếp hạng chiến tranh tông môn
     */
    getLeaderboard() {
        // Thống kê từ các cuộc chiến đã kết thúc
        const completedWars = database_1.default.prepare("SELECT * FROM guild_wars WHERE status = 'completed'").all();
        const stats = new Map();
        for (const war of completedWars) {
            const challengerSect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(war.challenger_sect_id);
            const defenderSect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(war.defender_sect_id);
            if (challengerSect) {
                const s = stats.get(war.challenger_sect_id) || { wins: 0, losses: 0, totalDamage: 0, sectName: challengerSect.name };
                if (war.winner_sect_id === war.challenger_sect_id)
                    s.wins++;
                else
                    s.losses++;
                s.totalDamage += war.challenger_score || 0;
                stats.set(war.challenger_sect_id, s);
            }
            if (defenderSect) {
                const s = stats.get(war.defender_sect_id) || { wins: 0, losses: 0, totalDamage: 0, sectName: defenderSect.name };
                if (war.winner_sect_id === war.defender_sect_id)
                    s.wins++;
                else
                    s.losses++;
                s.totalDamage += war.defender_score || 0;
                stats.set(war.defender_sect_id, s);
            }
        }
        return Array.from(stats.entries())
            .map(([sectId, data]) => ({ sectId, ...data }))
            .sort((a, b) => b.wins - a.wins || b.totalDamage - a.totalDamage)
            .slice(0, 10);
    }
    /**
     * Lấy thông tin chi tiết cuộc chiến
     */
    getWarDetail(warId) {
        return database_1.default.prepare("SELECT * FROM guild_wars WHERE id = ?").get(warId);
    }
    /**
     * Lấy lịch sử tấn công của một cuộc chiến
     */
    getAttackLogs(warId, limit = 20) {
        const logs = database_1.default.prepare(`
      SELECT l.* FROM guild_war_attack_logs l
      WHERE l.war_id = ?
      ORDER BY l.id DESC
      LIMIT ?
    `).all(warId, limit);
        return logs.map(l => {
            const attacker = UserRepository_1.userRepository.get(l.attacker_id);
            const target = l.target_id ? UserRepository_1.userRepository.get(l.target_id) : null;
            return {
                round: l.round_number,
                attackerName: attacker?.name || 'Không xác định',
                targetName: target?.name || 'Tông Môn',
                damage: l.damage,
                description: l.description
            };
        });
    }
    /**
     * Lấy danh sách participant của một cuộc chiến
     */
    getParticipants(warId) {
        return database_1.default.prepare("SELECT * FROM guild_war_participants WHERE war_id = ? ORDER BY damage_dealt DESC").all(warId);
    }
    /**
     * Kiểm tra xem user có đang trong war active không
     */
    getUserActiveWar(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return null;
        return database_1.default.prepare("SELECT * FROM guild_wars WHERE (challenger_sect_id = ? OR defender_sect_id = ?) AND status IN ('pending', 'active') ORDER BY created_at DESC LIMIT 1").get(user.sect_id, user.sect_id);
    }
    // ──── Internal Sect Tournament ────
    tournaments = new Map();
    /**
     * Tông Chủ mở giải đấu nội bộ
     */
    startTournament(sectId, masterId) {
        if (this.tournaments.has(sectId)) {
            const t = this.tournaments.get(sectId);
            if (t.status !== 'finished') {
                return { success: false, message: 'Tông Môn này đang có giải đấu đang diễn ra!' };
            }
        }
        this.tournaments.set(sectId, {
            sectId,
            masterId,
            participants: [],
            status: 'open',
            winnerId: null,
            startedAt: Date.now()
        });
        return { success: true, message: '🏟️ **Giải Đấu Nội Bộ** đã được mở! Các đệ tử hãy dùng `/tongmon tthi thamgia` để ghi danh!' };
    }
    /**
     * Thành viên tham gia giải đấu
     */
    joinTournament(sectId, userId, userName) {
        const t = this.tournaments.get(sectId);
        if (!t)
            return { success: false, message: 'Tông Môn này chưa mở giải đấu nào!' };
        if (t.status !== 'open')
            return { success: false, message: 'Giải đấu đã bắt đầu hoặc kết thúc, không thể tham gia!' };
        if (t.participants.includes(userId))
            return { success: false, message: 'Đạo hữu đã đăng ký tham gia rồi!' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || user.level < 10)
            return { success: false, message: 'Cần đạt ít nhất cấp 10 để tham gia giải đấu!' };
        t.participants.push(userId);
        return { success: true, message: `✅ **${userName}** đã đăng ký tham gia giải đấu nội bộ! (${t.participants.length} người tham gia)` };
    }
    /**
     * Tông Chủ kết thúc giải đấu, hệ thống tự động mô phỏng đấu và trao thưởng
     */
    endTournament(sectId, masterId) {
        const t = this.tournaments.get(sectId);
        if (!t)
            return { success: false, message: 'Tông Môn này không có giải đấu nào!' };
        if (t.masterId !== masterId)
            return { success: false, message: 'Chỉ có Tông Chủ mới có quyền kết thúc giải đấu!' };
        if (t.status === 'finished')
            return { success: false, message: 'Giải đấu này đã kết thúc rồi!' };
        if (t.participants.length < 2) {
            this.tournaments.delete(sectId);
            return { success: false, message: 'Cần ít nhất 2 người tham gia để tổ chức giải đấu! Đã hủy giải.' };
        }
        t.status = 'fighting';
        // Mô phỏng đấu loại trực tiếp
        const shuffled = [...t.participants].sort(() => Math.random() - 0.5);
        let round = 1;
        let remaining = [...shuffled];
        const logs = [];
        while (remaining.length > 1) {
            const nextRound = [];
            logs.push(`─── **Vòng ${round}** ───`);
            for (let i = 0; i < remaining.length; i += 2) {
                if (i + 1 >= remaining.length) {
                    nextRound.push(remaining[i]);
                    const p = UserRepository_1.userRepository.get(remaining[i]);
                    logs.push(`🔄 **${p?.name || 'Vô danh'}** được miễn đấu vòng này.`);
                    continue;
                }
                const a = remaining[i];
                const b = remaining[i + 1];
                const pA = UserRepository_1.userRepository.get(a);
                const pB = UserRepository_1.userRepository.get(b);
                // So sánh cấp + random để quyết định thắng thua
                const scoreA = (pA?.level || 1) + Math.random() * 5;
                const scoreB = (pB?.level || 1) + Math.random() * 5;
                const winner = scoreA >= scoreB ? a : b;
                const loser = scoreA >= scoreB ? b : a;
                const wName = (scoreA >= scoreB ? pA?.name : pB?.name) || 'Vô danh';
                const lName = (scoreA >= scoreB ? pB?.name : pA?.name) || 'Vô danh';
                nextRound.push(winner);
                logs.push(`⚔️ **${wName}** (Cấp ${pA?.level || '?'}) vs **${lName}** (Cấp ${pB?.level || '?'}) → **${wName}** thắng!`);
            }
            remaining = nextRound;
            round++;
        }
        t.status = 'finished';
        t.winnerId = remaining[0];
        const winner = UserRepository_1.userRepository.get(remaining[0]);
        const winnerName = winner?.name || 'Vô danh';
        const winnerLevel = winner?.level || 1;
        // Trao thưởng Tông Môn Điểm
        const rewardSectContribution = Math.min(500, 50 + winnerLevel * 5);
        const rewardKNB = 2;
        const allRewardContribution = 10;
        database_1.default.transaction(() => {
            // Thưởng cho quán quân
            UserRepository_1.userRepository.update(remaining[0], {
                sect_contribution: (winner?.sect_contribution || 0) + rewardSectContribution,
                knb: (winner?.knb || 0) + rewardKNB
            });
            // Thưởng consulation cho tất cả người tham gia
            for (const pid of t.participants) {
                if (pid === remaining[0])
                    continue;
                const p = UserRepository_1.userRepository.get(pid);
                if (p) {
                    UserRepository_1.userRepository.update(pid, {
                        sect_contribution: (p.sect_contribution || 0) + allRewardContribution
                    });
                }
            }
        })();
        const fightLog = logs.join('\n');
        return {
            success: true,
            message: `🏆 **GIẢI ĐẤU NỘI BỘ KẾT THÚC!**\n\n${fightLog}\n\n─── **KẾT QUẢ CHUNG CUỘC** ───\n🥇 **${winnerName}** - Vô địch giải đấu!\n• Nhận **+${rewardSectContribution}** Tông Môn Điểm\n• Nhận **+${rewardKNB}** KNB\n🎁 Các đấu thủ khác nhận **+${allRewardContribution}** Tông Môn Điểm.`,
            rewards: {
                winner: winnerName,
                winnerId: remaining[0],
                participants: t.participants.length
            }
        };
    }
    /**
     * Xem thông tin giải đấu nội bộ
     */
    getTournamentInfo(sectId) {
        const t = this.tournaments.get(sectId);
        if (!t)
            return null;
        const participantNames = t.participants.map(pid => {
            const u = UserRepository_1.userRepository.get(pid);
            return u?.name || 'Vô danh';
        });
        let winnerName;
        if (t.winnerId) {
            const w = UserRepository_1.userRepository.get(t.winnerId);
            winnerName = w?.name;
        }
        return {
            active: t.status !== 'finished',
            participants: participantNames,
            status: t.status,
            winnerName
        };
    }
    /**
     * Rời khỏi giải đấu (chỉ khi đang mở đăng ký)
     */
    leaveTournament(sectId, userId) {
        const t = this.tournaments.get(sectId);
        if (!t)
            return { success: false, message: 'Tông Môn này không có giải đấu nào!' };
        if (t.status !== 'open')
            return { success: false, message: 'Giải đấu đã bắt đầu, không thể rút lui!' };
        const idx = t.participants.indexOf(userId);
        if (idx === -1)
            return { success: false, message: 'Đạo hữu chưa đăng ký tham gia!' };
        t.participants.splice(idx, 1);
        return { success: true, message: '🚫 Đạo hữu đã rút khỏi giải đấu.' };
    }
    /**
     * Xóa bộ nhớ giải đấu đã kết thúc (dọn dẹp)
     */
    cleanupTournaments() {
        const now = Date.now();
        for (const [sectId, t] of this.tournaments) {
            if (t.status === 'finished' && now - t.startedAt > 3600000) {
                this.tournaments.delete(sectId);
            }
        }
    }
}
exports.guildWarService = new GuildWarService();
