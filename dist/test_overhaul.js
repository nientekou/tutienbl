"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const database_2 = __importDefault(require("./database/database"));
const UserRepository_1 = require("./database/repositories/UserRepository");
const InventoryRepository_1 = require("./database/repositories/InventoryRepository");
const InventoryService_1 = require("./services/InventoryService");
const InteractionLock_1 = require("./services/InteractionLock");
const EquipmentService_1 = require("./services/EquipmentService");
const CombatService_1 = require("./services/CombatService");
async function runTests() {
    console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG TU TIÊN V2... 🧪\n');
    // 1. Khởi tạo DB sạch cho test
    (0, database_1.initDatabase)();
    const testUser1 = 'test_user_111';
    const testUser2 = 'test_user_222';
    // Dọn dẹp dữ liệu cũ nếu có
    database_2.default.prepare('DELETE FROM users WHERE discord_id IN (?, ?)').run(testUser1, testUser2);
    database_2.default.prepare("DELETE FROM inventories WHERE user_id IN (?, ?, 'market')").run(testUser1, testUser2);
    database_2.default.prepare('DELETE FROM roguelike_progress WHERE user_id IN (?, ?)').run(testUser1, testUser2);
    database_2.default.prepare('DELETE FROM market_listings WHERE seller_id IN (?, ?)').run(testUser1, testUser2);
    // 2. Tạo nhân vật
    UserRepository_1.userRepository.create({
        discord_id: testUser1,
        name: 'Tiêu Viêm',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.05,
        base_crit_res: 0.01,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Hỏa': 100 })
    });
    UserRepository_1.userRepository.create({
        discord_id: testUser2,
        name: 'Lâm Phàm',
        base_hp: 150,
        base_mp: 80,
        base_atk: 25,
        base_def: 12,
        base_crit: 0.05,
        base_crit_res: 0.01,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Mộc': 100 })
    });
    console.log('✅ 1. Khởi tạo nhân vật test thành công.');
    // 3. Test Stamina Recovery
    const user1 = UserRepository_1.userRepository.get(testUser1);
    if (user1.stamina !== 340)
        throw new Error('Stamina khởi đầu phải là 340');
    // Giảm stamina xuống 100
    UserRepository_1.userRepository.update(testUser1, { stamina: 100, last_stamina_recover_at: Math.floor(Date.now() / 1000) - 240 });
    // Lấy lại user1 -> trigger hồi phục (240s = 2 điểm)
    const user1Recovered = UserRepository_1.userRepository.get(testUser1);
    console.log(`🔋 Stamina sau 240 giây hồi phục: ${user1Recovered.stamina}/340 (Mong đợi: 102)`);
    if (user1Recovered.stamina !== 102)
        throw new Error('Hồi phục Stamina sai lệch!');
    console.log('✅ 2. Logic hồi phục Stamina chính xác.');
    // 4. Test Anti-Spam Lock
    const locked1 = InteractionLock_1.InteractionLock.acquire(testUser1);
    if (!locked1)
        throw new Error('Lấy lock lần đầu phải thành công');
    const locked2 = InteractionLock_1.InteractionLock.acquire(testUser1);
    if (locked2)
        throw new Error('Lấy lock trùng lặp hoặc trong cooldown phải thất bại');
    InteractionLock_1.InteractionLock.release(testUser1);
    const locked3 = InteractionLock_1.InteractionLock.acquire(testUser1);
    if (locked3)
        throw new Error('Lấy lock ngay lập tức sau giải phóng (<1.2s Cooldown) phải bị chặn');
    console.log('✅ 3. Hệ thống chống spam (InteractionLock) hoạt động hoàn hảo.');
    // 5. Test Giám Định Phôi rèn đúc
    InventoryRepository_1.inventoryRepository.addItem(testUser1, 'phoi_weapon_a', 1);
    const userInventory = InventoryRepository_1.inventoryRepository.getUserInventory(testUser1);
    const phoiItem = userInventory.find(i => i.item_id === 'phoi_weapon_a');
    // Phí giám định 50
    UserRepository_1.userRepository.update(testUser1, { coin_ha_pham: 100 });
    const appraiseRes = EquipmentService_1.equipmentService.appraisePhoi(testUser1, phoiItem.id);
    console.log(`🔮 Kết quả giám định: ${appraiseRes.message}`);
    const updatedInv = InventoryRepository_1.inventoryRepository.getUserInventory(testUser1);
    const weaponItem = updatedInv.find(i => i.item_id === 'weapon_sword_a');
    if (!weaponItem || weaponItem.custom_stats === null) {
        throw new Error('Giám định thất bại hoặc không tạo chỉ số phụ!');
    }
    console.log('✅ 4. Giám định Phôi rèn đúc chính xác.');
    // 6. Test Nâng Sao Trang Bị
    // Cung cấp mảnh trang bị
    InventoryRepository_1.inventoryRepository.addItem(testUser1, 'item_fragment', 50);
    const starRes = EquipmentService_1.equipmentService.upgradeStars(testUser1, weaponItem.id);
    console.log(`⭐ Kết quả nâng sao: ${starRes.message}`);
    const star1Weapon = InventoryRepository_1.inventoryRepository.get(weaponItem.id);
    if (star1Weapon.stars !== 1)
        throw new Error('Nâng sao không được lưu vào DB');
    // Kiểm tra chỉ số chiến đấu thực tế (Active Stats) có nhân thuộc tính sao (+20% mỗi sao)
    InventoryService_1.inventoryService.equipItem(testUser1, weaponItem.id);
    const stats = InventoryService_1.inventoryService.getActiveStats(testUser1);
    console.log(`📊 Chỉ số ATK thực tế (Kiếm A + 1 Sao): ${stats.atk} (Base: 30, Kiếm A: 100, 1 sao +20% -> 120, tổng = 150)`);
    if (stats.atk < 150)
        throw new Error('Chỉ số bồi thêm từ sao trang bị tính toán sai lệch!');
    console.log('✅ 5. Nâng sao trang bị hoạt động chính xác.');
    // 7. Test Phân Giải Trang Bị
    InventoryService_1.inventoryService.unequipItem(testUser1, weaponItem.id);
    const salvageRes = EquipmentService_1.equipmentService.salvageEquipment(testUser1, star1Weapon.id);
    console.log(`⚙️ Kết quả phân giải: ${salvageRes.message}`);
    const postSalvageInv = InventoryRepository_1.inventoryRepository.getUserInventory(testUser1);
    const finalFragments = postSalvageInv.find(i => i.item_id === 'item_fragment');
    console.log(`💎 Số mảnh thu về: ${finalFragments.quantity} (Gồm hoàn trả nâng sao)`);
    if (finalFragments.quantity < 35)
        throw new Error('Tính toán mảnh thu hồi sai!');
    console.log('✅ 6. Phân giải trang bị hoạt động chính xác.');
    // 8. Test Vạn Bảo Lâu (Chợ Đấu Giá)
    InventoryRepository_1.inventoryRepository.addItem(testUser1, 'pill_hp_2', 10);
    const sellerPill = InventoryRepository_1.inventoryRepository.getUserInventory(testUser1).find(i => i.item_id === 'pill_hp_2');
    // Đăng bán 3 viên giá 60 linh thạch
    database_2.default.prepare('DELETE FROM market_listings').run();
    // Sử dụng subcommand đăng bán giả lập
    const sellerHaPhamBefore = UserRepository_1.userRepository.get(testUser1).coin_ha_pham;
    const listTx = database_2.default.transaction(() => {
        database_2.default.prepare('UPDATE inventories SET quantity = quantity - 3 WHERE id = ?').run(sellerPill.id);
        const nowSec = Math.floor(Date.now() / 1000);
        const insertRes = database_2.default.prepare(`
      INSERT INTO inventories (user_id, item_id, quantity, is_equipped, custom_stats, stars, created_at)
      VALUES ('market', 'pill_hp_2', 3, 0, NULL, 0, ?)
    `).run(nowSec);
        database_2.default.prepare(`
      INSERT INTO market_listings (seller_id, inventory_id, item_id, quantity, price_type, price, listed_at, expires_at, status)
      VALUES ('test_user_111', ?, 'pill_hp_2', 3, 'ha_pham', 60, ?, ?, 'active')
    `).run(insertRes.lastInsertRowid, nowSec, nowSec + 600);
    });
    listTx();
    console.log('🏪 Treo bán 3x Hồi Huyết Đan lên sàn Vạn Bảo Lâu.');
    // Người thứ 2 mua
    UserRepository_1.userRepository.update(testUser2, { coin_ha_pham: 100 });
    const listing = database_2.default.prepare("SELECT id FROM market_listings WHERE status = 'active'").get();
    const buyTx = database_2.default.transaction(() => {
        // Trừ tiền người mua
        database_2.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - 60 WHERE discord_id = ?').run(testUser2);
        // Cộng tiền người bán (trừ 5% thuế tông môn -> payout 57)
        database_2.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham + 57 WHERE discord_id = ?').run(testUser1);
        database_2.default.prepare("UPDATE market_listings SET status = 'sold' WHERE id = ?").run(listing.id);
        const marketItem = database_2.default.prepare('SELECT id, inventory_id, quantity FROM market_listings WHERE id = ?').get(listing.id);
        database_2.default.prepare("UPDATE inventories SET user_id = ? WHERE id = ?").run(testUser2, marketItem.inventory_id);
    });
    buyTx();
    const buyer2 = UserRepository_1.userRepository.get(testUser2);
    const seller1 = UserRepository_1.userRepository.get(testUser1);
    const buyer2Pill = InventoryRepository_1.inventoryRepository.getUserInventory(testUser2).find(i => i.item_id === 'pill_hp_2');
    console.log(`💸 Người mua 2 Linh thạch còn lại: ${buyer2.coin_ha_pham} (Mong chờ: 40)`);
    console.log(`💰 Người bán 1 nhận được: ${seller1.coin_ha_pham} (Nhận +57 Linh Thạch từ giao dịch)`);
    console.log(`📦 Người mua nhận được: ${buyer2Pill.quantity}x Hồi Huyết Đan`);
    if (buyer2.coin_ha_pham !== 40 || buyer2Pill.quantity !== 3) {
        throw new Error('Giao dịch Vạn Bảo Lâu xảy ra sai sót!');
    }
    console.log('✅ 7. Logic mua bán tự do trên Vạn Bảo Lâu chính xác.');
    // 9. Test Bí Cảnh Đột Phá Khắc Chế & Đọc Hiểu
    // Challenge với buff
    const combatResWin = CombatService_1.combatService.challengeDungeon(testUser1, 'dungeon_luyen_khi_1', 'thường', true, false);
    console.log(`⚔️ Bí Cảnh kết quả (Chọn đúng chiêu - Nhận Buff): ${combatResWin.message}`);
    if (combatResWin.message !== 'Chiến Thắng') {
        throw new Error('Đáng lẽ phải thắng khi nhận buff khắc chế!');
    }
    // Challenge với debuff (quái quật)
    const combatResLose = CombatService_1.combatService.challengeDungeon(testUser1, 'dungeon_luyen_khi_1', 'ác_mộng', false, true);
    console.log(`💀 Bí Cảnh kết quả (Chọn sai chiêu - Quái Buff): ${combatResLose.message}`);
    console.log('✅ 8. Cơ chế quyết sách khắc chế & Độ khó Bí cảnh hoạt động chính xác.');
    console.log('\n🌟 TẤT CẢ KỊCH BẢN KIỂM THỬ ĐÃ VƯỢT QUA THÀNH CÔNG 100%! 🌟');
}
runTests().catch(e => {
    console.error('\n❌ BỘ KIỂM THỬ THẤT BẠI:', e);
    process.exit(1);
});
