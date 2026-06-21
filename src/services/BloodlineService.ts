import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export interface Bloodline {
  id: string;
  name: string;
  description: string;
  passives: string; // JSON
  weakness: string; // JSON
  rage_effect: string; // JSON
}

export interface UserBloodline {
  user_id: string;
  bloodline_id: string;
  level: number;
  exp: number;
  activated_at: number;
  rage_cooldown: number;
}

class BloodlineService {
  public getAllBloodlines(): Bloodline[] {
    return db.prepare('SELECT * FROM bloodlines').all() as Bloodline[];
  }

  public getUserBloodline(userId: string): (UserBloodline & { name: string, description: string, passives: any, weakness: any, rage_effect: any }) | null {
    const row = db.prepare(`
      SELECT ub.*, b.name, b.description, b.passives, b.weakness, b.rage_effect
      FROM user_bloodlines ub
      JOIN bloodlines b ON ub.bloodline_id = b.id
      WHERE ub.user_id = ?
    `).get(userId) as any;

    if (!row) return null;
    return {
      ...row,
      passives: JSON.parse(row.passives || '{}'),
      weakness: JSON.parse(row.weakness || '{}'),
      rage_effect: JSON.parse(row.rage_effect || '{}'),
    };
  }

  public chooseBloodline(userId: string, bloodlineId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại!' };
    if (user.level < 10) return { success: false, message: 'Cần đạt Cấp 10 để giác tỉnh Huyết Mạch!' };

    const existing = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
    if (existing) return { success: false, message: 'Đạo hữu đã giác tỉnh Huyết Mạch rồi! Hãy dùng Huyết Mạch Chuyển Hóa Đan để thay đổi.' };

    const bloodline = db.prepare('SELECT * FROM bloodlines WHERE id = ?').get(bloodlineId) as Bloodline | undefined;
    if (!bloodline) return { success: false, message: 'Huyết mạch không tồn tại!' };

    if (user.coin_ha_pham < 500) return { success: false, message: 'Thiếu 500 Linh Thạch phí giác tỉnh!' };

    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 500 });
      db.prepare(`
        INSERT INTO user_bloodlines (user_id, bloodline_id, level, exp, activated_at, rage_cooldown)
        VALUES (?, ?, 1, 0, ?, 0)
      `).run(userId, bloodlineId, now);
    })();

    return { success: true, message: `🩸 Chúc mừng! Đạo hữu đã giác tỉnh thành công **${bloodline.name}**!` };
  }

  public changeBloodline(userId: string, newBloodlineId: string): { success: boolean; message: string } {
    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Nhân vật không tồn tại!' };

    const existing = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId);
    if (!existing) return { success: false, message: 'Đạo hữu chưa giác tỉnh Huyết Mạch! Dùng /huyetmach chon để giác tỉnh.' };

    const bloodline = db.prepare('SELECT * FROM bloodlines WHERE id = ?').get(newBloodlineId) as Bloodline | undefined;
    if (!bloodline) return { success: false, message: 'Huyết mạch mới không tồn tại!' };

    const requiredItem = 'item_bloodline_pill'; // ID của Huyết Mạch Chuyển Hóa Đan
    const inv = inventoryRepository.getUserInventory(userId);
    const item = inv.find(i => i.item_id === requiredItem && i.is_equipped === 0);

    if (!item || item.quantity < 1) {
      return { success: false, message: 'Đạo hữu cần 1 viên **Huyết Mạch Chuyển Hóa Đan** để thay đổi huyết mạch!' };
    }

    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      if (item.quantity > 1) {
        db.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(item.id);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      }

      db.prepare(`
        UPDATE user_bloodlines 
        SET bloodline_id = ?, level = 1, exp = 0, activated_at = ?, rage_cooldown = 0
        WHERE user_id = ?
      `).run(newBloodlineId, now, userId);
    })();

    return { success: true, message: `🩸 Đạo hữu đã chuyển đổi thành công sang **${bloodline.name}**. Huyết mạch tu vi quay về cấp 1!` };
  }

  public addExp(userId: string, expAmount: number): void {
    const ub = db.prepare('SELECT * FROM user_bloodlines WHERE user_id = ?').get(userId) as UserBloodline | undefined;
    if (!ub) return;
    if (ub.level >= 50) return; // Max level

    let currentExp = ub.exp;
    let currentLevel = ub.level;
    currentExp += expAmount;

    let expNeeded = currentLevel * 200;
    while (currentExp >= expNeeded && currentLevel < 50) {
      currentExp -= expNeeded;
      currentLevel++;
      expNeeded = currentLevel * 200;
    }

    if (currentLevel >= 50) {
      currentLevel = 50;
      currentExp = 0;
    }

    db.prepare('UPDATE user_bloodlines SET level = ?, exp = ? WHERE user_id = ?').run(currentLevel, currentExp, userId);
  }

  public getActivePassives(ub: UserBloodline & { passives: any }): any {
    const result: any = {};
    const passives = ub.passives;
    // levels = ['1', '10', '25', '50']
    const breakpoints = [1, 10, 25, 50];
    for (const bp of breakpoints) {
      if (ub.level >= bp && passives[bp.toString()]) {
        const p = passives[bp.toString()];
        result[p.stat] = p.value;
      }
    }
    return result;
  }

  public updateRageCooldown(userId: string, newCooldown: number): void {
    db.prepare('UPDATE user_bloodlines SET rage_cooldown = ? WHERE user_id = ?').run(newCooldown, userId);
  }
}

export const bloodlineService = new BloodlineService();
