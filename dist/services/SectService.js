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
            return { success: false, message: 'Dao huu da co Tong Mon! Vui long roi Tong Mon cu truoc khi sang lap mon phai moi.' };
        }
        const cost = gameConstants_1.GAME_CONSTANTS.SECT_CREATE_COST_LT;
        if (user.coin_ha_pham < cost) {
            return { success: false, message: `Dao huu khong du Linh Thach de lap Tong Mon! (Yeu cau **${cost}** Linh Thach, hien co **${user.coin_ha_pham}**)` };
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
}
exports.SectService = SectService;
exports.sectService = new SectService();
