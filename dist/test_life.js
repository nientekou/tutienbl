"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const UserRepository_1 = require("./database/repositories/UserRepository");
const InventoryRepository_1 = require("./database/repositories/InventoryRepository");
const FarmingService_1 = require("./services/FarmingService");
const SectService_1 = require("./services/SectService");
const CraftingService_1 = require("./services/CraftingService");
const database_2 = __importDefault(require("./database/database"));
console.log('=== CHẠY THỬ NGHIỆM ĐỜI SỐNG & TÔNG MÔN (GIAI ĐOẠN 6) ===');
try {
    // 1. Khởi tạo DB
    (0, database_1.initDatabase)();
    const userIdA = '888888888888888881';
    const userIdB = '888888888888888882';
    // Dọn dẹp dữ liệu cũ
    database_2.default.prepare('DELETE FROM users WHERE discord_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM farming_plots WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM sects WHERE master_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM crafting_queues WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    // 2. Khởi tạo nhân vật test
    UserRepository_1.userRepository.create({
        discord_id: userIdA,
        name: 'Trương Vô Kỵ',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.05,
        base_crit_res: 0.0,
        base_luck: 15,
        linh_can: JSON.stringify({ 'Hỏa': 100 })
    });
    UserRepository_1.userRepository.create({
        discord_id: userIdB,
        name: 'Tống Thanh Thư',
        base_hp: 180,
        base_mp: 90,
        base_atk: 25,
        base_def: 12,
        base_crit: 0.05,
        base_crit_res: 0.0,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Thủy': 100 })
    });
    console.log('✅ Đã khởi tạo thành công 2 nhân vật Trương Vô Kỵ và Tống Thanh Thư.');
    // ============================================
    // KHIỂM THỬ LINH ĐIỀN (FARMING)
    // ============================================
    console.log('\n--- 1. Kiểm Thử Linh Điền (Farming) ---');
    // Lấy ô đất (tự động khởi tạo ô index 0)
    let plots = FarmingService_1.farmingService.getPlots(userIdA);
    console.log(`- Số lượng ô đất ban đầu: ${plots.length} (Ô 1 trạng thái: ${plots[0].status})`);
    // Thêm hạt giống và bùa tăng tốc vào túi
    InventoryRepository_1.inventoryRepository.addItem(userIdA, 'seed_linh_thao_1', 2);
    InventoryRepository_1.inventoryRepository.addItem(userIdA, 'talisman_speed_1', 1);
    console.log('Đã cấp 2x Hạt Giống Linh Thảo và 1x Thần Hành Phù vào túi Trương Vô Kỵ.');
    // Gieo hạt giống vào ô index 0
    const plantRes = FarmingService_1.farmingService.plantSeed(userIdA, 0, 'seed_linh_thao_1');
    console.log(`- Kết quả gieo hạt: success = ${plantRes.success}, tin nhắn = "${plantRes.message}"`);
    plots = FarmingService_1.farmingService.getPlots(userIdA);
    console.log(`- Trạng thái ô 1 sau gieo: ${plots[0].status} (Hạt giống: ${plots[0].seedName}, Thời gian còn lại: ${plots[0].timeRemaining}s)`);
    // Thử thu hoạch ngay lập tức (phải thất bại)
    const harvestFail = FarmingService_1.farmingService.harvestPlot(userIdA, 0);
    console.log(`- Thu hoạch lập tức: success = ${harvestFail.success}, tin nhắn = "${harvestFail.message}"`);
    // Dùng phù gia tốc (giảm 3600s -> chín luôn)
    const speedupRes = FarmingService_1.farmingService.speedupPlot(userIdA, 0);
    console.log(`- Sử dụng Thần Hành Phù gia tốc: success = ${speedupRes.success}, tin nhắn = "${speedupRes.message}"`);
    plots = FarmingService_1.farmingService.getPlots(userIdA);
    console.log(`- Thời gian còn lại sau gia tốc: ${plots[0].timeRemaining}s`);
    // Thu hoạch khi chín
    const harvestSuccess = FarmingService_1.farmingService.harvestPlot(userIdA, 0);
    console.log(`- Thu hoạch sau gia tốc: success = ${harvestSuccess.success}, tin nhắn = "${harvestSuccess.message}"`);
    const userInv = InventoryRepository_1.inventoryRepository.getUserInventory(userIdA);
    const herbCount = userInv.find(i => i.item_id === 'material_linh_thao_1')?.quantity || 0;
    console.log(`- Số lượng Linh Thảo Hạ Phẩm trong hành trang: ${herbCount}x`);
    // Mở rộng ô đất
    UserRepository_1.userRepository.update(userIdA, { coin_ha_pham: 300 }); // cấp linh thạch
    console.log('Cấp 300 Linh thạch cho Trương Vô Kỵ.');
    const unlockRes = FarmingService_1.farmingService.unlockPlot(userIdA);
    console.log(`- Khai khẩn thêm ô đất số 2: success = ${unlockRes.success}, tin nhắn = "${unlockRes.message}"`);
    plots = FarmingService_1.farmingService.getPlots(userIdA);
    console.log(`- Tổng số ô đất hiện có: ${plots.length} ô.`);
    // ============================================
    // KIỂM THỬ TÔNG MÔN (SECT)
    // ============================================
    console.log('\n--- 2. Kiểm Thử Tông Môn (Sect) ---');
    UserRepository_1.userRepository.update(userIdA, { coin_ha_pham: 600 });
    console.log('Cấp 600 Linh thạch cho Trương Vô Kỵ.');
    // Sáng lập tông môn
    const sectRes = SectService_1.sectService.createSect(userIdA, 'Võ Đang Phái', 'Chân Võ Đãng Ma, Thái Cực Tự Nhiên.');
    console.log(`- Kết quả sáng lập Tông Môn: success = ${sectRes.success}, tin nhắn = "${sectRes.message}"`);
    const userASect = UserRepository_1.userRepository.get(userIdA);
    console.log(`- Tông môn ID của Trương Vô Kỵ: ${userASect.sect_id} (Đóng góp: ${userASect.sect_contribution})`);
    // Tống Thanh Thư gia nhập Võ Đang
    const joinRes = SectService_1.sectService.joinSect(userIdB, userASect.sect_id);
    console.log(`- Tống Thanh Thư gia nhập Võ Đang Phái: success = ${joinRes.success}, tin nhắn = "${joinRes.message}"`);
    let sectDetails = SectService_1.sectService.getSectDetails(userASect.sect_id);
    console.log(`- Chi tiết Tông Môn: Cấp ${sectDetails.level} | Số đệ tử: ${sectDetails.member_count}/${sectDetails.member_limit} người`);
    // Quyên góp tông môn
    UserRepository_1.userRepository.update(userIdB, { coin_ha_pham: 300 });
    console.log('Cấp 300 Linh thạch cho Tống Thanh Thư.');
    const donateRes = SectService_1.sectService.donateToSect(userIdB, 200);
    console.log(`- Quyên góp 200 Linh thạch: success = ${donateRes.success}, tin nhắn = "${donateRes.message}"`);
    sectDetails = SectService_1.sectService.getSectDetails(userASect.sect_id);
    console.log(`- Ngân khố Tông môn: ${sectDetails.resources} Linh Thạch | Exp: ${sectDetails.exp}`);
    // Tống Thanh Thư rời bang
    const leaveRes = SectService_1.sectService.leaveSect(userIdB);
    console.log(`- Tống Thanh Thư rời Võ Đang: success = ${leaveRes.success}, tin nhắn = "${leaveRes.message}"`);
    // Trương Vô Kỵ (Tông Chủ) rời bang -> Giải tán
    const disbandRes = SectService_1.sectService.leaveSect(userIdA);
    console.log(`- Trương Vô Kỵ giải tán bang phái: success = ${disbandRes.success}, tin nhắn = "${disbandRes.message}"`);
    const topSects = SectService_1.sectService.getTopSects();
    console.log(`- Tổng số tông môn tồn tại sau giải tán: ${topSects.length}`);
    // ============================================
    // KIỂM THỬ CHẾ TẠO (CRAFTING)
    // ============================================
    console.log('\n--- 3. Kiểm Thử Chế Tạo (Crafting) ---');
    // Cấp nguyên liệu chế thuốc
    InventoryRepository_1.inventoryRepository.addItem(userIdA, 'material_linh_thao_1', 3);
    UserRepository_1.userRepository.update(userIdA, { coin_ha_pham: 50 });
    console.log('Cấp 3x Linh Thảo Hạ Phẩm và 50 Linh thạch cho Trương Vô Kỵ.');
    // Bắt đầu chế đan dược
    const craftRes = CraftingService_1.craftingService.startCrafting(userIdA, 'recipe_pill_tu_vi_low');
    console.log(`- Bắt đầu chế tạo Sơ Cấp Tụ Khí Đan: success = ${craftRes.success}, tin nhắn = "${craftRes.message}"`);
    let queue = CraftingService_1.craftingService.getQueue(userIdA);
    console.log(`- Số lò luyện đang đun: ${queue.length} lò (Lò 1 trạng thái: ${queue[0].status}, Còn lại: ${queue[0].timeRemaining}s)`);
    // Nhận thành phẩm ngay lập tức (phải báo lỗi)
    const claimFail = CraftingService_1.craftingService.claimCraftedItems(userIdA);
    console.log(`- Thu lò ngay lập tức: success = ${claimFail.success}, tin nhắn = "${claimFail.message}"`);
    // Giả lập đưa thời gian kết thúc lò về 10 phút trước
    console.log('Giả lập đưa thời điểm hoàn thành lò về 10 phút trước...');
    const tenMinsAgo = Math.floor(Date.now() / 1000) - 600;
    database_2.default.prepare('UPDATE crafting_queues SET end_time = ? WHERE user_id = ?').run(tenMinsAgo, userIdA);
    queue = CraftingService_1.craftingService.getQueue(userIdA);
    console.log(`- Trạng thái lò 1 sau khi giả lập: status = ${queue[0].status}, Còn lại: ${queue[0].timeRemaining}s`);
    // Nhận thành phẩm sau hoàn thành
    const claimSuccess = CraftingService_1.craftingService.claimCraftedItems(userIdA);
    console.log(`- Thu lò thành công: success = ${claimSuccess.success}, tin nhắn = "${claimSuccess.message}"`);
    const userInvAfter = InventoryRepository_1.inventoryRepository.getUserInventory(userIdA);
    const pillCount = userInvAfter.find(i => i.item_id === 'pill_tu_vi_low')?.quantity || 0;
    console.log(`- Số lượng Sơ Cấp Tụ Khí Đan nhận được trong hành trang: ${pillCount}x`);
    // Dọn dẹp dữ liệu test
    database_2.default.prepare('DELETE FROM users WHERE discord_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM farming_plots WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM sects WHERE master_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM crafting_queues WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    console.log('\n🎉 === TẤT CẢ KIỂM THỬ GIAI ĐOẠN 6 ĐÃ HOÀN THÀNH XUẤT SẮC! ===');
}
catch (error) {
    console.error('❌ Có lỗi xảy ra trong quá trình chạy kiểm thử:', error);
}
finally {
    database_2.default.close();
}
