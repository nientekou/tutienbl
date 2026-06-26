"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sectWarService = exports.SECT_MINES = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const CombatEngine_1 = require("./CombatEngine");
const MAX_ATTACKS_PER_WEEK = 5;
const MATCH_INTERVAL_DAYS = 7;
exports.SECT_MINES = [
    { id: 'mo_nho', name: 'Mỏ Linh Thạch Nhỏ', income: 500, level_req: 1, guard_hp: 5000, guard_atk: 100, guard_def: 50 },
    { id: 'mo_vua', name: 'Mỏ Linh Thạch Vừa', income: 1500, level_req: 3, guard_hp: 20000, guard_atk: 300, guard_def: 150 },
    { id: 'mo_lon', name: 'Mỏ Linh Thạch Lớn', income: 5000, level_req: 5, guard_hp: 100000, guard_atk: 800, guard_def: 400 },
];
class SectWarService {
    getOrCreateSeason() {
        let season = database_1.default.prepare("SELECT * FROM sect_war_seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        if (!season) {
            const now = Math.floor(Date.now() / 1000);
            const lastSeason = database_1.default.prepare("SELECT MAX(season_number) as max_num FROM sect_war_seasons").get();
            const nextNum = (lastSeason?.max_num || 0) + 1;
            database_1.default.prepare(`
        INSERT INTO sect_war_seasons (season_number, started_at, status)
        VALUES (?, ?, 'active')
      `).run(nextNum, now);
            season = database_1.default.prepare("SELECT * FROM sect_war_seasons WHERE season_number = ?").get(nextNum);
        }
        return season;
    }
    getSeasonById(seasonId) {
        return database_1.default.prepare('SELECT * FROM sect_war_seasons WHERE id = ?').get(seasonId);
    }
    endSeason(seasonId) {
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare("UPDATE sect_war_seasons SET status = 'ended', ended_at = ? WHERE id = ?").run(now, seasonId);
        database_1.default.prepare("UPDATE sect_war_battles SET status = 'completed' WHERE season_id = ? AND status = 'active'").run(seasonId);
    }
    getSectWarScore(sectId) {
        const season = this.getOrCreateSeason();
        const row = database_1.default.prepare(`
      SELECT COALESCE(SUM(swps.damage_dealt), 0) as total_damage,
             COALESCE(SUM(swps.wins), 0) as total_wins,
             COALESCE(SUM(swps.battles_fought), 0) as total_battles
      FROM sect_war_participant_scores swps
      WHERE swps.season_id = ? AND swps.sect_id = ?
    `).get(season.id, sectId);
        return row;
    }
    getSectLeaderboard() {
        const season = this.getOrCreateSeason();
        const rows = database_1.default.prepare(`
      SELECT swps.sect_id,
             (SELECT name FROM sects WHERE id = swps.sect_id) as sect_name,
             (SELECT level FROM sects WHERE id = swps.sect_id) as level,
             SUM(swps.damage_dealt) as total_damage,
             SUM(swps.wins) as total_wins,
             SUM(swps.battles_fought) as total_battles
      FROM sect_war_participant_scores swps
      WHERE swps.season_id = ?
      GROUP BY swps.sect_id
      ORDER BY total_damage DESC, total_wins DESC
      LIMIT 20
    `).all(season.id);
        return rows;
    }
    getUserWeeklyAttacks(userId, seasonId) {
        const row = database_1.default.prepare(`
      SELECT COALESCE(SUM(swps.battles_fought), 0) as fought
      FROM sect_war_participant_scores swps
      JOIN sect_war_battles swb ON swps.battle_id = swb.id
      WHERE swps.user_id = ? AND swps.season_id = ?
    `).get(userId, seasonId);
        return row.fought;
    }
    getActiveBattlesForSect(sectId) {
        const season = this.getOrCreateSeason();
        const rows = database_1.default.prepare(`
      SELECT * FROM sect_war_battles
      WHERE season_id = ? AND status = 'active'
        AND instr(sect_ids, ?) > 0
      ORDER BY created_at DESC
    `).all(season.id, sectId.toString());
        return rows.map((r) => ({
            ...r,
            sect_ids: JSON.parse(r.sect_ids || '[]'),
            scores: JSON.parse(r.scores || '{}'),
        }));
    }
    joinBattle(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        if (!user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const season = this.getOrCreateSeason();
        const weekAttacks = this.getUserWeeklyAttacks(userId, season.id);
        if (weekAttacks >= MAX_ATTACKS_PER_WEEK) {
            return { success: false, message: `Đạo hữu đã dùng hết **${MAX_ATTACKS_PER_WEEK}** lượt trong tuần này! Tuần sau quay lại.` };
        }
        // Tìm battle đang active cho sect này, nếu không có thì tạo mới
        const activeBattles = this.getActiveBattlesForSect(user.sect_id);
        let battle = activeBattles.length > 0 ? activeBattles[0] : null;
        if (!battle) {
            // Tạo battle mới: match với 2 sect khác có level gần nhất
            const now = Math.floor(Date.now() / 1000);
            const sectLevel = database_1.default.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id);
            if (!sectLevel)
                return { success: false, message: 'Lỗi truy vấn Tông Môn.' };
            const candidates = database_1.default.prepare(`
        SELECT id FROM sects
        WHERE id != ? AND id IN (SELECT DISTINCT sect_id FROM users WHERE sect_id IS NOT NULL)
        ORDER BY ABS(level - ?) ASC
        LIMIT 2
      `).all(user.sect_id, sectLevel.level);
            if (candidates.length < 2) {
                return { success: false, message: 'Không đủ Tông Môn khác để ghép trận! (Cần ít nhất 3 Tông Môn hoạt động).' };
            }
            const sectIds = [user.sect_id, candidates[0].id, candidates[1].id];
            database_1.default.prepare(`
        INSERT INTO sect_war_battles (season_id, round_number, sect_ids, scores, status, created_at)
        VALUES (?, 1, ?, '{}', 'active', ?)
      `).run(season.id, JSON.stringify(sectIds), now);
            const rawBattle = database_1.default.prepare('SELECT * FROM sect_war_battles WHERE created_at = ? AND season_id = ?').get(now, season.id);
            if (!rawBattle)
                return { success: false, message: 'Lỗi tạo trận đấu.' };
            rawBattle.sect_ids = JSON.parse(rawBattle.sect_ids || '[]');
            rawBattle.scores = JSON.parse(rawBattle.scores || '{}');
            battle = rawBattle;
        }
        if (!battle)
            return { success: false, message: 'Không thể tạo trận đấu.' };
        // Thêm người chơi vào participant_scores
        const existing = database_1.default.prepare('SELECT id FROM sect_war_participant_scores WHERE battle_id = ? AND user_id = ?').get(battle.id, userId);
        if (!existing) {
            database_1.default.prepare(`
        INSERT INTO sect_war_participant_scores (battle_id, season_id, user_id, sect_id)
        VALUES (?, ?, ?, ?)
      `).run(battle.id, season.id, userId, user.sect_id);
        }
        return { success: true, message: `✅ Tham gia trận đấu thành công!`, battleId: battle.id };
    }
    attack(userId, targetUserId) {
        const user = UserRepository_1.userRepository.get(userId);
        const target = UserRepository_1.userRepository.get(targetUserId);
        if (!user || !target)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        if (!user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const season = this.getOrCreateSeason();
        const weekAttacks = this.getUserWeeklyAttacks(userId, season.id);
        if (weekAttacks >= MAX_ATTACKS_PER_WEEK) {
            return { success: false, message: 'Hết lượt tấn công trong tuần!' };
        }
        // Kiểm tra cùng battle
        const battles = this.getActiveBattlesForSect(user.sect_id);
        if (battles.length === 0)
            return { success: false, message: 'Không có trận đấu nào đang diễn ra! Hãy dùng `/sectwar thamgia` trước.' };
        const battle = battles[0];
        const targetSectId = target.sect_id;
        if (!targetSectId || !battle.sect_ids.includes(targetSectId)) {
            return { success: false, message: 'Mục tiêu không nằm trong trận đấu của bạn!' };
        }
        if (targetSectId === user.sect_id) {
            return { success: false, message: 'Không thể tấn công đồng môn!' };
        }
        // Combat via CombatEngine
        const { inventoryService } = require('./InventoryService');
        const playerStats = inventoryService.getActiveStats(userId);
        const targetStats = inventoryService.getActiveStats(targetUserId);
        if (!playerStats || !targetStats) {
            return { success: false, message: 'Lỗi tính toán chỉ số chiến đấu!' };
        }
        // Áp dụng hình phạt Chính Đạo (-5% ATK trong PvP)
        let finalPlayerAtk = playerStats.atk;
        if (user.alignment === 'orthodox') {
            finalPlayerAtk = Math.round(finalPlayerAtk * 0.95);
        }
        let finalTargetAtk = targetStats.atk;
        if (target.alignment === 'orthodox') {
            finalTargetAtk = Math.round(finalTargetAtk * 0.95);
        }
        const { soulImprintService } = require('./SoulImprintService');
        const playerCombatant = {
            name: user.name,
            hp: playerStats.hp,
            maxHp: playerStats.hp,
            atk: finalPlayerAtk,
            def: playerStats.def,
            crit: playerStats.crit,
            critRes: playerStats.critRes,
            luck: playerStats.luck,
            speed: playerStats.speed,
            dodge: playerStats.dodge,
            linhCan: user.linh_can || '{}',
            hasOai: soulImprintService.hasOaiActive(userId)
        };
        const targetCombatant = {
            name: target.name,
            hp: targetStats.hp,
            maxHp: targetStats.hp,
            atk: finalTargetAtk,
            def: targetStats.def,
            crit: targetStats.crit,
            critRes: targetStats.critRes,
            luck: targetStats.luck,
            speed: targetStats.speed,
            dodge: targetStats.dodge,
            linhCan: target.linh_can || '{}',
            hasOai: soulImprintService.hasOaiActive(targetUserId)
        };
        const result = CombatEngine_1.CombatEngine.run(playerCombatant, targetCombatant, null, 10);
        const isWin = result.winner === 'player';
        const damage = result.totalDamageDealt;
        // Cập nhật điểm số
        const scores = { ...battle.scores };
        scores[user.sect_id] = (scores[user.sect_id] || 0) + damage;
        const now = Math.floor(Date.now() / 1000);
        database_1.default.transaction(() => {
            database_1.default.prepare('UPDATE sect_war_battles SET scores = ? WHERE id = ?').run(JSON.stringify(scores), battle.id);
            const existing = database_1.default.prepare('SELECT id FROM sect_war_participant_scores WHERE battle_id = ? AND user_id = ?').get(battle.id, userId);
            if (existing) {
                database_1.default.prepare(`
          UPDATE sect_war_participant_scores
          SET damage_dealt = damage_dealt + ?,
              wins = wins + ?,
              losses = losses + ?,
              battles_fought = battles_fought + 1
          WHERE id = ?
        `).run(damage, isWin ? 1 : 0, isWin ? 0 : 1, existing.id);
            }
            else {
                database_1.default.prepare(`
          INSERT INTO sect_war_participant_scores (battle_id, season_id, user_id, sect_id, damage_dealt, wins, losses, battles_fought)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(battle.id, season.id, userId, user.sect_id, damage, isWin ? 1 : 0, isWin ? 0 : 1);
            }
        })();
        return {
            success: true,
            message: `⚔️ **${user.name}** tấn công **${target.name}**!\n${result.log.slice(0, 3).join('\n')}\n💥 Sát thương gây ra: **${damage}** | Kết quả: **${isWin ? 'THẮNG 🏆' : 'BẠI 💀'}**`,
            damage,
        };
    }
    getBattleDetails(battleId) {
        const row = database_1.default.prepare('SELECT * FROM sect_war_battles WHERE id = ?').get(battleId);
        if (!row)
            return null;
        return {
            ...row,
            sect_ids: JSON.parse(row.sect_ids || '[]'),
            scores: JSON.parse(row.scores || '{}'),
        };
    }
    getParticipantStats(battleId) {
        const rows = database_1.default.prepare(`
      SELECT swps.*, (SELECT name FROM users WHERE discord_id = swps.user_id) as user_name
      FROM sect_war_participant_scores swps
      WHERE swps.battle_id = ?
      ORDER BY swps.damage_dealt DESC
    `).all(battleId);
        return rows;
    }
    distributeSeasonRewards() {
        const season = this.getOrCreateSeason();
        if (season.status !== 'active')
            return;
        const leaderboard = this.getSectLeaderboard();
        const now = Math.floor(Date.now() / 1000);
        const rewardPool = [50000, 30000, 15000, 8000, 5000, 3000, 2000, 1000, 500, 300];
        for (let i = 0; i < Math.min(leaderboard.length, rewardPool.length); i++) {
            const entry = leaderboard[i];
            const reward = rewardPool[i];
            const members = database_1.default.prepare('SELECT discord_id FROM users WHERE sect_id = ?').all(entry.sect_id);
            if (members.length === 0)
                continue;
            const sharePerMember = Math.floor(reward / members.length);
            for (const m of members) {
                UserRepository_1.userRepository.update(m.discord_id, { coin_trung_pham: database_1.default.prepare('SELECT coin_trung_pham FROM users WHERE discord_id = ?').get(m.discord_id)?.coin_trung_pham + sharePerMember || sharePerMember });
            }
        }
        this.endSeason(season.id);
        console.log(`✅ Đã kết thúc mùa giải #${season.season_number} và phát thưởng.`);
    }
    // === MỎ LINH THẠCH (TERRITORY CONTROL) ===
    getMinesState() {
        const rows = database_1.default.prepare('SELECT * FROM mine_ownership').all();
        return rows.map(r => {
            const sect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(r.sect_id);
            return { ...r, sect_name: sect ? sect.name : 'Vô Danh' };
        });
    }
    captureMine(userId, mineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const mineDef = exports.SECT_MINES.find(m => m.id === mineId);
        if (!mineDef)
            return { success: false, message: 'Mỏ linh thạch không tồn tại.' };
        const sect = database_1.default.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect || sect.level < mineDef.level_req) {
            return { success: false, message: `Tông Môn của bạn chưa đạt Cấp ${mineDef.level_req} để chiếm mỏ này.` };
        }
        const currentOwnership = database_1.default.prepare('SELECT * FROM mine_ownership WHERE mine_id = ?').get(mineId);
        if (currentOwnership && currentOwnership.sect_id === user.sect_id) {
            return { success: false, message: 'Tông Môn của bạn đã sở hữu mỏ này rồi!' };
        }
        // Combat với Hộ Vệ Mỏ (hoặc Tông Môn đang giữ)
        const { inventoryService } = require('./InventoryService');
        const playerStats = inventoryService.getActiveStats(userId);
        if (!playerStats) {
            return { success: false, message: 'Lỗi tính toán chỉ số chiến đấu!' };
        }
        const { soulImprintService } = require('./SoulImprintService');
        const playerCombatant = {
            name: user.name,
            hp: playerStats.hp,
            maxHp: playerStats.hp,
            atk: playerStats.atk,
            def: playerStats.def,
            crit: playerStats.crit,
            critRes: playerStats.critRes,
            luck: playerStats.luck,
            speed: playerStats.speed,
            dodge: playerStats.dodge,
            linhCan: user.linh_can || '{}',
            hasOai: soulImprintService.hasOaiActive(userId)
        };
        const guardCombatant = {
            name: `Hộ Vệ ${mineDef.name}`,
            hp: mineDef.guard_hp,
            maxHp: mineDef.guard_hp,
            atk: mineDef.guard_atk,
            def: mineDef.guard_def,
            crit: 0.1,
            critRes: 0.1,
            luck: 10,
            speed: 120,
            dodge: 0.1,
            linhCan: '{}',
        };
        // Đánh Boss/Guard
        const result = CombatEngine_1.CombatEngine.run(playerCombatant, guardCombatant, null, 15);
        const isWin = result.winner === 'player';
        if (!isWin) {
            return { success: false, message: `💀 Thất bại! Đạo hữu không đánh bại được Hộ Vệ Mỏ.\nSát thương gây ra: **${result.totalDamageDealt}**`, log: result.log };
        }
        // Chiếm thành công
        const now = Math.floor(Date.now() / 1000);
        if (currentOwnership) {
            database_1.default.prepare(`
        UPDATE mine_ownership 
        SET sect_id = ?, captured_at = ?, last_claimed_at = ?, total_income = 0
        WHERE mine_id = ?
      `).run(user.sect_id, now, now, mineId);
        }
        else {
            database_1.default.prepare(`
        INSERT INTO mine_ownership (mine_id, sect_id, captured_at, last_claimed_at, total_income)
        VALUES (?, ?, ?, ?, 0)
      `).run(mineId, user.sect_id, now, now);
        }
        return { success: true, message: `🏆 Chúc mừng! Tông Môn của bạn đã chiếm lĩnh **${mineDef.name}** thành công!`, log: result.log };
    }
    claimMineIncome(userId, mineId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn!' };
        const ownership = database_1.default.prepare('SELECT * FROM mine_ownership WHERE mine_id = ?').get(mineId);
        if (!ownership)
            return { success: false, message: 'Mỏ này chưa có ai chiếm giữ.' };
        if (ownership.sect_id !== user.sect_id)
            return { success: false, message: 'Tông Môn của bạn không sở hữu mỏ này!' };
        const mineDef = exports.SECT_MINES.find(m => m.id === mineId);
        if (!mineDef)
            return { success: false, message: 'Mỏ không hợp lệ.' };
        const now = Math.floor(Date.now() / 1000);
        const hoursElapsed = (now - ownership.last_claimed_at) / 3600;
        // Yêu cầu ít nhất 4h
        if (hoursElapsed < 4) {
            const remaining = Math.ceil(4 - hoursElapsed);
            return { success: false, message: `⏳ Mỏ chưa đủ linh thạch. Hãy quay lại sau **${remaining} giờ** nữa.` };
        }
        // Tính income
        const periods = Math.floor(hoursElapsed / 4); // Mỗi 4h nhận 1 lần
        const income = periods * mineDef.income;
        database_1.default.transaction(() => {
            // Thêm vào quỹ Tông Môn
            database_1.default.prepare('UPDATE sects SET resources = resources + ? WHERE id = ?').run(income, user.sect_id);
            // Cập nhật mine
            const newClaimTime = ownership.last_claimed_at + (periods * 4 * 3600);
            database_1.default.prepare('UPDATE mine_ownership SET last_claimed_at = ?, total_income = total_income + ? WHERE id = ?')
                .run(newClaimTime, income, ownership.id);
        })();
        return { success: true, message: `💰 Đã thu hoạch **${income} Linh Thạch** từ **${mineDef.name}** vào quỹ Tông Môn!` };
    }
    // === LỊCH SỬ CHIẾN TRẬN (HISTORY) ===
    getFinishedBattlesHistory() {
        return database_1.default.prepare(`
      SELECT * FROM sect_war_battles
      WHERE status = 'completed'
      ORDER BY ended_at DESC
      LIMIT 10
    `).all().map((r) => ({
            ...r,
            sect_ids: JSON.parse(r.sect_ids || '[]'),
            scores: JSON.parse(r.scores || '{}')
        }));
    }
    // === W9-01: Sect War Season — War Points & Tier Rewards ===
    /**
     * W9-01: Award war points after battle
     */
    awardWarPoints(userId, won) {
        const basePoints = won ? 10 : 2;
        // Streak bonus: up to +50% for consecutive wins
        let streakBonus = 0;
        try {
            const user = UserRepository_1.userRepository.get(userId);
            if (user && user.sect_id) {
                const recentWins = database_1.default.prepare(`
          SELECT COUNT(*) as c FROM sect_war_participant_scores swps
          WHERE swps.user_id = ? AND swps.wins > 0 AND swps.season_id = (
            SELECT id FROM sect_war_seasons WHERE status = 'active' LIMIT 1
          )
        `).get(userId);
                streakBonus = Math.min(recentWins.c * 0.10, 0.50); // +10% per win, max +50%
            }
        }
        catch { }
        const totalPoints = Math.round(basePoints * (1 + streakBonus));
        // Store war points (add to user's sect_contribution or a separate field)
        try {
            const user = UserRepository_1.userRepository.get(userId);
            if (user) {
                UserRepository_1.userRepository.update(userId, {
                    sect_contribution: user.sect_contribution + totalPoints
                });
            }
        }
        catch { }
        return { points: basePoints, streakBonus };
    }
    /**
     * W9-01: Get season ranking rewards
     */
    getSeasonRewards() {
        return [
            { rank: 'Top 1', reward: '500 KNB + "Võ Lâm Minh Chủ" title + Sect-wide buff +10% ATK next season' },
            { rank: 'Top 2-3', reward: '200 KNB + "Chiến Thần" title + Sect-wide buff +5% ATK next season' },
            { rank: 'Top 4-10', reward: '100 KNB + Rare materials' },
            { rank: 'Participating', reward: '50 KNB for all members of top 10 sects' },
        ];
    }
    /**
     * W9-01: Get season info
     */
    getSeasonInfo() {
        const season = this.getOrCreateSeason();
        const now = Math.floor(Date.now() / 1000);
        const endDate = season.ended_at || (season.started_at + 30 * 86400);
        const daysLeft = Math.max(0, Math.ceil((endDate - now) / 86400));
        return {
            seasonNumber: season.season_number,
            status: season.status,
            daysLeft
        };
    }
    // === B-02: Guild War V2 — Siege Mechanics & War Roles ===
    /**
     * B-02: Assign war role to member
     */
    assignWarRole(userId, role) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: '❌ Chưa gia nhập Tông Môn!' };
        const roleBonuses = {
            attacker: { stat: 'atk', value: 0.20 },
            defender: { stat: 'def', value: 0.20 },
            support: { stat: 'heal', value: 0.20 },
        };
        // Store role in user's y_canh JSON
        try {
            const yCanh = JSON.parse(user.y_canh || '{}');
            yCanh.war_role = role;
            UserRepository_1.userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });
        }
        catch {
            UserRepository_1.userRepository.update(userId, { y_canh: JSON.stringify({ war_role: role }) });
        }
        const bonus = roleBonuses[role];
        return {
            success: true,
            message: `⚔️ Đã chọn vai trò **${role}**!\nBonus: +${bonus.value * 100}% ${bonus.stat} trong chiến tranh`
        };
    }
    /**
     * B-02: Get war role bonus
     */
    getWarRoleBonus(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return { role: 'none', bonus: 0 };
        try {
            const yCanh = JSON.parse(user.y_canh || '{}');
            const role = yCanh.war_role || 'none';
            const bonuses = { attacker: 0.20, defender: 0.20, support: 0.20 };
            return { role, bonus: bonuses[role] || 0 };
        }
        catch {
            return { role: 'none', bonus: 0 };
        }
    }
    /**
     * B-02: Siege capture point
     */
    captureSiegePoint(userId, pointId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: '❌ Chưa gia nhập Tông Môn!' };
        const roleBonus = this.getWarRoleBonus(userId);
        const capturePower = 100 + roleBonus.bonus * 100; // Base 100 + role bonus
        // Simple capture logic
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO siege_points (point_id, sect_id, captured_at, defense_power)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(point_id) DO UPDATE SET
        sect_id = excluded.sect_id, captured_at = excluded.captured_at, defense_power = excluded.defense_power
    `).run(pointId, user.sect_id, now, capturePower);
        return {
            success: true,
            message: `🏰 Đã chiếm điểm **${pointId}**! Defense Power: ${capturePower}`
        };
    }
    /**
     * B-02: Get siege status
     */
    getSiegeStatus() {
        try {
            const points = database_1.default.prepare('SELECT * FROM siege_points').all();
            return {
                points: points.map(p => {
                    const sect = database_1.default.prepare('SELECT name FROM sects WHERE id = ?').get(p.sect_id);
                    return {
                        id: p.point_id,
                        sectId: p.sect_id,
                        sectName: sect?.name || 'Không rõ',
                        defensePower: p.defense_power
                    };
                })
            };
        }
        catch {
            return { points: [] };
        }
    }
    // === B-01: Guild War Siege Expansion ===
    /**
     * B-01: Get siege maps
     */
    getSiegeMaps() {
        return [
            { id: 'thanh_thanh', name: 'Thành Thành', description: 'Chiếm cửa thành và pháo đài', capturePoints: 5 },
            { id: 'nui_doi', name: 'Núi Đồi', description: 'Chiếm vùng cao để giành lợi thế', capturePoints: 3 },
            { id: 'song_ngu', name: 'Song Ngư', description: 'Chiến trường hai mặt — phân chia lực lượng', capturePoints: 4 },
            { id: 'huyet_truong', name: 'Huyết Trường', description: 'Tính điểm theo số mạng — không chiếm đóng', capturePoints: 0 },
        ];
    }
    /**
     * B-01: Get siege strategies
     */
    getSiegeStrategies() {
        return [
            { id: 'rush', name: 'Tấn Công Thần Tốc', description: 'Tập trung tấn công nhanh', bonus: '+20% damage trong 5 phút đầu' },
            { id: 'defend', name: 'Phòng Thủ Kiên Cố', description: 'Tập trung phòng thủ điểm chính', bonus: '+20% defense cho tất cả thành viên' },
            { id: 'split', name: 'Phân Tán Lực Lượng', description: 'Chia đều lực lượng', bonus: '+10% all stats cho tất cả' },
            { id: 'guerrilla', name: 'Du Kích', description: 'Tấn công điểm yếu của địch', bonus: '+30% damage cho 1 target' },
        ];
    }
    /**
     * B-01: Get siege spectating info
     */
    getSiegeSpectating(siegeId) {
        const viewers = database_1.default.prepare('SELECT COUNT(*) as c FROM arena_spectators WHERE match_id = ?').get(siegeId);
        const topDamage = database_1.default.prepare(`
      SELECT swps.user_id, u.name, swps.damage_dealt as damage
      FROM sect_war_participant_scores swps
      JOIN users u ON swps.user_id = u.discord_id
      WHERE swps.battle_id = ?
      ORDER BY swps.damage_dealt DESC
      LIMIT 5
    `).all(siegeId);
        return { viewers: viewers.c, topDamage };
    }
    /**
     * B-01: Get siege history
     */
    getSiegeHistory(limit = 10) {
        return database_1.default.prepare(`
      SELECT
        datetime(ended_at, 'unixepoch') as date,
        winner_sect_id as winner,
        loser_sect_id as loser,
        total_damage as score
      FROM sect_war_battles
      WHERE status = 'completed'
      ORDER BY ended_at DESC
      LIMIT ?
    `).all(limit);
    }
}
exports.sectWarService = new SectWarService();
