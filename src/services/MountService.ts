import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';

export interface Mount {
  id: number;
  user_id: string;
  name: string;
  template_id: string;
  rarity: string;
  level: number;
  exp: number;
  speed_bonus: number;
  stamina_save: number;
  is_active: number;
  skills: string;
  is_tamed: number;
  created_at: number;
}

const EXP_PER_LEVEL = 100;
const MAX_LEVEL = 10;

class MountService {
  public getMounts(userId: string): Mount[] {
    return db.prepare('SELECT * FROM mounts WHERE user_id = ? ORDER BY level DESC, rarity DESC').all(userId) as Mount[];
  }

  public getActiveMount(userId: string): Mount | null {
    return (db.prepare('SELECT * FROM mounts WHERE user_id = ? AND is_active = 1').get(userId) as Mount) || null;
  }

  public getMount(id: number, userId: string): Mount | null {
    return (db.prepare('SELECT * FROM mounts WHERE id = ? AND user_id = ?').get(id, userId) as Mount) || null;
  }

  public activateMount(userId: string, mountId: number): { success: boolean; message: string } {
    const mount = this.getMount(mountId, userId);
    if (!mount) return { success: false, message: 'Tọa kỵ không tồn tại!' };
    if (!mount.is_tamed) return { success: false, message: 'Tọa kỵ chưa được thuần hóa, không thể cưỡi!' };

    db.transaction(() => {
      db.prepare('UPDATE mounts SET is_active = 0 WHERE user_id = ?').run(userId);
      db.prepare('UPDATE mounts SET is_active = 1 WHERE id = ? AND user_id = ?').run(mountId, userId);
    })();

    return { success: true, message: `🐎 Đã cưỡi **${mount.name}**! Tốc độ làm việc +${Math.round(mount.speed_bonus * 100)}%, Thể lực tiết kiệm +${Math.round(mount.stamina_save * 100)}%.` };
  }

  public deactivateMount(userId: string): { success: boolean; message: string } {
    const active = this.getActiveMount(userId);
    if (!active) return { success: false, message: 'Đạo hữu không cưỡi tọa kỵ nào!' };

    db.prepare('UPDATE mounts SET is_active = 0 WHERE user_id = ?').run(userId);
    return { success: true, message: `🐎 Đã thu hồi **${active.name}** về mãnh thú các.` };
  }

  public feedMount(userId: string, mountId: number, materialItemId: string, qty: number = 1): { success: boolean; message: string; leveledUp?: boolean } {
    const mount = this.getMount(mountId, userId);
    if (!mount) return { success: false, message: 'Tọa kỵ không tồn tại!' };

    if (mount.level >= MAX_LEVEL) {
      return { success: false, message: `**${mount.name}** đã đạt cấp tối đa (${MAX_LEVEL})!` };
    }

    const inv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, materialItemId) as any;
    if (!inv || inv.quantity < 1) return { success: false, message: 'Không có nguyên liệu để nuôi!' };

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(materialItemId) as any;
    const rarityExp: Record<string, number> = { common: 15, uncommon: 30, rare: 50, epic: 80, legendary: 150 };
    const expGain = rarityExp[item?.rarity] || 15;

    let newLevel = mount.level;
    let remainingExp = mount.exp;
    let leveledUp = false;
    let consumedCount = 0;

    const maxConsume = Math.min(qty, inv.quantity);

    for (let i = 0; i < maxConsume; i++) {
      if (newLevel >= MAX_LEVEL) {
        break;
      }
      remainingExp += expGain;
      consumedCount++;

      let expNeeded = (newLevel < 1 ? 1 : newLevel) * EXP_PER_LEVEL;
      while (remainingExp >= expNeeded && newLevel < MAX_LEVEL) {
        remainingExp -= expNeeded;
        newLevel++;
        leveledUp = true;
        expNeeded = (newLevel < 1 ? 1 : newLevel) * EXP_PER_LEVEL;
      }
    }

    if (consumedCount === 0) {
      return { success: false, message: `**${mount.name}** đã đạt cấp tối đa (${MAX_LEVEL})!` };
    }

    // Tính bonus mới dựa trên level
    const baseSpeedByRarity: Record<string, number> = { common: 0.02, uncommon: 0.04, rare: 0.07, epic: 0.10, legendary: 0.15 };
    const baseStaminaByRarity: Record<string, number> = { common: 0.01, uncommon: 0.02, rare: 0.04, epic: 0.06, legendary: 0.10 };
    const baseSpeed = baseSpeedByRarity[mount.rarity] || 0.02;
    const baseStamina = baseStaminaByRarity[mount.rarity] || 0.01;
    const newSpeedBonus = Math.min(baseSpeed * newLevel, 0.5);
    const newStaminaSave = Math.min(baseStamina * newLevel, 0.3);

