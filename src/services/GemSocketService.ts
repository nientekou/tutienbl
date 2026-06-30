import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

interface GemDef {
  id: string;
  name: string;
  element: string;
  tier: number;
  statBonus: Record<string, number>;
}

const GEMS: GemDef[] = [
  { id: 'gem_fire_1', name: 'Hỏa Ngọc Cấp 1', element: 'Hỏa', tier: 1, statBonus: { atk: 5, crit: 0.01 } },
  { id: 'gem_fire_2', name: 'Hỏa Ngọc Cấp 2', element: 'Hỏa', tier: 2, statBonus: { atk: 15, crit: 0.03 } },
  { id: 'gem_fire_3', name: 'Hỏa Ngọc Cấp 3', element: 'Hỏa', tier: 3, statBonus: { atk: 40, crit: 0.05 } },
  { id: 'gem_water_1', name: 'Thủy Ngọc Cấp 1', element: 'Thủy', tier: 1, statBonus: { hp: 50, def: 3 } },
  { id: 'gem_water_2', name: 'Thủy Ngọc Cấp 2', element: 'Thủy', tier: 2, statBonus: { hp: 150, def: 10 } },
  { id: 'gem_water_3', name: 'Thủy Ngọc Cấp 3', element: 'Thủy', tier: 3, statBonus: { hp: 400, def: 25 } },
  { id: 'gem_earth_1', name: 'Thổ Ngọc Cấp 1', element: 'Thổ', tier: 1, statBonus: { def: 5, hp: 30 } },
  { id: 'gem_earth_2', name: 'Thổ Ngọc Cấp 2', element: 'Thổ', tier: 2, statBonus: { def: 15, hp: 100 } },
  { id: 'gem_earth_3', name: 'Thổ Ngọc Cấp 3', element: 'Thổ', tier: 3, statBonus: { def: 40, hp: 300 } },
  { id: 'gem_thunder_1', name: 'Lôi Ngọc Cấp 1', element: 'Lôi', tier: 1, statBonus: { speed: 5, crit: 0.02 } },
  { id: 'gem_thunder_2', name: 'Lôi Ngọc Cấp 2', element: 'Lôi', tier: 2, statBonus: { speed: 15, crit: 0.04 } },
  { id: 'gem_thunder_3', name: 'Lôi Ngọc Cấp 3', element: 'Lôi', tier: 3, statBonus: { speed: 40, crit: 0.06 } },
];

