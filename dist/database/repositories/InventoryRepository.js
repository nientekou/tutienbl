"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryRepository = exports.InventoryRepository = void 0;
const database_1 = __importDefault(require("../database"));
class InventoryRepository {
    /**
     * Lấy danh sách túi đồ của người chơi (kèm theo thông tin item tĩnh)
     */
    getUserInventory(userId) {
        const stmt = database_1.default.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ?
      ORDER BY i.is_equipped DESC, t.type ASC, t.rarity DESC
    `);
        return stmt.all(userId) || [];
    }
    /**
     * Đếm tổng số lượng stack vật phẩm trong túi đồ của người chơi
     */
    getUserInventoryCount(userId) {
        const stmt = database_1.default.prepare(`SELECT COUNT(*) as count FROM inventories WHERE user_id = ?`);
        const result = stmt.get(userId);
        return result ? result.count : 0;
    }
    /**
     * Lấy danh sách túi đồ của người chơi (có phân trang ở mức Database)
     */
    getUserInventoryPaginated(userId, limit, offset) {
        const stmt = database_1.default.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ?
      ORDER BY i.is_equipped DESC, t.type ASC, t.rarity DESC
      LIMIT ? OFFSET ?
    `);
        return stmt.all(userId, limit, offset) || [];
    }
    /**
     * Lấy thông tin một vật phẩm cụ thể trong túi đồ bằng ID tự tăng
     */
    get(inventoryId) {
        const stmt = database_1.default.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.id = ?
    `);
        return stmt.get(inventoryId) || null;
    }
    /**
     * Thêm vật phẩm vào túi đồ của người chơi
     */
    addItem(userId, itemId, quantity = 1, customStats = null) {
        const now = Math.floor(Date.now() / 1000);
        // Tìm kiếm xem đã có vật phẩm tương tự trong túi chưa (tránh cộng dồn nếu là trang bị đang mặc hoặc khác chỉ số phụ)
        const findStmt = database_1.default.prepare(`
      SELECT id, quantity FROM inventories 
      WHERE user_id = ? AND item_id = ? AND is_equipped = 0 AND (custom_stats = ? OR (custom_stats IS NULL AND ? IS NULL))
    `);
        const existing = findStmt.get(userId, itemId, customStats, customStats);
        if (existing) {
            // Nếu đã tồn tại, cộng dồn số lượng
            const updateStmt = database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?');
            updateStmt.run(quantity, existing.id);
        }
        else {
            // Nếu chưa, thêm dòng mới
            const insertStmt = database_1.default.prepare(`
        INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, created_at)
        VALUES (?, ?, ?, 0, NULL, ?, ?)
      `);
            insertStmt.run(userId, itemId, quantity, customStats, now);
        }
    }
    /**
     * Thêm nhiều vật phẩm cùng lúc bằng Transaction để tránh N+1 queries gây nghẽn DB
     */
    addMultipleItems = database_1.default.transaction((items) => {
        const now = Math.floor(Date.now() / 1000);
        const findStmt = database_1.default.prepare(`
      SELECT id FROM inventories 
      WHERE user_id = ? AND item_id = ? AND is_equipped = 0 AND (custom_stats = ? OR (custom_stats IS NULL AND ? IS NULL))
    `);
        const updateStmt = database_1.default.prepare('UPDATE inventories SET quantity = quantity + ? WHERE id = ?');
        const insertStmt = database_1.default.prepare(`
      INSERT INTO inventories (user_id, item_id, quantity, is_equipped, equipment_slot, custom_stats, created_at)
      VALUES (?, ?, ?, 0, NULL, ?, ?)
    `);
        for (const item of items) {
            const stats = item.customStats || null;
            const existing = findStmt.get(item.userId, item.itemId, stats, stats);
            if (existing) {
                updateStmt.run(item.quantity, existing.id);
            }
            else {
                insertStmt.run(item.userId, item.itemId, item.quantity, stats, now);
            }
        }
    });
    /**
     * Xóa / Khấu trừ vật phẩm khỏi túi đồ của người chơi
     */
    removeItem(userId, itemId, quantity = 1) {
        // Ưu tiên trừ vật phẩm CHƯA TRANG BỊ trước
        const findStmt = database_1.default.prepare(`
      SELECT id, quantity FROM inventories 
      WHERE user_id = ? AND item_id = ?
      ORDER BY is_equipped ASC
    `);
        const items = findStmt.all(userId, itemId);
        if (items.length === 0)
            return false;
        let remainingToRemove = quantity;
        for (const item of items) {
            if (item.quantity > remainingToRemove) {
                // Trừ bớt số lượng
                database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(remainingToRemove, item.id);
                remainingToRemove = 0;
                break;
            }
            else {
                // Xóa hoàn toàn dòng này
                database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(item.id);
                remainingToRemove -= item.quantity;
            }
        }
        return remainingToRemove === 0;
    }
    /**
     * Tháo vật phẩm khỏi túi đồ bằng ID tự tăng
     */
    removeItemById(inventoryId, quantity = 1) {
        const item = database_1.default.prepare('SELECT id, quantity FROM inventories WHERE id = ?').get(inventoryId);
        if (!item)
            return false;
        if (item.quantity > quantity) {
            database_1.default.prepare('UPDATE inventories SET quantity = quantity - ? WHERE id = ?').run(quantity, inventoryId);
        }
        else {
            database_1.default.prepare('DELETE FROM inventories WHERE id = ?').run(inventoryId);
        }
        return true;
    }
    /**
     * Cập nhật trạng thái trang bị vật phẩm
     */
    updateEquipmentStatus(inventoryId, isEquipped, slot) {
        const stmt = database_1.default.prepare('UPDATE inventories SET is_equipped = ?, equipment_slot = ? WHERE id = ?');
        stmt.run(isEquipped, slot, inventoryId);
    }
    /**
     * Cập nhật số lượng sao trang bị
     */
    updateStars(inventoryId, stars) {
        database_1.default.prepare('UPDATE inventories SET stars = ? WHERE id = ?').run(stars, inventoryId);
    }
    /**
     * Cập nhật thuộc tính ngẫu nhiên (chỉ số phụ)
     */
    updateCustomStats(inventoryId, customStats) {
        database_1.default.prepare('UPDATE inventories SET custom_stats = ? WHERE id = ?').run(customStats, inventoryId);
    }
    /**
     * Cập nhật độ bền của trang bị
     */
    updateDurability(inventoryId, durability) {
        database_1.default.prepare('UPDATE inventories SET durability = ? WHERE id = ?').run(Math.max(0, durability), inventoryId);
    }
    /**
     * Giảm độ bền của trang bị (sau chiến đấu)
     */
    reduceDurability(inventoryId, amount = 5) {
        database_1.default.prepare('UPDATE inventories SET durability = MAX(0, durability - ?) WHERE id = ?').run(amount, inventoryId);
    }
    /**
     * Sửa chữa trang bị, hồi phục độ bền về tối đa
     * Trả về: true nếu sửa thành công, false nếu không có gì thay đổi
     */
    repairItem(inventoryId, newDurability = null) {
        if (newDurability !== null) {
            database_1.default.prepare('UPDATE inventories SET durability = ? WHERE id = ?').run(newDurability, inventoryId);
        }
        else {
            // Mặc định sửa về max_durability
            database_1.default.prepare('UPDATE inventories SET durability = max_durability WHERE id = ?').run(inventoryId);
        }
        return true;
    }
    /**
     * Lấy danh sách trang bị đang đeo có độ bền thấp (dưới ngưỡng)
     */
    getLowDurabilityEquipped(userId, threshold = 30) {
        const stmt = database_1.default.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND i.is_equipped = 1 AND i.durability <= ?
      ORDER BY i.durability ASC
    `);
        return stmt.all(userId, threshold) || [];
    }
    /**
     * Tìm trang bị đang được mặc tại slot cụ thể của người chơi
     */
    getEquippedInSlot(userId, slot) {
        const stmt = database_1.default.prepare(`
      SELECT 
        i.id, i.user_id, i.item_id, i.quantity, i.is_equipped, i.equipment_slot, i.custom_stats, i.stars, i.durability, i.max_durability, i.enhance_level, i.is_life_bound, i.bound_exp, i.bound_level, i.created_at,
        t.name, t.type, t.rarity, t.description, t.stats as base_stats, t.value_ha_pham, t.usable, t.equipable
      FROM inventories i
      JOIN items t ON i.item_id = t.id
      WHERE i.user_id = ? AND i.is_equipped = 1 AND i.equipment_slot = ?
    `);
        return stmt.get(userId, slot) || null;
    }
    /**
     * Cập nhật cấp độ cường hóa của vật phẩm
     */
    updateEnhanceLevel(inventoryId, level) {
        database_1.default.prepare('UPDATE inventories SET enhance_level = ? WHERE id = ?').run(level, inventoryId);
    }
}
exports.InventoryRepository = InventoryRepository;
exports.inventoryRepository = new InventoryRepository();
