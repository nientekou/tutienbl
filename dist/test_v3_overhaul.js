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
const AlchemyService_1 = require("./services/AlchemyService");
const TribulationService_1 = require("./services/TribulationService");
const SectService_1 = require("./services/SectService");
const constants_1 = require("./utils/constants");
async function runV3Tests() {
    console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG TU TIÊN V3... 🧪\n');
    // 1. Khởi tạo DB sạch
    (0, database_1.initDatabase)();
    const testUser = 'tu_si_test_999';
    // Dọn dẹp dữ liệu cũ nếu có
    database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
    database_2.default.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);
    database_2.default.prepare('DELETE FROM sects WHERE master_id = ?').run(testUser);
    // Tạo tu sĩ test
    UserRepository_1.userRepository.create({
        discord_id: testUser,
        name: 'Hàn Lập',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.10,
        base_crit_res: 0.05,
        base_luck: 15,
        linh_can: JSON.stringify({ 'Mộc': 80, 'Thủy': 20 })
    });
    const u = UserRepository_1.userRepository.get(testUser);
    console.log(`✅ 1. Khởi tạo nhân vật test thành công: ${u.name} (Alchemy Level: ${u.alchemy_level}, Stamina: ${u.stamina})`);
    // 2. Kiểm thử Luyện Đan (Alchemy System)
    console.log('\n--- 🧪 TEST LUYỆN ĐAN THUẬT ---');
    // Thêm nguyên liệu và Linh thạch
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'material_linh_thao_1', 20);
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'material_nhan_sam_1', 10);
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'material_iron_1', 5);
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'item_fragment', 5);
    UserRepository_1.userRepository.update(testUser, { coin_ha_pham: 5000 });
    // Thêm lò luyện đan trung phẩm
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'cauldron_mid', 1);
    const userCauldron = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).find(i => i.item_id === 'cauldron_mid');
    // Thử luyện Luyện Khí Đan
    const craftRes = AlchemyService_1.alchemyService.craftPill(testUser, 'recipe_tuvi', userCauldron.id);
    console.log(`🔮 Kết quả luyện Luyện Khí Đan: ${craftRes.message}`);
    const postCraftUser = UserRepository_1.userRepository.get(testUser);
    console.log(`📈 EXP Luyện đan hiện tại: ${postCraftUser.alchemy_exp}/${postCraftUser.alchemy_level * 100}`);
    // Thử sử dụng đan dược Luyện Khí Đan vừa luyện thành
    const pills = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).filter(i => i.item_id === 'pill_alchemy_tuvi');
    if (pills.length > 0) {
        const pill = pills[0];
        const useRes = InventoryService_1.inventoryService.useItem(testUser, pill.id);
        console.log(`💊 Sử dụng Luyện Khí Đan: ${useRes.message}`);
    }
    // Thử luyện và dùng Bổ Thiên Đan (hồi Stamina)
    // Đưa stamina về 50
    UserRepository_1.userRepository.update(testUser, { stamina: 50, alchemy_level: 3 }); // Nâng lên cấp 3 để đủ điều kiện công thức
    const staminaCraft = AlchemyService_1.alchemyService.craftPill(testUser, 'recipe_stamina', userCauldron.id);
    console.log(`🔮 Kết quả luyện Bổ Thiên Đan: ${staminaCraft.message}`);
    const staminaPills = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).filter(i => i.item_id === 'pill_alchemy_stamina');
    if (staminaPills.length > 0) {
        const sPill = staminaPills[0];
        console.log(`🔋 Thể lực trước khi sử dụng Bổ Thiên Đan: ${UserRepository_1.userRepository.get(testUser).stamina}/340`);
        // Sử dụng lần 1
        const useS1 = InventoryService_1.inventoryService.useItem(testUser, sPill.id);
        console.log(`💊 Sử dụng Bổ Thiên Đan lần 1: ${useS1.message}`);
        // Cho thêm Bổ Thiên Đan vào để test giới hạn sử dụng
        InventoryRepository_1.inventoryRepository.addItem(testUser, 'pill_alchemy_stamina', 3);
        // Dùng lần 2, 3, 4 (Truy vấn lại danh sách túi đồ sau mỗi lần dùng để lấy id hợp lệ còn tồn tại)
        let currentStaminaPills = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).filter(i => i.item_id === 'pill_alchemy_stamina');
        const useS2 = InventoryService_1.inventoryService.useItem(testUser, currentStaminaPills[0].id);
        console.log(`💊 Sử dụng Bổ Thiên Đan lần 2: ${useS2.message}`);
        currentStaminaPills = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).filter(i => i.item_id === 'pill_alchemy_stamina');
        const useS3 = InventoryService_1.inventoryService.useItem(testUser, currentStaminaPills[0].id);
        console.log(`💊 Sử dụng Bổ Thiên Đan lần 3: ${useS3.message}`);
        currentStaminaPills = InventoryRepository_1.inventoryRepository.getUserInventory(testUser).filter(i => i.item_id === 'pill_alchemy_stamina');
        const useS4 = InventoryService_1.inventoryService.useItem(testUser, currentStaminaPills[0].id);
        console.log(`💊 Sử dụng Bổ Thiên Đan lần 4 (Mong muốn bị chặn): ${useS4.message}`);
        if (useS4.success)
            throw new Error('Chặn giới hạn 3 viên Bổ Thiên Đan/ngày bị lỗi!');
    }
    console.log('✅ 2. Logic Luyện Đan và đan dược Tiên gia hoạt động chính xác.');
    // 3. Kiểm thử Đột Phá Lôi Kiếp (Thunder Tribulation)
    console.log('\n--- ⚡ TEST THIÊN KIẾP LÔI KIẾP ---');
    // Thiết lập tu sĩ đầy tu vi ở tầng 38
    UserRepository_1.userRepository.update(testUser, { level: 38, tu_vi: 2000, exp_needed: 1000 });
    // Nghênh tiếp lôi kiếp (Trúc Cơ Kỳ -> majorIndex = 0 -> 3 đạo sét, ~20 dmg mỗi đạo)
    const tribStart = TribulationService_1.tribulationService.start(testUser, 'Hàn Lập', 0);
    console.log(`⚡ Bắt đầu Lôi Kiếp: Đạo thứ 1/${TribulationService_1.tribulationService.get(testUser).totalLightningBolts}`);
    // Đạo sét 1: Chọn Ngự Thủ (Tốn 20 MP, giảm 50% dmg)
    const action1 = TribulationService_1.tribulationService.handleAction(testUser, 'nguthu');
    console.log(`🛡️ Kết quả đạo thứ 1: ${action1.embed.data.description}`);
    if (action1.finished)
        throw new Error('Trận lôi kiếp đáng lẽ phải chưa kết thúc!');
    // Đạo sét 2: Chọn Kháng Cự (Roll Crit)
    const action2 = TribulationService_1.tribulationService.handleAction(testUser, 'khangcu');
    console.log(`⚡ Kết quả đạo thứ 2: ${action2.embed.data.description}`);
    if (action2.finished)
        throw new Error('Trận lôi kiếp đáng lẽ phải chưa kết thúc!');
    // Thêm Ngự Lôi Đan vào hành trang để chuẩn bị test đạo sét 3
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'pill_alchemy_anti_loi', 1);
    // Đạo sét 3: Dùng Ngự Lôi Đan (Giảm 30% sát thương)
    const action3 = TribulationService_1.tribulationService.handleAction(testUser, 'dungnguloidan');
    console.log(`💊 Kết quả đạo thứ 3 (Cuối cùng): ${action3.embed.data.description}`);
    if (!action3.finished)
        throw new Error('Lôi kiếp đáng lẽ phải kết thúc thành công!');
    const finalUser = UserRepository_1.userRepository.get(testUser);
    console.log(`🏆 Cảnh giới tu sĩ sau khi vượt qua lôi kiếp: ${(0, constants_1.getRealmDetails)(finalUser.level).fullName} (Level: ${finalUser.level})`);
    if (finalUser.level !== 39)
        throw new Error('Đột phá thăng cấp sau lôi kiếp bị lỗi!');
    console.log('✅ 3. Logic Đột phá Lôi Kiếp hoàn thành xuất sắc.');
    // 4. Kiểm thử Nâng Cấp Công Trình Tông Môn (Sect Expansion)
    console.log('\n--- 🏰 TEST NÂNG CẤP TÔNG MÔN ---');
    UserRepository_1.userRepository.update(testUser, { sect_id: null, coin_ha_pham: 1000 });
    // Sáng lập tông môn
    const sectRes = SectService_1.sectService.createSect(testUser, 'Huyền Vy Tông', 'Tông môn đệ nhất thiên hạ');
    console.log(sectRes.message);
    const sectId = sectRes.sectId;
    const sectDetails = SectService_1.sectService.getSectDetails(sectId);
    console.log(`🏰 Tông môn khởi lập: ${sectDetails.name} (Tài nguyên: ${sectDetails.resources}, Tụ Linh: ${sectDetails.tu_linh_level}, Luyện Đan: ${sectDetails.dan_duong_level})`);
    // Quyên góp 5000 linh thạch để lấy 5000 tài nguyên
    UserRepository_1.userRepository.update(testUser, { coin_ha_pham: 6000 });
    SectService_1.sectService.donateToSect(testUser, 5000);
    const postDonateSect = SectService_1.sectService.getSectDetails(sectId);
    console.log(`🪙 Tài nguyên Tông môn sau khi quyên góp: ${postDonateSect.resources}`);
    // Nâng cấp Tụ Linh Trận lên cấp 1 (Tốn 1000 tài nguyên)
    const up1 = SectService_1.sectService.upgradeFacility(testUser, 'tuling');
    console.log(up1.message);
    // Nâng cấp Luyện Đan Đường lên cấp 1 (Tốn 1000 tài nguyên)
    const up2 = SectService_1.sectService.upgradeFacility(testUser, 'danduong');
    console.log(up2.message);
    const finalSect = SectService_1.sectService.getSectDetails(sectId);
    console.log(`🏰 Tông môn sau nâng cấp: Tụ Linh: Cấp ${finalSect.tu_linh_level}, Luyện Đan: Cấp ${finalSect.dan_duong_level}, Tài nguyên còn lại: ${finalSect.resources}`);
    if (finalSect.tu_linh_level !== 1 || finalSect.dan_duong_level !== 1 || finalSect.resources !== 3000) {
        throw new Error('Nâng cấp công trình Tông môn tính toán tài nguyên sai lệch!');
    }
    console.log('✅ 4. Logic Nâng cấp Tông môn và công trình hoạt động chính xác.');
    console.log('\n🌟 TẤT CẢ KỊCH BẢN KIỂM THỬ PHIÊN BẢN V3 ĐÃ VƯỢT QUA THÀNH CÔNG 100%! 🌟');
}
runV3Tests().catch(e => {
    console.error('\n❌ BỘ KIỂM THỬ V3 THẤT BẠI:', e);
    process.exit(1);
});
