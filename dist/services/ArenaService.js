"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arenaService = exports.ArenaService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryService_1 = require("./InventoryService");
const NewbieProtectionService_1 = require("./NewbieProtectionService");
const CombatEngine_1 = require("./CombatEngine");
class ArenaService {
    K_FACTOR = 32;
    /**
     * Lấy hồ sơ Arena của user, nếu chưa có thì tạo mới
     */
    getProfile(userId) {
        let profile = database_1.default.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(userId);
        if (!profile) {
            database_1.default.prepare(`
        INSERT INTO arena_profiles (user_id, elo, wins, losses, win_streak, highest_elo, last_season_rank, season_id)
        VALUES (?, 1000, 0, 0, 0, 1000, 0, 'season_1')
      `).run(userId);
            profile = {
                user_id: userId, elo: 1000, wins: 0, losses: 0, win_streak: 0, highest_elo: 1000, last_season_rank: 0, season_id: 'season_1'
            };
        }
        return profile;
    }
    /**
     * Tính toán ELO thay đổi sau trận đấu
     */
    calculateEloChange(winnerElo, loserElo) {
        const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
        // Thắng được 1 điểm thực tế, Thua được 0 điểm thực tế
        const winnerGain = Math.round(this.K_FACTOR * (1 - expectedWinner));
        const loserDrop = Math.round(this.K_FACTOR * (0 - expectedLoser)); // Thường sẽ là số âm
        return {
            winnerGain: Math.max(5, winnerGain), // Cấp điểm tối thiểu
            loserDrop: Math.min(-5, loserDrop)
        };
    }
    /**
     * Lấy đối thủ ngẫu nhiên có ELO tương đương (+- 150), hoặc ngẫu nhiên nếu không tìm thấy
     */
    isShielded(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return false;
        try {
            const yCanh = JSON.parse(user.y_canh || '{}');
            if (yCanh.shield_until && yCanh.shield_until > Math.floor(Date.now() / 1000)) {
                return true;
            }
        }
        catch (e) { }
        // Newbie protection: người chơi mới không thể bị tấn công
        if (NewbieProtectionService_1.newbieProtectionService.isProtected(userId))
            return true;
        return false;
    }
    updateLossesAndShield(userId, isWin) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return;
        try {
            const yCanh = JSON.parse(user.y_canh || '{}');
            if (isWin) {
                yCanh.consecutive_losses = 0;
            }
            else {
                yCanh.consecutive_losses = (yCanh.consecutive_losses || 0) + 1;
                if (yCanh.consecutive_losses >= 5) {
                    yCanh.shield_until = Math.floor(Date.now() / 1000) + 3600; // 1-hour shield
                    yCanh.consecutive_losses = 0; // reset
                }
            }
            UserRepository_1.userRepository.update(userId, { y_canh: JSON.stringify(yCanh) });
        }
        catch (e) { }
    }
    /**
     * Lấy đối thủ ngẫu nhiên có ELO tương đương (+- 150), hoặc ngẫu nhiên nếu không tìm thấy, loại bỏ người chơi có Hộ Giới Bài
     */
    getMatchmaking(userId) {
        const profile = this.getProfile(userId);
        const minElo = profile.elo - 150;
        const maxElo = profile.elo + 150;
        const opponents = database_1.default.prepare(`
      SELECT user_id FROM arena_profiles 
      WHERE user_id != ? AND elo >= ? AND elo <= ?
      ORDER BY RANDOM() LIMIT 20
    `).all(userId, minElo, maxElo);
        for (const opp of opponents) {
            if (!this.isShielded(opp.user_id)) {
                return opp.user_id;
            }
        }
        // Nếu không tìm thấy trong khoảng, mở rộng tìm kiếm toàn bộ (trừ bản thân)
        const globalOpponents = database_1.default.prepare(`
      SELECT user_id FROM arena_profiles 
      WHERE user_id != ?
      ORDER BY RANDOM() LIMIT 50
    `).all(userId);
        for (const opp of globalOpponents) {
            if (!this.isShielded(opp.user_id)) {
                return opp.user_id;
            }
        }
        return null;
    }
    /**
     * Bắt đầu trận đấu PvP
     */
    challenge(challengerId, opponentId) {
        const cUser = UserRepository_1.userRepository.get(challengerId);
        const oUser = UserRepository_1.userRepository.get(opponentId);
        if (!cUser || !oUser) {
            return { success: false, message: 'Người chơi không hợp lệ!' };
        }
        // Build combatants
        const cStats = InventoryService_1.inventoryService.getActiveStats(challengerId);
        const oStats = InventoryService_1.inventoryService.getActiveStats(opponentId);
        if (!cStats || !oStats) {
            return { success: false, message: 'Lỗi tính toán chỉ số.' };
        }
        // Lấy pet của challenger
        let cPetConfig = null;
        const cPetRaw = database_1.default.prepare('SELECT name, base_atk, mutations, skills FROM pets WHERE user_id = ? AND is_deployed = 1').get(challengerId);
        if (cPetRaw) {
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            let skillsArr = [];
            try {
                mutations = JSON.parse(cPetRaw.mutations || '{}');
            }
            catch (e) { }
            try {
                skillsArr = JSON.parse(cPetRaw.skills || '[]');
            }
            catch (e) { }
            cPetConfig = {
                name: cPetRaw.name,
                atk: cPetRaw.base_atk + (mutations.bonus_atk || 0),
                skills: skillsArr
            };
        }
        // Lấy pet của opponent (Auto-battle nên opponent cũng có thể dùng pet)
        let oPetConfig = null;
        const oPetRaw = database_1.default.prepare('SELECT name, base_atk, mutations, skills FROM pets WHERE user_id = ? AND is_deployed = 1').get(opponentId);
        if (oPetRaw) {
            let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
            let skillsArr = [];
            try {
                mutations = JSON.parse(oPetRaw.mutations || '{}');
            }
            catch (e) { }
            try {
                skillsArr = JSON.parse(oPetRaw.skills || '[]');
            }
            catch (e) { }
            oPetConfig = {
                name: oPetRaw.name,
                atk: oPetRaw.base_atk + (mutations.bonus_atk || 0),
                skills: skillsArr
            };
        }
        const { soulImprintService } = require('./SoulImprintService');
        let challengerAtk = cStats.atk;
        if (cUser.alignment === 'orthodox') {
            challengerAtk = Math.round(challengerAtk * 0.95);
        }
        let opponentAtk = oStats.atk;
        if (oUser.alignment === 'orthodox') {
            opponentAtk = Math.round(opponentAtk * 0.95);
        }
        const challenger = {
            name: cUser.name,
            hp: cStats.hp,
            maxHp: cStats.hp,
            atk: challengerAtk,
            def: cStats.def,
            crit: cStats.crit,
            critRes: cStats.critRes,
            luck: cStats.luck,
            speed: cStats.speed,
            dodge: cStats.dodge,
            linhCan: cUser.linh_can,
            hasOai: soulImprintService.hasOaiActive(challengerId)
        };
        const opponent = {
            name: oUser.name,
            hp: oStats.hp,
            maxHp: oStats.hp,
            atk: opponentAtk,
            def: oStats.def,
            crit: oStats.crit,
            critRes: oStats.critRes,
            luck: oStats.luck,
            speed: oStats.speed,
            dodge: oStats.dodge,
            linhCan: oUser.linh_can,
            hasOai: soulImprintService.hasOaiActive(opponentId)
        };
        // Để cho công bằng, hai bên có thể gọi Pet, nhưng CombatEngine.run hiện tại chỉ nhận 1 pet.
        // Mình có thể pass cPetConfig vào, và enemy atk được buff ngầm hoặc bỏ qua pet.
        // Tạm thời truyền pet của Challenger.
        if (oPetConfig) {
            opponent.atk += Math.floor(oPetConfig.atk * 0.5); // Opponent pet damage is added to opponent's basic attack
        }
        const combatResult = CombatEngine_1.CombatEngine.run(challenger, opponent, cPetConfig, 15, false);
        // Cập nhật ELO
        const cProfile = this.getProfile(challengerId);
        const oProfile = this.getProfile(opponentId);
        const isChallengerWin = combatResult.winner === 'player';
        let eloChangeObj;
        if (isChallengerWin) {
            eloChangeObj = this.calculateEloChange(cProfile.elo, oProfile.elo);
            this.updateProfileAfterMatch(challengerId, cProfile, true, eloChangeObj.winnerGain);
            this.updateProfileAfterMatch(opponentId, oProfile, false, eloChangeObj.loserDrop);
            this.updateLossesAndShield(challengerId, true);
            this.updateLossesAndShield(opponentId, false);
        }
        else {
            eloChangeObj = this.calculateEloChange(oProfile.elo, cProfile.elo);
            this.updateProfileAfterMatch(challengerId, cProfile, false, eloChangeObj.loserDrop);
            this.updateProfileAfterMatch(opponentId, oProfile, true, eloChangeObj.winnerGain);
            this.updateLossesAndShield(challengerId, false);
            this.updateLossesAndShield(opponentId, true);
        }
        const eloChangeForChallenger = isChallengerWin ? eloChangeObj.winnerGain : eloChangeObj.loserDrop;
        // Lưu lịch sử
        const nowSec = Math.floor(Date.now() / 1000);
        const winnerId = isChallengerWin ? challengerId : opponentId;
        // Rút ngắn combat log nếu quá dài
        const combatLogStr = JSON.stringify(combatResult.log);
        database_1.default.prepare(`
      INSERT INTO arena_history (challenger_id, opponent_id, winner_id, elo_change, created_at, combat_log)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(challengerId, opponentId, winnerId, Math.abs(eloChangeForChallenger), nowSec, combatLogStr);
        let artifactMessage = undefined;
        if (isChallengerWin) {
            const artifactRes = InventoryService_1.inventoryService.addArtifactExp(challengerId, 30);
            if (artifactRes && artifactRes.message) {
                artifactMessage = artifactRes.message;
            }
        }
        return {
            success: true,
            message: `Chiến đấu hoàn tất!`,
            result: combatResult,
            artifactMessage
        };
    }
    updateProfileAfterMatch(userId, profile, isWin, eloChange) {
        const newElo = Math.max(0, profile.elo + eloChange);
        const wins = profile.wins + (isWin ? 1 : 0);
        const losses = profile.losses + (isWin ? 0 : 1);
        const winStreak = isWin ? profile.win_streak + 1 : 0;
        const highestElo = Math.max(profile.highest_elo, newElo);
        database_1.default.prepare(`
      UPDATE arena_profiles 
      SET elo = ?, wins = ?, losses = ?, win_streak = ?, highest_elo = ?
      WHERE user_id = ?
    `).run(newElo, wins, losses, winStreak, highestElo, userId);
    }
    /**
     * Lấy Top 10 Bảng Xếp Hạng Arena
     */
    getLeaderboard(limit = 10) {
        return database_1.default.prepare(`
      SELECT p.*, u.name 
      FROM arena_profiles p
      JOIN users u ON p.user_id = u.discord_id
      ORDER BY p.elo DESC 
      LIMIT ?
    `).all(limit);
    }
    /**
     * Xử lý kết thúc mùa giải Arena
     */
    processSeasonEnd(newSeasonId) {
        // Lấy tất cả user đã tham gia ít nhất 1 trận
        const players = database_1.default.prepare(`SELECT * FROM arena_profiles WHERE wins > 0 OR losses > 0 ORDER BY elo DESC`).all();
        database_1.default.transaction(() => {
            players.forEach((p, index) => {
                const rank = index + 1;
                // Soft reset ELO: (elo hiện tại + 1000) / 2
                const resetElo = Math.max(1000, Math.floor((p.elo + 1000) / 2));
                database_1.default.prepare(`
          UPDATE arena_profiles 
          SET elo = ?, wins = 0, losses = 0, win_streak = 0, last_season_rank = ?, season_id = ?
          WHERE user_id = ?
        `).run(resetElo, rank, newSeasonId, p.user_id);
                // Có thể trao phần thưởng trực tiếp tại đây cho Top 1-10 nếu cần
                if (rank <= 10) {
                    const rewardLT = 100000 - (rank * 5000); // Ví dụ top 1 được 95k LT
                    const user = UserRepository_1.userRepository.get(p.user_id);
                    if (user) {
                        UserRepository_1.userRepository.update(p.user_id, { coin_ha_pham: user.coin_ha_pham + rewardLT });
                    }
                }
            });
        })();
    }
    /**
     * Khởi động lịch trình tự động reset mùa giải mỗi sáng Thứ 2 (0:00), reset 2 tuần/mùa
     */
    initScheduler() {
        setInterval(() => {
            const now = new Date();
            // Nếu là Thứ 2 (day === 1) và giờ là 00:00 (hoặc trong khoảng 0-5 phút)
            if (now.getDay() === 1 && now.getHours() === 0 && now.getMinutes() < 60) {
                // Chỉ chạy 1 lần mỗi 2 tuần, kiểm tra cờ (flag) trong database để tránh chạy lặp
                const db = require('../database/database').default;
                const currentSeason = db.prepare("SELECT value FROM system_config WHERE key = 'arena_season_id'").get();
                const biWeekNum = Math.ceil(this.getWeekNumber(now) / 2);
                const expectedSeason = `season_${now.getFullYear()}_BiW${biWeekNum}`;
                if (!currentSeason || currentSeason.value !== expectedSeason) {
                    this.processSeasonEnd(expectedSeason);
                    db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('arena_season_id', ?)").run(expectedSeason);
                    console.log(`[ArenaService] Đã reset mùa giải sang: ${expectedSeason}`);
                }
            }
        }, 60 * 60 * 1000); // Kiểm tra mỗi giờ
    }
    getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
    }
}
exports.ArenaService = ArenaService;
exports.arenaService = new ArenaService();
