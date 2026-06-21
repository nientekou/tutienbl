import { soulWeaponRepository, SoulWeapon } from '../database/repositories/SoulWeaponRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import db from '../database/database';
import { ActiveStats } from './InventoryService';

class SoulWeaponService {
  private readonly MAX_LEVEL = 100;

  // Cần bao nhiêu exp để thăng cấp? (Cấp * 50)
  public getExpRequired(level: number): number {
    return level * 50;
  }

  // Nuốt trang bị rác để tăng EXP
  public feedItems(userId: string, inventoryIds: number[]): { success: boolean; message: string; expGained: number; levelUp: number } {
    const sw = soulWeaponRepository.getByUserId(userId);
    if (!sw) return { success: false, message: 'Đạo hữu chưa có Pháp Bảo Bản Mệnh!', expGained: 0, levelUp: 0 };
    if (sw.level >= this.MAX_LEVEL) return { success: false, message: 'Pháp Bảo đã đạt cấp tối đa!', expGained: 0, levelUp: 0 };

    if (inventoryIds.length === 0) return { success: false, message: 'Vui lòng chọn ít nhất 1 vật phẩm để tế luyện!', expGained: 0, levelUp: 0 };

    let totalExpGained = 0;
    let itemsDestroyed = 0;
    
    const tx = db.transaction(() => {
      for (const invId of inventoryIds) {
        // Chỉ lấy trang bị (equipable = 1) hoặc nguyên liệu
        const item = db.prepare(`
          SELECT i.id, i.quantity, i.is_equipped, t.rarity, t.type
          FROM inventories i
          JOIN items t ON i.item_id = t.id
          WHERE i.id = ? AND i.user_id = ?
        `).get(invId, userId) as any;

        if (!item || item.is_equipped === 1) continue;

        // Tính EXP dựa trên độ hiếm
        let expPerItem = 1;
        if (item.rarity === 'uncommon') expPerItem = 2;
        if (item.rarity === 'rare') expPerItem = 5;
        if (item.rarity === 'epic') expPerItem = 20;
        if (item.rarity === 'legendary') expPerItem = 100;

        totalExpGained += (expPerItem * item.quantity);
        itemsDestroyed += item.quantity;
        
        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      }
    });

    tx();

    if (itemsDestroyed === 0) {
      return { success: false, message: 'Không có vật phẩm nào hợp lệ để tế luyện (hoặc đang được trang bị).', expGained: 0, levelUp: 0 };
    }

    let currentExp = sw.exp + totalExpGained;
    let currentLevel = sw.level;
    let levelUps = 0;

    while (currentLevel < this.MAX_LEVEL) {
      const required = this.getExpRequired(currentLevel);
      if (currentExp >= required) {
        currentExp -= required;
        currentLevel++;
        levelUps++;
      } else {
        break;
      }
    }

    // Nếu đạt max cấp, reset exp
    if (currentLevel >= this.MAX_LEVEL) {
      currentLevel = this.MAX_LEVEL;
      currentExp = 0;
    }

    soulWeaponRepository.updateLevelExp(sw.id, currentLevel, currentExp);

    let msg = `✨ Đã hiến tế **${itemsDestroyed}** vật phẩm. Pháp bảo **${sw.name}** nhận được **${totalExpGained} EXP**!`;
    if (levelUps > 0) msg += `\n🎉 **Bạo phát!** Pháp bảo đột phá **${levelUps}** cấp, đạt **Lv${currentLevel}**!`;

    return { success: true, message: msg, expGained: totalExpGained, levelUp: levelUps };
  }
}

export const soulWeaponService = new SoulWeaponService();
