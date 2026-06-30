import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { ITEMS } from '../config/itemConstants';

// V17 D-02: Cave Pets Guard (Linh Thú Hộ Vệ) & /tromduoc

class CaveGuardService {
  private initTable(): void {
    try { db.exec('ALTER TABLE user_caves ADD COLUMN guard_beast_id INTEGER'); } catch {}
  }
  public assignGuard(userId: string, beastId: number): { success: boolean; message: string } {
    this.initTable();
    const beast = db.prepare('SELECT * FROM user_beasts WHERE id = ? AND user_id = ?').get(beastId, userId) as any;
    if (!beast) return { success: false, message: '❌ Sủng thú không tồn tại.' };
    if (beast.hp <= 0) return { success: false, message: '❌ Sủng thú đã kiệt sức.' };

    db.prepare('UPDATE user_caves SET guard_beast_id = ? WHERE user_id = ?').run(beastId, userId);
    return { success: true, message: `✅ ${beast.name} sẽ canh giữ động phủ cho đạo hữu.` };
  }

  public removeGuard(userId: string): { success: boolean; message: string } {
    this.initTable();
    db.prepare('UPDATE user_caves SET guard_beast_id = NULL WHERE user_id = ?').run(userId);
    return { success: true, message: '✅ Đã rút sủng thú canh giữ.' };
  }

  public stealHerbs(thiefId: string): { success: boolean; message: string; loot?: { item: string; qty: number } } {
    const thief = userRepository.get(thiefId);
    if (!thief) return { success: false, message: '❌ Chưa tạo nhân vật.' };

    // Find a random target with a cave
    const targets = db.prepare(
      'SELECT user_id FROM user_caves WHERE level >= 2 ORDER BY RANDOM() LIMIT 1'
    ).all() as { user_id: string }[];
    if (targets.length === 0) return { success: false, message: '❌ Không tìm thấy động phủ nào để trộm.' };

    const targetId = targets[0].user_id;
    if (targetId === thiefId) return { success: false, message: '❌ Không thể trộm động phủ của mình.' };

    // Check if guard beast exists
    const guard = db.prepare('SELECT guard_beast_id FROM user_caves WHERE user_id = ?').get(targetId) as any;
    let guardBeast: any = null;
    if (guard?.guard_beast_id) {
      guardBeast = db.prepare('SELECT * FROM user_beasts WHERE id = ?').get(guard.guard_beast_id) as any;
    }

    if (guardBeast) {
      // Guard fight: simplified combat check
      const thiefPower = thief.level || 1;
      const guardPower = guardBeast.atk || 10;
      const winChance = thiefPower / (thiefPower + guardPower);

      if (Math.random() < winChance) {
        // Thief wins - bypass guard
        const herbs = this.getRandomHerbs(targetId);
        if (herbs) {
          inventoryRepository.addItem(thiefId, herbs.item, herbs.qty);
          return { success: true, message: `🏃 Vượt qua **${guardBeast.name}**! Trộm được **${herbs.qty}x ${herbs.item}**!`, loot: herbs };
        }
        return { success: true, message: `🏃 Vượt qua **${guardBeast.name}**! Nhưng không có dược liệu để trộm.` };
      }

      // Guard wins - thief gets fined
      const fine = Math.floor(guardPower * 10);
      userRepository.update(thiefId, { coin_ha_pham: Math.max(0, thief.coin_ha_pham - fine) });
      userRepository.update(targetId, { coin_ha_pham: (userRepository.get(targetId)?.coin_ha_pham || 0) + fine });
      return { success: false, message: `🐾 **${guardBeast.name}** phát hiện kẻ trộm! Bị phạt **${fine}** LT!` };
    }

    // No guard - steal freely
    const herbs = this.getRandomHerbs(targetId);
    if (herbs) {
      inventoryRepository.addItem(thiefId, herbs.item, herbs.qty);
      return { success: true, message: `🕵️ Đột nhập thành công! Trộm được **${herbs.qty}x ${herbs.item}**!`, loot: herbs };
    }
    return { success: true, message: '🕵️ Đột nhập thành công! Nhưng động phủ trống trơn.' };
  }

  private getRandomHerbs(userId: string): { item: string; qty: number } | null {
    const herbs = db.prepare(
      'SELECT item_id, quantity FROM inventories WHERE user_id = ? AND (item_id LIKE ? OR item_id LIKE ?) AND quantity > 0 LIMIT 10'
    ).all(userId, 'herb_%', 'seed_%') as any[];
    if (herbs.length === 0) return null;
    const picked = herbs[Math.floor(Math.random() * herbs.length)];
    const stolenQty = Math.min(picked.quantity, Math.max(1, Math.floor(Math.random() * 3) + 1));
    db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?')
      .run(stolenQty, userId, picked.item_id);
    return { item: picked.item_id, qty: stolenQty };
  }

  public getGuardInfo(userId: string): string {
    const guard = db.prepare('SELECT guard_beast_id FROM user_caves WHERE user_id = ?').get(userId) as any;
    if (!guard?.guard_beast_id) return '🛡️ Không có linh thú canh giữ.';
    const beast = db.prepare('SELECT name, atk, def, hp FROM user_beasts WHERE id = ?').get(guard.guard_beast_id) as any;
    if (!beast) return '🛡️ Không có linh thú canh giữ.';
    return `🛡️ **${beast.name}** đang canh giữ (ATK: ${beast.atk}, DEF: ${beast.def}, HP: ${beast.hp})`;
  }
}

export const caveGuardService = new CaveGuardService();