    let newTamed = mount.is_tamed;
    if (!newTamed && newLevel >= 1) {
      newTamed = 1;
    }

    db.transaction(() => {
      if (inv.quantity > consumedCount) {
        db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(consumedCount, inv.id);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
      }
      db.prepare('UPDATE mounts SET exp = ?, level = ?, speed_bonus = ?, stamina_save = ?, is_tamed = ? WHERE id = ? AND user_id = ?')
        .run(remainingExp, newLevel, newSpeedBonus, newStaminaSave, newTamed, mountId, userId);
    })();

    const totalExpGained = consumedCount * expGain;
    let msg = `🍖 **${mount.name}** hấp thụ x${consumedCount} **${item?.name || materialItemId}**, nhận **+${totalExpGained}** EXP!`;
    if (!mount.is_tamed && newTamed) {
      msg += `\n🎉 **THUẦN HÓA THÀNH CÔNG!** Đạo hữu đã có thể cưỡi tọa kỵ này.`;
    } else if (leveledUp) {
      msg += `\n⬆️ **Thăng cấp: ${newLevel}** | Tốc độ: +${Math.round(newSpeedBonus * 100)}% | Tiết kiệm: +${Math.round(newStaminaSave * 100)}%`;
    }

    return {
      success: true,
      message: msg,
      leveledUp,
    };
  }

  public calculateExpProgress(mount: Mount): { current: number; needed: number; pct: number } {
    const levelToUse = mount.level < 1 ? 1 : mount.level;
    const needed = levelToUse * EXP_PER_LEVEL;
    return { current: mount.exp, needed, pct: Math.min(100, Math.round((mount.exp / needed) * 100)) };
  }

  public captureMount(userId: string, consumeItemId: string): { success: boolean; message: string; mount?: any } {
    // Tiêu hao Thừng Bắt Thú
    const inv = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND item_id = ?').get(userId, consumeItemId) as any;
    if (!inv || inv.quantity < 1) {
      return { success: false, message: 'Đạo hữu không có Thừng Bắt Thú (item_id: thung_bat_thu)!' };
    }

    const mountsConfig = [
      { id: 'horse', name: 'Huyết Hãn Mã', rarity: 'common', prob: 0.5 },
      { id: 'wolf', name: 'U Minh Lang', rarity: 'uncommon', prob: 0.3 },
      { id: 'tiger', name: 'Xích Viêm Hổ', rarity: 'rare', prob: 0.15 },
      { id: 'dragon', name: 'Giao Long', rarity: 'epic', prob: 0.04 },
      { id: 'kirin', name: 'Hỏa Kỳ Lân', rarity: 'legendary', prob: 0.01 }
    ];

    let roll = Math.random();
    let selectedMount = mountsConfig[0];
    for (const m of mountsConfig) {
      if (roll < m.prob) {
        selectedMount = m;
        break;
      }
      roll -= m.prob;
    }

    // Tỷ lệ bắt thành công dựa trên rarity
    const catchRate: Record<string, number> = { common: 0.8, uncommon: 0.6, rare: 0.4, epic: 0.2, legendary: 0.05 };
    const successRate = catchRate[selectedMount.rarity];

    db.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(inv.id);
    if (inv.quantity - 1 <= 0) {
      db.prepare('DELETE FROM inventories WHERE id = ?').run(inv.id);
    }

    if (Math.random() > successRate) {
      return { success: false, message: `💥 Đạo hữu đã phát hiện **${selectedMount.name}** [${selectedMount.rarity}] nhưng nó đã vùng vẫy thoát khỏi Thừng Bắt Thú!` };
    }

    const res = db.prepare(`
      INSERT INTO mounts (user_id, name, template_id, rarity, level, exp, speed_bonus, stamina_save, is_tamed, created_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?)
    `).run(userId, selectedMount.name, selectedMount.id, selectedMount.rarity, Math.floor(Date.now() / 1000));

    return {
      success: true,
      message: `🎉 Chúc mừng! Đạo hữu đã tóm được **${selectedMount.name}** [${selectedMount.rarity}]! (ID: ${res.lastInsertRowid})\n⚠️ Tọa kỵ vẫn còn hoang dại, hãy dùng \`/toaky nuoiduong\` để thuần hóa.`,
      mount: selectedMount
    };
  }
}

export const mountService = new MountService();
