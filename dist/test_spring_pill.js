"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importStar(require("./database/database"));
const UserRepository_1 = require("./database/repositories/UserRepository");
const InventoryRepository_1 = require("./database/repositories/InventoryRepository");
const InventoryService_1 = require("./services/InventoryService");
const CaveService_1 = require("./services/CaveService");
const CultivationService_1 = require("./services/CultivationService");
async function testSpringAndPill() {
    console.log('🧪 BẮT ĐẦU TEST LINH TUYỀN & CẮN THUỐC... 🧪\n');
    (0, database_1.initDatabase)();
    const testUser = 'test_user_spring_pill';
    database_1.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
    database_1.default.prepare('DELETE FROM user_caves WHERE user_id = ?').run(testUser);
    database_1.default.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);
    // Tạo nhân vật test
    UserRepository_1.userRepository.create({
        discord_id: testUser,
        name: 'Tu Luyện Giả',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.05,
        base_crit_res: 0.01,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Hỏa': 100 })
    });
    const user = UserRepository_1.userRepository.get(testUser);
    console.log(`Ban đầu: Level: ${user.level}, Tu Vi: ${user.tu_vi}/${user.exp_needed}`);
    // Test Linh Tuyền Động Phủ
    console.log('\n--- TEST LINH TUYỀN ---');
    const collectRes = CaveService_1.caveService.collectSpring(testUser);
    console.log(`Collect Spring Result: ${collectRes.message}`);
    // Kiểm tra DB trực tiếp
    let dbUser = database_1.default.prepare('SELECT tu_vi, updated_at FROM users WHERE discord_id = ?').get(testUser);
    console.log(`DB User sau khi ngâm Linh Tuyền: Tu Vi: ${dbUser.tu_vi}, updated_at: ${dbUser.updated_at}`);
    // Kiểm tra qua userRepository.get (sẽ dùng cache hoặc DB)
    let repoUser = UserRepository_1.userRepository.get(testUser);
    console.log(`Repo User sau khi ngâm Linh Tuyền: Tu Vi: ${repoUser.tu_vi}, updated_at: ${repoUser.updated_at}`);
    // Mô phỏng claimIdleCultivation trong /hoso
    const claimRes = CultivationService_1.cultivationService.claimIdleCultivation(testUser);
    console.log(`Claim Idle Cultivation: gained: ${claimRes?.gained}, user.tu_vi: ${claimRes?.user.tu_vi}`);
    // Test Cắn Thuốc
    console.log('\n--- TEST CẮN THUỐC ---');
    InventoryRepository_1.inventoryRepository.addItem(testUser, 'pill_tu_vi_low', 2);
    const inv = InventoryRepository_1.inventoryRepository.getUserInventory(testUser);
    const pillItem = inv.find((i) => i.item_id === 'pill_tu_vi_low');
    console.log(`Đã thêm thuốc, ID: #${pillItem.id}, Số lượng: ${pillItem.quantity}`);
    const useRes = InventoryService_1.inventoryService.useItem(testUser, pillItem.id);
    console.log(`Use Item Result: ${useRes.message}`);
    // Kiểm tra DB trực tiếp
    dbUser = database_1.default.prepare('SELECT tu_vi, updated_at FROM users WHERE discord_id = ?').get(testUser);
    console.log(`DB User sau khi cắn thuốc lần 1: Tu Vi: ${dbUser.tu_vi}, updated_at: ${dbUser.updated_at}`);
    // Kiểm tra qua userRepository.get
    repoUser = UserRepository_1.userRepository.get(testUser);
    console.log(`Repo User sau khi cắn thuốc lần 1: Tu Vi: ${repoUser.tu_vi}, updated_at: ${repoUser.updated_at}`);
    // Mô phỏng claimIdleCultivation lần nữa
    const claimRes2 = CultivationService_1.cultivationService.claimIdleCultivation(testUser);
    console.log(`Claim Idle Cultivation 2: gained: ${claimRes2?.gained}, user.tu_vi: ${claimRes2?.user.tu_vi}`);
    console.log('\n🌟 HOÀN TẤT TEST LINH TUYỀN & CẮN THUỐC 🌟');
}
testSpringAndPill().catch(e => console.error(e));
