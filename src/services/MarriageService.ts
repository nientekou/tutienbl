import { userRepository, UserEntity } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { coupleRepository } from '../database/repositories/CoupleRepository';

export interface MarriageResult {
  success: boolean;
  message: string;
}

export class MarriageService {
  public checkProposal(userId: string, targetId: string): MarriageResult {
    if (userId === targetId) {
      return { success: false, message: 'Không thể tự kết hôn với chính mình.' };
    }

    const user = userRepository.get(userId);
    const target = userRepository.get(targetId);

    if (!user) return { success: false, message: 'Nhân vật của bạn không tồn tại.' };
    if (!target) return { success: false, message: 'Người chơi mục tiêu không tồn tại.' };

    if (user.partner_id) {
      return { success: false, message: 'Đạo hữu đã có đạo lữ, không thể trêu hoa ghẹo nguyệt thêm!' };
    }
    if (target.partner_id) {
      return { success: false, message: 'Người ấy đã là hoa đã có chủ, xin đạo hữu tự trọng.' };
    }

    const inv = inventoryRepository.getUserInventory(userId);
    const hasItem = inv.find(i => i.item_id === 'item_tam_sinh_thach' && i.quantity > 0);
    if (!hasItem) {
      return { success: false, message: 'Cần có **Tam Sinh Thạch** trong túi để làm tín vật định tình!' };
    }

    return { success: true, message: 'Lời cầu hôn hợp lệ.' };
  }

  /**
   * Chấp nhận cầu hôn (chỉ gọi khi người kia đồng ý)
   */
  public acceptProposal(proposerId: string, targetId: string): MarriageResult {
    // Kiểm tra lại toàn bộ điều kiện
    const check = this.checkProposal(proposerId, targetId);
    if (!check.success) return check;

    // Trừ vật phẩm của người cầu hôn
    inventoryRepository.removeItem(proposerId, 'item_tam_sinh_thach', 1);

    // Cập nhật cả 2 người
    userRepository.update(proposerId, { partner_id: targetId, intimacy: 100 });
    userRepository.update(targetId, { partner_id: proposerId, intimacy: 100 });

    const target = userRepository.get(targetId)!;
    return { 
      success: true, 
      message: `🎉 **CHÚC MỪNG TÂN LANG TÂN NƯƠNG!** 🎉\nĐạo hữu và **${target.name}** đã chính thức kết duyên đạo lữ, thề non hẹn biển dưới Tam Sinh Thạch!`
    };
  }

  /**
   * Ly hôn
   */
  public divorce(userId: string): MarriageResult {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };
    if (!user.partner_id) return { success: false, message: 'Đạo hữu hiện đang độc thân, không thể ly hôn.' };

    const inv = inventoryRepository.getUserInventory(userId);
    const hasItem = inv.find(i => i.item_id === 'item_tuyet_tinh_nuoc' && i.quantity > 0);
    if (!hasItem) {
      return { success: false, message: 'Cần có **Tuyệt Tình Nước** để cắt đứt tơ hồng duyên phận.' };
    }

    const partnerId = user.partner_id;

    // Trừ vật phẩm
    inventoryRepository.removeItem(userId, 'item_tuyet_tinh_nuoc', 1);

    // Xóa liên kết trong bảng couples
    const couple = coupleRepository.getCoupleByUserId(userId);
    if (couple) {
      coupleRepository.deleteCouple(couple.id);
    }

    // Hình phạt ly hôn: Trừ 20% Tu Vi hiện tại
    const penaltyTuvi = Math.floor(user.tu_vi * 0.2);
    const newTuVi = Math.max(0, user.tu_vi - penaltyTuvi);
    
    // Cập nhật người ly hôn
    userRepository.update(userId, { partner_id: null, intimacy: 0, tu_vi: newTuVi });
    
    // Cập nhật người bị ly hôn (chỉ mất đạo lữ, không mất tu vi)
    userRepository.update(partnerId, { partner_id: null, intimacy: 0 });

