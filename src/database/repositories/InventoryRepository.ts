import db from '../database';

export interface InventoryItem {
  id: number;
  user_id: string;
  item_id: string;
  quantity: number;
  is_equipped: number;
  equipment_slot: string | null;
  custom_stats: string | null;
  stars: number;
  durability: number;       // Độ bền hiện tại (0-100)
  max_durability: number;   // Độ bền tối đa
  enhance_level: number;    // Cấp độ cường hóa
  created_at: number;
  is_life_bound: number;     // 1 if life bound, 0 otherwise
  bound_exp: number;
  bound_level: number;
  
  // Thông tin vật phẩm từ bảng items
  name: string;
  type: string;
  rarity: string;
  description: string;
  base_stats: string | null;
  value_ha_pham: number;
  usable: number;
  equipable: number;
}

export class InventoryRepository {
  /**
   * Lấy danh sách túi đồ của người chơi (kèm theo thông tin item tĩnh)
   */
  public getUserInventory(userId: string): InventoryItem[] {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ?
      ORDER BY i.is_equipped DESC, t.type ASC, t.rarity DESC
    `);
    
    return (stmt.all(userId) as InventoryItem[]) || [];
  }

  /**
   * Đếm tổng số lượng stack vật phẩm trong túi đồ của người chơi
   */
  public getUserInventoryCount(userId: string): number {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM inventories WHERE user_id = ?`);
    const result = stmt.get(userId) as { count: number };
    return result ? result.count : 0;
  }

  /**
   * Lấy danh sách túi đồ của người chơi (có phân trang ở mức Database)
   */
  public getUserInventoryPaginated(userId: string, limit: number, offset: number): InventoryItem[] {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      LEFT JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ?
      ORDER BY i.is_equipped DESC, t.type ASC, t.rarity DESC
      LIMIT ? OFFSET ?
    `);
    
    return (stmt.all(userId, limit, offset) as InventoryItem[]) || [];
  }

  /**
   * Tự động xoá vật phẩm bất thường (orphan items) của một user
   * @returns Số lượng vật phẩm đã xoá
   */
  public cleanupOrphanItems(userId: string): number {
    // Xoá item không tồn tại trong bảng items
    const orphanItems = db.prepare(`
      SELECT i.id FROM inventories i
      LEFT JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND t.id IS NULL
    `).all(userId) as { id: number }[];

    // Xoá item có quantity <= 0
    const invalidQty = db.prepare(`
      SELECT id FROM inventories WHERE user_id = ? AND (quantity <= 0 OR quantity IS NULL)
    `).all(userId) as { id: number }[];

    let deletedCount = 0;
    for (const item of orphanItems) {
      db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      deletedCount++;
    }
    for (const item of invalidQty) {
      db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`[InventoryCleanup] Đã xoá ${deletedCount} vật phẩm bất thường cho user ${userId}`);
    }

    return deletedCount;
  }

  /**
   * Lấy thông tin một vật phẩm cụ thể trong túi đồ bằng ID tự tăng
   */
  public get(inventoryId: number): InventoryItem | null {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.id = ?
    `);
    
    return (stmt.get(inventoryId) as InventoryItem) || null;
  }

  /**
   * Lấy thông tin vật phẩm trong túi đồ bằng user_id + item_id
   */
  public getByUserIdAndItemId(userId: string, itemId: string): InventoryItem | null {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND i.item_id = ?
    `);
    
    return (stmt.get(userId, itemId) as InventoryItem) || null;
  }

  /**
   * Thêm vật phẩm vào túi đồ của người chơi
   */
  public addItem(userId: string, itemId: string, quantity: number = 1, customStats: string | null = null): void {
    const now = Math.floor(Date.now() / 1000);
    
    // Tìm kiếm xem đã có vật phẩm tương tự trong túi chưa (tránh cộng dồn nếu là trang bị đang mặc hoặc khác chỉ số phụ)
    const findStmt = db.prepare(`
      SELECT id, quantity FROM inventories 
      WHERE user_id = ? AND item_id = ? AND is_equipped = 0 AND (custom_stats = ? OR (custom_stats IS NULL AND ? IS NULL))
    `);
    
    const existing = findStmt.get(userId, itemId, customStats, customStats) as { id: number; quantity: number } | undefined;
    
    if (existing) {
      // Nếu đã tồn tại, cộng dồn số lượng
      const updateStmt = db.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?');
      updateStmt.run(quantity, existing.id);
    } else {
      // Nếu chưa, thêm dòng mới
      const insertStmt = db.prepare(`
        INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, created_at)
        VALUES (?, ?, ?, 0, NULL, ?, ?)
      `);
      insertStmt.run(userId, itemId, quantity, customStats, now);
    }
  }

  /**
   * Thêm nhiều vật phẩm cùng lúc bằng Transaction để tránh N+1 queries gây nghẽn DB
   */
  public addMultipleItems = db.transaction((items: Array<{ userId: string; itemId: string; quantity: number; customStats?: string | null }>) => {
    const now = Math.floor(Date.now() / 1000);
    const findStmt = db.prepare(`
      SELECT id FROM inventories 
      WHERE user_id = ? AND item_id = ? AND is_equipped = 0 AND (custom_stats = ? OR (custom_stats IS NULL AND ? IS NULL))
    `);
    const updateStmt = db.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, created_at)
      VALUES (?, ?, ?, 0, NULL, ?, ?)
    `);

    for (const item of items) {
      const stats = item.customStats || null;
      const existing = findStmt.get(item.userId, item.itemId, stats, stats) as { id: number } | undefined;
      
      if (existing) {
        updateStmt.run(item.quantity, existing.id);
      } else {
        insertStmt.run(item.userId, item.itemId, item.quantity, stats, now);
      }
    }
  });

  /**
   * Xóa / Khấu trừ vật phẩm khỏi túi đồ của người chơi
   */
  public removeItem(userId: string, itemId: string, quantity: number = 1): boolean {
    // Ưu tiên trừ vật phẩm CHƯA TRANG BỊ trước
    const findStmt = db.prepare(`
      SELECT id, quantity FROM inventories 
      WHERE user_id = ? AND item_id = ?
      ORDER BY is_equipped ASC
    `);
    
    const items = findStmt.all(userId, itemId) as { id: number; quantity: number }[];
    if (items.length === 0) return false;
    
    let remainingToRemove = quantity;
    
    for (const item of items) {
      if (item.quantity > remainingToRemove) {
        // Trừ bớt số lượng
        db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(remainingToRemove, item.id);
        remainingToRemove = 0;
        break;
      } else {
        // Xóa hoàn toàn dòng này
        db.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
        remainingToRemove -= item.quantity;
      }
    }
    
    return remainingToRemove === 0;
  }

  /**
   * Tháo vật phẩm khỏi túi đồ bằng ID tự tăng
   */
  public removeItemById(inventoryId: number, quantity: number = 1): boolean {
    const item = db.prepare('SELECT id, quantity FROM inventories WHERE id = ?').get(inventoryId) as { id: number; quantity: number } | undefined;
    if (!item) return false;

    if (item.quantity > quantity) {
      db.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, inventoryId);
    } else {
      db.prepare('DELETE FROM inventories WHERE id = ?').run(inventoryId);
    }
    return true;
  }

  /**
   * Cập nhật trạng thái trang bị vật phẩm
   */
  public updateEquipmentStatus(inventoryId: number, isEquipped: number, slot: string | null): void {
    const stmt = db.prepare('UPDATE inventories SET is_equipped = ?, equipment_slot = ? WHERE id = ?');
    stmt.run(isEquipped, slot, inventoryId);
  }

  /**
   * Cập nhật số lượng sao trang bị
   */
  public updateStars(inventoryId: number, stars: number): void {
    db.prepare('UPDATE inventories SET stars = ? WHERE id = ?').run(stars, inventoryId);
  }

  /**
   * Cập nhật thuộc tính ngẫu nhiên (chỉ số phụ)
   */
  public updateCustomStats(inventoryId: number, customStats: string | null): void {
    db.prepare('UPDATE inventories SET custom_stats = ? WHERE id = ?').run(customStats, inventoryId);
  }

  /**
   * Cập nhật độ bền của trang bị
   */
  public updateDurability(inventoryId: number, durability: number): void {
    db.prepare('UPDATE inventories SET durability = ? WHERE id = ?').run(Math.max(0, durability), inventoryId);
  }

  /**
   * Giảm độ bền của trang bị (sau chiến đấu)
   */
  public reduceDurability(inventoryId: number, amount: number = 5): void {
    db.prepare('UPDATE inventories SET durability = MAX(0, durability - ?) WHERE id = ?').run(amount, inventoryId);
  }

  /**
   * Sửa chữa trang bị, hồi phục độ bền về tối đa
   * Trả về: true nếu sửa thành công, false nếu không có gì thay đổi
   */
  public repairItem(inventoryId: number, newDurability: number | null = null): boolean {
    if (newDurability !== null) {
      db.prepare('UPDATE inventories SET durability = ? WHERE id = ?').run(newDurability, inventoryId);
    } else {
      // Mặc định sửa về max_durability
      db.prepare('UPDATE inventories SET durability = max_durability WHERE id = ?').run(inventoryId);
    }
    return true;
  }

  /**
   * Lấy danh sách trang bị đang đeo có độ bền thấp (dưới ngưỡng)
   */
  public getLowDurabilityEquipped(userId: string, threshold: number = 30): InventoryItem[] {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND i.is_equipped = 1 AND i.durability <= ?
      ORDER BY i.durability ASC
    `);
    return (stmt.all(userId, threshold) as InventoryItem[]) || [];
  }

  /**
   * Tìm trang bị đang được mặc tại slot cụ thể của người chơi
   */
  public getEquippedInSlot(userId: string, slot: string): InventoryItem | null {
    const stmt = db.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND i.is_equipped = 1 AND i.equipment_slot = ?
    `);
    
    return (stmt.get(userId, slot) as InventoryItem) || null;
  }

  /**
   * Cập nhật cấp độ cường hóa của vật phẩm
   */
  public updateEnhanceLevel(inventoryId: number, level: number): void {
    db.prepare('UPDATE inventories SET enhance_level = ? WHERE id = ?').run(level, inventoryId);
  }
}

export const inventoryRepository = new InventoryRepository();
