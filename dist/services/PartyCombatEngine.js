"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartyCombatEngine = void 0;
const PartyService_1 = require("./PartyService");
/**
 * PartyCombatEngine - Engine chiến đấu tổ đội 3 người chống Boss
 *
 * Mechanics:
 * - Turn-based theo Speed (người chơi đánh trước nếu Speed cao hơn Boss)
 * - Boss AI: 30% tấn công diện rộng (AoE), 70% target HP thấp nhất
 * - Player order: sắp xếp theo Speed giảm dần
 * - Phần thưởng chia theo % damage đóng góp
 */
class PartyCombatEngine {
    /**
     * Chạy trận đấu tổ đội 3v1 chống Boss
     */
    static run(members, boss, maxRounds = 40) {
        let bossHp = boss.hp;
        const bossMaxHp = boss.maxHp;
        const aliveMembers = members.filter(m => m.isAlive);
        const damageByPlayer = new Map();
        for (const m of members) {
            damageByPlayer.set(m.userId, 0);
        }
        const log = [];
        // Sắp xếp thành viên theo Speed giảm dần
        const sortedMembers = [...aliveMembers].sort((a, b) => (b.combatant.speed || 100) - (a.combatant.speed || 100));
        const bossSpeed = boss.speed || 90;
        const playerGoesFirst = sortedMembers.length > 0 &&
            (sortedMembers[0].combatant.speed || 100) >= bossSpeed;
        log.push(`⚔️ **TRẬN CHIẾN TỔ ĐỘI BẮT ĐẦU!**`);
        log.push(`👥 Thành viên: ${sortedMembers.map(m => `**${m.name}**`).join(', ')}`);
        log.push(`👹 Boss: **${boss.name}** (HP: ${bossHp}/${bossMaxHp} | Công: ${boss.atk} | Thủ: ${boss.def})`);
        const userIds = members.map(m => m.userId);
        const cycleInfo = (0, PartyService_1.checkPartyElementalCycle)(userIds);
        log.push(cycleInfo.text);
        if (cycleInfo.active) {
            for (const m of sortedMembers) {
                if (m.combatant) {
                    m.combatant.atk = Math.round(m.combatant.atk * 1.10);
                    m.combatant.def = Math.round(m.combatant.def * 1.10);
                }
            }
        }
        if (sortedMembers.length < members.length) {
            log.push(`💀 **${members.length - sortedMembers.length}** thành viên đã tử trận trước đó!`);
        }
        let round = 1;
        while (bossHp > 0 && sortedMembers.some(m => m.isAlive) && round <= maxRounds) {
            log.push(`\n=== ⏳ **Hiệp ${round}** ===`);
            if (playerGoesFirst) {
                // Lượt người chơi
                for (const member of sortedMembers) {
                    if (!member.isAlive || bossHp <= 0)
                        continue;
                    bossHp = this.executePlayerTurn(member, boss, bossHp, bossMaxHp, damageByPlayer, log);
                }
                // Lượt Boss
                if (bossHp > 0) {
                    bossHp = this.executeBossTurn(boss, bossHp, bossMaxHp, sortedMembers, log);
                }
            }
            else {
                // Lượt Boss trước
                if (bossHp > 0) {
                    bossHp = this.executeBossTurn(boss, bossHp, bossMaxHp, sortedMembers, log);
                }
                // Lượt người chơi
                for (const member of sortedMembers) {
                    if (!member.isAlive || bossHp <= 0)
                        continue;
                    bossHp = this.executePlayerTurn(member, boss, bossHp, bossMaxHp, damageByPlayer, log);
                }
            }
            // Kiểm tra thành viên nào chết
            for (const member of sortedMembers) {
                if (member.hp <= 0) {
                    member.isAlive = false;
                    log.push(`💀 **${member.name}** đã kiệt sức ngã xuống!`);
                }
            }
            round++;
        }
        const victory = bossHp <= 0;
        if (victory) {
            log.push(`\n🏆 **CHIẾN THẮNG!** Cả đội đã tiêu diệt **${boss.name}** sau ${round - 1} hiệp!`);
        }
        else if (round > maxRounds) {
            log.push(`\n⏳ **Hết giờ!** Trận chiến kéo dài quá ${maxRounds} hiệp mà chưa phân thắng bại!`);
        }
        else {
            log.push(`\n💀 **THẤT BẠI!** Cả đội đã bị **${boss.name}** đánh bại!`);
        }
        // Tính phần thưởng dựa trên % damage
        const totalDamage = Array.from(damageByPlayer.values()).reduce((a, b) => a + b, 0) || 1;
        const baseExp = victory ? 2000 : 500;
        const baseCoins = victory ? 500 : 100;
        const rewards = {
            exp: baseExp,
            coins: baseCoins,
            loots: []
        };
        return {
            victory,
            rounds: round - 1,
            bossHpRemaining: bossHp,
            bossMaxHp,
            damageByPlayer,
            rewards,
            log
        };
    }
    static executePlayerTurn(member, boss, bossHp, bossMaxHp, damageByPlayer, log) {
        if (!member.isAlive || bossHp <= 0)
            return 0;
        // Tính sát thương
        const critRate = Math.max(0.05, member.combatant.crit - boss.critRes) + (member.combatant.luck || 10) * 0.001;
        const isCrit = Math.random() < critRate;
        let damage = Math.max(1, member.combatant.atk - boss.def);
        damage = Math.round(damage * (0.85 + Math.random() * 0.3));
        if (isCrit)
            damage = Math.round(damage * 1.5);
        // Cộng dồn sát thương
        const currentDmg = damageByPlayer.get(member.userId) || 0;
        damageByPlayer.set(member.userId, currentDmg + damage);
        // Sủng thú hỗ trợ
        let petDmgText = '';
        if (member.petAtk > 0) {
            const petDmg = Math.round(member.petAtk * (0.8 + Math.random() * 0.4));
            damage += petDmg;
            damageByPlayer.set(member.userId, (damageByPlayer.get(member.userId) || 0) + petDmg);
            petDmgText = ` (Sủng thú **${member.petName}** +${petDmg})`;
        }
        const remainingHp = Math.max(0, bossHp - damage);
        const critText = isCrit ? ' **[BẠO KÍCH]** 💥' : '';
        const hpPercent = Math.round((remainingHp / bossMaxHp) * 100);
        log.push(`⚔️ **${member.name}** tung chiêu, gây **-${damage}** sát thương lên Boss${critText}!${petDmgText} (HP Boss: ${remainingHp}/${bossMaxHp} - ${hpPercent}%)`);
        return remainingHp;
    }
    static executeBossTurn(boss, bossHp, bossMaxHp, members, log) {
        const aliveMembers = members.filter(m => m.isAlive);
        if (aliveMembers.length === 0)
            return bossHp;
        const isEnraged = bossHp <= bossMaxHp * 0.5;
        // Boss AI: 30% AoE (50% nếu Enraged), 70% target HP thấp nhất
        const aoeChance = isEnraged ? 0.5 : 0.3;
        const isAoE = Math.random() < aoeChance;
        if (isEnraged && Math.random() < 0.1) {
            // Đòn đánh đặc biệt: Triệu hồi đệ tử (hồi máu cho boss)
            const heal = Math.round(bossMaxHp * 0.05);
            bossHp = Math.min(bossMaxHp, bossHp + heal);
            log.push(`🔥 **[CUỒNG NỘ]** **${boss.name}** triệu hồi đệ tử hiến tế, hồi phục **+${heal}** HP! (HP: ${bossHp}/${bossMaxHp})`);
            return bossHp; // Mất lượt đánh để hồi máu
        }
        if (isAoE) {
            // Tấn công diện rộng - sát thương chia đều (có thưởng sát thương nếu Enraged)
            const enrageMult = isEnraged ? 1.5 : 1.0;
            let baseDmg = Math.round((boss.atk * 0.7 * enrageMult) / aliveMembers.length);
            baseDmg = Math.max(1, baseDmg);
            for (const member of aliveMembers) {
                const dmgAfterDef = Math.max(1, baseDmg - Math.round(member.combatant.def * 0.5));
                member.hp -= dmgAfterDef;
            }
            if (isEnraged) {
                log.push(`🔥 **[CUỒNG NỘ]** **${boss.name}** thi triển SÁT CHIÊU DIỆN RỘNG! Gây **${baseDmg}** sát thương lên TOÀN BỘ đội hình!`);
            }
            else {
                log.push(`👹 **${boss.name}** gầm rú **DIỆN RỘNG!** Gây **${baseDmg}** sát thương lên TOÀN BỘ đội hình!`);
            }
        }
        else {
            // Target HP thấp nhất
            const target = aliveMembers.sort((a, b) => a.hp - b.hp)[0];
            const enrageMult = isEnraged ? 1.2 : 1.0;
            let baseDmg = Math.max(1, (boss.atk * enrageMult) - target.combatant.def);
            baseDmg = Math.round(baseDmg * (0.9 + Math.random() * 0.2));
            const isCrit = Math.random() < boss.crit;
            if (isCrit)
                baseDmg = Math.round(baseDmg * 1.5);
            target.hp -= baseDmg;
            const critText = isCrit ? ' **[BẠO KÍCH]** 💥' : '';
            log.push(`👹 **${boss.name}** nhắm **${target.name}** (HP thấp nhất), gây **-${baseDmg}** sát thương!${critText} (${target.name} còn: ${Math.max(0, target.hp)} HP)`);
        }
        return bossHp;
    }
    /**
     * Chia phần thưởng dựa trên % damage đóng góp
     */
    static distributeRewards(result, bossLevel) {
        const totalDamage = Array.from(result.damageByPlayer.values()).reduce((a, b) => a + b, 0) || 1;
        const rewards = new Map();
        const baseExp = result.victory ? 2000 + bossLevel * 500 : 500 + bossLevel * 100;
        const baseCoins = result.victory ? 500 + bossLevel * 200 : 100 + bossLevel * 50;
        const memberCount = result.damageByPlayer.size || 1;
        const equalExp = Math.round((baseExp * 0.7) / memberCount);
        const equalCoins = Math.round((baseCoins * 0.7) / memberCount);
        for (const [userId, damage] of result.damageByPlayer) {
            const share = damage / totalDamage;
            const contributionExp = Math.round(baseExp * 0.3 * share);
            const contributionCoins = Math.round(baseCoins * 0.3 * share);
            rewards.set(userId, {
                exp: equalExp + contributionExp,
                coins: equalCoins + contributionCoins
            });
        }
        // Bonus cho người gây sát thương cao nhất
        const topContributor = Array.from(result.damageByPlayer.entries())
            .sort(([, a], [, b]) => b - a)[0];
        if (topContributor && result.victory) {
            const topReward = rewards.get(topContributor[0]);
            if (topReward) {
                topReward.exp += Math.round(baseExp * 0.2);
                topReward.coins += Math.round(baseCoins * 0.2);
            }
        }
        return rewards;
    }
}
exports.PartyCombatEngine = PartyCombatEngine;
exports.default = PartyCombatEngine;
