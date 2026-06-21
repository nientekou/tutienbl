import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import db from '../database/database';

export class FeastService {
  /**
   * Tham gia yến tiệc tông môn hằng ngày
   */
  public joinFeast(discordId: string): { success: boolean; message: string; user?: UserEntity } {
    const user = userRepository.get(discordId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật. Hãy dùng `/taonhanvat`!' };
    }

    if (!user.sect_id) {
      return { success: false, message: '❌ Đạo hữu chưa tham gia Tông Môn nào! Hãy gia nhập hoặc thành lập Tông Môn để tham gia yến tiệc.' };
    }

    // Lấy thông tin Tông Môn
    let sectName = 'Tông Môn';
    try {
      const sect = db.prepare('SELECT name FROM sects WHERE id = ?').get(user.sect_id) as { name: string } | undefined;
      if (sect) {
        sectName = sect.name;
      }
    } catch (e) {}

    const now = new Date();
    const hour = now.getHours();

    if (hour !== 12 && hour !== 18) {
      return {
        success: false,
        message: '❌ Yến tiệc tông môn chỉ mở vào hai khung giờ hằng ngày:\n' +
                 '• ☀️ **12:00 - 13:00** (Yến tiệc giờ Ngọ)\n' +
                 '• 🌙 **18:00 - 19:00** (Yến tiệc giờ Dậu)'
      };
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const slotKey = `${year}-${month}-${day}-${hour}`;

    let yCanhMap: Record<string, any> = {};
    try {
      yCanhMap = JSON.parse(user.y_canh || '{}');
    } catch (e) {
      yCanhMap = {};
    }

    if (yCanhMap.last_feast_claimed === slotKey) {
      return { success: false, message: `❌ Đạo hữu đã dùng yến tiệc trong khung giờ này tại **${sectName}** rồi. Hãy quay lại vào khung giờ tiếp theo!` };
    }

    if (user.stamina >= 500) {
      return { success: false, message: '❌ Thể lực của đạo hữu đang đầy tràn (500/500), không cần dùng thêm linh thực yến tiệc.' };
    }

    const newStamina = Math.min(500, user.stamina + 100);
    yCanhMap.last_feast_claimed = slotKey;

    userRepository.update(discordId, {
      stamina: newStamina,
      y_canh: JSON.stringify(yCanhMap)
    });

    const updatedUser = userRepository.get(discordId)!;
    const feastType = hour === 12 ? 'Ngọ Tiệc' : 'Dậu Tiệc';

    return {
      success: true,
      message: `🍲 **TÔNG MÔN YẾN TIỆC (${feastType}):**\n` +
               `Đạo hữu tiến vào đại sảnh **${sectName}**, cùng các đồng môn thưởng thức linh quả, trân tu vạn năm.\n` +
               `💪 Thể lực phục hồi: **+100 Thể Lực** (Hiện tại: **${updatedUser.stamina}/500**).`,
      user: updatedUser
    };
  }
}

export const feastService = new FeastService();
