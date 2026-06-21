import db from '../database/database';
import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import { achievementService } from './AchievementService';
import { leylineService } from './LeylineService';

export interface SectDetails {
  id: number;
  name: string;
  master_id: string;
  master_name: string;
  level: number;
  exp: number;
  resources: number;
  tu_linh_level: number;
  dan_duong_level: number;
  description: string;
  created_at: number;
  member_count: number;
  member_limit: number;
  members: Array<{
    discord_id: string;
    name: string;
    title: string;
    level: number;
    sect_contribution: number;
  }>;
}

export class SectService {
  /**
   * Tạo Tông Môn mới (Tiêu hao 500 Linh thạch)
   */
  public createSect(userId: string, name: string, description: string): { success: boolean; message: string; sectId?: number } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Nhân vật của đạo hữu không tồn tại.' };
    }

    if (user.sect_id) {
      return { success: false, message: 'Đạo hữu đã có Tông Môn! Vui lòng rời Tông Môn cũ trước khi sáng lập môn phái mới.' };
    }

    if (user.coin_ha_pham < 500) {
      return { success: false, message: `Đạo hữu không đủ Linh Thạch để lập Tông Môn! (Yêu cầu **500** Linh Thạch, hiện có **${user.coin_ha_pham}**)` };
    }

    const nameRegex = /^[a-zA-Z0-9À-ỹ\s]{2,20}$/;
    if (!nameRegex.test(name.trim())) {
      return { success: false, message: 'Tên Tông Môn không hợp lệ! Chỉ được chứa chữ cái, số, dấu tiếng Việt, khoảng trắng và dài từ 2 đến 20 ký tự.' };
    }

    // Kiểm tra tên trùng lặp
    const existing = db.prepare('SELECT id FROM sects WHERE name = ?').get(name.trim());
    if (existing) {
      return { success: false, message: 'Tên Tông Môn này đã tồn tại trong bát hoang. Vui lòng chọn danh hiệu khác!' };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      db.prepare(`
        INSERT INTO sects (name, master_id, level, exp, resources, description, created_at)
        VALUES (?, ?, 1, 0, 0, ?, ?)
      `).run(name.trim(), userId, description.trim(), now);

      const sect = db.prepare('SELECT id FROM sects WHERE name = ?').get(name.trim()) as { id: number };

      userRepository.update(userId, {
        sect_id: sect.id,
        sect_contribution: 100, // Thưởng 100 điểm đóng góp khởi lập
        joined_sect_at: now,
        coin_ha_pham: user.coin_ha_pham - 500
      });

      return { 
        success: true, 
        message: `🎉 Chúc mừng đạo hữu lập thành công Tông Môn **${name.trim()}**! Thiên hạ đệ tử sẽ sớm quy phục.`,
        sectId: sect.id
      };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Lỗi hệ thống khi khởi tạo Tông Môn.' };
    }
  }

  /**
   * Gia nhập Tông Môn có sẵn
   */
  public joinSect(userId: string, sectId: number): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Nhân vật của đạo hữu không tồn tại.' };
    }

    if (user.sect_id) {
      return { success: false, message: 'Đạo hữu đã ở trong một Tông Môn rồi!' };
    }

    const sect = db.prepare('SELECT level, name FROM sects WHERE id = ?').get(sectId) as { level: number; name: string } | undefined;
    if (!sect) {
      return { success: false, message: 'Tông Môn này không tồn tại hoặc đã bị giải tán.' };
    }

    // Giới hạn đệ tử = 5 * Cấp Tông Môn
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE sect_id = ?').get(sectId) as { count: number };
    const limit = sect.level * 5;

    if (memberCount.count >= limit) {
      return { success: false, message: `Tông Môn **${sect.name}** đã đạt tối đa giới hạn đệ tử (**${memberCount.count}/${limit}** người)!` };
    }

    const now = Math.floor(Date.now() / 1000);
    userRepository.update(userId, {
      sect_id: sectId,
      sect_contribution: 0,
      joined_sect_at: now
    });

    // Kiểm tra thành tựu gia nhập tông môn
    achievementService.updateProgress(userId, 'sh_1', 1);

    return { 
      success: true, 
      message: `🟢 Chúc mừng đạo hữu đã gia nhập **${sect.name}**! Hãy đồng tâm hiệp lực cống hiến vì tông môn.` 
    };
  }

  /**
   * Rời khỏi Tông Môn (Nếu là Tông Chủ sẽ giải tán luôn Tông Môn)
   */
  public leaveSect(userId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) {
      return { success: false, message: 'Đạo hữu hiện là Tán Tu tự do, chưa gia nhập Tông môn nào!' };
    }

    const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as any;
    if (!sect) {
      // Dọn dẹp an toàn nếu sect đã mất tích trong DB
      userRepository.update(userId, { sect_id: null, sect_contribution: 0, joined_sect_at: null });
      return { success: true, message: 'Đã giải phóng đạo hữu về Tán Tu tự do.' };
    }

    if (sect.master_id === userId) {
      // Giải tán Tông môn
      db.prepare('UPDATE users SET sect_id = NULL, sect_contribution = 0, joined_sect_at = NULL WHERE sect_id = ?')
        .run(sect.id);
      db.prepare('DELETE FROM sects WHERE id = ?').run(sect.id);
      
      return { success: true, message: `💥 Đạo hữu là Tông Chủ! Tông môn **${sect.name}** đã chính thức **Giải Tán**, toàn bộ đệ tử trở lại thành Tán Tu.` };
    } else {
      userRepository.update(userId, { sect_id: null, sect_contribution: 0, joined_sect_at: null });
      return { success: true, message: `🔙 Đạo hữu đã rời khỏi Tông môn **${sect.name}**, bắt đầu lại hành trình Tán Tu.` };
    }
  }

  /**
   * Quyên góp Linh Thạch cống hiến Tông Môn
   */
  public donateToSect(userId: string, amount: number): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) {
      return { success: false, message: 'Đạo hữu chưa tham gia Tông môn nào để quyên góp!' };
    }

    if (user.coin_ha_pham < amount) {
      return { success: false, message: `Đạo hữu không đủ Linh thạch để cống hiến! (Có: ${user.coin_ha_pham} Linh thạch)` };
    }

    const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as any;
    if (!sect) {
      return { success: false, message: 'Tông môn không tồn tại.' };
    }

    // Leyline Buff Tông Môn (+15% cống hiến)
    let contributionGained = amount;
    if (leylineService.isBuffActive('tongmon')) {
      contributionGained = Math.floor(amount * 1.15);
    }
    
    // Cập nhật người chơi
    const newContribution = user.sect_contribution + contributionGained;
    userRepository.update(userId, {
      coin_ha_pham: user.coin_ha_pham - amount,
      sect_contribution: newContribution
    });

    // Kiểm tra thành tựu cống hiến tông môn
    achievementService.setProgress(userId, 'sh_2', newContribution);

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

    db.prepare('UPDATE sects SET resources = ?, exp = ?, level = ? WHERE id = ?')
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
  public getSectDetails(sectId: number): SectDetails | null {
    const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(sectId) as any;
    if (!sect) return null;

    const master = userRepository.get(sect.master_id);
    const masterName = master ? master.name : 'Vô danh';

    const members = db.prepare(`
      SELECT discord_id, name, title, level, sect_contribution
      FROM users
      WHERE sect_id = ?
      ORDER BY sect_contribution DESC
    `).all(sectId) as any[];

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
  public upgradeFacility(userId: string, facility: 'tuling' | 'danduong'): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user || !user.sect_id) {
      return { success: false, message: 'Đạo hữu chưa tham gia Tông môn nào!' };
    }

    const sect = db.prepare('SELECT * FROM sects WHERE id = ?').get(user.sect_id) as any;
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

    db.transaction(() => {
      db.prepare(`UPDATE sects SET resources = resources - ?, ${updateColumn} = ? WHERE id = ?`)
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
   * Lấy danh sách các Tông Môn đứng đầu server
   */
  public getTopSects(): Array<{ id: number; name: string; level: number; member_count: number; member_limit: number; master_name: string }> {
    const list = db.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM users u WHERE u.sect_id = s.id) as member_count,
        (SELECT name FROM users u WHERE u.discord_id = s.master_id) as master_name
      FROM sects s
      ORDER BY s.level DESC, s.exp DESC
      LIMIT 10
    `).all() as any[];

    return list.map(item => ({
      id: item.id,
      name: item.name,
      level: item.level,
      member_count: item.member_count,
      member_limit: item.level * 5,
      master_name: item.master_name || 'Vô danh'
    }));
  }
}

export const sectService = new SectService();