class GemSocketService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS item_sockets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
        slot_index INTEGER NOT NULL DEFAULT 0,
        gem_id TEXT,
        UNIQUE(inventory_id, slot_index)
      );
    `);
  }

  public getSockets(inventoryId: number): { slotIndex: number; gemId: string | null }[] {
    this.initTable();
    const rows = db.prepare('SELECT slot_index, gem_id FROM item_sockets WHERE inventory_id = ? ORDER BY slot_index')
      .all(inventoryId) as any[];
    return rows.map(r => ({ slotIndex: r.slot_index, gemId: r.gem_id }));
  }

  public getMaxSockets(itemId: string): number {
    if (itemId.includes('sss') || itemId.includes('ex')) return 3;
    if (itemId.includes('ss') || itemId.includes('s')) return 2;
    return 1;
  }

  public socketGem(userId: string, inventoryId: number, gemItemId: string): { success: boolean; message: string } {
    this.initTable();
    const inv = inventoryRepository.get(inventoryId);
    if (!inv || inv.user_id !== userId) return { success: false, message: '❌ Vật phẩm không tồn tại.' };
    if (inv.equipable !== 1) return { success: false, message: '❌ Chỉ có thể khảm ngọc lên trang bị.' };

    const maxSockets = this.getMaxSockets(inv.item_id);
    const existingSockets = this.getSockets(inventoryId);
    if (existingSockets.length >= maxSockets) return { success: false, message: `❌ Trang bị chỉ có ${maxSockets} lỗ khảm.` };

    const gem = GEMS.find(g => g.id === gemItemId);
    if (!gem) return { success: false, message: '❌ Ngọc không hợp lệ.' };

    const gemInv = db.prepare('SELECT id, quantity FROM inventories WHERE user_id = ? AND item_id = ?')
      .get(userId, gemItemId) as any;
    if (!gemInv || gemInv.quantity < 1) return { success: false, message: `❌ Không có ${gem.name} trong hành trang.` };

    const usedSlots = new Set(existingSockets.map(s => s.slotIndex));
    let nextSlot = 0;
    while (usedSlots.has(nextSlot)) nextSlot++;

    db.transaction(() => {
      if (gemInv.quantity > 1) {
        db.prepare('UPDATE inventories SET quantity = quantity - 1 WHERE id = ?').run(gemInv.id);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(gemInv.id);
      }
      db.prepare('INSERT INTO item_sockets (inventory_id, slot_index, gem_id) VALUES (?, ?, ?)')
        .run(inventoryId, nextSlot, gemItemId);
    })();

    return { success: true, message: `💎 Đã khảm **${gem.name}** vào ${inv.name || inv.item_id} (lỗ ${nextSlot + 1}/${maxSockets}).` };
  }

  public unsocketGem(userId: string, inventoryId: number, slotIndex: number): { success: boolean; message: string } {
    this.initTable();
    const inv = inventoryRepository.get(inventoryId);
    if (!inv || inv.user_id !== userId) return { success: false, message: '❌ Vật phẩm không tồn tại.' };

    const socket = db.prepare('SELECT * FROM item_sockets WHERE inventory_id = ? AND slot_index = ?')
      .get(inventoryId, slotIndex) as any;
    if (!socket || !socket.gem_id) return { success: false, message: '❌ Lỗ này trống.' };

    db.transaction(() => {
      db.prepare('DELETE FROM item_sockets WHERE inventory_id = ? AND slot_index = ?').run(inventoryId, slotIndex);
      inventoryRepository.addItem(userId, socket.gem_id, 1);
    })();

    return { success: true, message: `✅ Đã tháo ngọc khỏi lỗ ${slotIndex + 1}. Ngọc đã trả về hành trang.` };
  }

  public getSocketStats(inventoryId: number): Record<string, number> {
    const sockets = this.getSockets(inventoryId);
    const stats: Record<string, number> = {};
    for (const s of sockets) {
      if (!s.gemId) continue;
      const gem = GEMS.find(g => g.id === s.gemId);
      if (!gem) continue;
      for (const [stat, val] of Object.entries(gem.statBonus)) {
        stats[stat] = (stats[stat] || 0) + val;
      }
    }
    return stats;
  }

  public upgradeGem(userId: string, gemItemId: string): { success: boolean; message: string } {
    const gem = GEMS.find(g => g.id === gemItemId);
    if (!gem) return { success: false, message: '❌ Ngọc không hợp lệ.' };
    if (gem.tier >= 3) return { success: false, message: '❌ Ngọc đã đạt cấp tối đa.' };

    const nextGem = GEMS.find(g => g.element === gem.element && g.tier === gem.tier + 1);
    if (!nextGem) return { success: false, message: '❌ Không có ngọc cấp cao hơn.' };

    const gemInv = db.prepare('SELECT id, quantity FROM inventories WHERE user_id = ? AND item_id = ?')
      .get(userId, gemItemId) as any;
    if (!gemInv || gemInv.quantity < 3) return { success: false, message: `❌ Cần 3 viên ${gem.name} để nâng cấp.` };

    const user = userRepository.get(userId);
    if (!user || user.coin_ha_pham < gem.tier * 2000) return { success: false, message: `❌ Cần ${gem.tier * 2000} LT.` };

    const successRate = gem.tier === 1 ? 0.8 : 0.5;
    const success = Math.random() < successRate;

    db.transaction(() => {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - gem.tier * 2000 });
      if (gemInv.quantity > 3) {
        db.prepare('UPDATE inventories SET quantity = quantity - 3 WHERE id = ?').run(gemInv.id);
      } else {
        db.prepare('DELETE FROM inventories WHERE id = ?').run(gemInv.id);
      }
      if (success) {
        inventoryRepository.addItem(userId, nextGem.id, 1);
      } else {
        // Fail: return 1 of the input gems
        const tier1Gems = GEMS.filter(g => g.element === gem.element && g.tier === 1);
        if (tier1Gems.length > 0) {
          inventoryRepository.addItem(userId, tier1Gems[0].id, 1);
        }
      }
    })();

    if (success) {
      return { success: true, message: `✅ Nâng cấp thành công! **${gem.name}** → **${nextGem.name}** (Tỷ lệ: ${Math.round(successRate * 100)}%).` };
    }
    return { success: false, message: `❌ Nâng cấp thất bại! Mất 3 viên (Tỷ lệ: ${Math.round(successRate * 100)}%).` };
  }

  public getGemInfo(): string {
    let msg = '💎 **Linh Ngọc:**\n';
    const byElement: Record<string, string[]> = {};
    for (const g of GEMS) {
      if (!byElement[g.element]) byElement[g.element] = [];
      byElement[g.element].push(`${g.name} (${Object.entries(g.statBonus).map(([k, v]) => `${k}+${v}`).join(', ')})`);
    }
    for (const [el, gems] of Object.entries(byElement)) {
      msg += `\n**${el}:**\n${gems.map(g => `• ${g}`).join('\n')}\n`;
    }
    msg += '\nTrang bị cấp S+: 1 lỗ, SS+: 2 lỗ, SSS+: 3 lỗ\n';
    msg += 'Ghép 3 viên cùng cấp → lên cấp (80% T1→T2, 50% T2→T3).';
    return msg;
  }
}

export const gemSocketService = new GemSocketService();
