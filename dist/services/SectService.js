"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sectService = exports.SectService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const AchievementService_1 = require("./AchievementService");
const LeylineService_1 = require("./LeylineService");
const gameConstants_1 = require("../config/gameConstants");
const revengeWindows = new Map();
class SectService {
    /**
     * Tao Tong Mon moi (Tieu hao SECT_CREATE_COST_LT Linh thach)
     */
    createSect(userId, name, description) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Dao huu chua khoi tao nhan vat.' };
        }
        if (user.sect_id) {
            return { success: false, message: 'Đạo hữu đã có Tông Môn! Vui lòng rời Tông Môn cũ trước khi sáng lập môn phái mới.' };
        }
        const cost = gameConstants_1.GAME_CONSTANTS.SECT_CREATE_COST_LT;
        if (user.coin_ha_pham < cost) {
            return { success: false, message: `Đạo hữu không đủ Linh Thạch để lập Tông Môn! (Yêu cầu **${cost}** Linh Thạch, hiện có **${user.coin_ha_pham}**)` };
        }
        const nameRegex = /^[a-zA-Z0-9À-ỹ\s]{2,20}$/;
        if (!nameRegex.test(name.trim())) {
            return { success: false, message: 'Tên Tông Môn không hợp lệ! Chỉ được chứa chữ cái, số, dấu tiếng Việt, khoảng trắng và dài từ 2 đến 20 ký tự.' };
        }
        // Kiểm tra tên trùng lặp
        const existing = database_1.default.prepare('SELECT id FROM sects WHERE name = ?').get(name.trim());
        if (existing) {
            return { success: false, message: 'Tên Tông Môn này đã tồn tại trong bát hoang. Vui lòng chọn danh hiệu khác!' };
        }
        const now = Math.floor(Date.now() / 1000);
        try {
            database_1.default.prepare(`
        INSERT INTO sects (name, master_id, level, exp, resources, description, created_at)
        VALUES (?, ?, 1, 0, 0, ?, ?)
      `).run(name.trim(), userId, description.trim(), now);
            const sect = database_1.default.prepare('SELECT id FROM sects WHERE name = ?').get(name.trim());
            UserRepository_1.userRepository.update(userId, {
                sect_id: sect.id,
                sect_contribution: 100, // Thưởng 100 điểm đóng góp khởi lập
                joined_sect_at: now,
                coin_ha_pham: user.coin_ha_pham - gameConstants_1.GAME_CONSTANTS.SECT_CREATE_COST_LT
            });
            return {
                success: true,
                message: `🎉 Chúc mừng đạo hữu lập thành công Tông Môn **${name.trim()}**! Thiên hạ đệ tử sẽ sớm quy phục.`,
                sectId: sect.id
            };
        }
        catch (e) {
            console.error(e);
            return { success: false, message: 'Lỗi hệ thống khi khởi tạo Tông Môn.' };
        }
    }
    /**
     * Gia nhập Tông Môn có sẵn
     */
    joinSect(userId, sectId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        }
        if (user.sect_id) {
            return { success: false, message: 'Đạo hữu đã ở trong một Tông Môn rồi!' };
        }
        const sect = database_1.default.prepare('SELECT level, name FROM sects WHERE id = ?').get(sectId);
        if (!sect) {
            return { success: false, message: 'Tông Môn này không tồn tại hoặc đã bị giải tán.' };
        }
        // BIG UPDATE §2: Karma sect joining restriction
        try {
            const { karmaService } = require('./KarmaService');
            const check = karmaService.canJoinSect(userId, sectId);
            if (!check.allowed) {
                return { success: false, message: check.reason || 'Không thể gia nhập tông môn này.' };
            }
        }
        catch { }
        // Giới hạn đệ tử = 5 * Cấp Tông Môn
        const memberCount = database_1.default.prepare('SELECT COUNT(*) as count FROM users WHERE sect_id = ?').get(sectId);
        const limit = sect.level * 5;
        if (memberCount.count >= limit) {
            return { success: false, message: `Tông Môn **${sect.name}** đã đạt tối đa giới hạn đệ tử (**${memberCount.count}/${limit}** người)!` };
        }
        const now = Math.floor(Date.now() / 1000);
        UserRepository_1.userRepository.update(userId, {
            sect_id: sectId,
            sect_contribution: 0,
            joined_sect_at: now
        });
        // Kiểm tra thành tựu gia nhập tông môn
        AchievementService_1.achievementService.updateProgress(userId, 'sh_1', 1);
        return {
            success: true,
            message: `🟢 Chúc mừng đạo hữu đã gia nhập **${sect.name}**! Hãy đồng tâm hiệp lực cống hiến vì tông môn.`
        };
    }
    /**
     * Rời khỏi Tông Môn (Nếu là Tông Chủ sẽ giải tán luôn Tông Môn)
     */
    leaveSect(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id) {
            return { success: false, message: 'Đạo hữu hiện là Tán Tu tự do, chưa gia nhập Tông môn nào!' };
        }
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect) {
            // Dọn dẹp an toàn nếu sect đã mất tích trong DB
            UserRepository_1.userRepository.update(userId, { sect_id: null, sect_contribution: 0, joined_sect_at: null });
            return { success: true, message: 'Đã giải phóng đạo hữu về Tán Tu tự do.' };
        }
        if (sect.master_id === userId) {
            // Giải tán Tông môn
            database_1.default.prepare('UPDATE users SET sect_id = NULL, sect_contribution = 0, joined_sect_at = NULL WHERE sect_id = ?')
                .run(sect.id);
            database_1.default.prepare('DELETE FROM sects WHERE id = ?').run(sect.id);
            return { success: true, message: `💥 Đạo hữu là Tông Chủ! Tông môn **${sect.name}** đã chính thức **Giải Tán**, toàn bộ đệ tử trở lại thành Tán Tu.` };
        }
        else {
            UserRepository_1.userRepository.update(userId, { sect_id: null, sect_contribution: 0, joined_sect_at: null });
            return { success: true, message: `🔙 Đạo hữu đã rời khỏi Tông môn **${sect.name}**, bắt đầu lại hành trình Tán Tu.` };
        }
    }
    /**
     * Quyên góp Linh Thạch cống hiến Tông Môn
     */
    donateToSect(userId, amount) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id) {
            return { success: false, message: 'Đạo hữu chưa tham gia Tông môn nào để quyên góp!' };
        }
        if (user.coin_ha_pham < amount) {
            return { success: false, message: `Đạo hữu không đủ Linh thạch để cống hiến! (Có: ${user.coin_ha_pham} Linh thạch)` };
        }
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect) {
            return { success: false, message: 'Tông môn không tồn tại.' };
        }
        // Leyline Buff Tông Môn (+15% cống hiến)
        let contributionGained = amount;
        if (LeylineService_1.leylineService.isBuffActive('tongmon')) {
            contributionGained = Math.floor(amount * 1.15);
        }
        // Cập nhật người chơi
        const newContribution = user.sect_contribution + contributionGained;
        UserRepository_1.userRepository.update(userId, {
            coin_ha_pham: user.coin_ha_pham - amount,
            sect_contribution: newContribution
        });
        // Kiểm tra thành tựu cống hiến tông môn
        AchievementService_1.achievementService.setProgress(userId, 'sh_2', newContribution);
        // Cập nhật tông môn: exp, resources, thăng cấp
        const newResources = sect.resources + amount;
        let newExp = sect.exp + amount;
        let newLevel = sect.level;
        let expNeeded = newLevel * 1000;
        let leveledUp = false;
        while (newExp >= expNeeded) {
            newExp -= expNeeded;
            newLevel += 1;
            expNeeded = newLevel * 1000;
            leveledUp = true;
        }
        database_1.default.prepare('UPDATE sects SET resources = ?, exp = ?, level = ? WHERE id = ?')
            .run(newResources, newExp, newLevel, sect.id);
        let message = `💖 Đạo hữu quyên cống **${amount} Linh Thạch**! Nhận **+${contributionGained} Điểm Cống Hiến** tông môn.`;
        if (leveledUp) {
            message += `\n✨ **TÔNG MÔN THĂNG CẤP!** Bang hội thăng lên **Cấp ${newLevel}**! Giới hạn đệ tử mở rộng thành **${newLevel * 5}** người.`;
        }
        return { success: true, message };
    }
    /**
     * Xem thông tin chi tiết một Tông Môn
     */
    getSectDetails(sectId) {
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId);
        if (!sect)
            return null;
        const master = UserRepository_1.userRepository.get(sect.master_id);
        const masterName = master ? master.name : 'Vô danh';
        const members = database_1.default.prepare(`
      SELECT discord_id, name, title, level, sect_contribution
      FROM users
      WHERE sect_id = ?
      ORDER BY sect_contribution DESC
    `).all(sectId);
        return {
            id: sect.id,
            name: sect.name,
            master_id: sect.master_id,
            master_name: masterName,
            level: sect.level,
            exp: sect.exp,
            resources: sect.resources,
            tu_linh_level: sect.tu_linh_level || 0,
            dan_duong_level: sect.dan_duong_level || 0,
            description: sect.description,
            created_at: sect.created_at,
            member_count: members.length,
            member_limit: sect.level * 5,
            members
        };
    }
    /**
     * Tông Chủ nâng cấp kiến trúc Tông Môn
     */
    upgradeFacility(userId, facility) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id) {
            return { success: false, message: 'Đạo hữu chưa tham gia Tông môn nào!' };
        }
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect) {
            return { success: false, message: 'Tông môn không tồn tại hoặc đã bị giải tán.' };
        }
        if (sect.master_id !== userId) {
            return { success: false, message: 'Chỉ có Tông Chủ mới có quyền xây dựng và nâng cấp công trình Tông môn!' };
        }
        const currentLevel = facility === 'tuling' ? (sect.tu_linh_level || 0) : (sect.dan_duong_level || 0);
        if (currentLevel >= 5) {
            return { success: false, message: 'Kiến trúc công trình này đã đạt **Cấp 5 (Tối đa)**!' };
        }
        const costList = [1000, 2500, 5000, 10000, 25000];
        const cost = costList[currentLevel];
        if (sect.resources < cost) {
            return { success: false, message: `Tài nguyên Tông Môn không đủ để nâng cấp! (Yêu cầu: **${cost}** Tài nguyên, Tông môn hiện có: **${sect.resources}**). Các đệ tử hãy tích cực quyên góp!` };
        }
        const nextLevel = currentLevel + 1;
        const updateColumn = facility === 'tuling' ? 'tu_linh_level' : 'dan_duong_level';
        const facilityName = facility === 'tuling' ? 'Tụ Linh Trận' : 'Luyện Đan Đường';
        database_1.default.transaction(() => {
            database_1.default.prepare(`UPDATE sects SET resources = resources - ?, ${updateColumn} = ? WHERE id = ?`)
                .run(cost, nextLevel, sect.id);
        })();
        const effectText = facility === 'tuling'
            ? `tăng +${nextLevel * 5}% tốc độ tu luyện cho tất cả thành viên`
            : `tăng +${nextLevel * 2}% tỷ lệ luyện đan thành công cho tất cả thành viên`;
        return {
            success: true,
            message: `🏗️ **Nâng cấp thành công!** Tông môn **${sect.name}** tiêu hao **${cost}** tài nguyên để thăng cấp **${facilityName}** lên **Cấp ${nextLevel}** (${effectText})!`
        };
    }
    /**
     * Gửi lời mời liên minh đến Tông Môn khác
     */
    formAlliance(sectId1, sectId2, requesterUserId) {
        const sect1 = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId1);
        if (!sect1)
            return { success: false, message: 'Tông Môn yêu cầu không tồn tại!' };
        if (sect1.master_id !== requesterUserId) {
            return { success: false, message: 'Chỉ có Tông Chủ mới có quyền gửi lời mời liên minh!' };
        }
        const sect2 = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId2);
        if (!sect2)
            return { success: false, message: 'Tông Môn được mời không tồn tại!' };
        if (sectId1 === sectId2)
            return { success: false, message: 'Không thể liên minh với chính mình!' };
        const existing = database_1.default.prepare(`
      SELECT id, status FROM sect_alliances
      WHERE (sect_id_1 = ? AND sect_id_2 = ?) OR (sect_id_1 = ? AND sect_id_2 = ?)
    `).get(sectId1, sectId2, sectId2, sectId1);
        if (existing) {
            if (existing.status === 'active')
                return { success: false, message: 'Hai Tông Môn đã là liên minh!' };
            if (existing.status === 'pending')
                return { success: false, message: 'Đã có lời mời liên minh giữa hai Tông Môn này, vui lòng chờ phản hồi!' };
            if (existing.status === 'broken') {
                const broken = database_1.default.prepare('SELECT broken_at FROM sect_alliances WHERE id = ?').get(existing.id);
                if (broken?.broken_at) {
                    const cooldownEnd = broken.broken_at + 7 * 24 * 3600;
                    if (Math.floor(Date.now() / 1000) < cooldownEnd) {
                        const remaining = Math.ceil((cooldownEnd - Math.floor(Date.now() / 1000)) / 3600);
                        return { success: false, message: `Vừa phá vỡ liên minh, cần chờ thêm **${remaining} giờ** nữa!` };
                    }
                }
                database_1.default.prepare('DELETE FROM sect_alliances WHERE id = ?').run(existing.id);
            }
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare(`
      INSERT INTO sect_alliances (sect_id_1, sect_id_2, formed_at, status)
      VALUES (?, ?, ?, 'pending')
    `).run(sectId1, sectId2, now);
        return { success: true, message: `📜 **Liên Minh** - Tông Chủ **${sect1.name}** đã gửi lời đề nghị liên minh đến **${sect2.name}**!\nHãy chờ Tông Chủ phe kia chấp nhận bằng \`/tongmon lienminh chapnhan\`.` };
    }
    /**
     * Chấp nhận lời mời liên minh
     */
    acceptAlliance(sectId, requesterUserId) {
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId);
        if (!sect)
            return { success: false, message: 'Tông Môn không tồn tại!' };
        if (sect.master_id !== requesterUserId) {
            return { success: false, message: 'Chỉ có Tông Chủ mới có quyền chấp nhận liên minh!' };
        }
        const alliance = database_1.default.prepare(`
      SELECT a.*, s.name as partner_name
      FROM sect_alliances a
      JOIN sects s ON a.sect_id_1 = s.id
      WHERE a.sect_id_2 = ? AND a.status = 'pending'
      ORDER BY a.formed_at DESC LIMIT 1
    `).get(sectId);
        if (!alliance) {
            return { success: false, message: 'Không có lời mời liên minh nào đang chờ xử lý!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('UPDATE sect_alliances SET status = ?, formed_at = ? WHERE id = ?')
            .run('active', now, alliance.id);
        return { success: true, message: `🤝 **LIÊN MINH THÀNH CÔNG!** **${sect.name}** và **${alliance.partner_name}** chính thức kết minh, đồng sinh tử!` };
    }
    /**
     * Phá vỡ liên minh
     */
    breakAlliance(sectId, requesterUserId) {
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(sectId);
        if (!sect)
            return { success: false, message: 'Tông Môn không tồn tại!' };
        if (sect.master_id !== requesterUserId) {
            return { success: false, message: 'Chỉ có Tông Chủ mới có quyền phá vỡ liên minh!' };
        }
        const alliance = database_1.default.prepare(`
      SELECT a.*, s1.name as name1, s2.name as name2
      FROM sect_alliances a
      JOIN sects s1 ON a.sect_id_1 = s1.id
      JOIN sects s2 ON a.sect_id_2 = s2.id
      WHERE (a.sect_id_1 = ? OR a.sect_id_2 = ?) AND a.status = 'active'
    `).get(sectId, sectId);
        if (!alliance) {
            return { success: false, message: 'Tông Môn này hiện không có liên minh nào!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('UPDATE sect_alliances SET status = ?, broken_at = ? WHERE id = ?')
            .run('broken', now, alliance.id);
        return { success: true, message: `💔 **PHÁ VỠ LIÊN MINH!** **${alliance.name1}** và **${alliance.name2}** chính thức đoạn tuyệt!` };
    }
    /**
     * Xem thông tin liên minh của Tông Môn
     */
    getAlliance(sectId) {
        const alliance = database_1.default.prepare(`
      SELECT a.*,
        CASE WHEN a.sect_id_1 = ? THEN a.sect_id_2 ELSE a.sect_id_1 END as partner_id
      FROM sect_alliances a
      WHERE (a.sect_id_1 = ? OR a.sect_id_2 = ?) AND a.status = 'active'
    `).get(sectId, sectId, sectId);
        if (!alliance)
            return null;
        const partnerSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(alliance.partner_id);
        const partnerMaster = UserRepository_1.userRepository.get(partnerSect.master_id);
        const partnerCount = database_1.default.prepare('SELECT COUNT(*) as c FROM users WHERE sect_id = ?').get(partnerSect.id);
        return {
            alliance: {
                id: alliance.id,
                formed_at: alliance.formed_at,
                status: alliance.status
            },
            partnerSect: {
                id: partnerSect.id,
                name: partnerSect.name,
                master_id: partnerSect.master_id,
                master_name: partnerMaster?.name || 'Vô danh',
                level: partnerSect.level,
                member_count: partnerCount.c
            }
        };
    }
    /**
     * Bảng xếp hạng liên minh
     */
    getAllianceLeaderboard() {
        const rows = database_1.default.prepare(`
      SELECT s1.name as name1, s2.name as name2, a.formed_at, s1.level as level1, s2.level as level2
      FROM sect_alliances a
      JOIN sects s1 ON a.sect_id_1 = s1.id
      JOIN sects s2 ON a.sect_id_2 = s2.id
      WHERE a.status = 'active'
      ORDER BY (s1.level + s2.level) DESC, a.formed_at ASC
      LIMIT 20
    `).all();
        return rows.map(r => ({
            sect1: r.name1,
            sect2: r.name2,
            formed_at: r.formed_at,
            total_level: r.level1 + r.level2
        }));
    }
    /**
     * Kiểm tra hai Tông Môn có đang liên minh không
     */
    isAllied(sectId1, sectId2) {
        const result = database_1.default.prepare(`
      SELECT id FROM sect_alliances
      WHERE ((sect_id_1 = ? AND sect_id_2 = ?) OR (sect_id_1 = ? AND sect_id_2 = ?))
        AND status = 'active'
    `).get(sectId1, sectId2, sectId2, sectId1);
        return !!result;
    }
    /**
     * Tuyên chiến giữa hai liên minh
     */
    declareWar(requesterUserId, allianceSectId, targetAllianceSectId) {
        const requester = UserRepository_1.userRepository.get(requesterUserId);
        if (!requester)
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        const challengerSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(allianceSectId);
        if (!challengerSect)
            return { success: false, message: 'Tông Môn của đạo hữu không tồn tại!' };
        if (challengerSect.master_id !== requesterUserId) {
            return { success: false, message: 'Chỉ có Tông Chủ mới có thể tuyên chiến!' };
        }
        const defenderSect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(targetAllianceSectId);
        if (!defenderSect)
            return { success: false, message: 'Tông Môn mục tiêu không tồn tại!' };
        const challengerAlliance = database_1.default.prepare(`
      SELECT id FROM sect_alliances WHERE (sect_id_1 = ? OR sect_id_2 = ?) AND status = 'active'
    `).get(allianceSectId, allianceSectId);
        if (!challengerAlliance)
            return { success: false, message: 'Tông Môn của đạo hữu không có liên minh!' };
        const defenderAlliance = database_1.default.prepare(`
      SELECT id FROM sect_alliances WHERE (sect_id_1 = ? OR sect_id_2 = ?) AND status = 'active'
    `).get(targetAllianceSectId, targetAllianceSectId);
        if (!defenderAlliance)
            return { success: false, message: 'Tông Môn mục tiêu không có liên minh!' };
        if (requester.coin_ha_pham < 2000) {
            return { success: false, message: `Không đủ Linh Thạch! Cần 2000 LT (Có: ${requester.coin_ha_pham})` };
        }
        const activeWar = database_1.default.prepare("SELECT id FROM guild_wars WHERE (challenger_sect_id = ? OR defender_sect_id = ?) AND status IN ('pending', 'active')").get(allianceSectId, allianceSectId);
        if (activeWar)
            return { success: false, message: 'Tông Môn đang trong chiến tranh khác!' };
        const activeWarDef = database_1.default.prepare("SELECT id FROM guild_wars WHERE (challenger_sect_id = ? OR defender_sect_id = ?) AND status IN ('pending', 'active')").get(targetAllianceSectId, targetAllianceSectId);
        if (activeWarDef)
            return { success: false, message: 'Tông Môn mục tiêu đang trong chiến tranh khác!' };
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const warId = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const now = Math.floor(Date.now() / 1000);
        const maxRounds = Math.min(challengerSect.level, defenderSect.level) + 3;
        const challengerMembers = database_1.default.prepare(`
      SELECT DISTINCT u.discord_id, u.sect_id FROM users u
      JOIN sect_alliances a ON (a.sect_id_1 = u.sect_id OR a.sect_id_2 = u.sect_id)
      WHERE (a.sect_id_1 = ? OR a.sect_id_2 = ?) AND a.status = 'active' AND u.sect_id IS NOT NULL
    `).all(allianceSectId, allianceSectId);
        const defenderMembers = database_1.default.prepare(`
      SELECT DISTINCT u.discord_id, u.sect_id FROM users u
      JOIN sect_alliances a ON (a.sect_id_1 = u.sect_id OR a.sect_id_2 = u.sect_id)
      WHERE (a.sect_id_1 = ? OR a.sect_id_2 = ?) AND a.status = 'active' AND u.sect_id IS NOT NULL
    `).all(targetAllianceSectId, targetAllianceSectId);
        database_1.default.transaction(() => {
            UserRepository_1.userRepository.update(requesterUserId, { coin_ha_pham: requester.coin_ha_pham - 2000 });
            database_1.default.prepare(`
        INSERT INTO guild_wars (id, challenger_sect_id, defender_sect_id, status, max_rounds, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `).run(warId, allianceSectId, targetAllianceSectId, maxRounds, now);
            const insertParticipant = database_1.default.prepare(`
        INSERT OR IGNORE INTO guild_war_participants (war_id, user_id, sect_id, side)
        VALUES (?, ?, ?, ?)
      `);
            for (const m of challengerMembers) {
                insertParticipant.run(warId, m.discord_id, m.sect_id, 'challenger');
            }
            for (const m of defenderMembers) {
                insertParticipant.run(warId, m.discord_id, m.sect_id, 'defender');
            }
        })();
        return {
            success: true,
            message: `⚔️ **CHIẾN TRANH LIÊN MINH!** Liên minh **${challengerSect.name}** tuyên chiến với liên minh **${defenderSect.name}**!\nMã chiến: \`${warId}\`\nPhí phát động: -2000 Linh Thạch`,
            warId
        };
    }
    // ──── Cân Bằng Phe Phái (Underdog System) ────
    /**
     * Lấy số lượng thành viên của một Tông Môn
     */
    getMemberCount(sectId) {
        const result = database_1.default.prepare('SELECT COUNT(*) as count FROM users WHERE sect_id = ?').get(sectId);
        return result.count;
    }
    /**
     * Tính tỉ lệ sĩ số giữa hai Tông Môn (luôn >= 1)
     * VD: 20 vs 5 => ratio = 4
     */
    getSizeRatio(sectId1, sectId2) {
        const c1 = this.getMemberCount(sectId1);
        const c2 = this.getMemberCount(sectId2);
        if (c1 === c2)
            return { largerId: sectId1, smallerId: sectId2, ratio: 1 };
        if (c1 > c2)
            return { largerId: sectId1, smallerId: sectId2, ratio: c1 / c2 };
        return { largerId: sectId2, smallerId: sectId1, ratio: c2 / c1 };
    }
    /**
     * Damage multiplier cho phe nhỏ khi đánh phe lớn (Underdog Attack Buff)
     * ratio 1-1.5x => +0% | 1.5-2x => +10% | 2-3x => +20% | 3-5x => +30% | 5x+ => +50%
     */
    getUnderdogAttackMultiplier(mySectId, enemySectId) {
        const { largerId, smallerId, ratio } = this.getSizeRatio(mySectId, enemySectId);
        // Nếu mình là phe lớn, không buff
        if (largerId === mySectId)
            return 1.0;
        if (ratio >= 5.0)
            return 1.50;
        if (ratio >= 3.0)
            return 1.30;
        if (ratio >= 2.0)
            return 1.20;
        if (ratio >= 1.5)
            return 1.10;
        return 1.0;
    }
    /**
     * Damage reduction cho phe lớn (Zerg Penalty)
     * ratio 1-1.5x => 0% | 1.5-2x => -10% | 2-3x => -20% | 3-5x => -30% | 5x+ => -50%
     */
    getZergDamageReduction(mySectId, enemySectId) {
        const { largerId, smallerId, ratio } = this.getSizeRatio(mySectId, enemySectId);
        // Nếu mình là phe nhỏ, không penalty
        if (smallerId === mySectId)
            return 1.0;
        if (ratio >= 5.0)
            return 0.50;
        if (ratio >= 3.0)
            return 0.70;
        if (ratio >= 2.0)
            return 0.80;
        if (ratio >= 1.5)
            return 0.90;
        return 1.0;
    }
    /**
     * Reward multiplier cho phe nhỏ thắng phe lớn
     * ratio 1-1.5x => 1x | 1.5-2x => 1.5x | 2-3x => 2x | 3-5x => 3x | 5x+ => 5x
     */
    getUnderdogRewardMultiplier(sectId, enemySectId) {
        const { largerId, smallerId, ratio } = this.getSizeRatio(sectId, enemySectId);
        // Phe lớn thắng phe nhỏ: không bonus
        if (largerId === sectId)
            return 1.0;
        // Phe nhỏ thắng phe lớn
        if (ratio >= 5.0)
            return 5.0;
        if (ratio >= 3.0)
            return 3.0;
        if (ratio >= 2.0)
            return 2.0;
        if (ratio >= 1.5)
            return 1.5;
        return 1.0;
    }
    /**
     * Kiểm tra phe nào là underdog (trả về sectId phe yếu hơn, null nếu cân bằng)
     */
    getUnderdogSectId(sectId1, sectId2) {
        const { largerId, smallerId, ratio } = this.getSizeRatio(sectId1, sectId2);
        return ratio >= 1.5 ? smallerId : null;
    }
    /**
     * Khi thành viên bị đánh bại trong PvP, các thành viên khác trong Tông Môn nhận thông báo
     */
    notifySectDefeat(sectId, defeatedName, attackerName) {
        const members = database_1.default.prepare('SELECT discord_id FROM users WHERE sect_id = ? AND discord_id != ?').all(sectId, '');
        const notificationMsg = `⚔️ **${defeatedName}** đã bị **${attackerName}** đánh bại! Đồng môn có thể báo thù trong 24h không tốn Thể Lực!`;
        const revengeKey = `revenge_${sectId}_${Date.now()}`;
        revengeWindows.set(revengeKey, {
            attackerName,
            victimName: defeatedName,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            sectId
        });
        return members.map(m => m.discord_id);
    }
    /**
     * Lấy danh sách các Tông Môn đứng đầu server
     */
    getTopSects() {
        const list = database_1.default.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM users u WHERE u.sect_id = s.id) as member_count,
        (SELECT name FROM users u WHERE u.discord_id = s.master_id) as master_name
      from sects s
      ORDER BY s.level DESC, s.exp DESC
      LIMIT 10
    `).all();
        return list.map(item => ({
            id: item.id,
            name: item.name,
            level: item.level,
            member_count: item.member_count,
            member_limit: item.level * 5,
            master_name: item.master_name || 'Vô danh'
        }));
    }
    /**
     * Chỉ định Phó Tông Chủ
     */
    assignDeputy(masterId, deputyId) {
        const master = UserRepository_1.userRepository.get(masterId);
        if (!master || !master.sect_id)
            return { success: false, message: 'Đạo hữu không có Tông Môn!' };
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(master.sect_id);
        if (!sect || sect.master_id !== masterId) {
            return { success: false, message: 'Chỉ Tông Chủ mới có thể chỉ định Phó Tông Chủ!' };
        }
        const deputy = UserRepository_1.userRepository.get(deputyId);
        if (!deputy || deputy.sect_id !== master.sect_id) {
            return { success: false, message: 'Người được chỉ định phải là thành viên cùng Tông Môn!' };
        }
        database_1.default.prepare('UPDATE sects SET deputy_id = ? WHERE id = ?').run(deputyId, master.sect_id);
        return { success: true, message: `✅ Đã chỉ định **${deputy.name}** làm Phó Tông Chủ!` };
    }
    /**
     * Truyền ngôi Tông Môn
     */
    transferLeadership(masterId, targetId) {
        const master = UserRepository_1.userRepository.get(masterId);
        if (!master || !master.sect_id)
            return { success: false, message: 'Đạo hữu không có Tông Môn!' };
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(master.sect_id);
        if (!sect || sect.master_id !== masterId) {
            return { success: false, message: 'Chỉ Tông Chủ mới có thể truyền ngôi!' };
        }
        const target = UserRepository_1.userRepository.get(targetId);
        if (!target || target.sect_id !== master.sect_id) {
            return { success: false, message: 'Người nhận ngôi phải là thành viên cùng Tông Môn!' };
        }
        database_1.default.prepare('UPDATE sects SET master_id = ?, deputy_id = NULL WHERE id = ?').run(targetId, master.sect_id);
        UserRepository_1.userRepository.update(masterId, { sect_role: 'elder' });
        UserRepository_1.userRepository.update(targetId, { sect_role: 'master' });
        return { success: true, message: `👑 Đã truyền ngôi Tông Chủ cho **${target.name}**! Đạo hữu giờ là Trưởng Lão của tông môn.` };
    }
    // === P2-03: Sect Shop ===
    /**
     * Sect Shop items — level-gated, daily/weekly limits, purchasable with sect_contribution
     */
    SECT_SHOP_ITEMS = [
        { id: 'tu_khi_dan', name: 'Tụ Khí Đan', emoji: '💊', description: 'Đan dược đột phá', cost: 150, minSectLevel: 3, limitType: 'daily', limit: 3 },
        { id: 'boi_nguyen_dan', name: 'Bồi Nguyên Đan', emoji: '💎', description: 'Đan dược bổ sung nguyên khí', cost: 400, minSectLevel: 3, limitType: 'daily', limit: 2 },
        { id: 'tinh_thach_shard', name: 'Mảnh Tinh Thạch', emoji: '💠', description: 'Mảnh ghép Tinh Thạch', cost: 600, minSectLevel: 5, limitType: 'daily', limit: 1 },
        { id: 'rare_herb_pack', name: 'Bộ Thảo Dược Quý', emoji: '🌿', description: '3 thảo dược hiếm ngẫu nhiên', cost: 200, minSectLevel: 3, limitType: 'daily', limit: 5 },
        { id: 'beast_egg', name: 'Trứng Linh Thú', emoji: '🥚', description: 'Linh Thú ngẫu nhiên', cost: 1200, minSectLevel: 5, limitType: 'weekly', limit: 1 },
        { id: 'tim_phap_fragment', name: 'Hộp Mảnh Tâm Pháp', emoji: '📜', description: '2 mảnh Tâm Pháp ngẫu nhiên', cost: 1000, minSectLevel: 8, limitType: 'weekly', limit: 2 },
        { id: 'soul_essence', name: 'Tinh Hồn', emoji: '✨', description: 'Vật liệu tiến hóa Soul Weapon', cost: 2000, minSectLevel: 8, limitType: 'weekly', limit: 1 },
        { id: 'sect_title', name: 'Danh Hiệu Tông Môn', emoji: '🏆', description: 'Danh hiệu độc quyền Tông Môn', cost: 5000, minSectLevel: 10, limitType: 'permanent', limit: 1 },
        { id: 'sect_mount', name: 'Tộc Tông Môn', emoji: '🐉', description: 'Skin cưỡi độc quyền Tông Môn', cost: 15000, minSectLevel: 10, limitType: 'permanent', limit: 1 },
    ];
    /**
     * Lấy danh sách Sect Shop items (đã filter theo level tông môn)
     */
    getSectShopItems(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return [];
        const sect = database_1.default.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect)
            return [];
        const todayStart = this.getTodayStart();
        const weekStart = this.getWeekStart();
        return this.SECT_SHOP_ITEMS
            .filter(item => sect.level >= item.minSectLevel)
            .map(item => {
            const purchased = this.getPurchasedCount(userId, item.id, item.limitType, todayStart, weekStart);
            return {
                item,
                purchased,
                canBuy: purchased < item.limit && user.sect_contribution >= item.cost
            };
        });
    }
    /**
     * Mua item từ Sect Shop
     */
    buyFromSectShop(userId, itemId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn nào!' };
        const item = this.SECT_SHOP_ITEMS.find(i => i.id === itemId);
        if (!item)
            return { success: false, message: 'Vật phẩm không tồn tại!' };
        const sect = database_1.default.prepare('SELECT level FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect || sect.level < item.minSectLevel) {
            return { success: false, message: `Tông Môn cần đạt cấp ${item.minSectLevel} để mở khóa vật phẩm này!` };
        }
        if (user.sect_contribution < item.cost) {
            return { success: false, message: `Không đủ Đóng Góp! Cần **${item.cost}** (Hiện có **${user.sect_contribution}**).` };
        }
        const todayStart = this.getTodayStart();
        const weekStart = this.getWeekStart();
        const purchased = this.getPurchasedCount(userId, item.id, item.limitType, todayStart, weekStart);
        if (purchased >= item.limit) {
            return { success: false, message: `Đã mua đủ **${item.limit}** lần hôm nay/tuần!` };
        }
        // Deduct contribution
        UserRepository_1.userRepository.update(userId, { sect_contribution: user.sect_contribution - item.cost });
        // Track purchase
        database_1.default.prepare(`
      INSERT INTO sect_shop_purchases (user_id, item_id, purchased_at)
      VALUES (?, ?, ?)
    `).run(userId, itemId, Math.floor(Date.now() / 1000));
        return {
            success: true,
            message: `${item.emoji} **${item.name}** đã mua thành công! (-${item.cost} Đóng Góp)`
        };
    }
    /**
     * Lấy thông tin cửa hàng cho UI
     */
    getSectShopDescription(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return '❌ Đạo hữu chưa gia nhập Tông Môn!';
        const items = this.getSectShopItems(userId);
        if (items.length === 0)
            return '🏪 Cửa Hàng Tông Môn chưa mở (Cần Tông Môn cấp 3+)';
        let msg = `🏪 **Cửa Hàng Tông Môn** (Đóng Góp: **${user.sect_contribution}**)\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        const levels = [3, 5, 8, 10];
        for (const lvl of levels) {
            const levelItems = items.filter(i => i.item.minSectLevel === lvl);
            if (levelItems.length === 0)
                continue;
            msg += `\n**Mở khóa cấp ${lvl}:**\n`;
            for (const { item, purchased, canBuy } of levelItems) {
                const status = canBuy ? '✅' : (purchased >= item.limit ? '🔒' : '❌');
                const limitText = item.limitType === 'permanent' ? `${purchased}/${item.limit}` :
                    item.limitType === 'daily' ? `${purchased}/${item.limit}/ngày` :
                        `${purchased}/${item.limit}/tuần`;
                msg += `${status} ${item.emoji} **${item.name}** — ${item.cost} đóng góp (${limitText})\n`;
            }
        }
        return msg;
    }
    getPurchasedCount(userId, itemId, limitType, todayStart, weekStart) {
        let query = 'SELECT COUNT(*) as c FROM sect_shop_purchases WHERE user_id = ? AND item_id = ?';
        const params = [userId, itemId];
        if (limitType === 'daily') {
            query += ' AND purchased_at >= ?';
            params.push(todayStart);
        }
        else if (limitType === 'weekly') {
            query += ' AND purchased_at >= ?';
            params.push(weekStart);
        }
        // 'permanent' — no date filter, count all
        const row = database_1.default.prepare(query).get(...params);
        return row.c;
    }
    getTodayStart() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        vn.setUTCHours(0, 0, 0, 0);
        return Math.floor((vn.getTime() - 7 * 3600000) / 1000);
    }
    getWeekStart() {
        const now = new Date();
        const vn = new Date(now.getTime() + 7 * 3600000);
        const day = vn.getUTCDay() || 7;
        vn.setUTCDate(vn.getUTCDate() - (day - 1));
        vn.setUTCHours(0, 0, 0, 0);
        return Math.floor((vn.getTime() - 7 * 3600000) / 1000);
    }
    // === B-07: Sect Features Expansion ===
    sectFeatureInit = false;
    initSectFeatures() {
        if (this.sectFeatureInit)
            return;
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS sect_garden (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
        plot_index INTEGER NOT NULL,
        seed_type TEXT,
        planted_at INTEGER,
        harvest_at INTEGER,
        status TEXT DEFAULT 'empty',
        UNIQUE(sect_id, plot_index)
      );

      CREATE TABLE IF NOT EXISTS sect_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
        book_type TEXT NOT NULL,
        donated_by TEXT,
        donated_at INTEGER NOT NULL
      );
    `);
        this.sectFeatureInit = true;
    }
    /**
     * B-07: Sect Garden — Plant seeds, harvest after 24h
     */
    plantInGarden(userId, plotIndex, seedType) {
        this.initSectFeatures();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: '❌ Chưa gia nhập Tông Môn!' };
        const plot = database_1.default.prepare('SELECT * FROM sect_garden WHERE sect_id = ? AND plot_index = ?')
            .get(user.sect_id, plotIndex);
        if (plot && plot.status !== 'empty') {
            return { success: false, message: 'Ô này đã có cây!' };
        }
        const now = Math.floor(Date.now() / 1000);
        const harvestAt = now + 24 * 3600;
        database_1.default.prepare(`
      INSERT INTO sect_garden (sect_id, plot_index, seed_type, planted_at, harvest_at, status)
      VALUES (?, ?, ?, ?, ?, 'growing')
      ON CONFLICT(sect_id, plot_index) DO UPDATE SET
        seed_type = excluded.seed_type, planted_at = excluded.planted_at,
        harvest_at = excluded.harvest_at, status = 'growing'
    `).run(user.sect_id, plotIndex, seedType, now, harvestAt);
        return { success: true, message: `🌱 Đã gieo **${seedType}** vào ô ${plotIndex}. Thu hoạch sau 24h!` };
    }
    /**
     * B-07: Harvest garden plot
     */
    harvestGarden(userId, plotIndex) {
        this.initSectFeatures();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: '❌ Chưa gia nhập Tông Môn!' };
        const plot = database_1.default.prepare('SELECT * FROM sect_garden WHERE sect_id = ? AND plot_index = ?')
            .get(user.sect_id, plotIndex);
        if (!plot || plot.status !== 'growing')
            return { success: false, message: 'Ô này chưa có gì để thu hoạch!' };
        const now = Math.floor(Date.now() / 1000);
        if (now < plot.harvest_at) {
            const remainH = Math.ceil((plot.harvest_at - now) / 3600);
            return { success: false, message: `Còn **${remainH}h** nữa mới thu hoạch được!` };
        }
        // Rewards based on seed type
        const rewards = {
            'herb': { coins: 200, exp: 100 },
            'flower': { coins: 350, exp: 200 },
            'tree': { coins: 500, exp: 350 },
        };
        const reward = rewards[plot.seed_type] || rewards['herb'];
        UserRepository_1.userRepository.update(userId, {
            coin_ha_pham: user.coin_ha_pham + reward.coins,
            tu_vi: Math.min(user.tu_vi + reward.exp, user.exp_needed)
        });
        database_1.default.prepare("UPDATE sect_garden SET status = 'harvested', seed_type = NULL WHERE sect_id = ? AND plot_index = ?")
            .run(user.sect_id, plotIndex);
        return { success: true, message: `🌾 Thu hoạch thành công! +${reward.coins} LT, +${reward.exp} Tu Vi` };
    }
    /**
     * B-07: Sect Library — Donate books for shared bonuses
     */
    donateToLibrary(userId, bookType) {
        this.initSectFeatures();
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return { success: false, message: '❌ Chưa gia nhập Tông Môn!' };
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO sect_library (sect_id, book_type, donated_by, donated_at) VALUES (?, ?, ?, ?)')
            .run(user.sect_id, bookType, userId, now);
        // Count books and calculate bonus
        const bookCount = database_1.default.prepare('SELECT COUNT(*) as c FROM sect_library WHERE sect_id = ?')
            .get(user.sect_id);
        const bonus = Math.min(bookCount.c * 0.01, 0.10); // Max +10% from library
        return {
            success: true,
            message: `📚 Đã hiến tặng **${bookType}** cho Thư Viện Tông Môn!\nHiện có **${bookCount.c}** sách → **+${Math.round(bonus * 100)}%** shared bonus cho tất cả thành viên.`
        };
    }
    /**
     * B-07: Get sect library bonus
     */
    getLibraryBonus(sectId) {
        this.initSectFeatures();
        const count = database_1.default.prepare('SELECT COUNT(*) as c FROM sect_library WHERE sect_id = ?')
            .get(sectId);
        return Math.min(count.c * 0.01, 0.10);
    }
    // === B-01: Guild System Deep ===
    /**
     * B-01: Get guild levels and benefits
     */
    getGuildLevels() {
        return [
            { level: 1, memberLimit: 10, benefits: 'Tính năng tông môn cơ bản' },
            { level: 2, memberLimit: 15, benefits: '+5% Tu Vi cho thành viên' },
            { level: 3, memberLimit: 20, benefits: 'Mở khóa Cửa Hàng Tông Môn' },
            { level: 4, memberLimit: 25, benefits: '+10% Tu Vi cho thành viên' },
            { level: 5, memberLimit: 30, benefits: 'Mở khóa cửa hàng nâng cao + Kỹ Năng Tông Môn' },
            { level: 6, memberLimit: 35, benefits: '+15% Tu Vi + Thành Tựu Tông Môn' },
            { level: 7, memberLimit: 40, benefits: 'Mở khóa Sự Kiện Tông Môn' },
            { level: 8, memberLimit: 45, benefits: '+20% Tu Vi + Cửa Hàng Tinh Anh' },
            { level: 9, memberLimit: 50, benefits: 'Mở khóa Boss Tông Môn' },
            { level: 10, memberLimit: 60, benefits: '+25% Tu Vi + Cửa Hàng Huyền Thoại + Tùy Biến Tông Môn' },
        ];
    }
    /**
     * B-01: Get guild skills
     */
    getGuildSkills() {
        return [
            { id: 'gs_exp', name: 'EXP Gia Trì', description: '+5% Tu Vi cho tất cả thành viên', bonus: 'exp_bonus', levelReq: 5 },
            { id: 'gs_atk', name: 'ATK Gia Trì', description: '+3% ATK cho tất cả thành viên', bonus: 'atk_bonus', levelReq: 6 },
            { id: 'gs_def', name: 'DEF Gia Trì', description: '+3% DEF cho tất cả thành viên', bonus: 'def_bonus', levelReq: 7 },
            { id: 'gs_hp', name: 'HP Gia Trì', description: '+5% HP cho tất cả thành viên', bonus: 'hp_bonus', levelReq: 8 },
            { id: 'gs_all', name: 'Toàn Năng Gia Trì', description: '+2% tất cả chỉ số cho thành viên', bonus: 'all_bonus', levelReq: 10 },
        ];
    }
    /**
     * B-01: Get active guild skills
     */
    getActiveGuildSkills(sectId) {
        try {
            const sect = database_1.default.prepare('SELECT level FROM sects WHERE id = ?').get(sectId);
            const allSkills = this.getGuildSkills();
            return allSkills.filter(s => sect.level >= s.levelReq).map(s => ({
                id: s.id,
                name: s.name,
                bonus: s.bonus
            }));
        }
        catch {
            return [];
        }
    }
    /**
     * B-01: Get guild achievements
     */
    getGuildAchievements() {
        return [
            { id: 'ga_member_10', name: 'Phát Triển', description: 'Đạt 10 thành viên', target: 10, reward: '5000 Tu Vi tông môn' },
            { id: 'ga_member_25', name: 'Tông Môn Hùng Mạnh', description: 'Đạt 25 thành viên', target: 25, reward: '10000 Tu Vi tông môn + Danh hiệu' },
            { id: 'ga_level_5', name: 'Có Chỗ Đứng', description: 'Đạt cấp tông môn 5', target: 5, reward: 'Mở khóa Kỹ Năng Tông Môn' },
            { id: 'ga_level_10', name: 'Tông Môn Huyền Thoại', description: 'Đạt cấp tông môn 10', target: 10, reward: 'Danh hiệu Huyền Thoại + Tọa Kỵ' },
            { id: 'ga_donate_100k', name: 'Hiến Tế Rộng Lượng', description: 'Hiến tế tổng cộng 100,000', target: 100000, reward: 'Trang Phục Độc Quyền' },
        ];
    }
    /**
     * B-01: Get guild events
     */
    getGuildEvents() {
        return [
            { id: 'ge_war', name: 'Tông Chiến', description: 'Chiến trường tông môn hàng tuần', reward: 'Điểm Chiến + Phần Thưởng' },
            { id: 'ge_raid', name: 'Boss Tông Môn', description: 'Boss tông môn hàng tháng', reward: 'Nguyên Liệu Hiếm + KNB' },
            { id: 'ge_craft', name: 'Đua Chế Tạo', description: 'Thi chế tạo hàng tuần', reward: 'Nguyên Liệu Chế Tạo + Danh Hiệu' },
            { id: 'ge_explore', name: 'Thám Hiểm Tốc Độ', description: 'Thử thách thám hiểm hàng tuần', reward: 'Phần Thưởng Thám Hiểm x2' },
        ];
    }
    /**
     * B-01: Get guild description for UI
     */
    getGuildDescription(userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || !user.sect_id)
            return '❌ Chưa gia nhập Tông Môn!';
        const sect = database_1.default.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id);
        if (!sect)
            return '❌ Không tìm thấy Tông Môn!';
        const levels = this.getGuildLevels();
        const currentLevel = levels.find(l => l.level === sect.level) || levels[0];
        const nextLevel = levels.find(l => l.level === sect.level + 1);
        let msg = `☯️ **${sect.name}** (Cấp ${sect.level})\n`;
        msg += `👥 Members: ${this.getMemberCount(sect.id)}/${currentLevel.memberLimit}\n`;
        msg += `📊 Benefits: ${currentLevel.benefits}\n`;
        if (nextLevel) {
            msg += `📈 Cấp Tiếp Theo: ${nextLevel.benefits}\n`;
        }
        // Show active skills
        const skills = this.getActiveGuildSkills(sect.id);
        if (skills.length > 0) {
            msg += `\n**Kỹ Năng Tông Môn:**\n`;
            for (const s of skills) {
                msg += `• ${s.name}: ${s.bonus}\n`;
            }
        }
        return msg;
    }
    // === V16 D-04: Guild Treasury (Kho Tàng Tông Môn) ===
    initTreasuryTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS sect_treasury (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER NOT NULL,
        contributor_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        deposited_at INTEGER NOT NULL
      );
    `);
    }
    depositToTreasury(userId, sectId, itemId, itemName, quantity = 1) {
        this.initTreasuryTable();
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO sect_treasury (sect_id, contributor_id, item_id, item_name, quantity, deposited_at) VALUES (?, ?, ?, ?, ?, ?)').run(sectId, userId, itemId, itemName, quantity, now);
        // Check milestones
        const totalItems = database_1.default.prepare('SELECT SUM(quantity) as total FROM sect_treasury WHERE sect_id = ?')
            .get(sectId);
        let milestoneMsg = '';
        if (totalItems.total >= 1000)
            milestoneMsg = '\n🏆 **Kho Tàng Đã Đạt 1000 vật phẩm!** +5% stats cho cả tông môn.';
        else if (totalItems.total >= 500)
            milestoneMsg = '\n🥈 **Kho Tàng Đã Đạt 500 vật phẩm!** Mở cửa hàng tông môn.';
        return { success: true, message: `✅ Đã nộp **${quantity}x ${itemName}** vào kho tàng.${milestoneMsg}` };
    }
    getTreasuryInfo(sectId) {
        this.initTreasuryTable();
        const total = database_1.default.prepare('SELECT SUM(quantity) as total FROM sect_treasury WHERE sect_id = ?')
            .get(sectId);
        const recent = database_1.default.prepare('SELECT item_name as name, quantity, deposited_at as time FROM sect_treasury WHERE sect_id = ? ORDER BY deposited_at DESC LIMIT 10').all(sectId);
        const now = Math.floor(Date.now() / 1000);
        return {
            totalItems: total.total || 0,
            recentDeposits: recent.map(r => ({
                name: r.name,
                quantity: r.quantity,
                time: `${Math.floor((now - r.time) / 3600)}h trước`,
            })),
        };
    }
    getTreasuryDescription(sectId) {
        const info = this.getTreasuryInfo(sectId);
        let msg = `🏛️ **Kho Tàng Tông Môn**\n`;
        msg += `📦 Tổng: **${info.totalItems}** vật phẩm\n\n`;
        if (info.totalItems >= 1000)
            msg += '🏆 Milestone: +5% stats cho cả tông môn\n';
        else if (info.totalItems >= 500)
            msg += '🥈 Milestone: Mở cửa hàng tông môn\n';
        else
            msg += `📦 Còn ${500 - info.totalItems} nữa để mở cửa hàng tông môn\n`;
        if (info.recentDeposits.length > 0) {
            msg += '\n**Gần đây:**\n';
            for (const d of info.recentDeposits) {
                msg += `• ${d.name} x${d.quantity} (${d.time})\n`;
            }
        }
        return msg;
    }
}
exports.SectService = SectService;
exports.sectService = new SectService();