    return { 
      success: true, 
      message: `💔 Đạo hữu đã uống cạn Tuyệt Tình Nước, cắt đứt duyên phận với đạo lữ.\nĐạo tâm chịu tổn thương nặng nề, mất đi **${penaltyTuvi}** Tu Vi.`
    };
  }

  /**
   * Song Tu
   */
  public dualCultivate(userId: string): MarriageResult & { tuviGain?: number; hpGain?: number } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại.' };
    if (!user.partner_id) return { success: false, message: 'Đạo hữu chưa có đạo lữ để song tu.' };

    const partnerId = user.partner_id;
    const partner = userRepository.get(partnerId);
    if (!partner) return { success: false, message: 'Đạo lữ của bạn không tồn tại.' };

    const now = Math.floor(Date.now() / 1000);
    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    // Tính toán Stamina cost
    const staminaCost = 30;
    if (user.stamina < staminaCost) {
      return { success: false, message: `Đạo hữu hiện đang kiệt sức (Thể lực: ${user.stamina}/${staminaCost}). Hãy nghỉ ngơi trước khi tiến hành song tu!` };
    }
    if (partner.stamina < staminaCost) {
      return { success: false, message: `Đạo lữ của bạn đang mệt mỏi, không đủ Thể lực để song tu.` };
    }

    // Kiểm tra xem hôm nay cặp này đã song tu chưa (cả 2 đều chia sẻ lượt)
    if (user.last_songtu_at >= startOfToday || partner.last_songtu_at >= startOfToday) {
      return { success: false, message: 'Hôm nay hai người đã tiến hành song tu rồi, không nên lao lực quá độ! Hãy nghỉ ngơi đến ngày mai.' };
    }

    // Trừ Thể Lực
    userRepository.update(userId, { stamina: user.stamina - staminaCost });
    userRepository.update(partnerId, { stamina: partner.stamina - staminaCost });

    // Tính toán Tu Vi và HP nhận được dựa trên Độ Thân Mật và Cảnh Giới
    // Base Tu Vi = 1000 * Cấp độ
    // Thưởng thêm từ Độ thân mật (mỗi điểm thân mật +0.5%)
    const intimacyBonus = 1 + (user.intimacy * 0.005);
    const tuviGain = Math.floor(user.level * 1000 * intimacyBonus);
    
    // HP Gain (Tạm thời tăng thẳng HP vào thuộc tính hoặc chỉ là thưởng tĩnh)
    const hpGain = Math.floor(user.base_hp * 0.1); // +10% HP cơ bản giới hạn

    // Cập nhật lượt song tu và thưởng cho cả 2
    userRepository.update(userId, { 
      last_songtu_at: now,
      tu_vi: user.tu_vi + tuviGain
    });

    userRepository.update(partnerId, { 
      last_songtu_at: now,
      tu_vi: partner.tu_vi + Math.floor(partner.level * 1000 * intimacyBonus)
    });

    // Tăng nhẹ thân mật sau mỗi lần song tu
    this.addIntimacy(userId, 5);

    return { 
      success: true, 
      tuviGain,
      message: `🌸 Mây mưa vần vũ, thiên địa giao hòa...\nĐạo hữu và đạo lữ đã song tu viên mãn! Cả hai cảm thấy tinh thần sảng khoái.\n**Thu hoạch:**\n- Nhận được **${tuviGain}** Tu Vi.\n- Tăng thêm **5** Độ Thân Mật.`
    };
  }

  /**
   * Tăng độ thân mật
   */
  public addIntimacy(userId: string, amount: number): void {
    const user = userRepository.get(userId);
    if (!user || !user.partner_id) return;

    userRepository.update(userId, { intimacy: user.intimacy + amount });
    const partner = userRepository.get(user.partner_id);
    if (partner) {
      userRepository.update(partner.discord_id, { intimacy: partner.intimacy + amount });
    }
  }
}

export const marriageService = new MarriageService();
